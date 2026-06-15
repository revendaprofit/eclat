import { NextResponse } from "next/server"
import { medusaListTags, medusaCreateTag } from "@/lib/medusa"

export async function GET() {
  try {
    return NextResponse.json(await medusaListTags())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const { value } = (await req.json()) as { value?: string }
  if (!value?.trim()) return NextResponse.json({ error: "valor obrigatório" }, { status: 400 })
  try {
    return NextResponse.json(await medusaCreateTag(value.trim()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
