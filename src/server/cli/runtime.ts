/**
 * Shared set-up of the admin command-line tools (scripts/admin-*.mjs): one database connection (pool limit 1, counted
 * in the reserved budget R of A1-DATABASE-SCHEMA §4.2), the same services as the app, an operator label for the audit
 * log, and argument parsing that never takes a password or token.
 */
import { userInfo } from "node:os";
import { readDbConfig } from "../config/env.ts";
import { createAuthDeps, type AuthDeps } from "../auth/deps.ts";
import { createAppPool, describeDbError } from "../db/pool.ts";

export interface CliContext {
  deps: AuthDeps;
  operator: string;
  close: () => Promise<void>;
}

export function cliContext(env: Record<string, string | undefined> = process.env): CliContext {
  const config = readDbConfig(env);
  const pool = createAppPool({ ...config, poolLimit: 1 });
  return { deps: createAuthDeps(pool, env), operator: `cli:${userInfo().username}`, close: () => pool.end() };
}

export type ParsedArgs = Record<string, string | boolean | string[]>;

/**
 * `--flag`, `--name value` and `--name=value`; a name listed in `multi` may repeat. Unknown flags and stray words are
 * errors (so a mistyped option never silently changes what runs).
 */
export function parseArgs(argv: string[], spec: { values: string[]; flags: string[]; multi?: string[] }): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z0-9-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match) throw new Error(`Unexpected argument: ${argv[i]}`);
    const [, name, inline] = match;
    if (spec.flags.includes(name)) {
      if (inline !== undefined) throw new Error(`--${name} takes no value.`);
      out[name] = true;
      continue;
    }
    if (!spec.values.includes(name)) throw new Error(`Unknown option: --${name}`);
    const value = inline ?? argv[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value.`);
    if (spec.multi?.includes(name)) out[name] = [...((out[name] as string[] | undefined) ?? []), value];
    else if (out[name] !== undefined) throw new Error(`--${name} is given twice.`);
    else out[name] = value;
  }
  return out;
}

/** A database error as a code, never its message (which may name the host, user or SQL). */
export const cliDbError = (error: unknown) => `Database error: ${describeDbError(error)}.`;
