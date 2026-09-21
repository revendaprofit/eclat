// Quem é a loja, por extenso. O Decreto 7.962/2013 (lei do comércio eletrônico) exige que o
// site mostre, em lugar de destaque, nome empresarial, CNPJ, endereço físico e endereço
// eletrônico. Até 2026-09-20 nada disso aparecia — e a falta é exatamente o que uma cliente
// procura antes de pagar: houve relato de aviso de "possível golpe" no fechamento da compra.
//
// O CNPJ aqui é o MESMO da conta Mercado Pago que recebe o dinheiro (conferido na API em
// 2026-09-20). Se um dia mudar a conta que recebe, esta constante muda junto — o nome que a
// cliente lê no site tem que bater com o nome que ela vê no extrato.

export const EMPRESA = {
  nomeFantasia: "use.ÉCLAT",
  razaoSocial: "Camila de Moura Nogueira",
  cnpj: "68.673.407/0001-13",
  endereco: {
    logradouro: "Rua Norte, 180",
    bairro: "Angola",
    cidade: "Betim",
    uf: "MG",
    cep: "32604-182",
  },
  email: "useeclatbr@gmail.com",
} as const

/** O endereço como se escreve numa linha só, para o rodapé. */
export function enderecoEmUmaLinha(): string {
  const { logradouro, bairro, cidade, uf, cep } = EMPRESA.endereco
  return `${logradouro} — ${bairro}, ${cidade}/${uf}, CEP ${cep}`
}

/** Só os dígitos do CNPJ — para comparar com cadastros que não usam pontuação. */
export function cnpjSoDigitos(): string {
  return EMPRESA.cnpj.replace(/\D/g, "")
}
