// O Medusa aceita UM handler por hook de workflow; um segundo registro derruba o servidor na subida
// ("Cannot define multiple hook handlers", deploy de 2026-09-30). Este teste carrega todos os arquivos de
// ganchos juntos, como o servidor faz, para o erro aparecer aqui e não no Railway.
import { readdirSync } from "fs"
import { join } from "path"

describe("ganchos de workflow", () => {
  it("todos os arquivos carregam juntos sem hook duplicado", () => {
    const pasta = join(__dirname, "..")
    const arquivos = readdirSync(pasta).filter((f) => f.endsWith(".ts"))
    expect(arquivos.length).toBeGreaterThan(0)
    expect(() => {
      jest.isolateModules(() => {
        for (const f of arquivos) require(join(pasta, f))
      })
    }).not.toThrow()
  })
})
