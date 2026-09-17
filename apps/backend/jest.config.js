const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
  // Workaround para TS2835: sob node16/nodenext, imports dinâmicos relativos exigem extensão
  // .js mesmo apontando para um .ts. O TypeScript entende isso (a extensão é resolvida para o
  // .ts na hora da checagem), mas o Jest resolveria o caminho .js literal e falharia — o mapper
  // devolve a extensão para o resolvedor do Jest achar o módulo de verdade.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
