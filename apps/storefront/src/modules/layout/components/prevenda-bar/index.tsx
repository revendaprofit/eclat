import { getPrevenda, fraseEnvios, frasePagamento, linkClubeWhatsapp } from "@lib/data/prevenda"

// Barra fina no topo (acima da navegação) enquanto a pré-venda estiver ativa.
// Some sozinha quando o Cockpit desligar a pré-venda. Traz a porta de entrada do
// Clube Éclat, já que a página "Em breve" (que tinha o botão) não aparece com a loja aberta.
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
      <span> · </span>
      <a
        href={linkClubeWhatsapp(p)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 font-semibold hover:text-white"
        data-testid="prevenda-clube"
      >
        Entrar no Clube Éclat
      </a>
    </div>
  )
}
