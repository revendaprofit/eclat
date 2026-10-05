// Aviso de venda para a creator (desenho 2026-09-29-programa-creators-design.md, C1–C5 e C14).
//
// A cada pedido pago com o cupom de uma parceria, a creator recebe UMA mensagem no WhatsApp: número do pedido,
// valor das peças, comissão prevista, total do mês e quanto falta para a 2ª peça. É a única automação que escreve
// para alguém que não escreveu antes — autorizada pelo dono só para quem tem `parceria.aceite_avisos = true`.
//
// Chamado de dois lugares: o subscriber de `order.placed` (na hora) e o job de 5 minutos (o que ficou pendente
// por horário, teto ou falha passageira). Dois chamadores ao mesmo tempo nunca mandam duas vezes: a trava é a
// transição condicional `pendente → enviando` no Postgres (lib/parceria-db.ts, `mudarAviso`).
//
// ESTADOS de `parceria_aviso.status`:
//   pendente      — registrado, ainda não saiu (fora do horário, teto da hora, falha passageira).
//   enviando      — reservado por um chamador. Transitório.
//   enviado       — saiu. Final.
//   dispensado    — não vai sair: parceria sem comissão, sem aceite, inativa, ou pendente há mais de 24 h. Final.
//   sem_whatsapp  — parceria sem número, ou a Evolution disse que o número não tem WhatsApp. Final.
//   incerto       — o envio estourou o tempo ou ficou em `enviando` mais de 10 min: PODE ter saído. Final;
//                   ninguém reenvia. DUPLICAR É PIOR QUE FALTAR.
//
// DADO PESSOAL: nenhum log leva telefone, nome ou corpo de resposta. Só número do pedido, código e status.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EvolutionHttpError, evolutionConfigured, sendWhatsappText } from "./evolution"
import { getOrCreateConversation, insertMessageIdempotent } from "./supabase"
import { aposVendaDaParceria } from "./creator-ciclo"
import {
  avisoDoPedido, avisosEnviadosDesde, criarAviso, entregaDoNumero, listarAvisos, listarParcerias, mudarAviso,
  parceriaDbConfigured, parceriaPorCodigo, vendasDaParceria, type Aviso,
} from "./parceria-db"
import {
  comissaoCentavos, cupomDeParceria, dentroDoHorario, destinoDoAviso, inicioDoMes, limparNumeroDoVideo, paraCentavos,
  TETO_AVISOS_POR_HORA, textoAviso,
} from "./parceria-regras"

type Log = { info: (m: string) => void; warn: (m: string) => void }
type RespostaEvolution = { key?: { id?: string; remoteJid?: string } }

const INSTANCIA = process.env.EVOLUTION_INSTANCE || "eclat"
const TIMEOUT_WHATSAPP_MS = 15_000
const DIGITANDO_MS = 4_000 // C5: "digitando" de 3–5 s
const PENDENTE_MAX_MS = 24 * 60 * 60 * 1000
const ENVIANDO_MAX_MS = 10 * 60 * 1000

/** Pedido de teste da equipe (mesma convenção das outras automações): nunca avisa creator. */
const ehPedidoDeTeste = (email?: string | null) => (email ?? "").toLowerCase().endsWith("@eclat.local")

/**
 * Registra a venda do pedido (se ele tem cupom de parceria) e tenta avisar. Nunca lança: falha aqui não pode
 * afetar o pedido.
 */
