"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  TIPOS_DESCONTO,
  type Curado,
  type TipoDesconto,
  unidadeDoTipo,
  entradaParaValor,
  valorParaEntrada,
  formatarReais,
  validarCurado,
  previaBeneficio,
  alertaEstoque,
  slugConjunto,
} from "@/lib/conjunto"
import UploadImagem from "@/components/upload-imagem"

type CockpitVariant = { price: number | null; stock: number | null }
type CockpitProduct = {
  id: string
  title: string
  status: string
  thumbnail: string | null
  collection: string | null
  collection_id: string | null
  categories: { id: string; name: string }[]
  variants: CockpitVariant[]
}

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const btn =
  "self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"

const HANDLE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SELO: Record<string, { texto: string; cls: string }> = {
  rascunho: { texto: "Rascunho", cls: "bg-eclat-pedra/30 text-eclat-grafite/60" },
  sem_estoque: { texto: "Sem estoque", cls: "bg-red-100 text-red-700" },
  estoque_baixo: { texto: "Estoque baixo · bom para queimar estoque", cls: "bg-amber-100 text-amber-700" },
}

async function apiCall<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || "Falha na operação")
  return d as T
}

function precoMinCentavos(p: CockpitProduct): number | null {
  const precos = p.variants.map((v) => v.price).filter((x): x is number => x != null)
  if (!precos.length) return null
  return Math.round(Math.min(...precos) * 100)
}

function formatarValorRegra(t: TipoDesconto, valor: number): string {
  return unidadeDoTipo(t) === "%" ? `${valor}%` : formatarReais(valor)
}

