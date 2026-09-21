import { createHmac } from "node:crypto"
import { acaoDoEvento, assinaturaSuperfreteValida, numeroDoPedido, rastreioDoEvento } from "../superfrete-webhook"

const SEGREDO = "segredo-de-teste"
const CORPO = JSON.stringify({ event: "order.posted", data: { id: "abc" } })
const hmac = (cod: "hex" | "base64") => createHmac("sha256", SEGREDO).update(CORPO).digest(cod)

describe("assinatura do webhook da SuperFrete", () => {
  it("aceita as formas plausíveis do mesmo HMAC (a doc não diz qual é)", () => {
    for (const header of [hmac("hex"), `sha256=${hmac("hex")}`, hmac("base64"), `sha256=${hmac("base64")}`]) {
      expect(assinaturaSuperfreteValida(CORPO, header, SEGREDO)).toBe(true)
    }
  })

  it("recusa assinatura de outro segredo, corpo alterado e lixo", () => {
    expect(assinaturaSuperfreteValida(CORPO, createHmac("sha256", "outro").update(CORPO).digest("hex"), SEGREDO)).toBe(false)
    expect(assinaturaSuperfreteValida(CORPO + " ", hmac("hex"), SEGREDO)).toBe(false)
    expect(assinaturaSuperfreteValida(CORPO, "nao-e-assinatura", SEGREDO)).toBe(false)
  })

  it("sem segredo, sem header ou sem corpo nunca aceita", () => {
    expect(assinaturaSuperfreteValida(CORPO, hmac("hex"), undefined)).toBe(false)
    expect(assinaturaSuperfreteValida(CORPO, undefined, SEGREDO)).toBe(false)
    expect(assinaturaSuperfreteValida(undefined, hmac("hex"), SEGREDO)).toBe(false)
  })

  it("funciona com o corpo cru em Buffer (é o que a rota recebe)", () => {
    expect(assinaturaSuperfreteValida(Buffer.from(CORPO), hmac("hex"), SEGREDO)).toBe(true)
  })
})

describe("número do pedido nas tags", () => {
  it("lê a primeira tag que é um número", () => {
    expect(numeroDoPedido({ tags: [{ tag: "1042", url: "" }] })).toBe(1042)
    expect(numeroDoPedido({ tags: [{ tag: "eclat" }, { tag: "1042" }] })).toBe(1042)
  })

  it("devolve null quando não dá para saber", () => {
    for (const data of [{}, { tags: [] }, { tags: [{ tag: "" }] }, { tags: [{ tag: "abc" }] }, { tags: [{ tag: "-3" }] }, { tags: "x" }, null]) {
      expect(numeroDoPedido(data)).toBeNull()
    }
  })
})

describe("ação por evento", () => {
  it("postado avisa por WhatsApp e e-mail; entregue só por WhatsApp", () => {
    expect(acaoDoEvento("order.posted")).toEqual({ gravar: true, aviso: "posted", canais: ["whatsapp", "email"] })
    expect(acaoDoEvento("order.delivered")).toEqual({ gravar: true, aviso: "delivered", canais: ["whatsapp"] })
  })

  it("gerada, criada, paga e cancelada só gravam (o despacho da gerada é do remetente único, não da tabela)", () => {
    for (const e of ["order.generated", "order.created", "order.released", "order.cancelled"]) {
      expect(acaoDoEvento(e)).toEqual({ gravar: true, aviso: null, canais: [] })
    }
  })

  it("evento desconhecido não faz nada", () => {
    expect(acaoDoEvento("order.qualquer")).toBeNull()
    expect(acaoDoEvento("")).toBeNull()
  })
})

describe("rastreio do evento", () => {
  it("lê só o código, tolerando ausência — o `tracking_url` do corpo NUNCA é usado (o link é sempre o dos Correios)", () => {
    expect(rastreioDoEvento({ tracking: "AA123BR", tracking_url: "https://x/y" })).toEqual({ tracking: "AA123BR" })
    expect(rastreioDoEvento({})).toEqual({ tracking: "" })
    expect(rastreioDoEvento(null)).toEqual({ tracking: "" })
  })
})
