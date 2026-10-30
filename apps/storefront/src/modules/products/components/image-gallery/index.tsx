"use client"

import { HttpTypes } from "@medusajs/types"
import { Container, clx } from "@modules/common/components/ui"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import ProductVideo from "@modules/products/components/product-video"
import { buildGalleryItems, type GalleryItem, type VideoSource } from "@lib/util/product-video"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle?: string
  productHandle?: string
  // vídeo já resolvido para a cor em exibição (resolveVideoSource): MP4 próprio ou YouTube
  video?: VideoSource | null
  // 2º vídeo da cor, no fim (capa + play; só baixa ao tocar)
  videoFim?: VideoSource | null
}

// Celular: carrossel horizontal com scroll-snap, uma foto por vez, arrastando, bolinhas embaixo.
// Desktop (desde 2026-09-30, referência beatco.com.br): todas as fotos em grade de 2 colunas descendo
// pela página, sem setas — a mesma lista de itens, só o CSS muda (sem duplicar imagens no HTML).
// Item de vídeo (quando `video` existe) entra como slide no meio das fotos —
// buildGalleryItems decide a posição (2º item, LCP intacto no hero).
const ImageGallery = ({ images, productTitle, productHandle, video, videoFim }: ImageGalleryProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef = useRef(0)
  const [active, setActive] = useState(0)
  const items = buildGalleryItems(images, video, videoFim)
  // Ampliar ao clicar (sócia, 30/10): a foto ocupa a tela inteira sobre fundo escuro, setas para as outras fotos,
  // Esc/X/toque fora fecha. Só fotos (os vídeos têm o próprio play).
  const fotos = items.filter((i): i is Extract<GalleryItem, { kind: "image" }> => i.kind === "image")
  const [ampliada, setAmpliada] = useState<number | null>(null)
  useEffect(() => {
    if (ampliada === null) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliada(null)
      if (e.key === "ArrowRight") setAmpliada((a) => (a === null ? a : (a + 1) % fotos.length))
      if (e.key === "ArrowLeft") setAmpliada((a) => (a === null ? a : (a - 1 + fotos.length) % fotos.length))
    }
    window.addEventListener("keydown", tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", tecla)
      document.body.style.overflow = overflow
    }
  }, [ampliada, fotos.length])

  // Vai para o slide `i` animando o scroll da faixa (o IntersectionObserver abaixo atualiza
  // `active`). Animação própria (rAF, ~260 ms) em vez de `scrollTo({ behavior: "smooth" })`:
  // no Chrome, o smooth programático dentro de um contêiner `scroll-snap` é ignorado/cancelado
  // (visto em 2026-09-13). O snap fica desligado só durante a animação.
  const irPara = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const alvo = Math.max(0, Math.min(items.length - 1, i))
    const el = track.children[alvo] as HTMLElement | undefined
    if (!el) return
    const inicio = track.scrollLeft
    const dist = el.offsetLeft - inicio
    if (!dist) return
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const reduzir = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduzir) {
      track.scrollLeft = el.offsetLeft
      return
    }
    const t0 = performance.now()
    const dur = 260
    track.style.scrollSnapType = "none"
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      track.scrollLeft = inicio + dist * e
      if (k < 1) animRef.current = requestAnimationFrame(passo)
      else {
        animRef.current = 0
        track.style.scrollSnapType = ""
      }
    }
    animRef.current = requestAnimationFrame(passo)
  }
  // Chave estável da lista de itens (não a referência do array, que muda a cada
  // render): troca de cor real -> listKey muda -> carrossel volta pro início.
  // Re-render sem troca de fotos (ex.: outro estado do pai) -> listKey igual -> não mexe.
  const listKey = items.map((i) => i.id).join("|")

  useEffect(() => {
    setActive(0)
    trackRef.current?.scrollTo({ left: 0 })
  }, [listKey])

  useEffect(() => {
    const track = trackRef.current
    if (!track || items.length < 2) return
    const els = Array.from(track.children) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(els.indexOf(e.target as HTMLElement))
      },
      { root: track, threshold: [0.6] }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reobserva só quando a lista de itens muda (items.length deriva de listKey)
  }, [listKey])

  // Caixa 2:3 = proporção das fotos do catálogo (1333x2000): com object-cover numa caixa mais larga
  // (a antiga 29:34) o site cortava ~11% em cima e embaixo — cabeça da modelo e barra do short
  // (achado do dono, 14/09/2026). Mobile e desktop usam a mesma caixa.
  let fotoN = 0

  return (
    <div className="flex flex-col relative">
      <div
        ref={trackRef}
        className="flex w-full gap-x-2 overflow-x-auto snap-x snap-mandatory no-scrollbar small:grid small:grid-cols-2 small:gap-2 small:overflow-visible small:snap-none"
        data-testid="image-gallery"
      >
        {items.map((item, idx) => {
          // Computador (2026-10-11, referência versianiswim.com.br): o 1º item ocupa a largura toda da coluna;
          // os demais seguem em 2 colunas. Desde 2026-10-30 o 1º item é a capa (o vídeo é o 2º).
          const grande = idx === 0 ? " small:col-span-2" : ""
          if (item.kind === "video") {
            return (
              <Container
                key={item.id}
                className={"relative aspect-[2/3] w-full shrink-0 snap-center overflow-hidden bg-ui-bg-subtle small:shrink" + grande}
                id={item.id}
                data-testid="product-video"
              >
                <ProductVideo source={item.source} productTitle={productTitle} productHandle={productHandle} autoplay={idx === 0} />
              </Container>
            )
          }
          fotoN += 1
          const alt = productTitle ? `${productTitle} — use.ÉCLAT — foto ${fotoN}` : `Foto ${fotoN} do produto`
          return (
            <Container key={item.id} className={"relative aspect-[2/3] w-full shrink-0 snap-center overflow-hidden bg-ui-bg-subtle small:shrink" + grande} id={item.id}>
              {/* follow-up #2: `priority` conta FOTOS, não itens da galeria — o slide de vídeo não
                  pode consumir uma das duas prioridades. Sem vídeo o HTML sai idêntico ao de antes
                  desta feature (as 2 primeiras imagens com fetchpriority=high). */}
              <button type="button" onClick={() => setAmpliada(fotoN - 1)} aria-label={`Ampliar foto ${fotoN}`} className="absolute inset-0 block h-full w-full cursor-zoom-in" data-testid="ampliar-foto">
                <Image src={item.url} priority={fotoN <= 2} className="absolute inset-0 rounded-rounded" alt={alt} fill quality={80}
                  sizes={idx === 0 ? "(max-width: 1024px) 100vw, 720px" : "(max-width: 1024px) 100vw, 360px"} style={{ objectFit: "cover" }} />
              </button>
            </Container>
          )
        })}
      </div>
      {ampliada !== null && fotos[ampliada] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setAmpliada(null)} data-testid="foto-ampliada">
          <div className="relative h-full w-full max-w-[min(100vw,66.6667vh)]" onClick={(e) => e.stopPropagation()}>
            <Image src={fotos[ampliada].url} alt={productTitle ? `${productTitle} — foto ${ampliada + 1}` : `Foto ${ampliada + 1}`} fill quality={85} sizes="100vw" style={{ objectFit: "contain" }} priority />
          </div>
          <button type="button" onClick={() => setAmpliada(null)} aria-label="Fechar" className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-eclat-grafite shadow hover:bg-white">
            Fechar
          </button>
          {fotos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAmpliada((ampliada - 1 + fotos.length) % fotos.length) }} aria-label="Foto anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-eclat-grafite shadow hover:bg-white">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAmpliada((ampliada + 1) % fotos.length) }} aria-label="Próxima foto" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-eclat-grafite shadow hover:bg-white">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-xs text-eclat-grafite">{ampliada + 1} / {fotos.length}</span>
            </>
          )}
        </div>
      )}
      {items.length > 1 && (
        <>
          <div className="flex small:hidden justify-center gap-1.5 w-full mt-3" role="tablist" aria-label="Fotos do produto">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Foto ${i + 1} de ${items.length}`}
                onClick={() => irPara(i)}
                className={clx("h-2.5 w-2.5 rounded-full transition-colors", i === active ? "bg-eclat-grafite" : "bg-eclat-grafite/25 hover:bg-eclat-grafite/50")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ImageGallery
