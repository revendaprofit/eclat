import { describe, expect, it, vi } from "vitest"
import { garantirEtiqueta, lerEstadoDoFrete, type Deps, type EstadoDoFrete } from "./etiqueta-segura"
import type { CarrierLabel } from "./shipping"

const LABEL: CarrierLabel = {
  tracking_number: "AA123456789BR",
  tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
  label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
  carrier_order_id: "ord_1",
}
const AGORA = "2026-09-19T12:00:00.000Z"

function deps(overrides: Partial<Deps> = {}): Deps {
  return {
    criar: vi.fn(async () => "ord_1"),
    pagar: vi.fn(async () => LABEL),
    consultar: vi.fn(async () => ({ status: "pending", label: null })),
    salvar: vi.fn(async () => {}),
    agora: () => new Date(AGORA),
    ...overrides,
  }
}

describe("lerEstadoDoFrete", () => {
  it("sem metadata (ou metadata vazio), devolve null", () => {
    expect(lerEstadoDoFrete(undefined)).toBeNull()
    expect(lerEstadoDoFrete(null)).toBeNull()
    expect(lerEstadoDoFrete({})).toBeNull()
  })

  it("frete malformado (não é objeto), devolve null", () => {
    expect(lerEstadoDoFrete({ frete: "oops" })).toBeNull()
  })

  it("frete de outra transportadora, devolve null (não interfere na SuperFrete)", () => {
    expect(
      lerEstadoDoFrete({ frete: { transportadora: "correios-direto", status: "paga", em: "2026-09-19T10:00:00.000Z" } })
    ).toBeNull()
  })

  it("status desconhecido, devolve null", () => {
    expect(
      lerEstadoDoFrete({ frete: { transportadora: "superfrete", status: "algo", em: "2026-09-19T10:00:00.000Z" } })
    ).toBeNull()
  })

  it("sem `em`, devolve null", () => {
    expect(lerEstadoDoFrete({ frete: { transportadora: "superfrete", status: "paga" } })).toBeNull()
  })

  it("frete válido, devolve o estado completo", () => {
    const estado = lerEstadoDoFrete({
      frete: {
        transportadora: "superfrete",
        status: "paga",
        superfrete_id: "ord_1",
        tracking_number: "AA1",
        tracking_url: "url",
        label_url: "pdf",
        em: "2026-09-19T10:00:00.000Z",
      },
    })
    expect(estado).toEqual({
      transportadora: "superfrete",
      status: "paga",
      superfrete_id: "ord_1",
      tracking_number: "AA1",
      tracking_url: "url",
      label_url: "pdf",
      em: "2026-09-19T10:00:00.000Z",
    })
  })

  it("frete válido mas incompleto (só o essencial), devolve só os campos presentes", () => {
    const estado = lerEstadoDoFrete({ frete: { transportadora: "superfrete", status: "iniciando", em: "2026-09-19T10:00:00.000Z" } })
    expect(estado).toEqual({ transportadora: "superfrete", status: "iniciando", em: "2026-09-19T10:00:00.000Z" })
  })
})

