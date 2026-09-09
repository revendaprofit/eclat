import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { getVitrineConjuntos } from "@lib/data/conjuntos"
import { getBaseURL } from "@lib/util/env"
import type { CardConjunto as CardConjuntoData } from "@lib/util/conjuntos"
import CategoryHeader from "@modules/categories/components/category-header"
import Breadcrumb from "@modules/common/components/breadcrumb"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ItemListJsonLd } from "@modules/seo/jsonld"
import Track, { type EcommercePayload } from "@modules/analytics/track"
import CardConjunto from "@modules/conjuntos/components/card-conjunto"
import GradeColecao, { CARDS_INICIAIS } from "@modules/conjuntos/components/grade-colecao"

// Payload GA4 (schema `EcommercePayload`) a partir dos cards de uma seção — mesma forma de
// `productsToItemList` (item_id/item_name/price/index), mas com o preço COM benefício (é o preço
// que a cliente vê e paga pelo conjunto).
function itemListPayload(cards: CardConjuntoData[], listName: string): EcommercePayload {
  return {
    item_list_name: listName,
    items: cards.map((c, i) => ({
      item_id: c.handle,
      item_name: c.nome,
      price: c.precoComBeneficio / 100,
      index: i,
    })),
  }
}

// Página Conjuntos (`/categories/conjuntos`, spec §7.1, F3): vitrine dedicada do Benefício
// Conjunto — sem filtros de catálogo (ruling 2). Duas famílias de seção: "Escolhidos pela ÉCLAT"
// (curados, ordem do backend, sem limite) e uma por coleção com pares gerados (12 + "ver todos",
// `GradeColecao`). Cada seção dispara seu próprio `view_item_list` e tem seu próprio
// `ItemListJsonLd` — os nomes usados no rótulo (h2) e no `item_list_name` (GA4/JSON-LD) diferem de
// propósito: o primeiro é uma legenda de leitura, o segundo é o nome de evento/lista.
export default async function VitrineConjuntos({
  category,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  countryCode: string
}) {
  if (!category || !countryCode) notFound()

  const { curados, colecoes } = await getVitrineConjuntos(countryCode)
  const base = getBaseURL()
  const vazio = curados.length === 0 && colecoes.length === 0

  return (
    <div className="content-container py-6" data-testid="conjuntos-container">
      <Breadcrumb
        items={[
          { name: "Início", href: "" },
          { name: "Conjuntos", href: "/categories/conjuntos" },
        ]}
        countryCode={countryCode}
      />
      <CategoryHeader category={category} />

      {vazio ? (
        <div className="py-16 text-center flex flex-col items-center gap-4" data-testid="conjuntos-vazio">
          <p className="font-serif text-2xl text-eclat-grafite">Em breve: conjuntos da coleção</p>
          <LocalizedClientLink href="/store" className="underline text-eclat-terracota">
            Ver toda a loja
          </LocalizedClientLink>
        </div>
      ) : (
        <div className="flex flex-col gap-16">
          {curados.length > 0 && (
            <section aria-labelledby="conjuntos-curados-titulo" data-testid="secao-curados">
              <h2 id="conjuntos-curados-titulo" className="font-serif text-2xl text-eclat-grafite mb-6">
                Escolhidos pela ÉCLAT
              </h2>
              <ItemListJsonLd
                name="Conjuntos"
                items={curados.map((c) => ({
                  name: c.nome,
                  url: `${base}/${countryCode}/conjuntos/${c.handle}`,
                }))}
              />
              <Track event="view_item_list" ecommerce={itemListPayload(curados, "Conjuntos")} />
              <ul
                className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
                data-testid="conjuntos-curados-list"
              >
                {curados.map((c) => (
                  <li key={c.handle}>
                    <CardConjunto card={c} listName="Conjuntos" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {colecoes.map((col) => {
            const listName = `Conjuntos: ${col.titulo}`
            return (
              <section
                key={col.collection_id}
                aria-labelledby={`conjuntos-colecao-${col.collection_id}`}
                data-testid="secao-colecao"
              >
                <h2
                  id={`conjuntos-colecao-${col.collection_id}`}
                  className="font-serif text-2xl text-eclat-grafite mb-6"
                >
                  Conjuntos {col.titulo}
                </h2>
                <ItemListJsonLd
                  name={listName}
                  items={col.cards.map((c) => ({
                    name: c.nome,
                    url: `${base}/${countryCode}/conjuntos/${c.handle}`,
                  }))}
                />
                <Track event="view_item_list" ecommerce={itemListPayload(col.cards.slice(0, CARDS_INICIAIS), listName)} />
                <GradeColecao cards={col.cards} listName={listName} />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
