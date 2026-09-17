import { describe, it, expect } from "vitest"
import { rotuloStatus, statusBloqueiaDevolucao, corDoStatus } from "./fiscal"

describe("rotuloStatus", () => {
  it("traduz cada status para português legível", () => {
    expect(rotuloStatus("verificado")).toBe("Verificado")
    expect(rotuloStatus("autorizado_nao_verificado")).toBe("Autorizado (aguardando XML)")
    expect(rotuloStatus("transmitido_sem_confirmacao")).toBe("Transmitido sem confirmação")
    expect(rotuloStatus("rejeitado")).toBe("Rejeitado")
    expect(rotuloStatus("denegado")).toBe("Denegado")
    expect(rotuloStatus("em_contingencia")).toBe("Em contingência")
    expect(rotuloStatus("montado")).toBe("Montado")
  })

  it("devolve o próprio valor para status desconhecido, sem quebrar a tela", () => {
    expect(rotuloStatus("coisa_nova" as never)).toBe("coisa_nova")
  })
})

describe("statusBloqueiaDevolucao", () => {
  it("só 'verificado' libera a devolução", () => {
    expect(statusBloqueiaDevolucao("verificado")).toBe(false)
    expect(statusBloqueiaDevolucao("autorizado_nao_verificado")).toBe(true)
    expect(statusBloqueiaDevolucao("rejeitado")).toBe(true)
    expect(statusBloqueiaDevolucao("montado")).toBe(true)
  })
})

describe("corDoStatus", () => {
  it("dá cor de alerta para os status que exigem ação", () => {
    expect(corDoStatus("rejeitado")).toBe("vermelho")
    expect(corDoStatus("denegado")).toBe("vermelho")
    expect(corDoStatus("verificado")).toBe("verde")
    expect(corDoStatus("autorizado_nao_verificado")).toBe("amarelo")
  })
})
