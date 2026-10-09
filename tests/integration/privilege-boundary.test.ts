/**
 * A2 Correction 1: an old session token never authenticates, so it can never take on what its successor was given.
 * Every rotation — the second factor (Test A), a step-up (Test B), a password change, 2FA turned on, replaced or off
 * (Test C), the periodic rotation and concurrent rotations (Test D) — leaves the old token refused at the same instant:
 * no grace window, no alias through `replaced_by_id` (kept for the record only).
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, eq, isNull } from "drizzle-orm";
import { beginEnrolment, confirmEnrolment, disableMfa, regenerateRecoveryCodes } from "../../src/server/auth/mfa.ts";
import { changePassword } from "../../src/server/auth/passwords.ts";
import {
  createSession,
  findSessionByToken,
  isRecentlyAuthenticated,
  lookupSession,
  rotateSession,
  SessionEndedError,
  type SessionRow,
} from "../../src/server/auth/sessions.ts";
import { reauthenticate, rotateIfDue, signIn, verifySecondFactor } from "../../src/server/auth/sign-in.ts";
import { dbFor, inTransaction } from "../../src/server/db/client.ts";
import { sessions } from "../../src/server/db/schema.ts";
import { base32Decode, totpCode } from "../../src/server/security/totp.ts";
import { actorFor, codeFor, createUser, meta, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

const MIN = 60_000;
let env: TestEnv;
before(async () => {
  env = await setupTestEnv("boundary");
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const now = () => env.deps.clock();

/** The old token is refused now and at every moment of what used to be a 30-second grace window; the new one works. */
async function assertOnlyNewTokenWorks(oldToken: string, oldSessionId: string, fresh: { token: string; session: SessionRow }) {
  assert.equal(await findSessionByToken(db(), oldToken, now()), null, "the old token is refused at the same instant");
  assert.deepEqual(await lookupSession(db(), oldToken, now()), { kind: "ended" });
  const live = await findSessionByToken(db(), fresh.token, now());
  assert.equal(live?.session.id, fresh.session.id, "the new token works");
  for (const step of [1, 999, 15_000, 14_000]) {
    env.clock.advance(step);
    assert.equal(await findSessionByToken(db(), oldToken, now()), null, `still refused ${step} ms later`);
  }
  const [row] = await db().select().from(sessions).where(eq(sessions.id, oldSessionId));
  assert.ok(row.revokedAt, "the old row is revoked");
  assert.equal(row.revokedReason, "rotated");
  assert.equal(row.replacedById, fresh.session.id, "the lineage is recorded (and never followed)");
}

describe("Test A — the second factor", () => {
  test("the pending password-only token stops working the moment the second factor completes; only the new token is verified", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const first = await signIn(env.deps, { email: user.email, password: user.password }, meta());
    assert.equal(first.kind, "mfa_required");
    if (first.kind !== "mfa_required") return;
    const pending = await findSessionByToken(db(), first.token, now());
    assert.ok(pending, "before the second factor the pending token is a (pending) session");
    assert.equal(pending.session.mfaVerifiedAt, null);
    const done = await verifySecondFactor(env.deps, pending, { code: codeFor(env, user) }, meta());
    assert.equal(done.kind, "signed_in");
    if (done.kind !== "signed_in") return;
    const verified = await findSessionByToken(db(), done.token, now());
    assert.ok(verified?.session.mfaVerifiedAt, "the new session carries the verified second factor");
    await assertOnlyNewTokenWorks(first.token, pending.session.id, done);
  });

  test("a recovery code completes the sign-in the same way: the pending token never inherits it", async () => {
    const user = await createUser(env, { roles: ["owner"], mfa: true });
    const [code] = (await regenerateRecoveryCodes(env.deps, await actorFor(env, user), meta())) ?? [];
    const first = await signIn(env.deps, { email: user.email, password: user.password }, meta());
    assert.equal(first.kind, "mfa_required");
    if (first.kind !== "mfa_required") return;
    const pending = await findSessionByToken(db(), first.token, now());
    assert.ok(pending);
    const done = await verifySecondFactor(env.deps, pending, { recoveryCode: code }, meta());
    assert.equal(done.kind, "signed_in");
    if (done.kind !== "signed_in") return;
    await assertOnlyNewTokenWorks(first.token, pending.session.id, done);
  });
});

