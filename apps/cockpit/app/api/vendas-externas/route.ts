import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaCreateCustomer, medusaListCustomers, medusaListProducts, medusaUpdateStock } from "@/lib/medusa"
import { enviarERegistrar } from "@/lib/whatsapp-registro"
import { normalizarWhatsapp, prepararVenda, textoUnboxing, type NovaVenda, type VendaExterna } from "@/lib/venda-externa"

// Vendas fora do site (sócia, 2026-10-15). GET lista (mais recentes primeiro); POST lança uma venda:
// valida → grava no Supabase → vincula/cria a cliente no Medusa → baixa o estoque (Admin API) → convite ao unboxing
// se a sócia marcou. Cada passo depois da gravação é best-effort e volta no campo `avisos`.
const hojeBr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())

export async function GET() {
  const r = await sb("venda_externa?select=*&order=criado_em.desc&limit=300")
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const vendas = (await r.json()) as VendaExterna[]
  return NextResponse.json({ hoje: hojeBr(), vendas })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as NovaVenda
  const prep = prepararVenda(body, hojeBr())
  if ("erro" in prep) return NextResponse.json({ error: prep.erro }, { status: 400 })
  const linha = prep.linha
  const avisos: string[] = []

  // Cliente no Medusa: acha pelo WhatsApp (ou e-mail), senão cria — assim ela entra no programa de aniversário,
  // na ficha 360° e nas próximas automações.
  let customerId: string | null = null
  try {
    const whatsapp = String(linha.cliente_whatsapp)
    const email = (linha.cliente_email as string | null) ?? null
    const todos = await medusaListCustomers()
    const achado = todos.find((c) => (email && c.email?.toLowerCase() === email) || (c.phone && normalizarWhatsapp(c.phone) === whatsapp))
    if (achado) customerId = achado.id
    else {
      const partes = String(linha.cliente_nome).split(/\s+/)
      const criado = await medusaCreateCustomer({
        ...(email ? { email } : {}),
        first_name: partes[0],
        last_name: partes.slice(1).join(" ") || undefined,
        phone: whatsapp,
      })
      customerId = criado.id
    }
  } catch (e) {
    avisos.push(`Cliente não vinculada no Medusa: ${(e as Error).message}`)
  }

  const r = await sb("venda_externa", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...linha, medusa_customer_id: customerId }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const venda = ((await r.json()) as VendaExterna[])[0]

  // Estoque: baixa no Medusa (fonte da verdade). Só o que tem item de inventário.
  if (body.baixar_estoque !== false) {
    try {
      const produtos = await medusaListProducts()
      const porVariante = new Map(produtos.flatMap((p) => p.variants.map((v) => [v.id, v] as const)))
      let baixados = 0
      for (const it of venda.itens) {
        const v = porVariante.get(it.variant_id)
        if (!v?.inventory_item_id || v.stock == null) {
          avisos.push(`${it.produto} ${it.variacao ?? ""}: sem controle de estoque, não baixou.`)
          continue
        }
        await medusaUpdateStock(v.inventory_item_id, Math.max(0, v.stock - it.quantidade))
        baixados++
      }
      if (baixados) await sb(`venda_externa?id=eq.${venda.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ estoque_baixado: true }) })
    } catch (e) {
      avisos.push(`Estoque não baixado: ${(e as Error).message}`)
    }
  }

  // Convite ao unboxing (check da sócia).
  if (body.enviar_unboxing) {
    const env = await enviarERegistrar({ numero: venda.cliente_whatsapp, texto: textoUnboxing(venda.cliente_nome), nome: venda.cliente_nome, medusa_customer_id: customerId })
    if (env.ok) await sb(`venda_externa?id=eq.${venda.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ unboxing_enviado_em: new Date().toISOString() }) })
    else avisos.push(`Convite ao unboxing não enviado: ${env.error ?? "WhatsApp falhou"}`)
  }

  return NextResponse.json({ ok: true, id: venda.id, avisos })
}
