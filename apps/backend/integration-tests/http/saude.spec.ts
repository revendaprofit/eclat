import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("saúde do harness", () => {
      it("GET /health responde 200", async () => {
        const res = await api.get("/health")
        expect(res.status).toBe(200)
      })
      it("admin autenticado lê /admin/users/me", async () => {
        const { headers } = await criarAdmin(api, getContainer())
        const me = await api.get("/admin/users/me", { headers })
        expect(me.status).toBe(200)
        expect(me.data.user.email).toBe("admin@eclat.test")
      })
    })
  },
})
