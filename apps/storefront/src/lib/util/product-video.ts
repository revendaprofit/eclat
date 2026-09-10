// Vídeo de produto na galeria da PDP. Fonte: product.metadata.youtube_id
// (Cockpit → Produto → Ficha técnica). Aceita o ID puro (11 chars) ou uma URL do
// YouTube (watch?v=, youtu.be/, shorts/, embed/, live/). Funções puras (Vitest).

const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function parseYoutubeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (ID_RE.test(s)) return s

  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, "")
  let id: string | null = null
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v")
    } else {
      const m = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?]+)/)
      id = m ? m[1] : null
    }
  }
  return id && ID_RE.test(id) ? id : null
}

export function youtubeThumbUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

// Loop mudo sem UI do YouTube — comportamento de "GIF de produto" (referência: Angè).
export function youtubeEmbedUrl(id: string): string {
  const q = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id, // loop=1 exige playlist com o próprio ID
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`
}

export type GalleryItem =
  | { kind: "image"; id: string; url: string }
  | { kind: "video"; id: string; youtubeId: string }

// Vídeo entra como 2º item: a 1ª foto continua sendo o hero (LCP/SEO) e o vídeo
// aparece no 1º scroll. Decisão 1 do plano; mude aqui se optar por "último".
export const VIDEO_POSITION = 1

export function buildGalleryItems(
  images: { id: string; url?: string | null }[],
  youtubeId: string | null | undefined
): GalleryItem[] {
  const items: GalleryItem[] = images
    .filter((i) => !!i.url)
    .map((i) => ({ kind: "image" as const, id: i.id, url: i.url as string }))
  if (!youtubeId) return items
  const video: GalleryItem = { kind: "video", id: `video-${youtubeId}`, youtubeId }
  items.splice(Math.min(VIDEO_POSITION, items.length), 0, video)
  return items
}
