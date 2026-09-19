import { arredonda90, paraCentavos, paraValorMedusa } from "../dinheiro"

describe("dinheiro do frete", () => {
  it("converte reais decimais da SuperFrete em centavos inteiros", () => {
    expect(paraCentavos(17.43)).toBe(1743)
    expect(paraCentavos("17.4")).toBe(1740)
    expect(paraCentavos(0.1 + 0.2)).toBe(30)
  })

  it("recusa valor que não é número", () => {
    expect(() => paraCentavos("abc")).toThrow("Valor inválido")
  })

  it("devolve ao Medusa o valor na unidade maior decimal", () => {
    expect(paraValorMedusa(1690)).toBe(16.9)
    expect(paraValorMedusa(0)).toBe(0)
  })

  it("arredonda para cima até o próximo final ,90", () => {
    expect(arredonda90(1630)).toBe(1690)
    expect(arredonda90(1689)).toBe(1690)
    expect(arredonda90(1690)).toBe(1690)
    expect(arredonda90(1691)).toBe(1790)
    expect(arredonda90(200)).toBe(290)
  })
})
