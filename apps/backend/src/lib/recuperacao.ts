// Recuperação automática de vendas — orquestração (job a cada 5 min + webhook do WhatsApp).
// Regras puras em ./recuperacao-regras.ts; tabelas em ./recuperacao-db.ts; doc em
// architecture/recuperacao.md. Decisões do dono em 2026-09-29:
// - WhatsApp em tom de pessoa ("Camila, da ÉCLAT"): 1ª mensagem só abordagem, oferta só se responder;
// - no máximo 15 abordagens por dia, intervalo sorteado de 15 a 60 min, só das 9h às 19h;
// - e-mail pelo Resend para quem deixou e-mail;
// - quatro ocasiões: lead do site, carrinho abandonado com contato, Pix não pago, lead de anúncio parado.
// Freios: dois interruptores (WhatsApp e e-mail, desligados de início), sessão do WhatsApp aberta,
// 1 abordagem por rodada, uma ocasião por pessoa a cada 30 dias, confere compra antes de cada envio,
// pausa sozinha depois de 3 falhas seguidas. Log sem telefone nem e-mail.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { configDoAmbiente, entraNaLista } from "../api/admin/carrinhos-abandonados/filtro"
import { connectionState, evolutionConfigured, EvolutionHttpError, sendWhatsappText } from "./evolution"
import { getPrevenda } from "./prevenda"
import {
  ativaPorContatoChave, atualizar, contarAbordagensDesde, getConfig, inserir, listar, porChave,
  recentesDaPessoa, recuperacaoDbConfigured, reservar, updateConfig, type Recuperacao, type RecuperacaoConfig,
} from "./recuperacao-db"
import {
  chaveContato, deveMandarEmail, dentroDaJanela, ehPedidoDeParada, inicioDoDiaLocal, linkDaOferta,
  motivoParaEncerrar, ocasiaoDoCarrinho, ocasiaoDoLeadAnuncio, ocasiaoDoLeadSite, PRIORIDADE, resumoItens,
  sortearIntervaloMs, tempoDigitandoMs, textoAbordagem, textoOferta, TEXTO_PARADA,
  type CarrinhoBruto, type LeadBruto, type Ocasiao,
} from "./recuperacao-regras"
import { getOrCreateConversation, getOrCreateLeadByWhatsapp, insertMessageIdempotent, sbSelect, updateLead } from "./supabase"

type Log = { info: (m: string) => void; warn: (m: string) => void }

const LOJA_URL = process.env.STOREFRONT_URL || "https://www.useeclat.com.br"
const INSTANCIA = process.env.EVOLUTION_INSTANCE || "eclat"
const HORA = 3600_000
const MIN = 60_000

// ============================ (1) DETECTOR ============================

const CAMPOS_CARRINHO = [
  "id", "email", "updated_at", "created_at", "completed_at", "metadata",
  "customer.first_name", "customer.email", "customer.phone",
  "shipping_address.first_name", "shipping_address.phone",
  "items.title", "items.variant_title", "items.quantity", "items.unit_price",
  "payment_collection.payment_sessions.provider_id",
  "payment_collection.payment_sessions.status",
  "payment_collection.payment_sessions.data",
]

async function carrinhosParados(container: MedusaContainer, agora: Date): Promise<CarrinhoBruto[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: CAMPOS_CARRINHO,
    filters: {
      completed_at: null,
      updated_at: { $gte: new Date(agora.getTime() - 3 * 24 * HORA), $lte: new Date(agora.getTime() - 30 * MIN) },
    },
    pagination: { take: 200, skip: 0, order: { updated_at: "DESC" } },
  })
  // Mesmo filtro da tela de carrinhos abandonados: testes da equipe e o que é anterior ao marco zero ficam de fora.
  const cfg = configDoAmbiente()
  return ((data ?? []) as unknown as CarrinhoBruto[]).filter((c) => entraNaLista(c as never, cfg))
}

