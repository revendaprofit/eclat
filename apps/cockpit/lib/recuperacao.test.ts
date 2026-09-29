import { describe, expect, it } from "vitest"
import { inicioDoDiaLocal, resumir, validarConfig, type LinhaRecuperacao } from "./recuperacao"

describe("validarConfig", () => {
  it("aceita a configuração decidida pelo dono", () => {
    const r = validarConfig({
      whatsapp_ativo: true, persona: " Camila ", cupom: "bemvinda10", janela_inicio: "09:00", janela_fim: "19:00",
      max_abordagens_dia: 15, intervalo_min_min: 15, intervalo_max_min: 60,
    })
    expect(r).toEqual({
      campos: {
        whatsapp_ativo: true, persona: "Camila", cupom: "BEMVINDA10", janela_inicio: "09:00", janela_fim: "19:00",
        max_abordagens_dia: 15, intervalo_min_min: 15, intervalo_max_min: 60, falhas_seguidas: 0,
      },
    })
  })
  it("recusa limites que arriscam o número e horários trocados", () => {
    expect(validarConfig({ max_abordagens_dia: 100 })).toHaveProperty("erro")
    expect(validarConfig({ intervalo_min_min: 1 })).toHaveProperty("erro")
    expect(validarConfig({ intervalo_min_min: 60, intervalo_max_min: 15 })).toHaveProperty("erro")
    expect(validarConfig({ janela_inicio: "19:00", janela_fim: "09:00" })).toHaveProperty("erro")
    expect(validarConfig({ janela_inicio: "9h" })).toHaveProperty("erro")
    expect(validarConfig({ whatsapp_ativo: "sim" })).toHaveProperty("erro")
    expect(validarConfig({ persona: "" })).toHaveProperty("erro")
  })
  it("ignora campos que não são da configuração", () => {
    expect(validarConfig({ falhas_seguidas: 9, qualquer: 1 })).toEqual({ campos: {} })
  })
})

describe("resumir", () => {
  const base = {
    id: "1", gatilho: "carrinho", etapa: "aguardando", motivo_fim: null, nome: null, contato: null, email: null, dados: null,
    elegivel_em: "", abordagem_em: null, abordagem_texto: null, resposta_em: null, oferta_em: null, oferta_texto: null, email_em: null, criado_em: "",
  } as LinhaRecuperacao
  it("conta fila, abordagens de hoje, respostas, e-mails e compras", () => {
    const r = resumir(
      [
        base,
        { ...base, etapa: "abordada", abordagem_em: "2026-09-29T13:00:00Z" },
        { ...base, etapa: "oferta_enviada", abordagem_em: "2026-09-28T13:00:00Z", resposta_em: "x" },
        { ...base, etapa: "encerrada", motivo_fim: "comprou", email_em: "x" },
      ],
      "2026-09-29T03:00:00.000Z"
    )
    expect(r).toEqual({ na_fila: 1, abordagens_hoje: 1, abordadas: 2, responderam: 1, emails: 1, compraram: 1 })
  })
  it("dia começa à meia-noite de Brasília", () => {
    expect(inicioDoDiaLocal(new Date("2026-09-29T02:59:00Z"))).toBe("2026-09-28T03:00:00.000Z")
  })
})
