"use client"

// Painel só-leitura "Conjuntos" na ficha do produto (spec Benefício Conjunto §8.3, Task 5 F2).
// Carrega por-produto/regras/pares/produtos/categorias e mostra: parceiras (par de coleção),
// conjuntos curados, e — quando os dois estão vazios — o motivo inferido no cliente (o backend
// não devolve motivo).
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type { Regra, Par, Curado } from "@/lib/conjunto"
import { TIPOS_DESCONTO, formatarReais, valorParaEntrada } from "@/lib/conjunto"

type ProdutoLista = {
  id: string
  title: string
  thumbnail: string | null
  collection_id: string | null
  categories: { id: string; name: string }[]
}
type Categoria = { id: string; name: string; handle: string; parent_id: string | null; is_active: boolean }
type Parceira = { product_id: string; categoria_raiz: string; collection_id: string }

type Dados = {
  parceiras: Parceira[]
  curados: Curado[]
  regras: Regra[]
  pares: Par[]
  produtos: ProdutoLista[]
  categorias: Categoria[]
}

const labelCls = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"

// Sobe a árvore (parent_id) até a raiz e devolve o handle dela — mesma regra do backend
// (raizPorCategoria em apps/backend/.../beneficio-conjunto/utils/categorias.ts).
function raizHandle(categoryId: string | undefined, porId: Map<string, Categoria>): string | null {
  if (!categoryId) return null
  let atual = porId.get(categoryId)
  if (!atual) return null
  let guarda = 0
  while (atual.parent_id && porId.has(atual.parent_id) && guarda++ < 20) atual = porId.get(atual.parent_id)!
  return atual.handle
}
const nomeDaRaiz = (handle: string, categorias: Categoria[]) => categorias.find((c) => c.handle === handle)?.name ?? handle

// Mesma lógica de `regraEfetiva` do backend: exceção de coleção (ativa ou não) manda; senão a padrão.
function temBeneficioAtivo(regras: Regra[], collectionId: string): boolean {
  const excecao = regras.find((r) => r.escopo === "colecao" && r.collection_id === collectionId)
  if (excecao) return excecao.ativa
  const padrao = regras.find((r) => r.escopo === "padrao")
  return !!padrao?.ativa
}

function motivoVazio(d: Dados, productId: string): string {
  const atual = d.produtos.find((p) => p.id === productId)
  const collectionId = atual?.collection_id ?? null
  if (!collectionId) return "Produto sem coleção: não forma conjunto de coleção"
  if (!temBeneficioAtivo(d.regras, collectionId)) return "Coleção sem benefício ativo"
  const porId = new Map(d.categorias.map((c) => [c.id, c]))
  const categoriaRaiz = raizHandle(atual?.categories?.[0]?.id, porId)
  const participa = !!categoriaRaiz && d.pares.some((p) => p.ativo && (p.categoria_a === categoriaRaiz || p.categoria_b === categoriaRaiz))
  if (!participa) return "Categoria não participa dos pares permitidos"
  return "Nenhuma peça parceira publicada nesta coleção"
}

