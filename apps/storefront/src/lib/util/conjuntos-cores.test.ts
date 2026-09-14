import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import { coresComunsDisponiveis, hrefConjunto, montarCardCurado, montarCardsCuradoPorCor, precoMinDisponivel, type CuradoStore } from "./conjuntos"

const opts = (cores: string[]) => [
  { id: "o_t", title: "Tamanho", values: [{ value: "P" }, { value: "M" }] },
  { id: "o_c", title: "Cor", values: cores.map((value) => ({ value })) },
]
const v = (id: string, tam: string, cor: string, qty: number, preco: number, fotos: string[] = []) => ({
  id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty,
  options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
  images: fotos.map((url, i) => ({ id: `${id}-${i}`, url })),
  calculated_price: { calculated_amount: preco },
})
const prod = (id: string, cores: string[], variants: ReturnType<typeof v>[]) =>
  ({ id, handle: id, title: id, thumbnail: `${id}-capa.jpg`, images: [{ id: `${id}-i`, url: `${id}-capa.jpg` }], options: opts(cores), variants }) as unknown as HttpTypes.StoreProduct

const TOP = prod("top", ["Telha", "Grafitti"], [
  v("t1", "P", "Telha", 2, 169, ["top-telha.jpg"]),
  v("t2", "P", "Grafitti", 3, 159, ["top-grafitti.jpg"]),
])
const SHORT = prod("short", ["Grafitti", "telha"], [
  v("s1", "P", "Grafitti", 1, 169, ["short-grafitti.jpg"]),
  v("s2", "M", "telha", 4, 179, ["short-telha.jpg"]),
])
const SHORT_SEM_TELHA = prod("short2", ["Grafitti", "Telha"], [v("x1", "P", "Grafitti", 1, 169), v("x2", "P", "Telha", 0, 169)])

const CURADO: CuradoStore = {
  id: "ccur_1", nome: "Aurora", handle: "conjunto-aurora", capa_url: "capa.jpg",
  product_ids: ["top", "short"], regra: { tipo_desconto: "total_percentual", valor: 10 },
}
const MAPA = new Map([TOP, SHORT, SHORT_SEM_TELHA].map((p) => [p.id, p]))

describe("conjunto com um card por cor", () => {
  it("preço mínimo disponível por cor, sem diferenciar acento e caixa", () => {
    expect(precoMinDisponivel(TOP)).toBe(15900)
    expect(precoMinDisponivel(TOP, "telha")).toBe(16900)
    expect(precoMinDisponivel(SHORT_SEM_TELHA, "Telha")).toBeNull()
  })
  it("cores comuns disponíveis seguem a ordem e a grafia da primeira peça", () => {
    expect(coresComunsDisponiveis([TOP, SHORT])).toEqual(["Telha", "Grafitti"])
    expect(coresComunsDisponiveis([TOP, SHORT_SEM_TELHA])).toEqual(["Grafitti"])
  })
  it("um card por cor comum: capa = 1ª foto da 1ª peça na cor, foto e preço da cor, link com ?cor=", () => {
    const cards = montarCardsCuradoPorCor(CURADO, MAPA)
    expect(cards.map((c) => c.cor)).toEqual(["Telha", "Grafitti"])
    const [telha, grafitti] = cards
    expect(telha.capa).toBe("top-telha.jpg")
    expect(grafitti.capa).toBe("top-grafitti.jpg")
    expect(telha.pecas.map((p) => p.thumbnail)).toEqual(["top-telha.jpg", "short-telha.jpg"])
    expect(telha.precoCheio).toBe(16900 + 17900)
    expect(telha.precoComBeneficio).toBe(16900 + 17900 - 1690 - 1790)
    expect(grafitti.pecas.map((p) => p.thumbnail)).toEqual(["top-grafitti.jpg", "short-grafitti.jpg"])
    expect(grafitti.precoCheio).toBe(15900 + 16900)
    expect(hrefConjunto(telha)).toBe("/conjuntos/conjunto-aurora?cor=Telha")
  })
  it("menos de duas cores em comum → card único de sempre, com a capa e sem cor", () => {
    const cards = montarCardsCuradoPorCor({ ...CURADO, product_ids: ["top", "short2"] }, MAPA)
    expect(cards).toHaveLength(1)
    expect(cards[0].cor).toBeNull()
    expect(cards[0].capa).toBe("capa.jpg")
    expect(hrefConjunto(cards[0])).toBe("/conjuntos/conjunto-aurora")
  })
  it("produto ausente → nenhum card; card único segue com cor null", () => {
    expect(montarCardsCuradoPorCor({ ...CURADO, product_ids: ["top", "nao-existe"] }, MAPA)).toEqual([])
    expect(montarCardCurado(CURADO, MAPA)?.cor).toBeNull()
  })
})
