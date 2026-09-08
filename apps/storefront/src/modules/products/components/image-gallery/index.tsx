"use client"

import { HttpTypes } from "@medusajs/types"
import { Container, clx } from "@modules/common/components/ui"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type ImageGalleryProps = { images: HttpTypes.StoreProductImage[]; productTitle?: string }

// Desktop: pilha vertical (como antes). Mobile: carrossel horizontal com scroll-snap
// e indicadores — sem biblioteca. Mesmo markup nos dois; só CSS muda.
const ImageGallery = ({ images, productTitle }: ImageGalleryProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track || images.length < 2) return
    const items = Array.from(track.children) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(items.indexOf(e.target as HTMLElement))
      },
      { root: track, threshold: [0.6] }
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [images])

  const alt = (i: number) => (productTitle ? `${productTitle} — use.ÉCLAT — foto ${i + 1}` : `Foto ${i + 1} do produto`)

  return (
    <div className="flex flex-col items-start relative">
      <div
        ref={trackRef}
        className="flex w-full gap-x-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide small:flex-col small:overflow-visible small:gap-y-4 small:mx-16 small:w-auto small:flex-1"
        data-testid="image-gallery"
      >
        {images.map((image, index) => (
          <Container key={image.id} className="relative aspect-[29/34] w-full shrink-0 snap-center overflow-hidden bg-ui-bg-subtle" id={image.id}>
            {!!image.url && (
              <Image src={image.url} priority={index <= 1} className="absolute inset-0 rounded-rounded" alt={alt(index)} fill quality={80}
                sizes="(max-width: 576px) 100vw, (max-width: 1024px) 60vw, 800px" style={{ objectFit: "cover" }} />
            )}
          </Container>
        ))}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 w-full mt-3 small:hidden" aria-hidden>
          {images.map((img, i) => <span key={img.id} className={clx("w-1.5 h-1.5 rounded-full", i === active ? "bg-eclat-grafite" : "bg-eclat-grafite/25")} />)}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
