"use client"

import { useCallback, useEffect, useState } from "react"
import { META_SEGUNDA_PECA, type CreatorDoPainel, type VideoDoPainel } from "@/lib/creators"
import { brl } from "@/lib/parcerias"

// Crescimento → Creators: o ciclo (desenho 2026-09-29-programa-creators-design.md §9).
// Os vídeos entram sozinhos pela leitura diária do Instagram (7h); aqui a Camila vê o que vendeu, quem está parada,
// quem ganhou a 2ª peça, e copia o resumo da semana para o grupo das creators.

type Dados = { creators: CreatorDoPainel[]; resumo: string }

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-meta uppercase tracking-wider text-eclat-texto-3 mb-1 block"
const btn =
  "bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-meta px-5 py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-texto disabled:opacity-50"
const btnClaro = "text-meta px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40 disabled:opacity-50"
const etiqueta = "inline-block rounded-sm px-1.5 py-0.5 text-meta uppercase tracking-wider"
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—")
const numero = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"))

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j as T
}

export default function CreatorsPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const [loading, setLoading] = useState(true)
  const [lendo, setLendo] = useState(false)
  const [novo, setNovo] = useState(false)
  const [briefing, setBriefing] = useState("")
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro("")
    try {
      setDados(await chamar<Dados>("/api/creators"))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function lerPerfis() {
    setLendo(true)
    setAviso("")
    setErro("")
    try {
      const r = await chamar<{ instagram_configurado: boolean; registro: string[] }>("/api/creators/ler-perfis", { method: "POST" })
      const novos = r.registro.filter((l) => l.includes("vídeo novo")).length
      const falhas = r.registro.filter((l) => l.startsWith("AVISO"))
      setAviso(
        !r.instagram_configurado
          ? "O acesso ao Instagram não está configurado no servidor (META_IG_TOKEN)."
          : falhas.length
            ? `Leitura feita com ${falhas.length} falha(s): ${falhas[0].replace("AVISO ", "")}`
            : novos
              ? `${novos} vídeo(s) novo(s) cadastrado(s).`
              : "Perfis lidos. Nenhum vídeo novo."
      )
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLendo(false)
    }
  }

  const lista = dados?.creators ?? []
  const todosVideos = lista.flatMap((c) => c.videos)
  const textoResumo = dados ? dados.resumo + (briefing.trim() ? `\n\n*Ideias para a próxima semana*\n${briefing.trim()}` : "") : ""

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoResumo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro("Não foi possível copiar. Selecione o texto e copie à mão.")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-texto">Creators</h1>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className={btnClaro}>
            Atualizar
          </button>
          <button onClick={() => setNovo((v) => !v)} className={btnClaro}>
            {novo ? "Fechar" : "Cadastrar vídeo à mão"}
          </button>
          <button onClick={lerPerfis} disabled={lendo} className={btn}>
            {lendo ? "Lendo…" : "Ler perfis agora"}
          </button>
        </div>
      </div>
      <p className="text-meta text-eclat-texto-3 mb-4 max-w-3xl leading-relaxed">
        Todo dia às 7h o sistema lê o Instagram de cada creator e cadastra sozinho os posts que citam a ÉCLAT (o nome, o @eclat.use ou o
        cupom dela na legenda). Venda com o cupom vai para o vídeo do link numerado ou, sem número, para o último vídeo dela (até 14 dias).
        Vídeo vencedor: 3 vendas em 14 dias. Segunda peça: {META_SEGUNDA_PECA} vendas. Parada: 21 dias sem publicar. Stories não aparecem
        na leitura.
      </p>

      {aviso && <p className="text-corpo text-eclat-texto bg-eclat-areia/50 border border-eclat-pedra/40 rounded-md p-3 mb-4">{aviso}</p>}
      {erro && <p className="text-corpo text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4">{erro}</p>}
      {loading && <p className="text-corpo text-eclat-texto-3">Carregando…</p>}

      {novo && dados && <NovoVideo creators={lista} onCriado={() => { setNovo(false); carregar() }} />}

      {dados && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { t: "Creators ativas", v: `${lista.filter((c) => c.situacao === "ativa").length} de ${lista.length}` },
            { t: "Vídeos cadastrados", v: String(todosVideos.length) },
            { t: "Vídeos vencedores", v: String(todosVideos.filter((v) => v.vencedor_em).length) },
            { t: "Vendas com cupom", v: String(lista.reduce((s, c) => s + c.vendas_que_contam, 0)) },
          ].map((k) => (
            <div key={k.t} className="border border-eclat-pedra/40 rounded-lg bg-white/60 px-4 py-3">
              <div className="text-meta uppercase tracking-wider text-eclat-texto-3">{k.t}</div>
              <div className="text-lg text-eclat-texto mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && !erro && lista.length === 0 && <p className="text-corpo text-eclat-texto-3">Nenhuma creator aprovada.</p>}

      <div className="flex flex-col gap-4">
        {lista.map((c) => (
          <Creator key={c.id} c={c} onMudou={carregar} onErro={setErro} />
        ))}
      </div>

      {dados && lista.length > 0 && (
        <section className="mt-8 border border-eclat-pedra/40 rounded-lg bg-white/60 p-4 max-w-3xl">
          <h2 className="font-serif text-xl text-eclat-texto mb-1">Resumo da semana para o grupo</h2>
          <p className="text-meta text-eclat-texto-3 mb-3 leading-relaxed">
            Texto pronto para colar no grupo de WhatsApp das creators. O sistema não envia sozinho, para proteger o número. Não leva
            dado de cliente nem valor de comissão.
          </p>
          <label className={label} htmlFor="briefing">
            Ideias para a próxima semana (opcional)
          </label>
          <textarea
            id="briefing"
            rows={3}
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Ex.: mostrar o silicone do short no agachamento; gravar a troca do look do treino para o dia a dia."
            className={input}
          />
          <pre className="mt-3 whitespace-pre-wrap text-corpo text-eclat-texto bg-eclat-areia/30 border border-eclat-pedra/30 rounded-md p-3" data-testid="resumo-semanal">
            {textoResumo}
          </pre>
          <button onClick={copiar} className={`${btn} mt-3`}>
            {copiado ? "Copiado" : "Copiar resumo"}
          </button>
        </section>
      )}
    </div>
  )
}

function Creator({ c, onMudou, onErro }: { c: CreatorDoPainel; onMudou: () => void; onErro: (m: string) => void }) {
  const liberada = c.falta_para_segunda_peca === 0
  return (
    <section className="border border-eclat-pedra/40 rounded-lg bg-white/60" data-testid="creator">
      <header className="flex items-start justify-between gap-4 flex-wrap px-4 py-3 border-b border-eclat-pedra/20">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-serif text-xl text-eclat-texto">{c.nome}</h2>
            <span className={`${etiqueta} ${c.situacao === "ativa" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              {c.situacao === "ativa" ? "Ativa" : "Parada"}
            </span>
            {liberada && <span className={`${etiqueta} bg-eclat-dourado/30 text-eclat-texto`}>2ª peça liberada</span>}
          </div>
          <div className="text-meta text-eclat-texto-3 mt-1">
            <a href={`https://www.instagram.com/${c.instagram}/`} target="_blank" rel="noopener noreferrer" className="underline">
              @{c.instagram}
            </a>
            {" · "}
            {numero(c.seguidores)} seguidores · engajamento {c.engajamento_pct == null ? "—" : `${String(c.engajamento_pct).replace(".", ",")}%`}
            {" · "}último vídeo {data(c.ultimo_video_em)}
          </div>
          {c.link && (
            <div className="text-meta text-eclat-texto-3 mt-1">
              Cupom <strong className="text-eclat-texto">{c.codigo}</strong> · link{" "}
              <span className="font-mono text-eclat-texto">{c.link.replace("https://", "")}</span> (com /1, /2… para cada Stories)
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg text-eclat-texto">
            {c.vendas_que_contam} {c.vendas_que_contam === 1 ? "venda" : "vendas"}
          </div>
          <div className="text-meta text-eclat-texto-3">comissão prevista {brl(c.comissao_centavos)}</div>
          <div className="text-meta text-eclat-texto-3">
            {liberada ? "chegou às 5 vendas" : `${c.falta_para_segunda_peca === 1 ? "falta 1 venda" : `faltam ${c.falta_para_segunda_peca} vendas`} para a 2ª peça`}
          </div>
        </div>
      </header>

      {c.videos.length === 0 ? (
        <p className="px-4 py-3 text-corpo text-eclat-texto-3">
          Nenhum vídeo sobre a ÉCLAT encontrado. Peça para ela citar a marca ou o cupom na legenda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-corpo">
            <thead>
              <tr className="text-left text-meta uppercase tracking-wider text-eclat-texto-3">
                <th className="px-4 py-2 font-normal">Vídeo</th>
                <th className="px-3 py-2 font-normal">Publicado</th>
                <th className="px-3 py-2 font-normal text-center">Vendas</th>
                <th className="px-3 py-2 font-normal">Em anúncio</th>
                <th className="px-3 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {c.videos.map((v) => (
                <Video key={v.id} v={v} onMudou={onMudou} onErro={onErro} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Video({ v, onMudou, onErro }: { v: VideoDoPainel; onMudou: () => void; onErro: (m: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(v.titulo ?? "")
  const [ocupado, setOcupado] = useState(false)

  async function salvar(campos: Record<string, unknown>) {
    setOcupado(true)
    try {
      await chamar(`/api/creators/videos/${v.id}`, { method: "PATCH", body: JSON.stringify(campos) })
      setEditando(false)
      onMudou()
    } catch (e) {
      onErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  async function apagar() {
    if (!window.confirm("Apagar este vídeo da lista? Use só se o post não era sobre a ÉCLAT.")) return
    setOcupado(true)
    try {
      await chamar(`/api/creators/videos/${v.id}`, { method: "DELETE" })
      onMudou()
    } catch (e) {
      onErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <tr className="border-t border-eclat-pedra/10 align-top" data-testid="video">
      <td className="px-4 py-2">
        {editando ? (
          <div className="flex gap-2">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={input} aria-label="Nome do vídeo" />
            <button onClick={() => salvar({ titulo })} disabled={ocupado} className={btnClaro}>
              Salvar
            </button>
          </div>
        ) : (
          <div>
            <div className="text-eclat-texto">{v.titulo || (v.origem === "link" ? `Vídeo nº ${v.numero}` : "Sem título")}</div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className={`${etiqueta} bg-eclat-areia text-eclat-texto`}>{v.formato}</span>
              {v.origem === "link" && <span className={`${etiqueta} bg-eclat-areia text-eclat-texto`}>link /{v.numero}</span>}
              {v.vencedor_em && <span className={`${etiqueta} bg-eclat-dourado/40 text-eclat-texto`}>Vencedor</span>}
              {v.link_post && (
                <a href={v.link_post} target="_blank" rel="noopener noreferrer" className="text-meta underline text-eclat-texto-3">
                  ver no Instagram
                </a>
              )}
            </div>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-eclat-texto-2 whitespace-nowrap">{data(v.publicado_em)}</td>
      <td className="px-3 py-2 text-center text-eclat-texto">{v.vendas}</td>
      <td className="px-3 py-2">
        <label className="inline-flex items-center gap-2 text-meta text-eclat-texto-3">
          <input type="checkbox" checked={v.em_anuncio} disabled={ocupado} onChange={(e) => salvar({ em_anuncio: e.target.checked })} />
          {v.em_anuncio ? "sim" : "não"}
        </label>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button onClick={() => setEditando((x) => !x)} className="text-meta underline text-eclat-texto-3 mr-3">
          {editando ? "cancelar" : "renomear"}
        </button>
        {v.vendas === 0 && (
          <button onClick={apagar} disabled={ocupado} className="text-meta underline text-red-700">
            apagar
          </button>
        )}
      </td>
    </tr>
  )
}

function NovoVideo({ creators, onCriado }: { creators: CreatorDoPainel[]; onCriado: () => void }) {
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? "")
  const [link, setLink] = useState("")
  const [titulo, setTitulo] = useState("")
  const [quando, setQuando] = useState(new Date().toISOString().slice(0, 10))
  const [formato, setFormato] = useState("reels")
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setSalvando(true)
    try {
      await chamar("/api/creators/videos", {
        method: "POST",
        body: JSON.stringify({ creator_id: creatorId, link_post: link, titulo, publicado_em: `${quando}T12:00:00-03:00`, formato }),
      })
      onCriado()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-4 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-3xl">
      <p className="lg:col-span-2 text-meta text-eclat-texto-3 leading-relaxed">
        Use para o post que a leitura não pegou (sem legenda, sem citar a marca) ou para Stories.
      </p>
      <div>
        <label className={label} htmlFor="nv-creator">Creator</label>
        <select id="nv-creator" value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className={input}>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} (@{c.instagram})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="nv-formato">Formato</label>
        <select id="nv-formato" value={formato} onChange={(e) => setFormato(e.target.value)} className={input}>
          <option value="reels">Reels</option>
          <option value="post">Post</option>
          <option value="stories">Stories</option>
        </select>
      </div>
      <div className="lg:col-span-2">
        <label className={label} htmlFor="nv-link">Link do post no Instagram</label>
        <input id="nv-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/reel/…" className={input} required />
      </div>
      <div>
        <label className={label} htmlFor="nv-titulo">Nome do vídeo</label>
        <input id="nv-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Reels do Solaris no treino" className={input} />
      </div>
      <div>
        <label className={label} htmlFor="nv-data">Publicado em</label>
        <input id="nv-data" type="date" value={quando} onChange={(e) => setQuando(e.target.value)} className={input} required />
      </div>
      {erro && <p className="lg:col-span-2 text-corpo text-red-700">{erro}</p>}
      <div className="lg:col-span-2">
        <button type="submit" disabled={salvando} className={btn}>
          {salvando ? "Salvando…" : "Cadastrar vídeo"}
        </button>
      </div>
    </form>
  )
}
