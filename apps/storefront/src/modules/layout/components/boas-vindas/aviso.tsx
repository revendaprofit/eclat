"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cadastrarBoasVindas } from "@lib/data/boas-vindas"
import { avisoPermitidoNaRota, CHAVE_CUPOM_GUARDADO, COOKIE_AVISO, mascararCelular, TEXTO_ACEITE } from "@lib/util/boas-vindas"
import { pushEcommerceEvent } from "@modules/analytics/push"

const ESPERA_MS = 8000 // deixa a visitante ver a página antes; nunca abre em cima do aviso de cookies
// Desde 2026-09-30 o cupom também está na barra do topo, então o aviso não precisa interromper quem
// acabou de chegar: só abre depois de a visitante rolar uma tela inteira (sinal de interesse).
const rolouUmaTela = () => window.scrollY >= window.innerHeight
const temCookie = (nome: string) => document.cookie.split("; ").some((c) => c.startsWith(`${nome}=`))
const marcarVisto = () => {
  document.cookie = `${COOKIE_AVISO}=1;path=/;max-age=${60 * 60 * 24 * 60}`
}

const reaisCurto = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100)

export default function AvisoBoasVindas({
  percentual,
  modo = "cupom",
  minimoPresente = null,
}: {
  percentual: number
  modo?: "cupom" | "presente"
  minimoPresente?: number | null
}) {
  const presente = modo === "presente"
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [site, setSite] = useState("") // campo-isca
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [cupom, setCupom] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [feito, setFeito] = useState(false) // modo presente: cadastro feito, sem cupom

  useEffect(() => {
    if (aberto || cupom || feito || !avisoPermitidoNaRota(pathname) || temCookie(COOKIE_AVISO)) return
    let id: ReturnType<typeof setTimeout>
    const tentar = () => {
      // o aviso de cookies ocupa o mesmo canto da tela: espera a escolha antes de abrir
      if (!temCookie("eclat_consent") || !rolouUmaTela()) id = setTimeout(tentar, 2000)
      else setAberto(true)
    }
    id = setTimeout(tentar, ESPERA_MS)
    return () => clearTimeout(id)
  }, [pathname, aberto, cupom, feito])

  const fechar = () => {
    marcarVisto()
    setAberto(false)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!aceite) return setErro(presente ? "Marque o aceite para receber as novidades." : "Marque o aceite para liberar o cupom.")
    setEnviando(true)
    const r = await cadastrarBoasVindas({ whatsapp, email, aceite, site })
    setEnviando(false)
    if ("erro" in r) return setErro(r.erro)
    marcarVisto()
    if (r.cupom) {
      setCupom(r.cupom)
      try {
        localStorage.setItem(CHAVE_CUPOM_GUARDADO, r.cupom)
      } catch {
        /* navegação privada: a cliente ainda pode copiar o código */
      }
    } else setFeito(true)
    pushEcommerceEvent("generate_lead", undefined, { lead_source: "boas_vindas" })
  }

  const copiar = async () => {
    if (!cupom) return
    try {
      await navigator.clipboard.writeText(cupom)
      setCopiado(true)
    } catch {
      /* sem permissão: o código está visível para copiar à mão */
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end small:items-center justify-center" data-testid="boas-vindas">
      <button type="button" aria-label="Fechar" onClick={fechar} className="absolute inset-0 bg-eclat-grafite/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boas-vindas-titulo"
        className="relative w-full small:max-w-md bg-eclat-luz rounded-t-2xl small:rounded-2xl shadow-xl p-6 pb-8"
      >
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-3 right-4 text-2xl leading-none text-eclat-grafite/60 min-h-[44px] min-w-[44px]"
        >
          ×
        </button>
        {feito ? (
          <div className="flex flex-col gap-y-4" data-testid="boas-vindas-feito">
            <h2 id="boas-vindas-titulo" className="font-serif text-2xl text-eclat-grafite pr-8">
              Pronto, você está na lista ✨
            </h2>
            <p className="text-sm text-eclat-grafite/80">
              Você fica sabendo dos lançamentos antes de todo mundo.
              {minimoPresente ? ` E lembre: a partir de ${reaisCurto(minimoPresente)} em peças, a meia Éclat vai de presente.` : ""}
            </p>
            <button type="button" onClick={() => setAberto(false)} className="h-11 rounded-md bg-eclat-terracota text-white text-sm font-medium">
              Continuar vendo as peças
            </button>
          </div>
        ) : cupom ? (
          <div className="flex flex-col gap-y-4" data-testid="boas-vindas-cupom">
            <h2 id="boas-vindas-titulo" className="font-serif text-2xl text-eclat-grafite pr-8">
              Seu cupom de {percentual}%
            </h2>
            <p className="text-sm text-eclat-grafite/80">
              Use na sacola, na sua primeira compra. Ele já fica guardado neste aparelho.
            </p>
            <div className="flex gap-2">
              <span
                className="flex-1 h-11 flex items-center justify-center border border-dashed border-eclat-terracota rounded-md font-mono text-lg tracking-widest text-eclat-grafite"
                data-testid="boas-vindas-codigo"
              >
                {cupom}
              </span>
              <button type="button" onClick={copiar} className="h-11 px-4 rounded-md border border-eclat-grafite text-sm text-eclat-grafite">
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <button type="button" onClick={() => setAberto(false)} className="h-11 rounded-md bg-eclat-terracota text-white text-sm font-medium">
              Continuar vendo as peças
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-y-3">
            <h2 id="boas-vindas-titulo" className="font-serif text-2xl text-eclat-grafite pr-8">
              {presente
                ? minimoPresente
                  ? `Presente na sua compra: meia Éclat a partir de ${reaisCurto(minimoPresente)}`
                  : "Lançamentos antes de todo mundo"
                : `${percentual}% na sua primeira compra`}
            </h2>
            <p className="text-sm text-eclat-grafite/80">
              {presente
                ? "Deixe seu WhatsApp e receba os lançamentos antes de todo mundo."
                : "Deixe seu WhatsApp e o cupom aparece aqui na hora."}
            </p>
            <label className="text-xs text-eclat-grafite/70" htmlFor="bv-whatsapp">
              WhatsApp (com DDD)
            </label>
            <input
              id="bv-whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(mascararCelular(e.target.value))}
              placeholder="(31) 99999-0000"
              className="h-11 px-3 rounded-md border border-eclat-pedra bg-white text-base text-eclat-grafite"
              data-testid="boas-vindas-whatsapp"
            />
            <label className="text-xs text-eclat-grafite/70" htmlFor="bv-email">
              E-mail (opcional)
            </label>
            <input
              id="bv-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="h-11 px-3 rounded-md border border-eclat-pedra bg-white text-base text-eclat-grafite"
            />
            {/* campo-isca: invisível para gente, robô preenche */}
            <input
              type="text"
              name="site"
              tabIndex={-1}
              autoComplete="off"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />
            <label className="flex items-start gap-2 text-xs text-eclat-grafite/80 mt-1">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 h-4 w-4"
                data-testid="boas-vindas-aceite"
              />
              <span>{TEXTO_ACEITE}</span>
            </label>
            {erro && (
              <p role="alert" className="text-xs text-red-600" data-testid="boas-vindas-erro">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={enviando}
              className="h-11 rounded-md bg-eclat-terracota text-white text-sm font-medium disabled:opacity-60"
              data-testid="boas-vindas-enviar"
            >
              {enviando ? "Enviando..." : presente ? "Quero receber os lançamentos" : `Quero meu cupom de ${percentual}%`}
            </button>
            <button type="button" onClick={fechar} className="text-xs underline text-eclat-grafite/60 min-h-[44px]">
              Agora não
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
