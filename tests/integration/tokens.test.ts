/** First-Owner bootstrap, invitations and password reset: single use, expiry, generic answers, revocation, audit. */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { bootstrapOwner, recoveryReset } from "../../src/server/auth/bootstrap.ts";
import { acceptInvitation, inspectInvitation, inviteUser, resendInvitation } from "../../src/server/auth/invitations.ts";
import { completePasswordReset, requestPasswordReset } from "../../src/server/auth/passwords.ts";
import { findSessionByToken } from "../../src/server/auth/sessions.ts";
import { signIn } from "../../src/server/auth/sign-in.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, authTokens, userRoles, users } from "../../src/server/db/schema.ts";
import { sha256 } from "../../src/server/security/ids.ts";
import { actorFor, createUser, linkToken, meta, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
let env: TestEnv;
let mailless: TestEnv;
before(async () => {
  env = await setupTestEnv("tokens");
  mailless = await setupTestEnv("nomail", { mail: "disabled" });
});
after(async () => {
  await env?.close();
  await mailless?.close();
});

const tokenOf = (link: string) => link.slice(link.lastIndexOf("/") + 1);

describe("first-Owner bootstrap", () => {
  test("creates an invited Owner with a 30-minute single-use setup link; refused once an Owner is active", async () => {
    const first = await bootstrapOwner(env.deps, { email: "Founder@Example.test", displayName: "First Owner" }, "cli:test");
    assert.equal(first.kind, "created");
    if (first.kind !== "created") return;
    assert.equal(first.expiresAt.getTime() - env.clock.now.getTime(), 30 * MIN);
    const token = tokenOf(first.link);
    const [stored] = await dbFor(env.pool).select().from(authTokens).where(eq(authTokens.userId, first.userId));
    assert.equal(stored.purpose, "owner_setup");
    assert.deepEqual(stored.tokenHash, sha256(token));
    const [user] = await dbFor(env.pool).select().from(users).where(eq(users.id, first.userId));
    assert.equal(user.email, "Founder@Example.test");
    assert.equal(user.emailNormalized, "founder@example.test");
    assert.equal(user.status, "invited");
    assert.equal(user.passwordHash, null);
    const roles = await dbFor(env.pool).select().from(userRoles).where(eq(userRoles.userId, first.userId));
    assert.deepEqual(
      roles.map((r) => r.roleKey),
      ["owner"],
    );
    // Renewing before activation retires the first link.
    const renewed = await bootstrapOwner(env.deps, { email: "founder@example.test", displayName: "First Owner" }, "cli:test");
    assert.equal(renewed.kind, "renewed");
    if (renewed.kind !== "renewed") return;
    assert.equal(await inspectInvitation(env.deps, token), null);
    const password = strongPassword();
    assert.equal((await acceptInvitation(env.deps, { token: tokenOf(renewed.link), password }, meta())).kind, "ok");
    assert.equal((await acceptInvitation(env.deps, { token: tokenOf(renewed.link), password }, meta())).kind, "invalid");
    assert.equal((await signIn(env.deps, { email: "founder@example.test", password }, meta())).kind, "signed_in");
    assert.deepEqual(await bootstrapOwner(env.deps, { email: "second@example.test", displayName: "Second" }, "cli:test"), { kind: "owner_exists" });
    const audit = await dbFor(env.pool).select().from(auditEvents).where(eq(auditEvents.action, "auth.bootstrap"));
    assert.deepEqual(
      audit.map((a) => [a.actorType, a.outcome]),
      [
        ["cli", "success"],
        ["cli", "success"],
        ["cli", "denied"],
      ],
    );
  });

  test("an expired setup link no longer works", async () => {
    const result = await bootstrapOwner(mailless.deps, { email: "late@example.test", displayName: "Late Owner" }, "cli:test");
    assert.equal(result.kind, "created");
    if (result.kind !== "created") return;
    mailless.clock.advance(30 * MIN);
    assert.equal((await acceptInvitation(mailless.deps, { token: tokenOf(result.link), password: strongPassword() }, meta())).kind, "invalid");
  });

  test("recovery reset: unlocks, signs out everywhere and issues a reset link", async () => {
    const owner = await createUser(env, { roles: ["owner"] });
    const actor = await actorFor(env, owner);
    await dbFor(env.pool).update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + HOUR), failedLoginCount: 9 }).where(eq(users.id, owner.id));
    const result = await recoveryReset(env.deps, { email: owner.email }, "cli:test");
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.equal(result.sessionsRevoked, 1);
    assert.equal(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), null);
    const password = strongPassword();
    assert.deepEqual(await completePasswordReset(env.deps, { token: tokenOf(result.link), password }, meta()), { kind: "ok" });
    assert.equal((await signIn(env.deps, { email: owner.email, password }, meta())).kind, "signed_in");
    assert.deepEqual(await recoveryReset(env.deps, { email: "nobody@example.test" }, "cli:test"), { kind: "not_found" });
  });
});

