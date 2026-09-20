import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button } from "@modules/common/components/ui"

const EmptyCartMessage = () => {
  return (
    <div className="py-24 small:py-36 flex flex-col items-center text-center" data-testid="empty-cart-message">
      <span className="text-[10px] uppercase tracking-[0.3em] text-eclat-terracota">Sacola</span>
      <h1 className="mt-3 font-serif text-4xl small:text-5xl text-eclat-grafite">Ainda vazia</h1>
      <p className="mt-4 max-w-sm text-eclat-grafite/70">Escolha suas peças e elas ficam guardadas aqui até você finalizar.</p>
      <LocalizedClientLink href="/store" className="mt-8">
        <Button className="h-12 px-8 uppercase tracking-[0.18em] text-xs">Ver as peças</Button>
      </LocalizedClientLink>
    </div>
  )
}

export default EmptyCartMessage
