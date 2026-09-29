import {
  chaveContato, deveMandarEmail, dentroDaJanela, ehPedidoDeParada, inicioDoDiaLocal, linkDaOferta,
  motivoParaEncerrar, normalizarContato, ocasiaoDoCarrinho, ocasiaoDoLeadAnuncio, ocasiaoDoLeadSite,
  primeiroNome, resumoItens, sortearIntervaloMs, tempoDigitandoMs, textoAbordagem, textoOferta,
  type LinhaRecuperacao,
} from "../recuperacao-regras"

const agora = new Date("2026-09-29T15:00:00Z") // 12:00 em Brasília

describe("contato", () => {
  it("normaliza com DDI e recusa o que não é telefone BR", () => {
    expect(normalizarContato("31987439025")).toBe("5531987439025")
    expect(normalizarContato("(31) 98743-9025")).toBe("5531987439025")
    expect(normalizarContato("5531987439025")).toBe("5531987439025")
    expect(normalizarContato("553187439025")).toBe("553187439025")
    expect(normalizarContato("123")).toBeNull()
    expect(normalizarContato(null)).toBeNull()
  })
  it("a chave casa o número do site (com 9) com o JID do WhatsApp (sem 9)", () => {
    expect(chaveContato("31987439025")).toBe("553187439025")
    expect(chaveContato("553187439025")).toBe("553187439025")
  })
})

describe("primeiroNome", () => {
  it("usa o primeiro nome, capitalizado", () => {
    expect(primeiroNome("maria joaquina")).toBe("Maria")
    expect(primeiroNome("ALESSANDRA Cristina")).toBe("Alessandra")
  })
  it("descarta nome genérico, da própria marca ou com símbolos", () => {
    expect(primeiroNome("Visitante do site")).toBeNull()
    expect(primeiroNome("Contato WhatsApp")).toBeNull()
    expect(primeiroNome("Éclat - Moda Fitness")).toBeNull()
    expect(primeiroNome("𝕿𝖆𝖎́𝖘 𝕿𝖊𝖗𝖗𝖊𝖘")).toBeNull()
    expect(primeiroNome("")).toBeNull()
  })
})

describe("pedido de parada", () => {
  it("reconhece os jeitos comuns de pedir para parar", () => {
    for (const t of ["Sair", "pare de me mandar", "não quero", "nao tenho interesse", "STOP", "vou bloquear"]) {
      expect(ehPedidoDeParada(t)).toBe(true)
    }
  })
  it("não confunde resposta normal com parada", () => {
    for (const t of ["Oi, tudo bem!", "quem é?", "quero sim", "pode mandar", "parabéns pela loja"]) {
      expect(ehPedidoDeParada(t)).toBe(false)
    }
  })
})

describe("tempo", () => {
  it("janela 09:00–19:00 no horário de Brasília", () => {
    expect(dentroDaJanela("09:00", "19:00", new Date("2026-09-29T12:00:00Z"))).toBe(true) // 09:00
    expect(dentroDaJanela("09:00", "19:00", new Date("2026-09-29T11:59:00Z"))).toBe(false) // 08:59
    expect(dentroDaJanela("09:00:00", "19:00:00", new Date("2026-09-29T21:59:00Z"))).toBe(true) // 18:59
    expect(dentroDaJanela("09:00", "19:00", new Date("2026-09-29T22:00:00Z"))).toBe(false) // 19:00
  })
  it("início do dia local é meia-noite de Brasília", () => {
    expect(inicioDoDiaLocal(new Date("2026-09-30T02:00:00Z"))).toBe("2026-09-29T03:00:00.000Z") // 23h do dia 29
  })
  it("intervalo sorteado fica entre 15 e 60 minutos", () => {
    expect(sortearIntervaloMs(15, 60, () => 0)).toBe(15 * 60_000)
    expect(sortearIntervaloMs(15, 60, () => 0.999999)).toBeLessThanOrEqual(60 * 60_000)
    expect(sortearIntervaloMs(15, 60, () => 0.5)).toBe(37.5 * 60_000)
  })
  it("digitando entre 3 e ~10 segundos", () => {
    expect(tempoDigitandoMs("oi", () => 0)).toBe(3000)
    expect(tempoDigitandoMs("x".repeat(1000), () => 0)).toBe(9000)
  })
})

