import { aplicarFreteGratis, normalizaUf, pisoPara, precosDeVitrine, precosNormais, semDominadas } from "../preco"
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

describe("opção dominada", () => {
  it("BH: SEDEX mais barato e mais rápido esconde PAC e Mini Envios", () => {
    expect(semDominadas({ mini: 1690, pac: 2090, sedex: 1490 }, { mini: 8, pac: 5, sedex: 1 })).toEqual({ sedex: 1490 })
  })

  it("São Paulo: cada uma ganha em preço ou em prazo, ficam as três", () => {
    const normais = { mini: 1890, pac: 2390, sedex: 3590 }
    expect(semDominadas(normais, { mini: 8, pac: 5, sedex: 1 })).toEqual(normais)
  })

  it("mesmo preço de vitrine e prazo pior: some a mais lenta", () => {
    expect(semDominadas({ mini: 1690, pac: 1690 }, { mini: 8, pac: 5 })).toEqual({ pac: 1690 })
  })

  it("empate nos dois quesitos mantém as duas", () => {
    expect(semDominadas({ pac: 1690, sedex: 1690 }, { pac: 3, sedex: 3 })).toEqual({ pac: 1690, sedex: 1690 })
  })

  it("sem prazo conhecido não dá para comparar: a opção fica", () => {
    expect(semDominadas({ pac: 2090, sedex: 1490 }, { sedex: 1 })).toEqual({ pac: 2090, sedex: 1490 })
  })

  it("precosDeVitrine aplica margem, ,90 e tira a dominada (cotação real de BH em 2026-09-18)", () => {
    const P = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }
    expect(
      precosDeVitrine(
        [
          { servico: "mini", centavos: 1452, prazoMax: 8 },
          { servico: "pac", centavos: 1871, prazoMax: 5 },
          { servico: "sedex", centavos: 1191, prazoMax: 1 },
        ],
        P
      )
    ).toEqual({ sedex: 1490 })
  })
})
