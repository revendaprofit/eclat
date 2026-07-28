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
        </div>
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
