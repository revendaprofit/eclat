import { getCondicoesDaLoja } from "@lib/data/condicoes"
import { frasesDaBarra, reais } from "@lib/util/condicoes"
import Rotativo from "./rotativo"

// Barra fina acima da navegação com as condições da loja (cupom de 1ª compra, cartão, Pix, frete).
// Referência: beatco.com.br (relatório de 2026-09-30). Desktop mostra tudo numa linha; no celular
// as frases se revezam. Quem liga/desliga cada frase é a fonte de verdade de cada uma
// (site_content "condicoes" e "boas_vindas", pisos do backend), então a barra nunca promete
// uma condição que o checkout não cumpre.
export default async function BarraCondicoes() {
  const loja = await getCondicoesDaLoja()
  const frases = frasesDaBarra({ ...loja, fmt: (c) => reais(c, { curto: true }) })
  if (frases.length === 0) return null
  return (
    <div
      className="bg-eclat-terracota text-eclat-luz text-xs small:text-[13px] tracking-wide"
      data-testid="barra-condicoes"
    >
      <p className="hidden small:block text-center px-4 py-2">
        {frases.map((f, i) => (
          <span key={f}>
            {i > 0 && <span aria-hidden className="mx-3 opacity-60">·</span>}
            <span className={i === 0 && loja.cupom ? "font-semibold" : undefined}>{f}</span>
          </span>
        ))}
      </p>
      <Rotativo frases={frases} destaquePrimeira={!!loja.cupom} />
    </div>
  )
}
