// Aceite da Task 3 dos avisos de entrega (spec 2026-09-20-avisos-entrega-superfrete-design.md §9,
// itens 2, 3 e 3a): `tentarAvisoDeDespacho`, o ÚNICO remetente da mensagem de despacho, chamado pelo
// Cockpit, pelo webhook `order.generated` e pelo job de 5 min.
//
// Nada aqui toca serviço real. A Evolution (WhatsApp) e a SuperFrete (`GET /api/v0/order/info/{id}`)
// são servidores HTTP em 127.0.0.1, e as variáveis entram no process.env ANTES de o runner subir o
// app (lib/evolution.ts lê EVOLUTION_API_URL no carregamento do módulo). Por isso a função é
// importada DINAMICAMENTE, depois dos servidores de pé — um import estático carregaria a
// lib/evolution.ts com as variáveis ainda vazias. Token, chave e etiquetas são literais fictícios.
//
// O teste que importa: a CORRIDA. Chamadores simultâneos (e um webhook `order.posted` gravando estado
// no mesmo pedido ao mesmo tempo) e a Evolution falsa tem de receber EXATAMENTE UMA mensagem de despacho.
import { createHmac } from "node:crypto"
import { createServer, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(240 * 1000)

const SEGREDO = "segredo-ficticio-do-teste-do-aviso"
const TELEFONE = "31999990000"
const ETIQUETA = "sfid_aviso_teste"
const CODIGO = "AA123456789BR"

// ---- Evolution simulada ----
// "200-nao-json": a Evolution ENTREGA (registra a mensagem) e responde 2xx com corpo ilegível — o
// erro nasce DEPOIS da entrega. "503": falha do lado dela, antes de entregar.
let modoEvolution: "ok" | "401" | "400" | "503" | "200-nao-json" | "pendurado" = "ok"
// Atraso antes de responder "ok": alarga a janela em que chamadores simultâneos se sobrepõem.
let atrasoEvolutionMs = 0
const pendurados: ServerResponse[] = []
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
      if (modoEvolution === "401") {
        res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ status: 401, error: "Unauthorized" }))
        return
      }
      if (modoEvolution === "503") {
        res.writeHead(503, { "content-type": "application/json" }).end("{}")
        return
      }
      if (modoEvolution === "pendurado") {
        pendurados.push(res)
        return
      }
      const { number, text } = JSON.parse(corpo || "{}")
      if (modoEvolution === "200-nao-json") {
        whatsappEnviados.push({ number, text })
        res.writeHead(200, { "content-type": "text/html" }).end("<html>ok</html>")
        return
      }
      if (modoEvolution === "400") {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ response: { message: [{ exists: false, jid: `${number}@s.whatsapp.net` }] } }))
        return
      }
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
    const id = decodeURIComponent(m[1])
    consultasSuperfrete.push(id)
    const r = infoDasEtiquetas.get(id) ?? { status: 404, corpo: { message: "order not found" } }
    res.writeHead(r.status, { "content-type": "application/json" }).end(JSON.stringify(r.corpo))
  })
  const [urlEvolution, urlSuperfrete] = await Promise.all([ouvir(servidorEvolution), ouvir(servidorSuperfrete)])
  process.env.SUPERFRETE_WEBHOOK_SECRET = SEGREDO
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

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let pedidos: IOrderModuleService
    let tentar: typeof import("../../src/lib/aviso-despacho").tentarAvisoDeDespacho

    beforeAll(async () => {
      await pronto
      await criarAdmin(api, getContainer())
      pedidos = getContainer().resolve(Modules.ORDER)
      tentar = (await import("../../src/lib/aviso-despacho.js")).tentarAvisoDeDespacho
    })

    afterAll(() => {
      for (const r of pendurados) r.destroy()
      servidorEvolution.close()
      servidorSuperfrete.close()
    })

    beforeEach(() => {
      modoEvolution = "ok"
      atrasoEvolutionMs = 0
      for (const r of pendurados.splice(0)) r.destroy()
      whatsappEnviados.length = 0
      consultasSuperfrete.length = 0
      infoDasEtiquetas.clear()
    })

    // O que o Cockpit grava ao comprar a etiqueta. Tem de sobreviver a TODOS os caminhos.
    const FRETE_DO_COCKPIT = {
      transportadora: "superfrete",
      status: "paga",
      em: "2026-09-21T10:00:00.000Z",
      superfrete_id: ETIQUETA,
      label_url: "https://exemplo.invalid/etiqueta.pdf",
    }

    async function criarPedido(frete: Record<string, unknown>, opts: { semTelefone?: boolean; superfreteId?: string } = {}) {
      const pedido = await pedidos.createOrders({
        currency_code: "brl",
        email: "cliente@example.com",
        shipping_address: {
          first_name: "Ana",
          last_name: "Teste",
          city: "Belo Horizonte",
          country_code: "br",
          ...(opts.semTelefone ? {} : { phone: TELEFONE }),
        },
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

    // A etiqueta, o PDF e o id da SuperFrete ficam intactos em qualquer desfecho.
    async function freteDoCockpitIntacto(orderId: string) {
      const md = (await pedidos.retrieveOrder(orderId)).metadata as Record<string, any>
      expect(md.observacao).toBe("não mexer")
      expect(md.frete).toMatchObject(FRETE_DO_COCKPIT)
    }

    const pendente = (desde = minutosAtras(1)) => ({ aviso_despacho: { status: "pendente", desde } })
    const despachos = () => whatsappEnviados.filter((m) => m.text.includes("acabou de ser enviado"))

    it("pendente e o código já no pedido → envia 1 vez, marca enviado com `por` e preserva `desde`", async () => {
      const desde = minutosAtras(2)
      const p = await criarPedido({ ...pendente(desde), tracking_number: CODIGO, tracking_url: "https://exemplo.invalid/AA" })
      const final = await tentar(getContainer(), p.id, "cockpit")

      expect(final).toEqual({ status: "enviado", desde, em: expect.any(String), por: "cockpit", desde_envio: expect.any(String) })
      expect((await lerFrete(p.id)).aviso_despacho).toEqual(final)
      expect(whatsappEnviados).toHaveLength(1)
      expect(whatsappEnviados[0].number).toBe(`55${TELEFONE}`)
      expect(whatsappEnviados[0].text).toContain(`#${p.display_id}`)
      expect(whatsappEnviados[0].text).toContain(CODIGO)
      // O link é SEMPRE o dos Correios montado do código — nunca um `tracking_url` gravado no pedido
      // (que pode ter vindo do corpo de um webhook).
      expect(whatsappEnviados[0].text).toContain(`https://rastreamento.correios.com.br/app/index.php?objetos=${CODIGO}`)
      expect(whatsappEnviados[0].text).not.toContain("exemplo.invalid")
      expect(consultasSuperfrete).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("pendente sem código e a SuperFrete já tem o código → grava o código (e o link dos Correios), envia e marca", async () => {
      const etiqueta = "sfid_com_codigo"
      infoDasEtiquetas.set(etiqueta, { status: 200, corpo: { id: etiqueta, status: "released", tracking: CODIGO, tags: [{ tag: "21" }] } })
      const p = await criarPedido(pendente(), { superfreteId: etiqueta })
      const final = await tentar(getContainer(), p.id, "job")

      expect(final?.status).toBe("enviado")
      expect(final?.por).toBe("job")
      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe(CODIGO)
      expect(frete.tracking_url).toBe(`https://rastreamento.correios.com.br/app/index.php?objetos=${CODIGO}`)
      expect(consultasSuperfrete).toEqual([etiqueta])
      expect(whatsappEnviados).toHaveLength(1)
      expect(whatsappEnviados[0].text).toContain(CODIGO)
      expect(frete.superfrete_id).toBe(etiqueta)
      expect(frete.label_url).toBe(FRETE_DO_COCKPIT.label_url)
    })

    it("pendente sem código e a SuperFrete ainda sem código → não envia e segue pendente", async () => {
      const etiqueta = "sfid_sem_codigo"
      infoDasEtiquetas.set(etiqueta, { status: 200, corpo: { id: etiqueta, status: "pending", tracking: null, tags: [{ tag: "21" }] } })
      const desde = minutosAtras(3)
      const p = await criarPedido(pendente(desde), { superfreteId: etiqueta })
      const final = await tentar(getContainer(), p.id, "job")

      expect(final).toEqual({ status: "pendente", desde })
      expect((await lerFrete(p.id)).tracking_number).toBeUndefined()
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("a consulta à SuperFrete falha → não envia e segue pendente", async () => {
      const etiqueta = "sfid_com_erro"
      infoDasEtiquetas.set(etiqueta, { status: 500, corpo: { message: "erro interno" } })
      const p = await criarPedido(pendente(), { superfreteId: etiqueta })
      const final = await tentar(getContainer(), p.id, "job")
      expect(final?.status).toBe("pendente")
      expect(whatsappEnviados).toHaveLength(0)
      const frete = await lerFrete(p.id)
      expect(frete.superfrete_id).toBe(etiqueta)
      expect(frete.label_url).toBe(FRETE_DO_COCKPIT.label_url)
      expect(frete.tracking_number).toBeUndefined()
    })

    // O webhook da corrida é o order.delivered: grava estado no mesmo `frete` e manda a mensagem dele,
    // sem tocar no aviso de despacho. (O order.posted DISPENSA um despacho pendente — I-4 da revisão
    // final — e tem teste próprio abaixo e no frete-webhook.spec.)
    it("CORRIDA: chamadores simultâneos + um webhook order.delivered gravando estado → exatamente 1 mensagem de despacho", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      atrasoEvolutionMs = 300
      const corpo = JSON.stringify({ event: "order.delivered", data: { id: ETIQUETA, tags: [{ tag: String(p.display_id) }] } })
      const webhook = api
        .post("/webhooks/superfrete", corpo, {
          headers: { "content-type": "application/json", "x-me-signature": createHmac("sha256", SEGREDO).update(corpo).digest("hex") },
        })
        .catch((e) => e.response)

      const resultados = await Promise.all([
        tentar(getContainer(), p.id, "cockpit"),
        tentar(getContainer(), p.id, "webhook"),
        tentar(getContainer(), p.id, "job"),
        tentar(getContainer(), p.id, "job"),
        webhook,
      ])

      expect(despachos()).toHaveLength(1)
      const frete = await lerFrete(p.id)
      expect(frete.aviso_despacho.status).toBe("enviado")
      // Quem não ganhou a reserva devolve o estado que leu, sem enviar: "enviando" ou "enviado".
      for (const r of resultados.slice(0, 4)) expect(["enviando", "enviado"]).toContain((r as { status: string }).status)
      // O webhook gravou o estado dele sem desfazer a reserva/marca (e vice-versa).
      expect((resultados[4] as { status: number }).status).toBe(200)
      expect(frete.status_transportadora).toBe("order.delivered")
      expect(frete.eventos["order.delivered"]).toEqual(expect.any(String))
      expect(frete.avisos.delivered).toEqual(expect.any(String))
      await freteDoCockpitIntacto(p.id)
    })

    it("CORRIDA com o order.posted (I-4): nunca duas mensagens de despacho; ou saiu o despacho, ou ele foi dispensado pelo postado", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      atrasoEvolutionMs = 300
      const corpo = JSON.stringify({ event: "order.posted", data: { id: ETIQUETA, tags: [{ tag: String(p.display_id) }] } })
      const webhook = api
        .post("/webhooks/superfrete", corpo, {
          headers: { "content-type": "application/json", "x-me-signature": createHmac("sha256", SEGREDO).update(corpo).digest("hex") },
        })
        .catch((e) => e.response)
      await Promise.all([tentar(getContainer(), p.id, "cockpit"), tentar(getContainer(), p.id, "job"), webhook])

      const aviso = (await lerFrete(p.id)).aviso_despacho
      if (aviso.status === "dispensado") {
        expect(aviso.motivo).toBe("coberto pelo aviso de postado")
        expect(despachos()).toHaveLength(0)
      } else {
        expect(aviso.status).toBe("enviado")
        expect(despachos()).toHaveLength(1)
      }
      expect((await lerFrete(p.id)).avisos.posted).toEqual(expect.any(String))
    })

    // ---- I-3 (revisão final): etiqueta cancelada não recebe mensagem de despacho ----

    it("I-3: pendente e o estado da transportadora é order.cancelled → dispensado (etiqueta cancelada), sem consultar nem enviar; log warn com o número", async () => {
      const desde = minutosAtras(2)
      const p = await criarPedido({ ...pendente(desde), tracking_number: CODIGO, status_transportadora: "order.cancelled" })
      const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
      const aviso = jest.spyOn(logger, "warn")
      try {
        const final = await tentar(getContainer(), p.id, "job")
        expect(final).toEqual({ status: "dispensado", desde, em: expect.any(String), motivo: "etiqueta cancelada" })
        expect(aviso.mock.calls.some(([m]) => String(m).includes(`#${p.display_id}`) && String(m).includes("cancelada"))).toBe(true)
      } finally {
        aviso.mockRestore()
      }
      expect((await lerFrete(p.id)).aviso_despacho.status).toBe("dispensado")
      expect(whatsappEnviados).toHaveLength(0)
      expect(consultasSuperfrete).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("I-3: pendente sem código e a SuperFrete diz que a etiqueta está \"canceled\" → dispensado, não envia", async () => {
      const etiqueta = "sfid_cancelada"
      infoDasEtiquetas.set(etiqueta, { status: 200, corpo: { id: etiqueta, status: "canceled", tracking: null } })
      const desde = minutosAtras(2)
      const p = await criarPedido(pendente(desde), { superfreteId: etiqueta })
      const final = await tentar(getContainer(), p.id, "job")
      expect(final).toEqual({ status: "dispensado", desde, em: expect.any(String), motivo: "etiqueta cancelada" })
      expect(consultasSuperfrete).toEqual([etiqueta])
      expect(whatsappEnviados).toHaveLength(0)
      // E nada mais sai depois.
      expect((await tentar(getContainer(), p.id, "job"))?.status).toBe("dispensado")
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("I-3: a SuperFrete diz \"canceled\" MESMO com código de rastreio → dispensado, não envia", async () => {
      const etiqueta = "sfid_cancelada_com_codigo"
      infoDasEtiquetas.set(etiqueta, { status: 200, corpo: { id: etiqueta, status: "canceled", tracking: CODIGO } })
      const p = await criarPedido(pendente(), { superfreteId: etiqueta })
      const final = await tentar(getContainer(), p.id, "job")
      expect(final?.status).toBe("dispensado")
      expect(final?.motivo).toBe("etiqueta cancelada")
      expect(whatsappEnviados).toHaveLength(0)
    })

    it.each(["enviado", "dispensado", "sem_telefone", "expirado", "incerto", "sem_whatsapp"])(
      "status %s → não envia nada e devolve o que está lá",
      async (status) => {
        const aviso = { status, desde: minutosAtras(5), em: minutosAtras(4) }
        const p = await criarPedido({ aviso_despacho: aviso, tracking_number: CODIGO })
        expect(await tentar(getContainer(), p.id, "job")).toEqual(aviso)
        expect((await lerFrete(p.id)).aviso_despacho).toEqual(aviso)
        expect(whatsappEnviados).toHaveLength(0)
      }
    )

    it("sem aviso_despacho → devolve null e não envia", async () => {
      const p = await criarPedido({ tracking_number: CODIGO })
      expect(await tentar(getContainer(), p.id, "job")).toBeNull()
      expect((await lerFrete(p.id)).aviso_despacho).toBeUndefined()
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("pendente há mais de 24 h → expirado, não envia", async () => {
      const desde = minutosAtras(24 * 60 + 5)
      const p = await criarPedido({ ...pendente(desde), tracking_number: CODIGO })
      const final = await tentar(getContainer(), p.id, "job")
      expect(final).toMatchObject({ status: "expirado", desde })
      expect((await lerFrete(p.id)).aviso_despacho.status).toBe("expirado")
      expect(whatsappEnviados).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("enviando há menos de 10 min → devolve como está, não envia", async () => {
      const aviso = { status: "enviando", desde: minutosAtras(3), desde_envio: minutosAtras(2), por: "job" }
      const p = await criarPedido({ aviso_despacho: aviso, tracking_number: CODIGO })
      expect(await tentar(getContainer(), p.id, "job")).toEqual(aviso)
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("enviando há mais de 10 min → incerto, não envia (nunca reenvia a partir daqui)", async () => {
      const aviso = { status: "enviando", desde: minutosAtras(20), desde_envio: minutosAtras(11), por: "job" }
      const p = await criarPedido({ aviso_despacho: aviso, tracking_number: CODIGO })
      const final = await tentar(getContainer(), p.id, "job")
      expect(final).toMatchObject({ ...aviso, status: "incerto" })
      expect((await lerFrete(p.id)).aviso_despacho.status).toBe("incerto")
      expect(whatsappEnviados).toHaveLength(0)
      // E depois de incerto, nada mais sai.
      expect((await tentar(getContainer(), p.id, "job"))?.status).toBe("incerto")
      expect(whatsappEnviados).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("sem telefone → sem_telefone, não envia", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO }, { semTelefone: true })
      const final = await tentar(getContainer(), p.id, "cockpit")
      expect(final?.status).toBe("sem_telefone")
      expect(whatsappEnviados).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("Evolution 401 → volta para pendente (o job tenta de novo), sem os campos da reserva", async () => {
      const desde = minutosAtras(2)
      const p = await criarPedido({ ...pendente(desde), tracking_number: CODIGO })
      modoEvolution = "401"
      const final = await tentar(getContainer(), p.id, "job")
      // Formato exato que a ordenação do job reconhece (regex no SELECT de verificarAvisosPendentes).
      const ISO_DO_JOB = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(final).toEqual({ status: "pendente", desde, tentado_em: ISO_DO_JOB })
      expect((await lerFrete(p.id)).aviso_despacho).toEqual({ status: "pendente", desde, tentado_em: ISO_DO_JOB })
      await freteDoCockpitIntacto(p.id)

      // A retentativa seguinte, com a Evolution de volta, manda.
      modoEvolution = "ok"
      const depois = await tentar(getContainer(), p.id, "job")
      expect(depois?.status).toBe("enviado")
      expect(whatsappEnviados).toHaveLength(1)
      // `tentado_em` só serve à fila de pendentes: o enviado não o carrega (nem no retorno, nem no banco).
      expect(depois).not.toHaveProperty("tentado_em")
      expect((await lerFrete(p.id)).aviso_despacho).not.toHaveProperty("tentado_em")
    })

    it("Evolution 400 com exists: false → sem_whatsapp (final)", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      modoEvolution = "400"
      const final = await tentar(getContainer(), p.id, "webhook")
      expect(final?.status).toBe("sem_whatsapp")
      modoEvolution = "ok"
      expect((await tentar(getContainer(), p.id, "job"))?.status).toBe("sem_whatsapp")
      expect(whatsappEnviados).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("Evolution pendurada (timeout) → incerto: a mensagem pode ter saído, ninguém reenvia", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      modoEvolution = "pendurado"
      const inicio = Date.now()
      const final = await tentar(getContainer(), p.id, "job")
      expect(Date.now() - inicio).toBeLessThan(30_000)
      expect(final?.status).toBe("incerto")
      modoEvolution = "ok"
      expect((await tentar(getContainer(), p.id, "job"))?.status).toBe("incerto")
      expect(whatsappEnviados).toHaveLength(0)
      await freteDoCockpitIntacto(p.id)
    })

    it("a marca final falha → a mensagem saiu 1 vez, a função não lança, e a chamada seguinte NÃO reenvia", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      // O `raw` do knex é somente-leitura (jest.spyOn não consegue trocá-lo). Em vez disso, a função
      // recebe um container que devolve um knex EMBRULHADO: igual ao real, exceto que derruba só a
      // gravação que leva o status "enviado". A reserva e as leituras passam.
      const container = getContainer()
      const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as { raw: (...a: unknown[]) => unknown }
      let derrubadas = 0
      const pgQueFalhaNaMarca = {
        raw: (sql: string, bindings?: unknown[]) => {
          if (Array.isArray(bindings) && bindings.some((b) => typeof b === "string" && b.includes('"status":"enviado"'))) {
            derrubadas++
            return Promise.reject(new Error("banco fora do ar"))
          }
          return pg.raw(sql, bindings)
        },
      }
      const containerComFalha = {
        resolve: (chave: string) => (chave === ContainerRegistrationKeys.PG_CONNECTION ? pgQueFalhaNaMarca : container.resolve(chave)),
      } as unknown as typeof container
      const final = await tentar(containerComFalha, p.id, "job")
      expect(derrubadas).toBe(1)
      expect((final as { status: string }).status).toBe("enviado")
      expect(whatsappEnviados).toHaveLength(1)
      // No banco ficou "enviando" (vira incerto em 10 min) — e nada sai de novo.
      expect((await lerFrete(p.id)).aviso_despacho.status).toBe("enviando")
      expect((await tentar(getContainer(), p.id, "job"))?.status).toBe("enviando")
      expect(whatsappEnviados).toHaveLength(1)
      await freteDoCockpitIntacto(p.id)
    })

    // ---- Fix round 1 da Task 3 ----

    // Um container igual ao real, com o knex e/ou o logger trocados — o `raw` do knex é somente-leitura
    // e o logger do container não é capturável de outro jeito.
    function containerCom(troca: { pg?: unknown; logger?: unknown }) {
      const container = getContainer()
      return {
        resolve: (chave: string) =>
          chave === ContainerRegistrationKeys.PG_CONNECTION && troca.pg
            ? troca.pg
            : chave === ContainerRegistrationKeys.LOGGER && troca.logger
              ? troca.logger
              : container.resolve(chave),
      } as unknown as typeof container
    }
    function loggerEspiao() {
      return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn() }
    }
    const pgReal = () => getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as { raw: (sql: string, b?: unknown[]) => Promise<any> }

    it("Evolution responde 2xx com corpo que não é JSON (a mensagem SAIU) → incerto, e a chamada seguinte não reenvia", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      modoEvolution = "200-nao-json"
      const final = await tentar(getContainer(), p.id, "job")
      expect(final?.status).toBe("incerto")
      expect(whatsappEnviados).toHaveLength(1)
      modoEvolution = "ok"
      expect((await tentar(getContainer(), p.id, "job"))?.status).toBe("incerto")
      expect(whatsappEnviados).toHaveLength(1)
      await freteDoCockpitIntacto(p.id)
    })

    it("Evolution 5xx → volta para pendente (decisão técnica: retentar em vez de silenciar; a confirmar com o dono)", async () => {
      const desde = minutosAtras(2)
      const p = await criarPedido({ ...pendente(desde), tracking_number: CODIGO })
      modoEvolution = "503"
      expect(await tentar(getContainer(), p.id, "job")).toEqual({ status: "pendente", desde, tentado_em: expect.any(String) })
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("conexão recusada (Evolution fora do ar, nada chegou a ela) → volta para pendente", async () => {
      const desde = minutosAtras(2)
      const p = await criarPedido({ ...pendente(desde), tracking_number: CODIGO })
      // lib/evolution.ts guarda a URL no carregamento; para recusar a conexão, o servidor falso sai da
      // porta e volta a ela depois.
      const porta = (servidorEvolution.address() as AddressInfo).port
      servidorEvolution.closeAllConnections()
      await new Promise((ok) => servidorEvolution.close(() => ok(undefined)))
      await new Promise((r) => setTimeout(r, 200))
      try {
        expect(await tentar(getContainer(), p.id, "job")).toEqual({ status: "pendente", desde, tentado_em: expect.any(String) })
      } finally {
        await new Promise((ok) => servidorEvolution.listen(porta, "127.0.0.1", () => ok(undefined)))
      }
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("a marca enviando → enviado não acha a linha (o aviso mudou no meio) → log de ERRO para o operador, sem reenviar", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      const pg = pgReal()
      const logger = loggerEspiao()
      const pgQueMudaOAviso = {
        raw: async (sql: string, bindings?: unknown[]) => {
          if (Array.isArray(bindings) && bindings.some((b) => typeof b === "string" && b.includes('"status":"enviado"'))) {
            // Outro escritor muda o aviso durante o envio: a marca condicional não acha "enviando".
            await pg.raw(`UPDATE "order" SET metadata = jsonb_set(metadata, '{frete,aviso_despacho,status}', '"dispensado"') WHERE id = ?`, [p.id])
          }
          return pg.raw(sql, bindings)
        },
      }
      const final = await tentar(containerCom({ pg: pgQueMudaOAviso, logger }), p.id, "job")
      expect(final?.status).toBe("dispensado")
      expect(whatsappEnviados).toHaveLength(1)
      const erros = logger.error.mock.calls.map((c) => String(c[0]))
      expect(erros.some((m) => m.includes("SAIU") && m.includes("dispensado"))).toBe(true)
      expect(logger.info.mock.calls.map((c) => String(c[0])).some((m) => m.includes("enviado ("))).toBe(false)
    })

    it("gravação DEPOIS do envio falha (volta a pendente após 5xx) → a função não lança; fica enviando (vira incerto)", async () => {
      const p = await criarPedido({ ...pendente(), tracking_number: CODIGO })
      const pg = pgReal()
      const logger = loggerEspiao()
      const pgQueFalhaDepois = {
        raw: (sql: string, bindings?: unknown[]) =>
          Array.isArray(bindings) && bindings.some((b) => typeof b === "string" && b.includes('"status":"pendente"'))
            ? Promise.reject(new Error("banco fora do ar"))
            : pg.raw(sql, bindings),
      }
      modoEvolution = "503"
      const final = await tentar(containerCom({ pg: pgQueFalhaDepois, logger }), p.id, "job")
      expect(final?.status).toBe("enviando")
      expect((await lerFrete(p.id)).aviso_despacho.status).toBe("enviando")
      expect(logger.error).toHaveBeenCalled()
    })
  },
})
