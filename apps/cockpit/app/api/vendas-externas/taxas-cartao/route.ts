import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { normalizarTaxas, type TaxasCartao } from "@/lib/venda-externa"

// Taxas da maquininha (em %) por forma: débito e crédito 1x..12x. Guardadas em site_content
// "cockpit.taxas_cartao"; a sócia preenche na tela de Vendas fora do site. Usadas para gravar o líquido real.
export const CHAVE = "cockpit.taxas_cartao"

export async function lerTaxas(): Promise<TaxasCartao> {
  const r = await sb(`site_content?key=eq.${CHAVE}&select=value`)
  if (!r.ok) return normalizarTaxas(null)
  const linhas = (await r.json()) as { value: unknown }[]
  return normalizarTaxas(linhas[0]?.value)
}

export async function GET() {
  return NextResponse.json(await lerTaxas())
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const taxas = normalizarTaxas(body)
  const w = await sb("site_content?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: CHAVE, value: taxas, updated_at: new Date().toISOString() }),
  })
  if (!w.ok) return NextResponse.json({ error: `Supabase ${w.status}` }, { status: 502 })
  return NextResponse.json(taxas)
}
