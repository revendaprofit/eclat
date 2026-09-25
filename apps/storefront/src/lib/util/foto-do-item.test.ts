import { describe, expect, it } from "vitest"
import { fotoDoItem } from "./foto-do-item"

describe("fotoDoItem", () => {
  it("usa a foto da variante (cor escolhida), não a capa do produto", () => {
    expect(
      fotoDoItem({
        thumbnail: "telha-01.jpg",
        variant: { images: [{ url: "grafitti-02.jpg", rank: 1 }, { url: "grafitti-01.jpg", rank: 0 }] },
      })
    ).toBe("grafitti-01.jpg")
  })
  it("sem foto na variante, cai na capa", () => {
    expect(fotoDoItem({ thumbnail: "capa.jpg", variant: { images: [] } })).toBe("capa.jpg")
    expect(fotoDoItem({ thumbnail: null })).toBeNull()
  })
})
