// Estilos do wizard "Minha ÉCLAT" → handles de categoria (spec §10): as categorias escolhidas
// vêm primeiro no bloco "Compre por peça"; NADA é escondido. Puro.
export const STYLE_HANDLES: Record<string, string> = {
  legging: "leggings",
  top: "tops",
  short: "shorts",
  macacao: "macaquinhos",
  conjunto: "conjuntos",
}

export function orderByStyles<T extends { handle: string }>(items: T[], estilos: string[] | undefined): T[] {
  if (!estilos?.length) return items
  // hasOwnProperty explícito (I3): STYLE_HANDLES[e] sozinho responderia a chaves herdadas do
  // protótipo ("constructor", "__proto__"…) como se fossem um estilo válido.
  const chosen = new Set(
    estilos
      .map((e) => (Object.prototype.hasOwnProperty.call(STYLE_HANDLES, e) ? STYLE_HANDLES[e] : null))
      .filter((h): h is string => !!h)
  )
  if (chosen.size === 0) return items
  return [...items.filter((i) => chosen.has(i.handle)), ...items.filter((i) => !chosen.has(i.handle))]
}
