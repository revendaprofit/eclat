import { NextResponse } from "next/server"
import { medusaUpdateCategory, medusaDeleteCategory } from "@/lib/medusa"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const fields = (await req.json()) as {
    name?: string
    parent_id?: string | null
    rank?: number
    metadata?: Record<string, unknown>
  }
  if (fields.rank !== undefined && !(Number.isFinite(fields.rank) && fields.rank >= 0))
    return NextResponse.json({ error: "rank deve ser número ≥ 0" }, { status: 400 })
  if (fields.metadata !== undefined && (typeof fields.metadata !== "object" || fields.metadata === null))
    return NextResponse.json({ error: "metadata inválido" }, { status: 400 })
  try {
    await medusaUpdateCategory(id, fields)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await medusaDeleteCategory(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