describe("invitations", () => {
  test("an Admin invites an Editor; the 72-hour link is single use and activates the account", async () => {
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const result = await inviteUser(env.deps, await actorFor(env, admin), { email: "New.Editor@Example.test", displayName: "  New   Editor ", roles: ["editor"] }, meta());
    assert.equal(result.kind, "invited");
    if (result.kind !== "invited") return;
    assert.equal(result.delivered, true);
    assert.equal(result.link, null, "the link is not shown when the email went out");
    const message = env.mail().at(-1);
    assert.equal(message?.to, "New.Editor@Example.test");
    const token = linkToken(message?.text ?? "", "invite");
    const seen = await inspectInvitation(env.deps, token);
    assert.deepEqual(seen, { email: "New.Editor@Example.test", displayName: "New Editor", roles: ["editor"], purpose: "invitation" });
    const [row] = await dbFor(env.pool).select().from(authTokens).where(and(eq(authTokens.userId, result.userId), eq(authTokens.purpose, "invitation")));
    assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 72 * HOUR);
    assert.deepEqual(await acceptInvitation(env.deps, { token, password: "short" }, meta()), { kind: "weak", problem: "too_short" });
    assert.deepEqual(await acceptInvitation(env.deps, { token, password: "password12345" }, meta()), { kind: "weak", problem: "common" });
    const password = strongPassword();
    assert.equal((await acceptInvitation(env.deps, { token, password }, meta())).kind, "ok");
    assert.deepEqual(await acceptInvitation(env.deps, { token, password }, meta()), { kind: "invalid" });
    assert.equal((await signIn(env.deps, { email: "new.editor@example.test", password }, meta())).kind, "signed_in");
  });

  test("an invitation expires after 72 hours; a new link retires the old one", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const actor = await actorFor(env, owner);
    const result = await inviteUser(env.deps, actor, { email: "slow@example.test", displayName: "Slow Reader", roles: ["reviewer"] }, meta());
    assert.equal(result.kind, "invited");
    if (result.kind !== "invited") return;
    const first = linkToken(env.mail().at(-1)?.text ?? "", "invite");
    const again = await resendInvitation(env.deps, actor, result.userId, meta());
    assert.equal(again.kind, "invited");
    const second = linkToken(env.mail().at(-1)?.text ?? "", "invite");
    assert.notEqual(first, second);
    assert.equal(await inspectInvitation(env.deps, first), null);
    env.clock.advance(72 * HOUR);
    assert.equal(await inspectInvitation(env.deps, second), null);
    assert.deepEqual(await acceptInvitation(env.deps, { token: second, password: strongPassword() }, meta()), { kind: "invalid" });
  });

  test("Admins cannot invite Admins or Owners; duplicates are refused", async () => {
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const actor = await actorFor(env, admin);
    assert.deepEqual(await inviteUser(env.deps, actor, { email: "x1@example.test", displayName: "X", roles: ["admin"] }, meta()), { kind: "denied" });
    assert.deepEqual(await inviteUser(env.deps, actor, { email: "x2@example.test", displayName: "X", roles: ["owner"] }, meta()), { kind: "denied" });
    assert.deepEqual(await inviteUser(env.deps, actor, { email: admin.email.toUpperCase(), displayName: "X", roles: ["editor"] }, meta()), { kind: "exists" });
    assert.deepEqual(await inviteUser(env.deps, actor, { email: "x3@example.test", displayName: "X", roles: ["editor", "ghost"] }, meta()), {
      kind: "invalid",
      field: "roles",
    });
    const editor = await createUser(env, { roles: ["editor"] });
    assert.deepEqual(await inviteUser(env.deps, await actorFor(env, editor), { email: "x4@example.test", displayName: "X", roles: ["reviewer"] }, meta()), {
      kind: "denied",
    });
  });

  test("without a mail transport the link is returned to the inviter once and nothing claims delivery", async () => {
    const owner = await createUser(mailless, { roles: ["owner"], mfa: true });
    const result = await inviteUser(mailless.deps, await actorFor(mailless, owner), { email: "manual@example.test", displayName: "Manual", roles: ["editor"] }, meta());
    assert.equal(result.kind, "invited");
    if (result.kind !== "invited") return;
    assert.equal(result.delivered, false);
    assert.match(result.link ?? "", /^http:\/\/localhost:3401\/admin\/invite\/[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(mailless.mail(), []);
  });
});

