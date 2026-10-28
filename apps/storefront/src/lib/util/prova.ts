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
