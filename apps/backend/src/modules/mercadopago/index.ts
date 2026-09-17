import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import MercadoPagoProviderService from "./service.js"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MercadoPagoProviderService],
})
