import { Suspense } from "react"

import PersonaGallery from "@modules/personalization/persona-gallery"
import type { PersonaMedia } from "@lib/data/personas"
import ProductActions from "@modules/products/components/product-actions"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import { ProductDescription, ProductHeader } from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActionsWrapper from "./product-actions-wrapper"
import GuaranteeSeals from "@modules/products/components/guarantee-seals"
import QuemE from "@modules/products/components/quem-e"
import PdpTestimonials from "@modules/products/components/pdp-testimonials"
import ProductFaq from "@modules/products/components/product-faq"
import NotifyMe from "@modules/products/components/notify-me"
import Track from "@modules/analytics/track"
import { productToViewItem } from "@modules/analytics/items"
import { ProductJsonLd } from "@modules/seo/jsonld"
import { getBaseURL } from "@lib/util/env"
import { getColorMap } from "@lib/data/colors"
import { ProductSelectionProvider } from "@modules/products/components/product-selection"
import CompleteSet from "@modules/products/components/complete-set"
import { BreadcrumbJsonLd } from "@modules/seo/jsonld"
import { getDeepestCategoryChain } from "@lib/data/category-path"
import { getMeasureMap } from "@lib/data/measurements"
import { pickMeasurements } from "@lib/util/measurements"
import { parseProductVideos, parseYoutubeId } from "@lib/util/product-video"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
  personaMedia?: PersonaMedia[]
  selectedVariantId?: string | null
  initialColor?: string | null
}

const ProductTemplate = async ({
  product,
  region,
  countryCode,
  images,
  personaMedia = [],
  selectedVariantId,
  initialColor,
}: ProductTemplateProps) => {
  if (!product || !product.id) {
    return notFound()
  }

  const colorMap = await getColorMap()

  // Categoria mais profunda entre as do produto (spec §5.3) — não `categories[0]`: um produto
  // que está na raiz E numa subcategoria não deve prender breadcrumb/medidas na raiz.
  const catIds = (product.categories ?? []).map((c) => c.id)
  const chain = catIds.length ? await getDeepestCategoryChain(catIds) : []
  const breadcrumbItems = [
    { name: "Início", href: "" },
    ...chain.map((c) => ({ name: c.name, href: `/categories/${c.handle}` })),
    { name: product.title ?? "Produto", href: `/products/${product.handle}` },
  ]

  const measureMap = await getMeasureMap()
  const categoryPath = chain.length ? chain.map((c) => c.handle).join("/") : null
  const measureTable = categoryPath ? pickMeasurements(measureMap, categoryPath) : null

  const productUrl = `${getBaseURL()}/${countryCode}/products/${product.handle}`

  // vídeo da galeria: product.metadata.youtube_id (ID ou URL), preenchido no Cockpit
  const youtubeId = parseYoutubeId(product.metadata?.youtube_id)
  // MP4 próprio por cor: product.metadata.videos (JSON cor → URL); tem prioridade sobre o YouTube
  const videos = parseProductVideos(product.metadata)

  // esgotado total: nenhuma variante disponível (mesma regra do JSON-LD/feed)
  const variants = (product.variants ?? []) as {
    manage_inventory?: boolean
    allow_backorder?: boolean
    inventory_quantity?: number
  }[]
  const allOut =
    variants.length > 0 &&
    !variants.some(
      (v) =>
        v.manage_inventory === false ||
        v.allow_backorder === true ||
        (typeof v.inventory_quantity === "number" && v.inventory_quantity > 0)
    )

  return (
    <>
      <Track event="view_item" ecommerce={productToViewItem(product)} />
      <ProductJsonLd product={product} url={productUrl} />
      <ProductSelectionProvider key={product.id} product={product} initialVariantId={selectedVariantId} initialColor={initialColor}>
        <div className="content-container relative">
          {/* Só o JSON-LD do caminho (SEO); o breadcrumb visível saiu da PDP a pedido do dono (2026-09-13). */}
          <BreadcrumbJsonLd items={breadcrumbItems.map((c) => ({ name: c.name, url: `${getBaseURL()}/${countryCode}${c.href}` }))} />
          {/* Mobile (coluna única, pela `order`): cabeçalho → fotos → compra → descrição + abas.
              Desktop (grid 300 | fotos | 300): cabeçalho e descrição na coluna da esquerda
              (linhas 1 e 2), fotos no centro, compra à direita (fixa) — pedido do dono, 2026-09-13. */}
          <div
            className="flex flex-col small:grid small:grid-cols-[300px_minmax(0,1fr)_300px] small:gap-x-8 small:items-start py-6"
            data-testid="product-container"
          >
            <div className="order-1 w-full pt-2 pb-4 small:p-0 small:col-start-1 small:row-start-1">
              <ProductHeader product={product} />
            </div>
            <div className="order-2 block w-full relative small:col-start-2 small:row-start-1 small:row-span-2">
              <PersonaGallery
                images={images}
                personaMedia={personaMedia}
                productTitle={product.title}
                productHandle={product.handle ?? undefined}
                youtubeId={youtubeId}
                videos={videos}
              />
            </div>
            <div className="order-4 flex flex-col w-full py-8 gap-y-6 small:py-6 small:col-start-1 small:row-start-2">
              <ProductDescription product={product} />
              <ProductTabs product={product} measureTable={measureTable} />
            </div>
            <div className="order-3 flex flex-col w-full py-8 gap-y-12 small:py-0 small:col-start-3 small:row-start-1 small:row-span-2 small:self-start small:sticky small:top-48">
              <ProductOnboardingCta />
              <Suspense
                fallback={
                  <ProductActions
                    disabled={true}
                    product={product}
                    region={region}
                    colorMap={colorMap}
                    measureTable={measureTable}
                  />
                }
              >
                <ProductActionsWrapper
                  id={product.id}
                  region={region}
                  colorMap={colorMap}
                  measureTable={measureTable}
                />
              </Suspense>
              {allOut && <NotifyMe productId={product.handle ?? product.id} />}
            </div>
          </div>
          {/* Achado #5: o bloco busca conjuntos no backend — sem `Suspense` a PDP inteira espera
              por ele. Fallback `null`: o bloco simplesmente aparece quando os dados chegam. */}
          <Suspense fallback={null}>
            <CompleteSet product={product} countryCode={countryCode} colorMap={colorMap} />
          </Suspense>
        </div>
      </ProductSelectionProvider>
      {/* Faixas de borda a borda alternando os tons da marca (areia, luz, blush claro), pedido do
          dono (2026-09-13): cada seção cuida do próprio fundo e some inteira quando não tem dados. */}
      <QuemE product={product} />
      <PdpTestimonials />
      <section className="bg-eclat-blush-claro/60 py-12 small:py-16" data-testid="pdp-faixa-faq">
        <div className="content-container max-w-4xl flex flex-col gap-y-10">
          {/* Selos (7 dias / 30 dias / WhatsApp) saíram da coluna de compra para logo antes da FAQ
              (pedido do dono, 2026-09-13). */}
          <GuaranteeSeals />
          <ProductFaq product={product} />
        </div>
      </section>
      <div
        className="content-container my-16 small:my-32"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
