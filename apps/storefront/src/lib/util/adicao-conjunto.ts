// Máquina de estados PURA da adição de um conjunto à sacola (ruling V7). Único mecanismo de
// "retry resumível" da vitrine: a página do conjunto (`conjunto-builder.tsx`) e o bloco
// "Complete o conjunto" da PDP (`complete-set/parceira.tsx`) chamam só as funções daqui — antes
// cada um tinha a sua própria implementação (efeito de reset no builder, chave inteira
// `ancora|parceira` na parceira), nenhuma testada.
//
// Progresso POR PEÇA: `progresso[indice]` guarda a variante que JÁ entrou na sacola para aquele
// slot nesta página. Um retry com a mesma variante pula a peça que já entrou; trocar a variante de
// UMA peça faz só essa peça ser adicionada de novo (a outra continua pulada) — a peça antiga
// permanece na sacola e a cliente ajusta manualmente (comportamento já documentado).
//
// Sem I/O: quem adiciona de fato é o callback `adicionar` (o componente fecha sobre `addToCart`).

export type SlotAdicao = { indice: number; variantId: string; titulo: string; metadata: Record<string, string> }

/** índice do slot → variantId que JÁ entrou na sacola nesta página (progresso por peça). */
export type ProgressoAdicao = Record<number, string>

/** slots ainda não adicionados COM A VARIANTE ATUAL (slot cujo progresso[indice] === variantId é pulado). */
export function pendentes(slots: SlotAdicao[], progresso: ProgressoAdicao): SlotAdicao[] {
  return slots.filter((s) => progresso[s.indice] !== s.variantId)
}

/** adiciona os pendentes EM SEQUÊNCIA (await um a um, na ordem de `indice`), parando no 1º erro. */
export async function adicionarEmSequencia(
  slots: SlotAdicao[],
  progresso: ProgressoAdicao,
  adicionar: (slot: SlotAdicao) => Promise<void>
): Promise<{ progresso: ProgressoAdicao; adicionadosAgora: SlotAdicao[]; falha: SlotAdicao | null }> {
  const fila = pendentes(slots, progresso).slice().sort((a, b) => a.indice - b.indice)
  const acumulado: ProgressoAdicao = { ...progresso }
  const adicionadosAgora: SlotAdicao[] = []
  for (const slot of fila) {
    try {
      await adicionar(slot)
    } catch {
      return { progresso: acumulado, adicionadosAgora, falha: slot }
    }
    acumulado[slot.indice] = slot.variantId
    adicionadosAgora.push(slot)
  }
  return { progresso: acumulado, adicionadosAgora, falha: null }
}

/** texto pt-BR do erro: nomeia quem já está na sacola (se houver) e quem falhou.
 *  ex.: "Top Aura já está na sacola. Não foi possível adicionar Legging Vértice. Tente de novo."
 *  sem peça na sacola: "Não foi possível adicionar Legging Vértice. Tente de novo." */
export function mensagemFalha(falha: SlotAdicao, slots: SlotAdicao[], progresso: ProgressoAdicao): string {
  const naSacola = slots
    .slice()
    .sort((a, b) => a.indice - b.indice)
    .filter((s) => s.indice !== falha.indice && progresso[s.indice] === s.variantId)
    .map((s) => s.titulo)
  const prefixo = naSacola.length ? `${naSacola.join(", ")} já ${naSacola.length > 1 ? "estão" : "está"} na sacola. ` : ""
  return `${prefixo}Não foi possível adicionar ${falha.titulo}. Tente de novo.`
}