describe("password reset", () => {
  test("generic answer for any email; a 30-minute single-use link for an active account; every session ends", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    const before = env.mail().length;
    assert.deepEqual(await requestPasswordReset(env.deps, { email: "nobody-here@example.test" }, meta("198.51.100.1")), { mailConfigured: true });
    assert.equal(env.mail().length, before, "no message for an unknown email");
    assert.deepEqual(await requestPasswordReset(env.deps, { email: user.email }, meta("198.51.100.1")), { mailConfigured: true });
    const token = linkToken(env.mail().at(-1)?.text ?? "", "reset");
    const [row] = await dbFor(env.pool).select().from(authTokens).where(and(eq(authTokens.userId, user.id), eq(authTokens.purpose, "password_reset")));
    assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 30 * MIN);
    const password = strongPassword();
    assert.deepEqual(await completePasswordReset(env.deps, { token, password }, meta()), { kind: "ok" });
    assert.deepEqual(await completePasswordReset(env.deps, { token, password: strongPassword() }, meta()), { kind: "invalid" });
    assert.equal(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), null);
    assert.equal((await signIn(env.deps, { email: user.email, password }, meta())).kind, "signed_in");
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta())).kind, "failed");
  });

  test("a reset link expires after 30 minutes", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    await requestPasswordReset(env.deps, { email: user.email }, meta("198.51.100.2"));
    const token = linkToken(env.mail().at(-1)?.text ?? "", "reset");
    env.clock.advance(30 * MIN);
    assert.deepEqual(await completePasswordReset(env.deps, { token, password: strongPassword() }, meta()), { kind: "invalid" });
  });

  test("3 requests per account and 10 per address an hour; the answer stays the same", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const count = () => env.mail().filter((m) => m.to === user.email).length;
    for (let i = 0; i < 4; i++) await requestPasswordReset(env.deps, { email: user.email }, meta(`198.51.100.${10 + i}`));
    assert.equal(count(), 3);
    const other = await createUser(env, { roles: ["editor"] });
    for (let i = 0; i < 10; i++) await requestPasswordReset(env.deps, { email: `filler-${i}@example.test` }, meta("198.51.100.99"));
    assert.deepEqual(await requestPasswordReset(env.deps, { email: other.email }, meta("198.51.100.99")), { mailConfigured: true });
    assert.equal(env.mail().filter((m) => m.to === other.email).length, 0);
    env.clock.advance(HOUR);
    await requestPasswordReset(env.deps, { email: user.email }, meta("198.51.100.20"));
    assert.equal(count(), 4);
  });

  test("without a mail transport no token is created and the page is told so", async () => {
    const user = await createUser(mailless, { roles: ["editor"] });
    assert.deepEqual(await requestPasswordReset(mailless.deps, { email: user.email }, meta()), { mailConfigured: false });
    const tokens = await dbFor(mailless.pool).select().from(authTokens).where(eq(authTokens.userId, user.id));
    assert.equal(tokens.length, 0);
  });
});
