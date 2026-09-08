import { describe, expect, it } from "vitest"
import { orderByStyles, STYLE_HANDLES } from "./style-order"

const ITEMS = [{ handle: "tops" }, { handle: "shorts" }, { handle: "leggings" }, { handle: "macaquinhos" }]

describe("orderByStyles", () => {
  it("escolhidos primeiro (na ordem original entre si), o resto depois; nada some", () => {
    expect(orderByStyles(ITEMS, ["macacao", "legging"]).map((i) => i.handle)).toEqual(["leggings", "macaquinhos", "tops", "shorts"])
  })
  it("sem estilos, estilo desconhecido ou lista vazia → ordem original", () => {
    expect(orderByStyles(ITEMS, undefined)).toBe(ITEMS)
    expect(orderByStyles(ITEMS, [])).toBe(ITEMS)
    expect(orderByStyles(ITEMS, ["pilates"])).toBe(ITEMS)
  })
  it("mapa cobre os 5 estilos do wizard", () => {
    expect(Object.keys(STYLE_HANDLES).sort()).toEqual(["conjunto", "legging", "macacao", "short", "top"])
  })
  it("chave herdada do protótipo não é estilo válido (I3)", () => {
    expect(orderByStyles(ITEMS, ["constructor"])).toBe(ITEMS)
  })
})
