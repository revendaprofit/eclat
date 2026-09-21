// Testa apps/backend/ativar-webhook-superfrete.mjs como processo filho, contra uma SuperFrete
// FALSA em 127.0.0.1 (SUPERFRETE_BASE_URL). Nunca chama a API real: o ambiente do filho é
// montado do zero (não herda o process.env do Jest) e sempre aponta para o servidor falso.
import { execFile } from "node:child_process"
import { createServer, IncomingMessage, Server } from "node:http"
import { AddressInfo } from "node:net"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const SCRIPT = path.resolve(__dirname, "../../../ativar-webhook-superfrete.mjs")
const NOSSA_URL = "https://backend.exemplo.test/webhooks/superfrete"
const OUTRA_URL = "https://outro-sistema.exemplo.test/hook?token=NAO-PODE-APARECER"
const TOKEN = "tok-falso-da-conta"
const SEGREDO_NOVO = "segredo-gerado-pela-superfrete-123"
const SEIS = ["order.created", "order.released", "order.generated", "order.posted", "order.delivered", "order.cancelled"]

type Req = { method: string; url: string; headers: IncomingMessage["headers"]; body: any }
type Webhook = { id: string; name: string; url: string; events: string[]; is_active: boolean; secret_token?: string }

let servidor: Server
let base = ""
let webhooks: Webhook[] = []
let requisicoes: Req[] = []
let falharCom: number | null = null

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let bruto = ""
    req.on("data", (c) => (bruto += c))
    req.on("end", () => {
      const body = bruto ? JSON.parse(bruto) : undefined
      requisicoes.push({ method: req.method!, url: req.url!, headers: req.headers, body })
      const responder = (status: number, dados?: unknown) => {
        res.writeHead(status, { "content-type": "application/json" })
        res.end(dados === undefined ? "" : JSON.stringify(dados))
      }
      if (falharCom) return responder(falharCom, { message: "detalhe-interno-do-erro" })
      const m = req.url!.match(/^\/api\/v0\/webhook(?:\/([^/?]+))?$/)
      if (!m) return responder(404, {})
      const id = m[1] ? decodeURIComponent(m[1]) : null
      if (req.method === "GET" && !id) return responder(200, webhooks)
      if (req.method === "POST" && !id) {
        const novo = { id: `wh-${webhooks.length + 1}`, name: body.name, url: body.url, events: body.events, is_active: true }
        webhooks.push(novo)
        return responder(201, { ...novo, secret_token: SEGREDO_NOVO, created_at: "2026-09-21T12:00:00Z" })
      }
      const alvo = webhooks.find((w) => w.id === id)
      if (!alvo) return responder(400, {})
      if (req.method === "PUT") {
        Object.assign(alvo, body)
        return responder(200, { ...alvo, updated_at: "2026-09-21T12:00:00Z" })
      }
      if (req.method === "DELETE") {
        webhooks = webhooks.filter((w) => w.id !== id)
        return responder(204)
      }
      return responder(405, {})
    })
  })
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((r) => servidor.close(() => r()))
})

beforeEach(() => {
  webhooks = []
  requisicoes = []
  falharCom = null
})

function ambiente(extra: Record<string, string | undefined> = {}) {
  const env: Record<string, string> = {
    SUPERFRETE_BASE_URL: base,
    SUPERFRETE_TOKEN: TOKEN,
    SUPERFRETE_CONTACT_EMAIL: "contato@exemplo.test",
    SUPERFRETE_WEBHOOK_URL: NOSSA_URL,
  }
  // Mínimo para o Node rodar no Windows; nada do ambiente do Jest (que pode ter variáveis reais).
  for (const k of ["PATH", "Path", "SystemRoot", "TEMP", "TMP"]) if (process.env[k]) env[k] = process.env[k]!
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete env[k]
    else env[k] = v
  }
  return env
}

function rodar(args: string[], extra: Record<string, string | undefined> = {}) {
  return new Promise<{ codigo: number; saida: string }>((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: ambiente(extra), timeout: 15000 }, (erro, stdout, stderr) => {
      const codigo = erro ? (typeof (erro as any).code === "number" ? (erro as any).code : 1) : 0
      resolve({ codigo, saida: `${stdout}\n${stderr}` })
    })
  })
}

const escritas = () => requisicoes.filter((r) => r.method !== "GET")

