// Leitor de código de barras (spec docs/superpowers/specs/2026-09-14-leitor-codigo-barras-design.md, F0/F1).
// Puro: normaliza o que o leitor "digitou" e decide a conferência de um pedido. Sem I/O, sem React —
// usado pela tela (feedback de cada leitura) e pela rota de despacho (validação no servidor).

// SKU impresso na etiqueta da Lumière: ECL-<REF de 4 dígitos>-<TAMANHO> (Code 128 com o mesmo texto).
export const SKU_ETIQUETA = /^ECL-\d{4}-(PP|P|M|G|GG|XG)$/

// O leitor age como teclado. Com layout ABNT2 × US o hífen pode chegar como apóstrofo, barra, sublinhado
// ou espaço; alguns leitores mandam prefixo AIM ("]C0"). Tudo vira o SKU canônico em maiúsculas.
export function normalizarCodigo(bruto: string): string {
  return (bruto ?? "")
    .trim()
    .replace(/^\]C\d/i, "")
    .toUpperCase()
    .replace(/['´`/\\_\s–—?=]+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function ehSkuDaEtiqueta(codigo: string): boolean {
  return SKU_ETIQUETA.test(codigo)
}

// ---------- Conferência do pedido ----------

export type ItemPedido = {
  item_id: string
  sku: string | null
  titulo: string
  variante: string | null
  quantidade: number
}

export type StatusLinha = "ok" | "faltando" | "excedente" | "sem_codigo"

export type LinhaConferencia = {
  sku: string | null
  titulo: string
  variante: string | null
  esperado: number
  bipado: number
  status: StatusLinha
}

export type ResumoConferencia = {
  linhas: LinhaConferencia[]
  foraDoPedido: { codigo: string; vezes: number }[]
  completa: boolean
  pecasEsperadas: number
  pecasBipadas: number
}

// Linhas por SKU (o mesmo SKU pode estar em mais de uma linha do pedido, ex.: peças de conjunto em
// linhas separadas). Item sem SKU não tem como ser bipado: vira "sem_codigo" e impede a conferência
// de fechar (o despacho exige motivo).
function agrupar(itens: ItemPedido[]): LinhaConferencia[] {
  const porSku = new Map<string, LinhaConferencia>()
  const semCodigo: LinhaConferencia[] = []
  for (const it of itens) {
    const sku = it.sku ? normalizarCodigo(it.sku) : ""
    if (!sku) {
      semCodigo.push({ sku: null, titulo: it.titulo, variante: it.variante, esperado: it.quantidade, bipado: 0, status: "sem_codigo" })
      continue
    }
    const atual = porSku.get(sku)
    if (atual) atual.esperado += it.quantidade
    else porSku.set(sku, { sku, titulo: it.titulo, variante: it.variante, esperado: it.quantidade, bipado: 0, status: "faltando" })
  }
  return [...porSku.values(), ...semCodigo]
}

function contar(leituras: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of leituras) {
    const c = normalizarCodigo(l)
    if (c) m.set(c, (m.get(c) ?? 0) + 1)
  }
  return m
}

export function resumoConferencia(itens: ItemPedido[], leituras: string[]): ResumoConferencia {
  const linhas = agrupar(itens)
  const contagem = contar(leituras)
  const skusDoPedido = new Set(linhas.map((l) => l.sku).filter((s): s is string => !!s))
  for (const l of linhas) {
    if (l.status === "sem_codigo" || !l.sku) continue
    l.bipado = contagem.get(l.sku) ?? 0
    l.status = l.bipado === l.esperado ? "ok" : l.bipado > l.esperado ? "excedente" : "faltando"
  }
  const foraDoPedido = [...contagem.entries()]
    .filter(([c]) => !skusDoPedido.has(c))
    .map(([codigo, vezes]) => ({ codigo, vezes }))
  const completa = linhas.every((l) => l.status === "ok") && foraDoPedido.length === 0
  return {
    linhas,
    foraDoPedido,
    completa,
    pecasEsperadas: linhas.reduce((s, l) => s + l.esperado, 0),
    pecasBipadas: leituras.filter((l) => normalizarCodigo(l)).length,
  }
}

export type ResultadoLeitura =
  | { tipo: "ok"; sku: string; faltam: number } // peça do pedido, ainda dentro da quantidade
  | { tipo: "excedente"; sku: string } // peça do pedido, mas já bipada todas as vezes
  | { tipo: "fora_do_pedido"; sku: string } // SKU que não está no pedido (cor/tamanho/modelo trocado)
  | { tipo: "invalido" } // leitura vazia depois de normalizar

// Classifica UMA leitura nova, dado o que já foi bipado (para o sinal verde/vermelho da tela).
export function avaliarLeitura(itens: ItemPedido[], leiturasAnteriores: string[], bruto: string): ResultadoLeitura {
  const sku = normalizarCodigo(bruto)
  if (!sku) return { tipo: "invalido" }
  const linha = agrupar(itens).find((l) => l.sku === sku)
  if (!linha) return { tipo: "fora_do_pedido", sku }
  const jaBipado = contar(leiturasAnteriores).get(sku) ?? 0
  if (jaBipado >= linha.esperado) return { tipo: "excedente", sku }
  return { tipo: "ok", sku, faltam: linha.esperado - jaBipado - 1 }
}

// ---------- Registro gravado no pedido (metadata.conferencia) ----------

export type ConferenciaEnviada = {
  leituras: string[]
  motivo?: string | null
}

export type RegistroConferencia = {
  status: "ok" | "divergente"
  itens: { sku: string | null; titulo: string; variante: string | null; esperado: number; bipado: number }[]
  fora_do_pedido: { codigo: string; vezes: number }[]
  motivo: string | null
  operador_email: string | null
  em: string
}

// Validação no servidor (rota de despacho): recalcula a conferência a partir dos itens REAIS do pedido
// e das leituras enviadas pela tela. Conferência que não fecha só passa com motivo (decisão do dono:
// "avisar e permitir com motivo").
export function validarConferencia(
  itens: ItemPedido[],
  enviada: ConferenciaEnviada | null | undefined,
  operadorEmail: string | null,
  agora: Date = new Date()
): { ok: true; registro: RegistroConferencia } | { ok: false; erro: string } {
  if (!enviada || !Array.isArray(enviada.leituras)) {
    return { ok: false, erro: "Confira as peças com o leitor antes de despachar." }
  }
  const resumo = resumoConferencia(itens, enviada.leituras)
  const motivo = (enviada.motivo ?? "").trim() || null
  if (!resumo.completa && !motivo) {
    return { ok: false, erro: "A conferência não fechou. Informe o motivo para despachar mesmo assim." }
  }
  return {
    ok: true,
    registro: {
      status: resumo.completa ? "ok" : "divergente",
      itens: resumo.linhas.map(({ sku, titulo, variante, esperado, bipado }) => ({ sku, titulo, variante, esperado, bipado })),
      fora_do_pedido: resumo.foraDoPedido,
      motivo: resumo.completa ? null : motivo,
      operador_email: operadorEmail,
      em: agora.toISOString(),
    },
  }
}
