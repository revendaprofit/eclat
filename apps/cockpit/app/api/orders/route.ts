import { NextResponse } from "next/server"
import { medusaListOrders } from "@/lib/medusa"

// Lista de pedidos (Medusa = fonte da verdade).
export async function GET() {
  try {
    return NextResponse.json(await medusaListOrders())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
