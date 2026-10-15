/**
 * A2 Correction 2: a role change that adds privilege is decided on the account's credentials as its page showed them.
 *  - A. A promotion decided before the account's password was replaced is refused (`changed`) — with or without a second
 *    factor, through the account's own session or a reset link, and when the change commits while the promotion waits
 *    for the account's row; decided again on the account as it is, it goes through.
 *  - B. Every kind of privilege addition is refused the same way, not only Admin: a permission added at the same rank, a
 *    swap that adds permissions, the Owner role, and additions made by an Admin.
 *  - C. A change that adds nothing (removing roles, Admin → Editor, Owner → Admin) goes through on the older page after a
 *    password change — the account it is meant to contain cannot hold it off — but is still decided on the access the
 *    page showed.
 *  - D. A sign-in's rehash of the same password is not a password change: the promotion goes through.
 *  - Recovery codes issued after the page was shown refuse a promotion too; using one does not.
 * The existing tests of Correction 1 (stale roles, status, second factor, invitation races, Back and refreshed forms) run
 * unchanged in review-races.test.ts and e2e-admin/admin.spec.ts.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, asc, eq } from "drizzle-orm";
import { regenerateRecoveryCodes } from "../../src/server/auth/mfa.ts";
import { changePassword, completePasswordReset } from "../../src/server/auth/passwords.ts";
import { reauthenticate, signIn } from "../../src/server/auth/sign-in.ts";
import { issueToken } from "../../src/server/auth/tokens.ts";
import type { Actor } from "../../src/server/auth/types.ts";
import { getUserDetail, setUserRoles } from "../../src/server/auth/user-admin.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, userMfa, userRoles, users } from "../../src/server/db/schema.ts";
import { createPasswordHasher } from "../../src/server/security/password.ts";
import { actorFor, createUser, meta, setupTestEnv, strongPassword, type TestEnv, type TestUser } from "./helpers.ts";

let env: TestEnv;
before(async () => {
  env = await setupTestEnv("promotion");
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const later = () => env.clock.advance(1000);

const userRow = async (id: string) => (await db().select().from(users).where(eq(users.id, id)))[0];
const rolesNow = async (id: string) =>
  (await db().select({ role: userRoles.roleKey }).from(userRoles).where(eq(userRoles.userId, id)).orderBy(asc(userRoles.roleKey))).map((r) => r.role);

/** The account as its user page shows it to `actor`, fingerprints included: what the page's forms decide on. */
async function pageOf(actor: Actor, userId: string) {
  const detail = await getUserDetail(env.deps, actor, userId);
  assert.ok(detail, "the user page exists");
  return detail;
}

/** What the roles form on that page sends back with its boxes: both fingerprints it was drawn with. */
const rolesForm = (page: { version: string; rolesVersion?: string }) => ({ version: page.version, rolesVersion: page.rolesVersion as string });

async function signedIn(roles: string[], options: { mfa?: boolean } = {}) {
  const user = await createUser(env, { roles, mfa: options.mfa ?? (roles.includes("owner") || roles.includes("admin")) });
  return { user, actor: await actorFor(env, user) };
}

/** The account's password replaced, as its holder would: through its own session, or with a reset link. */
async function replacePassword(user: TestUser, how: "own session" | "reset link") {
  later();
  if (how === "own session") {
    const session = await actorFor(env, user);
    const current = { session: session.session, user: session.user, roles: session.roles };
    const result = await changePassword(env.deps, current, { currentPassword: user.password, newPassword: strongPassword() }, meta("198.51.100.80"));
    assert.equal(result.kind, "ok", "the password was changed");
  } else {
    const { token } = await issueToken(db(), { userId: user.id, purpose: "password_reset", now: env.deps.clock() });
    assert.deepEqual(await completePasswordReset(env.deps, { token, password: strongPassword() }, meta("198.51.100.81")), { kind: "ok" });
  }
  later();
}

async function refusalAudited(targetId: string) {
  const rows = await db()
    .select({ outcome: auditEvents.outcome, summary: auditEvents.summary })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "user.roles_change"), eq(auditEvents.entityId, targetId)));
  return rows.some((row) => row.outcome === "denied" && /changed after the page/.test(row.summary));
}

