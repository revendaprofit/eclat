"use client"

import Image, { type ImageProps } from "next/image"
import { useEffect, useRef, useState } from "react"

// Foto fora da primeira tela (03/11, velocidade no 4G): só entra na fila de downloads quando a cliente chega perto.
// O carregamento preguiçoso do navegador não basta: no 4G ele baixa tudo a até 1250 px da tela, e depoimentos e
// conjunto disputavam a conexão com a foto principal. Sem `fill`, a caixa guarda o espaço para a página não pular.
export default function ImagemPerto({ alt, ...props }: ImageProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [perto, setPerto] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const opcoes: IntersectionObserverInit & { scrollMargin?: string } = { rootMargin: "300px", scrollMargin: "200px" }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setPerto(true)
    }, opcoes)
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  if (perto) return <Image alt={alt} {...props} />
  const caixa: React.CSSProperties = props.fill
    ? { position: "absolute", inset: 0 }
    : { display: "block", width: "100%", aspectRatio: `${props.width} / ${props.height}` }
  // Herda a classe da foto: a versão escondida por CSS (a do computador, no celular) nunca entra na fila.
  return <span ref={ref} className={props.className} style={caixa} />
}
