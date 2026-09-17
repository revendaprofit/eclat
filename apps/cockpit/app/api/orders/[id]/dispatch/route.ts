import { NextResponse } from "next/server"
import { medusaGetOrder, medusaFulfillOrder, medusaMergeOrderMetadata, medusaShipFulfillment, medusaAdmin } from "@/lib/medusa"
import { validarConferencia, type ConferenciaEnviada } from "@/lib/leitor"
import { decidirDespacho, type ResultadoEmissao } from "@/lib/fiscal-despacho"
import { createSupabaseServer } from "@/lib/supabase/server"
import { carrierCreateLabel } from "@/lib/shipping"
import { sendWhatsappText } from "@/lib/evolution"

// Despacha um pedido: confere as peças (leitor) + emite a NF-e + cria fulfillment + marca envio
// (com rastreio) + avisa o cliente por WhatsApp. Rastreio: manual (tracking_number) OU gerado pela
// transportadora (use_carrier). Conferência (spec leitor-codigo-barras F1): a tela manda as
// leituras; o servidor recalcula contra os itens reais do pedido e só despacha conferência
// divergente com motivo. O registro vai para metadata.conferencia ANTES do fulfillment.
//
// A decisão "emissão falhou → aborta o despacho" mora em lib/fiscal-despacho.ts (decidirDespacho),
// não aqui — é a regra fiscal/legal de maior risco do projeto, e uma route.ts sem teste (como toda
// route.ts do Cockpit hoje) deixaria um refactor futuro reordenar os blocos e despachar sem nota
// em silêncio. Aqui a rota fica fina: chama a Admin API, monta o ResultadoEmissao, obedece.

function normalizaWhatsapp(phone: string): string {
  const d = phone.replace(/\D/g, "")
  if (d.startsWith("55")) return d
  if (d.length === 10 || d.length === 11) return "55" + d
  return d
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
  }

  try {
    const order = await medusaGetOrder(id)
    if (order.fulfillment_status !== "not_fulfilled") {
      return NextResponse.json({ error: "Este pedido já foi despachado." }, { status: 400 })
    }
    const items = order.items.map((i) => ({ id: i.id, quantity: i.quantity }))

    // 0) conferência das peças (leitor de código de barras)
    let operador: string | null = null
    try {
      const { data } = await (await createSupabaseServer()).auth.getUser()
      operador = data.user?.email ?? null
    } catch {
      operador = null
    }
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
      } else {
        avisoFiscal = decisao.aviso
        console.warn(
          `[fiscal] pedido ${id} despachado SEM nota — ${decisao.aviso}${operador ? ` — operador ${operador}` : ""}`
        )
      }
    } else {
      // Saída de escape para o operador despachar sem nota num caso excepcional — mas isso não
      // pode passar em silêncio: fica registrado no log do servidor.
      console.warn(
        `[fiscal] pedido ${id} despachado SEM emissão de NF-e (emitir_nfe=false)${operador ? ` — operador ${operador}` : ""}`
      )
    }

    // 1) rastreio: transportadora ou manual
    let label: { tracking_number: string; tracking_url: string; label_url: string } | undefined
    if (body.use_carrier) {
      const a = order.shipping_address
      label = await carrierCreateLabel({
        destino: {
          nome: [a?.first_name, a?.last_name].filter(Boolean).join(" ") || order.email || "Cliente",
          telefone: a?.phone ?? null,
          endereco: a?.address_1 ?? null,
          cidade: a?.city ?? null,
          estado: a?.province ?? null,
          cep: a?.postal_code ?? null,
        },
      })
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

    // 3) aviso por WhatsApp (se pedido + telefone)
    let whatsapp: { ok: boolean; error?: string } | null = null
    const phone = order.shipping_address?.phone
    if (body.notify && phone) {
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
      aviso_fiscal: avisoFiscal,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
