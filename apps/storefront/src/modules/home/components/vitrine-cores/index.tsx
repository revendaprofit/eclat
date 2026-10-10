import type { HttpTypes } from "@medusajs/types"
import { listProducts } from "@lib/data/products"
import { getColorMap } from "@lib/data/colors"
import { DEFAULT_FILTERS } from "@lib/util/catalog-filters"
import { entradasPorCor, entryKey, type ListingEntry } from "@lib/util/listagem-cores"
import { normalizeColorName, resolveColor } from "@lib/util/colors"
import { isProductAvailable, type StockVariant } from "@lib/util/availability"
import ProductPreview from "@modules/products/components/product-preview"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Abas, { type Aba } from "../abas"

// "Escolha a cor. O resto é Lumière." (referência bechose.com.br, 2026-10-10): uma aba por cor do
// catálogo, com as peças daquela cor. Nasce do "um card por cor" que a vitrine já faz.
const MAX = 8

export default async function VitrineCores({ region, countryCode }: { region: HttpTypes.StoreRegion; countryCode: string }) {
  const [{ response }, colorMap] = await Promise.all([listProducts({ countryCode, regionId: region.id, queryParams: { limit: 100 } }), getColorMap()])
  const disponiveis = response.products.filter((p) => isProductAvailable((p.variants ?? []) as StockVariant[]))
  const entradas = entradasPorCor(disponiveis, DEFAULT_FILTERS, true).filter((e) => e.cor)
  // Cores na ordem em que aparecem no catálogo; só as que têm pelo menos 2 peças (uma aba com 1 card não é vitrine).
  const porCor = new Map<string, ListingEntry[]>()
  for (const e of entradas) {
    const k = normalizeColorName(e.cor as string)
    if (!porCor.has(k)) porCor.set(k, [])
    porCor.get(k)!.push(e)
  }
  const abas: Aba[] = []
  for (const lista of Array.from(porCor.values())) {
    if (lista.length < 2) continue
    const nome = resolveColor(colorMap, lista[0].cor as string).name
    abas.push({
      id: normalizeColorName(nome),
      rotulo: nome,
      painel: (
        <ul className="grid grid-cols-2 small:grid-cols-4 gap-x-4 gap-y-10 small:gap-x-6 small:gap-y-12">
          {lista.slice(0, MAX).map((e) => (
            <li key={entryKey(e)}>
              <ProductPreview product={e.product} cor={e.cor} region={region} listName={`Home · Cor ${nome}`} />
            </li>
          ))}
        </ul>
      ),
    })
  }
  if (abas.length < 2) return null

  return (
    <section className="bg-eclat-areia/30 border-y border-eclat-pedra/30">
      <div className="content-container py-12 small:py-20" data-testid="vitrine-cores">
        <div className="flex flex-col small:flex-row small:items-end small:justify-between gap-4 mb-6">
          <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite text-balance">
            Escolha a cor. <span className="italic text-eclat-terracota">O resto é Lumière.</span>
          </h2>
          <LocalizedClientLink href="/collections/lumiere" className="text-xs uppercase tracking-[0.18em] text-eclat-grafite underline underline-offset-4 hover:text-eclat-terracota">
            Ver a coleção →
          </LocalizedClientLink>
        </div>
        <Abas abas={abas} nomeDaLista="cores" />
      </div>
    </section>
  )
}
