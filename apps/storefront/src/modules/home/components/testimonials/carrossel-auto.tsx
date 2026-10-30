"use client"

import { useEffect, useRef, type ReactNode } from "react"

// Faixa de depoimentos que vai passando sozinha (sócia, 29/10: "vamos tornar essa parte dinâmica").
// Não pesa: os cards vêm prontos do servidor (os mesmos prints, já leves) e aqui só o scroll da faixa
// anda — um card a cada `intervalo` ms, com o encaixe (scroll-snap) que o celular já tinha. Para quando
// a pessoa toca/passa o mouse, quando a faixa está fora da tela, na aba em segundo plano e para quem
// pediu "reduzir movimento". No fim volta ao começo.
export default function CarrosselAuto({ children, className, intervalo = 4000, rotulo }: { children: ReactNode; className?: string; intervalo?: number; rotulo?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let naTela = false
    let pausado = false
    let timer = 0
    const passo = () => {
      if (!naTela || pausado || document.visibilityState !== "visible") return
      const cards = Array.from(el.children) as HTMLElement[]
      if (cards.length < 2) return
      const fim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
      if (fim) {
        el.scrollTo({ left: 0, behavior: "smooth" })
        return
      }
      const proximo = cards.find((c) => c.offsetLeft > el.scrollLeft + 1)
      if (proximo) el.scrollTo({ left: proximo.offsetLeft, behavior: "smooth" })
    }
    const ligar = () => {
      window.clearInterval(timer)
      timer = window.setInterval(passo, intervalo)
    }
    const pausar = () => {
      pausado = true
    }
    const retomar = () => {
      pausado = false
      ligar() // reinicia a contagem: quem acabou de arrastar não vê o card pular logo em seguida
    }
    const io = new IntersectionObserver(([e]) => {
      naTela = e.isIntersecting
    }, { threshold: 0.3 })
    io.observe(el)
    el.addEventListener("pointerenter", pausar)
    el.addEventListener("pointerleave", retomar)
    el.addEventListener("touchstart", pausar, { passive: true })
    el.addEventListener("touchend", retomar, { passive: true })
    el.addEventListener("focusin", pausar)
    el.addEventListener("focusout", retomar)
    ligar()
    return () => {
      window.clearInterval(timer)
      io.disconnect()
      el.removeEventListener("pointerenter", pausar)
      el.removeEventListener("pointerleave", retomar)
      el.removeEventListener("touchstart", pausar)
      el.removeEventListener("touchend", retomar)
      el.removeEventListener("focusin", pausar)
      el.removeEventListener("focusout", retomar)
    }
  }, [intervalo])
  return (
    <ul ref={ref} className={className} aria-label={rotulo} data-testid="carrossel-auto">
      {children}
    </ul>
  )
}
