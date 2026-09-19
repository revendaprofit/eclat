import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SuperfreteProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [SuperfreteProviderService],
})
