import { cabeNoMiniEnvios, montarPacote } from "../embalagem"

describe("embalagem", () => {
  it("1 peça leve vai no saquinho P com 4 cm e cabe no Mini Envios", () => {
    const p = montarPacote([{ quantidade: 1, peso_g: 200 }])
    expect(p).toEqual({ pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.25 })
    expect(cabeNoMiniEnvios(p)).toBe(true)
  })

  it("1 peça de 300 g passa do limite de peso: saquinho P com 5 cm, sem Mini Envios", () => {
    const p = montarPacote([{ quantidade: 1, peso_g: 300 }])
    expect(p).toEqual({ pecas: 1, largura: 15, altura: 5, comprimento: 15, peso_kg: 0.35 })
    expect(cabeNoMiniEnvios(p)).toBe(false)
  })

  it("no limite exato de 300 g (250 g + saquinho de 50 g) ainda cabe", () => {
    expect(cabeNoMiniEnvios(montarPacote([{ quantidade: 1, peso_g: 250 }]))).toBe(true)
  })

  it("2 peças vão no saquinho M", () => {
    const p = montarPacote([{ quantidade: 2, peso_g: 200 }])
    expect(p).toEqual({ pecas: 2, largura: 20, altura: 5, comprimento: 20, peso_kg: 0.45 })
    expect(cabeNoMiniEnvios(p)).toBe(false)
  })

  it("3 peças ou mais vão na caixa, somando linhas diferentes", () => {
    const p = montarPacote([
      { quantidade: 2, peso_g: 200 },
      { quantidade: 1, peso_g: 300 },
    ])
    expect(p).toEqual({ pecas: 3, largura: 25, altura: 10, comprimento: 20, peso_kg: 0.815 })
  })

  it("peça sem peso cadastrado conta 300 g", () => {
    expect(montarPacote([{ quantidade: 1, peso_g: null }]).peso_kg).toBe(0.35)
    expect(montarPacote([{ quantidade: 1 }]).peso_kg).toBe(0.35)
  })

  it("peças reais da Lumière (2026-09-19): macaquinho sozinho ainda cabe no Mini Envios", () => {
    const macaquinho = montarPacote([{ quantidade: 1, peso_g: 222 }]) // 222 + 50 = 272 g
    expect(macaquinho.peso_kg).toBe(0.272)
    expect(cabeNoMiniEnvios(macaquinho)).toBe(true)
    const conjunto = montarPacote([{ quantidade: 1, peso_g: 137 }, { quantidade: 1, peso_g: 132 }]) // top + short Aurora
    expect(conjunto.peso_kg).toBe(0.319)
    expect(cabeNoMiniEnvios(conjunto)).toBe(false) // saquinho M tem 5 cm de altura
  })

  it("carrinho vazio é erro", () => {
    expect(() => montarPacote([])).toThrow("sem peças")
  })
})
