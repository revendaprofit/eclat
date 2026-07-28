import React, { Suspense } from "react"

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
import { ProductJsonLd, BreadcrumbJsonLd } from "@modules/seo/jsonld"
import { getBaseURL } from "@lib/util/env"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
  personaMedia?: PersonaMedia[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
  personaMedia = [],
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const productUrl = `${getBaseURL()}/${countryCode}/products/${product.handle}`

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
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: `${getBaseURL()}/${countryCode}` },
          { name: "Loja", url: `${getBaseURL()}/${countryCode}/store` },
          { name: product.title ?? "Produto", url: productUrl },
        ]}
      />
      <div
        className="content-container  flex flex-col small:flex-row small:items-start py-6 relative"
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
              />
            }
          >
            <ProductActionsWrapper id={product.id} region={region} />
          </Suspense>
          <GuaranteeSeals />
          {allOut && <NotifyMe productId={product.handle ?? product.id} />}
        </div>
      </div>
      <div className="content-container max-w-4xl">
        <QuemE product={product} />
        <PdpTestimonials />
        <div className="mt-10">
          <SizeGuide />
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
