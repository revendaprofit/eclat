// Pré-venda lida pelo backend (para o e-mail de pedido). Fonte da verdade: Supabase,
// site_content key "prevenda" — a mesma que a vitrine lê em apps/storefront/src/lib/data/prevenda.ts.
// Os padrões abaixo espelham os de lá; se mudar um, mude o outro.
import { sbSelect, supabaseConfigured } from "./supabase"

export type Prevenda = { ativa: boolean; envios_a_partir: string; whatsapp: string }

const PADRAO: Prevenda = { ativa: true, envios_a_partir: "2026-10-10", whatsapp: "5531991184431" }

export async function getPrevenda(): Promise<Prevenda> {
  if (!supabaseConfigured()) return PADRAO
  try {
    const linhas = await sbSelect<{ value: Partial<Prevenda> | null }>(
      "site_content",
      "key=eq.prevenda&select=value&limit=1"
    )
    return { ...PADRAO, ...(linhas[0]?.value ?? {}) }
  } catch {
    return PADRAO
  }
}
