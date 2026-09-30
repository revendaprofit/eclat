import { describe, expect, it } from "vitest"
import { adicionarDepoimento, chaveContato, primeiroNome, resumirAvaliacoes, validarConfigAvaliacao, type LinhaAvaliacao } from "./avaliacao"

describe("validarConfigAvaliacao", () => {
  it("aceita interruptor, dias e textos; recusa link e valores fora da faixa", () => {
    expect(validarConfigAvaliacao({ ativo: true, dias_apos_entrega: 3, texto_pedido: " Oi {nome}! " })).toEqual({
      campos: { ativo: true, dias_apos_entrega: 3, texto_pedido: "Oi {nome}!" },
    })
    expect(validarConfigAvaliacao({ texto_pedido: "" })).toEqual({ campos: { texto_pedido: null } })
    expect(validarConfigAvaliacao({ texto_pedido: "veja em https://x.com" })).toHaveProperty("erro")
    expect(validarConfigAvaliacao({ dias_apos_entrega: 90 })).toHaveProperty("erro")
    expect(validarConfigAvaliacao({ ativo: "sim" })).toHaveProperty("erro")
  })
})

describe("adicionarDepoimento", () => {
  const atual = { heading: "O que elas dizem", items: [{ quote: "Amei viu! Super aprovado!", author: "Pollianna", origem: "Instagram" }] }
  it("entra no começo, com a fala exata e origem WhatsApp", () => {
    const r = adicionarDepoimento(atual, { fala: "Não subiu nem no agachamento!!", nome: "Maria" })
    expect(r).toEqual({
      heading: "O que elas dizem",
      items: [{ quote: "Não subiu nem no agachamento!!", author: "Maria", origem: "WhatsApp" }, atual.items[0]],
    })
  })
  it("não duplica, não publica sem fala nem sem nome", () => {
    expect(adicionarDepoimento(atual, { fala: "Amei viu! Super aprovado!", nome: "P" })).toHaveProperty("erro")
    expect(adicionarDepoimento(atual, { fala: "  ", nome: "Maria" })).toHaveProperty("erro")
    expect(adicionarDepoimento(atual, { fala: "Lindo", nome: null })).toHaveProperty("erro")
    expect(adicionarDepoimento(null, { fala: "Lindo", nome: "Ana" })).toEqual({ heading: "O que elas dizem", items: [{ quote: "Lindo", author: "Ana", origem: "WhatsApp" }] })
  })
})

describe("contato e nome", () => {
  it("mesma chave do backend (sem o nono dígito) e primeiro nome apresentável", () => {
    expect(chaveContato("(31) 98765-4321")).toBe("553187654321")
    expect(chaveContato("553187654321")).toBe("553187654321")
    expect(primeiroNome("maria clara")).toBe("Maria")
    expect(primeiroNome("Contato WhatsApp")).toBeNull()
    expect(primeiroNome("Éclat - Moda")).toBeNull()
  })
})

describe("resumirAvaliacoes", () => {
  it("conta as etapas", () => {
    const l = (x: Partial<LinhaAvaliacao>) => ({ etapa: "agendada", pedido_em: null, resposta_em: null, autorizou_em: null, ...x }) as LinhaAvaliacao
    const r = resumirAvaliacoes(
      [l({}), l({ etapa: "pedida", pedido_em: "2026-10-10T13:00:00Z" }), l({ etapa: "publicada", pedido_em: "2026-10-01T13:00:00Z", resposta_em: "x", autorizou_em: "y" })],
      "2026-10-10T03:00:00Z"
    )
    expect(r).toEqual({ agendadas: 1, pedidas_hoje: 1, pedidas: 2, responderam: 1, autorizaram: 1, no_site: 1 })
  })
})
