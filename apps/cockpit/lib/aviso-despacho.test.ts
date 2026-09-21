import { describe, expect, it } from "vitest"
import { avisoAoDespacharComEtiqueta, lerAvisoDespacho, textoDoAviso } from "./aviso-despacho"

const AGORA = "2026-09-21T15:07:00.000Z"

describe("avisoAoDespacharComEtiqueta", () => {
  it("avisar + tem telefone → pendente desde agora (o backend manda quando o código existir)", () => {
    expect(avisoAoDespacharComEtiqueta({ notificar: true, temTelefone: true, agora: AGORA })).toEqual({
      status: "pendente",
      desde: AGORA,
    })
  })

  it("aviso desligado no despacho → dispensado (com ou sem telefone)", () => {
    expect(avisoAoDespacharComEtiqueta({ notificar: false, temTelefone: true, agora: AGORA })).toEqual({
      status: "dispensado",
      em: AGORA,
    })
    expect(avisoAoDespacharComEtiqueta({ notificar: false, temTelefone: false, agora: AGORA })).toEqual({
      status: "dispensado",
      em: AGORA,
    })
  })

  it("avisar mas sem telefone → sem_telefone", () => {
    expect(avisoAoDespacharComEtiqueta({ notificar: true, temTelefone: false, agora: AGORA })).toEqual({
      status: "sem_telefone",
      em: AGORA,
    })
  })
})

describe("lerAvisoDespacho", () => {
  it("ausente → null", () => {
    expect(lerAvisoDespacho(undefined)).toBeNull()
    expect(lerAvisoDespacho(null)).toBeNull()
    expect(lerAvisoDespacho({})).toBeNull()
    expect(lerAvisoDespacho({ frete: { status: "paga" } })).toBeNull()
  })

  it("malformado → null", () => {
    expect(lerAvisoDespacho("texto")).toBeNull()
    expect(lerAvisoDespacho({ frete: "x" })).toBeNull()
    expect(lerAvisoDespacho({ frete: { aviso_despacho: "pendente" } })).toBeNull()
    expect(lerAvisoDespacho({ frete: { aviso_despacho: [] } })).toBeNull()
    expect(lerAvisoDespacho({ frete: { aviso_despacho: { status: 1 } } })).toBeNull()
  })

  it("status desconhecido → null", () => {
    expect(lerAvisoDespacho({ frete: { aviso_despacho: { status: "atrasado" } } })).toBeNull()
  })

  it("válido → devolve o aviso, só com os campos conhecidos e em texto", () => {
    expect(
      lerAvisoDespacho({
        frete: { status: "paga", aviso_despacho: { status: "enviado", em: AGORA, por: "webhook", extra: 1 } },
      })
    ).toEqual({ status: "enviado", em: AGORA, por: "webhook" })
    expect(lerAvisoDespacho({ frete: { aviso_despacho: { status: "pendente", desde: AGORA, em: 5 } } })).toEqual({
      status: "pendente",
      desde: AGORA,
    })
  })
})

describe("textoDoAviso", () => {
  it("null → null", () => {
    expect(textoDoAviso(null)).toBeNull()
  })

  it("pendente", () => {
    expect(textoDoAviso({ status: "pendente", desde: AGORA })).toBe("Aviso à cliente: aguardando o código de rastreio.")
  })

  it("enviado → hora de Brasília", () => {
    expect(textoDoAviso({ status: "enviado", em: AGORA })).toBe("Aviso à cliente enviado às 12:07.")
  })

  it("enviado sem hora válida → frase sem hora", () => {
    expect(textoDoAviso({ status: "enviado" })).toBe("Aviso à cliente enviado.")
    expect(textoDoAviso({ status: "enviado", em: "não é data" })).toBe("Aviso à cliente enviado.")
  })

  it("dispensado", () => {
    expect(textoDoAviso({ status: "dispensado", em: AGORA })).toBe("Aviso à cliente desligado no despacho.")
  })

  it("sem_telefone", () => {
    expect(textoDoAviso({ status: "sem_telefone", em: AGORA })).toBe(
      "Pedido sem telefone: a cliente não será avisada pelo WhatsApp."
    )
  })

  it("expirado", () => {
    expect(textoDoAviso({ status: "expirado", em: AGORA })).toBe(
      "O código de rastreio não apareceu em 24 h. Avise a cliente à mão."
    )
  })
})
