import { describe, expect, it, vi } from "vitest"
import { garantirEtiqueta, lerEstadoDoFrete, type Deps, type EstadoDoFrete } from "./etiqueta-segura"
import type { CarrierLabel } from "./shipping"

const LABEL: CarrierLabel = {
  tracking_number: "AA123456789BR",
  tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
  label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
  carrier_order_id: "ord_1",
}
const SEM_RASTREIO: CarrierLabel = { tracking_number: "", tracking_url: "", label_url: "https://sandbox.superfrete.com/etiqueta.pdf", carrier_order_id: "ord_1" }
const AGORA = "2026-09-19T12:00:00.000Z"

function deps(overrides: Partial<Deps> = {}): Deps {
  return {
    criar: vi.fn(async () => "ord_1"),
    pagar: vi.fn(async () => LABEL),
    consultar: vi.fn(async () => ({ status: "pending", label: null })),
    salvar: vi.fn(async () => {}),
    esperar: vi.fn(async () => {}),
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

  // ---- Regra A (revisão 2026-09-19 com API real): "paga" sem rastreio ainda -----------------------
  // A API real devolveu tracking VAZIO no /checkout e "pending" por alguns segundos no /order/info
  // logo depois de um pagamento que já tinha sido aceito — o status da SuperFrete é EVENTUALMENTE
  // CONSISTENTE. Uma etiqueta que NÓS já registramos como paga nunca pode voltar a pagar ou criar,
  // não importa o que a consulta disser (exceto "canceled", que é a única forma de escapar do "paga").

  it("achado 1 (API real): 'paga' sem rastreio + consulta fica 'pending' o tempo todo — NÃO paga de novo, NÃO cria outro, devolve a etiqueta registrada (com o PDF)", async () => {
    const atual: EstadoDoFrete = {
      transportadora: "superfrete", status: "paga", superfrete_id: "ord_1",
      label_url: SEM_RASTREIO.label_url, em: "2026-09-19T10:00:00.000Z",
    }
    const d = deps({ consultar: vi.fn(async () => ({ status: "pending", label: null })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(SEM_RASTREIO)
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.consultar).toHaveBeenCalledTimes(3) // esgota as tentativas de achar rastreio (TENTATIVAS_RASTREIO)
    expect(d.esperar).toHaveBeenCalledWith(4000)
  })

  it("'paga' sem rastreio + a SuperFrete acha o rastreio na 2ª tentativa — devolve com rastreio e grava de novo", async () => {
    const atual: EstadoDoFrete = {
      transportadora: "superfrete", status: "paga", superfrete_id: "ord_1",
      label_url: SEM_RASTREIO.label_url, em: "2026-09-19T10:00:00.000Z",
    }
    let chamada = 0
    const d = deps({
      consultar: vi.fn(async () => {
        chamada++
        return chamada < 2 ? { status: "pending", label: null } : { status: "released", label: LABEL }
      }),
    })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.consultar).toHaveBeenCalledTimes(2)
    expect(d.esperar).toHaveBeenCalledWith(4000)
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).toHaveBeenCalledTimes(1)
    expect(d.salvar).toHaveBeenCalledWith({
      transportadora: "superfrete", status: "paga", superfrete_id: "ord_1",
      tracking_number: LABEL.tracking_number, tracking_url: LABEL.tracking_url, label_url: LABEL.label_url,
      em: AGORA,
    })
  })

  it("'paga' sem rastreio + `consultar` falha: devolve a etiqueta já registrada, NÃO lança, NÃO paga de novo (dinheiro já gasto — o operador precisa conseguir terminar)", async () => {
    const atual: EstadoDoFrete = {
      transportadora: "superfrete", status: "paga", superfrete_id: "ord_1",
      label_url: SEM_RASTREIO.label_url, em: "2026-09-19T10:00:00.000Z",
    }
    const d = deps({
      consultar: vi.fn(async () => {
        throw new Error("SuperFrete /api/v0/order/info/ord_1 → HTTP 500")
      }),
    })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(SEM_RASTREIO)
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it("'paga' sem rastreio + consulta devolve 'canceled': lança erro de etiqueta cancelada — nunca compra outra sozinho sobre um registro pago", async () => {
    const atual: EstadoDoFrete = {
      transportadora: "superfrete", status: "paga", superfrete_id: "ord_1",
      label_url: SEM_RASTREIO.label_url, em: "2026-09-19T10:00:00.000Z",
    }
    const d = deps({ consultar: vi.fn(async () => ({ status: "canceled", label: null })) })
    await expect(garantirEtiqueta(d, atual)).rejects.toThrow(
      "A etiqueta ord_1 consta como CANCELADA na SuperFrete. Confira o painel antes de tentar de novo; para comprar outra, limpe o frete do pedido."
    )
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
  })

  // ---- Regra B (antiga regra 2): "pendente" + id — agora com 2ª checagem depois de esperar --------

  it("regra B: '1ª consulta released' — confere e NÃO paga de novo (sem precisar esperar)", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "released", label: LABEL })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.consultar).toHaveBeenCalledWith("ord_1")
    expect(d.consultar).toHaveBeenCalledTimes(1)
    expect(d.esperar).not.toHaveBeenCalled()
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

  it("regra B: 1ª consulta 'pending', 2ª (depois de esperar 8s) 'released' — NÃO paga de novo", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    let chamada = 0
    const d = deps({
      consultar: vi.fn(async () => {
        chamada++
        return chamada === 1 ? { status: "pending", label: null } : { status: "released", label: LABEL }
      }),
    })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.consultar).toHaveBeenCalledTimes(2)
    expect(d.esperar).toHaveBeenCalledTimes(1)
    expect(d.esperar).toHaveBeenCalledWith(8000)
    expect(d.salvar).toHaveBeenCalledTimes(1)
  })

  it("regra B: 'pending' nas duas consultas (não é só lentidão de status, é mesmo não pago) — só então paga, com o MESMO id, não cria outro", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "pending", label: null })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.consultar).toHaveBeenCalledTimes(2)
    expect(d.esperar).toHaveBeenCalledTimes(1)
    expect(d.esperar).toHaveBeenCalledWith(8000)
    expect(d.pagar).toHaveBeenCalledTimes(1)
    expect(d.pagar).toHaveBeenCalledWith("ord_1")
    expect(d.criar).not.toHaveBeenCalled()
  })

  it("regra B: 'canceled' na 1ª consulta — comprar um novo é legítimo (passa pela regra 4 inteira)", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "canceled", label: null })) })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.criar).toHaveBeenCalledTimes(1)
    expect(d.pagar).toHaveBeenCalledWith("ord_1")
    expect(d.salvar).toHaveBeenCalledTimes(3)
  })

  it("regra B: 'canceled' só na 2ª consulta (depois do 'pending' inicial) — também cai na regra 4", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    let chamada = 0
    const d = deps({
      consultar: vi.fn(async () => {
        chamada++
        return chamada === 1 ? { status: "pending", label: null } : { status: "canceled", label: null }
      }),
    })
    const label = await garantirEtiqueta(d, atual)
    expect(label).toEqual(LABEL)
    expect(d.criar).toHaveBeenCalledTimes(1)
    expect(d.pagar).toHaveBeenCalledWith("ord_1")
  })

  it("regra B: status desconhecido/inesperado na 1ª consulta — não paga nem cria, avisa o operador", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({ consultar: vi.fn(async () => ({ status: "on_hold", label: null })) })
    await expect(garantirEtiqueta(d, atual)).rejects.toThrow(
      'A etiqueta ord_1 está com status "on_hold" na SuperFrete. Confira no painel da SuperFrete antes de tentar de novo.'
    )
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it("regra B: status desconhecido só depois do 'pending' inicial (na 2ª consulta) — também avisa o operador", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    let chamada = 0
    const d = deps({
      consultar: vi.fn(async () => {
        chamada++
        return chamada === 1 ? { status: "pending", label: null } : { status: "on_hold", label: null }
      }),
    })
    await expect(garantirEtiqueta(d, atual)).rejects.toThrow('está com status "on_hold"')
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
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
    expect(d.consultar).not.toHaveBeenCalled()
    expect(d.salvar).toHaveBeenCalledTimes(3)
  })

  it("regra B: se `consultar` falhar na 1ª consulta (ex.: 404 na SuperFrete), não tenta pagar nem criar — erro propaga", async () => {
    const atual: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: "2026-09-19T10:00:00.000Z" }
    const d = deps({
      consultar: vi.fn(async () => {
        throw new Error("SuperFrete /api/v0/order/info/ord_1 → HTTP 404: order not found")
      }),
    })
    await expect(garantirEtiqueta(d, atual)).rejects.toThrow("HTTP 404")
    expect(d.pagar).not.toHaveBeenCalled()
    expect(d.criar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  // ---- Regra 4 (compra do zero) ---------------------------------------------------------------

  it("regra 4: compra do zero — iniciando → pendente → paga, nessa ordem (etiqueta já vem com rastreio: sem busca extra)", async () => {
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
    expect(d.esperar).not.toHaveBeenCalled() // já tinha rastreio, não precisou procurar
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

  it("regra 4, `pagar` devolve SEM rastreio (achado 3, API real): grava 'paga' (sem rastreio) ANTES de procurar — nunca fica só 'pendente' esperando", async () => {
    const ordem: string[] = []
    const d = deps({
      pagar: vi.fn(async () => SEM_RASTREIO),
      esperar: vi.fn(async (ms: number) => {
        ordem.push(`esperar:${ms}`)
      }),
      consultar: vi.fn(async () => {
        ordem.push("consultar")
        return { status: "released", label: LABEL }
      }),
      salvar: vi.fn(async (estado: EstadoDoFrete) => {
        ordem.push(`salvar:${estado.status}:${estado.tracking_number ? "com-rastreio" : "sem-rastreio"}`)
      }),
    })
    const label = await garantirEtiqueta(d, null)
    expect(label).toEqual(LABEL)
    expect(ordem).toEqual([
      "salvar:iniciando:sem-rastreio",
      "salvar:pendente:sem-rastreio",
      "salvar:paga:sem-rastreio", // grava PAGO mesmo sem rastreio, ANTES de procurar (item C)
      "esperar:4000",
      "consultar",
      "salvar:paga:com-rastreio", // achou rastreio, grava de novo
    ])
    expect(d.criar).toHaveBeenCalledTimes(1)
    expect(d.pagar).toHaveBeenCalledTimes(1)
  })

  it("regra 4, `pagar` devolve sem rastreio e a SuperFrete nunca acha em 3 tentativas: devolve com tracking_number vazio e o PDF, sem lançar", async () => {
    const d = deps({
      pagar: vi.fn(async () => SEM_RASTREIO),
      consultar: vi.fn(async () => ({ status: "pending", label: null })),
    })
    const label = await garantirEtiqueta(d, null)
    expect(label).toEqual(SEM_RASTREIO)
    expect(d.consultar).toHaveBeenCalledTimes(3)
    expect(d.esperar).toHaveBeenCalledTimes(3)
    expect(d.esperar).toHaveBeenCalledWith(4000)
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

    // retentativa: já existe estado "pendente" com o id — não cria outro frete; como a consulta some
    // continua "pending" nas duas checagens (regra B), só então paga, com o mesmo id.
    const estadoPendente: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: AGORA }
    const d2 = deps({ consultar: vi.fn(async () => ({ status: "pending", label: null })) })
    const label = await garantirEtiqueta(d2, estadoPendente)
    expect(label).toEqual(LABEL)
    expect(d2.criar).not.toHaveBeenCalled()
    expect(d2.consultar).toHaveBeenCalledWith("ord_1")
    expect(d2.pagar).toHaveBeenCalledWith("ord_1")
  })

  it("regra 4, `salvar` falha logo depois de `criar` (gravar 'pendente'): erro traz o id pro operador não perder o frete, e NÃO tenta pagar", async () => {
    const d = deps({
      salvar: vi.fn(async (estado: EstadoDoFrete) => {
        if (estado.status === "pendente") throw new Error("Falha de rede ao gravar metadata")
      }),
    })
    let erro: Error | undefined
    try {
      await garantirEtiqueta(d, null)
    } catch (e) {
      erro = e as Error
    }
    expect(erro?.message).toContain("ord_1")
    expect(erro?.message).toContain("Falha de rede ao gravar metadata")
    expect(erro?.message).toContain("Nada foi cobrado")
    expect(d.pagar).not.toHaveBeenCalled()
  })

  it("regra 4, `salvar` falha depois de `pagar` (gravar 'paga'): o erro propaga, mas a retentativa reaproveita a etiqueta sem pagar de novo", async () => {
    const d1 = deps({
      salvar: vi.fn(async (estado: EstadoDoFrete) => {
        if (estado.status === "paga") throw new Error("Falha ao gravar o metadata final")
      }),
    })
    await expect(garantirEtiqueta(d1, null)).rejects.toThrow("Falha ao gravar o metadata final")
    expect(d1.pagar).toHaveBeenCalledTimes(1)

    // retentativa: o estado ficou "pendente" (o salvar de "paga" falhou, nunca foi persistido) —
    // a SuperFrete já mostra a etiqueta liberada, então a regra B reaproveita sem pagar de novo.
    const estadoPendente: EstadoDoFrete = { transportadora: "superfrete", status: "pendente", superfrete_id: "ord_1", em: AGORA }
    const d2 = deps({ consultar: vi.fn(async () => ({ status: "released", label: LABEL })) })
    const label = await garantirEtiqueta(d2, estadoPendente)
    expect(label).toEqual(LABEL)
    expect(d2.pagar).not.toHaveBeenCalled()
    // pagar foi chamado UMA vez no total, somando as duas tentativas (só em d1)
  })
})
