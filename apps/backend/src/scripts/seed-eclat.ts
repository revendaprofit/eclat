import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteCollectionsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
  deleteRegionsWorkflow,
  deleteShippingOptionsWorkflow,
  deleteStockLocationsWorkflow,
  deleteTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

// === Catálogo use.ÉCLAT — Parte 1 (Data-First). Schema: architecture/catalog.md ===
// Limpa a demo (produtos + Europa/EUR) e cria estrutura Brasil/BRL + produtos-exemplo on-brand.
// Reexecutável: zera produtos/região e recria. Reaproveita o Default Sales Channel (chave da vitrine).

const SIZES = ["P", "M", "G", "GG"]
const COLOR_CODE: Record<string, string> = {
  Preto: "PRT",
  Areia: "ARE",
  Vinho: "VIN",
  "Verde Musgo": "MUS",
}

type EclatProduct = {
  title: string
  handle: string
  tipo: string // 3 letras p/ SKU
  category: string
  collection: string
  description: string
  colors: string[]
  price: number // em BRL decimal (contrato do Medusa). Ex.: 199.90
  metadata: Record<string, string>
}

const CATEGORIES = [
  "Leggings",
  "Tops & Sutiãs",
  "Shorts",
  "Calças",
  "Blusas & Cropped",
  "Macacões",
  "Conjuntos",
  "Casacos & Jaquetas",
]

const COLLECTIONS = [
  { title: "Resplendor", handle: "resplendor" },
  { title: "Luz Primeira", handle: "luz-primeira" },
]

const PRODUCTS: EclatProduct[] = [
  {
    title: "Legging Resplendor",
    handle: "legging-resplendor",
    tipo: "LEG",
    category: "Leggings",
    collection: "Resplendor",
    description:
      "Legging de cintura alta em compressão firme que sustenta e valoriza. Tecido encorpado, opaco e respirável — para treinar e viver com a luz da mulher inteira.",
    colors: ["Preto", "Areia"],
    price: 199.9,
    metadata: {
      composicao: "78% poliamida, 22% elastano",
      compressao: "alta",
      caimento: "justo",
      cuidados: "Lavar à mão ou ciclo delicado. Não usar secadora. Não passar.",
      modelo_veste: "Modelo 1,70 m veste M",
      guia_medidas: "P: 36-38 · M: 40-42 · G: 44-46 · GG: 48-50",
    },
  },
  {
    title: "Top Aurora",
    handle: "top-aurora",
    tipo: "TOP",
    category: "Tops & Sutiãs",
    collection: "Resplendor",
    description:
      "Top com sustentação média e bojo removível. Alças ajustáveis e acabamento premium para conforto do treino ao dia.",
    colors: ["Preto", "Vinho"],
    price: 129.9,
    metadata: {
      composicao: "82% poliamida, 18% elastano",
      compressao: "media",
      caimento: "justo",
      cuidados: "Lavar à mão. Não usar secadora. Secar à sombra.",
      modelo_veste: "Modelo 1,70 m veste M",
      guia_medidas: "P: 36-38 · M: 40-42 · G: 44-46 · GG: 48-50",
    },
  },
  {
    title: "Short Solene",
    handle: "short-solene",
    tipo: "SHO",
    category: "Shorts",
    collection: "Luz Primeira",
    description:
      "Short de compressão com cintura alta e modelagem que não sobe. Leveza e cobertura para movimentos de alta intensidade.",
    colors: ["Preto"],
    price: 149.9,
    metadata: {
      composicao: "80% poliamida, 20% elastano",
      compressao: "alta",
      caimento: "justo",
      cuidados: "Lavar à mão ou ciclo delicado. Não usar alvejante.",
      modelo_veste: "Modelo 1,70 m veste M",
      guia_medidas: "P: 36-38 · M: 40-42 · G: 44-46 · GG: 48-50",
    },
  },
  {
    title: "Conjunto Luz",
    handle: "conjunto-luz",
    tipo: "CON",
    category: "Conjuntos",
    collection: "Luz Primeira",
    description:
      "Conjunto cropped + legging em malha canelada com toque acetinado. Visual coordenado, elegante e confortável.",
    colors: ["Areia"],
    price: 329.9,
    metadata: {
      composicao: "85% poliamida, 15% elastano",
      compressao: "media",
      caimento: "regular",
      cuidados: "Lavar à mão. Não usar secadora. Não passar sobre estampas.",
      modelo_veste: "Modelo 1,70 m veste M",
      guia_medidas: "P: 36-38 · M: 40-42 · G: 44-46 · GG: 48-50",
    },
  },
]