describe("ativar-webhook-superfrete.mjs", () => {
  it.each([["SUPERFRETE_TOKEN"], ["SUPERFRETE_CONTACT_EMAIL"], ["SUPERFRETE_WEBHOOK_URL"]])(
    "sem %s: mensagem clara, código 1 e nenhuma chamada",
    async (faltando) => {
      const { codigo, saida } = await rodar(["--aplicar"], { [faltando]: undefined })
      expect(codigo).toBe(1)
      expect(saida).toContain(faltando)
      expect(requisicoes).toHaveLength(0)
    }
  )

  it("URL do webhook que não é https: recusa sem chamar nada", async () => {
    const { codigo, saida } = await rodar(["--aplicar"], { SUPERFRETE_WEBHOOK_URL: "http://backend.exemplo.test/webhooks/superfrete" })
    expect(codigo).toBe(1)
    expect(saida).toMatch(/https/)
    expect(requisicoes).toHaveLength(0)
  })

  it("sem argumento: lista, diz que criaria, não grava e não expõe token nem query de outra URL", async () => {
    webhooks = [{ id: "wh-outro", name: "Outro", url: OUTRA_URL, events: ["order.posted"], is_active: true, secret_token: "segredo-alheio" }]
    const { codigo, saida } = await rodar([])
    expect(codigo).toBe(0)
    expect(escritas()).toHaveLength(0)
    expect(requisicoes).toHaveLength(1)
    expect(requisicoes[0].method).toBe("GET")
    expect(requisicoes[0].url).toBe("/api/v0/webhook")
    expect(requisicoes[0].headers.authorization).toBe(`Bearer ${TOKEN}`)
    expect(requisicoes[0].headers["user-agent"]).toBe("use.ECLAT (contato@exemplo.test)")
    expect(saida).toContain("Outro")
    expect(saida).toContain("outro-sistema.exemplo.test/hook")
    expect(saida).not.toContain("NAO-PODE-APARECER")
    expect(saida).not.toContain("segredo-alheio")
    expect(saida).not.toContain(TOKEN)
    expect(saida).toMatch(/criaria/i)
    expect(saida).toMatch(/simula/i)
  })

  it("--aplicar sem webhook nosso: cria com os seis eventos e mostra o segredo uma vez", async () => {
    webhooks = [{ id: "wh-outro", name: "Outro", url: OUTRA_URL, events: ["order.posted"], is_active: true }]
    const { codigo, saida } = await rodar(["--aplicar"])
    expect(codigo).toBe(0)
    const posts = escritas()
    expect(posts).toHaveLength(1)
    expect(posts[0].method).toBe("POST")
    expect(posts[0].url).toBe("/api/v0/webhook")
    expect(posts[0].body.url).toBe(NOSSA_URL)
    expect(posts[0].body.events).toEqual(SEIS)
    expect(typeof posts[0].body.name).toBe("string")
    expect(posts[0].headers["content-type"]).toMatch(/application\/json/)
    expect(saida.split(SEGREDO_NOVO)).toHaveLength(2) // aparece exatamente uma vez
    expect(saida).toContain("SUPERFRETE_WEBHOOK_SECRET")
    expect(saida).not.toContain(TOKEN)
    expect(webhooks.find((w) => w.id === "wh-outro")!.url).toBe(OUTRA_URL)
  })

  it("--aplicar --salvar-segredo=arquivo: grava o segredo no arquivo e não imprime", async () => {
    const pasta = mkdtempSync(path.join(tmpdir(), "eclat-webhook-"))
    const arquivo = path.join(pasta, "segredo.txt")
    try {
      const { codigo, saida } = await rodar(["--aplicar", `--salvar-segredo=${arquivo}`])
      expect(codigo).toBe(0)
      expect(saida).not.toContain(SEGREDO_NOVO)
      expect(saida).toContain(arquivo)
      expect(readFileSync(arquivo, "utf8").trim()).toBe(SEGREDO_NOVO)
    } finally {
      rmSync(pasta, { recursive: true, force: true })
    }
  })

  it("--salvar-segredo para um arquivo que já existe: recusa antes de chamar a API", async () => {
    const pasta = mkdtempSync(path.join(tmpdir(), "eclat-webhook-"))
    const arquivo = path.join(pasta, "segredo.txt")
    writeFileSync(arquivo, "antigo")
    try {
      const { codigo } = await rodar(["--aplicar", `--salvar-segredo=${arquivo}`])
      expect(codigo).toBe(1)
      expect(requisicoes).toHaveLength(0)
      expect(readFileSync(arquivo, "utf8")).toBe("antigo")
    } finally {
      rmSync(pasta, { recursive: true, force: true })
    }
  })

  it("--aplicar com a mesma URL já cadastrada mas incompleta/inativa: atualiza, não duplica", async () => {
    webhooks = [
      { id: "wh-nosso", name: "velho", url: NOSSA_URL, events: ["order.posted"], is_active: false },
      { id: "wh-outro", name: "Outro", url: OUTRA_URL, events: ["order.posted"], is_active: true },
    ]
    const { codigo, saida } = await rodar(["--aplicar"])
    expect(codigo).toBe(0)
    const e = escritas()
    expect(e).toHaveLength(1)
    expect(e[0].method).toBe("PUT")
    expect(e[0].url).toBe("/api/v0/webhook/wh-nosso")
    expect(e[0].body).toMatchObject({ url: NOSSA_URL, events: SEIS, is_active: true })
    expect(webhooks).toHaveLength(2)
    expect(saida).toMatch(/atualizado/i)
    expect(saida).toMatch(/SUPERFRETE_WEBHOOK_SECRET/) // lembra que o segredo é o da criação
  })

  it("a URL com barra no fim conta como a mesma", async () => {
    webhooks = [{ id: "wh-nosso", name: "velho", url: `${NOSSA_URL}/`, events: ["order.posted"], is_active: true }]
    const { codigo } = await rodar(["--aplicar"])
    expect(codigo).toBe(0)
    expect(escritas().map((r) => r.method)).toEqual(["PUT"])
  })

  it("--aplicar com o nosso já completo e ativo: não grava nada (idempotente)", async () => {
    webhooks = [{ id: "wh-nosso", name: "use.ECLAT", url: NOSSA_URL, events: [...SEIS].reverse(), is_active: true }]
    const { codigo, saida } = await rodar(["--aplicar"])
    expect(codigo).toBe(0)
    expect(escritas()).toHaveLength(0)
    expect(saida).toMatch(/nada a fazer/i)
  })

  it("--aplicar com dois webhooks na mesma URL: não adivinha, para sem gravar", async () => {
    webhooks = [
      { id: "wh-a", name: "a", url: NOSSA_URL, events: SEIS, is_active: true },
      { id: "wh-b", name: "b", url: NOSSA_URL, events: SEIS, is_active: true },
    ]
    const { codigo, saida } = await rodar(["--aplicar"])
    expect(codigo).toBe(1)
    expect(escritas()).toHaveLength(0)
    expect(saida).toContain("wh-a")
    expect(saida).toContain("--desfazer")
  })

  it("--aplicar --desfazer: remove só os webhooks da nossa URL", async () => {
    webhooks = [
      { id: "wh-a", name: "a", url: NOSSA_URL, events: SEIS, is_active: true },
      { id: "wh-outro", name: "Outro", url: OUTRA_URL, events: ["order.posted"], is_active: true },
      { id: "wh-b", name: "b", url: NOSSA_URL, events: ["order.posted"], is_active: false },
    ]
    const { codigo, saida } = await rodar(["--aplicar", "--desfazer"])
    expect(codigo).toBe(0)
    const e = escritas()
    expect(e.map((r) => `${r.method} ${r.url}`).sort()).toEqual(["DELETE /api/v0/webhook/wh-a", "DELETE /api/v0/webhook/wh-b"])
    expect(webhooks.map((w) => w.id)).toEqual(["wh-outro"])
    expect(saida).toMatch(/removido/i)
  })

  it("--desfazer sem --aplicar: só mostra o que removeria", async () => {
    webhooks = [{ id: "wh-a", name: "a", url: NOSSA_URL, events: SEIS, is_active: true }]
    const { codigo, saida } = await rodar(["--desfazer"])
    expect(codigo).toBe(0)
    expect(escritas()).toHaveLength(0)
    expect(saida).toMatch(/removeria/i)
  })

  it("--aplicar --desfazer sem nenhum nosso: nada a fazer, sem DELETE", async () => {
    webhooks = [{ id: "wh-outro", name: "Outro", url: OUTRA_URL, events: ["order.posted"], is_active: true }]
    const { codigo, saida } = await rodar(["--aplicar", "--desfazer"])
    expect(codigo).toBe(0)
    expect(escritas()).toHaveLength(0)
    expect(saida).toMatch(/nada a fazer/i)
  })

  it("erro HTTP da SuperFrete: código 1, mostra o status e não o corpo nem o token", async () => {
    falharCom = 401
    const { codigo, saida } = await rodar([])
    expect(codigo).toBe(1)
    expect(saida).toContain("HTTP 401")
    expect(saida).not.toContain("detalhe-interno-do-erro")
    expect(saida).not.toContain(TOKEN)
  })

  it("SUPERFRETE_SANDBOX=true sem SUPERFRETE_BASE_URL aponta para o sandbox (conferido sem rede)", async () => {
    // Não dá para deixar chamar o sandbox de verdade: com --mostrar-base o script só imprime a base e sai.
    const { codigo, saida } = await rodar(["--mostrar-base"], { SUPERFRETE_BASE_URL: undefined, SUPERFRETE_SANDBOX: "true" })
    expect(codigo).toBe(0)
    expect(saida).toContain("https://sandbox.superfrete.com")
    expect(requisicoes).toHaveLength(0)
    const prod = await rodar(["--mostrar-base"], { SUPERFRETE_BASE_URL: undefined })
    expect(prod.saida).toContain("https://api.superfrete.com")
  })
})
