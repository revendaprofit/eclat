import { NextRequest, NextResponse } from "next/server"
import { suggestProducts } from "@lib/data/search"

// Sugestões de produto da barra de busca (spec §9). GET cacheável na borda; nunca 500 (lista vazia em erro).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  const cc = req.nextUrl.searchParams.get("cc") ?? "br"
  const products = await suggestProducts(q, cc)
  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  )
}
