import { describe, expect, it } from "vitest"
import {
  descontoEmCentavos,
  liquidoDoCartao,
  normalizarTaxas,
  normalizarWhatsapp,
  prepararVenda,
  situacao,
  taxasVazias,
  textoLembretePagamento,
  totais,
  type NovaVenda,
} from "./venda-externa"

const item = { variant_id: "v1", produto: "Short Aurora", variacao: "M / Grafitti", sku: "ECL-1004-M", quantidade: 1, preco_centavos: 15900 }
const base: NovaVenda = { data: "2026-10-15", canal: "whatsapp", cliente_nome: "Samara Lima", cliente_whatsapp: "(31) 99207-9671", itens: [item], pagamento: "pix" }
const taxas = normalizarTaxas({ debito: 1.99, credito: { "1": 3.49, "3": 5.5 } })
const linha = (v: NovaVenda, t = taxas) => {
  const r = prepararVenda(v, "2026-10-15", t)
  if ("erro" in r) throw new Error(r.erro)
  return r.linha
}

describe("vendas fora do site", () => {
  it("whatsapp e totais", () => {
    expect(normalizarWhatsapp("(31) 99207-9671")).toBe("5531992079671")
    expect(totais([item, { ...item, quantidade: 2 }], 1000)).toEqual({ subtotal: 47700, total: 46700 })
  })
  it("desconto em R$ ou em %", () => {
    expect(descontoEmCentavos(15900, "valor", 1000)).toBe(1000)
    expect(descontoEmCentavos(15900, "valor", 99999)).toBe(15900)
    expect(descontoEmCentavos(15900, "percentual", 0, 20)).toBe(3180)
    expect(descontoEmCentavos(15900, "percentual", 0, 100)).toBe(15900)
    const l = linha({ ...base, tipo_desconto: "percentual", desconto_percentual: 10 })
    expect(l.desconto_centavos).toBe(1590)
    expect(l.total_centavos).toBe(14310)
  })
  it("embaixadora sempre 20%; creator custo zero vira cortesia paga, ou % livre", () => {
    const e = linha({ ...base, perfil: "embaixadora", tipo_desconto: "valor", desconto_centavos: 5 })
    expect([e.perfil, e.desconto_percentual, e.total_centavos]).toEqual(["embaixadora", 20, 12720])
    const c = linha({ ...base, perfil: "creator", desconto_percentual: 100 })
    expect([c.perfil, c.total_centavos, c.pagamento, c.pago]).toEqual(["creator", 0, "cortesia", true])
    const c2 = linha({ ...base, perfil: "creator", desconto_percentual: 50 })
    expect([c2.total_centavos, c2.pagamento]).toEqual([7950, "pix"])
    expect(prepararVenda({ ...base, perfil: "creator" }, "2026-10-15")).toEqual({ erro: "Creator: informe o % de desconto (100 = custo zero)." })
    const u = linha({ ...base, perfil: "uso_proprio", tipo_desconto: "valor", desconto_centavos: 500 })
    expect([u.perfil, u.desconto_percentual, u.total_centavos, u.pagamento, u.pago]).toEqual(["uso_proprio", 100, 0, "cortesia", true])
  })
  it("cartão: parcelas + taxa da maquininha → líquido; sem taxa configurada, recusa", () => {
    expect(liquidoDoCartao(15900, 1, taxas)).toEqual({ taxa_percentual: 3.49, taxa_centavos: 555, liquido_centavos: 15345 })
    expect(liquidoDoCartao(15900, 0, taxas)?.taxa_centavos).toBe(316)
    expect(liquidoDoCartao(15900, 2, taxas)).toBeNull()
    const l = linha({ ...base, pagamento: "cartao", parcelas: 3 })
    expect([l.parcelas, l.taxa_percentual, l.taxa_centavos, l.liquido_centavos]).toEqual([3, 5.5, 875, 15025])
    expect(prepararVenda({ ...base, pagamento: "cartao", parcelas: 2 }, "2026-10-15", taxas)).toEqual({ erro: "Cartão: a taxa para 2x não está configurada. Preencha as taxas da maquininha na tela." })
    expect(prepararVenda({ ...base, pagamento: "cartao" }, "2026-10-15", taxas)).toEqual({ erro: "Cartão: informe débito ou o número de parcelas (1 a 12)." })
    expect(linha(base).liquido_centavos).toBe(15900)
  })
  it("taxas: normaliza lixo", () => {
    expect(normalizarTaxas(null)).toEqual(taxasVazias())
    expect(normalizarTaxas({ debito: "x", credito: { "1": 3.456, "13": 9 } }).credito["1"]).toBe(3.46)
  })
  it("pix nasce paga; a prazo exige data futura e nasce em aberto", () => {
    expect(linha(base).pago).toBe(true)
    expect(prepararVenda({ ...base, pagamento: "a_prazo" }, "2026-10-15")).toEqual({ erro: "Venda a prazo: informe a data combinada do pagamento." })
    expect(prepararVenda({ ...base, pagamento: "a_prazo", vencimento: "2026-10-01" }, "2026-10-15")).toEqual({ erro: "A data combinada do pagamento já passou." })
    const p = linha({ ...base, pagamento: "a_prazo", vencimento: "2026-10-20" })
    expect([p.pago, p.vencimento]).toEqual([false, "2026-10-20"])
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
  })
  it("lembrete com valor e data", () => {
    expect(textoLembretePagamento("Samara Lima", 15900, "2026-10-20")).toContain("20/10/2026")
    expect(textoLembretePagamento("Samara Lima", 15900, "2026-10-20")).toContain("R$ 159,00")
  })
})