export default function ConjuntoProdutoPanel({ productId }: { productId: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const [porProdutoR, regrasR, paresR, produtosR, categoriasR] = await Promise.all([
        fetch(`/api/conjuntos/por-produto/${productId}`, { cache: "no-store" }),
        fetch(`/api/conjuntos/regras`, { cache: "no-store" }),
        fetch(`/api/conjuntos/pares`, { cache: "no-store" }),
        fetch(`/api/products`, { cache: "no-store" }),
        fetch(`/api/taxonomy/categories`, { cache: "no-store" }),
      ])
      const [porProdutoD, regrasD, paresD, produtosD, categoriasD] = await Promise.all([
        porProdutoR.json(),
        regrasR.json(),
        paresR.json(),
        produtosR.json(),
        categoriasR.json(),
      ])
      if (!porProdutoR.ok) throw new Error(porProdutoD.error || "Falha ao carregar conjuntos do produto")
      if (!regrasR.ok) throw new Error(regrasD.error || "Falha ao carregar regras")
      if (!paresR.ok) throw new Error(paresD.error || "Falha ao carregar pares")
      if (!produtosR.ok) throw new Error(produtosD.error || "Falha ao carregar produtos")
      if (!categoriasR.ok) throw new Error(categoriasD.error || "Falha ao carregar categorias")
      setDados({
        parceiras: porProdutoD.parceiras ?? [],
        curados: porProdutoD.curados ?? [],
        regras: regrasD.regras ?? [],
        pares: paresD.pares ?? [],
        produtos: produtosD ?? [],
        categorias: categoriasD ?? [],
      })
    } catch (e) {
      setErro((e as Error).message || "Falha ao carregar conjuntos do produto")
    }
  }, [productId])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro)
    return (
      <div>
        <label className={labelCls}>Conjuntos</label>
        <div className="text-xs text-red-700 flex items-center gap-2">
          <span>{erro}</span>
          <button onClick={() => carregar()} className="underline">tentar novamente</button>
        </div>
      </div>
    )
  if (!dados)
    return (
      <div>
        <label className={labelCls}>Conjuntos</label>
        <p className="text-xs text-eclat-grafite/50">Carregando conjuntos…</p>
      </div>
    )

  const produtosMapa = new Map(dados.produtos.map((p) => [p.id, p]))
  const parceiras = dados.parceiras.map((par) => ({
    id: par.product_id,
    titulo: produtosMapa.get(par.product_id)?.title ?? par.product_id,
    thumbnail: produtosMapa.get(par.product_id)?.thumbnail ?? null,
    categoriaNome: nomeDaRaiz(par.categoria_raiz, dados.categorias),
  }))
  const semNada = !parceiras.length && !dados.curados.length

  return (
    <div className="border border-eclat-pedra/40 rounded-lg p-4 bg-white/60 flex flex-col gap-3">
      <h3 className="text-sm font-medium text-eclat-grafite">Conjuntos</h3>

      <div>
        <label className={labelCls}>Forma par com</label>
        {parceiras.length ? (
          <ul className="flex flex-col gap-2">
            {parceiras.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-eclat-grafite">
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" className="w-8 h-8 rounded object-cover border border-eclat-pedra/40" />
                ) : (
                  <span className="w-8 h-8 rounded bg-eclat-pedra/20 flex-shrink-0" />
                )}
                <span>{p.titulo}</span>
                <span className="text-xs text-eclat-grafite/50">· {p.categoriaNome}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-eclat-grafite/50">Nenhuma peça parceira.</p>
        )}
      </div>

      <div>
        <label className={labelCls}>Está nos conjuntos curados</label>
        {dados.curados.length ? (
          <ul className="flex flex-col gap-2 mb-1">
            {dados.curados.map((c) => {
              const tipo = TIPOS_DESCONTO.find((t) => t.value === c.regra.tipo_desconto)
              const valorLabel =
                tipo?.unidade === "%" ? `${valorParaEntrada(c.regra.tipo_desconto, c.regra.valor)}%` : formatarReais(c.regra.valor)
              return (
                <li key={c.id} className="text-sm text-eclat-grafite flex flex-col">
                  <span>{c.nome}</span>
                  <span className="text-xs text-eclat-grafite/50">
                    {tipo?.label ?? c.regra.tipo_desconto} — {valorLabel}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-eclat-grafite/50 mb-1">Não faz parte de conjuntos curados.</p>
        )}
        <Link href="/conjuntos?aba=curados" className="text-xs text-eclat-dourado underline">
          ver conjuntos curados
        </Link>
      </div>

      {semNada && <p className="text-xs text-amber-700">{motivoVazio(dados, productId)}</p>}
    </div>
  )
}
