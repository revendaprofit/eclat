// "Prova" da PDP (diagnóstico do funil, 2026-10-27): a promessa do anúncio repetida logo abaixo do
// nome, com a frase real de uma cliente. Quem chega pelo anúncio da Paty ("o short que não sobe")
// precisa ver a mesma prova sem rolar até a FAQ. Conteúdo em product.metadata.prova (JSON, gravado
// por scripts/prova-pecas.py): { titulo, texto?, frase?, autora?, chamada? }. Sem o campo, a PDP fica como era.
// `chamada` (28/10, pedido da sessão de anúncios): frase curta por cima da 1ª mídia, para quem não rola a página.
export type Prova = { titulo: string; texto: string | null; frase: string | null; autora: string | null; chamada: string | null }

const limpo = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export function lerProva(valor: unknown): Prova | null {
  let obj: unknown = valor
  if (typeof valor === "string") {
    try {
      obj = JSON.parse(valor)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null
  const o = obj as Record<string, unknown>
  const titulo = limpo(o.titulo)
  if (!titulo) return null
  const frase = limpo(o.frase)
  // Frase de cliente sem nome não entra: depoimento sempre com quem disse.
  const autora = frase ? limpo(o.autora) : null
  const chamada = limpo(o.chamada)
  return { titulo, texto: limpo(o.texto), frase: frase && autora ? frase : null, autora, chamada: chamada && chamada.length <= 40 ? chamada : null }
}

export type FraseDaProva = { frase: string; autora: string }
export const MAX_FRASES_PROVA = 5

/**
 * Frases que giram abaixo do nome (sócia, 29/10/2026): a frase da prova primeiro, depois as falas dos depoimentos
 * marcados para a peça (só texto, nunca foto), sem repetir, até 5. Autora = primeiro nome + cidade quando houver
 * ("Luana, Betim/MG"): a cidade deixa a prova mais real para quem compra de perto.
 */
export function frasesDaProva(
  prova: Prova | null,
  depoimentos: { quote: string; author?: string; cidade?: string; tipo?: "print" | "foto" }[]
): FraseDaProva[] {
  const out: FraseDaProva[] = []
  const vistas = new Set<string>()
  const chave = (s: string) => s.toLowerCase().replace(/[^a-z0-9à-ú]+/gi, " ").trim()
  const add = (frase: string | null | undefined, autora: string | null | undefined) => {
    if (!frase || !autora || out.length >= MAX_FRASES_PROVA) return
    const k = chave(frase)
    if (!k || vistas.has(k)) return
    vistas.add(k)
    out.push({ frase: frase.trim(), autora: autora.trim() })
  }
  if (prova) add(prova.frase, prova.autora)
  for (const t of depoimentos) {
    if (t.tipo === "foto" || !t.quote || !t.author) continue
    add(t.quote, t.cidade ? `${t.author}, ${t.cidade}` : t.author)
  }
  return out
}
