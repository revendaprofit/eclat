// Vídeo de produto na galeria da PDP. Fontes (Cockpit → Produto → Ficha técnica):
// - metadata.youtube_id: ID puro (11 chars) ou URL do YouTube (watch?v=, youtu.be/, shorts/, embed/, live/);
// - metadata.videos: MP4 próprio por cor (ver parseProductVideos). Funções puras (Vitest).
import { normalizeColorName } from "./colors"

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

// Duas fontes de vídeo: YouTube (metadata.youtube_id) ou MP4 próprio (metadata.videos, por cor).
export type VideoSource =
  | { kind: "youtube"; id: string }
  | { kind: "mp4"; src: string; poster: string | null }

export type GalleryItem =
  | { kind: "image"; id: string; url: string }
  | { kind: "video"; id: string; source: VideoSource }

// metadata.videos (Cockpit → Ficha técnica): JSON cor → URL do MP4 ou cor → {src, poster}.
// Chave normalizada como as cores do catálogo (normalizeColorName). Os vídeos das peças da
// Lumière já estão em site/hero/giro/ (banner interativo, 2026-09-14) — a PDP reaproveita.
export type ProductVideo = { src: string; poster: string | null }
export type ProductVideos = Record<string, ProductVideo>

const isHttp = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//.test(v.trim())

export function parseProductVideos(meta: Record<string, unknown> | null | undefined): ProductVideos {
  const raw = meta?.videos
  if (!raw) return {}
  let obj: unknown = raw
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
  const out: ProductVideos = {}
  for (const [cor, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = normalizeColorName(cor)
    if (!key) continue
    if (isHttp(v)) out[key] = { src: v.trim(), poster: null }
    else if (v && typeof v === "object") {
      const o = v as { src?: unknown; poster?: unknown }
      if (isHttp(o.src)) out[key] = { src: o.src.trim(), poster: isHttp(o.poster) ? o.poster.trim() : null }
    }
  }
  return out
}

// Vídeo da cor escolhida. Sem cor escolhida ainda → o primeiro cadastrado (a foto hero também
// mostra alguma cor). Cor escolhida sem vídeo → null: nunca mostrar o vídeo de outra cor.
export function videoForColor(videos: ProductVideos, color: string | null | undefined): ProductVideo | null {
  const keys = Object.keys(videos)
  if (keys.length === 0) return null
  if (color == null || !color.trim()) return videos[keys[0]]
  return videos[normalizeColorName(color)] ?? null
}

// MP4 da cor tem prioridade; YouTube é o fallback do produto inteiro.
export function resolveVideoSource(
  videos: ProductVideos,
  youtubeId: string | null | undefined,
  color: string | null | undefined
): VideoSource | null {
  const mp4 = videoForColor(videos, color)
  if (mp4) return { kind: "mp4", src: mp4.src, poster: mp4.poster }
  return youtubeId ? { kind: "youtube", id: youtubeId } : null
}

// Vídeo entra como 2º item: a 1ª foto continua sendo o hero (LCP/SEO) e o vídeo
// aparece no 1º scroll. Decisão 1 do plano; mude aqui se optar por "último".
export const VIDEO_POSITION = 1

export function buildGalleryItems(
  images: { id: string; url?: string | null }[],
  video: VideoSource | null | undefined
): GalleryItem[] {
  const items: GalleryItem[] = images
    .filter((i) => !!i.url)
    .map((i) => ({ kind: "image" as const, id: i.id, url: i.url as string }))
  if (!video) return items
  // id entra no listKey/DOM da galeria: MP4 usa a URL, então trocar de cor troca o slide.
  const id = video.kind === "youtube" ? `video-${video.id}` : `video-${video.src}`
  items.splice(Math.min(VIDEO_POSITION, items.length), 0, { kind: "video", id, source: video })
  return items
}
