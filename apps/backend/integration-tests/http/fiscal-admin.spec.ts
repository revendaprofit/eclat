// Rotas admin da integração fiscal. Não transmite nada: valida contrato das rotas, a
// autenticação e as recusas explícitas (Invariante 6 — nunca chutar valor tributário).
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(180 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
    })

    it("exige autenticação de admin", async () => {
      await expect(api.get("/admin/fiscal/config")).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it("GET /admin/fiscal/config nunca devolve token, só o booleano credenciais_ok", async () => {
      const r = await api.get("/admin/fiscal/config", { headers: admin })
      expect(r.status).toBe(200)
      expect(typeof r.data.credenciais_ok).toBe("boolean")
      expect(JSON.stringify(r.data)).not.toMatch(/BRASILNFE_|UserToken/)
    })

    it("POST /admin/fiscal/emitir sem order_id responde 400", async () => {
      await expect(api.post("/admin/fiscal/emitir", {}, { headers: admin })).rejects.toMatchObject({
        response: { status: 400 },
      })
    })

    it("POST /admin/fiscal/emitir com pedido inexistente responde 422 com mensagem legível", async () => {
      await expect(
        api.post("/admin/fiscal/emitir", { order_id: "order_nao_existe" }, { headers: admin })
      ).rejects.toMatchObject({
        response: { status: 422, data: { error: expect.stringMatching(/não encontrado/i) } },
      })
    })
  },
})
