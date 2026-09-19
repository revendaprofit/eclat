// Compra segura da etiqueta SuperFrete — a orquestração que garante que uma retentativa de despacho
// NUNCA paga a mesma etiqueta duas vezes (achados 1–3 da revisão de 2026-09-19: retentativa pós-
// pagamento comprava de novo; sem timeout a ambiguidade "foi cobrado?" alimentava isso; sem trava,
// um duplo clique disparava duas compras ao mesmo tempo).
//
// Dependências injetadas (Deps) em vez de chamar lib/shipping.ts direto: permite testar toda a
// lógica de decisão sem `fetch`, sem stub de rede, e sem qualquer chance de bater na API real.
//
// O estado do frete vive em metadata.frete do pedido (gravado via `salvar`), lido de volta com
// `lerEstadoDoFrete`. `status`:
//   "iniciando" → decidiu comprar, ainda não tem id da SuperFrete (não gasta saldo).
//   "pendente"  → tem id (POST /api/v0/cart feito), pagamento incerto — pode ter falhado, pode ter
//                 sido só lentidão/timeout. NUNCA assume pago nem assume não pago: consulta.
//   "paga"      → pagamento confirmado (tracking_number presente). Fonte da verdade final.
import type { CarrierLabel } from "./shipping"

export type EstadoDoFrete = {
  transportadora: "superfrete"
  status: "iniciando" | "pendente" | "paga"
  superfrete_id?: string
  tracking_number?: string
  tracking_url?: string
  label_url?: string
  em: string // ISO
}

export type Deps = {
  criar: () => Promise<string>
  pagar: (id: string) => Promise<CarrierLabel>
  consultar: (id: string) => Promise<{ status: string; label: CarrierLabel | null }>
  salvar: (estado: EstadoDoFrete) => Promise<void>
  agora?: () => Date
}

const DOIS_MINUTOS_MS = 120_000
// Data propositalmente "impossível de ser recente": grava aqui quando `criar` falha, pra uma
// retentativa logo em seguida (ex.: operador corrigiu o CEP e clicou de novo) não ficar bloqueada
// pelos 2 minutos da regra 3 — o erro foi instantâneo, não uma compra em andamento de verdade.
const EPOCH_ZERO = "1970-01-01T00:00:00.000Z"

const STATUS_VALIDOS = new Set(["iniciando", "pendente", "paga"])

// Lê metadata.frete do pedido de volta em EstadoDoFrete — defensivo: qualquer coisa fora do
// esperado (ausente, de outra transportadora, status desconhecido, sem `em`) vira null, e o chamador
// trata como "nenhum estado aproveitável" (regra 4, compra do zero).
export function lerEstadoDoFrete(metadata: unknown): EstadoDoFrete | null {
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {}
  const f = m.frete
  if (!f || typeof f !== "object") return null
  const o = f as Record<string, unknown>
  if (o.transportadora !== "superfrete") return null
  const status = o.status
  if (typeof status !== "string" || !STATUS_VALIDOS.has(status)) return null
  const em = o.em
  if (typeof em !== "string" || !em) return null

  const estado = { transportadora: "superfrete", status, em } as EstadoDoFrete
  if (typeof o.superfrete_id === "string") estado.superfrete_id = o.superfrete_id
  if (typeof o.tracking_number === "string") estado.tracking_number = o.tracking_number
  if (typeof o.tracking_url === "string") estado.tracking_url = o.tracking_url
  if (typeof o.label_url === "string") estado.label_url = o.label_url
  return estado
}

function labelDoEstado(estado: { superfrete_id?: string; tracking_number?: string; tracking_url?: string; label_url?: string }): CarrierLabel {
  return {
    tracking_number: estado.tracking_number ?? "",
    tracking_url: estado.tracking_url ?? "",
    label_url: estado.label_url ?? "",
    carrier_order_id: estado.superfrete_id ?? "",
  }
}

