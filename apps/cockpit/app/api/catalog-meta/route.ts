import { NextResponse } from "next/server"
import { medusaListCollections, medusaListCategories } from "@/lib/medusa"

// Coleções + categorias para preencher os selects do formulário de produto.
export async function GET() {
  try {
    const [collections, categories] = await Promise.all([
      medusaListCollections(),
      medusaListCategories(),
    ])
    return NextResponse.json({ collections, categories })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
