"use client"

import { useEffect, useState } from "react"

// Vídeo de fundo do banner da home. A capa (primeiro quadro do vídeo) aparece de imediato; o vídeo
// só é montado no navegador quando: a tela bate com `media` (o vídeo do desktop nunca é baixado
// no celular e vice-versa), a pessoa não pediu "reduzir movimento" e não está em economia de dados.
// Quando começa a tocar, entra por cima da capa com um fade curto — sem salto, porque a capa é o
// próprio quadro inicial.
export default function HeroVideo({
  video,
  poster,
  media,
  className,
}: {
  video: string
  poster: string | null
  media: string
  className?: string
}) {
  const [montar, setMontar] = useState(false)
  const [tocando, setTocando] = useState(false)

  useEffect(() => {
    const tela = window.matchMedia(media)
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)")
    const economia = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    const avaliar = () => setMontar(tela.matches && !reduzir.matches && !economia)
    avaliar()
    tela.addEventListener("change", avaliar)
    reduzir.addEventListener("change", avaliar)
    return () => {
      tela.removeEventListener("change", avaliar)
      reduzir.removeEventListener("change", avaliar)
    }
  }, [media])

  return (
    <div className={"absolute inset-0 overflow-hidden bg-[#09090d] " + (className ?? "")} aria-hidden>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {montar && (
        <video
          src={video}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onPlaying={() => setTocando(true)}
          className={
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " +
            (tocando ? "opacity-100" : "opacity-0")
          }
        />
      )}
    </div>
  )
}
