import { describe, expect, it } from "vitest"
import { corpoDoEnvio } from "./medusa"

const ITEMS = [{ id: "item_1", quantity: 1 }]

describe("corpoDoEnvio", () => {
  it("sem label: só os itens, sem a chave labels", () => {
    expect(corpoDoEnvio(ITEMS)).toEqual({ items: ITEMS })
  })

  it("rastreio + PDF: labels com os três campos", () => {
    const body = corpoDoEnvio(ITEMS, {
      tracking_number: "AA123456789BR",
      tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
      label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
    })
    expect(body).toEqual({
      items: ITEMS,
      labels: [
        {
          tracking_number: "AA123456789BR",
          tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
          label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
        },
      ],
    })
  })

  it("PDF sem rastreio ainda (achado da revisão 2026-09-19, round 3): grava o label mesmo assim, tracking_number vira string vazia", () => {
    const body = corpoDoEnvio(ITEMS, { tracking_number: "", tracking_url: "", label_url: "https://sandbox.superfrete.com/etiqueta.pdf" })
    expect(body).toEqual({
      items: ITEMS,
      labels: [{ tracking_number: "", tracking_url: "", label_url: "https://sandbox.superfrete.com/etiqueta.pdf" }],
    })
  })

  it("label com os três campos vazios: não grava labels (nada pra mostrar no Cockpit)", () => {
    const body = corpoDoEnvio(ITEMS, { tracking_number: "", tracking_url: "", label_url: "" })
    expect(body).toEqual({ items: ITEMS })
  })

  it("objeto com uma chave extra (ex.: carrier_order_id): a chave extra NUNCA vai pro corpo enviado ao Medusa", () => {
    const label = { tracking_number: "AA1", tracking_url: "url", label_url: "pdf", carrier_order_id: "ord_1" }
    const body = corpoDoEnvio(ITEMS, label) as { labels: Record<string, unknown>[] }
    expect(body.labels[0]).toEqual({ tracking_number: "AA1", tracking_url: "url", label_url: "pdf" })
    expect(body.labels[0]).not.toHaveProperty("carrier_order_id")
  })
})
