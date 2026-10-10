"use client"

import Image from "next/image"
import { useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { badgeFor, type ProductCardData } from "@lib/util/product-card-data"
import { normalizeColorName } from "@lib/util/colors"
import Badge from "./badge"
import QuickAdd from "./quick-add"
import Swatches from "./swatches"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { emCentavos, linhaParcelamento, linhaPix, reais, type Condicoes } from "@lib/util/condicoes"

function pushSelectItem(data: ProductCardData, listName?: string, cor?: string) {
  pushEcommerceEvent("select_item", { item_list_name: listName, items: [{ item_id: data.id, item_name: data.title, price: data.price?.calculated_price_number, ...(cor ? { item_variant: cor } : {}) }] })
}

// Índice da cor inicial: a cor do card (vitrine com um card por cor) quando existir no produto;
// senão a primeira cor disponível, como sempre.
function indiceInicial(data: ProductCardData, initialColor: string | null): number {
  if (initialColor) {
    const alvo = normalizeColorName(initialColor)
    const i = data.colors.findIndex((c) => normalizeColorName(c.name) === alvo)
    if (i !== -1) return i
  }
  return Math.max(0, data.colors.findIndex((c) => c.available))
}

export default function ProductCard({ data, countryCode, listName, aspect = "portrait", initialColor = null, condicoes }: { data: ProductCardData; countryCode: string; listName?: string; aspect?: "portrait" | "featured"; initialColor?: string | null; condicoes?: Condicoes }) {
  const [active, setActive] = useState(() => indiceInicial(data, initialColor))
  const [sheet, setSheet] = useState(false)
  const color = data.colors[active] ?? data.colors[0]
  const [img1, img2] = color?.images.length ? color.images : data.images
  const badge = badgeFor(data, active)
  // Leva a cor escolhida na vitrine (nunca o tamanho — controller: tamanho só quando a cliente
  // escolher na PDP). Produto sem opção Cor tem `color.name === ""` -> sem query.
  const href = `/products/${data.handle}${color?.name ? `?cor=${encodeURIComponent(color.name)}` : ""}`
  // Proporção do card = a da foto (2:3), para a foto aparecer inteira (regra da sócia, 2026-09-19: sem
  // cortar cabeça, peça nem logo). "featured" mantém a moldura mais larga do destaque antigo.
  const aspectClass = aspect === "featured" ? "aspect-[11/14]" : "aspect-[2/3]"
  // Parcela e Pix abaixo do preço (referência beatco.com.br). Cada linha só existe com a condição
  // ligada em site_content "condicoes" — ver lib/util/condicoes.ts.
  const precoCentavos = data.price ? emCentavos(data.price.calculated_price_number) : 0
  const parcela = condicoes ? linhaParcelamento(precoCentavos, condicoes, (c) => reais(c)) : null
  const pix = condicoes ? linhaPix(precoCentavos, condicoes, (c) => reais(c)) : null

  // A faixa de adição rápida fica FORA do link (botão dentro de <a> é HTML inválido):
  // o link cobre a imagem por baixo, a faixa fica por cima como irmã posicionada.
  return (
    <div className="group relative" data-testid="product-wrapper">
      <div className={clx("relative w-full overflow-hidden rounded-large bg-ui-bg-subtle", aspectClass)}>
        <LocalizedClientLink href={href} onClick={() => pushSelectItem(data, listName, color?.name || undefined)} className="absolute inset-0 block" aria-label={data.title}>
          <Badge badge={badge} percent={data.price?.percentage_diff} />
          {img1 ? (
            <Image src={img1} alt={`${data.title} — ${color?.name || "use.ÉCLAT"}`} fill quality={80} sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw" className={clx("object-cover object-center transition-opacity duration-300", img2 && "small:group-hover:opacity-0")} draggable={false} />
          ) : null}
          {img2 && <Image src={img2} alt="" aria-hidden fill quality={80} sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover object-center opacity-0 transition-opacity duration-300 small:group-hover:opacity-100" draggable={false} />}
        </LocalizedClientLink>
        {color && color.available && <QuickAdd data={data} color={color} countryCode={countryCode} open={sheet} onClose={() => setSheet(false)} />}
      </div>
      <LocalizedClientLink href={href} onClick={() => pushSelectItem(data, listName, color?.name || undefined)} className="block">
        {/* Tamanhos da cor, sempre visíveis (referência bechose.com.br, 2026-10-10): esgotado fica riscado.
            A adição rápida (hover / "+") continua sendo a faixa sobre a foto. */}
        {color && color.variants.some((v) => v.size) && (
          <ul className="mt-3 flex flex-wrap gap-1" aria-label="Tamanhos" data-testid="card-tamanhos">
            {color.variants.map((v) => (
              <li
                key={v.id}
                className={clx("min-w-[26px] rounded-sm border px-1.5 py-0.5 text-center text-[10px] leading-none", v.available ? "border-eclat-pedra/70 text-eclat-grafite" : "border-eclat-pedra/40 text-eclat-grafite/35 line-through")}
                aria-label={`${v.size}${v.available ? "" : " esgotado"}`}
              >
                {v.size}
              </li>
            ))}
          </ul>
        )}
        {/* Mobile: nome em cima, preço embaixo (em 2 colunas estreitas o preço lado a lado
            transbordava para o card vizinho). Desktop (large): lado a lado. */}
        <div className="flex flex-col mt-2 gap-y-1 large:flex-row large:justify-between large:items-start large:gap-2">
          <div className="min-w-0">
            {/* Nome · cor numa linha (referência bechose.com.br, 2026-10-10): com um card por cor, a cor faz
                parte do nome — "Top Aurora · Grafitti". */}
            <Text className="text-ui-fg-subtle break-words" data-testid="product-title">
              {data.title}
              {data.colors.length > 1 && color?.name && (
                <span className="text-ui-fg-muted" data-testid="product-color-name">
                  {" · "}
                  {color.name}
                </span>
              )}
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 large:shrink-0">
            {data.price?.price_type === "sale" && <Text className="line-through text-ui-fg-muted" data-testid="original-price">{data.price.original_price}</Text>}
            {data.price && <Text className={clx("text-ui-fg-muted", data.price.price_type === "sale" && "text-ui-fg-interactive")} data-testid="price">{data.price.calculated_price}</Text>}
          </div>
        </div>
        {(parcela || pix) && (
          <div className="mt-1 text-xs leading-snug text-ui-fg-muted" data-testid="card-condicoes">
            {pix && <p className="text-eclat-terracota font-medium">{pix}</p>}
            {parcela && <p>{parcela}</p>}
          </div>
        )}
        {data.formaConjunto && (
          <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-eclat-dourado" data-testid="forma-conjunto-badge">
            Forma conjunto
          </p>
        )}
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
