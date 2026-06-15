import { NextResponse } from "next/server"
import { medusaUpdateProductStatus } from "@/lib/medusa"

// Alterna o status do produto (published / draft) via Medusa Admin API.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { status } = (await req.json()) as { status?: string }
  if (status !== "published" && status !== "draft") {
    return NextResponse.json(
      { error: "status deve ser 'published' ou 'draft'" },
      { status: 400 }
    )
  }
  try {
    await medusaUpdateProductStatus(id, status)
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
