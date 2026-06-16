import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { listCategories } from "@lib/data/categories"
import { StoreRegion, HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import SearchBar from "@modules/layout/components/search-bar"
import MainMenu from "@modules/layout/components/main-menu"

export default async function Nav() {
  const [regions, locales, currentLocale, categories] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listCategories().catch(() => [] as HttpTypes.StoreProductCategory[]),
  ])

  // linhas de topo (Treino, Casual…) com subcategorias, para o menu mobile
  const lines = (categories || []).filter(
    (c) => !c.parent_category && (c.category_children?.length ?? 0) > 0
  )

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative h-16 mx-auto border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between w-full h-full text-small-regular">
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} lines={lines} />
            </div>
          </div>

          <div className="flex items-center h-full">
            <LocalizedClientLink
              href="/"
              className="font-serif text-2xl leading-none tracking-wide text-eclat-grafite hover:text-eclat-dourado transition-colors"
              data-testid="nav-store-link"
            >
              use.ÉCLAT
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <MainMenu />
              <LocalizedClientLink
                className="hover:text-eclat-dourado transition-colors"
                href="/account"
                data-testid="nav-account-link"
              >
                Conta
              </LocalizedClientLink>
            </div>
            <SearchBar />
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-eclat-dourado transition-colors flex items-center"
                  href="/cart"
                  data-testid="nav-cart-link"
                  aria-label="Sacola"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M6 8h12l-1 12H7L6 8z" />
                    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                  </svg>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
