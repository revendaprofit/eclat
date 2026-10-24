import { describe, expect, it } from "vitest"
import { depoimentosDaPeca, depoimentosReais, somentePrints } from "./depoimentos"
import { HOME_DEFAULTS } from "@modules/home/content"

describe("depoimentosReais", () => {
  it("só passa depoimento com fala e autora", () => {
    expect(
      depoimentosReais([
        { quote: " Amei viu! Super aprovado! ", author: "Pollianna", origem: "Instagram" },
        { quote: "sem autora" },
        { author: "sem fala" },
        null,
      ])
    ).toEqual([{ quote: "Amei viu! Super aprovado!", author: "Pollianna", origem: "Instagram", tipo: "print" }])
    expect(depoimentosReais(undefined)).toEqual([])
  })
  it("foto de cliente precisa de imagem do Storage e autora; produtos marcam a peça", () => {
    const foto = { tipo: "foto", author: "Poli", image_url: "https://abc.supabase.co/storage/v1/object/public/site/depoimentos/poli.jpg", produtos: ["macaquinho-solaris", " "] }
    const semImagem = { tipo: "foto", author: "Poli", image_url: "https://outro.com/x.jpg" }
    const print = { quote: "Amei", author: "Melka", produtos: ["macaquinho-solaris"] }
    const todos = depoimentosReais([foto, semImagem, print])
    expect(todos.map((t) => [t.tipo, t.author, t.produtos])).toEqual([["foto", "Poli", ["macaquinho-solaris"]], ["print", "Melka", ["macaquinho-solaris"]]])
    expect(somentePrints(todos).map((t) => t.author)).toEqual(["Melka"])
    expect(depoimentosDaPeca(todos, "macaquinho-solaris")).toHaveLength(2)
    expect(depoimentosDaPeca(todos, "top-aurora")).toEqual([])
    expect(depoimentosDaPeca(todos, undefined)).toEqual([])
  })
  it("o código não traz depoimento padrão (nada inventado)", () => {
    expect(HOME_DEFAULTS.testimonials.items ?? []).toEqual([])
  })
})
