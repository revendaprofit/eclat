// Tipos do Benefício Conjunto (spec §4–§5). Dinheiro em centavos inteiros.
export const TIPOS_DESCONTO = ["menor_peca_percentual", "menor_peca_valor", "total_percentual", "total_valor"] as const
export type TipoDesconto = (typeof TIPOS_DESCONTO)[number]
export const ESCOPOS = ["padrao", "colecao", "curado"] as const
export type Escopo = (typeof ESCOPOS)[number]

export type Regra = { id: string; nome: string; escopo: Escopo; collection_id: string | null; tipo_desconto: TipoDesconto; valor: number; ativa: boolean; promotion_id: string | null }
export type Par = { id: string; categoria_a: string; categoria_b: string; ativo: boolean }
export type Curado = { id: string; nome: string; handle: string; capa_url: string | null; product_ids: string[]; regra_id: string; ativo: boolean; ordem: number }

// Entrada do cálculo: uma LINHA do carrinho (quantidade pode ser > 1)
export type Linha = { item_id: string; product_id: string; collection_id: string | null; categoria_raiz: string | null; preco_unitario: number; quantidade: number }
export type UnidadeFormada = { item_id: string; product_id: string; preco_unitario: number; desconto_unitario: number }
export type ConjuntoFormado = { id: string; tipo: "curado" | "colecao"; regra_id: string; unidades: UnidadeFormada[] }
export type Oportunidade = { collection_id: string; categoria_faltante: string; a_partir_do_item_id: string }
export type ResultadoMontagem = { conjuntos: ConjuntoFormado[]; oportunidades: Oportunidade[] }