export default function ConjuntoCurados() {
  const [curados, setCurados] = useState<Curado[]>([])
  const [produtosMap, setProdutosMap] = useState<Map<string, CockpitProduct>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [erroOrdem, setErroOrdem] = useState<string | null>(null)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({})
  const [formAberto, setFormAberto] = useState<{ mode: "create" } | { mode: "edit"; curado: Curado } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarregar(null)
    try {
      const [c, p] = await Promise.all([
        fetch("/api/conjuntos/curados", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/products", { cache: "no-store" }).then((r) => r.json()),
      ])
      if (c?.error) throw new Error(c.error)
      if (!Array.isArray(p)) throw new Error((p as { error?: string })?.error || "Falha ao carregar produtos.")
      setCurados(Array.isArray(c?.curados) ? c.curados : [])
      setProdutosMap(new Map((p as CockpitProduct[]).map((pr) => [pr.id, pr])))
    } catch (e) {
      setErroCarregar((e as Error).message || "Falha ao carregar dados.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const ordenados = useMemo(() => [...curados].sort((a, b) => a.ordem - b.ordem), [curados])

  async function persistirOrdem(nova: Curado[]) {
    const mudados = nova.map((c, i) => ({ c, i })).filter(({ c, i }) => c.ordem !== i)
    try {
      for (const { c, i } of mudados) {
        await apiCall(`/api/conjuntos/curados/${c.id}`, "PUT", { ordem: i })
      }
      setErroOrdem(null)
    } catch (e) {
      // erro inline perto da lista (não usa erroCarregar — esse bloqueia a tela inteira); mostra
      // antes de recarregar, para o dono ver o motivo mesmo se a lista voltar reordenada.
      setErroOrdem((e as Error).message || "Falha ao reordenar.")
    } finally {
      await carregar()
    }
  }

  function onDrop(targetId: string) {
    const origem = dragId
    setDragId(null)
    if (!origem || origem === targetId) return
    const atual = ordenados
    const fromIdx = atual.findIndex((c) => c.id === origem)
    const toIdx = atual.findIndex((c) => c.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const nova = [...atual]
    const [item] = nova.splice(fromIdx, 1)
    nova.splice(toIdx, 0, item)
    setCurados(nova.map((c, i) => ({ ...c, ordem: i })))
    persistirOrdem(nova)
  }

  async function alternarAtivo(c: Curado) {
    setErroLinha((er) => ({ ...er, [c.id]: "" }))
    setCurados((prev) => prev.map((x) => (x.id === c.id ? { ...x, ativo: !x.ativo } : x)))
    try {
      await apiCall(`/api/conjuntos/curados/${c.id}`, "PUT", { ativo: !c.ativo })
    } catch (e) {
      setCurados((prev) => prev.map((x) => (x.id === c.id ? { ...x, ativo: c.ativo } : x)))
      setErroLinha((er) => ({ ...er, [c.id]: (e as Error).message }))
    }
  }

  async function excluir(id: string) {
    setExcluindo(true)
    setErroLinha((er) => ({ ...er, [id]: "" }))
    try {
      await apiCall(`/api/conjuntos/curados/${id}`, "DELETE")
      setConfirmandoExcluir(null)
      await carregar()
    } catch (e) {
      setErroLinha((er) => ({ ...er, [id]: (e as Error).message }))
    } finally {
      setExcluindo(false)
    }
  }

  if (carregando) return <p className="text-sm text-eclat-grafite/50">Carregando…</p>
  if (erroCarregar) return <p className="text-sm text-red-700">{erroCarregar}</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-eclat-grafite/55">Arraste os cards para reordenar como aparecem na vitrine.</p>
        <button onClick={() => setFormAberto({ mode: "create" })} className={btn}>
          + Novo conjunto
        </button>
      </div>

      {erroOrdem && <p className="text-xs text-red-700">{erroOrdem}</p>}

      {ordenados.length === 0 && <p className="text-sm text-eclat-grafite/50">Nenhum conjunto curado ainda.</p>}

      <div className="flex flex-col gap-2">
        {ordenados.map((c) => {
          const pecas = c.product_ids.map((id) => produtosMap.get(id)).filter((p): p is CockpitProduct => !!p)
          return (
            <div
              key={c.id}
              draggable
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(c.id)}
              className="bg-white border border-eclat-pedra/40 rounded-md p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing"
            >
              {c.capa_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.capa_url}
                  alt=""
                  className="w-12 h-12 rounded object-cover border border-eclat-pedra/40 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-eclat-areia flex items-center justify-center text-eclat-grafite/50 font-serif text-lg shrink-0">
                  {c.nome.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-eclat-grafite truncate">{c.nome}</span>
                  <span className="text-xs text-eclat-grafite/40">/{c.handle}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {pecas.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 bg-eclat-areia/50 rounded-full pl-1 pr-2 py-0.5 text-[11px] text-eclat-grafite/70"
                    >
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-eclat-pedra/40" />
                      )}
                      {p.title}
                    </span>
                  ))}
                  {c.product_ids.length > pecas.length && (
                    <span className="text-[11px] text-eclat-grafite/40">
                      +{c.product_ids.length - pecas.length} produto(s) não encontrado(s)
                    </span>
                  )}
                </div>
                <p className="text-xs text-eclat-grafite/55 mt-1">
                  {TIPOS_DESCONTO.find((t) => t.value === c.regra.tipo_desconto)?.label} ·{" "}
                  {formatarValorRegra(c.regra.tipo_desconto, c.regra.valor)}
                </p>
                {erroLinha[c.id] && <p className="text-xs text-red-700 mt-1">{erroLinha[c.id]}</p>}
              </div>
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none shrink-0">
                <input type="checkbox" checked={c.ativo} onChange={() => alternarAtivo(c)} />
                Ativo
              </label>
              <button
                onClick={() => setFormAberto({ mode: "edit", curado: c })}
                className="text-xs text-eclat-dourado underline shrink-0"
              >
                Editar
              </button>
              {confirmandoExcluir === c.id ? (
                <span className="flex items-center gap-2 text-xs shrink-0">
                  <button onClick={() => excluir(c.id)} disabled={excluindo} className="text-red-700 underline disabled:opacity-50">
                    {excluindo ? "Excluindo…" : "Confirmar"}
                  </button>
                  <button onClick={() => setConfirmandoExcluir(null)} className="text-eclat-grafite/50 underline">
                    cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmandoExcluir(c.id)}
                  className="text-xs text-red-700/80 underline shrink-0"
                >
                  Excluir
                </button>
              )}
            </div>
          )
        })}
      </div>

      {formAberto && (
        <CuradoForm
          mode={formAberto.mode}
          curado={formAberto.mode === "edit" ? formAberto.curado : null}
          produtosMap={produtosMap}
          contagemAtual={curados.length}
          onClose={() => setFormAberto(null)}
          onSaved={async () => {
            setFormAberto(null)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function CuradoForm({
  mode,
  curado,
  produtosMap,
  contagemAtual,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  curado: Curado | null
  produtosMap: Map<string, CockpitProduct>
  contagemAtual: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [nome, setNome] = useState(curado?.nome ?? "")
  const [handle, setHandle] = useState(curado?.handle ?? "")
  const [handleTocado, setHandleTocado] = useState(mode === "edit")
  const [capaUrl, setCapaUrl] = useState<string | undefined>(curado?.capa_url ?? undefined)
  const [escolhidos, setEscolhidos] = useState<CockpitProduct[]>(() =>
    (curado?.product_ids ?? []).map((id) => produtosMap.get(id)).filter((p): p is CockpitProduct => !!p)
  )
  // Produtos deste curado que ficaram fora do mapa (limite de 100 do GET /api/products): sem isso,
  // um edit qualquer reenviaria só os `product_ids` resolvidos e apagaria os demais silenciosamente.
  const idsNaoResolvidos = useMemo(
    () => (curado?.product_ids ?? []).filter((id) => !produtosMap.has(id)),
    [curado, produtosMap]
  )
  const [tipo, setTipo] = useState<TipoDesconto>(curado?.regra.tipo_desconto ?? TIPOS_DESCONTO[0].value)
  const [valorTexto, setValorTexto] = useState(
    curado ? valorParaEntrada(curado.regra.tipo_desconto, curado.regra.valor) : ""
  )
  const [ativo, setAtivo] = useState(curado?.ativo ?? true)

  const [busca, setBusca] = useState("")
  const [resultados, setResultados] = useState<CockpitProduct[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState<string | null>(null)

  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // handle acompanha o nome até o usuário editar manualmente — só na criação (imutável depois).
  useEffect(() => {
    if (mode === "create" && !handleTocado) setHandle(slugConjunto(nome))
  }, [nome, handleTocado, mode])

  // busca de produtos com debounce 300ms
  useEffect(() => {
    const termo = busca.trim()
    if (!termo) {
      setResultados([])
      setErroBusca(null)
      setBuscando(false)
      return
    }
    setBuscando(true)
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products?q=${encodeURIComponent(termo)}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const d = await r.json()
        if (!r.ok) throw new Error((d as { error?: string })?.error || "Falha ao buscar produtos.")
        setResultados(Array.isArray(d) ? d : [])
        setErroBusca(null)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setErroBusca((e as Error).message)
        setResultados([])
      } finally {
        if (!controller.signal.aborted) setBuscando(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [busca])

  function adicionar(p: CockpitProduct) {
    setEscolhidos((prev) => (prev.some((e) => e.id === p.id) ? prev : [...prev, p]))
  }
  function remover(id: string) {
    setEscolhidos((prev) => prev.filter((p) => p.id !== id))
  }

  // Preserva os ids não resolvidos ao salvar (dedupe defensivo — não deveriam colidir com `escolhidos`).
  const productIds = Array.from(new Set([...escolhidos.map((p) => p.id), ...idsNaoResolvidos]))
  const erroValidacao = validarCurado({ nome, product_ids: productIds, tipo_desconto: tipo, valorTexto })
  const erroHandle =
    mode === "create" && handle.trim() && !HANDLE_REGEX.test(handle.trim())
      ? "Handle inválido: use letras minúsculas, números e hífen (ex.: conjunto-verao)."
      : null
  const valorNumerico = entradaParaValor(tipo, valorTexto)

  const precos = escolhidos.map((p) => precoMinCentavos(p)).filter((x): x is number => x != null)
  const previa =
    valorNumerico !== null && precos.length > 0 && precos.length === escolhidos.length
      ? previaBeneficio(tipo, valorNumerico, precos)
      : null

  async function salvar() {
    setTentouSalvar(true)
    if (erroValidacao || erroHandle || valorNumerico === null) return
    setSalvando(true)
    setErro(null)
    try {
      if (mode === "create") {
        await apiCall("/api/conjuntos/curados", "POST", {
          nome: nome.trim(),
          handle: handle.trim() || undefined,
          capa_url: capaUrl || null,
          product_ids: productIds,
          tipo_desconto: tipo,
          valor: valorNumerico,
          ativo,
          // Novo conjunto entra no fim da lista de exibição da vitrine; PUT (edição) nunca manda
          // `ordem` — só muda via arrastar (persistirOrdem), para não sobrescrever reordenações.
          ordem: contagemAtual,
        })
      } else if (curado) {
        await apiCall(`/api/conjuntos/curados/${curado.id}`, "PUT", {
          nome: nome.trim(),
          capa_url: capaUrl || null,
          product_ids: productIds,
          tipo_desconto: tipo,
          valor: valorNumerico,
          ativo,
        })
      }
      await onSaved()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-eclat-luz overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-eclat-luz border-b border-eclat-pedra/30 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-serif text-2xl text-eclat-grafite">
            {mode === "create" ? "Novo conjunto curado" : "Editar conjunto"}
          </h2>
          <button onClick={onClose} className="text-eclat-grafite/50 hover:text-eclat-grafite text-xl">
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>
          )}

          <div>
            <label className={label}>Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={input} />
          </div>

          <div>
            <label className={label}>
              Handle (URL) {mode === "edit" && <span className="normal-case text-eclat-grafite/40">(fixo após criação)</span>}
            </label>
            <input
              value={handle}
              disabled={mode === "edit"}
              onChange={(e) => {
                setHandleTocado(true)
                setHandle(e.target.value)
              }}
              className={input + (mode === "edit" ? " opacity-60 cursor-not-allowed" : "")}
            />
            {mode === "create" && erroHandle && <p className="text-xs text-red-700 mt-1">{erroHandle}</p>}
          </div>

          <div>
            <label className={label}>Capa</label>
            <UploadImagem url={capaUrl} onChange={setCapaUrl} />
          </div>

          <div>
            <label className={label}>Produtos ({escolhidos.length} escolhido(s) — mínimo 2)</label>
            {idsNaoResolvidos.length > 0 && (
              <p className="text-xs text-amber-700 mb-2">
                {idsNaoResolvidos.length} produto(s) deste conjunto estão fora da lista carregada (limite de 100) e
                serão mantidos.
              </p>
            )}
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto por nome…"
              className={input}
            />
            {buscando && <p className="text-xs text-eclat-grafite/50 mt-1">Buscando…</p>}
            {erroBusca && <p className="text-xs text-red-700 mt-1">{erroBusca}</p>}
            {resultados.length > 0 && (
              <div className="border border-eclat-pedra/40 rounded-md mt-2 divide-y divide-eclat-pedra/15 bg-white max-h-56 overflow-y-auto">
                {resultados.map((p) => {
                  const selo = alertaEstoque(p)
                  const jaEscolhido = escolhidos.some((e) => e.id === p.id)
                  const bloqueado = selo === "rascunho"
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={bloqueado || jaEscolhido}
                      onClick={() => adicionar(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-eclat-areia/30 disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt="" className="w-8 h-8 rounded object-cover border border-eclat-pedra/30 shrink-0" />
                      ) : (
                        <span className="w-8 h-8 rounded bg-eclat-areia shrink-0" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-eclat-grafite">{p.title}</span>
                        <span className="block text-xs text-eclat-grafite/50 truncate">
                          {p.collection || "sem coleção"}
                        </span>
                      </span>
                      {selo && (
                        <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${SELO[selo].cls}`}>
                          {SELO[selo].texto}
                        </span>
                      )}
                      {jaEscolhido && <span className="text-[10px] text-eclat-grafite/40 shrink-0">já escolhido</span>}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-3">
              {escolhidos.map((p) => {
                const preco = precoMinCentavos(p)
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-eclat-areia/40 rounded-md px-3 py-2">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail} alt="" className="w-8 h-8 rounded object-cover border border-eclat-pedra/30 shrink-0" />
                    ) : (
                      <span className="w-8 h-8 rounded bg-eclat-pedra/30 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 text-sm text-eclat-grafite truncate">{p.title}</span>
                    <span className="text-xs text-eclat-grafite/50 shrink-0">
                      {preco != null ? `a partir de ${formatarReais(preco)}` : "sem preço"}
                    </span>
                    <button onClick={() => remover(p.id)} className="text-eclat-grafite/50 hover:text-red-700 shrink-0">
                      ×
                    </button>
                  </div>
                )
              })}
              {escolhidos.length === 0 && <p className="text-xs text-eclat-grafite/40">Nenhum produto escolhido ainda.</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Tipo de desconto</label>
              <select
                value={tipo}
                onChange={(e) => {
                  // trocar o tipo limpa o valor: 20 (%) não pode virar R$ 20,00 por acidente
                  setTipo(e.target.value as TipoDesconto)
                  setValorTexto("")
                }}
                className={input}
              >
                {TIPOS_DESCONTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Valor</label>
              <div className="flex items-center gap-2">
                <input
                  value={valorTexto}
                  onChange={(e) => setValorTexto(e.target.value)}
                  placeholder={unidadeDoTipo(tipo) === "%" ? "ex.: 15" : "ex.: 45,90"}
                  className={input}
                />
                <span className="text-xs text-eclat-grafite/50 shrink-0">{unidadeDoTipo(tipo)}</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span className="text-eclat-grafite/70">Ativo</span>
          </label>

          <div className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-4 flex items-center gap-3">
            {capaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capaUrl} alt="" className="w-16 h-16 rounded object-cover border border-eclat-pedra/40 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded bg-eclat-areia flex items-center justify-center text-eclat-grafite/50 font-serif text-xl shrink-0">
                {(nome || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-eclat-grafite">{nome || "Nome do conjunto"}</p>
              {previa ? (
                <p className="text-xs text-eclat-grafite/70">
                  a partir de <strong className="text-eclat-grafite">{formatarReais(previa.final)}</strong>
                </p>
              ) : (
                <p className="text-xs text-eclat-grafite/40">Escolha produtos e um valor válido para ver a prévia.</p>
              )}
            </div>
          </div>

          {tentouSalvar && erroValidacao && <p className="text-xs text-red-700">{erroValidacao}</p>}
          {tentouSalvar && mode === "create" && erroHandle && <p className="text-xs text-red-700">{erroHandle}</p>}

          <div className="flex gap-3 pt-2 pb-8">
            <button onClick={salvar} disabled={salvando} className={btn}>
              {salvando ? "Salvando…" : mode === "create" ? "Criar conjunto" : "Salvar alterações"}
            </button>
            <button onClick={onClose} className="text-sm text-eclat-grafite/60 underline">
              cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
