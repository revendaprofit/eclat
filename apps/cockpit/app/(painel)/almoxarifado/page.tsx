"use client"

import { useEffect, useMemo, useState } from "react"
import { Aviso, Carregando, Metrica, Secao, TituloPagina } from "@/components/ui"
import { estoqueUtil, necessidade, valorEstoque, type Almoxarifado, type FichaParaNecessidade, type ItemAlmox } from "@/lib/almoxarifado"

// Almoxarifado (sócia, 2026-10-23): sobras de insumos contadas, editáveis, e "tenho insumo para a próxima produção?"
// calculado pelas fichas de custo (consumo por peça × quantidade planejada) contra o estoque útil.
type Ficha = FichaParaNecessidade & { collection: string | null; lote: number }
type Resposta = Almoxarifado & { fichas: Ficha[] }

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const inputCls = "border border-eclat-pedra/50 rounded-md px-2 py-1 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const novoId = () => `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export default function AlmoxarifadoPage() {
  const [d, setD] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [plano, setPlano] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch("/api/almoxarifado", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setD(j)))
      .catch((e) => setErro((e as Error).message))
  }, [])

  const setItem = (id: string, patch: Partial<ItemAlmox>) => setD((a) => (a ? { ...a, itens: a.itens.map((i) => (i.id === id ? { ...i, ...patch, atualizado_em: new Date().toISOString() } : i)) } : a))
  const remover = (id: string) => setD((a) => (a ? { ...a, itens: a.itens.filter((i) => i.id !== id) } : a))
  const adicionar = () => setD((a) => (a ? { ...a, itens: [...a.itens, { id: novoId(), grupo: "", nome: "", unidade: "un", quantidade: 0, custo_unitario_centavos: null, chave: null, observacao: null, atualizado_em: null }] } : a))
  const salvar = async () => {
    if (!d) return
    setSalvando(true)
    setErro(null)
    try {
      const r = await fetch("/api/almoxarifado", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reserva_pct: d.reserva_pct, nota: d.nota, itens: d.itens }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setAviso("Estoque salvo.")
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const grupos = useMemo(() => {
    if (!d) return []
    const m = new Map<string, ItemAlmox[]>()
    for (const i of d.itens) m.set(i.grupo || "Sem grupo", [...(m.get(i.grupo || "Sem grupo") ?? []), i])
    return Array.from(m.entries())
  }, [d])
  const linhasNecessidade = useMemo(() => (d ? necessidade(d, d.fichas, plano) : []), [d, plano])
  const totalPlanejado = Object.values(plano).reduce((s, v) => s + (Number(v) || 0), 0)

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina
        titulo="Almoxarifado"
        descricao="Sobras de insumos contadas. Edite as quantidades quando contar de novo e clique em Salvar. Abaixo, simule a próxima produção para ver se o estoque dá."
        acoes={<button onClick={salvar} disabled={salvando || !d} className="text-meta px-4 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90 disabled:opacity-50">{salvando ? "Salvando…" : "Salvar estoque"}</button>}
      />
      {!d && !erro && <Carregando />}
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <Aviso tom="atencao">{aviso}</Aviso>}
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica rotulo="Itens em estoque" valor={d.itens.length} detalhe={`${grupos.length} grupo(s)`} />
            <Metrica rotulo="Valor do estoque útil" valor={brl(valorEstoque(d))} detalhe="pelo custo unitário, sem a reserva" />
            <div className="rounded-xl border border-eclat-pedra/50 bg-white p-4">
              <div className="text-meta uppercase tracking-wider text-eclat-texto-3">Reserva (%)</div>
              <input type="number" min={0} max={50} value={d.reserva_pct} onChange={(e) => setD({ ...d, reserva_pct: Number(e.target.value) || 0 })} className={inputCls + " w-20 mt-2"} />
              <div className="text-meta text-eclat-texto-3 mt-1.5">perda, uso próprio, reposição</div>
            </div>
            <Metrica rotulo="Última contagem" valor={d.itens.reduce((m, i) => (i.atualizado_em && i.atualizado_em > m ? i.atualizado_em : m), "").slice(0, 10).split("-").reverse().join("/") || "—"} detalhe="data da última edição" />
          </div>

          <Secao titulo="Estoque" acoes={<button onClick={adicionar} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">+ Item</button>}>
            {d.nota && <p className="text-meta text-eclat-texto-3">{d.nota}</p>}
            <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-x-auto">
              <table className="w-full text-corpo">
                <thead>
                  <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                    <th className="px-3 py-2 font-normal">Grupo</th>
                    <th className="px-3 py-2 font-normal">Item</th>
                    <th className="px-3 py-2 font-normal text-right">Contado</th>
                    <th className="px-3 py-2 font-normal text-right">Útil</th>
                    <th className="px-3 py-2 font-normal">Un.</th>
                    <th className="px-3 py-2 font-normal text-right">Custo un. (R$)</th>
                    <th className="px-3 py-2 font-normal text-right">Valor</th>
                    <th className="px-3 py-2 font-normal">Casa com a ficha</th>
                    <th className="px-3 py-2 font-normal">Obs.</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([grupo, itens]) =>
                    itens.map((i, k) => (
                      <tr key={i.id} className="border-b border-eclat-pedra/10 last:border-0 align-top">
                        <td className="px-3 py-1.5">{k === 0 ? <input value={i.grupo} onChange={(e) => setItem(i.id, { grupo: e.target.value })} className={inputCls + " w-44"} placeholder="Grupo" /> : <span className="text-meta text-eclat-texto/40 pl-2">{grupo}</span>}</td>
                        <td className="px-3 py-1.5"><input value={i.nome} onChange={(e) => setItem(i.id, { nome: e.target.value })} className={inputCls + " w-40"} placeholder="Item" /></td>
                        <td className="px-3 py-1.5 text-right"><input type="number" min={0} value={i.quantidade} onChange={(e) => setItem(i.id, { quantidade: Math.max(0, Number(e.target.value) || 0) })} className={inputCls + " w-24 text-right"} /></td>
                        <td className="px-3 py-1.5 text-right lining-nums text-eclat-texto-2">{estoqueUtil(i, d.reserva_pct)}</td>
                        <td className="px-3 py-1.5"><input value={i.unidade} onChange={(e) => setItem(i.id, { unidade: e.target.value })} className={inputCls + " w-14"} /></td>
                        <td className="px-3 py-1.5 text-right"><input value={i.custo_unitario_centavos != null ? (i.custo_unitario_centavos / 100).toFixed(2) : ""} onChange={(e) => setItem(i.id, { custo_unitario_centavos: e.target.value.trim() === "" ? null : Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0 })} className={inputCls + " w-24 text-right"} placeholder="—" /></td>
                        <td className="px-3 py-1.5 text-right lining-nums whitespace-nowrap">{i.custo_unitario_centavos != null ? brl(i.custo_unitario_centavos * estoqueUtil(i, d.reserva_pct)) : "—"}</td>
                        <td className="px-3 py-1.5"><input value={i.chave ?? ""} onChange={(e) => setItem(i.id, { chave: e.target.value || null })} className={inputCls + " w-32"} placeholder="ex.: monograma" title="Trecho do nome do insumo na ficha de custo; vazio = fora do cálculo" /></td>
                        <td className="px-3 py-1.5"><input value={i.observacao ?? ""} onChange={(e) => setItem(i.id, { observacao: e.target.value || null })} className={inputCls + " w-40"} /></td>
                        <td className="px-3 py-1.5 text-right"><button onClick={() => remover(i.id)} className="text-eclat-texto-3 hover:text-red-700">✕</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Secao>

          <Secao titulo="Tenho insumo para a próxima produção?">
            <p className="text-meta text-eclat-texto-3">Digite quantas peças de cada ficha pretende produzir. A necessidade vem das fichas de custo; o estoque é o útil, já sem a reserva. Cores de termocolante somam no mesmo tipo.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {d.fichas.map((f) => (
                <label key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-eclat-pedra/40 bg-white/60 px-3 py-2 text-corpo">
                  <span className="truncate" title={f.name}>{f.name}<span className="block text-meta text-eclat-texto/40">{f.collection ?? ""} · lote anterior {f.lote}</span></span>
                  <input type="number" min={0} value={plano[f.id] ?? ""} onChange={(e) => setPlano({ ...plano, [f.id]: Number(e.target.value) || 0 })} className={inputCls + " w-20 text-right"} placeholder="0" />
                </label>
              ))}
            </div>
            {totalPlanejado > 0 && (
              <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
                <table className="w-full text-corpo">
                  <thead>
                    <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                      <th className="px-4 py-2 font-normal">Insumo</th>
                      <th className="px-4 py-2 font-normal text-right">Precisa</th>
                      <th className="px-4 py-2 font-normal text-right">Em estoque (útil)</th>
                      <th className="px-4 py-2 font-normal text-right">Falta comprar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasNecessidade.map((l) => (
                      <tr key={l.chave} className="border-b border-eclat-pedra/10 last:border-0">
                        <td className="px-4 py-2">{l.rotulo} <span className="text-meta text-eclat-texto/40">({l.chave})</span></td>
                        <td className="px-4 py-2 text-right lining-nums">{l.precisa}</td>
                        <td className="px-4 py-2 text-right lining-nums">{l.estoque}</td>
                        <td className={`px-4 py-2 text-right lining-nums font-medium ${l.falta > 0 ? "text-red-700" : "text-green-700"}`}>{l.falta > 0 ? l.falta : "dá"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>
        </>
      )}
    </div>
  )
}
