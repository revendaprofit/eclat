// Programa de aniversário das clientes (sócia, 2026-10-14). "Aurora" é como a marca chama a mulher da comunidade
// ÉCLAT (a cliente), não uma peça. Desenho em
// docs/superpowers/specs/2026-10-14-aniversario-clientes-design.md.
//
// Onde mora a data: `customer.metadata` no Medusa (a cliente grava no cadastro/checkout pela Store API, o Cockpit
// edita pela Admin API, os jobs leem pelo query.graph — um lugar só).
//   aniversario            "MM-DD" (dia e mês; o ano é opcional e nunca é pedido)
//   aniversario_origem     "cadastro" | "checkout" | "whatsapp" | "cockpit"
//   aniversario_pedido_em  ISO: quando a marca perguntou a data pelo WhatsApp (uma vez por cliente)
//   aniversario_parabens   { ano: "2026", cupom: "ANDREAANIV26", em: ISO, status }  — uma vez por ano
//
// Este arquivo tem só regras puras (testáveis sem banco). O que fala com Medusa/Evolution está em
// aniversario-envios.ts.

import { chaveContato } from "./recuperacao-regras"

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const MESES_SEM_ACENTO = MESES.map((m) => m.normalize("NFD").replace(/[̀-ͯ]/g, ""))
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export const ANIVERSARIO_PERCENTUAL = 10
export const ANIVERSARIO_VALIDADE_DIAS = 30
export const INSTAGRAM_ECLAT = process.env.ECLAT_INSTAGRAM || "@eclat.use"

/** "14/10", "14-10", "14 de outubro", "14 out", "14/10/1990", "1410" → "10-14". Null quando não é uma data. */
export function interpretarAniversario(texto: string | null | undefined): { mes: number; dia: number; ano: number | null } | null {
  const t = String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
  if (!t) return null
  let dia: number | null = null
  let mes: number | null = null
  let ano: number | null = null
  let m = t.match(/(?<![\d])(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?(?![\d])/)
  if (m) {
    dia = Number(m[1])
    mes = Number(m[2])
    if (m[3]) ano = m[3].length === 2 ? 1900 + Number(m[3]) + (Number(m[3]) < 30 ? 100 : 0) : Number(m[3])
  } else {
    m = t.match(/(?<![\d])(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})\.?(?:\s*(?:de\s+)?(\d{4}))?/)
    if (m) {
      const idx = MESES_SEM_ACENTO.findIndex((nome) => nome === m![2] || nome.startsWith(m![2].slice(0, 3)))
      if (idx >= 0) {
        dia = Number(m[1])
        mes = idx + 1
        if (m[3]) ano = Number(m[3])
      }
    } else {
      m = t.match(/^(\d{2})(\d{2})(\d{4})?$/) // "1410" ou "14101990"
      if (m) {
        dia = Number(m[1])
        mes = Number(m[2])
        if (m[3]) ano = Number(m[3])
      }
    }
  }
  if (dia === null || mes === null) return null
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_NO_MES[mes - 1]) return null
  if (ano !== null && (ano < 1920 || ano > new Date().getFullYear())) ano = null
  return { mes, dia, ano }
}

