// ESLint flat config (ESLint 9). Substitui `next lint` (deprecado no Next 16) e o
// `.eslintrc.json` antigo; as regras vêm de `eslint-config-next` via FlatCompat.
import { FlatCompat } from "@eslint/eslintrc"

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  { ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts", "public/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Arquivos de configuração na raiz são CommonJS por exigência do Next/Tailwind.
  { files: ["*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // Fixtures de teste usam `any` de propósito (objetos parciais da Store API).
  { files: ["**/*.test.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
]

export default config
