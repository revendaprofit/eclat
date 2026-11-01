// Teto de unidades por tamanho na sacola (sócia, 2026-11-01). O backend é quem recusa de verdade
// (apps/backend/src/modules/limite-por-item); aqui é só para o seletor da sacola não oferecer mais que isso.
// Se mudar CARRINHO_MAX_POR_VARIANTE no backend, mudar aqui também.
export const LIMITE_POR_VARIANTE = 5
