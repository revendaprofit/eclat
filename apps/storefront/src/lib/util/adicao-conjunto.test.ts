import { describe, expect, it, vi } from "vitest"
import {
  adicionarEmSequencia,
  mensagemFalha,
  pendentes,
  type ProgressoAdicao,
  type SlotAdicao,
} from "./adicao-conjunto"

const slot = (indice: number, variantId: string, titulo: string): SlotAdicao => ({
  indice,
  variantId,
  titulo,
  metadata: { conjunto_slot: `handle#${indice}#1` },
})

const TOP = slot(0, "var_top_p", "Top Aura")
const LEGGING = slot(1, "var_leg_m", "Legging Vértice")
const LEGGING_G = slot(1, "var_leg_g", "Legging Vértice")
const TOP_M = slot(0, "var_top_m", "Top Aura")

describe("pendentes", () => {
  it("pula só o slot cuja variante atual já entrou na sacola", () => {
    const progresso: ProgressoAdicao = { 0: TOP.variantId }
    expect(pendentes([TOP, LEGGING], progresso)).toEqual([LEGGING])
  })

  it("não pula um slot cuja variante mudou desde a adição", () => {
    const progresso: ProgressoAdicao = { 0: TOP.variantId, 1: LEGGING.variantId }
    expect(pendentes([TOP, LEGGING_G], progresso)).toEqual([LEGGING_G])
  })
})

describe("adicionarEmSequencia", () => {
  it("1. tudo pendente → adiciona os 2 em ordem, adicionadosAgora 2, falha null", async () => {
    const adicionar = vi.fn().mockResolvedValue(undefined)
    const r = await adicionarEmSequencia([TOP, LEGGING], {}, adicionar)

    expect(adicionar).toHaveBeenCalledTimes(2)
    expect(adicionar.mock.calls.map((c) => (c[0] as SlotAdicao).variantId)).toEqual([
      TOP.variantId,
      LEGGING.variantId,
    ])
    expect(r.adicionadosAgora).toEqual([TOP, LEGGING])
    expect(r.falha).toBeNull()
    expect(r.progresso).toEqual({ 0: TOP.variantId, 1: LEGGING.variantId })
  })

  it("2. falha na 2ª → progresso tem só a 1ª, falha = 2ª, mock chamado 2×", async () => {
    const adicionar = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("network"))
    const r = await adicionarEmSequencia([TOP, LEGGING], {}, adicionar)

    expect(adicionar).toHaveBeenCalledTimes(2)
    expect(r.progresso).toEqual({ 0: TOP.variantId })
    expect(r.falha).toEqual(LEGGING)
    expect(r.adicionadosAgora).toEqual([TOP])
  })

  it("3. retry com o mesmo progresso e mesmas variantes → só a 2ª é chamada, sem duplicata", async () => {
    const adicionar = vi.fn().mockResolvedValue(undefined)
    const r = await adicionarEmSequencia([TOP, LEGGING], { 0: TOP.variantId }, adicionar)

    expect(adicionar).toHaveBeenCalledTimes(1)
    expect((adicionar.mock.calls[0][0] as SlotAdicao).variantId).toBe(LEGGING.variantId)
    expect(r.adicionadosAgora).toEqual([LEGGING])
    expect(r.progresso).toEqual({ 0: TOP.variantId, 1: LEGGING.variantId })
  })

  it("4. retry após trocar a variante da 2ª → só a nova 2ª", async () => {
    const adicionar = vi.fn().mockResolvedValue(undefined)
    const r = await adicionarEmSequencia([TOP, LEGGING_G], { 0: TOP.variantId }, adicionar)

    expect(adicionar).toHaveBeenCalledTimes(1)
    expect((adicionar.mock.calls[0][0] as SlotAdicao).variantId).toBe(LEGGING_G.variantId)
    expect(r.progresso).toEqual({ 0: TOP.variantId, 1: LEGGING_G.variantId })
    expect(r.falha).toBeNull()
  })

  it("5. trocar a variante da 1ª após sucesso parcial → a 1ª nova é adicionada, a 2ª também", async () => {
    const adicionar = vi.fn().mockResolvedValue(undefined)
    const r = await adicionarEmSequencia([TOP_M, LEGGING], { 0: TOP.variantId }, adicionar)

    expect(adicionar.mock.calls.map((c) => (c[0] as SlotAdicao).variantId)).toEqual([
      TOP_M.variantId,
      LEGGING.variantId,
    ])
    expect(r.progresso).toEqual({ 0: TOP_M.variantId, 1: LEGGING.variantId })
    expect(r.adicionadosAgora).toEqual([TOP_M, LEGGING])
  })

  it("7. ordem: slots fora de ordem entram por `indice`", async () => {
    const adicionar = vi.fn().mockResolvedValue(undefined)
    await adicionarEmSequencia([LEGGING, TOP], {}, adicionar)

    expect(adicionar.mock.calls.map((c) => (c[0] as SlotAdicao).indice)).toEqual([0, 1])
  })

  it("8. nunca chama `adicionar` em paralelo", async () => {
    let emVoo = 0
    let sobreposicao = false
    const adicionar = vi.fn(async () => {
      emVoo++
      if (emVoo > 1) sobreposicao = true
      await new Promise((r) => setTimeout(r, 5))
      if (emVoo > 1) sobreposicao = true
      emVoo--
    })

    await adicionarEmSequencia([TOP, LEGGING, slot(2, "var_x", "Meia")], {}, adicionar)

    expect(adicionar).toHaveBeenCalledTimes(3)
    expect(sobreposicao).toBe(false)
  })
})

describe("mensagemFalha", () => {
  it("6a. nomeia quem já está na sacola e quem falhou", () => {
    expect(mensagemFalha(LEGGING, [TOP, LEGGING], { 0: TOP.variantId })).toBe(
      "Top Aura já está na sacola. Não foi possível adicionar Legging Vértice. Tente de novo."
    )
  })

  it("6b. sem peça na sacola: só quem falhou", () => {
    expect(mensagemFalha(LEGGING, [TOP, LEGGING], {})).toBe(
      "Não foi possível adicionar Legging Vértice. Tente de novo."
    )
  })
})
