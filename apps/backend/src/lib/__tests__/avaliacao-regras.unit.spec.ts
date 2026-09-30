import {
  candidataDoPedido, classificarAutorizacao, dataDeDespacho, dataDeEntrega, descreverPecas, elegivelEm,
  motivoParaEncerrar, textoAutorizacao, textoPedido, type PedidoBruto,
} from "../avaliacao-regras"

const cfg = { dias_apos_entrega: 3, dias_apos_despacho: 10, marco_zero: "2026-09-30T00:00:00Z" }
const base: PedidoBruto = {
  id: "order_1",
  display_id: 30,
  created_at: "2026-10-01T12:00:00Z",
  status: "pending",
  email: "maria@exemplo.com",
  metadata: {},
  shipping_address: { first_name: "maria clara", phone: "(31) 98765-4321" },
  items: [{ product_title: "Top Aurora" }, { product_title: "Short Aurora" }],
  fulfillments: [{ shipped_at: "2026-10-02T15:00:00Z" }],
}

describe("datas de entrega e despacho", () => {
  it("entrega vem do evento do webhook da SuperFrete; sem ele, do fulfillment marcado como entregue", () => {
    const comWebhook = { ...base, metadata: { frete: { eventos: { "order.delivered": "2026-10-06T10:00:00Z" } } } }
    expect(dataDeEntrega(comWebhook)).toBe(Date.parse("2026-10-06T10:00:00Z"))
    const marcado = { ...base, fulfillments: [{ shipped_at: "2026-10-02T15:00:00Z", delivered_at: "2026-10-07T09:00:00Z" }] }
    expect(dataDeEntrega(marcado)).toBe(Date.parse("2026-10-07T09:00:00Z"))
    expect(dataDeEntrega(base)).toBeNull()
    expect(dataDeDespacho(base)).toBe(Date.parse("2026-10-02T15:00:00Z"))
  })
  it("3 dias depois de entregue; sem entrega, 10 dias depois do despacho; sem despacho, nada", () => {
    const entregue = { ...base, metadata: { frete: { eventos: { "order.delivered": "2026-10-06T10:00:00Z" } } } }
    expect(new Date(elegivelEm(entregue, cfg)!).toISOString()).toBe("2026-10-09T10:00:00.000Z")
    expect(new Date(elegivelEm(base, cfg)!).toISOString()).toBe("2026-10-12T15:00:00.000Z")
    expect(elegivelEm({ ...base, fulfillments: [] }, cfg)).toBeNull()
    expect(elegivelEm({ ...base, fulfillments: [{ shipped_at: "2026-10-02T15:00:00Z", canceled_at: "2026-10-02T16:00:00Z" }] }, cfg)).toBeNull()
  })
})

describe("candidataDoPedido", () => {
  it("monta a candidata com primeiro nome, WhatsApp e peças", () => {
    expect(candidataDoPedido(base, cfg)).toEqual({
      order_id: "order_1", display_id: 30, contato: "5531987654321", contato_chave: "553187654321",
      nome: "Maria", pecas: "o Conjunto Aurora", elegivel_em: "2026-10-12T15:00:00.000Z",
    })
  })
  it("fica de fora: cancelado, teste, antes do marco zero, sem despacho, sem telefone", () => {
    expect(candidataDoPedido({ ...base, status: "canceled" }, cfg)).toEqual({ fora: "cancelado" })
    expect(candidataDoPedido({ ...base, email: "x@eclat.local" }, cfg)).toEqual({ fora: "teste" })
    expect(candidataDoPedido({ ...base, created_at: "2026-09-20T12:00:00Z" }, cfg)).toEqual({ fora: "antes_do_marco_zero" })
    expect(candidataDoPedido({ ...base, fulfillments: [] }, cfg)).toEqual({ fora: "nao_despachado" })
    expect(candidataDoPedido({ ...base, shipping_address: { first_name: "Ana", phone: null } }, cfg)).toEqual({ fora: "sem_telefone" })
  })
})

describe("descreverPecas", () => {
  it("conjunto, peça única, duas peças, várias", () => {
    expect(descreverPecas([{ product_title: "Top Orvalho" }, { product_title: "Short Orvalho" }])).toBe("o Conjunto Orvalho")
    expect(descreverPecas([{ product_title: "Macaquinho Solaris" }])).toBe("o Macaquinho Solaris")
    expect(descreverPecas([{ product_title: "Top Aurora" }, { product_title: "Short Orvalho" }])).toBe("o Top Aurora e o Short Orvalho")
    expect(descreverPecas([{ title: "A" }, { title: "B" }, { title: "C" }])).toBe("as peças")
    expect(descreverPecas([])).toBe("as peças")
  })
})

describe("textos", () => {
  it("pedido sem link, com nome, peça e persona; modelo do Cockpit substitui as variações", () => {
    const t = textoPedido({ persona: "Camila", nome: "Maria", pecas: "o Conjunto Aurora" }, () => 0)
    expect(t).toContain("Oi, Maria!")
    expect(t).toContain("Camila, da ÉCLAT")
    expect(t).toContain("o Conjunto Aurora")
    expect(t).not.toMatch(/https?:|www\./)
    expect(textoPedido({ persona: "Camila", nome: null, pecas: "o Top Aurora", modelo: "Oi {nome}, {persona} aqui. E {pecas}?" })).toBe(
      "Oi, Camila aqui. E o Top Aurora?"
    )
    expect(textoAutorizacao({}, () => 0)).toMatch(/primeiro nome/)
  })
})

describe("classificarAutorizacao", () => {
  it("sim, não e ambígua", () => {
    for (const s of ["Sim!", "pode sim", "Claro 😍", "pode colocar", "ok", "Com certeza", "👍"]) expect(classificarAutorizacao(s)).toBe("sim")
    for (const n of ["não", "Prefiro não", "melhor não, obrigada", "nao quero"]) expect(classificarAutorizacao(n)).toBe("nao")
    for (const a of ["depende do que vai aparecer", "hmm", ""]) expect(classificarAutorizacao(a)).toBe("ambigua")
    expect(classificarAutorizacao("claro que sim, não tem problema")).toBe("sim")
  })
})

describe("motivoParaEncerrar", () => {
  const agora = new Date("2026-10-20T12:00:00Z")
  it("agendada 7 dias vencida, pedida 5 dias sem resposta, autorização 5 dias sem sim", () => {
    expect(motivoParaEncerrar({ etapa: "agendada", elegivel_em: "2026-10-10T00:00:00Z", pedido_em: null, autorizacao_em: null }, agora)).toBe("expirou")
    expect(motivoParaEncerrar({ etapa: "pedida", elegivel_em: "2026-10-10T00:00:00Z", pedido_em: "2026-10-14T00:00:00Z", autorizacao_em: null }, agora)).toBe("sem_resposta")
    expect(motivoParaEncerrar({ etapa: "autorizacao_pedida", elegivel_em: "x", pedido_em: "x", autorizacao_em: "2026-10-14T00:00:00Z" }, agora)).toBe("nao_autorizou")
    expect(motivoParaEncerrar({ etapa: "pedida", elegivel_em: "x", pedido_em: "2026-10-18T00:00:00Z", autorizacao_em: null }, agora)).toBeNull()
  })
})
