/**
 * drizzle-kit configuration (development only; drizzle-kit is a dev dependency). Use only `npm run db:generate`
 * (drizzle-kit generate): the generated SQL is reviewed and committed, and `scripts/db-migrate.mjs` applies it. Never
 * `drizzle-kit push` or `pull` (they crash on MariaDB's CHECK constraints and bypass review: A1-DATABASE-SCHEMA §1, §10).
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
