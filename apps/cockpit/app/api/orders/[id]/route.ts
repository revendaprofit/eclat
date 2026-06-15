import { NextResponse } from "next/server"
import { medusaGetOrder } from "@/lib/medusa"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    return NextResponse.json(await medusaGetOrder(id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
