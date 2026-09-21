"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

// Clube Éclat — painel da automação do grupo do WhatsApp (architecture/clube.md).
// Abas: Painel · Automações · Agenda · Aprovações · Histórico. Nada sai do sistema sem estar
// "aprovada" (por você ou por uma regra em modo automático que você ligou).

type Config = {
  ativo: boolean; grupo_jid: string; aviso_jid: string | null
  janela_inicio: string; janela_fim: string; max_por_dia: number; atraso_max_min: number; falhas_seguidas: number
}
type Regra = {
  tipo: string; ativa: boolean; modo: "automatico" | "aprovar"; template: string
  limiar: number | null; cooldown_horas: number; agrupar: boolean; anexar_foto: boolean
}
type Msg = {
  id: string; origem: "agenda" | "gatilho" | "manual"; tipo: string | null
  status: "rascunho" | "aprovada" | "enviada" | "falhou" | "descartada"
  enviar_em: string | null; titulo: string | null; texto: string; texto_final: string | null
  midia: string | null; midia_url_final: string | null; erro: string | null
  criado_em: string; enviado_em: string | null
}
type Estoque = { variant_id: string; product_handle: string; product_title: string; cor: string | null; tamanho: string | null; qty: number; imagem_url: string | null }
type Painel = {
  config?: Config; regras?: Regra[]; whatsapp?: string
  fila?: { aguardando: Msg[]; agendadas: Msg[]; enviadas: Msg[]; falhas: Msg[] }
  estoque?: Estoque[]; estoque_erro?: string; pedidos?: { total: number; hoje: number }; erro?: string
}

const ROTULO: Record<string, string> = {
  ultima_unidade: "Última unidade", reposicao: "Reposição", novidade: "Novidade", esgotado: "Esgotado", marco_reservas: "Marco de reservas",
}
const EXPLICA: Record<string, string> = {
  ultima_unidade: "Quando uma variação (peça + cor + tamanho) fica com o estoque no limiar ou abaixo.",
  reposicao: "Quando uma variação que estava zerada volta a ter estoque.",
  novidade: "Quando um produto novo é publicado, ou uma cor nova aparece num produto existente.",
  esgotado: "Quando TODOS os tamanhos de uma cor zeram. Sugestão: deixar em 'aprovar'.",
  marco_reservas: "Quando o total de pedidos cruza um múltiplo do limiar (10, 20, 30…).",
}

const card = "border border-eclat-pedra/40 rounded-lg p-5 bg-eclat-luz flex flex-col gap-3"
const input = "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-meta uppercase tracking-wider text-eclat-texto-3 mb-1 block"
const hint = "text-meta text-eclat-texto-3 leading-relaxed"
const btn = "bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-meta px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-texto disabled:opacity-50"
const btn2 = "border border-eclat-grafite/30 text-eclat-texto uppercase tracking-widest text-meta px-4 py-2 rounded-md hover:border-eclat-dourado disabled:opacity-50"
const chip = (s: string) => ({
  rascunho: "bg-amber-100 text-amber-900", aprovada: "bg-sky-100 text-sky-900", enviada: "bg-emerald-100 text-emerald-900",
  falhou: "bg-red-100 text-red-900", descartada: "bg-gray-200 text-gray-700",
}[s] || "bg-gray-100")

function fmt(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}
// datetime-local (hora de SP) ↔ ISO
function toLocalInput(iso: string | null) {
  if (!iso) return ""
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000)
  return d.toISOString().slice(0, 16)
}
function fromLocalInput(v: string) {
  return v ? `${v}:00-03:00` : null
}

