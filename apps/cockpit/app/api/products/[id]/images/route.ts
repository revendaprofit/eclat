import { NextResponse } from "next/server"
import {
  medusaAddProductImages,
  medusaGetProductImages,
  medusaSetImageVariants,
  medusaSetThumbnail,
} from "@/lib/medusa"
import { groupImagesByColor } from "@/lib/color-images"

type Params = { params: Promise<{ id: string }> }

async function grouped(id: string) {
  return groupImagesByColor(await medusaGetProductImages(id))
}

// GET: imagens agrupadas por cor.
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    return NextResponse.json(await grouped(id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

// POST { urls, color? }: adiciona imagens e vincula à cor. POST { thumbnail }: define a capa.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const body = (await req.json()) as { urls?: string[]; color?: string; thumbnail?: string | null }
  try {
    if ("thumbnail" in body) {
      await medusaSetThumbnail(id, body.thumbnail ?? null)
      return NextResponse.json(await grouped(id))
    }
    const urls = (body.urls ?? []).filter((u) => typeof u === "string" && u.trim())
    if (!urls.length) return NextResponse.json({ error: "urls obrigatório" }, { status: 400 })
    let variant_ids: string[] | undefined
    if (body.color) {
      const g = await grouped(id)
      const grupo = g.groups.find((x) => x.color === body.color)
      if (!grupo) return NextResponse.json({ error: `cor "${body.color}" não existe neste produto` }, { status: 400 })
      variant_ids = grupo.variant_ids
    }
    const novas = await medusaAddProductImages(id, urls)
    if (variant_ids) {
      for (const img of novas) await medusaSetImageVariants(id, img.id, variant_ids, [])
    }
    return NextResponse.json(await grouped(id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
