// Pedido de avaliação pelo WhatsApp — orquestração (job a cada 5 min + webhook do WhatsApp).
// Regras puras em ./avaliacao-regras.ts; tabelas em ./avaliacao-db.ts; doc em architecture/avaliacao.md.
// Decisões do dono em 2026-09-30: 3 dias depois de entregue (10 dias depois do despacho sem dado de
// entrega); 1ª mensagem sem link pergunta o que achou; se ela responder, a 2ª pede autorização para
// publicar no site (o "sim" fica registrado); publicar é um clique no Cockpit; nada em troca.
// Freios: os da recuperação (recuperacao_config: janela, intervalo sorteado, próximo envio, teto diário
// COMPARTILHADO), sessão `open`, 1 pedido por rodada, 1 por pessoa a cada 60 dias, pausa depois de 3
// falhas seguidas. Log sem telefone.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ativaAvaliacaoPorContato, atualizarAvaliacao, avaliacaoDbConfigured, contarPedidosDeAvaliacaoDesde, getConfigAvaliacao,
  inserirAvaliacao, listarAvaliacoes, pedidosJaRegistrados, recentePorContato, reservarAvaliacao,
  type Avaliacao, type AvaliacaoConfig,
} from "./avaliacao-db"
import {
  candidataDoPedido, classificarAutorizacao, JANELA_POR_PESSOA_DIAS, motivoParaEncerrar, textoAutorizacao, textoPedido,
  TEXTO_AUTORIZOU, TEXTO_NAO_AUTORIZOU, type PedidoBruto,
} from "./avaliacao-regras"
import { connectionState, evolutionConfigured, EvolutionHttpError, sendWhatsappText } from "./evolution"
import { contarAbordagensDesde, getConfig as getConfigRecuperacao, updateConfig as updateConfigRecuperacao } from "./recuperacao-db"
import {
  chaveContato, dentroDaJanela, ehPedidoDeParada, inicioDoDiaLocal, sortearIntervaloMs, tempoDigitandoMs, TEXTO_PARADA,
} from "./recuperacao-regras"
import { getOrCreateConversation, getOrCreateLeadByWhatsapp, insertMessageIdempotent, sbSelect } from "./supabase"

type Log = { info: (m: string) => void; warn: (m: string) => void }

const INSTANCIA = process.env.EVOLUTION_INSTANCE || "eclat"
const HORA = 3600_000
const DIA = 24 * HORA

// ============================ (1) DETECTOR ============================

const CAMPOS_PEDIDO = [
  "id", "display_id", "created_at", "status", "email", "metadata",
  "shipping_address.first_name", "shipping_address.phone",
  "items.title", "items.product_title", "items.quantity",
  "fulfillments.shipped_at", "fulfillments.delivered_at", "fulfillments.canceled_at",
]

export async function detectarAvaliacoes(container: MedusaContainer, cfg: AvaliacaoConfig, log: Log): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const desde = new Date(Math.max(Date.parse(cfg.marco_zero), Date.now() - 90 * DIA))
  const { data } = await query.graph({
    entity: "order",
    fields: CAMPOS_PEDIDO,
    filters: { created_at: { $gte: desde } },
    pagination: { take: 300, skip: 0, order: { created_at: "ASC" } },
  })
  const pedidos = (data ?? []) as unknown as PedidoBruto[]
  if (!pedidos.length) return
  const jaTem = await pedidosJaRegistrados(pedidos.map((p) => p.id))
  for (const p of pedidos) {
    if (jaTem.has(p.id)) continue
    const c = candidataDoPedido(p, cfg)
    if ("fora" in c) continue // não despachado ainda entra numa rodada futura
    try {
      const recente = await recentePorContato(c.contato_chave, new Date(Date.now() - JANELA_POR_PESSOA_DIAS * DIA).toISOString())
      await inserirAvaliacao({
        ...c,
        origem: "pedido",
        ...(recente ? { etapa: "encerrada", motivo_fim: "pedida_recentemente" } : {}),
      })
    } catch (e) {
      log.warn(`[avaliacao] pedido #${p.display_id} não registrado: ${(e as Error).message}`)
    }
  }
}

// ============================ (2) ENVIO ============================

type RespostaEvolution = { key?: { id?: string; remoteJid?: string } }

