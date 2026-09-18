// Produto oculto: publicado e comprável pelo link direto, mas fora de tudo o que lista
// produtos (vitrine, busca, sitemap, llms.txt, feed.xml do Google/Meta, feed da OpenAI).
// Serve para compra de teste em produção. Liga com `metadata.oculto = true` no produto.

type ComMetadata = { metadata?: Record<string, unknown> | null }

export function isProdutoOculto(p: ComMetadata | null | undefined): boolean {
  const v = p?.metadata?.oculto
  return v === true || v === "true"
}

// Consulta que pede um produto específico (PDP por handle, hidratação por id) precisa
// enxergar o oculto; qualquer outra consulta é listagem e não enxerga.
function pedeProdutoEspecifico(queryParams: unknown): boolean {
  const q = (queryParams ?? {}) as Record<string, unknown>
  return q.handle != null || q.id != null
}

export function semOcultos<P extends ComMetadata>(
  resposta: { products: P[]; count: number },
  queryParams: unknown
): { products: P[]; count: number } {
  if (pedeProdutoEspecifico(queryParams)) return resposta
  const products = resposta.products.filter((p) => !isProdutoOculto(p))
  const removidos = resposta.products.length - products.length
  if (removidos === 0) return resposta
  return { products, count: Math.max(0, resposta.count - removidos) }
}
