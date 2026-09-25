// Foto da linha da sacola. Achado de 2026-09-25: a sacola usava `item.thumbnail`, que o Medusa
// copia da capa do PRODUTO — o Aurora Grafitti aparecia com a foto Telha. As fotos de cada cor
// ficam nas variantes (todas as variantes da cor têm as mesmas), então a primeira foto da
// variante é a da cor certa.

type ItemComFoto = {
  thumbnail?: string | null
  variant?: { images?: { url?: string | null; rank?: number | null }[] | null } | null
}

export function fotoDoItem(item: ItemComFoto): string | null {
  const imagens = (item.variant?.images ?? []).filter((i) => !!i?.url)
  if (imagens.length) {
    const primeira = [...imagens].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))[0]
    return primeira.url ?? null
  }
  return item.thumbnail ?? null
}