export async function registrarVendaDeParceria(container: MedusaContainer, orderId: string, log: Log): Promise<void> {
  if (!parceriaDbConfigured()) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [pedido],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "status", "email", "created_at", "item_total", "metadata", "promotions.code"],
    filters: { id: orderId },
  })
  if (!pedido || ehPedidoDeTeste(pedido.email)) return
  const codigosDoPedido = ((pedido as any).promotions ?? []).map((p: { code?: string | null }) => p?.code)
  if (!codigosDoPedido.some(Boolean)) return // caminho comum: pedido sem cupom, nenhuma consulta a mais

  const parcerias = await listarParcerias()
  const codigo = cupomDeParceria(codigosDoPedido, parcerias.map((p) => p.codigo))
  if (!codigo) return
  const parceria = parcerias.find((p) => p.codigo.toUpperCase() === codigo)!

  // De qual vídeo veio (C11): só vale se o link era da MESMA parceria do cupom usado.
  const meta = ((pedido as any).metadata ?? {}) as Record<string, unknown>
  const veioPeloLink = typeof meta.parceria_link === "string" && meta.parceria_link.toUpperCase() === codigo
  const numero = veioPeloLink ? limparNumeroDoVideo(String(meta.parceria_conteudo ?? "")) : null
  let entregaId: string | null = null
  if (numero) {
    try {
      entregaId = await entregaDoNumero(parceria.codigo, numero)
    } catch {
      entregaId = null // o vídeo é detalhe: a venda entra do mesmo jeito
    }
  }

  const base = paraCentavos((pedido as any).item_total)
  const aviso = await criarAviso({
    order_id: pedido.id,
    codigo: parceria.codigo,
    display_id: Number((pedido as any).display_id),
    base_centavos: base,
    comissao_centavos: comissaoCentavos(base, parceria.comissao_percentual),
    entrega_id: entregaId,
    veio_pelo_link: veioPeloLink,
    pedido_em: new Date((pedido as any).created_at).toISOString(),
  })
  if (!aviso) return // já estava registrado (o subscriber rodou duas vezes): quem criou cuida do envio
  log.info(`[parceria] venda registrada: pedido #${aviso.display_id} com ${aviso.codigo}`)
  // Sem número de vídeo, a venda vai para o último vídeo dela (até 14 dias); e confere o vídeo vencedor.
  await aposVendaDaParceria(container, parceria.codigo, entregaId, log)
  await entregarAviso(container, aviso, new Date(), log)
}

/** Job de 5 minutos: manda o que ficou pendente e fecha o que travou. Nunca lança. */
export async function rodarAvisosPendentes(container: MedusaContainer, agora: Date, log: Log): Promise<void> {
  if (!parceriaDbConfigured()) return
  let travados: Aviso[] = []
  let pendentes: Aviso[] = []
  try {
    // Tabela ausente (migration 0014 não aplicada) = automação inexistente, sem erro no log a cada 5 min.
    travados = await listarAvisos(`status=eq.enviando&select=*&limit=20`)
    pendentes = await listarAvisos(`status=eq.pendente&select=*&order=desde.asc&limit=20`)
  } catch {
    return
  }
  for (const a of travados) {
    const desde = new Date(a.enviado_em ?? a.desde).getTime()
    if (agora.getTime() - desde > ENVIANDO_MAX_MS) {
      if (await mudarAviso(a.order_id, "enviando", { status: "incerto" })) log.warn(`[parceria] aviso do pedido #${a.display_id}: incerto (travado em envio)`)
    }
  }
  for (const a of pendentes) await entregarAviso(container, a, agora, log)
}

