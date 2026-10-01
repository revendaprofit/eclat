import { recuperacao, type DadosRecuperacaoEmail } from "../templates/recuperacao"

const base: DadosRecuperacaoEmail = {
  gatilho: "carrinho",
  primeiroNome: "Cristina",
  itens: "o Macaquinho Solaris (Telha / M)",
  cupom: "BEMVINDA10",
  link: "https://www.useeclat.com.br/br/cart",
  lojaUrl: "https://www.useeclat.com.br",
  whatsapp: "5531991184431",
}

describe("e-mail de recuperação", () => {
  it("carrinho: cita as peças, o cupom e leva à sacola", () => {
    const e = recuperacao(base)
    expect(e.subject).toContain("sacola")
    expect(e.html).toContain("Cristina, suas peças continuam separadas")
    expect(e.html).toContain("Macaquinho Solaris")
    expect(e.html).toContain("BEMVINDA10")
    expect(e.html).toContain('href="https://www.useeclat.com.br/br/cart"')
    expect(e.text).toContain("Voltar para a sacola: https://www.useeclat.com.br/br/cart")
  })
  it("Pix e lead do site têm assunto próprio", () => {
    expect(recuperacao({ ...base, gatilho: "pix" }).subject).toContain("Pix expirou")
    expect(recuperacao({ ...base, gatilho: "lead_site" }).subject).toContain("BEMVINDA10")
  })
  it("escapa HTML vindo de dados e recusa link que não é http(s)", () => {
    const e = recuperacao({ ...base, primeiroNome: "<b>X</b>", link: "javascript:alert(1)" })
    expect(e.html).not.toContain("<b>X</b>")
    expect(e.html).not.toContain("javascript:")
  })
  it("sem nome e sem cupom continua legível", () => {
    const e = recuperacao({ ...base, primeiroNome: null, cupom: null })
    expect(e.html).toContain("Suas peças continuam separadas")
    expect(e.html).not.toContain("cupom")
  })
  it("com o presente ligado: fala da meia e não cita cupom nem 10% (carrinho e lead do site)", () => {
    const presente = "Nas compras a partir de R$ 250 em peças, você ganha uma meia Éclat de presente."
    const carrinho = recuperacao({ ...base, presente })
    expect(carrinho.html).toContain("meia Éclat de presente")
    expect(carrinho.html).not.toContain("BEMVINDA10")
    const lead = recuperacao({ ...base, gatilho: "lead_site", presente })
    expect(lead.subject).toContain("presente")
    expect(lead.html).toContain("meia Éclat de presente")
    expect(lead.html + lead.text + lead.subject).not.toMatch(/10%|BEMVINDA/)
  })
})
