// Aceite da Task 4 dos avisos de entrega (spec 2026-09-20-avisos-entrega-superfrete-design.md §9,
// itens 2, 3 e 4): os dois chamadores que faltavam do remetente único `tentarAvisoDeDespacho`.
//   - POST /admin/frete/aviso-despacho/:order_id — o Cockpit chama logo depois do despacho;
//   - verificarAvisosPendentes — o que o job de 5 min roda.
//
// Nada aqui toca serviço real. A Evolution (WhatsApp) e a SuperFrete (`GET /api/v0/order/info/{id}`)
// são servidores HTTP em 127.0.0.1, com as variáveis no process.env ANTES de o runner subir o app
// (lib/evolution.ts lê EVOLUTION_API_URL no carregamento do módulo). Token, chave, telefone e
// etiquetas são literais fictícios. Arquivo separado do aviso-despacho.spec.ts de propósito: o job
// varre o banco inteiro, e os pedidos que os testes de lá deixam em "pendente" contaminariam a contagem.
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asValue } from "@medusajs/framework/awilix"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(240 * 1000)

const TELEFONE = "31999990000"
const ETIQUETA = "sfid_rota_job_teste"
const CODIGO = "AA123456789BR"

// ---- Evolution simulada ----
// Atraso antes de responder: usado para o Cockpit "desistir" (fechar a conexão) no meio do envio.
let atrasoEvolutionMs = 0
// "pendurado": recebe e nunca responde (o envio estoura os 15 s → incerto). "503": falha antes de
// entregar (volta a pendente). "400": número sem WhatsApp (sem_whatsapp, desfecho de UM pedido).
let modoEvolution: "ok" | "pendurado" | "503" | "400" = "ok"
const pendurados: import("node:http").ServerResponse[] = []
// Toda requisição de envio que chegou, entregue ou não.
let requisicoesEvolution = 0
// Quantas mensagens a Evolution falsa está atendendo ao mesmo tempo (o job manda EM SEQUÊNCIA).
let emVoo = 0
let maxEmVoo = 0
const whatsappEnviados: { number: string; text: string }[] = []
let servidorEvolution: Server

// ---- SuperFrete simulada: `order/info` por id de etiqueta ----
const infoDasEtiquetas = new Map<string, { status: number; corpo: unknown }>()
const consultasSuperfrete: string[] = []
let servidorSuperfrete: Server

function ouvir(servidor: Server): Promise<string> {
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok(`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`)))
}

async function subirSimulados(): Promise<void> {
  servidorEvolution = createServer((req, res) => {
    let corpo = ""
    req.on("data", (p) => (corpo += p))
    req.on("end", async () => {
      if (!req.url?.startsWith("/message/sendText/")) {
        res.writeHead(404).end("{}")
        return
      }
      requisicoesEvolution++
      if (modoEvolution === "pendurado") {
        pendurados.push(res)
        return
      }
      if (modoEvolution === "503") {
        res.writeHead(503, { "content-type": "application/json" }).end("{}")
        return
      }
      const { number, text } = JSON.parse(corpo || "{}")
      if (modoEvolution === "400") {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ response: { message: [{ exists: false, jid: `${number}@s.whatsapp.net` }] } }))
        return
      }
      whatsappEnviados.push({ number, text })
      emVoo++
      maxEmVoo = Math.max(maxEmVoo, emVoo)
      if (atrasoEvolutionMs) await new Promise((r) => setTimeout(r, atrasoEvolutionMs))
      emVoo--
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ key: { id: "msg_1" } }))
    })
  })
  servidorSuperfrete = createServer((req, res) => {
    const m = /^\/api\/v0\/order\/info\/([^/?]+)$/.exec(req.url ?? "")
    if (!m || req.method !== "GET") {
      res.writeHead(404).end("{}")
      return
    }
    consultasSuperfrete.push(decodeURIComponent(m[1]))
    const r = infoDasEtiquetas.get(decodeURIComponent(m[1])) ?? { status: 404, corpo: { message: "order not found" } }
    res.writeHead(r.status, { "content-type": "application/json" }).end(JSON.stringify(r.corpo))
  })
  const [urlEvolution, urlSuperfrete] = await Promise.all([ouvir(servidorEvolution), ouvir(servidorSuperfrete)])
  process.env.EVOLUTION_API_URL = urlEvolution
  process.env.EVOLUTION_API_KEY = "chave-ficticia-do-teste"
  process.env.EVOLUTION_INSTANCE = "eclat-teste"
  process.env.SUPERFRETE_TOKEN = "token-ficticio-do-teste"
  process.env.SUPERFRETE_CONTACT_EMAIL = "teste@example.com"
  process.env.SUPERFRETE_FROM_POSTAL_CODE = "01001000"
  process.env.SUPERFRETE_BASE_URL = urlSuperfrete
  delete process.env.RESEND_API_KEY
}

