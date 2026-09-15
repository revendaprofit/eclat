import { describe, expect, it } from "vitest"
import {
  avaliarLeitura,
  ehSkuDaEtiqueta,
  normalizarCodigo,
  resumoConferencia,
  validarConferencia,
  type ItemPedido,
} from "./leitor"

describe("normalizarCodigo", () => {
  it("mantém o SKU da etiqueta", () => {
    expect(normalizarCodigo("ECL-1001-P")).toBe("ECL-1001-P")
  })
  it("corrige minúsculas, espaços e hífen trocado pelo layout do teclado", () => {
    expect(normalizarCodigo("  ecl-1003-m \n")).toBe("ECL-1003-M")
    expect(normalizarCodigo("ECL'1003'M")).toBe("ECL-1003-M")
    expect(normalizarCodigo("ECL/1005/GG")).toBe("ECL-1005-GG")
    expect(normalizarCodigo("ECL_1002_G")).toBe("ECL-1002-G")
  })
  it("remove prefixo AIM e sujeira", () => {
    expect(normalizarCodigo("]C0ECL-1010-P")).toBe("ECL-1010-P")
    expect(normalizarCodigo("--ECL--1007--M--")).toBe("ECL-1007-M")
  })
  it("vazio continua vazio", () => {
    expect(normalizarCodigo("   ")).toBe("")
  })
  it("reconhece o formato da etiqueta", () => {
    expect(ehSkuDaEtiqueta("ECL-1001-P")).toBe(true)
    expect(ehSkuDaEtiqueta("ECL-TA-TEL-P")).toBe(false)
  })
})

const PEDIDO: ItemPedido[] = [
  { item_id: "l1", sku: "ECL-1001-M", titulo: "Top Aurora", variante: "M / Telha", quantidade: 1 },
  { item_id: "l2", sku: "ECL-1003-M", titulo: "Short Aurora", variante: "M / Telha", quantidade: 2 },
]

describe("resumoConferencia", () => {
  it("fecha quando cada SKU foi bipado a quantidade exata", () => {
    const r = resumoConferencia(PEDIDO, ["ECL-1001-M", "ecl-1003-m", "ECL'1003'M"])
    expect(r.completa).toBe(true)
    expect(r.linhas.map((l) => [l.sku, l.bipado, l.status])).toEqual([
      ["ECL-1001-M", 1, "ok"],
      ["ECL-1003-M", 2, "ok"],
    ])
    expect(r.pecasEsperadas).toBe(3)
    expect(r.pecasBipadas).toBe(3)
  })
  it("faltando, excedente e peça fora do pedido não fecham", () => {
    const r = resumoConferencia(PEDIDO, ["ECL-1001-M", "ECL-1001-M", "ECL-1003-G"])
    expect(r.completa).toBe(false)
    expect(r.linhas.map((l) => l.status)).toEqual(["excedente", "faltando"])
    expect(r.foraDoPedido).toEqual([{ codigo: "ECL-1003-G", vezes: 1 }])
  })
  it("mesmo SKU em duas linhas do pedido soma o esperado", () => {
    const r = resumoConferencia(
      [...PEDIDO, { item_id: "l3", sku: "ECL-1001-M", titulo: "Top Aurora", variante: "M / Telha", quantidade: 1 }],
      ["ECL-1001-M", "ECL-1001-M", "ECL-1003-M", "ECL-1003-M"]
    )
    expect(r.linhas[0]).toMatchObject({ sku: "ECL-1001-M", esperado: 2, bipado: 2, status: "ok" })
    expect(r.completa).toBe(true)
  })
  it("item sem SKU nunca fecha a conferência", () => {
    const r = resumoConferencia([{ item_id: "x", sku: null, titulo: "Brinde", variante: null, quantidade: 1 }], [])
    expect(r.linhas[0].status).toBe("sem_codigo")
    expect(r.completa).toBe(false)
  })
})

describe("avaliarLeitura", () => {
  it("ok com quantas faltam daquele SKU", () => {
    expect(avaliarLeitura(PEDIDO, [], "ECL-1003-M")).toEqual({ tipo: "ok", sku: "ECL-1003-M", faltam: 1 })
    expect(avaliarLeitura(PEDIDO, ["ECL-1003-M"], "ECL-1003-M")).toEqual({ tipo: "ok", sku: "ECL-1003-M", faltam: 0 })
  })
  it("excedente, fora do pedido e inválido", () => {
    expect(avaliarLeitura(PEDIDO, ["ECL-1001-M"], "ECL-1001-M")).toEqual({ tipo: "excedente", sku: "ECL-1001-M" })
    expect(avaliarLeitura(PEDIDO, [], "ECL-1002-M")).toEqual({ tipo: "fora_do_pedido", sku: "ECL-1002-M" })
    expect(avaliarLeitura(PEDIDO, [], "  ")).toEqual({ tipo: "invalido" })
  })
})

describe("validarConferencia (servidor)", () => {
  const agora = new Date("2026-09-14T22:00:00Z")
  it("sem conferência enviada, recusa", () => {
    expect(validarConferencia(PEDIDO, null, "op@eclat.local", agora)).toEqual({ ok: false, erro: "Confira as peças com o leitor antes de despachar." })
  })
  it("completa → registro ok, sem motivo", () => {
    const r = validarConferencia(PEDIDO, { leituras: ["ECL-1001-M", "ECL-1003-M", "ECL-1003-M"], motivo: "ignorado" }, "op@eclat.local", agora)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.registro.status).toBe("ok")
      expect(r.registro.motivo).toBeNull()
      expect(r.registro.operador_email).toBe("op@eclat.local")
      expect(r.registro.em).toBe("2026-09-14T22:00:00.000Z")
    }
  })
  it("divergente sem motivo recusa; com motivo registra", () => {
    const leituras = ["ECL-1001-M", "ECL-1003-M"]
    expect(validarConferencia(PEDIDO, { leituras }, null, agora).ok).toBe(false)
    expect(validarConferencia(PEDIDO, { leituras, motivo: "   " }, null, agora).ok).toBe(false)
    const r = validarConferencia(PEDIDO, { leituras, motivo: "etiqueta do short rasgada" }, null, agora)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.registro.status).toBe("divergente")
      expect(r.registro.motivo).toBe("etiqueta do short rasgada")
      expect(r.registro.itens.find((i) => i.sku === "ECL-1003-M")).toMatchObject({ esperado: 2, bipado: 1 })
    }
  })
})
