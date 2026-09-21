import { describe, expect, it } from "vitest"
import { avisoAoDespacharComEtiqueta, avisoPedeAtencao, lerRespostaDoBackend, avisoPeloBackend, lerAvisoDespacho, textoDoAviso, type StatusAviso } from "./aviso-despacho"

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

describe("avisoPeloBackend (interruptor SUPERFRETE_AVISO_PELO_BACKEND)", () => {
  it("ausente → false (padrão: o Cockpit avisa na hora, como antes)", () => {
    expect(avisoPeloBackend({})).toBe(false)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: undefined })).toBe(false)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "" })).toBe(false)
  })

  it("qualquer coisa que não seja true → false", () => {
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "false" })).toBe(false)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "1" })).toBe(false)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "sim" })).toBe(false)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "truee" })).toBe(false)
  })

  it("true → true, tolerando espaço e maiúscula (um espaço colado no Vercel não pode desligar em silêncio)", () => {
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "true" })).toBe(true)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: " true " })).toBe(true)
    expect(avisoPeloBackend({ SUPERFRETE_AVISO_PELO_BACKEND: "TRUE" })).toBe(true)
  })
})

// Estados que o remetente único do backend grava (Task 3/4): a tela e o alerta pós-despacho
// precisam conhecê-los — a resposta da rota do backend pode vir com qualquer um deles.
describe("estados do remetente único do backend", () => {
  it("lerAvisoDespacho aceita enviando, sem_whatsapp e incerto (e lê desde_envio)", () => {
    expect(
      lerAvisoDespacho({ frete: { aviso_despacho: { status: "enviando", desde: AGORA, desde_envio: AGORA, por: "cockpit" } } })
    ).toEqual({ status: "enviando", desde: AGORA, desde_envio: AGORA, por: "cockpit" })
    expect(lerAvisoDespacho({ frete: { aviso_despacho: { status: "sem_whatsapp", em: AGORA } } })).toEqual({
      status: "sem_whatsapp",
      em: AGORA,
    })
    expect(
      lerAvisoDespacho({ frete: { aviso_despacho: { status: "incerto", incerto_em: AGORA, motivo: "x", desde_envio: 3 } } })
    ).toEqual({ status: "incerto" })
  })

  it("tolera `tentado_em` (gravado pelo backend quando uma tentativa falha) e o ignora", () => {
    expect(lerAvisoDespacho({ frete: { aviso_despacho: { status: "pendente", desde: AGORA, tentado_em: AGORA } } })).toEqual({
      status: "pendente",
      desde: AGORA,
    })
  })

  it("a resposta da rota do backend ({ aviso_despacho }) é lida com os estados novos", () => {
    for (const status of ["enviando", "enviado", "sem_whatsapp", "incerto"]) {
      expect(lerAvisoDespacho({ frete: { aviso_despacho: { status } } })?.status).toBe(status)
    }
  })

  it("textoDoAviso: enviando", () => {
    expect(textoDoAviso({ status: "enviando", desde_envio: AGORA })).toBe("Aviso à cliente sendo enviado agora.")
  })

  it("textoDoAviso: sem_whatsapp", () => {
    expect(textoDoAviso({ status: "sem_whatsapp", em: AGORA })).toBe(
      "O número da cliente não tem WhatsApp. Avise por outro canal."
    )
  })

  it("textoDoAviso: incerto", () => {
    expect(textoDoAviso({ status: "incerto" })).toBe(
      "Não deu para confirmar se o aviso saiu. Confira na conversa antes de mandar de novo."
    )
  })
})

describe("avisoPedeAtencao (tom de atenção na tela)", () => {
  it("atenção: o operador precisa agir (expirado, sem_telefone, sem_whatsapp, incerto) e o pendente (frase longa, decisão da Task 5)", () => {
    for (const status of ["pendente", "expirado", "sem_telefone", "sem_whatsapp", "incerto"] as StatusAviso[]) {
      expect([status, avisoPedeAtencao({ status })]).toEqual([status, true])
    }
  })

  it("sem atenção: enviando, enviado, dispensado e ausente", () => {
    for (const status of ["enviando", "enviado", "dispensado"] as StatusAviso[]) {
      expect([status, avisoPedeAtencao({ status })]).toEqual([status, false])
    }
    expect(avisoPedeAtencao(null)).toBe(false)
  })
})

describe("lerRespostaDoBackend (POST /admin/frete/aviso-despacho/{id} → { aviso_despacho })", () => {
  it("{ aviso_despacho: null } é resposta VÁLIDA (o pedido não tem aviso) — não é 'fora do formato'", () => {
    expect(lerRespostaDoBackend({ aviso_despacho: null })).toEqual({ valida: true, aviso: null })
  })

  it("aviso conhecido → válida com o aviso lido", () => {
    expect(lerRespostaDoBackend({ aviso_despacho: { status: "incerto", motivo: "x" } })).toEqual({
      valida: true,
      aviso: { status: "incerto" },
    })
  })

  it("fora do formato → inválida", () => {
    for (const dados of [null, undefined, "x", [], {}, { aviso_despacho: "enviado" }, { aviso_despacho: { status: "atrasado" } }]) {
      expect([dados, lerRespostaDoBackend(dados)]).toEqual([dados, { valida: false }])
    }
  })
})