describe("Test B — step-up", () => {
  test("a token from before a re-authentication never gains it: it stops working, and only the new token is recent", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const actor = await actorFor(env, user);
    env.clock.advance(11 * MIN);
    assert.equal(isRecentlyAuthenticated(actor.session, now()), false, "the step-up window has passed");
    const result = await reauthenticate(env.deps, actor, { password: user.password, code: codeFor(env, user) }, meta());
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    const fresh = await findSessionByToken(db(), result.token, now());
    assert.ok(fresh && isRecentlyAuthenticated(fresh.session, now()), "the new token satisfies the step-up");
    await assertOnlyNewTokenWorks(actor.token, actor.session.id, result);
  });
});

describe("Test C — other security rotations", () => {
  test("a password change: the old token is refused at once", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    const result = await changePassword(env.deps, actor, { currentPassword: user.password, newPassword: strongPassword() }, meta());
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") await assertOnlyNewTokenWorks(actor.token, actor.session.id, result);
  });

  test("two-factor turned on: the old (password-only) token is refused at once; the new one is verified", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    const begun = await beginEnrolment(env.deps, actor, { password: user.password }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    const code = totpCode(base32Decode(begun.secret), now().getTime());
    const result = await confirmEnrolment(env.deps, actor, { code, pending: begun.pending }, meta());
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.ok(result.session.mfaVerifiedAt);
    await assertOnlyNewTokenWorks(actor.token, actor.session.id, result);
  });

  test("the authenticator replaced: the old token is refused at once", async () => {
    const user = await createUser(env, { roles: ["owner"], mfa: true });
    const actor = await actorFor(env, user);
    const begun = await beginEnrolment(env.deps, actor, { password: user.password, replace: true }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    const code = totpCode(base32Decode(begun.secret), now().getTime());
    const result = await confirmEnrolment(env.deps, actor, { code, pending: begun.pending }, meta());
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.equal(result.replaced, true);
    await assertOnlyNewTokenWorks(actor.token, actor.session.id, result);
  });

  test("two-factor turned off (an optional role): the old token is refused at once", async () => {
    const user = await createUser(env, { roles: ["reviewer"], mfa: true });
    const actor = await actorFor(env, user);
    const result = await disableMfa(env.deps, actor, meta());
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") await assertOnlyNewTokenWorks(actor.token, actor.session.id, result);
  });

  test("the periodic rotation: the old token is refused at once", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    env.clock.advance(30 * MIN);
    const rotated = await rotateIfDue(env.deps, actor.session, meta());
    assert.ok(rotated);
    await assertOnlyNewTokenWorks(actor.token, actor.session.id, rotated);
  });
});

describe("Test D — concurrent periodic rotation", () => {
  test("rotations racing on one session: one successor at most, the old token refused, nothing resurrected", async () => {
    for (let round = 0; round < 5; round++) {
      const user = await createUser(env, { roles: ["editor"] });
      const { token, session } = await createSession(db(), { userId: user.id, now: now(), ip: "203.0.113.5", userAgent: "test", mfaVerified: false });
      env.clock.advance(30 * MIN);
      const results = await Promise.all(Array.from({ length: 4 }, () => rotateIfDue(env.deps, session, meta())));
      const winners = results.filter((r): r is NonNullable<typeof r> => r !== null);
      assert.equal(winners.length, 1, `round ${round}: exactly one rotation wins`);
      const rows = await db().select().from(sessions).where(eq(sessions.userId, user.id));
      assert.equal(rows.length, 2, "the old row and one successor");
      const live = await db()
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
      assert.deepEqual(
        live.map((r) => r.id),
        [winners[0].session.id],
      );
      assert.equal(await findSessionByToken(db(), token, now()), null, "the old token is refused");
      assert.ok(await findSessionByToken(db(), winners[0].token, now()), "the successor works");
      // No resurrection: the old session can never be rotated (or revived) again.
      await assert.rejects(
        inTransaction(env.pool, (tx) => rotateSession(tx, session, { now: now(), ip: null, userAgent: null })),
        SessionEndedError,
      );
      assert.equal(await rotateIfDue(env.deps, session, meta()), null);
      assert.equal((await db().select().from(sessions).where(eq(sessions.userId, user.id))).length, 2, "still one successor");
      assert.equal(await findSessionByToken(db(), token, now()), null);
    }
  });
});
