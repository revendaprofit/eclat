import { model } from "@medusajs/framework/utils"
import { ESCOPOS, TIPOS_DESCONTO } from "../utils/tipos"

// Regra de benefício (spec §4.1). Exatamente uma linha `padrao`; `colecao` única por collection_id.
const ConjuntoRegra = model
  .define("conjunto_regra", {
    id: model.id({ prefix: "creg" }).primaryKey(),
    nome: model.text(),
    // model.enum() espera unknown[] | EnumLike; ESCOPOS/TIPOS_DESCONTO são tuplas `readonly` (as const)
    // — espalhar em array mutável evita o erro de tipo TS2345 sem perder a validação em runtime.
    escopo: model.enum([...ESCOPOS]),
    collection_id: model.text().nullable(),
    tipo_desconto: model.enum([...TIPOS_DESCONTO]),
    valor: model.number(), // percentual inteiro (1–100) ou centavos (>= 1)
    ativa: model.boolean().default(true),
    promotion_id: model.text().nullable(),
  })
  .indexes([{ on: ["collection_id"], unique: true, where: "escopo = 'colecao' AND deleted_at IS NULL" }])

export default ConjuntoRegra
