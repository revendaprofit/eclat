import { describe, expect, it } from "vitest"
import { fotosInstagram, limparHandle, linkPerfilInstagram } from "./instagram"

describe("instagram", () => {
  it("limpa o @ e recusa handle inválido", () => {
    expect(limparHandle("@eclat.use")).toBe("eclat.use")
    expect(limparHandle(" eclat.use ")).toBe("eclat.use")
    expect(limparHandle("javascript:alert(1)")).toBe("")
    expect(linkPerfilInstagram("@eclat.use")).toBe("https://www.instagram.com/eclat.use/")
    expect(linkPerfilInstagram("")).toBe("")
  })

  it("filtra fotos, limita a 6 e manda link de fora do Instagram para o perfil", () => {
    const foto = (n: number, href?: string) => ({ image_url: `https://x.supabase.co/f${n}.jpg`, href })
    const r = fotosInstagram({
      handle: "eclat.use",
      items: [
        foto(1, "https://www.instagram.com/p/abc/"),
        foto(2, "https://golpe.com/"),
        { image_url: "http://inseguro.jpg" },
        foto(3), foto(4), foto(5), foto(6), foto(7),
      ],
    })
    expect(r).toHaveLength(6)
    expect(r[0].href).toBe("https://www.instagram.com/p/abc/")
    expect(r[1].href).toBe("https://www.instagram.com/eclat.use/")
    expect(r.map((f) => f.image_url)).not.toContain("http://inseguro.jpg")
  })

  it("sem conteúdo, lista vazia", () => {
    expect(fotosInstagram(null)).toEqual([])
  })
})
