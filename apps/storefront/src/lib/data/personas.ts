import "server-only"

// "Minha ÉCLAT": personas (modelos das fotos) e mídia por produto × persona.
// Leitura pública via anon (RLS: só personas ativas). Revalida a cada 60s.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type Persona = {
  id: string
  slug: string
  nome: string
  descricao: string | null
  avatar_url: string | null
  ordem: number
}

export type PersonaMedia = {
  persona_id: string
  images: string[]
}

async function rest<T>(path: string): Promise<T | null> {
  if (!URL || !ANON) return null
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      next: { revalidate: 60, tags: ["personas"] },
    })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export async function listPersonas(): Promise<Persona[]> {
  const rows = await rest<Persona[]>(
    "persona?select=id,slug,nome,descricao,avatar_url,ordem&order=ordem.asc"
  )
  return rows ?? []
}

// Mídia de TODAS as personas para um produto (id ou handle do Medusa).
export async function getPersonaMediaForProduct(
  productIdOrHandle: string,
  fallbackId?: string
): Promise<PersonaMedia[]> {
  const ids = [productIdOrHandle, fallbackId].filter(Boolean) as string[]
  const filter = ids.map((i) => `"${i}"`).join(",")
  const rows = await rest<PersonaMedia[]>(
    `product_persona_media?product_id=in.(${encodeURIComponent(filter).replace(/%2C/g, ",")})&select=persona_id,images`
  )
  return rows ?? []
}
