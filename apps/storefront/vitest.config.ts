import path from "node:path"
import { defineConfig } from "vitest/config"

// Só funções puras (src/lib/util). Nada de React, nada de "server-only".
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "src/lib"),
      "@modules": path.resolve(__dirname, "src/modules"),
    },
  },
})
