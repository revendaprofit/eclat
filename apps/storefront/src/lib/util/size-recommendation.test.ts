import { describe, expect, it } from "vitest"
import {
  columnToKey,
  estimateMeasurements,
  measurableColumns,
  parseRange,
  recommendSize,
} from "./size-recommendation"

// Tabela padrão de macaquinhos (Cockpit, PADRAO.macaquinhos)
const MACAQUINHO = {
  columns: ["Busto", "Cintura", "Quadril"],
  rows: [
    ["P", "82–88 cm", "62–68 cm", "88–94 cm"],
    ["M", "88–94 cm", "68–74 cm", "94–100 cm"],
    ["G", "94–100 cm", "74–80 cm", "100–106 cm"],
    ["GG", "100–108 cm", "80–88 cm", "106–114 cm"],
  ],
}
// Tabela de camiseta masculina: só "Tórax" é comparável; "Comprimento" é ignorado
const CAMISETA = {
  columns: ["Tórax", "Comprimento"],
  rows: [
    ["P", "90-96", "68"],
    ["M", "96-102", "70"],
    ["G", "102-108", "72"],
  ],
}

describe("parseRange", () => {
  it("aceita travessão, hífen, 'a' e valor único", () => {
    expect(parseRange("82–88 cm")).toEqual({ min: 82, max: 88 })
    expect(parseRange("82-88")).toEqual({ min: 82, max: 88 })
    expect(parseRange("82 a 88 cm")).toEqual({ min: 82, max: 88 })
    expect(parseRange("88")).toEqual({ min: 88, max: 88 })
    expect(parseRange("88,5 – 90")).toEqual({ min: 88.5, max: 90 })
  })
  it("sem número devolve null", () => {
    expect(parseRange("")).toBeNull()
    expect(parseRange("—")).toBeNull()
  })
})

describe("columnToKey", () => {
  it("mapeia cabeçalhos em pt-BR (com e sem acento)", () => {
    expect(columnToKey("Busto")).toBe("busto")
    expect(columnToKey("Peito")).toBe("busto")
    expect(columnToKey("Tórax")).toBe("busto")
    expect(columnToKey("torax")).toBe("busto")
    expect(columnToKey("Cintura")).toBe("cintura")
    expect(columnToKey("Quadril")).toBe("quadril")
    expect(columnToKey("Comprimento")).toBeNull()
  })
  it("measurableColumns ignora colunas não comparáveis", () => {
    expect(measurableColumns(CAMISETA)).toEqual([{ index: 0, key: "busto", label: "Tórax" }])
  })
})

describe("recommendSize", () => {
  it("todas as medidas dentro da faixa → ideal, sem alternativa longe", () => {
    const r = recommendSize(MACAQUINHO, { busto: 90, cintura: 70, quadril: 96 })
    expect(r?.recomendado).toBe("M")
    expect(r?.caimento).toBe("ideal")
    expect(r?.detalhes).toHaveLength(3)
  })
  it("medida acima do máximo do tamanho → 'justo'", () => {
    // cintura 75 passa 1 cm do M (68–74); G ficaria 3 cm folgado no busto (94–100) e 2 no quadril
    const r = recommendSize(MACAQUINHO, { busto: 91, cintura: 75, quadril: 98 })
    expect(r?.recomendado).toBe("M")
    expect(r?.caimento).toBe("justo")
    expect(r?.alternativa).toBe("G")
  })
  it("medida abaixo do mínimo → 'folgado'", () => {
    const r = recommendSize(MACAQUINHO, { busto: 80, cintura: 60, quadril: 86 })
    expect(r?.recomendado).toBe("P")
    expect(r?.caimento).toBe("folgado")
    expect(r?.alternativa).toBeNull()
  })
  it("empate exato entre dois tamanhos → o maior (Decisão 3)", () => {
    // busto 94 está no limite de M (88–94) e de G (94–100): ambos ideais, distância 0
    const r = recommendSize(MACAQUINHO, { busto: 94 })
    expect(r?.recomendado).toBe("G")
    expect(r?.alternativa).toBe("M")
  })
  it("usa só as medidas informadas e só as colunas comparáveis", () => {
    const r = recommendSize(CAMISETA, { busto: 100, cintura: 80 })
    expect(r?.recomendado).toBe("M")
    expect(r?.detalhes.map((d) => d.medida)).toEqual(["busto"])
  })
  it("sem tabela, sem medida útil ou sem coluna comparável → null", () => {
    expect(recommendSize(null, { busto: 90 })).toBeNull()
    expect(recommendSize(MACAQUINHO, {})).toBeNull()
    expect(recommendSize({ columns: ["Comprimento"], rows: [["P", "68"]] }, { busto: 90 })).toBeNull()
  })
  it("alternativa só quando a diferença é ≤ 4 cm", () => {
    // busto 96: G ideal (94–100 → 0); M 2 acima (88–94); P 8 acima → G recomendado, M alternativa (diferença 2)
    expect(recommendSize(MACAQUINHO, { busto: 96 })?.recomendado).toBe("G")
    expect(recommendSize(MACAQUINHO, { busto: 96 })?.alternativa).toBe("M")
    // P: 20 acima; M: 14; G: 8; GG: 0 → GG, diferença para G = 8 > 4 → sem alternativa
    expect(recommendSize(MACAQUINHO, { busto: 108 })?.alternativa).toBeNull()
  })
})

describe("estimateMeasurements (Decisão 2 — heurística de pré-preenchimento)", () => {
  it("1,65 m / 60 kg cai em M na tabela padrão", () => {
    const est = estimateMeasurements(165, 60)
    expect(est).toEqual({ busto: 94, cintura: 73, quadril: 98 })
    expect(recommendSize(MACAQUINHO, est!)?.recomendado).toBe("M")
  })
  it("valores impossíveis → null", () => {
    expect(estimateMeasurements(0, 60)).toBeNull()
    expect(estimateMeasurements(165, 0)).toBeNull()
    expect(estimateMeasurements(NaN, 60)).toBeNull()
  })
})
