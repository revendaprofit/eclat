import { resolverPerfil } from "../fiscal-perfil"
import { ErroFiscal, type FiscalPerfil } from "../tipos"

function perfil(p: Partial<FiscalPerfil>): FiscalPerfil {
  return {
    id: p.id ?? "p1",
    escopo: p.escopo ?? "padrao",
    alvo_id: p.alvo_id ?? null,
    csosn: p.csosn ?? "102",
    cfop_dentro_uf: p.cfop_dentro_uf ?? "5102",
    cfop_fora_uf: p.cfop_fora_uf ?? "6108",
    cfop_devolucao_dentro_uf: p.cfop_devolucao_dentro_uf ?? "1202",
    cfop_devolucao_fora_uf: p.cfop_devolucao_fora_uf ?? "2202",
    origem_padrao: p.origem_padrao ?? 0,
    ativo: p.ativo ?? true,
  }
}

const padrao = perfil({ id: "padrao", escopo: "padrao", csosn: "102" })
const porCategoria = perfil({ id: "cat", escopo: "categoria", alvo_id: "tops", csosn: "500" })
const porProduto = perfil({ id: "prod", escopo: "produto", alvo_id: "prod_1", csosn: "900" })

describe("resolverPerfil", () => {
  it("prefere o perfil do produto sobre o da categoria e o padrão", () => {
    const r = resolverPerfil([padrao, porCategoria, porProduto], "prod_1", "tops")
    expect(r.id).toBe("prod")
  })

  it("cai na categoria quando não há perfil do produto", () => {
    const r = resolverPerfil([padrao, porCategoria], "prod_2", "tops")
    expect(r.id).toBe("cat")
  })

  it("cai no padrão quando não há perfil de produto nem de categoria", () => {
    const r = resolverPerfil([padrao, porCategoria], "prod_2", "leggings")
    expect(r.id).toBe("padrao")
  })

  it("ignora perfil inativo e desce um nível", () => {
    const catInativo = perfil({ id: "cat", escopo: "categoria", alvo_id: "tops", ativo: false })
    const r = resolverPerfil([padrao, catInativo], "prod_2", "tops")
    expect(r.id).toBe("padrao")
  })

  it("falha com mensagem legível quando não existe perfil padrão", () => {
    expect(() => resolverPerfil([porCategoria], "prod_2", "leggings")).toThrow(ErroFiscal)
    expect(() => resolverPerfil([porCategoria], "prod_2", "leggings")).toThrow(
      /Nenhum perfil fiscal padrão/
    )
  })

  it("não inventa perfil quando a categoria é nula", () => {
    const r = resolverPerfil([padrao, porCategoria], "prod_2", null)
    expect(r.id).toBe("padrao")
  })
})
