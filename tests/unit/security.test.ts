/** Security primitives without a database: TOTP (RFC 6238 vectors), client IP, passwords, configuration, audit redaction. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { redactChanges } from "../../src/server/audit/audit.ts";
import { adminBaseUrl, appEnv, ConfigError, mailConfig, readDbConfig, readKeyRing, trustedProxyHops } from "../../src/server/config/env.ts";
import { resolveClientIp } from "../../src/server/security/client-ip.ts";
import { isUlid, looksLikeToken, randomToken, ulid } from "../../src/server/security/ids.ts";
import { checkPassword } from "../../src/server/security/password-policy.ts";
import { createPasswordHasher, dummyHash } from "../../src/server/security/password.ts";
import { base32Decode, base32Encode, hotp, normalizeTotpInput, otpauthUri, verifyTotp } from "../../src/server/security/totp.ts";

describe("TOTP (RFC 4226 / RFC 6238)", () => {
  const secret = Buffer.from("12345678901234567890");
  test("RFC 4226 appendix D: HOTP values for counters 0–9", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => assert.equal(hotp(secret, counter), code));
  });
  test("RFC 6238 appendix B (SHA-1), last 6 digits", () => {
    const vectors: [number, string][] = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
      [20000000000, "353130"],
    ];
    for (const [seconds, code] of vectors) assert.notEqual(verifyTotp(secret, code, seconds * 1000, null), null, `T=${seconds}`);
  });
  test("±1 step accepted, a used step refused, input normalized", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    assert.equal(verifyTotp(secret, hotp(secret, step - 1), now, null), step - 1);
    assert.equal(verifyTotp(secret, hotp(secret, step + 1), now, null), step + 1);
    assert.equal(verifyTotp(secret, hotp(secret, step + 2), now, null), null);
    assert.equal(verifyTotp(secret, hotp(secret, step), now, step), null, "replay of the same step");
    assert.equal(verifyTotp(secret, hotp(secret, step - 1), now, step - 1), null);
    const spaced = hotp(secret, step).replace(/^(\d{3})/, "$1 ");
    assert.equal(normalizeTotpInput(spaced), hotp(secret, step));
    assert.equal(normalizeTotpInput("12345"), null);
    assert.equal(normalizeTotpInput("abcdef"), null);
  });
  test("base32 round trip and the otpauth URI", () => {
    const bytes = Buffer.from("rawasy-totp-secret!!");
    assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
    assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
    assert.equal(
      otpauthUri(Buffer.from("12345678901234567890"), "owner@example.test"),
      "otpauth://totp/RAWASY%20Admin:owner%40example.test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=RAWASY%20Admin&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("client IP (X-Forwarded-For)", () => {
  test("the right-most entry added by the trusted proxies; client-written entries ignored", () => {
    assert.equal(resolveClientIp("203.0.113.9", 0), "203.0.113.9");
    assert.equal(resolveClientIp("1.2.3.4, 203.0.113.9", 1), "203.0.113.9");
    assert.equal(resolveClientIp("6.6.6.6, 1.2.3.4, 203.0.113.9, 10.0.0.2", 2), "203.0.113.9");
    assert.equal(resolveClientIp("203.0.113.9", 2), null, "fewer entries than trusted hops");
    assert.equal(resolveClientIp("garbage, 203.0.113.9", 1), "203.0.113.9");
    assert.equal(resolveClientIp("[2001:DB8::1]:443", 1), "2001:db8::1");
    assert.equal(resolveClientIp("::ffff:198.51.100.7", 1), "198.51.100.7");
    assert.equal(resolveClientIp("203.0.113.9:51234", 1), "203.0.113.9");
    assert.equal(resolveClientIp("not-an-ip", 1), null);
    assert.equal(resolveClientIp(null, 1), null);
    assert.equal(resolveClientIp("", 0), null);
  });

  test("the address is picked by its raw position, then validated: a malformed entry never shifts a client's into place", () => {
    // The proxy that should have written the client's address wrote something else: no address, never the left one.
    assert.equal(resolveClientIp("203.0.113.9, unknown, 10.0.0.2", 2), null);
    assert.equal(resolveClientIp("203.0.113.9,, 10.0.0.2", 2), null);
    assert.equal(resolveClientIp("6.6.6.6, 203.0.113.9, unknown", 1), null);
    assert.equal(resolveClientIp("6.6.6.6, not-an-ip", 0), null);
    // Malformed entries to the left (client-written) do not matter.
    assert.equal(resolveClientIp("garbage,, 6.6.6.6, 203.0.113.9, 10.0.0.2", 2), "203.0.113.9");
  });
});

describe("passwords", () => {
  test("12–128 characters, no composition rules; common, repetitive, sequential and personal passwords refused", () => {
    assert.equal(checkPassword("short"), "too_short");
    assert.equal(checkPassword("x".repeat(129)), "too_long");
    assert.equal(checkPassword("password1234"), "common");
    assert.equal(checkPassword("kkkkjjjjkkkkjjjj"), "repetitive");
    assert.equal(checkPassword("xyzxyzxyzxyzxyz"), "repetitive");
    assert.equal(checkPassword("hijklmnopqrs"), "sequence");
    assert.equal(checkPassword("mnbvcxzlkjhg"), "sequence");
    assert.equal(checkPassword("RawasyMetal2026"), "personal");
    assert.equal(checkPassword("jane.doe-2026!", { email: "jane.doe@example.test" }), "personal");
    assert.equal(checkPassword("velvet tractor marmalade"), null);
    assert.equal(checkPassword("جملة عربية طويلة للمرور"), null, "any characters, Arabic included");
    assert.equal(checkPassword("🔒🔑 long emoji phrase"), null);
  });
  test("Argon2id: self-describing hash, verify, needs-rehash; NFKC equivalence", async () => {
    const argon = createPasswordHasher("argon2id");
    const hash = await argon.hash("velvet tractor marmalade");
    assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.equal(await argon.verify(hash, "velvet tractor marmalade"), true);
    assert.equal(await argon.verify(hash, "velvet tractor marmalad"), false);
    assert.equal(argon.needsRehash(hash), false);
    const weak = hash.replace("m=19456,t=2", "m=4096,t=1");
    assert.equal(argon.needsRehash(weak), true);
    const composed = await argon.hash("café crème brûlée");
    assert.equal(await argon.verify(composed, "café crème brûlée"), true);
  });
  test("scrypt fallback verifies, and each hasher reads the other's hashes", async () => {
    const scrypt = createPasswordHasher("scrypt");
    const argon = createPasswordHasher("argon2id");
    const s = await scrypt.hash("velvet tractor marmalade");
    assert.match(s, /^\$scrypt\$ln=15,r=8,p=1\$/);
    assert.equal(await scrypt.verify(s, "velvet tractor marmalade"), true);
    assert.equal(await argon.verify(s, "velvet tractor marmalade"), true);
    assert.equal(argon.needsRehash(s), true);
    assert.equal(await scrypt.verify("$unknown$x", "anything"), false);
    assert.match(await dummyHash(argon), /^\$argon2id\$/);
  });
});

describe("identifiers and tokens", () => {
  test("ULIDs sort by time; tokens are 256-bit base64url", () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_001);
    assert.ok(isUlid(a) && isUlid(b) && a < b);
    const t = randomToken();
    assert.ok(looksLikeToken(t));
    assert.equal(Buffer.from(t, "base64url").length, 32);
  });
});

describe("configuration", () => {
  test("APP_ENV: production unless said otherwise in a production build", () => {
    assert.equal(appEnv({ NODE_ENV: "production" }), "production");
    assert.equal(appEnv({}), "local");
    assert.equal(appEnv({ APP_ENV: "staging", NODE_ENV: "production" }), "staging");
    assert.throws(() => appEnv({ APP_ENV: "dev" }), ConfigError);
  });
  test("DB_POOL_LIMIT defaults to 2 and is capped at 4; errors never echo values", () => {
    const base = { DB_NAME: "rawasy_x", DB_USER: "u", DB_PASSWORD: "secret-value" };
    assert.equal(readDbConfig(base).poolLimit, 2);
    assert.equal(readDbConfig({ ...base, DB_POOL_LIMIT: "4" }).poolLimit, 4);
    assert.throws(() => readDbConfig({ ...base, DB_POOL_LIMIT: "5" }), ConfigError);
    try {
      readDbConfig({ ...base, DB_PORT: "secret-value" });
      assert.fail("expected a ConfigError");
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      assert.doesNotMatch(error.message, /secret-value/);
    }
    assert.throws(() => readDbConfig({ DB_USER: "u" }), /DB_NAME is not set/);
  });
  test("encryption keys: 32 bytes, versioned, retired versions, no duplicates", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const other = Buffer.alloc(32, 9).toString("base64");
    const ring = readKeyRing({ AUTH_ENCRYPTION_KEY: key, AUTH_ENCRYPTION_KEY_VERSION: "2", AUTH_ENCRYPTION_RETIRED_KEYS: `1:${other}` });
    assert.equal(ring.activeVersion, 2);
    assert.deepEqual([...ring.keys.keys()].sort(), [1, 2]);
    assert.throws(() => readKeyRing({}), /AUTH_ENCRYPTION_KEY is not set/);
    assert.throws(() => readKeyRing({ AUTH_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64"), AUTH_ENCRYPTION_KEY_VERSION: "1" }), /exactly 32 bytes/);
    assert.throws(() => readKeyRing({ AUTH_ENCRYPTION_KEY: key, AUTH_ENCRYPTION_KEY_VERSION: "1", AUTH_ENCRYPTION_RETIRED_KEYS: `1:${other}` }), /repeats/);
    assert.throws(() => readKeyRing({ AUTH_ENCRYPTION_KEY: key }), /AUTH_ENCRYPTION_KEY_VERSION/);
  });
  test("proxy hops, admin URL and mail sink are safe by default", () => {
    assert.equal(trustedProxyHops({}), 0);
    assert.throws(() => trustedProxyHops({ APP_ENV: "production" }), /must be set/);
    assert.equal(trustedProxyHops({ APP_ENV: "production", TRUSTED_PROXY_HOPS: "1" }), 1);
    assert.equal(adminBaseUrl({}), "http://localhost:3000");
    assert.throws(() => adminBaseUrl({ APP_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://example.test" }), /https/);
    assert.equal(adminBaseUrl({ APP_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://www.example.test/x" }), "https://www.example.test");
    assert.equal(mailConfig({}).transport, "disabled");
    assert.throws(() => mailConfig({ APP_ENV: "production", MAIL_TRANSPORT: "sink" }), /only with APP_ENV=local/);
    assert.throws(() => mailConfig({ MAIL_TRANSPORT: "smtp" }), ConfigError);
  });
});

describe("audit redaction", () => {
  test("keys that could hold secrets are dropped from `changes`", () => {
    const out = redactChanges({
      roles: { before: ["editor"], after: ["reviewer"] },
      password: "hunter2",
      newPasswordHash: "$argon2id$…",
      token: "abc",
      totpSecret: "JBSWY3DP",
      recoveryCodes: ["x"],
      apiKey: "k",
      status: { before: "active", after: "disabled" },
    });
    assert.deepEqual(out, { roles: { before: ["editor"], after: ["reviewer"] }, status: { before: "active", after: "disabled" } });
  });
});
