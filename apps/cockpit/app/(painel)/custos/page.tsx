"use client"

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react"

// Custos de Coleção — estrutura MODELO × COLEÇÃO:
// · MODELO = catálogo permanente (molde; foto de referência). Modelagem = Despesa (Opção 1).
// · COLEÇÃO = lançamento com parâmetros padrão (herdados pelas fichas novas).
// · FICHA = modelo dentro de uma coleção (colorway + BOM + preços daquela produção).
// Centavos inteiros no banco; edição em reais no painel.

type Item = {
  kind: "material" | "aviamento" | "servico"
  name: string
  unit: "kg" | "m" | "un"
  consumption: number
  unit_price_centavos: number
}

type Model = {
  id: string
  name: string
  category: string | null
  reference_image_url: string | null
}

type Collection = {
  id: string
  name: string
  launch_date: string | null
  status: string
  perda_pct: number
  imposto_pct: number
  taxa_pagamento_pct: number
  marketing_pct: number
  frete_embalagem_centavos: number
  markup: number
  notes: string | null
}

type Piece = {
  id: string
  name: string
  collection_id: string | null
  model_id: string | null
  colorway: string | null
  reference_image_url: string | null
  status: "rascunho" | "cotacao" | "aprovada"
  faccao_centavos: number
  estampa_centavos: number
  modelagem_total_centavos: number
  modelagem_pecas: number
  perda_pct: number
  imposto_pct: number
  taxa_pagamento_pct: number
  marketing_pct: number
  frete_embalagem_centavos: number
  markup: number
  preco_venda_centavos: number | null
  medusa_variant_ids: string[]
  notes: string | null
  costing_item: (Item & { id: string; position: number })[]
  costing_model: Model | null
}

const input =
  "w-full border border-eclat-pedra/50 rounded px-2 py-1.5 text-sm bg-white/80 text-eclat-grafite focus:outline-none focus:border-eclat-dourado"
const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const parseMoney = (s: string) =>
  Math.max(0, Math.round((parseFloat(s.replace(",", ".")) || 0) * 100))

function calc(p: Piece, items: Item[]) {
  const materiais = items.reduce(
    (acc, i) => acc + i.consumption * i.unit_price_centavos,
    0
  )
  const materiaisComPerda = materiais * (1 + (p.perda_pct || 0) / 100)
  const modelagem = p.modelagem_total_centavos / Math.max(1, p.modelagem_pecas)
  const industrial =
    materiaisComPerda + p.faccao_centavos + p.estampa_centavos + modelagem
  const sugerido = industrial * (p.markup || 1)
  const preco = p.preco_venda_centavos ?? Math.round(sugerido)
  const pctTotal =
    ((p.imposto_pct || 0) + (p.taxa_pagamento_pct || 0) + (p.marketing_pct || 0)) /
    100
  const custosPct = preco * pctTotal
  const margem = preco - industrial - custosPct - (p.frete_embalagem_centavos || 0)
  const margemPct = preco > 0 ? (margem / preco) * 100 : 0
  return {
    materiais: materiaisComPerda,
    modelagem,
    industrial,
    sugerido,
    preco,
    custosPct,
    margem,
    margemPct,
  }
}

const thumb = (p: Piece) =>
  p.reference_image_url || p.costing_model?.reference_image_url || null

