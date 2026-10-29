import { describe, expect, it } from "vitest"
import { frasesDaProva, lerProva } from "./prova"

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

describe("frasesDaProva (frases que giram abaixo do nome, 29/10)", () => {
  const prova = lerProva({ titulo: "Não sobe", frase: "Treinei o dia inteiro sem puxar o short.", autora: "Paty, cliente Éclat" })
  it("prova primeiro, depois os depoimentos da peça com cidade, sem repetir, sem fotos, até 5", () => {
    const deps = [
      { quote: "Treinei o dia inteiro sem puxar o short.", author: "Paty" }, // repetida → fora
      { quote: "Não subiu nadinha na corrida.", author: "Luana", cidade: "Betim/MG" },
      { quote: "só foto", author: "Poli", tipo: "foto" as const },
      { quote: "Amei.", author: "Melka" },
      { quote: "Um.", author: "A" },
      { quote: "Dois.", author: "B" },
      { quote: "Três.", author: "C" },
    ]
    const f = frasesDaProva(prova, deps)
    expect(f).toHaveLength(5)
    expect(f[0]).toEqual({ frase: "Treinei o dia inteiro sem puxar o short.", autora: "Paty, cliente Éclat" })
    expect(f[1]).toEqual({ frase: "Não subiu nadinha na corrida.", autora: "Luana, Betim/MG" })
    expect(f.map((x) => x.autora)).not.toContain("Poli")
  })
  it("sem prova e sem depoimentos, nada", () => {
    expect(frasesDaProva(null, [])).toEqual([])
  })
})
