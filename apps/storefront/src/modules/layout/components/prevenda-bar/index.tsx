import { getPrevenda, fraseEnvios, frasePagamento } from "@lib/data/prevenda"

// Barra fina no topo (acima da navegação) enquanto a pré-venda estiver ativa.
// Some sozinha quando o Cockpit desligar a pré-venda.
export default async function PrevendaBar() {
  const p = await getPrevenda()
  if (!p.ativa) return null
  return (
    <div
      className="bg-eclat-terracota text-eclat-luz text-center text-xs small:text-sm tracking-wide px-4 py-2"
      data-testid="prevenda-bar"
    >
      <span className="font-semibold">{fraseEnvios(p)}</span>
      <span className="hidden small:inline"> · {frasePagamento(p)}</span>
    </div>
  )
}
