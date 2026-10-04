"use client"

import { useCallback, useEffect, useState } from "react"
import { brl, mensagemParaParceira, type Parceria, type ResumoParceria, type Venda } from "@/lib/parcerias"

type Linha = Parceria & { resumo: ResumoParceria }
type Lista = { hoje: string; parcerias: Linha[] }
type Ficha = { hoje: string; parceria: Parceria; vendas: Venda[]; resumo: ResumoParceria }

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-meta uppercase tracking-wider text-eclat-texto-3 mb-1 block"
const btn =
  "bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-meta px-5 py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-texto disabled:opacity-50"
const btnClaro = "text-meta px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40 disabled:opacity-50"
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
const mesTitulo = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long" })
const contagem = (t: { pedidos: number; comissao_centavos: number }) => (t.pedidos ? `${t.pedidos} · ${brl(t.comissao_centavos)}` : "—")

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j as T
}

export default function ParceriasPage() {
  const [dados, setDados] = useState<Lista | null>(null)
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro("")
    try {
      setDados(await chamar<Lista>("/api/parcerias"))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  const lista = dados?.parcerias ?? []
  const somaMes = lista.reduce((s, p) => s + p.resumo.mes_atual.comissao_centavos, 0)
  const somaAnterior = lista.reduce((s, p) => s + p.resumo.mes_anterior.comissao_centavos, 0)
  const vendasMes = lista.reduce((s, p) => s + p.resumo.mes_atual.pedidos, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-texto">Parcerias</h1>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className={btnClaro}>
            Atualizar
          </button>
          <button onClick={() => setNovo((v) => !v)} className={btn}>
            {novo ? "Fechar" : "Nova parceria"}
          </button>
        </div>
      </div>
      <p className="text-meta text-eclat-texto-3 mb-4 max-w-3xl leading-relaxed">
        Cupom da influencer: a cliente ganha o desconto nas peças (nunca no frete, nunca somando com o Benefício Conjunto) e a parceira
        recebe a comissão sobre o valor das peças efetivamente pago. Só conta pedido pago e não cancelado. O repasse fecha por mês.
      </p>

      {novo && <NovaParceria onCriada={() => { setNovo(false); carregar() }} />}

      {dados && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { t: "Parcerias ativas", v: String(lista.filter((p) => p.ativa).length) },
            { t: `Vendas em ${mesTitulo(dados.hoje)}`, v: String(vendasMes) },
            { t: `Comissão de ${mesTitulo(dados.hoje)}`, v: brl(somaMes) },
            { t: "Comissão do mês anterior", v: brl(somaAnterior) },
          ].map((k) => (
            <div key={k.t} className="border border-eclat-pedra/40 rounded-lg bg-white/60 px-4 py-3">
              <div className="text-meta uppercase tracking-wider text-eclat-texto-3">{k.t}</div>
              <div className="text-lg text-eclat-texto mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-corpo text-eclat-texto-3">Carregando…</p>}
      {erro && <p className="text-corpo text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>}
      {!loading && !erro && lista.length === 0 && <p className="text-corpo text-eclat-texto-3">Nenhuma parceria cadastrada.</p>}

      {!loading && !erro && lista.length > 0 && (
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-x-auto">
          <table className="w-full text-corpo min-w-[720px]">
            <thead>
              <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                <th className="px-4 py-2 font-normal">Cupom</th>
                <th className="px-4 py-2 font-normal">Parceira</th>
                <th className="px-4 py-2 font-normal text-right">Cliente</th>
                <th className="px-4 py-2 font-normal text-right">Comissão</th>
                <th className="px-4 py-2 font-normal">Usos</th>
                <th className="px-4 py-2 font-normal text-right">Mês atual</th>
                <th className="px-4 py-2 font-normal text-right">Mês anterior</th>
                <th className="px-4 py-2 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr
                  key={p.codigo}
                  onClick={() => setAberta(aberta === p.codigo ? null : p.codigo)}
                  className={`border-b border-eclat-pedra/10 last:border-0 cursor-pointer hover:bg-eclat-areia/30 ${aberta === p.codigo ? "bg-eclat-dourado/10" : ""} ${p.ativa ? "" : "opacity-50"}`}
                >
                  <td className="px-4 py-2 font-mono font-medium">
                    {p.codigo}
                    {!p.ativa && <span className="ml-2 text-meta text-eclat-texto-3">desativada</span>}
                  </td>
                  <td className="px-4 py-2">
                    {p.nome}
                    {p.instagram && <div className="text-meta text-eclat-texto-3">@{p.instagram}</div>}
                  </td>
                  <td className="px-4 py-2 text-right">{p.desconto_percentual}%</td>
                  <td className="px-4 py-2 text-right">{p.comissao_percentual}%</td>
                  <td className="px-4 py-2 text-meta text-eclat-texto-2">{p.medusa_campaign_id ? "com teto" : "sem teto"}</td>
                  <td className="px-4 py-2 text-right">{contagem(p.resumo.mes_atual)}</td>
                  <td className="px-4 py-2 text-right">{contagem(p.resumo.mes_anterior)}</td>
                  <td className="px-4 py-2 text-right font-medium">{contagem(p.resumo.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-meta text-eclat-texto-3">Nas colunas de período: pedidos pagos · comissão. Clique na linha para abrir a ficha.</p>
        </div>
      )}

      {/* key = código: trocar de parceira remonta a ficha (estado zerado) sem setState dentro de efeito */}
      {aberta && <FichaParceria key={aberta} codigo={aberta} onMudou={carregar} />}
    </div>
  )
}

function NovaParceria({ onCriada }: { onCriada: () => void }) {
  const [f, setF] = useState({ codigo: "", nome: "", instagram: "", whatsapp: "", desconto_percentual: 10, comissao_percentual: 5, notas: "" })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((v) => ({ ...v, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }))

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    const codigo = f.codigo.trim().toUpperCase()
    if (!confirm(`Criar o cupom ${codigo} na loja agora (${f.desconto_percentual}% nas peças, sem teto de usos) e cadastrar ${f.nome} com ${f.comissao_percentual}% de comissão?`)) return
    setSalvando(true)
    setErro("")
    try {
      await chamar("/api/parcerias", { method: "POST", body: JSON.stringify(f) })
      onCriada()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={criar} className="border border-eclat-pedra/40 rounded-lg p-5 bg-eclat-luz mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className={label}>Código do cupom</label>
        <input className={`${input} font-mono uppercase`} value={f.codigo} onChange={set("codigo")} placeholder="PATY10" required />
        <p className="text-meta text-eclat-texto-3 mt-1">Padrão: nome + desconto (NOME10). Só letras e números.</p>
      </div>
      <div>
        <label className={label}>Parceira</label>
        <input className={input} value={f.nome} onChange={set("nome")} placeholder="Nome" required />
      </div>
      <div>
        <label className={label}>Instagram</label>
        <input className={input} value={f.instagram} onChange={set("instagram")} placeholder="@perfil" />
      </div>
      <div>
        <label className={label}>WhatsApp</label>
        <input className={input} value={f.whatsapp} onChange={set("whatsapp")} placeholder="(31) 9…" />
      </div>
      <div>
        <label className={label}>Desconto da cliente (%)</label>
        <input className={input} type="number" min={1} max={100} value={f.desconto_percentual} onChange={set("desconto_percentual")} />
      </div>
      <div>
        <label className={label}>Comissão da parceira (%)</label>
        <input className={input} type="number" min={0} max={100} value={f.comissao_percentual} onChange={set("comissao_percentual")} />
      </div>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={salvando} className={btn}>
          {salvando ? "Criando…" : "Criar cupom e parceria"}
        </button>
        {erro && <span className="text-corpo text-red-700">{erro}</span>}
      </div>
    </form>
  )
}

function FichaParceria({ codigo, onMudou }: { codigo: string; onMudou: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [erro, setErro] = useState("")
  const [edit, setEdit] = useState({ nome: "", instagram: "", whatsapp: "", comissao_percentual: 0, notas: "" })
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    setErro("")
    try {
      const f = await chamar<Ficha>(`/api/parcerias/${codigo}`)
      setFicha(f)
      setEdit({
        nome: f.parceria.nome,
        instagram: f.parceria.instagram ?? "",
        whatsapp: f.parceria.whatsapp ?? "",
        comissao_percentual: f.parceria.comissao_percentual,
        notas: f.parceria.notas ?? "",
      })
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [codigo])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function patch(body: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return
    setSalvando(true)
    setErro("")
    try {
      await chamar(`/api/parcerias/${codigo}`, { method: "PATCH", body: JSON.stringify(body) })
      await carregar()
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  if (!ficha) return <p className="text-corpo text-eclat-texto-3 mt-4">{erro || "Carregando ficha…"}</p>
  const p = ficha.parceria
  const msg = mensagemParaParceira(p)
  const wa = p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(msg)}` : null

  return (
    <section className="mt-4 border border-eclat-pedra/40 rounded-lg bg-eclat-luz p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-eclat-texto">
            <span className="font-mono">{p.codigo}</span> · {p.nome}
          </h2>
          <p className="text-meta text-eclat-texto-3 mt-1">
            Cliente {p.desconto_percentual}% · comissão {p.comissao_percentual}% · {p.medusa_campaign_id ? "com teto de usos" : "sem teto"} · criada em {data(p.criado_em)}
            {p.notas && ` · ${p.notas}`}
          </p>
        </div>
        <button
          disabled={salvando}
          onClick={() =>
            patch(
              { ativa: !p.ativa },
              p.ativa ? `Desativar ${p.codigo}? O cupom para de funcionar na loja na hora.` : `Reativar ${p.codigo}? O cupom volta a valer na loja.`
            )
          }
          className={btnClaro}
        >
          {p.ativa ? "Desativar cupom" : "Reativar cupom"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { t: mesTitulo(ficha.hoje), v: contagem(ficha.resumo.mes_atual) },
          { t: "Mês anterior", v: contagem(ficha.resumo.mes_anterior) },
          { t: "Desde o início", v: contagem(ficha.resumo.total) },
          { t: "Aguardando pagamento", v: String(ficha.resumo.pendentes) },
        ].map((k) => (
          <div key={k.t} className="border border-eclat-pedra/40 rounded-lg bg-white/60 px-4 py-3">
            <div className="text-meta uppercase tracking-wider text-eclat-texto-3">{k.t}</div>
            <div className="text-lg text-eclat-texto mt-0.5">{k.v}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-meta uppercase tracking-wider text-eclat-texto-3 mb-2">Pedidos com o cupom</h3>
        {ficha.vendas.length === 0 ? (
          <p className="text-corpo text-eclat-texto-3">Nenhum pedido usou {p.codigo} ainda.</p>
        ) : (
          <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-x-auto">
            <table className="w-full text-corpo min-w-[560px]">
              <thead>
                <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                  <th className="px-4 py-2 font-normal">Pedido</th>
                  <th className="px-4 py-2 font-normal">Data</th>
                  <th className="px-4 py-2 font-normal">Cliente</th>
                  <th className="px-4 py-2 font-normal text-right">Peças pagas</th>
                  <th className="px-4 py-2 font-normal text-right">Comissão</th>
                  <th className="px-4 py-2 font-normal">Situação</th>
                </tr>
              </thead>
              <tbody>
                {ficha.vendas.map((v) => (
                  <tr key={v.order_id} className={`border-b border-eclat-pedra/10 last:border-0 ${v.conta ? "" : "text-eclat-texto-3"}`}>
                    <td className="px-4 py-2">
                      <a href={`/pedidos?id=${v.order_id}`} className="hover:underline">
                        #{v.display_id}
                      </a>
                    </td>
                    <td className="px-4 py-2">{data(v.criado_em)}</td>
                    <td className="px-4 py-2 text-meta">{v.email ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{brl(v.base_centavos)}</td>
                    <td className="px-4 py-2 text-right font-medium">{v.conta ? brl(v.comissao_centavos) : "—"}</td>
                    <td className="px-4 py-2 text-meta">{v.conta ? "conta" : v.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          patch(edit)
        }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div>
          <label className={label}>Parceira</label>
          <input className={input} value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} required />
        </div>
        <div>
          <label className={label}>Instagram</label>
          <input className={input} value={edit.instagram} onChange={(e) => setEdit({ ...edit, instagram: e.target.value })} placeholder="@perfil" />
        </div>
        <div>
          <label className={label}>WhatsApp</label>
          <input className={input} value={edit.whatsapp} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} placeholder="(31) 9…" />
        </div>
        <div>
          <label className={label}>Comissão (%)</label>
          <input
            className={input}
            type="number"
            min={0}
            max={100}
            value={edit.comissao_percentual}
            onChange={(e) => setEdit({ ...edit, comissao_percentual: Number(e.target.value) })}
          />
        </div>
        <div className="md:col-span-3">
          <label className={label}>Notas</label>
          <input className={input} value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} />
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" disabled={salvando} className={btn}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {erro && <p className="md:col-span-4 text-corpo text-red-700">{erro}</p>}
      </form>

      <div className="border-t border-eclat-pedra/30 pt-4">
        <div className="text-meta uppercase tracking-wider text-eclat-texto-3 mb-1">Mensagem para a parceira</div>
        <p className="text-corpo text-eclat-texto-2 mb-2">{msg}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={btnClaro}
            onClick={() => {
              navigator.clipboard?.writeText(msg)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2000)
            }}
          >
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-meta px-3 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">
              💬 Abrir no WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
