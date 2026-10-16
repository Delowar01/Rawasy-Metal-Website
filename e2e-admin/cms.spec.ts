/**
 * The Core CMS (Phase A3) end to end, on the production build against the admin suite's local MariaDB
 * (e2e-admin/server.mjs): the CONTENT navigation by role, the dashboard's real counts, pages, services and their
 * machines, projects with categories, services and restrictions, archive and restore, search and filters, Arabic input,
 * the stale save, unsaved-change warnings, phones (390 and 320 px), dark mode, axe, the CSP, forged requests from a
 * signed-in Editor, and every A3 route and action behind the ADMIN_ENABLED gate. No mutation is faked: every change goes
 * through the pages and Server Actions into the database. Test data only ("Test …", "Demo …").
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { expect, request as apiRequest, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { cliEnv, freshCode, queryTestDb } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "cms.owner@example.test", name: "Cora Owner", password: "cms owner phrase alpine", mfa: true },
  admin: { email: "cms.admin@example.test", name: "Cyrus Admin", password: "cms admin phrase harbour", mfa: true },
  editor: { email: "cms.editor@example.test", name: "Celia Editor", password: "cms editor phrase meadow", mfa: false },
  reviewer: { email: "cms.reviewer@example.test", name: "Conor Reviewer", password: "cms reviewer phrase lantern", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
const ids: Record<string, string> = {};
const ULID_IN_URL = /\/([0-9A-HJKMNP-TV-Z]{26})(?:\?|$)/;
const AREAS = ["Pages", "Services", "Projects", "Machinery", "Industries", "Clients", "Certificates"];

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

/** Opens an admin address and waits for its content (admin pages stream in after a loading skeleton). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main :is(h1, h2)").first().waitFor();
}

const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** List title cells whose lines (the title, the Arabic title, the slug) run together: each must start below the last. */
const titleCellsRunTogether = (page: Page) =>
  page.locator("main .adm-cell-title").evaluateAll((cells) =>
    cells.flatMap((cell) => {
      const boxes = [...cell.children].map((child) => child.getBoundingClientRect());
      return boxes.slice(1).some((box, i) => box.top < boxes[i].bottom - 1) ? [cell.textContent ?? ""] : [];
    }),
  );
const english = (page: Page) => page.locator("#english");
const arabic = (page: Page) => page.locator("#arabic");
const idFrom = (page: Page) => ULID_IN_URL.exec(page.url())?.[1] ?? "";

async function save(page: Page, button = "Save draft") {
  await page.getByRole("button", { name: button }).click();
  await page.waitForURL(/[?&](saved|created)=1/);
  await page.locator("main h1").first().waitFor();
}

/** The id of one of the admin's Server Actions in this build (from Next's own manifest). */
function actionId(name: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { exportedName?: string; filename?: string }>;
  };
  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && v.filename?.startsWith("src/server/admin/actions/"));
  if (!found) throw new Error(`No Server Action ${name} in the build.`);
  return found[0];
}

/**
 * A Server Action sent from inside a signed-in page with arguments of the person's choosing (what a modified page or
 * a script could send): same origin, the session cookie, React's reply encoding as this React version's client writes
 * it — the FormData's fields as `_1_<name>` first, then part `0` (the form state and the reference `$K1`), since the
 * server resolves the reference when part `0` arrives. The server must decide it alone.
 */
async function forgeAction(page: Page, name: string, fields: Record<string, string>): Promise<number> {
  return page.evaluate(
    async ({ id, fields }) => {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.append(`_1_${key}`, value);
      body.append("0", JSON.stringify([{ status: "idle" }, "$K1"]));
      const response = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body });
      await response.text();
      return response.status;
    },
    { id: actionId(name), fields },
  );
}

const AXE = require.resolve("axe-core/axe.min.js");
/** axe through the CSS object model-free path: the admin's CSP refuses inline scripts, so the file is evaluated directly. */
async function axe(page: Page) {
  await page.evaluate(readFileSync(AXE, "utf8"));
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (o: object) => Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } }).axe.run({
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);
  });
}

test.beforeAll(async () => {
  for (const role of ROLES) {
    const user = USERS[role];
    const out = execFileSync(
      process.execPath,
      [join(ROOT, "e2e-admin/seed-user.mjs"), "--email", user.email, "--name", user.name, "--roles", role, ...(user.mfa ? ["--mfa"] : [])],
      { env: { ...cliEnv(), SEED_PASSWORD: user.password }, encoding: "utf8" },
    );
    const seeded = JSON.parse(out) as { id: string; secret: string | null };
    if (seeded.secret) secrets[role] = seeded.secret;
  }
});

test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

test.afterAll(async () => {
  for (const page of Object.values(pages)) await page?.context().close();
});

async function as(browser: Browser, role: Role): Promise<Page> {
  pages[role] ??= await signedIn(browser, role);
  return pages[role]!;
}

