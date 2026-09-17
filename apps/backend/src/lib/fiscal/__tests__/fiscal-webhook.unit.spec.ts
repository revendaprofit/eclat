// Esquema de assinatura e envelope: https://www.brasilnfe.com.br/webhooks

import { createHmac } from "node:crypto"
import { assinaturaValida, chavesDoLote } from "../fiscal-webhook"

const SEGREDO = "segredo-de-teste"
const CORPO = '{"event":"test.ping","deliveryId":"abc","timestamp":"2026-09-17T12:00:00Z","data":{"test":true}}'

function assinar(corpo: string, segredo = SEGREDO): string {
  return "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex")
}

describe("assinaturaValida", () => {
  it("aceita a assinatura correta, com o corpo como string ou Buffer", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO), SEGREDO)).toBe(true)
    expect(assinaturaValida(Buffer.from(CORPO, "utf8"), assinar(CORPO), SEGREDO)).toBe(true)
  })

  it("recusa corpo alterado em 1 byte", () => {
    expect(assinaturaValida(CORPO.replace("true", "tru3"), assinar(CORPO), SEGREDO)).toBe(false)
  })

  it("recusa o MESMO JSON reserializado com outro espaçamento — é por isso que precisa do corpo bruto", () => {
    const reserializado = JSON.stringify(JSON.parse(CORPO), null, 2)
    expect(JSON.parse(reserializado)).toEqual(JSON.parse(CORPO)) // mesmo conteúdo…
    expect(assinaturaValida(reserializado, assinar(CORPO), SEGREDO)).toBe(false) // …assinatura diferente
  })

  it("recusa assinatura feita com outro segredo", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, "outro"), SEGREDO)).toBe(false)
  })

  it("recusa header sem o prefixo sha256=, vazio ou ausente", () => {
    const hex = assinar(CORPO).slice("sha256=".length)
    expect(assinaturaValida(CORPO, hex, SEGREDO)).toBe(false)
    expect(assinaturaValida(CORPO, "", SEGREDO)).toBe(false)
    expect(assinaturaValida(CORPO, undefined, SEGREDO)).toBe(false)
  })

  it("recusa quando o segredo não está configurado — nunca 'aceita tudo' por falta de config", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, ""), "")).toBe(false)
    expect(assinaturaValida(CORPO, assinar(CORPO), undefined)).toBe(false)
  })

  it("recusa quando o corpo bruto não está disponível", () => {
    expect(assinaturaValida(undefined, assinar(CORPO), SEGREDO)).toBe(false)
  })

  it("header de tamanho diferente não lança (timingSafeEqual exige tamanhos iguais)", () => {
    expect(() => assinaturaValida(CORPO, "sha256=abc", SEGREDO)).not.toThrow()
    expect(assinaturaValida(CORPO, "sha256=abc", SEGREDO)).toBe(false)
  })
})

describe("chavesDoLote", () => {
  const CHAVE = "31260968673407000113550010000000011000000017"

  it("extrai só as chaves de 44 dígitos (nota não autorizada vem com chave vazia)", () => {
    expect(chavesDoLote({ notas: [{ chaveAcesso: CHAVE }, { chaveAcesso: "" }, { chaveAcesso: "123" }] })).toEqual([CHAVE])
  })

  it("corpo malformado devolve lista vazia, sem lançar", () => {
    expect(chavesDoLote(undefined)).toEqual([])
    expect(chavesDoLote({})).toEqual([])
    expect(chavesDoLote({ notas: "x" })).toEqual([])
    expect(chavesDoLote({ notas: [null, 5, {}] })).toEqual([])
  })
})
