/**
 * RBAC: the seeded matrix equals A1-SECURITY-RBAC §5.3 (written out independently below, row by row), the rank rules,
 * last-Owner protection (including two Owners disabling each other at the same moment), self-protection and audited
 * denials.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { SessionEndedError } from "../../src/server/auth/sessions.ts";
import { setUserRoles, setUserStatus, revokeSessionsOf, unlockUser } from "../../src/server/auth/user-admin.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, permissions, rolePermissions, roles as rolesTable, users } from "../../src/server/db/schema.ts";
import { canGrantRoles, canManageUser } from "../../src/server/policy/rbac.ts";
import { PERMISSIONS, ROLE_PERMISSIONS, SENSITIVE_PERMISSIONS } from "../../src/server/policy/registry.ts";
import { actorFor, createUser, meta, setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
before(async () => {
  env = await setupTestEnv("rbac");
});
after(async () => env?.close());

// A1-SECURITY-RBAC §5.3, transcribed row by row (O, A, E, R). ⚑ defaults as proposed.
const O = "O", A = "A", E = "E", R = "R";
const CONTENT = ["pages", "services", "machines", "projects", "project_categories", "industries", "clients", "orderings", "reusable_sections"];
const expected: Record<string, string[]> = {
  "dashboard.view": [O, A, E, R],
  "content.view": [O, A, E, R],
  "preview.use": [O, A, E, R],
  "users.view": [O, A],
  "users.invite": [O, A],
  "users.edit": [O, A],
  "users.disable": [O, A],
  "users.sessions_revoke": [O, A],
  "users.delete": [O],
  "roles.view": [O, A],
  "roles.manage": [O],
  "security.settings": [O],
  "pages.create_generic": [O, A, E],
  "projects.clear_flags": [O, A],
  "legal.edit": [O, A],
  "legal.publish": [O],
  "certificates.edit": [O, A],
  "certificates.submit": [O, A],
  "certificates.restore": [O, A],
  "certificates.review": [O],
  "certificates.publish": [O],
  "certificates.publish_reviewed": [O],
  "certificates.archive": [O],
  "certificates.delete": [O],
  "private_documents.view": [O],
  "private_documents.upload": [O],
  "private_documents.delete": [O],
  "media.view": [O, A, E, R],
  "media.upload": [O, A, E],
  "media.edit": [O, A, E],
  "media.flag": [O, A, E, R],
  "media.approve": [O, A],
  "media.view_original": [O, A],
  "media.delete": [O, A],
  "purge.any": [O],
  "menus.edit": [O, A],
  "menus.publish": [O, A],
  "settings.edit": [O, A],
  "settings.publish": [O, A],
  "theme.edit": [O],
  "theme.publish": [O],
  "seo.advanced": [O, A],
  "redirects.view": [O, A, E, R],
  "redirects.manage": [O, A],
  "forms.edit": [O, A],
  "forms.publish": [O, A],
  "forms.delivery_mode": [O],
  "enquiries.view": [O, A],
  "enquiries.manage": [O, A],
  "enquiries.export": [O],
  "enquiries.delete": [O],
  "audit.view": [O, A],
  "audit.export": [O],
  "backups.view": [O],
  "backups.run": [O],
  "cache.refresh": [O, A],
  "cache.clear_images": [O],
};
for (const resource of CONTENT) {
  expected[`${resource}.edit`] = [O, A, E];
  expected[`${resource}.submit`] = [O, A, E];
  expected[`${resource}.restore`] = [O, A, E];
  expected[`${resource}.review`] = [O, A, R];
  expected[`${resource}.publish`] = [O, A];
  expected[`${resource}.publish_reviewed`] = [O, A, R];
  expected[`${resource}.archive`] = [O, A];
  expected[`${resource}.delete`] = [O, A];
}
const LETTER: Record<string, string> = { owner: O, admin: A, editor: E, reviewer: R };

describe("the permission matrix", () => {
  test("129 keys, exactly A1 §5.4's", () => {
    assert.equal(PERMISSIONS.length, 129);
    assert.deepEqual(new Set(PERMISSIONS.map((p) => p.key)), new Set(Object.keys(expected)));
  });

  for (const role of ["owner", "admin", "editor", "reviewer"]) {
    test(`${role}: every permission allowed or denied as in A1 §5.3`, () => {
      const granted = new Set(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]);
      for (const [key, holders] of Object.entries(expected)) {
        assert.equal(granted.has(key), holders.includes(LETTER[role]), `${role} × ${key}`);
      }
    });
  }

  test("the database holds exactly the registry (seed migration)", async () => {
    const db = dbFor(env.pool);
    const seededRoles = await db.select().from(rolesTable);
    assert.deepEqual(
      seededRoles.map((r) => [r.key, r.rank, r.isSystem]).sort(),
      [
        ["admin", 80, true],
        ["editor", 40, true],
        ["owner", 100, true],
        ["reviewer", 30, true],
      ],
    );
    const seededPermissions = await db.select().from(permissions);
    assert.deepEqual(
      seededPermissions.map((p) => [p.key, p.isSensitive]).sort(),
      PERMISSIONS.map((p) => [p.key, p.isSensitive]).sort(),
    );
    const matrix = await db.select().from(rolePermissions);
    for (const role of ["owner", "admin", "editor", "reviewer"] as const) {
      assert.deepEqual(
        matrix.filter((m) => m.roleKey === role).map((m) => m.permissionKey).sort(),
        [...ROLE_PERMISSIONS[role]].sort(),
        role,
      );
    }
  });

  test("sensitive permissions (step-up) are those A1 §3.7 lists", () => {
    assert.deepEqual([...SENSITIVE_PERMISSIONS].sort(), [
      "backups.run",
      "cache.clear_images",
      "cache.refresh",
      "enquiries.export",
      "legal.publish",
      "private_documents.view",
      "purge.any",
      "roles.manage",
      "security.settings",
      "theme.publish",
      "users.delete",
      "users.disable",
      "users.edit",
      "users.invite",
      "users.sessions_revoke",
    ]);
  });
});

describe("rank rules", () => {
  const roles = (...r: string[]) => ({ roles: r });
  test("nobody manages an equal or higher rank, except the Owner", () => {
    const cases: [string[], string[], boolean][] = [
      [["owner"], ["owner"], true],
      [["owner"], ["admin"], true],
      [["admin"], ["owner"], false],
      [["admin"], ["admin"], false],
      [["admin"], ["editor"], true],
      [["admin"], ["reviewer"], true],
      [["admin"], ["editor", "admin"], false],
      [["editor"], ["reviewer"], true],
      [["editor"], ["editor"], false],
      [["reviewer"], ["editor"], false],
    ];
    for (const [actor, target, allowed] of cases) assert.equal(canManageUser(roles(...actor), roles(...target)), allowed, `${actor} → ${target}`);
  });

  test("only the Owner grants Admin or Owner", () => {
    assert.equal(canGrantRoles(roles("owner"), ["owner", "admin"]), true);
    assert.equal(canGrantRoles(roles("admin"), ["editor", "reviewer"]), true);
    assert.equal(canGrantRoles(roles("admin"), ["admin"]), false);
    assert.equal(canGrantRoles(roles("admin"), ["owner"]), false);
    assert.equal(canGrantRoles(roles("admin"), ["ghost"]), false);
  });

  test("the services enforce the rules themselves and audit each refusal", async () => {
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const otherAdmin = await createUser(env, { roles: ["admin"], mfa: true });
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const editor = await createUser(env, { roles: ["editor"] });
    const adminActor = await actorFor(env, admin);
    assert.deepEqual(await setUserStatus(env.deps, adminActor, otherAdmin.id, "disabled", meta()), { kind: "denied", reason: "rank" });
    assert.deepEqual(await setUserStatus(env.deps, adminActor, owner.id, "disabled", meta()), { kind: "denied", reason: "rank" });
    assert.deepEqual(await setUserRoles(env.deps, adminActor, editor.id, ["admin"], meta()), { kind: "denied", reason: "owner_only" });
    assert.deepEqual(await setUserStatus(env.deps, adminActor, admin.id, "disabled", meta()), { kind: "denied", reason: "self" });
    assert.deepEqual(await revokeSessionsOf(env.deps, adminActor, owner.id, null, meta()), { kind: "denied", reason: "rank" });
    const editorActor = await actorFor(env, editor);
    assert.deepEqual(await unlockUser(env.deps, editorActor, admin.id, meta()), { kind: "denied", reason: "permission" });
    assert.equal((await setUserRoles(env.deps, adminActor, editor.id, ["reviewer", "editor"], meta())).kind, "ok");
    const denials = await dbFor(env.pool).select().from(auditEvents).where(and(eq(auditEvents.outcome, "denied"), eq(auditEvents.actorUserId, admin.id)));
    assert.equal(denials.length, 5);
    for (const d of denials) assert.match(d.summary, /^Refused: /);
  });
});

describe("last-Owner protection", () => {
  test("the only active Owner cannot be disabled or demoted; with two, one can", async () => {
    const isolated = await setupTestEnv("lastowner");
    try {
      const a = await createUser(isolated, { roles: ["owner"], mfa: true });
      const b = await createUser(isolated, { roles: ["owner"], mfa: true });
      const actorA = await actorFor(isolated, a);
      assert.equal((await setUserStatus(isolated.deps, actorA, b.id, "disabled", meta())).kind, "ok");
      const actorB = await actorFor(isolated, b);
      // B is disabled now; A is the last active Owner. A second Owner (C) cannot remove A.
      const c = await createUser(isolated, { roles: ["owner"], mfa: true });
      const actorC = await actorFor(isolated, c);
      assert.equal((await setUserStatus(isolated.deps, actorC, a.id, "disabled", meta())).kind, "ok");
      // A is disabled and signed out: whatever A's revoked session still asks for is refused (A2 Correction 1, review).
      await assert.rejects(setUserStatus(isolated.deps, actorA, c.id, "disabled", meta()), SessionEndedError);
      await assert.rejects(setUserRoles(isolated.deps, actorA, c.id, ["admin"], meta()), SessionEndedError);
      // Behind that, the last-Owner rule still holds: a session of A that outlived the disable (made here by hand)
      // cannot remove C, the only active Owner.
      const stray = await actorFor(isolated, a);
      assert.deepEqual(await setUserStatus(isolated.deps, stray, c.id, "disabled", meta()), { kind: "last_owner" });
      assert.deepEqual(await setUserRoles(isolated.deps, stray, c.id, ["admin"], meta()), { kind: "last_owner" });
      assert.ok(actorB);
    } finally {
      await isolated.close();
    }
  });

  test("two Owners disabling each other at the same moment: exactly one succeeds", async () => {
    const isolated = await setupTestEnv("ownerrace");
    try {
      let survivor: Awaited<ReturnType<typeof createUser>> | null = null;
      for (let round = 0; round < 5; round++) {
        const a = await createUser(isolated, { roles: ["owner"], mfa: true });
        const b = await createUser(isolated, { roles: ["owner"], mfa: true });
        // Exactly two active Owners before the race: the previous round's survivor steps aside first.
        if (survivor) assert.equal((await setUserStatus(isolated.deps, await actorFor(isolated, a), survivor.id, "disabled", meta())).kind, "ok");
        const [actorA, actorB] = [await actorFor(isolated, a), await actorFor(isolated, b)];
        const [ra, rb] = await Promise.allSettled([
          setUserStatus(isolated.deps, actorA, b.id, "disabled", meta()),
          setUserStatus(isolated.deps, actorB, a.id, "disabled", meta()),
        ]);
        // The first to commit disables the other and signs them out; the other's request then ends with its session
        // (A2 Correction 1, review: it used to reach the last-Owner rule with a revoked session).
        const outcome = (r: PromiseSettledResult<{ kind: string }>) =>
          r.status === "fulfilled" ? r.value.kind : r.reason instanceof SessionEndedError ? "session_ended" : String(r.reason);
        assert.deepEqual([outcome(ra), outcome(rb)].sort(), ["ok", "session_ended"], `round ${round}`);
        survivor = outcome(ra) === "ok" ? a : b;
        const active = await dbFor(isolated.pool).select({ id: users.id }).from(users).where(and(inArray(users.id, [a.id, b.id]), eq(users.status, "active")));
        assert.deepEqual(active.map((u) => u.id), [survivor.id], `round ${round}: exactly one of the two is still active`);
      }
    } finally {
      await isolated.close();
    }
  });
});
