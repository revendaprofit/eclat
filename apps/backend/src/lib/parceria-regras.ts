// Aviso de venda para a creator e link /p/<apelido> — a parte pura (sem rede, sem banco).
// Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md (C1–C6, C11, C14). Dinheiro em centavos.

export type ParceriaDoAviso = {
  codigo: string
  nome: string
  whatsapp: string | null
  comissao_percentual: number
  ativa: boolean
  aceite_avisos: boolean
  apelido_link?: string | null
}

export const META_SEGUNDA_PECA = 5 // D6: a 2ª peça sai na 5ª venda
export const TETO_AVISOS_POR_HORA = 20 // C5: na loja toda
export const HORA_INICIO = 8 // C2: 8h–21h, horário de Brasília
export const HORA_FIM = 21

/** 5% de R$ 233,10 = R$ 11,66 (meio para cima), só com inteiros. */
export function comissaoCentavos(baseCentavos: number, percentual: number): number {
  if (!Number.isFinite(baseCentavos) || baseCentavos <= 0 || percentual <= 0) return 0
  return Math.floor((Math.round(baseCentavos) * percentual + 50) / 100)
}

/** Reais do Medusa (233.1, ou BigNumber { numeric }) → centavos inteiros. */
export function paraCentavos(v: unknown): number {
  const n =
    typeof v === "object" && v !== null
      ? typeof (v as { numeric?: unknown }).numeric === "number"
        ? ((v as { numeric: number }).numeric)
        : Number((v as { value?: unknown }).value)
      : Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** O cupom de parceria do pedido: o primeiro código do pedido que é de uma parceria conhecida. */
export function cupomDeParceria(codigosDoPedido: (string | null | undefined)[], codigosDeParceria: string[]): string | null {
  const conhecidos = new Set(codigosDeParceria.map((c) => c.trim().toUpperCase()))
  for (const c of codigosDoPedido) {
    const cod = (c ?? "").trim().toUpperCase()
    if (cod && conhecidos.has(cod)) return cod
  }
  return null
}

/**
 * C1: quem recebe aviso. Parceria ativa, com comissão, com WhatsApp e que ACEITOU receber (C5 — é a exceção à
 * regra "o robô só responde a quem escreveu"). Os NOME20 (comissão 0) não geram aviso.
 */
export function destinoDoAviso(p: ParceriaDoAviso): "avisar" | "dispensado" | "sem_whatsapp" {
  if (!p.ativa || p.comissao_percentual <= 0 || !p.aceite_avisos) return "dispensado"
  if (!(p.whatsapp ?? "").replace(/\D/g, "")) return "sem_whatsapp"
  return "avisar"
}

/** Hora em Brasília (UTC−3 o ano todo: o Brasil não tem horário de verão desde 2019). */
export function horaDeBrasilia(agora: Date): number {
  return (agora.getUTCHours() + 21) % 24
}

export function dentroDoHorario(agora: Date): boolean {
  const h = horaDeBrasilia(agora)
  return h >= HORA_INICIO && h < HORA_FIM
}

/** Começo do mês corrente em Brasília, em ISO (UTC). */
export function inicioDoMes(agora: Date): string {
  const local = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3, 0, 0)).toISOString()
}

export function reais(centavos: number): string {
  const c = Math.max(0, Math.round(centavos))
  const inteiro = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `R$ ${inteiro},${String(c % 100).padStart(2, "0")}`
}

/** Frase do progresso para a 2ª peça (C14). Vazia depois que ela já passou da meta. */
export function fraseSegundaPeca(vendasQueContam: number): string {
  if (vendasQueContam === META_SEGUNDA_PECA) return "Você chegou a 5 vendas: a sua 2ª peça está liberada! Me conta qual você quer 💛"
  if (vendasQueContam > META_SEGUNDA_PECA) return ""
  const falta = META_SEGUNDA_PECA - vendasQueContam
  return falta === 1 ? "Falta 1 venda para a sua 2ª peça." : `Faltam ${falta} vendas para a sua 2ª peça.`
}

/**
 * C3: a mensagem. Sem nenhum dado da cliente (LGPD): só o número do pedido, o valor das peças, a comissão
 * PREVISTA (pedido cancelado sai no fechamento do mês) e o acumulado.
 */
export function textoAviso(p: {
  nome: string
  codigo: string
  displayId: number
  baseCentavos: number
  comissaoCentavos: number
  vendasNoMes: number
  comissaoNoMesCentavos: number
  vendasQueContam: number
}): string {
  const primeiroNome = p.nome.trim().split(/\s+/)[0] || "tudo bem"
  const linhas = [
    `Oi, ${primeiroNome}! Saiu mais uma venda com o seu cupom ${p.codigo} 🎉`,
    `Pedido #${p.displayId} · peças ${reais(p.baseCentavos)} · sua comissão prevista ${reais(p.comissaoCentavos)}.`,
    `No mês: ${p.vendasNoMes} ${p.vendasNoMes === 1 ? "venda" : "vendas"}, ${reais(p.comissaoNoMesCentavos)} previstos. O repasse é no início do mês que vem.`,
  ]
  const segunda = fraseSegundaPeca(p.vendasQueContam)
  if (segunda) linhas.push(segunda)
  return linhas.join("\n")
}

// ---- Link /p/<apelido>[/<n>] (C6, C11) ----

/** "Paty" / "paty " → "paty"; qualquer coisa fora de letras, números e hífen → "". */
export function limparApelido(v: unknown): string {
  const a = typeof v === "string" ? v.trim().toLowerCase() : ""
  return /^[a-z0-9][a-z0-9-]{1,30}$/.test(a) ? a : ""
}

/** Número do vídeo no link: inteiro de 1 a 999. Qualquer outra coisa = sem vídeo (link geral). */
export function limparNumeroDoVideo(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,3}$/.test(v.trim()) ? Number(v.trim()) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null
}
