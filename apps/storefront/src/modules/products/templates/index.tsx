import { Suspense } from "react"

import PersonaGallery from "@modules/personalization/persona-gallery"
import type { PersonaMedia } from "@lib/data/personas"
import ProductActions from "@modules/products/components/product-actions"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActionsWrapper from "./product-actions-wrapper"
import DsbHero from "@modules/products/components/dsb-hero"
import GuaranteeSeals from "@modules/products/components/guarantee-seals"
import QuemE from "@modules/products/components/quem-e"
import PdpTestimonials from "@modules/products/components/pdp-testimonials"
import SizeGuide from "@modules/products/components/size-guide"
import ProductFaq from "@modules/products/components/product-faq"
import NotifyMe from "@modules/products/components/notify-me"
import Track from "@modules/analytics/track"
import { productToViewItem } from "@modules/analytics/items"
import { ProductJsonLd } from "@modules/seo/jsonld"
import { getBaseURL } from "@lib/util/env"
import { getColorMap } from "@lib/data/colors"
import { ProductSelectionProvider } from "@modules/products/components/product-selection"
import CompleteSet from "@modules/products/components/complete-set"
import Breadcrumb from "@modules/common/components/breadcrumb"
import { getDeepestCategoryChain } from "@lib/data/category-path"
import { getMeasureMap } from "@lib/data/measurements"
import { pickMeasurements } from "@lib/util/measurements"
import { parseYoutubeId } from "@lib/util/product-video"

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
          <Breadcrumb items={breadcrumbItems} countryCode={countryCode} />
          <div
            className="flex flex-col small:flex-row small:items-start py-6"
            data-testid="product-container"
          >
            <div className="flex flex-col small:sticky small:top-48 small:py-0 small:max-w-[300px] w-full py-8 gap-y-6">
              <ProductInfo product={product} />
              <DsbHero product={product} />
              <ProductTabs product={product} />
            </div>
            <div className="block w-full relative">
              <PersonaGallery
                images={images}
                personaMedia={personaMedia}
                productTitle={product.title}
                productHandle={product.handle ?? undefined}
                youtubeId={youtubeId}
              />
            </div>
            <div className="flex flex-col small:sticky small:top-48 small:py-0 small:max-w-[300px] w-full py-8 gap-y-12">
              <ProductOnboardingCta />
              <Suspense
                fallback={
                  <ProductActions
                    disabled={true}
                    product={product}
                    region={region}
                    colorMap={colorMap}
                  />
                }
              >
                <ProductActionsWrapper id={product.id} region={region} colorMap={colorMap} />
              </Suspense>
              <GuaranteeSeals />
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
      <div className="content-container max-w-4xl">
        <QuemE product={product} />
        <PdpTestimonials />
        <div className="mt-10">
          <SizeGuide table={measureTable} />
        </div>
        <ProductFaq product={product} />
      </div>
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
