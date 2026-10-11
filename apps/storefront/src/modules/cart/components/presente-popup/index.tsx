"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { escolherPresente } from "@lib/data/brinde"
import { faixasParaEscolher, NOME_DO_PRESENTE, type EstadoBrinde, type FaixaId, type OpcaoDePresente } from "@lib/util/brinde"

// Pop-up do presente (sócia, 2026-10-11, depois do pedido #29 sem a meia): quando a sacola atinge a faixa e
// ainda não há presente escolhido, abre uma vez por sacola/faixa um pop-up com fogos de artifício, a frase
// "você já garantiu uma meia" e as opções para escolher ali mesmo. "Escolher depois" fecha; o bloco em
// destaque na sacola/checkout continua lembrando. Guarda em sessionStorage que já mostrou.
export default function PresentePopup({
  estado,
  opcoes,
  cartId,
}: {
  estado: EstadoBrinde | null
  opcoes: Partial<Record<FaixaId, OpcaoDePresente[]>>
  cartId: string
}) {
  const escolhiveis = estado?.ativo ? faixasParaEscolher(estado).filter((f) => (opcoes[f] ?? []).some((o) => o.disponivel)) : []
  const faixa = escolhiveis[0] ?? null
  const ganhou = !!faixa && !estado?.presente
  const chave = faixa ? `eclat_presente_popup:${cartId}:${faixa}` : ""
  const [aberto, setAberto] = useState(false)
  const [variante, setVariante] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  useEffect(() => {
    if (!ganhou || !chave) return
    let visto = false
    try {
      visto = sessionStorage.getItem(chave) === "1"
    } catch {
      /* sem storage: mostra assim mesmo */
    }
    if (visto) return
    const t = setTimeout(() => setAberto(true), 350)
    return () => clearTimeout(t)
  }, [ganhou, chave])

  const fechar = () => {
    try {
      sessionStorage.setItem(chave, "1")
    } catch {
      /* noop */
    }
    setAberto(false)
  }

  const confirmar = () =>
    iniciar(async () => {
      setErro(null)
      const r = await escolherPresente(variante)
      if (!r.ok) setErro(r.mensagem)
      else fechar()
    })

  if (!aberto || !faixa) return null
  const lista = opcoes[faixa] ?? []

  return (
    <div className="fixed inset-0 z-[70] flex items-end small:items-center justify-center bg-eclat-grafite/60 p-0 small:p-6" role="dialog" aria-modal="true" aria-labelledby="presente-popup-titulo" data-testid="presente-popup">
      <Fogos />
      <div className="relative w-full small:max-w-md rounded-t-2xl small:rounded-2xl bg-eclat-luz p-6 small:p-8 shadow-2xl">
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-4 top-4 text-eclat-grafite/50 hover:text-eclat-grafite text-xl leading-none">
          ×
        </button>
        <div className="text-center flex flex-col items-center gap-2">
          <span className="text-5xl" aria-hidden="true">
            🎁
          </span>
          <span className="uppercase tracking-[0.25em] text-[11px] text-eclat-terracota">Presente garantido</span>
          <h2 id="presente-popup-titulo" className="font-serif text-2xl small:text-3xl text-eclat-grafite leading-tight text-balance">
            Você já garantiu {NOME_DO_PRESENTE[faixa]} de presente!
          </h2>
          <p className="text-sm text-eclat-grafite/70">Escolha {faixa === "oculos" ? "o modelo" : "tamanho e cor"} e ela vai junto com o pedido, sem custo.</p>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Opções do presente">
          {lista.map((o) => (
            <li key={o.variant_id}>
              <button
                type="button"
                role="radio"
                aria-checked={variante === o.variant_id}
                disabled={!o.disponivel}
                onClick={() => setVariante(o.variant_id)}
                className={`w-full rounded-md border px-3 py-2.5 text-sm text-left transition-colors disabled:opacity-40 ${
                  variante === o.variant_id ? "border-eclat-grafite bg-eclat-grafite text-eclat-luz" : "border-eclat-pedra bg-white text-eclat-grafite hover:border-eclat-grafite"
                }`}
              >
                {o.rotulo}
                {!o.disponivel && <span className="block text-[11px] opacity-70">esgotado</span>}
              </button>
            </li>
          ))}
        </ul>
        {erro && (
          <p className="mt-3 text-xs text-red-600" role="alert">
            {erro}
          </p>
        )}
        <button
          type="button"
          disabled={!variante || pendente}
          onClick={confirmar}
          className="mt-4 h-12 w-full bg-eclat-terracota text-eclat-luz text-xs font-semibold uppercase tracking-widest disabled:opacity-50 hover:bg-eclat-terracota-claro transition-colors"
          data-testid="presente-popup-confirmar"
        >
          {pendente ? "Colocando…" : "Quero minha meia"}
        </button>
        <button type="button" onClick={fechar} className="mt-3 w-full text-xs uppercase tracking-widest text-eclat-grafite/60 hover:text-eclat-grafite">
          Escolher depois
        </button>
      </div>
    </div>
  )
}

// Fogos de artifício em canvas: três explosões nas cores da marca, ~3 s, sem biblioteca. Respeita
// "reduzir movimento" (não desenha nada).
function Fogos() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = (c.width = window.innerWidth * dpr)
    const H = (c.height = window.innerHeight * dpr)
    const cores = ["#C27050", "#C9A24C", "#E8B4A0", "#FAF8F3", "#7A3B2C"]
    type P = { x: number; y: number; vx: number; vy: number; vida: number; cor: string; r: number }
    const ps: P[] = []
    const explodir = (x: number, y: number) => {
      for (let i = 0; i < 70; i++) {
        const a = (Math.PI * 2 * i) / 70 + Math.random() * 0.2
        const v = (2 + Math.random() * 4) * dpr
        ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 60 + Math.random() * 30, cor: cores[i % cores.length], r: (1.5 + Math.random() * 1.5) * dpr })
      }
    }
    const t0 = performance.now()
    const agenda = [0, 500, 1000, 1700]
    const pontos = [
      [0.3, 0.3],
      [0.7, 0.25],
      [0.5, 0.4],
      [0.2, 0.5],
    ]
    let disparos = 0
    let raf = 0
    const passo = (t: number) => {
      const dt = t - t0
      while (disparos < agenda.length && dt >= agenda[disparos]) {
        explodir(W * pontos[disparos][0], H * pontos[disparos][1])
        disparos++
      }
      ctx.clearRect(0, 0, W, H)
      for (const p of ps) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06 * dpr
        p.vx *= 0.985
        p.vida -= 1
        ctx.globalAlpha = Math.max(0, Math.min(1, p.vida / 40))
        ctx.fillStyle = p.cor
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let i = ps.length - 1; i >= 0; i--) if (ps[i].vida <= 0) ps.splice(i, 1)
      if (dt < 4000 || ps.length) raf = requestAnimationFrame(passo)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
}
