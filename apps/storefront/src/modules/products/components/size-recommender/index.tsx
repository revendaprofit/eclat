"use client"

import { useState } from "react"
import Modal from "@modules/common/components/modal"
import useToggleState from "@lib/hooks/use-toggle-state"
import { Button } from "@modules/common/components/ui"
import type { MeasureTable } from "@lib/util/measurements"
import {
  estimateMeasurements,
  indiceTamanho,
  measurableColumns,
  normalizarTamanho,
  recommendSize,
  type MedidaKey,
  type Medidas,
  type Recomendacao,
} from "@lib/util/size-recommendation"
import { getPrefs, setPrefs } from "@modules/personalization/prefs"

// "Qual é o meu tamanho?" — 3 passos: corpo (altura/peso → pré-preenche) → medidas
// (busto/cintura/quadril conforme colunas da tabela) → resultado (tamanho + caimento +
// alternativa + "Selecionar"). Tudo local: função pura + prefs no navegador.

const LABEL: Record<MedidaKey, string> = { busto: "Busto", cintura: "Cintura", quadril: "Quadril" }
const CAIMENTO: Record<Recomendacao["caimento"], string> = {
  ideal: "Caimento ideal",
  justo: "Fica mais justo — mais sustentação",
  folgado: "Fica mais folgado — mais conforto",
}
const FIT_CURTO: Record<Recomendacao["caimento"], string> = {
  ideal: "na faixa",
  justo: "acima da faixa",
  folgado: "abaixo da faixa",
}

type Props = {
  table: MeasureTable
  availableSizes: string[]
  onSelect: (size: string) => void
  productHandle?: string
  // fix round 1, achado #7: durante o fallback do Suspense (ProductActions inteiro desabilitado),
  // o link continua clicável e abre um modal funcional enquanto os demais controles estão
  // desabilitados. Mesmo tratamento dos botões de tamanho (visível, porém desabilitado) — não
  // escondido — para consistência com o resto do seletor.
  disabled?: boolean
  // follow-up #9: o mesmo SizeSelect aparece inline e no bottom sheet do mobile — o sufixo evita
  // `data-testid` duplicado no DOM ("-mobile" no bottom sheet).
  testIdSuffix?: string
}

type Step = "corpo" | "medidas" | "resultado"
type Form = Record<MedidaKey, string>

const TITULO: Record<Step, string> = {
  corpo: "Sua altura e peso",
  medidas: "Suas medidas",
  resultado: "Resultado",
}

const inputCls =
  "w-full h-10 rounded-rounded border border-ui-border-base bg-white px-3 text-sm text-eclat-grafite focus:outline-none focus:border-eclat-terracota"

const MEDIDA_MIN_CM = 40
const MEDIDA_MAX_CM = 200

function medidaValida(v: string): boolean {
  if (v === "") return true // campo vazio é opcional — validação só entra em cena quando preenchido
  const n = Number(v)
  return Number.isFinite(n) && n >= MEDIDA_MIN_CM && n <= MEDIDA_MAX_CM
}

