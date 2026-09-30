import "server-only"
import { getSiteContent } from "@lib/data/site-content"
import { getRegrasDeFrete } from "@lib/data/frete"
import { lerConfigBoasVindas } from "@lib/util/boas-vindas"
import { lerCondicoes, type Condicoes } from "@lib/util/condicoes"
import type { RegrasDeFrete } from "@lib/util/frete"

export type CondicoesDaLoja = {
  condicoes: Condicoes
  // Cupom de primeira compra: o mesmo do aviso de boas-vindas (site_content "boas_vindas").
  // Desligar o aviso no Cockpit tira o cupom da barra também.
  cupom: { codigo: string; percentual: number } | null
  pisos: RegrasDeFrete | null
}

// Pré-visualização LOCAL: `ECLAT_CONDICOES_PREVIEW='{"sem_juros":true,"pix_percentual":5}'` no .env.local
// mostra as linhas de parcela/Pix antes de ligar no Cockpit. Ignorada em produção (NODE_ENV).
async function condicoesSalvas(): Promise<unknown> {
  const preview = process.env.NODE_ENV !== "production" ? process.env.ECLAT_CONDICOES_PREVIEW : undefined
  if (preview) {
    try {
      return JSON.parse(preview)
    } catch {
      /* JSON inválido: segue com o Cockpit */
    }
  }
  return getSiteContent("condicoes")
}

/** Tudo que a vitrine fala sobre pagamento e frete, lido das fontes de verdade (Cockpit e backend). */
export async function getCondicoesDaLoja(): Promise<CondicoesDaLoja> {
  const [salvo, boasVindas, pisos] = await Promise.all([
    condicoesSalvas(),
    getSiteContent("boas_vindas"),
    getRegrasDeFrete(),
  ])
  const bv = lerConfigBoasVindas(boasVindas)
  return {
    condicoes: lerCondicoes(salvo),
    cupom: bv ? { codigo: bv.cupom, percentual: bv.percentual } : null,
    pisos,
  }
}

export async function getCondicoes(): Promise<Condicoes> {
  return lerCondicoes(await condicoesSalvas())
}
