import { NextResponse } from "next/server"
import { medusaListCustomers } from "@/lib/medusa"
import { aniversarioDe, hojeChave, proximosAniversariantes } from "@/lib/aniversario"

// Programa de aniversário: todas as clientes com data (calendário) + as próximas (hoje e 7 dias) + quantas faltam.
export async function GET() {
  try {
    const customers = await medusaListCustomers()
    const hoje = hojeChave()
    const comData = customers.filter((c) => aniversarioDe(c))
    const comPedidoSemData = customers.filter((c) => !aniversarioDe(c)).length
    return NextResponse.json({
      hoje,
      proximos: proximosAniversariantes(comData, hoje, 7),
      clientes: comData,
      sem_data: comPedidoSemData,
      perguntadas: customers.filter((c) => !aniversarioDe(c) && c.metadata?.aniversario_pedido_em).length,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