export default function ClubePage() {
  const [aba, setAba] = useState<"painel" | "automacoes" | "agenda" | "aprovacoes" | "historico">("painel")
  const [p, setP] = useState<Painel>({})
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [painel, lista] = await Promise.all([
        fetch("/api/clube/painel", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/clube/mensagens?limit=300", { cache: "no-store" }).then((r) => r.json()),
      ])
      setP(painel || {})
      setMsgs(Array.isArray(lista) ? lista : [])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function api(path: string, method: string, body?: unknown) {
    setBusy(true); setAviso(null)
    try {
      const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `Erro ${r.status}`)
      await carregar()
      return d
    } catch (e) {
      setAviso((e as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const cfg = p.config
  const contagem = useMemo(() => ({
    aguardando: msgs.filter((m) => m.status === "rascunho").length,
    agendadas: msgs.filter((m) => m.status === "aprovada").length,
    enviadasHoje: msgs.filter((m) => m.status === "enviada" && m.enviado_em && new Date(m.enviado_em).toDateString() === new Date().toDateString()).length,
    falhas: msgs.filter((m) => m.status === "falhou").length,
  }), [msgs])

  if (loading && !cfg) return <p className="text-corpo text-eclat-texto-3">Carregando…</p>

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-texto">Clube Éclat</h1>
        <p className="text-corpo text-eclat-texto-3 mt-1">
          Tudo que vai para o grupo <strong>CLUB ÉCLAT</strong> passa por aqui. Agenda, gatilhos automáticos e envios manuais
          entram numa fila só; o carteiro roda a cada 5 minutos, dentro da janela de horário, e avisa você no privado se falhar.
        </p>
      </div>

      {aviso && <div className="text-corpo text-red-800 bg-red-50 border border-red-200 rounded-md px-4 py-2">{aviso}</div>}

      <nav className="flex gap-2 flex-wrap">
        {(["painel", "automacoes", "agenda", "aprovacoes", "historico"] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`${aba === a ? btn : btn2}`}>
            {a === "painel" ? "Painel" : a === "automacoes" ? "Automações" : a === "agenda" ? "Agenda" : a === "aprovacoes" ? `Aprovações${contagem.aguardando ? ` (${contagem.aguardando})` : ""}` : "Histórico"}
          </button>
        ))}
      </nav>

      {aba === "painel" && cfg && (
        <section className="flex flex-col gap-4">
          <div className={card}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-eclat-texto">Automação {cfg.ativo ? "LIGADA" : "DESLIGADA"}</p>
                <p className={hint}>Interruptor-mestre. Desligado, nada sai (nem agenda, nem gatilhos). Religar zera o contador de falhas.</p>
              </div>
              <button disabled={busy} onClick={() => api("/api/clube/config", "PUT", { ativo: !cfg.ativo })} className={cfg.ativo ? btn2 : btn}>
                {cfg.ativo ? "Desligar" : "Ligar"}
              </button>
            </div>
            <div className="grid grid-cols-2 small:grid-cols-4 gap-3 text-corpo">
              <Stat rotulo="WhatsApp" valor={p.whatsapp === "open" ? "conectado" : `⚠ ${p.whatsapp || "?"}`} alerta={p.whatsapp !== "open"} />
              <Stat rotulo="Aguardando aprovação" valor={String(contagem.aguardando)} alerta={contagem.aguardando > 0} />
              <Stat rotulo="Agendadas" valor={String(contagem.agendadas)} />
              <Stat rotulo="Enviadas hoje" valor={String(contagem.enviadasHoje)} />
            </div>
            {cfg.falhas_seguidas > 0 && (
              <p className="text-corpo text-red-800">Falhas seguidas: {cfg.falhas_seguidas} (com 3, a automação pausa sozinha).</p>
            )}
          </div>

          <div className={card}>
            <p className="font-semibold text-eclat-texto">Freios</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Janela: início</label><input type="time" className={input} defaultValue={cfg.janela_inicio.slice(0, 5)} onBlur={(e) => api("/api/clube/config", "PUT", { janela_inicio: e.target.value })} /></div>
              <div><label className={label}>Janela: fim</label><input type="time" className={input} defaultValue={cfg.janela_fim.slice(0, 5)} onBlur={(e) => api("/api/clube/config", "PUT", { janela_fim: e.target.value })} /></div>
              <div><label className={label}>Máx. automáticas por dia</label><input type="number" min={0} className={input} defaultValue={cfg.max_por_dia} onBlur={(e) => api("/api/clube/config", "PUT", { max_por_dia: Number(e.target.value) })} /></div>
              <div><label className={label}>Atraso aleatório (min)</label><input type="number" min={0} max={30} className={input} defaultValue={cfg.atraso_max_min} onBlur={(e) => api("/api/clube/config", "PUT", { atraso_max_min: Number(e.target.value) })} /></div>
              <div className="col-span-2"><label className={label}>Seu WhatsApp para alertas (só dígitos, com 55)</label><input className={input} defaultValue={cfg.aviso_jid || ""} onBlur={(e) => api("/api/clube/config", "PUT", { aviso_jid: e.target.value })} /></div>
            </div>
            <p className={hint}>Fora da janela a fila espera. O teto diário vale só para gatilhos (a agenda não conta). O atraso aleatório evita postar &quot;em ponto&quot;.</p>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-eclat-texto">Estoque agora (o que o detector vê)</p>
              <button disabled={busy} className={btn2} onClick={() => api("/api/clube/rodar", "POST")}>Rodar detector + carteiro agora</button>
            </div>
            {p.estoque_erro && <p className="text-corpo text-red-800">Erro na leitura: {p.estoque_erro}</p>}
            {p.estoque && (
              <div className="overflow-x-auto">
                <table className="text-corpo w-full">
                  <thead><tr className="text-left text-eclat-texto-3"><th className="pr-3">Peça</th><th className="pr-3">Cor</th><th className="pr-3">Tam.</th><th className="pr-3 text-right">Qtd.</th></tr></thead>
                  <tbody>
                    {p.estoque.map((v) => (
                      <tr key={v.variant_id} className={v.qty === 0 ? "text-red-800" : v.qty <= 1 ? "text-amber-800" : ""}>
                        <td className="pr-3">{v.product_title}</td><td className="pr-3">{v.cor}</td><td className="pr-3">{v.tamanho}</td><td className="pr-3 text-right tabular-nums">{v.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {p.pedidos && <p className={hint}>Pedidos: {p.pedidos.total} no total, {p.pedidos.hoje} hoje.</p>}
          </div>
        </section>
      )}

      {aba === "automacoes" && (
        <section className="flex flex-col gap-4">
          {(p.regras || []).map((r) => <RegraCard key={r.tipo} r={r} busy={busy} salvar={(f) => api(`/api/clube/regras/${r.tipo}`, "PUT", f)} preview={(t) => api("/api/clube/preview", "POST", { texto: t })} />)}
        </section>
      )}

      {aba === "agenda" && (
        <section className="flex flex-col gap-4">
          <NovaMensagem busy={busy} criar={(b) => api("/api/clube/mensagens", "POST", b)} />
          {msgs.filter((m) => m.origem === "agenda" && m.status !== "descartada" && m.status !== "enviada").length === 0 && <p className={hint}>Nenhuma mensagem pendente na agenda.</p>}
          {msgs.filter((m) => m.origem === "agenda" && m.status !== "descartada" && m.status !== "enviada").map((m) => (
            <MsgCard key={m.id} m={m} busy={busy} acao={(id, b) => api(`/api/clube/mensagens/${id}`, "PATCH", b)} preview={(t, midia) => api("/api/clube/preview", "POST", { texto: t, midia })} />
          ))}
        </section>
      )}

      {aba === "aprovacoes" && (
        <section className="flex flex-col gap-4">
          <p className={hint}>Rascunhos gerados por gatilhos em modo &quot;aprovar&quot; e mensagens manuais salvas sem aprovar. Aprovar coloca na fila; a entrega respeita a janela e o teto.</p>
          {msgs.filter((m) => m.status === "rascunho" && m.origem !== "agenda").length === 0 && <p className={hint}>Nada aguardando.</p>}
          {msgs.filter((m) => m.status === "rascunho" && m.origem !== "agenda").map((m) => (
            <MsgCard key={m.id} m={m} busy={busy} acao={(id, b) => api(`/api/clube/mensagens/${id}`, "PATCH", b)} preview={(t, midia) => api("/api/clube/preview", "POST", { texto: t, midia })} />
          ))}
        </section>
      )}

      {aba === "historico" && (
        <section className="flex flex-col gap-3">
          {msgs.filter((m) => ["enviada", "falhou", "descartada"].includes(m.status)).sort((a, b) => (b.enviado_em || b.criado_em).localeCompare(a.enviado_em || a.criado_em)).map((m) => (
            <div key={m.id} className={card}>
              <div className="flex items-center gap-2 text-meta">
                <span className={`px-2 py-0.5 rounded ${chip(m.status)}`}>{m.status}</span>
                <span className="text-eclat-texto-3">{m.origem}{m.tipo ? ` · ${ROTULO[m.tipo] || m.tipo}` : ""} · {fmt(m.enviado_em || m.criado_em)}</span>
              </div>
              <p className="font-medium text-corpo">{m.titulo}</p>
              <pre className="whitespace-pre-wrap text-corpo font-sans text-eclat-texto-2">{m.texto_final || m.texto}</pre>
              {m.erro && <p className="text-corpo text-red-800">Erro: {m.erro}</p>}
              {m.status === "falhou" && <div><button disabled={busy} className={btn2} onClick={() => api(`/api/clube/mensagens/${m.id}`, "PATCH", { acao: "aprovar" })}>Tentar de novo</button></div>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Stat({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 ${alerta ? "bg-amber-50 border border-amber-200" : "bg-white border border-eclat-pedra/40"}`}>
      <div className="text-meta uppercase tracking-wider text-eclat-texto-3">{rotulo}</div>
      <div className="text-lg font-semibold text-eclat-texto">{valor}</div>
    </div>
  )
}

function RegraCard({ r, busy, salvar, preview }: { r: Regra; busy: boolean; salvar: (f: Partial<Regra>) => Promise<unknown>; preview: (t: string) => Promise<{ texto_final?: string } | null> }) {
  const [template, setTemplate] = useState(r.template)
  const [prev, setPrev] = useState<string | null>(null)
  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-eclat-texto">{ROTULO[r.tipo] || r.tipo} {r.ativa ? "" : <span className="text-meta text-eclat-texto-3">(desligada)</span>}</p>
          <p className={hint}>{EXPLICA[r.tipo]}</p>
        </div>
        <button disabled={busy} className={r.ativa ? btn2 : btn} onClick={() => salvar({ ativa: !r.ativa })}>{r.ativa ? "Desligar" : "Ligar"}</button>
      </div>
      <div className="grid grid-cols-2 small:grid-cols-4 gap-3">
        <div>
          <label className={label}>Modo</label>
          <select className={input} value={r.modo} onChange={(e) => salvar({ modo: e.target.value as Regra["modo"] })}>
            <option value="automatico">Automático (sai sozinho)</option>
            <option value="aprovar">Aprovar antes</option>
          </select>
        </div>
        {(r.tipo === "ultima_unidade" || r.tipo === "marco_reservas") && (
          <div><label className={label}>{r.tipo === "ultima_unidade" ? "Limiar (qtd ≤)" : "A cada N reservas"}</label><input type="number" min={1} className={input} defaultValue={r.limiar ?? 1} onBlur={(e) => salvar({ limiar: Number(e.target.value) })} /></div>
        )}
        <div><label className={label}>Não repetir por (h)</label><input type="number" min={1} className={input} defaultValue={r.cooldown_horas} onBlur={(e) => salvar({ cooldown_horas: Number(e.target.value) })} /></div>
        <div className="flex flex-col gap-1 pt-5 text-corpo">
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.agrupar} onChange={(e) => salvar({ agrupar: e.target.checked })} /> agrupar numa mensagem</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.anexar_foto} onChange={(e) => salvar({ anexar_foto: e.target.checked })} /> anexar foto da peça</label>
        </div>
      </div>
      <div>
        <label className={label}>Modelo da mensagem</label>
        <textarea className={`${input} min-h-[90px]`} value={template} onChange={(e) => setTemplate(e.target.value)} />
        <p className={hint}>Marcadores: {"{{ultimas_unidades}} {{reposicao}} {{novidades}} {{esgotados}} {{reservas_total}} {{reservas_hoje}} {{dias_para_envio}}"}. Frase com marcador vazio some sozinha.</p>
      </div>
      <div className="flex gap-2">
        <button disabled={busy || template === r.template} className={btn} onClick={() => salvar({ template })}>Salvar modelo</button>
        <button disabled={busy} className={btn2} onClick={async () => { const d = await preview(template); setPrev(d?.texto_final ?? "(sem texto: nenhum dado real agora)") }}>Prévia com dados de hoje</button>
      </div>
      {prev !== null && <pre className="whitespace-pre-wrap text-corpo font-sans bg-white border border-eclat-pedra/40 rounded-md p-3">{prev}</pre>}
    </div>
  )
}

function NovaMensagem({ busy, criar }: { busy: boolean; criar: (b: unknown) => Promise<unknown> }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState("")
  const [titulo, setTitulo] = useState("")
  const [midia, setMidia] = useState("")
  const [quando, setQuando] = useState("")
  if (!aberto) return <div><button className={btn} onClick={() => setAberto(true)}>Nova mensagem</button></div>
  return (
    <div className={card}>
      <p className="font-semibold text-eclat-texto">Nova mensagem para o grupo</p>
      <div><label className={label}>Título (só para você)</label><input className={input} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
      <div><label className={label}>Texto</label><textarea className={`${input} min-h-[140px]`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="*negrito* com asteriscos, como no WhatsApp" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Foto (opcional)</label><input className={input} value={midia} onChange={(e) => setMidia(e.target.value)} placeholder="produto:macaquinho-solaris:Telha ou uma URL" /></div>
        <div><label className={label}>Quando (vazio = agora)</label><input type="datetime-local" className={input} value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <button disabled={busy || !texto.trim()} className={btn} onClick={async () => { await criar({ texto, titulo, midia, enviar_em: fromLocalInput(quando), aprovar: true, origem: quando ? "agenda" : "manual" }); setAberto(false); setTexto(""); setTitulo(""); setMidia(""); setQuando("") }}>{quando ? "Agendar (aprovada)" : "Enviar agora"}</button>
        <button disabled={busy || !texto.trim()} className={btn2} onClick={async () => { await criar({ texto, titulo, midia, enviar_em: fromLocalInput(quando), aprovar: false, origem: quando ? "agenda" : "manual" }); setAberto(false); setTexto(""); setTitulo(""); setMidia(""); setQuando("") }}>Salvar como rascunho</button>
        <button className={btn2} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  )
}

function MsgCard({ m, busy, acao, preview }: { m: Msg; busy: boolean; acao: (id: string, b: unknown) => Promise<unknown>; preview: (t: string, midia: string | null) => Promise<{ texto_final?: string; midia_url?: string | null } | null> }) {
  const [texto, setTexto] = useState(m.texto)
  const [midia, setMidia] = useState(m.midia || "")
  const [quando, setQuando] = useState(toLocalInput(m.enviar_em))
  const [prev, setPrev] = useState<{ texto_final?: string; midia_url?: string | null } | null>(null)
  const alterado = texto !== m.texto || midia !== (m.midia || "") || quando !== toLocalInput(m.enviar_em)
  const temPreencher = /\[PREENCHER/.test(texto)
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-meta flex-wrap">
        <span className={`px-2 py-0.5 rounded ${chip(m.status)}`}>{m.status}</span>
        <span className="text-eclat-texto-3">{m.origem}{m.tipo ? ` · ${ROTULO[m.tipo] || m.tipo}` : ""}</span>
        {temPreencher && <span className="px-2 py-0.5 rounded bg-red-100 text-red-900">tem [PREENCHER]: edite antes de aprovar</span>}
      </div>
      <p className="font-medium text-corpo">{m.titulo}</p>
      <textarea className={`${input} min-h-[120px]`} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Foto</label><input className={input} value={midia} onChange={(e) => setMidia(e.target.value)} placeholder="produto:handle:Cor, URL, ou vazio" /></div>
        <div><label className={label}>Quando (hora de Brasília)</label><input type="datetime-local" className={input} value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {alterado && <button disabled={busy} className={btn} onClick={() => acao(m.id, { texto, midia, enviar_em: fromLocalInput(quando) })}>Salvar alterações</button>}
        {m.status === "rascunho" && <button disabled={busy || alterado || temPreencher} className={btn} onClick={() => acao(m.id, { acao: "aprovar" })}>Aprovar</button>}
        {m.status === "aprovada" && <button disabled={busy} className={btn2} onClick={() => acao(m.id, { acao: "rascunho" })}>Voltar para rascunho</button>}
        <button disabled={busy || alterado || temPreencher} className={btn2} onClick={() => acao(m.id, { acao: "enviar_agora" })}>Enviar agora</button>
        <button disabled={busy} className={btn2} onClick={async () => setPrev(await preview(texto, midia || null))}>Prévia</button>
        <button disabled={busy} className={btn2} onClick={() => { if (confirm("Descartar esta mensagem?")) acao(m.id, { acao: "descartar" }) }}>Descartar</button>
      </div>
      {prev && (
        <div className="bg-white border border-eclat-pedra/40 rounded-md p-3 flex flex-col gap-2">
          {prev.midia_url && <img src={prev.midia_url} alt="" className="max-h-48 w-auto rounded" />}
          <pre className="whitespace-pre-wrap text-corpo font-sans">{prev.texto_final || "(sem texto: nenhum dado real agora)"}</pre>
        </div>
      )}
    </div>
  )
}
