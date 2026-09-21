// Peças de leitura do Cockpit.
//
// Por que existe: até 20/09 cada uma das 17 páginas montava as próprias caixas e tabelas na
// mão — a mesma borda aparecia copiada 30 vezes, com espaçamentos e tons diferentes em cada
// cópia. O painel não parecia "básico" por falta de marca (creme, serifa e dourado já estavam
// lá), e sim por falta de repetição: sem peça comum, cada tela nasce com uma régua própria.
//
// Regras que estas peças garantem sozinhas:
// - nenhum texto abaixo de 4,5:1 de contraste (ver os tons em globals.css);
// - quatro tamanhos de letra, nunca sete;
// - linha de tabela com alvo de clique de dedo (≥ 44px) e faixa alternada para o olho não pular;
// - título de seção sempre no mesmo lugar, com o mesmo filete.

import type { ReactNode } from "react"
import Link from "next/link"

/* ── Página e seção ─────────────────────────────────────────────────────── */

export function TituloPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl leading-tight text-eclat-texto">{titulo}</h1>
        {descricao && <p className="text-meta text-eclat-texto-2 mt-1">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function Secao({
  titulo,
  acoes,
  children,
}: {
  titulo: ReactNode
  acoes?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-secao font-serif text-eclat-texto">{titulo}</h2>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </section>
  )
}

/** Rótulo curto acima de um número ou valor. O único lugar em que cabe caixa alta. */
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <div className="text-meta uppercase tracking-[0.12em] text-eclat-texto-3">{children}</div>
  )
}

/* ── Superfícies ────────────────────────────────────────────────────────── */

export function Cartao({
  children,
  className = "",
  tom = "normal",
}: {
  children: ReactNode
  className?: string
  tom?: "normal" | "atencao"
}) {
  const base = "rounded-xl border p-5"
  const cor =
    tom === "atencao"
      ? "border-eclat-dourado/60 bg-eclat-dourado/10"
      : "border-eclat-pedra/50 bg-white"
  return <div className={`${base} ${cor} ${className}`}>{children}</div>
}

/**
 * Número que vale uma olhada — e, quando tem `href`, também é a porta para a fila de trabalho.
 * `atencao` é para "tem coisa te esperando aqui", não para enfeitar.
 */