describe("A. a promotion decided before the account's password was replaced is refused", () => {
  test("Editor → Editor + Admin: refused after the password was replaced, with or without a second factor, by its session or a reset link", async () => {
    const owner = await signedIn(["owner"]);
    for (const mfa of [false, true]) {
      for (const how of ["own session", "reset link"] as const) {
        const { user: editor } = await signedIn(["editor"], { mfa });
        const before = (await userRow(editor.id)).passwordChangedAt;
        // The Owner opens the Editor's page and decides to make them an Admin ...
        const shown = await pageOf(owner.actor, editor.id);
        assert.deepEqual(shown.roles, ["editor"]);
        assert.equal(shown.mfaEnabled, mfa);
        // ... while someone holding the Editor's password (or a reset link) replaces it.
        await replacePassword(editor, how);
        assert.notEqual((await userRow(editor.id)).passwordChangedAt?.getTime(), before?.getTime(), "the password's last change moved");
        const result = await setUserRoles(env.deps, owner.actor, editor.id, ["editor", "admin"], meta(), rolesForm(shown));
        assert.deepEqual(result, { kind: "denied", reason: "changed" }, `2FA ${mfa ? "on" : "off"}, ${how}`);
        assert.deepEqual(await rolesNow(editor.id), ["editor"], "no Admin granted");
        assert.ok(await refusalAudited(editor.id), "the refusal is audited");
        // Reloaded, the page shows the password change; the promotion decided on that goes through (positive control).
        const now = await pageOf(owner.actor, editor.id);
        assert.notEqual(now.rolesVersion, shown.rolesVersion);
        assert.equal(now.version, shown.version, "the access the page shows did not change: only the credentials did");
        assert.equal((await setUserRoles(env.deps, owner.actor, editor.id, ["editor", "admin"], meta(), rolesForm(now))).kind, "ok");
        assert.deepEqual(await rolesNow(editor.id), ["admin", "editor"]);
      }
    }
  });

  test("... decided under the account's row lock: a password change committed while the promotion waits for the row wins", async () => {
    const owner = await signedIn(["owner"]);
    const { user: editor } = await signedIn(["editor"]);
    const shown = await pageOf(owner.actor, editor.id);
    const replaced = await env.deps.hasher.hash(strongPassword());
    const held = await env.pool.getConnection();
    try {
      // A password change, made as every password write is: the account's row first.
      await held.query("START TRANSACTION");
      await held.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [editor.id]);
      await held.query("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?", [replaced, new Date(env.clock.now.getTime() + 5000), editor.id]);
      // Authorised against the account it can still see; its transaction then waits for the account's row.
      const changing = setUserRoles(env.deps, owner.actor, editor.id, ["editor", "admin"], meta(), rolesForm(shown));
      await new Promise((resolve) => setTimeout(resolve, 400));
      await held.query("COMMIT");
      assert.deepEqual(await changing, { kind: "denied", reason: "changed" });
    } finally {
      held.release();
    }
    assert.deepEqual(await rolesNow(editor.id), ["editor"]);
  });

  test("recovery codes issued after the page was shown refuse a promotion; a code used meanwhile does not", async () => {
    const owner = await signedIn(["owner"]);
    const { user: editor, actor: editorActor } = await signedIn(["editor"], { mfa: true });
    const current = { session: editorActor.session, user: editorActor.user, roles: editorActor.roles };
    const first = await regenerateRecoveryCodes(env.deps, current, meta());
    assert.ok(first?.length);
    const shown = await pageOf(owner.actor, editor.id);
    // New codes are issued after the page was shown (whoever holds them can sign in from now on) ...
    later();
    const codes = await regenerateRecoveryCodes(env.deps, current, meta());
    assert.ok(codes?.length);
    assert.deepEqual(await setUserRoles(env.deps, owner.actor, editor.id, ["editor", "admin"], meta(), rolesForm(shown)), { kind: "denied", reason: "changed" });
    assert.deepEqual(await rolesNow(editor.id), ["editor"]);
    // ... while using one is not issuing one: a promotion decided on a page shown before a code was used goes through.
    const fresh = await pageOf(owner.actor, editor.id);
    later();
    assert.equal((await reauthenticate(env.deps, current, { password: editor.password, code: codes[0] }, meta("198.51.100.82"))).kind, "ok");
    assert.equal((await setUserRoles(env.deps, owner.actor, editor.id, ["editor", "admin"], meta(), rolesForm(fresh))).kind, "ok");
    assert.deepEqual(await rolesNow(editor.id), ["admin", "editor"]);
  });
});

describe("B. every kind of privilege addition is refused the same way", () => {
  test("a permission added at the same rank, a swap that adds permissions, the Owner role, and additions made by an Admin", async () => {
    const owner = await signedIn(["owner"]);
    const admin = await signedIn(["admin"]);
    const cases: { actor: Actor; from: string[]; to: string[]; why: string }[] = [
      { actor: owner.actor, from: ["editor"], to: ["editor", "reviewer"], why: "review and publish-after-review added, rank unchanged" },
      { actor: owner.actor, from: ["editor"], to: ["reviewer"], why: "a lower rank, but publish-after-review added" },
      { actor: owner.actor, from: ["reviewer"], to: ["editor"], why: "editing added, a higher rank" },
      { actor: owner.actor, from: ["admin"], to: ["owner"], why: "the Owner role" },
      { actor: owner.actor, from: ["admin", "editor"], to: ["owner", "editor"], why: "the Owner role, kept roles alongside" },
      { actor: admin.actor, from: ["reviewer"], to: ["reviewer", "editor"], why: "an Admin adding Editor" },
      { actor: admin.actor, from: ["editor"], to: ["reviewer"], why: "an Admin swapping Editor for Reviewer" },
    ];
    for (const { actor, from, to, why } of cases) {
      const { user: target } = await signedIn(from);
      const shown = await pageOf(actor, target.id);
      await replacePassword(target, "own session");
      assert.deepEqual(await setUserRoles(env.deps, actor, target.id, to, meta(), rolesForm(shown)), { kind: "denied", reason: "changed" }, why);
      assert.deepEqual(await rolesNow(target.id), [...from].sort(), `${why}: nothing granted`);
      const now = await pageOf(actor, target.id);
      assert.equal((await setUserRoles(env.deps, actor, target.id, to, meta(), rolesForm(now))).kind, "ok", `${why}: decided again`);
      assert.deepEqual(await rolesNow(target.id), [...to].sort());
    }
  });
});

