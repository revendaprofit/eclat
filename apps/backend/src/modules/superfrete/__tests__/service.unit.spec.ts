import SuperfreteProviderService from "../service"
import { ErroSuperfrete, type Cotacao } from "../cliente"

const P = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }
const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }

const COTACOES: Cotacao[] = [
  { servico: "mini", centavos: 990, prazoMin: 6, prazoMax: 8 },
  { servico: "pac", centavos: 1430, prazoMin: 5, prazoMax: 6 },
  { servico: "sedex", centavos: 2210, prazoMin: 1, prazoMax: 2 },
]

function provider(o: { cotacoes?: Cotacao[] | Error; base?: number } = {}) {
  const cotar = jest.fn(async () => {
    const c = o.cotacoes ?? COTACOES
    if (c instanceof Error) throw c
    return c
  })
  const buscarBase = jest.fn(async () => o.base ?? 20000)
  const svc = new SuperfreteProviderService({ logger } as any, { cotador: { cotar }, buscarBase, parametros: P })
  return { svc, cotar, buscarBase }
}

const contexto = (o: { qtd?: number; peso?: number; uf?: string; cep?: string | null } = {}) =>
  ({
    id: "cart_1",
    items: [{ quantity: o.qtd ?? 1, unit_price: 200, variant: { weight: o.peso ?? 200 } }],
    shipping_address: { postal_code: o.cep === undefined ? "30130-010" : o.cep, province: o.uf ?? "MG" },
  }) as any

