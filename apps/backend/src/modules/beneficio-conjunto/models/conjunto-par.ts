import { model } from "@medusajs/framework/utils"

// Par de categorias raiz que forma conjunto (spec §4.2). Guardado ordenado (a < b) para unicidade
// do par NÃO ordenado — o CHECK abaixo impede a linha espelhada (b, a), e a normalização em
// `service.criarPar` garante que toda escrita pelo serviço já chega ordenada.
const ConjuntoPar = model
  .define("conjunto_par", {
    id: model.id({ prefix: "cpar" }).primaryKey(),
    categoria_a: model.text(),
    categoria_b: model.text(),
    ativo: model.boolean().default(true),
  })
  .indexes([{ on: ["categoria_a", "categoria_b"], unique: true, where: "deleted_at IS NULL" }])
  .checks([
    // fix round 1 — achado "conjunto_par uniqueness doesn't cover the unordered pair": sem isto,
    // nada impede a linha espelhada (categoria_b, categoria_a), que passaria pelo índice único
    // acima (colunas diferentes) mas representaria o mesmo par para a spec §4.2.
    { name: "conjunto_par_ordem", expression: (columns) => `${columns.categoria_a} < ${columns.categoria_b}` },
  ])

export default ConjuntoPar