export default function SizeRecommender({
  table,
  availableSizes,
  onSelect,
  productHandle,
  disabled,
  testIdSuffix = "",
}: Props) {
  const { state: isOpen, open, close } = useToggleState()
  const cols = measurableColumns(table)
  const [step, setStep] = useState<Step>("corpo")
  const [altura, setAltura] = useState("")
  const [peso, setPeso] = useState("")
  const [form, setForm] = useState<Form>({ busto: "", cintura: "", quadril: "" })
  const [resultado, setResultado] = useState<Recomendacao | null>(null)

  if (cols.length === 0) return null

  function abrir() {
    const saved = getPrefs().medidas
    if (saved) {
      setAltura(saved.altura_cm ? String(saved.altura_cm) : "")
      setPeso(saved.peso_kg ? String(saved.peso_kg) : "")
      setForm({
        busto: saved.busto ? String(saved.busto) : "",
        cintura: saved.cintura ? String(saved.cintura) : "",
        quadril: saved.quadril ? String(saved.quadril) : "",
      })
    }
    setResultado(null)
    setStep("corpo")
    open()
  }

  // fix round 1, achado #3: `estimateMeasurements` rejeita altura >= 230 / peso >= 250 (faixa
  // plausível de corpo humano) — usar o mesmo critério aqui evita "Continuar" habilitado com
  // valores como 165/300 que resultariam num passo 2 sem pré-preenchimento.
  const corpoValido = estimateMeasurements(Number(altura), Number(peso)) !== null

  function continuar() {
    const est = estimateMeasurements(Number(altura), Number(peso))
    if (est) {
      // só preenche o que a cliente ainda não informou
      setForm((prev) => ({
        busto: prev.busto || String(est.busto),
        cintura: prev.cintura || String(est.cintura),
        quadril: prev.quadril || String(est.quadril),
      }))
    }
    setStep("medidas")
  }

  const medidasInformadas = cols.some((c) => Number(form[c.key]) > 0)
  // fix round 1, achado #4: cada campo preenchido precisa estar em 40–200 cm (rejeita erro de
  // unidade, ex.: "1,65" digitado em metros) antes de liberar o cálculo.
  const medidasValidas = cols.every((c) => medidaValida(form[c.key]))
  const podeCalcular = medidasInformadas && medidasValidas

  function calcular() {
    const m: Medidas = {}
    for (const c of cols) {
      const n = Number(form[c.key])
      if (n > 0) m[c.key] = n
    }
    const r = recommendSize(table, m)
    setResultado(r)
    setStep("resultado")
    try {
      // fix round 1, achado #5: mescla com as medidas já salvas em vez de substituir o objeto
      // inteiro — a tabela desta categoria pode não pedir todas as colunas, e um campo salvo antes
      // (ex.: busto, numa categoria de 2 colunas atual) não pode ser apagado por este cálculo.
      // follow-up #5: altura/peso anteriores são preservados quando o passo 1 foi pulado ("Já sei
      // minhas medidas" deixa os campos vazios) e a falha de storage não quebra o fluxo.
      const salvas = getPrefs().medidas
      setPrefs({
        medidas: {
          ...salvas,
          altura_cm: Number(altura) > 0 ? Number(altura) : salvas?.altura_cm,
          peso_kg: Number(peso) > 0 ? Number(peso) : salvas?.peso_kg,
          ...m,
        },
      })
    } catch {
      /* noop */
    }
    if (r) {
      try {
        const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
        w.dataLayer = w.dataLayer || []
        w.dataLayer.push({
          event: "size_recommendation",
          item_id: productHandle ?? null,
          recommended_size: r.recomendado,
          fit: r.foraDaTabela ? "fora_da_tabela" : r.caimento,
        })
      } catch {
        /* noop */
      }
    }
  }

  function usar(size: string) {
    onSelect(size)
    // fix round 1, achado #6: uma falha de storage (modo privado/quota) não pode impedir o
    // fechamento do modal nem a seleção do tamanho — só a persistência da preferência é perdida.
    try {
      setPrefs({ tamanho: normalizarTamanho(size) })
    } catch {
      /* noop */
    }
    close()
  }

  // follow-up #4: o rótulo vem da tabela do Cockpit e o valor vem da opção do Medusa — os dois
  // lados passam por `normalizarTamanho`, e o que vai para o seletor é SEMPRE o valor do Medusa.
  function opcaoPara(rotulo: string): string | null {
    const alvo = normalizarTamanho(rotulo)
    return availableSizes.find((s) => normalizarTamanho(s) === alvo) ?? null
  }

  // follow-up #8: recomendado indisponível e sem alternativa → oferece o tamanho disponível mais
  // próximo na ORDEM_TAMANHOS (empate → o maior, mesma regra do desempate da recomendação).
  function maisProximoDisponivel(rotulo: string): string | null {
    const alvo = indiceTamanho(rotulo)
    if (alvo === -1) return null
    let melhor: string | null = null
    let melhorDist = Infinity
    let melhorIdx = -1
    for (const s of availableSizes) {
      const i = indiceTamanho(s)
      if (i === -1) continue
      const dist = Math.abs(i - alvo)
      if (dist < melhorDist || (dist === melhorDist && i > melhorIdx)) {
        melhor = s
        melhorDist = dist
        melhorIdx = i
      }
    }
    return melhor
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={disabled}
        className="self-start text-xs underline underline-offset-2 text-eclat-terracota hover:text-eclat-terracota-claro disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-eclat-terracota"
        data-testid={`size-recommender-open${testIdSuffix}`}
      >
        Qual é o meu tamanho?
      </button>

      <Modal isOpen={isOpen} close={close} size="small" data-testid="size-recommender-modal">
        <Modal.Title>{TITULO[step]}</Modal.Title>

        {/* follow-up #2: o painel do Modal compartilhado é `overflow-y-hidden` + `max-h-[75vh]`
            (não mexer nele) — o corpo dos passos rola aqui dentro, senão o resultado de uma
            tabela de 3 colunas fica inalcançável em telas baixas (375×667). */}
        <div className="overflow-y-auto max-h-[calc(75vh-5rem)] pr-1">
          {step === "corpo" && (
            <div className="flex flex-col gap-4 pt-4">
              <p className="text-sm text-eclat-grafite/70">
                Informe altura e peso para estimarmos suas medidas. Você confere e ajusta no
                próximo passo.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                  Altura (cm)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={100}
                    max={230}
                    placeholder="165"
                    value={altura}
                    onChange={(e) => setAltura(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                  Peso (kg)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={250}
                    placeholder="60"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              <Button
                variant="primary"
                className="w-full h-10"
                onClick={continuar}
                disabled={!corpoValido}
              >
                Continuar
              </Button>
              <button
                type="button"
                onClick={() => setStep("medidas")}
                className="text-xs underline text-eclat-grafite/60 self-center"
              >
                Já sei minhas medidas
              </button>
            </div>
          )}

          {step === "medidas" && (
            <div className="flex flex-col gap-4 pt-4">
              <p className="text-sm text-eclat-grafite/70">
                Meça com a fita paralela ao chão: busto na parte mais cheia, cintura na mais
                fina, quadril na mais cheia. Ajuste os valores se precisar.
              </p>
              {/* follow-up #6: a grade acompanha o número de colunas comparáveis da tabela —
                  sem buraco quando a categoria só tem 2 medidas. */}
              <div
                className={
                  cols.length >= 3 ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"
                }
              >
                {cols.map((c) => {
                  const valor = form[c.key]
                  const invalida = valor !== "" && !medidaValida(valor)
                  const erroId = `medida-erro-${c.key}${testIdSuffix}`
                  return (
                    <label key={c.key} className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                      {LABEL[c.key]} (cm)
                      <input
                        type="number"
                        inputMode="numeric"
                        min={MEDIDA_MIN_CM}
                        max={MEDIDA_MAX_CM}
                        value={valor}
                        onChange={(e) => setForm((prev) => ({ ...prev, [c.key]: e.target.value }))}
                        className={inputCls}
                        aria-invalid={invalida}
                        aria-describedby={invalida ? erroId : undefined}
                      />
                      {invalida && (
                        <span id={erroId} className="text-[10px] text-eclat-terracota">
                          Informe a medida em cm, entre 40 e 200
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              <Button
                variant="primary"
                className="w-full h-10"
                onClick={calcular}
                disabled={!podeCalcular}
              >
                Encontrar meu tamanho
              </Button>
              <button
                type="button"
                onClick={() => setStep("corpo")}
                className="text-xs underline text-eclat-grafite/60 self-center"
              >
                Voltar
              </button>
            </div>
          )}

          {step === "resultado" && !resultado && (
            <div className="flex flex-col gap-4 pt-4" role="status" aria-live="polite">
              <p className="text-sm text-eclat-grafite/70">
                Não conseguimos calcular com essas medidas. Confira os valores e tente de novo.
              </p>
              <Button variant="secondary" className="w-full h-10" onClick={() => setStep("medidas")}>
                Voltar
              </Button>
            </div>
          )}

          {step === "resultado" && resultado && (
            <div
              className="flex flex-col gap-4 pt-4"
              role="status"
              aria-live="polite"
              data-testid="size-recommender-result"
            >
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-eclat-grafite/60">
                  {resultado.foraDaTabela
                    ? "Suas medidas ficam fora da nossa tabela"
                    : "Seu tamanho ideal"}
                </p>
                {!resultado.foraDaTabela && (
                  <>
                    <p className="font-serif text-5xl text-eclat-grafite leading-none mt-1">
                      {resultado.recomendado}
                    </p>
                    <p className="text-sm text-eclat-grafite/70 mt-2">
                      {CAIMENTO[resultado.caimento]}
                    </p>
                  </>
                )}
              </div>
              <ul className="text-xs text-eclat-grafite/70 divide-y divide-ui-border-base border-y border-ui-border-base">
                {resultado.detalhes.map((d) => (
                  <li key={d.medida} className="flex justify-between py-2">
                    <span>
                      {LABEL[d.medida]} {d.valor} cm
                    </span>
                    <span>
                      faixa {d.faixa.min}–{d.faixa.max} · {FIT_CURTO[d.fit]}
                    </span>
                  </li>
                ))}
              </ul>

              {resultado.foraDaTabela ? (
                // follow-up #1 (UI): nenhuma linha da tabela serve — sem CTA "Selecionar". Não há
                // URL/constante de WhatsApp na vitrine hoje, então o texto vai sem link e o CTA é a
                // própria tabela de medidas da PDP (âncora #medidas, a mesma do SizeSelect).
                <>
                  <p className="text-sm text-eclat-grafite/70 text-center">
                    A mais próxima seria <strong>{resultado.recomendado}</strong>, mas pode não
                    vestir bem. Fale com a gente no WhatsApp que ajudamos a escolher.
                  </p>
                  <a
                    href="#medidas"
                    onClick={close}
                    className="w-full h-10 flex items-center justify-center rounded-rounded border border-eclat-grafite text-sm text-eclat-grafite"
                    data-testid="size-recommender-ver-tabela"
                  >
                    Ver tabela de medidas
                  </a>
                </>
              ) : (
                <>
                  {resultado.alternativa && (
                    <p className="text-xs text-eclat-grafite/70 text-center">
                      Também pode servir: <strong>{resultado.alternativa}</strong>
                      {resultado.caimento === "justo" && " (mais confortável)"}
                      {resultado.caimento === "folgado" && " (mais sustentação)"}
                    </p>
                  )}
                  {(() => {
                    const opcao = opcaoPara(resultado.recomendado)
                    if (opcao) {
                      return (
                        <Button
                          variant="primary"
                          className="w-full h-10"
                          onClick={() => usar(opcao)}
                          data-testid="size-recommender-select"
                        >
                          Selecionar {resultado.recomendado}
                        </Button>
                      )
                    }
                    const opcaoAlt = resultado.alternativa
                      ? opcaoPara(resultado.alternativa)
                      : null
                    const proximo = opcaoAlt ? null : maisProximoDisponivel(resultado.recomendado)
                    return (
                      <>
                        <p className="text-xs text-eclat-terracota text-center">
                          O tamanho {resultado.recomendado} não está disponível nesta peça.
                        </p>
                        {!opcaoAlt && proximo && (
                          <>
                            <p className="text-xs text-eclat-grafite/70 text-center">
                              Disponível: <strong>{proximo}</strong>
                            </p>
                            <Button
                              variant="secondary"
                              className="w-full h-10"
                              onClick={() => usar(proximo)}
                              data-testid="size-recommender-select-proximo"
                            >
                              Selecionar {proximo}
                            </Button>
                          </>
                        )}
                        {!opcaoAlt && !proximo && (
                          <p className="text-xs text-eclat-grafite/70 text-center">
                            Nenhum tamanho disponível nesta cor
                          </p>
                        )}
                      </>
                    )
                  })()}
                  {resultado.alternativa &&
                    (() => {
                      const opcaoAlt = opcaoPara(resultado.alternativa as string)
                      if (!opcaoAlt) return null
                      return (
                        <Button
                          variant="secondary"
                          className="w-full h-10"
                          onClick={() => usar(opcaoAlt)}
                        >
                          Selecionar {resultado.alternativa}
                        </Button>
                      )
                    })()}
                </>
              )}

              <button
                type="button"
                onClick={() => setStep("corpo")}
                className="text-xs underline text-eclat-grafite/60 self-center"
              >
                Calcular novamente
              </button>
              <p className="text-[10px] text-eclat-grafite/50 text-center leading-relaxed">
                Estimativa com base na tabela de medidas desta peça. Nossos tecidos têm compressão
                com elasticidade — entre dois tamanhos, o menor sustenta mais e o maior é mais
                confortável.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
