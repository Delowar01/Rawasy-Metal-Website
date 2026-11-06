/**
 * A8 end to end, on the production build against the admin suite's local MariaDB: the review workflow by role through
 * the publishing panel (an Editor submits, a Reviewer sends back with a comment and later approves and publishes
 * someone else's submission, an Admin unpublishes), the version history, comparing two versions field by field in both
 * languages, restoring an earlier version, "Used by" from the reference index, the audit log (filters in the address,
 * the search never in it; Editors refused), phones (390 / 320 px) without sideways scrolling, axe, and the keyboard.
 * Nothing is faked: every step goes through the pages and Server Actions into the database. The public website is not
 * touched: publishing fills the database's public read model only. Test data only ("Test …").
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { cliEnv, freshCode, queryTestDb } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "pub.owner@example.test", name: "Test Publishing Owner", password: "publishing owner phrase granite", mfa: true },
  admin: { email: "pub.admin@example.test", name: "Test Publishing Admin", password: "publishing admin phrase estuary", mfa: true },
  editor: { email: "pub.editor@example.test", name: "Test Publishing Editor", password: "publishing editor phrase orchard", mfa: false },
  reviewer: { email: "pub.reviewer@example.test", name: "Test Publishing Reviewer", password: "publishing reviewer phrase beacon", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
const ids: Record<string, string> = {};
const ULID_IN_URL = /\/([0-9A-HJKMNP-TV-Z]{26})(?:\?|$)/;
const SEARCH_WORDS = "Test Publishing Editor";

async function signedIn(browser: Browser, role: Role, options: { viewport?: { width: number; height: number }; colorScheme?: "light" | "dark" } = {}): Promise<Page> {
  const context: BrowserContext = await browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 800 }, colorScheme: options.colorScheme ?? "light" });
  const page = await context.newPage();
  const user = USERS[role];
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (user.mfa) {
    await page.waitForURL("**/admin/login/verify**");
    await page.getByLabel("Authentication code").fill(await freshCode(secrets[role]!));
    await page.getByRole("button", { name: "Verify" }).click();
  }
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"));
  return page;
}

async function as(browser: Browser, role: Role): Promise<Page> {
  pages[role] ??= await signedIn(browser, role);
  return pages[role]!;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main :is(h1, h2)").first().waitFor();
}

const panel = (page: Page) => page.locator("#publishing");
const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const pastScreen = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => !e.closest(".adm-sr-only") && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).length);

