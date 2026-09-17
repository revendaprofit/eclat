// Rota de resolução manual de documento fiscal preso em transmitido_sem_confirmacao sem chave
// (Tarefa A do plano 2026-09-16). Não transmite nada: valida contrato, autenticação e recusas
// explícitas (Invariante 6 — nunca chutar valor tributário).
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
      await expect(api.post("/admin/fiscal/resolver", {})).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it("sem documento_id responde 400", async () => {
      await expect(
        api.post("/admin/fiscal/resolver", { acao: "anexar_chave" }, { headers: admin })
      ).rejects.toMatchObject({ response: { status: 400 } })
    })

    it("com ação inválida responde 400", async () => {
      await expect(
        api.post(
          "/admin/fiscal/resolver",
          { documento_id: "doc_qualquer", acao: "fazer_magica" },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 400 } })
    })

    it("com documento inexistente responde 422 com mensagem legível", async () => {
      await expect(
        api.post(
          "/admin/fiscal/resolver",
          { documento_id: "doc_nao_existe", acao: "marcar_rejeitado" },
          { headers: admin }
        )
      ).rejects.toMatchObject({
        response: { status: 422, data: { error: expect.stringMatching(/não encontrado/i) } },
      })
    })

    it("com chave_acesso de 43 dígitos responde 422", async () => {
      await expect(
        api.post(
          "/admin/fiscal/resolver",
          {
            documento_id: "doc_nao_existe",
            acao: "anexar_chave",
            chave_acesso: "1".repeat(43),
          },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 422 } })
    })
  },
})
