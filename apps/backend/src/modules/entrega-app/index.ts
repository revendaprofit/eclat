import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import EntregaAppProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [EntregaAppProviderService],
})
