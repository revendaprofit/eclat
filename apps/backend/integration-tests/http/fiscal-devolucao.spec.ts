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

    // Achado I8/5.3: `typeof === "number"` deixava passar NaN e fração — NaN não é pego pelas
    // travas de quantidade (NaN < 1 e NaN > vendida são ambas falsas) e chegava a reais(), que
    // produzia "NaN.NaN"; 1.5 produzia "12.34.5". Com previa:true isso seria transmitido ao
    // fornecedor. As três formas inválidas precisam responder 400 antes de tocar em qualquer coisa.
    it("quantidade NaN responde 400", async () => {
      await expect(
        api.post(
          "/admin/fiscal/emitir-devolucao",
          { order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade: NaN }] },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 400 } })
    })

    it("quantidade fracionária (1.5) responde 400", async () => {
      await expect(
        api.post(
          "/admin/fiscal/emitir-devolucao",
          { order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade: 1.5 }] },
          { headers: admin }
        )
      ).rejects.toMatchObject({ response: { status: 400 } })
    })

    it("quantidade zero responde 400", async () => {
      await expect(
        api.post(
          "/admin/fiscal/emitir-devolucao",
          { order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade: 0 }] },
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

    // Os testes abaixo (Importante 4 e Crítico 1 da revisão de 2026-09-17) precisam de um pedido
    // real no Medusa E de um fiscal_documento de venda VERIFICADO no Supabase — o que exige a
    // migration 0011_fiscal.sql aplicada (mesma limitação já documentada para
    // GET /admin/fiscal/config) mais um fixture de pedido com produto, endereço com CPF/IBGE, e
    // reconciliação já rodada. Ficam escritos e marcados it.skip; destravam aplicando a migration
    // e montando esse fixture (ex.: reaproveitando o seed de testes do Medusa + criarDocumento/
    // criarItens/atualizarDocumento com status "verificado" e verificado_em preenchido).
    describe("lógica de negócio (precisa de pedido real + NF-e de venda verificada)", () => {
      it.skip("previa: true não transmite nem grava documento", async () => {
        // const r = await api.post("/admin/fiscal/emitir-devolucao",
        //   { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_a", quantidade: 1 }], previa: true },
        //   { headers: admin })
        // expect(r.status).toBe(200)
        // expect(r.data.previa).toBeDefined()
        // const doc = await api.get(`/admin/fiscal/documentos?order_id=${orderComVendaVerificada}`, { headers: admin })
        // expect(doc.data.documento.tipo).not.toBe("devolucao") // nenhuma NFD foi gravada
      })

      it.skip("documento_origem_id da NFD aponta para o documento de venda", async () => {
        // const r = await api.post("/admin/fiscal/emitir-devolucao",
        //   { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_a", quantidade: 1 }] },
        //   { headers: admin })
        // expect(r.data.documento.documento_origem_id).toBe(docVendaVerificada.id)
        // expect(r.data.documento.tipo).toBe("devolucao")
      })

      it.skip("emissao_ativa desligada bloqueia a emissão (422) mas não a prévia", async () => {
        // await api.patch("/admin/fiscal/config", { emissao_ativa: false }, { headers: admin })
        // await expect(
        //   api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_a", quantidade: 1 }] }, { headers: admin })
        // ).rejects.toMatchObject({ response: { status: 422, data: { error: expect.stringMatching(/emissao_ativa/i) } } })
      })

      it.skip("mesma requisição de devolução duas vezes: um documento só, sem retransmitir", async () => {
        // const itens = [{ line_item_id: "li_a", quantidade: 1 }]
        // const r1 = await api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens }, { headers: admin })
        // const r2 = await api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens }, { headers: admin })
        // expect(r2.data.documento.id).toBe(r1.data.documento.id) // mesmo digest, mesma chave, devolve o existente
      })

      it.skip("conjuntos diferentes do mesmo pedido geram dois documentos distintos", async () => {
        // const r1 = await api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_a", quantidade: 1 }] }, { headers: admin })
        // const r2 = await api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_b", quantidade: 1 }] }, { headers: admin })
        // expect(r2.data.documento.id).not.toBe(r1.data.documento.id) // digest diferente, chave nova
      })

      it.skip("devolver mais do que o vendido, somando com uma devolução anterior, responde 422 apontando o item", async () => {
        // await api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_a", quantidade: 1 }] }, { headers: admin })
        // // li_a tinha só 1 unidade vendida — pedir mais 1 estoura a soma.
        // await expect(
        //   api.post("/admin/fiscal/emitir-devolucao", { order_id: orderComVendaVerificada, itens: [{ line_item_id: "li_a", quantidade: 1 }] }, { headers: admin })
        // ).rejects.toMatchObject({
        //   response: { status: 422, data: { error: expect.stringMatching(/li_a.*já foram devolvidas/is) } },
        // })
      })
    })
  },
})
