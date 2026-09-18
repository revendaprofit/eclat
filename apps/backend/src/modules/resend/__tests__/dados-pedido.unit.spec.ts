import { montarDadosPedido, brl } from "../dados-pedido"

const pedido = {
  id: "order_01",
  display_id: 42,
  email: "cliente@exemplo.com",
  currency_code: "brl",
  created_at: "2026-09-18T23:10:00.000Z",
  item_subtotal: 318,
  shipping_total: { numeric: 24.9 },
  discount_total: 19,
  total: { value: "323.9", precision: 20 },
  shipping_address: {
    first_name: "Ana",
    last_name: "Souza",
    address_1: "Rua Norte, 180",
    address_2: "Apto 2 · Angola",
    city: "Betim",
    province: "MG",
    postal_code: "32604182",
  },
  items: [
    { title: "Top Aurora", variant_title: "P / Telha", quantity: 2, unit_price: 159, thumbnail: "https://x/y.jpg" },
  ],
}

describe("brl", () => {
  it("formata em reais com vírgula", () => {
    expect(brl(159)).toBe("R$ 159,00")
    expect(brl(24.9)).toBe("R$ 24,90")
    expect(brl(1234.5)).toBe("R$ 1.234,50")
  })
})

describe("montarDadosPedido", () => {
  it("monta os dados do e-mail a partir do pedido do Medusa, aceitando BigNumber", () => {
    const d = montarDadosPedido(pedido, { lojaUrl: "https://www.useeclat.com.br" })
    expect(d.numero).toBe("42")
    expect(d.primeiroNome).toBe("Ana")
    expect(d.itens).toEqual([
      { nome: "Top Aurora", variante: "P / Telha", quantidade: 2, total: "R$ 318,00", foto: "https://x/y.jpg" },
    ])
    expect(d.subtotal).toBe("R$ 318,00")
    expect(d.frete).toBe("R$ 24,90")
    expect(d.desconto).toBe("R$ 19,00")
    expect(d.total).toBe("R$ 323,90")
    expect(d.endereco).toEqual(["Ana Souza", "Rua Norte, 180", "Apto 2 · Angola", "Betim - MG", "CEP 32604-182"])
    expect(d.lojaUrl).toBe("https://www.useeclat.com.br")
    expect(d.pedidoUrl).toBe("https://www.useeclat.com.br/br/order/order_01/confirmed")
  })

  it("sem desconto não devolve a linha de desconto; frete zero vira Grátis", () => {
    const d = montarDadosPedido({ ...pedido, discount_total: 0, shipping_total: 0 }, { lojaUrl: "https://l" })
    expect(d.desconto).toBeNull()
    expect(d.frete).toBe("Grátis")
  })

  it("carrega a frase de pré-venda quando ela está ativa", () => {
    const ativa = montarDadosPedido(pedido, {
      lojaUrl: "https://l",
      prevenda: { ativa: true, envios_a_partir: "2026-10-10" },
    })
    expect(ativa.avisoEnvio).toBe("Pré-venda: os envios começam em 10/10.")
    const inativa = montarDadosPedido(pedido, {
      lojaUrl: "https://l",
      prevenda: { ativa: false, envios_a_partir: "2026-10-10" },
    })
    expect(inativa.avisoEnvio).toBeNull()
  })

  it("sem endereço cai para um cumprimento neutro", () => {
    const d = montarDadosPedido({ ...pedido, shipping_address: null }, { lojaUrl: "https://l" })
    expect(d.primeiroNome).toBeNull()
    expect(d.endereco).toEqual([])
  })
})
