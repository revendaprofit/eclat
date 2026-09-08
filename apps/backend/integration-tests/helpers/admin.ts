// Cria o primeiro usuário admin. Tenta o fluxo público do Medusa (register → token → POST /admin/users)
// e devolve os headers autenticados. Só para testes.
//
// FALLBACK (registrado no F0): em 2.15.5 o `POST /admin/users` com o token de registro responde 401
// (o endpoint não aceita mais um ator "não registrado" para criar o primeiro usuário). Nesse caso,
// criamos o usuário via módulo USER, vinculamos a auth identity criada no registro (módulo AUTH) e
// assinamos o JWT manualmente com o mesmo JWT_SECRET do app — conforme o brief previu como fallback pré-aprovado.
import type { AxiosInstance } from "axios"
import type { IAuthModuleService, IUserModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"

export const ADMIN_EMAIL = "admin@eclat.test"
export const ADMIN_SENHA = "senha-teste-123"

export async function criarAdmin(api: AxiosInstance, container: MedusaContainer): Promise<{ headers: Record<string, string> }> {
  const reg = await api.post("/auth/user/emailpass/register", { email: ADMIN_EMAIL, password: ADMIN_SENHA })
  const tokenRegistro = reg.data.token as string

  try {
    await api.post("/admin/users", { email: ADMIN_EMAIL, first_name: "Admin", last_name: "Teste" }, { headers: { Authorization: `Bearer ${tokenRegistro}` } })
    const login = await api.post("/auth/user/emailpass", { email: ADMIN_EMAIL, password: ADMIN_SENHA })
    return { headers: { Authorization: `Bearer ${login.data.token as string}` } }
  } catch {
    const decoded = jwt.decode(tokenRegistro) as { auth_identity_id: string }

    const userModule = container.resolve<IUserModuleService>(Modules.USER)
    const user = await userModule.createUsers({ email: ADMIN_EMAIL, first_name: "Admin", last_name: "Teste" })

    const authModule = container.resolve<IAuthModuleService>(Modules.AUTH)
    await authModule.updateAuthIdentities({ id: decoded.auth_identity_id, app_metadata: { user_id: user.id } })

    const token = jwt.sign(
      { actor_id: user.id, actor_type: "user", auth_identity_id: decoded.auth_identity_id, app_metadata: { user_id: user.id } },
      process.env.JWT_SECRET as string
    )
    return { headers: { Authorization: `Bearer ${token}` } }
  }
}
