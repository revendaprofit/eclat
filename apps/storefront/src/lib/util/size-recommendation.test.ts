import { describe, expect, it } from "vitest"
import { SIZE_ORDER } from "./catalog-facets"
import {
  columnToKey,
  estimateMeasurements,
  indiceTamanho,
  measurableColumns,
  normalizarTamanho,
  ORDEM_TAMANHOS,
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
  it("empate com tabela em ordem diferente → o maior tamanho vence", () => {
    // Tabela com linhas fora de ordem (GG, G, M, P) para verificar que o desempate não depende da ordem
    const TABLE_DESORDENADA = {
      columns: ["Busto", "Cintura", "Quadril"],
      rows: [
        ["GG", "100–108 cm", "80–88 cm", "106–114 cm"],
        ["G", "94–100 cm", "74–80 cm", "100–106 cm"],
        ["M", "88–94 cm", "68–74 cm", "94–100 cm"],
        ["P", "82–88 cm", "62–68 cm", "88–94 cm"],
      ],
    }
    // busto 94 está no limite de M (88–94) e de G (94–100): ambos ideais, distância 0
    // mesmo com tabela desordenada, G (maior) deve ser recomendado
    const r = recommendSize(TABLE_DESORDENADA, { busto: 94 })
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

describe("normalizarTamanho / ORDEM_TAMANHOS", () => {
  it("normaliza espaços e caixa do rótulo", () => {
    expect(normalizarTamanho(" m ")).toBe("M")
    expect(normalizarTamanho("gg")).toBe("GG")
  })
  it("indiceTamanho usa a ordem canônica da vitrine e aceita rótulo cru", () => {
    expect(ORDEM_TAMANHOS).toEqual(SIZE_ORDER)
    expect(indiceTamanho(" g ")).toBe(ORDEM_TAMANHOS.indexOf("G"))
    expect(indiceTamanho("XPTO")).toBe(-1)
  })
})

describe("recommendSize — fora da tabela", () => {
  it("medidas 20 cm acima de toda a tabela → foraDaTabela", () => {
    const r = recommendSize(MACAQUINHO, { busto: 128, cintura: 108, quadril: 134 })
    expect(r?.foraDaTabela).toBe(true)
    // a linha menos ruim continua vindo (a UI mostra "a mais próxima seria X"), sem alternativa
    expect(r?.recomendado).toBe("GG")
    expect(r?.alternativa).toBeNull()
    expect(r?.caimento).toBe("justo")
  })
  it("medidas 20 cm abaixo de toda a tabela → foraDaTabela", () => {
    const r = recommendSize(MACAQUINHO, { busto: 62, cintura: 42, quadril: 68 })
    expect(r?.foraDaTabela).toBe(true)
    expect(r?.recomendado).toBe("P")
    expect(r?.alternativa).toBeNull()
  })
  it("medidas dentro da faixa → não é fora da tabela", () => {
    const r = recommendSize(MACAQUINHO, { busto: 90, cintura: 70, quadril: 96 })
    expect(r?.foraDaTabela).toBeFalsy()
  })
  it("uma medida 4 cm fora e soma ≤ 10 cm → ainda dentro da tabela", () => {
    // busto 112: GG (100–108) fica 4 cm acima — abaixo dos 5 cm por medida e dos 10 cm de soma
    const r = recommendSize(MACAQUINHO, { busto: 112 })
    expect(r?.recomendado).toBe("GG")
    expect(r?.foraDaTabela).toBe(false)
  })
})

describe("recommendSize — desempate da alternativa", () => {
  // G é o melhor sozinho (0); M e GG empatam em 1 cm — a alternativa deve ser a MAIOR (GG),
  // independentemente da ordem das linhas na tabela.
  const LINHAS = {
    P: ["P", "80-85"],
    M: ["M", "90-92"],
    G: ["G", "93-93"],
    GG: ["GG", "94-96"],
  }
  it("empate no 2º lugar → o maior tamanho, com a tabela em ordem", () => {
    const t = { columns: ["Busto"], rows: [LINHAS.P, LINHAS.M, LINHAS.G, LINHAS.GG] }
    const r = recommendSize(t, { busto: 93 })
    expect(r?.recomendado).toBe("G")
    expect(r?.alternativa).toBe("GG")
  })
  it("empate no 2º lugar → o maior tamanho, com a tabela desordenada", () => {
    const t = { columns: ["Busto"], rows: [LINHAS.GG, LINHAS.M, LINHAS.P, LINHAS.G] }
    const r = recommendSize(t, { busto: 93 })
    expect(r?.recomendado).toBe("G")
    expect(r?.alternativa).toBe("GG")
  })
})

describe("recommendSize — célula em branco", () => {
  it("ignora a coluna sem número na linha e pontua as demais", () => {
    const PARCIAL = {
      columns: ["Busto", "Cintura", "Quadril"],
      rows: [
        ["P", "82–88 cm", "", "88–94 cm"],
        ["M", "88–94 cm", "68–74 cm", "94–100 cm"],
      ],
    }
    const r = recommendSize(PARCIAL, { busto: 85, cintura: 64, quadril: 90 })
    expect(r?.recomendado).toBe("P")
    // a cintura da linha P não tem faixa: só busto e quadril entram nos detalhes
    expect(r?.detalhes.map((d) => d.medida)).toEqual(["busto", "quadril"])
  })
})

describe("estimateMeasurements — bordas", () => {
  it("altura e peso no limite superior excluído → null", () => {
    expect(estimateMeasurements(230, 60)).toBeNull()
    expect(estimateMeasurements(165, 250)).toBeNull()
  })
  it("valores negativos → null", () => {
    expect(estimateMeasurements(-165, 60)).toBeNull()
    expect(estimateMeasurements(165, -60)).toBeNull()
  })
})
