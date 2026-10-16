import { textoLembretePagamento, vencidasSemLembrete } from "../venda-externa"

describe("vendas fora do site: lembrete de pagamento", () => {
  const v = (id: string, extra: Record<string, unknown>) => ({ id, cliente_nome: "Samara Lima", cliente_whatsapp: "5531992079671", total_centavos: 15900, vencimento: "2026-10-20", ...extra })
  it("só a prazo em aberto, vencendo hoje ou atrasada, sem lembrete", () => {
    const lista = vencidasSemLembrete(
      [
        v("hoje", {}),
        v("futura", { vencimento: "2026-10-25" }),
        v("paga", { pago: true }),
        v("cancelada", { cancelada_em: "x" }),
        v("ja_lembrada", { lembrete_enviado_em: "x" }),
        v("atrasada", { vencimento: "2026-10-10" }),
      ],
      "2026-10-20"
    )
    expect(lista.map((x) => x.id)).toEqual(["hoje", "atrasada"])
  })
  it("texto com nome, data e valor", () => {
    const t = textoLembretePagamento("Samara Lima", 15900, "2026-10-20")
    expect(t).toContain("Oi, Samara!")
    expect(t).toContain("20/10/2026")
    expect(t).toContain("R$ 159,00")
  })
})
