import { NextResponse } from "next/server"
import { medusaListCategories, medusaCreateCategory } from "@/lib/medusa"

export async function GET() {
  try {
    return NextResponse.json(await medusaListCategories())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const { name, parent_id } = (await req.json()) as { name?: string; parent_id?: string | null }
  if (!name?.trim()) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 })
  try {
    return NextResponse.json(await medusaCreateCategory({ name: name.trim(), parent_id }))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