describe("textos", () => {
  it("abordagem: nome da persona, sem link, sem cupom, sem preço", () => {
    for (let i = 0; i < 4; i++) {
      const t = textoAbordagem({ persona: "Camila", nome: "Cristina", gatilho: "carrinho" }, () => i / 4)
      expect(t).toContain("Camila")
      expect(t).toContain("ÉCLAT")
      expect(t).not.toMatch(/https?:|BEMVINDA|R\$|%/)
    }
    expect(textoAbordagem({ persona: "Camila", nome: null, gatilho: "lead_site" }, () => 0)).toBe("Oi! Tudo bem? Aqui é a Camila, da ÉCLAT 😊")
  })
  it("abordagem do anúncio retoma a conversa, ainda sem link", () => {
    const t = textoAbordagem({ persona: "Camila", nome: "Braz", gatilho: "anuncio" }, () => 0)
    expect(t).toMatch(/^Oi, Braz!/)
    expect(t).not.toMatch(/https?:/)
  })
  it("oferta do carrinho cita as peças, o cupom e o link da sacola", () => {
    const t = textoOferta({
      gatilho: "carrinho",
      dados: { itens: [{ titulo: "Macaquinho Solaris", variante: "Telha / M", quantidade: 1 }] },
      cupom: "BEMVINDA10",
      link: linkDaOferta("carrinho", "https://www.useeclat.com.br/"),
    })
    expect(t).toContain("Macaquinho Solaris (Telha / M)")
    expect(t).toContain("BEMVINDA10")
    expect(t).toContain("https://www.useeclat.com.br/br/cart")
  })
  it("oferta do Pix fala em gerar Pix novo; lead do site leva à coleção", () => {
    expect(textoOferta({ gatilho: "pix", dados: {}, cupom: "", link: "L" })).toContain("Pix novo")
    expect(linkDaOferta("lead_site", "https://x.com")).toBe("https://x.com/br")
  })
  it("resumo das peças", () => {
    expect(resumoItens([])).toBe("algumas peças")
    expect(resumoItens([{ titulo: "Top", quantidade: 2 }])).toBe("Top e mais 1 peça")
    expect(resumoItens([{ titulo: "Top", quantidade: 1 }, { titulo: "Short", quantidade: 2 }])).toBe("Top e mais 2 peças")
  })
})

