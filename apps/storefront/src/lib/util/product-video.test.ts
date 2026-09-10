import { describe, expect, it } from "vitest"
import {
  buildGalleryItems,
  parseYoutubeId,
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
  it("com vídeo insere como 2º item (após o hero)", () => {
    const items = buildGalleryItems(imgs, "p5hcJujKDEc")
    expect(items.map((i) => i.kind)).toEqual(["image", "video", "image"])
    expect(items[1]).toEqual({ kind: "video", id: "video-p5hcJujKDEc", youtubeId: "p5hcJujKDEc" })
  })
  it("produto sem fotos: vídeo vira o único item", () => {
    expect(buildGalleryItems([], "p5hcJujKDEc")).toEqual([
      { kind: "video", id: "video-p5hcJujKDEc", youtubeId: "p5hcJujKDEc" },
    ])
  })
})
