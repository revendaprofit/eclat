import { describe, expect, it } from "vitest"
import {
  montarPainel, proximoNumeroAutomatico, resumoSemanal, situacaoDaCreator, validarEdicaoVideo, validarNovoVideo,
  type AvisoLinha, type VideoLinha,
} from "./creators"

const agora = new Date("2026-10-12T15:00:00Z")
const creators = [
  { id: "c-paty", instagram: "patysilveriostudio", nome: "Paty", status: "aprovada", parceria_codigo: "PATY10", aprovada_em: "2026-09-25T00:00:00Z" },
  { id: "c-nabels", instagram: "na.bels", nome: "Nabels", status: "aprovada", parceria_codigo: "NABELS10", aprovada_em: "2026-10-01T00:00:00Z" },
  { id: "c-x", instagram: "outra", nome: "Outra", status: "abordada", parceria_codigo: null, aprovada_em: null },
]
const parcerias = [
  { codigo: "PATY10", nome: "Paty", apelido_link: "paty", comissao_percentual: 5, ativa: true },
  { codigo: "NABELS10", nome: "Nabels", apelido_link: "nabels", comissao_percentual: 5, ativa: true },
]
const video = (id: string, numero: number, publicado_em: string | null, extra: Partial<VideoLinha> = {}): VideoLinha => ({
  id, creator_id: "c-paty", numero, formato: "reels", titulo: `Vídeo ${numero}`, link_post: `https://www.instagram.com/reel/${id}/`,
  publicado_em, vencedor_em: null, em_anuncio: false, ...extra,
})
const videos = [video("v1", 1001, "2026-09-25T12:00:00Z"), video("v2", 1002, "2026-10-08T12:00:00Z"), video("v3", 2, null, { link_post: null, titulo: null })]
const aviso = (order_id: string, entrega_id: string | null, pedido_em: string, codigo = "PATY10"): AvisoLinha => ({
  order_id, codigo, entrega_id, pedido_em, base_centavos: 23310, comissao_centavos: 1166, status: "enviado",
})
const avisos = [
  aviso("o1", "v2", "2026-10-09T10:00:00Z"),
  aviso("o2", "v2", "2026-10-10T10:00:00Z"),
  aviso("o3", "v2", "2026-10-11T10:00:00Z"),
  aviso("o4", "v3", "2026-10-11T12:00:00Z"),
  aviso("o5", null, "2026-09-20T12:00:00Z"),
  aviso("o-cancelado", "v2", "2026-10-11T13:00:00Z"),
]
const cancelados = new Set(["o-cancelado"])
const leituras = [
  { creator_id: "c-paty", seguidores: 52000, engajamento_pct: 0.3, lido_em: "2026-10-11T10:00:00Z" },
  { creator_id: "c-paty", seguidores: 52967, engajamento_pct: 0.36, lido_em: "2026-10-12T10:00:00Z" },
]
const painel = () => montarPainel({ creators, parcerias, videos, avisos, leituras, cancelados, agora, lojaUrl: "https://www.useeclat.com.br/" })

