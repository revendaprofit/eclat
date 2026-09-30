import { describe, expect, it } from "vitest"
import {
  CONDICOES_PADRAO,
  fraseCartao,
  fraseFreteGratis,
  frasesDaBarra,
  lerCondicoes,
  lerPresenteDaBarra,
  linhaParcelamento,
  linhaPix,
  parcelaEmCentavos,
  pixEmCentavos,
  reais,
} from "./condicoes"

const fmt = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`
const ligado = { parcelas: 4, sem_juros: true, pix_percentual: 5 }

describe("lerCondicoes", () => {
  it("sem registro vale o padrão seguro (nada de sem juros nem Pix)", () => {
    expect(lerCondicoes(null)).toEqual(CONDICOES_PADRAO)
    expect(CONDICOES_PADRAO).toEqual({ parcelas: 4, sem_juros: false, pix_percentual: 0 })
  })
  it("aceita o registro do Cockpit e descarta valores inválidos", () => {
    expect(lerCondicoes(ligado)).toEqual(ligado)
    expect(lerCondicoes({ parcelas: 0, sem_juros: "sim", pix_percentual: -5 })).toEqual(CONDICOES_PADRAO)
    expect(lerCondicoes({ parcelas: 3.5, pix_percentual: 80 })).toEqual(CONDICOES_PADRAO)
  })
})

describe("valores", () => {
  it("parcela e Pix em centavos inteiros", () => {
    expect(parcelaEmCentavos(29900, 4)).toBe(7475)
    expect(parcelaEmCentavos(25900, 4)).toBe(6475)
    expect(parcelaEmCentavos(15900, 4)).toBe(3975)
    expect(pixEmCentavos(29900, 5)).toBe(28405)
    expect(pixEmCentavos(28620, 5)).toBe(27189)
    expect(pixEmCentavos(25900, 0)).toBe(25900)
  })
  it("reais formata centavos; curto tira os centavos de valor redondo", () => {
    expect(reais(7475).replace(/\s/g, " ")).toBe("R$ 74,75")
    expect(reais(49900, { curto: true }).replace(/\s/g, " ")).toBe("R$ 499")
    expect(reais(49900).replace(/\s/g, " ")).toBe("R$ 499,00")
  })
})

describe("linhas de preço", () => {
  it("parcela só aparece sem juros", () => {
    expect(linhaParcelamento(29900, ligado, fmt)).toBe("4x de R$ 74,75 sem juros")
    expect(linhaParcelamento(29900, CONDICOES_PADRAO, fmt)).toBeNull()
    expect(linhaParcelamento(0, ligado, fmt)).toBeNull()
  })
  it("Pix só aparece com desconto ligado", () => {
    expect(linhaPix(25900, ligado, fmt)).toBe("R$ 246,05 no Pix")
    expect(linhaPix(25900, CONDICOES_PADRAO, fmt)).toBeNull()
  })
  it("frase do cartão não promete sem juros enquanto não estiver ligado", () => {
    expect(fraseCartao(ligado)).toBe("4x sem juros no cartão")
    expect(fraseCartao(CONDICOES_PADRAO)).toBe("Até 4x no cartão")
  })
})

describe("frete grátis", () => {
  it("usa os pisos do backend (centavos)", () => {
    expect(fraseFreteGratis({ piso_mg: 49900, piso_brasil: 59900 }, fmt)).toBe(
      "Frete grátis a partir de R$ 499,00 em MG e R$ 599,00 nos demais estados"
    )
    expect(fraseFreteGratis({ piso_mg: 30000, piso_brasil: 30000 }, fmt)).toBe("Frete grátis a partir de R$ 300,00")
    expect(fraseFreteGratis({ piso_mg: 0, piso_brasil: 0 }, fmt)).toBe("Frete grátis para todo o Brasil")
    expect(fraseFreteGratis(null, fmt)).toBeNull()
    expect(fraseFreteGratis({ piso_mg: 49900, piso_brasil: 59900 }, fmt, { curta: true })).toBe("Frete grátis: R$ 499,00 em MG, R$ 599,00 no Brasil")
  })
})

describe("frasesDaBarra", () => {
  it("cupom, cartão, Pix e frete, nessa ordem", () => {
    expect(
      frasesDaBarra({ condicoes: ligado, cupom: { codigo: "BEMVINDA10", percentual: 10 }, pisos: { piso_mg: 49900, piso_brasil: 59900 }, fmt })
    ).toEqual([
      "10% OFF na 1ª compra com o cupom BEMVINDA10",
      "4x sem juros no cartão",
      "5% de desconto no Pix",
      "Frete grátis: R$ 499,00 em MG, R$ 599,00 no Brasil",
    ])
  })
  it("presente por faixa vem primeiro; faixa mais baixa, só com a promoção ligada", () => {
    const presente = lerPresenteDaBarra({
      ativo: true,
      faixas: [
        { id: "oculos", minimo_centavos: 55000 },
        { id: "meia", minimo_centavos: 25000 },
      ],
    })
    expect(presente).toEqual({ id: "meia", minimo_centavos: 25000 })
    expect(lerPresenteDaBarra({ ativo: false, faixas: [{ id: "meia", minimo_centavos: 25000 }] })).toBeNull()
    expect(frasesDaBarra({ condicoes: ligado, cupom: null, presente, pisos: null, fmt })[0]).toBe("Meia de presente a partir de R$ 250,00")
  })
  it("sem cupom e sem frete, fica só o que é verdade", () => {
    expect(frasesDaBarra({ condicoes: CONDICOES_PADRAO, cupom: null, pisos: null, fmt })).toEqual(["Até 4x no cartão"])
  })
})
