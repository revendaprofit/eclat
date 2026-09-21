import { pedidoPostado, type DadosPostado } from "../templates/pedido-postado"

const dados: DadosPostado = {
  numero: "42",
  primeiroNome: "Ana",
  codigo: "AA123456789BR",
  link: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
  lojaUrl: "https://www.useeclat.com.br",
  whatsapp: "5500000000000",
}

describe("template pedido-postado", () => {
  it("assunto leva o número do pedido", () => {
    expect(pedidoPostado(dados).subject).toBe("Seu pedido #42 foi postado · use.ÉCLAT")
  })

  it("html e texto trazem nome, número, código e link de acompanhamento", () => {
    const { html, text } = pedidoPostado(dados)
    expect(html).toContain("Ana, seu pedido está a caminho")
    expect(html).toContain("#42")
    expect(html).toContain("AA123456789BR")
    expect(html).toContain('href="https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR"')
    expect(html).toContain("https://wa.me/5500000000000")
    expect(html).toContain("https://www.useeclat.com.br/brand/")
    expect(text).toContain("Pedido #42")
    expect(text).toContain("Código de rastreio: AA123456789BR")
    expect(text).toContain("Acompanhe: https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR")
  })

  it("sem link não há botão de acompanhamento; sem código não há bloco de rastreio", () => {
    const semLink = pedidoPostado({ ...dados, link: null })
    expect(semLink.html).toContain("AA123456789BR")
    expect(semLink.html).not.toContain("Acompanhar entrega")
    expect(semLink.text).not.toContain("Acompanhe:")

    const semCodigo = pedidoPostado({ ...dados, codigo: "", link: "" })
    expect(semCodigo.html).not.toContain("Código de rastreio")
    expect(semCodigo.text).not.toContain("Código de rastreio")
  })

  it("escapa HTML do nome e do código; sem nome o título continua inteiro", () => {
    const { html } = pedidoPostado({ ...dados, primeiroNome: "<script>x</script>", codigo: "A<B" })
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;")
    expect(html).not.toContain("<script>x</script>")
    expect(html).toContain("A&lt;B")
    expect(pedidoPostado({ ...dados, primeiroNome: null }).html).toContain("Seu pedido está a caminho")
  })

  it("link que não é http(s) não vira href (vem de fora: SuperFrete)", () => {
    const { html } = pedidoPostado({ ...dados, link: "javascript:alert(1)" })
    expect(html).not.toContain("javascript:")
  })
})
