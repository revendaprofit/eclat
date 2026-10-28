// Barra "faltam R$ X para frete grátis" (spec §4.6). Sem endereço, vale o piso do Brasil e a linha
// de baixo avisa do piso menor de MG. Some se o backend ainda não expõe /store/frete/regras.
import { convertToLocale } from "@lib/util/money"
import { baseDoCarrinho, casasDoValor, progressoFreteGratis, type RegrasDeFrete } from "@lib/util/frete"
import { HttpTypes } from "@medusajs/types"

const reais = (centavos: number, moeda: string) => {
  const casas = casasDoValor(centavos)
  return convertToLocale({
    amount: centavos / 100,
    currency_code: moeda,
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

const FreteGratisBarra = ({ cart, regras }: { cart: HttpTypes.StoreCart; regras: RegrasDeFrete | null }) => {
  if (!regras) return null
  const uf = cart.shipping_address?.province
  const base = baseDoCarrinho(cart)
  const p = progressoFreteGratis(base, uf, regras)
  // 27/10 (sócia): fora de MG, frete pela metade a partir de `metade_brasil`; MG fica grátis a partir de uma peça.
  const sigla = (uf ?? "").trim().toUpperCase().replace(/^BR-/, "")
  const metade = regras.metade_brasil ?? 0
  const foraDeMg = !!sigla && sigla !== "MG"
  const metadeAtingida = foraDeMg && metade > 0 && base >= metade

  return (
    <div className="flex flex-col gap-y-2" data-testid="frete-gratis-barra">
      <span className="text-small-regular text-ui-fg-base">
        {p.atingiu ? (
          <>Você ganhou <strong>frete grátis</strong>.</>
        ) : metadeAtingida ? (
          <>Seu frete já sai <strong>pela metade</strong>. Faltam <strong>{reais(p.falta, cart.currency_code)}</strong> para o frete grátis.</>
        ) : (
          <>Faltam <strong>{reais(p.falta, cart.currency_code)}</strong> para o frete grátis.</>
        )}
      </span>
      <div
        className="h-1.5 w-full rounded-full bg-eclat-blush overflow-hidden"
        role="progressbar"
        aria-label="Progresso para o frete grátis"
        aria-valuenow={p.percentual}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-eclat-terracota transition-all" style={{ width: `${p.percentual}%` }} />
      </div>
      {!uf && !p.atingiu && (
        <span className="text-xsmall-regular text-ui-fg-muted">
          {metade > 0
            ? `Em MG, frete grátis a partir de ${reais(regras.piso_mg, cart.currency_code)} · nos demais estados, pela metade a partir de ${reais(metade, cart.currency_code)} e grátis a partir de ${reais(regras.piso_brasil, cart.currency_code)}.`
            : `Frete grátis a partir de ${reais(regras.piso_brasil, cart.currency_code)} · em MG, a partir de ${reais(regras.piso_mg, cart.currency_code)}.`}
        </span>
      )}
      {foraDeMg && metade > 0 && !metadeAtingida && !p.atingiu && (
        <span className="text-xsmall-regular text-ui-fg-muted">A partir de {reais(metade, cart.currency_code)} o frete sai pela metade.</span>
      )}
    </div>
  )
}

export default FreteGratisBarra
