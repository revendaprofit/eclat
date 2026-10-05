import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaOrdersComCupom } from "@/lib/medusa"
import {
  montarPainel, resumoSemanal,
  type AvisoLinha, type CreatorLinha, type LeituraLinha, type ParceriaLinha, type VideoLinha,
} from "@/lib/creators"

// Ciclo dos creators (desenho 2026-09-29-programa-creators-design.md §9). Creators, vídeos, leituras e vendas
// por vídeo moram no Supabase (migration 0014); o status do pedido (cancelado ou não) vem da Medusa.
// Rota fina: a regra está em lib/creators.ts.

const LOJA = process.env.STOREFRONT_URL || "https://www.useeclat.com.br"

async function ler<T>(caminho: string): Promise<T[]> {
  const r = await sb(caminho)
  if (!r.ok) throw new Error(`Supabase respondeu HTTP ${r.status} em ${caminho.split("?")[0]}`)
  return (await r.json()) as T[]
}

export async function GET() {
  try {
    const [creators, parcerias, videos, avisos, leituras, pedidos] = await Promise.all([
      ler<CreatorLinha>("creator?select=id,instagram,nome,status,parceria_codigo,aprovada_em"),
      ler<ParceriaLinha>("parceria?select=codigo,nome,apelido_link,comissao_percentual,ativa"),
      ler<VideoLinha>("creator_entrega?select=id,creator_id,numero,formato,titulo,link_post,publicado_em,vencedor_em,em_anuncio,criado_em&limit=2000"),
      ler<AvisoLinha>("parceria_aviso?select=order_id,codigo,entrega_id,pedido_em,base_centavos,comissao_centavos,status&limit=5000"),
      ler<LeituraLinha>("creator_snapshot?select=creator_id,seguidores,engajamento_pct,lido_em&order=lido_em.desc&limit=400"),
      medusaOrdersComCupom(),
    ])
    const cancelados = new Set(pedidos.filter((p) => p.status === "canceled").map((p) => p.id))
    const agora = new Date()
    const painel = montarPainel({ creators, parcerias, videos, avisos, leituras, cancelados, agora, lojaUrl: LOJA })
    return NextResponse.json({ creators: painel, resumo: resumoSemanal(painel, avisos, cancelados, agora) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
