import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EvolutionHttpError, evolutionConfigured, sendWhatsappText } from "../../../lib/evolution"
import { normalizaWhatsapp, textoDespacho, textoEntregue, textoPostado } from "../../../lib/superfrete-avisos"
import { acaoDoEvento, assinaturaSuperfreteValida, numeroDoPedido, rastreioDoEvento } from "../../../lib/superfrete-webhook"

// Webhook de status da SuperFrete (spec 2026-09-20-avisos-entrega-superfrete-design.md §4.2–§4.4).
// Envelope: { event, data }, assinado em `X-ME-Signature` com HMAC-SHA256 do CORPO CRU.
//
// O corpo é DADO NÃO CONFIÁVEL mesmo depois de autenticado. A assinatura prova quem mandou, não
// que o conteúdo diz respeito a nós: por isso a rota nunca age só pelo `event`. Ela exige que a
// tag traga o `display_id` de um pedido NOSSO e que o `data.id` da etiqueta bata com o
// `metadata.frete.superfrete_id` que o Cockpit gravou ao comprá-la. Nada vindo do corpo vira
// decisão de dinheiro, de estoque ou de estado do pedido no Medusa — só texto no `metadata` e uma
// mensagem para a cliente.
//
// POR QUE CADA CÓDIGO HTTP (a SuperFrete reenvia até 5 vezes, a cada 15 min, quando não recebe
// resposta boa em 30 s — §4.4; logo, o código é o nosso controle de retentativa dela):
//   401 — assinatura inválida. Quem assina errado não é a SuperFrete; não merece 200 nem retentativa.
//   200 — TUDO o que não é envio: sem segredo configurado, evento fora da tabela, sem tag, pedido
//         não encontrado, etiqueta de outra origem, aviso já enviado, e também o caso em que o
//         evento foi gravado e não havia mensagem a mandar. Nenhum deles melhora com retentativa,
//         e 500 aqui viraria 5 reenvios por nada. O "sem segredo" em especial: um deploy sem a
//         variável não pode derrubar o backend nem gerar reenvio infinito.
//   500 — DE PROPÓSITO, e só num caso: havia mensagem para sair, todos os canais tentados
//         falharam e o aviso NÃO foi marcado. O 500 é o pedido de "tenta de novo em 15 minutos".
//         Canal indisponível (sem telefone, Evolution desligada, Resend desligado) não é falha:
//         não há o que retentar, então é 200 — e o aviso segue sem marca, de propósito. A recusa
//         da Evolution por NÚMERO INEXISTENTE (HTTP 400 com `exists: false`) também é
//         indisponível: é permanente e só daquela cliente. Qualquer OUTRO erro da Evolution —
//         401/403 (chave errada ou trocada), 404 (instância sumiu), 408/429, 400 de instância
//         desconectada ou payload ruim, 5xx, rede — atinge todas as clientes e é FALHA (→ 500).
//         TIMEOUT É AMBÍGUO: a Evolution pode ter entregado e respondido tarde. Ainda assim conta
//         como falha (→ 500 → reenvio), e nesse caso a cliente pode receber a mensagem duas
//         vezes. Troca aceita: perder o aviso em silêncio é pior que uma repetição rara.
//   500 — também, de propósito, quando o NOSSO banco falha (ler o pedido ou gravar o estado): o
//         erro sobe e a retentativa da SuperFrete cobre a instabilidade passageira. As regras de
//         "nunca 500" da §4.4 são sobre eventos ignorados ou que não são nossos, não sobre queda nossa.
//   200 — e NUNCA 500 — quando a mensagem já saiu e só a marca falhou: um 500 faria a SuperFrete
//         reenviar e a cliente receberia a mensagem duas vezes (`marcado: false` na resposta).
//
// A marca de "já avisei" (`metadata.frete.avisos[...]`) só é gravada DEPOIS do envio dar certo.
// O estado (`status_transportadora`, `eventos`) é gravado antes e independe do envio: saber por
// onde o pacote passou não pode depender da Evolution estar de pé.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // Lido a cada requisição (não no topo do módulo) para o "sem segredo" ser um estado do ambiente,
  // não do boot: ligar a variável no Railway passa a valer sem redeploy do processo.
  const segredo = process.env.SUPERFRETE_WEBHOOK_SECRET
  if (!segredo) {
    logger.info("[frete] webhook da SuperFrete chegou, mas SUPERFRETE_WEBHOOK_SECRET não está configurado — ignorado")
    return res.status(200).json({ ignorado: "sem segredo" })
  }

  const assinatura = req.headers["x-me-signature"]
  if (!assinaturaSuperfreteValida(req.rawBody, Array.isArray(assinatura) ? assinatura[0] : assinatura, segredo)) {
    logger.warn("[frete] webhook da SuperFrete com assinatura inválida — recusado")
    return res.status(401).json({ error: "assinatura inválida" })
  }

  const { event, data } = (req.body || {}) as { event?: unknown; data?: unknown }

  // `event` que não é string (array, número, objeto) é desconhecido ANTES de chegar à tabela:
  // `String(["order.generated"])` vira "order.generated" e passaria como evento válido.
  const acao = typeof event === "string" ? acaoDoEvento(event) : null
  if (!acao || typeof event !== "string") {
    // O `event` vem do corpo e não está na tabela: nunca vai cru para o log (injeção de linhas,
    // lixo arbitrário). Só um texto fixo e o tamanho (ou o tipo, quando nem string é).
    const descricao = typeof event === "string" ? `${event.length} caracteres` : `tipo ${Array.isArray(event) ? "array" : typeof event}`
    logger.info(`[frete] webhook da SuperFrete com evento desconhecido (${descricao}) — ignorado`)
    return res.status(200).json({ ignorado: "evento desconhecido" })
  }

  const displayId = numeroDoPedido(data)
  if (displayId === null) {
    // Etiqueta comprada fora do sistema (ou antes desta fase) não tem a nossa tag — risco 4 da spec.
    logger.warn(`[frete] webhook ${event} sem tag com o número do pedido — ignorado`)
    return res.status(200).json({ ignorado: "sem tag" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [pedido],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "metadata", "shipping_address.*"],
    // A coluna é inteira e o filtro numérico é o que os testes de integração exercitam; o tipo gerado
    // do Query declara `display_id` como string, daí o cast (só de tipo, o valor segue número).
    filters: { display_id: displayId as unknown as string },
  })
  if (!pedido) {
    logger.warn(`[frete] webhook ${event}: pedido #${displayId} não encontrado — ignorado`)
    return res.status(200).json({ ignorado: "pedido não encontrado" })
  }

  const metadata = (pedido.metadata ?? {}) as Record<string, unknown>
  const freteAtual = (metadata.frete && typeof metadata.frete === "object" ? metadata.frete : {}) as Record<string, unknown>

  // Conferência cruzada (§4.3): o id da etiqueta tem de ser o mesmo que o Cockpit gravou ao
  // comprá-la. Pedido sem `superfrete_id` cai aqui de propósito — sem etiqueta nossa registrada,
  // não há nada que este aviso possa estar descrevendo.
  const idDoEvento = String((data as { id?: unknown } | null | undefined)?.id ?? "")
  const idGravado = typeof freteAtual.superfrete_id === "string" ? freteAtual.superfrete_id : ""
  if (!idDoEvento || !idGravado || idDoEvento !== idGravado) {
    // `data.id` vem do corpo: vai para o log só depois de reduzido a caracteres de id.
    const idLog = idDoEvento.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "(sem id)"
    logger.warn(`[frete] webhook ${event}: etiqueta ${idLog} não é a do pedido #${displayId} (${idGravado || "sem etiqueta"}) — ignorado`)
    return res.status(200).json({ ignorado: "etiqueta de outro pedido" })
  }

  const avisosAtuais = (freteAtual.avisos && typeof freteAtual.avisos === "object" ? freteAtual.avisos : {}) as Record<string, unknown>
  // `order.generated` não usa `avisos`: a marca dele é `aviso_despacho` (§9), conferida mais abaixo,
  // DEPOIS de gravar o rastreio — um reenvio ainda pode trazer o código que faltava.
  if (event !== "order.generated" && acao.aviso && avisosAtuais[acao.aviso]) {
    // Reenvio da SuperFrete de algo que já avisamos: sai antes de reescrever qualquer coisa, para a
    // data do aviso (e a do evento) não mudarem a cada retentativa.
    logger.info(`[frete] webhook ${event} do pedido #${displayId} já avisado em ${String(avisosAtuais[acao.aviso])} — ignorado`)
    return res.status(200).json({ ignorado: "já avisado" })
  }

  const agora = new Date().toISOString()
  const rastreio = rastreioDoEvento(data)

  // `metadata.frete` é RELIDO aqui, imediatamente antes do write do estado, e as mudanças do webhook
  // são aplicadas sobre essa cópia fresca — não sobre a lida no começo da requisição. Entre as duas
  // leituras o Cockpit (ou o job de avisos pendentes) pode ter marcado `aviso_despacho` como
  // "enviado"; espalhar a cópia velha devolveria "pendente" e a cliente receberia o despacho duas
  // vezes. O merge do Medusa é raso: `frete` inteiro é substituído pelo que mandarmos.
  const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const freteBase = objeto(objeto((await orderModule.retrieveOrder(pedido.id, { select: ["id", "metadata"] })).metadata).frete)

  // A mesma leitura fresca refaz a conferência de "já avisado": se outro caminho avisou enquanto
  // esta requisição corria, sai sem gravar nem enviar.
  if (event !== "order.generated" && acao.aviso && objeto(freteBase.avisos)[acao.aviso]) {
    logger.info(`[frete] webhook ${event} do pedido #${displayId} já avisado (conferido na releitura) — ignorado`)
    return res.status(200).json({ ignorado: "já avisado" })
  }

  // As mudanças DESTE webhook, e só elas: estado da transportadora, histórico de eventos e o
  // rastreio que faltava. Todo o resto de `frete` (do Cockpit: `superfrete_id`, `status`,
  // `tracking_number`, `label_url`, `aviso_despacho`) segue como está no banco agora.
  const freteNovo: Record<string, unknown> = {
    ...freteBase,
    status_transportadora: event,
    eventos: { ...objeto(freteBase.eventos), [String(event)]: agora },
  }

  // §4.1: o rastreio nasce segundos depois do pagamento da etiqueta (~24 s na primeira etiqueta
  // real, pedido #21), então o despacho pode ter saído sem ele. QUALQUER evento que traga o código
  // preenche o que falta — se o `order.generated` se perdeu, o `order.posted` ainda completa — e
  // nenhum sobrescreve um código que já existe.
  //
  // NOTA DE ESCOPO: o rastreio do FULFILLMENT no Medusa não é reescrito aqui. Quem grava o `label`
  // no envio é o Cockpit, na hora de despachar. Esta fase registra o código no `metadata.frete`; o
  // Cockpit passa a exibi-lo de lá numa fase futura.
  if (!freteBase.tracking_number && rastreio.tracking) {
    freteNovo.tracking_number = rastreio.tracking
    if (rastreio.tracking_url) freteNovo.tracking_url = rastreio.tracking_url
  }

  // SÓ a chave `frete` vai no update. O Medusa 2.15.5 (MedusaInternalService.update → mergeMetadata)
  // faz merge RASO do `metadata` enviado sobre a linha como ela está no banco NA HORA do write: cada
  // chave de primeiro nível enviada substitui a do banco, e as não enviadas ficam como estão. Mandar
  // `{ ...metadata, frete }` reescreveria `fiscal`, `conferencia` etc. com o valor lido no começo da
  // requisição, desfazendo o que outro escritor (webhook da Brasil NFe, Cockpit) gravou no meio.
  await orderModule.updateOrders(pedido.id, { metadata: { frete: freteNovo } })

  // `order.generated` (spec §9, decisão do dono em 2026-09-21): quando a etiqueta sai sem código, o
  // Cockpit despacha mas SEGURA o WhatsApp e grava `aviso_despacho = { status: "pendente" }`. Aqui,
  // se o aviso está pendente e agora existe código, sai a mensagem de despacho COMPLETA (número +
  // código + link) — a mesma de sempre, não um segundo aviso. `aviso_despacho` ausente (despacho
  // antigo ou manual) ou já "enviado" (pelo Cockpit, pelo job de 5 min ou por um webhook anterior)
  // → só grava o rastreio e não manda nada. Decidido sobre a leitura FRESCA.
  const despachoPendente = objeto(freteBase.aviso_despacho).status === "pendente" && Boolean(freteNovo.tracking_number)
  const aviso = event === "order.generated" ? (despachoPendente ? acao.aviso : null) : acao.aviso
  if (!aviso) {
    logger.info(`[frete] webhook ${event} do pedido #${displayId} registrado (sem mensagem para a cliente)`)
    return res.status(200).json({ ok: true, gravado: true, enviado: false })
  }

  const codigo = String(freteNovo.tracking_number ?? "")
  const link = String(freteNovo.tracking_url ?? "")
  const nome = (pedido.shipping_address?.first_name as string | undefined) || ""
  // Os textos vivem em lib/superfrete-avisos.ts — um arquivo só, para o dono revisar sem mexer em código.
  const dadosDoAviso = { nome, numero: Number(pedido.display_id), codigo, link }
  const texto = aviso === "generated" ? textoDespacho(dadosDoAviso) : aviso === "posted" ? textoPostado(dadosDoAviso) : textoEntregue(dadosDoAviso)

  let tentados = 0
  let entregues = 0

  // DADO PESSOAL: nenhum log daqui para baixo leva `message` de erro de canal. O erro da Evolution
  // traz o corpo da resposta, e ela ecoa o número (ou o JID) quando recusa — com 5 retentativas da
  // SuperFrete, seriam 5 cópias do telefone da cliente no log. Loga-se só o status HTTP ou o tipo.
  if (acao.canais.includes("whatsapp")) {
    const telefone = (pedido.shipping_address?.phone as string | undefined)?.trim()
    if (!telefone || !evolutionConfigured()) {
      // Canal indisponível ≠ canal com falha: não conta como tentativa, e por isso não vira 500.
      logger.info(`[frete] aviso ${aviso} do pedido #${displayId}: WhatsApp pulado (${telefone ? "Evolution desligada" : "pedido sem telefone"})`)
    } else {
      tentados++
      try {
        await sendWhatsappText(normalizaWhatsapp(telefone), texto, 0, { timeoutMs: TIMEOUT_WHATSAPP_MS })
        entregues++
      } catch (e) {
        if (e instanceof EvolutionHttpError && e.numeroInexistente) {
          // SÓ a recusa por número inexistente (400 + `exists: false`) é permanente e daquela
          // cliente: retentar em 15 min dá o mesmo resultado. Vira "canal indisponível" — sai da
          // conta de tentativas. O número NÃO vai para o log (o corpo do erro fica no campo privado).
          tentados--
          logger.warn(`[frete] aviso ${aviso} do pedido #${displayId}: número da cliente não tem WhatsApp (Evolution HTTP 400) — canal indisponível`)
        } else {
          // Todo o resto é FALHA (→ 500 → a SuperFrete retenta): 5xx, rede, timeout e também os
          // 4xx que não são "número inexistente" (chave errada, instância ausente ou desconectada,
          // limite, payload ruim) — esses atingem todas as clientes e não podem sumir num 200.
          const motivo = e instanceof EvolutionHttpError ? `HTTP ${e.status}` : (e as Error)?.name === "TimeoutError" ? "timeout" : "erro de rede"
          logger.error(`[frete] aviso ${aviso} do pedido #${displayId}: WhatsApp falhou (${motivo})`)
        }
      }
    }
  }

  if (acao.canais.includes("email")) {
    const email = pedido.email as string | undefined
    if (!process.env.RESEND_API_KEY || !email) {
      logger.info(`[frete] aviso ${aviso} do pedido #${displayId}: e-mail pulado (${email ? "Resend desligado" : "pedido sem e-mail"})`)
    } else {
      tentados++
      try {
        // TODO(Task 3): o template `pedido-postado` ainda não existe no módulo do Resend. O
        // try/catch abaixo é o que impede um template faltando de derrubar a rota (e de virar 500,
        // que faria a SuperFrete reenviar 5 vezes por um erro que retentar não conserta). Quando a
        // Task 3 criar o template, o catch vira apenas o tratamento de falha real do envio.
        await req.scope.resolve(Modules.NOTIFICATION).createNotifications({
          to: email,
          channel: "email",
          template: "pedido-postado",
          trigger_type: "superfrete.order.posted",
          resource_type: "order",
          resource_id: pedido.id,
          // Chave de idempotência do §4.4: o mesmo evento da mesma etiqueta nunca vira dois e-mails,
          // nem que a marca de aviso se perca entre uma retentativa e outra.
          idempotency_key: `superfrete-${aviso}-${idDoEvento}`,
          data: { nome, display_id: pedido.display_id, tracking_number: codigo, tracking_url: link },
        })
        entregues++
      } catch (e) {
        // Só o tipo do erro: a mensagem do provider pode repetir o endereço de e-mail.
        logger.error(`[frete] aviso ${aviso} do pedido #${displayId}: e-mail falhou (${(e as Error)?.name ?? "erro"})`)
      }
    }
  }

  if (tentados > 0 && entregues === 0) {
    // 500 DE PROPÓSITO: o aviso fica sem marca e a SuperFrete reenvia em 15 min (§4.4). O estado
    // já gravado acima não se perde — a retentativa cai no mesmo caminho e só refaz o envio.
    logger.error(`[frete] aviso ${aviso} do pedido #${displayId} falhou em todos os canais — respondendo 500 para a SuperFrete reenviar`)
    return res.status(500).json({ error: "falha ao avisar a cliente" })
  }

  if (entregues === 0) {
    // Nada foi tentado (nenhum canal disponível). Não há o que retentar e não houve envio: 200, e
    // o aviso NÃO é marcado — marcar seria registrar uma mensagem que nunca saiu.
    logger.warn(`[frete] aviso ${aviso} do pedido #${displayId}: nenhum canal disponível — nada enviado`)
    return res.status(200).json({ ok: true, gravado: true, enviado: false })
  }

  // A marca só depois do envio. No despacho ela é `aviso_despacho` (o mesmo campo que o Cockpit e o
  // job de avisos pendentes leem para não repetir); nos demais, `avisos[aviso]`.
  //
  // Daqui em diante a mensagem JÁ SAIU. Duas regras:
  //  - `metadata.frete` é relido AGORA e só a marca é aplicada por cima: o envio levou segundos, e
  //    o Cockpit pode ter gravado no `frete` nesse meio-tempo (o merge do Medusa é raso — `frete`
  //    inteiro é substituído pelo que mandarmos).
  //  - Falha aqui NUNCA vira 500: um 500 faria a SuperFrete reenviar, o reenvio não veria a marca e
  //    a cliente receberia a mensagem de novo. Responde 200 com `marcado: false` e loga para o
  //    operador — uma marca faltando é bem menos grave que uma mensagem duplicada.
  try {
    const marcadoEm = new Date().toISOString()
    const fresco = await orderModule.retrieveOrder(pedido.id, { select: ["id", "metadata"] })
    const freteFresco = objeto(objeto(fresco.metadata).frete)
    const freteMarcado =
      aviso === "generated"
        ? { ...freteFresco, aviso_despacho: { ...objeto(freteFresco.aviso_despacho), status: "enviado", em: marcadoEm, por: "webhook" } }
        : { ...freteFresco, avisos: { ...objeto(freteFresco.avisos), [aviso]: marcadoEm } }
    await orderModule.updateOrders(pedido.id, { metadata: { frete: freteMarcado } })
  } catch (e) {
    logger.error(
      `[frete] aviso ${aviso} do pedido #${displayId} ENVIADO, mas a marca não foi gravada (${(e as Error)?.name ?? "erro"}) — ` +
        `conferir o pedido: um reenvio da SuperFrete pode repetir a mensagem`
    )
    return res.status(200).json({ ok: true, gravado: true, enviado: true, marcado: false })
  }

  logger.info(`[frete] aviso ${aviso} do pedido #${displayId} enviado (${entregues}/${tentados} canais)`)
  return res.status(200).json({ ok: true, gravado: true, enviado: true, marcado: true })
}

// Timeout do WhatsApp: a SuperFrete desiste da chamada em 30 s; uma Evolution pendurada não pode
// segurar a resposta além disso. Estourar conta como falha passageira (→ 500 → retentativa).
const TIMEOUT_WHATSAPP_MS = 15_000

// Lê um valor do metadata como objeto plano; qualquer outra coisa (ausente, string, array) vira {}.
function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
