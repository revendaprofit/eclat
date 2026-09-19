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
const abortado = () => {
  const e = new Error("The operation was aborted.")
  e.name = "AbortError"
  return e
}
const MSG_TIMEOUT = "A SuperFrete não respondeu a tempo. Nada foi cobrado em dobro: clique em Despachar de novo que o sistema confere a etiqueta antes de comprar."

beforeEach(() => {
  vi.resetModules()
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("carrierCriarFrete", () => {
  it("cria o frete (POST /api/v0/cart) e devolve o id", async () => {
    let chamada: { url: string; init: RequestInit } | undefined
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      chamada = { url, init }
      return resposta(200, { id: "ord_1", price: 14.3, status: "pending" })
    }))
    const { carrierCriarFrete } = await import("./shipping")
    const id = await carrierCriarFrete(PEDIDO, null)
    expect(id).toBe("ord_1")
    expect(chamada?.url).toBe("https://sandbox.superfrete.com/api/v0/cart")
    expect(JSON.parse(String(chamada?.init.body)).service).toBe(1)
    const headers = chamada?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer tok-teste")
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("SuperFrete não devolve id: erro claro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(200, { price: 14.3 })))
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete(PEDIDO, null)).rejects.toThrow("SuperFrete não devolveu o id do frete criado.")
  })

  it("saldo insuficiente (HTTP 402) vira mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(402, { message: "Saldo insuficiente" })))
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete(PEDIDO, null)).rejects.toThrow("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
  })

  it("saldo insuficiente relatado como HTTP 400 com 'Saldo insuficiente' no corpo também vira a mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(400, { message: "Saldo insuficiente" })))
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete(PEDIDO, null)).rejects.toThrow("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
  })

  it("erro não relacionado a saldo (menciona 'saldo devedor') NÃO vira mensagem de sem saldo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(400, { message: "CEP de origem com saldo devedor de tributos" })))
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete(PEDIDO, null)).rejects.toThrow(/SuperFrete \/api\/v0\/cart → HTTP 400/)
  })

  it("sem token, lança CarrierNotConfigured e NÃO chama a API", async () => {
    vi.stubEnv("SUPERFRETE_TOKEN", "")
    const chamada = vi.fn()
    vi.stubGlobal("fetch", chamada)
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete(PEDIDO, null)).rejects.toThrow("SUPERFRETE_TOKEN")
    expect(chamada).not.toHaveBeenCalled()
  })

  it("pedido sem CPF: valida antes de chamar a API, nunca gasta saldo por dado ruim", async () => {
    const chamada = vi.fn()
    vi.stubGlobal("fetch", chamada)
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete({ ...PEDIDO, cpf: "" }, null)).rejects.toThrow("CPF")
    expect(chamada).not.toHaveBeenCalled()
  })

  it("SuperFrete não responde a tempo: mensagem exata dizendo que não cobrou em dobro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw abortado() }))
    const { carrierCriarFrete } = await import("./shipping")
    await expect(carrierCriarFrete(PEDIDO, null)).rejects.toThrow(MSG_TIMEOUT)
  })
})

describe("carrierPagarFrete", () => {
  it("paga o frete (POST /api/v0/checkout) e devolve rastreio + PDF + carrier_order_id", async () => {
    let chamada: { url: string; corpo: unknown } | undefined
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      chamada = { url, corpo: JSON.parse(String(init.body)) }
      return resposta(200, { success: true, purchase: { status: "paid", orders: [{ id: "ord_1", tracking: "AA123456789BR", print: { url: "https://sandbox.superfrete.com/etiqueta.pdf" } }] } })
    }))
    const { carrierPagarFrete } = await import("./shipping")
    expect(await carrierPagarFrete("ord_1")).toEqual({
      tracking_number: "AA123456789BR",
      tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
      label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
      carrier_order_id: "ord_1",
    })
    expect(chamada?.url).toBe("https://sandbox.superfrete.com/api/v0/checkout")
    expect(chamada?.corpo).toEqual({ orders: ["ord_1"] })
  })

  it("sem token, lança CarrierNotConfigured", async () => {
    vi.stubEnv("SUPERFRETE_TOKEN", "")
    const { carrierPagarFrete } = await import("./shipping")
    await expect(carrierPagarFrete("ord_1")).rejects.toThrow("SUPERFRETE_TOKEN")
  })

  it("saldo insuficiente vira mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(402, { message: "Saldo insuficiente" })))
    const { carrierPagarFrete } = await import("./shipping")
    await expect(carrierPagarFrete("ord_1")).rejects.toThrow("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
  })

  it("SuperFrete não responde a tempo: mensagem exata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw abortado() }))
    const { carrierPagarFrete } = await import("./shipping")
    await expect(carrierPagarFrete("ord_1")).rejects.toThrow(MSG_TIMEOUT)
  })

  it("timeout durante a LEITURA DO CORPO da resposta (não só no cabeçalho) também vira a mensagem exata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => { throw abortado() },
      json: async () => { throw abortado() },
    })))
    const { carrierPagarFrete } = await import("./shipping")
    await expect(carrierPagarFrete("ord_1")).rejects.toThrow(MSG_TIMEOUT)
  })

  it("sem rastreio ainda na resposta: tracking_number fica vazio, NUNCA cai pro id do frete", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(200, {
      success: true, purchase: { status: "pending", orders: [{ id: "ord_1" }] },
    })))
    const { carrierPagarFrete } = await import("./shipping")
    const label = await carrierPagarFrete("ord_1")
    expect(label.tracking_number).toBe("")
    expect(label.tracking_url).toBe("")
    expect(label.carrier_order_id).toBe("ord_1")
  })
})

