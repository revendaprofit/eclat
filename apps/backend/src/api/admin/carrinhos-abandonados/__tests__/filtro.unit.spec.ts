import { configDoAmbiente, entraNaLista } from "../filtro"

const MARCO = "2026-09-21T10:30:00.000Z"
const cfg = configDoAmbiente({
  CARRINHOS_ABANDONADOS_DESDE: MARCO,
  CARRINHOS_ABANDONADOS_MANTER: "cart_alana",
  CARRINHOS_ABANDONADOS_IGNORAR: "Dono@Gmail.com, socia@hotmail.com",
} as NodeJS.ProcessEnv)

describe("carrinhos que entram na lista de abandonados", () => {
  it("antes do marco zero não aparece", () => {
    expect(entraNaLista({ id: "cart_velho", created_at: "2026-09-18T12:00:00Z", email: "x@gmail.com" }, cfg)).toBe(false)
  })

  it("a cliente mantida aparece mesmo sendo de antes do marco", () => {
    expect(entraNaLista({ id: "cart_alana", created_at: "2026-09-16T15:38:00Z", email: "alana@gmail.com" }, cfg)).toBe(true)
  })

  it("daqui para frente, carrinho de cliente aparece — com ou sem contato", () => {
    expect(entraNaLista({ id: "c1", created_at: "2026-09-22T09:00:00Z", email: "nova@gmail.com" }, cfg)).toBe(true)
    expect(entraNaLista({ id: "c2", created_at: "2026-09-22T09:00:00Z" }, cfg)).toBe(true)
  })

  it("teste da equipe nunca aparece, nem depois do marco", () => {
    const depois = "2026-09-25T09:00:00Z"
    expect(entraNaLista({ id: "t1", created_at: depois, email: "conferencia@useeclat.com.br" }, cfg)).toBe(false)
    expect(entraNaLista({ id: "t2", created_at: depois, email: "cliente@eclat.local" }, cfg)).toBe(false)
    expect(entraNaLista({ id: "t3", created_at: depois, email: "dono@gmail.com" }, cfg)).toBe(false) // maiúsculas não importam
    expect(entraNaLista({ id: "t4", created_at: depois, customer: { email: "SOCIA@hotmail.com" } }, cfg)).toBe(false)
  })

  it("sem configuração, nada é escondido além dos domínios internos", () => {
    const vazio = configDoAmbiente({} as NodeJS.ProcessEnv)
    expect(entraNaLista({ id: "c", created_at: "2020-01-01T00:00:00Z", email: "a@gmail.com" }, vazio)).toBe(true)
    expect(entraNaLista({ id: "c", created_at: "2020-01-01T00:00:00Z", email: "a@useeclat.com.br" }, vazio)).toBe(false)
  })

  it("data inválida na variável é ignorada, não esconde tudo", () => {
    const ruim = configDoAmbiente({ CARRINHOS_ABANDONADOS_DESDE: "amanhã" } as NodeJS.ProcessEnv)
    expect(ruim.desde).toBeNull()
  })
})
