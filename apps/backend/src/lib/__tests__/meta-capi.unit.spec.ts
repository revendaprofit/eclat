import crypto from "crypto"
import { montarEventoDeCompra, telefoneParaMeta } from "../meta-capi"

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

const PEDIDO = {
  id: "order_1",
  email: " Cliente@Exemplo.com ",
  total: 313.9,
  currency_code: "brl",
  metadata: { cpf: "x", meta_fbp: "fb.1.1.2", meta_fbc: "fb.1.1.abc", meta_ua: "Mozilla/5.0" },
  items: [
    { id: "it_1", variant_id: "variant_top", product_id: "prod_top", quantity: 1, unit_price: 159 },
    { id: "it_2", variant_id: "variant_short", product_id: "prod_short", quantity: 2, unit_price: 159 },
  ],
  shipping_address: { phone: "(31) 99999-0000", first_name: "Ána", last_name: "Souza", city: "Belo Horizonte", postal_code: "30130-000" },
}

describe("telefoneParaMeta", () => {
  it("põe o 55 em número brasileiro sem DDI e deixa o que já tem", () => {
    expect(telefoneParaMeta("(31) 99999-0000")).toBe("5531999990000")
    expect(telefoneParaMeta("+55 31 99999-0000")).toBe("5531999990000")
    expect(telefoneParaMeta("123")).toBeUndefined()
  })
})

describe("montarEventoDeCompra", () => {
  const ev = montarEventoDeCompra(PEDIDO, "https://loja.exemplo", 1_700_000_000_000)

  it("usa o mesmo event_id da vitrine (deduplicação) e o id da variante (= g:id do feed)", () => {
    expect(ev.event_id).toBe("purchase_order_1")
    expect(ev.custom_data.content_ids).toEqual(["variant_top", "variant_short"])
    expect(ev.custom_data.contents[1]).toEqual({ id: "variant_short", quantity: 2, item_price: 159 })
    expect(ev.custom_data.value).toBe(313.9)
    expect(ev.custom_data.currency).toBe("BRL")
    expect(ev.event_time).toBe(1_700_000_000)
  })

  it("dados pessoais só saem em hash, normalizados", () => {
    expect(ev.user_data.em).toEqual([sha("cliente@exemplo.com")])
    expect(ev.user_data.ph).toEqual([sha("5531999990000")])
    expect(ev.user_data.fn).toEqual([sha("ana")])
    expect(ev.user_data.ct).toEqual([sha("belohorizonte")])
    expect(ev.user_data.zp).toEqual([sha("30130000")])
    expect(JSON.stringify(ev)).not.toContain("exemplo.com")
  })

  it("com os sinais do navegador vai como website; sem eles, como gerado pelo sistema", () => {
    expect(ev.action_source).toBe("website")
    expect(ev.user_data.fbp).toBe("fb.1.1.2")
    expect(ev.event_source_url).toBe("https://loja.exemplo/")
    const semSinais = montarEventoDeCompra({ ...PEDIDO, metadata: { cpf: "x" } }, "https://loja.exemplo", 1)
    expect(semSinais.action_source).toBe("system_generated")
    expect(semSinais.user_data.fbp).toBeUndefined()
    expect("event_source_url" in semSinais).toBe(false)
  })
})
