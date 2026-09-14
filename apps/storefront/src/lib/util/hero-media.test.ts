import { describe, expect, it } from "vitest"
import { HERO_TEXTOS_PADRAO, heroInterativo, heroTelas, heroTextos } from "./hero-media"

describe("heroInterativo", () => {
  const peca = { nome: "Orvalho", cor: "Grafitti", cor_hex: "#3A363A", video_url: "o.mp4", poster_url: "o.jpg" }
  it("desligado (ou sem a chave): null — o celular segue com vídeo/imagem", () => {
    expect(heroInterativo({ interativo_pecas: [peca] })).toBeNull()
    expect(heroInterativo({ interativo_mobile: false, interativo_pecas: [peca] })).toBeNull()
  })
  it("ligado sem nenhuma peça válida: null (não mostra palco vazio)", () => {
    expect(heroInterativo({ interativo_mobile: true })).toBeNull()
    expect(heroInterativo({ interativo_mobile: true, interativo_pecas: [{ ...peca, video_url: " " }] })).toBeNull()
  })
  it("ligado: descarta peça sem vídeo/capa/nome, limpa espaços e mantém a ordem do Cockpit", () => {
    const r = heroInterativo({
      interativo_mobile: true,
      interativo_ceu_url: " ceu.jpg ",
      interativo_pecas: [
        { ...peca, nome: " Solaris ", cor: "Telha", cor_hex: "", video_url: "s.mp4", poster_url: "s.jpg" },
        { ...peca, poster_url: "" },
        { ...peca, nome: "" },
        peca,
      ],
    })
    expect(r).toEqual({
      ceu: "ceu.jpg",
      pecas: [
        { id: "solaris-telha", nome: "Solaris", cor: "Telha", corHex: null, video: "s.mp4", poster: "s.jpg" },
        { id: "orvalho-grafitti", nome: "Orvalho", cor: "Grafitti", corHex: "#3A363A", video: "o.mp4", poster: "o.jpg" },
      ],
    })
  })
  it("lista que não é array e céu ausente não quebram", () => {
    expect(heroInterativo({ interativo_mobile: true, interativo_pecas: "x" as unknown as [] })).toBeNull()
    expect(heroInterativo({ interativo_mobile: true, interativo_pecas: [peca] })?.ceu).toBeNull()
  })
})

describe("heroTelas", () => {
  it("sem vídeo: imagens do modo antigo (mobile cai no desktop e vice-versa)", () => {
    expect(heroTelas({ banner_mobile_url: "m.jpg", banner_desktop_url: "d.jpg" })).toEqual({
      mobile: { tipo: "imagem", src: "m.jpg" },
      desktop: { tipo: "imagem", src: "d.jpg" },
    })
    expect(heroTelas({ banner_desktop_url: "d.jpg" }).mobile).toEqual({ tipo: "imagem", src: "d.jpg" })
    expect(heroTelas({ image_url: "legado.jpg" }).desktop).toEqual({ tipo: "imagem", src: "legado.jpg" })
  })
  it("vídeo só no desktop: desktop vídeo, mobile continua com a imagem", () => {
    const t = heroTelas({ banner_mobile_url: "m.jpg", banner_desktop_url: "d.jpg", video_desktop_url: "d.mp4", video_poster_desktop_url: "d-capa.jpg" })
    expect(t.desktop).toEqual({ tipo: "video", video: "d.mp4", poster: "d-capa.jpg" })
    expect(t.mobile).toEqual({ tipo: "imagem", src: "m.jpg" })
  })
  it("vídeo nas duas telas; capa ausente vira null; espaços são ignorados", () => {
    const t = heroTelas({ video_mobile_url: " m.mp4 ", video_desktop_url: "d.mp4", video_poster_desktop_url: "  " })
    expect(t.mobile).toEqual({ tipo: "video", video: "m.mp4", poster: null })
    expect(t.desktop).toEqual({ tipo: "video", video: "d.mp4", poster: null })
  })
  it("nada cadastrado: nenhum", () => {
    expect(heroTelas({})).toEqual({ mobile: { tipo: "nenhum" }, desktop: { tipo: "nenhum" } })
  })
})

describe("heroTextos", () => {
  it("usa os textos da arte quando o Cockpit não tem os campos", () => {
    expect(heroTextos({})).toEqual(HERO_TEXTOS_PADRAO)
  })
  it("campo preenchido vence; vazio cai no padrão", () => {
    const t = heroTextos({ video_titulo_1: "Nova linha", video_cta: "  " })
    expect(t.titulo1).toBe("Nova linha")
    expect(t.cta).toBe(HERO_TEXTOS_PADRAO.cta)
  })
})
