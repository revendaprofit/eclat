"use client"

import { useEffect, useRef, useState } from "react"
import { normalizarCodigo } from "@/lib/leitor"

// Campo do leitor de código de barras (spec leitor-codigo-barras F0). O leitor USB/Bluetooth age como
// teclado: "digita" o código e envia Enter. O campo mantém o foco enquanto está na tela (sem roubar o
// foco de outro campo que a pessoa clicou), normaliza a leitura e dá sinal visual + sonoro.

export type Sinal = "ok" | "aviso" | "erro"

function bip(sinal: Sinal) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.value = sinal === "ok" ? 1320 : sinal === "aviso" ? 660 : 220
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (sinal === "ok" ? 0.08 : 0.25))
    osc.onended = () => ctx.close()
  } catch {
    // sem áudio (política do navegador) — o sinal visual basta
  }
}

const CORES: Record<Sinal, string> = {
  ok: "border-green-500 bg-green-50",
  aviso: "border-amber-500 bg-amber-50",
  erro: "border-red-500 bg-red-50",
}

export default function CampoLeitor({
  onLeitura,
  disabled,
  placeholder = "Bipe a peça com o leitor (ou digite o SKU e Enter)",
}: {
  // Recebe o código já normalizado e devolve o sinal + a mensagem da leitura.
  onLeitura: (codigo: string) => { sinal: Sinal; mensagem: string } | Promise<{ sinal: Sinal; mensagem: string }>
  disabled?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [valor, setValor] = useState("")
  const [ultimo, setUltimo] = useState<{ sinal: Sinal; mensagem: string } | null>(null)

  useEffect(() => {
    if (!disabled) ref.current?.focus()
  }, [disabled])

  // Volta o foco para o campo quando ele o perde para "nada" (clique em área vazia); não rouba o foco de
  // outro input/textarea/select/botão que a pessoa escolheu.
  function aoPerderFoco() {
    setTimeout(() => {
      const ativo = document.activeElement
      const interativo = ativo && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(ativo.tagName)
      if (!disabled && !interativo) ref.current?.focus()
    }, 150)
  }

  async function confirmar() {
    const codigo = normalizarCodigo(valor)
    setValor("")
    if (!codigo) return
    const r = await onLeitura(codigo)
    setUltimo(r)
    bip(r.sinal)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={ref}
        value={valor}
        disabled={disabled}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            void confirmar()
          }
        }}
        onBlur={aoPerderFoco}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        data-testid="campo-leitor"
        className={`border-2 rounded-md px-3 py-2.5 text-corpo font-mono tracking-wider bg-white focus:outline-none transition-colors ${
          ultimo ? CORES[ultimo.sinal] : "border-eclat-pedra/50 focus:border-eclat-dourado"
        } disabled:opacity-50`}
      />
      {ultimo && (
        <p
          role="status"
          data-testid="campo-leitor-mensagem"
          className={`text-meta ${ultimo.sinal === "ok" ? "text-green-800" : ultimo.sinal === "aviso" ? "text-amber-800" : "text-red-700"}`}
        >
          {ultimo.mensagem}
        </p>
      )}
    </div>
  )
}
