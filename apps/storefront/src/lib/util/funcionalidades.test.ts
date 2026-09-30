import { describe, expect, it } from "vitest"
import { lerFuncionalidades } from "./funcionalidades"

describe("lerFuncionalidades", () => {
  it("aceita JSON em texto (metadata do Medusa) ou array", () => {
    const itens = [{ titulo: "Silicone na barra", texto: "Não sobe no treino." }]
    expect(lerFuncionalidades(JSON.stringify(itens))).toEqual(itens)
    expect(lerFuncionalidades(itens)).toEqual(itens)
  })
  it("descarta item incompleto, JSON inválido e passa de 8", () => {
    expect(lerFuncionalidades('[{"titulo":"A"},{"titulo":" B ","texto":" c "}]')).toEqual([{ titulo: "B", texto: "c" }])
    expect(lerFuncionalidades("{quebrado")).toEqual([])
    expect(lerFuncionalidades(undefined)).toEqual([])
    const muitos = Array.from({ length: 10 }, (_, i) => ({ titulo: `t${i}`, texto: "x" }))
    expect(lerFuncionalidades(muitos)).toHaveLength(8)
  })
})
