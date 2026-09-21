import { normalizarWhatsapp, validarBoasVindas } from "../boas-vindas"

describe("normalizarWhatsapp", () => {
  it("aceita celular com máscara, com e sem 55; devolve dígitos com DDI", () => {
    expect(normalizarWhatsapp("(31) 99118-4431")).toBe("5531991184431")
    expect(normalizarWhatsapp("+55 31 99118-4431")).toBe("5531991184431")
    expect(normalizarWhatsapp("3133334444")).toBe("553133334444")
  })
  it("recusa número curto, longo demais ou celular sem o 9", () => {
    expect(normalizarWhatsapp("99118-4431")).toBeNull()
    expect(normalizarWhatsapp("31 8118-44310")).toBeNull()
    expect(normalizarWhatsapp("123456789012345")).toBeNull()
  })
})

describe("validarBoasVindas", () => {
  const agora = new Date("2026-09-21T12:00:00Z")
  it("monta o lead com o aceite datado; e-mail é opcional", () => {
    const r = validarBoasVindas({ whatsapp: "31 99118-4431", aceite: true, texto_aceite: "Aceito receber novidades" }, agora)
    expect(r).toEqual({ lead: { whatsapp: "5531991184431", email: null, nota: '[boas-vindas do site] Aceite em 2026-09-21T12:00:00.000Z: "Aceito receber novidades"' } })
  })
  it("sem aceite, com WhatsApp ou e-mail errado, ou com o campo-isca preenchido → erro", () => {
    expect(validarBoasVindas({ whatsapp: "31991184431" }, agora)).toHaveProperty("erro")
    expect(validarBoasVindas({ whatsapp: "123", aceite: true }, agora)).toHaveProperty("erro")
    expect(validarBoasVindas({ whatsapp: "31991184431", aceite: true, email: "x@" }, agora)).toHaveProperty("erro")
    expect(validarBoasVindas({ whatsapp: "31991184431", aceite: true, site: "http://spam" }, agora)).toHaveProperty("erro")
  })
})
