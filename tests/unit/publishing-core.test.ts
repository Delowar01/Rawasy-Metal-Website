/**
 * A8 — the publishing core without a database: every permission key a workflow step needs is a key of the seeded
 * registry (no invented key, no role name), the approval rule (A1 T6: `publish`, or `publish_reviewed` for someone
 * else's submission; legal pages only with `legal.publish`), who may do what by role, the displayed states, the
 * canonical snapshot form (stable, hashed the same whatever the key order), the comparison (repeated items matched by
 * id, moves told apart from edits, languages named), and the audit filters (bounded, the search never in an address).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AGGREGATE_TYPES, AGGREGATES, allowed, canApprove, displayedState, workflowKeys, type WorkflowAction } from "../../src/server/publishing/registry.ts";
import { canonicalJson, sha256 } from "../../src/server/publishing/snapshot.ts";
import { changeLabel, diffSnapshots, displayValue, localesOf } from "../../src/server/publishing/compare.ts";
import { auditAddress, parseAuditQuery } from "../../src/server/audit/viewer.ts";
import { PERMISSION_KEYS, permissionsOf, ROLE_KEYS } from "../../src/server/policy/registry.ts";

const ACTIONS: WorkflowAction[] = ["view", "edit", "submit", "review", "publish", "publish_reviewed", "unpublish", "restore"];

describe("workflow keys come from the seeded registry", () => {
  test("every key of every step of every aggregate exists (normal and legal pages)", () => {
    for (const type of AGGREGATE_TYPES)
      for (const action of ACTIONS)
        for (const facts of [{}, { pageType: "legal" as const }])
          for (const key of workflowKeys(type, action, facts)) assert.ok(PERMISSION_KEYS.has(key), `${type} ${action} ${JSON.stringify(facts)}: ${key}`);
  });

  test("a key never names a role", () => {
    for (const type of AGGREGATE_TYPES) for (const action of ACTIONS) for (const key of workflowKeys(type, action)) for (const role of ROLE_KEYS) assert.ok(!key.split(".").includes(role), key);
  });

  test("legal pages are edited and published with legal.* only", () => {
    assert.deepEqual(workflowKeys("page", "publish", { pageType: "legal" }), ["legal.publish"]);
    assert.deepEqual(workflowKeys("page", "publish_reviewed", { pageType: "legal" }), ["legal.publish"]);
    assert.deepEqual(workflowKeys("page", "edit", { pageType: "legal" }), ["legal.edit"]);
    assert.deepEqual(workflowKeys("page", "publish"), ["pages.publish"]);
  });

  test("menus, settings and forms have no review steps (published directly with <resource>.publish)", () => {
    for (const type of ["menu", "site_settings", "form"] as const) {
      assert.equal(AGGREGATES[type].review, false);
      assert.deepEqual(workflowKeys(type, "review"), [`${AGGREGATES[type].resource}.publish`]);
    }
  });
});

describe("who may do what (the A1 matrix, through the keys)", () => {
  const as = (role: string) => permissionsOf([role]);

  test("a Reviewer edits nothing, reviews, and publishes only someone else's submission", () => {
    const reviewer = as("reviewer");
    assert.equal(allowed(reviewer, "client", "edit"), false);
    assert.equal(allowed(reviewer, "client", "review"), true);
    assert.equal(canApprove(reviewer, "client", {}, "R", "E"), true);
    assert.equal(canApprove(reviewer, "client", {}, "R", "R"), false, "never one's own submission");
    assert.equal(canApprove(reviewer, "client", {}, "R", null), false, "never a version nobody submitted");
    assert.equal(allowed(reviewer, "client", "unpublish"), false);
  });

  test("an Editor submits but never publishes or unpublishes", () => {
    const editor = as("editor");
    assert.equal(allowed(editor, "client", "submit"), true);
    assert.equal(canApprove(editor, "client", {}, "E", "X"), false);
    assert.equal(allowed(editor, "client", "unpublish"), false);
  });

  test("Owner and Admin publish directly; certificates and legal pages follow the registry", () => {
    for (const role of ["owner", "admin"]) assert.equal(canApprove(as(role), "client", {}, "A", "A"), true, role);
    assert.equal(canApprove(as("owner"), "certificate", {}, "O", "O"), true);
    assert.equal(canApprove(as("admin"), "certificate", {}, "A", "E"), allowed(as("admin"), "certificate", "publish") || allowed(as("admin"), "certificate", "publish_reviewed"));
    assert.equal(canApprove(as("reviewer"), "page", { pageType: "legal" }, "R", "E"), allowed(as("reviewer"), "page", "publish", { pageType: "legal" }));
  });
});

describe("displayed states (A1 §2)", () => {
  test("publication × draft", () => {
    assert.equal(displayedState("unpublished", "draft"), "Draft");
    assert.equal(displayedState("unpublished", "in_review"), "In review");
    assert.equal(displayedState("published", "none"), "Published");
    assert.equal(displayedState("published", "draft"), "Published · changes in draft");
    assert.equal(displayedState("published", "in_review"), "Published · changes in review");
    assert.equal(displayedState("archived", "none"), "Archived");
  });
});

describe("the canonical snapshot", () => {
  test("key order never changes the text or the hash; undefined drops, dates are ISO, binary is hex", () => {
    const a = { b: 1, a: { d: [1, { y: 2, x: 1 }], c: "t" }, u: undefined, when: new Date("2026-11-06T09:00:00Z"), bin: Buffer.from([1, 255]) };
    const b = { bin: Buffer.from([1, 255]), when: new Date("2026-11-06T09:00:00Z"), a: { c: "t", d: [1, { x: 1, y: 2 }] }, b: 1 };
    assert.equal(canonicalJson(a), canonicalJson(b));
    assert.equal(canonicalJson(a), '{"a":{"c":"t","d":[1,{"x":1,"y":2}]},"b":1,"bin":"01ff","when":"2026-11-06T09:00:00.000Z"}');
    assert.deepEqual(sha256(canonicalJson(a)), sha256(canonicalJson(b)));
    assert.notDeepEqual(sha256(canonicalJson(a)), sha256(canonicalJson({ ...b, b: 2 })));
  });
});

describe("comparing two versions", () => {
  const before = {
    root: { slug: "test" },
    texts: { en: { title: "Test" }, ar: { title: "تجربة" } },
    children: [
      { id: "c1", en: { label: "One" } },
      { id: "c2", en: { label: "Two" } },
    ],
  };

  test("an edit in one language names that language only", () => {
    const after = { ...before, texts: { en: { title: "Test" }, ar: { title: "تجربة معدلة" } } };
    const changes = diffSnapshots(before, after);
    assert.deepEqual(changes, [{ path: ["texts", "ar", "title"], kind: "changed", before: "تجربة", after: "تجربة معدلة" }]);
    assert.deepEqual(localesOf(changes), ["ar"]);
    assert.equal(changeLabel(changes[0], { before, after }), "Arabic · Title");
  });

  test("repeated items are matched by id: a move is an order change, not two edits; added and removed items are told", () => {
    const moved = { ...before, children: [before.children[1], before.children[0]] };
    assert.deepEqual(diffSnapshots(before, moved), [{ path: ["children", "(order)"], kind: "reordered", before: ["c1", "c2"], after: ["c2", "c1"] }]);
    const edited = { ...before, children: [before.children[0], { id: "c3", en: { label: "Three" } }] };
    const changes = diffSnapshots(before, edited);
    assert.deepEqual(
      changes.map((c) => [c.path.join("/"), c.kind]),
      [
        ["children/#c3", "added"],
        ["children/#c2", "removed"],
      ],
    );
  });

  test("an identical version has no change; a missing side is all added or removed", () => {
    assert.deepEqual(diffSnapshots(before, JSON.parse(JSON.stringify(before))), []);
    assert.ok(diffSnapshots(null, before).every((c) => c.kind === "added"));
  });

  test("values are shown as short text (rich text as its words)", () => {
    assert.equal(displayValue(null), "—");
    assert.equal(displayValue(true), "Yes");
    assert.equal(displayValue({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] }), "Hello");
    assert.equal(displayValue("x".repeat(400)).length, 301);
  });
});

describe("the audit filters", () => {
  test("only known values pass; the rest fall back to no filter", () => {
    const q = parseAuditQuery(
      { outcome: "denied", type: "client", entity: "client:01JA8TESTCL1ENT00000000000", actor: "nope", action: "client.publish", from: "2026-11-01", to: "2026-13-45", page: "2", size: "50" },
      "Test words",
    );
    assert.deepEqual(q, {
      q: "Test words",
      outcome: "denied",
      type: "client",
      entity: { type: "client", id: "01JA8TESTCL1ENT00000000000" },
      actor: "",
      action: "client.publish",
      from: "2026-11-01",
      to: "",
      page: 2,
      size: 50,
    });
    const bad = parseAuditQuery({ outcome: "all", type: "Robert'); DROP", entity: "x:../../etc", action: "a b", page: "-1", size: "1000" }, "");
    assert.deepEqual([bad.outcome, bad.type, bad.entity, bad.action, bad.page, bad.size], ["", "", null, "", 1, 25]);
  });

  test("the search is bounded by code points (an emoji never cut in half) and never written into an address", () => {
    const q = parseAuditQuery({ outcome: "failed" }, `${"😀".repeat(120)}\uD800`);
    assert.equal([...q.q].length, 100);
    assert.ok(q.q.split("").every((ch, i, all) => !/[\uD800-\uDBFF]/.test(ch) || /[\uDC00-\uDFFF]/.test(all[i + 1] ?? "")));
    const address = auditAddress({ ...q, q: "Secret words" }, 3);
    assert.equal(address, "/admin/audit?outcome=failed&page=3");
    assert.ok(!address.includes("Secret"));
  });
});