describe("carrierConsultarFrete", () => {
  it("status pending (criado, ainda não pago): sem etiqueta", async () => {
    let url: string | undefined
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      url = u
      return resposta(200, { id: "ord_1", status: "pending" })
    }))
    const { carrierConsultarFrete } = await import("./shipping")
    expect(await carrierConsultarFrete("ord_1")).toEqual({ status: "pending", label: null })
    expect(url).toBe("https://sandbox.superfrete.com/api/v0/order/info/ord_1")
  })

  it("status released (pago, aguardando postagem): devolve rastreio + PDF", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(200, {
      id: "ord_1", status: "released", tracking: "AA123456789BR", print: { url: "https://sandbox.superfrete.com/etiqueta.pdf" },
    })))
    const { carrierConsultarFrete } = await import("./shipping")
    expect(await carrierConsultarFrete("ord_1")).toEqual({
      status: "released",
      label: {
        tracking_number: "AA123456789BR",
        tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
        label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
        carrier_order_id: "ord_1",
      },
    })
  })

  it("status posted e delivered também contam como etiqueta pronta", async () => {
    for (const status of ["posted", "delivered"]) {
      vi.resetModules()
      vi.stubGlobal("fetch", vi.fn(async () => resposta(200, { id: "ord_1", status, tracking: "AA1", print: { url: "pdf" } })))
      const { carrierConsultarFrete } = await import("./shipping")
      const r = await carrierConsultarFrete("ord_1")
      expect(r.status).toBe(status)
      expect(r.label).not.toBeNull()
    }
  })

  it("status canceled: sem etiqueta (não é um dos status finalizados)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(200, { id: "ord_1", status: "canceled" })))
    const { carrierConsultarFrete } = await import("./shipping")
    expect(await carrierConsultarFrete("ord_1")).toEqual({ status: "canceled", label: null })
  })

  it("status finalizado mas sem rastreio na resposta: tracking_number fica vazio, NUNCA cai pro id do frete", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(200, { id: "ord_1", status: "released", print: { url: "pdf" } })))
    const { carrierConsultarFrete } = await import("./shipping")
    const r = await carrierConsultarFrete("ord_1")
    expect(r.label?.tracking_number).toBe("")
    expect(r.label?.tracking_url).toBe("")
    expect(r.label?.carrier_order_id).toBe("ord_1")
  })

  it("HTTP 404 (frete não encontrado na SuperFrete): lança erro, NUNCA devolve um resultado 'sem etiqueta'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(404, { message: "order not found" })))
    const { carrierConsultarFrete } = await import("./shipping")
    await expect(carrierConsultarFrete("ord_1")).rejects.toThrow(/SuperFrete \/api\/v0\/order\/info\/ord_1 → HTTP 404/)
  })

  it("sem token, lança CarrierNotConfigured", async () => {
    vi.stubEnv("SUPERFRETE_TOKEN", "")
    const { carrierConsultarFrete } = await import("./shipping")
    await expect(carrierConsultarFrete("ord_1")).rejects.toThrow("SUPERFRETE_TOKEN")
  })

  it("SuperFrete não responde a tempo: mensagem exata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw abortado() }))
    const { carrierConsultarFrete } = await import("./shipping")
    await expect(carrierConsultarFrete("ord_1")).rejects.toThrow(MSG_TIMEOUT)
  })

  it("timeout durante a LEITURA DO CORPO da resposta também vira a mensagem exata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => { throw abortado() },
      json: async () => { throw abortado() },
    })))
    const { carrierConsultarFrete } = await import("./shipping")
    await expect(carrierConsultarFrete("ord_1")).rejects.toThrow(MSG_TIMEOUT)
  })
})
