import { ATRASO_APOS_DESPACHO_MS, candidatoAoConvite, estaNoGrupo, JANELA_APOS_DESPACHO_MS, reservarConvite, textoConviteClube } from "../convite-clube"

const AGORA = Date.parse("2026-10-08T15:00:00Z")
const despachado = (haMs: number) => new Date(AGORA - haMs).toISOString()
const base = {
  id: "order_28",
  display_id: 28,
  created_at: "2026-10-07T12:00:00Z",
  status: "completed",
  email: "alana@exemplo.com",
  metadata: {},
  shipping_address: { first_name: "Alana", phone: "(31) 99078-1500" },
  fulfillments: [{ shipped_at: despachado(20 * 60_000), delivered_at: null, canceled_at: null }],
}

describe("candidatoAoConvite", () => {
  it("pedido despachado há mais de 10 min e menos de 24 h, com telefone, entra", () => {
    expect(candidatoAoConvite(base, AGORA)).toEqual({ order_id: "order_28", display_id: 28, telefone: "5531990781500", nome: "Alana" })
  })
  it("espera o rastreio chegar primeiro (10 min) e não convida despacho velho (24 h)", () => {
    expect(candidatoAoConvite({ ...base, fulfillments: [{ shipped_at: despachado(ATRASO_APOS_DESPACHO_MS - 1) }] }, AGORA)).toEqual({ fora: "cedo" })
    expect(candidatoAoConvite({ ...base, fulfillments: [{ shipped_at: despachado(JANELA_APOS_DESPACHO_MS + 1) }] }, AGORA)).toEqual({ fora: "antigo" })
  })
  it("fica de fora: cancelado, teste da equipe, já tratado, não despachado, sem telefone", () => {
    expect(candidatoAoConvite({ ...base, status: "canceled" }, AGORA)).toEqual({ fora: "cancelado" })
    expect(candidatoAoConvite({ ...base, email: "teste@eclat.local" }, AGORA)).toEqual({ fora: "teste" })
    expect(candidatoAoConvite({ ...base, metadata: { clube_convite: { status: "enviado" } } }, AGORA)).toEqual({ fora: "ja_tratado" })
    expect(candidatoAoConvite({ ...base, fulfillments: [] }, AGORA)).toEqual({ fora: "nao_despachado" })
    expect(candidatoAoConvite({ ...base, shipping_address: { first_name: "Alana", phone: "" } }, AGORA)).toEqual({ fora: "sem_telefone" })
  })
  it("envio cancelado não conta como despacho", () => {
    expect(candidatoAoConvite({ ...base, fulfillments: [{ shipped_at: despachado(60 * 60_000), canceled_at: despachado(30 * 60_000) }] }, AGORA)).toEqual({ fora: "nao_despachado" })
  })
})

describe("estaNoGrupo", () => {
  const grupo = ["553190781500@s.whatsapp.net", "5511988887777@s.whatsapp.net"]
  it("acha o telefone mesmo quando o JID do grupo vem sem o 9", () => {
    expect(estaNoGrupo(grupo, "5531990781500")).toBe(true)
    expect(estaNoGrupo(grupo, "(11) 98888-7777")).toBe(true)
  })
  it("quem não está no grupo recebe o convite", () => {
    expect(estaNoGrupo(grupo, "5521977776666")).toBe(false)
    expect(estaNoGrupo([], "5531990781500")).toBe(false)
    expect(estaNoGrupo(grupo, null)).toBe(false)
  })
})

describe("textoConviteClube", () => {
  it("convida para participar das decisões, com o link, e sem cupom", () => {
    const t = textoConviteClube("Alana", "https://chat.whatsapp.com/abc")
    expect(t).toMatch(/^Oi, Alana! 💛\n/)
    expect(t).toContain("*Clube Éclat*")
    expect(t).toContain("próximas coleções")
    expect(t).toContain("https://chat.whatsapp.com/abc")
    expect(t).not.toMatch(/cupom|CLUBE10|10%/i)
    expect(textoConviteClube(null)).toMatch(/^Oi, tudo bem! 💛\n/)
  })
})

describe("reservarConvite", () => {
  it("é um UPDATE condicional: só grava se ainda não há marca, e diz se gravou", async () => {
    const chamadas: { sql: string; bindings: unknown[] }[] = []
    const pg = { raw: async (sql: string, bindings: readonly unknown[] = []) => { chamadas.push({ sql, bindings: [...bindings] }); return { rows: [{ id: "order_28" }] } } }
    expect(await reservarConvite(pg, "order_28", { status: "enviando" })).toBe(true)
    expect(chamadas[0].sql).toContain("(metadata->'clube_convite') IS NULL")
    expect(chamadas[0].sql).toContain("RETURNING id")
    expect(chamadas[0].bindings).toEqual([JSON.stringify({ status: "enviando" }), "order_28"])
    const pgOcupado = { raw: async () => ({ rows: [] }) }
    expect(await reservarConvite(pgOcupado, "order_28", { status: "enviando" })).toBe(false)
  })
})
