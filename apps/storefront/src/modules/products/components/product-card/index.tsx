"use client"

import Image from "next/image"
import { useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { badgeFor, type ProductCardData } from "@lib/util/product-card-data"
import Badge from "./badge"
import QuickAdd from "./quick-add"
import Swatches from "./swatches"
import { pushEcommerceEvent } from "@modules/analytics/push"

function pushSelectItem(data: ProductCardData, listName?: string) {
  pushEcommerceEvent("select_item", { item_list_name: listName, items: [{ item_id: data.id, item_name: data.title, price: data.price?.calculated_price_number }] })
}

export default function ProductCard({ data, countryCode, listName, aspect = "portrait" }: { data: ProductCardData; countryCode: string; listName?: string; aspect?: "portrait" | "featured" }) {
  const [active, setActive] = useState(() => Math.max(0, data.colors.findIndex((c) => c.available)))
  const [sheet, setSheet] = useState(false)
  const color = data.colors[active] ?? data.colors[0]
  const [img1, img2] = color?.images.length ? color.images : data.images
  const badge = badgeFor(data, active)
  // Leva a cor escolhida na vitrine (nunca o tamanho — controller: tamanho só quando a cliente
  // escolher na PDP). Produto sem opção Cor tem `color.name === ""` -> sem query.
  const href = `/products/${data.handle}${color?.name ? `?cor=${encodeURIComponent(color.name)}` : ""}`
  // Proporção do card: portrait (9/16) no grid, featured (11/14) no destaque da home
  const aspectClass = aspect === "featured" ? "aspect-[11/14]" : "aspect-[9/16]"

  // A faixa de adição rápida fica FORA do link (botão dentro de <a> é HTML inválido):
  // o link cobre a imagem por baixo, a faixa fica por cima como irmã posicionada.
  return (
    <div className="group relative" data-testid="product-wrapper">
      <div className={clx("relative w-full overflow-hidden rounded-large bg-ui-bg-subtle", aspectClass)}>
        <LocalizedClientLink href={href} onClick={() => pushSelectItem(data, listName)} className="absolute inset-0 block" aria-label={data.title}>
          <Badge badge={badge} percent={data.price?.percentage_diff} />
          {img1 ? (
            <Image src={img1} alt={`${data.title} — ${color?.name || "use.ÉCLAT"}`} fill quality={80} sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw" className={clx("object-cover object-center transition-opacity duration-300", img2 && "small:group-hover:opacity-0")} draggable={false} />
          ) : null}
          {img2 && <Image src={img2} alt="" aria-hidden fill quality={80} sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover object-center opacity-0 transition-opacity duration-300 small:group-hover:opacity-100" draggable={false} />}
        </LocalizedClientLink>
        {color && color.available && <QuickAdd data={data} color={color} countryCode={countryCode} open={sheet} onClose={() => setSheet(false)} />}
      </div>
      <LocalizedClientLink href={href} onClick={() => pushSelectItem(data, listName)} className="block">
        <div className="flex mt-4 justify-between items-start gap-2">
          <Text className="text-ui-fg-subtle" data-testid="product-title">{data.title}</Text>
          <div className="flex items-center gap-x-2 shrink-0">
            {data.price?.price_type === "sale" && <Text className="line-through text-ui-fg-muted" data-testid="original-price">{data.price.original_price}</Text>}
            {data.price && <Text className={clx("text-ui-fg-muted", data.price.price_type === "sale" && "text-ui-fg-interactive")} data-testid="price">{data.price.calculated_price}</Text>}
          </div>
        </div>
      </LocalizedClientLink>
      <div className="flex items-center justify-between">
        <Swatches colors={data.colors} active={active} onSelect={(i) => { setActive(i); setSheet(false) }} />
        {color?.available && (
          <button type="button" onClick={() => setSheet((s) => !s)} aria-label="Adicionar rápido" className="small:hidden mt-2 w-8 h-8 rounded-full border border-eclat-grafite text-lg leading-none" data-testid="quick-add-toggle">+</button>
        )}
      </div>
    </div>
  )
}
