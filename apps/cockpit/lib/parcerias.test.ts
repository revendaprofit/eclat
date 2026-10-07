import { describe, expect, it } from "vitest"
import {
  comissaoCentavos,
  mensagemParaParceira,
  mesAnterior,
  mesDe,
  normalizarWhatsApp,
  resumoParceria,
  totais,
  validarEdicao,
  validarNovaParceria,
  vendasDaParceria,
  type PedidoComCupom,
} from "./parcerias"

const PATY = { codigo: "PATY10", comissao_percentual: 5 }
const pedido = (n: number, extra: Partial<PedidoComCupom> = {}): PedidoComCupom => ({
  id: `order_${n}`,
  display_id: n,
  status: "pending",
  payment_status: "captured",
  item_total: 233.1,
  created_at: "2026-09-25T15:00:00.000Z",
  email: "cliente@ex.com",
  promotions: [{ code: "PATY10" }],
  ...extra,
})

describe("comissão", () => {
  it("é % sobre o valor pago das peças, em centavos, meio para cima", () => {
    expect(comissaoCentavos(23310, 5)).toBe(1166) // 1165,5 → 1166
    expect(comissaoCentavos(31800, 5)).toBe(1590)
    expect(comissaoCentavos(23310, 0)).toBe(0)
    expect(comissaoCentavos(0, 5)).toBe(0)
  })

  it("Solaris com PATY10: cliente paga 233,10 e a parceira recebe 11,66", () => {
    const [v] = vendasDaParceria([pedido(1)], PATY)
    expect(v.base_centavos).toBe(23310)
    expect(v.comissao_centavos).toBe(1166)
    expect(v.conta).toBe(true)
    expect(v.motivo).toBeNull()
  })
})

describe("o que conta", () => {
  it("só pedidos com o cupom da parceira (comparação sem diferenciar maiúsculas)", () => {
    const lista = vendasDaParceria(
      [pedido(1), pedido(2, { promotions: [{ code: "ERIKA20" }] }), pedido(3, { promotions: [{ code: "paty10" }] }), pedido(4, { promotions: null })],
      PATY
    )
    expect(lista.map((v) => v.display_id)).toEqual([1, 3])
  })

  it("cancelado não conta e não gera comissão", () => {
    const [v] = vendasDaParceria([pedido(1, { status: "canceled" })], PATY)
    expect(v.conta).toBe(false)
    expect(v.motivo).toBe("cancelado")
    expect(v.comissao_centavos).toBe(0)
  })

  it("aguardando pagamento aparece na lista mas não conta", () => {
    const [v] = vendasDaParceria([pedido(1, { payment_status: "awaiting" })], PATY)
    expect(v.conta).toBe(false)
    expect(v.motivo).toBe("aguardando pagamento")
    expect(totais([v])).toEqual({ pedidos: 0, base_centavos: 0, comissao_centavos: 0 })
  })

  it("pagamento autorizado (cartão) conta como o DRE", () => {
    expect(vendasDaParceria([pedido(1, { payment_status: "authorized" })], PATY)[0].conta).toBe(true)
  })

  it("mais recentes primeiro", () => {
    const lista = vendasDaParceria([pedido(1, { created_at: "2026-09-01T10:00:00Z" }), pedido(2, { created_at: "2026-09-20T10:00:00Z" })], PATY)
    expect(lista.map((v) => v.display_id)).toEqual([2, 1])
  })
})

describe("períodos e resumo", () => {
  it("mesDe e mesAnterior cobrem fevereiro e a virada de ano", () => {
    expect(mesDe("2026-02-10")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" })
    expect(mesAnterior("2026-01-15")).toEqual({ inicio: "2025-12-01", fim: "2025-12-31" })
    expect(mesAnterior("2026-03-31")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" })
  })

  it("separa mês atual, mês anterior, total e pendentes", () => {
    const vendas = vendasDaParceria(
      [
        pedido(1, { created_at: "2026-09-25T15:00:00Z" }),
        pedido(2, { created_at: "2026-08-30T15:00:00Z", item_total: 318 }),
        pedido(3, { created_at: "2026-09-02T15:00:00Z", payment_status: "awaiting" }),
        pedido(4, { created_at: "2026-07-02T15:00:00Z" }),
      ],
      PATY
    )
    const r = resumoParceria(vendas, "2026-09-25")
    expect(r.mes_atual).toEqual({ pedidos: 1, base_centavos: 23310, comissao_centavos: 1166 })
    expect(r.mes_anterior).toEqual({ pedidos: 1, base_centavos: 31800, comissao_centavos: 1590 })
    expect(r.total.pedidos).toBe(3)
    expect(r.total.comissao_centavos).toBe(1166 + 1590 + 1166)
    expect(r.pendentes).toBe(1)
  })
})

describe("formulário", () => {
  it("normaliza código, @ e WhatsApp; aplica os padrões 10% / 5%", () => {
    const r = validarNovaParceria({ codigo: " paty10 ", nome: " Paty ", instagram: "@paty.fit", whatsapp: "(31) 98888-7777" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valor).toEqual({
        codigo: "PATY10",
        nome: "Paty",
        instagram: "paty.fit",
        whatsapp: "5531988887777",
        desconto_percentual: 10,
        comissao_percentual: 5,
        notas: null,
      })
    }
  })

  it("recusa código com símbolo, nome vazio e percentual fora da faixa", () => {
    const r = validarNovaParceria({ codigo: "PATY-10", nome: "", comissao_percentual: 150 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros).toHaveLength(3)
  })

  it("WhatsApp: aceita com e sem 55, com máscara; vazio vira null", () => {
    expect(normalizarWhatsApp("+55 31 98888-7777")).toBe("5531988887777")
    expect(normalizarWhatsApp("3133334444")).toBe("553133334444")
    expect(normalizarWhatsApp("")).toBeNull()
  })

  it("edição só leva os campos enviados e nunca o desconto", () => {
    const r = validarEdicao({ instagram: "@paty", ativa: false, desconto_percentual: 50 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.valor).toEqual({ instagram: "paty", ativa: false })
    expect(validarEdicao({}).ok).toBe(false)
    expect(validarEdicao({ ativa: "sim" }).ok).toBe(false)
  })
})

describe("mensagem para a parceira", () => {
  it("cita código, desconto e comissão; sem comissão não promete nada", () => {
    expect(mensagemParaParceira({ codigo: "PATY10", nome: "Paty Silva", desconto_percentual: 10, comissao_percentual: 5 })).toBe(
      "Oi, Paty! Seu cupom na use.ÉCLAT é PATY10: 10% nas peças para quem usar, em useeclat.com.br. E 5% de tudo o que for pago com o seu cupom é seu — fechamos e pagamos todo mês."
    )
    expect(mensagemParaParceira({ codigo: "ERIKA20", nome: "Erika", desconto_percentual: 20, comissao_percentual: 0 })).not.toContain("é seu")
  })
})
