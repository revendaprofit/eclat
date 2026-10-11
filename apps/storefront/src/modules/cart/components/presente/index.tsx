"use client"

// Presente por faixa na sacola e no checkout: "faltam R$ X", escolha do presente e o presente escolhido.
// Molde da FreteGratisBarra. Sem estado (backend fora do ar, promoção desligada), não aparece nada.
import { useState, useTransition } from "react"
import { convertToLocale } from "@lib/util/money"
import { escolherPresente, removerPresente } from "@lib/data/brinde"
import {
  faixasParaEscolher,
  NOME_DO_PRESENTE,
  percentualAteProxima,
  type EstadoBrinde,
  type FaixaId,
  type OpcaoDePresente,
} from "@lib/util/brinde"

const reais = (centavos: number, moeda: string) => convertToLocale({ amount: centavos / 100, currency_code: moeda })

export default function Presente({
  estado,
  opcoes,
  moeda,
  aviso,
  destaque,
}: {
  estado: EstadoBrinde | null
  opcoes: Partial<Record<FaixaId, OpcaoDePresente[]>>
  moeda: string
  aviso?: string | null
  // Bloco em destaque no topo da sacola/checkout (sócia, 2026-10-11): só aparece quando a cliente ganhou e
  // ainda não escolheu; some assim que escolhe (o resumo continua mostrando o presente).
  destaque?: boolean
}) {
  const escolhiveis = estado ? faixasParaEscolher(estado).filter((f) => (opcoes[f] ?? []).some((o) => o.disponivel)) : []
  const [faixa, setFaixa] = useState<FaixaId | null>(escolhiveis[0] ?? null)
  const [variante, setVariante] = useState("")
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (!estado?.ativo) return null
  const atual = estado.presente
  const faixaAtiva = faixa && escolhiveis.includes(faixa) ? faixa : escolhiveis[0] ?? null
  const podeSubir = !!atual && escolhiveis.some((f) => f !== atual.faixa && f === "oculos")
  const mostrarEscolha = escolhiveis.length > 0 && (!atual || aberto)
  if (destaque && (atual || !escolhiveis.length)) return null

  const confirmar = () =>
    iniciar(async () => {
      setErro(null)
      const r = await escolherPresente(variante)
      if (!r.ok) setErro(r.mensagem)
      else {
        setAberto(false)
        setVariante("")
      }
    })

  return (
    <div
      id={destaque ? "presente-destaque" : undefined}
      className={
        destaque
          ? "flex flex-col gap-y-3 rounded-xl border-2 border-eclat-terracota bg-eclat-blush-claro/60 px-4 py-4 small:px-6 small:py-5 shadow-[0_4px_18px_rgba(122,59,44,.12)]"
          : "flex flex-col gap-y-2 rounded-base border border-eclat-terracota/25 bg-eclat-blush-claro/40 px-3 py-3"
      }
      data-testid={destaque ? "presente-destaque" : "presente"}
    >
      {destaque && (
        <span className="font-serif text-xl small:text-2xl text-eclat-grafite leading-tight">
          🎁 Você ganhou {NOME_DO_PRESENTE[escolhiveis[0]]} de presente. Escolha {escolhiveis[0] === "oculos" ? "o modelo" : "tamanho e cor"}:
        </span>
      )}
      {aviso && (
        <span className="text-xs text-eclat-terracota" role="status">
          {aviso}
        </span>
      )}

      {atual ? (
        <span className="text-small-regular text-ui-fg-base">
          🎁 Seu presente: <strong>{NOME_DO_PRESENTE[atual.faixa]}</strong> já está na sacola.
        </span>
      ) : escolhiveis.length && !destaque ? (
        <span className="text-small-regular text-ui-fg-base">
          🎁 Você ganhou <strong>{NOME_DO_PRESENTE[escolhiveis[0]]}</strong>! Escolha abaixo.
        </span>
      ) : null}

      {estado.proxima && (
        <>
          <span className="text-small-regular text-ui-fg-base">
            Faltam <strong>{reais(estado.proxima.falta_centavos, moeda)}</strong> para{" "}
            {atual || escolhiveis.length ? "trocar por " : "ganhar "}
            {NOME_DO_PRESENTE[estado.proxima.id]} de presente.
          </span>
          <div
            className="h-1.5 w-full rounded-full bg-eclat-blush overflow-hidden"
            role="progressbar"
            aria-label="Progresso para o presente"
            aria-valuenow={percentualAteProxima(estado)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-eclat-terracota transition-all" style={{ width: `${percentualAteProxima(estado)}%` }} />
          </div>
        </>
      )}

      {mostrarEscolha && faixaAtiva && (
        <div className="flex flex-col gap-2 pt-1">
          {escolhiveis.length > 1 && (
            <div className="flex gap-2" role="radiogroup" aria-label="Qual presente">
              {escolhiveis.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={f === faixaAtiva}
                  onClick={() => {
                    setFaixa(f)
                    setVariante("")
                  }}
                  className={`flex-1 border px-2 py-1.5 text-xs ${f === faixaAtiva ? "border-eclat-grafite bg-eclat-grafite text-eclat-luz" : "border-eclat-pedra"}`}
                >
                  {f === "oculos" ? "Óculos" : "Meia"}
                </button>
              ))}
            </div>
          )}
          <select
            value={variante}
            onChange={(e) => setVariante(e.target.value)}
            className="h-10 border border-eclat-pedra bg-white px-2 text-sm"
            aria-label="Escolha a opção do presente"
            data-testid="presente-opcao"
          >
            <option value="">{faixaAtiva === "oculos" ? "Escolha o modelo" : "Escolha tamanho e cor"}</option>
            {(opcoes[faixaAtiva] ?? []).map((o) => (
              <option key={o.variant_id} value={o.variant_id} disabled={!o.disponivel}>
                {o.rotulo}
                {o.disponivel ? "" : " (esgotado)"}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!variante || pendente}
            onClick={confirmar}
            className="h-10 bg-eclat-terracota text-eclat-luz text-xs uppercase tracking-widest disabled:opacity-50"
            data-testid="presente-confirmar"
          >
            {pendente ? "Colocando…" : atual ? "Trocar presente" : "Colocar presente na sacola"}
          </button>
        </div>
      )}

      {atual && !mostrarEscolha && (
        <div className="flex gap-4 text-xs">
          {escolhiveis.length > 0 && (
            <button type="button" className="underline" onClick={() => setAberto(true)}>
              {podeSubir ? "Trocar pelo óculos" : "Trocar"}
            </button>
          )}
          <button type="button" className="underline text-ui-fg-muted" onClick={() => iniciar(() => removerPresente())}>
            Não quero o presente
          </button>
        </div>
      )}

      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  )
}
