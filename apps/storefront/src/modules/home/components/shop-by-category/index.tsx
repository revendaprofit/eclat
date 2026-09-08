import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"
import { getNavigation } from "@lib/data/navigation"
import { getServerPrefs } from "@lib/data/prefs"
import { orderByStyles } from "@lib/util/style-order"

// I6: classes completas (não interpoladas) para o Tailwind não descartar no build — o número
// de colunas do desktop acompanha a quantidade de femininas visíveis (nunca mais colunas que itens).
const SMALL_COLS: Record<number, string> = {
  1: "small:grid-cols-1",
  2: "small:grid-cols-2",
  3: "small:grid-cols-3",
  4: "small:grid-cols-4",
  5: "small:grid-cols-5",
}

// "Compre por peça" (spec §5.4): as categorias femininas visíveis, por rank, com capa.
export default async function ShopByCategory({ countryCode }: { countryCode: string }) {
  const [{ feminine }, prefs] = await Promise.all([getNavigation(countryCode), getServerPrefs()])
  if (!feminine.length) return null
  // spec §10: estilos do wizard primeiro (nunca esconde nada); sem cookie, ordem = rank
  const ordered = orderByStyles(feminine, prefs.estilos)
  const columns = Math.min(ordered.length, 5)
  return (
    <section className="content-container py-12 small:py-16" data-testid="shop-by-category">
      <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite mb-8 text-center">Compre por peça</h2>
      <ul className={clx("grid grid-cols-2 gap-3 small:gap-5", SMALL_COLS[columns])}>
        {ordered.map((c) => (
          <li key={c.id}>
            <LocalizedClientLink href={`/categories/${c.handle}`} className="group block">
              <div className="relative aspect-[3/4] rounded-md overflow-hidden bg-eclat-areia/40">
                {c.image_url ? (
                  <Image src={c.image_url} alt={c.name} fill sizes="(max-width: 1024px) 50vw, 20vw" quality={80} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center font-serif text-4xl text-eclat-grafite/30">{c.name.charAt(0)}</div>
                )}
              </div>
              <p className="mt-2 text-sm uppercase tracking-[0.15em] text-eclat-grafite group-hover:text-eclat-terracota">{c.name}</p>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
