"use client"

import { useState } from "react"
import Image from "next/image"
import { youtubeEmbedUrl, youtubeThumbUrl, type VideoSource } from "@lib/util/product-video"

// Item de vídeo da galeria da PDP. "Facade": mostra só a capa e carrega o player apenas ao
// clique — zero bytes de vídeo no carregamento da página.
// - YouTube: iframe youtube-nocookie (mudo, loop, sem controles), 16:9 com altura 100% e
//   centralizado, então "cobre" o container retrato (referência Angè).
// - MP4 próprio (metadata.videos, por cor): <video> mudo em loop. Os vídeos das peças são 9:16
//   e o slide é 29:34, então capa e vídeo ficam inteiros (object-contain) sobre o mesmo fundo
//   escuro do estúdio em que foram gravados — sem cortar cabeça nem pernas.

type Props = {
  source: VideoSource
  productTitle?: string
  productHandle?: string
}

// Fundo do estúdio dos vídeos da Lumière (medido no 1º quadro); vira a "moldura" do 9:16.
const FUNDO = "#242328"

export default function ProductVideo({ source, productTitle, productHandle }: Props) {
  const [playing, setPlaying] = useState(false)
  const title = productTitle ? `Vídeo — ${productTitle}` : "Vídeo do produto"
  const isMp4 = source.kind === "mp4"
  const poster = source.kind === "youtube" ? youtubeThumbUrl(source.id) : source.poster

  function play() {
    setPlaying(true)
    // dataLayer: video_play (GTM → GA4) — mesmo padrão inline do add_to_cart
    try {
      const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
      w.dataLayer = w.dataLayer || []
      w.dataLayer.push({
        event: "video_play",
        video_provider: source.kind,
        video_id: source.kind === "youtube" ? source.id : source.src,
        item_id: productHandle ?? null,
      })
    } catch {
      /* noop */
    }
  }

  if (playing) {
    return (
      <div className="absolute inset-0 overflow-hidden rounded-rounded" style={{ background: FUNDO }}>
        {source.kind === "youtube" ? (
          <iframe
            src={youtubeEmbedUrl(source.id)}
            title={title}
            className="absolute top-1/2 left-1/2 h-full aspect-video -translate-x-1/2 -translate-y-1/2"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <video
            src={source.src}
            poster={source.poster ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label={title}
            className="absolute inset-0 h-full w-full object-contain"
            data-testid="product-video-mp4"
          />
        )}
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
      className="group absolute inset-0 w-full h-full text-left rounded-rounded overflow-hidden"
      style={isMp4 ? { background: FUNDO } : undefined}
    >
      {poster && (
        <Image
          src={poster}
          alt={title}
          fill
          sizes="(max-width: 576px) 100vw, (max-width: 1024px) 60vw, 800px"
          style={{ objectFit: isMp4 ? "contain" : "cover" }}
          className="rounded-rounded"
        />
      )}
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
