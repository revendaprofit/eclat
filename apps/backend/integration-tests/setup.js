// Exigido pelo jest.config.js (setupFiles). Limpa o registro de metadados do MikroORM entre suítes.
const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")
MetadataStorage.clear()
