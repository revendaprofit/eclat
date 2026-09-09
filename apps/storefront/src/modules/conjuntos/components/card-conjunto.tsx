"use client"

import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { formatarReais, type CardConjunto as CardConjuntoData } from "@lib/util/conjuntos"
import { pushEcommerceEvent } from "@modules/analytics/push"

// Card do Benefício Conjunto (spec §7.1, ruling 3): duas fotos lado a lado (ou capa, quando o
// conjunto é curado e tem uma cadastrada), nome, preço com benefício + preço cheio riscado, selo
// "Benefício Conjunto". O clique dispara `select_item` (GA4) com o `item_list_name` da seção antes
// de navegar — mesmo padrão de `ProductCard` (`pushSelectItem`).
function pushSelectItem(card: CardConjuntoData, listName: string) {
  pushEcommerceEvent("select_item", {
    item_list_name: listName,
    items: [
      {
        item_id: card.handle,
        item_name: card.nome,
        price: card.precoComBeneficio / 100,
      },
    ],
  })
}

export default function CardConjunto({
  card,
  listName,
}: {
  card: CardConjuntoData
  listName: string
}) {
  const fotos = card.capa
    ? [card.capa]
    : card.pecas.slice(0, 2).map((p) => p.thumbnail)

  return (
    <LocalizedClientLink
      href={`/conjuntos/${card.handle}`}
      onClick={() => pushSelectItem(card, listName)}
      className="group block"
      data-testid="card-conjunto"
    >
      <div className="relative w-full aspect-[9/16] overflow-hidden rounded-large bg-eclat-areia/40">
        <span className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded bg-eclat-terracota text-eclat-luz">
          Benefício Conjunto
        </span>
        {fotos.length === 2 ? (
          <div className="grid grid-cols-2 gap-0.5 h-full">
            {fotos.map((src, i) =>
              src ? (
                <div key={i} className="relative h-full">
                  <Image
                    src={src}
                    alt={i === 0 ? `${card.nome} — use.ÉCLAT` : ""}
                    aria-hidden={i > 0}
                    fill
                    quality={80}
                    sizes="(max-width: 576px) 25vw, (max-width: 1024px) 16vw, 12vw"
                    className="object-cover object-center"
                    draggable={false}
                  />
                </div>
              ) : (
                <div key={i} className="h-full bg-eclat-areia/40" />
              )
            )}
          </div>
        ) : fotos[0] ? (
          <Image
            src={fotos[0]}
            alt={`${card.nome} — use.ÉCLAT`}
            fill
            quality={80}
            sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover object-center"
            draggable={false}
          />
        ) : null}
      </div>
      <div className="mt-4">
        <p className="text-eclat-grafite" data-testid="card-conjunto-nome">
          {card.nome}
        </p>
        <div className="mt-1">
          <div className="flex items-baseline gap-x-1">
            <span className="text-eclat-grafite/50 text-[10px] uppercase tracking-[0.15em]">a partir de</span>
            <span className="text-eclat-terracota font-medium" data-testid="card-conjunto-preco-beneficio">
              {formatarReais(card.precoComBeneficio)}
            </span>
          </div>
          <span className="line-through text-eclat-grafite/50 text-sm" data-testid="card-conjunto-preco-cheio">
            {formatarReais(card.precoCheio)}
          </span>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
