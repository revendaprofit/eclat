import { describe, expect, it } from "vitest"
import {
  contatoParaCarrinho,
  emailValido,
  etapaDoCheckout,
  lerContatoDoCookie,
  normalizarWhatsapp,
  serializarContato,
  validarContato,
  whatsappValido,
} from "./contato-checkout"

describe("whatsapp", () => {
  it("normaliza máscara e tira o 55 do país", () => {
    expect(normalizarWhatsapp("(31) 99999-0000")).toBe("31999990000")
    expect(normalizarWhatsapp("+55 31 99999-0000")).toBe("31999990000")
  })
  it("aceita só celular com DDD", () => {
    expect(whatsappValido("31999990000")).toBe(true)
    expect(whatsappValido("3133330000")).toBe(false) // fixo
    expect(whatsappValido("999990000")).toBe(false) // sem DDD
    expect(whatsappValido("01999990000")).toBe(false) // DDD inválido
  })
})

describe("validarContato", () => {
  it("devolve o contato normalizado", () => {
    expect(validarContato({ whatsapp: "(31) 99999-0000", email: " Ana@Email.com " })).toEqual({
      contato: { whatsapp: "31999990000", email: "ana@email.com" },
    })
  })
  it("recusa WhatsApp ou e-mail errados com mensagem própria", () => {
    expect(validarContato({ whatsapp: "123", email: "a@b.com" })).toHaveProperty("erro")
    expect(validarContato({ whatsapp: "31999990000", email: "ana@" })).toEqual({ erro: "Confira o e-mail." })
  })
  it("e-mail", () => {
    expect(emailValido("a@b.co")).toBe(true)
    expect(emailValido("a b@c.com")).toBe(false)
  })
})

describe("cookie do contato", () => {
  it("ida e volta", () => {
    const v = serializarContato({ whatsapp: "(31) 99999-0000", email: "Ana@email.com" })
    expect(lerContatoDoCookie(v)).toEqual({ whatsapp: "31999990000", email: "ana@email.com" })
  })
  it("ignora campo inválido e cookie quebrado", () => {
    expect(lerContatoDoCookie(serializarContato({ whatsapp: "31999990000", email: "" }))).toEqual({ whatsapp: "31999990000" })
    expect(lerContatoDoCookie("{nao é json")).toEqual({})
    expect(lerContatoDoCookie(undefined)).toEqual({})
  })
})

describe("contatoParaCarrinho", () => {
  it("preenche só o que falta e preserva o metadata", () => {
    expect(contatoParaCarrinho({ email: null, metadata: { cpf: "1" } }, { whatsapp: "31999990000", email: "a@b.com" })).toEqual({
      email: "a@b.com",
      metadata: { cpf: "1", whatsapp: "31999990000" },
    })
  })
  it("não sobrescreve contato que o carrinho já tem", () => {
    expect(
      contatoParaCarrinho({ email: "outra@b.com", metadata: { whatsapp: "31888880000" } }, { whatsapp: "31999990000", email: "a@b.com" })
    ).toBeNull()
  })
})

describe("etapaDoCheckout", () => {
  it("começa pelo contato", () => {
    expect(etapaDoCheckout({})).toBe("contato")
    expect(etapaDoCheckout({ email: "a@b.com" })).toBe("address")
    expect(etapaDoCheckout({ email: "a@b.com", shipping_address: { address_1: "Rua" }, shipping_methods: [] })).toBe("delivery")
    expect(etapaDoCheckout({ email: "a@b.com", shipping_address: { address_1: "Rua" }, shipping_methods: [{}] })).toBe("payment")
  })
  it("CEP sozinho (cotação da sacola) não pula o endereço", () => {
    expect(etapaDoCheckout({ email: "a@b.com", shipping_address: { address_1: null } })).toBe("address")
  })
})