describe("painel dos creators", () => {
  it("só creators aprovadas, quem vendeu mais primeiro", () => {
    expect(painel().map((c) => c.instagram)).toEqual(["patysilveriostudio", "na.bels"])
  })

  it("conta só pedido não cancelado e mostra o que falta para a 2ª peça", () => {
    const paty = painel()[0]
    expect(paty.vendas_que_contam).toBe(5)
    expect(paty.falta_para_segunda_peca).toBe(0)
    expect(paty.comissao_centavos).toBe(5 * 1166)
    expect(painel()[1]).toMatchObject({ vendas_que_contam: 0, falta_para_segunda_peca: 5, situacao: "parada", videos: [] })
  })

  it("vendas por vídeo, origem e link numerado", () => {
    const [v2, v1, v3] = painel()[0].videos // mais recente primeiro; sem data por último
    expect([v2.id, v2.vendas, v2.origem, v2.link_da_loja]).toEqual(["v2", 3, "perfil", null])
    expect([v1.id, v1.vendas]).toEqual(["v1", 0])
    expect([v3.id, v3.vendas, v3.origem, v3.link_da_loja]).toEqual(["v3", 1, "link", "https://www.useeclat.com.br/p/paty/2"])
  })

  it("usa a leitura mais recente do perfil e a data do último vídeo", () => {
    const paty = painel()[0]
    expect([paty.seguidores, paty.engajamento_pct]).toEqual([52967, 0.36])
    expect(paty.ultimo_video_em).toBe("2026-10-08T12:00:00Z")
    expect(paty.situacao).toBe("ativa")
    expect(paty.link).toBe("https://www.useeclat.com.br/p/paty")
  })

  it("parada depois de 21 dias sem publicar", () => {
    expect(situacaoDaCreator("2026-09-21T15:00:00Z", agora)).toBe("ativa")
    expect(situacaoDaCreator("2026-09-21T14:59:59Z", agora)).toBe("parada")
    expect(situacaoDaCreator(null, agora)).toBe("parada")
  })
})

describe("resumo semanal", () => {
  it("lista os vídeos que venderam na semana, os novos e o briefing — sem cliente nem valores", () => {
    const p = painel()
    p[0].videos.find((v) => v.id === "v2")!.vencedor_em = "2026-10-11T10:00:00Z"
    const t = resumoSemanal(p, avisos, cancelados, agora, "Mostrar o silicone do short no agachamento.")
    expect(t).toContain("*Creators ÉCLAT · semana de 05/10 a 12/10* ✨")
    expect(t).toContain("• Paty — Vídeo 1002 — 3 vendas\n  https://www.instagram.com/reel/v2/")
    expect(t).toContain("• Paty — Vídeo nº 2 — 1 venda")
    expect(t).toContain("*Vídeo vencedor (3 vendas em 14 dias)* 🏆")
    expect(t).toContain("*Vídeos novos da semana*")
    expect(t).toContain("*Ideias para a próxima semana*\nMostrar o silicone do short no agachamento.")
    expect(t).not.toMatch(/R\$|@eclat\.local|233/)
    expect(t).not.toContain("Vídeo 1001") // de setembro, sem venda na semana
  })

  it("semana sem venda", () => {
    expect(resumoSemanal(painel(), [], new Set(), agora)).toContain("Nenhuma venda por vídeo nesta semana")
  })
})

describe("edição e cadastro de vídeo", () => {
  it("valida a edição", () => {
    expect(validarEdicaoVideo({ titulo: "  Reels do   Solaris ", em_anuncio: true })).toEqual({ ok: true, valor: { titulo: "Reels do Solaris", em_anuncio: true } })
    expect(validarEdicaoVideo({ link_post: "https://golpe.com/x" })).toMatchObject({ ok: false })
    expect(validarEdicaoVideo({ link_post: "https://www.instagram.com/reel/abc/?igsh=1" })).toEqual({ ok: true, valor: { link_post: "https://www.instagram.com/reel/abc/" } })
    expect(validarEdicaoVideo({})).toMatchObject({ ok: false })
  })

  it("valida o cadastro manual e numera a partir de 1001", () => {
    const ok = validarNovoVideo({ creator_id: "11111111-1111-1111-1111-111111111111", link_post: "https://www.instagram.com/p/xyz/", publicado_em: "2026-10-05", titulo: "" })
    expect(ok).toMatchObject({ ok: true, valor: { formato: "reels", titulo: null, link_post: "https://www.instagram.com/p/xyz/" } })
    expect(validarNovoVideo({ creator_id: "x", link_post: "https://www.instagram.com/p/xyz/", publicado_em: "2026-10-05" })).toMatchObject({ ok: false })
    expect(validarNovoVideo({ creator_id: "11111111-1111-1111-1111-111111111111", link_post: "", publicado_em: "2026-10-05" })).toMatchObject({ ok: false })
    expect(proximoNumeroAutomatico([1, 2, 1001])).toBe(1002)
    expect(proximoNumeroAutomatico([])).toBe(1001)
  })
})
