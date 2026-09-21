import { NextResponse } from "next/server"
import { medusaGetOrder, medusaFulfillOrder, medusaMergeOrderMetadata, medusaShipFulfillment, medusaAdmin } from "@/lib/medusa"
import { podeDespachar } from "@/lib/despacho-permitido"
import { validarConferencia, type ConferenciaEnviada } from "@/lib/leitor"
import { decidirDespacho, type ResultadoEmissao } from "@/lib/fiscal-despacho"
import { createSupabaseServer } from "@/lib/supabase/server"
import {
  carrierConfigured,
  carrierCriarFrete,
  carrierPagarFrete,
  carrierConsultarFrete,
  MSG_CARRIER_NAO_CONFIGURADO,
} from "@/lib/shipping"
import { avisoAoDespacharComEtiqueta, avisoPeloBackend, lerAvisoDespacho, type AvisoDespacho } from "@/lib/aviso-despacho"
import { garantirEtiqueta, lerEstadoDoFrete } from "@/lib/etiqueta-segura"
import { executarComTrava, DespachoEmAndamento } from "@/lib/trava-despacho"
import { lerDadosFiscais } from "@/lib/dados-fiscais"
import { AVISO_PAGAMENTO, pagamentoConfirmado } from "@/lib/pagamento-despacho"
import { sendWhatsappText } from "@/lib/evolution"

// Despacha um pedido: confere as peças (leitor) + emite a NF-e + cria fulfillment + marca envio
// (com rastreio) + avisa o cliente por WhatsApp (no despacho com etiqueta da SuperFrete e com o
// interruptor abaixo ligado, o aviso espera o código de rastreio e quem manda é o backend — ver
// passo 3). Rastreio: manual (tracking_number) OU gerado pela transportadora (use_carrier).
//
// INTERRUPTOR SUPERFRETE_AVISO_PELO_BACKEND (lib/aviso-despacho.ts, avisoPeloBackend): DESLIGADO por
// padrão = o despacho com etiqueta avisa a cliente na hora, daqui, igual ao despacho manual (o
// comportamento de antes). LIGADO (`true`) = o Cockpit só grava metadata.frete.aviso_despacho e pede
// ao backend, que manda quando o código de rastreio existir. O Cockpit vai ao ar sozinho no push
// (Vercel) e o backend só com `railway up`, então a ordem segura para ligar é: `railway up` do
// backend → confirmar que o backend está mandando os avisos → ligar a variável no Vercel → redeploy
// do Cockpit. Ligar antes disso deixa todo aviso de etiqueta pendente para sempre.
//
// Conferência (spec leitor-codigo-barras F1): a tela manda as leituras; o servidor recalcula contra
// os itens reais do pedido e só despacha conferência divergente com motivo. O registro vai para metadata.conferencia ANTES do fulfillment.
//
// A decisão "emissão falhou → aborta o despacho" mora em lib/fiscal-despacho.ts (decidirDespacho),
// não aqui — é a regra fiscal/legal de maior risco do projeto, e uma route.ts sem teste (como toda
// route.ts do Cockpit hoje) deixaria um refactor futuro reordenar os blocos e despachar sem nota
// em silêncio. Aqui a rota fica fina: chama a Admin API, monta o ResultadoEmissao, obedece.
//
// A decisão "não pagar a etiqueta em dobro numa retentativa" mora em lib/etiqueta-segura.ts
// (garantirEtiqueta) pelo mesmo motivo: é dinheiro de verdade, com teste dedicado pra cada situação
// (retentativa pós-pagamento, timeout, frete cancelado etc.) — ver revisão de 2026-09-19.
//
// TRAVA: `executarComTrava(id, ...)` envolve o handler INTEIRO (revisão de 2026-09-19, achado 3 —
// a trava anterior só era adquirida perto da compra da etiqueta, DEPOIS da conferência e da emissão
// de NF-e, deixando segundos de janela para um duplo clique passar dos dois lados). A trava aqui é
// adquirida ANTES de medusaGetOrder e só liberada depois da resposta pronta.
//
// O que ela NÃO cobre: duas instâncias do Cockpit rodando ao mesmo tempo (cada processo tem seu
// próprio Set em memória — ver lib/trava-despacho.ts). Nesse caso quem protege o dinheiro é a regra
// 3 de garantirEtiqueta, alimentada por uma leitura FRESCA do pedido feita bem antes de decidir (não
// a do `order` carregado no topo do handler) — a janela residual é a duração de uma leitura+escrita
// no Medusa. A emissão de NF-e não tem proteção nenhuma entre instâncias: duas instâncias despachando
// o mesmo pedido ao mesmo tempo poderiam emitir duas notas; aceitável hoje porque o Cockpit roda numa
// instância só (arquitetura atual — sinalizar se isso mudar).

