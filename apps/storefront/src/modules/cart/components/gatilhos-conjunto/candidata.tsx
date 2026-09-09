"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import type { HttpTypes } from "@medusajs/types"
import { addToCart } from "@lib/data/cart"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { variantToAddToCart } from "@modules/analytics/items"
import { showToast } from "@modules/common/components/toast"
import { Button, clx } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { corParceira, formatarReais, precoMinDisponivel } from "@lib/util/conjuntos"
import { type Gatilho, slotGatilho } from "@lib/util/carrinho-conjunto"
import { findOption, imagesForColor, sizeAvailability, sizeValues, variantFor } from "@lib/util/pdp-variants"

export const LISTA_GATILHO = "Feche mais um conjunto"

// Card de uma candidata do gatilho (ruling 4): foto na primeira cor disponível, nome, preço
// "a partir de", chips de tamanho (mesmo estilo de `complete-set/parceira.tsx`) e "Adicionar".
// Adiciona 1 unidade em linha própria (`slotGatilho`); a página do carrinho se atualiza pela
// revalidação do carrinho feita por `addToCart`.
export default function Candidata({ produto, gatilho, countryCode }: { produto: HttpTypes.StoreProduct; gatilho: Gatilho; countryCode: string }) {
  const cor = useMemo(() => corParceira(produto, null), [produto])
  const [tamanho, setTamanho] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)

  const colorOpt = findOption(produto, "Cor")
  const sizeOpt = findOption(produto, "Tamanho")
  const sizes = useMemo(() => sizeValues(produto), [produto])
  const avail = useMemo(() => sizeAvailability(produto, cor), [produto, cor])

  const variante = useMemo(() => {
    if (sizeOpt && !tamanho) return null
    const sel: Record<string, string> = {}
    if (colorOpt && cor) sel[colorOpt.id] = cor
    if (sizeOpt && tamanho) sel[sizeOpt.id] = tamanho
    return variantFor(produto, sel)
  }, [produto, colorOpt, cor, sizeOpt, tamanho])

  const preco = precoMinDisponivel(produto)
  const imagem = imagesForColor(produto, cor)[0]?.url ?? produto.thumbnail ?? null
  const href = `/products/${produto.handle}${cor ? `?cor=${encodeURIComponent(cor)}` : ""}`
  const podeAdicionar = !!variante && !adicionando

  async function handleAdicionar() {
    if (!variante || adicionando) return
    pushEcommerceEvent("conjunto_trigger_click", undefined, {
      collection_id: gatilho.collection_id,
      categoria_faltante: gatilho.categoria_faltante,
    })
    setAdicionando(true)
    try {
      await addToCart({ variantId: variante.id, quantity: 1, countryCode, metadata: slotGatilho(gatilho.categoria_faltante) })
      pushEcommerceEvent("add_to_cart", { ...variantToAddToCart(produto, variante, 1), item_list_name: LISTA_GATILHO })
      showToast({ message: `${produto.title} adicionado à sacola` })
    } catch {
      showToast({ message: `Não foi possível adicionar ${produto.title}. Tente de novo.` })
    } finally {
      setAdicionando(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="gatilho-candidata">
      <LocalizedClientLink href={href} className="block relative w-full aspect-[9/16] overflow-hidden rounded-large bg-eclat-areia/40">
        {imagem && (
          <Image src={imagem} alt={produto.title ?? ""} fill quality={80} sizes="(max-width: 576px) 50vw, 25vw" className="object-cover object-center" draggable={false} />
        )}
      </LocalizedClientLink>
      <div>
        <p className="text-eclat-grafite" data-testid="candidata-nome">{produto.title}</p>
        {preco !== null && (
          <p className="text-eclat-grafite/70 text-sm" data-testid="candidata-preco">a partir de {formatarReais(preco)}</p>
        )}
      </div>
      {sizeOpt && (
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => {
            const esgotado = avail[s] === false
            const on = tamanho === s
            return (
              <button
                key={s}
                type="button"
                disabled={esgotado || adicionando}
                onClick={() => setTamanho(s)}
                aria-pressed={on}
                className={clx(
                  "h-8 min-w-[36px] px-2 text-xs rounded border",
                  on
                    ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite"
                    : esgotado
                      ? "border-eclat-pedra/50 text-eclat-grafite/40 line-through cursor-not-allowed"
                      : "border-eclat-grafite hover:bg-eclat-grafite hover:text-eclat-luz"
                )}
                data-testid={`candidata-tamanho-${s}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
      <Button type="button" onClick={handleAdicionar} disabled={!podeAdicionar} isLoading={adicionando} variant="secondary" className="w-full h-10 text-sm" data-testid="candidata-adicionar">
        Adicionar
      </Button>
    </div>
  )
}
