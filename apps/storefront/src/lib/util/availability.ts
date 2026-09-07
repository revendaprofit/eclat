// Regras de disponibilidade e "novidade" — uma fonte só para card, filtros e PDP.
// Sem I/O, sem React: testável e usável em server e client components.

export type StockVariant = {
  id?: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
  options?: { option_id?: string | null; value?: string | null }[] | null
}

export type OptionDef = { id: string; title?: string | null }

type ProductLike = {
  options?: OptionDef[] | null
  variants?: StockVariant[] | null
}

export const LOW_STOCK_THRESHOLD = 3
export const NEW_DAYS = 30

// Mesma regra do botão de compra (product-actions): não gerencia estoque → sempre;
// backorder → sempre; senão precisa de quantidade > 0.
export function isVariantAvailable(v: StockVariant): boolean {
  if (!v.manage_inventory) return true
  if (v.allow_backorder) return true
  return (v.inventory_quantity ?? 0) > 0
}

export function isProductAvailable(variants: StockVariant[] | null | undefined): boolean {
  return (variants ?? []).some(isVariantAvailable)
}

export function optionValue(
  options: OptionDef[] | null | undefined,
  variant: StockVariant,
  title: string
): string | null {
  const opt = (options ?? []).find((o) => (o.title ?? "").toLowerCase() === title.toLowerCase())
  if (!opt) return null
  const hit = (variant.options ?? []).find((vo) => vo.option_id === opt.id)
  return hit?.value ?? null
}

export function variantsOfColor(product: ProductLike, color: string): StockVariant[] {
  return (product.variants ?? []).filter((v) => optionValue(product.options, v, "Cor") === color)
}

// Soma só quantidade numérica das variantes disponíveis (backorder sem estoque conta 0).
export function colorStock(product: ProductLike, color: string): number {
  return variantsOfColor(product, color)
    .filter(isVariantAvailable)
    .reduce((acc, v) => acc + Math.max(0, v.inventory_quantity ?? 0), 0)
}

export function isLowStock(product: ProductLike, color: string, threshold = LOW_STOCK_THRESHOLD): boolean {
  const vs = variantsOfColor(product, color)
  if (!vs.some(isVariantAvailable)) return false
  return colorStock(product, color) <= threshold
}

export function isNew(
  product: { created_at?: string | null; tags?: { value?: string | null }[] | null },
  now: number = Date.now()
): boolean {
  if ((product.tags ?? []).some((t) => (t.value ?? "").trim().toLowerCase() === "novo")) return true
  if (!product.created_at) return false
  const created = Date.parse(product.created_at)
  if (Number.isNaN(created)) return false
  return now - created < NEW_DAYS * 24 * 60 * 60 * 1000
}
