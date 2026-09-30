"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ETAPAS, MOTIVOS, type AvaliacaoConfig, type EtapaAvaliacao, type LinhaAvaliacao } from "@/lib/avaliacao"

type Resposta = {
  config: AvaliacaoConfig | null
  freios: { persona: string; janela_inicio: string; janela_fim: string; max_abordagens_dia: number } | null
  linhas: LinhaAvaliacao[]
  resumo: { agendadas: number; pedidas_hoje: number; pedidas: number; responderam: number; autorizaram: number; no_site: number }
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"

const COR_ETAPA: Record<EtapaAvaliacao, string> = {
  agendada: "bg-eclat-pedra/30 text-eclat-texto-3",
  pedida: "bg-eclat-dourado/30 text-eclat-texto",
  respondeu: "bg-eclat-grafite text-eclat-luz",
  autorizacao_pedida: "bg-eclat-dourado/30 text-eclat-texto",
  autorizada: "bg-green-700 text-white",
  publicada: "bg-green-100 text-green-900 border border-green-300",
  encerrada: "bg-white border border-eclat-pedra/40 text-eclat-texto-3",
}

type Filtro = "" | "andamento" | "para_publicar" | "respostas" | "publicada" | "encerrada"
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "para_publicar", label: "Para publicar" },
  { id: "andamento", label: "Em andamento" },
  { id: "respostas", label: "Com resposta" },
  { id: "publicada", label: "No site" },
  { id: "encerrada", label: "Encerradas" },
  { id: "", label: "Todas" },
]
const noFiltro = (l: LinhaAvaliacao, f: Filtro) =>
  f === ""
    ? true
    : f === "andamento"
      ? !["encerrada", "publicada"].includes(l.etapa)
      : f === "para_publicar"
        ? l.etapa === "autorizada" || l.etapa === "autorizacao_pedida"
        : f === "respostas"
          ? Boolean(l.resposta_em)
          : l.etapa === f

