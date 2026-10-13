// Endereço em uma linha, com número, complemento e bairro. O checkout grava o número e o bairro em
// `metadata` (numero/bairro) e o complemento em `address_2`; a tela de pedidos só mostrava a rua, e a
// sócia estranhou "não está aparecendo o número da residência" (2026-10-12).
export type EnderecoCru = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  metadata?: Record<string, unknown> | null
}

const txt = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "")

export function enderecoEmLinha(a: EnderecoCru | null | undefined): string {
  if (!a) return ""
  const numero = txt(a.metadata?.numero)
  const bairro = txt(a.metadata?.bairro)
  const rua = [txt(a.address_1), numero].filter(Boolean).join(", ")
  const partes = [rua, txt(a.address_2), bairro, txt(a.city), txt(a.province), txt(a.postal_code)].filter(Boolean)
  return partes.join(" · ")
}
