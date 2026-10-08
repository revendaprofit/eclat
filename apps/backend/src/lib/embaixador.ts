import { Modules } from "@medusajs/framework/utils"
import { ehPromocaoEmbaixador } from "../modules/embaixador/regra"

// Quais destes códigos são cupons de embaixador (regra em modules/embaixador/regra.ts). Falha na consulta
// devolve vazio: vale a regra geral (sem soma com o conjunto, presente pela faixa).
export async function codigosDeEmbaixador(container: any, codigos: (string | null | undefined)[]): Promise<Set<string>> {
  const lista = Array.from(new Set(codigos.filter((c): c is string => !!c)))
  if (!lista.length) return new Set()
  try {
    const promocoes: any[] = await container.resolve(Modules.PROMOTION).listPromotions({ code: lista }, { relations: ["campaign"] })
    return new Set(promocoes.filter((p) => p?.status !== "inactive" && ehPromocaoEmbaixador(p)).map((p) => p.code as string))
  } catch (e) {
    console.error("[embaixador] cupons do carrinho", e)
    return new Set()
  }
}
