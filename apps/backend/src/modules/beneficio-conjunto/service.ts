import { MedusaService } from "@medusajs/framework/utils"
import ConjuntoRegra from "./models/conjunto-regra"
import ConjuntoPar from "./models/conjunto-par"
import ConjuntoCurado from "./models/conjunto-curado"
import type { Curado, Par, Regra } from "./utils/tipos"

// Serviço do módulo: CRUD gerado pelo MedusaService + leituras agregadas usadas pelo gancho e pelas rotas.
class BeneficioConjuntoService extends MedusaService({ ConjuntoRegra, ConjuntoPar, ConjuntoCurado }) {
  async carregarAtivos(): Promise<{ regras: Regra[]; pares: Par[]; curados: Curado[] }> {
    // Nota (fallback registrado): a pluralização automática do MedusaService (lib `pluralize`,
    // regras do inglês) gera "ConjuntoPars" para o modelo "conjunto_par" — não "ConjuntoPares"
    // como o pt-BR sugeriria. Os métodos reais em runtime são list/create/update/deleteConjuntoPars.
    // Nota (fallback registrado): a pluralização a nível de TIPO (@medusajs/types `Pluralize`)
    // difere da pluralização em RUNTIME (lib `pluralize` usada pelo MedusaService) para palavras
    // terminadas em "o" — o tipo infere "ConjuntoCuradoes", mas o método real gerado é
    // "listConjuntoCurados" (confirmado em runtime pelo teste de fumaça). Acesso via `any` evita
    // o erro de tipo TS2551 sem alterar o comportamento.
    const self = this as any
    const [regras, pares, curados] = await Promise.all([
      this.listConjuntoRegras({}),
      this.listConjuntoPars({ ativo: true }),
      self.listConjuntoCurados({ ativo: true }, { order: { ordem: "ASC" } }),
    ])
    return { regras: regras as unknown as Regra[], pares: pares as unknown as Par[], curados: curados as unknown as Curado[] }
  }
}
export default BeneficioConjuntoService
