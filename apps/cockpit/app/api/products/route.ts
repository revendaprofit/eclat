import { NextResponse } from "next/server"
import { medusaListProducts } from "@/lib/medusa"

// Lista produtos do Medusa (comércio é fonte da verdade — só leitura aqui).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || undefined
  try {
    const products = await medusaListProducts(q)
    return NextResponse.json(products)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