/** Opens a step's dialog, fills what it asks and confirms; waits for the page to show the new state. */
async function step(page: Page, button: string, fill: Record<string, string> = {}, confirm = button) {
  await panel(page).getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries(fill)) await dialog.getByLabel(label).fill(value);
  await dialog.getByRole("button", { name: confirm, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

const AXE = require.resolve("axe-core/axe.min.js");
async function axe(page: Page) {
  await page.evaluate(readFileSync(AXE, "utf8"));
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (o: object) => Promise<{ violations: { id: string; impact: string; nodes: { target: unknown[] }[] }[] }> } }).axe.run({
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => String(n.target)).join(" | ")}`);
  });
}

test.beforeAll(async () => {
  for (const role of ROLES) {
    const user = USERS[role];
    const out = execFileSync(process.execPath, [join(ROOT, "e2e-admin/seed-user.mjs"), "--email", user.email, "--name", user.name, "--roles", role, ...(user.mfa ? ["--mfa"] : [])], {
      env: { ...cliEnv(), SEED_PASSWORD: user.password },
      encoding: "utf8",
    });
    const seeded = JSON.parse(out) as { secret: string | null };
    if (seeded.secret) secrets[role] = seeded.secret;
  }
});

test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

test.afterAll(async () => {
  for (const page of Object.values(pages)) await page?.context().close();
});

test.describe("the review workflow by role", () => {
  test("an Editor writes both languages and submits; the panel lists what blocks publishing until then", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/clients/new");
    await editor.getByLabel("Slug", { exact: true }).fill("test-publishing-client");
    await editor.locator("#english").getByLabel(/^Name/).fill("Test Publishing Client");
    await editor.getByRole("button", { name: "Create client" }).click();
    await editor.waitForURL(/[?&]created=1/);
    ids.client = ULID_IN_URL.exec(editor.url())![1];
    await expect(panel(editor)).toContainText("Draft");
    await expect(panel(editor)).toContainText("Not ready to publish");
    await expect(panel(editor)).toContainText("Arabic has no text yet");
    await expect(panel(editor).getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
    await editor.locator("#arabic").getByLabel(/^Name/).fill("عميل النشر التجريبي");
    await editor.getByLabel("English is complete").check();
    await editor.getByLabel("Arabic is complete").check();
    await editor.getByRole("button", { name: "Save draft" }).click();
    await editor.waitForURL(/[?&]saved=1/);
    await expect(panel(editor)).toContainText("Ready to publish");
    await step(editor, "Submit for review", { "Note for the reviewer (optional)": "Test note for the review." });
    await expect(panel(editor)).toContainText("In review");
  });

  test("the Reviewer sends it back with a comment; the Editor sees it, resubmits; the Reviewer approves and publishes", async ({ browser }) => {
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, `/admin/clients/${ids.client}`);
    await expect(panel(reviewer)).toContainText("In review");
    await step(reviewer, "Request changes", { "What needs to change": "Test comment: check the Arabic name." }, "Send back with comment");
    await expect(panel(reviewer)).toContainText("Draft");
    const editor = await as(browser, "editor");
    await open(editor, `/admin/clients/${ids.client}`);
    await expect(panel(editor)).toContainText("Changes requested");
    await expect(panel(editor)).toContainText("Test comment: check the Arabic name.");
    await step(editor, "Submit for review");
    await open(reviewer, `/admin/clients/${ids.client}`);
    await step(reviewer, "Approve and publish");
    await expect(panel(reviewer)).toContainText("Published");
    await expect(panel(reviewer)).toContainText("Live version");
    const live = await queryTestDb<{ entity_id: string }>("SELECT entity_id FROM published_documents WHERE entity_type = 'client' AND entity_id = ?", [ids.client]);
    expect(live).toHaveLength(1);
    const audit = await queryTestDb<{ action: string; summary: string }>("SELECT action, summary FROM audit_events WHERE entity_id = ? AND action = 'client.publish' AND outcome = 'success'", [ids.client]);
    expect(audit[0].summary).toContain("after review");
    expect(audit.map((a) => a.summary).join(" ")).not.toContain("Arabic name");
  });

  test("the public website is untouched by publishing", async ({ browser }) => {
    const context = await browser.newContext();
    const html = await (await context.request.get("/en/clients")).text();
    await context.close();
    expect(html).not.toContain("Test Publishing Client");
  });

  test("an edit after publishing is a draft; history lists the versions; compare shows the change in its language", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/clients/${ids.client}`);
    await editor.locator("#arabic").getByLabel(/^Name/).fill("عميل النشر المعدل");
    await editor.getByLabel("English is complete").check();
    await editor.getByLabel("Arabic is complete").check();
    await editor.getByRole("button", { name: "Save draft" }).click();
    await editor.waitForURL(/[?&]saved=1/);
    await expect(panel(editor)).toContainText("Published · changes in draft");
    await panel(editor).getByRole("link", { name: /Version history/ }).click();
    await editor.locator("main h1").waitFor();
    await expect(editor.locator("main")).toContainText("Published");
    await expect(editor.locator("main").getByText("Live", { exact: true })).toHaveCount(1);
    await editor.getByRole("link", { name: "With the working copy" }).first().click();
    await editor.waitForURL(/\/compare\?/);
    const live = (await queryTestDb<{ id: string }>("SELECT published_revision_id AS id FROM clients WHERE id = ?", [ids.client]))[0].id;
    await open(editor, editor.url().replace(/a=[^&]+/, `a=${live}`));
    expect(editor.url()).toContain(`a=${live}`);
    const arabicCell = editor.locator("main td[lang='ar']").first();
    await expect(arabicCell).toHaveAttribute("dir", "rtl");
    await expect(editor.locator("main")).toContainText("عميل النشر المعدل");
    await expect(editor.locator("main")).toContainText("Arabic");
  });

  test("restore an earlier version from the history (a new version; the live one unchanged)", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/history/client/${ids.client}`);
    const before = await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM revisions WHERE entity_id = ?", [ids.client]);
    const live = await queryTestDb<{ published_revision_id: string }>("SELECT published_revision_id FROM clients WHERE id = ?", [ids.client]);
    const row = editor.locator("main tbody tr").filter({ has: editor.getByText("Live", { exact: true }) });
    await row.getByRole("button", { name: "Restore" }).click();
    await editor.getByRole("dialog").getByRole("button", { name: "Restore this version" }).click();
    await expect(editor.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
    const after = await queryTestDb<{ n: number; kind: string }>("SELECT COUNT(*) AS n, (SELECT kind FROM revisions WHERE entity_id = ? ORDER BY revision_number DESC LIMIT 1) AS kind FROM revisions WHERE entity_id = ?", [ids.client, ids.client]);
    expect(Number(after[0].n)).toBe(Number(before[0].n) + 1);
    expect(after[0].kind).toBe("restore");
    expect((await queryTestDb<{ published_revision_id: string }>("SELECT published_revision_id FROM clients WHERE id = ?", [ids.client]))[0].published_revision_id).toBe(live[0].published_revision_id);
    await open(editor, `/admin/clients/${ids.client}`);
    await expect(editor.locator("#arabic").getByLabel(/^Name/)).toHaveValue("عميل النشر التجريبي");
  });

  test("an Editor has no unpublish; an Admin unpublishes; a Reviewer's forged publish is refused and audited", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/clients/${ids.client}`);
    await expect(panel(editor).getByRole("button", { name: "Unpublish" })).toHaveCount(0);
    const admin = await as(browser, "admin");
    await open(admin, `/admin/clients/${ids.client}`);
    await step(admin, "Unpublish");
    await expect(panel(admin)).toContainText("Draft");
    expect(await queryTestDb("SELECT 1 FROM published_documents WHERE entity_type = 'client' AND entity_id = ?", [ids.client])).toHaveLength(0);
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, `/admin/clients/${ids.client}`);
    const version = (await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM clients WHERE id = ?", [ids.client]))[0].v;
    const status = await reviewer.evaluate(
      async ({ id, version, actionId }) => {
        const body = new FormData();
        for (const [k, v] of Object.entries({ step: "publish", type: "client", id, version: String(version) })) body.append(`_1_${k}`, v);
        body.append("0", JSON.stringify([{ status: "idle" }, "$K1"]));
        const response = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component" }, body });
        await response.text();
        return response.status;
      },
      { id: ids.client, version, actionId: actionIdOf("workflowAction") },
    );
    expect(status).toBe(200);
    expect(await queryTestDb("SELECT 1 FROM published_documents WHERE entity_type = 'client' AND entity_id = ?", [ids.client])).toHaveLength(0);
    const denied = await queryTestDb("SELECT 1 FROM audit_events WHERE entity_id = ? AND action = 'client.publish' AND outcome = 'denied'", [ids.client]);
    expect(denied.length).toBeGreaterThan(0);
  });
});