export function Metrica({
  rotulo,
  valor,
  detalhe,
  href,
  atencao,
}: {
  rotulo: ReactNode
  valor: ReactNode
  detalhe?: ReactNode
  href?: string
  atencao?: boolean
}) {
  const conteudo = (
    <>
      <Rotulo>{rotulo}</Rotulo>
      {/* A Cormorant vem com algarismos antigos (o 3 desce abaixo da linha, o 1 fica baixinho):
          bonito num livro, ruim numa coluna de valores. `lining-nums tabular-nums` deixa todos
          da mesma altura e da mesma largura, para os números alinharem entre si. */}
      <div className="font-serif lining-nums tabular-nums text-numero leading-none text-eclat-texto mt-2">{valor}</div>
      {detalhe && <div className="text-meta text-eclat-texto-3 mt-1.5">{detalhe}</div>}
    </>
  )
  const cor = atencao
    ? "border-eclat-dourado/60 bg-eclat-dourado/10 hover:bg-eclat-dourado/20"
    : "border-eclat-pedra/50 bg-white hover:border-eclat-pedra"
  const classe = `block rounded-xl border p-4 transition-colors ${cor}`
  return href ? (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

/* ── Tabela ─────────────────────────────────────────────────────────────── */

export function Tabela({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-eclat-pedra/50 bg-white overflow-x-auto ${className}`}>
      <table className="w-full text-corpo">{children}</table>
    </div>
  )
}

export function Th({
  children,
  alinhamento = "esquerda",
}: {
  children?: ReactNode
  alinhamento?: "esquerda" | "direita"
}) {
  return (
    <th
      className={`px-4 py-2.5 text-meta font-medium text-eclat-texto-3 whitespace-nowrap ${
        alinhamento === "direita" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  alinhamento = "esquerda",
  tom = "normal",
  className = "",
}: {
  children?: ReactNode
  alinhamento?: "esquerda" | "direita"
  tom?: "normal" | "apoio" | "meta"
  className?: string
}) {
  // Data, unidade e SKU nunca quebram em duas linhas: é o tipo de dado que se lê de relance.
  const cor =
    tom === "meta"
      ? "text-meta text-eclat-texto-3 whitespace-nowrap"
      : tom === "apoio"
        ? "text-eclat-texto-2"
        : ""
  return (
    <td
      className={`px-4 py-3 ${alinhamento === "direita" ? "text-right" : ""} ${cor} ${className}`}
    >
      {children}
    </td>
  )
}

/**
 * Linha com faixa alternada e altura de dedo. `onClick` vira uma linha clicável de verdade:
 * ganha foco pelo teclado e responde ao Enter, porque antes a linha era um `<tr onClick>` que
 * o teclado não alcançava.
 */
export function Tr({
  children,
  onClick,
  rotuloDoClique,
}: {
  children: ReactNode
  onClick?: () => void
  rotuloDoClique?: string
}) {
  const base = "border-b border-eclat-pedra/20 last:border-0 odd:bg-eclat-luz/60"
  if (!onClick) return <tr className={base}>{children}</tr>
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={rotuloDoClique}
      className={`${base} cursor-pointer hover:bg-eclat-areia/50 focus:outline-none focus-visible:bg-eclat-areia/60 focus-visible:ring-2 focus-visible:ring-eclat-dourado/70 focus-visible:ring-inset`}
    >
      {children}
    </tr>
  )
}

export function LinhaVazia({ colunas, children }: { colunas: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colunas} className="px-4 py-8 text-center text-eclat-texto-2">
        {children}
      </td>
    </tr>
  )
}

/* ── Sinais ─────────────────────────────────────────────────────────────── */

export type TomDoSelo = "neutro" | "ok" | "atencao" | "erro" | "andamento"

const SELO: Record<TomDoSelo, string> = {
  // Tons escolhidos sobre fundo claro: todos passam de 4,5:1 com o texto na mesma família.
  neutro: "bg-eclat-pedra/25 text-eclat-texto-2",
  ok: "bg-green-100 text-green-900",
  atencao: "bg-amber-100 text-amber-900",
  erro: "bg-red-100 text-red-900",
  andamento: "bg-sky-100 text-sky-900",
}

export function Selo({ tom = "neutro", children }: { tom?: TomDoSelo; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-meta whitespace-nowrap ${SELO[tom]}`}
    >
      {children}
    </span>
  )
}

export function Aviso({ tom = "erro", children }: { tom?: "erro" | "atencao"; children: ReactNode }) {
  const cor =
    tom === "erro" ? "bg-red-50 border-red-200 text-red-900" : "bg-amber-50 border-amber-200 text-amber-900"
  return <p className={`rounded-lg border p-3 text-corpo ${cor}`}>{children}</p>
}

export function Carregando({ children = "Carregando…" }: { children?: ReactNode }) {
  return <p className="text-corpo text-eclat-texto-2">{children}</p>
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-eclat-pedra/60 p-8 text-center text-corpo text-eclat-texto-2">
      {children}
    </div>
  )
}

/* ── Controles ──────────────────────────────────────────────────────────── */

/** Altura 40px: o campo de 32px de antes errava o toque no celular e sumia ao lado do texto. */
export const campoCls =
  "h-10 rounded-lg border border-eclat-pedra/60 bg-white px-3 text-corpo text-eclat-texto placeholder:text-eclat-texto-3 focus:outline-none focus:border-eclat-dourado-texto focus:ring-2 focus:ring-eclat-dourado/40"

export const selectCls = `${campoCls} pr-8`

export const botaoCls =
  "h-10 inline-flex items-center justify-center gap-2 rounded-lg px-4 text-corpo font-medium bg-eclat-grafite text-eclat-luz hover:bg-eclat-texto-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"

export const botaoSecundarioCls =
  "h-10 inline-flex items-center justify-center gap-2 rounded-lg px-4 text-corpo border border-eclat-pedra/60 bg-white text-eclat-texto hover:border-eclat-pedra hover:bg-eclat-areia/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
