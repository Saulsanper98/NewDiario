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
    // Proceso Electron en CommonJS: no aplicar reglas TS del front.
    "electron/**",
  ]),
  {
    rules: {
      /**
       * Next 16 / React Compiler: marca casi cualquier `setState` en `useEffect`,
       * incluidos hidratación, sincronización con `localStorage` y props del servidor.
       * Es ruido masivo frente a patrones correctos; el equipo revisa efectos a mano.
       */
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
