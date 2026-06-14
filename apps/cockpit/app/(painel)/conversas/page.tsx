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
  timestamp: string
  origem: string
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export default function ConversasPage() {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const selectedRef = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

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

  // realtime: novas mensagens
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const channel = supabase
      .channel("chat-eclat")
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
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadConvs])

  // scroll para o fim
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
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
                    <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                    <div className="text-[10px] text-eclat-grafite/40 mt-1 text-right">
                      {m.tipo !== "texto" ? `[${m.tipo}] ` : ""}
                      {hora(m.timestamp)}
                      {m.origem === "ia" ? " · IA" : ""}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="border-t border-eclat-pedra/30 p-3 flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Escreva uma mensagem…"
                  className="flex-1 border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
                >
                  {sending ? "…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
