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
const whatsappEnviados: { number: string; text: string }[] = []
let servidorEvolution: Server

// ---- SuperFrete simulada: `order/info` por id de etiqueta ----
const infoDasEtiquetas = new Map<string, { status: number; corpo: unknown }>()
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
      const { number, text } = JSON.parse(corpo || "{}")
      whatsappEnviados.push({ number, text })
      if (atrasoEvolutionMs) await new Promise((r) => setTimeout(r, atrasoEvolutionMs))
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ key: { id: "msg_1" } }))
    })
  })
  servidorSuperfrete = createServer((req, res) => {
    const m = /^\/api\/v0\/order\/info\/([^/?]+)$/.exec(req.url ?? "")
    if (!m || req.method !== "GET") {
      res.writeHead(404).end("{}")
      return
    }
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

    beforeAll(async () => {
      await pronto
      admin = (await criarAdmin(api, getContainer())).headers
      pedidos = getContainer().resolve(Modules.ORDER)
    })

    afterAll(() => {
      servidorEvolution.close()
      servidorSuperfrete.close()
    })

    beforeEach(() => {
      atrasoEvolutionMs = 0
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
  },
})