// Garante que existe uma etiqueta paga para o pedido, comprando o mínimo necessário — nunca mais
// que uma vez por frete. Cada branch abaixo corresponde a uma regra de segurança contra pagar em
// dobro; ver lib/etiqueta-segura.test.ts para o teste de cada uma.
export async function garantirEtiqueta(deps: Deps, atual: EstadoDoFrete | null): Promise<CarrierLabel> {
  const agora = deps.agora ?? (() => new Date())

  // Regra 1: já paga e com rastreio — nada a fazer. Cobre a retentativa pós-pagamento (achado 1):
  // se o fulfillment/shipment falhar DEPOIS da etiqueta comprada, o próximo clique em Despachar cai
  // aqui e devolve a etiqueta já paga, sem tocar na SuperFrete de novo.
  if (atual?.status === "paga" && atual.superfrete_id && atual.tracking_number) {
    return labelDoEstado(atual)
  }

  // Regra 2: já existe um frete criado na SuperFrete (id presente) — confere o status ANTES de
  // decidir pagar de novo. Cobre o caso do /checkout ter tido timeout ou erro (achado 2): não sabemos
  // se cobrou ou não, então perguntamos à SuperFrete em vez de arriscar pagar em dobro.
  if (atual?.superfrete_id) {
    const id = atual.superfrete_id
    const consulta = await deps.consultar(id)
    if (consulta.label) {
      const estado: EstadoDoFrete = {
        transportadora: "superfrete",
        status: "paga",
        superfrete_id: id,
        tracking_number: consulta.label.tracking_number,
        tracking_url: consulta.label.tracking_url,
        label_url: consulta.label.label_url,
        em: agora().toISOString(),
      }
      await deps.salvar(estado)
      return consulta.label
    }
    if (consulta.status === "pending") {
      // Criado, nunca chegou a ser pago — paga agora, com o MESMO id (não cria outro frete).
      const label = await deps.pagar(id)
      const estado: EstadoDoFrete = {
        transportadora: "superfrete",
        status: "paga",
        superfrete_id: id,
        tracking_number: label.tracking_number,
        tracking_url: label.tracking_url,
        label_url: label.label_url,
        em: agora().toISOString(),
      }
      await deps.salvar(estado)
      return label
    }
    if (consulta.status !== "canceled") {
      // Status que este fluxo não sabe interpretar com segurança (ex.: em disputa, erro da
      // SuperFrete) — não tenta pagar nem criar outro; manda o operador conferir manualmente.
      throw new Error(`A etiqueta ${id} está com status "${consulta.status}" na SuperFrete. Confira no painel da SuperFrete antes de tentar de novo.`)
    }
    // "canceled": o saldo já voltou pra carteira — comprar um frete novo é legítimo (cai na regra 4).
  } else if (atual?.status === "iniciando") {
    // Regra 3: decidiu comprar mas ainda não tem id — pode ser uma compra em andamento (outra aba,
    // duplo clique) ou uma tentativa anterior que falhou antes de chegar no /cart. Só bloqueia por
    // uma janela curta; achado 3 (duplo clique) é resolvido aqui pro caso entre duas instâncias do
    // Cockpit (a trava em memória da rota cobre o caso na mesma instância).
    const desde = Date.parse(atual.em)
    const idade = agora().getTime() - (Number.isFinite(desde) ? desde : 0)
    if (idade < DOIS_MINUTOS_MS) {
      throw new Error("Já existe uma compra de etiqueta em andamento para este pedido. Aguarde 2 minutos e tente de novo.")
    }
    // Mais velho que 2 minutos: considera abandonada (cai na regra 4).
  }

  // Regra 4: nenhum estado aproveitável — compra do zero. Grava "iniciando" ANTES de chamar `criar`
  // para que uma retentativa concorrente veja o estado e não dispare outra compra (regra 3).
  await deps.salvar({ transportadora: "superfrete", status: "iniciando", em: agora().toISOString() })
  let id: string
  try {
    id = await deps.criar()
  } catch (e) {
    // `criar` falhou (dado inválido, timeout etc.) — SEM isso, a próxima tentativa ficaria travada
    // pelos 2 minutos da regra 3 por causa de um erro que não gastou saldo nem levou tempo real.
    await deps.salvar({ transportadora: "superfrete", status: "iniciando", em: EPOCH_ZERO })
    throw e
  }
  try {
    await deps.salvar({ transportadora: "superfrete", status: "pendente", superfrete_id: id, em: agora().toISOString() })
  } catch (e) {
    // Este é o único ponto em que uma falha de gravação perde o rastro do frete: "iniciando" já foi
    // salvo, mas SEM o id — se essa gravação também falhar, ninguém mais sabe que `id` existe. O
    // frete não foi pago (não custou nada), mas o operador precisa do id pra achar e, se quiser,
    // cancelar essa etiqueta órfã no painel da SuperFrete.
    throw new Error(
      `Frete criado na SuperFrete (id ${id}), mas não consegui gravar no pedido: ${(e as Error).message}. Nada foi cobrado. Tente de novo em 2 minutos; se sobrar um frete pendente no painel da SuperFrete, ele não tem custo.`
    )
  }
  // Se `pagar` falhar daqui pra baixo (achado 2: sem saldo, timeout), o estado fica "pendente" com o
  // id gravado — a próxima chamada cai na regra 2 e conserta sozinha (consulta antes de pagar de novo).
  const label = await deps.pagar(id)
  await deps.salvar({
    transportadora: "superfrete",
    status: "paga",
    superfrete_id: id,
    tracking_number: label.tracking_number,
    tracking_url: label.tracking_url,
    label_url: label.label_url,
    em: agora().toISOString(),
  })
  return label
}
