import { NextResponse } from "next/server"
import { medusaUpdateTag, medusaDeleteTag } from "@/lib/medusa"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { value } = (await req.json()) as { value?: string }
  if (!value?.trim()) return NextResponse.json({ error: "valor obrigatório" }, { status: 400 })
  try {
    await medusaUpdateTag(id, value.trim())
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
    await medusaDeleteTag(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
