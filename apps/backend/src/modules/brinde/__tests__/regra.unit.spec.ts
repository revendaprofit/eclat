import { avaliarCarrinho, faixasLiberadas, frasePresente, lerConfig, proximaFaixa } from "../regra"

const RAW = {
  ativo: true,
  inicio: "2026-10-01T00:00:00-03:00",
  faixas: [
    { id: "oculos", minimo_centavos: 55000, product_handle: "oculos-eclat", limite: 15 },
    { id: "meia", minimo_centavos: 25000, product_handle: "meia-cano-medio", limite: 30 },
  ],
}
const cfg = lerConfig(RAW)!
const meia = (extra: Record<string, unknown> = {}) => ({
  id: "li_meia",
  variant_id: "var_meia",
  product_handle: "meia-cano-medio",
  unit_price: 0,
  quantity: 1,
  metadata: { brinde: "meia" },
  ...extra,
})

describe("brinde/regra", () => {
  it("lê a configuração e ordena as faixas pelo mínimo", () => {
    expect(cfg.faixas.map((f) => f.id)).toEqual(["meia", "oculos"])
    expect(lerConfig({ ...RAW, ativo: false })).toBeNull()
    expect(lerConfig(null)).toBeNull()
    expect(lerConfig({ ativo: true, faixas: [{ id: "chapeu", minimo_centavos: 100, product_handle: "x", limite: 1 }] })).toBeNull()
    expect(lerConfig({ ativo: true, faixas: [{ id: "meia", minimo_centavos: 250.5, product_handle: "x", limite: 1 }] })).toBeNull()
  })

  it("libera a faixa no valor exato e respeita o estoque reservado", () => {
    expect(faixasLiberadas(24999, cfg, {})).toEqual([])
    expect(faixasLiberadas(25000, cfg, {}).map((f) => f.id)).toEqual(["meia"])
    expect(faixasLiberadas(59800, cfg, {}).map((f) => f.id)).toEqual(["meia", "oculos"])
    expect(faixasLiberadas(59800, cfg, { oculos: 15 }).map((f) => f.id)).toEqual(["meia"])
  })

  it("diz quanto falta para a próxima faixa", () => {
    // Solaris com PATY10: R$ 233,10 → faltam R$ 16,90 para a meia
    expect(proximaFaixa(23310, cfg, {})).toMatchObject({ faixa: { id: "meia" }, falta_centavos: 1690 })
    // conjunto + Solaris com PATY10: R$ 519,30 → faltam R$ 30,70 para o óculos
    expect(proximaFaixa(51930, cfg, {})).toMatchObject({ faixa: { id: "oculos" }, falta_centavos: 3070 })
    expect(proximaFaixa(59800, cfg, {})).toBeNull()
    // óculos esgotado: nada mais a ganhar acima da meia
    expect(proximaFaixa(30000, cfg, { oculos: 15 })).toBeNull()
  })

  it("aceita um presente válido e carrinho sem presente", () => {
    expect(avaliarCarrinho([], 0, cfg, {})).toEqual({ ok: true })
    expect(avaliarCarrinho([meia()], 28620, cfg, {})).toEqual({ ok: true })
    expect(avaliarCarrinho([meia({ unit_price: { numeric: 0 } })], 28620, cfg, {})).toEqual({ ok: true })
  })

  it("recusa presente abaixo da faixa, em dobro, com quantidade ou preço mexidos", () => {
    expect(avaliarCarrinho([meia()], 23310, cfg, {})).toMatchObject({ ok: false, remover: ["li_meia"] })
    expect(avaliarCarrinho([meia(), meia({ id: "li_2" })], 60000, cfg, {})).toMatchObject({ ok: false, remover: ["li_meia", "li_2"] })
    expect(avaliarCarrinho([meia({ quantity: 3 })], 60000, cfg, {})).toMatchObject({ ok: false })
    expect(avaliarCarrinho([meia({ unit_price: 34.9 })], 60000, cfg, {})).toMatchObject({ ok: false })
    expect(avaliarCarrinho([meia({ product_handle: "macaquinho-solaris" })], 60000, cfg, {})).toMatchObject({ ok: false })
    expect(avaliarCarrinho([meia({ metadata: { brinde: "oculos" } })], 30000, cfg, {})).toMatchObject({ ok: false })
  })

  it("recusa presente com a promoção desligada ou esgotada", () => {
    expect(avaliarCarrinho([meia()], 30000, null, {})).toMatchObject({ ok: false })
    expect(avaliarCarrinho([meia()], 30000, cfg, { meia: 30 })).toMatchObject({ ok: false })
  })

  it("frase do presente para as mensagens: faixa mais baixa, valor sem centavos", () => {
    expect(frasePresente(cfg)).toBe("Nas compras a partir de R$ 250 em peças, você ganha uma meia Éclat de presente.")
    expect(frasePresente(null)).toBeNull()
  })

  it("peça paga igual ao presente não conta como presente", () => {
    const paga = { id: "li_paga", variant_id: "var_meia", product_handle: "meia-cano-medio", unit_price: 34.9, quantity: 2 }
    expect(avaliarCarrinho([paga], 10000, cfg, {})).toEqual({ ok: true })
  })
})
