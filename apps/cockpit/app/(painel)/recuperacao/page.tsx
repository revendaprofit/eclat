"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ETAPAS, GATILHOS, MOTIVOS, type Etapa, type LinhaRecuperacao, type RecuperacaoConfig,
} from "@/lib/recuperacao"

type Resposta = {
  config: RecuperacaoConfig | null
  linhas: LinhaRecuperacao[]
  resumo: { na_fila: number; abordagens_hoje: number; abordadas: number; responderam: number; emails: number; compraram: number }
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"

const COR_ETAPA: Record<Etapa, string> = {
  aguardando: "bg-eclat-pedra/30 text-eclat-texto-3",
  abordada: "bg-eclat-dourado/30 text-eclat-texto",
  respondeu: "bg-eclat-grafite text-eclat-luz",
  oferta_enviada: "bg-eclat-grafite text-eclat-luz",
  encerrada: "bg-white border border-eclat-pedra/40 text-eclat-texto-3",
}

type Filtro = "" | "andamento" | Etapa
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "andamento", label: "Em andamento" },
  { id: "aguardando", label: "Na fila" },
  { id: "respondeu", label: "Responderam" },
  { id: "encerrada", label: "Encerradas" },
  { id: "", label: "Todas" },
]
const noFiltro = (l: LinhaRecuperacao, f: Filtro) =>
  f === "" ? true : f === "andamento" ? l.etapa !== "encerrada" : f === "respondeu" ? Boolean(l.resposta_em) : l.etapa === f

function Interruptor({ ligado, onClick, rotulo, carregando }: { ligado: boolean; onClick: () => void; rotulo: string; carregando: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={carregando}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
        ligado ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "bg-white border-eclat-pedra/50 hover:bg-eclat-areia/40"
      }`}
    >
      <span className={`w-9 h-5 rounded-full relative ${ligado ? "bg-eclat-dourado" : "bg-eclat-pedra/50"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ligado ? "left-4" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block text-corpo font-medium">{rotulo}</span>
        <span className={`block text-meta ${ligado ? "text-eclat-luz/70" : "text-eclat-texto-3"}`}>{ligado ? "Ligado" : "Desligado"}</span>
      </span>
    </button>
  )
}