async function leads(origem: "site" | "anuncio", dias: number, agora: Date): Promise<LeadBruto[]> {
  const desde = new Date(agora.getTime() - dias * 24 * HORA).toISOString()
  return sbSelect<LeadBruto>(
    "lead",
    `origem=eq.${origem}&status=eq.novo&created_at=gte.${encodeURIComponent(desde)}&select=id,nome,whatsapp,email,origem,status,created_at&limit=200`
  )
}

async function ultimaMensagemPorLead(leadIds: string[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>()
  if (!leadIds.length) return mapa
  const convs = await sbSelect<{ lead_id: string; ultima_msg_em: string | null }>(
    "conversation",
    `lead_id=in.(${leadIds.join(",")})&select=lead_id,ultima_msg_em`
  )
  for (const c of convs) {
    const atual = mapa.get(c.lead_id)
    if (!atual || (c.ultima_msg_em && c.ultima_msg_em > atual)) mapa.set(c.lead_id, c.ultima_msg_em)
  }
  return mapa
}

/**
 * Registra a ocasião respeitando "uma por pessoa": se a mesma pessoa já tem uma em andamento, a
 * mais quente prevalece (Pix > carrinho > anúncio > lead do site) e a nova fica só no histórico.
 */
async function registrar(oc: Ocasiao, agora: Date): Promise<void> {
  const mesma = await porChave(oc.chave)
  if (mesma) {
    // Carrinho que virou Pix (ou ganhou itens): atualiza enquanto nada foi enviado ou só a abordagem.
    const podeMudar = mesma.etapa === "aguardando" || mesma.etapa === "abordada"
    if (podeMudar && PRIORIDADE[oc.gatilho] >= PRIORIDADE[mesma.gatilho] && oc.gatilho !== mesma.gatilho) {
      await atualizar(mesma.id, {
        gatilho: oc.gatilho,
        dados: oc.dados,
        ...(mesma.etapa === "aguardando" ? { elegivel_em: oc.elegivel_em } : {}),
      })
    }
    return
  }

  const recentes = await recentesDaPessoa(oc.contato_chave, oc.email, new Date(agora.getTime() - 30 * 24 * HORA).toISOString())
  const emAndamento = recentes.find((r) => r.etapa !== "encerrada")
  const base = {
    gatilho: oc.gatilho, chave: oc.chave, contato: oc.contato, contato_chave: oc.contato_chave, email: oc.email,
    nome: oc.nome, cart_id: oc.cart_id ?? null, lead_id: oc.lead_id ?? null, elegivel_em: oc.elegivel_em, dados: oc.dados,
  }
  if (emAndamento) {
    if (
      PRIORIDADE[oc.gatilho] > PRIORIDADE[emAndamento.gatilho] &&
      (emAndamento.etapa === "aguardando" || emAndamento.etapa === "abordada")
    ) {
      await atualizar(emAndamento.id, {
        gatilho: oc.gatilho, dados: oc.dados, cart_id: oc.cart_id ?? emAndamento.cart_id,
        nome: emAndamento.nome ?? oc.nome, email: emAndamento.email ?? oc.email,
        ...(emAndamento.etapa === "aguardando" ? { elegivel_em: oc.elegivel_em } : {}),
      })
    }
    await inserir({ ...base, etapa: "encerrada", motivo_fim: "mesma_pessoa" })
    return
  }
  if (recentes.length) {
    await inserir({ ...base, etapa: "encerrada", motivo_fim: "contatada_recentemente" })
    return
  }
  await inserir(base)
}

export async function rodarDetector(container: MedusaContainer, log: Log): Promise<void> {
  if (!recuperacaoDbConfigured()) return
  const cfg = await getConfig()
  if (!cfg || (!cfg.whatsapp_ativo && !cfg.email_ativo)) return
  const agora = new Date()
  const ocasioes: Ocasiao[] = []

  for (const c of await carrinhosParados(container, agora)) {
    const oc = ocasiaoDoCarrinho(c, agora)
    if (oc) ocasioes.push(oc)
  }
  for (const l of await leads("site", 7, agora)) {
    const oc = ocasiaoDoLeadSite(l, agora)
    if (oc) ocasioes.push(oc)
  }
  const anuncio = await leads("anuncio", 14, agora)
  const ultimas = await ultimaMensagemPorLead(anuncio.map((l) => l.id))
  for (const l of anuncio) {
    const oc = ocasiaoDoLeadAnuncio(l, ultimas.get(l.id) ?? null, agora)
    if (oc) ocasioes.push(oc)
  }

  // Mais quentes primeiro: o carrinho de uma pessoa entra antes do lead do site dela.
  ocasioes.sort((a, b) => PRIORIDADE[b.gatilho] - PRIORIDADE[a.gatilho])
  let erros = 0
  for (const oc of ocasioes) {
    try {
      await registrar(oc, agora)
    } catch (e) {
      erros++
      if (erros <= 3) log.warn(`[recuperacao] ocasião ${oc.chave.split(":")[0]} não registrada: ${(e as Error).message}`)
    }
  }
}

// ============================ (2) CONFERÊNCIAS ============================

type Pedido = { email: string | null; created_at: string; metadata: Record<string, unknown> | null; shipping_address: { phone: string | null } | null }

/** Pedidos recentes, lidos uma vez por rodada (o volume da loja cabe folgado). */
async function pedidosRecentes(container: MedusaContainer, agora: Date): Promise<Pedido[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["email", "created_at", "metadata", "shipping_address.phone"],
    filters: { created_at: { $gte: new Date(agora.getTime() - 35 * 24 * HORA) } },
    pagination: { take: 500, skip: 0 },
  })
  return (data ?? []) as unknown as Pedido[]
}

