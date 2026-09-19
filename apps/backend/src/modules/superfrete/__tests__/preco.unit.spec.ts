import { aplicarFreteGratis, normalizaUf, pisoPara, precosNormais } from "../preco"
import { parametrosDoAmbiente } from "../parametros"

const P = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }

describe("regra de preço do frete", () => {
  it("preço normal = cotação + margem, arredondado para ,90", () => {
    expect(precosNormais({ pac: 1430, sedex: 2210 }, P)).toEqual({ pac: 1690, sedex: 2490 })
  })

  it("normaliza a UF", () => {
    expect(normalizaUf("mg")).toBe("MG")
    expect(normalizaUf("BR-MG")).toBe("MG")
    expect(normalizaUf(" sp ")).toBe("SP")
    expect(normalizaUf(null)).toBe("")
  })

  it("piso de MG é diferente do resto do Brasil; UF desconhecida usa o do Brasil", () => {
    expect(pisoPara("MG", P)).toBe(49900)
    expect(pisoPara("SP", P)).toBe(59900)
    expect(pisoPara("", P)).toBe(59900)
  })

  it("abaixo do piso ninguém fica grátis", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 2490 }, 48000, "MG", P)).toEqual({ pac: 1690, sedex: 2490 })
  })

  it("no piso exato a mais barata zera e o SEDEX cobra a diferença (exemplo da spec)", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 2490 }, 49900, "MG", P)).toEqual({ pac: 0, sedex: 800 })
  })

  it("R$ 520 em SP não atinge o piso do Brasil", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 2490 }, 52000, "SP", P)).toEqual({ pac: 1690, sedex: 2490 })
  })

  it("com Mini Envios disponível, só ele zera; PAC e SEDEX cobram a diferença", () => {
    expect(aplicarFreteGratis({ mini: 1290, pac: 1690, sedex: 2490 }, 60000, "SP", P)).toEqual({
      mini: 0,
      pac: 400,
      sedex: 1200,
    })
  })

  it("diferença nunca fica negativa e mapa vazio continua vazio", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 1590 }, 60000, "SP", P)).toEqual({ pac: 100, sedex: 0 })
    expect(aplicarFreteGratis({}, 60000, "SP", P)).toEqual({})
  })
})

describe("parâmetros do ambiente", () => {
  it("usa os padrões da spec quando não há env", () => {
    expect(parametrosDoAmbiente({})).toEqual(P)
  })

  it("env sobrescreve, e valor inválido cai no padrão", () => {
    expect(parametrosDoAmbiente({ FRETE_MARGEM_CENTAVOS: "300", FRETE_GRATIS_MG_CENTAVOS: "abc" })).toEqual({
      ...P,
      margem: 300,
    })
  })
})
