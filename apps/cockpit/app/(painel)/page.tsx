"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ConnectionsPanel from "@/components/connections-panel"

type Dash = {
  vendas_hoje: { pedidos: number; receita_centavos: number }
  a_enviar: number
  leads_novos: number
  conversas_pendentes: number
  estoque_baixo: { count: number; itens: { produto: string; variacao: string; sku: string | null; estoque: number }[] }
  reativacao: number
  clientes_total: number
}

const brl = (cent: number) =>
  (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function Fila({
  href,
  titulo,
  valor,
  detalhe,
  destaque,
}: {
  href: string
  titulo: string
  valor: string | number
  detalhe?: string
  destaque?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block border rounded-lg p-4 transition-colors ${
        destaque
          ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
          : "border-eclat-pedra/40 bg-white/60 hover:bg-eclat-areia/30"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-eclat-grafite/50">{titulo}</div>
      <div className="font-serif text-3xl text-eclat-grafite mt-1">{valor}</div>
      {detalhe && <div className="text-xs text-eclat-grafite/50 mt-1">{detalhe}</div>}
    </Link>
  )
}

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
      <div>
        <h1 className="font-serif text-4xl text-eclat-grafite">{saudacao} ✨</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">Suas filas de ação de hoje.</p>
      </div>

      {loading && <p className="text-sm text-eclat-grafite/50">Carregando…</p>}
      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>
      )}

      {d && (
        <>
          {/* vendas do dia */}
          <div className="border border-eclat-grafite/20 rounded-lg bg-white/70 p-5">
            <div className="text-xs uppercase tracking-wider text-eclat-grafite/50">Vendas de hoje</div>
            <div className="font-serif text-4xl text-eclat-grafite mt-1">
              {brl(d.vendas_hoje.receita_centavos)}
            </div>
            <div className="text-xs text-eclat-grafite/50 mt-1">
              {d.vendas_hoje.pedidos} pedido(s) pago(s)/autorizado(s) · {d.clientes_total} cliente(s) no total
            </div>
          </div>

          {/* filas de ação */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Fila href="/pedidos" titulo="Pedidos a enviar" valor={d.a_enviar} detalhe="despachar" destaque={d.a_enviar > 0} />
            <Fila href="/conversas" titulo="Conversas pendentes" valor={d.conversas_pendentes} detalhe="responder" destaque={d.conversas_pendentes > 0} />
            <Fila href="/leads" titulo="Leads novos" valor={d.leads_novos} detalhe="atender" destaque={d.leads_novos > 0} />
            <Fila href="/produtos" titulo="Estoque baixo" valor={d.estoque_baixo.count} detalhe={`≤ 5 unidades`} destaque={d.estoque_baixo.count > 0} />
            <Fila href="/clientes" titulo="Reativação" valor={d.reativacao} detalhe="recorrentes inativos +60d" />
          </div>

          {/* detalhe estoque baixo */}
          {d.estoque_baixo.itens.length > 0 && (
            <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
              <div className="px-4 py-2 text-xs uppercase tracking-wider text-eclat-grafite/50 border-b border-eclat-pedra/20">
                Estoque baixo — repor
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {d.estoque_baixo.itens.map((it, i) => (
                    <tr key={i} className="border-b border-eclat-pedra/10 last:border-0">
                      <td className="px-4 py-2">{it.produto}</td>
                      <td className="px-4 py-2 text-eclat-grafite/60">{it.variacao}</td>
                      <td className="px-4 py-2 text-eclat-grafite/50 text-xs">{it.sku}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={it.estoque === 0 ? "text-red-700 font-medium" : "text-amber-700"}>
                          {it.estoque} un.
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConnectionsPanel />
    </div>
  )
}
