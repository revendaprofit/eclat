"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useState } from "react"
import type { MeasureTable } from "@lib/util/measurements"
import SizeGuide from "@modules/products/components/size-guide"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
  // tabela de medidas da categoria (null = tabela padrão do SizeGuide)
  measureTable?: MeasureTable | null
}

const ABA_MEDIDAS = "medidas"

const ProductTabs = ({ product, measureTable = null }: ProductTabsProps) => {
  // "Informações do produto" só existe quando a ficha técnica tem o texto livre (chave `informacoes`,
  // Cockpit → Produto → "Ficha técnica (metadata)"). Sem texto, a aba não aparece (pedido do dono, 13/09).
  // "Medidas e Tamanhos Recomendados" (13/09): a tabela de medidas saiu do corpo da página e virou aba;
  // os links `#medidas` ("Guia de medidas", "Ver tabela de medidas" do recomendador) rolam até aqui
  // e abrem a aba (acordeão controlado + hash).
  const tabs = [
    ...(paragrafosDe(product).length > 0
      ? [{ value: "informacoes", label: "Informações do produto", component: <ProductInfoTab product={product} /> }]
      : []),
    { value: ABA_MEDIDAS, label: "Medidas e Tamanhos Recomendados", component: <SizeGuide table={measureTable} semTitulo /> },
    { value: "envio", label: "Envio e trocas", component: <ShippingInfoTab /> },
  ]

  const [abertas, setAbertas] = useState<string[]>([])
  useEffect(() => {
    const abrirPeloHash = () => {
      if (window.location.hash === `#${ABA_MEDIDAS}`) {
        setAbertas((atual) => (atual.indexOf(ABA_MEDIDAS) === -1 ? atual.concat(ABA_MEDIDAS) : atual))
      }
    }
    abrirPeloHash()
    window.addEventListener("hashchange", abrirPeloHash)
    return () => window.removeEventListener("hashchange", abrirPeloHash)
  }, [])

  return (
    <div className="w-full scroll-mt-24" id={ABA_MEDIDAS}>
      <Accordion type="multiple" value={abertas} onValueChange={setAbertas}>
        {tabs.map((tab) => (
          <Accordion.Item key={tab.value} title={tab.label} headingSize="medium" value={tab.value}>
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

// Parágrafos do texto livre da ficha técnica (separados por linha em branco).
function paragrafosDe(product: HttpTypes.StoreProduct): string[] {
  const informacoes =
    typeof product.metadata?.informacoes === "string" ? product.metadata.informacoes.trim() : ""
  return informacoes ? informacoes.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : []
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  const paragrafos = paragrafosDe(product)
  return (
    <div className="text-small-regular py-8">
      <div className="flex flex-col gap-y-3 max-w-prose" data-testid="product-informacoes">
        {paragrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Entrega rastreada</span>
            <p className="max-w-sm">
              Enviamos para todo o Brasil com rastreio. O prazo e o valor do
              frete aparecem no checkout conforme o seu CEP.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">7 dias para se arrepender</span>
            <p className="max-w-sm">
              Você tem 7 dias corridos após receber para desistir da compra
              com reembolso integral (CDC).
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">Troca de tamanho e defeito</span>
            <p className="max-w-sm">
              Troca de tamanho é pelo WhatsApp, conforme o estoque. Defeito de
              fabricação: troca sem custo em até 30 dias.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
