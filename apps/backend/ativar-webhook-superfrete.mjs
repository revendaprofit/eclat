// F5 do frete (spec 2026-09-20-avisos-entrega-superfrete-design.md §4.6 e §10) — cadastra na conta
// da SuperFrete o webhook que avisa o backend (rota POST /webhooks/superfrete) quando a etiqueta
// muda de estado. Idempotente. Nunca mexe em webhook de outra URL.
//
// Rodar de apps/backend, com as variáveis do .env local:
//   cd apps/backend
//   node --env-file=.env ativar-webhook-superfrete.mjs                → só MOSTRA os webhooks e o que faria
//   node --env-file=.env ativar-webhook-superfrete.mjs --desfazer     → mostra o que removeria
// Grava (só o DONO, com "pode aplicar", no terminal dele — o Claude nunca roda o --aplicar que cria):
//   … --aplicar                        → cria o webhook com os seis eventos; se já existe um com a mesma
//                                        URL, atualiza (não duplica). Mostra o segredo UMA vez na tela.
//   … --aplicar --salvar-segredo=<arq> → idem, mas grava o segredo num arquivo NOVO (fora de qualquer
//                                        repositório git) em vez de mostrar. Obrigatório sem terminal.
//   … --aplicar --desfazer             → remove o(s) webhook(s) com essa URL.
//
// Ambiente: SUPERFRETE_TOKEN, SUPERFRETE_CONTACT_EMAIL (vai no User-Agent, como no backend) e
// SUPERFRETE_WEBHOOK_URL (URL pública do backend + /webhooks/superfrete, https). SUPERFRETE_SANDBOX=true
// usa o sandbox. SUPERFRETE_BASE_URL troca a base da API (só para os testes, com servidor falso);
// SUPERFRETE_TESTE_* só valem com a base em 127.0.0.1.
//
// O SEGREDO DA ASSINATURA É DA SUPERFRETE, não nosso: a API não aceita segredo na criação; ela gera
// um `secret_token` e o devolve UMA VEZ, na resposta da criação (a listagem e a atualização não o
// trazem). Copie para SUPERFRETE_WEBHOOK_SECRET no Railway logo em seguida. Perdeu o segredo? Rode
// --aplicar --desfazer e depois --aplicar de novo (webhook novo, segredo novo).
// Doc: https://superfrete.readme.io/reference/criar-webhook-app e https://superfrete.readme.io/reference/webhook
//
// Garantias: sem terminal (agente, pipe, log) o --aplicar que pode criar é recusado sem
// --salvar-segredo, para o segredo não parar num transcript. O arquivo é aberto ANTES da criação;
// se a escrita falhar depois, o segredo é impresso para não se perder. O modo 0600 do arquivo não
// protege nada no Windows — apague o arquivo assim que copiar. Nunca imprime o token da conta nem o
// segredo de webhooks existentes; de webhooks de outros sistemas mostra só a origem.
import { closeSync, existsSync, openSync, statSync, unlinkSync, writeSync } from "node:fs"
import path from "node:path"

const EVENTOS = ["order.created", "order.released", "order.generated", "order.posted", "order.delivered", "order.cancelled"]
const NOME = "use.ECLAT — avisos de entrega"
const PRODUCAO = "https://api.superfrete.com"
const FLAGS = new Set(["--aplicar", "--desfazer", "--mostrar-base"])

const semBarraFinal = (u) => String(u ?? "").replace(/\/+$/, "")
const mesmaUrl = (a, b) => semBarraFinal(a) === semBarraFinal(b)
const origemDe = (u) => {
  try {
    return new URL(u).origin
  } catch {
    return "(URL ilegível)"
  }
}
const eventosCompletos = (w) => EVENTOS.every((e) => (w.events ?? []).includes(e)) && (w.events ?? []).length === EVENTOS.length

// Sobe a partir da pasta do arquivo procurando `.git` (pasta no clone, arquivo numa worktree).
function repositorioGitAcima(arquivo) {
  let pasta = path.dirname(path.resolve(arquivo))
  for (;;) {
    if (existsSync(path.join(pasta, ".git"))) return pasta
    const acima = path.dirname(pasta)
    if (acima === pasta) return null
    pasta = acima
  }
}

function falhar(msg) {
  console.error(`✗ ${msg}`)
  process.exitCode = 1
}