// Revisão de 2026-09-19 (API real): a busca de rastreio pode esperar até ~8s (regra B) + até 3×4s
// (regra C) além do tempo normal das chamadas à SuperFrete e ao Medusa — um despacho com etiqueta
// pode passar de 20s. Em runtime serverless (Vercel), o limite padrão de 10-15s cortaria a resposta
// no meio da compra; 60s dá folga confortável.
export const maxDuration = 60

function normalizaWhatsapp(phone: string): string {
  const d = phone.replace(/\D/g, "")
  if (d.startsWith("55")) return d
  if (d.length === 10 || d.length === 11) return "55" + d
  return d
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

// Grava metadata.frete.aviso_despacho SEM perder o resto de metadata.frete (id do frete, status da
// etiqueta, rastreio…): medusaMergeOrderMetadata só junta no nível de cima, então gravar `frete`
// substitui o objeto inteiro. Por isso o pedido é relido AGORA, logo antes de gravar, e o `frete`
// relido é espalhado por baixo do aviso.
async function gravarAvisoDespacho(id: string, aviso: AvisoDespacho): Promise<void> {
  const relido = await medusaGetOrder(id)
  const frete = relido.metadata?.frete
  const freteRelido = ehObjeto(frete) ? frete : {}
  await medusaMergeOrderMetadata(id, { frete: { ...freteRelido, aviso_despacho: aviso } })
}

// Pede ao backend que tente mandar o aviso pendente na hora (POST /admin/frete/aviso-despacho/{id};
// resposta 200 com `{ aviso_despacho: {...} }`). MELHOR ESFORÇO: qualquer falha (rota ausente,
// timeout, 500, resposta fora do formato) só vai para o log — sem dado da cliente — e devolve null;
// o job do backend tenta de novo a cada 5 min. Limite de 5 s: o AbortController corta o fetch e o
// Promise.race garante o teto mesmo se o login no Medusa (medusaAdminToken, fora do signal) travar.
const LIMITE_AVISO_MS = 5_000
async function pedirAvisoAoBackend(id: string): Promise<AvisoDespacho | null> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const tempoEsgotado = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      ctrl.abort()
      console.warn(`[aviso-despacho] pedido ${id}: backend não respondeu em ${LIMITE_AVISO_MS / 1000}s — o job do backend tenta de novo`)
      resolve(null)
    }, LIMITE_AVISO_MS)
  })
  const chamada = (async (): Promise<AvisoDespacho | null> => {
    const r = await medusaAdmin(`/admin/frete/aviso-despacho/${encodeURIComponent(id)}`, {
      method: "POST",
      body: "{}",
      signal: ctrl.signal,
    })
    if (!r.ok) {
      console.warn(`[aviso-despacho] pedido ${id}: backend respondeu HTTP ${r.status} — o job do backend tenta de novo`)
      return null
    }
    const dados: unknown = await r.json().catch(() => null)
    // lerAvisoDespacho lê metadata.frete.aviso_despacho; a resposta é { aviso_despacho }, então
    // embrulha em { frete } para reaproveitar a mesma validação defensiva.
    const aviso = lerAvisoDespacho({ frete: dados })
    if (!aviso) console.warn(`[aviso-despacho] pedido ${id}: resposta do backend fora do formato — ignorada`)
    return aviso
  })().catch((e) => {
    if (!ctrl.signal.aborted) {
      console.warn(`[aviso-despacho] pedido ${id}: chamada ao backend falhou (${(e as Error).name}) — o job do backend tenta de novo`)
    }
    return null
  })
  try {
    return await Promise.race([chamada, tempoEsgotado])
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await req.json()) as {
    tracking_number?: string
    tracking_url?: string
    label_url?: string
    use_carrier?: boolean
    notify?: boolean
    conferencia?: ConferenciaEnviada
    emitir_nfe?: boolean
    pagamento_conferido?: boolean
  }

  try {
    return await executarComTrava(id, async () => {
      const order = await medusaGetOrder(id)
      // Trava dianteira: já despachado, não pago ou com o dinheiro devolvido não sai daqui.
      const trava = podeDespachar(order)
      if (!trava.pode) {
        return NextResponse.json({ error: trava.motivo }, { status: 400 })
      }
      // Quem está operando: resolvido já aqui no topo porque a guarda de pagamento logo abaixo
      // precisa registrar quem confirmou o despacho de um pedido que não consta como pago.
      let operador: string | null = null
      try {
        const { data } = await (await createSupabaseServer()).auth.getUser()
        operador = data.user?.email ?? null
      } catch {
        operador = null
      }

      // Pagamento antes de qualquer efeito (Task 16): a etiqueta da SuperFrete gasta saldo REAL da
      // carteira, e o `payment_status` não reflete a realidade enquanto o Pix é confirmado por fora (provider
      // manual). Por isso não é bloqueio: é aviso + confirmação explícita do operador. A guarda
      // fica aqui, logo depois do fulfillment_status — ANTES da gravação da conferência, ANTES da
      // emissão da NF-e e muito antes da compra: quando ela recusa, nada foi gravado, nada foi
      // emitido e nada foi comprado. O caminho manual não gasta dinheiro e segue como sempre.
      // Transportadora sem credenciais: recusa AQUI, junto da guarda de pagamento — antes, o
      // operador só descobria depois de gravar a conferência e passar pela nota fiscal (visto em
      // produção em 2026-09-21). Mesmo texto do CarrierNotConfigured (lib/shipping.ts).
      if (body.use_carrier && !carrierConfigured()) {
        return NextResponse.json({ error: MSG_CARRIER_NAO_CONFIGURADO }, { status: 400 })
      }
      if (body.use_carrier && !pagamentoConfirmado(order.payment_status)) {
        if (body.pagamento_conferido !== true) {
          return NextResponse.json(
            { error: `${AVISO_PAGAMENTO} Confirme que o pagamento foi verificado para continuar.` },
            { status: 400 }
          )
        }
        console.warn(
          `[pagamento] pedido ${id} teve etiqueta gerada SEM pagamento confirmado ` +
            `(payment_status=${order.payment_status}) — confirmado por ${operador ?? "operador não identificado"}`
        )
      }

      const items = order.items.map((i) => ({ id: i.id, quantity: i.quantity }))

      // 0) conferência das peças (leitor de código de barras)
      const conferencia = validarConferencia(
        order.items.map((i) => ({ item_id: i.id, sku: i.variant_sku ?? null, titulo: i.title, variante: i.variant_title, quantidade: i.quantity })),
        body.conferencia,
        operador
      )
      if (!conferencia.ok) {
        return NextResponse.json({ error: conferencia.erro }, { status: 400 })
      }
      await medusaMergeOrderMetadata(id, { conferencia: conferencia.registro })

      // 0.5) NF-e de venda — a DANFE precisa ir dentro da caixa, então emite antes do fulfillment.
      // Falha de emissão ABORTA o despacho: despachar sem nota é pior que não despachar. Nota
      // rejeitada ou denegada também aborta, com código e motivo visíveis ao operador. Emissão
      // DESLIGADA (interruptor mestre, Bloco 1) não é falha: o despacho prossegue sem nota, mas
      // nunca em silêncio — fica registrado no log e o aviso volta na resposta para o operador ver.
      let avisoFiscal: string | null = null
      let chaveNfe: string | null = null
      if (body.emitir_nfe !== false) {
        const r = await medusaAdmin("/admin/fiscal/emitir", {
          method: "POST",
          body: JSON.stringify({ order_id: id }),
        })
        const dados = (await r.json().catch(() => ({}))) as {
          documento?: ResultadoEmissao["documento"]
          emissao_desligada?: boolean
          motivo?: string
          error?: string
        }
        const decisao = decidirDespacho({
          ok: r.ok,
          documento: dados.documento,
          emissao_desligada: dados.emissao_desligada,
          motivo: dados.motivo,
          error: dados.error,
        })
        if (!decisao.prosseguir) {
          return NextResponse.json({ error: decisao.mensagem }, { status: decisao.status })
        }
        if (decisao.fiscal) {
          await medusaMergeOrderMetadata(id, { fiscal: decisao.fiscal })
          chaveNfe = decisao.fiscal.chave_acesso ?? null
        } else {
          avisoFiscal = decisao.aviso
          console.warn(
            `[fiscal] pedido ${id} despachado SEM nota — ${decisao.aviso}${operador ? ` — operador ${operador}` : ""}`
          )
          // Correção da spec §6.1: com o interruptor desligado, o vestígio de auditoria não é a
          // tabela fiscal_documento (que exigiria inventar CPF/IBGE/NCM/perfil pra um documento que
          // não é tentativa real de nota) — é o metadata do próprio pedido. Antes só existia o
          // console.warn acima e um alert() efêmero na tela; agora fica registrado no artefato certo.
          await medusaMergeOrderMetadata(id, {
            fiscal: { emitida: false, motivo: decisao.aviso, em: new Date().toISOString() },
          })
        }
      } else {
        // Saída de escape para o operador despachar sem nota num caso excepcional — mas isso não
        // pode passar em silêncio: fica registrado no log do servidor.
        console.warn(
          `[fiscal] pedido ${id} despachado SEM emissão de NF-e (emitir_nfe=false)${operador ? ` — operador ${operador}` : ""}`
        )
      }

      // 1) rastreio: transportadora (SuperFrete, com garantirEtiqueta cuidando de nunca pagar em
      // dobro numa retentativa) ou manual
      let label: { tracking_number: string; tracking_url: string; label_url: string } | undefined
      if (body.use_carrier) {
        const fiscais = lerDadosFiscais(order)
        const pedidoParaEtiqueta = {
          itens: order.items.map((i) => ({ titulo: [i.title, i.variant_title].filter(Boolean).join(" — "), quantidade: i.quantity, preco_unitario: i.unit_price })),
          endereco: order.shipping_address,
          email: order.email ?? null,
          cpf: fiscais.cpf,
          numero: fiscais.numero,
          bairro: fiscais.bairro,
          display_id: order.display_id ?? null,
          dados_do_frete: order.shipping_methods?.[0]?.data ?? null,
        }
        // Pedido relido do Medusa AGORA, nunca o `order` carregado lá no início do handler — a
        // conferência e a emissão de NF-e já podem ter passado. Duas checagens nessa cópia fresca:
        // (1) fulfillment_status — se uma execução concorrente (outra instância do Cockpit) já
        // despachou o pedido nesse meio-tempo, aborta aqui, ANTES de gastar dinheiro com uma etiqueta
        // pra um pedido que já foi enviado; (2) metadata.frete, que a regra 3 de garantirEtiqueta
        // precisa enxergar para não comprar uma segunda etiqueta. Uma leitura só, não duas.
        const pedidoFresco = await medusaGetOrder(id)
        if (pedidoFresco.fulfillment_status !== "not_fulfilled") {
          return NextResponse.json({ error: "Este pedido já foi despachado." }, { status: 400 })
        }
        const estadoAtual = lerEstadoDoFrete(pedidoFresco.metadata)
        const etiqueta = await garantirEtiqueta(
          {
            criar: () => carrierCriarFrete(pedidoParaEtiqueta, chaveNfe),
            pagar: carrierPagarFrete,
            consultar: carrierConsultarFrete,
            // Grava o estado do frete no metadata a cada passo (iniciando/pendente/paga) — ANTES do
            // fulfillment: se ele falhar, o id/status não se perde (é o que permite a retentativa
            // acertar sozinha, sem pagar de novo, e o que permitiria cancelar a etiqueta depois).
            salvar: (estado) => medusaMergeOrderMetadata(id, { frete: estado }),
          },
          estadoAtual
        )
        label = { tracking_number: etiqueta.tracking_number, tracking_url: etiqueta.tracking_url, label_url: etiqueta.label_url }
      } else if (body.tracking_number?.trim()) {
        label = {
          tracking_number: body.tracking_number.trim(),
          tracking_url: body.tracking_url?.trim() || "",
          label_url: body.label_url?.trim() || "",
        }
      }

      // 2) fulfillment + envio no Medusa
      const fulfillmentId = await medusaFulfillOrder(id, items)
      await medusaShipFulfillment(id, fulfillmentId, items, label)

      // 3) aviso à cliente.
      //
      // Etiqueta da SuperFrete COM o interruptor ligado (spec §9, 2026-09-21): o Cockpit NÃO manda o
      // WhatsApp — o código de rastreio pode levar dezenas de segundos para existir, e a mensagem
      // espera por ele. Quem
      // envia é o backend (webhook order.generated + verificação a cada 5 min), um remetente só. Aqui:
      // grava o estado em metadata.frete.aviso_despacho e, se ficou pendente, pede ao backend que
      // tente na hora (melhor esforço). O despacho já aconteceu neste ponto, então nenhuma falha
      // daqui vira erro da rota: vira aviso na resposta.
      //
      // Um bloco só manda o WhatsApp daqui (o `else if` abaixo): o despacho manual (código digitado ou
      // sem código) e o despacho com etiqueta com o interruptor DESLIGADO — igual a antes, avisa na
      // hora com o que houver; só menciona rastreio quando ele existe de fato.
      let whatsapp: { ok: boolean; error?: string } | null = null
      let avisoDespacho: AvisoDespacho | null = null
      let avisoDespachoErro: string | null = null
      const phone = order.shipping_address?.phone
      if (body.use_carrier && avisoPeloBackend()) {
        const aviso = avisoAoDespacharComEtiqueta({
          notificar: body.notify === true,
          temTelefone: !!phone,
          agora: new Date().toISOString(),
        })
        try {
          await gravarAvisoDespacho(id, aviso)
          avisoDespacho = aviso
        } catch (e) {
          // Só texto fixo + id + status HTTP: a mensagem do erro pode trazer o corpo da resposta do
          // Medusa (medusaMergeOrderMetadata), que pode ecoar o metadata do pedido (ex.: e-mail do
          // operador na conferência).
          const http = /HTTP (\d{3})/.exec((e as Error)?.message ?? "")?.[1]
          console.error(`[aviso-despacho] pedido ${id}: não foi possível gravar o aviso no pedido${http ? ` (HTTP ${http})` : ""}`)
          avisoDespachoErro =
            "Não foi possível registrar o aviso à cliente no pedido. Avise a cliente à mão pelo WhatsApp."
        }
        if (avisoDespacho?.status === "pendente") {
          avisoDespacho = (await pedirAvisoAoBackend(id)) ?? avisoDespacho
        }
      } else if (body.notify && phone) {
        const nome = order.shipping_address?.first_name || "tudo bem"
        const rastreio = label?.tracking_number
          ? `\n\n📦 Código de rastreio: *${label.tracking_number}*${label.tracking_url ? `\nAcompanhe: ${label.tracking_url}` : ""}`
          : ""
        const texto = `Oi, ${nome}! 💛\nSeu pedido *#${order.display_id}* da use.ÉCLAT acabou de ser enviado.${rastreio}\n\nQualquer dúvida, é só chamar por aqui. Obrigada por vestir a sua luz. ✨`
        whatsapp = await sendWhatsappText(normalizaWhatsapp(phone), texto)
      }

      return NextResponse.json({
        ok: true,
        conferencia: conferencia.registro.status,
        tracking_number: label?.tracking_number ?? null,
        label_url: label?.label_url ?? null,
        whatsapp,
        aviso_despacho: avisoDespacho,
        aviso_despacho_erro: avisoDespachoErro,
        aviso_fiscal: avisoFiscal,
      })
    })
  } catch (e) {
    if (e instanceof DespachoEmAndamento) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
