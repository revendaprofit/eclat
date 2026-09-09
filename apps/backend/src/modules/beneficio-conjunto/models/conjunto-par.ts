import { model } from "@medusajs/framework/utils"

// Par de categorias raiz que forma conjunto (spec §4.2). Guardado ordenado (a < b) para unicidade.
const ConjuntoPar = model
  .define("conjunto_par", {
    id: model.id({ prefix: "cpar" }).primaryKey(),
    categoria_a: model.text(),
    categoria_b: model.text(),
    ativo: model.boolean().default(true),
  })
  .indexes([{ on: ["categoria_a", "categoria_b"], unique: true, where: "deleted_at IS NULL" }])

export default ConjuntoPar
