"use client"

import { HttpTypes } from "@medusajs/types"
import { Container, clx } from "@modules/common/components/ui"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import ProductVideo from "@modules/products/components/product-video"
import { buildGalleryItems } from "@lib/util/product-video"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle?: string
  productHandle?: string
  // product.metadata.youtube_id já validado por parseYoutubeId (no template)
  youtubeId?: string | null
}

// Desktop: pilha vertical (como antes). Mobile: carrossel horizontal com scroll-snap
// e indicadores — sem biblioteca. Mesmo markup nos dois; só CSS muda.
// Item de vídeo (quando youtubeId existe) entra como slide no meio das fotos —
// buildGalleryItems decide a posição (2º item, LCP intacto no hero).
const ImageGallery = ({ images, productTitle, productHandle, youtubeId }: ImageGalleryProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const items = buildGalleryItems(images, youtubeId)
  // Chave estável da lista de itens (não a referência do array, que muda a cada
  // render): troca de cor real -> listKey muda -> carrossel volta pro início.
  // Re-render sem troca de fotos (ex.: outro estado do pai) -> listKey igual -> não mexe.
  const listKey = items.map((i) => i.id).join("|")

  useEffect(() => {
    setActive(0)
    trackRef.current?.scrollTo({ left: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey])

  let fotoN = 0

  return (
    <div className="flex flex-col items-start relative">
      <div
        ref={trackRef}
        className="flex w-full gap-x-2 overflow-x-auto snap-x snap-mandatory no-scrollbar small:flex-col small:overflow-visible small:gap-y-4 small:mx-16 small:w-auto small:flex-1"
        data-testid="image-gallery"
      >
        {items.map((item, index) => {
          if (item.kind === "video") {
            return (
              <Container
                key={item.id}
                className="relative aspect-[29/34] w-full shrink-0 snap-center overflow-hidden bg-ui-bg-subtle"
                id={item.id}
                data-testid="product-video"
              >
                <ProductVideo youtubeId={item.youtubeId} productTitle={productTitle} productHandle={productHandle} />
              </Container>
            )
          }
          fotoN += 1
          const alt = productTitle ? `${productTitle} — use.ÉCLAT — foto ${fotoN}` : `Foto ${fotoN} do produto`
          return (
            <Container key={item.id} className="relative aspect-[29/34] w-full shrink-0 snap-center overflow-hidden bg-ui-bg-subtle" id={item.id}>
              <Image src={item.url} priority={index <= 2} className="absolute inset-0 rounded-rounded" alt={alt} fill quality={80}
                sizes="(max-width: 576px) 100vw, (max-width: 1024px) 60vw, 800px" style={{ objectFit: "cover" }} />
            </Container>
          )
        })}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 w-full mt-3 small:hidden" aria-hidden>
          {items.map((it, i) => <span key={it.id} className={clx("w-1.5 h-1.5 rounded-full", i === active ? "bg-eclat-grafite" : "bg-eclat-grafite/25")} />)}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
