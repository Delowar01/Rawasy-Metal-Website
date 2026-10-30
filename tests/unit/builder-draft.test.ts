/**
 * Unsaved builder work kept in the tab (A5 final correction; `src/components/admin/builder/draft.ts`): one user's copy
 * of one record, keyed by both, read back only by them and only while fresh (12 hours, the absolute session limit);
 * other users' and expired copies purged, every copy cleared on sign-out; a copy holds the editor's content only (no
 * server model, no address, never a credential) and goes back onto a layout only when every section it names is there.
 * The session limits themselves are unchanged (2 hours idle, 12 hours absolute), and nothing in the editors polls.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  clearDrafts,
  DRAFT_PREFIX,
  DRAFT_TTL_MS,
  draftKey,
  keepLayout,
  parseDraft,
  purgeDrafts,
  readDraft,
  readKeptLayout,
  readKeptReusable,
  removeDraft,
  restoreLayout,
  writeDraft,
  type DraftRef,
  type KeptSection,
} from "../../src/components/admin/builder/draft.ts";
import type { WorkingSection } from "../../src/components/admin/builder/model.ts";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "../../src/server/auth/sessions.ts";

/** An in-memory Storage (the browser's sessionStorage interface). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  };
  return storage as unknown as Storage;
}

const USER = "01HZZZZZZZZZZZZZZZZZZZZZZA";
const OTHER = "01HZZZZZZZZZZZZZZZZZZZZZZB";
const PAGE = "01HZZZZZZZZZZZZZZZZZZZZZZC";
const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
const ref: DraftRef = { user: USER, kind: "page", id: PAGE };
const anything = (value: unknown) => value;
const data = (title: string) => ({ settings: { level: 2 }, content: { en: { title }, ar: { title: "" } }, complete: { en: true, ar: false }, otherUnaffected: false });

describe("a kept copy: one user, one record, this tab", () => {
  test("the key names the user, the kind and the record; ids are plain letters and digits", () => {
    assert.equal(draftKey(ref), `${DRAFT_PREFIX}${USER}:page:${PAGE}`);
    const storage = memoryStorage();
    for (const bad of [{ ...ref, user: "a:b" }, { ...ref, id: "../x" }, { ...ref, id: "" }, { ...ref, user: "x".repeat(41) }, { ...ref, kind: "user" as never }]) {
      assert.equal(writeDraft(storage, bad, 1, {}, NOW), false, JSON.stringify(bad));
    }
    assert.equal(storage.length, 0);
    assert.equal(writeDraft(storage, ref, -1, {}, NOW), false, "a version is a whole number");
    assert.equal(writeDraft(storage, ref, 1.5, {}, NOW), false);
  });

  test("written and read back by the same user for the same record, with its version and time", () => {
    const storage = memoryStorage();
    assert.equal(writeDraft(storage, ref, 7, { hello: "world" }, NOW), true);
    assert.deepEqual(readDraft(storage, ref, anything, NOW + 1000), { v: 1, user: USER, kind: "page", id: PAGE, base: 7, savedAt: NOW, payload: { hello: "world" } });
    // Another user, another kind or another record finds nothing (and leaves the copy alone).
    assert.equal(readDraft(storage, { ...ref, user: OTHER }, anything, NOW), null);
    assert.equal(readDraft(storage, { ...ref, kind: "service" }, anything, NOW), null);
    assert.equal(readDraft(storage, { ...ref, id: OTHER }, anything, NOW), null);
    assert.equal(storage.length, 1);
    removeDraft(storage, ref);
    assert.equal(storage.length, 0);
  });

  test("a copy is believed only while fresh: 12 hours at most (the absolute session limit), never far in the future", () => {
    assert.equal(DRAFT_TTL_MS, SESSION_ABSOLUTE_MS);
    const storage = memoryStorage();
    writeDraft(storage, ref, 1, {}, NOW);
    assert.ok(readDraft(storage, ref, anything, NOW + DRAFT_TTL_MS));
    assert.equal(readDraft(storage, ref, anything, NOW + DRAFT_TTL_MS + 1), null);
    assert.equal(storage.length, 0, "an expired copy is removed when read");
    writeDraft(storage, ref, 1, {}, NOW + 10 * 60_000);
    assert.equal(readDraft(storage, ref, anything, NOW), null, "dated 10 minutes ahead: not believed");
  });

  test("what does not read as this user's copy of this record is never used, and is removed", () => {
    const storage = memoryStorage();
    const key = draftKey(ref);
    const valid = { v: 1, user: USER, kind: "page", id: PAGE, base: 3, savedAt: NOW, payload: {} };
    for (const raw of [
      "not json",
      "[]",
      JSON.stringify({ ...valid, v: 2 }),
      JSON.stringify({ ...valid, user: OTHER }), // a copy of someone else's work put under this user's key
      JSON.stringify({ ...valid, id: OTHER }),
      JSON.stringify({ ...valid, kind: "service" }),
      JSON.stringify({ ...valid, base: "3" }),
      JSON.stringify({ ...valid, savedAt: "now" }),
    ]) {
      storage.setItem(key, raw);
      assert.equal(readDraft(storage, ref, anything, NOW), null, raw);
      assert.equal(storage.getItem(key), null, raw);
    }
    // The payload reader decides too.
    storage.setItem(key, JSON.stringify(valid));
    assert.equal(readDraft(storage, ref, () => null, NOW), null);
    assert.equal(parseDraft(JSON.stringify(valid), ref, NOW, anything)?.base, 3);
  });

  test("purging keeps only the signed-in user's fresh copies; other keys of the tab are left alone", () => {
    const storage = memoryStorage();
    storage.setItem("some-other-key", "kept");
    writeDraft(storage, ref, 1, {}, NOW);
    writeDraft(storage, { ...ref, id: OTHER }, 1, {}, NOW - DRAFT_TTL_MS - 1); // expired
    writeDraft(storage, { ...ref, user: OTHER }, 1, {}, NOW); // another user's
    storage.setItem(`${DRAFT_PREFIX}${USER}:page:broken`, "{");
    assert.equal(purgeDrafts(storage, USER, NOW), 3);
    assert.deepEqual([storage.key(0), storage.key(1)].sort(), [draftKey(ref), "some-other-key"].sort());
    assert.equal(purgeDrafts(storage, OTHER, NOW), 1, "another person signing in in this tab: this user's copy goes");
    assert.equal(storage.getItem(draftKey(ref)), null);
  });

  test("signing out clears every copy in the tab (and nothing else)", () => {
    const storage = memoryStorage();
    storage.setItem("some-other-key", "kept");
    writeDraft(storage, ref, 1, {}, NOW);
    writeDraft(storage, { ...ref, kind: "reusable" }, 1, {}, NOW);
    writeDraft(storage, { ...ref, user: OTHER }, 1, {}, NOW);
    assert.equal(clearDrafts(storage), 3);
    assert.equal(storage.length, 1);
    assert.equal(clearDrafts(null), 0, "no storage (private mode): nothing to clear, nothing thrown");
  });

  test("the session's limits are unchanged: 2 hours idle, 12 hours absolute", () => {
    assert.equal(SESSION_IDLE_MS, 2 * 60 * 60 * 1000);
    assert.equal(SESSION_ABSOLUTE_MS, 12 * 60 * 60 * 1000);
  });
});

// --- The layout's copy ------------------------------------------------------------------------------------------------------

const stored = (id: string, blockType: string, title: string): WorkingSection => ({
  ref: id,
  id,
  blockType,
  label: `Label ${title}`,
  visible: true,
  devices: { desktop: true, tablet: true, mobile: true },
  anchor: null,
  locked: false,
  reusable: null,
  data: data(title),
  dataChanged: false,
  model: { id, secret: "the server's model is never kept" } as unknown as WorkingSection["model"],
});
const S1 = "01HZZZZZZZZZZZZZZZZZZZZZS1";
const S2 = "01HZZZZZZZZZZZZZZZZZZZZZS2";
const R1 = "01HZZZZZZZZZZZZZZZZZZZZZR1";
const opened = [stored(S1, "generic.heading", "One"), stored(S2, "generic.text", "Two")];
const blocks = new Set(["generic.heading", "generic.text", "generic.cta"]);
let n = 0;
const newRef = () => `new:${++n}`;

describe("a layout's copy holds the editor's content only, and goes back only where it fits", () => {
  const working: WorkingSection[] = [
    { ...opened[1], data: data("Two, edited"), dataChanged: true, visible: false },
    {
      ref: "new:7",
      id: null,
      blockType: "generic.cta",
      label: "Call to action",
      visible: true,
      devices: { desktop: true, tablet: false, mobile: true },
      anchor: "contact-us",
      locked: false,
      reusable: null,
      data: data("New"),
      dataChanged: true,
      model: null,
    },
    { ...opened[0], ref: "new:8", id: null, duplicateOf: S1, data: data("One"), dataChanged: false, model: null },
    {
      ref: "new:9",
      id: null,
      blockType: "generic.cta",
      label: "Call to action",
      visible: true,
      devices: { desktop: true, tablet: true, mobile: true },
      anchor: null,
      locked: false,
      reusable: { id: R1, name: "Test reusable", archived: false, href: `/admin/reusable-sections/${R1}` },
      reusableId: R1,
      data: null,
      dataChanged: false,
      model: null,
    },
  ];

  test("kept: no server model, no address; data only where the save would send it", () => {
    const kept = keepLayout(working);
    const json = JSON.stringify(kept);
    assert.ok(!json.includes("server's model"), "the server's model of a section is never kept");
    assert.ok(!json.includes("/admin/"), "no address is kept (a link to a reusable section is rebuilt from its id)");
    for (const k of kept) {
      assert.deepEqual(
        Object.keys(k).sort(),
        ["anchor", "blockType", "data", "dataChanged", "devices", "id", "label", "ref", "reusable", "visible", ...(k.duplicateOf ? ["duplicateOf"] : []), ...(k.reusableId ? ["reusableId"] : [])].sort(),
      );
    }
    assert.equal(kept[0].data?.content.en?.title, "Two, edited", "an edited stored section keeps its data");
    assert.equal(kept[1].data?.content.en?.title, "New", "a new section keeps its data");
    assert.deepEqual(readKeptLayout(JSON.parse(json)), kept, "read back exactly");
  });

  test("restored onto the layout it was made on: stored sections take the page's model again, new ones fresh references", () => {
    const restored = restoreLayout(readKeptLayout(JSON.parse(JSON.stringify(keepLayout(working))))!, opened, blocks, newRef);
    assert.ok(restored);
    assert.deepEqual(
      restored.map((s) => [s.id, s.blockType, s.visible, s.dataChanged]),
      [
        [S2, "generic.text", false, true],
        [null, "generic.cta", true, true],
        [null, "generic.heading", true, false],
        [null, "generic.cta", true, false],
      ],
    );
    assert.equal(restored[0].model, opened[1].model, "the stored section's model is the page's own");
    assert.equal(restored[0].data?.content.en?.title, "Two, edited");
    assert.ok(restored.slice(1).every((s) => /^new:\d+$/.test(s.ref) && !["new:7", "new:8", "new:9"].includes(s.ref)), "new sections get this session's references");
    assert.equal(restored[2].duplicateOf, S1);
    assert.deepEqual(restored[3].reusable, { id: R1, name: "Test reusable", archived: false, href: `/admin/reusable-sections/${R1}` });
    assert.ok(!restored.some((s) => s.id === S1), "a stored section removed in the copy stays removed");
  });

  test("a stored section left unedited takes the page's data, never the copy's", () => {
    const kept = keepLayout([opened[0], opened[1]]);
    assert.equal(kept[0].data, null);
    const restored = restoreLayout(kept, opened, blocks, newRef)!;
    assert.equal(restored[0].data, opened[0].data);
  });

  test("never applied where it does not fit: an unknown or retyped section, an unknown block, a twice-named section", () => {
    const base = keepLayout(working);
    const cases: [string, KeptSection[]][] = [
      ["a stored section that is not on the page", [{ ...base[0], id: "01HZZZZZZZZZZZZZZZZZZZZZX9" }]],
      ["a stored section of another block", [{ ...base[0], blockType: "generic.heading" }]],
      ["a new section of an unknown block", [{ ...base[1], blockType: "generic.unknown" }]],
      ["a duplicate of a section that is not on the page", [{ ...base[2], duplicateOf: "01HZZZZZZZZZZZZZZZZZZZZZX9" }]],
      ["one stored section twice", [base[0], base[0]]],
      ["an edited stored section without its data", [{ ...base[0], data: null }]],
    ];
    for (const [name, kept] of cases) assert.equal(restoreLayout(kept, opened, blocks, newRef), null, name);
  });

  test("a copy that does not have the shape of one is unreadable as a whole", () => {
    const base = JSON.parse(JSON.stringify(keepLayout(working))) as Record<string, unknown>[];
    const bad: unknown[] = [
      null,
      {},
      Array.from({ length: 61 }, () => base[1]),
      [{ ...base[0], visible: "yes" }],
      [{ ...base[0], devices: { desktop: true } }],
      [{ ...base[0], id: "../../x" }],
      [{ ...base[0], data: { settings: {}, content: { fr: {} }, complete: { en: true, ar: true }, otherUnaffected: false } }],
      [{ ...base[3], reusable: { id: "javascript:alert(1)", name: "x" } }],
      [{ ...base[0], label: "x".repeat(241) }],
    ];
    for (const value of bad) assert.equal(readKeptLayout(value), null, JSON.stringify(value)?.slice(0, 80));
    // Fields that are not part of a kept section are dropped, never carried into the editor.
    const extra = readKeptLayout([{ ...base[3], href: "javascript:alert(1)", model: { ops: {} }, reusable: { id: R1, name: "x", href: "https://example.com" } }]);
    assert.ok(extra);
    assert.equal(JSON.stringify(extra).includes("javascript:"), false);
    assert.equal(JSON.stringify(extra).includes("example.com"), false);
  });

  test("a reusable section's copy: its name and data", () => {
    assert.deepEqual(readKeptReusable({ name: "Test", data: data("x") }), { name: "Test", data: data("x") });
    assert.equal(readKeptReusable({ name: 1, data: data("x") }), null);
    assert.equal(readKeptReusable({ name: "Test", data: { settings: [] } }), null);
    assert.equal(readKeptReusable({ name: "x".repeat(241), data: data("x") }), null);
  });
});

describe("the editors keep their work in the tab without keeping the session alive", () => {
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  test("no polling, no interval and no server call from the kept-copy code", () => {
    for (const path of ["src/components/admin/builder/useDraft.ts", "src/components/admin/builder/draft.ts", "src/components/admin/builder/DraftNotice.tsx"]) {
      const source = read(path);
      assert.equal(/setInterval|@\/server\/admin\/actions\/(?!builder-model)/.test(source), false, path);
    }
    for (const path of ["src/components/admin/builder/Builder.tsx", "src/components/admin/builder/ReusableEditor.tsx"]) {
      assert.equal(read(path).includes("setInterval"), false, path);
    }
  });
  test("the builder's actions answer an ended session in the page and name the editor", () => {
    const actions = read("src/server/admin/actions/builder.ts");
    for (const name of ["saveLayoutAction", "initializeLayoutAction", "detachSectionAction", "createReusableFromSectionAction", "saveReusableAction"]) {
      const body = actions.slice(actions.indexOf(`export async function ${name}(`));
      const firstLines = body.slice(0, body.indexOf("\n}"));
      assert.match(firstLines, /editor: string\)/, `${name} takes the editor`);
      assert.match(firstLines, /await editorContext\(/, `${name} starts with the editor's checks`);
      assert.doesNotMatch(firstLines, /await actionContext\(/, `${name} never redirects a signed-out editor`);
    }
    assert.match(actions, /actionContext\(action, \{ signedOut: "answer" \}\)/);
  });
});
