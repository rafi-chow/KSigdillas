import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".netlify/**",
    ".next-preview/**",
    ".next-e2e/**",
    ".data/**",
    "playwright-report/**",
    "test-results/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