function actionIdOf(name: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")) as { node: Record<string, { exportedName?: string; filename?: string }> };
  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && v.filename?.startsWith("src/server/admin/actions/"));
  if (!found) throw new Error(`No Server Action ${name} in the build.`);
  return found[0];
}

test.describe("the audit log", () => {
  test("filters stay in the address, the search never does; Editors are refused", async ({ browser }) => {
    const owner = await as(browser, "owner");
    const seen: string[] = [];
    owner.on("request", (r) => seen.push(r.url()));
    owner.on("response", (r) => {
      const location = r.headers()["location"];
      if (location) seen.push(location);
    });
    await open(owner, "/admin/audit");
    await owner.getByLabel("Outcome").selectOption("denied");
    await owner.getByLabel("Search summaries, records and people").fill(SEARCH_WORDS);
    await owner.getByRole("button", { name: "Show events" }).click();
    await owner.waitForURL(/outcome=denied/);
    await owner.locator("main h1").waitFor();
    await expect(owner.getByLabel("Search summaries, records and people")).toHaveValue(SEARCH_WORDS);
    for (const url of seen) expect(decodeURIComponent(url)).not.toContain(SEARCH_WORDS);
    for (const href of await owner.locator("main a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))) expect(decodeURIComponent(href)).not.toContain(SEARCH_WORDS);
    const cookies = await owner.context().cookies();
    const sealed = cookies.find((c) => c.name === "__Host-rawasy_audit_search");
    expect(sealed?.httpOnly && sealed.secure && sealed.sameSite === "Strict").toBeTruthy();
    expect(sealed?.value).not.toContain("Publishing");
    await owner.getByRole("button", { name: "Clear search" }).click();
    // Clear answers with the unfiltered log (the address had filters until then).
    await owner.waitForURL((u) => u.pathname === "/admin/audit" && u.search === "");
    await expect(owner.getByLabel("Search summaries, records and people")).toHaveValue("");
    expect((await owner.context().cookies()).some((c) => c.name === "__Host-rawasy_audit_search")).toBe(false);
    await open(owner, `/admin/audit?entity=client:${ids.client}`);
    await expect(owner.locator("main")).toContainText("client.publish");
    const editor = await as(browser, "editor");
    await open(editor, "/admin/audit");
    await expect(editor.locator("main")).toContainText("You don't have access to this page");
    await expect(editor.locator("main table")).toHaveCount(0);
  });
});

test.describe("phones, accessibility and the keyboard", () => {
  test("390 and 320 px: the panel, the history, the comparison and the audit log never scroll sideways", async ({ browser }) => {
    for (const width of [390, 320]) {
      const phone = await signedIn(browser, "owner", { viewport: { width, height: 844 } });
      const rev = (await queryTestDb<{ id: string }>("SELECT id FROM revisions WHERE entity_id = ? ORDER BY revision_number LIMIT 1", [ids.client]))[0].id;
      for (const path of [`/admin/clients/${ids.client}`, `/admin/history/client/${ids.client}`, `/admin/history/client/${ids.client}/compare?a=${rev}&b=working`, "/admin/audit"]) {
        await open(phone, path);
        expect(await pageOverflow(phone), `${path} at ${width}`).toBeLessThanOrEqual(0);
        expect(await pastScreen(phone), `${path} at ${width}`).toBe(0);
        // Stacked on phones, every cell says which column it is (the comparison's Before / After above all).
        if (path.includes("/compare")) {
          const labels = await phone.locator("main td[data-label]").evaluateAll((cells) => cells.map((c) => getComputedStyle(c, "::before").content));
          expect(labels.length, `${path} at ${width}`).toBeGreaterThan(0);
          expect(labels).toContain('"Before: "');
          expect(labels).toContain('"After: "');
        }
      }
      await phone.context().close();
    }
  });

  test("axe finds nothing on the A8 screens (light and dark)", async ({ browser }) => {
    // Rows whose record labels are long enough that a row's two links wrap onto two lines (the full suite's audit log
    // has such rows; this file alone did not, so the target-size rule once passed here and failed there).
    for (let i = 0; i < 8; i++) {
      await queryTestDb(
        "INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_label, action, entity_type, entity_id, entity_label, outcome, summary, changes) VALUES (NOW(3), ?, 'system', 'Test system', 'client.update', 'client', ?, ?, 'success', ?, ?)",
        [`01KA00000000000000AXETEST${i}`.slice(0, 26), ids.client, `Test Publishing Client with a deliberately long record label number ${i}`, `Test edit ${i} of the client with a long label.`, JSON.stringify({ count: i })],
      );
    }
    for (const scheme of ["light", "dark"] as const) {
      const page = await signedIn(browser, "owner", { colorScheme: scheme });
      const rev = (await queryTestDb<{ id: string }>("SELECT id FROM revisions WHERE entity_id = ? ORDER BY revision_number LIMIT 1", [ids.client]))[0].id;
      for (const path of [`/admin/clients/${ids.client}`, `/admin/history/client/${ids.client}`, `/admin/history/client/${ids.client}/compare?a=${rev}&b=working`, "/admin/audit"]) {
        await open(page, path);
        expect(await axe(page), `${path} (${scheme})`).toEqual([]);
      }
      await page.context().close();
    }
  });

  test("the keyboard reaches every publishing step; its dialog takes focus and Escape closes it", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/clients/${ids.client}`);
    const submit = panel(editor).getByRole("button", { name: "Submit for review" });
    await tabTo(editor, submit);
    await editor.keyboard.press("Enter");
    const dialog = editor.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await editor.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
    await editor.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(submit).toBeFocused();
    await open(editor, `/admin/history/client/${ids.client}`);
    await tabTo(editor, editor.getByRole("link", { name: "With the working copy" }).first());
    await editor.keyboard.press("Enter");
    await editor.waitForURL(/compare/);
  });
});

/** Tabs until `target` has focus (at most 150 presses), checking that every stop shows a focus ring. */
async function tabTo(page: Page, target: Locator) {
  await page.keyboard.press("Shift");
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || !el.closest("main")) return true;
      const s = getComputedStyle(el);
      return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
    });
    expect(ring, "every keyboard stop shows where it is").toBe(true);
  }
  throw new Error("The target was not reached with the keyboard.");
}
