import { describe, expect, it } from "vitest"
import { decidirCupomDaParceira, lerParceira, limparApelido, limparNumeroDoVideo, serializarParceira } from "./parceira"

const paty = { apelido: "paty", codigo: "PATY10", conteudo: 2 }

describe("link da creator", () => {
  it("limpa apelido e número do vídeo", () => {
    expect(limparApelido(" Paty ")).toBe("paty")
    expect(limparApelido("../x")).toBe("")
    expect(limparNumeroDoVideo("2")).toBe(2)
    expect(limparNumeroDoVideo("0")).toBeNull()
    expect(limparNumeroDoVideo("abc")).toBeNull()
  })

  it("cookie vai e volta; lixo vira nada", () => {
    expect(lerParceira(serializarParceira(paty))).toEqual(paty)
    expect(lerParceira(serializarParceira({ ...paty, conteudo: null }))).toEqual({ ...paty, conteudo: null })
    expect(lerParceira("paty|<script>|1")).toBeNull()
    expect(lerParceira("")).toBeNull()
    expect(lerParceira(null)).toBeNull()
  })

  it("aplica o cupom na sacola sem cupom", () => {
    expect(decidirCupomDaParceira({ parceira: paty, metadata: {}, cuponsVisiveis: [] })).toBe("aplicar")
    expect(decidirCupomDaParceira({ parceira: paty, metadata: null, cuponsVisiveis: ["paty10"] })).toBe("aplicar") // grava o link
  })

  it("não mexe quando a cliente já tem outro cupom", () => {
    expect(decidirCupomDaParceira({ parceira: paty, metadata: {}, cuponsVisiveis: ["NABELS10"] })).toBe("nada")
  })

  it("não reaplica na sacola já marcada com o mesmo link (ela pode ter tirado o cupom)", () => {
    const metadata = { parceria_link: "PATY10", parceria_conteudo: 2 }
    expect(decidirCupomDaParceira({ parceira: paty, metadata, cuponsVisiveis: [] })).toBe("nada")
  })

  it("link novo da mesma creator (outro vídeo) atualiza a marca; o último clique vence", () => {
    const metadata = { parceria_link: "PATY10", parceria_conteudo: 1 }
    expect(decidirCupomDaParceira({ parceira: paty, metadata, cuponsVisiveis: ["PATY10"] })).toBe("aplicar")
  })
})
