import { NextResponse } from "next/server"
import { medusaUpdateCollection, medusaDeleteCollection } from "@/lib/medusa"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const fields = (await req.json()) as { title?: string; handle?: string }
  try {
    await medusaUpdateCollection(id, fields)
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
    await medusaDeleteCollection(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
