import { describe, expect, it } from "vitest"
import { rotaLiberada } from "./rotas-publicas"

describe("rotas liberadas sem login", () => {
  it("login sempre passa", () => {
    expect(rotaLiberada("/login", "production")).toBe(true)
    expect(rotaLiberada("/login", "development")).toBe(true)
  })

  it("o mostruário só existe em desenvolvimento", () => {
    expect(rotaLiberada("/estilo", "development")).toBe(true)
    expect(rotaLiberada("/estilo", "production")).toBe(false)
  })

  it("nenhuma tela do painel passa sem login, nem em desenvolvimento", () => {
    for (const rota of ["/", "/pedidos", "/financeiro", "/api/dashboard", "/configuracoes"]) {
      expect(rotaLiberada(rota, "development")).toBe(false)
      expect(rotaLiberada(rota, "production")).toBe(false)
    }
  })
})
