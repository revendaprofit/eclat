"use client"

import { useEffect, useState } from "react"
import ConnectionsPanel from "@/components/connections-panel"
import {
  Aviso,
  Carregando,
  Cartao,
  Metrica,
  Rotulo,
  Secao,
  Tabela,
  Td,
  Th,
  TituloPagina,
  Tr,
} from "@/components/ui"

type Dash = {
  vendas_hoje: { pedidos: number; receita_centavos: number }
  a_enviar: number
  leads_novos: number
  conversas_pendentes: number
  estoque_baixo: { count: number; itens: { produto: string; variacao: string; sku: string | null; estoque: number }[] }
  reativacao: number
  clientes_total: number
  aniversariantes: { id: string; nome: string; phone: string | null; aniversario: string; dias: number; parabens_enviado: boolean }[]
}

const brl = (cent: number) =>
  (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => (data.error ? setErro(data.error) : setD(data)))
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const saudacao = (() => {
    const h = new Date().getHours()
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
  })()

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina titulo={`${saudacao} ✨`} descricao="Suas filas de ação de hoje." />

      {loading && <Carregando />}
      {erro && <Aviso>{erro}</Aviso>}

      {d && (
        <>
          <Cartao>
            <Rotulo>Vendas de hoje</Rotulo>
            <div className="font-serif lining-nums tabular-nums text-numero leading-none text-eclat-texto mt-2">
              {brl(d.vendas_hoje.receita_centavos)}
            </div>
            <div className="text-meta text-eclat-texto-3 mt-1.5">
              {d.vendas_hoje.pedidos} pedido(s) pago(s)/autorizado(s) · {d.clientes_total} cliente(s) no total
            </div>
          </Cartao>

          <Secao titulo="Esperando por você">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Metrica href="/pedidos" rotulo="Pedidos a enviar" valor={d.a_enviar} detalhe="despachar" atencao={d.a_enviar > 0} />
              <Metrica href="/conversas" rotulo="Conversas pendentes" valor={d.conversas_pendentes} detalhe="responder" atencao={d.conversas_pendentes > 0} />
              <Metrica href="/leads" rotulo="Leads novos" valor={d.leads_novos} detalhe="atender" atencao={d.leads_novos > 0} />
              <Metrica href="/produtos" rotulo="Estoque baixo" valor={d.estoque_baixo.count} detalhe="≤ 5 unidades" atencao={d.estoque_baixo.count > 0} />
              <Metrica href="/clientes" rotulo="Reativação" valor={d.reativacao} detalhe="recorrentes inativos +60d" />
              <Metrica
                href="/aniversarios"
                rotulo="Aniversariantes"
                valor={(d.aniversariantes ?? []).filter((a) => a.dias === 0).length}
                detalhe={`hoje · ${(d.aniversariantes ?? []).length} nos próximos 7 dias`}
                atencao={(d.aniversariantes ?? []).some((a) => a.dias === 0)}
              />
            </div>
          </Secao>

          {(d.aniversariantes ?? []).length > 0 && (
            <Secao titulo="Aniversários — esta semana 🎂">
              <ul className="flex flex-col gap-2">
                {d.aniversariantes.map((a) => (
                  <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 ${a.dias === 0 ? "border-eclat-dourado/60 bg-eclat-dourado/10" : "border-eclat-pedra/40 bg-white/60"}`}>
                    <div className="flex-1 min-w-[160px]">
                      <span className="font-medium text-eclat-texto">{a.nome}</span>
                      <span className="text-meta text-eclat-texto-3 ml-2">{a.dias === 0 ? "é hoje" : a.dias === 1 ? "amanhã" : `em ${a.dias} dias`} · {a.aniversario.slice(3)}/{a.aniversario.slice(0, 2)}</span>
                    </div>
                    {a.dias === 0 && (
                      <span className={`text-meta px-2 py-0.5 rounded-full ${a.parabens_enviado ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {a.parabens_enviado ? "parabéns + cupom enviados" : "parabéns saem às 9h"}
                      </span>
                    )}
                    {a.phone && (
                      <a href={`https://wa.me/${a.phone.replace(/\D/g, "").replace(/^(?!55)/, "55")}`} target="_blank" rel="noopener noreferrer" className="text-meta px-3 py-1.5 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">
                        💬 WhatsApp
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          {d.estoque_baixo.itens.length > 0 && (
            <Secao titulo="Estoque baixo — repor">
              <Tabela>
                <thead>
                  <tr>
                    <Th>Produto</Th>
                    <Th>Variação</Th>
                    <Th>SKU</Th>
                    <Th alinhamento="direita">Estoque</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.estoque_baixo.itens.map((it, i) => (
                    <Tr key={i}>
                      <Td>{it.produto}</Td>
                      <Td tom="apoio">{it.variacao}</Td>
                      <Td tom="meta">{it.sku}</Td>
                      <Td alinhamento="direita">
                        <span className={it.estoque === 0 ? "text-red-800 font-medium" : "text-amber-800 font-medium"}>
                          {it.estoque} un.
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>
            </Secao>
          )}
        </>
      )}

      <ConnectionsPanel />
    </div>
  )
}
