import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extrairItensDoXml, extrairChaveDoXml } from "../fiscal-xml"
import { ErroFiscal } from "../tipos"

const xml = readFileSync(join(__dirname, "fixtures", "nfe-autorizada.xml"), "utf8")

describe("extrairItensDoXml", () => {
  it("extrai um item por <det>, com nItem, código e NCM", () => {
    const itens = extrairItensDoXml(xml)
    expect(itens).toHaveLength(3)
    expect(itens[0]).toEqual({ n_item: 1, codigo: "TOP-AURA-P", ncm: "61091000" })
    expect(itens[2]).toEqual({ n_item: 3, codigo: "SHORT-NIMBLE-G", ncm: "61046300" })
  })

  it("devolve os itens ordenados por nItem, mesmo se o XML vier fora de ordem", () => {
    const foraDeOrdem = `<nfeProc>
      <det nItem="3"><prod><cProd>C</cProd><NCM>333</NCM></prod></det>
      <det nItem="1"><prod><cProd>A</cProd><NCM>111</NCM></prod></det>
      <det nItem="2"><prod><cProd>B</cProd><NCM>222</NCM></prod></det>
    </nfeProc>`
    const itens = extrairItensDoXml(foraDeOrdem)
    expect(itens.map((i) => i.n_item)).toEqual([1, 2, 3])
    expect(itens.map((i) => i.codigo)).toEqual(["A", "B", "C"])
  })

  it("aceita nItem com aspas simples", () => {
    const itens = extrairItensDoXml(xml.replace(/nItem="(\d+)"/g, "nItem='$1'"))
    expect(itens.map((i) => i.n_item)).toEqual([1, 2, 3])
  })

  it("falha quando o XML não tem nenhum <det>", () => {
    expect(() => extrairItensDoXml("<nfeProc></nfeProc>")).toThrow(ErroFiscal)
    expect(() => extrairItensDoXml("<nfeProc></nfeProc>")).toThrow(/nenhum item/i)
  })

  it("falha quando um <det> não traz nItem (rejeição VC03-20 em potencial)", () => {
    expect(() => extrairItensDoXml("<det><prod><cProd>X</cProd><NCM>1</NCM></prod></det>")).toThrow(
      ErroFiscal
    )
  })
})

describe("extrairChaveDoXml", () => {
  it("extrai a chave de acesso de 44 dígitos do protocolo", () => {
    expect(extrairChaveDoXml(xml)).toBe("31260968673407000113550010000000011000000017")
  })

  it("falha quando não há chave", () => {
    expect(() => extrairChaveDoXml("<nfeProc></nfeProc>")).toThrow(ErroFiscal)
  })
})