const pronto = subirSimulados()

const minutosAtras = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let pedidos: IOrderModuleService
    let admin: Record<string, string>
    let verificar: typeof import("../../src/lib/aviso-despacho").verificarAvisosPendentes

    beforeAll(async () => {
      await pronto
      admin = (await criarAdmin(api, getContainer())).headers
      pedidos = getContainer().resolve(Modules.ORDER)
      // Import dinâmico: a lib/evolution.ts precisa carregar com as variáveis já no process.env.
      verificar = (await import("../../src/lib/aviso-despacho.js")).verificarAvisosPendentes
    })

    afterAll(() => {
      for (const r of pendurados) r.destroy()
      servidorEvolution.close()
      servidorSuperfrete.close()
    })

    beforeEach(() => {
      atrasoEvolutionMs = 0
      modoEvolution = "ok"
      for (const r of pendurados.splice(0)) r.destroy()
      requisicoesEvolution = 0
      consultasSuperfrete.length = 0
      maxEmVoo = 0
      whatsappEnviados.length = 0
      infoDasEtiquetas.clear()
    })

    const FRETE_DO_COCKPIT = {
      transportadora: "superfrete",
      status: "paga",
      em: "2026-09-21T10:00:00.000Z",
      superfrete_id: ETIQUETA,
      label_url: "https://exemplo.invalid/etiqueta.pdf",
    }

    async function criarPedido(frete: Record<string, unknown>, opts: { superfreteId?: string } = {}) {
      const pedido = await pedidos.createOrders({
        currency_code: "brl",
        email: "cliente@example.com",
        shipping_address: { first_name: "Ana", last_name: "Teste", city: "Belo Horizonte", country_code: "br", phone: TELEFONE },
        metadata: {
          observacao: "não mexer",
          frete: { ...FRETE_DO_COCKPIT, ...(opts.superfreteId ? { superfrete_id: opts.superfreteId } : {}), ...frete },
        },
      })
      return { id: pedido.id, display_id: pedido.display_id as number }
    }

    async function lerFrete(orderId: string): Promise<Record<string, any>> {
      const pedido = await pedidos.retrieveOrder(orderId)
      return ((pedido.metadata as Record<string, unknown> | null)?.frete ?? {}) as Record<string, any>
    }

    const pendente = (desde = minutosAtras(1)) => ({ aviso_despacho: { status: "pendente", desde } })
    const despachos = () => whatsappEnviados.filter((m) => m.text.includes("acabou de ser enviado"))
    const rota = (id: string) => `/admin/frete/aviso-despacho/${encodeURIComponent(id)}`

    describe("POST /admin/frete/aviso-despacho/:order_id (o Cockpit chama logo depois do despacho)", () => {
      it("pendente com código → 200 { aviso_despacho: enviado } e a Evolution recebe 1 mensagem", async () => {
        const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        const r = await api.post(rota(p.id), {}, { headers: admin })

        expect(r.status).toBe(200)
        expect(r.data.aviso_despacho).toMatchObject({ status: "enviado", por: "cockpit", em: expect.any(String) })
        expect(despachos()).toHaveLength(1)
        expect(despachos()[0].text).toContain(`#${p.display_id}`)
        expect(despachos()[0].text).toContain(CODIGO)
        expect((await lerFrete(p.id)).aviso_despacho).toEqual(r.data.aviso_despacho)
        expect((await lerFrete(p.id)).label_url).toBe(FRETE_DO_COCKPIT.label_url)

        // Chamar de novo não reenvia.
        const r2 = await api.post(rota(p.id), {}, { headers: admin })
        expect(r2.data.aviso_despacho.status).toBe("enviado")
        expect(despachos()).toHaveLength(1)
      })

      it("pedido sem aviso_despacho → 200 { aviso_despacho: null }, nada enviado", async () => {
        const p = await criarPedido({})
        const r = await api.post(rota(p.id), {}, { headers: admin })
        expect(r.status).toBe(200)
        expect(r.data).toEqual({ aviso_despacho: null })
        expect(whatsappEnviados).toHaveLength(0)
      })

      it("sem login → 401 e nada enviado", async () => {
        const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        const r = await api.post(rota(p.id), {}).catch((e) => e.response)
        expect(r.status).toBe(401)
        expect(whatsappEnviados).toHaveLength(0)
        expect((await lerFrete(p.id)).aviso_despacho.status).toBe("pendente")
        // Limpa: nenhum "pendente" pode sobrar para o teste do job.
        await api.post(rota(p.id), {}, { headers: admin })
      })

      it("pedido inexistente → 404 { error }", async () => {
        const r = await api.post(rota("order_nao_existe"), {}, { headers: admin }).catch((e) => e.response)
        expect(r.status).toBe(404)
        expect(typeof r.data.error).toBe("string")
        expect(whatsappEnviados).toHaveLength(0)
      })

      it("erro inesperado (a reserva explode no banco) → 500 com mensagem genérica, nada enviado, segue pendente", async () => {
        const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        // Só durante esta chamada, o knex do container é trocado por um que derruba a reserva.
        const container = getContainer()
        const pgReal = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as { raw: (...a: unknown[]) => unknown }
        const pgQueFalhaNaReserva = {
          raw: (sql: string, bindings?: unknown[]) =>
            Array.isArray(bindings) && bindings.some((b) => typeof b === "string" && b.includes('"status":"enviando"'))
              ? Promise.reject(new Error("banco fora do ar"))
              : pgReal.raw(sql, bindings),
        }
        container.register(ContainerRegistrationKeys.PG_CONNECTION, asValue(pgQueFalhaNaReserva))
        let r: any
        try {
          r = await api.post(rota(p.id), {}, { headers: admin }).catch((e) => e.response)
        } finally {
          container.register(ContainerRegistrationKeys.PG_CONNECTION, asValue(pgReal))
        }
        expect(r.status).toBe(500)
        expect(r.data.error).toMatch(/Não foi possível/)
        expect(JSON.stringify(r.data)).not.toContain("banco fora do ar")
        expect(whatsappEnviados).toHaveLength(0)
        expect((await lerFrete(p.id)).aviso_despacho.status).toBe("pendente")
        // Limpa: nenhum "pendente" pode sobrar para o teste do job.
        await api.post(rota(p.id), {}, { headers: admin })
      })

      it("o Cockpit desiste no meio (fecha a conexão): o envio continua no backend e sai UMA vez", async () => {
        const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        atrasoEvolutionMs = 1500
        // Timeout do cliente bem menor que o envio: o axios aborta e fecha a conexão.
        const r = await api.post(rota(p.id), {}, { headers: admin, timeout: 300 }).catch((e) => e)
        expect(r).toBeInstanceOf(Error)
        // O handler segue: a mensagem sai e a marca "enviado" é gravada.
        for (let i = 0; i < 40 && (await lerFrete(p.id)).aviso_despacho.status !== "enviado"; i++) await esperar(100)
        expect((await lerFrete(p.id)).aviso_despacho).toMatchObject({ status: "enviado", por: "cockpit" })
        expect(despachos()).toHaveLength(1)
      })
    })

    // O job de 5 min só chama verificarAvisosPendentes. Os testes do job ficam DEPOIS dos da rota, e
    // cada teste deixa todos os seus pedidos fora de "pendente"/"enviando" no fim: o job varre o banco
    // inteiro, então sobra de um teste viraria candidato no seguinte.
    describe("verificarAvisosPendentes (o que o job de 5 min roda)", () => {
      const dispensar = (id: string) =>
        pgReal().raw(`UPDATE "order" SET metadata = jsonb_set(metadata, '{frete,aviso_despacho,status}', '"dispensado"') WHERE id = ?`, [id])

      it("3 pedidos: pendente com código, pendente sem código na SuperFrete, enviando velho → 1 enviado, 1 pendente, 1 incerto; 1 mensagem", async () => {
        const comCodigo = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        const semCodigo = await criarPedido(pendente(), { superfreteId: "sfid_sem_codigo" })
        infoDasEtiquetas.set("sfid_sem_codigo", { status: 200, corpo: { status: "released", tracking: "", tags: [] } })
        const preso = await criarPedido({
          tracking_number: CODIGO,
          aviso_despacho: { status: "enviando", desde: minutosAtras(30), desde_envio: minutosAtras(15), por: "cockpit" },
        })
        // Um pedido já resolvido não é candidato.
        const jaEnviado = await criarPedido({ tracking_number: CODIGO, aviso_despacho: { status: "enviado", em: minutosAtras(5), por: "webhook" } })

        const r = await verificar(getContainer())

        expect(r).toEqual({ candidatos: 3, porEstado: { enviado: 1, pendente: 1, incerto: 1 }, falhas: 0 })
        expect((await lerFrete(comCodigo.id)).aviso_despacho).toMatchObject({ status: "enviado", por: "job" })
        expect((await lerFrete(semCodigo.id)).aviso_despacho.status).toBe("pendente")
        expect((await lerFrete(preso.id)).aviso_despacho.status).toBe("incerto")
        expect((await lerFrete(jaEnviado.id)).aviso_despacho).toMatchObject({ status: "enviado", por: "webhook" })
        expect(despachos()).toHaveLength(1)
        expect(despachos()[0].text).toContain(`#${comCodigo.display_id}`)

        await dispensar(semCodigo.id)
      })

      it("envia EM SEQUÊNCIA (nunca duas mensagens ao mesmo tempo) e um pedido com erro não para os outros", async () => {
        const a = await criarPedido({ ...pendente(minutosAtras(3)), tracking_number: CODIGO })
        const quebrado = await criarPedido({ ...pendente(minutosAtras(2)), tracking_number: CODIGO })
        const b = await criarPedido({ ...pendente(minutosAtras(1)), tracking_number: CODIGO })
        atrasoEvolutionMs = 300
        // A reserva do pedido "quebrado" explode no banco: a função lança ANTES de enviar.
        const pg = pgReal()
        const pgQueQuebraUm = {
          raw: (sql: string, bindings?: unknown[]) =>
            Array.isArray(bindings) && bindings.includes(quebrado.id) && bindings.some((x) => typeof x === "string" && x.includes('"status":"enviando"'))
              ? Promise.reject(new Error("banco fora do ar"))
              : pg.raw(sql, bindings),
        }
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
        const r = await verificar(containerCom({ pg: pgQueQuebraUm, logger }))

        expect(r).toEqual({ candidatos: 3, porEstado: { enviado: 2 }, falhas: 1 })
        expect(despachos()).toHaveLength(2)
        expect(maxEmVoo).toBe(1)
        expect((await lerFrete(a.id)).aviso_despacho.status).toBe("enviado")
        expect((await lerFrete(b.id)).aviso_despacho.status).toBe("enviado")
        expect((await lerFrete(quebrado.id)).aviso_despacho.status).toBe("pendente")
        // Log de erro do pedido com falha: número do pedido e tipo do erro — nada de dado pessoal.
        const erros = logger.error.mock.calls.map((c) => String(c[0]))
        expect(erros.some((m) => m.includes(`#${quebrado.display_id}`) && m.includes("Error"))).toBe(true)
        expect(erros.join(" ")).not.toContain(TELEFONE)
        expect(erros.join(" ")).not.toContain("banco fora do ar")
        // E o resumo em `info`, porque houve algo.
        expect(logger.info.mock.calls.map((c) => String(c[0])).some((m) => m.includes("verificação"))).toBe(true)

        await dispensar(quebrado.id)
      })

      // ---- Fix round 1 ----

      // Três pedidos prontos para enviar, criados nesta ordem (o job pega o mais antigo primeiro).
      async function tresProntos() {
        const lista: { id: string; display_id: number }[] = []
        for (const min of [3, 2, 1]) lista.push(await criarPedido({ ...pendente(minutosAtras(min)), tracking_number: CODIGO }))
        return lista
      }
      const loggerEspiao = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })
      const avisos = async (ids: string[]) => Promise.all(ids.map(async (id) => (await lerFrete(id)).aviso_despacho))

      it("Evolution PENDURADA: só o primeiro vira incerto; a rodada para e os outros 2 seguem pendentes, sem reserva", async () => {
        const [a, b, c] = await tresProntos()
        modoEvolution = "pendurado"
        const logger = loggerEspiao()
        const r = await verificar(containerCom({ pg: pgReal(), logger }))

        expect(r).toEqual({ candidatos: 3, porEstado: { incerto: 1 }, falhas: 0, interrompida: 2 })
        expect(requisicoesEvolution).toBeLessThanOrEqual(1)
        const [fa, fb, fc] = await avisos([a.id, b.id, c.id])
        expect(fa.status).toBe("incerto")
        for (const f of [fb, fc]) {
          expect(f.status).toBe("pendente")
          expect(f.desde_envio).toBeUndefined()
          expect(f.por).toBeUndefined()
        }
        const warns = logger.warn.mock.calls.map((x) => String(x[0]))
        expect(warns.some((m) => m.includes("Evolution sem resposta") && m.includes("2 pedido(s)"))).toBe(true)

        for (const p of [a, b, c]) await dispensar(p.id)
      }, 60_000)

      it("Evolution fora do ar (503): o primeiro volta a pendente e a rodada para — 1 requisição só", async () => {
        const [a, b, c] = await tresProntos()
        modoEvolution = "503"
        const r = await verificar(containerCom({ pg: pgReal(), logger: loggerEspiao() }))

        expect(r).toEqual({ candidatos: 3, porEstado: { pendente: 1 }, falhas: 0, interrompida: 2 })
        expect(requisicoesEvolution).toBe(1)
        expect((await avisos([a.id, b.id, c.id])).map((x) => x.status)).toEqual(["pendente", "pendente", "pendente"])

        for (const p of [a, b, c]) await dispensar(p.id)
      })

      it("número sem WhatsApp é desfecho de UM pedido: a rodada NÃO para", async () => {
        const [a, b, c] = await tresProntos()
        modoEvolution = "400"
        const r = await verificar(containerCom({ pg: pgReal(), logger: loggerEspiao() }))

        expect(r).toEqual({ candidatos: 3, porEstado: { sem_whatsapp: 3 }, falhas: 0 })
        expect(requisicoesEvolution).toBe(3)
        expect((await avisos([a.id, b.id, c.id])).map((x) => x.status)).toEqual(["sem_whatsapp", "sem_whatsapp", "sem_whatsapp"])
      })

      it("duas rodadas ao mesmo tempo no mesmo processo: a segunda é pulada (nunca se sobrepõem)", async () => {
        const lista = await tresProntos()
        atrasoEvolutionMs = 200
        const [r1, r2] = await Promise.all([verificar(getContainer()), verificar(getContainer())])

        expect(r1).toEqual({ candidatos: 3, porEstado: { enviado: 3 }, falhas: 0 })
        expect(r2).toEqual({ candidatos: 0, porEstado: {}, falhas: 0, pulada: true })
        expect(despachos()).toHaveLength(3)
        expect(maxEmVoo).toBe(1)
        // A trava é liberada no fim: a rodada seguinte roda normalmente.
        expect(await verificar(getContainer())).toEqual({ candidatos: 0, porEstado: {}, falhas: 0 })
        expect((await avisos(lista.map((p) => p.id))).every((x) => x.status === "enviado")).toBe(true)
      })

      it("pendente com `desde` ausente ou ilegível → expirado, sem consultar a SuperFrete", async () => {
        const semDesde = await criarPedido({ aviso_despacho: { status: "pendente" } })
        const ilegivel = await criarPedido({ aviso_despacho: { status: "pendente", desde: "não é data" } })
        const logger = loggerEspiao()
        const r = await verificar(containerCom({ pg: pgReal(), logger }))

        expect(r).toEqual({ candidatos: 2, porEstado: { expirado: 2 }, falhas: 0 })
        for (const f of await avisos([semDesde.id, ilegivel.id])) expect(f).toMatchObject({ status: "expirado", expirado_em: expect.any(String) })
        expect(consultasSuperfrete).toHaveLength(0)
        expect(whatsappEnviados).toHaveLength(0)
        const warns = logger.warn.mock.calls.map((x) => String(x[0]))
        expect(warns.some((m) => m.includes(`#${semDesde.display_id}`))).toBe(true)
        expect(warns.some((m) => m.includes(`#${ilegivel.display_id}`))).toBe(true)
      })

      it("enviando RECENTE (menos de 10 min) que o job encontra fica como está, sem envio", async () => {
        const recente = await criarPedido({
          tracking_number: CODIGO,
          aviso_despacho: { status: "enviando", desde: minutosAtras(3), desde_envio: minutosAtras(2), por: "webhook" },
        })
        const antes = (await lerFrete(recente.id)).aviso_despacho
        const r = await verificar(getContainer())

        expect(r).toEqual({ candidatos: 1, porEstado: { enviando: 1 }, falhas: 0 })
        expect((await lerFrete(recente.id)).aviso_despacho).toEqual(antes)
        expect(requisicoesEvolution).toBe(0)

        await dispensar(recente.id)
      })

      it("o mais antigo primeiro: com limite 1, sai o pedido de created_at mais antigo, mesmo criado depois", async () => {
        const primeiroCriado = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        const maisAntigo = await criarPedido({ ...pendente(), tracking_number: CODIGO })
        // O segundo pedido passa a ser o mais antigo. (O UPDATE põe a versão nova da linha no fim da
        // tabela: sem ORDER BY, a varredura devolveria o primeiroCriado.)
        await pgReal().raw(`UPDATE "order" SET created_at = now() - interval '1 day' WHERE id = ?`, [maisAntigo.id])
        const r = await verificar(getContainer(), 1)

        expect(r).toEqual({ candidatos: 1, porEstado: { enviado: 1 }, falhas: 0 })
        expect(despachos()).toHaveLength(1)
        expect(despachos()[0].text).toContain(`#${maisAntigo.display_id}`)
        expect((await lerFrete(primeiroCriado.id)).aviso_despacho.status).toBe("pendente")

        await dispensar(primeiroCriado.id)
      })

      it("o job agendado fica desligado nas suítes (NODE_ENV=test): o cron não mexe nos pedidos dos testes", () => {
        expect(process.env.NODE_ENV).toBe("test")
      })

      it("sem candidatos → nada acontece e nada é logado", async () => {
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
        const r = await verificar(containerCom({ pg: pgReal(), logger }))
        expect(r).toEqual({ candidatos: 0, porEstado: {}, falhas: 0 })
        expect(logger.info).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
        expect(whatsappEnviados).toHaveLength(0)
      })
    })

    // ---- utilidades para trocar o knex e o logger só numa chamada ----
    function pgReal() {
      return getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as {
        raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
      }
    }

    // Um container igual ao do app, exceto pelo knex e pelo logger.
    function containerCom(troca: { pg: unknown; logger: unknown }) {
      const real = getContainer()
      return {
        resolve: (chave: string) =>
          chave === ContainerRegistrationKeys.PG_CONNECTION ? troca.pg : chave === ContainerRegistrationKeys.LOGGER ? troca.logger : real.resolve(chave),
      } as unknown as ReturnType<typeof getContainer>
    }
  },
})
