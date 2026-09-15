// Carteiro do Clube Éclat: (1) detector — estoque → eventos → fila; (2) entrega — fila → grupo.
// Roda a cada 5 min (jobs/clube.ts). Freios: master switch, janela de horário, teto diário de
// gatilhos, cooldown por chave, jitter, 1 envio por rodada, alerta no privado do dono em falha,
// pausa automática após 3 falhas seguidas. Ver architecture/clube.md.
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  clubeDbConfigured, contarEnviadasHoje, existeRecente, getConfig, insertMensagem, listMensagens,
  listRegras, logEvento, updateConfig, updateMensagem, type ClubeConfig, type ClubeMensagem, type ClubeRegra,
} from "./clube-db"
import { connectionState, evolutionConfigured, sendWhatsappMedia, sendWhatsappText } from "./evolution"
import { contarPedidos, corEsgotada, detectarEventos, lerEstoque, type EventoEstoque, type VarianteEstoque } from "./clube-estoque"
import { diasAte, extrairFoto, renderizar, type DadosMarcadores, type ItemEstoque } from "./clube-marcadores"

type Log = (msg: string) => void

const FUSO = "America/Sao_Paulo"

function horaLocal(d = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace("24:", "00:")
}

export function dentroDaJanela(cfg: ClubeConfig, agora = new Date()): boolean {
  const h = horaLocal(agora)
  const ini = cfg.janela_inicio.slice(0, 5)
  const fim = cfg.janela_fim.slice(0, 5)
  return h >= ini && h <= fim
}

// Próxima abertura da janela (hoje ou amanhã), em ISO.
function proximaAbertura(cfg: ClubeConfig, agora = new Date()): string {
  const [hh, mm] = cfg.janela_inicio.slice(0, 5).split(":").map(Number)
  const hoje = horaLocal(agora)
  const d = new Date(agora)
  // dia local em -03:00
  const local = new Date(d.getTime() - 3 * 3600_000)
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), day = local.getUTCDate()
  const alvo = Date.UTC(y, m, day + (hoje > cfg.janela_fim.slice(0, 5) ? 1 : 0), hh + 3, mm, 0)
  return new Date(alvo).toISOString()
}

function paraItem(v: VarianteEstoque): ItemEstoque {
  return { product_handle: v.product_handle ?? "", product_title: v.product_title ?? "", cor: v.cor, tamanho: v.tamanho, qty: v.qty }
}

