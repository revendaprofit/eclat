import "server-only"

import { listagemConfigDe, type ListagemConfig } from "@lib/util/listagem-cores"
import { getSiteContent } from "./site-content"

// Interruptores da vitrine (`site_content.listagem`), com o cache curto de `getSiteContent`.
// Sem chave → tudo ligado. Para voltar a "um card por produto": { "cards_por_cor": false }.
export async function getListagemConfig(): Promise<ListagemConfig> {
  return listagemConfigDe(await getSiteContent<Record<string, unknown>>("listagem"))
}
