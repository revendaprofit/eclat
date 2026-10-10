import { normalizaWhatsapp, textoDespacho, textoEntregue, textoPostado } from "../superfrete-avisos"

// Os textos são conferidos LETRA A LETRA: o de despacho tem de ser idêntico ao que o Cockpit manda
// (apps/cockpit/app/api/orders/[id]/dispatch/route.ts), e os três são os que a Task 2 já mandava.
// Se o dono mudar um texto, este teste muda junto — de propósito, para a mudança ser vista.
describe("textos dos avisos de entrega", () => {
  const base = { nome: "Ana", numero: 21, codigo: "AA123456789BR", link: "https://exemplo.invalid/AA" }

  it("despacho com código e link", () => {
    expect(textoDespacho(base)).toBe(
      "Oi, Ana! 💛\nSeu pedido *#21* da use.ÉCLAT acabou de ser enviado.\n\n📦 Código de rastreio: *AA123456789BR*\nAcompanhe: https://exemplo.invalid/AA\n\nQualquer dúvida, é só chamar por aqui. Obrigada por vestir a sua luz. ✨"
    )
  })

  it("despacho com código e sem link, e sem código", () => {
    expect(textoDespacho({ ...base, link: "" })).toBe(
      "Oi, Ana! 💛\nSeu pedido *#21* da use.ÉCLAT acabou de ser enviado.\n\n📦 Código de rastreio: *AA123456789BR*\n\nQualquer dúvida, é só chamar por aqui. Obrigada por vestir a sua luz. ✨"
    )
    expect(textoDespacho({ ...base, codigo: "", link: "" })).toBe(
      "Oi, Ana! 💛\nSeu pedido *#21* da use.ÉCLAT acabou de ser enviado.\n\nQualquer dúvida, é só chamar por aqui. Obrigada por vestir a sua luz. ✨"
    )
  })

  it("postado", () => {
    expect(textoPostado(base)).toBe(
      "Oi, Ana! 💛\nSeu pedido *#21* da use.ÉCLAT já foi postado e está a caminho.\n\n📦 Código de rastreio: *AA123456789BR*\nAcompanhe: https://exemplo.invalid/AA\n\nQualquer dúvida, é só chamar por aqui. ✨"
    )
  })

  it("entregue: convida para o unboxing, com roteiro, perfil e voucher (não fala de rastreio)", () => {
    expect(textoEntregue(base)).toBe(
      "Oi, Ana! 💛\nSeu pedido *#21* da use.ÉCLAT foi entregue. Esperamos que você ame! ✨\n\nQue tal fazer um unboxing e mostrar pra gente? 🎥 Um roteiro simples:\n1. Abra a caixa mostrando a embalagem e a tag.\n2. Mostre a peça de perto: a frente, as costas, o tecido.\n3. Vista ou treine com ela, do seu jeito.\n4. Poste nos stories marcando *@eclat.use*.\n\nMarcou? Me manda o print aqui que você ganha um *voucher de 10% OFF* para a sua próxima compra. 💛"
    )
    expect(textoEntregue(base)).not.toContain("rastreio")
  })

  it("sem nome, a saudação vira 'tudo bem' (mesma regra do Cockpit)", () => {
    for (const nome of ["", null, undefined]) {
      expect(textoEntregue({ ...base, nome })).toMatch(/^Oi, tudo bem! 💛\n/)
    }
  })
})

describe("normalizaWhatsapp (mesma regra do Cockpit)", () => {
  it("só dígitos, com DDI 55", () => {
    expect(normalizaWhatsapp("(31) 99999-0000")).toBe("5531999990000")
    expect(normalizaWhatsapp("3133330000")).toBe("553133330000")
    expect(normalizaWhatsapp("+55 31 99999-0000")).toBe("5531999990000")
  })

  it("outros tamanhos saem só com os dígitos, sem inventar DDI", () => {
    expect(normalizaWhatsapp("1-234")).toBe("1234")
  })
})
