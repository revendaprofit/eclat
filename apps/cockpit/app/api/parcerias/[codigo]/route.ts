import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaOrdersComCupom, medusaSetPromotionStatus } from "@/lib/medusa"
import { resumoParceria, validarEdicao, vendasDaParceria, type Parceria } from "@/lib/parcerias"

type Ctx = { params: Promise<{ codigo: string }> }

async function lerParceria(codigo: string): Promise<Parceria | null> {
  const r = await sb(`parceria?codigo=eq.${encodeURIComponent(codigo)}&select=*`)
  if (!r.ok) throw new Error(`Supabase respondeu HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return ((await r.json()) as Parceria[])[0] ?? null
}

// Ficha: parceria + todas as vendas com o cupom + resumo.
export async function GET(_req: Request, { params }: Ctx) {
  const codigo = (await params).codigo.toUpperCase()
  try {
    const [parceria, pedidos] = await Promise.all([lerParceria(codigo), medusaOrdersComCupom()])
    if (!parceria) return NextResponse.json({ error: `Parceria ${codigo} não encontrada.` }, { status: 404 })
    const vendas = vendasDaParceria(pedidos, parceria)
    const hoje = new Date().toISOString().slice(0, 10)
    return NextResponse.json({ hoje, parceria, vendas, resumo: resumoParceria(vendas, hoje) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

// Edita nome/@/WhatsApp/comissão/notas/ativa. `ativa` liga/desliga também o cupom no Medusa
// (parceira desativada = cupom parado na loja). O desconto não se edita: é outro cupom.
export async function PATCH(req: Request, { params }: Ctx) {
  const codigo = (await params).codigo.toUpperCase()
  const v = validarEdicao((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if (!v.ok) return NextResponse.json({ error: v.erros.join(" ") }, { status: 400 })
  try {
    const atual = await lerParceria(codigo)
    if (!atual) return NextResponse.json({ error: `Parceria ${codigo} não encontrada.` }, { status: 404 })
    if (v.valor.ativa !== undefined && v.valor.ativa !== atual.ativa) {
      await medusaSetPromotionStatus(atual.medusa_promotion_id, v.valor.ativa ? "active" : "inactive")
    }
    const r = await sb(`parceria?codigo=eq.${encodeURIComponent(codigo)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(v.valor),
    })
    if (!r.ok) throw new Error(`gravar parceria falhou (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`)
    const [parceria] = (await r.json()) as Parceria[]
    return NextResponse.json({ parceria })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
