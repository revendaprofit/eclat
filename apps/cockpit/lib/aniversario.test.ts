import { describe, expect, it } from "vitest"
import { calendarioPorMes, chaveDeAniversario, diasAte, ehCupomDeAniversario, proximosAniversariantes } from "./aniversario"

const c = (id: string, aniversario?: string, extra: Record<string, unknown> = {}) => ({
  id,
  first_name: id,
  last_name: null,
  email: `${id}@x.com`,
  phone: null,
  metadata: aniversario ? { aniversario, ...extra } : null,
})

describe("aniversário no Cockpit", () => {
  it("chave da ficha", () => {
    expect(chaveDeAniversario("14/10")).toBe("10-14")
    expect(chaveDeAniversario("")).toBeNull()
    expect(chaveDeAniversario("31/04")).toBeUndefined()
  })
  it("dias até o próximo aniversário, virando o ano", () => {
    expect(diasAte("10-14", "10-14")).toBe(0)
    expect(diasAte("10-20", "10-14")).toBe(6)
    expect(diasAte("01-02", "12-30")).toBe(3)
  })
  it("próximos 7 dias, ordenados, com a marca de parabéns do ano", () => {
    const ano = new Date().getFullYear()
    const lista = proximosAniversariantes(
      [c("a", "10-20"), c("b", "10-14", { aniversario_parabens: { ano, status: "enviado" } }), c("c", "11-05"), c("d")],
      "10-14"
    )
    expect(lista.map((x) => [x.id, x.dias, x.parabens_enviado])).toEqual([
      ["b", 0, true],
      ["a", 6, false],
    ])
  })
  it("calendário por mês", () => {
    const m = calendarioPorMes([c("a", "10-20"), c("b", "10-14"), c("c", "01-05")])
    expect(m[9].map((x) => x.dia)).toEqual([14, 20])
    expect(m[0].map((x) => x.id)).toEqual(["c"])
    expect(m[5]).toEqual([])
  })
  it("cupom de aniversário", () => {
    expect(ehCupomDeAniversario("ANDREAANIV26")).toBe(true)
    expect(ehCupomDeAniversario("ANDREA10")).toBe(false)
  })
})
