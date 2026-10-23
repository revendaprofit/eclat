// Programa de aniversário — a parte que fala com o Medusa e com o WhatsApp (regras puras em ./aniversario.ts).
//   enviarPerguntasDeAniversario  job diário 10h: pergunta a data a quem já comprou e nunca foi perguntada
//   enviarParabens                job diário 9h: cria o cupom (10%, 1 uso, 30 dias) e manda os parabéns
//   tratarRespostaDeAniversario   webhook: a cliente respondeu a pergunta com a data → grava e confirma
//   gravarAniversario             usado pelo checkout/cadastro (subscriber) e pelo Cockpit (rota admin)
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCampaignsWorkflow, createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import {
  ANIVERSARIO_PERCENTUAL,
  ANIVERSARIO_VALIDADE_DIAS,
  aniversarioDe,
  candidataAosParabens,
  candidataAPergunta,
  chaveContato,
  chaveMesDia,
  codigoDoCupom,
  hojeEmBrasilia,
  interpretarAniversario,
  textoConfirmacao,
  textoNaoEntendi,
  textoParabens,
  textoPergunta,
  type ClienteBruto,
} from "./aniversario"
import { connectionState, evolutionConfigured, EvolutionHttpError, sendWhatsappText } from "./evolution"
import { normalizarContato, primeiroNome } from "./recuperacao-regras"
import { sbSelect, supabaseConfigured } from "./supabase"

type Log = { info: (m: string) => void; warn: (m: string) => void }
const MIN = 60_000
const TIMEOUT_WHATSAPP_MS = 15_000
const DELAY_DIGITANDO_MS = 3_000
// Perguntas por rodada: a base atual tem poucas dezenas de clientes; 20 por dia evita cara de disparo em massa.
const MAX_PERGUNTAS_POR_RODADA = 20
const MAX_PARABENS_POR_RODADA = 30
// A resposta com a data só é aceita por 30 dias depois da pergunta (depois disso, "14/10" solto numa conversa
// pode ser qualquer coisa — fica para a equipe gravar na ficha).
const JANELA_RESPOSTA_MS = 30 * 24 * 60 * MIN

type PedidoBruto = {
  id: string
  customer_id?: string | null
  status?: string | null
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  shipping_address?: { phone?: string | null; first_name?: string | null } | null
}

type ClienteComTelefone = ClienteBruto & { telefone: string | null; nome: string | null }

/** Clientes com pelo menos um pedido não cancelado, com o melhor telefone que temos (cadastro, senão último pedido). */
export async function clientesComPedido(container: MedusaContainer): Promise<ClienteComTelefone[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: pedidos } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "status", "created_at", "metadata", "shipping_address.phone", "shipping_address.first_name"],
    pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } },
  })
  const telefonePorCliente = new Map<string, string>()
  const nomePorCliente = new Map<string, string>()
  for (const p of (pedidos ?? []) as unknown as PedidoBruto[]) {
    if (!p.customer_id || p.status === "canceled") continue
    const tel = normalizarContato(p.shipping_address?.phone ?? (p.metadata?.whatsapp as string | undefined))
    if (tel && !telefonePorCliente.has(p.customer_id)) telefonePorCliente.set(p.customer_id, tel)
    const nome = primeiroNome(p.shipping_address?.first_name)
    if (nome && !nomePorCliente.has(p.customer_id)) nomePorCliente.set(p.customer_id, nome)
  }
  // Vendas fora do site (sócia, 2026-10-23): a cliente lançada no Cockpit também entra no programa. A venda fica no
  // Supabase (venda_externa) com o vínculo medusa_customer_id; sem a tabela (migration pendente) segue só com pedidos.
  if (supabaseConfigured()) {
    try {
      const externas = await sbSelect<{ medusa_customer_id: string | null; cliente_whatsapp: string | null; cliente_nome: string | null }>(
        "venda_externa",
        "cancelada_em=is.null&medusa_customer_id=not.is.null&select=medusa_customer_id,cliente_whatsapp,cliente_nome"
      )
      for (const v of externas) {
        if (!v.medusa_customer_id) continue
        const tel = normalizarContato(v.cliente_whatsapp)
        if (tel && !telefonePorCliente.has(v.medusa_customer_id)) telefonePorCliente.set(v.medusa_customer_id, tel)
        const nome = primeiroNome(v.cliente_nome)
        if (nome && !nomePorCliente.has(v.medusa_customer_id)) nomePorCliente.set(v.medusa_customer_id, nome)
      }
    } catch {
      /* best-effort */
    }
  }
  if (!telefonePorCliente.size && !nomePorCliente.size) return []
  const ids = Array.from(new Set([...telefonePorCliente.keys(), ...nomePorCliente.keys()]))
  const { data: clientes } = await query.graph({
    entity: "customer",
    fields: ["id", "first_name", "last_name", "email", "phone", "created_at", "metadata"],
    filters: { id: ids },
    pagination: { take: ids.length, skip: 0 },
  })
  return ((clientes ?? []) as unknown as ClienteBruto[]).map((c) => ({
    ...c,
    telefone: normalizarContato(c.phone) ?? telefonePorCliente.get(c.id) ?? null,
    nome: primeiroNome(c.first_name) ?? nomePorCliente.get(c.id) ?? null,
  }))
}