async function carrinhoConcluido(container: MedusaContainer, cartId: string): Promise<boolean> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "cart", fields: ["id", "completed_at"], filters: { id: cartId } })
  return Boolean((data?.[0] as { completed_at?: unknown } | undefined)?.completed_at)
}

/** Comprou depois (ou pouco antes) da ocasião? Pelo carrinho, pelo e-mail ou pelo telefone do pedido. */
async function comprou(container: MedusaContainer, r: Recuperacao, pedidos: Pedido[]): Promise<boolean> {
  if (r.cart_id && (await carrinhoConcluido(container, r.cart_id))) return true
  const desde = Date.parse(r.criado_em) - 24 * HORA
  const email = r.email?.toLowerCase() || null
  return pedidos.some((p) => {
    if (Date.parse(p.created_at) < desde) return false
    if (email && p.email?.toLowerCase() === email) return true
    const tel = chaveContato(p.shipping_address?.phone ?? (p.metadata?.whatsapp as string | undefined) ?? null)
    return Boolean(r.contato_chave && tel && tel === r.contato_chave)
  })
}

/** Conversa humana nas últimas 24 h com essa pessoa → a equipe já está falando com ela. */
async function conversaRecente(r: Recuperacao, agora: Date): Promise<boolean> {
  if (!r.contato || !r.contato_chave) return false
  const numeros = Array.from(new Set([r.contato, r.contato_chave]))
  const convs = await sbSelect<{ ultima_msg_em: string | null }>(
    "conversation",
    `contato_e164=in.(${numeros.join(",")})&select=ultima_msg_em`
  )
  return convs.some((c) => c.ultima_msg_em && agora.getTime() - Date.parse(c.ultima_msg_em) < 24 * HORA)
}

// ============================ (3) ENVIO ============================

type RespostaEvolution = { key?: { id?: string; remoteJid?: string } }

