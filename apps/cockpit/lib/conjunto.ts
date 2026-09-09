// Benefício Conjunto no Cockpit — regras de formulário, dinheiro e prévia. Puro (sem fetch, sem React).
// Espelha a matemática do backend (apps/backend/src/modules/beneficio-conjunto/utils/montar-conjuntos.ts).
export type TipoDesconto = "menor_peca_percentual" | "menor_peca_valor" | "total_percentual" | "total_valor"
export const TIPOS_DESCONTO: { value: TipoDesconto; label: string; unidade: "%" | "R$" }[] = [
  { value: "menor_peca_percentual", label: "% na peça de menor valor", unidade: "%" },
  { value: "menor_peca_valor", label: "R$ na peça de menor valor", unidade: "R$" },
  { value: "total_percentual", label: "% sobre o total do conjunto", unidade: "%" },
  { value: "total_valor", label: "R$ sobre o total do conjunto", unidade: "R$" },
]
export type Regra = { id: string; nome: string; escopo: "padrao" | "colecao" | "curado"; collection_id: string | null; tipo_desconto: TipoDesconto; valor: number; ativa: boolean; promotion_id: string | null }
export type Par = { id: string; categoria_a: string; categoria_b: string; ativo: boolean }
export type Curado = { id: string; nome: string; handle: string; capa_url: string | null; product_ids: string[]; ativo: boolean; ordem: number; regra: Regra }

export const unidadeDoTipo = (t: TipoDesconto): "%" | "R$" => (t.endsWith("percentual") ? "%" : "R$")

export function entradaParaValor(t: TipoDesconto, texto: string): number | null {
  const s = texto.replace(/R\$|\s|%/g, "")
  if (!s) return null
  if (unidadeDoTipo(t) === "%") {
    if (!/^\d+$/.test(s)) return null
    const n = Number(s)
    return n >= 1 && n <= 100 ? n : null
  }
  const norm = s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null
  const centavos = Math.round(Number(norm) * 100)
  return centavos >= 1 ? centavos : null
}
export function valorParaEntrada(t: TipoDesconto, valor: number): string {
  return unidadeDoTipo(t) === "%" ? String(valor) : (valor / 100).toFixed(2).replace(".", ",")
}
export function formatarReais(centavos: number): string {
  const [int, dec] = (centavos / 100).toFixed(2).split(".")
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`
}
export function validarRegra(d: { nome: string; tipo_desconto: TipoDesconto; valorTexto: string }): string | null {
  if (!d.nome.trim()) return "Informe o nome da regra."
  if (entradaParaValor(d.tipo_desconto, d.valorTexto) === null) return unidadeDoTipo(d.tipo_desconto) === "%" ? "Valor inválido: use um percentual inteiro de 1 a 100." : "Valor inválido: use reais, ex.: 45,90."
  return null
}
export function validarCurado(d: { nome: string; product_ids: string[]; tipo_desconto: TipoDesconto; valorTexto: string }): string | null {
  if (!d.nome.trim()) return "Informe o nome do conjunto."
  if (new Set(d.product_ids).size < 2) return "Escolha pelo menos 2 produtos diferentes."
  return validarRegra({ nome: d.nome, tipo_desconto: d.tipo_desconto, valorTexto: d.valorTexto })
}
export function previaBeneficio(t: TipoDesconto, valor: number, precos: number[]) {
  const n = precos.length
  const idxMin = precos.reduce((m, p, i) => (p < precos[m] ? i : m), 0)
  let descontos = precos.map(() => 0)
  if (t === "menor_peca_percentual") descontos[idxMin] = Math.min(precos[idxMin], Math.round((precos[idxMin] * valor) / 100))
  else if (t === "menor_peca_valor") descontos[idxMin] = Math.min(precos[idxMin], valor)
  else if (t === "total_percentual") descontos = precos.map((p) => Math.min(p, Math.round((p * valor) / 100)))
  else descontos = precos.map((p) => Math.min(p, Math.round(valor / n)))
  const total = precos.reduce((s, p) => s + p, 0)
  const economia = descontos.reduce((s, d) => s + d, 0)
  return { descontos, total, economia, final: total - economia }
}
export function alertaEstoque(p: { status: string; variants: { stock: number | null }[] }): "rascunho" | "sem_estoque" | "estoque_baixo" | null {
  if (p.status !== "published") return "rascunho"
  const soma = p.variants.reduce((s, v) => s + Math.max(0, v.stock ?? 0), 0)
  if (soma <= 0) return "sem_estoque"
  if (soma <= 3) return "estoque_baixo"
  return null
}
export const slugConjunto = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

// Sobe a árvore (parent_id) da primeira categoria até a raiz e devolve o handle dela — mesma
// regra do backend (raizPorCategoria em apps/backend/.../beneficio-conjunto/utils/categorias.ts).
export function raizDeCategoria(cats: { id: string; handle: string; parent_id: string | null }[], categoryIds: string[]): string | null {
  const primeiro = categoryIds[0]
  if (!primeiro) return null
  const porId = new Map(cats.map((c) => [c.id, c]))
  let atual = porId.get(primeiro)
  if (!atual) return null
  let guarda = 0
  while (atual.parent_id && porId.has(atual.parent_id) && guarda++ < 20) atual = porId.get(atual.parent_id)!
  return atual.handle
}

// Mesma lógica de `regraEfetiva` do backend: exceção de coleção (ativa ou não) manda; senão a padrão.
function temBeneficioAtivo(regras: Regra[], collectionId: string): boolean {
  const excecao = regras.find((r) => r.escopo === "colecao" && r.collection_id === collectionId)
  if (excecao) return excecao.ativa
  const padrao = regras.find((r) => r.escopo === "padrao")
  return !!padrao?.ativa
}

// Motivo (pt-BR) pelo qual o produto não forma nenhum conjunto — null quando tem parceiras
// (o backend não devolve motivo; esta função espelha exatamente a mesma cadeia de regras dele:
// regraEfetiva em montar-conjuntos.ts + raizPorCategoria em categorias.ts).
export function motivoSemConjunto(input: {
  collection_id: string | null
  categoria_raiz: string | null
  regras: Regra[]
  pares: Par[]
  temParceiras: boolean
}): string | null {
  if (input.temParceiras) return null
  if (!input.collection_id) return "Produto sem coleção: não forma conjunto de coleção"
  if (!temBeneficioAtivo(input.regras, input.collection_id)) return "Coleção sem benefício ativo"
  const participa =
    !!input.categoria_raiz && input.pares.some((p) => p.ativo && (p.categoria_a === input.categoria_raiz || p.categoria_b === input.categoria_raiz))
  if (!participa) return "Categoria não participa dos pares permitidos"
  return "Nenhuma peça parceira publicada nesta coleção"
}
