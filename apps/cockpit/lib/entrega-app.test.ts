import { describe, expect, it } from "vitest"
import { aceiteDaEntregaApp, ehEntregaPorApp } from "./entrega-app"

const pedido = (m: unknown[]) => ({ shipping_methods: m } as never)

describe("entrega por aplicativo (Cockpit)", () => {
  it("reconhece pelo que o servidor gravou", () => {
    expect(ehEntregaPorApp(pedido([{ data: { tipo: "entrega_app" } }]))).toBe(true)
  })

  it("reconhece pelo provider quando o dado antigo não tem tipo", () => {
    expect(ehEntregaPorApp(pedido([{ shipping_option: { provider_id: "entrega-app_entrega-app" }, data: {} }]))).toBe(true)
  })

  it("pedido normal de transportadora não é confundido", () => {
    expect(ehEntregaPorApp(pedido([{ shipping_option: { provider_id: "superfrete_superfrete" }, data: { servico: 2 } }]))).toBe(false)
    expect(ehEntregaPorApp(pedido([]))).toBe(false)
    expect(ehEntregaPorApp(null)).toBe(false)
  })

  it("mostra a data do aceite em pt-BR", () => {
    const texto = aceiteDaEntregaApp(pedido([{ data: { tipo: "entrega_app", aceite_em: "2026-09-20T14:35:00.000Z" } }]))
    expect(texto).toMatch(/20\/09\/2026/)
  })

  it("sem aceite (ou com data inválida) devolve null", () => {
    expect(aceiteDaEntregaApp(pedido([{ data: { tipo: "entrega_app" } }]))).toBeNull()
    expect(aceiteDaEntregaApp(pedido([{ data: { aceite_em: "ontem" } }]))).toBeNull()
  })
})
