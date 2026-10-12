import { sb } from "@/lib/sb-admin"

// Carrinhos marcados pela equipe como teste/irrelevantes (sócia, 2026-10-11: "remover do Cockpit os carrinhos
// abandonados que foram testes das edições"). O Medusa continua sendo a fonte da verdade e NADA é apagado lá
// (vários carrinhos têm cobrança Pix ligada): a marca fica no Supabase, em site_content "cockpit.carrinhos_ignorados",
// e a lista do Cockpit só deixa de mostrar. Reversível ("Restaurar").
export const CHAVE = "cockpit.carrinhos_ignorados"

export type Ignorados = { ids: string[]; em: Record<string, string> }

export function normalizar(raw: unknown): Ignorados {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const ids = Array.isArray(r.ids) ? r.ids.filter((x): x is string => typeof x === "string" && x.startsWith("cart_")) : []
  const em = r.em && typeof r.em === "object" ? (r.em as Record<string, string>) : {}
  return { ids: Array.from(new Set(ids)), em }
}

/** Aplica a ação a uma lista já normalizada (puro, testável). */
export function aplicar(atual: Ignorados, acao: "ignorar" | "restaurar", ids: string[], agora = new Date().toISOString()): Ignorados {
  const alvo = ids.filter((x) => typeof x === "string" && x.startsWith("cart_"))
  if (acao === "ignorar") {
    const em = { ...atual.em }
    for (const id of alvo) em[id] = em[id] ?? agora
    return { ids: Array.from(new Set([...atual.ids, ...alvo])), em }
  }
  const tirar = new Set(alvo)
  const em = Object.fromEntries(Object.entries(atual.em).filter(([id]) => !tirar.has(id)))
  return { ids: atual.ids.filter((id) => !tirar.has(id)), em }
}

export async function lerIgnorados(): Promise<Ignorados> {
  const r = await sb(`site_content?key=eq.${CHAVE}&select=value`)
  if (!r.ok) return { ids: [], em: {} }
  const linhas = (await r.json()) as { value: unknown }[]
  return normalizar(linhas[0]?.value)
}

export async function gravarIgnorados(v: Ignorados): Promise<boolean> {
  const r = await sb("site_content?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: CHAVE, value: v, updated_at: new Date().toISOString() }),
  })
  return r.ok
}
