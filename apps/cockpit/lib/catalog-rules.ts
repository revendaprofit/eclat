// Regras do catálogo (spec 4.2): opções de variante padronizadas.
// Puro — usado pela rota de criação (bloqueio) e pelo formulário (feedback ao vivo).

export const TAMANHOS_VESTUARIO = ["P", "M", "G", "GG"] as const
export type OptionInput = { title: string; values: string[] }
export type ValidationResult = { errors: string[]; warnings: string[] }

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export function isAccessoryHandle(handle: string): boolean {
  const h = handle.replace(/^\/+|\/+$/g, "")
  return h === "acessorios" || h.startsWith("acessorios/")
}

// Resolve o caminho completo de uma categoria (ex.: "acessorios/oculos") subindo a
// cadeia de parent_id. Necessário porque, no Medusa, o `handle` de uma categoria-filha
// é só o handle simples (ex.: "oculos"), não o caminho completo — isAccessoryHandle
// precisa do caminho para reconhecer filhas de "acessorios".
export function categoryPath(
  cat: { id: string; handle: string; parent_id: string | null },
  all: { id: string; handle: string; parent_id: string | null }[]
): string {
  const byId = new Map(all.map((c) => [c.id, c]))
  const parts: string[] = [cat.handle]
  let current = cat
  const seen = new Set<string>([cat.id])
  while (current.parent_id) {
    const parent = byId.get(current.parent_id)
    if (!parent || seen.has(parent.id)) break
    parts.unshift(parent.handle)
    seen.add(parent.id)
    current = parent
  }
  return parts.join("/")
}

export function validateProductOptions(
  options: OptionInput[],
  ctx: { isAccessory: boolean; knownColors: string[] }
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const known = new Set(ctx.knownColors.map(norm))

  let tamanho: OptionInput | undefined
  let cor: OptionInput | undefined
  for (const o of options) {
    const t = norm(o.title)
    if (t === "tamanho") {
      if (o.title !== "Tamanho") warnings.push(`Título de opção fora do padrão: "${o.title}" (use "Tamanho").`)
      tamanho = o
    } else if (t === "cor") {
      if (o.title !== "Cor") warnings.push(`Título de opção fora do padrão: "${o.title}" (use "Cor").`)
      cor = o
    } else {
      errors.push(`Opção não permitida: "${o.title}". Só "Tamanho" e "Cor".`)
    }
  }

  if (!cor) errors.push('Toda peça precisa da opção "Cor".')
  if (!ctx.isAccessory && !tamanho) errors.push('Vestuário precisa da opção "Tamanho".')

  for (const o of [tamanho, cor]) {
    if (!o) continue
    const vals = o.values.map((v) => v.trim()).filter(Boolean)
    if (!vals.length) errors.push(`Opção "${o.title}" sem valores.`)
    if (new Set(vals.map(norm)).size !== vals.length) errors.push(`Opção "${o.title}" tem valores repetidos.`)
  }

  if (tamanho && !ctx.isAccessory) {
    const permitidos = new Set<string>(TAMANHOS_VESTUARIO)
    const ruins = tamanho.values.map((v) => v.trim()).filter((v) => v && !permitidos.has(v))
    if (ruins.length) errors.push(`Tamanho inválido para vestuário: ${ruins.join(", ")}. Use P, M, G, GG.`)
  }

  if (cor) {
    for (const c of cor.values.map((v) => v.trim()).filter(Boolean)) {
      if (!known.has(norm(c))) warnings.push(`Cor "${c}" não está no mapa de cores (Vitrine → Cores).`)
    }
  }

  return { errors, warnings }
}
