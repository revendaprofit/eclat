// O job é fino: chama verificarAvisosPendentes (provada no teste de integração
// integration-tests/http/aviso-despacho-rota-job.spec.ts). Aqui só o que é dele: agenda, não rodar
// nos testes e nunca deixar exceção escapar.
const mockVerificar = jest.fn()
jest.mock("../../lib/aviso-despacho", () => ({ verificarAvisosPendentes: (...a: unknown[]) => mockVerificar(...a) }))

import freteAvisosPendentesJob, { config } from "../frete-avisos-pendentes"

function containerFalso() {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return { logger, container: { resolve: () => logger } as never }
}

describe("job frete-avisos-pendentes", () => {
  const nodeEnvOriginal = process.env.NODE_ENV
  beforeEach(() => {
    mockVerificar.mockReset()
    process.env.NODE_ENV = "production"
  })
  afterAll(() => {
    process.env.NODE_ENV = nodeEnvOriginal
  })

  it("roda a cada 5 minutos", () => {
    expect(config).toEqual({ name: "frete-avisos-pendentes", schedule: "*/5 * * * *" })
  })

  it("chama a verificação com o container", async () => {
    mockVerificar.mockResolvedValue({ candidatos: 0, porEstado: {}, falhas: 0 })
    const { container } = containerFalso()
    await freteAvisosPendentesJob(container)
    expect(mockVerificar).toHaveBeenCalledTimes(1)
    expect(mockVerificar).toHaveBeenCalledWith(container)
  })

  it("com NODE_ENV=test não roda (o cron dispararia no meio das suítes de integração)", async () => {
    process.env.NODE_ENV = "test"
    await freteAvisosPendentesJob(containerFalso().container)
    expect(mockVerificar).not.toHaveBeenCalled()
  })

  it("exceção da verificação (ex.: o SELECT falhou) vira log de erro só com o tipo, e o job não lança", async () => {
    mockVerificar.mockRejectedValue(Object.assign(new Error("detalhe que não vai para o log"), { name: "KnexTimeoutError" }))
    const { container, logger } = containerFalso()
    await expect(freteAvisosPendentesJob(container)).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(String(logger.error.mock.calls[0][0])).toContain("KnexTimeoutError")
    expect(String(logger.error.mock.calls[0][0])).not.toContain("detalhe")
  })
})
