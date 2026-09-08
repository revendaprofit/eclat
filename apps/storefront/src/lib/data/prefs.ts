import "server-only"

import { cookies } from "next/headers"
import { parseFilters, type FilterState, type SearchParamsLike } from "@lib/util/catalog-filters"
import { applyPreferredSize, parsePrefsCookie, PREFS_COOKIE, type EclatPrefs } from "@lib/util/prefs-cookie"

// Cookie espelho das preferências do wizard (spec §10). Nunca lança.
export async function getServerPrefs(): Promise<EclatPrefs> {
  try {
    const jar = await cookies()
    return parsePrefsCookie(jar.get(PREFS_COOKIE)?.value)
  } catch {
    return {}
  }
}

export type ListingFilters = { filters: FilterState; implicitSize: string | null }

// parseFilters + tamanho preferido. Substitui `parseFilters(sp)` nas páginas de listagem.
export async function resolveListingFilters(sp: SearchParamsLike): Promise<ListingFilters> {
  return applyPreferredSize(parseFilters(sp), sp, await getServerPrefs())
}
