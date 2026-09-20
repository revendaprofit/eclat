import { describe, expect, it } from "vitest"
import { ehEntregaPorApp, TEXTO_ENTREGA_APP } from "./entrega-app"

describe("entrega por aplicativo (vitrine)", () => {
  it("reconhece a opção pelo provider, não pelo nome (nome é editável no Cockpit)", () => {
    expect(ehEntregaPorApp({ provider_id: "entrega-app_entrega-app" })).toBe(true)
    expect(ehEntregaPorApp({ provider_id: "superfrete_superfrete" })).toBe(false)
    expect(ehEntregaPorApp({ provider_id: "manual_manual" })).toBe(false)
    expect(ehEntregaPorApp(null)).toBe(false)
    expect(ehEntregaPorApp({})).toBe(false)
  })

  it("o texto do aceite diz de quem é a responsabilidade", () => {
    expect(TEXTO_ENTREGA_APP).toMatch(/chama e paga o carro/)
    expect(TEXTO_ENTREGA_APP).toMatch(/responsabilidade/)
  })
})
