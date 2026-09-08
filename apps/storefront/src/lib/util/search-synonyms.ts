// Sinônimos de busca (spec §9): termo popular → handle da categoria. Puro, sem I/O.
// Só entram aqui palavras que NÃO são nome de categoria (o match por nome já cobre "top",
// "legging", "short"…). "bermuda" fica de fora: Bermudas é categoria real (Masculino) — ruling 1.

export const SEARCH_SYNONYMS: Record<string, string> = {
  calca: "leggings",
  calcas: "leggings",
  blusa: "tops",
  blusas: "tops",
  cropped: "tops",
  croppeds: "tops",
  macacao: "macaquinhos",
  macacoes: "macaquinhos",
  shortinho: "shorts",
  shortinhos: "shorts",
}

// Mesma normalização de normalizeColorName (acento/caixa/espaços) — aqui para texto livre.
export function normalizeTerm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// Devolve o handle só quando a busca INTEIRA é um sinônimo ("calça", "Calças"); "calça preta" → null.
export function synonymCategoryHandle(q: string): string | null {
  const t = normalizeTerm(q)
  if (!t) return null
  return SEARCH_SYNONYMS[t] ?? null
}
