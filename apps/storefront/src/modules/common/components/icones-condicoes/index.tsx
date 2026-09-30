// Ícones de traço fino das condições de compra (faixa da home e bloco "Compra segura" da PDP).
// SVG inline: sem pacote de ícones e sem requisição extra. Cor vem de `currentColor`.

const traco = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const

export const ICONES = {
  cupom: (
    <svg viewBox="0 0 24 24" aria-hidden {...traco}>
      <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z" />
      <path d="m9.5 14.5 5-5M9.75 9.75h.01M14.25 14.25h.01" />
    </svg>
  ),
  cartao: (
    <svg viewBox="0 0 24 24" aria-hidden {...traco}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  ),
  pix: (
    <svg viewBox="0 0 24 24" aria-hidden {...traco}>
      <path d="m12 3 3.2 3.2a2 2 0 0 0 1.4.6H18l-3.6 3.6a3.4 3.4 0 0 1-4.8 0L6 6.8h1.4a2 2 0 0 0 1.4-.6L12 3ZM12 21l3.2-3.2a2 2 0 0 1 1.4-.6H18l-3.6-3.6a3.4 3.4 0 0 0-4.8 0L6 17.2h1.4a2 2 0 0 1 1.4.6L12 21Z" />
      <path d="M18 6.8 21 9.8a3 3 0 0 1 0 4.4l-3 3M6 6.8 3 9.8a3 3 0 0 0 0 4.4l3 3" />
    </svg>
  ),
  troca: (
    <svg viewBox="0 0 24 24" aria-hidden {...traco}>
      <path d="M4 9h13l-3-3M20 15H7l3 3" />
    </svg>
  ),
  envio: (
    <svg viewBox="0 0 24 24" aria-hidden {...traco}>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.5" />
      <circle cx="17.5" cy="17.5" r="1.5" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" aria-hidden {...traco}>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20Z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a3.5 3.5 0 0 1-2-2l1-1-1-2L9 9.5Z" />
    </svg>
  ),
}

export type NomeIconeCondicao = keyof typeof ICONES

export function IconeCondicao({ nome, className = "w-7 h-7" }: { nome: NomeIconeCondicao; className?: string }) {
  return <span className={`${className} shrink-0 text-eclat-terracota`}>{ICONES[nome]}</span>
}
