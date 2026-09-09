"use client"

import { useCallback, useState } from "react"
import type { HttpTypes } from "@medusajs/types"
import type { ColorMap } from "@lib/util/colors"
import { addToCart } from "@lib/data/cart"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { variantToAddToCart } from "@modules/analytics/items"
import { showToast } from "@modules/common/components/toast"
import { colorValues, firstAvailableVariantId } from "@lib/util/pdp-variants"
import { slotMetadata, totalDoConjunto, type CardConjunto } from "@lib/util/conjuntos"
import { ProductSelectionProvider } from "@modules/products/components/product-selection"
import PecaDoConjunto, { type SelecaoPeca } from "./peca-do-conjunto"
import RodapeConjunto from "./rodape-conjunto"

type VariantComPreco = HttpTypes.StoreProductVariant & {
  calculated_price?: { calculated_amount?: number | null } | null
}

// Cor a pré-selecionar em cada peça ao entrar pela página do conjunto: a primeira com variante
// disponível (spec §7.2, ruling 4 — "cor pré-selecionada = primeira disponível", nunca o tamanho).
function primeiraCorDisponivel(p: HttpTypes.StoreProduct): string | null {
  return colorValues(p).find((c) => firstAvailableVariantId(p, c) !== null) ?? null
}

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches

// Orquestra as peças do conjunto (spec §7.2, ruling 4): um `ProductSelectionProvider` por
// produto — a mesma seleção de cor/tamanho da PDP, isolada por peça — e o rodápe de compra que
// soma os totais e adiciona uma linha por peça no carrinho (spec §6.3: linhas separadas via
// `metadata.conjunto_slot`, nunca uma linha "conjunto" só).
export default function ConjuntoBuilder({
  card,
  produtos,
  colorMap,
  countryCode,
}: {
  card: CardConjunto
  produtos: HttpTypes.StoreProduct[]
  colorMap: ColorMap
  countryCode: string
}) {
  const [selecoes, setSelecoes] = useState<Record<string, SelecaoPeca>>({})
  const [adicionando, setAdicionando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleChange = useCallback(
    (index: number, info: SelecaoPeca) => {
      const productId = produtos[index]?.id
      if (!productId) return
      setSelecoes((prev) => {
        const atual = prev[productId]
        if (atual && atual.variant === info.variant && atual.completa === info.completa) return prev
        return { ...prev, [productId]: info }
      })
    },
    [produtos]
  )

  // Preço de cada peça: o da variante escolhida quando há uma selecionada; senão o `precoMin` do
  // card (mesmo fallback do card da vitrine) — o rodapé mostra um total plausível desde o 1º render.
  const precosSelecionados = produtos.map((p) => {
    const variante = selecoes[p.id]?.variant as VariantComPreco | null | undefined
    const amount = variante?.calculated_price?.calculated_amount
    return typeof amount === "number" ? Math.round(amount * 100) : null
  })
  const totais = totalDoConjunto(precosSelecionados, card.pecas, card.regra)
  const podeAdicionar = produtos.length > 0 && produtos.every((p) => selecoes[p.id]?.completa)

  async function handleAdicionar() {
    if (!podeAdicionar || adicionando) return
    setAdicionando(true)
    setErro(null)
    try {
      for (let i = 0; i < produtos.length; i++) {
        const produto = produtos[i]
        const variant = selecoes[produto.id]?.variant
        if (!variant) throw new Error("Peça incompleta")
        // eslint-disable-next-line no-await-in-loop -- linhas precisam entrar em sequência (spec §6.3)
        await addToCart({
          variantId: variant.id,
          quantity: 1,
          countryCode,
          metadata: slotMetadata(card.handle, i),
        })
        pushEcommerceEvent("add_to_cart", {
          ...variantToAddToCart(produto, variant, 1),
          item_list_name: `Conjunto: ${card.nome}`,
        })
      }
      // Desktop: o dropdown da sacola já abre sozinho ao detectar a troca de quantidade de itens
      // (mesmo mecanismo do `QuickAdd` — nada a fazer aqui). Mobile: toast, como no `QuickAdd`.
      if (isMobile()) {
        showToast({
          message: `Conjunto ${card.nome} adicionado à sacola`,
          action: { label: "Ver sacola", href: "/cart" },
        })
      }
    } catch {
      const msg = "Não foi possível adicionar o conjunto. Tente de novo."
      setErro(msg)
      showToast({ message: msg })
    } finally {
      setAdicionando(false)
    }
  }

  return (
    <div className="flex flex-col small:flex-row gap-8 pb-28 small:pb-0" data-testid="conjunto-builder">
      <div className="grid grid-cols-1 small:grid-cols-2 gap-10 flex-1">
        {produtos.map((produto, i) => (
          <ProductSelectionProvider key={produto.id} product={produto} initialColor={primeiraCorDisponivel(produto)}>
            <PecaDoConjunto peca={card.pecas[i]} index={i} colorMap={colorMap} onChange={handleChange} />
          </ProductSelectionProvider>
        ))}
      </div>
      <RodapeConjunto
        nome={card.nome}
        precoCheio={totais.cheio}
        precoComBeneficio={totais.comBeneficio}
        regra={card.regra}
        numPecas={card.pecas.length}
        disabled={!podeAdicionar}
        isAdding={adicionando}
        erro={erro}
        onAdicionar={handleAdicionar}
      />
    </div>
  )
}
