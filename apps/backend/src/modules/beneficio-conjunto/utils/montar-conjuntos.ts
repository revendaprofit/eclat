// Núcleo do Benefício Conjunto (spec §5). Puro: sem I/O, sem Medusa. Centavos inteiros.
import type { ConjuntoFormado, Curado, Linha, Oportunidade, Par, Regra, ResultadoMontagem } from "./tipos"

type Unidade = { uid: string; item_id: string; product_id: string; collection_id: string | null; categoria_raiz: string | null; preco: number }

const porPrecoDesc = (a: Unidade, b: Unidade) => b.preco - a.preco || a.uid.localeCompare(b.uid)
const porPrecoAsc = (a: Unidade, b: Unidade) => a.preco - b.preco || a.uid.localeCompare(b.uid)

// Acima disso o número de permutações (n!) explode; cai para a ordem cadastrada (spec §2.6, ruling P3).
const MAX_PARES_PERMUTAVEIS = 6

export function regraEfetiva(regras: Regra[], collection_id: string | null): Regra | null {
  if (!collection_id) return null
  const excecao = regras.find((r) => r.escopo === "colecao" && r.collection_id === collection_id)
  if (excecao) return excecao.ativa ? excecao : null
  const padrao = regras.find((r) => r.escopo === "padrao")
  return padrao?.ativa ? padrao : null
}

// Desconto por unidade de um conjunto, na ordem dos preços recebidos. Nunca passa do preço da unidade.
export function descontoDoConjunto(regra: Regra, precos: number[]): number[] {
  const n = precos.length
  const zeros = precos.map(() => 0)
  if (!n) return zeros
  const idxMin = precos.reduce((m, p, i) => (p < precos[m] ? i : m), 0)
  switch (regra.tipo_desconto) {
    case "menor_peca_percentual": {
      const d = zeros.slice(); d[idxMin] = Math.min(precos[idxMin], Math.round((precos[idxMin] * regra.valor) / 100)); return d
    }
    case "menor_peca_valor": {
      const d = zeros.slice(); d[idxMin] = Math.min(precos[idxMin], regra.valor); return d
    }
    case "total_percentual":
      return precos.map((p) => Math.min(p, Math.round((p * regra.valor) / 100)))
    case "total_valor": {
      const porUnidade = Math.round(regra.valor / n)
      return precos.map((p) => Math.min(p, porUnidade))
    }
  }
}

function expandir(linhas: Linha[]): Unidade[] {
  const out: Unidade[] = []
  for (const l of linhas) for (let i = 0; i < l.quantidade; i++) out.push({ uid: `${l.item_id}#${i}`, item_id: l.item_id, product_id: l.product_id, collection_id: l.collection_id, categoria_raiz: l.categoria_raiz, preco: l.preco_unitario })
  return out
}

function fechar(id: string, tipo: ConjuntoFormado["tipo"], regra: Regra, unidades: Unidade[]): ConjuntoFormado {
  const descontos = descontoDoConjunto(regra, unidades.map((u) => u.preco))
  return { id, tipo, regra_id: regra.id, unidades: unidades.map((u, i) => ({ item_id: u.item_id, product_id: u.product_id, preco_unitario: u.preco, desconto_unitario: descontos[i] })) }
}

// Todas as ordens (permutações) possíveis de uma lista de pares.
function permutar<T>(itens: T[]): T[][] {
  if (itens.length <= 1) return [itens.slice()]
  const out: T[][] = []
  for (let i = 0; i < itens.length; i++) {
    const resto = [...itens.slice(0, i), ...itens.slice(i + 1)]
    for (const p of permutar(resto)) out.push([itens[i], ...p])
  }
  return out
}

type ParConjunto = { par: Par; unidades: [Unidade, Unidade] }

// Passada gulosa de pareamento (ruling 5) numa ordem fixa de pares, sobre uma cópia livre das
// unidades da coleção — não muta `unidadesLivresDaColecao`. Devolve os conjuntos formados
// (ainda sem desconto/id — só as unidades pareadas) e o conjunto das unidades consumidas.
function parearOrdem(unidadesLivresDaColecao: Unidade[], ordemDePares: Par[]): { conjuntos: ParConjunto[]; consumidas: Set<Unidade> } {
  const disponiveis = new Set(unidadesLivresDaColecao)
  const conjuntos: ParConjunto[] = []
  for (const par of ordemDePares) {
    const ladoA = Array.from(disponiveis).filter((u) => u.categoria_raiz === par.categoria_a).sort(porPrecoDesc)
    const ladoB = Array.from(disponiveis).filter((u) => u.categoria_raiz === par.categoria_b).sort(porPrecoDesc)
    const n = Math.min(ladoA.length, ladoB.length)
    for (let i = 0; i < n; i++) {
      disponiveis.delete(ladoA[i]); disponiveis.delete(ladoB[i])
      conjuntos.push({ par, unidades: [ladoA[i], ladoB[i]] })
    }
  }
  const consumidas = new Set(unidadesLivresDaColecao.filter((u) => !disponiveis.has(u)))
  return { conjuntos, consumidas }
}

