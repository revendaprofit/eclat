import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { validarEdicaoVideo } from "@/lib/creators"

const idValido = (id: string) => /^[0-9a-f-]{36}$/i.test(id)

// Editar o vídeo: nome, link do post, data de publicação e a marca "em anúncio".
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!idValido(id)) return NextResponse.json({ error: "Vídeo inválido." }, { status: 400 })
  const v = validarEdicaoVideo((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
  const r = await sb(`creator_entrega?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...v.valor, atualizado_em: new Date().toISOString() }),
  })
  if (!r.ok) return NextResponse.json({ error: `alteração falhou (HTTP ${r.status})` }, { status: 502 })
  const [video] = (await r.json()) as unknown[]
  return video ? NextResponse.json({ video }) : NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 })
}

// Apagar um vídeo cadastrado por engano (a leitura pegou um post que não era da marca). Só sem venda ligada:
// vídeo com venda fica, para a conta da creator não mudar.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!idValido(id)) return NextResponse.json({ error: "Vídeo inválido." }, { status: 400 })
  const vendas = await sb(`parceria_aviso?entrega_id=eq.${id}&select=order_id&limit=1`)
  if (!vendas.ok) return NextResponse.json({ error: `consulta falhou (HTTP ${vendas.status})` }, { status: 502 })
  if (((await vendas.json()) as unknown[]).length) {
    return NextResponse.json({ error: "Este vídeo tem venda ligada a ele e não pode ser apagado." }, { status: 409 })
  }
  const r = await sb(`creator_entrega?id=eq.${id}`, { method: "DELETE" })
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: `não foi possível apagar (HTTP ${r.status})` }, { status: 502 })
}
