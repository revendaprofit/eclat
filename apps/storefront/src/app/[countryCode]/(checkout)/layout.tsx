import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import ChevronDown from "@modules/common/icons/chevron-down"
import MedusaCTA from "@modules/layout/components/medusa-cta"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-white relative small:min-h-screen">
      <div className="h-16 bg-white border-b ">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="text-small-semi text-ui-fg-base flex items-center gap-x-2 uppercase flex-1 basis-0"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base ">
              Voltar à sacola
            </span>
            <span className="mt-px block small:hidden txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base">
              Voltar
            </span>
          </LocalizedClientLink>
          {/* Mesma logo do cabeçalho da loja — o wordmark em texto não é usado em lugar nenhum. */}
          <LocalizedClientLink href="/" className="flex items-center gap-2" data-testid="store-link" aria-label="use.ÉCLAT — início">
            <Image src="/brand/mark.png" alt="" width={27} height={36} className="h-9 w-auto" />
            <Image src="/brand/wordmark.png" alt="use.ÉCLAT" width={75} height={24} className="h-[22px] w-auto" />
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
      <div className="py-4 w-full flex items-center justify-center">
        <MedusaCTA />
      </div>
    </div>
  )
}
