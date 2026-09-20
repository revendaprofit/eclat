"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { linkWhatsApp, type CarrinhoAbandonado, type Estagio } from "@/lib/carrinhos"

type Resposta = {
  dias: number
  min_parado_min: number
  resumo: { total: number; valor: number; com_contato: number; valor_com_contato: number; pagamento: number }
  carrinhos: CarrinhoAbandonado[]
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
const parado = (h: number) => (h < 1 ? "há menos de 1 h" : h < 48 ? `há ${Math.floor(h)} h` : `há ${Math.floor(h / 24)} dias`)

const ESTAGIOS: Record<Estagio, { txt: string; cls: string; dica: string }> = {
  pagamento: { txt: "Pagamento iniciado", cls: "bg-eclat-grafite text-eclat-luz", dica: "Gerou Pix ou tentou o cartão e não concluiu" },
  identificado: { txt: "Deixou contato", cls: "bg-eclat-dourado/30 text-eclat-grafite", dica: "Digitou e-mail/telefone no checkout" },
  sacola: { txt: "Só sacola", cls: "bg-eclat-pedra/30 text-eclat-grafite/60", dica: "Colocou peças e saiu sem se identificar" },
}
type Filtro = "" | Estagio | "contato"
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "contato", label: "Com contato" },
  { id: "pagamento", label: "Pagamento iniciado" },
  { id: "identificado", label: "Deixou contato" },
  { id: "sacola", label: "Só sacola" },
]
const noFiltro = (c: CarrinhoAbandonado, f: Filtro) => (f === "" ? true : f === "contato" ? c.estagio !== "sacola" : c.estagio === f)

export default function CarrinhosPage() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(30)
  const [filtro, setFiltro] = useState<Filtro>("contato")
  const [aberto, setAberto] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro("")
    try {
      const r = await fetch(`/api/carrinhos?dias=${dias}`, { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setDados(j)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  const lista = useMemo(() => (dados?.carrinhos ?? []).filter((c) => noFiltro(c, filtro)), [dados, filtro])

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-grafite">Carrinhos abandonados</h1>
        <div className="flex items-center gap-2">
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
          >
            {[7, 15, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                Últimos {d} dias
              </option>
            ))}
          </select>
          <button onClick={carregar} className="text-xs px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
            Atualizar
          </button>
        </div>
      </div>
      <p className="text-xs text-eclat-grafite/50 mb-4">
        Carrinho com peças, não finalizado e parado há mais de 1 hora. Só leitura: nada é enviado sozinho — o botão do WhatsApp abre a conversa
        com a mensagem pronta para você revisar e mandar.
      </p>

      {dados && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { t: "Carrinhos", v: String(dados.resumo.total) },
            { t: "Valor parado", v: brl(dados.resumo.valor) },
            { t: "Com contato", v: `${dados.resumo.com_contato} · ${brl(dados.resumo.valor_com_contato)}` },
            { t: "Pagamento iniciado", v: String(dados.resumo.pagamento) },
          ].map((k) => (
            <div key={k.t} className="border border-eclat-pedra/40 rounded-lg bg-white/60 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-eclat-grafite/50">{k.t}</div>
              <div className="text-lg text-eclat-grafite mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTROS.map((f) => {
          const n = (dados?.carrinhos ?? []).filter((c) => noFiltro(c, f.id)).length
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtro === f.id ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "bg-white border-eclat-pedra/50 hover:bg-eclat-areia/40"
              }`}
            >
              {f.label} <span className={filtro === f.id ? "text-eclat-luz/60" : "text-eclat-grafite/40"}>{n}</span>
            </button>
          )
        })}
      </div>

      {loading && <p className="text-sm text-eclat-grafite/50">Carregando…</p>}
      {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>}
      {!loading && !erro && lista.length === 0 && <p className="text-sm text-eclat-grafite/50">Nenhum carrinho neste filtro.</p>}

      {!loading && !erro && lista.length > 0 && (
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-eclat-grafite/50 border-b border-eclat-pedra/20">
                <th className="px-4 py-2 font-normal">Quem</th>
                <th className="px-4 py-2 font-normal">Peças</th>
                <th className="px-4 py-2 font-normal text-right">Valor</th>
                <th className="px-4 py-2 font-normal">Estágio</th>
                <th className="px-4 py-2 font-normal">Parado</th>
                <th className="px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const e = ESTAGIOS[c.estagio]
                const wa = linkWhatsApp(c)
                return (
                  <tr key={c.id} className="border-b border-eclat-pedra/10 last:border-0 align-top hover:bg-eclat-areia/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{c.nome || c.email || "Visitante sem identificação"}</div>
                      <div className="text-xs text-eclat-grafite/50">
                        {[c.nome ? c.email : null, c.telefone, c.cidade].filter(Boolean).join(" · ") || "sem contato"}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => setAberto(aberto === c.id ? null : c.id)} className="text-left hover:underline">
                        {c.pecas} peça(s) <span className="text-eclat-grafite/40">{aberto === c.id ? "▲" : "▼"}</span>
                      </button>
                      {aberto === c.id && (
                        <ul className="mt-1 text-xs text-eclat-grafite/70 space-y-0.5">
                          {c.itens.map((i) => (
                            <li key={i.id}>
                              {i.quantidade}× {i.titulo}
                              {i.variacao ? ` — ${i.variacao}` : ""} <span className="text-eclat-grafite/40">{brl(i.preco)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{brl(c.valor)}</td>
                    <td className="px-4 py-2">
                      <span title={e.dica} className={`text-[11px] px-2 py-0.5 rounded-full ${e.cls}`}>
                        {e.txt}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-eclat-grafite/70">
                      {parado(c.horas_parado)}
                      <div className="text-xs text-eclat-grafite/40">{dataHora(c.parado_desde)}</div>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">
                          💬 WhatsApp
                        </a>
                      ) : c.email ? (
                        <a href={`mailto:${c.email}`} className="text-xs px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
                          ✉ E-mail
                        </a>
                      ) : (
                        <span className="text-xs text-eclat-grafite/30">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
