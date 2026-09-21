import { describe, expect, it } from "vitest"
import { ERRO_CUPOM_PADRAO, mensagemDeErroDoCupom } from "./erro-cupom"

describe("mensagem de erro do cupom", () => {
  it("cupom de uso único já gasto: diz que já foi usado", () => {
    const erro = new Error("Promotion campaign budget exceeded")
    expect(mensagemDeErroDoCupom(erro, "ERIKA20")).toBe("O cupom ERIKA20 já foi usado.")
  })

  it("código errado: diz qual cupom não vale", () => {
    expect(mensagemDeErroDoCupom(new Error("The promotion code erika20 is invalid"), "erika20")).toBe(
      "Cupom erika20 inválido ou expirado."
    )
    expect(mensagemDeErroDoCupom(new Error("Promotion not found"))).toBe("Cupom inválido ou expirado.")
  })

  it("limite da campanha esgotado", () => {
    expect(mensagemDeErroDoCupom(new Error("Promotion campaign budget limit exceeded"), "ERIKA20")).toBe(
      "O cupom ERIKA20 já foi usado."
    )
  })

  it("erro desconhecido cai numa frase útil, nunca no texto técnico", () => {
    expect(mensagemDeErroDoCupom(new Error("ECONNRESET"))).toBe(ERRO_CUPOM_PADRAO)
    expect(mensagemDeErroDoCupom(undefined)).toBe(ERRO_CUPOM_PADRAO)
  })
})