test.describe("navigation and dashboard", () => {
  test("the Owner sees every CONTENT area; a Reviewer sees the areas but not Users & access", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin");
    const nav = owner.getByRole("complementary").getByRole("navigation", { name: "Admin sections" });
    await expect(nav.getByText("Content", { exact: true })).toBeVisible();
    for (const area of AREAS) await expect(nav.getByRole("link", { name: area, exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users", exact: true })).toBeVisible();
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, "/admin");
    const rnav = reviewer.getByRole("complementary").getByRole("navigation", { name: "Admin sections" });
    for (const area of AREAS) await expect(rnav.getByRole("link", { name: area, exact: true })).toBeVisible();
    await expect(rnav.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
    for (const area of AREAS) {
      await rnav.getByRole("link", { name: area, exact: true }).click();
      await expect(reviewer.locator("main h1")).toHaveText(area);
      await expect(reviewer.getByRole("link", { name: /^New / })).toHaveCount(0);
    }
  });

  test("the dashboard shows real counts per area (all zero before any content) and nothing invented", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin");
    const table = owner.getByRole("table", { name: "Content records by area" });
    await expect(table.getByRole("row")).toHaveCount(9);
    for (const area of ["Pages", "Services", "Projects", "Project categories", "Machinery", "Industries", "Clients", "Certificates"]) {
      const row = table.getByRole("row").filter({ has: owner.getByRole("rowheader", { name: area, exact: true }) });
      await expect(row.getByRole("cell")).toHaveText(["0", "0", "0", "0", "0"]);
    }
    // Nothing invented (A3). A4's media card shows recorded storage sizes, checked against the database in media.spec.ts.
    await expect(owner.locator("main")).not.toContainText(/views|leads|SEO score/i);
    await expect(owner.locator("main section").filter({ has: table })).not.toContainText(/storage/i);
  });
});

test.describe("pages", () => {
  test("create a generic page in English, then add Arabic (right to left) and mark English complete", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/pages/new");
    await expect(editor.getByRole("link", { name: "New generic page" })).toBeVisible();
    await expect(editor.getByText("A record for one of the site's fixed pages")).toHaveCount(0);
    await editor.getByRole("link", { name: "New generic page" }).click();
    await editor.getByLabel("Slug", { exact: true }).fill("about");
    await english(editor).getByLabel(/^Title/).fill("Test Careers");
    await editor.getByRole("button", { name: "Create page" }).click();
    await expect(editor.locator("main").getByRole("alert")).toContainText("“about” can't be used");
    await expect(english(editor).getByLabel(/^Title/)).toHaveValue("Test Careers");
    await editor.getByLabel("Slug", { exact: true }).fill("test-careers");
    await save(editor, "Create page");
    ids.page = idFrom(editor);
    await expect(editor.getByText("EN Draft").first()).toBeVisible();
    await expect(editor.getByText("AR Missing").first()).toBeVisible();
    const arTitle = arabic(editor).getByLabel(/^Title/);
    await expect(arTitle).toHaveAttribute("dir", "rtl");
    await expect(arTitle).toHaveAttribute("lang", "ar");
    await expect(english(editor).getByLabel(/^Title/)).toHaveAttribute("dir", "ltr");
    await expect(editor.locator("html")).toHaveAttribute("dir", "ltr");
    await arTitle.fill("صفحة الوظائف التجريبية");
    await english(editor).getByLabel("English is complete").check();
    await save(editor);
    await expect(arabic(editor).getByLabel(/^Title/)).toHaveValue("صفحة الوظائف التجريبية");
    await expect(editor.getByText("EN Complete").first()).toBeVisible();
    await expect(editor.getByText("AR Draft").first()).toBeVisible();
    const [row] = await queryTestDb<{ title: string }>("SELECT title FROM page_translations WHERE page_id = ? AND locale = 'ar'", [ids.page]);
    expect(row.title).toBe("صفحة الوظائف التجريبية");
  });

  test("a stale save is refused with the stale message; the typed values stay and the newer content is kept", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const admin = await as(browser, "admin");
    await open(editor, `/admin/pages/${ids.page}`);
    await open(admin, `/admin/pages/${ids.page}`);
    await english(admin).getByLabel(/^Title/).fill("Test Careers (Admin's newer title)");
    await save(admin);
    await english(editor).getByLabel(/^Title/).fill("Test Careers (Editor's older form)");
    await editor.getByRole("button", { name: "Save draft" }).click();
    await expect(editor.locator("main").getByRole("alert")).toContainText("This content changed after you opened it. Reload and review the latest version before saving.");
    await expect(english(editor).getByLabel(/^Title/)).toHaveValue("Test Careers (Editor's older form)");
    await expect(editor.getByRole("link", { name: "Open the latest version in a new tab" })).toHaveAttribute("target", "_blank");
    const [row] = await queryTestDb<{ title: string }>("SELECT title FROM page_translations WHERE page_id = ? AND locale = 'en'", [ids.page]);
    expect(row.title).toBe("Test Careers (Admin's newer title)");
  });

  test("leaving with unsaved changes asks first (in-app links and closing the tab)", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/pages/${ids.page}`);
    await english(editor).getByLabel(/^Navigation label/).fill("Unsaved label");
    let message = "";
    editor.once("dialog", (dialog) => {
      message = dialog.message();
      void dialog.dismiss();
    });
    await editor.getByRole("complementary").getByRole("link", { name: "Projects", exact: true }).click();
    expect(message).toContain("unsaved changes");
    await expect(editor).toHaveURL(new RegExp(`/admin/pages/${ids.page}`));
    await expect(english(editor).getByLabel(/^Navigation label/)).toHaveValue("Unsaved label");
    // The section links of the form itself never ask.
    await editor.getByRole("navigation", { name: "Sections of this form" }).getByRole("link", { name: "SEO" }).click();
    await expect(editor).toHaveURL(/#seo$/);
    editor.once("dialog", (dialog) => void dialog.accept());
    await editor.getByRole("complementary").getByRole("link", { name: "Projects", exact: true }).click();
    await expect(editor).toHaveURL(/\/admin\/projects$/);
    const fresh = await signedIn(browser, "editor");
    await open(fresh, `/admin/pages/${ids.page}`);
    await english(fresh).getByLabel(/^Navigation label/).fill("Unsaved again");
    let unload = "";
    fresh.once("dialog", (dialog) => {
      unload = dialog.type();
      void dialog.accept();
    });
    await fresh.close({ runBeforeUnload: true });
    await expect.poll(() => unload).toBe("beforeunload");
    await fresh.context().close();
  });

  test("an Editor can't register fixed pages or touch a legal record; an Admin registers the privacy record with the review label", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/pages/new");
    await admin.getByRole("link", { name: /Privacy policy/ }).click();
    await expect(admin.getByRole("note").filter({ hasText: "Requires legal review before publication" })).toBeVisible();
    await english(admin).getByLabel(/^Title/).fill("Test Privacy Draft");
    await save(admin, "Create page");
    ids.legal = idFrom(admin);
    await expect(admin.getByText("Requires legal review before publication").first()).toBeVisible();
    await expect(admin.getByLabel("Slug", { exact: true })).toHaveCount(0);
    await expect(admin.getByRole("button", { name: /^Archive/ })).toHaveCount(0);
    await expect(admin.getByText("Fixed pages of the site (homepage, system, legal and template pages) are never archived.")).toBeVisible();
    const editor = await as(browser, "editor");
    await open(editor, `/admin/pages/${ids.legal}`);
    await expect(editor.getByRole("note").filter({ hasText: "Your roles let you view this page, not change it." })).toBeVisible();
    await expect(english(editor).getByLabel(/^Title/)).toBeDisabled();
    await expect(editor.getByRole("button", { name: "Save draft" })).toHaveCount(0);
    // A forged save of the legal record by the Editor is refused on the server, and audited.
    const [{ lock_version }] = await queryTestDb<{ lock_version: number }>("SELECT lock_version FROM pages WHERE id = ?", [ids.legal]);
    await forgeAction(editor, "saveContentAction", { _type: "page", _id: ids.legal, lockVersion: String(lock_version), "en.title": "Changed by a forged request" });
    const [after] = await queryTestDb<{ title: string }>("SELECT title FROM page_translations WHERE page_id = ? AND locale = 'en'", [ids.legal]);
    expect(after.title).toBe("Test Privacy Draft");
    const [denied] = await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM audit_events WHERE entity_id = ? AND action = 'page.update' AND outcome = 'denied'", [ids.legal]);
    expect(Number(denied.n)).toBe(1);
  });
});

test.describe("services, machinery and projects", () => {
  test("create a service and a machine with a technical attribute, relate them, and change the order", async ({ browser }) => {
    const editor = await as(browser, "editor");
    for (const [slug, name] of [
      ["test-laser-service", "Test Laser Service"],
      ["test-bending-service", "Test Bending Service"],
    ]) {
      await open(editor, "/admin/services/new");
      await editor.getByLabel("Slug", { exact: true }).fill(slug);
      await editor.getByLabel("Section", { exact: true }).selectOption("metal");
      await editor.getByLabel("Icon / drawing").selectOption("laser-cutting");
      await english(editor).getByLabel(/^Name/).fill(name);
      await save(editor, "Create service");
      ids[slug] = idFrom(editor);
    }
    await open(editor, "/admin/machinery/new");
    await editor.getByLabel("Slug", { exact: true }).fill("test-laser-6kw");
    await editor.getByLabel("Power (W)").fill("6,000");
    await english(editor).getByLabel(/^Name/).fill("Test Laser 6 kW");
    await editor.getByRole("button", { name: "Add attribute" }).click();
    await editor.getByLabel("English label").fill("Test bed");
    await editor.getByLabel("English value").fill("3 × 1.5 m");
    await editor.getByLabel("Arabic label").fill("طاولة تجريبية");
    await editor.getByLabel("Arabic value").fill("٣ × ١٫٥ م");
    await editor.getByRole("button", { name: "Create machine" }).click();
    await expect(editor.locator("main").getByRole("alert")).toContainText("Enter the power in watts as a number.");
    await expect(editor.getByLabel("Arabic value")).toHaveValue("٣ × ١٫٥ م");
    await editor.getByLabel("Power (W)").fill("6000");
    await editor.getByLabel("Primary service").selectOption(ids["test-laser-service"]);
    await save(editor, "Create machine");
    ids.machine = idFrom(editor);
    await expect(editor.getByLabel("Arabic label")).toHaveAttribute("dir", "rtl");
    await open(editor, `/admin/services/${ids["test-laser-service"]}`);
    await editor.getByLabel("Add to machines").selectOption(ids.machine);
    await editor.getByRole("group", { name: /^Machines/ }).getByRole("button", { name: "Add", exact: true }).click();
    await save(editor);
    await expect(editor.getByRole("group", { name: /^Machines/ }).getByRole("listitem")).toHaveText([/Test Laser 6 kW/]);
    const rel = await queryTestDb<{ machine_id: string }>("SELECT machine_id FROM service_machines WHERE service_id = ?", [ids["test-laser-service"]]);
    expect(rel.map((r) => r.machine_id)).toEqual([ids.machine]);
    await open(editor, `/admin/machinery/${ids.machine}`);
    await expect(editor.getByRole("heading", { name: "Used by" })).toBeVisible();
    await expect(editor.getByRole("link", { name: "Test Laser Service" })).toBeVisible();
    // Order: the bending service moves up with the keyboard.
    await open(editor, "/admin/services/order");
    const items = editor.locator(".adm-order-item");
    await expect(items).toHaveText([/Test Laser Service/, /Test Bending Service/]);
    await editor.getByRole("button", { name: "Move Test Bending Service up" }).focus();
    await editor.keyboard.press("Enter");
    await expect(items).toHaveText([/Test Bending Service/, /Test Laser Service/]);
    await expect(editor.getByRole("button", { name: "Move Test Bending Service down" })).toBeFocused();
  });

  test("create a project with a category and a service; restrictions: a Reviewer adds one, only the Owner clears it", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/projects/categories/new");
    await editor.getByLabel("Slug", { exact: true }).fill("demo-steel-works");
    await english(editor).getByLabel(/^Label/).fill("Demo Steel Works");
    await save(editor, "Create project category");
    ids.category = idFrom(editor);
    await open(editor, "/admin/projects/new");
    await editor.getByLabel("Slug", { exact: true }).fill("demo-project");
    await editor.getByLabel("Year").fill("2024");
    await english(editor).getByLabel(/^Title/).fill("Demo Project");
    await english(editor).getByLabel(/^Summary/).fill("A demo project summary for the tests.");
    await editor.getByLabel("Add to categories").selectOption(ids.category);
    await editor.getByRole("group", { name: /^Categories/ }).getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByLabel("Add to services").selectOption(ids["test-laser-service"]);
    await editor.getByRole("group", { name: /^Services/ }).getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByLabel("Featured (working flag)").check();
    await save(editor, "Create project");
    ids.project = idFrom(editor);
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, `/admin/projects/${ids.project}`);
    await expect(english(reviewer).getByLabel(/^Title/)).toBeDisabled();
    await reviewer.getByLabel("Add a restriction").selectOption("rights_pending");
    await reviewer.getByLabel("Note (optional)").fill("Waiting for the test owner.");
    await reviewer.getByRole("button", { name: "Add restriction" }).click();
    await expect(reviewer.locator("#restrictions")).toContainText("Rights or copyright pending");
    await expect(reviewer.locator("#restrictions").getByRole("button", { name: "Clear" })).toHaveCount(0);
    await expect(reviewer.getByText("Only an Owner or Admin can clear a flag.")).toBeVisible();
    // Editor: no Clear button, and a forged clear is refused and audited.
    await open(editor, `/admin/projects/${ids.project}`);
    await expect(editor.locator("#restrictions").getByRole("button", { name: "Clear" })).toHaveCount(0);
    const [flag] = await queryTestDb<{ created_at: Date }>("SELECT created_at FROM project_flags WHERE project_id = ? AND flag = 'rights_pending'", [ids.project]);
    const token = String(new Date(flag.created_at).getTime());
    await forgeAction(editor, "clearFlagAction", { project: ids.project, flag: "rights_pending", token, note: "Forged attempt" });
    expect(await queryTestDb("SELECT flag FROM project_flags WHERE project_id = ?", [ids.project])).toHaveLength(1);
    const [denied] = await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM audit_events WHERE entity_id = ? AND action = 'project.restriction_clear' AND outcome = 'denied'", [ids.project]);
    expect(Number(denied.n)).toBe(1);
    // The Owner clears it with a reason.
    const owner = await as(browser, "owner");
    await open(owner, `/admin/projects/${ids.project}`);
    await owner.locator("#restrictions").getByRole("button", { name: "Clear" }).click();
    const dialog = owner.getByRole("dialog", { name: "Clear “Rights or copyright pending”?" });
    await dialog.getByLabel("Reason (required)").fill("Rights confirmed in the test.");
    await dialog.getByRole("button", { name: "Clear the flag" }).click();
    await expect(owner.locator("#restrictions")).toContainText("No restriction flags.");
    const [cleared] = await queryTestDb<{ changes: string }>("SELECT changes FROM audit_events WHERE entity_id = ? AND action = 'project.restriction_clear' AND outcome = 'success'", [ids.project]);
    expect(JSON.stringify(cleared.changes)).toContain("Rights confirmed in the test.");
  });

  test("a stale page cannot clear a newer restriction", async ({ browser }) => {
    const owner = await as(browser, "owner");
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, `/admin/projects/${ids.project}`);
    await reviewer.getByLabel("Add a restriction").selectOption("hidden");
    await reviewer.getByRole("button", { name: "Add restriction" }).click();
    await expect(reviewer.locator("#restrictions")).toContainText("Hidden");
    await open(owner, `/admin/projects/${ids.project}`);
    const admin = await as(browser, "admin");
    await open(admin, `/admin/projects/${ids.project}`);
    await admin.locator("#restrictions").getByRole("button", { name: "Clear" }).click();
    await admin.getByRole("dialog").getByLabel("Reason (required)").fill("Cleared by the admin.");
    await admin.getByRole("dialog").getByRole("button", { name: "Clear the flag" }).click();
    await expect(admin.locator("#restrictions")).toContainText("No restriction flags.");
    await open(reviewer, `/admin/projects/${ids.project}`);
    await reviewer.getByLabel("Add a restriction").selectOption("hidden");
    await reviewer.getByRole("button", { name: "Add restriction" }).click();
    await expect(reviewer.locator("#restrictions")).toContainText("Hidden");
    // The Owner's page still shows the first "Hidden"; clearing from it is refused.
    await owner.locator("#restrictions").getByRole("button", { name: "Clear" }).click();
    await owner.getByRole("dialog").getByLabel("Reason (required)").fill("From an old page.");
    await owner.getByRole("dialog").getByRole("button", { name: "Clear the flag" }).click();
    await expect(owner.getByRole("dialog").getByRole("alert")).toContainText("This flag was set again after you opened the page.");
    expect(await queryTestDb("SELECT flag FROM project_flags WHERE project_id = ? AND flag = 'hidden'", [ids.project])).toHaveLength(1);
  });

  test("A3 Correction 1: a project can't drop a service that features it — marked before saving, refused on save with the reason", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const service = ids["test-laser-service"];
    // The service features the project (the picker offers it: the project lists the service).
    await open(editor, `/admin/services/${service}`);
    await editor.getByLabel("Add to featured projects").selectOption(ids.project);
    await editor.getByRole("group", { name: /^Featured projects/ }).getByRole("button", { name: "Add", exact: true }).click();
    await save(editor);
    // The project's editor shows the dependency before any save: the mark on the service, the hint, the Used-by panel.
    await open(editor, `/admin/projects/${ids.project}`);
    const services = editor.getByRole("group", { name: /^Services/ });
    await expect(services.getByRole("listitem")).toHaveText([/Test Laser Service.*Features this project/]);
    await expect(services).toContainText("A service marked “Features this project” stays until the project is removed from that service's Featured projects.");
    await expect(editor.locator("#used-by")).toContainText("Services that feature this project");
    await expect(editor.locator("#used-by").getByRole("link", { name: "Test Laser Service" })).toBeVisible();
    // Removing it anyway: refused on save, the reason on the field and in the summary; nothing saved, the form kept.
    const [{ v }] = await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM projects WHERE id = ?", [ids.project]);
    await services.getByRole("button", { name: "Remove Test Laser Service" }).click();
    await expect(services.getByRole("listitem")).toHaveCount(0);
    await editor.getByRole("button", { name: "Save draft" }).click();
    const reason = "This project is currently featured by “Test Laser Service”. Remove it from that service's Featured projects first, then remove the service here.";
    await expect(editor.locator("main").getByRole("alert")).toContainText(reason);
    await expect(services.locator(".adm-error")).toHaveText(reason);
    await expect(services.getByRole("listitem")).toHaveCount(0);
    expect(editor.url()).not.toMatch(/[?&]saved=1/);
    expect(await queryTestDb("SELECT service_id FROM project_services WHERE project_id = ?", [ids.project])).toEqual([{ service_id: service }]);
    expect(await queryTestDb("SELECT project_id FROM service_featured_projects WHERE service_id = ?", [service])).toEqual([{ project_id: ids.project }]);
    const [after] = await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM projects WHERE id = ?", [ids.project]);
    expect(Number(after.v)).toBe(Number(v));
    const [event] = await queryTestDb<{ outcome: string; summary: string }>(
      "SELECT outcome, summary FROM audit_events WHERE entity_id = ? AND action = 'project.update' ORDER BY id DESC LIMIT 1",
      [ids.project],
    );
    expect(event).toEqual({ outcome: "failed", summary: "Refused: removing service “Test Laser Service” (test-laser-service) from this project — it still features the project in its Featured projects." });
  });
});

test.describe("lists, archive, search", () => {
  test("archive and restore a client (Admin); the archived filter; an Editor can't archive", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/clients/new");
    await admin.getByLabel("Slug", { exact: true }).fill("demo-client");
    await english(admin).getByLabel(/^Name/).fill("Demo Client Co.");
    await arabic(admin).getByLabel(/^Name/).fill("شركة العميل التجريبية");
    await admin.getByLabel("Website").fill("http://example.com");
    await admin.getByRole("button", { name: "Create client" }).click();
    await expect(admin.locator("main").getByRole("alert")).toContainText("Only https:// addresses are accepted.");
    await admin.getByLabel("Website").fill("https://example.com");
    await save(admin, "Create client");
    ids.client = idFrom(admin);
    const editor = await as(browser, "editor");
    await open(editor, `/admin/clients/${ids.client}`);
    await expect(editor.getByRole("button", { name: "Archive client" })).toHaveCount(0);
    await admin.getByRole("button", { name: "Archive client" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Archive client" }).click();
    await expect(admin.getByText("Archived (read-only, restorable)")).toBeVisible();
    await expect(english(admin).getByLabel(/^Name/)).toBeDisabled();
    await open(admin, "/admin/clients");
    await expect(admin.getByRole("link", { name: "Demo Client Co." })).toHaveCount(0);
    await open(admin, "/admin/clients?status=archived");
    await expect(admin.getByRole("link", { name: "Demo Client Co." })).toBeVisible();
    await admin.getByRole("link", { name: "Demo Client Co." }).click();
    await admin.locator("main h1").waitFor();
    await admin.getByRole("button", { name: "Restore client" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Restore as a draft" }).click();
    await expect(admin.getByText("Working state").locator("..")).toContainText("Draft");
    const [row] = await queryTestDb<{ publication_status: string; archived_by: string | null }>("SELECT publication_status, archived_by FROM clients WHERE id = ?", [ids.client]);
    expect(row).toEqual({ publication_status: "unpublished", archived_by: null });
  });

  test("search in English and normalized Arabic, the language filter, sorting, and the state in the address", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/services");
    await editor.getByLabel("Search services").fill("bending");
    await editor.getByRole("button", { name: "Apply" }).click();
    await expect(editor).toHaveURL(/\/admin\/services\?q=bending/);
    await expect(editor.getByRole("link", { name: "Test Bending Service" })).toBeVisible();
    await expect(editor.getByRole("link", { name: "Test Laser Service" })).toHaveCount(0);
    await open(editor, `/admin/clients?q=${encodeURIComponent("العميل التجريبيه")}`);
    await expect(editor.getByRole("link", { name: "Demo Client Co." })).toBeVisible();
    await open(editor, "/admin/services?lang=ar-missing");
    await expect(editor.getByRole("link", { name: "Test Laser Service" })).toBeVisible();
    await open(editor, "/admin/projects?restricted=1");
    await expect(editor.getByRole("link", { name: "Demo Project" })).toBeVisible();
    await open(editor, `/admin/projects?category=${ids.category}&featured=1`);
    await expect(editor.getByRole("link", { name: "Demo Project" })).toBeVisible();
    await open(editor, "/admin/services?sort=title&size=10");
    await expect(editor.locator("tbody th a")).toHaveText(["Test Bending Service", "Test Laser Service"]);
  });
});

test.describe("certificates and the media boundary", () => {
  test("certificate metadata: the files note (A4), uploads only inside the media pickers, no publishing, the digit guard", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin/certificates/new");
    await expect(owner.getByText("Public and private files are kept apart.")).toBeVisible();
    await owner.getByLabel("Slug", { exact: true }).fill("test-licence");
    await english(owner).getByLabel(/^Title/).fill("Test Licence 1234567");
    await english(owner).getByLabel(/^Issuer/).fill("Test Body");
    await owner.getByRole("button", { name: "Create certificate" }).click();
    await expect(owner.locator("main").getByRole("alert")).toContainText("registration or certificate number");
    await english(owner).getByLabel(/^Title/).fill("Test Licence");
    await save(owner, "Create certificate");
    for (const path of ["/admin/certificates/new", `/admin/certificates/${idFrom(owner)}`, "/admin/projects/new", "/admin/clients/new", "/admin/services/new"]) {
      await open(owner, path);
      // A4: a file input exists only inside a media picker's dialog (closed until asked for) — none on the page itself.
      await expect(owner.locator('input[type="file"]:visible'), path).toHaveCount(0);
      for (const input of await owner.locator('input[type="file"]').all()) expect(await input.evaluate((el) => !!el.closest("dialog.adm-picker")), path).toBe(true);
      await expect(owner.getByRole("button", { name: /upload|download|publish/i }), path).toHaveCount(0);
    }
  });
});

test.describe("phones, dark mode, accessibility and the CSP", () => {
  test("390 px: the list stacks and the editor works; 320 px: no CMS screen scrolls sideways", async ({ browser }) => {
    const phone = await signedIn(browser, "editor", { viewport: { width: 390, height: 844 } });
    await open(phone, "/admin/services");
    expect(await pageOverflow(phone)).toBeLessThanOrEqual(0);
    expect(await phone.locator("main .adm-cell-title").count()).toBeGreaterThan(0);
    expect(await titleCellsRunTogether(phone), "the stacked rows' title cells at 390 px").toEqual([]);
    await phone.getByRole("link", { name: "Test Laser Service" }).click();
    await phone.locator("main h1").waitFor();
    await english(phone).getByLabel(/^Tagline/).fill("Saved from a phone");
    await save(phone);
    await expect(english(phone).getByLabel(/^Tagline/)).toHaveValue("Saved from a phone");
    await phone.setViewportSize({ width: 320, height: 640 });
    const paths = [
      "/admin",
      "/admin/pages",
      "/admin/pages/new",
      `/admin/pages/${ids.page}`,
      "/admin/services",
      `/admin/services/${ids["test-laser-service"]}`,
      "/admin/services/order",
      "/admin/projects",
      `/admin/projects/${ids.project}`,
      "/admin/projects/categories",
      "/admin/machinery",
      `/admin/machinery/${ids.machine}`,
      "/admin/industries/new",
      "/admin/clients?status=all",
      `/admin/clients/${ids.client}`,
      "/admin/certificates/new",
    ];
    for (const path of paths) {
      await open(phone, path);
      expect(await pageOverflow(phone), path).toBeLessThanOrEqual(0);
      expect(await titleCellsRunTogether(phone), path).toEqual([]);
    }
    // The stale message, with its two long button labels, fits 320 px too (they wrap instead of widening the page).
    await open(phone, `/admin/pages/${ids.page}`);
    const admin = await as(browser, "admin");
    await open(admin, `/admin/pages/${ids.page}`);
    await english(admin).getByLabel(/^Navigation label/).fill("Changed while a phone had the page open");
    await save(admin);
    await english(phone).getByLabel(/^Navigation label/).fill("The phone's older form");
    await phone.getByRole("button", { name: "Save draft" }).click();
    await expect(phone.locator("main").getByRole("alert")).toContainText("This content changed after you opened it.");
    expect(await pageOverflow(phone), "the stale message at 320 px").toBeLessThanOrEqual(0);
    await phone.context().close();
  });

  test("dark mode follows the system; axe finds nothing on a list and an editor; no inline styles (CSP)", async ({ browser }) => {
    const dark = await signedIn(browser, "admin", { colorScheme: "dark" });
    for (const path of ["/admin/projects", `/admin/projects/${ids.project}`, "/admin/services/order", "/admin"]) {
      await open(dark, path);
      const background = await dark.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(background, path).toBe("rgb(14, 18, 23)");
      expect(await axe(dark), path).toEqual([]);
      const styled = await dark.evaluate(() => [...document.querySelectorAll("[style]")].filter((e) => e.localName !== "next-route-announcer").length);
      expect(styled, path).toBe(0);
    }
    const html = await (await dark.request.get(`/admin/projects/${ids.project}`)).text();
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle=/i);
    await dark.context().close();
  });
});

/** A database stand-in that counts connection attempts and refuses each one. */
async function countingDatabase(): Promise<{ port: number; attempts: () => number; close: () => Promise<void> }> {
  let attempts = 0;
  const db: Server = createServer((socket) => {
    attempts++;
    socket.destroy();
  });
  await new Promise<void>((done) => db.listen(0, "127.0.0.1", done));
  return {
    port: (db.address() as { port: number }).port,
    attempts: () => attempts,
    close: () => new Promise<void>((done) => db.close(() => done())),
  };
}

/** server.js on this build, in production mode with the given admin setting, against the counting stand-in. */
async function startGateServer(port: number, dbPort: number, settings: Record<string, string>) {
  const child: ChildProcess = spawn(process.execPath, [join(ROOT, "server.js")], {
    cwd: ROOT,
    stdio: "ignore",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DB_HOST: "127.0.0.1",
      DB_PORT: String(dbPort),
      DB_USER: "gate_test",
      DB_PASSWORD: "",
      DB_NAME: "rawasy_gate_test",
      AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      AUTH_ENCRYPTION_KEY_VERSION: "1",
      TRUSTED_PROXY_HOPS: "0",
      ADMIN_BASE_URL: "https://admin.example.test",
      ...settings,
    },
  });
  const client = await apiRequest.newContext({ baseURL: `http://127.0.0.1:${port}` });
  for (let i = 0; ; i++) {
    try {
      if ((await client.get("/robots.txt", { timeout: 2000 })).ok()) break;
    } catch {
      // not listening yet
    }
    if (i > 150) throw new Error("server.js did not start");
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    client,
    stop: async () => {
      await client.dispose();
      await new Promise<void>((done) => {
        child.once("exit", () => done());
        child.kill("SIGTERM");
      });
    },
  };
}

const GATE_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
/**
 * Every A3 Server Action as a forged request: the admin's origin and a session cookie (a made-up token, so with the admin
 * on the action looks it up in the database — the "on" test shows each one reaching it), in React's reply encoding. A
 * FormData keeps the order the server needs (an object would send the integer key "0" first).
 */
function cmsActionRequests() {
  return (
    [
      ["saveContentAction", { _type: "service", slug: "x", serviceGroup: "metal", iconKey: "fabrication" }],
      ["setArchivedAction", { type: "service", id: GATE_ID, version: "0", archived: "1" }],
      ["addFlagAction", { project: GATE_ID, flag: "hidden", note: "" }],
      ["clearFlagAction", { project: GATE_ID, flag: "hidden", token: "1", note: "x" }],
      // Malformed input is answered only after the admin's own checks (A3 security review, finding 5).
      ["saveContentAction", { _type: "not-a-type" }],
    ] as const
  ).map(([name, fields]) => {
    const multipart = new FormData();
    for (const [k, v] of Object.entries(fields)) multipart.append(`_1_${k}`, v);
    multipart.append("0", '[{"status":"idle"},"$K1"]');
    const headers = {
      "next-action": actionId(name),
      origin: "https://admin.example.test",
      "x-forwarded-host": "admin.example.test",
      accept: "text/x-component",
      cookie: `__Host-rawasy_admin=${"A".repeat(43)}`,
    };
    return { name, options: { headers, multipart, maxRedirects: 0 } };
  });
}
// moveContentAction takes a plain object (the order page calls it directly): React's encoding of one argument.
function moveRequest() {
  const multipart = new FormData();
  multipart.append("0", JSON.stringify([{ type: "service", id: GATE_ID, direction: "up", version: 0 }]));
  return {
    headers: {
      "next-action": actionId("moveContentAction"),
      origin: "https://admin.example.test",
      "x-forwarded-host": "admin.example.test",
      accept: "text/x-component",
      cookie: `__Host-rawasy_admin=${"A".repeat(43)}`,
    },
    multipart,
    maxRedirects: 0,
  };
}

const A3_ROUTES = [
  "/admin/pages",
  "/admin/pages/new",
  `/admin/pages/${GATE_ID}`,
  "/admin/services",
  "/admin/services/new",
  "/admin/services/order",
  `/admin/services/${GATE_ID}`,
  "/admin/projects",
  "/admin/projects/new",
  "/admin/projects/order",
  `/admin/projects/${GATE_ID}`,
  "/admin/projects/categories",
  "/admin/projects/categories/new",
  "/admin/projects/categories/order",
  `/admin/projects/categories/${GATE_ID}`,
  "/admin/machinery",
  "/admin/machinery/new",
  "/admin/machinery/order",
  `/admin/machinery/${GATE_ID}`,
  "/admin/industries",
  "/admin/industries/new",
  "/admin/industries/order",
  `/admin/industries/${GATE_ID}`,
  "/admin/clients",
  "/admin/clients/new",
  "/admin/clients/order",
  `/admin/clients/${GATE_ID}`,
  "/admin/certificates",
  "/admin/certificates/new",
  "/admin/certificates/order",
  `/admin/certificates/${GATE_ID}`,
];

test.describe("the admin gate", () => {
  test("off (production without ADMIN_ENABLED): every A3 route is the public 404 path and no CMS action runs", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3431, db.port, { APP_ENV: "production" });
    try {
      const { client } = server;
      for (const path of A3_ROUTES) {
        const r = await client.get(path, { maxRedirects: 0 });
        expect(r.status(), path).toBe(307);
        expect(r.headers().location, path).toBe(`/en${path}`);
        expect(r.headers()["content-security-policy"], path).toBeUndefined();
        expect((await client.get(`/en${path}`)).status(), path).toBe(404);
      }
      for (const { name, options } of cmsActionRequests()) {
        const atAdmin = await client.post("/admin/services", options);
        expect(atAdmin.status(), name).toBe(307);
        // Posted to a public page, Next hands the action to the page that has it: the gate stops it before it answers.
        const forwarded = await client.post("/en", options);
        expect(await forwarded.text(), name).not.toContain("Unknown content type");
      }
      expect((await client.post("/admin/services/order", moveRequest())).status()).toBe(307);
      await client.post("/en", moveRequest());
      expect(db.attempts(), "no database connection was attempted").toBe(0);
    } finally {
      await server.stop();
      await db.close();
    }
  });

  test("on (production, ADMIN_ENABLED=1): the same requests reach the database, so “off” means the gate stopped them", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3432, db.port, { APP_ENV: "production", ADMIN_ENABLED: "1" });
    try {
      const { client } = server;
      for (const { name, options } of [...cmsActionRequests(), { name: "moveContentAction", options: moveRequest() }]) {
        for (const path of ["/admin/services", "/en"]) {
          const before = db.attempts();
          await client.post(path, options);
          expect(db.attempts(), `${name} at ${path}`).toBeGreaterThan(before);
        }
      }
    } finally {
      await server.stop();
      await db.close();
    }
  });
});
