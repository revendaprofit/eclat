// Rota de emissão de NF-e de devolução (NFD), capacidade acionada manualmente pelo botão
// "Emitir NFD" do Cockpit (spec §3, §8; Tarefa B2 do plano 2026-09-16). Não transmite nada:
// valida contrato, autenticação e a recusa explícita quando não há nota de venda emitida.
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
      await expect(api.post("/admin/fiscal/emitir-devolucao", {})).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it("sem order_id responde 400", async () => {
      await expect(
        api.post(
          "/admin/fiscal/emitir-devolucao",
          { itens: [{ line_item_id: "li_1", quantidade: 1 }] },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 400 } })
    })

    it("com itens vazio responde 400", async () => {
      await expect(
        api.post(
          "/admin/fiscal/emitir-devolucao",
          { order_id: "order_1", itens: [] },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 400 } })
    })

    it("pedido sem NF-e de venda responde 422 com mensagem legível", async () => {
      await expect(
        api.post(
          "/admin/fiscal/emitir-devolucao",
          { order_id: "order_nao_existe", itens: [{ line_item_id: "li_1", quantidade: 1 }] },
          { headers: admin }
        )
      ).rejects.toMatchObject({
        response: { status: 422, data: { error: expect.stringMatching(/não tem NF-e de venda/i) } },
      })
    })
  },
})
