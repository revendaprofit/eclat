import { HttpTypes } from "@medusajs/types"

// Dados do pagador que o antifraude do Mercado Pago pontua (achado de 2026-09-19: cobranças de
// cartão saíam sem pagador e eram recusadas em série com `cc_rejected_high_risk`). Tudo sai do
// CARRINHO, no servidor — o navegador só manda o que só ele tem (token do cartão e o id do
// aparelho). Campo que não existe é omitido: vazio conta contra na análise de risco.

export type EnderecoDoPagador = {
  rua: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
}

export type ItemDoPagamento = {
  titulo: string
  quantidade: number
  preco_unitario: number
  sku?: string
  descricao?: string
}

export type DadosDoPagador = {
  sobrenome?: string
  telefone?: string
  endereco?: EnderecoDoPagador
  itens?: ItemDoPagamento[]
}

const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined)

function montarEndereco(endereco: HttpTypes.StoreCartAddress | null | undefined): EnderecoDoPagador | undefined {
  const rua = texto(endereco?.address_1)
  if (!rua) return undefined
  const extra = (endereco?.metadata ?? {}) as Record<string, unknown>
  const campos: EnderecoDoPagador = {
    rua,
    numero: texto(extra.numero),
    complemento: texto(endereco?.address_2),
    bairro: texto(extra.bairro),
    cidade: texto(endereco?.city),
    estado: texto(endereco?.province),
    cep: texto(endereco?.postal_code),
  }
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)) as EnderecoDoPagador
}

/**
 * Itens no formato que a Orders API aceita. O Mercado Pago recusa a cobrança inteira quando a
 * soma dos itens não bate com o total (400 `order_items_total_amount_mismatch`, sondado em
 * produção em 2026-09-19) — por isso frete vira um item e desconto vira um item negativo.
 */
function montarItens(cart: HttpTypes.StoreCart): ItemDoPagamento[] | undefined {
  const lista = (cart?.items ?? [])
    .map((i) => {
      const titulo = texto(i.title)
      const quantidade = Number(i.quantity)
      const preco = Number(i.unit_price)
      if (!titulo || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(preco)) return undefined
      const item: ItemDoPagamento = { titulo, quantidade, preco_unitario: preco }
      const sku = texto(i.variant_sku)
      const descricao = texto(i.variant_title)
      return { ...item, ...(sku ? { sku } : {}), ...(descricao ? { descricao } : {}) }
    })
    .filter((i): i is ItemDoPagamento => i !== undefined)
  if (!lista.length || lista.length !== (cart?.items?.length ?? 0)) return undefined
  const frete = Number(cart?.shipping_total ?? 0)
  if (frete > 0) lista.push({ titulo: "Frete", quantidade: 1, preco_unitario: frete })
  const desconto = Number(cart?.discount_total ?? 0)
  if (desconto > 0) lista.push({ titulo: "Desconto", quantidade: 1, preco_unitario: -desconto })
  return lista
}

export function dadosDoPagador(cart: HttpTypes.StoreCart): DadosDoPagador {
  const entrega = cart?.shipping_address
  const cobranca = cart?.billing_address
  const dados: DadosDoPagador = {
    sobrenome: texto(entrega?.last_name) ?? texto(cobranca?.last_name),
    telefone: texto(entrega?.phone) ?? texto(cobranca?.phone),
    endereco: montarEndereco(entrega) ?? montarEndereco(cobranca),
    itens: montarItens(cart),
  }
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) as DadosDoPagador
}
