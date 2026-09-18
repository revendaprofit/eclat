import { formaPagamentoDoPedido } from "../fiscal-pagamento"

describe("formaPagamentoDoPedido", () => {
  it("provedor manual vira 99 COM descrição (99 sem descrição é rejeição 441)", () => {
    const p = formaPagamentoDoPedido(["pp_system_default"])
    expect(p.forma).toBe("99")
    expect(p.descricao).toBe("Pagamento online")
  })

  it("provedor desconhecido também vira 99 com descrição — nunca adivinha Pix ou cartão", () => {
    const p = formaPagamentoDoPedido(["pp_algum_gateway_novo"])
    expect(p.forma).toBe("99")
    expect(p.descricao).not.toBeNull()
  })

  it("pedido sem pagamento registrado vira 99 com descrição", () => {
    expect(formaPagamentoDoPedido([])).toEqual({ forma: "99", descricao: "Pagamento online" })
  })
})