// ---------- (1) DETECTOR ----------
export async function rodarDetector(container: MedusaContainer, log: Log): Promise<void> {
  if (!clubeDbConfigured()) return
  const cfg = await getConfig()
  if (!cfg) return
  const regras = await listRegras()
  const regraPor = new Map(regras.map((r) => [r.tipo, r]))
  const limiar = regraPor.get("ultima_unidade")?.limiar ?? 1

  const atual = await lerEstoque(container)
  const { eventos, primeiraRodada } = await detectarEventos(atual, limiar)
  if (primeiraRodada) {
    log(`[clube] primeiro snapshot: ${atual.length} variações gravadas (sem eventos)`)
    return
  }
  if (!eventos.length) return

  // Agrupa por tipo; "esgotado" só vale por cor inteira zerada.
  const porTipo = new Map<EventoEstoque["tipo"], VarianteEstoque[]>()
  for (const ev of eventos) {
    if (ev.tipo === "esgotado" && !corEsgotada(atual, ev.item)) continue
    const arr = porTipo.get(ev.tipo) ?? []
    arr.push(ev.item)
    porTipo.set(ev.tipo, arr)
  }

  for (const [tipo, itens] of porTipo) {
    const regra = regraPor.get(tipo)
    await logEvento(tipo, null, itens.map(paraItem), regra?.ativa ? "regra ativa" : "regra desligada")
    if (!regra?.ativa) continue
    // cooldown por variante (ou por produto+cor no esgotado)
    const vivos: VarianteEstoque[] = []
    for (const it of itens) {
      const chave = tipo === "esgotado" ? `${tipo}:${it.product_id}:${it.cor ?? ""}` : `${tipo}:${it.variant_id}`
      if (await existeRecente(chave, regra.cooldown_horas)) continue
      vivos.push(it)
    }
    if (!vivos.length) continue
    const lotes = regra.agrupar ? [vivos] : vivos.map((v) => [v])
    for (const lote of lotes) {
      const dados: DadosMarcadores = {}
      if (tipo === "ultima_unidade") dados.ultimas_unidades = lote.map(paraItem)
      if (tipo === "reposicao") dados.reposicao = lote.map(paraItem)
      if (tipo === "esgotado") dados.esgotados = lote.map(paraItem)
      if (tipo === "novidade") dados.novidades = lote.map((v) => ({ product_title: v.product_title ?? "", cor: v.cor }))
      const foto = regra.anexar_foto ? lote[0].imagem_url : null
      const chave = tipo === "esgotado" ? `${tipo}:${lote[0].product_id}:${lote[0].cor ?? ""}` : `${tipo}:${lote[0].variant_id}`
      const automatico = regra.modo === "automatico"
      await insertMensagem({
        origem: "gatilho",
        tipo,
        status: automatico ? "aprovada" : "rascunho",
        enviar_em: dentroDaJanela(cfg) ? new Date().toISOString() : proximaAbertura(cfg),
        titulo: `${rotulo(tipo)}: ${lote.map((v) => `${v.product_title} ${v.cor ?? ""} ${v.tamanho ?? ""}`.trim()).join(", ")}`.slice(0, 200),
        texto: regra.template,
        midia: foto,
        dados: { itens: lote.map(paraItem), marcadores: dados } as Record<string, unknown>,
        chave_dedup: chave,
        aprovado_em: automatico ? new Date().toISOString() : null,
      })
      log(`[clube] evento ${tipo} → fila (${automatico ? "automático" : "aguardando aprovação"}): ${lote.length} item(ns)`)
    }
  }
}

function rotulo(tipo: string): string {
  return { ultima_unidade: "Última unidade", reposicao: "Reposição", esgotado: "Esgotado", novidade: "Novidade", marco_reservas: "Marco de reservas" }[tipo] ?? tipo
}

// ---------- (2) ENTREGA ----------
export async function rodarEntrega(container: MedusaContainer, log: Log): Promise<void> {
  if (!clubeDbConfigured() || !evolutionConfigured()) return
  const cfg = await getConfig()
  if (!cfg?.ativo) return
  if (!dentroDaJanela(cfg)) return

  const agora = new Date().toISOString()
  const fila = await listMensagens(`status=eq.aprovada&enviar_em=lte.${encodeURIComponent(agora)}&order=enviar_em.asc&limit=5`)
  if (!fila.length) return

  const enviadasGatilho = await contarEnviadasHoje("gatilho")
  const msg = fila.find((m) => m.origem !== "gatilho" || enviadasGatilho < cfg.max_por_dia)
  if (!msg) {
    log(`[clube] teto diário de gatilhos (${cfg.max_por_dia}) atingido; fila espera amanhã`)
    return
  }

  // Jitter: adia até N min na primeira vez que a mensagem fica pronta (evita horário "em ponto").
  const dados = (msg.dados ?? {}) as Record<string, unknown>
  if (!dados.jitter_aplicado && cfg.atraso_max_min > 0) {
    const atraso = Math.floor(Math.random() * (cfg.atraso_max_min + 1))
    await updateMensagem(msg.id, {
      enviar_em: new Date(Date.now() + atraso * 60_000).toISOString(),
      dados: { ...dados, jitter_aplicado: true },
    })
    if (atraso > 0) return
  }

  const estado = await connectionState()
  if (estado !== "open") {
    await falhar(cfg, msg, `WhatsApp desconectado (estado: ${estado})`, log)
    return
  }

  try {
    const { texto_final, midia_url } = await montar(container, msg)
    const alvo = cfg.grupo_jid
    const resp = (midia_url
      ? await sendWhatsappMedia(alvo, midia_url, texto_final, 2500)
      : await sendWhatsappText(alvo, texto_final, 2500)) as { key?: { id?: string } }
    await updateMensagem(msg.id, {
      status: "enviada",
      texto_final,
      midia_url_final: midia_url,
      enviado_em: new Date().toISOString(),
      evolution_msg_id: resp?.key?.id ?? null,
      erro: null,
    })
    if (cfg.falhas_seguidas) await updateConfig({ falhas_seguidas: 0 })
    log(`[clube] enviada ${msg.origem}/${msg.tipo ?? "-"} (${msg.id})`)
  } catch (e) {
    await falhar(cfg, msg, (e as Error).message, log)
  }
}

