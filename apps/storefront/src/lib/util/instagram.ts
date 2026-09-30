import type { Instagram, InstagramItem } from "@modules/home/content"

export const MAX_FOTOS_INSTAGRAM = 6

// "@eclat.use" ou "eclat.use" → "eclat.use"; qualquer outra coisa que não pareça um @ válido → ""
export function limparHandle(handle?: string | null): string {
  const h = (handle || "").trim().replace(/^@+/, "")
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : ""
}

export function linkPerfilInstagram(handle?: string | null): string {
  const h = limparHandle(handle)
  return h ? `https://www.instagram.com/${h}/` : ""
}

// Só fotos https; link de cada foto só se for do instagram.com (senão vai para o perfil). No máximo 6.
export function fotosInstagram(c?: Instagram | null): Required<Pick<InstagramItem, "image_url" | "href">>[] {
  const perfil = linkPerfilInstagram(c?.handle)
  return (c?.items || [])
    .filter((i) => typeof i?.image_url === "string" && i.image_url.startsWith("https://"))
    .slice(0, MAX_FOTOS_INSTAGRAM)
    .map((i) => ({
      image_url: i.image_url,
      href: i.href && /^https:\/\/(www\.)?instagram\.com\//.test(i.href) ? i.href : perfil,
    }))
}
