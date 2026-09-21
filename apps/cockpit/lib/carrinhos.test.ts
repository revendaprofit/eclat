import { describe, expect, it } from "vitest"
import { linkWhatsApp, montarCarrinho, numeroWhatsApp, resumo, type CarrinhoCru } from "./carrinhos"

const AGORA = new Date("2026-09-20T12:00:00Z").getTime()
const base: CarrinhoCru = {
  id: "cart_1",
  created_at: "2026-09-20T08:00:00Z",
  updated_at: "2026-09-20T09:00:00Z",
  items: [
    { id: "i1", title: "Top Aurora", variant_title: "M / Telha", variant_sku: "ECL-1001-M", quantity: 1, unit_price: 159 },
    { id: "i2", title: "Short Aurora", variant_title: "M / Telha", quantity: 2, unit_price: 159, adjustments: [{ amount: 19 }] },
  ],
}

describe("montarCarrinho", () => {
  it("soma as peças e desconta os ajustes (Benefício Conjunto / cupom)", () => {
    const c = montarCarrinho(base, AGORA)
    expect(c.pecas).toBe(3)
    expect(c.valor).toBe(458) // 159 + 2×159 − 19
    expect(c.horas_parado).toBe(3)
  })

  it("sem e-mail nem telefone é só sacola; sem contato não há link de WhatsApp", () => {
    const c = montarCarrinho(base, AGORA)
    expect(c.estagio).toBe("sacola")
    expect(linkWhatsApp(c)).toBeNull()
  })

  it("e-mail do carrinho ou do cliente já identifica", () => {
    expect(montarCarrinho({ ...base, email: "ana@ex.com" }, AGORA).estagio).toBe("identificado")
    expect(montarCarrinho({ ...base, customer: { email: "ana@ex.com" } }, AGORA).email).toBe("ana@ex.com")
  })

  it("pagamento iniciado vence os outros estágios", () => {
    expect(montarCarrinho({ ...base, email: "ana@ex.com", pagamento_iniciado: "not_paid" }, AGORA).estagio).toBe("pagamento")
  })

  it("nome e telefone vêm do endereço de entrega antes do cadastro", () => {
    const c = montarCarrinho(
      { ...base, shipping_address: { first_name: "Ana", last_name: "Lima", phone: "(31) 98888-7777", city: "Betim", province: "MG" }, customer: { first_name: "X", phone: "1" } },
      AGORA
    )
    expect(c.nome).toBe("Ana Lima")
    expect(c.cidade).toBe("Betim / MG")
    expect(linkWhatsApp(c)).toContain("https://wa.me/5531988887777?text=Oi%2C%20Ana!")
  })

  it("carrinho sem itens não quebra", () => {
    const c = montarCarrinho({ ...base, items: null }, AGORA)
    expect(c.pecas).toBe(0)
    expect(c.valor).toBe(0)
  })
})

describe("numeroWhatsApp", () => {
  it("aceita com e sem 55, com máscara e com zero à esquerda", () => {
    expect(numeroWhatsApp("31988887777")).toBe("5531988887777")
    expect(numeroWhatsApp("+55 (31) 98888-7777")).toBe("5531988887777")
    expect(numeroWhatsApp("031 3333-4444")).toBe("553133334444")
  })
  it("recusa número sem DDD ou vazio", () => {
    expect(numeroWhatsApp("98888-7777")).toBeNull()
    expect(numeroWhatsApp(null)).toBeNull()
  })
})

describe("resumo", () => {
  it("separa o que tem contato do que é só sacola", () => {
    const lista = [montarCarrinho(base, AGORA), montarCarrinho({ ...base, id: "cart_2", email: "a@b.c" }, AGORA), montarCarrinho({ ...base, id: "cart_3", email: "a@b.c", pagamento_iniciado: "not_paid" }, AGORA)]
    expect(resumo(lista)).toEqual({ total: 3, valor: 1374, com_contato: 2, valor_com_contato: 916, pagamento: 1 })
  })
})
