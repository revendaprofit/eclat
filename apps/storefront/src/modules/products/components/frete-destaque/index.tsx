import { casasDoValor, destaqueDoFrete, type RegrasDeFrete } from "@lib/util/frete"
import { convertToLocale } from "@lib/util/money"

const reais = (centavos: number) =>
  convertToLocale({ amount: centavos / 100, currency_code: "brl", minimumFractionDigits: casasDoValor(centavos), maximumFractionDigits: casasDoValor(centavos) })

// Frete em destaque na página do produto, antes do preço (sócia, 27/10/2026). O diagnóstico do funil mostrou que
// o frete só aparecia no fim, depois de CEP; a condição é boa (MG grátis a partir de uma peça) e tem que ser
// a primeira coisa que a cliente lê perto do preço. Some se o backend não expõe as regras.
export default function FreteDestaque({ precoCentavos, regras }: { precoCentavos: number; regras: RegrasDeFrete | null }) {
  const d = destaqueDoFrete(precoCentavos, regras, reais)
  if (!d) return null
  return (
    <div className="flex items-start gap-x-3 border-l-2 border-eclat-terracota bg-eclat-blush-claro/40 px-3 py-2" data-testid="frete-destaque">
      <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-eclat-terracota" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </svg>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-eclat-grafite">{d.titulo}</span>
        {d.detalhe && <span className="text-xs text-eclat-grafite/65">{d.detalhe}</span>}
      </div>
    </div>
  )
}
