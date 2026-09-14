import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import { DEFAULT_FILTERS } from "./catalog-filters"
import { entradasPorCor, entryKey, listagemConfigDe } from "./listagem-cores"

const opts = (cores: string[]) => [
  { id: "o_t", title: "Tamanho", values: [{ value: "P" }, { value: "M" }] },
  { id: "o_c", title: "Cor", values: cores.map((value) => ({ value })) },
]
const v = (id: string, tam: string, cor: string, qty: number) => ({
  id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty,
  options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
})
const prod = (id: string, cores: string[], variants: ReturnType<typeof v>[]) =>
  ({ id, handle: id, title: id, options: opts(cores), variants }) as unknown as HttpTypes.StoreProduct

// top: Telha (P e M disponíveis) + Grafitti (P esgotado, M disponível)
const TOP = prod("top", ["Telha", "Grafitti"], [v("t1", "P", "Telha", 3), v("t2", "M", "Telha", 5), v("t3", "P", "Grafitti", 0), v("t4", "M", "Grafitti", 2)])
// short: só Grafitti
const SHORT = prod("short", ["Grafitti"], [v("s1", "P", "Grafitti", 4)])
// macaquinho: Telha disponível + Grafitti toda esgotada
const MACA = prod("maca", ["Telha", "Grafitti"], [v("m1", "M", "Telha", 1), v("m2", "M", "Grafitti", 0)])
const SEM_COR = { id: "meia", handle: "meia", title: "Meia", options: [], variants: [{ id: "x", manage_inventory: false, options: [] }] } as unknown as HttpTypes.StoreProduct

const lista = (es: ReturnType<typeof entradasPorCor>) => es.map((e) => `${e.product.id}:${e.cor ?? "-"}`)

describe("entradasPorCor", () => {
  it("uma entrada por cor, cores do mesmo modelo lado a lado, na ordem da opção", () => {
    expect(lista(entradasPorCor([TOP, SHORT], DEFAULT_FILTERS))).toEqual(["top:Telha", "top:Grafitti", "short:-"])
  })
  it("produto de cor única e produto sem opção Cor viram uma entrada sem cor", () => {
    expect(lista(entradasPorCor([SHORT, SEM_COR], DEFAULT_FILTERS))).toEqual(["short:-", "meia:-"])
  })
  it("cor esgotada continua na grade sem filtros", () => {
    expect(lista(entradasPorCor([MACA], DEFAULT_FILTERS))).toEqual(["maca:Telha", "maca:Grafitti"])
  })
  it("filtro de cor mantém só a cor escolhida, sem diferenciar acento e caixa", () => {
    expect(lista(entradasPorCor([TOP], { ...DEFAULT_FILTERS, cor: ["grafitti"] }))).toEqual(["top:Grafitti"])
  })
  it("filtro de tamanho exige a variante disponível daquela cor", () => {
    expect(lista(entradasPorCor([TOP], { ...DEFAULT_FILTERS, tamanho: ["P"] }))).toEqual(["top:Telha"])
    expect(lista(entradasPorCor([TOP], { ...DEFAULT_FILTERS, tamanho: ["M"] }))).toEqual(["top:Telha", "top:Grafitti"])
  })
  it("filtro disponível tira a cor toda esgotada", () => {
    expect(lista(entradasPorCor([MACA], { ...DEFAULT_FILTERS, disponivel: true }))).toEqual(["maca:Telha"])
  })
  it("porCor=false devolve um card por produto (vitrine antiga)", () => {
    expect(lista(entradasPorCor([TOP, MACA], DEFAULT_FILTERS, false))).toEqual(["top:-", "maca:-"])
  })
  it("chave estável por produto e cor normalizada", () => {
    expect(entryKey({ product: TOP, cor: "Grafitti" })).toBe("top|grafitti")
    expect(entryKey({ product: SHORT, cor: null })).toBe("short|")
  })
})

describe("listagemConfigDe", () => {
  it("ausente ou inválido → tudo ligado", () => {
    expect(listagemConfigDe(null)).toEqual({ cardsPorCor: true, conjuntosNaListagem: true })
    expect(listagemConfigDe({ cards_por_cor: "sim" })).toEqual({ cardsPorCor: true, conjuntosNaListagem: true })
  })
  it("respeita os booleanos gravados", () => {
    expect(listagemConfigDe({ cards_por_cor: false, conjuntos_na_listagem: false })).toEqual({ cardsPorCor: false, conjuntosNaListagem: false })
  })
})
