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

  // Bloco 1 / achados C1+C2: emissao_ativa=false (o padrão de fábrica) é o interruptor mestre da
  // spec §6.1, não uma trava de negócio. O backend responde 200 com documento null de propósito —
  // o despacho prossegue sem nota, com aviso visível ao operador, sem gravar metadata.fiscal.
  it("emissão desligada: prossegue SEM nota, com aviso — não é falha", () => {
    const r: ResultadoEmissao = {
      ok: true,
      emissao_desligada: true,
      motivo: "Emissão fiscal desligada em Fiscal → Configuração.",
    }
    const d = decidirDespacho(r)
    expect(d.prosseguir).toBe(true)
    if (d.prosseguir && d.fiscal === null) {
      expect(d.aviso).toBe("Emissão fiscal desligada em Fiscal → Configuração.")
    } else {
      throw new Error("esperava prosseguir=true com fiscal=null")
    }
  })

  it("emissão desligada sem motivo explícito: ainda prossegue, com um aviso de fallback legível", () => {
    const r: ResultadoEmissao = { ok: true, emissao_desligada: true }
    const d = decidirDespacho(r)
    expect(d.prosseguir).toBe(true)
    if (d.prosseguir && d.fiscal === null) {
      expect(d.aviso).not.toMatch(/undefined/)
      expect(d.aviso.length).toBeGreaterThan(0)
    } else {
      throw new Error("esperava prosseguir=true com fiscal=null")
    }
  })

  // Não afrouxa o caso oposto: emissão LIGADA e falha continua abortando o despacho — o aviso de
  // "desligada" só se aplica quando o backend confirma emissao_desligada explicitamente.
  it("emissão LIGADA e falha continua abortando — emissao_desligada não é assumido por ausência de documento", () => {
    const r: ResultadoEmissao = { ok: false, error: "Produto sem NCM: Top Aurora" }
    const d = decidirDespacho(r)
    expect(d.prosseguir).toBe(false)
    if (!d.prosseguir) {
      expect(d.status).toBe(422)
      expect(d.mensagem).toContain("Produto sem NCM: Top Aurora")
    }
  })
})
