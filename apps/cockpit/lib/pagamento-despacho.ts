// Pagamento x despacho (Task 16) — a leitura, num lugar só, de "este pedido consta como pago?".
//
// Por que existe: o botão "Gerar etiqueta (SuperFrete)" gasta saldo REAL da carteira da
// transportadora, e até aqui nada no caminho do despacho olhava o pagamento (a liberação era só a
// conferência de peças). Não é bloqueio duro porque hoje o Pix é confirmado POR FORA (provider
// manual do Medusa): `payment_status` não reflete a realidade, e travar o despacho pararia a
// operação até o Mercado Pago entrar no ar. Então: aviso + confirmação explícita do operador, no
// mesmo espírito do motivo digitado quando a conferência de peças é pulada.
//
// A tela e a rota importam daqui para nunca divergirem sobre o que é "pago" nem sobre o texto do
// aviso.

/**
 * Status de `payment_status` que contam como pagamento confirmado.
 * Fonte única: `app/api/dashboard/route.ts` e `app/api/finance/dre/route.ts` IMPORTAM daqui para
 * somar receita (antes cada um tinha uma cópia privada chamada `PAGOS`, que podia divergir em silêncio). O teste trava a regressão para ninguém
 * afrouxar o conjunto sem perceber.
 */
export const PAGAMENTOS_CONFIRMADOS: ReadonlySet<string> = new Set([
  "captured",
  "authorized",
  "partially_captured",
])

/** `true` só para os status do conjunto. Ausente, vazio ou desconhecido → `false` (nunca "na dúvida, pago"). */
export function pagamentoConfirmado(payment_status: string | null | undefined): boolean {
  return !!payment_status && PAGAMENTOS_CONFIRMADOS.has(payment_status)
}

/** Texto do aviso, usado igual na tela e na resposta da rota. */
export const AVISO_PAGAMENTO =
  "Este pedido não consta como pago. Gerar a etiqueta vai gastar saldo da SuperFrete."