async function main() {
  // --- argumentos: qualquer coisa desconhecida para tudo antes de chamar ---
  const args = process.argv.slice(2)
  let salvarSegredo = null
  for (const a of args) {
    if (a === "--salvar-segredo" || a.startsWith("--salvar-segredo=")) {
      const valor = a.slice("--salvar-segredo=".length)
      if (a === "--salvar-segredo" || !valor.trim()) return falhar("--salvar-segredo precisa de um arquivo: --salvar-segredo=<arquivo>. Nada foi chamado.")
      salvarSegredo = valor
    } else if (!FLAGS.has(a)) {
      return falhar(`argumento desconhecido: ${a}. Use --aplicar, --desfazer ou --salvar-segredo=<arquivo>. Nada foi chamado.`)
    }
  }
  const aplicar = args.includes("--aplicar")
  const desfazer = args.includes("--desfazer")

  const BASE = semBarraFinal(
    process.env.SUPERFRETE_BASE_URL ||
      (process.env.SUPERFRETE_SANDBOX === "true" ? "https://sandbox.superfrete.com" : PRODUCAO)
  )
  console.log(`Base da API: ${BASE}`)
  if (BASE !== PRODUCAO) {
    console.warn(`! atenção: esta base NÃO é a de produção (${PRODUCAO}) — um webhook cadastrado assim NÃO é o que a loja usa.`)
  }
  if (args.includes("--mostrar-base")) return
  // Interruptores de teste: só com a SuperFrete FALSA em 127.0.0.1; contra a API real não existem.
  let baseLocal = false
  try {
    baseLocal = new URL(BASE).hostname === "127.0.0.1"
  } catch {}
  const teste = (nome) => baseLocal && process.env[nome] === "1"
  const temTerminal = Boolean(process.stdout.isTTY) || teste("SUPERFRETE_TESTE_FINGIR_TTY")

  const TOKEN = process.env.SUPERFRETE_TOKEN
  const CONTATO = process.env.SUPERFRETE_CONTACT_EMAIL
  const ALVO = process.env.SUPERFRETE_WEBHOOK_URL
  const faltando = [
    ["SUPERFRETE_TOKEN", TOKEN],
    ["SUPERFRETE_CONTACT_EMAIL", CONTATO],
    ["SUPERFRETE_WEBHOOK_URL", ALVO],
  ].filter(([, v]) => !v).map(([k]) => k)
  if (faltando.length) return falhar(`defina ${faltando.join(", ")} no ambiente. Nada foi chamado.`)
  let alvoOk = false
  try {
    alvoOk = new URL(ALVO).protocol === "https:"
  } catch {}
  if (!alvoOk) return falhar("SUPERFRETE_WEBHOOK_URL precisa ser uma URL https (URL pública do backend + /webhooks/superfrete). Nada foi chamado.")
  if (!/\/webhooks\/superfrete\/?$/.test(new URL(ALVO).pathname)) {
    console.warn("! atenção: SUPERFRETE_WEBHOOK_URL não termina em /webhooks/superfrete — confira se é mesmo a rota do backend.")
  }

  if (salvarSegredo) {
    if (desfazer) return falhar("--salvar-segredo não combina com --desfazer (remover não gera segredo). Nada foi chamado.")
    if (existsSync(salvarSegredo)) return falhar(`${salvarSegredo} já existe — escolha um arquivo novo (não sobrescrevo segredo). Nada foi chamado.`)
    const repo = repositorioGitAcima(salvarSegredo)
    if (repo) return falhar(`${salvarSegredo} fica dentro de um repositório git (${repo}) — segredo não entra em git. Escolha uma pasta fora dele (nem no Drive). Nada foi chamado.`)
  }
  if (aplicar && !desfazer && !salvarSegredo && !temTerminal) {
    return falhar(
      "sem terminal (saída redirecionada ou rodando por um agente): o segredo novo iria parar num log. " +
        "Rode no seu terminal ou use --salvar-segredo=<arquivo fora do repositório>. Nada foi chamado."
    )
  }

  // O arquivo do segredo é aberto ANTES de qualquer chamada: se não der para criá-lo, nada é chamado.
  // Se no fim não houver criação (atualizar/nada/erro), o arquivo vazio é apagado.
  let fd = null
  if (salvarSegredo && aplicar) {
    try {
      fd = openSync(salvarSegredo, "wx", 0o600)
    } catch (e) {
      return falhar(`não consegui criar ${salvarSegredo} (${e?.code ?? e?.name}). Nada foi chamado.`)
    }
  }
  const soltarArquivo = () => {
    if (fd === null) return
    closeSync(fd)
    fd = null
    apagarSeVazio(salvarSegredo)
  }
  try {
    await executar()
  } finally {
    soltarArquivo()
  }

  async function executar() {
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
      const nosso = mesmaUrl(w.url, ALVO)
      const onde = nosso ? `${origemDe(w.url)}${new URL(ALVO).pathname}  ← NOSSO` : `${origemDe(w.url)} (caminho oculto)`
      console.log(`  · ${w.name ?? "(sem nome)"} [${w.id}] ${onde} — ${w.is_active === false ? "INATIVO" : "ativo"} — eventos: ${(w.events ?? []).join(", ") || "(nenhum)"}`)
    }
    const nossos = lista.filter((w) => mesmaUrl(w.url, ALVO))
    console.log(`URL alvo: ${origemDe(ALVO)}${new URL(ALVO).pathname}`)

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
    const lembreteSegredo =
      "  Se SUPERFRETE_WEBHOOK_SECRET NÃO está no Railway (ou você não tem mais o segredo): rode --aplicar --desfazer e depois --aplicar (segredo novo)."

    if (plano === "nada") {
      console.log(`Nada a fazer: o webhook ${existente.id} já está ativo com os seis eventos.`)
      console.log(lembreteSegredo)
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
      console.log(lembreteSegredo)
      return
    }

    const criado = await chamar("POST", "/api/v0/webhook", { name: NOME, url: ALVO, events: EVENTOS })
    console.log(`✓ webhook criado: ${criado?.id ?? "(sem id na resposta)"} — seis eventos.`)
    const segredo = typeof criado?.secret_token === "string" ? criado.secret_token.trim() : ""
    if (!segredo) {
      console.error("! a resposta da criação não trouxe secret_token. Sem ele o backend ignora os avisos (responde 200 e não faz nada).")
      console.error("  Rode --aplicar --desfazer e --aplicar de novo.")
      process.exitCode = 1
      return
    }

    if (fd !== null) {
      let gravou = false
      try {
        if (teste("SUPERFRETE_TESTE_FALHAR_ESCRITA")) throw Object.assign(new Error("falha simulada"), { code: "EIO" })
        writeSync(fd, segredo) // sem quebra de linha: o conteúdo é colado no Railway como está
        gravou = true
      } catch (e) {
        console.error(`✗ não consegui gravar o segredo em ${salvarSegredo} (${e?.code ?? e?.name}).`)
      } finally {
        soltarArquivo() // fecha; se ficou vazio (falhou), apaga
      }
      if (gravou) {
        console.log(`✓ segredo gravado em ${salvarSegredo} (não mostrado na tela).`)
        console.log("  Copie o conteúdo para SUPERFRETE_WEBHOOK_SECRET no Railway AGORA e APAGUE o arquivo.")
        console.log("  Até lá, os avisos de postado/entregue que chegarem são ignorados e não voltam.")
        return
      }
      // O webhook já existe e o segredo não aparece em nenhum outro lugar: imprimir é a única forma de não perdê-lo.
      process.exitCode = 1
      console.error("  Para o segredo não se perder, ele vai na tela UMA vez:")
    }
    console.log("")
    console.log("  SEGREDO DA ASSINATURA (a SuperFrete só mostra agora; não fica guardado em lugar nenhum):")
    console.log(`  ${segredo}`)
    console.log("  → copie para SUPERFRETE_WEBHOOK_SECRET no Railway AGORA. Não cole em git, chat nem Drive.")
    console.log("  Até lá, os avisos de postado/entregue que chegarem são ignorados e não voltam.")
    console.log("")
  }
}

function apagarSeVazio(arquivo) {
  try {
    if (statSync(arquivo).size === 0) unlinkSync(arquivo)
  } catch {}
}

main().catch((e) => {
  console.error(`✗ ${e?.name === "TimeoutError" ? "a SuperFrete não respondeu em 15 s" : e.message}`)
  process.exitCode = 1
})
