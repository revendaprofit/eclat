"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase/client"

type Conversation = {
  id: string
  contato_e164: string
  nome_contato: string | null
  alvo_tipo: string
  nao_lidas: number
  ultima_msg_em: string | null
}

type Message = {
  id: string
  direcao: "in" | "out"
  tipo: string
  texto: string | null
  media_url: string | null
  media_mime: string | null
  timestamp: string
  origem: string
}

const baixarLink = (src: string) => (
  <a href={src} download className="text-[10px] underline text-eclat-grafite/50">
    baixar
  </a>
)

function MediaView({
  m,
  onOpenImage,
}: {
  m: Message
  onOpenImage: (src: string) => void
}) {
  if (!m.media_url) {
    // mídia ainda não baixada/armazenada
    return <span className="italic text-eclat-grafite/50">{m.texto}</span>
  }
  const src = `/api/media?path=${encodeURIComponent(m.media_url)}`
  if (m.tipo === "imagem")
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => onOpenImage(src)}>
          <img
            src={src}
            alt="imagem"
            className="rounded-md max-w-full max-h-72 cursor-zoom-in"
          />
        </button>
        {baixarLink(src)}
      </div>
    )
  if (m.tipo === "audio")
    return (
      <div className="flex flex-col gap-1">
        <audio controls src={src} className="max-w-full" />
        {baixarLink(src)}
      </div>
    )
  if (m.tipo === "video")
    return (
      <div className="flex flex-col gap-1">
        <video controls src={src} className="rounded-md max-w-full max-h-72" />
        {baixarLink(src)}
      </div>
    )
  return (
    <a href={src} target="_blank" rel="noreferrer" className="underline text-eclat-grafite">
      {m.texto || "Baixar documento"}
    </a>
  )
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export default function ConversasPage() {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const selectedRef = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const loadConvs = useCallback(async () => {
    const r = await fetch("/api/conversations", { cache: "no-store" })
    if (r.ok) setConvs(await r.json())
  }, [])

  const openConv = useCallback(async (id: string) => {
    setSelected(id)
    selectedRef.current = id
    const r = await fetch(`/api/conversations/${id}/messages`, { cache: "no-store" })
    if (r.ok) setMessages(await r.json())
    loadConvs()
  }, [loadConvs])

  // carga inicial
  useEffect(() => {
    loadConvs()
  }, [loadConvs])

  const refetchMessages = useCallback(async (id: string) => {
    const r = await fetch(`/api/conversations/${id}/messages`, { cache: "no-store" })
    if (r.ok) setMessages(await r.json())
  }, [])

  // realtime: novas mensagens (autentica a conexão com a sessão do operador)
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const channel = supabase.channel("chat-eclat")

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message" },
          (payload) => {
            const msg = payload.new as Message & { conversation_id: string }
            if (msg.conversation_id === selectedRef.current) {
              setMessages((prev) =>
                prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
              )
            }
            loadConvs()
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "message" },
          (payload) => {
            const msg = payload.new as Message
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
            )
          }
        )
        .subscribe()
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadConvs])

  // polling de segurança (caso o realtime não entregue): atualiza lista e thread aberta
  useEffect(() => {
    const t = setInterval(() => {
      loadConvs()
      if (selectedRef.current) refetchMessages(selectedRef.current)
    }, 3000)
    return () => clearInterval(t)
  }, [loadConvs, refetchMessages])

  // scroll para o fim apenas quando chega mensagem nova (evita pular durante o polling)
  const lastCount = useRef(0)
  useEffect(() => {
    if (messages.length > lastCount.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    lastCount.current = messages.length
  }, [messages])

  async function send() {
    if (!text.trim() || !selected) return
    setSending(true)
    const body = text
    setText("")
    try {
      await fetch(`/api/conversations/${selected}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      })
      const r = await fetch(`/api/conversations/${selected}/messages`, {
        cache: "no-store",
      })
      if (r.ok) setMessages(await r.json())
      loadConvs()
    } finally {
      setSending(false)
    }
  }

  // auto-resize do campo de mensagem conforme o texto (ex.: sugestões da IA com várias linhas)
  useEffect(() => {
    const el = composerRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 200) + "px"
    }
  }, [text])

  async function suggest() {
    if (!selected) return
    setSuggesting(true)
    try {
      const r = await fetch(`/api/conversations/${selected}/suggest`, {
        method: "POST",
      })
      const data = await r.json()
      if (r.ok && data.suggestion) setText(data.suggestion)
      else alert(data.error || "Não foi possível gerar a sugestão.")
    } finally {
      setSuggesting(false)
    }
  }

  const atual = convs.find((c) => c.id === selected)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <h1 className="font-serif text-3xl text-eclat-grafite mb-4">Conversas</h1>
      <div className="flex flex-1 min-h-0 border border-eclat-pedra/40 rounded-lg overflow-hidden bg-white/50">
        {/* Lista */}
        <div className="w-72 shrink-0 border-r border-eclat-pedra/40 overflow-y-auto">
          {convs.length === 0 && (
            <p className="p-4 text-sm text-eclat-grafite/50">Nenhuma conversa ainda.</p>
          )}
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => openConv(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-eclat-pedra/20 transition-colors ${
                selected === c.id ? "bg-eclat-dourado/15" : "hover:bg-eclat-areia/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">
                  {c.nome_contato || c.contato_e164}
                </span>
                {c.nao_lidas > 0 && (
                  <span className="ml-2 text-[10px] bg-eclat-dourado text-eclat-grafite rounded-full px-1.5 py-0.5">
                    {c.nao_lidas}
                  </span>
                )}
              </div>
              <span className="text-xs text-eclat-grafite/50">{c.contato_e164}</span>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-eclat-grafite/50">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-eclat-pedra/30">
                <div className="font-medium text-sm">
                  {atual?.nome_contato || atual?.contato_e164}
                </div>
                <div className="text-xs text-eclat-grafite/50">
                  {atual?.contato_e164}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      m.direcao === "out"
                        ? "self-end bg-eclat-dourado/25"
                        : "self-start bg-white border border-eclat-pedra/30"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.tipo === "texto" ? (
                        m.texto
                      ) : (
                        <MediaView m={m} onOpenImage={setLightbox} />
                      )}
                    </div>
                    <div className="text-[10px] text-eclat-grafite/40 mt-1 text-right">
                      {hora(m.timestamp)}
                      {m.origem === "ia" ? " · IA" : ""}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="border-t border-eclat-pedra/30 p-3 flex gap-2 items-end">
                <button
                  onClick={suggest}
                  disabled={suggesting}
                  title="Sugerir resposta na voz da Éclat (IA)"
                  className="shrink-0 h-10 border border-eclat-dourado/60 text-eclat-grafite text-xs px-3 rounded-md hover:bg-eclat-dourado/15 transition-colors disabled:opacity-50"
                >
                  {suggesting ? "…" : "✨ IA"}
                </button>
                <textarea
                  ref={composerRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  rows={1}
                  placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
                  className="flex-1 resize-none max-h-[200px] overflow-y-auto border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado leading-snug"
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="shrink-0 h-10 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
                >
                  {sending ? "…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox}
              alt="imagem ampliada"
              className="max-h-[80vh] max-w-[90vw] rounded-md"
            />
            <div className="flex gap-6">
              <a
                href={lightbox}
                download
                className="bg-eclat-luz text-eclat-grafite px-4 py-2 rounded-md text-sm"
              >
                Baixar
              </a>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="text-eclat-luz text-sm underline"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