describe("C. a change that adds nothing is not held off by the account's password change", () => {
  test("removing roles, Admin → Editor, Owner → Admin: decided on the older page, by an Owner and by an Admin, they go through", async () => {
    const owner = await signedIn(["owner"]);
    const admin = await signedIn(["admin"]);
    const cases: { actor: Actor; from: string[]; to: string[]; why: string }[] = [
      { actor: owner.actor, from: ["admin", "editor"], to: ["editor"], why: "Admin removed" },
      { actor: owner.actor, from: ["admin"], to: ["editor"], why: "Admin → Editor (a swap that adds nothing)" },
      { actor: owner.actor, from: ["owner"], to: ["admin"], why: "Owner → Admin" },
      { actor: owner.actor, from: ["owner", "admin"], to: ["admin"], why: "Owner removed" },
      { actor: owner.actor, from: ["admin"], to: ["admin", "editor"], why: "Editor added to an Admin (nothing new)" },
      { actor: admin.actor, from: ["editor", "reviewer"], to: ["editor"], why: "an Admin removing Reviewer" },
    ];
    for (const how of ["own session", "reset link"] as const) {
      for (const { actor, from, to, why } of cases) {
        const { user: target } = await signedIn(from);
        const shown = await pageOf(actor, target.id);
        await replacePassword(target, how);
        assert.equal((await setUserRoles(env.deps, actor, target.id, to, meta(), rolesForm(shown))).kind, "ok", `${why} (${how})`);
        assert.deepEqual(await rolesNow(target.id), [...to].sort(), `${why} (${how})`);
      }
    }
  });

  test("... still decided on the access the page showed: a removal is refused once the roles or the second factor changed", async () => {
    const owner = await signedIn(["owner"]);
    const other = await signedIn(["owner"]);
    // The second factor replaced after the page was shown (Correction 1, unchanged).
    const { user: x } = await signedIn(["admin", "editor"]);
    const shown = await pageOf(owner.actor, x.id);
    later();
    await db().update(userMfa).set({ confirmedAt: new Date(env.clock.now) }).where(eq(userMfa.userId, x.id));
    assert.deepEqual(await setUserRoles(env.deps, owner.actor, x.id, ["editor"], meta(), rolesForm(shown)), { kind: "denied", reason: "changed" });
    assert.deepEqual(await rolesNow(x.id), ["admin", "editor"]);
    // A role another Owner changed meanwhile.
    const { user: y } = await signedIn(["editor", "reviewer"]);
    const page = await pageOf(owner.actor, y.id);
    later();
    assert.equal((await setUserRoles(env.deps, other.actor, y.id, ["editor"], meta())).kind, "ok");
    assert.deepEqual(await setUserRoles(env.deps, owner.actor, y.id, ["reviewer"], meta(), rolesForm(page)), { kind: "denied", reason: "changed" });
    assert.deepEqual(await rolesNow(y.id), ["editor"]);
  });
});

describe("D. a sign-in's rehash of the same password is not a password change", () => {
  test("an outdated hash replaced at sign-in leaves the password's last change as it was: the promotion goes through", async () => {
    const owner = await signedIn(["owner"]);
    const user = await createUser(env, { roles: ["editor"], hasher: createPasswordHasher("scrypt") });
    const before = await userRow(user.id);
    assert.match(before.passwordHash ?? "", /^\$scrypt\$/);
    const shown = await pageOf(owner.actor, user.id);
    later();
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta("198.51.100.83"))).kind, "signed_in");
    const rehashed = await userRow(user.id);
    assert.match(rehashed.passwordHash ?? "", /^\$argon2id\$/, "the stored hash was replaced");
    assert.equal(rehashed.passwordChangedAt?.getTime(), before.passwordChangedAt?.getTime(), "the password's last change did not move");
    const now = await pageOf(owner.actor, user.id);
    assert.equal(now.rolesVersion, shown.rolesVersion, "the credentials the page shows are the same");
    assert.equal((await setUserRoles(env.deps, owner.actor, user.id, ["editor", "admin"], meta(), rolesForm(shown))).kind, "ok");
    assert.deepEqual(await rolesNow(user.id), ["admin", "editor"]);
  });
});
