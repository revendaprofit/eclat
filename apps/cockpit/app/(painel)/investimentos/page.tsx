"use client"

import { useEffect, useMemo, useState } from "react"
import { Aviso, Carregando, Metrica, Secao, TituloPagina } from "@/components/ui"

// Visão geral do financeiro (sócia, 2026-10-22): "enxergar todo o financeiro da ÉCLAT de forma simples".
// Blocos: total investido (por categoria e por etapa) · lote Lumière: investido × vendas, peça a peça, clicável
// para ver a composição do custo · desenvolvimento (estilista, pilotos, moldes) · marketing por mês · demais gastos.
type Composicao = { itens: { kind: string; nome: string; unidade: string; consumo: number; preco_unit: number; custo: number }[]; faccao: number; estampa: number; perda_pct: number }
type Peca = { id: string; modelo: string; cor: string | null; nome: string; lote: number; custo_unitario: number; custo_lote: number; preco_venda: number | null; vendidas: number; receita: number; em_estoque: number; composicao: Composicao }
type Despesa = { id: string; data: string; descricao: string | null; valor_centavos: number; fornecedor: string | null; recorrencia: string | null; etapa: string | null; quantidade: number | null; custo_unitario_centavos: number | null; observacao: string | null; categoria: { nome: string } | null }
type Resposta = {
  total: number
  por_categoria: Record<string, number>
  por_etapa: Record<string, number>
  por_mes: Record<string, Record<string, number>>
  lumiere: { investido: number; custo_lote: number; producao: number; vendidas: number; em_estoque: number; receita: number; custo_vendido: number; recuperado_pct: number; pecas: Peca[] }
  marketing_por_mes: Record<string, { gastos: number; creators: number }>
  despesas: Despesa[]
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const pct = (v: number) => `${(v * 100).toFixed(0)}%`
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/")
const mesBr = (m: string) => {
  const [a, mm] = m.split("-")
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mm) - 1]}/${a.slice(2)}`
}
const KIND: Record<string, string> = { material: "Matéria-prima", aviamento: "Aviamentos, tags e rateios", servico: "Serviços" }

export default function InvestimentosPage() {
  const [d, setD] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [mostrarTodas, setMostrarTodas] = useState(false)
  useEffect(() => {
    fetch("/api/investimentos", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setD(j)))
      .catch((e) => setErro((e as Error).message))
  }, [])

  const categorias = useMemo(() => (d ? Object.entries(d.por_categoria).sort(([a], [b]) => a.localeCompare(b)) : []), [d])
  const etapas = useMemo(() => (d ? Object.entries(d.por_etapa).sort(([, a], [, b]) => b - a) : []), [d])
  const meses = useMemo(() => (d ? Object.keys(d.por_mes).sort() : []), [d])
  const desenvolvimento = useMemo(() => (d ? d.despesas.filter((x) => /^(2|6) /.test(x.categoria?.nome ?? "")) : []), [d])
  const demais = useMemo(() => (d ? d.despesas.filter((x) => /^(3|4|7|8) /.test(x.categoria?.nome ?? "")) : []), [d])
  const marketing = useMemo(() => (d ? d.despesas.filter((x) => /^5 /.test(x.categoria?.nome ?? "")) : []), [d])

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina
        titulo="Visão geral do financeiro"
        descricao="Tudo o que a ÉCLAT investiu, o lote da Lumière contra o que já vendeu, desenvolvimento, marketing por mês e demais gastos. Novo gasto: me avise no chat que eu lanço; o DRE do mês continua em Financeiro."
      />
      {!d && !erro && <Carregando />}
      {erro && <Aviso>{erro}</Aviso>}
      {d && (
        <>
          {/* Total investido */}
          <Secao titulo="Total investido">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metrica rotulo="Investido até hoje" valor={brl(d.total)} detalhe="todas as categorias" atencao />
              <Metrica rotulo="Lumière parte 01" valor={brl(d.lumiere.investido)} detalhe="produção + desenvolvimento + moldes" />
              <Metrica rotulo="Já voltou em vendas" valor={brl(d.lumiere.receita)} detalhe={`${pct(d.lumiere.recuperado_pct)} do investimento da Lumière`} />
              <Metrica rotulo="Peças vendidas" valor={`${d.lumiere.vendidas} / ${d.lumiere.producao}`} detalhe={`${d.lumiere.em_estoque} em estoque`} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1">
              <div className="rounded-lg border border-eclat-pedra/40 bg-white/60 p-4">
                <div className="text-meta uppercase tracking-wider text-eclat-texto-3 mb-2">Por categoria</div>
                {categorias.map(([nome, v]) => (
                  <div key={nome} className="flex justify-between text-corpo py-0.5"><span className="text-eclat-texto-2">{nome}</span><span>{brl(v)} <span className="text-meta text-eclat-texto/40">{pct(v / d.total)}</span></span></div>
                ))}
              </div>
              <div className="rounded-lg border border-eclat-pedra/40 bg-white/60 p-4">
                <div className="text-meta uppercase tracking-wider text-eclat-texto-3 mb-2">Por etapa / coleção</div>
                {etapas.map(([nome, v]) => (
                  <div key={nome} className="flex justify-between text-corpo py-0.5"><span className="text-eclat-texto-2">{nome}</span><span>{brl(v)} <span className="text-meta text-eclat-texto/40">{pct(v / d.total)}</span></span></div>
                ))}
              </div>
            </div>
          </Secao>

          {/* Lote Lumière */}
          <Secao titulo="Lumière parte 01 — lote × vendas">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metrica rotulo="Custo do lote (420 peças)" valor={brl(d.lumiere.custo_lote)} detalhe="pelas fichas de custo" />
              <Metrica rotulo="Receita das vendas" valor={brl(d.lumiere.receita)} detalhe="site + fora do site, pagas" />
              <Metrica rotulo="Custo do que vendeu" valor={brl(d.lumiere.custo_vendido)} detalhe={`margem bruta ${brl(d.lumiere.receita - d.lumiere.custo_vendido)}`} />
              <Metrica rotulo="Falta voltar" valor={brl(Math.max(0, d.lumiere.investido - d.lumiere.receita))} detalhe="para pagar o investimento da coleção" atencao={d.lumiere.investido > d.lumiere.receita} />
            </div>
            <p className="text-meta text-eclat-texto-3">Clique na peça para ver o que compõe o custo. Vendidas = pedidos pagos no site + vendas fora do site pagas.</p>
            <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
              <table className="w-full text-corpo">
                <thead>
                  <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                    <th className="px-4 py-2 font-normal">Peça</th>
                    <th className="px-4 py-2 font-normal text-right">Lote</th>
                    <th className="px-4 py-2 font-normal text-right">Custo/peça</th>
                    <th className="px-4 py-2 font-normal text-right">Custo do lote</th>
                    <th className="px-4 py-2 font-normal text-right">Preço</th>
                    <th className="px-4 py-2 font-normal text-right">Vendidas</th>
                    <th className="px-4 py-2 font-normal text-right">Receita</th>
                    <th className="px-4 py-2 font-normal text-right">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lumiere.pecas.map((p) => (
                    <>
                      <tr key={p.id} onClick={() => setAberta(aberta === p.id ? null : p.id)} className={`border-b border-eclat-pedra/10 cursor-pointer hover:bg-eclat-areia/30 ${aberta === p.id ? "bg-eclat-areia/40" : ""}`}>
                        <td className="px-4 py-2"><span className="font-medium">{p.modelo}</span> <span className="text-eclat-texto-3">{p.cor}</span> <span className="text-eclat-texto/40">{aberta === p.id ? "▲" : "▼"}</span></td>
                        <td className="px-4 py-2 text-right lining-nums">{p.lote}</td>
                        <td className="px-4 py-2 text-right lining-nums">{brl(p.custo_unitario)}</td>
                        <td className="px-4 py-2 text-right lining-nums">{brl(p.custo_lote)}</td>
                        <td className="px-4 py-2 text-right lining-nums text-eclat-texto-3">{p.preco_venda != null ? brl(p.preco_venda) : "—"}</td>
                        <td className="px-4 py-2 text-right lining-nums font-medium">{p.vendidas}</td>
                        <td className="px-4 py-2 text-right lining-nums">{brl(p.receita)}</td>
                        <td className="px-4 py-2 text-right lining-nums text-eclat-texto-3">{p.em_estoque}</td>
                      </tr>
                      {aberta === p.id && (
                        <tr key={p.id + "-c"} className="border-b border-eclat-pedra/10 bg-eclat-areia/20">
                          <td colSpan={8} className="px-6 py-3">
                            <div className="text-meta uppercase tracking-wider text-eclat-texto-3 mb-2">Composição do custo · {p.modelo} {p.cor}</div>
                            {(["material", "aviamento", "servico"] as const).map((k) => {
                              const itens = p.composicao.itens.filter((i) => i.kind === k)
                              if (!itens.length && k !== "servico") return null
                              return (
                                <div key={k} className="mb-2">
                                  <div className="text-meta text-eclat-texto-2 font-medium">{KIND[k]}</div>
                                  {itens.map((i, idx) => (
                                    <div key={idx} className="flex justify-between text-meta text-eclat-texto-2 py-0.5">
                                      <span>{i.nome} <span className="text-eclat-texto/50">· {i.consumo} {i.unidade} × {brl(i.preco_unit)}</span></span>
                                      <span className="lining-nums">{brl(i.custo)}</span>
                                    </div>
                                  ))}
                                  {k === "servico" && (
                                    <div className="flex justify-between text-meta text-eclat-texto-2 py-0.5"><span>Facção</span><span className="lining-nums">{brl(p.composicao.faccao)}</span></div>
                                  )}
                                  {k === "servico" && p.composicao.estampa > 0 && (
                                    <div className="flex justify-between text-meta text-eclat-texto-2 py-0.5"><span>Estampa</span><span className="lining-nums">{brl(p.composicao.estampa)}</span></div>
                                  )}
                                </div>
                              )
                            })}
                            <div className="flex justify-between text-corpo font-medium border-t border-eclat-pedra/30 pt-1"><span>Custo da peça{p.composicao.perda_pct ? ` (perda ${p.composicao.perda_pct}% nos materiais)` : ""}</span><span className="lining-nums">{brl(p.custo_unitario)}</span></div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>

          {/* Desenvolvimento */}
          <Secao titulo="Desenvolvimento de coleção, modelagem e pilotos">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Metrica rotulo="Total" valor={brl(desenvolvimento.reduce((s, x) => s + x.valor_centavos, 0))} detalhe="estilista, pilotos, envios, moldes" />
              <Metrica rotulo="Desenvolvimento" valor={brl(desenvolvimento.filter((x) => x.categoria?.nome.startsWith("2")).reduce((s, x) => s + x.valor_centavos, 0))} detalhe="estilista, tecidos de piloto, envios" />
              <Metrica rotulo="Modelagem e pilotagem" valor={brl(desenvolvimento.filter((x) => x.categoria?.nome.startsWith("6")).reduce((s, x) => s + x.valor_centavos, 0))} detalhe="moldes reaproveitados em novas cores" />
            </div>
            <TabelaDespesas lista={desenvolvimento} />
          </Secao>

          {/* Marketing mensal */}
          <Secao titulo="Marketing por mês">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.keys(d.marketing_por_mes).sort().map((m) => (
                <Metrica key={m} rotulo={mesBr(m)} valor={brl(d.marketing_por_mes[m].gastos + d.marketing_por_mes[m].creators)} detalhe={d.marketing_por_mes[m].creators > 0 ? `gastos ${brl(d.marketing_por_mes[m].gastos)} · peças p/ creators ${brl(d.marketing_por_mes[m].creators)}` : "site, social, fotos, tráfego"} />
              ))}
            </div>
            <TabelaDespesas lista={marketing} />
          </Secao>

          {/* Demais gastos */}
          <Secao titulo="Demais gastos: insumos, embalagem, fixos e acessórios" acoes={<button onClick={() => setMostrarTodas((m) => !m)} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">{mostrarTodas ? "Resumir" : "Ver lançamentos"}</button>}>
            <div className="rounded-lg border border-eclat-pedra/40 bg-white/60 p-4">
              <div className="text-meta uppercase tracking-wider text-eclat-texto-3 mb-2">Por mês</div>
              {meses.map((m) => (
                <div key={m} className="flex justify-between text-corpo py-0.5"><span className="text-eclat-texto-2">{mesBr(m)}</span><span className="lining-nums">{brl(Object.values(d.por_mes[m]).reduce((s, v) => s + v, 0))}</span></div>
              ))}
            </div>
            {mostrarTodas && <TabelaDespesas lista={demais} />}
          </Secao>
        </>
      )}
    </div>
  )
}

function TabelaDespesas({ lista }: { lista: Despesa[] }) {
  if (!lista.length) return <p className="text-corpo text-eclat-texto-3">Nenhum lançamento.</p>
  return (
    <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
      <table className="w-full text-corpo">
        <thead>
          <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
            <th className="px-4 py-2 font-normal">Data</th>
            <th className="px-4 py-2 font-normal">O quê</th>
            <th className="px-4 py-2 font-normal">Fornecedor</th>
            <th className="px-4 py-2 font-normal">Etapa</th>
            <th className="px-4 py-2 font-normal text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((x) => (
            <tr key={x.id} className="border-b border-eclat-pedra/10 last:border-0 align-top">
              <td className="px-4 py-2 whitespace-nowrap">{dataBr(x.data)}</td>
              <td className="px-4 py-2">
                <div>{x.descricao}</div>
                {x.observacao && <div className="text-meta text-eclat-texto/50">{x.observacao}</div>}
                {x.quantidade != null && x.custo_unitario_centavos != null && <div className="text-meta text-eclat-texto/50">{x.quantidade} × {brl(x.custo_unitario_centavos)}</div>}
              </td>
              <td className="px-4 py-2 text-eclat-texto-3">{x.fornecedor ?? "—"}</td>
              <td className="px-4 py-2 text-eclat-texto-3">{x.etapa ?? "—"}</td>
              <td className="px-4 py-2 text-right lining-nums font-medium whitespace-nowrap">{brl(x.valor_centavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
