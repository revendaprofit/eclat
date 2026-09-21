import { describe, expect, it } from "vitest"
import loader, { urlDaImagem } from "./image-loader"

const BASE = "https://abc123.supabase.co/storage/v1/object/public/site/"
const PRODUTO = BASE + "products/camiseta-raglan-dry/telha-01-7342967b.jpg"
const COCKPIT = BASE + "1789346520235-gu34au.jpg"

describe("modo direto (padrão, custo zero)", () => {
  it("foto de produto com hash usa a menor variante pronta que cobre a largura", () => {
    expect(urlDaImagem({ src: PRODUTO, width: 384 }, "direto")).toBe(PRODUTO.replace(".jpg", ".w480.jpg"))
    expect(urlDaImagem({ src: PRODUTO, width: 480 }, "direto")).toBe(PRODUTO.replace(".jpg", ".w480.jpg"))
    expect(urlDaImagem({ src: PRODUTO, width: 828 }, "direto")).toBe(PRODUTO.replace(".jpg", ".w960.jpg"))
  })
  it("acima da maior variante sai o original", () => {
    expect(urlDaImagem({ src: PRODUTO, width: 1200 }, "direto")).toBe(PRODUTO)
  })
  it("imagem sem variante garantida (upload do Cockpit, banner, categoria) sai no original, sem query", () => {
    expect(urlDaImagem({ src: COCKPIT + "?v=2", width: 640 }, "direto")).toBe(COCKPIT)
    expect(urlDaImagem({ src: BASE + "banners/conjuntos/editorial-conjuntos-duplo-7fab6443.jpg", width: 640 }, "direto")).toBe(
      BASE + "banners/conjuntos/editorial-conjuntos-duplo-7fab6443.jpg"
    )
    expect(urlDaImagem({ src: BASE + "products/meia/foto-sem-hash.jpg", width: 640 }, "direto")).toBe(BASE + "products/meia/foto-sem-hash.jpg")
  })
  it("o loader exportado usa o modo direto quando a variável não está definida", () => {
    expect(loader({ src: PRODUTO, width: 640, quality: 80 })).toBe(PRODUTO.replace(".jpg", ".w960.jpg"))
  })
})

describe("modo supabase (redimensionamento pago do Supabase)", () => {
  it("vai para o render do Supabase, na largura pedida e sem cortar", () => {
    expect(urlDaImagem({ src: PRODUTO, width: 828, quality: 80 }, "supabase")).toBe(
      "https://abc123.supabase.co/storage/v1/render/image/public/site/products/camiseta-raglan-dry/telha-01-7342967b.jpg?width=828&quality=80&resize=contain"
    )
  })
  it("sem quality usa 75 e descarta query antiga da URL", () => {
    expect(urlDaImagem({ src: COCKPIT + "?v=2", width: 256 }, "supabase")).toBe(
      "https://abc123.supabase.co/storage/v1/render/image/public/site/1789346520235-gu34au.jpg?width=256&quality=75&resize=contain"
    )
  })
})

describe("outras origens", () => {
  it("passam direto nos dois modos (arquivo local, YouTube, host parecido que não é o Supabase)", () => {
    const falso = "https://evil.example/storage/v1/object/public/site/products/x/a-01-7342967b.jpg"
    for (const modo of ["direto", "supabase"] as const) {
      expect(urlDaImagem({ src: "/brand/logo.png", width: 256 }, modo)).toBe("/brand/logo.png")
      expect(urlDaImagem({ src: "https://img.youtube.com/vi/abc/hqdefault.jpg", width: 640 }, modo)).toBe("https://img.youtube.com/vi/abc/hqdefault.jpg")
      expect(urlDaImagem({ src: falso, width: 640 }, modo)).toBe(falso)
    }
  })
})
