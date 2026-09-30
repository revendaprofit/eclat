// Códigos que VÃO valer no carrinho depois da atualização de promoções, conforme a ação do Medusa
// (updateCartPromotionsWorkflow): "replace" troca tudo pelos novos (é o que a vitrine usa ao aplicar
// ou tirar cupom), "remove" tira os informados, "add" (padrão) soma aos que já estavam.
//
// Bug corrigido em 2026-09-30: o gancho conjunto-marcar somava SEMPRE os códigos antigos do carrinho
// aos novos. Ao tirar um cupom (replace com a lista sem ele), o cupom antigo ainda contava na regra
// "maior desconto por peça", as peças saíam como "nenhum" e o carrinho ficava sem o Benefício
// Conjunto (R$ 318 em vez de R$ 299) até a próxima atualização. Visto em produção com carrinho de teste.
export function codigosEfetivos(doCarrinho: (string | null | undefined)[], novos: string[] = [], action?: string): string[] {
  const antigos = doCarrinho.filter((c): c is string => !!c)
  const lista = (novos ?? []).filter((c): c is string => !!c)
  let efetivos: string[]
  if (action === "replace") efetivos = lista
  else if (action === "remove") efetivos = antigos.filter((c) => !lista.includes(c))
  else efetivos = [...antigos, ...lista]
  return Array.from(new Set(efetivos))
}
