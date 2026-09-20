import { dentroDaArea, faixasDoAmbiente, normalizarCep, FAIXAS_PADRAO } from "../area"
import EntregaAppProviderService, { OPCAO, TEXTO_ACEITE } from "../service"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never
const servico = () => new EntregaAppProviderService({ logger })
const contexto = (cep: string | null) => ({ shipping_address: { postal_code: cep } }) as never

describe("entrega por aplicativo — área", () => {
  it("aceita CEP de Betim, BH, Contagem e Nova Lima", () => {
    for (const cep of ["32604182", "30130010", "32041000", "34000000"]) {
      expect(dentroDaArea(cep)).toBe(true)
    }
  })

  it("recusa fora da região (São Paulo, Manaus, Juiz de Fora)", () => {
    for (const cep of ["01001000", "69005010", "36010000"]) {
      expect(dentroDaArea(cep)).toBe(false)
    }
  })

  it("aceita CEP com máscara e recusa o que não tem 8 dígitos", () => {
    expect(dentroDaArea("32604-182")).toBe(true)
    expect(dentroDaArea("326041")).toBe(false)
    expect(dentroDaArea(null)).toBe(false)
    expect(normalizarCep("32.604-182")).toBe("32604182")
  })

  it("faixas do ambiente sobrescrevem; lixo cai no padrão", () => {
    expect(faixasDoAmbiente({ ENTREGA_APP_CEPS: "01000000-01099999" } as never)).toEqual([
      { de: 1000000, ate: 1099999, nome: "configurada" },
    ])
    expect(faixasDoAmbiente({ ENTREGA_APP_CEPS: "nada aqui" } as never)).toEqual(FAIXAS_PADRAO)
    expect(faixasDoAmbiente({} as never)).toEqual(FAIXAS_PADRAO)
  })
})

describe("entrega por aplicativo — provider", () => {
  it("frete zero dentro da área", async () => {
    await expect(servico().calculatePrice({ id: OPCAO } as never, {} as never, contexto("32604182"))).resolves.toEqual({
      calculated_amount: 0,
      is_calculated_price_tax_inclusive: true,
    })
  })

  it("fora da área a opção nem aparece (recusa no cálculo)", async () => {
    await expect(servico().calculatePrice({ id: OPCAO } as never, {} as never, contexto("01001000"))).rejects.toThrow(
      /Betim e a Região Metropolitana/
    )
  })

  it("sem o aceite da cliente, o método de entrega não é gravado", async () => {
    await expect(
      servico().validateFulfillmentData({ id: OPCAO }, { aceite: false }, contexto("32604182"))
    ).rejects.toThrow(/confirme que a contratação do transporte é sua/)
    await expect(servico().validateFulfillmentData({ id: OPCAO }, {}, contexto("32604182"))).rejects.toThrow()
  })

  it("com o aceite, grava o texto aceito, a hora e como combinar", async () => {
    const gravado = await servico().validateFulfillmentData({ id: OPCAO }, { aceite: true }, contexto("32604182"))
    expect(gravado.tipo).toBe("entrega_app")
    expect(gravado.aceite_texto).toBe(TEXTO_ACEITE)
    expect(gravado.combinar_por).toBe("whatsapp")
    expect(Date.parse(String(gravado.aceite_em))).not.toBeNaN()
  })

  it("aceite não vale fora da área", async () => {
    await expect(
      servico().validateFulfillmentData({ id: OPCAO }, { aceite: true }, contexto("01001000"))
    ).rejects.toThrow(/Betim e a Região Metropolitana/)
  })

  it("não cria etiqueta: a retirada é combinada por WhatsApp", async () => {
    await expect(servico().createFulfillment()).resolves.toEqual({ data: {}, labels: [] })
  })
})
