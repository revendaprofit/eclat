import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { adicionarDepoimento } from "@/lib/avaliacao"

// POST /api/avaliacoes/[id] — ações da equipe:
//   { acao: "parar" }          tira da automação (nada mais é enviado)
//   { acao: "autorizou" }      resposta ambígua que a equipe leu como "sim" (a fala dela fica registrada)
//   { acao: "nao_autorizou" }
//   { acao: "publicar" }       só com autorização: põe a fala EXATA no site (site_content "home.testimonials";
//                              a vitrine lê de novo em até 30 s)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { acao?: string }
  const agora = new Date().toISOString()
  const patch = (filtro: string, campos: Record<string, unknown>) =>
    sb(`avaliacao?id=eq.${encodeURIComponent(id)}${filtro}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...campos, atualizado_em: agora }),
    })

  if (body.acao === "parar") {
    const r = await patch("&etapa=not.in.(encerrada,publicada)", { etapa: "encerrada", motivo_fim: "parado_pela_equipe" })
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: `Supabase ${r.status}` }, { status: 502 })
  }

  if (body.acao === "autorizou" || body.acao === "nao_autorizou") {
    const campos =
      body.acao === "autorizou" ? { etapa: "autorizada", autorizou_em: agora } : { etapa: "encerrada", motivo_fim: "nao_autorizou" }
    const r = await patch("&etapa=eq.autorizacao_pedida", campos)
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: `Supabase ${r.status}` }, { status: 502 })
  }

  if (body.acao === "publicar") {
    const rl = await sb(`avaliacao?id=eq.${encodeURIComponent(id)}&select=id,etapa,nome,resposta_texto,autorizou_em`)
    const linha = rl.ok ? (await rl.json())[0] : null
    if (!linha) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 })
    if (linha.etapa !== "autorizada" || !linha.autorizou_em) {
      return NextResponse.json({ error: "Só publica com a autorização dela registrada." }, { status: 400 })
    }
    const rs = await sb("site_content?key=eq.home.testimonials&select=value")
    const atual = rs.ok ? ((await rs.json())[0]?.value ?? null) : null
    const novo = adicionarDepoimento(atual, { fala: linha.resposta_texto, nome: linha.nome })
    if ("erro" in novo) return NextResponse.json({ error: novo.erro }, { status: 400 })
    const w = await sb("site_content?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "home.testimonials", value: novo, updated_at: agora }),
    })
    if (!w.ok) return NextResponse.json({ error: `Supabase ${w.status}` }, { status: 502 })
    await patch("&etapa=eq.autorizada", { etapa: "publicada", publicado_em: agora, publicado_por: "cockpit" })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 })
}
