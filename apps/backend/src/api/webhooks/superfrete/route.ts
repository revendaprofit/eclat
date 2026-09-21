import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EvolutionHttpError, evolutionConfigured, sendWhatsappText } from "../../../lib/evolution"
import {
  MOTIVO_COBERTO_PELO_POSTADO,
  MOTIVO_ETIQUETA_CANCELADA,
  dispensarAvisoPendente,
  linkDeRastreio,
  mesclarNoFrete,
  tentarAvisoDeDespacho,
  type Pg,
} from "../../../lib/aviso-despacho"
import { normalizaWhatsapp, textoEntregue, textoPostado } from "../../../lib/superfrete-avisos"
import { getPrevenda } from "../../../lib/prevenda"
import { WHATSAPP_PADRAO } from "../../../modules/resend/dados-pedido"
import type { DadosPostado } from "../../../modules/resend/templates/pedido-postado"
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
//   200 — SEMPRE no `order.generated` depois de gravar o estado, mesmo que o aviso de despacho não
//         tenha saído ou que o remetente único (`tentarAvisoDeDespacho`) tenha lançado: quem manda o
//         despacho é ele, e a rede de segurança é o job de 5 min — a retentativa da SuperFrete não
//         acrescenta nada e competiria com o job. A rota não envia nem marca o despacho por conta própria.
//   500 — DE PROPÓSITO, e só num caso (postado/entregue): havia mensagem para sair, todos os canais tentados
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
// A marca de "já avisei" (`metadata.frete.avisos[...]`, postado/entregue) só é gravada DEPOIS do envio
// dar certo. Estado e marca são mesclados DENTRO do Postgres (`mesclarNoFrete`), nunca regravando o
// `frete` inteiro a partir de uma cópia lida antes.
// O estado (`status_transportadora`, `eventos`) é gravado antes e independe do envio: saber por
// onde o pacote passou não pode depender da Evolution estar de pé.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // Lido a cada requisição (não no topo do módulo): o "sem segredo" é um estado do ambiente e os
  // testes trocam a variável entre chamadas. Em produção a mudança só vale porque o Railway REINICIA
  // o serviço (redeploy) ao aplicar uma mudança de variável — um processo em pé não enxerga variável nova.
  // Aparado: um segredo colado com quebra de linha ou espaço daria 401 para sempre.
  const segredo = (process.env.SUPERFRETE_WEBHOOK_SECRET ?? "").trim()
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
  // `order.generated` não tem `acao.aviso` (a marca dele é `aviso_despacho`, §9, conferida pelo
  // remetente único DEPOIS de gravar o rastreio — um reenvio ainda pode trazer o código que faltava).
  if (acao.aviso && avisosAtuais[acao.aviso]) {
    // Reenvio da SuperFrete de algo que já avisamos: sai antes de reescrever qualquer coisa, para a
    // data do aviso (e a do evento) não mudarem a cada retentativa.
    logger.info(`[frete] webhook ${event} do pedido #${displayId} já avisado em ${String(avisosAtuais[acao.aviso])} — ignorado`)
    return res.status(200).json({ ignorado: "já avisado" })
  }

  const agora = new Date().toISOString()
  const rastreio = rastreioDoEvento(data)

  // `metadata.frete` é RELIDO aqui para refazer a conferência de "já avisado" e para decidir o
  // despacho: entre a leitura do começo e agora, outro caminho (Cockpit, job) pode ter avisado.
  const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const freteBase = objeto(objeto((await orderModule.retrieveOrder(pedido.id, { select: ["id", "metadata"] })).metadata).frete)

  // A mesma leitura fresca refaz a conferência de "já avisado": se outro caminho avisou enquanto
  // esta requisição corria, sai sem gravar nem enviar.
  if (acao.aviso && objeto(freteBase.avisos)[acao.aviso]) {
    logger.info(`[frete] webhook ${event} do pedido #${displayId} já avisado (conferido na releitura) — ignorado`)
    return res.status(200).json({ ignorado: "já avisado" })
  }

  // GRAVAÇÃO DO ESTADO SEM "LER, ALTERAR E GRAVAR" (Task 3, seção G). As mudanças DESTE webhook, e
  // só elas — estado da transportadora, histórico de eventos e o rastreio que faltava — são mescladas
  // DENTRO do Postgres (`mesclarNoFrete`, uma instrução por mudança). Nada é escrito a partir da
  // cópia relida acima: gravar `frete` inteiro com ela desfaria uma reserva `pendente → enviando`
  // feita por outro remetente nos milissegundos entre a releitura e a gravação, e a mensagem de
  // despacho poderia sair duas vezes. Todo o resto de `frete` (do Cockpit: `superfrete_id`,
  // `status`, `label_url`, `aviso_despacho`) e todo o resto do `metadata` (`fiscal`, …) ficam como
  // estão no banco NA HORA de cada instrução.
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as Pg
  await mesclarNoFrete(pg, pedido.id, { status_transportadora: event })
  let freteNovo = (await mesclarNoFrete(pg, pedido.id, { [event]: agora }, { em: "eventos" })) ?? freteBase

  // §4.1: o rastreio nasce segundos depois do pagamento da etiqueta (~24 s na primeira etiqueta
  // real, pedido #21), então o despacho pode ter saído sem ele. QUALQUER evento que traga o código
  // preenche o que falta — se o `order.generated` se perdeu, o `order.posted` ainda completa — e
  // nenhum sobrescreve um código que já existe (a condição está no próprio UPDATE: `seSemRastreio`).
  //
  // NOTA DE ESCOPO: o rastreio do FULFILLMENT no Medusa não é reescrito aqui. Quem grava o `label`
  // no envio é o Cockpit, na hora de despachar. Esta fase registra o código no `metadata.frete`; o
  // Cockpit passa a exibi-lo de lá numa fase futura.
  //
  // O LINK gravado é sempre o dos Correios montado do código (`linkDeRastreio`), nunca o
  // `tracking_url` do corpo: é ele que vai nas mensagens para a cliente (revisão final de 2026-09-21).
  if (rastreio.tracking) {
    const campos = { tracking_number: rastreio.tracking, tracking_url: linkDeRastreio(rastreio.tracking) }
    freteNovo = (await mesclarNoFrete(pg, pedido.id, campos, { seSemRastreio: true })) ?? freteNovo
  }

  // Etiqueta cancelada (I-3 da revisão final): um aviso de despacho ainda PENDENTE não sai mais.
  // Transição condicional `pendente → dispensado` — `enviando` e estados finais ficam como estão.
  // Erro do nosso banco aqui sobe (→ 500 → a SuperFrete reenvia), como nas gravações acima.
  if (event === "order.cancelled") {
    if (await dispensarAvisoPendente(pg, pedido.id, MOTIVO_ETIQUETA_CANCELADA)) {
      logger.warn(`[frete] webhook ${event} do pedido #${displayId}: etiqueta cancelada — aviso de despacho pendente DISPENSADO`)
    }
  }

  // `order.generated` (spec §9, decisão do dono em 2026-09-21): quando a etiqueta sai sem código, o
  // Cockpit despacha mas SEGURA o WhatsApp e grava `aviso_despacho = { status: "pendente" }`. A rota
  // NÃO envia o despacho por conta própria nem grava a marca: delega ao remetente único
  // (`tentarAvisoDeDespacho`, lib/aviso-despacho.ts), o mesmo que o Cockpit e o job de 5 min chamam.
  // Ele relê o pedido, faz a reserva atômica e só então envia — dois chamadores nunca mandam duas
  // vezes. `aviso_despacho` ausente (despacho antigo ou manual) ou já resolvido → não faz nada.
  //
  // Resposta SEMPRE 200 aqui, mesmo se a função não conseguiu enviar ou lançou: o job de 5 min é a
  // rede de segurança do despacho, e uma retentativa da SuperFrete não acrescenta nada — só competiria
  // com ele. O rastreio já está gravado acima.
  if (event === "order.generated") {
    try {
      const final = await tentarAvisoDeDespacho(req.scope, pedido.id, "webhook")
      logger.info(`[frete] webhook ${event} do pedido #${displayId} registrado (aviso de despacho: ${String(final?.status ?? "nenhum")})`)
      return res.status(200).json({ ok: true, gravado: true, aviso_despacho: final?.status ?? null })
    } catch (e) {
      logger.error(`[frete] webhook ${event} do pedido #${displayId}: aviso de despacho falhou (${(e as Error)?.name ?? "erro"}) — o job de 5 min tenta de novo`)
      return res.status(200).json({ ok: true, gravado: true, aviso_despacho: null })
    }
  }

  const aviso = acao.aviso
  if (!aviso) {
    logger.info(`[frete] webhook ${event} do pedido #${displayId} registrado (sem mensagem para a cliente)`)
    return res.status(200).json({ ok: true, gravado: true, enviado: false })
  }

  // Postado com despacho ainda PENDENTE (I-4 da revisão final): a mensagem de postado já leva o
  // código e o link, então o despacho atrasado não sai depois dela. Condicional `pendente →
  // dispensado`: um despacho `enviando` (já saindo) fica como está. É gravado ANTES de mandar o
  // postado — se o postado falhar, a retentativa da SuperFrete o manda de novo.
  if (event === "order.posted") {
    if (await dispensarAvisoPendente(pg, pedido.id, MOTIVO_COBERTO_PELO_POSTADO)) {
      logger.info(`[frete] webhook ${event} do pedido #${displayId}: aviso de despacho pendente dispensado — o aviso de postado leva o código`)
    }
  }

  const codigo = String(freteNovo.tracking_number ?? "")
  const link = String(freteNovo.tracking_url ?? "")
  const nome = (pedido.shipping_address?.first_name as string | undefined) || ""
  // Os textos vivem em lib/superfrete-avisos.ts — um arquivo só, para o dono revisar sem mexer em código.
  const dadosDoAviso = { nome, numero: Number(pedido.display_id), codigo, link }
  const texto = aviso === "posted" ? textoPostado(dadosDoAviso) : textoEntregue(dadosDoAviso)

  let tentados = 0
  let entregues = 0

  // A MARCA (`avisos[aviso]`) é gravada logo depois do PRIMEIRO canal que entregar — não no fim.
  // Motivo (Fix round 1 da Task 3): o WhatsApp pode levar até 15 s; se o e-mail vier depois e algo
  // nele demorar, a SuperFrete desiste em 30 s e reenvia. Com a marca já gravada, o reenvio cai no
  // "já avisado" e a cliente não recebe o WhatsApp de novo. A semântica não muda: a marca sempre
  // quis dizer "pelo menos um canal entregou" — só passa a ser gravada assim que isso é verdade.
  //  - Só a marca é gravada, mesclada DENTRO do banco (o Cockpit pode ter gravado no `frete` no
  //    meio-tempo — nada do que ele gravou é reescrito).
  //  - Falha na marca NUNCA vira 500: um 500 faria a SuperFrete reenviar, o reenvio não veria a
  //    marca e a cliente receberia a mensagem de novo. Resposta 200 com `marcado: false` e log.
  let marcado: boolean | null = null
  const marcar = async () => {
    if (marcado !== null) return
    try {
      // `avisos` é um objeto: a chave nova é mesclada DENTRO dele, no banco, sem reescrever as outras.
      await mesclarNoFrete(pg, pedido.id, { [aviso]: new Date().toISOString() }, { em: "avisos" })
      marcado = true
    } catch (e) {
      marcado = false
      logger.error(
        `[frete] aviso ${aviso} do pedido #${displayId} ENVIADO, mas a marca não foi gravada (${(e as Error)?.name ?? "erro"}) — ` +
          `conferir o pedido: um reenvio da SuperFrete pode repetir a mensagem`
      )
    }
  }

  // O e-mail precisa do contato de WhatsApp da marca (o da pré-venda, no Supabase). Ele é resolvido
  // ANTES do envio do WhatsApp e com prazo curto: o Supabase pendurado não pode empurrar a resposta
  // para além dos 30 s da SuperFrete. Sem resposta em 2 s, vale o contato padrão.
  const email = pedido.email as string | undefined
  const emailLigado = acao.canais.includes("email") && Boolean(process.env.RESEND_API_KEY) && Boolean(email)
  const contatoDaMarca = emailLigado ? await contatoWhatsappDaMarca() : WHATSAPP_PADRAO

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
        await marcar()
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
    if (!emailLigado) {
      logger.info(`[frete] aviso ${aviso} do pedido #${displayId}: e-mail pulado (${email ? "Resend desligado" : "pedido sem e-mail"})`)
    } else {
      tentados++
      try {
        // Os campos de `data` são exatamente os que o template `pedido-postado` lê (DadosPostado,
        // src/modules/resend/templates/pedido-postado.ts) + `idempotencia`, que o provider do Resend
        // manda como header — mesmo formato do "pedido confirmado". Uma falha aqui (inclusive do
        // template) cai no catch e conta como canal com falha, nunca derruba a rota.
        const idempotencia = `superfrete-${aviso}-${idDoEvento}`
        const dadosEmail: DadosPostado = {
          numero: String(pedido.display_id ?? displayId),
          primeiroNome: nome || null,
          codigo: codigo || null,
          link: link || null,
          lojaUrl: (process.env.STOREFRONT_URL || "https://www.useeclat.com.br").replace(/\/$/, ""),
          whatsapp: contatoDaMarca,
        }
        await req.scope.resolve(Modules.NOTIFICATION).createNotifications({
          to: email as string,
          channel: "email",
          template: "pedido-postado",
          trigger_type: "superfrete.order.posted",
          resource_type: "order",
          resource_id: pedido.id,
          // Chave de idempotência do §4.4: o mesmo evento da mesma etiqueta nunca vira dois e-mails,
          // nem que a marca de aviso se perca entre uma retentativa e outra.
          idempotency_key: idempotencia,
          data: { ...dadosEmail, idempotencia },
        })
        entregues++
        await marcar()
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

  if (!marcado) return res.status(200).json({ ok: true, gravado: true, enviado: true, marcado: false })
  logger.info(`[frete] aviso ${aviso} do pedido #${displayId} enviado (${entregues}/${tentados} canais)`)
  return res.status(200).json({ ok: true, gravado: true, enviado: true, marcado: true })
}

// Contato de WhatsApp da marca para o e-mail: o da pré-venda (Supabase), com prazo de 2 s. Sem
// resposta a tempo, ou com erro, vale o padrão — mesmo contato do "pedido confirmado".
const PRAZO_CONTATO_MS = 2_000
async function contatoWhatsappDaMarca(): Promise<string> {
  let relogio: NodeJS.Timeout | undefined
  const padrao = new Promise<string>((ok) => {
    relogio = setTimeout(() => ok(WHATSAPP_PADRAO), PRAZO_CONTATO_MS)
  })
  try {
    return await Promise.race([getPrevenda().then((p) => p?.whatsapp || WHATSAPP_PADRAO, () => WHATSAPP_PADRAO), padrao])
  } finally {
    clearTimeout(relogio)
  }
}

// Timeout do WhatsApp: a SuperFrete desiste da chamada em 30 s; uma Evolution pendurada não pode
// segurar a resposta além disso. Estourar conta como falha passageira (→ 500 → retentativa).
const TIMEOUT_WHATSAPP_MS = 15_000

// Lê um valor do metadata como objeto plano; qualquer outra coisa (ausente, string, array) vira {}.
function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
