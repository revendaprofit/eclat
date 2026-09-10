import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Regra nova do eslint-plugin-react-hooks (era do React Compiler). O padrão do Cockpit é
      // `useEffect(() => { carregar() }, [carregar])` com `setLoading(true)` síncrono — intencional
      // e validado em uso. Fica como aviso até adotarmos o React Compiler (30 ocorrências em 2026-09-10).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
