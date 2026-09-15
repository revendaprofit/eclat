// Marcadores do Clube Éclat: {{ultimas_unidades}}, {{esgotados}}, {{reposicao}}, {{novidades}},
// {{reservas_total}}, {{reservas_hoje}}, {{dias_para_envio}}, {{foto:<handle>:<cor>}}.
// Funções puras (sem I/O) para dar para testar. Regra: marcador sem dado apaga a FRASE inteira
// (até o ponto final ou a quebra de linha) — nunca sai texto com número inventado ou buraco.

export type ItemEstoque = {
  product_handle: string
  product_title: string
  cor: string | null
  tamanho: string | null
  qty: number
}

export type DadosMarcadores = {
  ultimas_unidades?: ItemEstoque[] // qty <= limiar
  esgotados?: ItemEstoque[] // qty == 0 (agrupados por produto+cor já)
  reposicao?: ItemEstoque[] // voltaram a ter estoque
  novidades?: { product_title: string; cor?: string | null }[]
  reservas_total?: number
  reservas_hoje?: number
  dias_para_envio?: number
}

// "Macaquinho Solaris Telha: só G" / "Top Orvalho Grafitti: P e M"
export function listaPorProdutoCor(itens: ItemEstoque[]): string {
  const grupos = new Map<string, string[]>()
  for (const it of itens) {
    const chave = `${it.product_title}${it.cor ? " " + it.cor : ""}`
    const tam = it.tamanho || ""
    const arr = grupos.get(chave) ?? []
    if (tam && !arr.includes(tam)) arr.push(tam)
    grupos.set(chave, arr)
  }
  return [...grupos.entries()]
    .map(([nome, tams]) => (tams.length ? `${nome}: ${tams.length === 1 ? "só " + tams[0] : juntar(tams)}` : nome))
    .join(" · ")
}

export function juntar(xs: string[]): string {
  if (xs.length <= 1) return xs.join("")
  return `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`
}

function valorMarcador(nome: string, d: DadosMarcadores): string {
  switch (nome) {
    case "ultimas_unidades":
      return d.ultimas_unidades?.length ? listaPorProdutoCor(d.ultimas_unidades) : ""
    case "esgotados":
      return d.esgotados?.length ? listaPorProdutoCor(d.esgotados) : ""
    case "reposicao":
      return d.reposicao?.length ? listaPorProdutoCor(d.reposicao) : ""
    case "novidades":
      return d.novidades?.length
        ? juntar([...new Set(d.novidades.map((n) => `${n.product_title}${n.cor ? " " + n.cor : ""}`))])
        : ""
    case "reservas_total":
      return d.reservas_total != null && d.reservas_total > 0 ? String(d.reservas_total) : ""
    case "reservas_hoje":
      return d.reservas_hoje != null && d.reservas_hoje > 0 ? String(d.reservas_hoje) : ""
    case "dias_para_envio":
      return d.dias_para_envio != null && d.dias_para_envio >= 0 ? String(d.dias_para_envio) : ""
    default:
      return ""
  }
}

const RE_MARCADOR = /\{\{\s*([a-z_]+)\s*\}\}/g
const RE_FOTO = /\{\{\s*foto:([a-z0-9-]+)(?::([^}]+))?\s*\}\}/i

// Extrai {{foto:handle:cor}} do texto (e o remove). Retorna { texto, foto }.
export function extrairFoto(texto: string): { texto: string; foto: { handle: string; cor: string | null } | null } {
  const m = texto.match(RE_FOTO)
  if (!m) return { texto, foto: null }
  return {
    texto: texto.replace(RE_FOTO, "").replace(/[ \t]+\n/g, "\n").trim(),
    foto: { handle: m[1].toLowerCase(), cor: m[2] ? m[2].trim() : null },
  }
}

// Resolve marcadores. Frases com marcador vazio são removidas; linhas que ficarem vazias somem.
export function renderizar(texto: string, d: DadosMarcadores): string {
  const linhas = texto.split("\n")
  const saida: string[] = []
  for (const linha of linhas) {
    if (!RE_MARCADOR.test(linha)) {
      saida.push(linha)
      RE_MARCADOR.lastIndex = 0
      continue
    }
    RE_MARCADOR.lastIndex = 0
    // Quebra a linha em frases (terminadas em . ! ?) para poder apagar só a frase com marcador vazio.
    const frases = linha.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) ?? [linha]
    const mantidas: string[] = []
    for (const frase of frases) {
      let vazio = false
      const resolvida = frase.replace(RE_MARCADOR, (_m, nome: string) => {
        const v = valorMarcador(nome, d)
        if (!v) vazio = true
        return v
      })
      if (!vazio) mantidas.push(resolvida)
    }
    const nova = mantidas.join("").replace(/\s+$/g, "")
    if (nova.trim()) saida.push(nova)
    else if (saida.length && saida[saida.length - 1] !== "") {
      // frase removida inteira: não deixa linha vazia dupla
    }
  }
  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

// Quantos dias faltam de hoje até a data (ISO YYYY-MM-DD), no fuso de São Paulo.
export function diasAte(iso: string, agora = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number)
  const alvo = Date.UTC(y, m - 1, d, 3, 0, 0) // 00:00 em -03:00
  const hoje = agora.getTime()
  return Math.ceil((alvo - hoje) / 86_400_000)
}
