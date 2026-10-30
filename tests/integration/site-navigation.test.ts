/**
 * Site controls (A6) — navigation on a real MariaDB: set-up copied from today's navigation (navigation.ts, the homepage's
 * "All services"), each slot's save decided on its own version, the design's shape (Services third in the header, the
 * header's first three shown, the Services menu fixed), site pages as the only targets (each once per slot), labels in
 * both languages with the slot's length, permissions (Owner, Admin) and the audit trail. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { footerNav, headerNav, legalNav } from "../../src/content/navigation.ts";
import { readMenus, saveMenu, setUpNavigation, type MenuModel } from "../../src/server/site/menus.ts";
import type { MenuSlotKey } from "../../src/server/site/registry.ts";
import { auditOf, query, team, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";
import { expectKind, issuesOf, menuInputOf, siteChange } from "./site-helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("site_navigation");
  t = await team(env);
});
after(async () => env?.close());

const menu = async (key: MenuSlotKey): Promise<MenuModel> => (await readMenus(env.deps.db)).find((m) => m.key === key)!;

describe("set-up", () => {
  test("nothing to save before set-up; an Editor and a Reviewer can't set it up", async () => {
    const before = await menu("header_main");
    assert.equal(before.setUp, false);
    assert.match(JSON.stringify(await saveMenu(siteChange(env, t.owner), menuInputOf(before))), /Set up the navigation/);
    for (const actor of [t.editor, t.reviewer]) assert.equal((await setUpNavigation(siteChange(env, actor))).kind, "denied");
  });

  test("an Admin copies today's navigation into the four slots, once", async () => {
    expectKind(await setUpNavigation(siteChange(env, t.admin)), "ok");
    const header = await menu("header_main");
    assert.deepEqual(
      header.items.map((i) => [i.route, i.label?.en, i.label?.ar, i.isVisible]),
      headerNav.map((n) => [n.route, n.label.en, n.label.ar, true]),
    );
    const services = await menu("header_services");
    assert.deepEqual(
      services.items.map((i) => [i.linkType, i.route, i.collection, i.label?.en ?? null]),
      [
        ["collection", null, "services", null],
        ["route", "services", null, "All services"],
      ],
    );
    assert.deepEqual((await menu("footer_company")).items.map((i) => [i.route, i.label?.en]), footerNav[0].items.map((n) => [n.route, n.label.en]));
    assert.deepEqual((await menu("footer_legal")).items.map((i) => [i.route, i.label?.ar]), legalNav.map((n) => [n.route, n.label.ar]));
    for (const m of await readMenus(env.deps.db)) assert.equal(m.lockVersion, 1);
    const [event] = await auditOf(env, "menu", "navigation");
    assert.equal(event.action, "menu.setup");
    expectKind(await setUpNavigation(siteChange(env, t.owner)), "ok");
    for (const m of await readMenus(env.deps.db)) assert.equal(m.lockVersion, 1, "a second set-up changes nothing");
  });
});

describe("saving a slot", () => {
  test("the header: reorder around Services, relabel, hide, add a page and remove one; the audit counts, never labels", async () => {
    const before = await menu("header_main");
    const input = menuInputOf(before);
    const items = input.items;
    [items[0], items[1]] = [items[1], items[0]]; // About before Home
    items[3].label = { en: "Test Capabilities", ar: "القدرات التجريبية" };
    items[5].isVisible = false;
    items.splice(6, 1); // Clients out
    items.push({ id: "", route: "certificates", label: { en: "Certificates", ar: "الشهادات" }, isVisible: true });
    const result = expectKind(await saveMenu(siteChange(env, t.owner), input), "ok");
    assert.equal(result.lockVersion, before.lockVersion + 1);
    const after = await menu("header_main");
    assert.deepEqual(
      after.items.map((i) => i.route),
      ["about", "home", "services", "capabilities", "projects", "industries", "contact", "certificates"],
    );
    assert.equal(after.items[3].label?.ar, "القدرات التجريبية");
    assert.equal(after.items[5].isVisible, false);
    const [event] = await auditOf(env, "menu", "header_main");
    assert.match(event.summary, /1 added, 1 removed, reordered, 1 relabelled, 1 shown\/hidden/);
    assert.doesNotMatch(JSON.stringify(event), /Test Capabilities/);
  });

  test("the design's shape: Services stays third; the first three stay shown; each page once; known pages only", async () => {
    const model = await menu("header_main");
    const cases: [string, (items: ReturnType<typeof menuInputOf>["items"]) => void, RegExp][] = [
      ["Services moved", (items) => items.splice(1, 0, items.splice(2, 1)[0]), /stays in place 3/],
      ["Services removed", (items) => items.splice(2, 1), /must be item 3/],
      ["first hidden", (items) => (items[0].isVisible = false), /always shows its first three/],
      ["duplicate", (items) => (items[4].route = "contact"), /already in this menu/],
      ["unknown page", (items) => (items[4].route = "admin"), /Choose one of the website's pages/],
      ["long label", (items) => (items[4].label = { en: "x".repeat(25), ar: "س" }), /at most 24 characters/],
      ["empty Arabic", (items) => (items[4].label = { en: "Projects", ar: " " }), /Required in both languages/],
      ["too many", (items) => items.push({ id: "", route: "privacy", label: { en: "P", ar: "خ" }, isVisible: true }), /at most 8 items/],
      ["too few", (items) => items.splice(2), /Keep at least 3/],
      ["foreign id", (items) => (items[4].id = "01ARZ3NDEKTSV4RRFFQ69G5FAV"), /This menu changed/],
      ["markup", (items) => (items[4].label = { en: "<i>x</i>", ar: "س" }), /items\.4\.label\.en/],
    ];
    for (const [name, change, pattern] of cases) {
      const input = menuInputOf(model);
      change(input.items);
      const result = await saveMenu(siteChange(env, t.admin), input);
      assert.equal(result.kind, "invalid", name);
      assert.match(issuesOf(result), pattern, name);
    }
    assert.equal((await menu("header_main")).lockVersion, model.lockVersion, "nothing was stored");
  });

  test("the Services menu is fixed: its link's label changes, nothing else", async () => {
    const model = await menu("header_services");
    const relabel = menuInputOf(model);
    relabel.items[1].label = { en: "Every service", ar: "كل الخدمات" };
    expectKind(await saveMenu(siteChange(env, t.admin), relabel), "ok");
    assert.equal((await menu("header_services")).items[1].label?.en, "Every service");
    const fresh = await menu("header_services");
    for (const change of [
      (i: ReturnType<typeof menuInputOf>) => i.items.reverse(),
      (i: ReturnType<typeof menuInputOf>) => i.items.push({ id: "", route: "contact", label: { en: "C", ar: "ت" }, isVisible: true }),
      (i: ReturnType<typeof menuInputOf>) => (i.items[1].isVisible = false),
      (i: ReturnType<typeof menuInputOf>) => (i.items[0].label = { en: "Services", ar: "الخدمات" }),
    ]) {
      const input = menuInputOf(fresh);
      change(input);
      assert.equal((await saveMenu(siteChange(env, t.admin), input)).kind, "invalid");
    }
  });

  test("an older form is refused as stale; an Editor's and a Reviewer's saves are refused (audited)", async () => {
    const model = await menu("footer_legal");
    const first = menuInputOf(model);
    const second = menuInputOf(model);
    first.items[0].label = { en: "Test Privacy", ar: "الخصوصية" };
    second.items[1].label = { en: "Test Terms", ar: "الشروط" };
    expectKind(await saveMenu(siteChange(env, t.owner), first), "ok");
    assert.match(expectKind(await saveMenu(siteChange(env, t.admin), second), "stale").message, /changed after you opened it/);
    assert.equal((await menu("footer_legal")).items[1].label?.en, legalNav[1].label.en);
    for (const actor of [t.editor, t.reviewer]) assert.equal((await saveMenu(siteChange(env, actor), menuInputOf(await menu("footer_legal")))).kind, "denied");
    const events = await auditOf(env, "menu", "footer_legal");
    assert.deepEqual(events.slice(0, 3).map((e) => e.outcome), ["denied", "denied", "failed"]);
  });

  test("the footer: a slot of its own; removing every link is refused", async () => {
    const model = await menu("footer_company");
    const input = menuInputOf(model);
    input.items = [];
    assert.match(issuesOf(await saveMenu(siteChange(env, t.owner), input)), /Keep at least 1 item/);
    const ok = menuInputOf(model);
    ok.items = ok.items.slice(0, 2);
    expectKind(await saveMenu(siteChange(env, t.owner), ok), "ok");
    assert.equal((await menu("footer_company")).items.length, 2);
    assert.equal((await query(env, "SELECT * FROM menu_item_translations t JOIN menu_items i ON i.id = t.item_id WHERE i.menu_key = 'footer_company'")).length, 4, "removed items' labels went with them");
  });
});
