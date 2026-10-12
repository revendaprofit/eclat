import { NextResponse } from "next/server"
import { aplicar, gravarIgnorados, lerIgnorados } from "@/lib/carrinhos-ignorados"

// POST /api/carrinhos/ignorar { acao: "ignorar" | "restaurar", ids: ["cart_..."] }
// Marca carrinhos como teste (somem da lista) ou devolve à lista. Só mexe no Supabase (site_content); o
// carrinho no Medusa fica intacto.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { acao?: string; ids?: unknown }
  const acao = body.acao === "restaurar" ? "restaurar" : body.acao === "ignorar" ? "ignorar" : null
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []
  if (!acao || !ids.length) return NextResponse.json({ error: "Informe acao (ignorar|restaurar) e ids." }, { status: 400 })
  const novo = aplicar(await lerIgnorados(), acao, ids)
  if (!(await gravarIgnorados(novo))) return NextResponse.json({ error: "Supabase não gravou." }, { status: 502 })
  return NextResponse.json({ ok: true, ignorados: novo.ids.length })
}
