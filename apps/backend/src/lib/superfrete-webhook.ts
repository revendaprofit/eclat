// Funções puras do webhook de status da SuperFrete (spec §4.1 a §4.4).
//
// Nada de I/O aqui: a rota lê o corpo cru e o header e só entrega o que recebeu. "Cru" é literal —
// o mesmo JSON reserializado tem outros bytes e outra assinatura.

import { createHmac, timingSafeEqual } from "node:crypto"

export type EventoSuperfrete =
  | "order.created"
  | "order.released"
  | "order.generated"
  | "order.posted"
  | "order.delivered"
  | "order.cancelled"

export type AcaoDoEvento = {
  gravar: true
  aviso: "generated" | "posted" | "delivered" | null
  canais: ("whatsapp" | "email")[]
}

// A SuperFrete documenta apenas "assinatura HMAC-SHA256 gerada usando o corpo da requisição e o
// secret_token", sem dizer a CODIFICAÇÃO do header X-ME-Signature. Para a integração não nascer
// morta na primeira chamada real, aceitamos as quatro formas plausíveis do MESMO HMAC: hex puro,
// hex com prefixo "sha256=", base64 puro e base64 com prefixo "sha256=". Isso não enfraquece nada:
// produzir qualquer uma delas exige o segredo. Quando soubermos qual é a forma de verdade, basta
// apagar as outras três.
export function assinaturaSuperfreteValida(
  corpoBruto: Buffer | string | undefined,
  header: string | undefined,
  segredo: string | undefined
): boolean {
  // Sem segredo configurado, NADA é aceito — nunca degradar para "aceita tudo".
  if (!segredo || !header || corpoBruto === undefined || corpoBruto === null) return false

  const hex = createHmac("sha256", segredo).update(corpoBruto).digest("hex")
  const base64 = createHmac("sha256", segredo).update(corpoBruto).digest("base64")
  const recebida = Buffer.from(header)

  return [hex, `sha256=${hex}`, base64, `sha256=${base64}`].some((candidato) => {
    const esperada = Buffer.from(candidato)
    // timingSafeEqual lança se os tamanhos diferem — confere antes. Comparação em tempo constante
    // para não vazar, pelo tempo de resposta, quantos caracteres da assinatura estavam certos.
    // O tamanho por si não vaza nada: as quatro formas têm tamanho fixo e público.
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
  })
}

// Ao comprar a etiqueta mandamos o display_id do pedido em options.tags; ele volta em
// data.tags[].tag (spec §4.3). A SuperFrete não promete que a nossa é a única tag, então pegamos a
// primeira que seja um inteiro positivo. Qualquer outra coisa → null, e a rota responde 200 sem
// fazer nada (pode ser etiqueta de outra origem, ou um teste).
export function numeroDoPedido(data: unknown): number | null {
  const tags = (data as { tags?: unknown } | null | undefined)?.tags
  if (!Array.isArray(tags)) return null
  for (const t of tags) {
    const tag = String((t as { tag?: unknown } | null)?.tag ?? "")
    if (/^\d+$/.test(tag) && Number(tag) > 0) return Number(tag)
  }
  return null
}

// Tabela da spec §4.1. Map (e não objeto) para que "constructor", "toString" e afins não caiam em
// herança do Object.prototype e virem uma ação inventada.
const TABELA = new Map<EventoSuperfrete, AcaoDoEvento>([
  ["order.created", { gravar: true, aviso: null, canais: [] }],
  ["order.released", { gravar: true, aviso: null, canais: [] }],
  // generated não avisa por si; quem decide é a rota, e só se o despacho saiu sem código (§4.1).
  ["order.generated", { gravar: true, aviso: "generated", canais: ["whatsapp"] }],
  ["order.posted", { gravar: true, aviso: "posted", canais: ["whatsapp", "email"] }],
  ["order.delivered", { gravar: true, aviso: "delivered", canais: ["whatsapp"] }],
  ["order.cancelled", { gravar: true, aviso: null, canais: [] }],
])

export function acaoDoEvento(evento: string): AcaoDoEvento | null {
  const acao = TABELA.get(evento as EventoSuperfrete)
  // Cópia: a tabela é do módulo e ninguém que chamar pode mexer nela sem querer.
  return acao ? { ...acao, canais: [...acao.canais] } : null
}

// O código de rastreio nasce alguns segundos DEPOIS do pagamento da etiqueta, então ele pode vir
// vazio em qualquer evento. String vazia significa "ainda não sei" — a rota não sobrescreve o que
// já está gravado com vazio.
export function rastreioDoEvento(data: unknown): { tracking: string; tracking_url: string } {
  const d = (data ?? {}) as { tracking?: unknown; tracking_url?: unknown }
  return {
    tracking: String(d.tracking ?? ""),
    tracking_url: String(d.tracking_url ?? ""),
  }
}
