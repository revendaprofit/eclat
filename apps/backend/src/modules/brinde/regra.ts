// Presente por faixa de compra (desenho: docs/superpowers/specs/2026-09-30-brindes-por-faixa-design.md).
// Meia a partir de R$ 250, óculos a partir de R$ 550; UM presente por pedido. A base é a mesma do frete grátis
// (peças já com cupom/conjunto, sem frete, sem o Pix — modules/superfrete/base-carrinho.ts). Tudo aqui é puro:
// quem busca carrinho, configuração e contagem são a rota, as travas e o subscriber.
//
// Espelho na vitrine: apps/storefront/src/lib/util/brinde.ts — se mudar uma regra aqui, mude lá.

export type FaixaId = "meia" | "oculos"

export type Faixa = {
  id: FaixaId
  minimo_centavos: number
  product_handle: string
  limite: number // quantos presentes desta faixa podem sair desde `inicio`
}

export type ConfigBrindes = { ativo: boolean; inicio: string; faixas: Faixa[] }

/** Presentes já dados desde `inicio`, por faixa (pedidos não cancelados). */
export type Usados = Partial<Record<FaixaId, number>>

export type LinhaDoCarrinho = {
  id?: string
  variant_id?: string | null
  product_handle?: string | null
  unit_price?: unknown
  quantity?: unknown
  metadata?: Record<string, unknown> | null
}

const IDS: FaixaId[] = ["meia", "oculos"]

/** Lê o JSON de site_content "brindes". Qualquer coisa fora do formato = sem presente (null). */
export function lerConfig(raw: unknown): ConfigBrindes | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (r.ativo !== true || !Array.isArray(r.faixas)) return null
  const faixas: Faixa[] = []
  for (const f of r.faixas as Record<string, unknown>[]) {
    const id = f?.id as FaixaId
    const minimo = Number(f?.minimo_centavos)
    const limite = Number(f?.limite)
    const handle = typeof f?.product_handle === "string" ? f.product_handle.trim() : ""
    if (!IDS.includes(id) || !Number.isInteger(minimo) || minimo <= 0 || !handle) continue
    if (!Number.isInteger(limite) || limite < 0) continue
    if (faixas.some((x) => x.id === id)) continue
    faixas.push({ id, minimo_centavos: minimo, product_handle: handle, limite })
  }
  if (!faixas.length) return null
  faixas.sort((a, b) => a.minimo_centavos - b.minimo_centavos)
  const inicio = typeof r.inicio === "string" && !Number.isNaN(Date.parse(r.inicio)) ? r.inicio : "1970-01-01T00:00:00Z"
  return { ativo: true, inicio, faixas }
}

function temEstoque(f: Faixa, usados: Usados): boolean {
  return (usados[f.id] ?? 0) < f.limite
}

/** Faixas que a cliente pode escolher com esta base (atingiu o mínimo e ainda há presente reservado). */
export function faixasLiberadas(base: number, config: ConfigBrindes | null, usados: Usados): Faixa[] {
  if (!config) return []
  return config.faixas.filter((f) => base >= f.minimo_centavos && temEstoque(f, usados))
}

/** Próxima faixa ainda não atingida (para "faltam R$ X"); null se não há mais nada a ganhar. */
export function proximaFaixa(
  base: number,
  config: ConfigBrindes | null,
  usados: Usados
): { faixa: Faixa; falta_centavos: number } | null {
  if (!config) return null
  const f = config.faixas.find((x) => base < x.minimo_centavos && temEstoque(x, usados))
  return f ? { faixa: f, falta_centavos: f.minimo_centavos - base } : null
}

export function ehLinhaDePresente(l: LinhaDoCarrinho): boolean {
  const b = l?.metadata?.brinde
  return typeof b === "string" && b.length > 0
}

export type Avaliacao =
  | { ok: true }
  | { ok: false; motivo: string; remover: string[] } // ids das linhas de presente a tirar

/**
 * O carrinho está com o presente em ordem? Usado pela trava do pagamento e do fechamento, e pela vitrine para
 * saber o que tirar. `usados` NÃO inclui este carrinho (ele ainda não é pedido).
 */
export function avaliarCarrinho(
  itens: LinhaDoCarrinho[],
  base: number,
  config: ConfigBrindes | null,
  usados: Usados
): Avaliacao {
  const presentes = itens.filter(ehLinhaDePresente)
  if (!presentes.length) return { ok: true }
  const ids = presentes.map((p) => p.id ?? "").filter(Boolean)
  const falha = (motivo: string): Avaliacao => ({ ok: false, motivo, remover: ids })

  if (!config) return falha("A promoção de presente não está ativa.")
  if (presentes.length > 1) return falha("Só um presente por pedido.")
  const p = presentes[0]
  const faixa = config.faixas.find((f) => f.id === p.metadata?.brinde)
  if (!faixa) return falha("Presente inválido.")
  if (Number(p.quantity) !== 1) return falha("O presente é uma unidade só.")
  if (Number(precoNumero(p.unit_price)) !== 0) return falha("Presente inválido.")
  if (p.product_handle && p.product_handle !== faixa.product_handle) return falha("Presente inválido.")
  if (base < faixa.minimo_centavos) return falha(mensagemAbaixo(faixa))
  if (!temEstoque(faixa, usados)) return falha("Os presentes desta faixa acabaram.")
  return { ok: true }
}

export function mensagemAbaixo(f: Faixa): string {
  const nome = f.id === "oculos" ? "o óculos" : "a meia"
  return `Seu presente saiu porque a sacola ficou abaixo de ${reais(f.minimo_centavos)} (valor para ganhar ${nome}).`
}

/** O Medusa entrega números ora crus, ora como BigNumber ({ numeric }) ou bruto ({ value }). */
function precoNumero(v: unknown): number {
  if (typeof v === "object" && v !== null) {
    const o = v as { numeric?: unknown; value?: unknown }
    if (typeof o.numeric === "number") return o.numeric
    if (o.value !== undefined) return Number(o.value)
  }
  return Number(v)
}

function reais(centavos: number): string {
  return `R$ ${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`
}
