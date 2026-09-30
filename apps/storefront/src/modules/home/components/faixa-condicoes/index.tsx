import { getCondicoesDaLoja } from "@lib/data/condicoes"
import { fraseCartao, fraseFreteGratis, frasePix, reais } from "@lib/util/condicoes"
import { IconeCondicao, type NomeIconeCondicao as NomeIcone } from "@modules/common/components/icones-condicoes"

// Faixa de condições logo abaixo do banner da home (referência: beatco.com.br, relatório de
// 2026-09-30). Responde "é seguro comprar aqui?" antes de a cliente rolar até os produtos.
// Os textos saem da mesma fonte da barra do topo (lib/util/condicoes.ts).

type Item = { icone: NomeIcone; titulo: string; texto: string }

export default async function FaixaCondicoes() {
  const { condicoes, cupom, pisos } = await getCondicoesDaLoja()
  const frete = fraseFreteGratis(pisos, (c) => reais(c, { curto: true }))

  const itens: Item[] = [
    ...(cupom
      ? [{ icone: "cupom" as const, titulo: `${cupom.percentual}% OFF na 1ª compra`, texto: `Use o cupom ${cupom.codigo}` }]
      : []),
    { icone: "cartao", titulo: fraseCartao(condicoes), texto: "Pagamento seguro pelo Mercado Pago" },
    {
      icone: "pix",
      titulo: frasePix(condicoes),
      texto: condicoes.pix_percentual > 0 ? "Aplicado ao escolher Pix no pagamento" : "Aprovação na hora",
    },
    { icone: "troca", titulo: "Troca em 7 dias", texto: "Troca de tamanho pelo WhatsApp" },
    { icone: "envio", titulo: "Envio para todo o Brasil", texto: frete ?? "Rastreado do CD até você" },
  ]

  return (
    <section aria-label="Condições de compra" className="border-b border-eclat-pedra/30 bg-eclat-luz" data-testid="faixa-condicoes">
      <ul className="content-container flex gap-3 overflow-x-auto snap-x snap-mandatory py-4 no-scrollbar small:grid small:grid-cols-5 small:gap-4 small:overflow-visible small:py-5">
        {itens.map((item) => (
          <li
            key={item.titulo}
            className="snap-start shrink-0 w-[72%] xsmall:w-[46%] small:w-auto flex items-center gap-3 rounded-rounded bg-eclat-areia/40 px-4 py-3"
          >
            <IconeCondicao nome={item.icone} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-eclat-grafite leading-snug">{item.titulo}</span>
              <span className="block text-xs text-eclat-grafite/70 leading-snug">{item.texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
