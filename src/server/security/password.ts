/**
 * Password hashing (A1-SECURITY-RBAC §3.2): Argon2id by default, Node's built-in scrypt as the documented fallback.
 *
 * Stored hashes are self-describing PHC strings ($argon2id$v=19$m=…,t=…,p=…$salt$hash or $scrypt$ln=…,r=…,p=…$salt$hash),
 * so either kind verifies whatever the configured default is, and `needsRehash` reports a hash made with another
 * algorithm or weaker parameters, to be replaced at the next successful sign-in. No pepper (A1 Correction 1).
 *
 * Argon2id comes from @node-rs/argon2 (prebuilt binary; its linux-x64-gnu build needs GLIBC 2.14 at most, checked in
 * A2 against the host's glibc 2.28). It is loaded only when needed, so the scrypt mode never touches the native module.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PasswordHasherKind } from "../config/env.ts";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;

/** OWASP's Argon2id baseline: 19 MiB, 2 passes, 1 lane (A1 §3.2; tune on the host to 250–500 ms before raising). */
export const ARGON2ID = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
/** scrypt fallback: N = 2^15, r = 8, p = 1 (≈ 32 MiB), 32-byte key, 16-byte salt. */
export const SCRYPT = { logN: 15, r: 8, p: 1, keyLength: 32 } as const;

const MAXMEM = 128 * 1024 * 1024;

/** Passwords are compared as NFKC-normalized text, so the same password typed on any keyboard matches (NIST 800-63B). */
export const normalizePassword = (password: string) => password.normalize("NFKC");

export interface PasswordHasher {
  readonly kind: PasswordHasherKind;
  hash(password: string): Promise<string>;
  verify(stored: string, password: string): Promise<boolean>;
  /** True when `stored` was made with another algorithm or weaker parameters than this hasher uses now. */
  needsRehash(stored: string): boolean;
}

type Argon2Module = typeof import("@node-rs/argon2");
let argon2Module: Promise<Argon2Module> | null = null;
const loadArgon2 = () => (argon2Module ??= import("@node-rs/argon2"));

function parseParams(segment: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of (segment ?? "").split(",")) {
    const [key, value] = pair.split("=");
    if (key && value && /^\d+$/.test(value)) out[key] = Number(value);
  }
  return out;
}

async function hashScrypt(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(normalizePassword(password), salt, SCRYPT.keyLength, {
    N: 2 ** SCRYPT.logN,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: MAXMEM,
  });
  const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "");
  return `$scrypt$ln=${SCRYPT.logN},r=${SCRYPT.r},p=${SCRYPT.p}$${b64(salt)}$${b64(key)}`;
}

async function verifyScrypt(stored: string, password: string): Promise<boolean> {
  const parts = stored.split("$");
  // ["", "scrypt", "ln=..,r=..,p=..", salt, hash]
  if (parts.length !== 5) return false;
  const params = parseParams(parts[2]);
  if (!params.ln || !params.r || !params.p || params.ln > 20) return false;
  const salt = Buffer.from(parts[3], "base64");
  const expected = Buffer.from(parts[4], "base64");
  if (salt.length < 8 || expected.length < 16) return false;
  const key = await scrypt(normalizePassword(password), salt, expected.length, {
    N: 2 ** params.ln,
    r: params.r,
    p: params.p,
    maxmem: MAXMEM,
  });
  return timingSafeEqual(key, expected);
}

const algorithmOf = (stored: string) => (stored.startsWith("$argon2id$") ? "argon2id" : stored.startsWith("$scrypt$") ? "scrypt" : null);

export function createPasswordHasher(kind: PasswordHasherKind): PasswordHasher {
  return {
    kind,
    async hash(password) {
      if (kind === "scrypt") return hashScrypt(password);
      const argon2 = await loadArgon2();
      // 2 = Algorithm.Argon2id (a const enum in the typings, which isolatedModules cannot import).
      return argon2.hash(normalizePassword(password), {
        ...ARGON2ID,
        algorithm: 2 as unknown as NonNullable<Parameters<Argon2Module["hash"]>[1]>["algorithm"],
      });
    },
    async verify(stored, password) {
      const algorithm = algorithmOf(stored);
      if (algorithm === "scrypt") return verifyScrypt(stored, password);
      if (algorithm === "argon2id") {
        const argon2 = await loadArgon2();
        try {
          return await argon2.verify(stored, normalizePassword(password));
        } catch {
          return false;
        }
      }
      return false;
    },
    needsRehash(stored) {
      const algorithm = algorithmOf(stored);
      if (algorithm !== kind) return true;
      const params = parseParams(stored.split("$")[algorithm === "argon2id" ? 3 : 2]);
      if (algorithm === "argon2id") {
        return (
          (params.m ?? 0) < ARGON2ID.memoryCost || (params.t ?? 0) < ARGON2ID.timeCost || (params.p ?? 0) < ARGON2ID.parallelism
        );
      }
      return (params.ln ?? 0) < SCRYPT.logN || (params.r ?? 0) < SCRYPT.r || (params.p ?? 0) < SCRYPT.p;
    },
  };
}

/**
 * A hash of a random password, computed once per process: sign-in verifies against it when the account is unknown,
 * disabled or locked, so the response takes about as long as a real check (no account enumeration by timing).
 */
const dummyHashes = new Map<PasswordHasherKind, Promise<string>>();
export function dummyHash(hasher: PasswordHasher): Promise<string> {
  let value = dummyHashes.get(hasher.kind);
  if (!value) {
    value = hasher.hash(randomBytes(24).toString("base64url"));
    dummyHashes.set(hasher.kind, value);
  }
  return value;
}
