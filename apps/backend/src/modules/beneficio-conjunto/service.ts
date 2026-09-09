import { MedusaService } from "@medusajs/framework/utils"
import ConjuntoRegra from "./models/conjunto-regra"
import ConjuntoPar from "./models/conjunto-par"
import ConjuntoCurado from "./models/conjunto-curado"
import type { Curado, Par, Regra } from "./utils/tipos"
import { normalizarPar } from "./utils/pares"

// Serviço do módulo: CRUD gerado pelo MedusaService + leituras agregadas usadas pelo gancho e pelas rotas.
class BeneficioConjuntoService extends MedusaService({ ConjuntoRegra, ConjuntoPar, ConjuntoCurado }) {
  // Regras vêm TODAS (inclusive inativas) — filtrar por `ativa` é responsabilidade de quem chama
  // (ex.: o gancho de cálculo do carrinho), pois algumas leituras administrativas (telas de gestão)
  // precisam enxergar regra inativa também.
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

  // Cria um par de categorias normalizando a ordem (categoria_a < categoria_b) para que a
  // unicidade do índice e o CHECK do modelo (spec §4.2) sempre vejam a mesma representação do
  // par não ordenado, independente da ordem em que o chamador informou as categorias.
  async criarPar(input: { categoria_a: string; categoria_b: string; ativo?: boolean }): Promise<Par> {
    const { categoria_a, categoria_b } = normalizarPar(input.categoria_a, input.categoria_b)
    const par = await this.createConjuntoPars({ categoria_a, categoria_b, ativo: input.ativo })
    return par as unknown as Par
  }
}
export default BeneficioConjuntoService
