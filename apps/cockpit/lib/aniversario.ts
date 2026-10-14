// Programa de aniversário (sócia, 2026-10-14). A data mora em customer.metadata.aniversario ("MM-DD") no Medusa;
// regra de verdade e textos no backend (apps/backend/src/lib/aniversario.ts). Aqui: o que as telas precisam.

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export type ClienteComAniversario = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  metadata?: Record<string, unknown> | null
}

export function aniversarioDe(c: { metadata?: Record<string, unknown> | null }): string | null {
  const v = c.metadata?.aniversario
  return typeof v === "string" && /^\d{2}-\d{2}$/.test(v) ? v : null
}

/** "14/10" digitado na ficha → "10-14"; vazio → null; inválido → undefined. */
export function chaveDeAniversario(v: string | null | undefined): string | null | undefined {
  const d = String(v ?? "").replace(/\D/g, "")
  if (!d) return null
  if (d.length !== 4) return undefined
  const dia = Number(d.slice(0, 2))
  const mes = Number(d.slice(2, 4))
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_NO_MES[mes - 1]) return undefined
  return `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

/** "10-14" → "14/10". */
export function aniversarioCurto(chave: string | null | undefined): string {
  const m = String(chave ?? "").match(/^(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[1]}` : ""
}

/** "10-14" → "14 de outubro". */
export function aniversarioPorExtenso(chave: string | null | undefined): string {
  const m = String(chave ?? "").match(/^(\d{2})-(\d{2})$/)
  return m ? `${Number(m[2])} de ${MESES[Number(m[1]) - 1]}` : ""
}

/** Hoje em Brasília como "MM-DD" (o servidor da Vercel roda em UTC). */
export function hojeChave(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", month: "2-digit", day: "2-digit" }).formatToParts(agora)
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? ""
  return `${g("month")}-${g("day")}`
}

/** Dias até o próximo aniversário (0 = hoje), ignorando o ano. */
export function diasAte(chave: string, hoje: string): number {
  const [hm, hd] = hoje.split("-").map(Number)
  const [am, ad] = chave.split("-").map(Number)
  const base = Date.UTC(2001, hm - 1, hd) // 2001 não é bissexto: 29/02 vira 01/03, bom o bastante para ordenar
  let alvo = Date.UTC(2001, am - 1, ad)
  if (alvo < base) alvo = Date.UTC(2002, am - 1, ad)
  return Math.round((alvo - base) / 86400000)
}

export type Aniversariante = ClienteComAniversario & { aniversario: string; dias: number; parabens_enviado: boolean }

/** Aniversariantes de hoje e dos próximos `janelaDias` dias, em ordem de proximidade. */
export function proximosAniversariantes<T extends ClienteComAniversario>(clientes: T[], hoje: string, janelaDias = 7): (T & Aniversariante)[] {
  const ano = new Date().getFullYear()
  const out: (T & Aniversariante)[] = []
  for (const c of clientes) {
    const a = aniversarioDe(c)
    if (!a) continue
    const dias = diasAte(a, hoje)
    if (dias > janelaDias) continue
    const p = c.metadata?.aniversario_parabens as { ano?: string | number; status?: string } | undefined
    out.push({ ...c, aniversario: a, dias, parabens_enviado: !!p && String(p.ano) === String(ano) && p.status === "enviado" })
  }
  return out.sort((x, y) => x.dias - y.dias)
}

/** Lista por mês para o calendário: 12 posições, cada uma com as clientes daquele mês em ordem de dia. */
export function calendarioPorMes<T extends ClienteComAniversario>(clientes: T[]): (T & { aniversario: string; dia: number })[][] {
  const meses: (T & { aniversario: string; dia: number })[][] = Array.from({ length: 12 }, () => [])
  for (const c of clientes) {
    const a = aniversarioDe(c)
    if (!a) continue
    const [m, d] = a.split("-").map(Number)
    meses[m - 1].push({ ...c, aniversario: a, dia: d })
  }
  for (const lista of meses) lista.sort((x, y) => x.dia - y.dia)
  return meses
}

export function ehCupomDeAniversario(codigo: string | null | undefined): boolean {
  return /ANIV\d{2}$/.test(String(codigo ?? "").toUpperCase())
}

export function nomeDe(c: { first_name: string | null; last_name: string | null; email: string }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email
}
