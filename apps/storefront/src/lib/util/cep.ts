// CEP e a resposta do provedor de busca. Funções PURAS: sem rede, sem I/O.
//
// O provedor (ViaCEP) fica isolado aqui — trocar de provedor é mudar este arquivo,
// não o formulário nem a rota.
//
// Por que o parse é tão desconfiado: o ViaCEP responde CEP inexistente com
// HTTP 200 e corpo { "erro": true }. Código que confia no status acha que deu certo
// e preenche o endereço com campos vazios. E sem `ibge` de 7 dígitos a nota não sai —
// então resposta sem ele vale tanto quanto resposta nenhuma.

export type EnderecoCep = {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  ibge: string
}

export function normalizarCep(v: string): string {
  return (v || "").replace(/\D/g, "")
}

export function cepValido(v: string): boolean {
  return /^\d{8}$/.test(normalizarCep(v))
}

export function urlProvedorCep(cep: string): string {
  return `https://viacep.com.br/ws/${normalizarCep(cep)}/json/`
}

export function parseRespostaCep(bruto: unknown): EnderecoCep | null {
  if (!bruto || typeof bruto !== "object") return null

  const r = bruto as Record<string, unknown>

  // CEP inexistente: HTTP 200 com { erro: true } (às vezes como string "true").
  if (r.erro === true || r.erro === "true") return null

  const ibge = String(r.ibge ?? "")
  if (!/^\d{7}$/.test(ibge)) return null

  return {
    logradouro: String(r.logradouro ?? ""),
    bairro: String(r.bairro ?? ""),
    cidade: String(r.localidade ?? ""),
    uf: String(r.uf ?? ""),
    ibge,
  }
}
