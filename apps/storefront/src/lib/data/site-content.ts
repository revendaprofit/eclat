import "server-only"

// Lê o conteúdo editorial da vitrine (editável no cockpit) do Supabase, publicamente (anon).
// Revalida a cada 30s — alterações no cockpit aparecem em até ~30s. Sempre tem fallback no componente.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function getSiteContent<T = Record<string, unknown>>(
  key: string
): Promise<T | null> {
  if (!URL || !ANON) return null
  try {
    const r = await fetch(
      `${URL}/rest/v1/site_content?key=eq.${encodeURIComponent(key)}&select=value`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        next: { revalidate: 30, tags: [`site_content:${key}`] },
      }
    )
    if (!r.ok) return null
    const rows = (await r.json()) as { value: T }[]
    return rows?.[0]?.value ?? null
  } catch {
    return null
  }
}
