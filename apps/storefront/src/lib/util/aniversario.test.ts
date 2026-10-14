import { describe, expect, it } from "vitest"
import { aniversarioParaCampo, chaveDeAniversario, mascararAniversario } from "./aniversario"

describe("aniversário no site", () => {
  it("máscara dia/mês", () => {
    expect(mascararAniversario("1")).toBe("1")
    expect(mascararAniversario("14")).toBe("14")
    expect(mascararAniversario("141")).toBe("14/1")
    expect(mascararAniversario("14/10/1990")).toBe("14/10")
  })
  it("chave MM-DD, vazio é null, inválido é undefined", () => {
    expect(chaveDeAniversario("14/10")).toBe("10-14")
    expect(chaveDeAniversario("")).toBeNull()
    expect(chaveDeAniversario("14/1")).toBeUndefined()
    expect(chaveDeAniversario("31/04")).toBeUndefined()
    expect(chaveDeAniversario("29/02")).toBe("02-29")
  })
  it("volta para o campo", () => {
    expect(aniversarioParaCampo("10-14")).toBe("14/10")
    expect(aniversarioParaCampo(null)).toBe("")
  })
})
