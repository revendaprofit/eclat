import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { normalizarAlmoxarifado, type Almoxarifado } from "@/lib/almoxarifado"

// Almoxarifado: GET devolve o estoque de insumos + as fichas (para calcular a necessidade da próxima produção);
// PUT grava o estoque inteiro (a tela edita e salva). site_content "cockpit.almoxarifado".
export const CHAVE = "cockpit.almoxarifado"

export async function lerAlmoxarifado(): Promise<Almoxarifado> {
  const r = await sb(`site_content?key=eq.${CHAVE}&select=value`)
  if (!r.ok) return normalizarAlmoxarifado(null)
  const linhas = (await r.json()) as { value: unknown }[]
  return normalizarAlmoxarifado(linhas[0]?.value)
}

export async function GET() {
  const [almox, fr] = await Promise.all([lerAlmoxarifado(), sb("costing_piece?select=id,name,collection,lote_pecas,costing_item(name,consumption)&order=name.asc")])
  const fichas = fr.ok ? ((await fr.json()) as { id: string; name: string; collection: string | null; lote_pecas: number; costing_item: { name: string; consumption: number }[] }[]) : []
  return NextResponse.json({ ...almox, fichas: fichas.map((f) => ({ id: f.id, name: f.name, collection: f.collection, lote: f.lote_pecas, itens: f.costing_item ?? [] })) })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const almox = normalizarAlmoxarifado(body)
  const agora = new Date().toISOString()
  for (const i of almox.itens) i.atualizado_em = i.atualizado_em ?? agora
  const w = await sb("site_content?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: CHAVE, value: almox, updated_at: agora }),
  })
  if (!w.ok) return NextResponse.json({ error: `Supabase ${w.status}` }, { status: 502 })
  return NextResponse.json(almox)
}
