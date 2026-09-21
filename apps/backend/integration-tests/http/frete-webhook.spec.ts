// Aceite da Task 2 dos avisos de entrega (spec 2026-09-20-avisos-entrega-superfrete-design.md
// §4.2–§4.4): POST /webhooks/superfrete, da assinatura até o que fica gravado no pedido.
//
// Nada aqui toca a SuperFrete de verdade — a SuperFrete é só quem ASSINA o corpo, e o segredo
// abaixo é um literal fictício deste arquivo. O único serviço externo que a rota chama é a
// Evolution (WhatsApp), e ela é simulada por um servidor HTTP em 127.0.0.1: é assim que este
// spec espiona o envio sem mock frágil (lib/evolution.ts lê EVOLUTION_API_URL no carregamento
// do módulo, então a variável entra no process.env ANTES de o runner subir o app).
//
// O e-mail NÃO é exercitado aqui de propósito: RESEND_API_KEY fica ausente, o Notification Module
// não ganha provider (medusa-config.ts) e o template `pedido-postado` só nasce na Task 3. O canal
// é pulado, e o WhatsApp sozinho já prova a regra "pelo menos um canal entregue → 200 e marca".
import { createHmac } from "node:crypto"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(240 * 1000)

// Segredo FICTÍCIO, só deste teste. O repositório é público: o segredo real vive no ambiente.
const SEGREDO = "segredo-ficticio-do-teste-do-webhook"
const TELEFONE = "31999990000"
const ETIQUETA = "sfid_teste_1"

let servidorEvolution: Server
// "ok" entrega; "503" é falha passageira; "400" é a recusa permanente (número fora do WhatsApp — a
// Evolution de verdade ecoa o número no corpo, e é isso que o 400 daqui faz também); "pendurado"
// nunca responde, para o timeout da rota estourar. "401" (chave errada) e "400-outro" (400 sem
// `exists: false`, como o de instância desconectada) são erros que atingem TODAS as clientes.
let modoEvolution: "ok" | "503" | "400" | "400-outro" | "401" | "pendurado" = "ok"
// Roda DURANTE o envio, antes da resposta: é como o teste simula outro escritor gravando no pedido
// enquanto a mensagem está saindo.
let duranteOEnvio: (() => Promise<void>) | null = null
const pendurados: import("node:http").ServerResponse[] = []
const whatsappEnviados: { number: string; text: string }[] = []

// Evolution simulada: `sendWhatsappText` faz POST /message/sendText/<instancia> e só considera
// entregue quando a resposta é 2xx.
function subirEvolutionSimulada(): Promise<void> {
  servidorEvolution = createServer((req, res) => {
    let corpo = ""
    req.on("data", (p) => (corpo += p))
    req.on("end", async () => {
      if (!req.url?.startsWith("/message/sendText/") || modoEvolution === "503") {
        res.writeHead(503, { "content-type": "application/json" }).end("{}")
        return
      }
      if (modoEvolution === "401") {
        res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ status: 401, error: "Unauthorized" }))
        return
      }
      if (modoEvolution === "400-outro") {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ status: 400, response: { message: ["Connection Closed"] } }))
        return
      }
      if (modoEvolution === "pendurado") {
        pendurados.push(res)
        return
      }
      let numero = ""
      try {
        const { number, text } = JSON.parse(corpo || "{}")
        numero = number
        if (modoEvolution === "ok") whatsappEnviados.push({ number, text })
      } catch {
        /* corpo ilegível não deve derrubar o teste; a asserção de contagem acusa */
      }
      if (modoEvolution === "400") {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ response: { message: [{ exists: false, jid: `${numero}@s.whatsapp.net` }] } }))
        return
      }
      if (duranteOEnvio) await duranteOEnvio()
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ key: { id: "msg_1" } }))
    })
  })
  return new Promise((ok) =>
    servidorEvolution.listen(0, "127.0.0.1", () => {
      process.env.SUPERFRETE_WEBHOOK_SECRET = SEGREDO
      process.env.EVOLUTION_API_URL = `http://127.0.0.1:${(servidorEvolution.address() as AddressInfo).port}`
      process.env.EVOLUTION_API_KEY = "chave-ficticia-do-teste"
      process.env.EVOLUTION_INSTANCE = "eclat-teste"
      delete process.env.RESEND_API_KEY
      ok()
    })
  )
}

