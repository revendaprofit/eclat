import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { montarCarrinho, resumo, type CarrinhoCru } from "@/lib/carrinhos"

// Carrinhos abandonados (Medusa = fonte da verdade; só leitura).
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams
    const qs = new URLSearchParams()
    for (const k of ["dias", "min_parado_min"]) if (p.get(k)) qs.set(k, p.get(k) as string)
    const r = await medusaAdmin(`/admin/carrinhos-abandonados?${qs}`)
    if (r.status === 404) {
      return NextResponse.json({ error: "O backend ainda não tem a rota de carrinhos abandonados (falta o deploy do backend)." }, { status: 502 })
    }
    if (!r.ok) throw new Error(`Medusa respondeu HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const { carrinhos, dias, min_parado_min } = (await r.json()) as { carrinhos: CarrinhoCru[]; dias: number; min_parado_min: number }
    const lista = carrinhos.map((c) => montarCarrinho(c))
    return NextResponse.json({ dias, min_parado_min, resumo: resumo(lista), carrinhos: lista })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
