import { model } from "@medusajs/framework/utils"

// Conjunto curado pelo admin (spec §4.3). regra_id aponta para uma conjunto_regra de escopo `curado`.
const ConjuntoCurado = model
  .define("conjunto_curado", {
    id: model.id({ prefix: "ccur" }).primaryKey(),
    nome: model.text(),
    handle: model.text(),
    capa_url: model.text().nullable(),
    product_ids: model.array(),
    regra_id: model.text(),
    ativo: model.boolean().default(true),
    ordem: model.number().default(0),
  })
  .indexes([{ on: ["handle"], unique: true, where: "deleted_at IS NULL" }])

export default ConjuntoCurado
