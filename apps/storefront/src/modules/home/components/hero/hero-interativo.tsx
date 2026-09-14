"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { HeroPeca, HeroTextos } from "@lib/util/hero-media"

// Banner interativo do celular (arte "Lumière em Movimento" do dono, 2026-09-14): céu do amanhecer com
// logo/textos/botão e, abaixo, o palco com a modelo girando 360°. Arrastar na horizontal leva o vídeo
// ao ponto do giro; os botões só trocam a peça (crossfade entre duas camadas de vídeo).
// Peso: nada de vídeo é baixado no desktop; no celular só a peça atual, quando o palco chega perto
// da tela; as outras só quando tocadas. Em economia de dados o vídeo espera o primeiro toque; com
// "reduzir movimento" nada toca sozinho (arrastar continua funcionando).

const PX_POR_VOLTA = 320 // arrasto horizontal (px) que percorre o vídeo inteiro = uma volta
const PASSOS_TECLADO = 36
const RETOMA_MS = 900
const TROCA_MS = 600
const CELULAR = "(max-width: 1023.98px)"

type Camada = { idx: number } | null

export default function HeroInterativo({
  ceu,
  pecas,
  textos,
  href,
}: {
  ceu: string | null
  pecas: HeroPeca[]
  textos: HeroTextos
  href: string
}) {
  const palco = useRef<HTMLDivElement>(null)
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const [camadas, setCamadas] = useState<[Camada, Camada]>([{ idx: 0 }, null])
  const [frente, setFrente] = useState<0 | 1>(0)
  const [selecionada, setSelecionada] = useState(0)
  const [carregar, setCarregar] = useState(false) // já pode pôr o src do vídeo
  const [dica, setDica] = useState(true)
  const mov = useRef({ permitido: false, visivel: false })
  const arrasto = useRef<{ ativo: boolean; x0: number; t0: number; alvo: number; raf: number; retoma?: number }>({
    ativo: false,
    x0: 0,
    t0: 0,
    alvo: -1,
    raf: 0,
  })
  const frenteRef = useRef(frente)
  frenteRef.current = frente

  const atual = () => videos[frente].current

  const tocar = useCallback((v: HTMLVideoElement | null) => {
    if (!v || !mov.current.permitido || !mov.current.visivel || arrasto.current.ativo) return
    const p = v.play()
    if (p && typeof p.catch === "function") p.catch(() => {})
  }, [])

  // Celular? Movimento permitido? Palco perto da tela? (decide quando baixar e quando tocar)
  useEffect(() => {
    const tela = window.matchMedia(CELULAR)
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)")
    const economia = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    mov.current.permitido = !reduzir.matches && !economia
    const el = palco.current
    if (!el || !tela.matches) return
    const io = new IntersectionObserver(
      ([e]) => {
        mov.current.visivel = e.isIntersecting
        if (e.isIntersecting && !economia) setCarregar(true)
        const v = videos[frenteRef.current].current
        if (!v) return
        if (e.isIntersecting) tocar(v)
        else v.pause()
      },
      { rootMargin: "200px 0px" }
    )
    io.observe(el)
    const dicaTimer = setTimeout(() => setDica(false), 9000)
    return () => {
      io.disconnect()
      clearTimeout(dicaTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocar])

  // ---- arrastar para girar ----
  const aplicarAlvo = () => {
    const a = arrasto.current
    a.raf = 0
    const v = atual()
    if (v && a.alvo >= 0) v.currentTime = a.alvo
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!carregar) setCarregar(true) // economia de dados: o primeiro toque libera o vídeo
    const v = atual()
    if (!v || !v.duration) return
    const a = arrasto.current
    a.ativo = true
    a.x0 = e.clientX
    a.t0 = v.currentTime
    window.clearTimeout(a.retoma)
    v.pause()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current
    const v = atual()
    if (!a.ativo || !v || !v.duration) return
    const dx = e.clientX - a.x0
    if (Math.abs(dx) > 4) setDica(false)
    const d = v.duration
    const t = a.t0 + (dx / PX_POR_VOLTA) * d
    a.alvo = ((t % d) + d) % d
    if (!a.raf) a.raf = requestAnimationFrame(aplicarAlvo) // um seek por quadro de tela, não por evento
  }

  const fimArrasto = () => {
    const a = arrasto.current
    if (!a.ativo) return
    a.ativo = false
    a.retoma = window.setTimeout(() => tocar(atual()), RETOMA_MS)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = atual()
    if (!v || !v.duration || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return
    e.preventDefault()
    const a = arrasto.current
    window.clearTimeout(a.retoma)
    v.pause()
    const d = v.duration
    const passo = (d / PASSOS_TECLADO) * (e.key === "ArrowRight" ? 1 : -1)
    v.currentTime = (((v.currentTime + passo) % d) + d) % d
    setDica(false)
    a.retoma = window.setTimeout(() => tocar(v), RETOMA_MS + 300)
  }

  // ---- trocar a peça: carrega na camada de trás e cruza quando o primeiro quadro chega ----
  const trocando = useRef(false)
  const escolher = (idx: number) => {
    if (trocando.current || idx === selecionada) return
    trocando.current = true
    setCarregar(true)
    setSelecionada(idx)
    const tras = frente === 0 ? 1 : 0
    setCamadas((c) => {
      const n: [Camada, Camada] = [c[0], c[1]]
      n[tras] = { idx }
      return n
    })
  }

  // loadeddata dispara uma vez por vídeo carregado (não a cada salto do arrasto, como canplay)
  const onLoadedData = (camada: 0 | 1) => {
    if (camada === frente) {
      if (!trocando.current) tocar(videos[camada].current) // primeira peça: começa a girar sozinha
      return
    }
    if (!trocando.current) return
    const nova = videos[camada].current
    const velha = videos[frente].current
    tocar(nova)
    setFrente(camada)
    setTimeout(() => {
      velha?.pause()
      trocando.current = false
    }, TROCA_MS)
  }

  const onError = (camada: 0 | 1) => {
    if (camada === frente || !trocando.current) return
    trocando.current = false
    const naTela = camadas[frente]
    if (naTela) setSelecionada(naTela.idx) // vídeo da peça nova não abriu: o botão volta para a que está na tela
  }

  const sombra = { textShadow: "0 2px 12px rgba(0,0,0,.5)" }

  return (
    <div className="bg-black text-[#f3eff0]" data-testid="hero-interativo">
      <div className="mx-auto max-w-[520px] overflow-hidden">
        {/* ---- amanhecer: céu + textos ---- */}
        <div className="relative isolate flex min-h-[560px] flex-col px-7 pt-11">
          <div
            aria-hidden
            className="ceu-deriva absolute inset-0 -z-20 bg-cover bg-top bg-no-repeat"
            style={ceu ? { backgroundImage: `url("${ceu}")` } : { background: "linear-gradient(180deg,#f08a4b 0%,#6a4a8c 45%,#000 100%)" }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_46%,rgba(0,0,0,.55)_72%,#000_100%)]" />
          </div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.18)_0%,rgba(0,0,0,0)_40%)]" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mark.png"
            alt=""
            aria-hidden
            className="mb-[26px] block h-auto w-[64px]"
            style={{ filter: "brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0,0,0,.45))" }}
          />
          <span className="mb-[22px] font-sans text-[13px] font-medium uppercase leading-none tracking-[0.28em] text-[#ecd6c8]" style={sombra}>
            {textos.eyebrow}
          </span>
          <p
            className="mb-[22px] font-serif text-[clamp(50px,14vw,62px)] font-semibold leading-[0.95] text-balance"
            style={{ textShadow: "0 3px 18px rgba(0,0,0,.45)" }}
          >
            {textos.titulo1}
            <em className="mt-0.5 block text-[1.06em] font-medium italic text-[#ffd6be]">{textos.titulo2}</em>
          </p>
          <p className="mb-[26px] max-w-[34ch] font-sans text-base leading-[1.55]" style={sombra}>
            {textos.texto}
          </p>
          <LocalizedClientLink
            href={href}
            className="self-start rounded-full bg-[#f3eff0] px-7 py-[18px] font-sans text-[13px] font-medium uppercase leading-none tracking-[0.18em] text-[#262932] shadow-[0_10px_30px_rgba(0,0,0,.35)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ffd6be]"
          >
            {textos.cta}
          </LocalizedClientLink>
        </div>

        {/* ---- noite: o palco que gira ---- */}
        <div className="relative -mt-[60px] pb-2">
          <div
            ref={palco}
            tabIndex={0}
            role="img"
            aria-label={`Modelo girando com ${rotulo(pecas[selecionada])}. Arraste para girar.`}
            className="relative aspect-[9/13] w-full cursor-grab touch-pan-y select-none overflow-hidden outline-none active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ffd6be]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={fimArrasto}
            onPointerCancel={fimArrasto}
            onLostPointerCapture={fimArrasto}
            onKeyDown={onKeyDown}
          >
            {([0, 1] as const).map((i) => {
              const camada = camadas[i]
              const peca = camada ? pecas[camada.idx] : null
              return (
                <video
                  key={i}
                  ref={videos[i]}
                  src={peca && carregar ? peca.video : undefined}
                  poster={peca?.poster}
                  muted
                  loop
                  playsInline
                  preload={peca && carregar ? "auto" : "none"}
                  onLoadedData={() => onLoadedData(i)}
                  onError={() => onError(i)}
                  className={
                    "pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-top transition-opacity duration-500 motion-reduce:transition-none " +
                    (i === frente ? "opacity-100" : "opacity-0")
                  }
                />
              )
            })}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#000_0%,rgba(0,0,0,0)_14%,rgba(0,0,0,0)_78%,#000_100%)]" />
            <div
              aria-hidden
              className={
                "pointer-events-none absolute bottom-[26px] left-1/2 z-[2] inline-flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full border border-[rgba(243,239,240,.22)] bg-black/55 px-4 py-2.5 font-sans text-[11px] font-medium uppercase leading-none tracking-[0.2em] text-[#d8cfd0] backdrop-blur-md transition-opacity duration-500 " +
                (dica ? "opacity-100" : "opacity-0")
              }
            >
              <svg viewBox="0 0 34 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="dica-empurra h-3 w-[34px]">
                <path d="M1 6h32M6 1 1 6l5 5M28 1l5 5-5 5" />
              </svg>
              Arraste para girar
            </div>
          </div>

          {pecas.length > 1 && (
            <>
              <p className="mb-2.5 mt-[22px] text-center font-sans text-[11px] font-medium uppercase leading-none tracking-[0.28em] text-[#ecd6c8]">
                Escolha a peça
              </p>
              <div role="group" aria-label="Peças da coleção" className="flex flex-wrap justify-center gap-2 px-5 pt-1.5">
                {pecas.map((p, i) => {
                  const ativa = i === selecionada
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => escolher(i)}
                      className={
                        "inline-flex items-center gap-2 rounded-full border px-3.5 py-[11px] font-sans text-[11px] font-medium uppercase leading-none tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#ffd6be] " +
                        (ativa
                          ? "border-[#f3eff0] bg-[#f3eff0] text-[#262932]"
                          : "border-[rgba(243,239,240,.22)] bg-[rgba(243,239,240,.10)] text-[#d8cfd0]")
                      }
                    >
                      {p.corHex && (
                        <span aria-hidden className="inline-block h-[9px] w-[9px] rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.25)]" style={{ background: p.corHex }} />
                      )}
                      {rotulo(p)}
                    </button>
                  )
                })}
              </div>
              <p className="mx-5 mb-3 mt-[26px] text-center font-sans text-xs leading-relaxed text-[#d8cfd0]/75">
                Toque numa peça para trocar. <b className="font-medium text-[#f3eff0]">Arraste</b> sobre a modelo para girar a 360°.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function rotulo(p: HeroPeca | undefined) {
  if (!p) return "a peça"
  return p.cor ? `${p.nome} · ${p.cor.toLowerCase()}` : p.nome
}
