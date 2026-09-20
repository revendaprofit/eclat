// Traduz a recusa do cupom (mensagem técnica do Medusa, em inglês) para uma frase que a cliente
// entenda e saiba o que fazer. Achado de 2026-09-20 em produção: o erro cru do servidor aparecia
// na tela como "An error occurred in the Server Components render…", que não ajuda ninguém.

export const ERRO_CUPOM_PADRAO = "Não conseguimos aplicar este cupom. Confira o código e tente de novo."

export function mensagemDeErroDoCupom(erro: unknown, codigo?: string): string {
  const bruto = (erro instanceof Error ? erro.message : String(erro ?? "")).toLowerCase()
  const cupom = (codigo ?? "").trim()

  // Cupom com limite por cliente: o Medusa só sabe quem é a cliente depois do e-mail (ou login).
  if (bruto.includes("customer_id") && bruto.includes("budget")) {
    return "Este cupom é limitado a um uso por cliente. Entre na sua conta, ou informe seu e-mail no checkout, e aplique o cupom lá."
  }
  // Limite da campanha já esgotado.
  if (bruto.includes("budget") && (bruto.includes("exceed") || bruto.includes("limit"))) {
    return cupom ? `O cupom ${cupom} já foi usado.` : "Este cupom já foi usado."
  }
  // Código inexistente, desativado ou fora da validade.
  if (bruto.includes("is invalid") || bruto.includes("not found")) {
    return cupom ? `Cupom ${cupom} inválido ou expirado.` : "Cupom inválido ou expirado."
  }
  return ERRO_CUPOM_PADRAO
}
