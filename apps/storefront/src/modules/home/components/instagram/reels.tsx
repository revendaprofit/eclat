"use client"

import { useEffect, useRef, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { InstagramReel } from "@modules/home/content"

// Cards de reels "em movimento" (referência bechose.com.br, pedido da sócia em 2026-10-10): vídeo curto
// em loop, sem som, com botão de som por card; legenda por cima e um botão por card — "Ver no Instagram"
// (link do post) ou "Comprar o look" (link interno de produto/categoria). Só toca quando está na tela.
export default function Reels({ reels, handle }: { reels: InstagramReel[]; handle: string }) {
  return (
    <ul className="grid grid-cols-2 small:grid-cols-4 gap-3 small:gap-5" data-testid="instagram-reels">
      {reels.map((r, i) => (
        <li key={r.video_url}>
          <Card reel={r} handle={handle} index={i} />
        </li>
      ))}
    </ul>
  )
}

function Card({ reel, handle, index }: { reel: InstagramReel; handle: string; index: number }) {
  const video = useRef<HTMLVideoElement>(null)
  const [mudo, setMudo] = useState(true)
  useEffect(() => {
    const v = video.current
    if (!v) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.35 }
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  const interno = !!reel.href && reel.href.startsWith("/")
  const rotulo = reel.cta_label || (interno ? "Comprar o look" : "Ver no Instagram")
  const aria = `Reel ${index + 1} de @${handle}`

  return (
    <article className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-eclat-grafite text-eclat-luz">
      <video
        ref={video}
        src={reel.video_url}
        poster={reel.poster_url}
        muted={mudo}
        loop
        playsInline
        preload="metadata"
        aria-label={aria}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={() => setMudo((m) => !m)}
        aria-label={mudo ? "Ativar som" : "Desativar som"}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-eclat-grafite/60 backdrop-blur text-eclat-luz hover:bg-eclat-grafite/80"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          {mudo ? <path d="M23 9l-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />}
        </svg>
      </button>
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-eclat-grafite/90 via-eclat-grafite/40 to-transparent p-3 pt-12 small:p-4 small:pt-16">
        {reel.caption && <p className="text-xs small:text-sm leading-snug text-eclat-luz/90 line-clamp-2">{reel.caption}</p>}
        {reel.href &&
          (interno ? (
            <LocalizedClientLink href={reel.href} className="inline-flex items-center justify-center rounded-full bg-eclat-luz px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-eclat-grafite hover:bg-eclat-terracota hover:text-eclat-luz transition-colors">
              {rotulo}
            </LocalizedClientLink>
          ) : (
            <a href={reel.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-eclat-luz px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-eclat-grafite hover:bg-eclat-terracota hover:text-eclat-luz transition-colors">
              {rotulo}
            </a>
          ))}
      </div>
    </article>
  )
}
