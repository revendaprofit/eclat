import { describe, expect, it } from "vitest"
import { personasAtivasDe } from "./personas-flag"

describe("personasAtivasDe", () => {
  it("chave ausente ou valor inválido → ativo (padrão)", () => {
    expect(personasAtivasDe(null)).toBe(true)
    expect(personasAtivasDe(undefined)).toBe(true)
    expect(personasAtivasDe({})).toBe(true)
    expect(personasAtivasDe("desativada")).toBe(true)
    expect(personasAtivasDe({ ativo: "false" })).toBe(true)
  })
  it("respeita o booleano", () => {
    expect(personasAtivasDe({ ativo: false })).toBe(false)
    expect(personasAtivasDe({ ativo: true })).toBe(true)
  })
})
