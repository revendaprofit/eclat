import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { validarCaminhoFiscal } from "@/lib/fiscal"

// Proxy do Cockpit para /admin/fiscal/* (Invariante 2: o Cockpit só fala pelas APIs donas).
async function proxy(req: Request, path: string[], method: "GET" | "POST" | "PATCH") {
  // Valida os segmentos ANTES de montar qualquer URL — sem isso, um path traversal decodificado
  // (ex.: "..", vindo de "%2e%2e" na URL) escapava de /admin/fiscal/ para qualquer rota da Admin
  // API, com o bearer token de admin do Cockpit anexado. Ver o comentário de
  // validarCaminhoFiscal em lib/fiscal.ts para a cadeia completa (achado crítico da revisão).
  const validacao = validarCaminhoFiscal(path)
  if (!validacao.ok) {
    return NextResponse.json({ error: "Rota fiscal inválida." }, { status: validacao.status })
  }

  const url = new URL(req.url)
  const caminho = `/admin/fiscal/${path.join("/")}${url.search}`
  const body = method === "GET" ? undefined : await req.text()
  try {
    const r = await medusaAdmin(caminho, {
      method,
      body: body || undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    })
    const data = await r.json().catch(() => ({}))
    // Repassa o status do backend em vez de achatar tudo em 502: as rotas fiscais usam 422 para
    // erro de negócio legível (ErroFiscal) e 400 para requisição malformada — sem isso a tela
    // perde a mensagem que o operador precisa ler.
    if (!r.ok) return NextResponse.json(data, { status: r.status })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path, "GET")
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path, "POST")
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path, "PATCH")
}
