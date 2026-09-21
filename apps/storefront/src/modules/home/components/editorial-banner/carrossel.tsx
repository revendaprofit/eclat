"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

// Carrossel do banner editorial (pedido da sócia, 2026-09-19): fotos 2:3 INTEIRAS — cada slide tem a
// proporção da foto, então nada é cortado (cabeça, peça e logo aparecem sempre). Celular: 1 foto por
// vez; computador: 2 lado a lado (a coluna é 4:3 = dois slides 2:3). `object-contain` sobre o preto do
// estúdio cobre o caso de a coluna esticar além do 4:3 por causa do texto ao lado.
const INTERVALO_MS = 4500

export default function CarrosselBanner({ fotos, alt }: { fotos: string[]; alt: string }) {
  const trilho = useRef<HTMLDivElement>(null)
  const pausado = useRef(false)
  const [pagina, setPagina] = useState(0)
  const [paginas, setPaginas] = useState(fotos.length)

  const medir = useCallback(() => {
    const el = trilho.current
    const slide = el?.children[0] as HTMLElement | undefined
    if (!el || !slide || !slide.offsetWidth) return
    const porTela = Math.max(1, Math.round(el.clientWidth / slide.offsetWidth))
    setPaginas(Math.max(1, fotos.length - porTela + 1))
    setPagina(Math.round(el.scrollLeft / slide.offsetWidth))
  }, [fotos.length])

  const irPara = useCallback((i: number) => {
    const el = trilho.current
    const slide = el?.children[i] as HTMLElement | undefined
    if (el && slide) el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" })
  }, [])

  useEffect(() => {
    medir()
    window.addEventListener("resize", medir)
    return () => window.removeEventListener("resize", medir)
  }, [medir])

  useEffect(() => {
    if (paginas < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = window.setInterval(() => {
      if (!pausado.current && !document.hidden) irPara((pagina + 1) % paginas)
    }, INTERVALO_MS)
    return () => window.clearInterval(t)
  }, [pagina, paginas, irPara])

  const seta =
    "absolute top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white text-xl leading-none hover:bg-black/60 transition-colors"

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => (pausado.current = true)}
      onMouseLeave={() => (pausado.current = false)}
      onTouchStart={() => (pausado.current = true)}
      onFocus={() => (pausado.current = true)}
      onBlur={() => (pausado.current = false)}
      role="group"
      aria-roledescription="carrossel"
      aria-label={alt}
      data-testid="banner-carrossel"
    >
      <div
        ref={trilho}
        onScroll={medir}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto no-scrollbar"
      >
        {fotos.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-start small:w-1/2">
            <Image
              src={src}
              alt={i === 0 ? alt : ""}
              aria-hidden={i > 0}
              fill
              quality={80}
              sizes="(max-width: 1024px) 100vw, 25vw"
              className="object-contain"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {paginas > 1 && (
        <>
          <button type="button" aria-label="Foto anterior" className={seta + " left-3"} onClick={() => irPara((pagina - 1 + paginas) % paginas)}>
            ‹
          </button>
          <button type="button" aria-label="Próxima foto" className={seta + " right-3"} onClick={() => irPara((pagina + 1) % paginas)}>
            ›
          </button>
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2">
            {Array.from({ length: paginas }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para a foto ${i + 1}`}
                aria-current={i === pagina}
                onClick={() => irPara(i)}
                className={"h-2 w-2 rounded-full transition-colors " + (i === pagina ? "bg-white" : "bg-white/40 hover:bg-white/70")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
