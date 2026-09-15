import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// GET /api/clube/mensagens?status=rascunho|aprovada|enviada|falhou|descartada&origem=agenda|gatilho|manual
export async function GET(req: Request) {
  const u = new URL(req.url)
  const status = u.searchParams.get("status")
  const origem = u.searchParams.get("origem")
  const limit = Number(u.searchParams.get("limit") || 200)
  const q = ["select=*", `limit=${limit}`, "order=enviar_em.asc.nullslast,criado_em.desc"]
  if (status) q.push(`status=eq.${status}`)
  if (origem) q.push(`origem=eq.${origem}`)
  const r = await sb(`clube_mensagens?${q.join("&")}`)
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

// POST /api/clube/mensagens — mensagem manual (ou nova entrada na agenda)
export async function POST(req: Request) {
  const b = (await req.json()) as { texto?: string; titulo?: string; midia?: string | null; enviar_em?: string | null; aprovar?: boolean; origem?: string }
  if (!b.texto?.trim()) return NextResponse.json({ error: "texto obrigatório" }, { status: 400 })
  const agora = new Date().toISOString()
  const row = {
    origem: b.origem === "agenda" ? "agenda" : "manual",
    status: b.aprovar ? "aprovada" : "rascunho",
    enviar_em: b.enviar_em || agora,
    titulo: b.titulo?.trim() || b.texto.trim().slice(0, 60),
    texto: b.texto.trim(),
    midia: b.midia?.trim() || null,
    aprovado_em: b.aprovar ? agora : null,
  }
  const r = await sb("clube_mensagens", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = await r.json()
  return NextResponse.json(rows[0] ?? {})
}
