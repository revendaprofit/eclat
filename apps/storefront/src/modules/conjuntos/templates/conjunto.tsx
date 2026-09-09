import type { HttpTypes } from "@medusajs/types"
import type { CardConjunto as CardConjuntoData } from "@lib/util/conjuntos"
import { getBaseURL } from "@lib/util/env"
import { getColorMap } from "@lib/data/colors"
import Breadcrumb from "@modules/common/components/breadcrumb"
import Track, { type EcommercePayload } from "@modules/analytics/track"
import { ConjuntoJsonLd } from "@modules/seo/jsonld"
import ConjuntoBuilder from "@modules/conjuntos/components/conjunto-builder"

// `view_item` do conjunto (spec §7.2): os "items" são as PEÇAS, não uma linha "conjunto" — não
// existe SKU de conjunto no catálogo. `value` é o total com benefício (o que a cliente paga).
function viewItemPayload(card: CardConjuntoData): EcommercePayload {
  return {
    currency: "BRL",
    value: card.precoComBeneficio / 100,
    item_list_name: `Conjunto: ${card.nome}`,
    items: card.pecas.map((p, i) => ({
      item_id: p.id,
      item_name: p.title,
      price: (p.precoMin ?? 0) / 100,
      index: i,
    })),
  }
}

// Página de um conjunto (`/conjuntos/[handle]`, spec §7.2, F3, ruling 4): breadcrumb, JSON-LD e o
// builder client (peças com galeria/cor/tamanho próprios + rodapé de compra com o total).
export default async function ConjuntoTemplate({
  card,
  produtos,
  countryCode,
}: {
  card: CardConjuntoData
  produtos: HttpTypes.StoreProduct[]
  countryCode: string
}) {
  const colorMap = await getColorMap()
  const base = getBaseURL()
  const url = `${base}/${countryCode}/conjuntos/${card.handle}`

  return (
    <div className="content-container py-6" data-testid="conjunto-container">
      <Breadcrumb
        items={[
          { name: "Início", href: "" },
          { name: "Conjuntos", href: "/categories/conjuntos" },
          { name: card.nome, href: `/conjuntos/${card.handle}` },
        ]}
        countryCode={countryCode}
      />
      <Track event="view_item" ecommerce={viewItemPayload(card)} />
      <ConjuntoJsonLd
        nome={card.nome}
        url={url}
        imagem={card.capa ?? card.pecas[0]?.thumbnail ?? undefined}
        precoTotal={card.precoComBeneficio / 100}
        moeda="BRL"
        pecas={card.pecas.map((p) => ({
          nome: p.title,
          url: `${base}/${countryCode}/products/${p.handle}`,
        }))}
      />
      <h1 className="font-serif text-2xl text-eclat-grafite mb-6" data-testid="conjunto-nome">
        {card.nome}
      </h1>
      <ConjuntoBuilder card={card} produtos={produtos} colorMap={colorMap} countryCode={countryCode} />
    </div>
  )
}
