// Cria o primeiro usuário admin dos testes e devolve headers autenticados. Só para testes.
// Em 2.15.5 o fluxo público (register → POST /admin/users) responde 401 para o primeiro usuário,
// então o helper cria o usuário pelo módulo USER, a identidade pelo módulo AUTH e assina o JWT
// com o mesmo JWT_SECRET do app (mesmas claims que o middleware `authenticate` lê:
// actor_id, actor_type, auth_identity_id, app_metadata). `api` fica na assinatura só para
// manter o contrato com os specs; não é usado aqui.
import type { AxiosInstance } from "axios"
import type { IAuthModuleService, IUserModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"

export const ADMIN_EMAIL = "admin@eclat.test"

export async function criarAdmin(_api: AxiosInstance, container: MedusaContainer): Promise<{ headers: Record<string, string> }> {
  const userModule = container.resolve<IUserModuleService>(Modules.USER)
  const user = await userModule.createUsers({ email: ADMIN_EMAIL, first_name: "Admin", last_name: "Teste" })
  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH)
  const identity = await authModule.createAuthIdentities({
    provider_identities: [{ provider: "emailpass", entity_id: ADMIN_EMAIL, provider_metadata: {} }],
    app_metadata: { user_id: user.id },
  })
  const token = jwt.sign(
    { actor_id: user.id, actor_type: "user", auth_identity_id: identity.id, app_metadata: { user_id: user.id } },
    process.env.JWT_SECRET as string
  )
  return { headers: { Authorization: `Bearer ${token}` } }
}
