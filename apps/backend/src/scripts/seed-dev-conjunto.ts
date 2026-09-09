import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { BENEFICIO_CONJUNTO_MODULE } from "../modules/beneficio-conjunto"
import { sincronizarPromocao } from "../modules/beneficio-conjunto/sincronizar-promocao"

// === Seed LOCAL de validação — Benefício Conjunto F3 (Vitrine) ===
// Roda com `npx medusa exec ./src/scripts/seed-dev-conjunto.ts` de dentro de apps/backend, com
// DATABASE_URL apontando para o contêiner local (ex.: eclat-pg-test, porta 55432). Cria um
// catálogo mínimo on-brand "Família Blackout": região Brasil/BRL, canal "Loja" + chave publicável,
// categorias raiz tops/shorts/leggings/macaquinhos (+conjuntos), 4 produtos com Tamanho×Cor,
// regra padrão 20% ATIVA (sincronizada com a promoção automática), pares leggings+tops e
// shorts+tops, e um curado "Look Blackout" (top+legging, total_valor). Idempotente — cada bloco
// procura por handle/título antes de criar. NUNCA escreve fora de localhost/127.0.0.1 (ver guarda
// abaixo, que precisa continuar sendo a primeira coisa que a função faz).

const SIZES = ["P", "M", "G"]
const COLORS = ["Verde Exército", "Licor"]
const COLOR_CODE: Record<string, string> = { "Verde Exército": "VEX", Licor: "LIC" }

type ProdutoSeed = { title: string; handle: string; tipo: string; category: string; price: number }

const PRODUTOS: ProdutoSeed[] = [
  { title: "Top Aura Blackout", handle: "top-aura-blackout", tipo: "TOP", category: "tops", price: 189 },
  { title: "Short Eclipse Blackout", handle: "short-eclipse-blackout", tipo: "SHO", category: "shorts", price: 159 },
  { title: "Legging Vértice Blackout", handle: "legging-vertice-blackout", tipo: "LEG", category: "leggings", price: 259 },
  { title: "Macaquinho Nébula Blackout", handle: "macaquinho-nebula-blackout", tipo: "MAC", category: "macaquinhos", price: 299 },
]

// Categorias raiz do par leggings+tops e shorts+tops, + "conjuntos" (categoria da própria vitrine
// de conjuntos, sem produto associado neste seed).
const CATEGORIAS = ["tops", "shorts", "leggings", "macaquinhos", "conjuntos"]

