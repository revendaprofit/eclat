import { describe, expect, it, vi } from "vitest"
import { DespachoEmAndamento, executarComTrava } from "./trava-despacho"

describe("executarComTrava", () => {
  it("uma segunda chamada concorrente com a mesma chave é rejeitada IMEDIATAMENTE, sem chamar fn", async () => {
    let liberar: (() => void) | undefined
    const travado = new Promise<void>((r) => (liberar = r))
    const fn1 = vi.fn(async () => {
      await travado
      return "ok1"
    })
    const fn2 = vi.fn(async () => "ok2")

    const p1 = executarComTrava("pedido-1", fn1)
    const p2 = executarComTrava("pedido-1", fn2)

    await expect(p2).rejects.toBeInstanceOf(DespachoEmAndamento)
    await expect(p2).rejects.toThrow(
      "Este pedido já está sendo despachado em outra aba ou por outra pessoa. Aguarde terminar e atualize a página."
    )
    expect(fn2).not.toHaveBeenCalled()

    liberar!()
    await expect(p1).resolves.toBe("ok1")
  })

  it("libera a trava depois do sucesso — a chamada seguinte funciona normalmente", async () => {
    await expect(executarComTrava("pedido-2", async () => "primeira")).resolves.toBe("primeira")
    await expect(executarComTrava("pedido-2", async () => "segunda")).resolves.toBe("segunda")
  })

  it("libera a trava mesmo quando fn lança — a chamada seguinte não fica bloqueada para sempre", async () => {
    await expect(
      executarComTrava("pedido-3", async () => {
        throw new Error("falhou")
      })
    ).rejects.toThrow("falhou")
    await expect(executarComTrava("pedido-3", async () => "depois")).resolves.toBe("depois")
  })

  it("chaves diferentes não bloqueiam uma à outra", async () => {
    let liberar: (() => void) | undefined
    const travado = new Promise<void>((r) => (liberar = r))
    const p1 = executarComTrava("pedido-A", async () => {
      await travado
      return "A"
    })
    const p2 = executarComTrava("pedido-B", async () => "B")

    await expect(p2).resolves.toBe("B")
    liberar!()
    await expect(p1).resolves.toBe("A")
  })
})
