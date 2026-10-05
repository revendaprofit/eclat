import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"

// "Ler perfis agora": dispara no backend a rotina diária do ciclo (lê o Instagram das creators, cadastra os posts
// que citam a marca, liga vendas sem número e marca vencedores). A rotina também roda sozinha todo dia às 7h.
export async function POST() {
  try {
    const r = await medusaAdmin("/admin/creators/ler-perfis", { method: "POST" })
    if (!r.ok) throw new Error(`o backend respondeu HTTP ${r.status}`)
    return NextResponse.json(await r.json())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
