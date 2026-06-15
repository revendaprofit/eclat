import { NextResponse } from "next/server"
import { medusaGetOrder, medusaFulfillOrder, medusaShipFulfillment } from "@/lib/medusa"
import { carrierCreateLabel } from "@/lib/shipping"
import { sendWhatsappText } from "@/lib/evolution"

// Despacha um pedido: cria fulfillment + marca envio (com rastreio) + avisa o cliente por WhatsApp.
// Rastreio: manual (tracking_number) OU gerado pela transportadora (use_carrier).

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
  }

  try {
    const order = await medusaGetOrder(id)
    if (order.fulfillment_status !== "not_fulfilled") {
      return NextResponse.json({ error: "Este pedido já foi despachado." }, { status: 400 })
    }
    const items = order.items.map((i) => ({ id: i.id, quantity: i.quantity }))

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
      tracking_number: label?.tracking_number ?? null,
      label_url: label?.label_url ?? null,
      whatsapp,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
