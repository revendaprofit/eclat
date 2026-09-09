import { CODIGO_PREFIXO, codigoDaRegra, nUnidadesDaRegra, payloadPromocao, REGRA_EXCLUSAO } from "../utils/promocao"
import type { Curado, Regra } from "../utils/tipos"

const R = (p: Partial<Regra> & Pick<Regra, "id" | "escopo" | "tipo_desconto" | "valor">): Regra =>
  ({ nome: p.id, collection_id: null, ativa: true, promotion_id: null, ...p })

describe("payloadPromocao", () => {
  it("menor_peca_valor 5000 → fixed, valor 50 (centavos → reais)", () => {
    const regra = R({ id: "creg_a", escopo: "padrao", tipo_desconto: "menor_peca_valor", valor: 5000 })
    const p = payloadPromocao(regra, 2)
    expect(p.application_method.type).toBe("fixed")
    expect(p.application_method.value).toBe(50)
  })

  it("total_valor 4500, n=2 → fixed, valor repartido 22.5", () => {
    const regra = R({ id: "creg_b", escopo: "padrao", tipo_desconto: "total_valor", valor: 4500 })
    const p = payloadPromocao(regra, 2)
    expect(p.application_method.type).toBe("fixed")
    expect(p.application_method.value).toBe(22.5)
  })

  it("percentuais (menor_peca_percentual e total_percentual) → percentage com o valor inteiro, sem dividir por 100", () => {
    const regraMenor = R({ id: "creg_c", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20 })
    const pMenor = payloadPromocao(regraMenor, 2)
    expect(pMenor.application_method.type).toBe("percentage")
    expect(pMenor.application_method.value).toBe(20)

    const regraTotal = R({ id: "creg_d", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10 })
    const pTotal = payloadPromocao(regraTotal, 2)
    expect(pTotal.application_method.type).toBe("percentage")
    expect(pTotal.application_method.value).toBe(10)
  })

  it("status reflete ativa/inativa", () => {
    const ativa = R({ id: "creg_e", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10, ativa: true })
    const inativa = R({ id: "creg_f", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10, ativa: false })
    expect(payloadPromocao(ativa, 2).status).toBe("active")
    expect(payloadPromocao(inativa, 2).status).toBe("inactive")
  })

  it("code usa o prefixo CONJUNTO- + id da regra", () => {
    const regra = R({ id: "creg_xyz", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10 })
    expect(payloadPromocao(regra, 2).code).toBe("CONJUNTO-creg_xyz")
    expect(payloadPromocao(regra, 2).code).toBe(`${CODIGO_PREFIXO}creg_xyz`)
    expect(codigoDaRegra("creg_xyz")).toBe("CONJUNTO-creg_xyz")
  })

  it("target_rules aponta para o id da regra via items.conjunto_desconto", () => {
    const regra = R({ id: "creg_g", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10 })
    const p = payloadPromocao(regra, 2)
    expect(p.application_method.target_rules).toEqual([{ attribute: "items.conjunto_desconto", operator: "eq", values: ["creg_g"] }])
  })
})

describe("REGRA_EXCLUSAO", () => {
  it("marca itens sem benefício (nenhum) para excluir a promoção automática", () => {
    expect(REGRA_EXCLUSAO).toEqual({ attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"] })
  })
})

describe("nUnidadesDaRegra", () => {
  it("regra de escopo não-curado → sempre 2", () => {
    const regra = R({ id: "creg_h", escopo: "padrao", tipo_desconto: "total_valor", valor: 100 })
    expect(nUnidadesDaRegra(regra, [])).toBe(2)
  })

  it("regra de escopo curado com 3 produtos → 3", () => {
    const regra = R({ id: "creg_cur", escopo: "curado", tipo_desconto: "total_valor", valor: 100 })
    const curados: Curado[] = [{ id: "ccur_1", nome: "Look", handle: "look", capa_url: null, product_ids: ["p1", "p2", "p3"], regra_id: "creg_cur", ativo: true, ordem: 0 }]
    expect(nUnidadesDaRegra(regra, curados)).toBe(3)
  })

  it("regra curado sem curado correspondente → fallback 2", () => {
    const regra = R({ id: "creg_orfa", escopo: "curado", tipo_desconto: "total_valor", valor: 100 })
    expect(nUnidadesDaRegra(regra, [])).toBe(2)
  })
})
