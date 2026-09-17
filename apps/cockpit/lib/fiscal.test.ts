import { describe, it, expect } from "vitest"
import { rotuloStatus, statusBloqueiaDevolucao, corDoStatus, validarCaminhoFiscal, ehUuid } from "./fiscal"

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

  // Cobertura extra (lacuna apontada na revisão): os outros três status também caem em
  // "amarelo" — só "verificado" é verde e só "rejeitado"/"denegado" são vermelhos.
  it("os demais status (montado, transmitido, em contingência) também caem em amarelo", () => {
    expect(corDoStatus("montado")).toBe("amarelo")
    expect(corDoStatus("transmitido_sem_confirmacao")).toBe("amarelo")
    expect(corDoStatus("em_contingencia")).toBe("amarelo")
  })
})

// Achado crítico da revisão: o proxy montava a URL da Admin API por concatenação de string, sem
// validar `path`. Estes testes cobrem a função extraída para lib/ que fecha essa via de escape.
describe("validarCaminhoFiscal", () => {
  it("rejeita segmento '..' com 400 (path traversal do achado crítico)", () => {
    const r = validarCaminhoFiscal(["..", "..", "customers"])
    expect(r).toEqual({ ok: false, status: 400 })

    // Prova de que o achado é real: SEM a validação, é exatamente isso que o proxy fazia antes
    // da correção — montar "/admin/fiscal/../../customers" por concatenação e deixar o fetch
    // normalizar. O WHATWG URL colapsa os dot-segments e escapa de /admin/fiscal/ inteiro.
    const caminhoSemValidacao = `/admin/fiscal/${["..", "..", "customers"].join("/")}`
    expect(new URL(caminhoSemValidacao, "http://host").pathname).toBe("/customers")
  })

  it("rejeita '..' mesmo vindo de '%2e%2e' decodificado pelo roteador do Next", () => {
    const segmento = decodeURIComponent("%2e%2e")
    expect(segmento).toBe("..")
    expect(validarCaminhoFiscal([segmento, "customers"]).ok).toBe(false)
  })

  it("rejeita segmento com '/' ou '\\\\' embutido", () => {
    expect(validarCaminhoFiscal(["perfis/../../customers"])).toEqual({ ok: false, status: 400 })
    expect(validarCaminhoFiscal(["perfis\\..\\..\\customers"])).toEqual({ ok: false, status: 400 })
  })

  it("rejeita primeiro segmento fora da allowlist, com 404 (não confirma que a rota existe)", () => {
    expect(validarCaminhoFiscal(["customers"])).toEqual({ ok: false, status: 404 })
    // "emitir" fica de fora de propósito: transmite nota de verdade à SEFAZ, só via servidor.
    expect(validarCaminhoFiscal(["emitir"])).toEqual({ ok: false, status: 404 })
  })

  it("aceita cada rota da allowlist", () => {
    for (const rota of ["config", "perfis", "documentos", "reconciliar", "resolver", "emitir-devolucao"]) {
      expect(validarCaminhoFiscal([rota])).toEqual({ ok: true })
    }
  })

  it("aceita um sub-segmento válido depois da rota permitida (ex.: perfis/<id>)", () => {
    expect(validarCaminhoFiscal(["documentos", "abc123"])).toEqual({ ok: true })
  })
})

describe("ehUuid", () => {
  it("aceita uuid", () => {
    expect(ehUuid("3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b")).toBe(true)
  })
  it("recusa qualquer coisa que possa escapar do caminho", () => {
    for (const v of ["", "..", "../customers", "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b/../x", "3f2b8c1e%2f"]) {
      expect(ehUuid(v)).toBe(false)
    }
  })
})
