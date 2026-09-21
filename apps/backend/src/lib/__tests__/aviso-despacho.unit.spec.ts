import { linkDeRastreio, mesclarNoFrete, mudarAvisoDespacho } from "../aviso-despacho"

// O comportamento no banco é provado no teste de integração (integration-tests/http/aviso-despacho.spec.ts).
// Aqui ficam as regras que não dependem do Postgres.
function pgFalso() {
  const chamadas: { sql: string; bindings: unknown[] }[] = []
  return {
    chamadas,
    raw: async (sql: string, bindings: readonly unknown[] = []) => {
      chamadas.push({ sql, bindings: [...bindings] })
      return { rows: [] }
    },
  }
}

describe("mesclarNoFrete", () => {
  it("recusa `aviso_despacho` (só as transições condicionais mexem no aviso)", async () => {
    const pg = pgFalso()
    await expect(mesclarNoFrete(pg, "order_1", { aviso_despacho: { status: "enviado" } })).rejects.toThrow(/aviso_despacho/)
    expect(pg.chamadas).toHaveLength(0)
  })

  it("é uma instrução só, que mescla dentro do banco (nada de ler antes)", async () => {
    const pg = pgFalso()
    expect(await mesclarNoFrete(pg, "order_1", { status_transportadora: "order.posted" })).toBeNull()
    expect(pg.chamadas).toHaveLength(1)
    expect(pg.chamadas[0].sql).toMatch(/^UPDATE "order"/)
    expect(pg.chamadas[0].sql).toContain("|| ?::jsonb")
    expect(pg.chamadas[0].bindings).toEqual([JSON.stringify({ status_transportadora: "order.posted" }), "order_1"])
  })

  it("`seSemRastreio` põe a condição no próprio UPDATE", async () => {
    const pg = pgFalso()
    await mesclarNoFrete(pg, "order_1", { tracking_number: "AA1BR" }, { seSemRastreio: true })
    expect(pg.chamadas[0].sql).toContain("coalesce(metadata->'frete'->>'tracking_number','') = ''")
  })
})

describe("mudarAvisoDespacho", () => {
  it("condiciona no status atual e remove as chaves pedidas", async () => {
    const pg = pgFalso()
    expect(await mudarAvisoDespacho(pg, "order_1", "enviando", { status: "pendente" }, ["desde_envio", "por"])).toBeNull()
    const { sql, bindings } = pg.chamadas[0]
    expect(sql).toContain("->>'status' = ?")
    expect(sql).toContain(" - ?::text - ?::text")
    expect(bindings).toEqual(["desde_envio", "por", JSON.stringify({ status: "pendente" }), "order_1", "enviando"])
  })
})

describe("linkDeRastreio (mesma regra do Cockpit)", () => {
  it("rastreamento dos Correios com o código; sem código, vazio", () => {
    expect(linkDeRastreio("AA123456789BR")).toBe("https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR")
    expect(linkDeRastreio("")).toBe("")
  })
})
