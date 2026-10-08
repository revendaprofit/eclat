// Cupom de EMBAIXADOR (decisão do dono, 2026-10-08): convidados que compram por um ano com 20%, sem comissão.
// Diferente do cupom de parceria (creator, 10% + comissão), que segue a regra geral.
// O que muda para o embaixador:
//   - o cupom SOMA com o Benefício Conjunto: incide sobre o preço já com o conjunto (R$ 299 → R$ 239,20),
//     em vez de disputar "o maior desconto por peça";
//   - carrinho com cupom de embaixador NÃO ganha presente (meia/óculos): o desconto já é o benefício.
// Como se reconhece: a campanha do cupom tem `campaign_identifier` começando com `embaixador-`
// (criada por `scripts/cupom.mjs --embaixador`). O código em si não diz nada — NOME20 também existe em parceria.
// Onde é tratado (procure por `ehPromocaoEmbaixador` / `codigosDeEmbaixador`):
//   - beneficio-conjunto: não disputa com o conjunto e não ganha a regra de exclusão
//   - lib/brinde: carrinho com o cupom fica sem presente
export const PREFIXO_CAMPANHA_EMBAIXADOR = "embaixador-"

export function ehCampanhaEmbaixador(identificador: unknown): boolean {
  return typeof identificador === "string" && identificador.trim().toLowerCase().startsWith(PREFIXO_CAMPANHA_EMBAIXADOR)
}

/** Promoção carregada com a relação `campaign`. Sem campanha = não é de embaixador. */
export function ehPromocaoEmbaixador(p: { campaign?: { campaign_identifier?: string | null } | null } | null | undefined): boolean {
  return ehCampanhaEmbaixador(p?.campaign?.campaign_identifier)
}
