import { Module } from "@medusajs/framework/utils"
import BeneficioConjuntoService from "./service"

export const BENEFICIO_CONJUNTO_MODULE = "beneficioConjunto"
export default Module(BENEFICIO_CONJUNTO_MODULE, { service: BeneficioConjuntoService })
