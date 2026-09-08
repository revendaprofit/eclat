import { NextResponse } from "next/server"
import { medusaGetProductImages, medusaRemoveProductImage, medusaSetImageVariants } from "@/lib/medusa"
import { groupImagesByColor } from "@/lib/color-images"

type Params = { params: Promise<{ id: string; imageId: string }> }

// PATCH { color: string | null }: move a imagem para a cor (ou tira de todas).
export async function PATCH(req: Request, { params }: Params) {
  const { id, imageId } = await params
  const { color } = (await req.json()) as { color: string | null }
  try {
    const raw = await medusaGetProductImages(id)
    const g = groupImagesByColor(raw)
    const todasVariantes = raw.variants.map((v) => v.id)
    const alvo = color ? g.groups.find((x) => x.color === color) : null
    if (color && !alvo) return NextResponse.json({ error: `cor "${color}" não existe neste produto` }, { status: 400 })
    const add = alvo ? alvo.variant_ids : []
    const remove = todasVariantes.filter((vid) => !add.includes(vid))
    await medusaSetImageVariants(id, imageId, add, remove)
    return NextResponse.json(groupImagesByColor(await medusaGetProductImages(id)))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, imageId } = await params
  try {
    await medusaRemoveProductImage(id, imageId)
    return NextResponse.json(groupImagesByColor(await medusaGetProductImages(id)))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