describe("provider superfrete", () => {
  it("oferece as três opções e valida o id", async () => {
    const { svc } = provider()
    expect((await svc.getFulfillmentOptions()).map((o) => o.id)).toEqual(["mini", "pac", "sedex"])
    expect(await svc.validateOption({ id: "pac" })).toBe(true)
    expect(await svc.validateOption({ id: "jadlog" })).toBe(false)
    expect(await svc.canCalculate({} as any)).toBe(true)
  })

  it("preço normal em reais decimais, com imposto incluso", async () => {
    const { svc } = provider()
    expect(await svc.calculatePrice({ id: "pac" }, {}, contexto())).toEqual({
      calculated_amount: 16.9,
      is_calculated_price_tax_inclusive: true,
    })
    expect((await svc.calculatePrice({ id: "mini" }, {}, contexto())).calculated_amount).toBe(11.9)
  })

  it("frete grátis: a mais barata zera e as outras cobram a diferença", async () => {
    const { svc, buscarBase } = provider({ base: 52000 })
    expect((await svc.calculatePrice({ id: "mini" }, {}, contexto())).calculated_amount).toBe(0)
    expect((await svc.calculatePrice({ id: "pac" }, {}, contexto())).calculated_amount).toBe(5)
    expect((await svc.calculatePrice({ id: "sedex" }, {}, contexto())).calculated_amount).toBe(13)
    expect(buscarBase).toHaveBeenCalledWith("cart_1")
  })

  it("usa os adjustments do context quando o Medusa os entrega, sem ir ao banco", async () => {
    const { svc, buscarBase } = provider()
    const ctx = contexto()
    ctx.items = [{ quantity: 2, unit_price: 300, adjustments: [{ amount: 50 }], variant: { weight: 200 } }]
    // base = 60000 − 5000 = 55000 ≥ piso MG → 2 peças não têm Mini; PAC é a mais barata
    expect((await svc.calculatePrice({ id: "pac" }, {}, ctx)).calculated_amount).toBe(0)
    expect(buscarBase).not.toHaveBeenCalled()
  })

  it("sem peso na variante, usa o peso do produto (é onde ele mora em produção)", async () => {
    const { svc, cotar } = provider()
    const ctx = contexto()
    ctx.items = [{ quantity: 1, unit_price: 200, variant: { weight: null }, product: { weight: 200 } }]
    expect((await svc.calculatePrice({ id: "mini" }, {}, ctx)).calculated_amount).toBe(11.9)
    expect(cotar).toHaveBeenCalledWith("30130010", { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.25 })
  })

  it("Mini Envios não se aplica a pacote fora do limite, mesmo que a API cote", async () => {
    const { svc } = provider()
    await expect(svc.calculatePrice({ id: "mini" }, {}, contexto({ qtd: 2 }))).rejects.toMatchObject({ type: "not_allowed" })
    // e o Mini fora do jogo não pode ser "a mais barata" do frete grátis
    const gratis = provider({ base: 60000 })
    expect((await gratis.svc.calculatePrice({ id: "pac" }, {}, contexto({ qtd: 2 }))).calculated_amount).toBe(0)
  })

  it("serviço que a SuperFrete não cotou não se aplica", async () => {
    const { svc } = provider({ cotacoes: [COTACOES[1]] })
    await expect(svc.calculatePrice({ id: "sedex" }, {}, contexto())).rejects.toMatchObject({ type: "not_allowed" })
  })

  it("SuperFrete fora do ar: só PAC, pelo valor de reserva, e o frete grátis continua valendo", async () => {
    const fora = provider({ cotacoes: new ErroSuperfrete("caiu") })
    expect((await fora.svc.calculatePrice({ id: "pac" }, {}, contexto())).calculated_amount).toBe(24.9)
    await expect(fora.svc.calculatePrice({ id: "sedex" }, {}, contexto())).rejects.toMatchObject({ type: "not_allowed" })
    expect(logger.error).toHaveBeenCalled()

    const foraGratis = provider({ cotacoes: new ErroSuperfrete("caiu"), base: 60000 })
    expect((await foraGratis.svc.calculatePrice({ id: "pac" }, {}, contexto())).calculated_amount).toBe(0)
  })

  it("sem CEP válido pede o CEP", async () => {
    const { svc } = provider()
    await expect(svc.calculatePrice({ id: "pac" }, {}, contexto({ cep: null }))).rejects.toThrow("Informe o CEP")
    await expect(svc.calculatePrice({ id: "pac" }, {}, contexto({ cep: "123" }))).rejects.toThrow("Informe o CEP")
  })

  it("grava no shipping method o serviço, o pacote e o prazo — ignorando o que vier do navegador", async () => {
    const { svc } = provider()
    expect(await svc.validateFulfillmentData({ id: "sedex" }, { servico: 999, pacote: "forjado" }, contexto())).toEqual({
      servico: 2,
      pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.25 },
      prazo_min: 1,
      prazo_max: 2,
    })
  })

  it("sem cotação, grava serviço e pacote sem prazo", async () => {
    const { svc } = provider({ cotacoes: new ErroSuperfrete("caiu") })
    expect(await svc.validateFulfillmentData({ id: "pac" }, {}, contexto())).toEqual({
      servico: 1,
      pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.25 },
    })
  })

  it("createFulfillment não compra etiqueta (isso é do Cockpit)", async () => {
    const { svc, cotar } = provider()
    expect(await svc.createFulfillment({}, [], undefined, {})).toEqual({ data: {}, labels: [] })
    expect(cotar).not.toHaveBeenCalled()
  })

  it("opção dominada não se aplica: em BH só o SEDEX aparece, e é ele que fica grátis", async () => {
    const BH: Cotacao[] = [
      { servico: "mini", centavos: 1452, prazoMin: 8, prazoMax: 8 },
      { servico: "pac", centavos: 1871, prazoMin: 5, prazoMax: 5 },
      { servico: "sedex", centavos: 1191, prazoMin: 1, prazoMax: 1 },
    ]
    const normal = provider({ cotacoes: BH })
    expect((await normal.svc.calculatePrice({ id: "sedex" }, {}, contexto())).calculated_amount).toBe(14.9)
    await expect(normal.svc.calculatePrice({ id: "pac" }, {}, contexto())).rejects.toMatchObject({ type: "not_allowed" })
    await expect(normal.svc.calculatePrice({ id: "mini" }, {}, contexto())).rejects.toMatchObject({ type: "not_allowed" })

    const gratis = provider({ cotacoes: BH, base: 52000 })
    expect((await gratis.svc.calculatePrice({ id: "sedex" }, {}, contexto())).calculated_amount).toBe(0)
  })
})
