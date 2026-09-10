"use client"

import { useState } from "react"
import Image from "next/image"
import { youtubeEmbedUrl, youtubeThumbUrl } from "@lib/util/product-video"

// Item de vídeo da galeria da PDP. "Facade": mostra só a thumbnail do YouTube e
// carrega o iframe (youtube-nocookie, mudo, em loop, sem controles) apenas ao clique —
// zero JS do YouTube no carregamento da página. O iframe é 16:9 com altura 100% e
// centralizado, então "cobre" o container retrato (mesma técnica da referência Angè);
// funciona para vídeo horizontal (corta as laterais) e vertical (fica com barras).

type Props = {
  youtubeId: string
  productTitle?: string
  productHandle?: string
}

export default function ProductVideo({ youtubeId, productTitle, productHandle }: Props) {
  const [playing, setPlaying] = useState(false)
  const title = productTitle ? `Vídeo — ${productTitle}` : "Vídeo do produto"

  function play() {
    setPlaying(true)
    // dataLayer: video_play (GTM → GA4) — mesmo padrão inline do add_to_cart
    try {
      const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
      w.dataLayer = w.dataLayer || []
      w.dataLayer.push({
        event: "video_play",
        video_provider: "youtube",
        video_id: youtubeId,
        item_id: productHandle ?? null,
      })
    } catch {
      /* noop */
    }
  }

  if (playing) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-black rounded-rounded">
        <iframe
          src={youtubeEmbedUrl(youtubeId)}
          title={title}
          className="absolute top-1/2 left-1/2 h-full aspect-video -translate-x-1/2 -translate-y-1/2"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <button
          type="button"
          onClick={() => setPlaying(false)}
          aria-label="Fechar vídeo"
          className="absolute top-3 right-3 z-10 rounded-full bg-white/90 text-eclat-grafite text-xs font-semibold px-3 py-1 shadow hover:bg-white"
        >
          Fechar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Ver vídeo: ${productTitle ?? "produto"}`}
      className="group absolute inset-0 w-full h-full text-left"
    >
      <Image
        src={youtubeThumbUrl(youtubeId)}
        alt={title}
        fill
        sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
        style={{ objectFit: "cover" }}
        className="rounded-rounded"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-2 rounded-full bg-white/90 text-eclat-grafite text-xs font-semibold uppercase tracking-wider px-4 py-2 shadow group-hover:bg-white transition-colors">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Ver vídeo
        </span>
      </span>
    </button>
  )
}
