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
import { corParceira, formatarReais, precoMinDisponivel, slotMetadata } from "@lib/util/conjuntos"
import { findOption, imagesForColor, sizeAvailability, sizeValues, variantFor } from "@lib/util/pdp-variants"
import { useProductSelection } from "@modules/products/components/product-selection"

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches

// Card de uma parceira dentro de "Complete o conjunto" (spec §7.3, ruling 5): foto na cor
// derivada da seleção da página (`corParceira`), nome, preço, tamanho próprio (chip, estilo do
// `QuickAdd`) e "Adicionar as duas". A peça-âncora vem de `useProductSelection()` — este
// componente é sempre descendente do `ProductSelectionProvider` da PDP (ver `templates/index.tsx`),
// nunca ganha um provider próprio como as peças da página do conjunto (`PecaDoConjunto`).
export default function Parceira({
  parceira,
  countryCode,
}: {
  parceira: HttpTypes.StoreProduct
  countryCode: string
}) {
  const {
    product: anchor,
    selectedVariant: anchorVariant,
    isComplete: anchorComplete,
    color: anchorColor,
  } = useProductSelection()

  const cor = useMemo(() => corParceira(parceira, anchorColor), [parceira, anchorColor])
  const [tamanho, setTamanho] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  // Progresso da tentativa em curso (retry resumível, fix round 1, achado "retry duplica linha
  // da âncora"), atrelado à SELEÇÃO à qual pertence — `chave` é `${anchorVariant.id}|${parceiraVariant.id}`
  // capturados no clique que gerou o progresso. Sem isso (fix round 2, achado "retry pula slot 0
  // com seleção nova"): se a página troca a peça-âncora (ou o tamanho da parceira muda) enquanto
  // uma adição está em voo e ela falha, um `useEffect` de reset com guarda por ref não reagia —
  // React já tinha memorizado as deps novas, o efeito nunca re-executava, e o retry seguinte
  // herdava `adicionados={0}` de uma seleção que não é mais a atual. Guardar o progresso junto da
  // chave elimina o efeito: no clique, comparamos a chave atual com a do progresso salvo — se
  // bater, retomamos; se não, começamos do zero (nenhum ref, nenhum efeito).
  const [progresso, setProgresso] = useState<{ chave: string; adicionados: Set<0 | 1> } | null>(
    null
  )

  const colorOpt = findOption(parceira, "Cor")
  const sizeOpt = findOption(parceira, "Tamanho")
  const sizes = useMemo(() => sizeValues(parceira), [parceira])
  const avail = useMemo(() => sizeAvailability(parceira, cor), [parceira, cor])

  const parceiraVariant = useMemo(() => {
    if (sizeOpt && !tamanho) return null
    const sel: Record<string, string> = {}
    if (colorOpt && cor) sel[colorOpt.id] = cor
    if (sizeOpt && tamanho) sel[sizeOpt.id] = tamanho
    return variantFor(parceira, sel)
  }, [parceira, colorOpt, cor, sizeOpt, tamanho])

  // Desabilitado até a página TER tamanho escolhido (peça-âncora completa) e a parceira também
  // ter uma variante disponível escolhida (ruling 5).
  const podeAdicionar = !!anchorVariant && anchorComplete && !!parceiraVariant && !adicionando

  const preco = precoMinDisponivel(parceira)
  const imagem = imagesForColor(parceira, cor)[0]?.url ?? parceira.thumbnail ?? null
  const href = `/products/${parceira.handle}${cor ? `?cor=${encodeURIComponent(cor)}` : ""}`

  async function handleAdicionar() {
    if (!podeAdicionar || !anchorVariant || !parceiraVariant) return
    // Captura a seleção UMA VEZ no clique: os dois `addToCart` abaixo e `chaveAtual` usam sempre
    // estas variáveis, nunca `anchorVariant`/`parceiraVariant` de novo — se a página trocar a
    // peça-âncora (ou o tamanho da parceira) enquanto esta tentativa está em voo, ela não muda de
    // seleção no meio do caminho.
    const anchorVarAtual = anchorVariant
    const parceiraVarAtual = parceiraVariant
    const chaveAtual = `${anchorVarAtual.id}|${parceiraVarAtual.id}`
    // Retoma o progresso salvo só se ele pertence a esta MESMA seleção; caso contrário (seleção
    // mudou desde a última tentativa) começa do zero — ver comentário do `useState` acima.
    let adicionadosAtual =
      progresso?.chave === chaveAtual ? progresso.adicionados : new Set<0 | 1>()
    setAdicionando(true)
    const conjuntoHandle = `${anchor.handle}--${parceira.handle}`
    // Título da peça cuja `addToCart` falhou — só para nomear a peça na mensagem de erro; a
    // resumabilidade em si vem do `adicionadosAtual.has(slot)` abaixo (fix round 1).
    let tituloComFalha: string | null = null
    try {
      if (!adicionadosAtual.has(0)) {
        try {
          await addToCart({
            variantId: anchorVarAtual.id,
            quantity: 1,
            countryCode,
            metadata: slotMetadata(conjuntoHandle, 0),
          })
        } catch (e) {
          tituloComFalha = anchor.title ?? null
          throw e
        }
        adicionadosAtual = new Set<0 | 1>(Array.from(adicionadosAtual))
        adicionadosAtual.add(0)
        setProgresso({ chave: chaveAtual, adicionados: adicionadosAtual })
        pushEcommerceEvent("add_to_cart", {
          ...variantToAddToCart(anchor, anchorVarAtual, 1),
          item_list_name: "Complete o conjunto",
        })
      }
      if (!adicionadosAtual.has(1)) {
        try {
          await addToCart({
            variantId: parceiraVarAtual.id,
            quantity: 1,
            countryCode,
            metadata: slotMetadata(conjuntoHandle, 1),
          })
        } catch (e) {
          tituloComFalha = parceira.title ?? null
          throw e
        }
        adicionadosAtual = new Set<0 | 1>(Array.from(adicionadosAtual))
        adicionadosAtual.add(1)
        setProgresso({ chave: chaveAtual, adicionados: adicionadosAtual })
        pushEcommerceEvent("add_to_cart", {
          ...variantToAddToCart(parceira, parceiraVarAtual, 1),
          item_list_name: "Complete o conjunto",
        })
      }
      setProgresso(null) // sucesso completo: próximo clique começa uma tentativa nova
      // Desktop: o dropdown da sacola já abre sozinho ao detectar a troca de quantidade de itens
      // (mesmo mecanismo do `QuickAdd`/`ConjuntoBuilder`). Mobile: toast.
      if (isMobile()) {
        showToast({
          message: `${anchor.title} e ${parceira.title} adicionados à sacola`,
          action: { label: "Ver sacola", href: "/cart" },
        })
      }
    } catch {
      // Progresso parcial já foi salvo (sob `chaveAtual`) logo após o add que teve sucesso, antes
      // do que falhou — nada a fazer aqui além de avisar o usuário.
      const msg = tituloComFalha
        ? `Não foi possível adicionar ${tituloComFalha}. Tente de novo.`
        : "Não foi possível adicionar. Tente de novo."
      showToast({ message: msg })
    } finally {
      setAdicionando(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="parceira-conjunto">
      <LocalizedClientLink
        href={href}
        className="block relative w-full aspect-[9/16] overflow-hidden rounded-large bg-eclat-areia/40"
      >
        {imagem && (
          <Image
            src={imagem}
            alt={parceira.title ?? ""}
            fill
            quality={80}
            sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover object-center"
            draggable={false}
          />
        )}
      </LocalizedClientLink>
      <div>
        <p className="text-eclat-grafite" data-testid="parceira-nome">
          {parceira.title}
        </p>
        {preco !== null && (
          <p className="text-eclat-grafite/70 text-sm" data-testid="parceira-preco">
            {formatarReais(preco)}
          </p>
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
                data-testid={`parceira-tamanho-${s}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
      <Button
        type="button"
        onClick={handleAdicionar}
        disabled={!podeAdicionar}
        isLoading={adicionando}
        variant="secondary"
        className="w-full h-10 text-sm"
        data-testid="adicionar-duas-button"
      >
        Adicionar as duas
      </Button>
    </div>
  )
}
