import {
  citaAMarca, ehVencedor, engajamento, formatoDoPost, proximoNumeroAutomatico, situacaoDaCreator, tituloDoPost, videoDaVenda,
} from "../creator-regras"

describe("creator-regras", () => {
  it("reconhece o post que fala da marca", () => {
    expect(citaAMarca("Treinar é saúde! Com look novo da Éclat fica melhor ainda né", "PATY10")).toBe(true)
    expect(citaAMarca("meu look de hoje @eclat.use 💛", "PATY10")).toBe(true)
    expect(citaAMarca("use o cupom paty10 no site", "PATY10")).toBe(true)
    expect(citaAMarca("conjunto da use.ÉCLAT", "PATY10")).toBe(true)
    expect(citaAMarca("#eclat #treino", "PATY10")).toBe(true)
  })

  it("não confunde com outras palavras nem cadastra post sem legenda", () => {
    expect(citaAMarca("Os cabelos mais pedidos de SETEMBRO!", "PATY10")).toBe(false)
    expect(citaAMarca("que momento ecléticazinho", "PATY10")).toBe(false)
    expect(citaAMarca("vestida de Nabels então, aí é sucesso", "NABELS10")).toBe(false)
    expect(citaAMarca("", "PATY10")).toBe(false)
    expect(citaAMarca(null, "PATY10")).toBe(false)
  })

  it("formato e título do post", () => {
    expect(formatoDoPost({ permalink: "x", timestamp: "t", media_product_type: "REELS" })).toBe("reels")
    expect(formatoDoPost({ permalink: "x", timestamp: "t", media_product_type: "FEED", media_type: "CAROUSEL_ALBUM" })).toBe("post")
    expect(tituloDoPost("Treinar é saúde!\n\nCom look novo")).toBe("Treinar é saúde! Com look novo")
    expect(tituloDoPost("a".repeat(100))).toHaveLength(68)
    expect(tituloDoPost(null)).toBe("Sem legenda")
  })

  it("vídeos da rotina começam em 1001 (1 a 999 são os números do link)", () => {
    expect(proximoNumeroAutomatico([])).toBe(1001)
    expect(proximoNumeroAutomatico([1, 2, 3])).toBe(1001)
    expect(proximoNumeroAutomatico([1, 1001, 1002])).toBe(1003)
  })

  it("venda sem número vai para o último vídeo publicado até 14 dias antes", () => {
    const videos = [
      { id: "antigo", publicado_em: "2026-09-10T12:00:00Z" },
      { id: "setembro", publicado_em: "2026-09-30T12:00:00Z" },
      { id: "outubro", publicado_em: "2026-10-04T12:00:00Z" },
      { id: "sem-data", publicado_em: null },
    ]
    expect(videoDaVenda("2026-10-05T10:00:00Z", videos)).toBe("outubro")
    expect(videoDaVenda("2026-10-02T10:00:00Z", videos)).toBe("setembro") // o de outubro ainda não existia
    expect(videoDaVenda("2026-10-14T12:00:01Z", [videos[1]])).toBeNull() // 14 dias e 1 segundo
    expect(videoDaVenda("2026-10-14T12:00:00Z", [videos[1]])).toBe("setembro") // exatamente 14 dias
    expect(videoDaVenda("2026-09-01T00:00:00Z", videos)).toBeNull()
  })

  it("vencedor: 3 vendas em qualquer período de 14 dias", () => {
    expect(ehVencedor(["2026-10-01T10:00:00Z", "2026-10-05T10:00:00Z", "2026-10-15T10:00:00Z"])).toBe(true) // 14 dias exatos
    expect(ehVencedor(["2026-10-01T10:00:00Z", "2026-10-05T10:00:00Z", "2026-10-15T10:00:01Z"])).toBe(false)
    expect(ehVencedor(["2026-10-01T10:00:00Z", "2026-10-05T10:00:00Z"])).toBe(false)
    // janela móvel: as 3 últimas cabem em 14 dias mesmo com a primeira longe
    expect(ehVencedor(["2026-09-01T10:00:00Z", "2026-10-10T10:00:00Z", "2026-10-12T10:00:00Z", "2026-10-20T10:00:00Z"])).toBe(true)
  })

  it("ativa até 21 dias sem publicar; depois, parada", () => {
    const agora = new Date("2026-10-22T12:00:00Z")
    expect(situacaoDaCreator("2026-10-01T12:00:00Z", agora)).toBe("ativa")
    expect(situacaoDaCreator("2026-10-01T11:59:59Z", agora)).toBe("parada")
    expect(situacaoDaCreator(null, agora)).toBe("parada")
  })

  it("engajamento = (média de curtidas + comentários) ÷ seguidores", () => {
    const posts = [
      { permalink: "a", timestamp: "t", like_count: 94, comments_count: 10 },
      { permalink: "b", timestamp: "t", like_count: 30, comments_count: 6 },
    ]
    expect(engajamento(posts, 52969)).toEqual({ media_curtidas: 62, media_comentarios: 8, engajamento_pct: 0.13 })
    expect(engajamento([], 1000).engajamento_pct).toBe(0)
    expect(engajamento(posts, 0).engajamento_pct).toBeNull()
  })
})
