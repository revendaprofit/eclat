import { mensagemDeRecusa } from "../recusas"

describe("recusas (mensagens em pt-BR)", () => {
  it("traduz os motivos confirmados na F0 (sandbox real, 2026-09-17)", () => {
    expect(mensagemDeRecusa("rejected_by_issuer")).toMatch(/banco emissor/)
    expect(mensagemDeRecusa("required_call_for_authorize")).toMatch(/autorize|autoriza/i)
    expect(mensagemDeRecusa("insufficient_amount")).toMatch(/limite/)
    expect(mensagemDeRecusa("bad_filled_card_data")).toMatch(/dados do cartão/)
  })

  it("nunca devolve o código técnico como mensagem", () => {
    for (const motivo of ["rejected_by_issuer", "insufficient_amount", "cc_rejected_high_risk"]) {
      expect(mensagemDeRecusa(motivo)).not.toContain("_")
    }
  })

  it("devolve mensagem genérica com oferta de alternativa pra motivo desconhecido", () => {
    expect(mensagemDeRecusa("um_codigo_que_nao_existe")).toMatch(/outra forma de pagamento|Tenta de novo/)
  })

  it("devolve mensagem genérica quando o motivo não vem", () => {
    expect(mensagemDeRecusa(undefined)).toBeTruthy()
    expect(mensagemDeRecusa(null)).toBeTruthy()
  })
})