async function falhar(cfg: ClubeConfig, msg: ClubeMensagem, erro: string, log: Log): Promise<void> {
  await updateMensagem(msg.id, { status: "falhou", erro })
  const falhas = (cfg.falhas_seguidas ?? 0) + 1
  const pausar = falhas >= 3
  await updateConfig({ falhas_seguidas: falhas, ...(pausar ? { ativo: false } : {}) })
  log(`[clube] FALHA (${falhas}ª seguida): ${erro}${pausar ? " — automação PAUSADA" : ""}`)
  if (cfg.aviso_jid) {
    try {
      await sendWhatsappText(
        cfg.aviso_jid,
        `Clube Éclat: a mensagem "${(msg.titulo ?? msg.texto).slice(0, 60)}" NÃO saiu (${erro}).${pausar ? " Automação pausada depois de 3 falhas: religue no Cockpit → Clube." : " Ela fica como 'falhou' no Cockpit → Clube."}`
      )
    } catch {
      /* se nem o aviso sai, o log basta */
    }
  }
}

// Resolve marcadores e mídia da mensagem com dados reais do momento.
export async function montar(container: MedusaContainer, msg: ClubeMensagem): Promise<{ texto_final: string; midia_url: string | null }> {
  const dadosGravados = ((msg.dados ?? {}) as { marcadores?: DadosMarcadores }).marcadores ?? {}
  const { texto, foto } = extrairFoto(msg.texto)
  const precisaVivo = /\{\{\s*(ultimas_unidades|esgotados|reservas_total|reservas_hoje|dias_para_envio)\s*\}\}/.test(texto)
  const d: DadosMarcadores = { ...dadosGravados }

  let estoque: VarianteEstoque[] | null = null
  if (precisaVivo || foto || (msg.midia && msg.midia.startsWith("produto:"))) {
    estoque = await lerEstoque(container)
  }
  if (precisaVivo && estoque) {
    const regras = await listRegras()
    const limiar = regras.find((r) => r.tipo === "ultima_unidade")?.limiar ?? 1
    if (!d.ultimas_unidades) d.ultimas_unidades = estoque.filter((v) => v.qty > 0 && v.qty <= limiar).map(paraItem)
    if (!d.esgotados) d.esgotados = estoque.filter((v) => v.qty === 0).map(paraItem)
    const ped = await contarPedidos(container)
    d.reservas_total = ped.total
    d.reservas_hoje = ped.hoje
    const prevenda = await lerPrevenda()
    if (prevenda?.envios_a_partir) d.dias_para_envio = diasAte(prevenda.envios_a_partir)
  }

  let midia_url: string | null = null
  const ref = foto ? `produto:${foto.handle}:${foto.cor ?? ""}` : msg.midia
  if (ref?.startsWith("produto:")) {
    const [, handle, cor] = ref.split(":")
    const v = (estoque ?? []).find((x) => x.product_handle === handle && (!cor || (x.cor ?? "").toLowerCase() === cor.toLowerCase())) ?? (estoque ?? []).find((x) => x.product_handle === handle)
    midia_url = v?.imagem_url ?? null
  } else if (ref && /^https?:\/\//.test(ref)) {
    midia_url = ref
  }

  return { texto_final: renderizar(texto, d), midia_url }
}

async function lerPrevenda(): Promise<{ envios_a_partir?: string } | null> {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const r = await fetch(`${url}/rest/v1/site_content?key=eq.prevenda&select=value`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const rows = (await r.json()) as { value: { envios_a_partir?: string } }[]
    return rows[0]?.value ?? { envios_a_partir: "2026-10-10" }
  } catch {
    return null
  }
}

export { type ClubeRegra }
