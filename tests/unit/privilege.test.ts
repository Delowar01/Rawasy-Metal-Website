/**
 * Which role changes add privilege (A2 Correction 2, `addsPrivilege`), proven over every pair of role sets: a change it
 * judges to add nothing never lets the account do anything it could not do before, under any permission or rank rule,
 * and a change it judges to add privilege always gives the account something it did not have.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addsPrivilege, canGrantRoles, canManageUser, grantableRoles, isOwner } from "../../src/server/policy/rbac.ts";
import { permissionsOf, rankOf, ROLE_KEYS } from "../../src/server/policy/registry.ts";

/** Every set of roles, the empty one included (16 with the four roles). */
const ALL_SETS: string[][] = Array.from({ length: 1 << ROLE_KEYS.length }, (_, mask) => ROLE_KEYS.filter((_, i) => mask & (1 << i)));
const label = (roles: readonly string[]) => (roles.length ? [...roles].sort().join("+") : "(none)");
const principal = (roles: readonly string[]) => ({ roles });

/**
 * Everything a set of roles lets an account do, or shields it from, as distinct facts: each permission; each set of
 * roles it may manage; each role it may grant or remove; each set of roles that may manage it (fewer is more shielded);
 * being an Owner.
 */
function capabilities(roles: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const key of permissionsOf(roles)) out.add(`permission:${key}`);
  for (const other of ALL_SETS) if (canManageUser(principal(roles), principal(other))) out.add(`manages:${label(other)}`);
  for (const key of ROLE_KEYS) if (canGrantRoles(principal(roles), [key])) out.add(`grants:${key}`);
  for (const other of ALL_SETS) if (!canManageUser(principal(other), principal(roles))) out.add(`shielded-from:${label(other)}`);
  if (isOwner(principal(roles))) out.add("owner");
  return out;
}

describe("addsPrivilege (A2 Correction 2)", () => {
  test("a change judged to add nothing never gives the account anything it did not have, over all 256 pairs of role sets", () => {
    let none = 0;
    for (const before of ALL_SETS) {
      const had = capabilities(before);
      for (const after of ALL_SETS) {
        if (addsPrivilege(before, after)) continue;
        none++;
        const gained = [...capabilities(after)].filter((c) => !had.has(c));
        assert.deepEqual(gained, [], `${label(before)} → ${label(after)} gains ${gained.join(", ")}`);
        // The same, stated rule by rule.
        assert.ok(rankOf(after) <= rankOf(before), `${label(before)} → ${label(after)}: rank`);
        assert.ok(!isOwner(principal(after)) || isOwner(principal(before)), `${label(before)} → ${label(after)}: Owner`);
        const grantable = grantableRoles(principal(before), ROLE_KEYS);
        assert.ok(
          grantableRoles(principal(after), ROLE_KEYS).every((key) => grantable.includes(key)),
          `${label(before)} → ${label(after)}: roles it may grant`,
        );
      }
    }
    assert.ok(none > 0);
  });

  test("a change judged to add privilege always gives the account something it did not have (it never refuses a removal)", () => {
    for (const before of ALL_SETS) {
      const had = capabilities(before);
      for (const after of ALL_SETS) {
        if (!addsPrivilege(before, after)) continue;
        const gained = [...capabilities(after)].filter((c) => !had.has(c));
        assert.ok(gained.length > 0, `${label(before)} → ${label(after)} is judged a promotion but gives nothing`);
      }
    }
  });

  test("removing roles never adds privilege; the brief's demotions add none; a swap that adds a permission does", () => {
    for (const before of ALL_SETS) {
      for (const after of ALL_SETS) {
        if (after.every((key) => before.includes(key))) assert.equal(addsPrivilege(before, after), false, `${label(before)} → ${label(after)}`);
      }
    }
    // Demotions of a one-role account are swaps (the form needs one role at least): they add a role key and nothing else.
    for (const [before, after] of [
      [["admin"], ["editor"]],
      [["admin"], ["reviewer"]],
      [["owner"], ["admin"]],
      [["owner"], ["editor"]],
      [["owner", "admin"], ["admin"]],
      [["admin", "editor"], ["editor"]],
      [["editor", "reviewer"], ["editor"]],
      [["editor", "reviewer"], ["reviewer"]],
      [["admin"], ["admin", "editor"]],
      [["owner"], ["owner", "admin", "editor", "reviewer"]],
    ]) {
      assert.equal(addsPrivilege(before, after), false, `${label(before)} → ${label(after)} adds nothing`);
    }
    for (const [before, after] of [
      [["editor"], ["admin"]],
      [["editor"], ["editor", "admin"]],
      [["editor"], ["editor", "reviewer"]],
      [["reviewer"], ["editor"]],
      [["admin"], ["owner"]],
      [["admin", "editor"], ["owner"]],
      [["reviewer"], ["reviewer", "admin"]],
      [[], ["reviewer"]],
    ]) {
      assert.equal(addsPrivilege(before, after), true, `${label(before)} → ${label(after)} adds privilege`);
    }
  });

  test("Editor → Reviewer adds privilege: a Reviewer may review and publish reviewed work, which an Editor may not", () => {
    const added = [...permissionsOf(["reviewer"])].filter((key) => !permissionsOf(["editor"]).has(key)).sort();
    assert.equal(addsPrivilege(["editor"], ["reviewer"]), true);
    assert.equal(added.length, 18);
    assert.ok(added.every((key) => /\.(review|publish_reviewed)$/.test(key)), added.join(", "));
    assert.ok(added.includes("pages.publish_reviewed"));
    // Rank alone would call it a demotion (40 → 30): permissions decide.
    assert.ok(rankOf(["reviewer"]) < rankOf(["editor"]));
  });
});
