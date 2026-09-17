import { montarItensDoPedido } from "../fiscal-pedido"
import { ErroFiscal } from "../tipos"

// Pedido "feliz": 2 itens, endereço completo, CPF e IBGE presentes. Cada teste clona e
// sobrescreve só o que precisa, para não vazar mutação entre casos.
function pedidoBase(): Record<string, any> {
  return {
    id: "order_1",
    email: "cliente@example.com",
    currency_code: "brl",
    shipping_total: 15,
    items: [
      {
        id: "li_a",
        title: "Top Aura",
        variant_title: "P",
        quantity: 1,
        unit_price: 100,
        discount_total: 0,
        item_total: 100,
        variant_sku: "TOP-AURA-P",
        variant_id: "variant_a",
        product_id: "prod_a",
        variant: { hs_code: "61091000", origin_country: "BR" },
        product: { categories: [{ handle: "tops" }] },
      },
      {
        id: "li_b",
        title: "Legging Vertice",
        variant_title: "M",
        quantity: 2,
        unit_price: 50,
        discount_total: 10,
        item_total: 90,
        variant_sku: "LEG-VERTICE-M",
        variant_id: "variant_b",
        product_id: "prod_b",
        variant: { hs_code: "61046200", origin_country: "CN" },
        product: { categories: [{ handle: "leggings" }] },
      },
    ],
    shipping_address: {
      first_name: "Maria",
      last_name: "Silva",
      address_1: "Rua A",
      address_2: null,
      city: "Belo Horizonte",
      province: "MG",
      postal_code: "30110-000",
      metadata: { cpf: "12345678909", municipio_ibge: "3106200", numero: "10", bairro: "Centro" },
    },
    billing_address: { metadata: {} },
    metadata: {},
  }
}

function scopeCom(order: Record<string, any> | null) {
  const graph = jest.fn().mockResolvedValue({ data: order ? [order] : [] })
  const scope = { resolve: () => ({ graph }) } as any
  return { scope, graph }
}

describe("montarItensDoPedido", () => {
  it("mapeia 2 itens com NCM, origem, SKU, quantidade e valores corretos", async () => {
    const { scope } = scopeCom(pedidoBase())
    const { itens } = await montarItensDoPedido(scope, "order_1")

    expect(itens).toHaveLength(2)

    expect(itens[0]).toMatchObject({
      line_item_id: "li_a",
      sku: "TOP-AURA-P",
      ncm: "61091000",
      origem: 0,
      quantidade: 1,
      valor_unitario_centavos: 10000,
      desconto_centavos: 0,
    })

    expect(itens[1]).toMatchObject({
      line_item_id: "li_b",
      sku: "LEG-VERTICE-M",
      ncm: "61046200",
      origem: 1, // origin_country "CN" -> importação
      quantidade: 2,
      valor_unitario_centavos: 5000,
      desconto_centavos: 1000,
    })
  })

  it("calcula desconto_centavos a partir de discount_total e passa a conferência do item", async () => {
    const pedido = pedidoBase()
    // item_total já reflete o desconto (90 = 50*2 - 10) — não deve lançar ErroFiscal.
    const { scope } = scopeCom(pedido)
    const { itens } = await montarItensDoPedido(scope, "order_1")
    expect(itens[1].desconto_centavos).toBe(1000)
  })

  it("lança ErroFiscal quando o bruto menos o desconto não bate com item_total", async () => {
    const pedido = pedidoBase()
    // Adultera o item_total do Medusa para não bater com bruto - desconto (10000 - 0 = 10000).
    pedido.items[0].item_total = 99
    const { scope } = scopeCom(pedido)

    await expect(montarItensDoPedido(scope, "order_1")).rejects.toThrow(ErroFiscal)
    await expect(montarItensDoPedido(scope, "order_1")).rejects.toThrow(/Top Aura/)
  })

  it("falha com mensagem legível quando o pedido não tem CPF em lugar nenhum", async () => {
    const pedido = pedidoBase()
    pedido.shipping_address.metadata = { municipio_ibge: "3106200", numero: "10", bairro: "Centro" }
    pedido.billing_address = { metadata: {} }
    pedido.metadata = {}
    const { scope } = scopeCom(pedido)

    await expect(montarItensDoPedido(scope, "order_1")).rejects.toThrow(/CPF/)
  })

  it("normaliza CPF formatado (pontos e traço) para 11 dígitos", async () => {
    const pedido = pedidoBase()
    pedido.shipping_address.metadata.cpf = "123.456.789-09"
    const { scope } = scopeCom(pedido)

    const { destinatario } = await montarItensDoPedido(scope, "order_1")
    expect(destinatario.cpf).toBe("12345678909")
  })

  it("falha com mensagem legível quando o código IBGE do município não tem 7 dígitos", async () => {
    const pedido = pedidoBase()
    pedido.shipping_address.metadata.municipio_ibge = "31062" // só 5 dígitos
    const { scope } = scopeCom(pedido)

    await expect(montarItensDoPedido(scope, "order_1")).rejects.toThrow(/código IBGE/i)
  })

  it("falha quando o pedido não tem endereço de entrega", async () => {
    const pedido = pedidoBase()
    pedido.shipping_address = null
    const { scope } = scopeCom(pedido)

    await expect(montarItensDoPedido(scope, "order_1")).rejects.toThrow(ErroFiscal)
    await expect(montarItensDoPedido(scope, "order_1")).rejects.toThrow(/endereço de entrega/i)
  })

  it("falha quando o pedido não é encontrado", async () => {
    const { scope } = scopeCom(null)
    await expect(montarItensDoPedido(scope, "order_x")).rejects.toThrow(/não encontrado/i)
  })

  it("converte shipping_total (decimal) para frete_centavos (inteiro)", async () => {
    const pedido = pedidoBase()
    pedido.shipping_total = 19.9
    const { scope } = scopeCom(pedido)

    const { frete_centavos } = await montarItensDoPedido(scope, "order_1")
    expect(frete_centavos).toBe(1990)
  })
})
