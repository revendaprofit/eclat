import { describe, expect, it } from "vitest"
import { normalizarWhatsapp, prepararVenda, situacao, textoLembretePagamento, totais, type NovaVenda } from "./venda-externa"

const item = { variant_id: "v1", produto: "Short Aurora", variacao: "M / Grafitti", sku: "ECL-1004-M", quantidade: 1, preco_centavos: 15900 }
const base: NovaVenda = { data: "2026-10-15", canal: "whatsapp", cliente_nome: "Samara Lima", cliente_whatsapp: "(31) 99207-9671", itens: [item], pagamento: "pix" }

describe("vendas fora do site", () => {
  it("whatsapp e totais", () => {
    expect(normalizarWhatsapp("(31) 99207-9671")).toBe("5531992079671")
    expect(totais([item, { ...item, quantidade: 2 }], 1000)).toEqual({ subtotal: 47700, total: 46700 })
  })
  it("pix nasce paga; a prazo exige data futura e nasce em aberto", () => {
    const r = prepararVenda(base, "2026-10-15")
    expect("linha" in r && r.linha.pago).toBe(true)
    expect("linha" in r && r.linha.total_centavos).toBe(15900)
    expect(prepararVenda({ ...base, pagamento: "a_prazo" }, "2026-10-15")).toEqual({ erro: "Venda a prazo: informe a data combinada do pagamento." })
    expect(prepararVenda({ ...base, pagamento: "a_prazo", vencimento: "2026-10-01" }, "2026-10-15")).toEqual({ erro: "A data combinada do pagamento já passou." })
    const p = prepararVenda({ ...base, pagamento: "a_prazo", vencimento: "2026-10-20" }, "2026-10-15")
    expect("linha" in p && p.linha.pago).toBe(false)
    expect("linha" in p && p.linha.vencimento).toBe("2026-10-20")
  })
  it("recusa sem nome, sem whatsapp válido ou sem peças", () => {
    expect(prepararVenda({ ...base, cliente_nome: " " }, "2026-10-15")).toEqual({ erro: "Informe o nome da cliente." })
    expect(prepararVenda({ ...base, cliente_whatsapp: "123" }, "2026-10-15")).toEqual({ erro: "Confira o WhatsApp: DDD + número, 10 ou 11 dígitos." })
    expect(prepararVenda({ ...base, itens: [] }, "2026-10-15")).toEqual({ erro: "Escolha pelo menos uma peça." })
  })
  it("situação da cobrança", () => {
    const v = { pago: false, vencimento: "2026-10-20", cancelada_em: null, pagamento: "a_prazo" as const }
    expect(situacao(v, "2026-10-15")).toBe("a_vencer")
    expect(situacao(v, "2026-10-20")).toBe("vence_hoje")
    expect(situacao(v, "2026-10-21")).toBe("atrasada")
    expect(situacao({ ...v, pago: true }, "2026-10-21")).toBe("paga")
    expect(situacao({ ...v, cancelada_em: "x" }, "2026-10-21")).toBe("cancelada")
  })
  it("lembrete com valor e data", () => {
    expect(textoLembretePagamento("Samara Lima", 15900, "2026-10-20")).toContain("20/10/2026")
    expect(textoLembretePagamento("Samara Lima", 15900, "2026-10-20")).toContain("R$ 159,00")
  })
})