export default function CustosPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [colId, setColId] = useState<string>("")
  const [sel, setSel] = useState<Piece | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  // form "adicionar modelo à coleção"
  const [addModelId, setAddModelId] = useState("")
  const [addModelName, setAddModelName] = useState("")
  const [addColorway, setAddColorway] = useState("")

  const load = useCallback(async () => {
    const [rc, rm, rp] = await Promise.all([
      fetch("/api/costing-collections"),
      fetch("/api/costing-models"),
      fetch("/api/costing"),
    ])
    if (rc.ok) {
      const cols = (await rc.json()) as Collection[]
      setCollections(cols)
      setColId((cur) => cur || cols[0]?.id || "")
    }
    if (rm.ok) setModels(await rm.json())
    if (rp.ok) setPieces(await rp.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const col = collections.find((c) => c.id === colId) || null
  const colPieces = pieces.filter((p) => p.collection_id === colId)

  function open(p: Piece) {
    setSel({ ...p })
    setItems(
      [...(p.costing_item || [])]
        .sort((a, b) => a.position - b.position)
        .map(({ kind, name, unit, consumption, unit_price_centavos }) => ({
          kind,
          name,
          unit,
          consumption: Number(consumption),
          unit_price_centavos,
        }))
    )
    setMsg("")
  }

  async function novaColecao() {
    const name = prompt("Nome da nova coleção/família (ex.: Família Blackout — Inverno 27):")
    if (!name) return
    const r = await fetch("/api/costing-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!r.ok) {
      setMsg("Erro ao criar coleção.")
      return
    }
    const nova = (await r.json()) as Collection
    // opcional: copiar as peças da coleção atual (modelagem sempre zerada)
    if (
      col &&
      colPieces.length > 0 &&
      confirm(`Copiar as ${colPieces.length} peças de "${col.name}" para a nova coleção? (BOM herdado; ajuste tecidos/cores/preços depois)`)
    ) {
      for (const p of colPieces) {
        const cr = await fetch("/api/costing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            collection_id: nova.id,
            model_id: p.model_id,
            colorway: p.colorway,
            reference_image_url: p.reference_image_url,
          }),
        })
        if (!cr.ok) continue
        const created = (await cr.json()) as { id: string }
        await fetch(`/api/costing/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faccao_centavos: p.faccao_centavos,
            estampa_centavos: p.estampa_centavos,
            modelagem_total_centavos: 0,
            items: (p.costing_item || [])
              .sort((a, b) => a.position - b.position)
              .map(({ kind, name, unit, consumption, unit_price_centavos }) => ({
                kind,
                name,
                unit,
                consumption,
                unit_price_centavos,
              })),
          }),
        })
      }
    }
    setColId(nova.id)
    setSel(null)
    load()
  }

  async function salvarParametros() {
    if (!col) return
    const r = await fetch(`/api/costing-collections/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(col),
    })
    setMsg(r.ok ? "Parâmetros da coleção salvos ✓ (valem para fichas novas)" : "Erro ao salvar parâmetros.")
  }

  async function adicionarModelo() {
    if (!col) return
    let model = models.find((m) => m.id === addModelId) || null
    if (!model && addModelName.trim()) {
      const r = await fetch("/api/costing-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addModelName.trim() }),
      })
      if (r.ok) model = (await r.json()) as Model
    }
    if (!model) {
      setMsg("Escolha um modelo do catálogo ou digite o nome de um novo.")
      return
    }
    const colorway = addColorway.trim() || "—"
    const r = await fetch("/api/costing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${model.name} — ${colorway}`,
        collection_id: col.id,
        model_id: model.id,
        colorway,
        reference_image_url: model.reference_image_url,
      }),
    })
    if (!r.ok) {
      setMsg("Erro ao adicionar modelo.")
      return
    }
    const created = (await r.json()) as { id: string }
    // herda o BOM da ficha mais recente deste modelo (qualquer coleção)
    const fonte = pieces
      .filter((p) => p.model_id === model!.id && (p.costing_item || []).length > 0)
      .slice(-1)[0]
    if (fonte) {
      await fetch(`/api/costing/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faccao_centavos: fonte.faccao_centavos,
          estampa_centavos: fonte.estampa_centavos,
          modelagem_total_centavos: 0,
          items: (fonte.costing_item || [])
            .sort((a, b) => a.position - b.position)
            .map(({ kind, name, unit, consumption, unit_price_centavos }) => ({
              kind,
              name,
              unit,
              consumption,
              unit_price_centavos,
            })),
        }),
      })
    }
    setAddModelId("")
    setAddModelName("")
    setAddColorway("")
    setMsg(`${model.name} adicionado à coleção${fonte ? " (BOM herdado da ficha mais recente)" : ""} ✓`)
    load()
  }

  async function salvar() {
    if (!sel) return
    setSaving(true)
    setMsg("")
    const r = await fetch(`/api/costing/${sel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sel, items }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      setMsg(`Erro: ${(e as { error?: string }).error || r.status}`)
      return
    }
    setMsg("Salvo ✓")
    load()
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta ficha de custo?")) return
    await fetch(`/api/costing/${id}`, { method: "DELETE" })
    if (sel?.id === id) setSel(null)
    load()
  }

  async function aplicarCogs() {
    if (!sel) return
    if (sel.modelagem_total_centavos > 0) {
      const ok = confirm(
        "Atenção: esta ficha tem custo de MODELAGEM > 0.\n\nPela convenção ÉCLAT (Opção 1), a modelagem vai em Financeiro → Despesas (Desenvolvimento de coleção) e NÃO no COGS — senão o DRE desconta duas vezes.\n\nAplicar mesmo assim, INCLUINDO a modelagem no custo?"
      )
      if (!ok) return
    }
    const c = calc(sel, items)
    const ids = (sel.medusa_variant_ids || []).filter(Boolean)
    if (!ids.length) {
      setMsg("Preencha os IDs de variação do Medusa para aplicar o COGS.")
      return
    }
    const r = await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: ids.map((variant_id) => ({
          variant_id,
          custo_centavos: Math.round(c.industrial),
        })),
      }),
    })
    setMsg(
      r.ok
        ? `COGS ${money(Math.round(c.industrial))} aplicado a ${ids.length} variação(ões) ✓`
        : "Erro ao aplicar COGS."
    )
  }

  const c = useMemo(() => (sel ? calc(sel, items) : null), [sel, items])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between max-w-6xl">
        <div>
          <h1 className="font-serif text-3xl text-eclat-grafite">
            Custos de Coleção
          </h1>
          <p className="text-xs text-eclat-dourado mt-1 max-w-2xl">
            Convenção ÉCLAT: modelagem NÃO entra no custo da peça — lance em
            Financeiro → Despesas (&quot;Desenvolvimento de coleção&quot;).
            Molde reaproveitado em nova cor/coleção = custo zero.
          </p>
        </div>
        <button
          onClick={novaColecao}
          className="shrink-0 bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-sm px-4 py-2 rounded"
        >
          + Nova coleção
        </button>
      </div>

      {/* seletor + parâmetros da coleção */}
      <div className="max-w-6xl border border-eclat-pedra/40 rounded-lg bg-white/60 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <select
            className={`${input} max-w-md font-medium`}
            value={colId}
            onChange={(e) => {
              setColId(e.target.value)
              setSel(null)
            }}
          >
            {collections.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.name}
              </option>
            ))}
          </select>
          {col && (
            <select
              className={`${input} w-40`}
              value={col.status}
              onChange={(e) =>
                setCollections(
                  collections.map((cc) =>
                    cc.id === col.id ? { ...cc, status: e.target.value } : cc
                  )
                )
              }
            >
              <option value="planejamento">planejamento</option>
              <option value="producao">produção</option>
              <option value="lancada">lançada</option>
              <option value="arquivada">arquivada</option>
            </select>
          )}
          <span className="text-xs text-eclat-grafite/50">
            {colPieces.length} peça(s)
          </span>
        </div>
        {col && (
          <div className="flex flex-wrap items-end gap-3 text-xs text-eclat-grafite/60">
            <label>
              Perda (%)
              <input className={`${input} w-20`} type="number" step="0.5" value={col.perda_pct}
                onChange={(e) => setCollections(collections.map((cc) => cc.id === col.id ? { ...cc, perda_pct: parseFloat(e.target.value) || 0 } : cc))} />
            </label>
            <label>
              Impostos (%)
              <input className={`${input} w-20`} type="number" step="0.5" value={col.imposto_pct}
                onChange={(e) => setCollections(collections.map((cc) => cc.id === col.id ? { ...cc, imposto_pct: parseFloat(e.target.value) || 0 } : cc))} />
            </label>
            <label>
              Taxa pagto (%)
              <input className={`${input} w-20`} type="number" step="0.5" value={col.taxa_pagamento_pct}
                onChange={(e) => setCollections(collections.map((cc) => cc.id === col.id ? { ...cc, taxa_pagamento_pct: parseFloat(e.target.value) || 0 } : cc))} />
            </label>
            <label>
              CAC (%)
              <input className={`${input} w-20`} type="number" step="0.5" value={col.marketing_pct}
                onChange={(e) => setCollections(collections.map((cc) => cc.id === col.id ? { ...cc, marketing_pct: parseFloat(e.target.value) || 0 } : cc))} />
            </label>
            <label>
              Frete+emb. (R$)
              <input className={`${input} w-24`}
                defaultValue={(col.frete_embalagem_centavos / 100).toFixed(2)}
                onBlur={(e) => setCollections(collections.map((cc) => cc.id === col.id ? { ...cc, frete_embalagem_centavos: parseMoney(e.target.value) } : cc))} />
            </label>
            <label>
              Markup (×)
              <input className={`${input} w-20`} type="number" step="0.1" value={col.markup}
                onChange={(e) => setCollections(collections.map((cc) => cc.id === col.id ? { ...cc, markup: parseFloat(e.target.value) || 1 } : cc))} />
            </label>
            <button
              onClick={salvarParametros}
              className="border border-eclat-pedra/60 text-eclat-grafite text-xs px-3 py-2 rounded hover:bg-eclat-areia/40"
            >
              Salvar parâmetros da coleção
            </button>
          </div>
        )}
        {/* adicionar modelo */}
        {col && (
          <div className="flex flex-wrap items-end gap-3 text-xs text-eclat-grafite/60 border-t border-eclat-pedra/30 pt-3">
            <label>
              Modelo do catálogo
              <select className={`${input} w-56`} value={addModelId}
                onChange={(e) => { setAddModelId(e.target.value); setAddModelName("") }}>
                <option value="">— escolher —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <span className="pb-2">ou</span>
            <label>
              Novo modelo
              <input className={`${input} w-48`} value={addModelName} placeholder="ex.: Top Aurora II"
                onChange={(e) => { setAddModelName(e.target.value); setAddModelId("") }} />
            </label>
            <label>
              Cor/tecido (colorway)
              <input className={`${input} w-56`} value={addColorway} placeholder="ex.: Verde Exército · Licor 8316"
                onChange={(e) => setAddColorway(e.target.value)} />
            </label>
            <button
              onClick={adicionarModelo}
              className="bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-xs px-3 py-2 rounded"
            >
              + Adicionar à coleção
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6 items-start max-w-6xl">
        {/* peças da coleção (com foto) */}
        <ul className="w-80 shrink-0 flex flex-col divide-y divide-eclat-pedra/30 border border-eclat-pedra/30 rounded-lg bg-white/60">
          {colPieces.length === 0 && (
            <li className="p-4 text-sm text-eclat-grafite/50">
              Nenhuma peça nesta coleção — adicione um modelo acima.
            </li>
          )}
          {colPieces.map((p) => {
            const pc = calc(p, p.costing_item || [])
            const img = thumb(p)
            return (
              <li
                key={p.id}
                onClick={() => open(p)}
                className={`p-2.5 cursor-pointer hover:bg-eclat-areia/30 flex gap-3 items-center ${
                  sel?.id === p.id ? "bg-eclat-dourado/10" : ""
                }`}
              >
                {img ? (
                  <img src={img} alt={p.name} className="w-14 h-14 object-contain rounded bg-white shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded bg-eclat-areia/40 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-eclat-grafite truncate">
                    {p.costing_model?.name || p.name}
                  </p>
                  <p className="text-xs text-eclat-grafite/50 truncate">
                    {p.colorway || "—"}
                  </p>
                  <p className="text-xs text-eclat-grafite/50">
                    custo {money(Math.round(pc.industrial))} ·{" "}
                    <span className={p.status === "aprovada" ? "text-green-700" : "text-eclat-dourado"}>
                      {p.status}
                    </span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        {/* ficha */}
        {sel && c && (
          <div className="flex-1 border border-eclat-dourado/40 rounded-lg bg-white/70 p-5 flex flex-col gap-4">
            <div className="flex gap-4 items-start">
              {thumb(sel) && (
                <img src={thumb(sel)!} alt={sel.name} className="w-24 h-24 object-contain rounded bg-white border border-eclat-pedra/30 shrink-0" />
              )}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex gap-3 items-center">
                  <input
                    className={`${input} font-medium`}
                    value={sel.name}
                    onChange={(e) => setSel({ ...sel, name: e.target.value })}
                  />
                  <select
                    className={`${input} w-32`}
                    value={sel.status}
                    onChange={(e) =>
                      setSel({ ...sel, status: e.target.value as Piece["status"] })
                    }
                  >
                    <option value="rascunho">rascunho</option>
                    <option value="cotacao">cotação</option>
                    <option value="aprovada">aprovada</option>
                  </select>
                  <button
                    onClick={() => excluir(sel.id)}
                    className="text-sm text-red-700/70 hover:text-red-700 underline shrink-0"
                  >
                    excluir
                  </button>
                </div>
                <div className="flex gap-3 items-center text-xs text-eclat-grafite/60">
                  <span className="shrink-0">
                    Modelo: <strong>{sel.costing_model?.name || "—"}</strong>
                  </span>
                  <label className="flex-1">
                    Cor/tecido:
                    <input
                      className={input}
                      value={sel.colorway || ""}
                      onChange={(e) => setSel({ ...sel, colorway: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* BOM */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-medium text-eclat-grafite">
                  Materiais e aviamentos (por peça)
                </h2>
                <button
                  onClick={() =>
                    setItems([
                      ...items,
                      { kind: "material", name: "", unit: "un", consumption: 1, unit_price_centavos: 0 },
                    ])
                  }
                  className="text-xs text-eclat-dourado hover:underline"
                >
                  + item
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-eclat-grafite/50 text-left">
                    <th className="py-1 pr-2">Tipo</th>
                    <th className="pr-2">Item</th>
                    <th className="pr-2 w-16">Un.</th>
                    <th className="pr-2 w-24">Consumo</th>
                    <th className="pr-2 w-28">Preço un. (R$)</th>
                    <th className="w-24 text-right">Subtotal</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <select className={input} value={it.kind}
                          onChange={(e) => { const v = [...items]; v[i] = { ...it, kind: e.target.value as Item["kind"] }; setItems(v) }}>
                          <option value="material">material</option>
                          <option value="aviamento">aviamento</option>
                          <option value="servico">serviço</option>
                        </select>
                      </td>
                      <td className="pr-2">
                        <input className={input} value={it.name}
                          onChange={(e) => { const v = [...items]; v[i] = { ...it, name: e.target.value }; setItems(v) }} />
                      </td>
                      <td className="pr-2">
                        <select className={input} value={it.unit}
                          onChange={(e) => { const v = [...items]; v[i] = { ...it, unit: e.target.value as Item["unit"] }; setItems(v) }}>
                          <option value="kg">kg</option>
                          <option value="m">m</option>
                          <option value="un">un</option>
                        </select>
                      </td>
                      <td className="pr-2">
                        <input className={input} type="number" step="0.01" value={it.consumption}
                          onChange={(e) => { const v = [...items]; v[i] = { ...it, consumption: parseFloat(e.target.value) || 0 }; setItems(v) }} />
                      </td>
                      <td className="pr-2">
                        <input className={input} defaultValue={(it.unit_price_centavos / 100).toFixed(2)}
                          onBlur={(e) => { const v = [...items]; v[i] = { ...it, unit_price_centavos: parseMoney(e.target.value) }; setItems(v) }} />
                      </td>
                      <td className="text-right text-eclat-grafite/70">
                        {money(Math.round(it.consumption * it.unit_price_centavos))}
                      </td>
                      <td className="text-right">
                        <button onClick={() => setItems(items.filter((_, j) => j !== i))}
                          className="text-red-700/60 hover:text-red-700">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mão de obra */}
            <div className="grid grid-cols-2 small:grid-cols-5 gap-3 text-xs text-eclat-grafite/60">
              <label>
                Facção (R$/peça)
                <input className={input} defaultValue={(sel.faccao_centavos / 100).toFixed(2)}
                  onBlur={(e) => setSel({ ...sel, faccao_centavos: parseMoney(e.target.value) })} />
              </label>
              <label>
                Estampa/bordado (R$)
                <input className={input} defaultValue={(sel.estampa_centavos / 100).toFixed(2)}
                  onBlur={(e) => setSel({ ...sel, estampa_centavos: parseMoney(e.target.value) })} />
              </label>
              <label>
                Modelagem — só simulação (R$)
                <input className={input} defaultValue={(sel.modelagem_total_centavos / 100).toFixed(2)}
                  onBlur={(e) => setSel({ ...sel, modelagem_total_centavos: parseMoney(e.target.value) })} />
              </label>
              <label>
                Diluir por (peças)
                <input className={input} type="number" value={sel.modelagem_pecas}
                  onChange={(e) => setSel({ ...sel, modelagem_pecas: Math.max(1, parseInt(e.target.value) || 1) })} />
              </label>
              <label>
                Perda de materiais (%)
                <input className={input} type="number" step="0.5" value={sel.perda_pct}
                  onChange={(e) => setSel({ ...sel, perda_pct: parseFloat(e.target.value) || 0 })} />
              </label>
            </div>

            <div className="bg-eclat-areia/30 rounded p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span>Materiais c/ perda: <strong>{money(Math.round(c.materiais))}</strong></span>
              <span>Modelagem diluída: <strong>{money(Math.round(c.modelagem))}</strong></span>
              <span className="text-eclat-terracota">
                CUSTO INDUSTRIAL: <strong>{money(Math.round(c.industrial))}</strong>
              </span>
            </div>

            {/* precificação */}
            <div className="grid grid-cols-2 small:grid-cols-6 gap-3 text-xs text-eclat-grafite/60">
              <label>
                Impostos (%)
                <input className={input} type="number" step="0.5" value={sel.imposto_pct}
                  onChange={(e) => setSel({ ...sel, imposto_pct: parseFloat(e.target.value) || 0 })} />
              </label>
              <label>
                Taxa pagamento (%)
                <input className={input} type="number" step="0.5" value={sel.taxa_pagamento_pct}
                  onChange={(e) => setSel({ ...sel, taxa_pagamento_pct: parseFloat(e.target.value) || 0 })} />
              </label>
              <label>
                Marketing/CAC (%)
                <input className={input} type="number" step="0.5" value={sel.marketing_pct}
                  onChange={(e) => setSel({ ...sel, marketing_pct: parseFloat(e.target.value) || 0 })} />
              </label>
              <label>
                Frete+embalagem (R$)
                <input className={input} defaultValue={(sel.frete_embalagem_centavos / 100).toFixed(2)}
                  onBlur={(e) => setSel({ ...sel, frete_embalagem_centavos: parseMoney(e.target.value) })} />
              </label>
              <label>
                Markup (×)
                <input className={input} type="number" step="0.1" value={sel.markup}
                  onChange={(e) => setSel({ ...sel, markup: parseFloat(e.target.value) || 1 })} />
              </label>
              <label>
                Preço de venda (R$) — vazio = sugerido
                <input className={input}
                  defaultValue={sel.preco_venda_centavos != null ? (sel.preco_venda_centavos / 100).toFixed(2) : ""}
                  onBlur={(e) => {
                    const t = e.target.value.trim()
                    setSel({ ...sel, preco_venda_centavos: t ? parseMoney(t) : null })
                  }} />
              </label>
            </div>

            <div className={`rounded p-3 text-sm flex flex-wrap gap-x-6 gap-y-1 ${c.margemPct >= 55 ? "bg-green-50" : c.margemPct >= 40 ? "bg-yellow-50" : "bg-red-50"}`}>
              <span>Preço sugerido ({sel.markup}×): <strong>{money(Math.round(c.sugerido))}</strong></span>
              <span>Preço em uso: <strong>{money(c.preco)}</strong></span>
              <span>Impostos+taxas+CAC: <strong>{money(Math.round(c.custosPct))}</strong></span>
              <span>
                MARGEM: <strong>{money(Math.round(c.margem))} ({c.margemPct.toFixed(1)}%)</strong>
                {c.margemPct < 40 && " ⚠️ abaixo do saudável p/ DTC"}
              </span>
            </div>

            <label className="text-xs text-eclat-grafite/60">
              IDs das variações no Medusa (separados por vírgula — em Produtos, copie o ID da variação)
              <input className={input}
                value={(sel.medusa_variant_ids || []).join(", ")}
                onChange={(e) =>
                  setSel({ ...sel, medusa_variant_ids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
                placeholder="variant_01ABC…, variant_01DEF…" />
            </label>

            {msg && <p className="text-sm text-eclat-grafite">{msg}</p>}
            <div className="flex gap-2">
              <button onClick={salvar} disabled={saving}
                className="bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-sm px-4 py-2 rounded disabled:opacity-50">
                {saving ? "Salvando…" : "Salvar ficha"}
              </button>
              <button onClick={aplicarCogs}
                className="border border-eclat-pedra/60 text-eclat-grafite text-sm px-4 py-2 rounded hover:bg-eclat-areia/40">
                Aplicar custo como COGS do produto
              </button>
            </div>
          </div>
        )}
      </div>
      {msg && !sel && <p className="text-sm text-eclat-grafite max-w-6xl">{msg}</p>}
    </div>
  )
}
