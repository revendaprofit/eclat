import { NextResponse } from "next/server"
import { medusaListCollectionsManage, medusaCreateCollection } from "@/lib/medusa"

export async function GET() {
  try {
    return NextResponse.json(await medusaListCollectionsManage())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const { title, handle } = (await req.json()) as { title?: string; handle?: string }
  if (!title?.trim()) return NextResponse.json({ error: "título obrigatório" }, { status: 400 })
  if (!handle?.trim()) return NextResponse.json({ error: "handle obrigatório" }, { status: 400 })
  try {
    return NextResponse.json(
      await medusaCreateCollection({ title: title.trim(), handle: handle.trim() })
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
