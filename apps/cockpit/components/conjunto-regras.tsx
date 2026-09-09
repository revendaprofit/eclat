"use client"

import { useCallback, useEffect, useState } from "react"
import {
  TIPOS_DESCONTO,
  type Regra,
  type Par,
  type TipoDesconto,
  unidadeDoTipo,
  entradaParaValor,
  valorParaEntrada,
  formatarReais,
  validarRegra,
  previaBeneficio,
} from "@/lib/conjunto"

type Coll = { id: string; title: string; handle: string }
type Cat = {
  id: string
  name: string
  handle: string
  parent_id: string | null
  rank: number
  metadata: Record<string, unknown>
  is_active: boolean
}

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const btn =
  "self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"

// prévia fixa da spec: Top R$ 189,00 + Legging R$ 259,00
const PRECOS_EXEMPLO = [18900, 25900]

async function apiCall<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || "Falha na operação")
  return d as T
}

export default function ConjuntoRegras() {
  const [regras, setRegras] = useState<Regra[]>([])
  const [pares, setPares] = useState<Par[]>([])
  const [colecoes, setColecoes] = useState<Coll[]>([])
  const [categorias, setCategorias] = useState<Cat[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarregar(null)
    try {
      const [r, p, c, cat] = await Promise.all([
        fetch("/api/conjuntos/regras", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/conjuntos/pares", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/taxonomy/collections", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/taxonomy/categories", { cache: "no-store" }).then((res) => res.json()),
      ])
      if (r?.error) throw new Error(r.error)
      if (p?.error) throw new Error(p.error)
      if (!Array.isArray(c)) throw new Error((c as { error?: string })?.error || "Falha ao carregar coleções.")
      if (!Array.isArray(cat)) throw new Error((cat as { error?: string })?.error || "Falha ao carregar categorias.")
      setRegras(Array.isArray(r?.regras) ? r.regras : [])
      setPares(Array.isArray(p?.pares) ? p.pares : [])
      setColecoes(c)
      setCategorias(cat)
    } catch (e) {
      setErroCarregar((e as Error).message || "Falha ao carregar dados.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const recarregarRegras = useCallback(async () => {
    const d = await fetch("/api/conjuntos/regras", { cache: "no-store" }).then((res) => res.json())
    if (Array.isArray(d?.regras)) setRegras(d.regras)
  }, [])

  if (carregando) return <p className="text-sm text-eclat-grafite/50">Carregando…</p>
  if (erroCarregar) return <p className="text-sm text-red-700">{erroCarregar}</p>

  const categoriasRaiz = categorias.filter((c) => c.parent_id === null && c.is_active)
  const regraPadrao = regras.find((r) => r.escopo === "padrao") ?? null

  return (
    <div className="flex flex-col gap-8">
      <BlocoPadrao regra={regraPadrao} onSalvo={recarregarRegras} />
      <BlocoExcecoes regras={regras} colecoes={colecoes} onSalvo={recarregarRegras} />
      <BlocoPares pares={pares} categoriasRaiz={categoriasRaiz} onSalvo={setPares} />
      <BlocoReconciliar />
    </div>
  )
}

function BlocoPadrao({
  regra,
  onSalvo,
}: {
  regra: Regra | null
  onSalvo: () => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoDesconto>(regra?.tipo_desconto ?? TIPOS_DESCONTO[0].value)
  const [valorTexto, setValorTexto] = useState(
    regra ? valorParaEntrada(regra.tipo_desconto, regra.valor) : ""
  )
  const [ativa, setAtiva] = useState(regra?.ativa ?? true)
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setTipo(regra?.tipo_desconto ?? TIPOS_DESCONTO[0].value)
    setValorTexto(regra ? valorParaEntrada(regra.tipo_desconto, regra.valor) : "")
    setAtiva(regra?.ativa ?? true)
    setTentouSalvar(false)
    setErro(null)
  }, [regra])

  const erroValidacao = validarRegra({ nome: "Benefício padrão", tipo_desconto: tipo, valorTexto })
  const valorNumerico = entradaParaValor(tipo, valorTexto)
  const previa = valorNumerico !== null ? previaBeneficio(tipo, valorNumerico, PRECOS_EXEMPLO) : null

  async function salvar() {
    setTentouSalvar(true)
    if (erroValidacao || valorNumerico === null) return
    setSalvando(true)
    setErro(null)
    try {
      if (regra) {
        await apiCall(`/api/conjuntos/regras/${regra.id}`, "PUT", {
          tipo_desconto: tipo,
          valor: valorNumerico,
          ativa,
        })
      } else {
        await apiCall("/api/conjuntos/regras", "POST", {
          nome: "Benefício padrão",
          escopo: "padrao",
          tipo_desconto: tipo,
          valor: valorNumerico,
          ativa,
        })
      }
      await onSalvo()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4">
      <h2 className="font-serif text-xl text-eclat-grafite">Benefício padrão</h2>
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
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
        <span className="text-eclat-grafite/70">Ativo</span>
      </label>
      {!ativa && (
        <p className="text-xs text-eclat-dourado bg-eclat-dourado/10 rounded px-3 py-2">
          Benefício desligado: a vitrine não mostra conjuntos nem aplica desconto.
        </p>
      )}
      {previa ? (
        <p className="text-xs text-eclat-grafite/70">
          Exemplo: Top {formatarReais(PRECOS_EXEMPLO[0])} + Legging {formatarReais(PRECOS_EXEMPLO[1])} → cliente
          paga <strong className="text-eclat-grafite">{formatarReais(previa.final)}</strong> (economia{" "}
          {formatarReais(previa.economia)})
        </p>
      ) : (
        <p className="text-xs text-eclat-grafite/40">Informe um valor válido para ver a prévia.</p>
      )}
      {tentouSalvar && erroValidacao && <p className="text-xs text-red-700">{erroValidacao}</p>}
      {erro && <p className="text-xs text-red-700">{erro}</p>}
      <button onClick={salvar} disabled={salvando} className={btn}>
        {salvando ? "Salvando…" : regra ? "Salvar" : "Criar benefício padrão"}
      </button>
    </section>
  )
}

type ExcecaoForm = { tipo: TipoDesconto; valorTexto: string; ativa: boolean }
const excecaoFormPadrao: ExcecaoForm = { tipo: TIPOS_DESCONTO[0].value, valorTexto: "", ativa: true }

function BlocoExcecoes({
  regras,
  colecoes,
  onSalvo,
}: {
  regras: Regra[]
  colecoes: Coll[]
  onSalvo: () => Promise<void>
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [forms, setForms] = useState<Record<string, ExcecaoForm>>({})
  const [tentouSalvar, setTentouSalvar] = useState<Set<string>>(new Set())
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})

  function excecaoDe(collectionId: string): Regra | null {
    return regras.find((r) => r.escopo === "colecao" && r.collection_id === collectionId) ?? null
  }

  function abrir(id: string) {
    setAbertas((s) => new Set(s).add(id))
    setForms((f) => ({ ...f, [id]: excecaoFormPadrao }))
  }
  function cancelar(id: string) {
    setAbertas((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
    setForms((f) => {
      const n = { ...f }
      delete n[id]
      return n
    })
  }
  function formDe(id: string, regra: Regra | null): ExcecaoForm {
    if (forms[id]) return forms[id]
    if (regra) return { tipo: regra.tipo_desconto, valorTexto: valorParaEntrada(regra.tipo_desconto, regra.valor), ativa: regra.ativa }
    return excecaoFormPadrao
  }
  function setForm(id: string, atual: ExcecaoForm, patch: Partial<ExcecaoForm>) {
    setForms((f) => ({ ...f, [id]: { ...atual, ...patch } }))
  }

  async function salvar(c: Coll, regra: Regra | null) {
    const form = formDe(c.id, regra)
    setTentouSalvar((s) => new Set(s).add(c.id))
    const erroValidacao = validarRegra({ nome: c.title, tipo_desconto: form.tipo, valorTexto: form.valorTexto })
    const valorNumerico = entradaParaValor(form.tipo, form.valorTexto)
    if (erroValidacao || valorNumerico === null) return
    setSalvandoId(c.id)
    setErros((er) => ({ ...er, [c.id]: "" }))
    try {
      if (regra) {
        await apiCall(`/api/conjuntos/regras/${regra.id}`, "PUT", {
          tipo_desconto: form.tipo,
          valor: valorNumerico,
          ativa: form.ativa,
        })
      } else {
        await apiCall("/api/conjuntos/regras", "POST", {
          nome: `Exceção — ${c.title}`,
          escopo: "colecao",
          collection_id: c.id,
          tipo_desconto: form.tipo,
          valor: valorNumerico,
          ativa: form.ativa,
        })
      }
      cancelar(c.id)
      await onSalvo()
    } catch (e) {
      setErros((er) => ({ ...er, [c.id]: (e as Error).message }))
    } finally {
      setSalvandoId(null)
    }
  }

  return (
    <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4">
      <h2 className="font-serif text-xl text-eclat-grafite">Exceções por coleção</h2>
      <p className="text-xs text-eclat-grafite/55">Coleções sem exceção usam o benefício padrão.</p>
      {colecoes.length === 0 && <p className="text-sm text-eclat-grafite/50">Nenhuma coleção cadastrada.</p>}
      <div className="border border-eclat-pedra/30 rounded-md divide-y divide-eclat-pedra/15 bg-white">
        {colecoes.map((c) => {
          const regra = excecaoDe(c.id)
          const aberta = abertas.has(c.id) || !!regra
          const form = formDe(c.id, regra)
          const erroValidacao = validarRegra({ nome: c.title, tipo_desconto: form.tipo, valorTexto: form.valorTexto })
          return (
            <div key={c.id} className="p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${aberta ? "text-eclat-grafite" : "text-eclat-grafite/50"}`}>{c.title}</span>
                {!aberta && (
                  <span className="flex items-center gap-3 text-xs">
                    <span className="text-eclat-grafite/40 uppercase tracking-wider">padrão</span>
                    <button onClick={() => abrir(c.id)} className="text-eclat-dourado underline">
                      Criar exceção
                    </button>
                  </span>
                )}
              </div>
              {aberta && (
                <div className="flex flex-col gap-2 bg-eclat-areia/20 rounded p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label}>Tipo</label>
                      <select
                        value={form.tipo}
                        onChange={(e) => {
                          // trocar o tipo limpa o valor: 20 (%) não pode virar R$ 20,00 por acidente
                          setForm(c.id, form, { tipo: e.target.value as TipoDesconto, valorTexto: "" })
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
                          value={form.valorTexto}
                          onChange={(e) => setForm(c.id, form, { valorTexto: e.target.value })}
                          placeholder={unidadeDoTipo(form.tipo) === "%" ? "ex.: 15" : "ex.: 45,90"}
                          className={input}
                        />
                        <span className="text-xs text-eclat-grafite/50 shrink-0">{unidadeDoTipo(form.tipo)}</span>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.ativa}
                      onChange={(e) => setForm(c.id, form, { ativa: e.target.checked })}
                    />
                    <span className="text-eclat-grafite/70">Ativa</span>
                  </label>
                  <p className="text-[11px] text-eclat-grafite/50">
                    Exceção inativa = esta coleção fica SEM benefício (não volta ao padrão).
                  </p>
                  {tentouSalvar.has(c.id) && erroValidacao && <p className="text-xs text-red-700">{erroValidacao}</p>}
                  {erros[c.id] && <p className="text-xs text-red-700">{erros[c.id]}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => salvar(c, regra)} disabled={salvandoId === c.id} className={btn}>
                      {salvandoId === c.id ? "Salvando…" : regra ? "Salvar" : "Criar exceção"}
                    </button>
                    {!regra && (
                      <button
                        onClick={() => cancelar(c.id)}
                        className="text-sm text-eclat-grafite/60 underline self-center"
                      >
                        cancelar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BlocoPares({
  pares,
  categoriasRaiz,
  onSalvo,
}: {
  pares: Par[]
  categoriasRaiz: Cat[]
  onSalvo: (pares: Par[]) => void
}) {
  const [locais, setLocais] = useState<{ categoria_a: string; categoria_b: string }[]>(
    pares.filter((p) => p.ativo).map((p) => ({ categoria_a: p.categoria_a, categoria_b: p.categoria_b }))
  )
  const [novoA, setNovoA] = useState("")
  const [novoB, setNovoB] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setLocais(pares.filter((p) => p.ativo).map((p) => ({ categoria_a: p.categoria_a, categoria_b: p.categoria_b })))
  }, [pares])

  function nomeDaCategoria(handle: string) {
    return categoriasRaiz.find((c) => c.handle === handle)?.name ?? handle
  }

  function adicionar() {
    setErro(null)
    setMsg(null)
    if (!novoA || !novoB) return setErro("Escolha as duas categorias.")
    if (novoA === novoB) return setErro("Escolha duas categorias diferentes.")
    const [a, b] = [novoA, novoB].sort()
    if (locais.some((p) => [p.categoria_a, p.categoria_b].sort().join("|") === `${a}|${b}`))
      return setErro("Esse par já existe.")
    setLocais((l) => [...l, { categoria_a: a, categoria_b: b }])
    setNovoA("")
    setNovoB("")
  }

  function remover(idx: number) {
    setMsg(null)
    setLocais((l) => l.filter((_, i) => i !== idx))
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    setMsg(null)
    try {
      const d = await apiCall<{ pares: Par[] }>("/api/conjuntos/pares", "PUT", {
        pares: locais.map((p) => ({ ...p, ativo: true })),
      })
      onSalvo(d.pares)
      setMsg("Pares salvos.")
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4">
      <h2 className="font-serif text-xl text-eclat-grafite">Pares permitidos</h2>
      <p className="text-xs text-eclat-grafite/55">
        Só peças de categorias pareadas aqui formam um conjunto com benefício na vitrine.
      </p>
      <div className="flex flex-wrap gap-2">
        {locais.length === 0 && <p className="text-sm text-eclat-grafite/50">Nenhum par cadastrado.</p>}
        {locais.map((p, i) => (
          <span
            key={`${p.categoria_a}-${p.categoria_b}`}
            className="flex items-center gap-2 bg-eclat-areia/60 rounded-full px-3 py-1.5 text-sm"
          >
            <span className="text-eclat-grafite">
              {nomeDaCategoria(p.categoria_a)} + {nomeDaCategoria(p.categoria_b)}
            </span>
            <span className="text-[10px] text-eclat-grafite/40">
              ({p.categoria_a} + {p.categoria_b})
            </span>
            <button onClick={() => remover(i)} className="text-eclat-grafite/50 hover:text-red-700">
              ×
            </button>
          </span>
        ))}
      </div>
      {categoriasRaiz.length < 2 ? (
        <p className="text-xs text-eclat-grafite/50">Cadastre ao menos duas categorias raiz ativas para criar pares.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Categoria A</label>
              <select value={novoA} onChange={(e) => setNovoA(e.target.value)} className={input}>
                <option value="">Selecione</option>
                {categoriasRaiz.map((c) => (
                  <option key={c.id} value={c.handle}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Categoria B</label>
              <select value={novoB} onChange={(e) => setNovoB(e.target.value)} className={input}>
                <option value="">Selecione</option>
                {categoriasRaiz.map((c) => (
                  <option key={c.id} value={c.handle}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={adicionar} className={btn}>
            Adicionar par
          </button>
        </>
      )}
      {erro && <p className="text-xs text-red-700">{erro}</p>}
      {msg && <p className="text-xs text-eclat-grafite/60">{msg}</p>}
      <button onClick={salvar} disabled={salvando} className={btn}>
        {salvando ? "Salvando…" : "Salvar pares"}
      </button>
    </section>
  )
}

function BlocoReconciliar() {
  const [confirmando, setConfirmando] = useState(false)
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState<{ regras: number; cupons: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function reconciliar() {
    setRodando(true)
    setErro(null)
    setResultado(null)
    try {
      const d = await apiCall<{ regras: number; cupons: number }>("/api/conjuntos/reconciliar", "POST")
      setResultado(d)
      setConfirmando(false)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setRodando(false)
    }
  }

  return (
    <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 flex flex-col gap-3">
      <h2 className="font-serif text-xl text-eclat-grafite">Reconciliar</h2>
      <p className="text-xs text-eclat-grafite/55">
        Sincroniza as promoções e os cupons do Medusa com as regras e os pares atuais.
      </p>
      {!confirmando ? (
        <button
          onClick={() => {
            setConfirmando(true)
            setResultado(null)
            setErro(null)
          }}
          className="self-start border border-eclat-grafite text-eclat-grafite uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-grafite hover:text-eclat-luz transition-colors"
        >
          Reconciliar promoções e cupons
        </button>
      ) : (
        <div className="flex flex-col gap-2 bg-eclat-areia/30 rounded p-3">
          <p className="text-sm text-eclat-grafite">Confirmar sincronização de promoções e cupons agora?</p>
          <div className="flex gap-3">
            <button onClick={reconciliar} disabled={rodando} className={btn}>
              {rodando ? "Reconciliando…" : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              disabled={rodando}
              className="text-sm text-eclat-grafite/60 underline self-center"
            >
              cancelar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-xs text-red-700">{erro}</p>}
      {resultado && (
        <p className="text-sm text-eclat-grafite/70">
          Regras sincronizadas: {resultado.regras} · Cupons convertidos: {resultado.cupons}
        </p>
      )}
    </section>
  )
}
