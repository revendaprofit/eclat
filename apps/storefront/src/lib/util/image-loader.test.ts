import { describe, expect, it } from "vitest"
import loader from "./image-loader"

const S = "https://abc123.supabase.co/storage/v1/object/public/site/products/meia/cinza-01.jpg"

describe("eclatImageLoader", () => {
  it("imagem do Supabase vai para o render do próprio Supabase, na largura pedida e sem cortar", () => {
    expect(loader({ src: S, width: 828, quality: 80 })).toBe(
      "https://abc123.supabase.co/storage/v1/render/image/public/site/products/meia/cinza-01.jpg?width=828&quality=80&resize=contain"
    )
  })
  it("sem quality usa 75 e descarta query antiga da URL", () => {
    expect(loader({ src: S + "?v=2", width: 256 })).toBe(
      "https://abc123.supabase.co/storage/v1/render/image/public/site/products/meia/cinza-01.jpg?width=256&quality=75&resize=contain"
    )
  })
  it("outras origens passam direto (arquivo local, YouTube, host parecido que não é o Supabase)", () => {
    expect(loader({ src: "/brand/logo.png", width: 256 })).toBe("/brand/logo.png")
    expect(loader({ src: "https://img.youtube.com/vi/abc/hqdefault.jpg", width: 640 })).toBe("https://img.youtube.com/vi/abc/hqdefault.jpg")
    const falso = "https://evil.example/storage/v1/object/public/site/x.jpg"
    expect(loader({ src: falso, width: 640 })).toBe(falso)
  })
})
