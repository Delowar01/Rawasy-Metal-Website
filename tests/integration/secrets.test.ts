/**
 * Nothing secret is stored or logged: after a complete flow (bootstrap, setup, sign-in, 2FA enrolment and challenge,
 * recovery code, password change, reset, invitation), every value of every table and everything written to the console
 * is searched for the passwords, raw tokens, the TOTP secret, the codes used and the recovery codes, in several
 * encodings. (The local mail sink holds the links by design: it exists only with APP_ENV=local.)
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { bootstrapOwner } from "../../src/server/auth/bootstrap.ts";
import { acceptInvitation, inviteUser } from "../../src/server/auth/invitations.ts";
import { beginEnrolment, confirmEnrolment } from "../../src/server/auth/mfa.ts";
import { changePassword, completePasswordReset, requestPasswordReset } from "../../src/server/auth/passwords.ts";
import { findSessionByToken } from "../../src/server/auth/sessions.ts";
import { signIn, signOut, verifySecondFactor } from "../../src/server/auth/sign-in.ts";
import { rolesOf } from "../../src/server/auth/accounts.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { permissionsOf, rankOf } from "../../src/server/policy/registry.ts";
import { base32Decode, totpCode } from "../../src/server/security/totp.ts";
import { linkToken, meta, serverConnection, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

let env: TestEnv;
before(async () => {
  env = await setupTestEnv("secrets");
});
after(async () => env?.close());

test("no password, token, TOTP secret, code or recovery code is stored in clear or written to the console", async () => {
  const secrets: string[] = [];
  const logged: string[] = [];
  const originals = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const name of ["log", "error", "warn", "info"] as const) {
    console[name] = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
  }
  try {
    // Bootstrap and Owner setup.
    const boot = await bootstrapOwner(env.deps, { email: "owner@example.test", displayName: "Owner Person" }, "cli:test");
    assert.equal(boot.kind, "created");
    if (boot.kind !== "created") return;
    const setupToken = boot.link.slice(boot.link.lastIndexOf("/") + 1);
    const ownerPassword = strongPassword();
    secrets.push(setupToken, ownerPassword);
    assert.equal((await acceptInvitation(env.deps, { token: setupToken, password: ownerPassword }, meta())).kind, "ok");

    // First sign-in (2FA required for the Owner) and enrolment.
    const first = await signIn(env.deps, { email: "owner@example.test", password: ownerPassword }, meta());
    assert.ok(first.kind === "signed_in" && first.enrolmentRequired);
    if (first.kind !== "signed_in") return;
    secrets.push(first.token);
    const roles = await rolesOf(dbFor(env.pool), first.user.id);
    const current = { session: first.session, user: first.user, roles, permissions: permissionsOf(roles), rank: rankOf(roles) };
    const begun = await beginEnrolment(env.deps, current, { password: ownerPassword }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    const secret = base32Decode(begun.secret);
    secrets.push(begun.secret, secret.toString("hex"), secret.toString("base64"), secret.toString("latin1"));
    const enrolCode = totpCode(secret, env.deps.clock().getTime());
    const confirmed = await confirmEnrolment(env.deps, current, { code: enrolCode }, meta());
    assert.equal(confirmed.kind, "ok");
    if (confirmed.kind !== "ok") return;
    secrets.push(confirmed.token, ...confirmed.recoveryCodes, ...confirmed.recoveryCodes.map((c) => c.replace("-", "")));

    // Sign out; sign in with TOTP; then with a recovery code.
    await signOut(env.deps, { ...current, session: confirmed.session }, meta());
    env.clock.advance(30_000);
    const second = await signIn(env.deps, { email: "owner@example.test", password: ownerPassword }, meta());
    assert.equal(second.kind, "mfa_required");
    if (second.kind !== "mfa_required") return;
    secrets.push(second.token);
    const pending = await findSessionByToken(dbFor(env.pool), second.token, env.deps.clock());
    assert.ok(pending);
    const code = totpCode(secret, env.deps.clock().getTime());
    const done = await verifySecondFactor(env.deps, pending, { code }, meta());
    assert.equal(done.kind, "signed_in");
    if (done.kind !== "signed_in") return;
    secrets.push(done.token);
    const third = await signIn(env.deps, { email: "owner@example.test", password: ownerPassword }, meta());
    if (third.kind !== "mfa_required") return assert.fail(third.kind);
    secrets.push(third.token);
    const pending3 = await findSessionByToken(dbFor(env.pool), third.token, env.deps.clock());
    assert.ok(pending3);
    assert.equal((await verifySecondFactor(env.deps, pending3, { recoveryCode: confirmed.recoveryCodes[0] }, meta())).kind, "signed_in");

    // Password change, then a reset by email.
    const newPassword = strongPassword();
    secrets.push(newPassword);
    const changed = await changePassword(env.deps, { ...current, session: done.session }, { currentPassword: ownerPassword, newPassword }, meta());
    assert.equal(changed.kind, "ok");
    await requestPasswordReset(env.deps, { email: "owner@example.test" }, meta());
    const resetToken = linkToken(env.mail().at(-1)?.text ?? "", "reset");
    const resetPassword = strongPassword();
    secrets.push(resetToken, resetPassword);
    assert.equal((await completePasswordReset(env.deps, { token: resetToken, password: resetPassword }, meta())).kind, "ok");

    // An invitation, accepted.
    const owner = { ...current, session: changed.kind === "ok" ? changed.session : done.session };
    const invited = await inviteUser(env.deps, owner, { email: "editor@example.test", displayName: "Editor Person", roles: ["editor"] }, meta());
    assert.equal(invited.kind, "invited");
    const inviteToken = linkToken(env.mail().at(-1)?.text ?? "", "invite");
    const editorPassword = strongPassword();
    secrets.push(inviteToken, editorPassword);
    assert.equal((await acceptInvitation(env.deps, { token: inviteToken, password: editorPassword }, meta())).kind, "ok");
    secrets.push(code, enrolCode);
  } finally {
    Object.assign(console, originals);
  }

  // Every value of every table, as text, hex, base64 and latin1.
  const connection = await serverConnection(env.database);
  const [tables] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
  const haystack: string[] = [];
  for (const { t } of tables) {
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${String(t).replace(/`/g, "")}\``);
    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (value === null || value === undefined) continue;
        if (Buffer.isBuffer(value)) haystack.push(value.toString("hex"), value.toString("base64"), value.toString("latin1"));
        else haystack.push(typeof value === "object" ? JSON.stringify(value) : String(value));
      }
    }
  }
  await connection.end();
  const stored = haystack.join("\n");
  const console_ = logged.join("\n");
  const sixDigit = (s: string) => /^\d{6}$/.test(s);
  for (const secret of secrets) {
    if (sixDigit(secret)) {
      // A 6-digit code could appear by chance inside long hex or numbers; look for it as a whole value only.
      assert.ok(!haystack.includes(secret), "a TOTP code is stored");
      assert.ok(!console_.includes(secret), "a TOTP code was logged");
      continue;
    }
    assert.ok(!stored.includes(secret), `a secret of length ${secret.length} is stored in clear`);
    assert.ok(!console_.includes(secret), `a secret of length ${secret.length} was written to the console`);
  }
  assert.ok(secrets.length >= 25);
});
