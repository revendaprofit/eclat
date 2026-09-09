"use client"

// Painel só-leitura "Conjuntos" na ficha do produto (spec Benefício Conjunto §8.3, Task 5 F2).
// Carrega por-produto/regras/pares/produtos/categorias e mostra: parceiras (par de coleção),
// conjuntos curados, e — quando os dois estão vazios — o motivo inferido no cliente (o backend
// não devolve motivo). A coleção/categorias do produto visto vêm do próprio formulário (props),
// nunca do mapa `/api/products` (que é limitado a 100 itens e pode não conter o produto atual).
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type { Regra, Par, Curado, TipoDesconto } from "@/lib/conjunto"
import { TIPOS_DESCONTO, formatarReais, motivoSemConjunto, raizDeCategoria, valorParaEntrada } from "@/lib/conjunto"

type ProdutoLista = {
  id: string
  title: string
  thumbnail: string | null
  collection_id: string | null
  categories: { id: string; name: string }[]
}
type Categoria = { id: string; name: string; handle: string; parent_id: string | null; is_active: boolean }
type Parceira = { product_id: string; categoria_raiz: string; collection_id: string }
type CuradoWire = Array<Omit<Curado, "regra"> & { regra: { tipo_desconto: TipoDesconto; valor: number } }>

type Dados = {
  parceiras: Parceira[]
  curados: CuradoWire
  regras: Regra[]
  pares: Par[]
  produtos: ProdutoLista[]
  categorias: Categoria[]
}

const labelCls = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"

// Usada só para o nome de exibição das parceiras (título/miniatura ficam no mapa de `/api/products`
// mesmo — a limitação de 100 itens só afeta o fallback visual dessas linhas, nunca o motivo inferido).
const nomeDaRaiz = (handle: string, categorias: Categoria[]) => categorias.find((c) => c.handle === handle)?.name ?? handle

// Lê o body de erro com segurança: se não for JSON válido (ex.: HTML de um 502), cai no status HTTP.
async function erroDe(r: Response, fallback: string): Promise<string> {
  try {
    const d = await r.json()
    return d?.error || fallback
  } catch {
    return `HTTP ${r.status}`
  }
}

export default function ConjuntoProdutoPanel({
  productId,
  collectionId,
  categoryIds,
}: {
  productId: string
  collectionId: string | null
  categoryIds: string[]
}) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // `aindaAtivo` é fornecido pelo efeito (ou `() => true` pelo botão "tentar novamente"); evita
  // aplicar uma resposta atrasada depois que `productId` mudou ou o componente desmontou.
  const carregar = useCallback(
    async (aindaAtivo: () => boolean) => {
      setErro(null)
      try {
        const [porProdutoR, regrasR, paresR, produtosR, categoriasR] = await Promise.all([
          fetch(`/api/conjuntos/por-produto/${productId}`, { cache: "no-store" }),
          fetch(`/api/conjuntos/regras`, { cache: "no-store" }),
          fetch(`/api/conjuntos/pares`, { cache: "no-store" }),
          fetch(`/api/products`, { cache: "no-store" }),
          fetch(`/api/taxonomy/categories`, { cache: "no-store" }),
        ])
        if (!porProdutoR.ok) throw new Error(await erroDe(porProdutoR, "Falha ao carregar conjuntos do produto"))
        if (!regrasR.ok) throw new Error(await erroDe(regrasR, "Falha ao carregar regras"))
        if (!paresR.ok) throw new Error(await erroDe(paresR, "Falha ao carregar pares"))
        if (!produtosR.ok) throw new Error(await erroDe(produtosR, "Falha ao carregar produtos"))
        if (!categoriasR.ok) throw new Error(await erroDe(categoriasR, "Falha ao carregar categorias"))
        const [porProdutoD, regrasD, paresD, produtosD, categoriasD] = await Promise.all([
          porProdutoR.json(),
          regrasR.json(),
          paresR.json(),
          produtosR.json(),
          categoriasR.json(),
        ])
        if (!aindaAtivo()) return
        setDados({
          parceiras: porProdutoD.parceiras ?? [],
          curados: porProdutoD.curados ?? [],
          regras: regrasD.regras ?? [],
          pares: paresD.pares ?? [],
          produtos: produtosD ?? [],
          categorias: categoriasD ?? [],
        })
      } catch (e) {
        if (!aindaAtivo()) return
        setErro((e as Error).message || "Falha ao carregar conjuntos do produto")
      }
    },
    [productId]
  )

  useEffect(() => {
    let ativo = true
    setDados(null)
    setErro(null)
    carregar(() => ativo)
    return () => {
      ativo = false
    }
  }, [carregar])

  if (erro)
    return (
      <div>
        <label className={labelCls}>Conjuntos</label>
        <div className="text-xs text-red-700 flex items-center gap-2">
          <span>{erro}</span>
          <button onClick={() => carregar(() => true)} className="underline">tentar novamente</button>
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
  const categoriaRaiz = raizDeCategoria(dados.categorias, categoryIds)
  const motivo = semNada
    ? motivoSemConjunto({
        collection_id: collectionId,
        categoria_raiz: categoriaRaiz,
        regras: dados.regras,
        pares: dados.pares,
        temParceiras: false,
      })
    : null

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

      {semNada && motivo && <p className="text-xs text-amber-700">{motivo}</p>}
    </div>
  )
}
