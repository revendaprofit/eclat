// Validação de CPF por dígito verificador. Função PURA: sem rede, sem I/O.
//
// Isto NÃO prova que o CPF existe na Receita — prova que os dígitos fecham.
// Serve para pegar erro de digitação antes de o pedido virar nota fiscal, onde
// um CPF errado só apareceria na rejeição da SEFAZ, com a cliente já esperando.

export function normalizarCpf(v: string): string {
  return (v || "").replace(/\D/g, "")
}

// Calcula um dígito verificador sobre os `n` primeiros dígitos.
function digito(cpf: string, n: number): number {
  let soma = 0
  for (let i = 0; i < n; i++) {
    soma += Number(cpf[i]) * (n + 1 - i)
  }
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

export function cpfValido(v: string): boolean {
  const cpf = normalizarCpf(v)
  if (cpf.length !== 11) return false

  // 111.111.111-11 e os outros repetidos FECHAM a conta dos dígitos verificadores,
  // mas não são CPF. Sem esta checagem, o campo aceitaria o placeholder mais óbvio.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  return digito(cpf, 9) === Number(cpf[9]) && digito(cpf, 10) === Number(cpf[10])
}

export function formatarCpf(v: string): string {
  const cpf = normalizarCpf(v)
  if (cpf.length !== 11) return v
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}