const pronto = subirEvolutionSimulada()

medusaIntegrationTestRunner({
  // Mesmas opções do frete-superfrete.spec.ts: sem `disableAutoTeardown` o runner faz TRUNCATE
  // depois de cada it(), e os pedidos montados aqui sumiriam no meio da suíte.
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let pedidos: IOrderModuleService

    beforeAll(async () => {
      await pronto
      // O admin não é usado pelas chamadas do webhook (a rota é pública, autenticada por
      // assinatura); é criado só para manter o harness idêntico ao dos outros specs de HTTP.
      await criarAdmin(api, getContainer())
      pedidos = getContainer().resolve(Modules.ORDER)
    })

    afterAll(() => {
      for (const r of pendurados) r.destroy()
      servidorEvolution.close()
    })

    beforeEach(() => {
      modoEvolution = "ok"
      duranteOEnvio = null
      for (const r of pendurados.splice(0)) r.destroy()
      whatsappEnviados.length = 0
    })

    // Um pedido por teste: a suíte roda sem truncate entre os it(), então nada pode ser reaproveitado.
    async function criarPedido(frete: Record<string, unknown> = {}): Promise<{ id: string; display_id: number }> {
      const pedido = await pedidos.createOrders({
        currency_code: "brl",
        email: "cliente@example.com",
        shipping_address: {
          first_name: "Ana",
          last_name: "Teste",
          address_1: "Rua Um, 10",
          city: "Belo Horizonte",
          province: "MG",
          postal_code: "30130-010",
          country_code: "br",
          phone: TELEFONE,
        },
        metadata: {
          // Chave de outro assunto: prova que a rota preserva o que não é dela.
          observacao: "não mexer",
          frete: { transportadora: "superfrete", status: "paga", em: "2026-09-20T10:00:00.000Z", superfrete_id: ETIQUETA, ...frete },
        },
      })
      return { id: pedido.id, display_id: pedido.display_id as number }
    }

    async function lerFrete(orderId: string): Promise<Record<string, any>> {
      const pedido = await pedidos.retrieveOrder(orderId)
      return ((pedido.metadata as Record<string, unknown> | null)?.frete ?? {}) as Record<string, any>
    }

    function corpoDe(display_id: number | null, event: string, extra: Record<string, unknown> = {}) {
      return {
        event,
        data: { id: ETIQUETA, ...(display_id === null ? {} : { tags: [{ tag: String(display_id), url: null }] }), ...extra },
      }
    }

    // O corpo vai como STRING: a assinatura é sobre bytes, e reserializar no axios poderia mudá-los.
    async function chamar(corpo: unknown, opts: { assinatura?: string } = {}) {
      const bruto = JSON.stringify(corpo)
      const assinatura = opts.assinatura ?? createHmac("sha256", SEGREDO).update(bruto).digest("hex")
      return api
        .post("/webhooks/superfrete", bruto, { headers: { "content-type": "application/json", "x-me-signature": assinatura } })
        .catch((e) => e.response)
    }

    it("assinatura errada → 401 e nada é gravado", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(p.display_id, "order.posted"), { assinatura: "não é a assinatura" })
      expect(r.status).toBe(401)
      expect(await lerFrete(p.id)).not.toHaveProperty("eventos")
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("sem SUPERFRETE_WEBHOOK_SECRET no ambiente → 200 e nada é gravado", async () => {
      const p = await criarPedido()
      delete process.env.SUPERFRETE_WEBHOOK_SECRET
      try {
        const r = await chamar(corpoDe(p.display_id, "order.posted"))
        expect(r.status).toBe(200)
        expect(r.data).toEqual({ ignorado: "sem segredo" })
      } finally {
        process.env.SUPERFRETE_WEBHOOK_SECRET = SEGREDO
      }
      expect(await lerFrete(p.id)).not.toHaveProperty("eventos")
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("evento desconhecido → 200 e nada é gravado", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(p.display_id, "order.inventado"))
      expect(r.status).toBe(200)
      expect(await lerFrete(p.id)).not.toHaveProperty("eventos")
    })

    it("sem tag com o número do pedido → 200 e nada é gravado", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(null, "order.posted"))
      expect(r.status).toBe(200)
      expect(await lerFrete(p.id)).not.toHaveProperty("eventos")
    })

    it("pedido inexistente → 200 e nada é gravado", async () => {
      const r = await chamar(corpoDe(999_999_999, "order.posted"))
      expect(r.status).toBe(200)
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("data.id que não bate com o superfrete_id do pedido → 200 e nada é gravado", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(p.display_id, "order.posted", { id: "sfid_de_outra_pessoa" }))
      expect(r.status).toBe(200)
      expect(await lerFrete(p.id)).not.toHaveProperty("eventos")
      expect(whatsappEnviados).toHaveLength(0)
    })

    // Spec §9 (2026-09-21): o Cockpit segura a mensagem de despacho quando a etiqueta sai sem código
    // e grava aviso_despacho = { status: "pendente" }; o order.generated é quem a manda.
    const PENDENTE = { aviso_despacho: { status: "pendente", desde: "2026-09-21T10:00:00.000Z" } }
    const COM_CODIGO = { tracking: "AA123456789BR", tracking_url: "https://exemplo.invalid/AA123456789BR" }

    it("order.generated com aviso_despacho pendente: grava o rastreio, manda o despacho completo e marca enviado — o reenvio não repete", async () => {
      const p = await criarPedido(PENDENTE)
      const r = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r.status).toBe(200)

      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe("AA123456789BR")
      expect(frete.tracking_url).toBe("https://exemplo.invalid/AA123456789BR")
      expect(frete.status_transportadora).toBe("order.generated")
      expect(frete.eventos["order.generated"]).toEqual(expect.any(String))
      expect(frete.aviso_despacho).toEqual({ status: "enviado", desde: "2026-09-21T10:00:00.000Z", em: expect.any(String), por: "webhook" })
      expect(frete.avisos).toBeUndefined()
      // O que já estava no metadata continua lá (superfrete_id, status, e a chave de outro assunto).
      expect(frete.superfrete_id).toBe(ETIQUETA)
      expect(frete.status).toBe("paga")
      expect((await pedidos.retrieveOrder(p.id)).metadata).toMatchObject({ observacao: "não mexer" })

      expect(whatsappEnviados).toHaveLength(1)
      expect(whatsappEnviados[0].number).toBe(`55${TELEFONE}`)
      expect(whatsappEnviados[0].text).toContain(`#${p.display_id}`)
      expect(whatsappEnviados[0].text).toContain("AA123456789BR")
      expect(whatsappEnviados[0].text).toContain("https://exemplo.invalid/AA123456789BR")

      // Reenvio da SuperFrete: nada sai de novo e a data do aviso não muda.
      const r2 = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r2.status).toBe(200)
      expect((await lerFrete(p.id)).aviso_despacho.em).toBe(frete.aviso_despacho.em)
      expect(whatsappEnviados).toHaveLength(1)
    })

    it("order.generated com aviso_despacho pendente mas SEM código no evento: não manda e segue pendente", async () => {
      const p = await criarPedido(PENDENTE)
      const r = await chamar(corpoDe(p.display_id, "order.generated", { tracking: "" }))
      expect(r.status).toBe(200)
      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBeUndefined()
      expect(frete.aviso_despacho.status).toBe("pendente")
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("order.generated com aviso_despacho pendente e WhatsApp fora do ar → 500, segue pendente; o reenvio manda", async () => {
      const p = await criarPedido(PENDENTE)
      modoEvolution = "503"
      const r1 = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r1.status).toBe(500)
      const falhou = await lerFrete(p.id)
      expect(falhou.tracking_number).toBe("AA123456789BR")
      expect(falhou.aviso_despacho.status).toBe("pendente")

      modoEvolution = "ok"
      const r2 = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r2.status).toBe(200)
      expect((await lerFrete(p.id)).aviso_despacho.status).toBe("enviado")
      expect(whatsappEnviados).toHaveLength(1)
    })

    it("order.generated SEM aviso_despacho: grava o rastreio e não manda nada", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r.status).toBe(200)
      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe("AA123456789BR")
      expect(frete.aviso_despacho).toBeUndefined()
      expect(frete.avisos).toBeUndefined()
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("order.generated com aviso_despacho já enviado: grava o rastreio e não manda de novo", async () => {
      const enviado = { status: "enviado", em: "2026-09-21T10:00:05.000Z", por: "cockpit" }
      const p = await criarPedido({ aviso_despacho: enviado })
      const r = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r.status).toBe(200)
      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe("AA123456789BR")
      expect(frete.aviso_despacho).toEqual(enviado)
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("order.generated com o pedido JÁ com rastreio (sem aviso pendente): grava o evento, não sobrescreve e não avisa", async () => {
      const p = await criarPedido({ tracking_number: "ZZ000000000BR", tracking_url: "https://exemplo.invalid/ZZ" })
      const r = await chamar(corpoDe(p.display_id, "order.generated", { tracking: "AA123456789BR", tracking_url: "https://exemplo.invalid/AA" }))
      expect(r.status).toBe(200)

      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe("ZZ000000000BR")
      expect(frete.tracking_url).toBe("https://exemplo.invalid/ZZ")
      expect(frete.eventos["order.generated"]).toEqual(expect.any(String))
      expect(frete.avisos).toBeUndefined()
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("order.posted: grava o evento, avisa e marca — e o reenvio não avisa de novo", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR", tracking_url: "https://exemplo.invalid/AA" })

      const r1 = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r1.status).toBe(200)
      const primeiro = await lerFrete(p.id)
      expect(primeiro.status_transportadora).toBe("order.posted")
      expect(primeiro.avisos.posted).toEqual(expect.any(String))
      expect(whatsappEnviados).toHaveLength(1)
      expect(whatsappEnviados[0].text).toContain("AA123456789BR")

      // Reenvio da SuperFrete (ela repete até 5 vezes): mesmo corpo, mesma assinatura.
      const r2 = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r2.status).toBe(200)
      const segundo = await lerFrete(p.id)
      expect(segundo.avisos.posted).toBe(primeiro.avisos.posted)
      expect(whatsappEnviados).toHaveLength(1)
    })

    it("order.delivered: grava o evento e marca avisos.delivered", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      const r = await chamar(corpoDe(p.display_id, "order.delivered"))
      expect(r.status).toBe(200)

      const frete = await lerFrete(p.id)
      expect(frete.status_transportadora).toBe("order.delivered")
      expect(frete.eventos["order.delivered"]).toEqual(expect.any(String))
      expect(frete.avisos.delivered).toEqual(expect.any(String))
      expect(whatsappEnviados).toHaveLength(1)
    })

    it("evento que não vira mensagem (order.created) grava e responde 200 sem enviar nada", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(p.display_id, "order.created"))
      expect(r.status).toBe(200)

      const frete = await lerFrete(p.id)
      expect(frete.eventos["order.created"]).toEqual(expect.any(String))
      expect(frete.avisos).toBeUndefined()
      expect(whatsappEnviados).toHaveLength(0)
    })

    it("todos os canais falharam → 500 de propósito, sem marcar; o reenvio seguinte funciona", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })

      modoEvolution = "503"
      const r1 = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r1.status).toBe(500)
      const falhou = await lerFrete(p.id)
      // O estado é gravado mesmo assim — só o AVISO é que não pode ser marcado sem envio.
      expect(falhou.eventos["order.posted"]).toEqual(expect.any(String))
      expect(falhou.avisos).toBeUndefined()

      modoEvolution = "ok"
      const r2 = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r2.status).toBe(200)
      expect((await lerFrete(p.id)).avisos.posted).toEqual(expect.any(String))
      expect(whatsappEnviados).toHaveLength(1)
    })

    it("sem telefone no pedido o canal é pulado: 200, nada marcado, nada enviado", async () => {
      const pedido = await pedidos.createOrders({
        currency_code: "brl",
        email: "cliente@example.com",
        shipping_address: { first_name: "Ana", last_name: "Teste", city: "Belo Horizonte", country_code: "br" },
        metadata: { frete: { transportadora: "superfrete", status: "paga", em: "2026-09-20T10:00:00.000Z", superfrete_id: ETIQUETA, tracking_number: "AA123456789BR" } },
      })
      const r = await chamar(corpoDe(pedido.display_id as number, "order.posted"))
      expect(r.status).toBe(200)

      const frete = await lerFrete(pedido.id)
      expect(frete.eventos["order.posted"]).toEqual(expect.any(String))
      expect(frete.avisos).toBeUndefined()
      expect(whatsappEnviados).toHaveLength(0)
    })

    // ---- Revisão da Task 2 (fix round 1) ----

    it("aviso_despacho pendente, pedido JÁ com rastreio e evento SEM código: manda o despacho e marca", async () => {
      const p = await criarPedido({ ...PENDENTE, tracking_number: "ZZ000000000BR", tracking_url: "https://exemplo.invalid/ZZ" })
      const r = await chamar(corpoDe(p.display_id, "order.generated", { tracking: "" }))
      expect(r.status).toBe(200)
      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe("ZZ000000000BR")
      expect(frete.aviso_despacho.status).toBe("enviado")
      expect(whatsappEnviados).toHaveLength(1)
      expect(whatsappEnviados[0].text).toContain("ZZ000000000BR")
    })

    it("order.posted com código preenche o rastreio que faltou (o generated pode ter se perdido)", async () => {
      const p = await criarPedido()
      const r = await chamar(corpoDe(p.display_id, "order.posted", COM_CODIGO))
      expect(r.status).toBe(200)
      const frete = await lerFrete(p.id)
      expect(frete.tracking_number).toBe("AA123456789BR")
      expect(frete.tracking_url).toBe("https://exemplo.invalid/AA123456789BR")
      expect(whatsappEnviados[0].text).toContain("AA123456789BR")
    })

    it("order.delivered com outro código NÃO sobrescreve o rastreio existente", async () => {
      const p = await criarPedido({ tracking_number: "ZZ000000000BR" })
      await chamar(corpoDe(p.display_id, "order.delivered", COM_CODIGO))
      expect((await lerFrete(p.id)).tracking_number).toBe("ZZ000000000BR")
    })

    it("Evolution recusa com 4xx (número fora do WhatsApp) → 200, sem marca, sem retentativa", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      modoEvolution = "400"
      const r = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r.status).toBe(200)
      expect(r.data).toMatchObject({ enviado: false })
      const frete = await lerFrete(p.id)
      expect(frete.eventos["order.posted"]).toEqual(expect.any(String))
      expect(frete.avisos).toBeUndefined()
    })

    it("Evolution pendurada: o timeout da rota estoura antes dos 30 s da SuperFrete → 500, sem marca", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      modoEvolution = "pendurado"
      const inicio = Date.now()
      const r = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r.status).toBe(500)
      expect(Date.now() - inicio).toBeLessThan(30_000)
      expect((await lerFrete(p.id)).avisos).toBeUndefined()
    })

    it("chave de primeiro nível gravada por outro escritor no meio da requisição sobrevive (só `frete` vai no update)", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      await pedidos.updateOrders(p.id, { metadata: { fiscal: { status: "pendente" } } })
      // Outro escritor (ex.: o webhook da Brasil NFe) MUDA `fiscal` enquanto a mensagem sai — DEPOIS
      // de a rota ter lido o pedido. Antes da correção, o write da marca mandava `{ ...metadata }`
      // lido no começo, e o merge raso do Medusa devolvia `fiscal` ao valor velho ("pendente").
      duranteOEnvio = async () => {
        await pedidos.updateOrders(p.id, { metadata: { fiscal: { status: "autorizada" } } })
      }
      const r = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r.status).toBe(200)
      const md = (await pedidos.retrieveOrder(p.id)).metadata as Record<string, any>
      expect(md.fiscal).toEqual({ status: "autorizada" })
      expect(md.observacao).toBe("não mexer")
      expect(md.frete.avisos.posted).toEqual(expect.any(String))
    })

    it("chave de `frete` gravada pelo Cockpit durante o envio sobrevive à marca (frete relido antes de marcar)", async () => {
      const p = await criarPedido(PENDENTE)
      duranteOEnvio = async () => {
        const atual = (await pedidos.retrieveOrder(p.id)).metadata as Record<string, any>
        await pedidos.updateOrders(p.id, { metadata: { frete: { ...atual.frete, label_url: "https://exemplo.invalid/etiqueta.pdf" } } })
      }
      const r = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
      expect(r.status).toBe(200)
      const frete = await lerFrete(p.id)
      expect(frete.label_url).toBe("https://exemplo.invalid/etiqueta.pdf")
      expect(frete.aviso_despacho.status).toBe("enviado")
      expect(frete.tracking_number).toBe("AA123456789BR")
    })

    it("mensagem enviada mas a marca falha ao gravar → 200 com marcado: false (nunca 500, que duplicaria a mensagem)", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      // Espião no serviço de pedidos REAL do container: deixa o write do estado passar e derruba só
      // o seguinte (o da marca). O app roda no mesmo processo (inApp), então é a mesma instância.
      const original = pedidos.updateOrders.bind(pedidos)
      let chamadas = 0
      const espiao = jest.spyOn(pedidos, "updateOrders").mockImplementation(((...args: unknown[]) => {
        chamadas++
        if (chamadas === 2) return Promise.reject(new Error("banco fora do ar"))
        return (original as (...a: unknown[]) => unknown)(...args)
      }) as never)
      try {
        const r = await chamar(corpoDe(p.display_id, "order.posted"))
        expect(chamadas).toBe(2)
        expect(r.status).toBe(200)
        expect(r.data).toMatchObject({ enviado: true, marcado: false })
      } finally {
        espiao.mockRestore()
      }
      expect(whatsappEnviados).toHaveLength(1)
      expect((await lerFrete(p.id)).avisos).toBeUndefined()
    })

    // ---- Revisão da Task 2 (fix round 2) ----

    it("Evolution responde 401 (chave errada ou trocada) → FALHA: 500 e sem marca", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      modoEvolution = "401"
      const r = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r.status).toBe(500)
      expect((await lerFrete(p.id)).avisos).toBeUndefined()
    })

    it("Evolution responde 400 SEM `exists: false` (instância desconectada, payload ruim) → FALHA: 500 e sem marca", async () => {
      const p = await criarPedido({ tracking_number: "AA123456789BR" })
      modoEvolution = "400-outro"
      const r = await chamar(corpoDe(p.display_id, "order.posted"))
      expect(r.status).toBe(500)
      expect((await lerFrete(p.id)).avisos).toBeUndefined()
    })

    it("aviso_despacho marcado 'enviado' por outro caminho ENTRE a leitura do pedido e o write do estado: não volta a 'pendente' nem manda de novo", async () => {
      const p = await criarPedido(PENDENTE)
      const jaEnviado = { status: "enviado", desde: "2026-09-21T10:00:00.000Z", em: "2026-09-21T10:00:30.000Z", por: "cockpit" }
      // A rota lê o pedido pelo Query no começo e RELÊ pelo módulo de pedidos antes do write do
      // estado. O espião, na primeira releitura, faz o que o Cockpit/job faria nesse intervalo:
      // marca o despacho como enviado. Determinístico — não depende de tempo.
      const original = pedidos.retrieveOrder.bind(pedidos)
      let primeira = true
      const espiao = jest.spyOn(pedidos, "retrieveOrder").mockImplementation((async (...args: unknown[]) => {
        if (primeira) {
          primeira = false
          const atual = (await original(p.id)).metadata as Record<string, any>
          await pedidos.updateOrders(p.id, { metadata: { frete: { ...atual.frete, aviso_despacho: jaEnviado } } })
        }
        return (original as (...a: unknown[]) => unknown)(...args)
      }) as never)
      try {
        const r = await chamar(corpoDe(p.display_id, "order.generated", COM_CODIGO))
        expect(r.status).toBe(200)
        expect(primeira).toBe(false)
      } finally {
        espiao.mockRestore()
      }
      const frete = await lerFrete(p.id)
      expect(frete.aviso_despacho).toEqual(jaEnviado)
      expect(frete.tracking_number).toBe("AA123456789BR")
      expect(frete.eventos["order.generated"]).toEqual(expect.any(String))
      expect(whatsappEnviados).toHaveLength(0)
    })
  },
})
