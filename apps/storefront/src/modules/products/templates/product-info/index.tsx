import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { lerFuncionalidades } from "@lib/util/funcionalidades"

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

export const ProductDescription = ({ product }: ProductInfoProps) => {
  const funcionalidades = lerFuncionalidades(product.metadata?.funcionalidades)
  if (!product.description && funcionalidades.length === 0) return null
  return (
    <div className="flex flex-col gap-y-5 lg:max-w-[500px] mx-auto w-full">
      {product.description && (
        <Text className="text-medium text-ui-fg-subtle whitespace-pre-line" data-testid="product-description">
          {product.description}
        </Text>
      )}
      {funcionalidades.length > 0 && (
        <div data-testid="product-funcionalidades">
          <h2 className="text-xs uppercase tracking-widest text-eclat-terracota mb-3">Funcionalidades</h2>
          <ul className="flex flex-col gap-y-2 text-sm text-ui-fg-subtle">
            {funcionalidades.map((f) => (
              <li key={f.titulo} className="flex gap-x-2">
                <span aria-hidden className="text-eclat-terracota">•</span>
                <span>
                  <strong className="font-semibold text-eclat-grafite">{f.titulo}:</strong> {f.texto}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const ProductInfo = ({ product }: ProductInfoProps) => (
  <div className="flex flex-col gap-y-4">
    <ProductHeader product={product} />
    <ProductDescription product={product} />
  </div>
)

export default ProductInfo