/** Mescla `patch` em customer.metadata (o módulo substitui o objeto inteiro; por isso lê antes). */
export async function gravarAniversario(container: MedusaContainer, customerId: string, patch: Record<string, unknown>): Promise<void> {
  const customers: any = container.resolve(Modules.CUSTOMER)
  const atual = await customers.retrieveCustomer(customerId, { select: ["id", "metadata"] })
  await customers.updateCustomers(customerId, { metadata: { ...(atual?.metadata ?? {}), ...patch } })
}

// ---------------------------------------------------------------------------------------------

export async function enviarPerguntasDeAniversario(container: MedusaContainer, log: Log): Promise<void> {
  if (!evolutionConfigured()) return
  const clientes = await clientesComPedido(container)
  const fila: { c: ClienteComTelefone; telefone: string }[] = []
  for (const c of clientes) {
    const r = candidataAPergunta(c, c.telefone)
    if (!("fora" in r)) fila.push({ c, telefone: r.telefone })
  }
  if (!fila.length) return
  if ((await connectionState()) !== "open") {
    log.warn(`[aniversario] ${fila.length} pergunta(s) esperando: WhatsApp da marca não está conectado`)
    return
  }
  for (const { c, telefone } of fila.slice(0, MAX_PERGUNTAS_POR_RODADA)) {
    // Marca antes de enviar: se o envio ficar incerto, não repete (uma pergunta por cliente, para sempre).
    await gravarAniversario(container, c.id, { aniversario_pedido_em: new Date().toISOString() })
    try {
      await sendWhatsappText(telefone, textoPergunta(c.nome), DELAY_DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS })
      log.info(`[aniversario] pergunta enviada para ${c.email ?? c.id}`)
    } catch (e) {
      const motivo = e instanceof EvolutionHttpError && e.numeroInexistente ? "sem_whatsapp" : "incerto"
      await gravarAniversario(container, c.id, { aniversario_pedido_status: motivo })
      log.warn(`[aniversario] pergunta para ${c.email ?? c.id}: ${motivo} (${(e as Error)?.name ?? "erro"})`)
    }
  }
}

export async function enviarParabens(container: MedusaContainer, log: Log, agora: Date = new Date()): Promise<void> {
  if (!evolutionConfigured()) return
  const hoje = hojeEmBrasilia(agora)
  const clientes = await clientesComPedido(container)
  const fila: { c: ClienteComTelefone; telefone: string }[] = []
  for (const c of clientes) {
    const r = candidataAosParabens(c, c.telefone, hoje)
    if (!("fora" in r)) fila.push({ c, telefone: r.telefone })
  }
  if (!fila.length) return
  if ((await connectionState()) !== "open") {
    log.warn(`[aniversario] ${fila.length} parabéns esperando: WhatsApp da marca não está conectado`)
    return
  }
  for (const { c, telefone } of fila.slice(0, MAX_PARABENS_POR_RODADA)) {
    const cupom = codigoDoCupom(c.nome ?? c.first_name, hoje.ano)
    await gravarAniversario(container, c.id, { aniversario_parabens: { ano: String(hoje.ano), cupom, em: agora.toISOString(), status: "enviando" } })
    try {
      await criarCupomDeAniversario(container, cupom, agora)
      await sendWhatsappText(telefone, textoParabens(c.nome, cupom), DELAY_DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS })
      await gravarAniversario(container, c.id, { aniversario_parabens: { ano: String(hoje.ano), cupom, em: agora.toISOString(), status: "enviado" } })
      log.info(`[aniversario] parabéns + cupom ${cupom} para ${c.email ?? c.id}`)
    } catch (e) {
      await gravarAniversario(container, c.id, {
        aniversario_parabens: { ano: String(hoje.ano), cupom, em: agora.toISOString(), status: "incerto", erro: (e as Error)?.message?.slice(0, 160) ?? "erro" },
      })
      log.warn(`[aniversario] parabéns para ${c.email ?? c.id} ficou incerto: ${(e as Error)?.message ?? "erro"}`)
    }
  }
}

