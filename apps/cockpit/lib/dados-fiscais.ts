// O que a emissão de nota exige de um pedido, e o que falta nele.
//
// As chaves e a ordem de leitura espelham apps/backend/src/lib/fiscal/fiscal-pedido.ts.
// Se aquele arquivo mudar, este precisa mudar junto — senão a tela diz que está tudo
// certo e o despacho recusa mesmo assim.

export type DadosFiscaisPedido = {
  cpf: string
  numero: string
  bairro: string
  municipio_ibge: string
}

function meta(o: unknown): Record<string, unknown> {
  return (o && typeof o === "object" ? (o as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >
}

export function lerDadosFiscais(order: unknown): DadosFiscaisPedido {
  const o = meta(order)
  const pedido = meta(o.metadata)
  const envio = meta(meta(o.shipping_address).metadata)

  return {
    cpf: String(pedido.cpf ?? "").replace(/\D/g, ""),
    numero: String(envio.numero ?? "").trim(),
    bairro: String(envio.bairro ?? "").trim(),
    municipio_ibge: String(envio.municipio_ibge ?? "").trim(),
  }
}

function digito(cpf: string, n: number): number {
  let soma = 0
  for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

function cpfOk(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  return digito(cpf, 9) === Number(cpf[9]) && digito(cpf, 10) === Number(cpf[10])
}

export function faltamDadosFiscaisPedido(d: DadosFiscaisPedido): string[] {
  const faltam: string[] = []
  if (!cpfOk(d.cpf)) faltam.push("CPF")
  if (!d.numero) faltam.push("número")
  if (!d.bairro) faltam.push("bairro")
  if (!/^\d{7}$/.test(d.municipio_ibge)) faltam.push("município (código IBGE)")
  return faltam
}
