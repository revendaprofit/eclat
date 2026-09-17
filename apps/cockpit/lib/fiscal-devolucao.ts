// Monta a lista de itens a devolver para POST /api/fiscal/emitir-devolucao (spec §3, botão manual
// "Emitir NFD" no detalhe do pedido). O backend decide CFOP/CSOSN e trava por documento verificado
// (statusBloqueiaDevolucao em lib/fiscal.ts) — aqui só validamos a forma do que a tela do Cockpit
// vai enviar, para não mandar um payload malformado ou uma devolução vazia.

export type ItemPedidoParaDevolucao = { item_id: string; quantidade_pedido: number }
export type ItemDevolvido = { line_item_id: string; quantidade: number }

export type MontagemDevolucao = { ok: true; itens: ItemDevolvido[] } | { ok: false; erro: string }

// `quantidades` vem do formulário: chave = item_id do pedido, valor = quantidade informada pelo
// operador (0 ou ausente = não devolver essa linha). Chaves que não correspondem a nenhum item do
// pedido são ignoradas — a tela só gera chaves a partir da própria lista de itens.
export function montarItensDevolvidos(
  itens: ItemPedidoParaDevolucao[],
  quantidades: Record<string, number>
): MontagemDevolucao {
  const devolvidos: ItemDevolvido[] = []

  for (const item of itens) {
    const bruta = quantidades[item.item_id]
    if (bruta === undefined || bruta === null) continue

    if (!Number.isFinite(bruta)) {
      return { ok: false, erro: "Quantidade inválida — use um número inteiro maior ou igual a zero." }
    }
    // Sinal validado ANTES de truncar: Math.trunc(-0.5) é -0, e -0 === 0 é verdadeiro em JS — se o
    // corte de sinal viesse depois do trunc, "-0.5" silenciosamente virava "não devolver" em vez
    // de cair no erro de quantidade negativa (achado da revisão). -0 puro (sem casa decimal) segue
    // tratado como zero, que é o valor que ele de fato representa.
    if (bruta < 0) {
      return { ok: false, erro: "Quantidade inválida — use um número inteiro maior ou igual a zero." }
    }
    const quantidade = Math.trunc(bruta)
    if (quantidade === 0) continue
    if (quantidade > item.quantidade_pedido) {
      return {
        ok: false,
        erro: `Quantidade a devolver (${quantidade}) maior que a quantidade do pedido (${item.quantidade_pedido}) em um dos itens.`,
      }
    }
    devolvidos.push({ line_item_id: item.item_id, quantidade })
  }

  if (devolvidos.length === 0) {
    return { ok: false, erro: "Informe a quantidade de ao menos um item para devolver." }
  }
  return { ok: true, itens: devolvidos }
}