async function entregarAviso(container: MedusaContainer, aviso: Aviso, agora: Date, log: Log): Promise<void> {
  try {
    const parceria = await parceriaPorCodigo(aviso.codigo)
    const destino = parceria ? destinoDoAviso(parceria) : "dispensado"
    if (destino !== "avisar") {
      await mudarAviso(aviso.order_id, "pendente", { status: destino })
      return
    }
    if (agora.getTime() - new Date(aviso.desde).getTime() > PENDENTE_MAX_MS) {
      await mudarAviso(aviso.order_id, "pendente", { status: "dispensado" })
      log.warn(`[parceria] aviso do pedido #${aviso.display_id}: dispensado (24 h pendente)`)
      return
    }
    if (!evolutionConfigured() || !dentroDoHorario(agora)) return // fica pendente; o job manda às 8h
    if ((await avisosEnviadosDesde(new Date(agora.getTime() - 60 * 60 * 1000).toISOString())) >= TETO_AVISOS_POR_HORA) return

    // Pedido cancelado antes de o aviso sair (ficou pendente de madrugada): não avisa.
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const vendas = await vendasDaParceria(aviso.codigo)
    const { data: pedidos } = await query.graph({
      entity: "order",
      fields: ["id", "status"],
      filters: { id: vendas.map((v) => v.order_id) },
    })
    const cancelados = new Set((pedidos as { id: string; status?: string }[]).filter((p) => p.status === "canceled").map((p) => p.id))
    if (cancelados.has(aviso.order_id)) {
      await mudarAviso(aviso.order_id, "pendente", { status: "dispensado" })
      return
    }
    const contam = vendas.filter((v) => !cancelados.has(v.order_id))
    const mes = inicioDoMes(agora)
    const doMes = contam.filter((v) => v.pedido_em >= mes)
    const texto = textoAviso({
      nome: parceria!.nome,
      codigo: parceria!.codigo,
      displayId: aviso.display_id,
      baseCentavos: aviso.base_centavos,
      comissaoCentavos: aviso.comissao_centavos,
      vendasNoMes: doMes.length,
      comissaoNoMesCentavos: doMes.reduce((s, v) => s + v.comissao_centavos, 0),
      vendasQueContam: contam.length,
    })

    // Reserva: a partir daqui só este chamador envia. `enviado_em` guarda a hora da reserva até o envio fechar.
    if (!(await mudarAviso(aviso.order_id, "pendente", { status: "enviando", texto, enviado_em: agora.toISOString() }))) return

    const numero = (parceria!.whatsapp as string).replace(/\D/g, "")
    let resp: RespostaEvolution
    try {
      resp = (await sendWhatsappText(numero, texto, DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS + DIGITANDO_MS })) as RespostaEvolution
    } catch (e) {
      if (e instanceof EvolutionHttpError) {
        if (e.numeroInexistente) {
          await mudarAviso(aviso.order_id, "enviando", { status: "sem_whatsapp", enviado_em: null })
          log.warn(`[parceria] aviso do pedido #${aviso.display_id}: número sem WhatsApp`)
        } else {
          // A Evolution RESPONDEU com erro: nada saiu. Volta a pendente e o job tenta de novo.
          await mudarAviso(aviso.order_id, "enviando", { status: "pendente", enviado_em: null })
          log.warn(`[parceria] aviso do pedido #${aviso.display_id}: falhou (HTTP ${e.status}), segue pendente`)
        }
      } else {
        // Tempo estourado ou rede: pode ter saído. Não reenvia.
        await mudarAviso(aviso.order_id, "enviando", { status: "incerto" })
        log.warn(`[parceria] aviso do pedido #${aviso.display_id}: incerto (${(e as Error).name})`)
      }
      return
    }
    await mudarAviso(aviso.order_id, "enviando", { status: "enviado", enviado_em: new Date().toISOString() })
    log.info(`[parceria] aviso enviado: pedido #${aviso.display_id} (${aviso.codigo})`)

    // Registro na tela de Conversas do Cockpit: secundário, a mensagem já saiu.
    try {
      const contato = resp?.key?.remoteJid?.replace(/@.*/, "") || numero
      const conversationId = await getOrCreateConversation(contato, INSTANCIA, { nome_contato: parceria!.nome })
      await insertMessageIdempotent({
        conversation_id: conversationId, direcao: "out", tipo: "texto", texto, media_mime: null, status: null,
        origem: "ia", timestamp: new Date().toISOString(), evolution_msg_id: resp?.key?.id || `parceria_${aviso.order_id}`,
      })
    } catch {
      /* só o registro */
    }
  } catch (e) {
    log.warn(`[parceria] aviso do pedido #${aviso.display_id}: erro (${(e as Error).message})`)
  }
}

/** Para a rota de teste e o Cockpit: o aviso de um pedido. */
export { avisoDoPedido }
