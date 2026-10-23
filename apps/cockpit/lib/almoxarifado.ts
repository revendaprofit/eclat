// Almoxarifado (sócia, 2026-10-23): estoque de insumos (etiquetas termocolantes, tiras 3D, tags, lacres, DTF…) com
// as quantidades de sobra, para saber se há insumo para a próxima produção. Guardado em site_content
// "cockpit.almoxarifado" (sem migration). A necessidade de uma produção vem das fichas de custo (costing_item):
// cada item do almoxarifado tem uma `chave` que casa com o nome do insumo na ficha.

export type ItemAlmox = {
  id: string
  grupo: string // "Termocolante off white", "Tiras 3D", "DTF do cós"…
  nome: string // "Monograma", "ÉCLAT pequeno", "P fundo branco"…
  unidade: string // un, kg, m
  quantidade: number // sobra contada
  custo_unitario_centavos: number | null
  chave: string | null // texto que aparece no nome do insumo nas fichas (ex.: "monograma"); null = não entra no cálculo
  observacao: string | null
  atualizado_em: string | null
}

export type Almoxarifado = { reserva_pct: number; itens: ItemAlmox[]; nota?: string | null }

export function normalizarAlmoxarifado(raw: unknown): Almoxarifado {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const itens = Array.isArray(r.itens) ? r.itens : []
  return {
    reserva_pct: typeof r.reserva_pct === "number" ? r.reserva_pct : 5,
    nota: typeof r.nota === "string" ? r.nota : null,
    itens: itens
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i, k) => ({
        id: typeof i.id === "string" && i.id ? i.id : `item-${k}`,
        grupo: String(i.grupo ?? "").trim(),
        nome: String(i.nome ?? "").trim(),
        unidade: String(i.unidade ?? "un").trim() || "un",
        quantidade: Math.max(0, Number(i.quantidade) || 0),
        custo_unitario_centavos: Number.isFinite(Number(i.custo_unitario_centavos)) && i.custo_unitario_centavos != null ? Math.round(Number(i.custo_unitario_centavos)) : null,
        chave: typeof i.chave === "string" && i.chave.trim() ? i.chave.trim() : null,
        observacao: typeof i.observacao === "string" && i.observacao.trim() ? i.observacao.trim() : null,
        atualizado_em: typeof i.atualizado_em === "string" ? i.atualizado_em : null,
      }))
      .filter((i) => i.grupo || i.nome),
  }
}

/** Estoque útil = quantidade − reserva (perda, uso próprio, reposição). */
export function estoqueUtil(i: ItemAlmox, reservaPct: number): number {
  return Math.floor(i.quantidade * (1 - reservaPct / 100))
}

export function valorEstoque(a: Almoxarifado): number {
  return a.itens.reduce((s, i) => s + (i.custo_unitario_centavos ?? 0) * estoqueUtil(i, a.reserva_pct), 0)
}

export type FichaParaNecessidade = { id: string; name: string; itens: { name: string; consumption: number }[] }

/**
 * Necessidade de insumos para uma produção planejada (quantidade por ficha) contra o estoque útil, agrupando o
 * estoque por `chave` (as cores de termocolante somam no mesmo tipo). Devolve uma linha por chave.
 */
export function necessidade(
  a: Almoxarifado,
  fichas: FichaParaNecessidade[],
  plano: Record<string, number>
): { chave: string; rotulo: string; precisa: number; estoque: number; falta: number }[] {
  const chaves = Array.from(new Set(a.itens.map((i) => i.chave).filter((c): c is string => !!c)))
  return chaves
    .map((chave) => {
      const k = chave.toLowerCase()
      let precisa = 0
      for (const f of fichas) {
        const qtd = Number(plano[f.id] ?? 0)
        if (!qtd) continue
        for (const it of f.itens) if (it.name.toLowerCase().includes(k)) precisa += it.consumption * qtd
      }
      const estoque = a.itens.filter((i) => i.chave === chave).reduce((s, i) => s + estoqueUtil(i, a.reserva_pct), 0)
      const rotulo = a.itens.find((i) => i.chave === chave)?.nome ?? chave
      return { chave, rotulo, precisa: Math.ceil(precisa), estoque, falta: Math.max(0, Math.ceil(precisa) - estoque) }
    })
    .filter((l) => l.precisa > 0 || l.estoque > 0)
    .sort((x, y) => y.falta - x.falta)
}
