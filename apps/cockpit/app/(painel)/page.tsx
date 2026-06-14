import ConnectionsPanel from "@/components/connections-panel"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-4xl text-eclat-grafite">Dashboard</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">
          Visão geral da operação. As filas de ação chegam na Fase 6.
        </p>
      </div>

      <ConnectionsPanel />

      <div className="border border-dashed border-eclat-pedra/50 rounded-lg p-6 text-sm text-eclat-grafite/60">
        Shell do Cockpit (Fase 0). As áreas no menu são placeholders — cada uma
        será construída em sua fase (Conversas, Leads, Produtos, etc.).
      </div>
    </div>
  )
}
