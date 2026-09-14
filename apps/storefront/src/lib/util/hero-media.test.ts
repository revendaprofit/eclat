import { describe, expect, it } from "vitest"
import { HERO_TEXTOS_PADRAO, heroTelas, heroTextos } from "./hero-media"

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