describe("garantirEtiqueta — segurança contra pagar em dobro", () => {
  it("regra 1: etiqueta já paga com rastreio — devolve do estado, ZERO chamadas à SuperFrete (corrige o achado 1: retentativa pós-pagamento não compra de novo)", async () => {
    const atual: EstadoDoFrete = {
      transportadora: "superfrete",
      status: "paga",
      superfrete_id: "ord_1",
      tracking_number: LABEL.tracking_number,
      tracking_url: LABEL.tracking_url,
      label_url: LABEL.label_url,
      em: "2026-09-19T10:00:00.000Z",
    }
    const d = deps()
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.consultar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it("regra 2a: frete pendente e a SuperFrete já mostra etiqueta liberada — confere e NÃO paga de novo", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "released", label: LABEL })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.consultar).toHaveBeenCalledWith("ord_1")
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).toHaveBeenCalledTimes(1)
    expect(d.salvar).toHaveBeenCalledWith({
      transportadora: "superfrete",
      status: "paga",
      superfrete_id: "ord_1",
      tracking_number: LABEL.tracking_number,
      tracking_url: LABEL.tracking_url,
      label_url: LABEL.label_url,
      em: AGORA,
    })
  })

  it("regra 2b: frete criado mas nunca chegou a pagar (pending na SuperFrete) — paga com o MESMO id, não cria outro", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "pending", label: null })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.pagar).toHaveBeenCalledWith("ord_1")
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).toHaveBeenCalledTimes(1)
  })

  it("regra 2c: frete cancelado na SuperFrete — comprar um novo é legítimo (passa pela regra 4 inteira)", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "canceled", label: null })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.criar).toHaveBeenCalledTimes(1)
    expect(d.pagar).toHaveBeenCalledWith("ord_1")
    expect(d.salvar).toHaveBeenCalledTimes(3)
  })

  it("regra 2d: status desconhecido/inesperado na SuperFrete — não paga nem cria, avisa o operador", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "on_hold", label: null })) })
    await expect(garantirEtiqueta(d, atual)).rejects.toThrow(
      'A etiqueta ord_1 está com status "on_hold" na SuperFrete. Confira no painel da SuperFrete antes de tentar de novo.'
    )
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it("regra 3a: compra 'iniciando' há menos de 2 minutos — bloqueia, ZERO chamadas (corrige o achado 3: duplo clique)", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "iniciando", em: "2026-09-19T11:59:00.000Z" }
    const d = deps()
    await expect(garantirEtiqueta(d, atual)).rejects.toThrow(
      "Já existe uma compra de etiqueta em andamento para este pedido. Aguarde 2 minutos e tente de novo."
    )
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.consultar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it("regra 3b: 'iniciando' há mais de 2 minutos — considera abandonada e compra do zero", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "iniciando", em: "2026-09-19T11:00:00.000Z" }
    const d = deps()
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.criar).toHaveBeenCalledTimes(1)
    expect(d.salvar).toHaveBeenCalledTimes(3)
  })

  it("regra 4: compra do zero — iniciando → pendente → paga, nessa ordem", async () => {
    const ordem: string[] = []
    const d = deps({
      criar: vi.fn(async () => {
        ordem.push("criar")
        return "ord_1"
      }),
      pagar: vi.fn(async (id: string) => {
        ordem.push(`pagar:${id}`)
        return LABEL
      }),
      salvar: vi.fn(async (estado: EstadoDoFrete) => {
        ordem.push(`salvar:${estado.status}`)
      }),
    })
    const label = await garantirEtiqueta(d, null)
    expect(label).toEqual(LABEL)
    expect(ordem).toEqual(["salvar:iniciando", "criar", "salvar:pendente", "pagar:ord_1", "salvar:paga"])
    expect(d.salvar).toHaveBeenNthCalledWith(1, { transportadora: "superfrete", status: "iniciando", em: AGORA })
    expect(d.salvar).toHaveBeenNthCalledWith(2, { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: AGORA })
    expect(d.salvar).toHaveBeenNthCalledWith(3, {
      transportadora: "superfrete",
      status: "paga",
      superfrete_id: "ord_1",
      tracking_number: LABEL.tracking_number,
      tracking_url: LABEL.tracking_url,
      label_url: LABEL.label_url,
      em: AGORA,
    })
  })

  it("regra 4, `criar` falha: grava 'iniciando' com data zerada para NÃO travar a próxima tentativa por 2 minutos", async () => {
    const d = deps({
      criar: vi.fn(async () => {
        throw new Error("CEP do pedido inválido: corrija o endereço antes de gerar a etiqueta.")
      }),
    })
    await expect(garantirEtiqueta(d, null)).rejects.toThrow("CEP do pedido inválido")
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.salvar).toHaveBeenCalledTimes(2)
    expect(d.salvar).toHaveBeenNthCalledWith(1, { transportadora: "superfrete", status: "iniciando", em: AGORA })
    expect(d.salvar).toHaveBeenNthCalledWith(2, { transportadora: "superfrete", status: "iniciando", em: "1970-01-01T00:00:00.000Z" })
  })

  it("depois de `criar` falhar, a retentativa NÃO fica bloqueada e compra do zero de novo (achado 1: erro instantâneo não pode virar trava de 2 min)", async () => {
    const estadoAposFalha: EstadoDoFrete = { transportadora: "superfrete", status: "iniciando", em: "1970-01-01T00:00:00.000Z" }
    const d = deps()
    const label = await garantirEtiqueta(d, estadoAposFalha)
    expect(label).toEqual(LABEL)
    expect(d.criar).toHaveBeenCalledTimes(1)
  })

  it("regra 4, `pagar` falha (achado 2, ex.: timeout no /checkout): o frete fica 'pendente' com o id — e a retentativa NÃO cria outro frete", async () => {
    const d1 = deps({
      pagar: vi.fn(async () => {
        throw new Error("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
      }),
    })
    await expect(garantirEtiqueta(d1, null)).rejects.toThrow("Sem saldo na SuperFrete")
    expect(d1.criar).toHaveBeenCalledTimes(1)
    expect(d1.salvar).toHaveBeenCalledTimes(2)
    expect(d1.salvar).toHaveBeenNthCalledWith(2, { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: AGORA })

    // retentativa: já existe estado "pendente" com o id — não cria outro frete, só consulta e paga o mesmo.
    const estadoPendente: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: AGORA }
    const d2 = deps({ consultar: vi.fn(async () => ({ status: "pending", label: null })) })
    const label = await garantirEtiqueta(d2, estadoPendente)
    expect(label).toEqual(LABEL)
    expect(d2.criar).not.toHaveBeenCalled()
    expect(d2.consultar).toHaveBeenCalledWith("ord_1")
    expect(d2.pagar).toHaveBeenCalledWith("ord_1")
  })
})
