// Presente por faixa na sacola (desenho: docs/superpowers/specs/2026-09-30-brindes-por-faixa-design.md).
// A regra de verdade mora no backend (modules/brinde/regra.ts, rota /store/carts/:id/brinde); aqui só o que a
// tela precisa para escrever as frases.

export type FaixaId = "meia" | "oculos"

export type EstadoBrinde = {
  ativo: boolean
  base_centavos: number
  liberadas: { id: FaixaId; minimo_centavos: number; product_handle: string }[]
  proxima: { id: FaixaId; minimo_centavos: number; falta_centavos: number } | null
  faixas: { id: FaixaId; minimo_centavos: number; product_handle: string }[]
  presente: { line_item_id: string; variant_id: string; faixa: FaixaId } | null
  valido: boolean
  motivo: string | null
}

export type OpcaoDePresente = { variant_id: string; rotulo: string; disponivel: boolean }

export const NOME_DO_PRESENTE: Record<FaixaId, string> = { meia: "uma meia Éclat", oculos: "o óculos Éclat" }

export function ehLinhaDePresente(item: { metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  const b = item?.metadata?.brinde
  return typeof b === "string" && b.length > 0
}

/** Percentual da barra até a próxima faixa (ou 100 quando não há mais nada a ganhar). */
export function percentualAteProxima(e: EstadoBrinde): number {
  if (!e.proxima) return 100
  return Math.max(0, Math.min(100, Math.round((e.base_centavos / e.proxima.minimo_centavos) * 100)))
}

/**
 * O que a cliente pode escolher agora: a faixa mais alta liberada primeiro (óculos antes de meia). Um presente só;
 * quem já tem a meia e chegou no óculos vê as duas e pode trocar.
 */
export function faixasParaEscolher(e: EstadoBrinde): FaixaId[] {
  return [...e.liberadas].sort((a, b) => b.minimo_centavos - a.minimo_centavos).map((f) => f.id)
}

/** "34-38 · Cinza & Grafitti" a partir das opções da variante (tamanho primeiro, depois cor). */
export function rotuloDaVariante(options: { value?: string | null; option?: { title?: string | null } | null }[] | null | undefined): string {
  const lista = (options ?? []).filter((o) => o?.value)
  const peso = (t?: string | null) => (/tam/i.test(t ?? "") ? 0 : /cor/i.test(t ?? "") ? 1 : 2)
  return lista
    .sort((a, b) => peso(a.option?.title) - peso(b.option?.title))
    .map((o) => o.value)
    .join(" · ")
}
