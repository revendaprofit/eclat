"use client"

import { useState } from "react"
import Modal from "@modules/common/components/modal"
import useToggleState from "@lib/hooks/use-toggle-state"
import { Button } from "@modules/common/components/ui"
import type { MeasureTable } from "@lib/util/measurements"
import {
  estimateMeasurements,
  measurableColumns,
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
}

type Step = "corpo" | "medidas" | "resultado"
type Form = Record<MedidaKey, string>

const inputCls =
  "w-full h-10 rounded-rounded border border-ui-border-base bg-white px-3 text-sm text-eclat-grafite focus:outline-none focus:border-eclat-terracota"

export default function SizeRecommender({ table, availableSizes, onSelect, productHandle }: Props) {
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

  const corpoValido = Number(altura) > 100 && Number(peso) > 30

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

  function calcular() {
    const m: Medidas = {}
    for (const c of cols) {
      const n = Number(form[c.key])
      if (n > 0) m[c.key] = n
    }
    const r = recommendSize(table, m)
    setResultado(r)
    setStep("resultado")
    setPrefs({
      medidas: {
        altura_cm: Number(altura) > 0 ? Number(altura) : undefined,
        peso_kg: Number(peso) > 0 ? Number(peso) : undefined,
        ...m,
      },
    })
    if (r) {
      try {
        const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
        w.dataLayer = w.dataLayer || []
        w.dataLayer.push({
          event: "size_recommendation",
          item_id: productHandle ?? null,
          recommended_size: r.recomendado,
          fit: r.caimento,
        })
      } catch {
        /* noop */
      }
    }
  }

  function usar(size: string) {
    onSelect(size)
    setPrefs({ tamanho: size })
    close()
  }

  const disponivel = (size: string) => availableSizes.includes(size)

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="self-start text-xs underline underline-offset-2 text-eclat-terracota hover:text-eclat-terracota-claro"
        data-testid="size-recommender-open"
      >
        Qual é o meu tamanho?
      </button>

      <Modal isOpen={isOpen} close={close} size="small" data-testid="size-recommender-modal">
        <Modal.Title>Encontre seu tamanho</Modal.Title>

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
            <Button variant="primary" className="w-full h-10" onClick={continuar} disabled={!corpoValido}>
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
            <div className="grid grid-cols-3 gap-3">
              {cols.map((c) => (
                <label key={c.key} className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                  {LABEL[c.key]} (cm)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={40}
                    max={200}
                    value={form[c.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    className={inputCls}
                  />
                </label>
              ))}
            </div>
            <Button variant="primary" className="w-full h-10" onClick={calcular} disabled={!medidasInformadas}>
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
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-sm text-eclat-grafite/70">
              Não conseguimos calcular com essas medidas. Confira os valores e tente de novo.
            </p>
            <Button variant="secondary" className="w-full h-10" onClick={() => setStep("medidas")}>
              Voltar
            </Button>
          </div>
        )}

        {step === "resultado" && resultado && (
          <div className="flex flex-col gap-4 pt-4" data-testid="size-recommender-result">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider text-eclat-grafite/60">
                Seu tamanho ideal
              </p>
              <p className="font-serif text-5xl text-eclat-grafite leading-none mt-1">
                {resultado.recomendado}
              </p>
              <p className="text-sm text-eclat-grafite/70 mt-2">{CAIMENTO[resultado.caimento]}</p>
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
            {resultado.alternativa && (
              <p className="text-xs text-eclat-grafite/70 text-center">
                Também pode servir: <strong>{resultado.alternativa}</strong>
                {resultado.caimento === "justo" && " (mais confortável)"}
                {resultado.caimento === "folgado" && " (mais sustentação)"}
              </p>
            )}
            {disponivel(resultado.recomendado) ? (
              <Button
                variant="primary"
                className="w-full h-10"
                onClick={() => usar(resultado.recomendado)}
                data-testid="size-recommender-select"
              >
                Selecionar {resultado.recomendado}
              </Button>
            ) : (
              <p className="text-xs text-eclat-terracota text-center">
                O tamanho {resultado.recomendado} não está disponível nesta peça.
              </p>
            )}
            {resultado.alternativa && disponivel(resultado.alternativa) && (
              <Button
                variant="secondary"
                className="w-full h-10"
                onClick={() => usar(resultado.alternativa as string)}
              >
                Selecionar {resultado.alternativa}
              </Button>
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
      </Modal>
    </>
  )
}
