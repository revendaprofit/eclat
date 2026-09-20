import { EMPRESA, enderecoEmUmaLinha } from "@lib/empresa"
import { clx } from "@modules/common/components/ui"

/**
 * Quem é a loja, escrito por extenso: razão social, CNPJ, endereço e e-mail.
 *
 * Fica no rodapé (exigência do Decreto 7.962/2013) e no fechamento da compra. No checkout ele
 * responde a uma dúvida concreta: o dinheiro sai para "Camila de Moura Nogueira", e quem não
 * souber que é a ÉCLAT vê um nome estranho na hora de pagar — foi o que levou uma cliente a
 * suspeitar de golpe em 2026-09-20.
 */
export default function IdentificacaoDaEmpresa({
  titulo,
  className,
}: {
  titulo?: string
  className?: string
}) {
  return (
    <address className={clx("not-italic text-ui-fg-muted txt-compact-small leading-relaxed", className)}>
      {titulo ? <span className="block text-ui-fg-subtle">{titulo}</span> : null}
      <span className="block">
        {EMPRESA.razaoSocial} ·{" "}
        {/* no celular a linha quebra; o CNPJ não pode partir no meio do número */}
        <span className="whitespace-nowrap">CNPJ {EMPRESA.cnpj}</span>
      </span>
      <span className="block">{enderecoEmUmaLinha()}</span>
      <a href={`mailto:${EMPRESA.email}`} className="block hover:text-ui-fg-base">
        {EMPRESA.email}
      </a>
    </address>
  )
}
