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

    // O fiscal_config recém-semeado (migration 0011_fiscal.sql) nasce com emissao_ativa=false —
    // o interruptor mestre desligado, de propósito, para a loja continuar despachando enquanto o
    // checkout não coleta CPF (achado N1 da revisão de 2026-09-17). Com o interruptor lido ANTES
    // de montarItensDoPedido, a rota responde 200 com emissao_desligada:true e nem chega a
    // procurar o pedido — mesmo um order_id inexistente não vira erro.
    it("POST /admin/fiscal/emitir com emissao_ativa=false (estado semeado) responde 200 com emissao_desligada", async () => {
      const r = await api.post(
        "/admin/fiscal/emitir",
        { order_id: "order_nao_existe" },
        { headers: admin }
      )
      expect(r.status).toBe(200)
      expect(r.data.emissao_desligada).toBe(true)
    })

    // O caso "pedido inexistente → 422 não encontrado" só é alcançável com emissao_ativa=true —
    // só aí a rota chega a montarItensDoPedido e tenta de fato achar o pedido. Ligar o
    // interruptor exigiria escrever em fiscal_config no Supabase REAL (não há Postgres de teste
    // para essa tabela — as rotas fiscais leem direto o Supabase de produção), o que este arquivo
    // está proibido de fazer. Fica escrito e pulado: destrava ligando emissao_ativa manualmente
    // (ou com um setup dedicado que grave e depois desfaça) antes de rodar.
    it.skip("POST /admin/fiscal/emitir com pedido inexistente e emissao_ativa=true responde 422 com mensagem legível", async () => {
      await expect(
        api.post("/admin/fiscal/emitir", { order_id: "order_nao_existe" }, { headers: admin })
      ).rejects.toMatchObject({
        response: { status: 422, data: { error: expect.stringMatching(/não encontrado/i) } },
      })
    })
  },
})
