import { NextResponse } from "next/server"
import { medusaGetCustomer, medusaOrdersByCustomer } from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"

// Ficha 360°: dados do cliente + endereços + pedidos + vínculo de relacionamento
// (lead/conversa e cliente_rel no Supabase, por medusa_customer_id).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const [{ customer, addresses }, orders] = await Promise.all([
      medusaGetCustomer(id),
      medusaOrdersByCustomer(id),
    ])

    // CRM (Supabase) — não falha a ficha se o Supabase recusar
    let lead: { id: string; whatsapp: string | null; status: string; conversation_id: string | null } | null = null
    let cliente_rel: { tags: string[] | null; notas: string | null; consentimento_lgpd: boolean } | null = null
    try {
      const lr = await sb(
        `lead?medusa_customer_id=eq.${id}&select=id,whatsapp,status,conversation(id)&limit=1`
      )
      if (lr.ok) {
        const rows = (await lr.json()) as Array<{
          id: string
          whatsapp: string | null
          status: string
          conversation: { id: string }[] | null
        }>
        const l = rows[0]
        if (l)
          lead = {
            id: l.id,
            whatsapp: l.whatsapp,
            status: l.status,
            conversation_id: l.conversation?.[0]?.id ?? null,
          }
      }
      const cr = await sb(
        `cliente_rel?medusa_customer_id=eq.${id}&select=tags,notas,consentimento_lgpd&limit=1`
      )
      if (cr.ok) {
        const rows = (await cr.json()) as Array<{
          tags: string[] | null
          notas: string | null
          consentimento_lgpd: boolean
        }>
        if (rows[0]) cliente_rel = rows[0]
      }
    } catch {
      /* CRM opcional */
    }

    return NextResponse.json({ customer, addresses, orders, lead, cliente_rel })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
