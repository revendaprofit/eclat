import { createHmac } from "node:crypto"
import { assinaturaValida } from "../assinatura.js"

describe("assinatura (webhook do Mercado Pago)", () => {
  const segredo = "segredo-de-teste"
  const ts = "1742505638683"
  // Id de order real (alfanumérico maiúsculo) — o ponto central é confirmar que o lowercase é
  // aplicado antes do HMAC, exatamente como a doc oficial exige (findings.md, 2026-09-17).
  const dataId = "ORD01M28P44G5FG8RJPM579EH56FV"

  function assinar(manifesto: string) {
    return createHmac("sha256", segredo).update(manifesto).digest("hex")
  }

  function base() {
    const v1 = assinar(`id:${dataId.toLowerCase()};request-id:req-1;ts:${ts};`)
    return { xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId, segredo }
  }

  it("aceita uma assinatura correta", () => {
    expect(assinaturaValida(base())).toBe(true)
  })

  it("aceita mesmo se o id do webhook vier em maiúsculas (normaliza antes do HMAC)", () => {
    expect(assinaturaValida({ ...base(), dataId: dataId.toUpperCase() })).toBe(true)
  })

  it("rejeita quando o segredo está errado", () => {
    expect(assinaturaValida({ ...base(), segredo: "outro-segredo" })).toBe(false)
  })

  it("rejeita quando o id foi adulterado", () => {
    expect(assinaturaValida({ ...base(), dataId: "ORD999999999999999999999" })).toBe(false)
  })

  it("rejeita quando o x-request-id foi adulterado", () => {
    expect(assinaturaValida({ ...base(), xRequestId: "req-adulterado" })).toBe(false)
  })

  it("rejeita quando falta o header x-signature", () => {
    expect(assinaturaValida({ ...base(), xSignature: undefined })).toBe(false)
  })

  it("rejeita quando falta o segredo configurado", () => {
    expect(assinaturaValida({ ...base(), segredo: undefined })).toBe(false)
  })

  it("rejeita quando falta o dataId", () => {
    expect(assinaturaValida({ ...base(), dataId: undefined })).toBe(false)
  })

  it("rejeita um x-signature sem ts ou v1", () => {
    expect(assinaturaValida({ ...base(), xSignature: "formato=invalido" })).toBe(false)
  })

  it("rejeita uma assinatura truncada (não é só prefixo válido)", () => {
    const { xSignature } = base()
    const truncada = xSignature.slice(0, xSignature.length - 4)
    expect(assinaturaValida({ ...base(), xSignature: truncada })).toBe(false)
  })
})
