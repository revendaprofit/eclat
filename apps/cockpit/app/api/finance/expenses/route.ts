import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Lista despesas (opcional: período ?de=YYYY-MM-DD&ate=YYYY-MM-DD) com a categoria embutida.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const de = u.searchParams.get("de")
  const ate = u.searchParams.get("ate")
  let q =
    "finance_expense?select=id,data,descricao,valor_centavos,fornecedor,recorrencia,categoria_id,finance_expense_category(nome)&order=data.desc"
  if (de) q += `&data=gte.${de}`
  if (ate) q += `&data=lte.${ate}`
  const r = await sb(q)
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const b = (await req.json()) as {
    data?: string
    categoria_id?: string | null
    descricao?: string
    valor_centavos?: number
    fornecedor?: string
    recorrencia?: string
  }
  if (!b.data) return NextResponse.json({ error: "data obrigatória" }, { status: 400 })
  if (!Number.isInteger(b.valor_centavos) || (b.valor_centavos ?? -1) < 0)
    return NextResponse.json({ error: "valor inválido" }, { status: 400 })
  const r = await sb("finance_expense", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      data: b.data,
      categoria_id: b.categoria_id || null,
      descricao: b.descricao || null,
      valor_centavos: b.valor_centavos,
      fornecedor: b.fornecedor || null,
      recorrencia: b.recorrencia || null,
    }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const d = await r.json()
  return NextResponse.json(Array.isArray(d) ? d[0] : d)
}