/** Cupom de aniversário: 10% nas peças, 1 uso, 30 dias. Se o código já existe (job rodou duas vezes), reaproveita. */
export async function criarCupomDeAniversario(container: MedusaContainer, codigo: string, agora: Date = new Date()): Promise<void> {
  const promocoes: any = container.resolve(Modules.PROMOTION)
  const [existente] = await promocoes.listPromotions({ code: codigo })
  if (existente) return
  const fim = new Date(agora.getTime() + ANIVERSARIO_VALIDADE_DIAS * 24 * 60 * MIN)
  const { result: campanhas } = await createCampaignsWorkflow(container).run({
    input: {
      campaignsData: [
        {
          name: `Aniversário ${codigo}`,
          campaign_identifier: `aniversario-${codigo.toLowerCase()}`,
          starts_at: agora,
          ends_at: fim,
          budget: { type: "usage", limit: 1 },
        },
      ],
    },
  })
  await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: [
        {
          code: codigo,
          type: "standard",
          is_automatic: false,
          status: "active",
          campaign_id: campanhas[0].id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "across",
            value: ANIVERSARIO_PERCENTUAL,
            currency_code: "brl",
          },
        } as any,
      ],
    },
  })
}

// ---------------------------------------------------------------------------------------------
// Resposta da cliente à pergunta (webhook do WhatsApp). Cache de 5 min de quem foi perguntada e ainda não respondeu.

let cachePerguntadas: { em: number; porChave: Map<string, ClienteComTelefone> } | null = null

async function perguntadasPorChave(container: MedusaContainer): Promise<Map<string, ClienteComTelefone>> {
  if (cachePerguntadas && Date.now() - cachePerguntadas.em < 5 * MIN) return cachePerguntadas.porChave
  const porChave = new Map<string, ClienteComTelefone>()
  for (const c of await clientesComPedido(container)) {
    const pedidoEm = Date.parse(String(c.metadata?.aniversario_pedido_em ?? ""))
    if (!Number.isFinite(pedidoEm) || Date.now() - pedidoEm > JANELA_RESPOSTA_MS) continue
    if (aniversarioDe(c)) continue
    const k = chaveContato(c.telefone)
    if (k) porChave.set(k, c)
  }
  cachePerguntadas = { em: Date.now(), porChave }
  return porChave
}

export function esquecerCacheDeAniversario(): void {
  cachePerguntadas = null
}

/** Devolve true quando a mensagem era a resposta à pergunta do aniversário (tratada aqui; as outras automações não mexem). */
export async function tratarRespostaDeAniversario(
  container: MedusaContainer,
  p: { number: string; fromMe: boolean; texto: string; tipo?: string; log: Log }
): Promise<boolean> {
  if (p.fromMe || (p.tipo && p.tipo !== "texto")) return false
  const chave = chaveContato(p.number)
  if (!chave) return false
  const c = (await perguntadasPorChave(container)).get(chave)
  if (!c) return false
  const data = interpretarAniversario(p.texto)
  if (!data) {
    // Só insiste uma vez: a segunda mensagem sem data é conversa normal (fica para a equipe).
    if (c.metadata?.aniversario_nao_entendi) return false
    await gravarAniversario(container, c.id, { aniversario_nao_entendi: new Date().toISOString() })
    esquecerCacheDeAniversario()
    try {
      await sendWhatsappText(p.number, textoNaoEntendi(c.nome), DELAY_DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS })
    } catch (e) {
      p.log.warn(`[aniversario] "não entendi" não enviado (${(e as Error)?.name ?? "erro"})`)
    }
    return true
  }
  const chaveData = chaveMesDia(data.mes, data.dia)
  await gravarAniversario(container, c.id, {
    aniversario: chaveData,
    aniversario_origem: "whatsapp",
    ...(data.ano ? { aniversario_ano: data.ano } : {}),
    aniversario_respondido_em: new Date().toISOString(),
  })
  esquecerCacheDeAniversario()
  p.log.info(`[aniversario] ${c.email ?? c.id} respondeu: ${chaveData}`)
  try {
    await sendWhatsappText(p.number, textoConfirmacao(c.nome, chaveData), DELAY_DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS })
  } catch (e) {
    p.log.warn(`[aniversario] confirmação não enviada (${(e as Error)?.name ?? "erro"})`)
  }
  return true
}