// Desconto total (soma de todas as unidades) que uma ordem de pareamento gera, para comparar ordens.
function totalDescontoDaOrdem(conjuntos: ParConjunto[], regra: Regra): number {
  return conjuntos.reduce((soma, c) => soma + descontoDoConjunto(regra, c.unidades.map((u) => u.preco)).reduce((a, b) => a + b, 0), 0)
}

export function montarConjuntos(linhas: Linha[], regras: Regra[], pares: Par[], curados: Curado[]): ResultadoMontagem {
  const livres = new Set(expandir(linhas))
  const conjuntos: ConjuntoFormado[] = []
  let seq = 0

  // 1) Curados primeiro, na ordem cadastrada; consomem as unidades mais baratas de cada produto.
  for (const cur of curados.filter((c) => c.ativo).sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))) {
    const regra = regras.find((r) => r.id === cur.regra_id)
    if (!regra?.ativa) continue
    for (;;) {
      const escolhidas: Unidade[] = []
      for (const pid of cur.product_ids) {
        const cand = Array.from(livres).filter((u) => u.product_id === pid && !escolhidas.includes(u)).sort(porPrecoAsc)[0]
        if (!cand) break
        escolhidas.push(cand)
      }
      if (escolhidas.length < cur.product_ids.length) break
      escolhidas.forEach((u) => livres.delete(u))
      conjuntos.push(fechar(`${cur.id}#${seq++}`, "curado", regra, escolhidas))
    }
  }

  // 2) Pares de coleção: por coleção, testamos todas as ordens de processamento dos pares ativos
  // (spec §2.6, ruling P3) e escolhemos a que forma mais conjuntos; empate → maior desconto total;
  // empate → ordem lexicograficamente menor (chave `${categoria_a}+${categoria_b}` unidas por "|").
  // Cada ordem roda o pareamento guloso (ruling 5) sobre uma cópia livre das unidades da coleção.
  const colecoes = Array.from(new Set(Array.from(livres).map((u) => u.collection_id).filter((c): c is string => !!c))).sort()
  const oportunidades: Oportunidade[] = []
  let avisouLimitePares = false
  for (const col of colecoes) {
    const regra = regraEfetiva(regras, col)
    if (!regra) continue
    const paresAtivos = pares.filter((p) => p.ativo)
    if (paresAtivos.length > 0) {
      const unidadesColecao = Array.from(livres).filter((u) => u.collection_id === col)
      let ordens: Par[][]
      if (paresAtivos.length > MAX_PARES_PERMUTAVEIS) {
        if (!avisouLimitePares) {
          console.warn(`montarConjuntos: ${paresAtivos.length} pares ativos excede o limite de ${MAX_PARES_PERMUTAVEIS} para testar todas as ordens; usando a ordem cadastrada.`)
          avisouLimitePares = true
        }
        ordens = [paresAtivos]
      } else {
        ordens = permutar(paresAtivos)
      }

      let melhor: { conjuntos: ParConjunto[]; totalDesconto: number; chave: string } | null = null
      for (const ordem of ordens) {
        const { conjuntos: conjuntosDaOrdem } = parearOrdem(unidadesColecao, ordem)
        const totalDesconto = totalDescontoDaOrdem(conjuntosDaOrdem, regra)
        const chave = ordem.map((p) => `${p.categoria_a}+${p.categoria_b}`).join("|")
        const vence =
          !melhor ||
          conjuntosDaOrdem.length > melhor.conjuntos.length ||
          (conjuntosDaOrdem.length === melhor.conjuntos.length &&
            (totalDesconto > melhor.totalDesconto || (totalDesconto === melhor.totalDesconto && chave < melhor.chave)))
        if (vence) melhor = { conjuntos: conjuntosDaOrdem, totalDesconto, chave }
      }

      if (melhor) {
        for (const { par, unidades } of melhor.conjuntos) {
          livres.delete(unidades[0]); livres.delete(unidades[1])
          conjuntos.push(fechar(`${col}:${par.categoria_a}+${par.categoria_b}#${seq++}`, "colecao", regra, unidades))
        }
      }
    }
    // 3) Oportunidades: unidade livre de um lado do par sem parceira do outro lado.
    for (const par of pares.filter((p) => p.ativo)) {
      for (const [de, falta] of [[par.categoria_a, par.categoria_b], [par.categoria_b, par.categoria_a]] as const) {
        const sobra = Array.from(livres).filter((u) => u.collection_id === col && u.categoria_raiz === de).sort(porPrecoAsc)[0]
        if (!sobra) continue
        if (oportunidades.some((o) => o.collection_id === col && o.categoria_faltante === falta)) continue
        oportunidades.push({ collection_id: col, categoria_faltante: falta, a_partir_do_item_id: sobra.item_id })
      }
    }
  }
  return { conjuntos, oportunidades }
}
