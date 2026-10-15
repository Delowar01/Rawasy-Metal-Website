/**
 * Core CMS (A3) — who may do what, decided from the permission registry (never from role names): every content action
 * of every type for each role, record-level rules (legal pages, fixed pages, certificates, advanced SEO), and the
 * direction of safety changes — adding a flag never lowers a restriction, and only Owner and Admin can clear one,
 * checked over every subset of flags.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { can, canCreateAnyPage, isFixedPage, requiredPermissions, type ContentAction } from "../../src/server/cms/permissions.ts";
import { ENTITY_TYPES, isBlockingFlag, PROJECT_FLAG_KEYS, type EntityType, type PageType } from "../../src/server/cms/registry.ts";
import { decideFlagChange, flagToken, isAtLeastAsRestrictive, restrictionLevel } from "../../src/server/cms/restrictions.ts";
import { permissionsOf } from "../../src/server/policy/registry.ts";

const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
const perms = Object.fromEntries(ROLES.map((r) => [r, permissionsOf([r])])) as unknown as Record<(typeof ROLES)[number], ReadonlySet<string>>;

/** The expected outcome per role (O A E R), written out from A1-SECURITY-RBAC §5.3 independently of the code. */
const yes = (...roles: string[]) => (role: string) => roles.includes(role);

const GENERAL: EntityType[] = ["service", "machine", "project", "project_category", "industry", "client"];

describe("content permissions by role (the registry decides)", () => {
  test("view: every role", () => {
    for (const type of ENTITY_TYPES) for (const role of ROLES) assert.equal(can(perms[role], type, "view"), true, `${role} ${type}`);
  });

  test("general content: Owner, Admin and Editor create and edit; Owner and Admin archive; Reviewer reviews only", () => {
    for (const type of GENERAL) {
      for (const role of ROLES) {
        assert.equal(can(perms[role], type, "create"), yes("owner", "admin", "editor")(role), `${role} create ${type}`);
        assert.equal(can(perms[role], type, "edit"), yes("owner", "admin", "editor")(role), `${role} edit ${type}`);
        assert.equal(can(perms[role], type, "archive"), yes("owner", "admin")(role), `${role} archive ${type}`);
      }
    }
  });

  test("certificates: edited by Owner and Admin, archived by the Owner only", () => {
    for (const role of ROLES) {
      assert.equal(can(perms[role], "certificate", "edit"), yes("owner", "admin")(role), role);
      assert.equal(can(perms[role], "certificate", "create"), yes("owner", "admin")(role), role);
      assert.equal(can(perms[role], "certificate", "archive"), yes("owner")(role), role);
    }
  });

  test("pages: generic by Owner, Admin, Editor; fixed pages registered by Owner and Admin; legal pages under legal.edit", () => {
    const cases: [PageType, ContentAction, (r: string) => boolean][] = [
      ["generic", "create", yes("owner", "admin", "editor")],
      ["generic", "edit", yes("owner", "admin", "editor")],
      ["system", "create", yes("owner", "admin")],
      ["home", "create", yes("owner", "admin")],
      ["template", "create", yes("owner", "admin")],
      ["system", "edit", yes("owner", "admin", "editor")],
      ["legal", "create", yes("owner", "admin")],
      ["legal", "edit", yes("owner", "admin")],
    ];
    for (const [pageType, action, expected] of cases) {
      for (const role of ROLES) assert.equal(can(perms[role], "page", action, { pageType }), expected(role), `${role} ${action} ${pageType}`);
    }
    assert.deepEqual(requiredPermissions("page", "edit", { pageType: "legal" }), ["legal.edit"]);
    assert.deepEqual(requiredPermissions("page", "create", { pageType: "system" }), ["pages.edit", "pages.archive"]);
    assert.equal(canCreateAnyPage(perms.reviewer), false);
    assert.equal(canCreateAnyPage(perms.editor), true);
  });

  test("order: everyone who edits general content (orderings.edit), never a Reviewer", () => {
    for (const type of ENTITY_TYPES) for (const role of ROLES) assert.equal(can(perms[role], type, "reorder"), yes("owner", "admin", "editor")(role), `${role} ${type}`);
  });

  test("robots, canonical and sitemap: Owner and Admin (seo.advanced)", () => {
    for (const role of ROLES) assert.equal(can(perms[role], "page", "seo_advanced"), yes("owner", "admin")(role), role);
  });

  test("fixed pages are every type but generic", () => {
    assert.deepEqual((["home", "system", "legal", "generic", "template"] as const).map(isFixedPage), [true, true, true, false, true]);
  });

  test("an empty or unrelated permission set may do nothing but what it holds", () => {
    for (const type of ENTITY_TYPES) for (const action of ["view", "create", "edit", "archive", "reorder"] as const) assert.equal(can(new Set(), type, action), false);
    assert.equal(can(new Set(["services.edit"]), "project", "edit"), false);
  });
});

describe("the direction of safety changes", () => {
  test("every role may add a known flag; only Owner and Admin may clear one, and only with a reason", () => {
    for (const role of ROLES) {
      for (const flag of PROJECT_FLAG_KEYS) {
        assert.deepEqual(decideFlagChange(perms[role], "add", flag), { ok: true }, `${role} add ${flag}`);
        const clear = decideFlagChange(perms[role], "clear", flag, "Confirmed with the owner.");
        assert.deepEqual(clear, role === "owner" || role === "admin" ? { ok: true } : { ok: false, reason: "permission" }, `${role} clear ${flag}`);
      }
      assert.deepEqual(decideFlagChange(perms[role], "add", "approved_for_public"), { ok: false, reason: "unknown_flag" });
    }
    assert.deepEqual(decideFlagChange(perms.owner, "clear", "hidden", ""), { ok: false, reason: "note_required" });
    assert.deepEqual(decideFlagChange(perms.owner, "clear", "hidden", "  x "), { ok: false, reason: "note_required" });
    assert.deepEqual(decideFlagChange(perms.owner, "clear", "unknown_future_flag", "Reason given."), { ok: true }, "an unknown flag can still be cleared");
  });

  test("blocking: every flag but ai_watermark; a flag the code does not know blocks", () => {
    for (const flag of PROJECT_FLAG_KEYS) assert.equal(isBlockingFlag(flag), flag !== "ai_watermark", flag);
    assert.equal(isBlockingFlag("from_a_newer_release"), true);
    assert.equal(restrictionLevel([]), "clear");
    assert.equal(restrictionLevel(["ai_watermark"]), "flagged");
    assert.equal(restrictionLevel(["ai_watermark", "hidden"]), "blocked");
  });

  test("over every subset of flags, adding one never makes a project less restricted, and removing one never adds", () => {
    const keys = PROJECT_FLAG_KEYS;
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const set = keys.filter((_, i) => mask & (1 << i));
      for (const flag of keys) {
        if (set.includes(flag)) {
          const after = set.filter((f) => f !== flag);
          assert.equal(isAtLeastAsRestrictive(set, after), false, `clearing ${flag} from ${set.join(",")} is a loosening`);
        } else {
          assert.equal(isAtLeastAsRestrictive(set, [...set, flag]), true, `adding ${flag} to ${set.join(",")}`);
        }
      }
    }
  });

  test("a flag's token names the instance (the time it was added), so a newer one has another token", () => {
    assert.equal(flagToken(new Date(1_000)), "1000");
    assert.notEqual(flagToken(new Date(1_000)), flagToken(new Date(1_001)));
  });
});
