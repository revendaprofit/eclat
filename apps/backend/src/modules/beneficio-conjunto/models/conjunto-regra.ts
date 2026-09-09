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
  .indexes([
    { on: ["collection_id"], unique: true, where: "escopo = 'colecao' AND deleted_at IS NULL" },
    // Índice único parcial sobre `escopo`: todas as linhas que passam no `where` compartilham o
    // mesmo valor ('padrao'), então o índice único só permite UMA linha 'padrao' ativa por vez
    // (fix round 1 — achado "no DB constraint enforces exactly one padrao rule").
    { on: ["escopo"], unique: true, where: "escopo = 'padrao' AND deleted_at IS NULL" },
  ])

export default ConjuntoRegra
