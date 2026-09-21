// F5 do frete (spec 2026-09-20-avisos-entrega-superfrete-design.md §4.6) — cadastra na conta da
// SuperFrete o webhook que avisa o backend (rota POST /webhooks/superfrete) quando a etiqueta
// muda de estado. Idempotente. Nunca mexe em webhook de outra URL.
//
// Sem argumentos: só MOSTRA os webhooks da conta e o que faria (não grava nada).
//   node ativar-webhook-superfrete.mjs
//   node ativar-webhook-superfrete.mjs --desfazer          → mostra o que removeria
// Grava (só com "pode aplicar" do dono):
//   node ativar-webhook-superfrete.mjs --aplicar            → cria o webhook com os seis eventos; se já
//                                                             existe um com a mesma URL, atualiza (não duplica)
//   node ativar-webhook-superfrete.mjs --aplicar --salvar-segredo=<arquivo>
//                                                           → idem, mas grava o segredo novo no arquivo em vez
//                                                             de mostrar na tela (o arquivo não pode existir)
//   node ativar-webhook-superfrete.mjs --aplicar --desfazer → remove o(s) webhook(s) com essa URL
//
// Ambiente: SUPERFRETE_TOKEN, SUPERFRETE_CONTACT_EMAIL (vai no User-Agent, como no backend) e
// SUPERFRETE_WEBHOOK_URL (URL pública do backend + /webhooks/superfrete, https). SUPERFRETE_SANDBOX=true
// usa o sandbox. SUPERFRETE_BASE_URL troca a base da API (só para os testes, com servidor falso).
//
// O SEGREDO DA ASSINATURA É DA SUPERFRETE, não nosso: a API não aceita segredo na criação; ela gera
// um `secret_token` e o devolve UMA VEZ, na resposta da criação (a listagem e a atualização não o
// trazem). Por isso o --aplicar que CRIA mostra o segredo uma única vez (ou grava no arquivo de
// --salvar-segredo): copie para SUPERFRETE_WEBHOOK_SECRET no Railway. Perdeu o segredo? Rode
// --aplicar --desfazer e depois --aplicar de novo (webhook novo, segredo novo).
// Doc: https://superfrete.readme.io/reference/criar-webhook-app e https://superfrete.readme.io/reference/webhook
//
// Nunca imprime o token da conta nem o segredo de webhooks existentes; de URLs de outros webhooks
// mostra só o endereço, sem a query (que pode carregar token de outro sistema).
import { existsSync, writeFileSync } from "node:fs"

const EVENTOS = ["order.created", "order.released", "order.generated", "order.posted", "order.delivered", "order.cancelled"]
const NOME = "use.ECLAT — avisos de entrega"

const semBarraFinal = (u) => String(u ?? "").replace(/\/+$/, "")
const mesmaUrl = (a, b) => semBarraFinal(a) === semBarraFinal(b)
const urlSemQuery = (u) => {
  try {
    const x = new URL(u)
    return `${x.origin}${x.pathname}${x.search ? " (query oculta)" : ""}`
  } catch {
    return "(URL ilegível)"
  }
}
const eventosCompletos = (w) => EVENTOS.every((e) => (w.events ?? []).includes(e)) && (w.events ?? []).length === EVENTOS.length