export default async function seedEclat({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const storeModuleService = container.resolve(Modules.STORE)

  // ---------- LIMPEZA DA DEMO ----------
  logger.info("[éclat] Limpando dados demo (produtos, Europa/EUR)...")

  const { data: oldProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
  })
  if (oldProducts.length) {
    await deleteProductsWorkflow(container).run({
      input: { ids: oldProducts.map((p) => p.id) },
    })
    logger.info(`[éclat] Removidos ${oldProducts.length} produtos.`)
  }

  const { data: oldCategories } = await query.graph({
    entity: "product_category",
    fields: ["id"],
  })
  if (oldCategories.length) {
    await deleteProductCategoriesWorkflow(container).run({
      input: oldCategories.map((c) => c.id),
    })
  }

  const { data: oldCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id"],
  })
  if (oldCollections.length) {
    await deleteCollectionsWorkflow(container).run({
      input: { ids: oldCollections.map((c) => c.id) },
    })
  }

  const { data: oldShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
  })
  if (oldShippingOptions.length) {
    await deleteShippingOptionsWorkflow(container).run({
      input: { ids: oldShippingOptions.map((s) => s.id) },
    })
  }

  const { data: oldFulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id"],
  })
  if (oldFulfillmentSets.length) {
    await fulfillmentModuleService.deleteFulfillmentSets(
      oldFulfillmentSets.map((f) => f.id)
    )
  }

  const { data: oldRegions } = await query.graph({
    entity: "region",
    fields: ["id"],
  })
  if (oldRegions.length) {
    await deleteRegionsWorkflow(container).run({
      input: { ids: oldRegions.map((r) => r.id) },
    })
  }

  const { data: oldTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
  })
  if (oldTaxRegions.length) {
    await deleteTaxRegionsWorkflow(container).run({
      input: { ids: oldTaxRegions.map((t) => t.id) },
    })
  }

  const { data: oldStockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  if (oldStockLocations.length) {
    await deleteStockLocationsWorkflow(container).run({
      input: { ids: oldStockLocations.map((s) => s.id) },
    })
  }

  // ---------- LOJA: moeda BRL ----------
  const [store] = await storeModuleService.listStores()
  await storeModuleService.updateStores(store.id, {
    supported_currencies: [{ currency_code: "brl", is_default: true }],
  })
  logger.info("[éclat] Loja configurada para BRL (default).")

  // Sales channel da vitrine (não recriar — a publishable key aponta para ele)
  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const defaultSalesChannel =
    salesChannels.find((s) => s.name === "Default Sales Channel") ||
    salesChannels[0]

  // ---------- REGIÃO BRASIL ----------
  logger.info("[éclat] Criando região Brasil/BRL...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Brasil",
          currency_code: "brl",
          countries: ["br"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const region = regionResult[0]

  await createTaxRegionsWorkflow(container).run({
    input: [{ country_code: "br", provider_id: "tp_system" }],
  })

  // ---------- ESTOQUE + FULFILLMENT (Brasil) ----------
  logger.info("[éclat] Criando CD Brasil e fulfillment...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "CD Brasil",
          address: { city: "São Paulo", country_code: "BR", address_1: "" },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Entregas Brasil",
    type: "shipping",
    service_zones: [
      {
        name: "Brasil",
        geo_zones: [{ country_code: "br", type: "country" }],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Entrega Padrão",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Padrão",
          description: "Entrega em 5-8 dias úteis.",
          code: "standard",
        },
        prices: [{ currency_code: "brl", amount: 24.9 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultSalesChannel.id] },
  })

  // ---------- CATEGORIAS + COLEÇÕES ----------
  logger.info("[éclat] Criando categorias e coleções...")
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: CATEGORIES.map((name) => ({
        name,
        is_active: true,
      })),
    },
  })
  const catId = (name: string) =>
    categoryResult.find((c) => c.name === name)!.id

  const { result: collectionResult } = await createCollectionsWorkflow(
    container
  ).run({
    input: { collections: COLLECTIONS.map((c) => ({ title: c.title, handle: c.handle })) },
  })
  const collId = (title: string) =>
    collectionResult.find((c) => c.title === title)!.id

  // ---------- PRODUTOS ----------
  logger.info("[éclat] Criando produtos-exemplo on-brand...")
  const productsInput = PRODUCTS.map((p) => {
    const variants = p.colors.flatMap((color) =>
      SIZES.map((size) => ({
        title: `${size} / ${color}`,
        sku: `ECL-${p.tipo}-${p.handle.split("-")[1]?.toUpperCase() ?? "X"}-${
          COLOR_CODE[color] ?? "XXX"
        }-${size}`,
        options: { Tamanho: size, Cor: color },
        prices: [{ amount: p.price, currency_code: "brl" }],
      }))
    )

    return {
      title: p.title,
      handle: p.handle,
      description: p.description,
      status: ProductStatus.PUBLISHED,
      category_ids: [catId(p.category)],
      collection_id: collId(p.collection),
      shipping_profile_id: shippingProfile.id,
      weight: 300,
      metadata: p.metadata,
      options: [
        { title: "Tamanho", values: SIZES },
        { title: "Cor", values: p.colors },
      ],
      variants,
      sales_channels: [{ id: defaultSalesChannel.id }],
    }
  })

  await createProductsWorkflow(container).run({
    input: { products: productsInput },
  })

  // ---------- ESTOQUE INICIAL ----------
  logger.info("[éclat] Definindo níveis de estoque...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 100,
        inventory_item_id: item.id,
      })),
    },
  })

  logger.info(
    `[éclat] Catálogo pronto: ${PRODUCTS.length} produtos, ${CATEGORIES.length} categorias, ${COLLECTIONS.length} coleções, região Brasil/BRL.`
  )
}
