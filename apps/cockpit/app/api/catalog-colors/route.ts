import { NextResponse } from "next/server"
import { medusaListColorValues } from "@/lib/medusa"

export async function GET() {
  try {
    return NextResponse.json({ colors: await medusaListColorValues() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
