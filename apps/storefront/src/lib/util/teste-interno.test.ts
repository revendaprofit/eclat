import { describe, it, expect, beforeEach } from "vitest"
import { ehPedidoDeTeste, SCRIPT_MARCADOR_TESTE } from "./teste-interno"

describe("ehPedidoDeTeste", () => {
  it("pedido marcado pelo navegador de teste", () => {
    expect(ehPedidoDeTeste({ metadata: { eclat_teste: "1" }, items: [] })).toBe(true)
  })

  it("pedido com o produto oculto de teste", () => {
    expect(ehPedidoDeTeste({ items: [{ product_handle: "teste-interno" }] })).toBe(true)
    expect(ehPedidoDeTeste({ items: [{ product: { handle: "teste-interno" } }] })).toBe(true)
  })

  it("pedido de cliente segue medido", () => {
    expect(ehPedidoDeTeste({ metadata: { cpf: "x", meta_fbp: "fb.1" }, items: [{ product_handle: "top-aurora" }] })).toBe(false)
    expect(ehPedidoDeTeste(null)).toBe(false)
  })
})

describe("SCRIPT_MARCADOR_TESTE", () => {
  // Simula o navegador: cookie como string acumulada, sem expiração real.
  let jar: Record<string, string>
  const rodar = (search: string) => {
    const w: Record<string, unknown> = {}
    const doc = {
      get cookie() {
        return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ")
      },
      set cookie(v: string) {
        const [par, ...attrs] = v.split(";")
        const [k, val] = par.split("=")
        if (attrs.some((a) => a.trim() === "max-age=0")) delete jar[k]
        else jar[k] = val
      },
    }
    new Function("window", "document", "location", SCRIPT_MARCADOR_TESTE)(w, doc, { search })
    return w.__eclatTeste
  }
  beforeEach(() => {
    jar = { eclat_consent: "granted" }
  })

  it("?eclat_teste=1 liga e o cookie mantém ligado nas próximas páginas", () => {
    expect(rodar("?eclat_teste=1")).toBe(true)
    expect(rodar("")).toBe(true)
  })

  it("?eclat_teste=0 desliga", () => {
    rodar("?eclat_teste=1")
    expect(rodar("?eclat_teste=0")).toBe(false)
    expect(rodar("")).toBe(false)
  })

  it("sem marcador, navegador normal", () => {
    expect(rodar("?utm_source=ig")).toBe(false)
  })
})
