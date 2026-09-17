import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { ehUuid } from "@/lib/fiscal"

// DANFE em PDF. Rota dedicada porque o proxy /api/fiscal/* só fala JSON. O id é validado ANTES de
// montar a URL: ele é o único segmento variável de um caminho que recebe o token de admin.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!ehUuid(id)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 })
  }
  try {
    const r = await medusaAdmin(`/admin/fiscal/documentos/${id}/danfe`, { method: "GET" })
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      return NextResponse.json(data, { status: r.status })
    }
    return new NextResponse(await r.arrayBuffer(), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