export function chaveMesDia(mes: number, dia: number): string {
  return `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

/** "10-14" → "14/10"; inválido → "". */
export function aniversarioPorExtenso(chave: string | null | undefined): string {
  const m = String(chave ?? "").match(/^(\d{2})-(\d{2})$/)
  if (!m) return ""
  return `${Number(m[2])} de ${MESES[Number(m[1]) - 1] ?? "?"}`
}

/** Hoje em Brasília como {ano, chave "MM-DD"}. O servidor roda em UTC; às 9h de Brasília é 12h UTC. */
export function hojeEmBrasilia(agora: Date = new Date()): { ano: number; chave: string } {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora)
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? ""
  return { ano: Number(g("year")), chave: `${g("month")}-${g("day")}` }
}

/** 29/02 em ano sem 29/02 comemora em 28/02. */
export function aniversariaHoje(aniversario: string | null | undefined, hoje: { ano: number; chave: string }): boolean {
  if (!aniversario) return false
  if (aniversario === hoje.chave) return true
  const bissexto = (hoje.ano % 4 === 0 && hoje.ano % 100 !== 0) || hoje.ano % 400 === 0
  return aniversario === "02-29" && !bissexto && hoje.chave === "02-28"
}

/** Código do cupom: primeiro nome sem acento + ANIV + ano com dois dígitos. "Andrea Alves", 2026 → ANDREAANIV26. */
export function codigoDoCupom(nome: string | null | undefined, ano: number): string {
  const primeiro = String(nome ?? "")
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 12)
  return `${primeiro || "CLIENTE"}ANIV${String(ano).slice(-2)}`
}

export function ehCupomDeAniversario(codigo: string | null | undefined): boolean {
  return /ANIV\d{2}$/.test(String(codigo ?? "").toUpperCase())
}

export type ClienteBruto = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
}

export function aniversarioDe(c: { metadata?: Record<string, unknown> | null }): string | null {
  const v = c.metadata?.aniversario
  return typeof v === "string" && /^\d{2}-\d{2}$/.test(v) ? v : null
}

/** Cliente de teste da equipe: nunca recebe mensagem. */
export function ehClienteDeTeste(c: ClienteBruto): boolean {
  const email = String(c.email ?? "").toLowerCase()
  return email.endsWith("@eclat.local") || email.endsWith("@useeclat.com.br")
}

/**
 * Quem recebe a pergunta "qual o seu aniversário?": já comprou (tem telefone de pedido ou cadastro), ainda não tem
 * a data e nunca foi perguntada. Uma pergunta por cliente, para sempre.
 */
export function candidataAPergunta(c: ClienteBruto, telefone: string | null): { telefone: string } | { fora: string } {
  if (ehClienteDeTeste(c)) return { fora: "teste" }
  if (aniversarioDe(c)) return { fora: "ja_tem" }
  if (c.metadata?.aniversario_pedido_em) return { fora: "ja_perguntado" }
  if (!telefone) return { fora: "sem_telefone" }
  return { telefone }
}

/** Quem recebe os parabéns hoje: aniversaria hoje e ainda não ganhou este ano. */
export function candidataAosParabens(c: ClienteBruto, telefone: string | null, hoje: { ano: number; chave: string }): { telefone: string } | { fora: string } {
  if (ehClienteDeTeste(c)) return { fora: "teste" }
  if (!aniversariaHoje(aniversarioDe(c), hoje)) return { fora: "nao_e_hoje" }
  const p = c.metadata?.aniversario_parabens as { ano?: string | number } | undefined
  if (p && String(p.ano) === String(hoje.ano)) return { fora: "ja_enviado" }
  if (!telefone) return { fora: "sem_telefone" }
  return { telefone }
}

// ---------------------------------------------------------------------------------------------
// Textos (um lugar só; a sócia ajusta aqui).

export function textoPergunta(nome: string | null): string {
  const oi = nome ? `Oi, ${nome}! 💛` : "Oi! 💛"
  return [
    oi,
    "Aqui é da use.ÉCLAT. Estamos montando o nosso programa de aniversário: no seu dia, você ganha *10% OFF* e um presente especial para a nossa Aurora aniversariante. 🎂✨",
    "",
    "Me conta: qual é o *dia e o mês* do seu aniversário? (ex.: 14/10)",
  ].join("\n")
}

export function textoConfirmacao(nome: string | null, aniversario: string): string {
  const oi = nome ? `Anotado, ${nome}! 💛` : "Anotado! 💛"
  return `${oi} Seu aniversário fica guardado aqui: *${aniversarioPorExtenso(aniversario)}*. No seu dia, a ÉCLAT aparece com uma surpresa. 🎂✨`
}

export function textoNaoEntendi(nome: string | null): string {
  const oi = nome ? `${nome}, não` : "Não"
  return `${oi} consegui entender a data. 😅 Me manda só o dia e o mês, assim: 14/10`
}

export function textoParabens(nome: string | null, cupom: string, validadeDias: number = ANIVERSARIO_VALIDADE_DIAS): string {
  const oi = nome ? `Feliz aniversário, ${nome}! 🎂💛` : "Feliz aniversário! 🎂💛"
  return [
    oi,
    "A ÉCLAT inteira te deseja um ano de treinos bons, conquistas e muita luz. ✨",
    "",
    `Seu presente de aniversariante: *${ANIVERSARIO_PERCENTUAL}% OFF* em qualquer peça com o código *${cupom}*, válido por ${validadeDias} dias, em www.useeclat.com.br.`,
    "E no seu pedido vai junto um *presente especial para a nossa Aurora aniversariante*: você. 🎁",
    "",
    `Se postar, marca a gente: ${INSTAGRAM_ECLAT}. 💛`,
  ].join("\n")
}

export { chaveContato }
