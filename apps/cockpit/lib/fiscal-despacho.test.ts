import { describe, it, expect } from "vitest"
import { decidirDespacho, type ResultadoEmissao } from "./fiscal-despacho"

const DOC_BASE = { id: "doc1", chave_acesso: "123", numero: 42, rejeicao_codigo: null, rejeicao_motivo: null }

describe("decidirDespacho", () => {
  it("prossegue com documento autorizado_nao_verificado, com fiscal preenchido", () => {
    const r: ResultadoEmissao = { ok: true, documento: { ...DOC_BASE, status: "autorizado_nao_verificado" } }
    expect(decidirDespacho(r)).toEqual({
      prosseguir: true,
      fiscal: { documento_id: "doc1", chave_acesso: "123", numero: 42 },
    })
  })

  it("prossegue com documento já verificado (reemissão idempotente devolvendo o existente)", () => {
    const r: ResultadoEmissao = { ok: true, documento: { ...DOC_BASE, status: "verificado" } }
    expect(decidirDespacho(r).prosseguir).toBe(true)
  })

  it("não prossegue quando a nota é rejeitada — 422 com código e motivo na mensagem", () => {
    const r: ResultadoEmissao = {
      ok: true,
      documento: { ...DOC_BASE, status: "rejeitado", rejeicao_codigo: "204", rejeicao_motivo: "Duplicidade de NF-e" },
    }
    expect(decidirDespacho(r)).toEqual({
      prosseguir: false,
      status: 422,
      mensagem: "NF-e rejeitado: Duplicidade de NF-e (código 204)",
    })
  })

  it("não prossegue quando a nota é denegada — 422 com código e motivo", () => {
    const r: ResultadoEmissao = {
      ok: true,
      documento: { ...DOC_BASE, status: "denegado", rejeicao_codigo: "301", rejeicao_motivo: "CNPJ irregular" },
    }
    const d = decidirDespacho(r)
    expect(d.prosseguir).toBe(false)
    if (!d.prosseguir) {
      expect(d.status).toBe(422)
      expect(d.mensagem).toContain("301")
      expect(d.mensagem).toContain("CNPJ irregular")
    }
  })

  it("r.ok === false com { error } do backend não prossegue e propaga a mensagem do backend", () => {
    const r: ResultadoEmissao = { ok: false, error: "Produto sem NCM: Top Aurora" }
    const d = decidirDespacho(r)
    expect(d.prosseguir).toBe(false)
    if (!d.prosseguir) {
      expect(d.status).toBe(422)
      expect(d.mensagem).toContain("Produto sem NCM: Top Aurora")
    }
  })

  it("resposta ok mas sem documento não prossegue — não assume sucesso pela ausência de erro", () => {
    const r: ResultadoEmissao = { ok: true }
    expect(decidirDespacho(r).prosseguir).toBe(false)
  })

  it("mensagem de fallback legível quando error está ausente numa falha (nunca 'undefined')", () => {
    const r: ResultadoEmissao = { ok: false }
    const d = decidirDespacho(r)
    expect(d.prosseguir).toBe(false)
    if (!d.prosseguir) {
      expect(d.mensagem).not.toMatch(/undefined/)
      expect(d.mensagem).toBe("NF-e não emitida: erro desconhecido")
    }
  })
})
