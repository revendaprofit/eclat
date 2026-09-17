// Verificação do webhook da Brasil NFe (spec §7.4). Fonte: https://www.brasilnfe.com.br/webhooks
//
// A assinatura é o HMAC-SHA256 do CORPO BRUTO, em hexadecimal, prefixado por "sha256=", no
// header X-Webhook-Signature. "Bruto" é literal: o mesmo JSON reserializado tem outros bytes e
// outra assinatura. Funções PURAS — a rota só entrega o que recebeu.

import { createHmac, timingSafeEqual } from "node:crypto"

export function assinaturaValida(
  corpoBruto: Buffer | string | undefined,
  header: string | undefined,
  segredo: string | undefined
): boolean {
  // Sem segredo configurado, NADA é aceito — nunca degradar para "aceita tudo".
  if (!segredo || !header || corpoBruto === undefined || corpoBruto === null) return false
  if (!header.startsWith("sha256=")) return false

  const esperada = Buffer.from("sha256=" + createHmac("sha256", segredo).update(corpoBruto).digest("hex"))
  const recebida = Buffer.from(header)
  // timingSafeEqual lança se os tamanhos diferem — confere antes. Comparação em tempo constante
  // para não vazar, pelo tempo de resposta, quantos caracteres da assinatura estavam certos.
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

// nfe.lote.finalizado → data.notas[].chaveAcesso (vazio quando a nota não foi autorizada).
export function chavesDoLote(data: unknown): string[] {
  const notas = (data as { notas?: unknown } | undefined)?.notas
  if (!Array.isArray(notas)) return []
  return notas
    .map((n) => String((n as { chaveAcesso?: unknown } | null)?.chaveAcesso ?? ""))
    .filter((c) => /^\d{44}$/.test(c))
}
