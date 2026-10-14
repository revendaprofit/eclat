// Aniversário da cliente (programa de aniversário, sócia 2026-10-14). A cliente digita "dia/mês"; guardamos em
// customer.metadata.aniversario como "MM-DD" (regra de verdade no backend: apps/backend/src/lib/aniversario.ts).

const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Máscara do campo: só dígitos, "DD/MM". "1410" → "14/10". */
export function mascararAniversario(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
}

/** "14/10" → "10-14"; vazio → null; inválido → undefined. */
export function chaveDeAniversario(v: string | null | undefined): string | null | undefined {
  const d = String(v ?? "").replace(/\D/g, "")
  if (!d) return null
  if (d.length !== 4) return undefined
  const dia = Number(d.slice(0, 2))
  const mes = Number(d.slice(2, 4))
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_NO_MES[mes - 1]) return undefined
  return `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

/** "10-14" → "14/10" (para mostrar o que está guardado). */
export function aniversarioParaCampo(chave: unknown): string {
  const m = String(chave ?? "").match(/^(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[1]}` : ""
}

export const ERRO_ANIVERSARIO = "Aniversário: use dia e mês, assim: 14/10."