/** Envia com "digitando…" e registra na conversa do Cockpit (origem "ia"). Devolve o id da conversa. */
async function enviarWhatsapp(r: Recuperacao, texto: string, etiqueta: string): Promise<string | null> {
  const resp = (await sendWhatsappText(r.contato as string, texto, tempoDigitandoMs(texto), { timeoutMs: 30_000 })) as RespostaEvolution
  // O JID devolvido é o número como o WhatsApp o conhece (às vezes sem o nono dígito): é por ele
  // que o webhook vai achar a conversa quando a pessoa responder.
  const numero = resp?.key?.remoteJid?.replace(/@.*/, "") || r.contato_chave || (r.contato as string)
  let conversationId = r.conversation_id
  try {
    if (!conversationId) {
      const leadId = r.lead_id ?? (await getOrCreateLeadByWhatsapp(numero, { nome: r.nome ?? "Contato WhatsApp", origem: "site", status: "novo" }))
      conversationId = await getOrCreateConversation(numero, INSTANCIA, { nome_contato: r.nome ?? "Contato WhatsApp", lead_id: leadId, alvo_tipo: "lead" })
    }
    await insertMessageIdempotent({
      conversation_id: conversationId, direcao: "out", tipo: "texto", texto, media_mime: null, status: null,
      origem: "ia", timestamp: new Date().toISOString(), evolution_msg_id: resp?.key?.id || `recuperacao_${r.id}_${etiqueta}`,
    })
  } catch {
    // Registro no Cockpit é secundário: a mensagem já saiu.
  }
  return conversationId
}

async function registrarFalha(cfg: RecuperacaoConfig, log: Log, motivo: string): Promise<void> {
  const falhas = cfg.falhas_seguidas + 1
  const pausar = falhas >= 3
  await updateConfig({ falhas_seguidas: falhas, ...(pausar ? { whatsapp_ativo: false } : {}) })
  log.warn(`[recuperacao] envio falhou (${motivo}); falhas seguidas: ${falhas}${pausar ? " — WhatsApp PAUSADO" : ""}`)
}

async function encerrarVencidas(agora: Date): Promise<void> {
  const abertas = await listar("etapa=in.(aguardando,abordada)&order=criado_em.asc&limit=200")
  for (const r of abertas) {
    const motivo = motivoParaEncerrar(r, agora)
    if (motivo) await atualizar(r.id, { etapa: "encerrada", motivo_fim: motivo })
  }
}

async function enviarOfertas(container: MedusaContainer, cfg: RecuperacaoConfig, pedidos: Pedido[], agora: Date, log: Log) {
  const prontas = await listar(`etapa=eq.respondeu&oferta_apos=lte.${encodeURIComponent(agora.toISOString())}&order=oferta_apos.asc&limit=5`)
  for (const r of prontas) {
    if (await comprou(container, r, pedidos)) {
      await atualizar(r.id, { etapa: "encerrada", motivo_fim: "comprou" })
      continue
    }
    const texto = textoOferta({ gatilho: r.gatilho, dados: r.dados ?? {}, cupom: cfg.cupom, link: linkDaOferta(r.gatilho, LOJA_URL) })
    if (!(await reservar(r.id, "respondeu", { etapa: "oferta_enviada", oferta_em: agora.toISOString(), oferta_texto: texto }))) continue
    try {
      const conv = await enviarWhatsapp(r, texto, "oferta")
      if (conv && conv !== r.conversation_id) await atualizar(r.id, { conversation_id: conv })
      log.info(`[recuperacao] oferta enviada (${r.gatilho})`)
    } catch (e) {
      await atualizar(r.id, { etapa: "respondeu", oferta_em: null, oferta_texto: null })
      await registrarFalha(cfg, log, e instanceof EvolutionHttpError ? `HTTP ${e.status}` : (e as Error).name)
      return
    }
  }
}

