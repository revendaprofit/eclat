"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { escolherEnvelope } from "@lib/data/boas-vindas"
import { CHAVE_CUPOM_GUARDADO, COOKIE_AVISO, mascararCelular } from "@lib/util/boas-vindas"
import { ENVELOPES, MENSAGEM_CONSULTORIA, TEXTO_ACEITE_ENVELOPE, envelopesPermitidos, type Envelope } from "@lib/util/envelopes"
import { CHAVE_SACOLA, lerEstadoSacola } from "@lib/util/sacola-guardada"
import { pushEcommerceEvent } from "@modules/analytics/push"

const ESPERA_MS = 8000
const temCookie = (nome: string) => document.cookie.split("; ").some((c) => c.startsWith(`${nome}=`))
const marcarVisto = () => {
  document.cookie = `${COOKIE_AVISO}=1;path=/;max-age=${60 * 60 * 24 * 60}`
}
// Quem já guardou a sacola já deixou o WhatsApp: não pede de novo.
const jaDeixouContato = () => {
  try {
    return lerEstadoSacola(localStorage.getItem(CHAVE_SACOLA)) === "guardou"
  } catch {
    return false
  }
}
// Um cartão por vez: frete e sacola têm a vez antes. O aviso de cookies não conta: fica em uma linha no topo, sem disputar
// o espaço, e muita gente o ignora (03/11: quem ignorava nunca via os envelopes).
const outroCartaoAberto = () => !!document.querySelector('[data-testid="aviso-frete"],[data-testid="guardar-sacola"]')

function DesenhoEnvelope({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 64 44" aria-hidden className="w-full">
      <rect x="1" y="1" width="62" height="42" rx="3" className="fill-eclat-terracota" />
      <path d={aberto ? "M1 4 L32 -14 L63 4" : "M1 4 L32 26 L63 4"} className="fill-[#6d3324] transition-all duration-300" />
      {!aberto && <circle cx="32" cy="25" r="5" fill="#C9A24C" />}
    </svg>
  )
}

