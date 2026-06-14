import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Cockpit = {
  comercio: {
    produtos?: number
    clientes?: number
    pedidos_total?: number
    pedidos_por_status?: Record<string, number>
    receita_pedidos_recentes?: number
    moeda?: string
    pedidos_recentes?: Array<{
      display_id: number
      status: string
      total: number
      currency_code: string
      email: string
      created_at: string
    }>
    erro?: string
  }
  relacionamento: {
    leads_total?: number
    clientes_rel?: number
    conversas_total?: number
    funil?: Record<string, number>
    conversas_recentes?: Array<{
      id: string
      canal: string
      direcao: string
      conteudo: string
      ocorreu_em: string
    }>
    erro?: string
  }
  gerado_em: string
}

const brl = (amount: number, currency = "brl") =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: (currency || "brl").toUpperCase(),
  }).format(amount || 0)

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Container className="flex flex-col gap-1">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Heading level="h2">{value}</Heading>
  </Container>
)

const CockpitPage = () => {
  const [data, setData] = useState<Cockpit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/admin/cockpit", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const c = data?.comercio
  const r = data?.relacionamento

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Cockpit — Visão geral</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Comércio (Medusa) + Relacionamento (Supabase). Somente leitura.
          </Text>
        </div>
        {data?.gerado_em && (
          <Text size="small" className="text-ui-fg-muted">
            Atualizado {new Date(data.gerado_em).toLocaleString("pt-BR")}
          </Text>
        )}
      </div>

      {loading && <Text>Carregando…</Text>}
      {error && <Text className="text-ui-fg-error">Erro: {error}</Text>}

      {data && (
        <>
          {/* COMÉRCIO */}
          <div className="flex flex-col gap-3">
            <Heading level="h2">Comércio</Heading>
            {c?.erro ? (
              <Text className="text-ui-fg-error">{c.erro}</Text>
            ) : (
              <>
                <div className="grid grid-cols-2 small:grid-cols-4 gap-3">
                  <Stat label="Produtos" value={c?.produtos ?? 0} />
                  <Stat label="Clientes" value={c?.clientes ?? 0} />
                  <Stat label="Pedidos" value={c?.pedidos_total ?? 0} />
                  <Stat
                    label="Receita (pedidos recentes)"
                    value={brl(c?.receita_pedidos_recentes ?? 0, c?.moeda)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(c?.pedidos_por_status ?? {}).map(([s, n]) => (
                    <Badge key={s}>
                      {s}: {n}
                    </Badge>
                  ))}
                </div>
                {!!c?.pedidos_recentes?.length && (
                  <Container className="flex flex-col gap-2">
                    <Text weight="plus">Pedidos recentes</Text>
                    {c.pedidos_recentes.map((o) => (
                      <div
                        key={o.display_id}
                        className="flex items-center justify-between border-b border-ui-border-base py-1 text-sm"
                      >
                        <span>
                          #{o.display_id} · {o.email}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge size="2xsmall">{o.status}</Badge>
                          {brl(o.total, o.currency_code)}
                        </span>
                      </div>
                    ))}
                  </Container>
                )}
              </>
            )}
          </div>

          {/* RELACIONAMENTO */}
          <div className="flex flex-col gap-3">
            <Heading level="h2">Relacionamento</Heading>
            {r?.erro ? (
              <Text className="text-ui-fg-error">{r.erro}</Text>
            ) : (
              <>
                <div className="grid grid-cols-2 small:grid-cols-3 gap-3">
                  <Stat label="Leads" value={r?.leads_total ?? 0} />
                  <Stat label="Clientes (relacionamento)" value={r?.clientes_rel ?? 0} />
                  <Stat label="Conversas" value={r?.conversas_total ?? 0} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    Funil:
                  </Text>
                  {Object.entries(r?.funil ?? {}).map(([s, n]) => (
                    <Badge key={s}>
                      {s}: {n}
                    </Badge>
                  ))}
                  {!Object.keys(r?.funil ?? {}).length && (
                    <Text size="small" className="text-ui-fg-muted">
                      sem leads ainda
                    </Text>
                  )}
                </div>
                {!!r?.conversas_recentes?.length && (
                  <Container className="flex flex-col gap-2">
                    <Text weight="plus">Conversas recentes</Text>
                    {r.conversas_recentes.map((cv) => (
                      <div
                        key={cv.id}
                        className="flex items-center justify-between border-b border-ui-border-base py-1 text-sm"
                      >
                        <span className="truncate max-w-[60%]">{cv.conteudo}</span>
                        <span className="flex items-center gap-2">
                          <Badge size="2xsmall">{cv.canal}</Badge>
                          <Badge size="2xsmall">{cv.direcao}</Badge>
                        </span>
                      </div>
                    ))}
                  </Container>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Cockpit",
  icon: ChartBar,
})

export default CockpitPage
