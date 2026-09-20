import { describe, expect, it } from "vitest"
import { dadosDoPagador } from "./pagamento-dados"

const carrinho = {
  email: "cliente@exemplo.com",
  shipping_address: {
    first_name: "Camila",
    last_name: "Nogueira",
    phone: "31991032698",
    address_1: "Rua Norte",
    address_2: "Casa",
    city: "Betim",
    province: "MG",
    postal_code: "32604182",
    metadata: { numero: "180", bairro: "Centro" },
  },
  items: [
    { title: "Macaquinho Solaris", quantity: 2, unit_price: 259, variant_sku: "ECL-MS-TEL-M", variant_title: "M / Telha" },
  ],
} as never

describe("dadosDoPagador", () => {
  it("monta sobrenome, telefone, endereço e itens a partir do carrinho", () => {
    expect(dadosDoPagador(carrinho)).toEqual({
      sobrenome: "Nogueira",
      telefone: "31991032698",
      endereco: {
        rua: "Rua Norte",
        numero: "180",
        complemento: "Casa",
        bairro: "Centro",
        cidade: "Betim",
        estado: "MG",
        cep: "32604182",
      },
      itens: [
        { titulo: "Macaquinho Solaris", quantidade: 2, preco_unitario: 259, sku: "ECL-MS-TEL-M", descricao: "M / Telha" },
      ],
    })
  })

  it("carrinho sem endereço nem itens: não inventa campo nenhum", () => {
    expect(dadosDoPagador({} as never)).toEqual({})
  })

  it("usa o endereço de cobrança quando não há o de entrega", () => {
    const so_cobranca = { billing_address: { address_1: "Av. Central", city: "Betim", postal_code: "32604182" } } as never
    expect(dadosDoPagador(so_cobranca).endereco).toEqual({ rua: "Av. Central", cidade: "Betim", cep: "32604182" })
  })

  it("item sem preço ou sem título fica de fora", () => {
    const c = { items: [{ title: "", quantity: 1, unit_price: 10 }, { title: "Top", quantity: 1 }] } as never
    expect(dadosDoPagador(c).itens).toBeUndefined()
  })
})
