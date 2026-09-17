import { paraCentavos, paraValorMp } from "../dinheiro.js"

describe("dinheiro", () => {
  describe("paraValorMp", () => {
    it("formata número com 2 casas", () => {
      expect(paraValorMp(199.9)).toBe("199.90")
    })

    it("formata número inteiro com 2 casas", () => {
      expect(paraValorMp(50)).toBe("50.00")
    })

    it("aceita string decimal", () => {
      expect(paraValorMp("24.9" as unknown as number)).toBe("24.90")
    })

    it("arredonda pra 2 casas quando vem com mais precisão", () => {
      expect(paraValorMp(199.905)).toBe("199.91")
    })

    it("lança em valor inválido", () => {
      expect(() => paraValorMp("não é número" as unknown as number)).toThrow()
    })
  })

  describe("paraCentavos", () => {
    it("converte string decimal em centavos inteiros", () => {
      expect(paraCentavos("9.96")).toBe(996)
    })

    it("converte número decimal em centavos inteiros", () => {
      expect(paraCentavos(22.71)).toBe(2271)
    })

    it("arredonda em vez de truncar", () => {
      expect(paraCentavos(9.965)).toBe(997) // 996.5 -> 997 (round)
    })
  })
})
