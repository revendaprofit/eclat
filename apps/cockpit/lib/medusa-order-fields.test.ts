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
