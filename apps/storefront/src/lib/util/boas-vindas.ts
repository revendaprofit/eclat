// Aviso de boas-vindas (cupom de primeira compra em troca do WhatsApp). Parte pura, testável.
// Config no Cockpit/Supabase: site_content key "boas_vindas" = { ativa, cupom, percentual }.
// Sem a chave (ou com `ativa: false`) o aviso NÃO aparece — é o interruptor, sem deploy.
export type BoasVindasConfig = { ativa: boolean; cupom: string; percentual: number }

export const CHAVE_CUPOM_GUARDADO = "eclat_cupom_boas_vindas" // localStorage: a sacola lê e já abre o campo
export const COOKIE_AVISO = "eclat_bv" // "1" = já viu/fechou/cadastrou: não reaparece por 60 dias

export const TEXTO_ACEITE = "Aceito receber novidades e ofertas da ÉCLAT por WhatsApp e e-mail. Posso sair quando quiser."

export function lerConfigBoasVindas(v: unknown): BoasVindasConfig | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  const cupom = typeof o.cupom === "string" ? o.cupom.trim().toUpperCase() : ""
  const percentual = Number(o.percentual)
  if (o.ativa !== true || !cupom || !Number.isFinite(percentual) || percentual <= 0 || percentual > 100) return null
  return { ativa: true, cupom, percentual }
}

// Onde o aviso NÃO abre: quem já está comprando não pode ser interrompido (sacola, checkout,
// pedido), nem quem está na conta. `pathname` vem com o país (`/br/...`).
// Diagnóstico de 2026-09-25: também não abre na página de produto nem na de conjunto — são o
// destino dos anúncios, e a cliente chegava e via o aviso de cookies e, logo depois, este aviso
// cobrindo a peça. O anúncio já traz o cupom no texto; o aviso aparece quando ela navega pela loja.
export function avisoPermitidoNaRota(pathname: string): boolean {
  const resto = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "")
  return !/^\/(cart|checkout|order|account|products|conjuntos)(\/|$)/.test(resto)
}

/** Máscara de celular brasileiro enquanto digita: (31) 99999-0000. */
export function mascararCelular(v: string): string {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
