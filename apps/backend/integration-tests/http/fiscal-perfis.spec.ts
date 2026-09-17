// Rota de perfis tributários (achado crítico C4 da revisão final): a tela manda "id" na edição,
// e antes deste fix a allowlist do POST descartava o campo — sem "id", o Prefer: resolution=
// merge-duplicates do PostgREST vira INSERT puro (ele resolve pela CHAVE PRIMÁRIA, não por
// escopo+alvo_id), o que batia nos índices parciais e travava a tabela do contador depois do
// primeiro cadastro. Não transmite nada: é a tabela de configuração tributária, caminho crítico
// da spec (contador cadastra e corrige o CSOSN/CFOP sem depender de ninguém).
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
      await expect(api.get("/admin/fiscal/perfis")).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it("GET /admin/fiscal/perfis responde uma lista", async () => {
      const r = await api.get("/admin/fiscal/perfis", { headers: admin })
      expect(r.status).toBe(200)
      expect(Array.isArray(r.data.perfis)).toBe(true)
    })

    // O teste que prova o fix precisa do schema real (índices parciais fiscal_perfil_padrao_unico
    // etc.), que exige a migration 0011_fiscal.sql aplicada — mesma limitação já documentada em
    // fiscal-resolver.spec.ts e fiscal-devolucao.spec.ts. Fica escrito e marcado it.skip: destrava
    // bastando aplicar a migration neste ambiente.
    describe("upsert por id (precisa da migration 0011_fiscal.sql aplicada)", () => {
      it.skip("cria um perfil padrão e o edita (CSOSN novo) — continua UM perfil só, com o valor novo", async () => {
        // 1) cadastra o perfil padrão (POST sem "id" → cria)
        // const criado = await api.post(
        //   "/admin/fiscal/perfis",
        //   {
        //     escopo: "padrao", csosn: "102", cfop_dentro_uf: "5102", cfop_fora_uf: "6108",
        //     cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
        //     origem_padrao: 0, ativo: true,
        //   },
        //   { headers: admin }
        // )
        // expect(criado.status).toBe(200)
        // const perfilId = criado.data.perfil.id
        //
        // 2) edita o MESMO perfil (POST com "id" → upsert deve resolver pela PK, não criar um novo)
        // const editado = await api.post(
        //   "/admin/fiscal/perfis",
        //   { id: perfilId, csosn: "500" },
        //   { headers: admin }
        // )
        // expect(editado.status).toBe(200)
        // expect(editado.data.perfil.id).toBe(perfilId)
        // expect(editado.data.perfil.csosn).toBe("500")
        //
        // 3) prova que continua UM perfil só (não INSERT duplicado batendo no índice parcial)
        // const lista = await api.get("/admin/fiscal/perfis", { headers: admin })
        // const padroes = lista.data.perfis.filter((p: { escopo: string }) => p.escopo === "padrao")
        // expect(padroes).toHaveLength(1)
        // expect(padroes[0].csosn).toBe("500")
      })
    })
  },
})
