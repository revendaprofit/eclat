// Vendas fora do site (sócia, 2026-10-15): lembrete de pagamento no dia combinado, às 9h de Brasília.
// A venda mora no Supabase (tabela venda_externa, lançada pelo Cockpit); aqui só o que sai sozinho.
// Texto igual ao botão "Lembrar agora" do Cockpit (apps/cockpit/lib/venda-externa.ts) — mudou um, mude o outro.
import { connectionState, evolutionConfigured, sendWhatsappText } from "./evolution"
import { sbSelect, supabaseConfigured } from "./supabase"

type Log = { info: (m: string) => void; warn: (m: string) => void }
const TIMEOUT_WHATSAPP_MS = 15_000
const DELAY_DIGITANDO_MS = 3_000
const MAX_POR_RODADA = 30

export type VendaAPrazo = {
  id: string
  cliente_nome: string
  cliente_whatsapp: string
  total_centavos: number
  vencimento: string
}

// WhatsApp: espaço normal entre "R$" e o valor (o toLocaleString põe um espaço duro, que fica estranho no celular).
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ")
const dataBr = (iso: string) => iso.split("-").reverse().join("/")

export function primeiroNome(nome: string): string {
  return String(nome ?? "").trim().split(/\s+/)[0] || "tudo bem"
}

export function textoLembretePagamento(nome: string, totalCentavos: number, vencimento: string): string {
  return [
    `Oi, ${primeiroNome(nome)}! 💛`,
    `Passando para lembrar: hoje, ${dataBr(vencimento)}, é o dia combinado do pagamento das suas peças da use.ÉCLAT, no valor de *${brl(totalCentavos)}*.`,
    "",
    "Pode fazer pelo Pix e me mandar o comprovante por aqui? Se precisar da chave, é só pedir. ✨",
  ].join("\n")
}

/** Hoje em Brasília, "YYYY-MM-DD". */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora)
}

/** Vendas a prazo, em aberto, com vencimento até hoje e sem lembrete: recebem o lembrete uma vez. */
export function vencidasSemLembrete(vendas: (VendaAPrazo & { pago?: boolean; cancelada_em?: string | null; lembrete_enviado_em?: string | null })[], hoje: string): VendaAPrazo[] {
  return vendas.filter((v) => !v.pago && !v.cancelada_em && !v.lembrete_enviado_em && !!v.vencimento && v.vencimento <= hoje)
}

async function marcarLembrete(id: string): Promise<void> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/venda_externa?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ lembrete_enviado_em: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`marcar lembrete falhou: ${res.status}`)
}

export async function enviarLembretesDePagamento(log: Log, agora: Date = new Date()): Promise<void> {
  if (!evolutionConfigured() || !supabaseConfigured()) return
  const hoje = hojeEmBrasilia(agora)
  let vendas: VendaAPrazo[]
  try {
    vendas = await sbSelect<VendaAPrazo>(
      "venda_externa",
      `pagamento=eq.a_prazo&pago=eq.false&cancelada_em=is.null&lembrete_enviado_em=is.null&vencimento=lte.${hoje}&select=id,cliente_nome,cliente_whatsapp,total_centavos,vencimento`
    )
  } catch (e) {
    // Tabela ainda não existe (migration 0016 não aplicada): nada a fazer hoje.
    log.warn(`[venda-externa] não consegui ler as vendas a prazo (${(e as Error).message.slice(0, 120)})`)
    return
  }
  if (!vendas.length) return
  if ((await connectionState()) !== "open") {
    log.warn(`[venda-externa] ${vendas.length} lembrete(s) esperando: WhatsApp da marca não está conectado`)
    return
  }
  for (const v of vendas.slice(0, MAX_POR_RODADA)) {
    try {
      // Marca antes de enviar: se o envio ficar incerto, não repete (a equipe tem o botão "Lembrar agora").
      await marcarLembrete(v.id)
      await sendWhatsappText(v.cliente_whatsapp, textoLembretePagamento(v.cliente_nome, v.total_centavos, v.vencimento), DELAY_DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS })
      log.info(`[venda-externa] lembrete de pagamento enviado para ${v.cliente_nome} (${brl(v.total_centavos)}, vencimento ${v.vencimento})`)
    } catch (e) {
      log.warn(`[venda-externa] lembrete para ${v.cliente_nome} falhou: ${(e as Error)?.message ?? "erro"}`)
    }
  }
}
