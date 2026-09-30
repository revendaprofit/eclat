import type { CondicoesDaLoja } from "@lib/data/condicoes"
import { fraseCartao, fraseFreteGratis, frasePix, reais } from "@lib/util/condicoes"
import { IconeCondicao, type NomeIconeCondicao } from "@modules/common/components/icones-condicoes"

// Lista de condições colada no botão de compra (referência beatco.com.br, relatório de 2026-09-30).
// Substitui os selos que ficavam antes da FAQ: a dúvida "e se não servir?" aparece na hora de
// decidir, não depois. Prazos reais da política (7 dias CDC, 30 dias defeito) — sem promessa inflada.
export default function CompraSegura({ loja }: { loja: CondicoesDaLoja }) {
  const { condicoes, pisos } = loja
  const frete = fraseFreteGratis(pisos, (c) => reais(c, { curto: true }))
  const linhas: { icone: NomeIconeCondicao; titulo: string; texto: string }[] = [
    {
      icone: "pix",
      titulo: frasePix(condicoes),
      texto: condicoes.pix_percentual > 0 ? "Desconto aplicado ao escolher Pix no pagamento." : "Aprovação na hora.",
    },
    { icone: "cartao", titulo: fraseCartao(condicoes), texto: "Pagamento seguro pelo Mercado Pago." },
    {
      icone: "troca",
      titulo: "Troca e devolução",
      texto: "7 dias para desistir (CDC) e 30 dias para defeito, sem custo.",
    },
    { icone: "envio", titulo: "Envio para todo o Brasil", texto: frete ? `${frete}.` : "Rastreado do CD até você." },
    { icone: "whatsapp", titulo: "Atendimento no WhatsApp", texto: "Dúvida de tamanho ou troca: a gente resolve com você." },
  ]
  return (
    <ul className="flex flex-col gap-y-3 border-t border-ui-border-base pt-5" data-testid="compra-segura">
      {linhas.map((l) => (
        <li key={l.icone} className="flex items-start gap-3">
          <IconeCondicao nome={l.icone} className="w-5 h-5 mt-0.5" />
          <span className="min-w-0 text-sm leading-snug">
            <span className="block font-semibold text-eclat-grafite">{l.titulo}</span>
            <span className="block text-xs text-eclat-grafite/70">{l.texto}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
