// Cotação de frete na SACOLA (diagnóstico de 2026-09-25). Parte pura, testável.
//
// Antes o frete só aparecia depois de a cliente preencher endereço completo, CPF e e-mail — custo
// extra que surge no fim é o motivo mais citado de abandono. A sacola agora cota pelo CEP, com as
// mesmas opções e preços do checkout (o carrinho recebe só o CEP; o backend calcula).

import { servicoDaOpcao, textoPrazo, type Prazos } from "./frete"

export type OpcaoCotada = { id: string; nome: string; centavos: number; prazo: string | null }

type OpcaoDoMedusa = {
  id: string
  name?: string | null
  price_type?: string | null
  amount?: number | null
  type?: { code?: string | null } | null
}

/**
 * Junta opções do Medusa, preços calculados (reais decimais, por id) e prazos por serviço.
 * Opção calculada sem preço = indisponível para o CEP (o backend recusou) e sai da lista.
 * Ordem: mais barata primeiro.
 */
export function montarCotacao(opcoes: OpcaoDoMedusa[], precosCalculados: Record<string, number>, prazos: Prazos): OpcaoCotada[] {
  const lista: OpcaoCotada[] = []
  for (const o of opcoes) {
    const reais = o.price_type === "calculated" ? precosCalculados[o.id] : o.amount
    if (typeof reais !== "number" || !Number.isFinite(reais)) continue
    const servico = servicoDaOpcao(o)
    lista.push({
      id: o.id,
      nome: o.name ?? "Entrega",
      centavos: Math.round(reais * 100),
      prazo: servico ? textoPrazo(prazos[servico]) : null,
    })
  }
  return lista.sort((a, b) => a.centavos - b.centavos)
}
