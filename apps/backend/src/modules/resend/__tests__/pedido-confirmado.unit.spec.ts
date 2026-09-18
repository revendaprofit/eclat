import { pedidoConfirmado } from "../templates/pedido-confirmado"
import type { DadosPedido } from "../dados-pedido"

const dados: DadosPedido = {
  numero: "42",
  primeiroNome: "Ana",
  itens: [{ nome: "Top <Aurora>", variante: "P / Telha", quantidade: 2, total: "R$ 318,00", foto: "https://x/y.jpg" }],
  subtotal: "R$ 318,00",
  frete: "R$ 24,90",
  desconto: "R$ 19,00",
  total: "R$ 323,90",
  endereco: ["Ana Souza", "Rua Norte, 180", "Betim - MG", "CEP 32604-182"],
  avisoEnvio: "Pré-venda: os envios começam em 10/10.",
  lojaUrl: "https://www.useeclat.com.br",
  pedidoUrl: "https://www.useeclat.com.br/br/order/order_01/confirmed",
  whatsapp: "5531991184431",
}

describe("template pedido-confirmado", () => {
  it("assunto leva o número do pedido", () => {
    expect(pedidoConfirmado(dados).subject).toBe("Pedido #42 confirmado · use.ÉCLAT")
  })

  it("html traz itens, totais, endereço e aviso de envio, com HTML escapado", () => {
    const { html } = pedidoConfirmado(dados)
    expect(html).toContain("Ana, seu pedido está confirmado")
    expect(html).toContain("Top &lt;Aurora&gt;")
    expect(html).not.toContain("Top <Aurora>")
    for (const t of [
      "P / Telha",
      "R$ 318,00",
      "R$ 24,90",
      "R$ 19,00",
      "R$ 323,90",
      "Rua Norte, 180",
      "os envios começam em 10/10",
    ]) {
      expect(html).toContain(t)
    }
    expect(html).toContain("https://wa.me/5531991184431")
    expect(html).toContain("https://www.useeclat.com.br/brand/")
    expect(html).toContain('href="https://www.useeclat.com.br/br/order/order_01/confirmed"')
  })

  it("sem desconto, sem aviso e sem nome o e-mail continua inteiro", () => {
    const { html, text } = pedidoConfirmado({ ...dados, desconto: null, avisoEnvio: null, primeiroNome: null })
    expect(html).toContain("Seu pedido está confirmado")
    expect(html).not.toContain("Desconto")
    expect(html).not.toContain("Pré-venda")
    expect(text).toContain("Pedido #42")
    expect(text).toContain("Total: R$ 323,90")
  })
})
