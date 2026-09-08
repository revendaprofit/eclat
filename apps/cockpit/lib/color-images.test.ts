import { describe, expect, it } from "vitest"
import { groupImagesByColor } from "./color-images"

const P = {
  thumbnail: "u1",
  images: [{ id: "i1", url: "u1" }, { id: "i2", url: "u2" }, { id: "i3", url: "u3" }, { id: "i4", url: "u4" }],
  options: [{ id: "o_t", title: "Tamanho" }, { id: "o_c", title: "Cor" }],
  variants: [
    { id: "vP", options: [{ option_id: "o_t", value: "P" }, { option_id: "o_c", value: "Licor" }], images: [{ id: "i1" }, { id: "i3" }] },
    { id: "vM", options: [{ option_id: "o_t", value: "M" }, { option_id: "o_c", value: "Licor" }], images: [{ id: "i1" }] },
    { id: "vVP", options: [{ option_id: "o_t", value: "P" }, { option_id: "o_c", value: "Verde" }], images: [{ id: "i2" }] },
  ],
}

describe("groupImagesByColor", () => {
  const g = groupImagesByColor(P)
  it("uma entrada por cor, na ordem de aparição, com as variantes da cor", () => {
    expect(g.groups.map((x) => x.color)).toEqual(["Licor", "Verde"])
    expect(g.groups[0].variant_ids).toEqual(["vP", "vM"])
  })
  it("imagem só entra na cor se está em TODAS as variantes da cor", () => {
    expect(g.groups[0].images.map((i) => i.id)).toEqual(["i1"]) // i3 só em vP
    expect(g.groups[1].images.map((i) => i.id)).toEqual(["i2"])
  })
  it("imagens sem cor completa ficam em unassigned (ordem do produto)", () => {
    expect(g.unassigned.map((i) => i.id)).toEqual(["i3", "i4"])
  })
  it("produto sem opção Cor: tudo unassigned, sem grupos", () => {
    const r = groupImagesByColor({ ...P, options: [{ id: "o_t", title: "Tamanho" }] })
    expect(r.groups).toEqual([])
    expect(r.unassigned.length).toBe(4)
  })
  it("repassa a capa", () => {
    expect(g.thumbnail).toBe("u1")
  })
})