export default function AvaliacoesPage() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>("para_publicar")
  const [form, setForm] = useState<Partial<AvaliacaoConfig>>({})

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro("")
    try {
      const r = await fetch("/api/avaliacoes", { cache: "no-store" })
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

  async function salvar(campos: Partial<AvaliacaoConfig>) {
    setSalvando(true)
    setAviso("")
    try {
      const r = await fetch("/api/avaliacoes/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campos) })
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

  async function acao(id: string, nome: "parar" | "autorizou" | "nao_autorizou" | "publicar") {
    const perguntas: Record<typeof nome, string> = {
      parar: "Tirar esta cliente da automação? Nada mais será enviado para ela.",
      autorizou: "Confirmar que a resposta dela é um SIM para publicar no site?",
      nao_autorizou: "Marcar que ela NÃO autorizou? O comentário não vai para o site.",
      publicar: "Publicar o comentário no site, exatamente como ela escreveu, com o primeiro nome?",
    }
    if (!confirm(perguntas[nome])) return
    setAviso("")
    const r = await fetch(`/api/avaliacoes/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: nome }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) setAviso(j.error || `HTTP ${r.status}`)
    else {
      if (nome === "publicar") setAviso("Publicado. Aparece no site em até 30 segundos.")
      carregar()
    }
  }

  const cfg = dados?.config
  const lista = useMemo(() => (dados?.linhas ?? []).filter((l) => noFiltro(l, filtro)), [dados, filtro])

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-texto">Avaliações</h1>
        <button onClick={carregar} className="text-meta px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
          Atualizar
        </button>
      </div>
      <p className="text-meta text-eclat-texto-3 mb-4 max-w-3xl">
        {cfg?.dias_apos_entrega ?? 3} dias depois da entrega, a {dados?.freios?.persona || "Camila"} pergunta pelo WhatsApp o que ela achou (sem
        link). Se ela responder, pergunta se pode colocar o comentário no site só com o primeiro nome. Com o &quot;sim&quot; dela, o comentário
        aparece aqui para você publicar com um clique, exatamente como ela escreveu. Para quem comprou fora do site, use &quot;Pedir
        avaliação&quot; na conversa.
      </p>

      {loading && <p className="text-corpo text-eclat-texto-3">Carregando…</p>}
      {erro && <p className="text-corpo text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>}

      {cfg && (
        <>
          <button
            onClick={() => salvar({ ativo: !cfg.ativo })}
            disabled={salvando}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors disabled:opacity-50 mb-4 ${
              cfg.ativo ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "bg-white border-eclat-pedra/50 hover:bg-eclat-areia/40"
            }`}
          >
            <span className={`w-9 h-5 rounded-full relative ${cfg.ativo ? "bg-eclat-dourado" : "bg-eclat-pedra/50"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${cfg.ativo ? "left-4" : "left-0.5"}`} />
            </span>
            <span>
              <span className="block text-corpo font-medium">Pedido de avaliação pelo WhatsApp</span>
              <span className={`block text-meta ${cfg.ativo ? "text-eclat-luz/70" : "text-eclat-texto-3"}`}>{cfg.ativo ? "Ligado" : "Desligado"}</span>
            </span>
          </button>

          <details className="border border-eclat-pedra/40 rounded-lg bg-white/60 mb-4">
            <summary className="px-4 py-3 cursor-pointer text-corpo">
              Regras: <strong>{cfg.dias_apos_entrega}</strong> dias depois da entrega (sem dado de entrega:{" "}
              <strong>{cfg.dias_apos_despacho}</strong> depois do despacho) · pedidos a partir de <strong>{dataHora(cfg.marco_zero)}</strong>
              {dados?.freios && (
                <>
                  {" "}
                  · freios da Recuperação: das {dados.freios.janela_inicio.slice(0, 5)} às {dados.freios.janela_fim.slice(0, 5)}, até{" "}
                  {dados.freios.max_abordagens_dia} mensagens por dia somando as duas automações
                </>
              )}
            </summary>
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-corpo">
              {(
                [
                  ["dias_apos_entrega", "Dias depois da entrega"],
                  ["dias_apos_despacho", "Dias depois do despacho (sem dado de entrega)"],
                ] as const
              ).map(([k, rotulo]) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-meta text-eclat-texto-3">{rotulo}</span>
                  <input
                    type="number"
                    value={String(form[k] ?? "")}
                    onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
                    className="border border-eclat-pedra/50 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-eclat-dourado"
                  />
                </label>
              ))}
              {(
                [
                  ["texto_pedido", "1ª mensagem (vazio = variações padrão). Use {nome}, {pecas} e {persona}. Sem link."],
                  ["texto_autorizacao", "2ª mensagem, pedindo autorização (vazio = padrão)"],
                ] as const
              ).map(([k, rotulo]) => (
                <label key={k} className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-meta text-eclat-texto-3">{rotulo}</span>
                  <textarea
                    rows={3}
                    value={String(form[k] ?? "")}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="border border-eclat-pedra/50 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-eclat-dourado"
                  />
                </label>
              ))}
              <div>
                <button
                  disabled={salvando}
                  onClick={() =>
                    salvar({
                      dias_apos_entrega: form.dias_apos_entrega,
                      dias_apos_despacho: form.dias_apos_despacho,
                      texto_pedido: form.texto_pedido ?? null,
                      texto_autorizacao: form.texto_autorizacao ?? null,
                    })
                  }
                  className="text-meta px-4 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90 disabled:opacity-50"
                >
                  Salvar regras
                </button>
              </div>
            </div>
          </details>
        </>
      )}
      {aviso && <p className="text-meta text-eclat-texto-2 mb-3">{aviso}</p>}

      {dados && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          {[
            { t: "Agendadas", v: dados.resumo.agendadas },
            { t: "Pedidas hoje", v: dados.resumo.pedidas_hoje },
            { t: "Pedidas (60 dias)", v: dados.resumo.pedidas },
            { t: "Responderam", v: dados.resumo.responderam },
            { t: "Autorizaram", v: dados.resumo.autorizaram },
            { t: "No site", v: dados.resumo.no_site },
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
            {f.label}{" "}
            <span className={filtro === f.id ? "text-eclat-luz/60" : "text-eclat-texto/40"}>
              {(dados?.linhas ?? []).filter((l) => noFiltro(l, f.id)).length}
            </span>
          </button>
        ))}
      </div>

      {!loading && !erro && lista.length === 0 && <p className="text-corpo text-eclat-texto-3">Ninguém neste filtro.</p>}

      <div className="flex flex-col gap-3">
        {lista.map((l) => (
          <div key={l.id} className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-corpo">
                  {l.nome || l.contato || "—"}{" "}
                  <span className="text-meta text-eclat-texto-3 font-normal">
                    {l.display_id ? `pedido #${l.display_id}` : "pedido manual"} · {l.pecas || "as peças"}
                  </span>
                </div>
                <div className="text-meta text-eclat-texto-3">
                  {l.etapa === "agendada" ? `sai a partir de ${dataHora(l.elegivel_em)}` : `pedida ${dataHora(l.pedido_em)}`}
                  {l.resposta_em && ` · respondeu ${dataHora(l.resposta_em)}`}
                  {l.autorizou_em && ` · autorizou ${dataHora(l.autorizou_em)}`}
                  {l.publicado_em && ` · no site desde ${dataHora(l.publicado_em)}`}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-meta px-2 py-0.5 rounded-full ${COR_ETAPA[l.etapa]}`}>{ETAPAS[l.etapa]}</span>
                {l.motivo_fim && <div className="text-meta text-eclat-texto-3 mt-1">{MOTIVOS[l.motivo_fim] ?? l.motivo_fim}</div>}
              </div>
            </div>

            {(l.resposta_texto || l.tem_foto) && (
              <blockquote className="mt-3 border-l-2 border-eclat-dourado pl-3 text-corpo text-eclat-texto whitespace-pre-wrap">
                {l.resposta_texto || <span className="text-eclat-texto-3">(mandou só foto/áudio — veja a conversa)</span>}
                {l.tem_foto && <div className="text-meta text-eclat-texto-3 mt-1">📷 mandou foto (na conversa)</div>}
              </blockquote>
            )}
            {l.autorizou_texto && (
              <div className="mt-2 text-meta text-eclat-texto-2">
                Resposta à autorização: <span className="italic">“{l.autorizou_texto}”</span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {l.etapa === "autorizada" && (
                <button onClick={() => acao(l.id, "publicar")} className="text-meta px-3 py-1.5 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">
                  Publicar no site
                </button>
              )}
              {l.etapa === "autorizacao_pedida" && l.autorizou_texto && (
                <>
                  <button onClick={() => acao(l.id, "autorizou")} className="text-meta px-3 py-1.5 rounded-md border border-green-600 text-green-800 bg-white hover:bg-green-50">
                    É um sim
                  </button>
                  <button onClick={() => acao(l.id, "nao_autorizou")} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
                    Não autorizou
                  </button>
                </>
              )}
              {l.conversation_id && (
                <Link href={`/conversas?c=${l.conversation_id}`} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
                  Abrir conversa
                </Link>
              )}
              {!["encerrada", "publicada"].includes(l.etapa) && (
                <button onClick={() => acao(l.id, "parar")} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">
                  Parar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
