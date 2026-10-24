// Marcador de teste interno: quem testa o site (equipe, sessões do Claude) abre qualquer página com
// `?eclat_teste=1` uma vez; o navegador guarda o cookie `eclat_teste=1` e, a partir daí, o GTM não
// carrega (sem pixel da Meta, GA4 e Google Ads) e a API de Conversões não envia nada desse navegador.
// `?eclat_teste=0` desliga. O carrinho leva `metadata.eclat_teste` e o backend também não manda o
// Purchase desse pedido (apps/backend/src/lib/meta-capi.ts, `ehPedidoDeTeste`).

export const COOKIE_TESTE = "eclat_teste"
export const PARAM_TESTE = "eclat_teste"
// Produto oculto da compra de teste (scripts/produto-teste.mjs): pedido com ele nunca é medido.
export const HANDLE_PRODUTO_TESTE = "teste-interno"

// Script inline (roda no parse do <body>, antes do GTM): grava/limpa o cookie pelo parâmetro da URL e
// deixa `window.__eclatTeste` para o snippet do GTM decidir se carrega.
export const SCRIPT_MARCADOR_TESTE =
  `(function(){try{var q=new URLSearchParams(location.search).get('${PARAM_TESTE}');` +
  `if(q==='1')document.cookie='${COOKIE_TESTE}=1;path=/;max-age=31536000;samesite=lax';` +
  `else if(q==='0')document.cookie='${COOKIE_TESTE}=;path=/;max-age=0';` +
  `window.__eclatTeste=/(?:^|; )${COOKIE_TESTE}=1(?:;|$)/.test(document.cookie);}catch(e){}})();`

type PedidoLike = {
  metadata?: Record<string, unknown> | null
  items?: Array<{ product_handle?: string | null; product?: { handle?: string | null } | null }> | null
} | null | undefined

/** Pedido (ou carrinho) de teste: marcado pelo navegador de teste ou com o produto oculto. */
export function ehPedidoDeTeste(pedido: PedidoLike): boolean {
  if (!pedido) return false
  const m = pedido.metadata?.eclat_teste
  if (m === true || m === "1" || m === 1) return true
  return (pedido.items ?? []).some(
    (it) => (it?.product_handle ?? it?.product?.handle) === HANDLE_PRODUTO_TESTE
  )
}
