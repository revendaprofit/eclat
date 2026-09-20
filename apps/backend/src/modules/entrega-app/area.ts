// Área atendida pela "Entrega por aplicativo" (decisão do dono, 2026-09-20: Betim e Região
// Metropolitana de BH). A cliente chama e paga o carro; a ÉCLAT entrega a sacola ao motorista.
//
// Por que faixa de CEP e não cidade: o Medusa só sabe o CEP que a cliente digitou — o nome da
// cidade vem do que ela escreveu no formulário e não dá para confiar. Faixas são conferíveis.
// A lista é sobrescritível por ambiente (ENTREGA_APP_CEPS="30000000-34999999,35460000-35469999")
// para o dono ampliar a área sem deploy de código.

export type Faixa = { de: number; ate: number; nome: string }

// Faixas conferidas nos Correios (2026-09-20). Cobrem Belo Horizonte, Contagem, Betim, Ibirité,
// Santa Luzia, Vespasiano, Ribeirão das Neves, Nova Lima, Sabará, Caeté e vizinhas da RMBH.
export const FAIXAS_PADRAO: Faixa[] = [
  { de: 30000000, ate: 31999999, nome: "Belo Horizonte" },
  { de: 32000000, ate: 32399999, nome: "Contagem" },
  { de: 32400000, ate: 32499999, nome: "Ibirité" },
  { de: 32500000, ate: 32699999, nome: "Betim" },
  { de: 33000000, ate: 33299999, nome: "Santa Luzia e Vespasiano" },
  { de: 33800000, ate: 33929999, nome: "Ribeirão das Neves" },
  { de: 34000000, ate: 34999999, nome: "Nova Lima, Sabará, Caeté e região" },
]

export function normalizarCep(bruto: unknown): string | null {
  const so = String(bruto ?? "").replace(/\D/g, "")
  return so.length === 8 ? so : null
}

/** Lê faixas do ambiente ("de-ate,de-ate"); valor inválido cai no padrão, nunca quebra o checkout. */
export function faixasDoAmbiente(env: NodeJS.ProcessEnv = process.env): Faixa[] {
  const bruto = (env.ENTREGA_APP_CEPS ?? "").trim()
  if (!bruto) return FAIXAS_PADRAO
  const faixas: Faixa[] = []
  for (const parte of bruto.split(",")) {
    const [de, ate] = parte.split("-").map((n) => Number(n.replace(/\D/g, "")))
    if (Number.isInteger(de) && Number.isInteger(ate) && de > 0 && ate >= de) {
      faixas.push({ de, ate, nome: "configurada" })
    }
  }
  return faixas.length ? faixas : FAIXAS_PADRAO
}

export function dentroDaArea(cep: unknown, faixas: Faixa[] = FAIXAS_PADRAO): boolean {
  const normalizado = normalizarCep(cep)
  if (!normalizado) return false
  const n = Number(normalizado)
  return faixas.some((f) => n >= f.de && n <= f.ate)
}