export default function RecuperacaoPage() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>("andamento")
  const [aberto, setAberto] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<RecuperacaoConfig>>({})

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro("")
    try {
      const r = await fetch("/api/recuperacao", { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setDados(j)
      setForm(j.config ?? {})
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(campos: Partial<RecuperacaoConfig>) {
    setSalvando(true)
    setAviso("")
    try {
      const r = await fetch("/api/recuperacao/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campos) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setDados((d) => (d ? { ...d, config: j } : d))
      setForm(j)
      setAviso("Salvo.")
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function encerrar(id: string) {
    if (!confirm("Tirar esta pessoa da automação? Nada mais será enviado para ela.")) return
    const r = await fetch(`/api/recuperacao/${id}`, { method: "POST" })
    if (r.ok) carregar()
  }

  const cfg = dados?.config
  const lista = useMemo(() => (dados?.linhas ?? []).filter((l) => noFiltro(l, filtro)), [dados, filtro])

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-texto">Recuperação automática</h1>
        <button onClick={carregar} className="text-meta px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
          Atualizar
        </button>
      </div>
      <p className="text-meta text-eclat-texto-3 mb-4 max-w-3xl">
        Quem deixou contato e não comprou recebe um contato automático: no WhatsApp, a {cfg?.persona || "Camila"} só dá um oi primeiro —
        o motivo, o cupom e o link vão depois que a pessoa responde. Quem deixou e-mail recebe um e-mail (sozinho, ou 4 h depois de um oi
        sem resposta). Se alguém da equipe escrever pelo celular, a automação sai da conversa.
      </p>

      {loading && <p className="text-corpo text-eclat-texto-3">Carregando…</p>}
      {erro && <p className="text-corpo text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>}

      {cfg && (
        <>
          {cfg.falhas_seguidas >= 3 && !cfg.whatsapp_ativo && (
            <p className="text-corpo text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
              O WhatsApp foi pausado sozinho depois de 3 falhas seguidas. Confira a conexão do número em Conversas antes de religar.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <Interruptor rotulo="WhatsApp automático" ligado={cfg.whatsapp_ativo} carregando={salvando} onClick={() => salvar({ whatsapp_ativo: !cfg.whatsapp_ativo })} />
            <Interruptor rotulo="E-mail automático" ligado={cfg.email_ativo} carregando={salvando} onClick={() => salvar({ email_ativo: !cfg.email_ativo })} />
          </div>

          <details className="border border-eclat-pedra/40 rounded-lg bg-white/60 mb-4">
            <summary className="px-4 py-3 cursor-pointer text-corpo">
              Regras: persona <strong>{cfg.persona}</strong> · até <strong>{cfg.max_abordagens_dia}</strong> abordagens por dia · intervalo de{" "}
              <strong>
                {cfg.intervalo_min_min} a {cfg.intervalo_max_min} min
              </strong>{" "}
              · das <strong>{cfg.janela_inicio.slice(0, 5)}</strong> às <strong>{cfg.janela_fim.slice(0, 5)}</strong> · cupom{" "}
              <strong>{cfg.cupom || "nenhum"}</strong>
            </summary>
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-corpo">
              {(
                [
                  ["persona", "Persona (primeiro nome)", "text"],
                  ["cupom", "Cupom da oferta", "text"],
                  ["janela_inicio", "Começa às", "time"],
                  ["janela_fim", "Para às", "time"],
                  ["max_abordagens_dia", "Abordagens por dia (máx. 40)", "number"],
                  ["intervalo_min_min", "Intervalo mínimo (min)", "number"],
                  ["intervalo_max_min", "Intervalo máximo (min)", "number"],
                ] as const
              ).map(([k, rotulo, tipo]) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-meta text-eclat-texto-3">{rotulo}</span>
                  <input
                    type={tipo}
                    value={String((form as Record<string, unknown>)[k] ?? "").slice(0, tipo === "time" ? 5 : undefined)}
                    onChange={(e) => setForm({ ...form, [k]: tipo === "number" ? Number(e.target.value) : e.target.value })}
                    className="border border-eclat-pedra/50 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-eclat-dourado"
                  />
                </label>
              ))}
              <div className="flex items-end gap-3">
                <button
                  disabled={salvando}
                  onClick={() =>
                    salvar({
                      persona: form.persona, cupom: form.cupom, janela_inicio: form.janela_inicio, janela_fim: form.janela_fim,
                      max_abordagens_dia: form.max_abordagens_dia, intervalo_min_min: form.intervalo_min_min, intervalo_max_min: form.intervalo_max_min,
                    })
                  }
                  className="text-meta px-4 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90 disabled:opacity-50"
                >
                  Salvar regras
                </button>
              </div>
            </div>
          </details>
          {aviso && <p className="text-meta text-eclat-texto-2 mb-3">{aviso}</p>}
        </>
      )}

      {dados && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          {[
            { t: "Na fila", v: dados.resumo.na_fila },
            { t: "Abordagens hoje", v: `${dados.resumo.abordagens_hoje}${cfg ? ` / ${cfg.max_abordagens_dia}` : ""}` },
            { t: "Abordadas (14 dias)", v: dados.resumo.abordadas },
            { t: "Responderam", v: dados.resumo.responderam },
            { t: "E-mails", v: dados.resumo.emails },
            { t: "Compraram", v: dados.resumo.compraram },
          ].map((k) => (
            <div key={k.t} className="border border-eclat-pedra/40 rounded-lg bg-white/60 px-4 py-3">
              <div className="text-meta uppercase tracking-wider text-eclat-texto-3">{k.t}</div>
              <div className="text-lg text-eclat-texto mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`text-meta px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f.id ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "bg-white border-eclat-pedra/50 hover:bg-eclat-areia/40"
            }`}
          >
            {f.label} <span className={filtro === f.id ? "text-eclat-luz/60" : "text-eclat-texto/40"}>{(dados?.linhas ?? []).filter((l) => noFiltro(l, f.id)).length}</span>
          </button>
        ))}
      </div>

      {!loading && !erro && lista.length === 0 && <p className="text-corpo text-eclat-texto-3">Ninguém neste filtro.</p>}

      {lista.length > 0 && (
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-x-auto">
          <table className="w-full text-corpo">
            <thead>
              <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                <th className="px-4 py-2 font-normal">Quem</th>
                <th className="px-4 py-2 font-normal">Ocasião</th>
                <th className="px-4 py-2 font-normal">Etapa</th>
                <th className="px-4 py-2 font-normal">WhatsApp</th>
                <th className="px-4 py-2 font-normal">E-mail</th>
                <th className="px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className="border-b border-eclat-pedra/10 last:border-0 align-top hover:bg-eclat-areia/30">
                  <td className="px-4 py-2">
                    <button onClick={() => setAberto(aberto === l.id ? null : l.id)} className="text-left">
                      <div className="font-medium">{l.nome || l.email || l.contato || "—"}</div>
                      <div className="text-meta text-eclat-texto-3">{[l.contato, l.nome ? l.email : null].filter(Boolean).join(" · ")}</div>
                    </button>
                    {aberto === l.id && (
                      <div className="mt-2 text-meta text-eclat-texto-2 space-y-1 max-w-md">
                        {(l.dados?.itens ?? []).map((i, n) => (
                          <div key={n}>
                            {i.quantidade}× {i.titulo}
                            {i.variante ? ` — ${i.variante}` : ""}
                          </div>
                        ))}
                        {l.abordagem_texto && <div className="bg-eclat-areia/40 rounded px-2 py-1">💬 {l.abordagem_texto}</div>}
                        {l.oferta_texto && <div className="bg-eclat-areia/40 rounded px-2 py-1">💬 {l.oferta_texto}</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {GATILHOS[l.gatilho]}
                    <div className="text-meta text-eclat-texto/40">desde {dataHora(l.criado_em)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-meta px-2 py-0.5 rounded-full ${COR_ETAPA[l.etapa]}`}>{ETAPAS[l.etapa]}</span>
                    {l.motivo_fim && <div className="text-meta text-eclat-texto-3 mt-1">{MOTIVOS[l.motivo_fim] ?? l.motivo_fim}</div>}
                    {l.etapa === "aguardando" && <div className="text-meta text-eclat-texto/40 mt-1">a partir de {dataHora(l.elegivel_em)}</div>}
                  </td>
                  <td className="px-4 py-2 text-meta text-eclat-texto-2">
                    {l.abordagem_em ? `oi ${dataHora(l.abordagem_em)}` : l.contato ? "—" : "sem número"}
                    {l.resposta_em && <div>respondeu {dataHora(l.resposta_em)}</div>}
                    {l.oferta_em && <div>oferta {dataHora(l.oferta_em)}</div>}
                  </td>
                  <td className="px-4 py-2 text-meta text-eclat-texto-2">{l.email_em ? dataHora(l.email_em) : l.email ? "—" : "sem e-mail"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {l.etapa !== "encerrada" && (
                      <button onClick={() => encerrar(l.id)} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
                        Parar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
