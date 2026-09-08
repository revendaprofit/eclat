import { listCollections } from "@lib/data/collections";
import { listRegions } from "@lib/data/regions";
import { getNavigation } from "@lib/data/navigation";
import { Text, clx } from "@modules/common/components/ui";
import { StoreRegion } from "@medusajs/types";

import LocalizedClientLink from "@modules/common/components/localized-client-link";

export default async function Footer() {
  const { collections } = await listCollections({
    fields: "*products",
  });
  // I8: mesma árvore de navegação da barra/menu (getNavigation) — só raízes visíveis
  // (≥1 produto publicado), na ordem de rank, com as filhas de cada uma.
  const regions = await listRegions()
    .then((r: StoreRegion[]) => r)
    .catch(() => [] as StoreRegion[]);
  const countryCode = regions?.[0]?.countries?.[0]?.iso_2 ?? "br";
  const { roots } = await getNavigation(countryCode);

  return (
    <footer className="border-t border-ui-border-base w-full">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-6 xsmall:flex-row items-start justify-between py-40">
          <div>
            <LocalizedClientLink
              href="/"
              className="font-serif text-2xl tracking-wide text-eclat-grafite hover:text-eclat-terracota transition-colors"
            >
              use.ÉCLAT
            </LocalizedClientLink>
          </div>
          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {roots.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  Categorias
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {roots.map((r) => (
                    <li
                      className="flex flex-col gap-2 text-ui-fg-subtle txt-small"
                      key={r.id}
                    >
                      <LocalizedClientLink
                        className={clx(
                          "hover:text-ui-fg-base",
                          r.children.length > 0 && "txt-small-plus"
                        )}
                        href={`/categories/${r.handle}`}
                        data-testid="category-link"
                      >
                        {r.name}
                      </LocalizedClientLink>
                      {r.children.length > 0 && (
                        <ul className="grid grid-cols-1 ml-3 gap-2">
                          {r.children.map((child) => (
                            <li key={child.id}>
                              <LocalizedClientLink
                                className="hover:text-ui-fg-base"
                                href={`/categories/${child.handle}`}
                                data-testid="category-link"
                              >
                                {child.name}
                              </LocalizedClientLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  Coleções
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-ui-fg-base"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base">A Éclat</span>
              <ul className="grid grid-cols-1 gap-y-2 text-ui-fg-subtle txt-small">
                <li>
                  <LocalizedClientLink href="/store" className="hover:text-ui-fg-base">
                    Toda a loja
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/sobre" className="hover:text-ui-fg-base">
                    Sobre a Éclat
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/editorial" className="hover:text-ui-fg-base">
                    Editorial
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/guia-de-medidas" className="hover:text-ui-fg-base">
                    Guia de medidas
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/trocas-e-devolucoes" className="hover:text-ui-fg-base">
                    Trocas e devoluções
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/privacidade" className="hover:text-ui-fg-base">
                    Privacidade
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/account" className="hover:text-ui-fg-base">
                    Minha conta
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full mb-16 justify-between text-ui-fg-muted">
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} use.ÉCLAT. Todos os direitos reservados.
          </Text>
          <Text className="txt-compact-small uppercase tracking-widest text-eclat-terracota">
            A luz da mulher inteira
          </Text>
        </div>
      </div>
    </footer>
  );
}