async function enviarEmails(container: MedusaContainer, cfg: RecuperacaoConfig, pedidos: Pedido[], agora: Date, log: Log) {
  if (!cfg.email_ativo || !process.env.RESEND_API_KEY) return
  const candidatas = await listar(
    `etapa=in.(aguardando,abordada)&email=not.is.null&email_em=is.null&elegivel_em=lte.${encodeURIComponent(agora.toISOString())}&order=elegivel_em.asc&limit=20`
  )
  const whatsappLigado = cfg.whatsapp_ativo && evolutionConfigured()
  const whatsappDaMarca = (await getPrevenda()).whatsapp
  for (const r of candidatas) {
    if (!deveMandarEmail(r, whatsappLigado, agora)) continue
    if (await comprou(container, r, pedidos)) {
      await atualizar(r.id, { etapa: "encerrada", motivo_fim: "comprou" })
      continue
    }
    try {
      await container.resolve(Modules.NOTIFICATION).createNotifications({
        to: r.email as string,
        channel: "email",
        template: "recuperacao",
        trigger_type: "recuperacao",
        resource_type: "recuperacao",
        resource_id: r.id,
        idempotency_key: `recuperacao-${r.id}`,
        data: {
          gatilho: r.gatilho,
          primeiroNome: r.nome,
          itens: resumoItens(r.dados?.itens),
          cupom: cfg.cupom,
          link: linkDaOferta(r.gatilho, LOJA_URL),
          lojaUrl: LOJA_URL,
          whatsapp: whatsappDaMarca,
          idempotencia: `recuperacao-${r.id}`,
        },
      })
      // Sem WhatsApp, o e-mail é o único contato: a ocasião termina aqui.
      await atualizar(r.id, { email_em: agora.toISOString(), ...(r.contato ? {} : { etapa: "encerrada", motivo_fim: "so_email" }) })
      log.info(`[recuperacao] e-mail enviado (${r.gatilho})`)
    } catch (e) {
      log.warn(`[recuperacao] e-mail falhou (${r.gatilho}): ${(e as Error).name}`)
    }
  }
}

async function enviarAbordagem(container: MedusaContainer, cfg: RecuperacaoConfig, pedidos: Pedido[], agora: Date, log: Log) {
  if (!cfg.whatsapp_ativo || !evolutionConfigured()) return
  if (!dentroDaJanela(cfg.janela_inicio, cfg.janela_fim, agora)) return
  if (cfg.proximo_envio_em && Date.parse(cfg.proximo_envio_em) > agora.getTime()) return
  if ((await contarAbordagensDesde(inicioDoDiaLocal(agora))) >= cfg.max_abordagens_dia) return

  const fila = await listar(
    `etapa=eq.aguardando&contato=not.is.null&elegivel_em=lte.${encodeURIComponent(agora.toISOString())}&order=elegivel_em.asc&limit=10`
  )
  if (!fila.length) return
  if ((await connectionState()) !== "open") {
    log.warn("[recuperacao] WhatsApp desconectado — abordagens em espera")
    return
  }

  for (const r of fila) {
    if (await comprou(container, r, pedidos)) {
      await atualizar(r.id, { etapa: "encerrada", motivo_fim: "comprou" })
      continue
    }
    if (r.gatilho !== "anuncio" && (await conversaRecente(r, agora))) {
      await atualizar(r.id, { etapa: "encerrada", motivo_fim: "ja_em_conversa" })
      continue
    }

    const texto = textoAbordagem({ persona: cfg.persona, nome: r.nome, gatilho: r.gatilho })
    if (!(await reservar(r.id, "aguardando", { etapa: "abordada", abordagem_em: agora.toISOString(), abordagem_texto: texto }))) continue
    // O intervalo conta a partir da tentativa: nem um erro faz a próxima sair colada.
    const proximo = new Date(agora.getTime() + sortearIntervaloMs(cfg.intervalo_min_min, cfg.intervalo_max_min)).toISOString()
    try {
      const conv = await enviarWhatsapp(r, texto, "abordagem")
      await updateConfig({ proximo_envio_em: proximo, falhas_seguidas: 0 })
      if (conv && conv !== r.conversation_id) await atualizar(r.id, { conversation_id: conv })
      if (r.lead_id) await updateLead(r.lead_id, { status: "contatado" }).catch(() => undefined)
      log.info(`[recuperacao] abordagem enviada (${r.gatilho}); próxima a partir de ${proximo}`)
    } catch (e) {
      if (e instanceof EvolutionHttpError && e.numeroInexistente) {
        await atualizar(r.id, { etapa: "encerrada", motivo_fim: "sem_whatsapp", abordagem_em: null })
        await updateConfig({ proximo_envio_em: proximo })
      } else {
        await atualizar(r.id, { etapa: "aguardando", abordagem_em: null, abordagem_texto: null })
        await updateConfig({ proximo_envio_em: proximo })
        await registrarFalha(cfg, log, e instanceof EvolutionHttpError ? `HTTP ${e.status}` : (e as Error).name)
      }
    }
    return // uma abordagem por rodada, no máximo
  }
}

