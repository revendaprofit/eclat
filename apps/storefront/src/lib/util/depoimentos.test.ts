import { describe, expect, it } from "vitest"
import { DEPOIMENTOS_VOLTAM_EM, depoimentosVisiveis } from "./depoimentos"

describe("depoimentosVisiveis", () => {
  it("ocultos antes da data, visiveis a partir dela", () => {
    const desde = new Date("2026-10-13T00:00:00-03:00")
    expect(depoimentosVisiveis(new Date("2026-09-13T21:00:00-03:00"), desde)).toBe(false)
    expect(depoimentosVisiveis(new Date("2026-10-12T23:59:59-03:00"), desde)).toBe(false)
    expect(depoimentosVisiveis(new Date("2026-10-13T00:00:00-03:00"), desde)).toBe(true)
    expect(depoimentosVisiveis(new Date("2026-11-01T00:00:00-03:00"), desde)).toBe(true)
  })
  it("data padrao = 30 dias depois de 13/09/2026", () => {
    expect(DEPOIMENTOS_VOLTAM_EM.toISOString()).toBe("2026-10-13T03:00:00.000Z")
  })
})
