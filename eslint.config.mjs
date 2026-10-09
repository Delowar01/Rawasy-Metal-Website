import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SERVER_MODULES = ["@/server", "@/server/**", "**/src/server/**", "../server/**", "../../server/**", "../../../server/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Admin (A2): Drizzle's core query builder only. The relational API (`db.query…`) emits LATERAL joins that MariaDB
  // does not support, and `drizzle()` must never receive a schema or mode (A1-DATABASE-SCHEMA §1). drizzle-kit is a
  // development tool: `generate` only, from drizzle.config.ts (never push or pull).
  {
    files: ["**/*.{ts,tsx,mts,mjs,js}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='query'][object.name=/^(db|tx)$/]",
          message: "Use Drizzle's core query builder (select/insert/update/delete); the relational API is not supported on MariaDB.",
        },
        {
          selector: "MemberExpression[property.name='query'][object.property.name='db']",
          message: "Use Drizzle's core query builder (select/insert/update/delete); the relational API is not supported on MariaDB.",
        },
        {
          selector: "CallExpression[callee.name='drizzle'] > ObjectExpression > Property[key.name=/^(schema|mode)$/]",
          message: "Never pass a schema or mode to drizzle(): it enables the relational API.",
        },
      ],
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "drizzle-kit", message: "drizzle-kit is used only by drizzle.config.ts (generate)." }] },
      ],
    },
  },
  {
    files: ["drizzle.config.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  // Import boundaries (A1-ARCHITECTURE §4): public code never imports the admin's server modules — the proxy included,
  // whose admin branch only sets headers (it never reads sessions). Admin client components import Server Actions only.
  {
    files: ["src/app/(commerce)/**", "src/app/*.{ts,tsx}", "src/components/commerce/**", "src/content/**", "src/lib/**", "src/i18n/**", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "drizzle-kit", message: "drizzle-kit is used only by drizzle.config.ts (generate)." }],
          patterns: [{ group: SERVER_MODULES, message: "Public code must not import the admin's server modules (A1-ARCHITECTURE §4)." }],
        },
      ],
    },
  },
  {
    files: ["src/components/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "drizzle-kit", message: "drizzle-kit is used only by drizzle.config.ts (generate)." }],
          patterns: [
            {
              regex: "^(@/server(?!/admin/actions(/|$))|(\\.\\./)+server/|.*/src/server/)",
              message: "Admin client components import Server Actions (@/server/admin/actions) only, never server modules.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
