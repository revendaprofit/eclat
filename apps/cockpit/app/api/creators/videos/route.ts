import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { proximoNumeroAutomatico, validarNovoVideo } from "@/lib/creators"

// Cadastro MANUAL de vídeo: para o post que a leitura do Instagram não pegou (sem legenda, sem citar a marca) ou
// para Stories. Numerado como os da rotina (a partir de 1001); 1 a 999 são os números que a creator põe no link.
export async function POST(req: Request) {
  const v = validarNovoVideo((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })
  try {
    const existentes = await sb(`creator_entrega?creator_id=eq.${v.valor.creator_id}&select=numero,link_post`)
    if (!existentes.ok) throw new Error(`Supabase respondeu HTTP ${existentes.status}`)
    const linhas = (await existentes.json()) as { numero: number; link_post: string | null }[]
    if (linhas.some((l) => l.link_post === v.valor.link_post)) {
      return NextResponse.json({ error: "Este post já está cadastrado para esta creator." }, { status: 409 })
    }
    const r = await sb("creator_entrega", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...v.valor, numero: proximoNumeroAutomatico(linhas.map((l) => l.numero)), status: "publicada" }),
    })
    if (!r.ok) throw new Error(`cadastro falhou (HTTP ${r.status})`)
    return NextResponse.json({ video: ((await r.json()) as unknown[])[0] }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
