import { describe, it, expect } from "vitest"
import { ORDER_DETAIL_FIELDS } from "./medusa"

// Trava de regressão (achado da revisão final): medusaGetOrder busca o pedido com uma
// lista explícita de `fields`, e lerDadosFiscais (dados-fiscais.ts) lê
// shipping_address.metadata.{numero,bairro,municipio_ibge} e
// shipping_address/billing_address.metadata.cpf. Se um desses caminhos sair do
// `fields`, o pedido volta sem o dado, e a tela de dados fiscais mente que falta tudo
// mesmo num pedido completo — sem o tsc ter como pegar, porque a prop era `unknown`.
//
// Cada caminho que lerDadosFiscais lê tem que estar em ORDER_DETAIL_FIELDS.
const CAMINHOS_LIDOS_POR_LER_DADOS_FISCAIS = [
  "metadata",
  "shipping_address.metadata",
  "billing_address.metadata",
]

describe("ORDER_DETAIL_FIELDS cobre o que lerDadosFiscais lê", () => {
  const pedidos = ORDER_DETAIL_FIELDS.split(",")

  it.each(CAMINHOS_LIDOS_POR_LER_DADOS_FISCAIS)("inclui %s", (caminho) => {
    expect(pedidos).toContain(caminho)
  })
})

// Parte 4: o bloco "Pagamento" da gaveta e a linha de taxas do DRE leem payment.data
// (lib/pagamento.ts). Sem esses caminhos no `fields`, o Medusa devolve o pedido sem pagamentos
// e a tela some com o bloco em silêncio.
describe("campos de pagamento (Parte 4)", () => {
  it.each(["payment_collections.payments.provider_id", "payment_collections.payments.data", "payment_collections.payments.canceled_at"])(
    "ORDER_DETAIL_FIELDS inclui %s",
    (caminho) => {
      expect(ORDER_DETAIL_FIELDS.split(",")).toContain(caminho)
    }
  )
})

// Etiqueta SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4.8): o serviço e o pacote cotados
// vivem em shipping_methods.data. Sem esse caminho no `fields`, toda etiqueta sairia como PAC com o
// pacote da tabela — e custaria diferente do frete cobrado, em silêncio.
//
// `shipping_methods.amount` é o valor gravado do frete. Pedir a relação SEM ele faz o Medusa
// 2.15.5 calcular o frete como zero — e o zero contamina o pedido inteiro: em 20/09 o pedido #21
// aparecia na gaveta com "SEDEX · R$ 0,00" e total R$ 299,00, quando a cliente pagou R$ 313,90
// (frete R$ 14,90). Conferido contra a produção: com `amount` no fields, total e frete voltam
// certos; sem ele, `shipping_methods.total` e `shipping_total` vêm 0.
describe("campos da etiqueta (frete)", () => {
  it.each(["shipping_methods.data", "shipping_methods.amount", "shipping_address.address_2"])(
    "ORDER_DETAIL_FIELDS inclui %s",
    (caminho) => {
      expect(ORDER_DETAIL_FIELDS.split(",")).toContain(caminho)
    }
  )
})