export async function rodarEnvios(container: MedusaContainer, log: Log): Promise<void> {
  if (!recuperacaoDbConfigured()) return
  const cfg = await getConfig()
  if (!cfg || (!cfg.whatsapp_ativo && !cfg.email_ativo)) return
  const agora = new Date()
  await encerrarVencidas(agora)
  const pedidos = await pedidosRecentes(container, agora)
  if (cfg.whatsapp_ativo && evolutionConfigured() && dentroDaJanela(cfg.janela_inicio, cfg.janela_fim, agora)) {
    await enviarOfertas(container, cfg, pedidos, agora, log)
  }
  await enviarEmails(container, cfg, pedidos, agora, log)
  await enviarAbordagem(container, cfg, pedidos, agora, log)
}

// ============================ (4) RESPOSTAS (webhook) ============================

/**
 * Chamado pelo webhook do WhatsApp a cada mensagem individual. Se a pessoa está numa recuperação:
 * - respondeu à abordagem → a oferta é agendada para 1 a 3 min depois (o job envia);
 * - pediu para parar → encerra e responde educadamente;
 * - alguém da equipe escreveu pelo celular → a conversa é humana, a automação sai de cena.
 */
export async function tratarMensagemRecebida(p: { number: string; fromMe: boolean; texto: string; log: Log }): Promise<void> {
  if (!recuperacaoDbConfigured()) return
  const chave = chaveContato(p.number)
  if (!chave) return
  const r = await ativaPorContatoChave(chave)
  if (!r) return
  const agora = new Date()

  if (p.fromMe) {
    // Eco da própria automação (se a Evolution devolver o envio da API no webhook) não conta como humano.
    if (p.texto === r.abordagem_texto || p.texto === r.oferta_texto || p.texto === TEXTO_PARADA) return
    if (r.etapa === "abordada" || r.etapa === "respondeu") {
      await atualizar(r.id, { etapa: "encerrada", motivo_fim: "humano_assumiu" })
      p.log.info("[recuperacao] equipe assumiu a conversa; automação encerrada")
    }
    return
  }

  if (ehPedidoDeParada(p.texto)) {
    await atualizar(r.id, { etapa: "encerrada", motivo_fim: "pediu_para_parar", resposta_em: r.resposta_em ?? agora.toISOString() })
    if (evolutionConfigured()) {
      try {
        await enviarWhatsapp({ ...r, contato: p.number }, TEXTO_PARADA, "parada")
      } catch {
        // sem resposta educada, mas a automação já parou — o que importa
      }
    }
    return
  }

  if (r.etapa === "abordada") {
    const atraso = 60_000 + Math.round(Math.random() * 120_000)
    await atualizar(r.id, { etapa: "respondeu", resposta_em: agora.toISOString(), oferta_apos: new Date(agora.getTime() + atraso).toISOString() })
    p.log.info(`[recuperacao] pessoa respondeu (${r.gatilho}); oferta agendada`)
  }
}
