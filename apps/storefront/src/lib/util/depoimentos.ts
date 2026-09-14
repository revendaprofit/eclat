// Depoimentos da PDP ocultos ate a loja ter vendas reais (pedido do dono, 13/09/2026): voltam
// sozinhos a partir da data abaixo, sem deploy. Para trocar a data, basta editar a constante.
export const DEPOIMENTOS_VOLTAM_EM = new Date("2026-10-13T00:00:00-03:00")

export function depoimentosVisiveis(agora: Date = new Date(), desde: Date = DEPOIMENTOS_VOLTAM_EM): boolean {
  return agora.getTime() >= desde.getTime()
}
