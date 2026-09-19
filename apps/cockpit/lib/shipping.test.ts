import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PedidoParaEtiqueta } from "./superfrete-etiqueta"

const PEDIDO: PedidoParaEtiqueta = {
  itens: [{ titulo: "Top Aura", quantidade: 1, preco_unitario: 189 }],
  endereco: { first_name: "Ana", last_name: "Silva", address_1: "Rua Um", city: "Belo Horizonte", province: "MG", postal_code: "30130010", country_code: "br", phone: "31988887777" },
  email: "ana@example.com", cpf: "52998224725", numero: "45", bairro: "Savassi",
  display_id: 1042,
  dados_do_frete: { servico: 1, pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } },
}
const ENV = {
  SUPERFRETE_TOKEN: "tok-teste", SUPERFRETE_SANDBOX: "true", SUPERFRETE_CONTACT_EMAIL: "teste@example.com",
  SUPERFRETE_FROM_NAME: "Loja Teste", SUPERFRETE_FROM_DOCUMENT: "11222333000181", SUPERFRETE_FROM_PHONE: "31999990000",
  SUPERFRETE_FROM_ADDRESS: "Rua Exemplo", SUPERFRETE_FROM_NUMBER: "100", SUPERFRETE_FROM_DISTRICT: "Centro",
  SUPERFRETE_FROM_CITY: "Cidade Teste", SUPERFRETE_FROM_STATE: "MG", SUPERFRETE_FROM_POSTAL_CODE: "01001000",
}
const resposta = (status: number, corpo: unknown) => ({ ok: status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) })

describe("carrierCreateLabel (SuperFrete)", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("cria o frete, paga com saldo e devolve rastreio + PDF", async () => {
    const chamadas: { url: string; corpo: Record<string, unknown> }[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, corpo: JSON.parse(String(init.body)) })
      if (url.endsWith("/api/v0/cart")) return resposta(200, { id: "ord_1", price: 14.3, status: "pending" })
      return resposta(200, { success: true, purchase: { status: "paid", orders: [{ id: "ord_1", tracking: "AA123456789BR", print: { url: "https://sandbox.superfrete.com/etiqueta.pdf" } }] } })
    }))
    const { carrierCreateLabel, carrierConfigured, CARRIER_NAME } = await import("./shipping")

    expect(CARRIER_NAME).toBe("SuperFrete")
    expect(carrierConfigured()).toBe(true)
    expect(await carrierCreateLabel(PEDIDO, null)).toEqual({
      tracking_number: "AA123456789BR",
      tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
      label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
      carrier_order_id: "ord_1",
    })
    expect(chamadas.map((c) => c.url)).toEqual(["https://sandbox.superfrete.com/api/v0/cart", "https://sandbox.superfrete.com/api/v0/checkout"])
    expect(chamadas[0].corpo.service).toBe(1)
    expect(chamadas[1].corpo).toEqual({ orders: ["ord_1"] })
  })

  it("saldo insuficiente vira mensagem clara e não esconde o motivo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.endsWith("/cart") ? resposta(200, { id: "ord_1" }) : resposta(402, { message: "Saldo insuficiente" })
    ))
    const { carrierCreateLabel } = await import("./shipping")
    await expect(carrierCreateLabel(PEDIDO, null)).rejects.toThrow("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
  })

  it("sem token, avisa e a UI segue no modo manual", async () => {
    vi.stubEnv("SUPERFRETE_TOKEN", "")
    const { carrierCreateLabel, carrierConfigured } = await import("./shipping")
    expect(carrierConfigured()).toBe(false)
    await expect(carrierCreateLabel(PEDIDO, null)).rejects.toThrow("SUPERFRETE_TOKEN")
  })

  it("não chama a API se o pedido não tem CPF", async () => {
    const chamada = vi.fn()
    vi.stubGlobal("fetch", chamada)
    const { carrierCreateLabel } = await import("./shipping")
    await expect(carrierCreateLabel({ ...PEDIDO, cpf: "" }, null)).rejects.toThrow("CPF")
    expect(chamada).not.toHaveBeenCalled()
  })
})