export default async function seedDevConjunto({ container }: ExecArgs) {
  // ---------- GUARDA: nunca roda fora de um Postgres local. Precisa ser a primeira coisa. ----------
  // Compara o HOST da URL, não a string inteira: um `includes("localhost")` aceitaria
  // `postgres://user:senha@prod.exemplo.com/localhost_db` ou um usuário chamado "localhost".
  const dbUrl = process.env.DATABASE_URL ?? ""
  let host: string | null = null
  try {
    host = new URL(dbUrl).hostname
  } catch {
    host = null
  }
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.log("recusado: DATABASE_URL não é local")
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeModuleService: any = container.resolve(Modules.STORE)
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)

  logger.info(`[conjunto-dev] Rodando contra ${dbUrl.replace(/:[^:@]+@/, ":***@")}`)

  // ---------- MOEDA BRL NA LOJA (necessária p/ calculated_price aparecer na região Brasil) ----------
  // Via query.graph (não `listStores()`) para pegar `is_default` de cada moeda existente — sem
  // isso o update perderia a moeda default atual e o módulo Store rejeitaria a escrita.
  const { data: lojas } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
  })
  const loja = lojas[0]
  const moedasAtuais = (loja.supported_currencies ?? []).map((c: any) => c.currency_code)
  if (!moedasAtuais.includes("brl")) {
    await storeModuleService.updateStores(loja.id, {
      supported_currencies: [
        ...(loja.supported_currencies ?? []).map((c: any) => ({ currency_code: c.currency_code, is_default: c.is_default })),
        { currency_code: "brl", is_default: false },
      ],
    })
    logger.info("[conjunto-dev] BRL adicionada às moedas suportadas da loja.")
  }

  // ---------- REGIÃO BRASIL ----------
  const { data: regioesExistentes } = await query.graph({ entity: "region", fields: ["id", "name", "currency_code"] })
  let regiaoBrasil = regioesExistentes.find((r: any) => r.name === "Brasil" && r.currency_code === "brl")
  if (!regiaoBrasil) {
    const { result } = await createRegionsWorkflow(container).run({
      input: { regions: [{ name: "Brasil", currency_code: "brl", countries: ["br"], payment_providers: ["pp_system_default"] }] },
    })
    regiaoBrasil = result[0]
    logger.info(`[conjunto-dev] Região Brasil criada: ${regiaoBrasil.id}`)
  } else {
    logger.info(`[conjunto-dev] Região Brasil reaproveitada: ${regiaoBrasil.id}`)
  }

  // ---------- CANAL "Loja" + CHAVE PUBLICÁVEL ----------
  const { data: canaisExistentes } = await query.graph({ entity: "sales_channel", fields: ["id", "name"] })
  let canalLoja = canaisExistentes.find((c: any) => c.name === "Loja")
  if (!canalLoja) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Loja", description: "Canal da vitrine — seed de validação F3 (Benefício Conjunto)" }] },
    })
    canalLoja = result[0]
    logger.info(`[conjunto-dev] Canal "Loja" criado: ${canalLoja.id}`)
  } else {
    logger.info(`[conjunto-dev] Canal "Loja" reaproveitado: ${canalLoja.id}`)
  }

  const { data: chavesExistentes } = await query.graph({ entity: "api_key", fields: ["id", "title", "token", "type"] })
  let chave = chavesExistentes.find((k: any) => k.title === "Loja — dev conjunto F3")
  if (!chave) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Loja — dev conjunto F3", type: "publishable", created_by: "" }] },
    })
    chave = result[0]
    await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: chave.id, add: [canalLoja.id] } })
    logger.info(`[conjunto-dev] Chave publicável criada e vinculada ao canal "Loja".`)
  } else {
    logger.info(`[conjunto-dev] Chave publicável reaproveitada.`)
  }

  // ---------- CATEGORIAS RAIZ ----------
  const { data: categoriasExistentes } = await query.graph({ entity: "product_category", fields: ["id", "handle"] })
  const categoriasFaltantes = CATEGORIAS.filter((handle) => !categoriasExistentes.some((c: any) => c.handle === handle))
  if (categoriasFaltantes.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: categoriasFaltantes.map((handle) => ({
          name: handle[0].toUpperCase() + handle.slice(1),
          handle,
          is_active: true,
        })),
      },
    })
    logger.info(`[conjunto-dev] Categorias criadas: ${categoriasFaltantes.join(", ")}`)
  } else {
    logger.info("[conjunto-dev] Categorias raiz já existiam.")
  }
  const { data: categoriasAtuais } = await query.graph({ entity: "product_category", fields: ["id", "handle"] })
  const catId = (handle: string) => categoriasAtuais.find((c: any) => c.handle === handle)!.id

  // ---------- COLEÇÃO "Família Blackout" ----------
  const { data: colecoesExistentes } = await query.graph({ entity: "product_collection", fields: ["id", "handle"] })
  let colecao = colecoesExistentes.find((c: any) => c.handle === "familia-blackout")
  if (!colecao) {
    const { result } = await createCollectionsWorkflow(container).run({
      input: { collections: [{ title: "Família Blackout", handle: "familia-blackout" }] },
    })
    colecao = result[0]
    logger.info(`[conjunto-dev] Coleção "Família Blackout" criada: ${colecao.id}`)
  } else {
    logger.info(`[conjunto-dev] Coleção "Família Blackout" reaproveitada: ${colecao.id}`)
  }

  // ---------- PRODUTOS ----------
  const { data: shippingProfiles } = await query.graph({ entity: "shipping_profile", fields: ["id"] })
  const shippingProfile = shippingProfiles[0]

  const { data: produtosExistentes } = await query.graph({ entity: "product", fields: ["id", "handle"] })
  const produtosFaltantes = PRODUTOS.filter((p) => !produtosExistentes.some((e: any) => e.handle === p.handle))
  if (produtosFaltantes.length) {
    const productsInput = produtosFaltantes.map((p) => ({
      title: p.title,
      handle: p.handle,
      description: `${p.title} — peça da Família Blackout, use.ÉCLAT.`,
      status: ProductStatus.PUBLISHED,
      category_ids: [catId(p.category)],
      collection_id: colecao.id,
      shipping_profile_id: shippingProfile?.id,
      weight: 300,
      options: [
        { title: "Tamanho", values: SIZES },
        { title: "Cor", values: COLORS },
      ],
      variants: COLORS.flatMap((cor) =>
        SIZES.map((tam) => ({
          title: `${tam} / ${cor}`,
          sku: `BLK-${p.tipo}-${COLOR_CODE[cor]}-${tam}`,
          manage_inventory: false,
          options: { Tamanho: tam, Cor: cor },
          prices: [{ amount: p.price, currency_code: "brl" }],
        }))
      ),
      sales_channels: [{ id: canalLoja.id }],
    }))
    await createProductsWorkflow(container).run({ input: { products: productsInput } })
    logger.info(`[conjunto-dev] Produtos criados: ${produtosFaltantes.map((p) => p.handle).join(", ")}`)
  } else {
    logger.info("[conjunto-dev] Produtos já existiam — nada criado.")
  }
  const { data: produtosAtuais } = await query.graph({ entity: "product", fields: ["id", "handle"] })
  const prodId = (handle: string) => produtosAtuais.find((p: any) => p.handle === handle)!.id

  // ---------- REGRA PADRÃO 20% ATIVA ----------
  const [regraPadrao] = await svc.listConjuntoRegras({ escopo: "padrao" })
  let regraPadraoId: string
  if (!regraPadrao) {
    const nova = await svc.createConjuntoRegras({
      nome: "Padrão — Família Blackout (seed dev)",
      escopo: "padrao",
      collection_id: null,
      tipo_desconto: "menor_peca_percentual",
      valor: 20,
      ativa: true,
    })
    regraPadraoId = nova.id
    logger.info(`[conjunto-dev] Regra padrão criada: ${regraPadraoId}`)
  } else {
    regraPadraoId = regraPadrao.id
    if (regraPadrao.tipo_desconto !== "menor_peca_percentual" || regraPadrao.valor !== 20 || !regraPadrao.ativa) {
      await svc.updateConjuntoRegras({ id: regraPadraoId, tipo_desconto: "menor_peca_percentual", valor: 20, ativa: true })
      logger.info(`[conjunto-dev] Regra padrão ajustada/reativada: ${regraPadraoId}`)
    } else {
      logger.info(`[conjunto-dev] Regra padrão já estava correta: ${regraPadraoId}`)
    }
  }
  await sincronizarPromocao(container, regraPadraoId)

  // ---------- PARES ----------
  async function garantirPar(categoriaA: string, categoriaB: string) {
    const [a, b] = [categoriaA, categoriaB].sort()
    const existentes = await svc.listConjuntoPars({})
    const jaExiste = existentes.find((p: any) => p.categoria_a === a && p.categoria_b === b)
    if (jaExiste) {
      if (!jaExiste.ativo) {
        await svc.updateConjuntoPars({ id: jaExiste.id, ativo: true })
        logger.info(`[conjunto-dev] Par ${a}+${b} estava inativo — reativado.`)
      } else {
        logger.info(`[conjunto-dev] Par ${a}+${b} já existia.`)
      }
      return
    }
    await svc.criarPar({ categoria_a: categoriaA, categoria_b: categoriaB, ativo: true })
    logger.info(`[conjunto-dev] Par ${a}+${b} criado.`)
  }
  await garantirPar("leggings", "tops")
  await garantirPar("shorts", "tops")

  // ---------- CURADO "Look Blackout" (top + legging, total_valor R$ 45,00) ----------
  const [curadoExistente] = await svc.listConjuntoCurados({ handle: "look-blackout" })
  if (!curadoExistente) {
    const regraCurado = await svc.createConjuntoRegras({
      nome: "Look Blackout",
      escopo: "curado",
      collection_id: null,
      tipo_desconto: "total_valor",
      valor: 4500,
      ativa: true,
    })
    await svc.createConjuntoCurados({
      nome: "Look Blackout",
      handle: "look-blackout",
      capa_url: null,
      product_ids: [prodId("top-aura-blackout"), prodId("legging-vertice-blackout")],
      regra_id: regraCurado.id,
      ativo: true,
      ordem: 0,
    })
    await sincronizarPromocao(container, regraCurado.id)
    logger.info(`[conjunto-dev] Curado "Look Blackout" criado (regra ${regraCurado.id}).`)
  } else {
    await sincronizarPromocao(container, curadoExistente.regra_id)
    logger.info(`[conjunto-dev] Curado "Look Blackout" já existia — promoção resincronizada.`)
  }

  // ---------- RESUMO ----------
  logger.info("[conjunto-dev] Seed concluído.")
  console.log("")
  console.log("=== Seed dev — Benefício Conjunto F3 (Família Blackout) ===")
  console.log(`Região Brasil: ${regiaoBrasil.id}`)
  console.log(`Canal "Loja": ${canalLoja.id}`)
  console.log(`Coleção "Família Blackout": ${colecao.id} (${colecao.handle})`)
  console.log(`Categorias: ${CATEGORIAS.join(", ")}`)
  console.log(`Produtos: ${PRODUTOS.map((p) => `${p.handle} (${p.category}, R$ ${p.price.toFixed(2)})`).join(" · ")}`)
  console.log(`Regra padrão (menor_peca_percentual 20%, ativa): ${regraPadraoId}`)
  console.log(`Pares: leggings+tops, shorts+tops`)
  console.log(`Curado: look-blackout (total_valor R$ 45,00)`)
  console.log(`Publishable key: ${chave.token}`)
  console.log("=============================================================")
}
