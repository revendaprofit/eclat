import { describe, expect, it } from "vitest"
import { lerProva } from "./prova"

describe("lerProva", () => {
  const completa = {
    titulo: "Não sobe no agachamento",
    texto: "Silicone na barra da perna.",
    frase: "Treinei o dia inteiro sem puxar o short.",
    autora: "Paty, cliente Éclat",
    chamada: "Não sobe no burpee",
  }

  it("aceita JSON em texto (metadata do Medusa) ou objeto", () => {
    expect(lerProva(JSON.stringify(completa))).toEqual(completa)
    expect(lerProva(completa)).toEqual(completa)
  })

  it("só o título já basta; espaços saem", () => {
    expect(lerProva({ titulo: "  Não sobe  " })).toEqual({ titulo: "Não sobe", texto: null, frase: null, autora: null, chamada: null })
  })

  it("chamada longa demais (mais de 40 letras) não entra", () => {
    expect(lerProva({ titulo: "Não sobe", chamada: "x".repeat(41) })?.chamada).toBeNull()
  })

  it("frase sem autora não entra", () => {
    expect(lerProva({ titulo: "Não sobe", frase: "Amei" })).toEqual({ titulo: "Não sobe", texto: null, frase: null, autora: null, chamada: null })
  })

  it("sem título, JSON inválido, lista ou vazio → nada", () => {
    expect(lerProva({ texto: "x" })).toBeNull()
    expect(lerProva("{quebrado")).toBeNull()
    expect(lerProva([completa])).toBeNull()
    expect(lerProva(undefined)).toBeNull()
  })
})