/** Envia com "digitando…" e registra na conversa do Cockpit (origem "ia"). Devolve o id da conversa. */
async function enviarWhatsapp(a: Avaliacao, texto: string, etiqueta: string): Promise<string | null> {
  const resp = (await sendWhatsappText(a.contato as string, texto, tempoDigitandoMs(texto), { timeoutMs: 30_000 })) as RespostaEvolution
  const numero = resp?.key?.remoteJid?.replace(/@.*/, "") || a.contato_chave || (a.contato as string)
  let conversationId = a.conversation_id
  try {
    if (!conversationId) {
      const leadId = await getOrCreateLeadByWhatsapp(numero, { nome: a.nome ?? "Cliente", origem: "site", status: "convertido" })
      conversationId = await getOrCreateConversation(numero, INSTANCIA, { nome_contato: a.nome ?? "Cliente", lead_id: leadId, alvo_tipo: "lead" })
    }
    await insertMessageIdempotent({
      conversation_id: conversationId, direcao: "out", tipo: "texto", texto, media_mime: null, status: null,
      origem: "ia", timestamp: new Date().toISOString(), evolution_msg_id: resp?.key?.id || `avaliacao_${a.id}_${etiqueta}`,
    })
  } catch {
    // Registro no Cockpit é secundário: a mensagem já saiu.
  }
  return conversationId
}

async function registrarFalha(log: Log, motivo: string): Promise<void> {
  const rec = await getConfigRecuperacao()
  const falhas = (rec?.falhas_seguidas ?? 0) + 1
  await updateConfigRecuperacao({ falhas_seguidas: falhas })
  if (falhas >= 3) {
    await pausar()
    log.warn(`[avaliacao] envio falhou (${motivo}); ${falhas} falhas seguidas — pedido de avaliação PAUSADO`)
  } else {
    log.warn(`[avaliacao] envio falhou (${motivo}); falhas seguidas: ${falhas}`)
  }
}

async function pausar(): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  await fetch(`${url}/rest/v1/avaliacao_config?id=eq.1`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ ativo: false, updated_at: new Date().toISOString() }),
  }).catch(() => undefined)
}

/** Conversa com mensagem nas últimas 24 h → alguém já está falando com ela: não interrompe. */
async function conversaRecente(a: Avaliacao, agora: Date): Promise<boolean> {
  if (!a.contato || !a.contato_chave) return false
  const numeros = Array.from(new Set([a.contato, a.contato_chave]))
  const convs = await sbSelect<{ ultima_msg_em: string | null }>("conversation", `contato_e164=in.(${numeros.join(",")})&select=ultima_msg_em`)
  return convs.some((c) => c.ultima_msg_em && agora.getTime() - Date.parse(c.ultima_msg_em) < 24 * HORA)
}

async function encerrarVencidas(agora: Date): Promise<void> {
  const abertas = await listarAvaliacoes("etapa=in.(agendada,pedida,autorizacao_pedida)&order=criado_em.asc&limit=200")
  for (const a of abertas) {
    const motivo = motivoParaEncerrar(a, agora)
    if (motivo) await atualizarAvaliacao(a.id, { etapa: "encerrada", motivo_fim: motivo })
  }
}

/** 2ª mensagem (autorização) para quem respondeu — não conta no teto diário, respeita o horário. */
async function enviarAutorizacoes(cfg: AvaliacaoConfig, agora: Date, log: Log): Promise<void> {
  const prontas = await listarAvaliacoes(
    `etapa=eq.respondeu&autorizacao_apos=lte.${encodeURIComponent(agora.toISOString())}&order=autorizacao_apos.asc&limit=5`
  )
  for (const a of prontas) {
    const texto = textoAutorizacao({ modelo: cfg.texto_autorizacao })
    if (!(await reservarAvaliacao(a.id, "respondeu", { etapa: "autorizacao_pedida", autorizacao_em: agora.toISOString(), autorizacao_texto: texto }))) continue
    try {
      const conv = await enviarWhatsapp(a, texto, "autorizacao")
      if (conv && conv !== a.conversation_id) await atualizarAvaliacao(a.id, { conversation_id: conv })
      log.info("[avaliacao] pedido de autorização enviado")
    } catch (e) {
      await atualizarAvaliacao(a.id, { etapa: "respondeu", autorizacao_em: null, autorizacao_texto: null })
      await registrarFalha(log, e instanceof EvolutionHttpError ? `HTTP ${e.status}` : (e as Error).name)
      return
    }
  }
}

