import { linkDeRastreio, mesclarNoFrete, mudarAvisoDespacho, naoChegouAEntregar } from "../aviso-despacho"
import { EvolutionHttpError } from "../evolution"

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

describe("naoChegouAEntregar (volta a pendente só quando é CERTO que não saiu)", () => {
  // Erro do fetch (undici): TypeError("fetch failed") com o código em `cause`.
  const deRede = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } })
  const agregado = (...codes: string[]) =>
    Object.assign(new TypeError("fetch failed"), { cause: { errors: codes.map((code) => ({ code })) } })

  it("4xx/5xx da Evolution → não chegou", () => {
    expect(naoChegouAEntregar(new EvolutionHttpError("x", 503))).toBe(true)
    expect(naoChegouAEntregar(new EvolutionHttpError("x", 401))).toBe(true)
  })

  it("erros da fase de conexão → não chegou (inclui EHOSTUNREACH e ENETUNREACH)", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "EHOSTUNREACH", "ENETUNREACH"]) {
      expect([code, naoChegouAEntregar(deRede(code))]).toEqual([code, true])
    }
    expect(naoChegouAEntregar(agregado("EHOSTUNREACH", "ENETUNREACH"))).toBe(true)
  })

  it("ETIMEDOUT e ECONNRESET são AMBÍGUOS (podem nascer depois da entrega) → não afirma", () => {
    expect(naoChegouAEntregar(deRede("ETIMEDOUT"))).toBe(false)
    expect(naoChegouAEntregar(deRede("ECONNRESET"))).toBe(false)
    expect(naoChegouAEntregar(agregado("EHOSTUNREACH", "ETIMEDOUT"))).toBe(false)
  })

  it("timeout, corpo ilegível e erro desconhecido → não afirma", () => {
    expect(naoChegouAEntregar(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(false)
    expect(naoChegouAEntregar(new SyntaxError("json"))).toBe(false)
    expect(naoChegouAEntregar(null)).toBe(false)
  })
})