async function main() {
  const args = process.argv.slice(2)
  const aplicar = args.includes("--aplicar")
  const desfazer = args.includes("--desfazer")
  const salvarSegredo = args.find((a) => a.startsWith("--salvar-segredo="))?.slice("--salvar-segredo=".length) || null

  const BASE = semBarraFinal(
    process.env.SUPERFRETE_BASE_URL ||
      (process.env.SUPERFRETE_SANDBOX === "true" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com")
  )
  if (args.includes("--mostrar-base")) {
    console.log(`Base da API: ${BASE}`)
    return
  }

  const TOKEN = process.env.SUPERFRETE_TOKEN
  const CONTATO = process.env.SUPERFRETE_CONTACT_EMAIL
  const ALVO = process.env.SUPERFRETE_WEBHOOK_URL
  const faltando = [
    ["SUPERFRETE_TOKEN", TOKEN],
    ["SUPERFRETE_CONTACT_EMAIL", CONTATO],
    ["SUPERFRETE_WEBHOOK_URL", ALVO],
  ].filter(([, v]) => !v).map(([k]) => k)
  if (faltando.length) {
    console.error(`✗ defina ${faltando.join(", ")} no ambiente. Nada foi chamado.`)
    process.exitCode = 1
    return
  }
  let alvoOk = false
  try {
    alvoOk = new URL(ALVO).protocol === "https:"
  } catch {}
  if (!alvoOk) {
    console.error("✗ SUPERFRETE_WEBHOOK_URL precisa ser uma URL https (URL pública do backend + /webhooks/superfrete). Nada foi chamado.")
    process.exitCode = 1
    return
  }
  if (!/\/webhooks\/superfrete\/?$/.test(new URL(ALVO).pathname)) {
    console.warn("! atenção: SUPERFRETE_WEBHOOK_URL não termina em /webhooks/superfrete — confira se é mesmo a rota do backend.")
  }
  if (salvarSegredo && existsSync(salvarSegredo)) {
    console.error(`✗ ${salvarSegredo} já existe — escolha um arquivo novo (não sobrescrevo segredo). Nada foi chamado.`)
    process.exitCode = 1
    return
  }

  const cabecalhos = {
    Authorization: `Bearer ${TOKEN}`,
    "User-Agent": `use.ECLAT (${CONTATO})`,
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  // Erro HTTP mostra só o método, o caminho e o status — nunca o corpo (pode ecoar dado da conta).
  const chamar = async (metodo, caminho, corpo) => {
    const r = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`${metodo} ${caminho} → HTTP ${r.status}`)
    const texto = await r.text()
    if (!texto) return null
    try {
      return JSON.parse(texto)
    } catch {
      throw new Error(`${metodo} ${caminho} → HTTP ${r.status}, mas a resposta não é JSON`)
    }
  }

  const resposta = await chamar("GET", "/api/v0/webhook")
  const lista = Array.isArray(resposta) ? resposta : Array.isArray(resposta?.data) ? resposta.data : Array.isArray(resposta?.webhooks) ? resposta.webhooks : null
  if (!lista) throw new Error("GET /api/v0/webhook → resposta fora do formato esperado (lista de webhooks)")

  console.log(`Webhooks na conta da SuperFrete (${lista.length}):`)
  for (const w of lista) {
    const nosso = mesmaUrl(w.url, ALVO) ? "  ← NOSSO" : ""
    console.log(`  · ${w.name ?? "(sem nome)"} [${w.id}] ${urlSemQuery(w.url)} — ${w.is_active === false ? "INATIVO" : "ativo"} — eventos: ${(w.events ?? []).join(", ") || "(nenhum)"}${nosso}`)
  }
  const nossos = lista.filter((w) => mesmaUrl(w.url, ALVO))
  console.log(`URL alvo: ${urlSemQuery(ALVO)}`)

  // --- desfazer: remove todos com a nossa URL, e só eles ---
  if (desfazer) {
    if (nossos.length === 0) {
      console.log("Nada a fazer: nenhum webhook com essa URL.")
      return
    }
    if (!aplicar) {
      console.log(`Removeria ${nossos.length} webhook(s): ${nossos.map((w) => w.id).join(", ")}.`)
      console.log('(simulação — nada gravado; repita com --aplicar --desfazer quando o dono disser "pode aplicar")')
      return
    }
    for (const w of nossos) {
      await chamar("DELETE", `/api/v0/webhook/${encodeURIComponent(w.id)}`)
      console.log(`✓ removido: ${w.id}`)
    }
    console.log("✓ desfeito: a SuperFrete não chama mais o backend. O aviso de despacho continua saindo pela verificação de 5 min.")
    return
  }

  // --- aplicar: cria, atualiza ou nada ---
  if (nossos.length > 1) {
    console.error(`✗ há ${nossos.length} webhooks com essa URL (${nossos.map((w) => w.id).join(", ")}) — não vou adivinhar qual manter.`)
    console.error("  Rode --aplicar --desfazer (remove todos) e depois --aplicar (cria um só, com segredo novo).")
    process.exitCode = 1
    return
  }
  const existente = nossos[0]
  const plano = !existente
    ? "criar"
    : existente.is_active === false || !eventosCompletos(existente) || existente.url !== ALVO
      ? "atualizar"
      : "nada"

  if (plano === "nada") {
    console.log(`Nada a fazer: o webhook ${existente.id} já está ativo com os seis eventos.`)
    return
  }
  if (!aplicar) {
    console.log(
      plano === "criar"
        ? `Criaria o webhook "${NOME}" com os eventos: ${EVENTOS.join(", ")}. A SuperFrete gera o segredo e o mostra só nessa hora.`
        : `Atualizaria o webhook ${existente.id}: ativo, com os eventos ${EVENTOS.join(", ")} (o segredo não muda).`
    )
    console.log('(simulação — nada gravado; repita com --aplicar quando o dono disser "pode aplicar")')
    return
  }

  if (plano === "atualizar") {
    await chamar("PUT", `/api/v0/webhook/${encodeURIComponent(existente.id)}`, { name: NOME, url: ALVO, events: EVENTOS, is_active: true })
    console.log(`✓ webhook ${existente.id} atualizado: ativo, seis eventos.`)
    console.log("  O segredo continua o da criação; ele já deve estar em SUPERFRETE_WEBHOOK_SECRET no Railway.")
    console.log("  Se ele se perdeu: --aplicar --desfazer e depois --aplicar (segredo novo).")
    return
  }

  const criado = await chamar("POST", "/api/v0/webhook", { name: NOME, url: ALVO, events: EVENTOS })
  console.log(`✓ webhook criado: ${criado?.id ?? "(sem id na resposta)"} — seis eventos.`)
  const segredo = criado?.secret_token
  if (!segredo) {
    console.error("! a resposta da criação não trouxe secret_token. Sem ele o backend ignora os avisos (responde 200 e não faz nada).")
    console.error("  Confira no painel da SuperFrete ou rode --aplicar --desfazer e --aplicar de novo.")
    process.exitCode = 1
    return
  }
  if (salvarSegredo) {
    writeFileSync(salvarSegredo, `${segredo}\n`, { flag: "wx", mode: 0o600 })
    console.log(`✓ segredo gravado em ${salvarSegredo} (não mostrado na tela).`)
    console.log("  Copie o conteúdo para SUPERFRETE_WEBHOOK_SECRET no Railway e APAGUE o arquivo.")
  } else {
    console.log("")
    console.log("  SEGREDO DA ASSINATURA (a SuperFrete só mostra agora; não fica guardado em lugar nenhum):")
    console.log(`  ${segredo}`)
    console.log("  → copie para SUPERFRETE_WEBHOOK_SECRET no Railway e redeploy do backend. Não cole em git, chat nem Drive.")
    console.log("")
  }
  console.log("  Até o segredo estar no Railway, o backend responde 200 e ignora os avisos (o despacho sai pela verificação de 5 min).")
}

main().catch((e) => {
  console.error(`✗ ${e?.name === "TimeoutError" ? "a SuperFrete não respondeu em 15 s" : e.message}`)
  process.exitCode = 1
})
