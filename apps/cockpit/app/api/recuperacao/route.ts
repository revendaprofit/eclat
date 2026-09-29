import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { inicioDoDiaLocal, resumir, type LinhaRecuperacao } from "@/lib/recuperacao"

// GET /api/recuperacao — configuração + ocasiões dos últimos N dias (padrão 14) + números do painel.
export async function GET(req: Request) {
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 14))
  const desde = new Date(Date.now() - dias * 86400000).toISOString()
  const [rc, rl] = await Promise.all([
    sb("recuperacao_config?id=eq.1&select=*"),
    sb(
      // Duplicatas da mesma pessoa ficam só no histórico. NULL precisa entrar explícito: em SQL,
      // "NULL not in (…)" não é verdadeiro.
      `recuperacao?criado_em=gte.${encodeURIComponent(desde)}&or=(motivo_fim.is.null,motivo_fim.not.in.(mesma_pessoa,contatada_recentemente))` +
        "&select=id,gatilho,etapa,motivo_fim,nome,contato,email,dados,elegivel_em,abordagem_em,abordagem_texto,resposta_em,oferta_em,oferta_texto,email_em,criado_em" +
        "&order=criado_em.desc&limit=300"
    ),
  ])
  if (!rc.ok || !rl.ok) {
    const status = !rc.ok ? rc.status : rl.status
    const faltaTabela = status === 404
    return NextResponse.json(
      { error: faltaTabela ? "Tabelas da recuperação não existem ainda: aplicar a migration 0014." : `Supabase ${status}` },
      { status: 502 }
    )
  }
  const config = (await rc.json())[0] ?? null
  const linhas = (await rl.json()) as LinhaRecuperacao[]
  return NextResponse.json({ config, linhas, resumo: resumir(linhas, inicioDoDiaLocal()) })
}
