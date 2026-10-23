"use client"

import { useEffect, useState } from "react"
import { Aviso, Carregando, Secao, TituloPagina } from "@/components/ui"

// Visão geral do financeiro em quadros (sócia, 2026-10-23): um número por assunto, sem detalhar; o detalhe abre
// ao clicar. Vendas sempre dizem de qual coleção é a peça.
type Linha = { rotulo: string; valor: number; nota?: string }
type Lancamento = { id: string; data: string; descricao: string | null; fornecedor: string | null; etapa: string | null; valor: number }
type Quadro = { id: string; titulo: string; total: number; linhas: Linha[]; nota?: string; lancamentos: Lancamento[] }
type VendaCol = { colecao: string; pecas: number; receita: number; custo: number; site: number; fora: number; investido: number; producao: number; itens: { nome: string; pecas: number; receita: number }[] }
type Resposta = {
  total: number
  por_ano: Record<string, number>
  quadros: { colecoes: Quadro[]; modelagem: Quadro; marketing: Quadro; creators: Quadro; social: Quadro; trafego: Quadro; fotos: Quadro; site: Quadro; claude: Quadro; uso_proprio: Quadro; insumos: Quadro; embalagem: Quadro; fixos: Quadro; acessorios: Quadro }
  vendas_por_colecao: VendaCol[]
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/")

function Card({ q, destaque, aberto, onToggle }: { q: Quadro; destaque?: boolean; aberto: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={q.lancamentos.length ? onToggle : undefined}
      className={`rounded-xl border p-4 flex flex-col gap-2 ${q.lancamentos.length ? "cursor-pointer hover:border-eclat-dourado" : ""} ${destaque ? "border-eclat-dourado/60 bg-eclat-dourado/10" : "border-eclat-pedra/50 bg-white"}`}
    >
      <div className="flex justify-between items-baseline"><span className="text-meta uppercase tracking-wider text-eclat-texto-3">{q.titulo}</span>{q.lancamentos.length > 0 && <span className="text-meta text-eclat-texto/40">{aberto ? "▲" : "▼"}</span>}</div>
      <div className="font-serif lining-nums tabular-nums text-numero leading-none text-eclat-texto">{brl(q.total)}</div>
      {q.nota && <div className="text-meta text-eclat-texto-3">{q.nota}</div>}
      {q.linhas.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5">
          {q.linhas.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 text-meta text-eclat-texto-2">
              <span>{l.rotulo}{l.nota ? <span className="text-eclat-texto/50"> · {l.nota}</span> : null}</span>
              <span className="lining-nums whitespace-nowrap">{brl(l.valor)}</span>
            </div>
          ))}
        </div>
      )}
      {q.lancamentos.length > 0 && !aberto && <div className="text-meta text-eclat-texto/40 mt-1">clique para ver os {q.lancamentos.length} item(ns)</div>}
      {aberto && q.lancamentos.length > 0 && (
        <table className="w-full text-meta mt-1">
          <tbody>
            {q.lancamentos.map((l) => (
              <tr key={l.id} className="border-t border-eclat-pedra/20 align-top">
                <td className="py-1 pr-2 whitespace-nowrap text-eclat-texto-3">{dataBr(l.data)}</td>
                <td className="py-1 pr-2">{l.descricao}{l.fornecedor ? <span className="text-eclat-texto/50"> · {l.fornecedor}</span> : null}{l.etapa ? <span className="text-eclat-texto/50"> · {l.etapa}</span> : null}</td>
                <td className="py-1 text-right lining-nums whitespace-nowrap">{brl(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function InvestimentosPage() {
  const [d, setD] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/investimentos", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setD(j)))
      .catch((e) => setErro((e as Error).message))
  }, [])
  const toggle = (id: string) => setAberto((a) => (a === id ? null : id))
  const q = d?.quadros

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina titulo="Visão geral do financeiro" descricao="Um quadro por assunto. Clique em 'ver lançamentos' para abrir o detalhe. Gasto novo: me avise no chat que eu lanço." />
      {!d && !erro && <Carregando />}
      {erro && <Aviso>{erro}</Aviso>}
      {d && q && (
        <>
          <Secao titulo="Investimento total">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-eclat-dourado/60 bg-eclat-dourado/10 p-4">
                <div className="text-meta uppercase tracking-wider text-eclat-texto-3">Investido até hoje</div>
                <div className="font-serif lining-nums tabular-nums text-numero leading-none text-eclat-texto mt-2">{brl(d.total)}</div>
                <div className="text-meta text-eclat-texto-3 mt-1.5">{Object.entries(d.por_ano).sort().map(([a, v]) => `${a}: ${brl(v)}`).join(" · ")}</div>
              </div>
              {q.colecoes.map((c) => <Card key={c.id} q={c} destaque aberto={aberto === c.id} onToggle={() => toggle(c.id)} />)}
            </div>
          </Secao>

          <Secao titulo="Vendas por coleção">
            {d.vendas_por_colecao.length === 0 ? (
              <p className="text-corpo text-eclat-texto-3">Nenhuma venda paga ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {d.vendas_por_colecao.map((v) => (
                  <div key={v.colecao} onClick={() => toggle(`venda:${v.colecao}`)} className="rounded-xl border border-eclat-pedra/50 bg-white p-4 flex flex-col gap-2 cursor-pointer hover:border-eclat-dourado">
                    <div className="flex justify-between items-baseline"><span className="text-meta uppercase tracking-wider text-eclat-texto-3">{v.colecao}</span><span className="text-meta text-eclat-texto/40">{aberto === `venda:${v.colecao}` ? "▲" : "▼"}</span></div>
                    <div className="font-serif lining-nums tabular-nums text-numero leading-none text-eclat-texto">{brl(v.receita)}</div>
                    <div className="text-meta text-eclat-texto-3">{v.pecas} peça(s) vendida(s){v.producao ? ` de ${v.producao} produzidas` : ""} · site {brl(v.site)} · fora do site {brl(v.fora)}</div>
                    <div className="flex flex-col gap-0.5 text-meta text-eclat-texto-2 mt-1">
                      <div className="flex justify-between"><span>Custo das peças vendidas</span><span className="lining-nums">{brl(v.custo)}</span></div>
                      <div className="flex justify-between"><span>Margem bruta</span><span className="lining-nums">{brl(v.receita - v.custo)}</span></div>
                      {v.investido > 0 && <div className="flex justify-between"><span>Investimento da coleção recuperado</span><span className="lining-nums">{((v.receita / v.investido) * 100).toFixed(0)}% · faltam {brl(Math.max(0, v.investido - v.receita))}</span></div>}
                    </div>
                    {aberto === `venda:${v.colecao}` ? (
                      <table className="w-full text-meta mt-1">
                        <tbody>
                          {v.itens.map((it) => (
                            <tr key={it.nome} className="border-t border-eclat-pedra/20"><td className="py-1 pr-2">{it.nome}</td><td className="py-1 pr-2 text-right lining-nums whitespace-nowrap">{it.pecas} un.</td><td className="py-1 text-right lining-nums whitespace-nowrap">{brl(it.receita)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-meta text-eclat-texto/40">clique para ver as peças vendidas</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Secao>

          <Secao titulo="Modelagem e pilotos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card q={q.modelagem} aberto={aberto === q.modelagem.id} onToggle={() => toggle(q.modelagem.id)} />
            </div>
          </Secao>

          <Secao titulo="Marketing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card q={q.marketing} destaque aberto={false} onToggle={() => undefined} />
              <Card q={q.creators} aberto={aberto === "creators"} onToggle={() => toggle("creators")} />
              <Card q={q.social} aberto={aberto === "social"} onToggle={() => toggle("social")} />
              <Card q={q.trafego} aberto={aberto === "trafego"} onToggle={() => toggle("trafego")} />
              <Card q={q.fotos} aberto={aberto === "fotos"} onToggle={() => toggle("fotos")} />
              <Card q={q.site} aberto={aberto === "site"} onToggle={() => toggle("site")} />
              <Card q={q.claude} aberto={aberto === "claude"} onToggle={() => toggle("claude")} />
            </div>
          </Secao>

          <Secao titulo="Insumos, embalagem, fixos e acessórios">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card q={q.insumos} aberto={aberto === "insumos"} onToggle={() => toggle("insumos")} />
              <Card q={q.embalagem} aberto={aberto === "embalagem"} onToggle={() => toggle("embalagem")} />
              <Card q={q.fixos} aberto={aberto === "fixos"} onToggle={() => toggle("fixos")} />
              <Card q={q.acessorios} aberto={aberto === "acessorios"} onToggle={() => toggle("acessorios")} />
              <Card q={q.uso_proprio} aberto={aberto === "uso_proprio"} onToggle={() => toggle("uso_proprio")} />
            </div>
          </Secao>
        </>
      )}
    </div>
  )
}
