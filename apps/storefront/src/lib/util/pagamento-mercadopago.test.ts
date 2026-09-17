import { describe, expect, it } from "vitest"
import {
  descricaoDoPagamento,
  isMercadoPago,
  lerOpcao,
  opcoesDePagamento,
  pixVigente,
  tempoRestante,
  valorDaOpcao,
} from "./pagamento-mercadopago"

const MP = "pp_mercadopago_mercadopago"
const AGORA = Date.parse("2026-09-17T18:00:00Z")
const EM_20_MIN = "2026-09-17T18:20:00Z"

const sessaoPix = (extra: Record<string, unknown> = {}, status = "pending") => ({
  provider_id: MP,
  status,
  data: { metodo: "pix", qr_code: "00020126...", qr_code_base64: "aGk=", valor_total: "213.90", expira_em: EM_20_MIN, ...extra },
})
const carrinho = (sessoes: unknown[], total = 213.9) =>
  ({ total, payment_collection: { payment_sessions: sessoes } }) as never

describe("opções de pagamento", () => {
  it("desdobra o Mercado Pago em Pix e cartão e mantém os outros providers", () => {
    expect(opcoesDePagamento([{ id: "pp_system_default" }, { id: MP }], true)).toEqual([
      { valor: "pp_system_default", providerId: "pp_system_default" },
      { valor: `${MP}#pix`, providerId: MP, metodo: "pix" },
      { valor: `${MP}#cartao`, providerId: MP, metodo: "cartao" },
    ])
  })

  it("sem a chave pública, só o Pix aparece (o Brick não teria como tokenizar)", () => {
    expect(opcoesDePagamento([{ id: MP }], false).map((o) => o.metodo)).toEqual(["pix"])
  })

  it("valorDaOpcao e lerOpcao são inversos", () => {
    expect(lerOpcao(valorDaOpcao(MP, "cartao"))).toEqual({ providerId: MP, metodo: "cartao" })
    expect(lerOpcao("pp_system_default")).toEqual({ providerId: "pp_system_default", metodo: undefined })
    expect(lerOpcao(`${MP}#boleto`).metodo).toBeUndefined()
  })

  it("isMercadoPago reconhece só o provider certo", () => {
    expect(isMercadoPago(MP)).toBe(true)
    expect(isMercadoPago("pp_system_default")).toBe(false)
    expect(isMercadoPago(undefined)).toBe(false)
  })
})

describe("pixVigente", () => {
  it("devolve o Pix gerado para o valor atual e ainda válido", () => {
    expect(pixVigente(carrinho([sessaoPix()]), AGORA)).toEqual({
      qrCode: "00020126...",
      qrCodeBase64: "aGk=",
      ticketUrl: undefined,
      expiraEm: Date.parse(EM_20_MIN),
    })
  })

  it("nunca mostra Pix com valor diferente do carrinho", () => {
    expect(pixVigente(carrinho([sessaoPix()], 250), AGORA)).toBeNull()
  })

  it("compara valor por centavos, não por representação (213.9 === \"213.90\")", () => {
    expect(pixVigente(carrinho([sessaoPix({ valor_total: "213.9" })]), AGORA)).not.toBeNull()
  })

  it("ignora Pix expirado", () => {
    expect(pixVigente(carrinho([sessaoPix({ expira_em: "2026-09-17T17:59:00Z" })]), AGORA)).toBeNull()
  })

  it("ignora sessão sem validade conhecida, de cartão, de outro provider ou fora de pending", () => {
    expect(pixVigente(carrinho([sessaoPix({ expira_em: undefined })]), AGORA)).toBeNull()
    expect(pixVigente(carrinho([sessaoPix({ metodo: "cartao" })]), AGORA)).toBeNull()
    expect(pixVigente(carrinho([{ ...sessaoPix(), provider_id: "pp_system_default" }]), AGORA)).toBeNull()
    expect(pixVigente(carrinho([sessaoPix({}, "error")]), AGORA)).toBeNull()
    expect(pixVigente(carrinho([]), AGORA)).toBeNull()
  })
})

describe("tempoRestante", () => {
  it("formata mm:ss e nunca fica negativo", () => {
    expect(tempoRestante(AGORA + 29 * 60000 + 5000, AGORA)).toBe("29:05")
    expect(tempoRestante(AGORA - 1000, AGORA)).toBe("00:00")
  })
})

describe("descricaoDoPagamento", () => {
  it("descreve Pix e cartão a partir dos dados do pagamento", () => {
    expect(descricaoDoPagamento({ metodo: "pix" })).toBe("Pix")
    expect(descricaoDoPagamento({ metodo: "cartao", parcelas: 1 })).toBe("Cartão de crédito")
    expect(descricaoDoPagamento({ metodo: "cartao", parcelas: 3, final_cartao: "3311" })).toBe("Cartão de crédito final 3311 em 3x")
  })

  it("devolve null quando não é um pagamento do Mercado Pago", () => {
    expect(descricaoDoPagamento({})).toBeNull()
    expect(descricaoDoPagamento(null)).toBeNull()
  })
})