/** 1ª mensagem: no máximo uma por rodada, dentro dos freios da recuperação (teto diário somado). */
async function enviarPedido(cfg: AvaliacaoConfig, agora: Date, log: Log): Promise<void> {
  const rec = await getConfigRecuperacao()
  if (!rec) return // sem os freios configurados, não envia
  if (!dentroDaJanela(rec.janela_inicio, rec.janela_fim, agora)) return
  if (rec.proximo_envio_em && Date.parse(rec.proximo_envio_em) > agora.getTime()) return
  const hoje = inicioDoDiaLocal(agora)
  const enviadasHoje = (await contarAbordagensDesde(hoje)) + (await contarPedidosDeAvaliacaoDesde(hoje))
  if (enviadasHoje >= rec.max_abordagens_dia) return

  const fila = await listarAvaliacoes(
    `etapa=eq.agendada&contato=not.is.null&elegivel_em=lte.${encodeURIComponent(agora.toISOString())}&order=elegivel_em.asc&limit=10`
  )
  if (!fila.length) return
  if ((await connectionState()) !== "open") {
    log.warn("[avaliacao] WhatsApp desconectado — pedidos de avaliação em espera")
    return
  }

  for (const a of fila) {
    if (await conversaRecente(a, agora)) {
      await atualizarAvaliacao(a.id, { etapa: "encerrada", motivo_fim: "ja_em_conversa" })
      continue
    }
    const texto = textoPedido({ persona: rec.persona, nome: a.nome, pecas: a.pecas || "as peças", modelo: cfg.texto_pedido })
    if (!(await reservarAvaliacao(a.id, "agendada", { etapa: "pedida", pedido_em: agora.toISOString(), pedido_texto: texto }))) continue
    // O intervalo conta a partir da tentativa e é o MESMO relógio da recuperação: nunca duas mensagens coladas.
    const proximo = new Date(agora.getTime() + sortearIntervaloMs(rec.intervalo_min_min, rec.intervalo_max_min)).toISOString()
    try {
      const conv = await enviarWhatsapp(a, texto, "pedido")
      await updateConfigRecuperacao({ proximo_envio_em: proximo, falhas_seguidas: 0 })
      if (conv && conv !== a.conversation_id) await atualizarAvaliacao(a.id, { conversation_id: conv })
      log.info(`[avaliacao] pedido de avaliação enviado${a.display_id ? ` (pedido #${a.display_id})` : " (manual)"}; próxima a partir de ${proximo}`)
    } catch (e) {
      await updateConfigRecuperacao({ proximo_envio_em: proximo })
      if (e instanceof EvolutionHttpError && e.numeroInexistente) {
        await atualizarAvaliacao(a.id, { etapa: "encerrada", motivo_fim: "sem_whatsapp", pedido_em: null })
      } else {
        await atualizarAvaliacao(a.id, { etapa: "agendada", pedido_em: null, pedido_texto: null })
        await registrarFalha(log, e instanceof EvolutionHttpError ? `HTTP ${e.status}` : (e as Error).name)
      }
    }
    return // um pedido por rodada, no máximo
  }
}

export async function rodarAvaliacoes(container: MedusaContainer, log: Log): Promise<void> {
  if (!avaliacaoDbConfigured()) return
  const cfg = await getConfigAvaliacao()
  if (!cfg || !cfg.ativo) return
  const agora = new Date()
  try {
    await detectarAvaliacoes(container, cfg, log)
  } catch (e) {
    log.warn(`[avaliacao] detector falhou: ${(e as Error).message}`)
  }
  await encerrarVencidas(agora)
  if (!evolutionConfigured()) return
  const rec = await getConfigRecuperacao()
  if (rec && dentroDaJanela(rec.janela_inicio, rec.janela_fim, agora)) await enviarAutorizacoes(cfg, agora, log)
  await enviarPedido(cfg, agora, log)
}

// ============================ (3) RESPOSTAS (webhook) ============================

/**
 * Chamado pelo webhook do WhatsApp a cada mensagem individual. Devolve true quando a mensagem
 * pertence a um pedido de avaliação em andamento (aí a recuperação não a trata).
 * - respondeu ao pedido → guarda a fala EXATA (várias mensagens se juntam) e agenda a autorização (1–3 min);
 * - respondeu à autorização → "sim" registra o consentimento literal; "não" encerra com resposta educada;
 *   resposta ambígua fica para a equipe decidir no Cockpit;
 * - pediu para parar → encerra e responde educadamente;
 * - alguém da equipe escreveu pelo celular → a automação sai de cena.
 */
export async function tratarRespostaDeAvaliacao(p: { number: string; fromMe: boolean; texto: string; tipo?: string; log: Log }): Promise<boolean> {
  if (!avaliacaoDbConfigured()) return false
  const chave = chaveContato(p.number)
  if (!chave) return false
  let a: Avaliacao | null
  try {
    a = await ativaAvaliacaoPorContato(chave)
  } catch {
    return false // tabela ainda não existe
  }
  if (!a) return false
  const agora = new Date()
  const bruto = (p.texto ?? "").trim()
  // "[imagem]", "[áudio]", "[vídeo]": marcador do webhook para mídia sem legenda — não é fala dela.
  const texto = /^\[[^\]]+\]$/.test(bruto) ? "" : bruto

  if (p.fromMe) {
    const nossos = [a.pedido_texto, a.autorizacao_texto, TEXTO_PARADA, TEXTO_AUTORIZOU, TEXTO_NAO_AUTORIZOU]
    if (nossos.includes(bruto)) return true
    await atualizarAvaliacao(a.id, { etapa: "encerrada", motivo_fim: "humano_assumiu" })
    p.log.info("[avaliacao] equipe assumiu a conversa; automação encerrada")
    return true
  }

  if (ehPedidoDeParada(texto) && a.etapa !== "autorizacao_pedida") {
    await atualizarAvaliacao(a.id, { etapa: "encerrada", motivo_fim: "pediu_para_parar", resposta_em: a.resposta_em ?? agora.toISOString() })
    if (evolutionConfigured()) await enviarWhatsapp({ ...a, contato: p.number }, TEXTO_PARADA, "parada").catch(() => undefined)
    return true
  }

  const foto = p.tipo === "imagem" || p.tipo === "image" || p.tipo === "video"
  if (a.etapa === "pedida" || a.etapa === "respondeu") {
    // Várias mensagens seguidas viram uma fala só, na ordem em que chegaram, sem edição.
    const fala = texto ? (a.resposta_texto ? `${a.resposta_texto}\n${texto}` : texto) : a.resposta_texto
    const primeira = a.etapa === "pedida"
    await atualizarAvaliacao(a.id, {
      etapa: "respondeu",
      resposta_texto: fala,
      tem_foto: a.tem_foto || foto,
      ...(primeira
        ? { resposta_em: agora.toISOString(), autorizacao_apos: new Date(agora.getTime() + 60_000 + Math.round(Math.random() * 120_000)).toISOString() }
        : {}),
    })
    if (primeira) p.log.info("[avaliacao] cliente respondeu; autorização agendada")
    return true
  }

  if (a.etapa === "autorizacao_pedida") {
    const decisao = classificarAutorizacao(texto)
    if (decisao === "sim") {
      await atualizarAvaliacao(a.id, { etapa: "autorizada", autorizou_texto: texto, autorizou_em: agora.toISOString() })
      if (evolutionConfigured()) await enviarWhatsapp({ ...a, contato: p.number }, TEXTO_AUTORIZOU, "autorizou").catch(() => undefined)
      p.log.info("[avaliacao] cliente autorizou publicar")
    } else if (decisao === "nao") {
      await atualizarAvaliacao(a.id, { etapa: "encerrada", motivo_fim: "nao_autorizou", autorizou_texto: texto })
      if (evolutionConfigured()) await enviarWhatsapp({ ...a, contato: p.number }, TEXTO_NAO_AUTORIZOU, "nao_autorizou").catch(() => undefined)
    } else {
      // Ambígua: guarda o que ela disse; a equipe decide no Cockpit (fica em autorizacao_pedida).
      await atualizarAvaliacao(a.id, { autorizou_texto: texto || a.autorizou_texto })
    }
    return true
  }
  return false
}
