// Rótulos e cores dos status de documento fiscal (spec §9).

export type StatusDocumento =
  | "montado"
  | "transmitido_sem_confirmacao"
  | "autorizado_nao_verificado"
  | "verificado"
  | "rejeitado"
  | "denegado"
  | "em_contingencia"

const ROTULOS: Record<StatusDocumento, string> = {
  montado: "Montado",
  transmitido_sem_confirmacao: "Transmitido sem confirmação",
  autorizado_nao_verificado: "Autorizado (aguardando XML)",
  verificado: "Verificado",
  rejeitado: "Rejeitado",
  denegado: "Denegado",
  em_contingencia: "Em contingência",
}

export function rotuloStatus(status: StatusDocumento): string {
  return ROTULOS[status] ?? String(status)
}

// Só documento reconciliado pode ser referenciado numa NFD (spec §7.3).
export function statusBloqueiaDevolucao(status: StatusDocumento): boolean {
  return status !== "verificado"
}

export function corDoStatus(status: StatusDocumento): "verde" | "amarelo" | "vermelho" {
  if (status === "verificado") return "verde"
  if (status === "rejeitado" || status === "denegado") return "vermelho"
  return "amarelo"
}

// ---- Validação do path do proxy (app/api/fiscal/[...path]/route.ts) — achado crítico da revisão ----
//
// O catch-all do proxy recebia `path` sem validação e montava a URL da Admin API por
// concatenação de string. O roteador do Next decodifica cada segmento antes de popular
// `params.path`, então uma requisição para "/api/fiscal/%2e%2e/%2e%2e/customers" chegava como
// path = ["..", "..", "customers"]. Isso virava "/admin/fiscal/../../customers", e o WHATWG URL
// usado por `fetch` normaliza dot-segments: `new URL("http://host/admin/fiscal/../../customers")`
// colapsa para "/customers". `medusaAdmin()` anexa o bearer token de admin a QUALQUER caminho que
// receba — ele não sabe que o destino final deixou de ser fiscal. Resultado: qualquer sessão do
// Cockpit alcançava qualquer rota da Admin API, autenticada, através do proxy fiscal.
//
// A correção tem duas camadas: (1) nenhum segmento pode ser "." ou ".." nem conter "/" ou "\" —
// isso fecha a via de escape por dot-segment; (2) só o primeiro segmento da allowlist abaixo passa
// — isso limita o proxy às sub-rotas fiscais de fato, mesmo que uma via de escape nova apareça.
//
// "emitir" fica de FORA da allowlist de propósito: essa rota transmite nota fiscal de verdade à
// SEFAZ e não é usada por esta tela. Uma tarefa futura vai chamá-la do servidor, direto por
// medusaAdmin, sem passar por um proxy que o navegador alcança — não a inclua aqui "para
// completar". "resolver" e "emitir-devolucao" ainda não existem no backend (serão criadas em
// tarefa futura), mas já entram na allowlist porque a tela vai precisar delas.
const ROTAS_FISCAL_PERMITIDAS = new Set([
  "config",
  "perfis",
  "documentos",
  "reconciliar",
  "resolver",
  "emitir-devolucao",
])

export type ValidacaoCaminhoFiscal =
  | { ok: true }
  | { ok: false; status: 400 | 404 }

// 400 = segmento malformado (tentativa de path traversal); 404 = rota bem formada mas fora da
// allowlist (não confirma pro chamador que a rota "existiria" se estivesse na lista).
export function validarCaminhoFiscal(path: string[]): ValidacaoCaminhoFiscal {
  if (path.length === 0) return { ok: false, status: 404 }
  for (const segmento of path) {
    if (segmento === "." || segmento === ".." || segmento.includes("/") || segmento.includes("\\")) {
      return { ok: false, status: 400 }
    }
  }
  if (!ROTAS_FISCAL_PERMITIDAS.has(path[0])) return { ok: false, status: 404 }
  return { ok: true }
}

// O id do documento fiscal vai para dentro de uma URL da Admin API com o token de admin anexado.
// Só uuid passa — mesma classe de defesa do validarCaminhoFiscal acima.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(v: string): boolean {
  return UUID_RE.test(v)
}

// O orderId do pedido vai para dentro de uma URL da Admin API com o token de admin anexado
// (app/api/fiscal-previa/[orderId]/route.ts) — mesma classe de defesa do ehUuid acima, mas para
// o formato de id do Medusa ("order_" + alfanumérico), que não é um uuid.
const ID_DE_PEDIDO_RE = /^order_[A-Za-z0-9]+$/

export function ehIdDePedido(v: string): boolean {
  return ID_DE_PEDIDO_RE.test(v)
}
