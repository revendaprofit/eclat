import "server-only"
import { getSiteContent } from "@lib/data/site-content"

// Pré-venda: a loja vende antes de as peças estarem no estoque físico.
// Fonte da verdade: site_content key "prevenda" (editável no Cockpit → Marketing).
// Sem registro no banco, valem os padrões abaixo (lançamento Lumière, 15/09/2026).
export type Prevenda = {
  ativa: boolean
  envios_a_partir: string // ISO (YYYY-MM-DD) — data em que os envios começam
  pagamento: "pix_whatsapp" | "gateway"
  whatsapp: string // número da marca com DDI, só dígitos
}

const PADRAO: Prevenda = {
  ativa: true,
  envios_a_partir: "2026-10-10",
  pagamento: "pix_whatsapp",
  whatsapp: "5531991184431",
}

export async function getPrevenda(): Promise<Prevenda> {
  const salvo = await getSiteContent<Partial<Prevenda>>("prevenda")
  return { ...PADRAO, ...(salvo ?? {}) }
}

// "2026-10-10" → "10/10"
export function dataEnviosCurta(iso: string): string {
  const [, m, d] = iso.split("-")
  return d && m ? `${d}/${m}` : iso
}

// Texto único usado na barra, na PDP, no checkout e no pedido — muda aqui, muda em todo lugar.
export function fraseEnvios(p: Prevenda): string {
  return `Pré-venda: envios a partir de ${dataEnviosCurta(p.envios_a_partir)}`
}

// Entrada do Clube Éclat: WhatsApp da marca com a frase-gatilho da resposta automática
// (apps/backend/src/lib/clube.ts). Entrar por aqui, e não pelo link direto do grupo,
// é o que transforma a pessoa em lead no Cockpit.
export function linkClubeWhatsapp(p: Prevenda): string {
  return `https://wa.me/${p.whatsapp}?text=${encodeURIComponent("Quero entrar no Clube Éclat ✨")}`
}

export function frasePagamento(p: Prevenda): string {
  return p.pagamento === "pix_whatsapp"
    ? "Pagamento por Pix, combinado no WhatsApp logo depois do pedido"
    : "Pagamento online no checkout"
}
