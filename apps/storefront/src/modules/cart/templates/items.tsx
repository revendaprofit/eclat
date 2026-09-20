import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Table } from "@modules/common/components/ui"

import ItemCard from "@modules/cart/components/item-card"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
  etiquetas?: Record<string, string>
}

// Lista de peças da sacola em cartões (redesenho 2026-09; era uma tabela que cortava no celular).
const ItemsTemplate = ({ cart, etiquetas }: ItemsTemplateProps) => {
  const items = cart?.items
  const pecas = (items ?? []).reduce((s, i) => s + i.quantity, 0)
  return (
    <div>
      <header className="flex items-baseline justify-between border-b border-eclat-grafite/80 pb-3">
        <h1 className="font-serif text-4xl small:text-5xl leading-none text-eclat-grafite">Sacola</h1>
        {items && (
          <span className="text-sm text-eclat-grafite/60" data-testid="cart-count">
            {pecas} {pecas === 1 ? "peça" : "peças"}
          </span>
        )}
      </header>
      {items ? (
        <ul className="flex flex-col" data-testid="cart-items">
          {[...items]
            .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
            .map((item) => (
              <ItemCard key={item.id} item={item} currencyCode={cart?.currency_code ?? "brl"} etiqueta={etiquetas?.[item.id]} />
            ))}
        </ul>
      ) : (
        <Table>
          <Table.Body>
            {repeat(3).map((i) => (
              <SkeletonLineItem key={i} />
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

export default ItemsTemplate
