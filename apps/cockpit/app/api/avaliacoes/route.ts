import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { inicioDoDiaLocal } from "@/lib/recuperacao"
import { resumirAvaliacoes, type LinhaAvaliacao } from "@/lib/avaliacao"

// GET /api/avaliacoes — configuração + pedidos de avaliação dos últimos N dias (padrão 60) + números.
export async function GET(req: Request) {
  const dias = Math.min(180, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 60))
  const desde = new Date(Date.now() - dias * 86400000).toISOString()
  const [rc, rl, rr] = await Promise.all([
    sb("avaliacao_config?id=eq.1&select=*"),
    sb(
      `avaliacao?criado_em=gte.${encodeURIComponent(desde)}&or=(motivo_fim.is.null,motivo_fim.neq.pedida_recentemente)` +
        "&select=id,origem,display_id,nome,contato,pecas,etapa,motivo_fim,elegivel_em,pedido_em,pedido_texto,resposta_texto,resposta_em,tem_foto,autorizacao_em,autorizou_texto,autorizou_em,publicado_em,conversation_id,criado_em" +
        "&order=criado_em.desc&limit=300"
    ),
    sb("recuperacao_config?id=eq.1&select=persona,janela_inicio,janela_fim,max_abordagens_dia"),
  ])
  if (!rc.ok || !rl.ok) {
    const status = !rc.ok ? rc.status : rl.status
    return NextResponse.json(
      { error: status === 404 ? "Tabelas do pedido de avaliação não existem ainda: aplicar a migration 0015." : `Supabase ${status}` },
      { status: 502 }
    )
  }
  const config = (await rc.json())[0] ?? null
  const linhas = (await rl.json()) as LinhaAvaliacao[]
  const freios = rr.ok ? ((await rr.json())[0] ?? null) : null
  return NextResponse.json({ config, freios, linhas, resumo: resumirAvaliacoes(linhas, inicioDoDiaLocal()) })
}
