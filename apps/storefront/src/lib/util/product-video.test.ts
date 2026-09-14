import { describe, expect, it } from "vitest"
import {
  buildGalleryItems,
  parseProductVideos,
  parseYoutubeId,
  resolveVideoSource,
  videoForColor,
  youtubeEmbedUrl,
  youtubeThumbUrl,
} from "./product-video"

describe("parseYoutubeId", () => {
  it("aceita o ID puro de 11 caracteres", () => {
    expect(parseYoutubeId("p5hcJujKDEc")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("  p5hcJujKDEc  ")).toBe("p5hcJujKDEc")
  })
  it("extrai de URLs comuns do YouTube", () => {
    expect(parseYoutubeId("https://www.youtube.com/watch?v=p5hcJujKDEc&t=10s")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://youtu.be/p5hcJujKDEc")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://youtube.com/shorts/p5hcJujKDEc?feature=share")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://www.youtube-nocookie.com/embed/p5hcJujKDEc")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://m.youtube.com/watch?v=p5hcJujKDEc")).toBe("p5hcJujKDEc")
  })
  it("rejeita lixo, vazio e outros domínios", () => {
    expect(parseYoutubeId("")).toBeNull()
    expect(parseYoutubeId(null)).toBeNull()
    expect(parseYoutubeId(42)).toBeNull()
    expect(parseYoutubeId("abc")).toBeNull()
    expect(parseYoutubeId("https://vimeo.com/123456")).toBeNull()
    expect(parseYoutubeId("https://www.youtube.com/watch?v=curto")).toBeNull()
  })
})

describe("URLs", () => {
  it("thumb e embed usam o ID", () => {
    expect(youtubeThumbUrl("p5hcJujKDEc")).toBe("https://img.youtube.com/vi/p5hcJujKDEc/hqdefault.jpg")
    const embed = youtubeEmbedUrl("p5hcJujKDEc")
    expect(embed.startsWith("https://www.youtube-nocookie.com/embed/p5hcJujKDEc?")).toBe(true)
    expect(embed).toContain("autoplay=1")
    expect(embed).toContain("mute=1")
    expect(embed).toContain("loop=1")
    expect(embed).toContain("playlist=p5hcJujKDEc")
    expect(embed).toContain("controls=0")
    expect(embed).toContain("playsinline=1")
  })
})

const YT = { kind: "youtube" as const, id: "p5hcJujKDEc" }
const MP4 = { kind: "mp4" as const, src: "https://s/x/orvalho-telha.mp4", poster: "https://s/x/orvalho-telha.jpg" }

describe("buildGalleryItems", () => {
  const imgs = [
    { id: "a", url: "https://x/a.jpg" },
    { id: "b", url: "https://x/b.jpg" },
    { id: "c", url: null },
  ]
  it("sem vídeo devolve só as imagens com url", () => {
    expect(buildGalleryItems(imgs, null)).toEqual([
      { kind: "image", id: "a", url: "https://x/a.jpg" },
      { kind: "image", id: "b", url: "https://x/b.jpg" },
    ])
  })
  it("com vídeo do YouTube insere como 2º item (após o hero)", () => {
    const items = buildGalleryItems(imgs, YT)
    expect(items.map((i) => i.kind)).toEqual(["image", "video", "image"])
    expect(items[1]).toEqual({ kind: "video", id: "video-p5hcJujKDEc", source: YT })
  })
  it("com MP4 o id do slide vem do arquivo (troca de cor = slide novo)", () => {
    const items = buildGalleryItems(imgs, MP4)
    expect(items[1]).toEqual({ kind: "video", id: "video-https://s/x/orvalho-telha.mp4", source: MP4 })
  })
  it("produto sem fotos: vídeo vira o único item", () => {
    expect(buildGalleryItems([], YT)).toEqual([{ kind: "video", id: "video-p5hcJujKDEc", source: YT }])
  })
})

// metadata.videos (Cockpit → Ficha técnica): JSON cor → URL do MP4, ou cor → {src, poster}.
// Vídeos das peças já vivem em site/hero/giro/ (banner interativo) — a PDP reaproveita.
describe("parseProductVideos", () => {
  it("aceita JSON em string (como o Cockpit salva) com url simples ou {src, poster}", () => {
    const meta = {
      videos: JSON.stringify({
        Telha: "https://s/x/orvalho-telha.mp4",
        Grafitti: { src: "https://s/x/orvalho-grafitti.mp4", poster: "https://s/x/orvalho-grafitti.jpg" },
      }),
    }
    expect(parseProductVideos(meta)).toEqual({
      telha: { src: "https://s/x/orvalho-telha.mp4", poster: null },
      grafitti: { src: "https://s/x/orvalho-grafitti.mp4", poster: "https://s/x/orvalho-grafitti.jpg" },
    })
  })
  it("aceita objeto já parseado e normaliza a cor (acento, caixa, espaços)", () => {
    expect(parseProductVideos({ videos: { " Café  Escuro ": "https://s/c.mp4" } })).toEqual({
      "cafe escuro": { src: "https://s/c.mp4", poster: null },
    })
  })
  it("descarta entradas sem src http(s), JSON inválido e metadata ausente", () => {
    expect(parseProductVideos({ videos: '{"Telha": ' })).toEqual({})
    expect(parseProductVideos({ videos: { Telha: "", Grafitti: { poster: "x" }, Rosa: "ftp://a" } })).toEqual({})
    expect(parseProductVideos(null)).toEqual({})
    expect(parseProductVideos({})).toEqual({})
  })
})

describe("videoForColor", () => {
  const videos = parseProductVideos({
    videos: { Telha: "https://s/t.mp4", Grafitti: { src: "https://s/g.mp4", poster: "https://s/g.jpg" } },
  })
  it("casa a cor escolhida ignorando acento e caixa", () => {
    expect(videoForColor(videos, "grafitti")?.src).toBe("https://s/g.mp4")
    expect(videoForColor(videos, "TELHA")?.src).toBe("https://s/t.mp4")
  })
  it("cor escolhida sem vídeo → null (não mostra vídeo de outra cor)", () => {
    expect(videoForColor(videos, "Rosa")).toBeNull()
  })
  it("sem cor escolhida → primeiro vídeo cadastrado", () => {
    expect(videoForColor(videos, null)?.src).toBe("https://s/t.mp4")
    expect(videoForColor({}, null)).toBeNull()
  })
})

describe("resolveVideoSource", () => {
  const videos = parseProductVideos({ videos: { Telha: "https://s/t.mp4" } })
  it("MP4 da cor tem prioridade sobre o YouTube", () => {
    expect(resolveVideoSource(videos, "p5hcJujKDEc", "Telha")).toEqual({ kind: "mp4", src: "https://s/t.mp4", poster: null })
  })
  it("sem MP4 para a cor cai no YouTube; sem nada → null", () => {
    expect(resolveVideoSource(videos, "p5hcJujKDEc", "Rosa")).toEqual(YT)
    expect(resolveVideoSource({}, null, null)).toBeNull()
  })
})
