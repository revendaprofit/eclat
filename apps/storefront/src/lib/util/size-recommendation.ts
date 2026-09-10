import type { MeasureTable } from "./measurements"
import { SIZE_ORDER } from "./catalog-facets"

// Recomendação de tamanho a partir de medidas do corpo (cm) × tabela de medidas da
// categoria (site_content.medidas, editada no Cockpit). Função pura, sem I/O.
//
// Regras (plano 2026-09-07, Decisões 2 e 3):
// - distância por medida = quanto o valor sai da faixa do tamanho (0 se está dentro);
// - recomendado = menor soma de distâncias; empate → o MAIOR tamanho (FAQ da marca);
// - alternativa = 2º melhor, só se a diferença de distâncias for ≤ 4 cm;
// - caimento do recomendado: "justo" se alguma medida passa do máximo, "folgado" se
//   alguma fica abaixo do mínimo, senão "ideal";
// - fora da tabela (follow-up): quando o corpo não cabe em NENHUMA linha — alguma medida a
//   mais de 5 cm da faixa da linha vencedora, ou soma de distâncias > 10 cm. Nesse caso
//   `recomendado` continua sendo a linha menos ruim (a UI mostra "a mais próxima seria X"),
//   mas sem alternativa e sem CTA de seleção.

export type MedidaKey = "busto" | "cintura" | "quadril"
export type Medidas = Partial<Record<MedidaKey, number>>
export type Range = { min: number; max: number }
export type Caimento = "ideal" | "justo" | "folgado"
export type Detalhe = { medida: MedidaKey; valor: number; faixa: Range; fit: Caimento }
export type Recomendacao = {
  recomendado: string
  alternativa: string | null
  caimento: Caimento
  detalhes: Detalhe[]
  // true = as medidas não cabem na tabela desta categoria (ver constantes abaixo)
  foraDaTabela?: boolean
}

const ALTERNATIVA_MAX_DIFF_CM = 4
// Fora da tabela: qualquer medida a mais de 5 cm da faixa da linha vencedora, OU soma de
// distâncias acima de 10 cm. Números do ruling do follow-up (2026-09-10).
const FORA_MEDIDA_MAX_CM = 5
const FORA_SOMA_MAX_CM = 10

// Mesma ordem canônica de tamanhos da vitrine (facetas, chip "Seu tamanho", prefs):
// uma única fonte evita divergência quando PP/XG entrarem nas tabelas de medidas.
export const ORDEM_TAMANHOS = SIZE_ORDER

// Rótulo de tamanho comparável: " m " → "M". A tabela de medidas é digitada no Cockpit e o
// valor da opção vem do Medusa; os dois lados passam por aqui antes de comparar.
export function normalizarTamanho(s: string): string {
  return s.trim().toUpperCase()
}

// Devolve o índice do tamanho na ordem padrão (PP → P → M → G → GG → XG); -1 se desconhecido.
// Usado para desempate: quando dois tamanhos têm o mesmo score, prefere-se o maior.
export function indiceTamanho(tamanho: string): number {
  return ORDEM_TAMANHOS.indexOf(normalizarTamanho(tamanho))
}

// "82–88 cm" | "82-88" | "82 a 88" | "88" | "88,5 – 90" → {min,max}; sem número → null
export function parseRange(cell: string): Range | null {
  const nums = (cell.match(/\d+(?:[.,]\d+)?/g) || [])
    .slice(0, 2)
    .map((n) => Number(n.replace(",", ".")))
  if (nums.length === 0) return null
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

export function columnToKey(header: string): MedidaKey | null {
  const h = header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos combinantes (Tórax → torax)
  if (/busto|peito|torax/.test(h)) return "busto"
  if (/cintura/.test(h)) return "cintura"
  if (/quadril/.test(h)) return "quadril"
  return null
}

export function measurableColumns(
  table: MeasureTable
): { index: number; key: MedidaKey; label: string }[] {
  const out: { index: number; key: MedidaKey; label: string }[] = []
  table.columns.forEach((label, index) => {
    const key = columnToKey(label)
    if (key) out.push({ index, key, label })
  })
  return out
}

// Quanto a medida sai da faixa (0 quando está dentro).
function distancia(d: Detalhe): number {
  return d.fit === "justo" ? d.valor - d.faixa.max : d.fit === "folgado" ? d.faixa.min - d.valor : 0
}

export function recommendSize(
  table: MeasureTable | null | undefined,
  medidas: Medidas
): Recomendacao | null {
  if (!table) return null
  const cols = measurableColumns(table).filter((c) => Number.isFinite(medidas[c.key]))
  if (cols.length === 0) return null

  const scored = table.rows
    .map((row) => {
      const detalhes: Detalhe[] = []
      let score = 0
      for (const c of cols) {
        const faixa = parseRange(row[c.index + 1] ?? "")
        if (!faixa) continue
        const valor = medidas[c.key] as number
        const fit: Caimento =
          valor > faixa.max ? "justo" : valor < faixa.min ? "folgado" : "ideal"
        score += fit === "justo" ? valor - faixa.max : fit === "folgado" ? faixa.min - valor : 0
        detalhes.push({ medida: c.key, valor, faixa, fit })
      }
      return { tamanho: row[0], score, detalhes }
    })
    .filter((s) => s.tamanho && s.detalhes.length > 0)
  if (scored.length === 0) return null

  // Desempate independente da ordem das linhas: na igualdade de score, prefere-se o maior tamanho
  const melhor = (a: typeof scored[number], b: typeof scored[number]) => {
    if (a.score !== b.score) return a.score < b.score ? a : b
    // Em caso de empate, prefere o tamanho maior (índice mais alto em ORDEM_TAMANHOS)
    return indiceTamanho(b.tamanho) > indiceTamanho(a.tamanho) ? b : a
  }
  const best = scored.reduce(melhor)
  const resto = scored.filter((s) => s !== best)
  // Mesmo desempate na alternativa: `.sort` estável dependia da ordem das linhas da tabela.
  const second = resto.length > 0 ? resto.reduce(melhor) : undefined

  const caimento: Caimento = best.detalhes.some((d) => d.fit === "justo")
    ? "justo"
    : best.detalhes.some((d) => d.fit === "folgado")
    ? "folgado"
    : "ideal"

  const foraDaTabela =
    best.detalhes.some((d) => distancia(d) > FORA_MEDIDA_MAX_CM) || best.score > FORA_SOMA_MAX_CM

  const alternativa =
    !foraDaTabela && second && second.score - best.score <= ALTERNATIVA_MAX_DIFF_CM
      ? second.tamanho
      : null

  return { recomendado: best.tamanho, alternativa, caimento, detalhes: best.detalhes, foraDaTabela }
}

// PRÉ-PREENCHIMENTO por altura/peso — heurística, NÃO regra final: a cliente sempre vê
// e ajusta os valores antes de calcular. Decisão 2 do plano; recalibrar com dados reais.
//   IMC = peso / altura²  ·  cintura ≈ 2,1·IMC + 27  ·  quadril ≈ cintura + 25  ·  busto ≈ quadril − 4
export function estimateMeasurements(
  altura_cm: number,
  peso_kg: number
): Required<Medidas> | null {
  if (!(altura_cm > 100 && altura_cm < 230) || !(peso_kg > 30 && peso_kg < 250)) return null
  const imc = peso_kg / (altura_cm / 100) ** 2
  const cintura = Math.round(2.1 * imc + 27)
  const quadril = cintura + 25
  const busto = quadril - 4
  return { busto, cintura, quadril }
}