export default function Envelopes({ whatsappMarca }: { whatsappMarca: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [escolha, setEscolha] = useState<Envelope | null>(null)
  const [whatsapp, setWhatsapp] = useState("")
  const [site, setSite] = useState("") // campo-isca
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [cupom, setCupom] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (aberto || !envelopesPermitidos(pathname) || temCookie(COOKIE_AVISO) || jaDeixouContato()) return
    let id: ReturnType<typeof setTimeout>
    const tentar = () => {
      // Só depois de rolar uma tela (sinal de interesse): nunca em cima de quem acabou de chegar do anúncio.
      if (outroCartaoAberto() || window.scrollY < window.innerHeight) id = setTimeout(tentar, 2000)
      else setAberto(true)
    }
    id = setTimeout(tentar, ESPERA_MS)
    return () => clearTimeout(id)
  }, [pathname, aberto])

  useEffect(() => {
    if (!envelopesPermitidos(pathname)) setAberto(false)
  }, [pathname])

  if (!aberto) return null

  const fechar = () => {
    marcarVisto()
    setAberto(false)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!escolha || enviando) return
    setEnviando(true)
    setErro(null)
    const r = await escolherEnvelope({ whatsapp, envelope: escolha.id, site }).catch(() => ({ erro: "Não deu certo agora. Tente de novo." }))
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
    }
    setPronto(true)
    pushEcommerceEvent("generate_lead", undefined, { lead_source: `envelope_${escolha.id}` })
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

  return (
    <div
      role="dialog"
      aria-labelledby="envelopes-titulo"
      className="fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-rounded border border-eclat-terracota/40 bg-eclat-luz p-4 shadow-lg small:bottom-6"
      data-testid="envelopes"
    >
      <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1 text-eclat-grafite/60 hover:text-eclat-grafite">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {pronto && escolha ? (
        <div className="flex flex-col gap-3" data-testid="envelopes-pronto">
          <p id="envelopes-titulo" className="pr-8 font-serif text-xl text-eclat-grafite">
            {escolha.id === "voucher" ? "Seu voucher de 10%" : escolha.id === "consultoria" ? "Sua consultoria está garantida" : "Seu presente está garantido"}
          </p>
          {escolha.id === "voucher" && cupom && (
            <>
              <p className="text-sm text-eclat-grafite/80">Use na sacola, na sua primeira compra. Ele já fica guardado neste aparelho.</p>
              <div className="flex gap-2">
                <span className="flex h-11 flex-1 items-center justify-center rounded-md border border-dashed border-eclat-terracota font-mono text-eclat-grafite" data-testid="envelopes-codigo">
                  {cupom}
                </span>
                <button type="button" onClick={copiar} className="h-11 rounded-md border border-eclat-grafite px-4 text-sm text-eclat-grafite">
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
            </>
          )}
          {escolha.id === "consultoria" && (
            <>
              <p className="text-sm text-eclat-grafite/80">Chame a gente agora e já começamos a escolher o seu look.</p>
              <a href={`https://wa.me/${whatsappMarca}?text=${encodeURIComponent(MENSAGEM_CONSULTORIA)}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center rounded-md bg-eclat-terracota text-sm font-medium text-white" data-testid="envelopes-whatsapp">
                Falar no WhatsApp
              </a>
            </>
          )}
          {escolha.id === "presente" && <p className="text-sm text-eclat-grafite/80">Ele vai junto na caixa da sua primeira compra. É só fazer o pedido neste aparelho.</p>}
          <button type="button" onClick={() => setAberto(false)} className="text-sm text-eclat-grafite/70 underline">
            Continuar vendo as peças
          </button>
        </div>
      ) : escolha ? (
        <form onSubmit={enviar} className="flex flex-col gap-2" data-testid="envelopes-form">
          <div className="flex items-center gap-3 pr-8">
            <span className="w-12 shrink-0">
              <DesenhoEnvelope aberto />
            </span>
            <div>
              <p id="envelopes-titulo" className="text-sm font-semibold text-eclat-grafite">
                {escolha.titulo}
              </p>
              <p className="text-xs text-eclat-grafite/70">{escolha.texto}</p>
            </div>
          </div>
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={site} onChange={(e) => setSite(e.target.value)} className="hidden" name="site" />
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              aria-label="WhatsApp com DDD"
              value={whatsapp}
              onChange={(e) => setWhatsapp(mascararCelular(e.target.value))}
              placeholder="(31) 99999-0000"
              className="h-11 min-w-0 flex-1 rounded-md border border-eclat-pedra bg-white px-3 text-base text-eclat-grafite"
              data-testid="envelopes-whatsapp-campo"
            />
            <button type="submit" disabled={enviando} className="h-11 shrink-0 rounded-md bg-eclat-terracota px-4 text-sm font-medium text-white disabled:opacity-60" data-testid="envelopes-enviar">
              {enviando ? "Abrindo..." : "Quero"}
            </button>
          </div>
          {erro && (
            <p role="alert" className="text-xs text-red-600" data-testid="envelopes-erro">
              {erro}
            </p>
          )}
          <p className="text-[11px] leading-snug text-eclat-grafite/60">{TEXTO_ACEITE_ENVELOPE}</p>
          <button type="button" onClick={() => setEscolha(null)} className="self-start text-xs text-eclat-grafite/70 underline">
            Ver os outros envelopes
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="pr-8">
            <p id="envelopes-titulo" className="font-serif text-xl text-eclat-grafite">
              Sua primeira compra tem um envelope
            </p>
            <p className="text-sm text-eclat-grafite/75">Escolha o seu.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ENVELOPES.map((e) => (
              <button key={e.id} type="button" onClick={() => setEscolha(e)} className="flex flex-col gap-1.5 rounded-md p-1 text-left hover:bg-eclat-areia/50" data-testid={`envelope-${e.id}`}>
                <DesenhoEnvelope aberto={false} />
                <span className="text-xs font-semibold leading-tight text-eclat-grafite">{e.titulo}</span>
                <span className="text-[11px] leading-snug text-eclat-grafite/70">{e.texto}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
