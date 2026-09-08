// Agrupa as imagens de um produto por COR (spec 4.5): uma imagem pertence à cor
// quando está vinculada a todas as variantes de tamanho daquela cor. Puro.

export type RawImage = { id: string; url: string }
export type RawVariant = {
  id: string
  options?: { option_id: string; value: string }[]
  images?: { id: string }[]
}
export type RawProductImages = {
  thumbnail: string | null
  images: RawImage[]
  options: { id: string; title: string }[]
  variants: RawVariant[]
}
export type ColorGroup = { color: string; variant_ids: string[]; images: RawImage[] }
export type GroupedImages = { thumbnail: string | null; groups: ColorGroup[]; unassigned: RawImage[] }

export function groupImagesByColor(p: RawProductImages): GroupedImages {
  const corOpt = p.options.find((o) => o.title.trim().toLowerCase() === "cor")
  if (!corOpt) return { thumbnail: p.thumbnail, groups: [], unassigned: [...p.images] }

  const byColor = new Map<string, RawVariant[]>()
  for (const v of p.variants) {
    const cor = (v.options ?? []).find((o) => o.option_id === corOpt.id)?.value
    if (!cor) continue
    if (!byColor.has(cor)) byColor.set(cor, [])
    byColor.get(cor)!.push(v)
  }

  const assigned = new Set<string>()
  const groups: ColorGroup[] = []
  for (const [color, vs] of byColor) {
    const images = p.images.filter((img) => vs.every((v) => (v.images ?? []).some((i) => i.id === img.id)))
    images.forEach((i) => assigned.add(i.id))
    groups.push({ color, variant_ids: vs.map((v) => v.id), images })
  }
  return { thumbnail: p.thumbnail, groups, unassigned: p.images.filter((i) => !assigned.has(i.id)) }
}
