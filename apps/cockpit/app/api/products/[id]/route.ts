import { NextResponse } from "next/server"
import {
  medusaGetProduct,
  medusaUpdateProduct,
  medusaDeleteProduct,
} from "@/lib/medusa"

// Detalhe do produto (para o formulário de edição).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    return NextResponse.json(await medusaGetProduct(id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

// Atualiza campos do produto (título, descrição, coleção, categorias, metadata, etc.).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const fields = await req.json()
  try {
    await medusaUpdateProduct(id, fields)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

// Exclui o produto.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await medusaDeleteProduct(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
