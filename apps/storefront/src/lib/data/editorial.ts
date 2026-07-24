import "server-only"

// Lê os posts editoriais (tabela editorial_post) do Supabase via anon.
// RLS garante que só posts 'published' são visíveis. Revalida a cada 60s.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type EditorialPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body_md: string
  cover_url: string | null
  tags: string[]
  published_at: string | null
  updated_at: string
}

async function rest<T>(path: string): Promise<T | null> {
  if (!URL || !ANON) return null
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      next: { revalidate: 60, tags: ["editorial"] },
    })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export async function listEditorialPosts(limit = 50): Promise<EditorialPost[]> {
  const rows = await rest<EditorialPost[]>(
    `editorial_post?select=id,slug,title,excerpt,cover_url,tags,published_at,updated_at,body_md&order=published_at.desc&limit=${limit}`
  )
  return rows ?? []
}

export async function getEditorialPost(
  slug: string
): Promise<EditorialPost | null> {
  const rows = await rest<EditorialPost[]>(
    `editorial_post?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`
  )
  return rows?.[0] ?? null
}
