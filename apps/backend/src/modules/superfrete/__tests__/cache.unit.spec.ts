import { CacheDeCotacao } from "../cache"

describe("CacheDeCotacao", () => {
  it("reaproveita o valor dentro do TTL e refaz depois", async () => {
    let agora = 1000
    const cache = new CacheDeCotacao<number>(600_000, () => agora)
    const produzir = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    expect(await cache.obter("k", produzir)).toBe(1)
    agora += 599_999
    expect(await cache.obter("k", produzir)).toBe(1)
    agora += 2
    expect(await cache.obter("k", produzir)).toBe(2)
    expect(produzir).toHaveBeenCalledTimes(2)
  })

  it("chamadas simultâneas compartilham a mesma promessa", async () => {
    const cache = new CacheDeCotacao<number>(600_000)
    let resolver!: (n: number) => void
    const produzir = jest.fn(() => new Promise<number>((r) => (resolver = r)))
    const a = cache.obter("k", produzir)
    const b = cache.obter("k", produzir)
    resolver(7)
    expect(await Promise.all([a, b])).toEqual([7, 7])
    expect(produzir).toHaveBeenCalledTimes(1)
  })

  it("erro não fica no cache", async () => {
    const cache = new CacheDeCotacao<number>(600_000)
    await expect(cache.obter("k", () => Promise.reject(new Error("caiu")))).rejects.toThrow("caiu")
    expect(await cache.obter("k", () => Promise.resolve(3))).toBe(3)
  })

  it("chaves diferentes não se misturam", async () => {
    const cache = new CacheDeCotacao<number>(600_000)
    expect(await cache.obter("a", () => Promise.resolve(1))).toBe(1)
    expect(await cache.obter("b", () => Promise.resolve(2))).toBe(2)
  })
})
