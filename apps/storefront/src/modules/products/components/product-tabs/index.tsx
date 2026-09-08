"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Informações do produto",
      component: <ProductInfoTab product={product} />,
    },
    {
      label: "Envio e trocas",
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  const composicao =
    typeof product.metadata?.composicao === "string" ? product.metadata.composicao : null
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-2 gap-x-8">
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">Material</span>
            <p>{product.material ? product.material : "-"}</p>
          </div>
          {composicao && (
            <div>
              <span className="font-semibold">Composição</span>
              <p>{composicao}</p>
            </div>
          )}
          <div>
            <span className="font-semibold">Tipo</span>
            <p>{product.type ? product.type.value : "-"}</p>
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">Peso</span>
            <p>{product.weight ? `${product.weight} g` : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Dimensões</span>
            <p>
              {product.length && product.width && product.height
                ? `${product.length}C x ${product.width}L x ${product.height}A`
                : "-"}
            </p>
          </div>
        </div>
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
