"use client"

import { useEffect, useState } from "react"
import { Aviso, Carregando, Metrica, Secao, TituloPagina } from "@/components/ui"
import { calendarioPorMes, MESES, nomeDe, type Aniversariante, type ClienteComAniversario } from "@/lib/aniversario"

// Calendário de aniversários das clientes (sócia, 2026-10-14). A data vem da ficha (cadastro, checkout, resposta no
// WhatsApp ou digitada aqui pela equipe). Às 9h do dia, o backend manda os parabéns com o cupom sozinho.
type Resposta = {
  hoje: string
  proximos: (ClienteComAniversario & Aniversariante)[]
  clientes: ClienteComAniversario[]
  sem_data: number
  perguntadas: number
}

const wa = (tel: string | null) => (tel ? `https://wa.me/${tel.replace(/\D/g, "").replace(/^(?!55)/, "55")}` : null)

export default function AniversariosPage() {
  const [d, setD] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/aniversarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setD(j)))
      .catch((e) => setErro((e as Error).message))
  }, [])

  const meses = d ? calendarioPorMes(d.clientes) : []
  const mesHoje = d ? Number(d.hoje.slice(0, 2)) - 1 : -1
  const diaHoje = d ? Number(d.hoje.slice(3)) : -1

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina
        titulo="Aniversários"
        descricao="No dia, às 9h, a cliente recebe os parabéns, o cupom de 10% e o aviso do presente — sozinho. A data entra pelo cadastro, pelo checkout, pela resposta no WhatsApp ou pela ficha da cliente."
      />
      {!d && !erro && <Carregando />}
      {erro && <Aviso>{erro}</Aviso>}
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica rotulo="Hoje" valor={d.proximos.filter((c) => c.dias === 0).length} detalhe="aniversariantes" atencao={d.proximos.some((c) => c.dias === 0)} />
            <Metrica rotulo="Próximos 7 dias" valor={d.proximos.length} detalhe="contando hoje" />
            <Metrica rotulo="Com data" valor={d.clientes.length} detalhe="clientes no calendário" />
            <Metrica href="/clientes" rotulo="Sem data" valor={d.sem_data} detalhe={`${d.perguntadas} já perguntada(s) no WhatsApp`} />
          </div>

          {d.proximos.length > 0 && (
            <Secao titulo="Esta semana">
              <ul className="flex flex-col gap-2">
                {d.proximos.map((c) => (
                  <li key={c.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${c.dias === 0 ? "border-eclat-dourado/60 bg-eclat-dourado/10" : "border-eclat-pedra/40 bg-white/60"}`}>
                    <span className="text-2xl" aria-hidden="true">🎂</span>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-medium text-eclat-texto">{nomeDe(c)}</div>
                      <div className="text-meta text-eclat-texto-3">{c.dias === 0 ? "é hoje" : c.dias === 1 ? "amanhã" : `em ${c.dias} dias`} · {c.aniversario.slice(3)}/{c.aniversario.slice(0, 2)}</div>
                    </div>
                    {c.dias === 0 && (
                      <span className={`text-meta px-2 py-0.5 rounded-full ${c.parabens_enviado ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {c.parabens_enviado ? "parabéns enviados" : "parabéns saem às 9h"}
                      </span>
                    )}
                    {wa(c.phone) && (
                      <a href={wa(c.phone) as string} target="_blank" rel="noopener noreferrer" className="text-meta px-3 py-1.5 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">
                        💬 WhatsApp
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          <Secao titulo="Calendário">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {meses.map((lista, i) => (
                <div key={i} className={`rounded-lg border p-3 bg-white/60 ${i === mesHoje ? "border-eclat-dourado/60" : "border-eclat-pedra/40"}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="font-serif text-lg text-eclat-texto capitalize">{MESES[i]}</h3>
                    <span className="text-meta text-eclat-texto-3">{lista.length ? `${lista.length}` : "—"}</span>
                  </div>
                  {lista.length === 0 ? (
                    <p className="text-meta text-eclat-texto/40">Ninguém ainda</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {lista.map((c) => (
                        <li key={c.id} className={`flex items-center gap-2 text-corpo ${i === mesHoje && c.dia === diaHoje ? "font-medium text-eclat-texto" : "text-eclat-texto-2"}`}>
                          <span className="w-7 text-right lining-nums tabular-nums text-eclat-texto-3">{String(c.dia).padStart(2, "0")}</span>
                          <span className="truncate">{nomeDe(c)}</span>
                          {i === mesHoje && c.dia === diaHoje && <span aria-hidden="true">🎂</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Secao>
        </>
      )}
    </div>
  )
}
