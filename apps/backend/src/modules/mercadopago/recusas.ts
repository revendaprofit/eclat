// Mensagens de recusa em pt-BR, tom da marca — sem jargão, sem culpar a cliente, sempre com um
// próximo passo. Cobre os motivos confirmados na F0 rodando de verdade contra o sandbox
// (cartões de teste APRO/OTHE/CONT/CALL/FUND/SECU, ver findings.md) mais os outros códigos
// documentados pelo Mercado Pago para o mesmo vocabulário de `status_detail`.
const MENSAGENS: Record<string, string> = {
  accredited: "Pagamento aprovado.",

  // Confirmados na F0 (2026-09-17) — vêm dentro de `errors[0].details[0]` no formato
  // "PAY_ID: motivo" quando a order falha (HTTP 402). Ver cliente.ts (`extrairMotivoDeRecusa`).
  rejected_by_issuer: "O banco emissor do cartão recusou a compra. Tenta outro cartão ou paga com Pix?",
  required_call_for_authorize: "Seu banco pediu uma confirmação. Autoriza a compra no app do banco e tenta de novo.",
  insufficient_amount: "O cartão não tem limite disponível pra esta compra. Quer tentar outro cartão ou pagar com Pix?",
  bad_filled_card_data: "Os dados do cartão não conferem. Dá uma olhada no número, na validade e no código de segurança.",

  // Documentados pelo Mercado Pago com o mesmo sentido, ainda não vistos ao vivo na F0.
  cc_rejected_bad_filled_security_code: "O código de segurança não confere. Dá uma olhada e tenta de novo.",
  cc_rejected_bad_filled_date: "A validade do cartão não confere. Confira o mês e o ano.",
  cc_rejected_bad_filled_other: "Algum dado do cartão não confere. Revisa os números e tenta de novo.",
  cc_rejected_card_disabled: "Esse cartão está desabilitado. Liga pro seu banco ou tenta outro cartão.",
  cc_rejected_duplicated_payment: "Já identificamos uma compra igual a essa há pouco. Confere se ela já não foi feita antes de tentar de novo.",
  cc_rejected_high_risk: "Não conseguimos aprovar esse pagamento por segurança. Tenta com outro cartão ou pelo Pix.",
  cc_rejected_max_attempts: "Foram várias tentativas com esse cartão. Espera um pouco ou tenta outro meio de pagamento.",
  cc_rejected_blacklist: "Não conseguimos processar esse cartão. Tenta outro cartão ou pelo Pix.",
  cc_rejected_invalid_installments: "O número de parcelas escolhido não é aceito pra esse cartão. Tenta com menos parcelas.",
  cc_rejected_card_type_not_allowed: "Esse tipo de cartão não é aceito. Tenta outro cartão ou pelo Pix.",
  cc_rejected_call_for_authorize: "Seu banco pediu uma confirmação. Autoriza a compra no app do banco e tenta de novo.",

  // Pix.
  waiting_transfer: "Aguardando a confirmação do seu banco. Assim que o Pix cair, seu pedido é criado automaticamente.",
  expired: "O código Pix expirou. Gera um novo código pra continuar.",
}

const GENERICA = "Não conseguimos confirmar esse pagamento agora. Tenta de novo ou escolhe outra forma de pagamento."

/** Traduz um `status_detail`/motivo do Mercado Pago numa mensagem acionável em pt-BR. */
export function mensagemDeRecusa(motivo: string | undefined | null): string {
  if (!motivo) return GENERICA
  return MENSAGENS[motivo] ?? GENERICA
}
