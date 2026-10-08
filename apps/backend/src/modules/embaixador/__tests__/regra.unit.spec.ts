import { ehCampanhaEmbaixador, ehPromocaoEmbaixador } from "../regra"

describe("cupom de embaixador", () => {
  it("reconhece pela campanha, não pelo código", () => {
    expect(ehCampanhaEmbaixador("embaixador-alana20")).toBe(true)
    expect(ehCampanhaEmbaixador("Embaixador-ALANA20")).toBe(true)
    expect(ehCampanhaEmbaixador("cupom-alana20")).toBe(false)
    expect(ehCampanhaEmbaixador(null)).toBe(false)
  })
  it("promoção sem campanha (parceria --sem-teto) não é de embaixador", () => {
    expect(ehPromocaoEmbaixador({ campaign: { campaign_identifier: "embaixador-debora20" } })).toBe(true)
    expect(ehPromocaoEmbaixador({ campaign: null })).toBe(false)
    expect(ehPromocaoEmbaixador({})).toBe(false)
    expect(ehPromocaoEmbaixador(undefined)).toBe(false)
  })
})
