import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

// Cabeçalho: coleção + nome. Separado da descrição porque, no mobile, a ordem da PDP é
// cabeçalho → fotos → compra → descrição (pedido do dono, 2026-09-13); no desktop os dois
// ficam na mesma coluna da esquerda.
export const ProductHeader = ({ product }: ProductInfoProps) => (
  <div id="product-info" className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto w-full">
    {product.collection && (
      <LocalizedClientLink
        href={`/collections/${product.collection.handle}`}
        className="text-medium text-ui-fg-muted hover:text-ui-fg-subtle"
      >
        {product.collection.title}
      </LocalizedClientLink>
    )}
    <Heading level="h1" className="text-3xl leading-10 text-ui-fg-base" data-testid="product-title">
      {product.title}
    </Heading>
  </div>
)

export const ProductDescription = ({ product }: ProductInfoProps) =>
  product.description ? (
    <Text
      className="text-medium text-ui-fg-subtle whitespace-pre-line lg:max-w-[500px] mx-auto w-full"
      data-testid="product-description"
    >
      {product.description}
    </Text>
  ) : null

const ProductInfo = ({ product }: ProductInfoProps) => (
  <div className="flex flex-col gap-y-4">
    <ProductHeader product={product} />
    <ProductDescription product={product} />
  </div>
)

export default ProductInfo
