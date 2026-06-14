import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaCreateCustomer } from "@/lib/medusa"

// Converte o lead em CLIENTE no Medusa (fonte da verdade do comércio),
// vincula medusa_customer_id no lead, marca status=convertido e cria o perfil
// de relacionamento (cliente_rel). Invariante: cliente vive no Medusa.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const lr = await sb(
    `lead?id=eq.${id}&select=nome,whatsapp,email,medusa_customer_id&limit=1`
  )
  if (!lr.ok) return NextResponse.json({ error: await lr.text() }, { status: 500 })
  const leads = (await lr.json()) as Array<{
    nome: string
    whatsapp: string | null
    email: string | null
    medusa_customer_id: string | null
  }>
  const lead = leads[0]
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 })
  if (lead.medusa_customer_id) {
    return NextResponse.json(
      { error: "Lead já convertido", customer_id: lead.medusa_customer_id },
      { status: 409 }
    )
  }

  const partes = (lead.nome || "Cliente").trim().split(/\s+/)
  const first_name = partes[0]
  const last_name = partes.slice(1).join(" ") || undefined
  const email =
    lead.email ||
    (lead.whatsapp ? `${lead.whatsapp}@whatsapp.eclat.local` : `lead-${id}@eclat.local`)

  let customer: { id: string }
  try {
    customer = await medusaCreateCustomer({
      email,
      first_name,
      last_name,
      phone: lead.whatsapp || undefined,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }

  await sb(`lead?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ medusa_customer_id: customer.id, status: "convertido" }),
  })

  // perfil de relacionamento (não duplica o cliente do Medusa)
  await sb("cliente_rel?on_conflict=medusa_customer_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ medusa_customer_id: customer.id, whatsapp: lead.whatsapp || null }),
  })

  return NextResponse.json({ ok: true, customer_id: customer.id })
}
