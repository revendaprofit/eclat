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

    it("com ação limpar_chave e documento inexistente também responde 422", async () => {
      await expect(
        api.post(
          "/admin/fiscal/resolver",
          { documento_id: "doc_nao_existe", acao: "limpar_chave" },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 422 } })
    })

    // Os testes abaixo (Importante 4 da revisão de 2026-09-17) precisam de um fiscal_documento
    // real no Supabase — o que exige a migration 0011_fiscal.sql aplicada, que este ambiente não
    // tem (mesma limitação já documentada para GET /admin/fiscal/config). Ficam escritos e
    // marcados it.skip: destrava bastando aplicar a migration e trocar o setup abaixo por uma
    // inserção real via fiscal-db (criarDocumento) antes de cada teste.
    describe("lógica de negócio (precisa da migration 0011_fiscal.sql aplicada)", () => {
      // Setup indicativo do que cada teste abaixo assumiria — não roda enquanto a suíte estiver
      // pulada, mas documenta o fixture necessário.
      // const docTransmitidoSemChave = await criarDocumento({
      //   medusa_order_id: "order_x", tipo: "venda", modelo: 55, serie: 1, numero: null,
      //   chave_acesso: null, status: "transmitido_sem_confirmacao", ambiente: "homologacao",
      //   idempotency_key: "order_x:venda:homologacao", payload_enviado: {}, resposta_bruta: null,
      //   rejeicao_codigo: null, rejeicao_motivo: null, xml_url: null, danfe_url: null,
      //   documento_origem_id: null,
      // })

      it.skip("anexar_chave bem-sucedido leva o status a autorizado_nao_verificado, nunca a verificado", async () => {
        // const r = await api.post("/admin/fiscal/resolver",
        //   { documento_id: docTransmitidoSemChave.id, acao: "anexar_chave", chave_acesso: "1".repeat(44) },
        //   { headers: admin })
        // expect(r.status).toBe(200)
        // expect(r.data.documento.status).toBe("autorizado_nao_verificado")
        // expect(r.data.documento.status).not.toBe("verificado")
        // // A reconciliação é quem marca "verificado" — nunca esta rota.
      })

      it.skip("marcar_rejeitado grava rejeicao_codigo MANUAL e o motivo informado", async () => {
        // const r = await api.post("/admin/fiscal/resolver",
        //   { documento_id: docTransmitidoSemChave.id, acao: "marcar_rejeitado", motivo: "cliente desistiu" },
        //   { headers: admin })
        // expect(r.data.documento.status).toBe("rejeitado")
        // expect(r.data.documento.rejeicao_codigo).toBe("MANUAL")
        // expect(r.data.documento.rejeicao_motivo).toBe("cliente desistiu")
      })

      it.skip("a trava recusa um documento já verificado", async () => {
        // (fixture: documento com status "verificado" e verificado_em preenchido)
        // await expect(
        //   api.post("/admin/fiscal/resolver", { documento_id: docVerificado.id, acao: "anexar_chave", chave_acesso: "1".repeat(44) }, { headers: admin })
        // ).rejects.toMatchObject({ response: { status: 422 } })
      })

      it.skip("a trava recusa um documento já rejeitado", async () => {
        // (fixture: documento com status "rejeitado")
        // await expect(
        //   api.post("/admin/fiscal/resolver", { documento_id: docRejeitado.id, acao: "marcar_rejeitado" }, { headers: admin })
        // ).rejects.toMatchObject({ response: { status: 422 } })
      })

      it.skip("limpar_chave devolve o documento a transmitido_sem_confirmacao, e anexar_chave funciona de novo", async () => {
        // await api.post("/admin/fiscal/resolver", { documento_id: docTransmitidoSemChave.id, acao: "anexar_chave", chave_acesso: "1".repeat(44) }, { headers: admin })
        // const limpo = await api.post("/admin/fiscal/resolver", { documento_id: docTransmitidoSemChave.id, acao: "limpar_chave" }, { headers: admin })
        // expect(limpo.data.documento.status).toBe("transmitido_sem_confirmacao")
        // expect(limpo.data.documento.chave_acesso).toBeNull()
        // const reanexado = await api.post("/admin/fiscal/resolver", { documento_id: docTransmitidoSemChave.id, acao: "anexar_chave", chave_acesso: "2".repeat(44) }, { headers: admin })
        // expect(reanexado.status).toBe(200)
      })

      it.skip("limpar_chave recusa documento já verificado (422)", async () => {
        // (fixture: documento com status "verificado" e verificado_em preenchido)
        // await expect(
        //   api.post("/admin/fiscal/resolver", { documento_id: docVerificado.id, acao: "limpar_chave" }, { headers: admin })
        // ).rejects.toMatchObject({ response: { status: 422 } })
      })
    })
  },
})
