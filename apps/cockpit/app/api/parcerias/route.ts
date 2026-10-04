import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaCriarCupomParceria, medusaOrdersComCupom, medusaPromotionByCode } from "@/lib/medusa"
import { resumoParceria, validarNovaParceria, vendasDaParceria, type Parceria } from "@/lib/parcerias"

// Parcerias com influencers. Parceira/percentuais/repasses = Supabase (`parceria`);
// venda = Medusa (order.promotions[].code). Rotas finas: a regra mora em lib/parcerias.ts.

const hoje = () => new Date().toISOString().slice(0, 10)

export async function GET() {
  try {
    const [rp, pedidos] = await Promise.all([sb("parceria?select=*&order=criado_em"), medusaOrdersComCupom()])
    if (!rp.ok) throw new Error(`Supabase respondeu HTTP ${rp.status}: ${(await rp.text()).slice(0, 200)}`)
    const parcerias = (await rp.json()) as Parceria[]
    const dia = hoje()
    return NextResponse.json({
      hoje: dia,
      parcerias: parcerias.map((p) => ({ ...p, resumo: resumoParceria(vendasDaParceria(pedidos, p), dia) })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

// Cria o cupom no Medusa (sem teto) e a linha em `parceria`. Se a linha falhar depois do cupom
// existir, a resposta diz o id do cupom para a operadora terminar pelo script (`parceria.mjs --importar`).
export async function POST(req: Request) {
  const v = validarNovaParceria((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if (!v.ok) return NextResponse.json({ error: v.erros.join(" ") }, { status: 400 })
  const n = v.valor
  try {
    const ja = await sb(`parceria?codigo=eq.${n.codigo}&select=codigo`)
    if (ja.ok && ((await ja.json()) as unknown[]).length) {
      return NextResponse.json({ error: `A parceria ${n.codigo} já está cadastrada.` }, { status: 409 })
    }
    if (await medusaPromotionByCode(n.codigo)) {
      return NextResponse.json(
        { error: `O cupom ${n.codigo} já existe na loja. Para cadastrá-lo como parceria use: node scripts/parceria.mjs --importar ${n.codigo} --nome "${n.nome}" --comissao ${n.comissao_percentual} --aplicar` },
        { status: 409 }
      )
    }
    const { id } = await medusaCriarCupomParceria(n.codigo, n.desconto_percentual)
    const linha = { ...n, medusa_promotion_id: id, medusa_campaign_id: null, ativa: true }
    const r = await sb("parceria", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(linha) })
    if (!r.ok) {
      throw new Error(`cupom ${n.codigo} criado na loja (${id}), mas o cadastro da parceira falhou (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}. Termine com: node scripts/parceria.mjs --importar ${n.codigo} --nome "${n.nome}" --comissao ${n.comissao_percentual} --aplicar`)
    }
    const [criada] = (await r.json()) as Parceria[]
    return NextResponse.json({ parceria: criada }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