describe("ocasiões", () => {
  const carrinho = {
    id: "cart_1",
    email: "Cliente@Gmail.com",
    updated_at: "2026-09-29T13:00:00Z",
    metadata: { whatsapp: "31987439025" },
    shipping_address: null,
    customer: null,
    items: [{ title: "Conjunto Aurora", variant_title: "Grafitti / P", quantity: 1, unit_price: 299 }],
  }
  it("carrinho com contato vira ocasião 1 h depois de parar", () => {
    const oc = ocasiaoDoCarrinho(carrinho, agora)!
    expect(oc.gatilho).toBe("carrinho")
    expect(oc.contato).toBe("5531987439025")
    expect(oc.contato_chave).toBe("553187439025")
    expect(oc.email).toBe("cliente@gmail.com")
    expect(oc.elegivel_em).toBe("2026-09-29T14:00:00.000Z")
    expect(oc.dados.valor).toBe(299)
  })
  it("Pix gerado vira ocasião 30 min depois de expirar", () => {
    const oc = ocasiaoDoCarrinho(
      { ...carrinho, payment_collection: { payment_sessions: [{ data: { metodo: "pix", expira_em: "2026-09-29T13:30:00Z" } }] } },
      agora
    )!
    expect(oc.gatilho).toBe("pix")
    expect(oc.elegivel_em).toBe("2026-09-29T14:00:00.000Z")
  })
  it("sem contato, concluído, vazio ou velho demais não entra", () => {
    expect(ocasiaoDoCarrinho({ ...carrinho, email: null, metadata: {} }, agora)).toBeNull()
    expect(ocasiaoDoCarrinho({ ...carrinho, completed_at: "2026-09-29T13:10:00Z" }, agora)).toBeNull()
    expect(ocasiaoDoCarrinho({ ...carrinho, items: [] }, agora)).toBeNull()
    expect(ocasiaoDoCarrinho({ ...carrinho, updated_at: "2026-09-25T13:00:00Z" }, agora)).toBeNull()
  })
  const lead = { id: "l1", nome: "Visitante do site", whatsapp: "5531987439025", email: null, origem: "site", status: "novo", created_at: "2026-09-29T10:00:00Z" }
  it("lead do site: 2 h depois do aceite, só se ainda está como novo", () => {
    expect(ocasiaoDoLeadSite(lead, agora)!.elegivel_em).toBe("2026-09-29T12:00:00.000Z")
    expect(ocasiaoDoLeadSite({ ...lead, status: "contatado" }, agora)).toBeNull()
    expect(ocasiaoDoLeadSite({ ...lead, origem: "whatsapp" }, agora)).toBeNull()
  })
  it("lead de anúncio: 24 h depois da última mensagem", () => {
    const oc = ocasiaoDoLeadAnuncio({ ...lead, nome: "Braz", origem: "anuncio" }, "2026-09-28T20:00:00Z", agora)!
    expect(oc.gatilho).toBe("anuncio")
    expect(oc.nome).toBe("Braz")
    expect(oc.elegivel_em).toBe("2026-09-29T20:00:00.000Z")
  })
})

describe("decisões da fila", () => {
  const base: LinhaRecuperacao = {
    id: "r1", gatilho: "carrinho", etapa: "aguardando", contato: "5531987439025", email: "a@b.com",
    elegivel_em: "2026-09-29T14:00:00Z", abordagem_em: null, resposta_em: null, email_em: null, criado_em: "2026-09-29T14:00:00Z",
  }
  it("com WhatsApp ligado, o e-mail espera 4 h sem resposta à abordagem", () => {
    expect(deveMandarEmail(base, true, agora)).toBe(false)
    expect(deveMandarEmail({ ...base, etapa: "abordada", abordagem_em: "2026-09-29T12:00:00Z" }, true, agora)).toBe(false)
    expect(deveMandarEmail({ ...base, etapa: "abordada", abordagem_em: "2026-09-29T10:59:00Z" }, true, agora)).toBe(true)
    expect(deveMandarEmail({ ...base, etapa: "abordada", abordagem_em: "2026-09-29T10:00:00Z", resposta_em: "x" }, true, agora)).toBe(false)
  })
  it("sem WhatsApp (ou desligado), o e-mail sai assim que a ocasião fica elegível", () => {
    expect(deveMandarEmail({ ...base, contato: null }, true, agora)).toBe(true)
    expect(deveMandarEmail(base, false, agora)).toBe(true)
    expect(deveMandarEmail({ ...base, elegivel_em: "2026-09-29T16:00:00Z" }, false, agora)).toBe(false)
    expect(deveMandarEmail({ ...base, email_em: "x" }, false, agora)).toBe(false)
    expect(deveMandarEmail({ ...base, gatilho: "anuncio" }, false, agora)).toBe(false)
  })
  it("encerra abordagem sem resposta em 3 dias e ocasião parada há 4 dias", () => {
    expect(motivoParaEncerrar({ ...base, etapa: "abordada", abordagem_em: "2026-09-26T14:00:00Z" }, agora)).toBe("sem_resposta")
    expect(motivoParaEncerrar({ ...base, criado_em: "2026-09-25T14:00:00Z" }, agora)).toBe("expirou")
    expect(motivoParaEncerrar(base, agora)).toBeNull()
  })
})
