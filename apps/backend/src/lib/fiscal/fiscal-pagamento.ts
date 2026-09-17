// Provedor de pagamento do pedido -> forma de pagamento da NF-e (tPag), spec §7.1.1.
//
// Tabela tPag relevante: 03 cartão de crédito · 17 Pix dinâmico · 90 sem pagamento · 99 outros.
// Hoje o único provedor é o manual, então tudo cai em 99. Quando o gateway real entrar, os casos
// 17 e 03 entram AQUI — e só aqui. Não adicionar antes de conhecer o formato real do provedor.
//
// 99 exige descrição: sem ela a SEFAZ devolve a rejeição 441.

export type PagamentoNF = { forma: string; descricao: string | null }

const OUTROS: PagamentoNF = { forma: "99", descricao: "Pagamento online" }

export function formaPagamentoDoPedido(_providerIds: string[]): PagamentoNF {
  return { ...OUTROS }
}
