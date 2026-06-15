import { NextResponse } from "next/server"
import { medusaGetCustomer, medusaOrdersByCustomer, medusaGetOrder } from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"
import { sendWhatsappText } from "@/lib/evolution"

// Follow-up por WhatsApp. Resolve o telefone na ordem: cliente → lead (Supabase) → último pedido.
function normalizaWhatsapp(phone: string): string {
  const d = phone.replace(/\D/g, "")
  if (d.startsWith("55")) return d
  if (d.length === 10 || d.length === 11) return "55" + d
  return d
}

async function resolverTelefone(id: string): Promise<string | null> {
  const { customer } = await medusaGetCustomer(id)
  if (customer.phone) return customer.phone
  try {
    const lr = await sb(`lead?medusa_customer_id=eq.${id}&select=whatsapp&limit=1`)
    if (lr.ok) {
      const rows = (await lr.json()) as { whatsapp: string | null }[]
      if (rows[0]?.whatsapp) return rows[0].whatsapp
    }
  } catch {
    /* opcional */
  }
  const orders = await medusaOrdersByCustomer(id)
  if (orders[0]) {
    const det = await medusaGetOrder(orders[0].id)
    if (det.shipping_address?.phone) return det.shipping_address.phone
  }
  return null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { text } = (await req.json()) as { text?: string }
  if (!text?.trim()) return NextResponse.json({ error: "mensagem vazia" }, { status: 400 })

  try {
    const phone = await resolverTelefone(id)
    if (!phone)
      return NextResponse.json(
        { error: "Cliente sem telefone (nem no cadastro, lead ou pedidos)." },
        { status: 400 }
      )
    const r = await sendWhatsappText(normalizaWhatsapp(phone), text.trim())
    if (!r.ok) return NextResponse.json({ error: r.error || "WhatsApp falhou" }, { status: 502 })
    return NextResponse.json({ ok: true, phone })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
