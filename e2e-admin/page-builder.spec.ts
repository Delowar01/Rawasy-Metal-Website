/**
 * The page builder (Phase A5) end to end, on the production build against the admin suite's local MariaDB and its
 * temporary RAWASY_DATA_DIR (e2e-admin/server.mjs): Pages → the builder, a generic page's layout set up, blocks added
 * from the library, English and Arabic texts, structured rich text, reorder, undo and redo, the unsaved-changes warning,
 * the remove confirmation, the media picker and the focal point in the preview, a projects grid chosen by hand and
 * automatically, hidden and phone-only sections, the preview's widths, themes and languages, the site's own page (About)
 * for an Editor and an Owner, a service's layout, reusable sections (create, link, used by, detach, archive), the stale
 * editor, a Reviewer, phones at 390 and 320 px, axe, the preview in a new tab and its headers, anonymous access, and
 * every A5 address and action behind the ADMIN_ENABLED gate. No mutation is faked: every change goes through the pages
 * and Server Actions. Test data only ("Test …") and the release's own approved photos (imported by A4's importer).
 *
 * Named to run after media.spec.ts: the release import adds the site's own media to the shared database, which the
 * media spec's pickers must not see.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { expect, request as apiRequest, test, type Browser, type BrowserContext, type FrameLocator, type Page } from "@playwright/test";
import { cli, cliEnv, freshCode, queryTestDb } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "builder.owner@example.test", name: "Test Builder Owner", password: "builder owner phrase canyon", mfa: true },
  admin: { email: "builder.admin@example.test", name: "Test Builder Admin", password: "builder admin phrase harbour", mfa: true },
  editor: { email: "builder.editor@example.test", name: "Test Builder Editor", password: "builder editor phrase meadow", mfa: false },
  reviewer: { email: "builder.reviewer@example.test", name: "Test Builder Reviewer", password: "builder reviewer phrase lantern", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
const ids: Record<string, string> = {};
const ULID_IN_URL = /\/([0-9A-HJKMNP-TV-Z]{26})(?:[/?]|$)/;
const STALE = "This page layout changed after you opened it. Reload and review the latest version before saving.";

async function signedIn(browser: Browser, role: Role, options: { viewport?: { width: number; height: number }; colorScheme?: "light" | "dark" } = {}): Promise<Page> {
  const context: BrowserContext = await browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 860 }, colorScheme: options.colorScheme ?? "light" });
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

/** Opens an admin address and waits for its content (admin pages stream in after a loading skeleton). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main :is(h1, h2)").first().waitFor();
}

const idFrom = (page: Page) => ULID_IN_URL.exec(new URL(page.url()).pathname + "?")?.[1] ?? "";
const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Elements of the page (the preview canvas and visually hidden text aside) that end past the screen's right edge. */
const pastTheScreen = (page: Page) =>
  page.locator("main *").evaluateAll((els) =>
    els.filter((e) => !e.closest(".adm-bld-canvas, .adm-sr-only") && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((e) => e.className),
  );
const english = (page: Page) => page.locator("#english");

// --- The builder's parts -----------------------------------------------------------------------------------------------------

const chip = (page: Page) => page.locator(".adm-bld-save");
const outline = (page: Page) => page.locator(".adm-bld-outline");
const inspector = (page: Page) => page.locator(".adm-bld-inspector");
const cards = (page: Page) => page.locator(".adm-bld-card");
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const card = (page: Page, label: string) => cards(page).filter({ has: page.locator(".adm-bld-card-title .adm-link-btn", { hasText: exactly(label) }) });
const frame = (page: Page): FrameLocator => page.frameLocator("iframe.adm-bld-frame");
const cardTitles = (page: Page) => page.locator(".adm-bld-card-title .adm-link-btn").allTextContents();
/** A JSON column as the driver returns it (mysql2 parses MariaDB's JSON columns; older pairs return the text). */
const json = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);

async function builder(page: Page, path: string) {
  await open(page, path);
  await page.locator(".adm-bld").waitFor();
}

/** Adds a block from the library (opened if closed). */
async function addBlock(page: Page, label: string) {
  const library = page.locator(".adm-bld-library");
  if (!(await library.evaluate((el) => (el as HTMLDetailsElement).open))) await library.locator("summary").click();
  await library.getByRole("button", { name: `Add “${label}”`, exact: true }).click();
}

/** Saves the layout and waits until the builder has reloaded the stored version. */
async function saveLayout(page: Page) {
  const before = new URL(page.url()).searchParams.get("v");
  await page.getByRole("button", { name: "Save layout" }).click();
  await page.waitForURL((url) => url.searchParams.get("done") === "saved" && url.searchParams.get("v") !== before);
  await expect(chip(page)).toHaveText("Saved");
  await expect(page.locator(".adm-bld-grid")).not.toHaveAttribute("inert", /.*/);
}

/** The preview frame's document, once its sections are found (its bridge says "ready" to the builder). */
async function previewReady(page: Page) {
  const f = frame(page);
  await f.locator("main").first().waitFor();
  return f;
}

/** The id of a stored section by its block type and title text (from the database). */
async function sectionIds(ownerColumn: "page_id" | "service_id", owner: string): Promise<{ id: string; block_type: string; position: number; is_visible: number }[]> {
  return queryTestDb(`SELECT id, block_type, position, is_visible FROM page_sections WHERE ${ownerColumn} = ? ORDER BY position`, [owner]);
}

const AXE = require.resolve("axe-core/axe.min.js");
async function axe(page: Page) {
  await page.evaluate(readFileSync(AXE, "utf8"));
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (c: unknown, o: object) => Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } }).axe.run(
      { exclude: [["iframe.adm-bld-frame"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, iframes: false },
    );
    return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);
  });
}

// --- Set-up ----------------------------------------------------------------------------------------------------------------

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
  // The release's own media (A4's importer: idempotent); one approved photo gets a focal point for the preview.
  cli("media-import-release.mjs", []);
  const [photo] = await queryTestDb<{ id: string }>("SELECT id FROM media_assets WHERE legacy_key = 'projects/chandelier-1' AND usage_status = 'approved'");
  ids.photo = photo.id;
  await queryTestDb("UPDATE media_assets SET focal_x = 0.25, focal_y = 0.75 WHERE id = ?", [ids.photo]);
});

test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

test.afterAll(async () => {
  for (const page of Object.values(pages)) await page?.context().close();
});

// --- A generic page ---------------------------------------------------------------------------------------------------------

test.describe("a generic page", () => {
  test("Pages → Edit page layout → set up: outline, preview and inspector side by side at 1280", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/pages/new");
    await editor.getByRole("link", { name: "New generic page" }).click();
    await editor.getByLabel("Slug", { exact: true }).fill("test-builder-page");
    await english(editor).getByLabel(/^Title/).fill("Test Builder Page");
    await editor.getByRole("button", { name: "Create page" }).click();
    await editor.waitForURL(/created=1/);
    ids.page = idFrom(editor);
    await editor.getByRole("link", { name: "Edit page layout" }).click();
    await editor.waitForURL(`**/admin/pages/${ids.page}/builder`);
    await expect(editor.getByRole("heading", { level: 1 })).toHaveText("Layout: Test Builder Page");
    await expect(editor.getByText("Working layout only: the public website does not use it")).toBeVisible();
    await expect(outline(editor)).toContainText("This layout is not set up yet.");
    await editor.getByRole("button", { name: "Set up this layout" }).click();
    await editor.waitForURL(/done=setup/);
    await expect(editor.getByRole("status").filter({ hasText: "The layout is set up with its required sections." })).toBeVisible();
    expect(await cardTitles(editor)).toEqual(["Page opening"]);
    await expect(card(editor, "Page opening").locator(".adm-bld-lock")).toContainText("Locked structure");
    // Desktop: the three panels in one row, no view tabs.
    await expect(editor.getByRole("group", { name: "Builder view" })).toBeHidden();
    const boxes = await Promise.all([outline(editor), editor.locator(".adm-bld-preview"), inspector(editor)].map((l) => l.boundingBox()));
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
    expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(2);
    const iframe = editor.locator("iframe.adm-bld-frame");
    await expect(iframe).toHaveAttribute("title", "Preview of Test Builder Page");
    // Sandboxed: scripts and its own origin only, so nothing inside it can navigate the builder (security review F6).
    await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
    await expect(iframe).toHaveAttribute("src", new RegExp(`^/admin/preview/page/${ids.page}\\?locale=en&theme=light&device=desktop&frame=1&v=\\d+$`));
    expect(await pageOverflow(editor)).toBe(0);
  });

  test("blocks from the library, English and Arabic texts, rich text, reorder and save: the preview draws them", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await addBlock(editor, "Heading");
    await expect(chip(editor)).toHaveText("Unsaved changes");
    await expect(inspector(editor).getByRole("heading", { level: 2 })).toHaveText("Heading");
    await inspector(editor).getByLabel(/^Title/).fill("Test builder heading");
    await inspector(editor).getByRole("button", { name: /^Arabic/ }).click();
    const arTitle = inspector(editor).getByLabel(/^Title/);
    await expect(arTitle).toHaveAttribute("dir", "rtl");
    await expect(arTitle).toHaveAttribute("lang", "ar");
    await arTitle.fill("عنوان تجريبي للمنشئ");
    await inspector(editor).getByRole("button", { name: /^English/ }).click();
    await expect(inspector(editor).getByLabel(/^Title/)).toHaveValue("Test builder heading");

    await addBlock(editor, "Text");
    await inspector(editor).getByLabel(/^Title/).fill("Test formatted text");
    const rich = inspector(editor).locator("fieldset.adm-bld-rich");
    await rich.getByRole("button", { name: "Add a paragraph" }).click();
    const block = rich.locator(".adm-bld-rich-block textarea").first();
    await block.fill("Test words in bold here.");
    await block.evaluate((el: HTMLTextAreaElement) => {
      el.focus();
      el.setSelectionRange(14, 18);
    });
    await rich.getByRole("button", { name: "Bold", exact: true }).click();
    await expect(rich.locator(".adm-bld-rich-marks li")).toHaveText(/Bold: “bold”/);
    await expect(rich.locator(".adm-bld-rich-preview strong")).toHaveText("bold");
    // Typed markup is text, and the server refuses it (plain text only): nothing to strip later.
    expect(await cardTitles(editor)).toEqual(["Page opening", "Heading", "Text"]);
    await card(editor, "Text").getByRole("button", { name: "Move “Text” up" }).click();
    expect(await cardTitles(editor)).toEqual(["Page opening", "Text", "Heading"]);
    await expect(editor.getByRole("status").filter({ hasText: "Moved “Text” to position 2 of 3." }).first()).toBeAttached();
    await saveLayout(editor);
    await expect(editor.getByRole("status").filter({ hasText: "Layout saved." })).toBeVisible();

    const stored = await sectionIds("page_id", ids.page);
    expect(stored.map((s) => s.block_type)).toEqual(["generic.hero", "generic.rich_text", "generic.heading"]);
    const f = await previewReady(editor);
    const text = f.locator(`[data-section="${stored[1].id}"]`);
    const heading = f.locator(`[data-section="${stored[2].id}"]`);
    await expect(text).toContainText("Test formatted text");
    await expect(text.locator("strong")).toHaveText("bold");
    await expect(heading).toContainText("Test builder heading");
    expect(await f.locator("[data-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section")))).toEqual(expect.arrayContaining([stored[1].id, stored[2].id]));
    const order = await f.locator(`[data-section="${stored[1].id}"], [data-section="${stored[2].id}"]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section")));
    expect(order).toEqual([stored[1].id, stored[2].id]);
    // Arabic: the frame is the Arabic page, right to left.
    await editor.getByLabel("Preview language").selectOption("ar");
    await expect(editor.locator("iframe.adm-bld-frame")).toHaveAttribute("src", /locale=ar/);
    const ar = await previewReady(editor);
    await expect(ar.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(ar.locator(`[data-section="${stored[2].id}"]`)).toContainText("عنوان تجريبي للمنشئ");
    await editor.getByLabel("Preview language").selectOption("en");
  });

  test("undo and redo; the unsaved-changes warning; removing a section that holds repeated items asks first", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await expect(editor.getByRole("button", { name: "Undo" })).toBeDisabled();
    await addBlock(editor, "Feature cards");
    expect(await cards(editor).count()).toBe(4);
    await editor.getByRole("button", { name: "Undo" }).click();
    expect(await cards(editor).count()).toBe(3);
    await expect(chip(editor)).toHaveText("Saved");
    await editor.getByRole("button", { name: "Redo" }).click();
    expect(await cards(editor).count()).toBe(4);
    await expect(chip(editor)).toHaveText("Unsaved changes");
    // Leaving through an admin link asks first; cancelling stays on the builder with the edits.
    const asked: string[] = [];
    editor.once("dialog", (d) => {
      asked.push(d.message());
      void d.dismiss();
    });
    await editor.locator(".adm-side").getByRole("link", { name: "Pages", exact: true }).click();
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toBe("You have unsaved changes. Leave this page and lose them?");
    expect(new URL(editor.url()).pathname).toBe(`/admin/pages/${ids.page}/builder`);
    // Remove: the cards hold repeated items, so the builder asks.
    await card(editor, "Feature cards").getByRole("button", { name: "Remove “Feature cards”" }).click();
    const dialog = editor.getByRole("dialog", { name: "Remove “Feature cards”?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("It holds");
    await dialog.getByRole("button", { name: "Keep it" }).click();
    expect(await cards(editor).count()).toBe(4);
    await card(editor, "Feature cards").getByRole("button", { name: "Remove “Feature cards”" }).click();
    await dialog.getByRole("button", { name: "Remove the section" }).click();
    expect(await cardTitles(editor)).toEqual(["Page opening", "Text", "Heading"]);
    await expect(chip(editor)).toHaveText("Saved");
    // Keyboard: Ctrl+Z outside a text field undoes the removal.
    await editor.locator("body").click({ position: { x: 5, y: 5 } });
    await editor.keyboard.press("Control+z");
    expect(await cards(editor).count()).toBe(4);
    // One step is left (the added section); then the history is at the stored layout.
    await editor.getByRole("button", { name: "Undo" }).click();
    expect(await cards(editor).count()).toBe(3);
    await expect(editor.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(chip(editor)).toHaveText("Saved");
  });

  test("a photo from the media picker at its focal point; hidden and phone-only sections; widths and themes of the preview", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await addBlock(editor, "Image");
    await inspector(editor).getByRole("button", { name: "Choose…" }).click();
    const picker = editor.getByRole("dialog", { name: "Choose: Photo" });
    await picker.getByLabel("Search media").fill("chandelier-1");
    await picker.getByRole("button", { name: "Search", exact: true }).click();
    await picker.locator("button.adm-pick").filter({ hasText: "chandelier-1" }).first().click();
    await expect(picker).toBeHidden();
    await expect(inspector(editor).locator(".adm-bld-media-card")).toContainText("chandelier-1");
    await inspector(editor).getByLabel("Shape").selectOption("1x1");
    await inspector(editor).getByLabel(/^Alt text/).fill("Test chandelier photo");
    await addBlock(editor, "Heading");
    await inspector(editor).getByLabel(/^Title/).fill("Test phone only");
    await inspector(editor).getByLabel("Desktop", { exact: true }).uncheck();
    await inspector(editor).getByLabel("Tablet", { exact: true }).uncheck();
    // The last screen can't be switched off while the section is shown.
    await expect(inspector(editor).getByLabel("Phone", { exact: true })).toBeDisabled();
    await card(editor, "Text").getByRole("button", { name: "Hide “Text”" }).click();
    await expect(card(editor, "Text").locator(".adm-badge", { hasText: "Hidden" })).toBeVisible();
    await saveLayout(editor);
    const stored = await sectionIds("page_id", ids.page);
    const image = stored.find((s) => s.block_type === "generic.image")!;
    const text = stored.find((s) => s.block_type === "generic.rich_text")!;
    expect(text.is_visible).toBe(0);

    let f = await previewReady(editor);
    const img = f.locator(`[data-section="${image.id}"] img`);
    await expect(img).toHaveAttribute("alt", "Test chandelier photo");
    expect(await img.evaluate((el) => getComputedStyle(el).objectPosition)).toBe("25% 75%");
    await expect(f.getByText("Test phone only")).toHaveCount(0);
    await expect(f.locator(`[data-section="${text.id}"]`)).toHaveCount(0);
    // Tablet and phone widths: the frame takes the width, the phone shows the phone-only section.
    for (const [label, width, device] of [
      ["Tablet (768)", 768, "tablet"],
      ["Phone (390)", 390, "mobile"],
      ["Small phone (320)", 320, "mobile"],
    ] as const) {
      await editor.getByLabel("Preview width").selectOption({ label });
      const iframe = editor.locator("iframe.adm-bld-frame");
      await expect(iframe).toHaveAttribute("src", new RegExp(`device=${device}`));
      await expect.poll(() => iframe.evaluate((el) => (el as HTMLElement).style.width)).toBe(`${width}px`);
      f = await previewReady(editor);
      if (device === "mobile") await expect(f.getByText("Test phone only")).toBeVisible();
      else await expect(f.getByText("Test phone only")).toHaveCount(0);
      expect(await f.locator("html").evaluate(() => window.innerWidth)).toBe(width);
    }
    await editor.getByLabel("Preview theme").selectOption("dark");
    f = await previewReady(editor);
    await expect(f.locator("html")).toHaveAttribute("data-theme", "dark");
    await editor.getByLabel("Preview theme").selectOption("light");
    await editor.getByLabel("Preview width").selectOption({ label: "Desktop (1280)" });
    // The outline says where each section shows.
    await expect(card(editor, "Heading").last().locator(".adm-badge", { hasText: "Phone" })).toBeVisible();
  });

  test("a projects grid: chosen by hand in an order, then automatically", async ({ browser }) => {
    const editor = await as(browser, "editor");
    for (const [slug, title] of [
      ["test-builder-project-a", "Test Builder Project A"],
      ["test-builder-project-b", "Test Builder Project B"],
    ]) {
      await open(editor, "/admin/projects/new");
      await editor.getByLabel("Slug", { exact: true }).fill(slug);
      await english(editor).getByLabel(/^Title/).fill(title);
      await english(editor).getByLabel(/^Summary/).fill(`${title} summary.`);
      await editor.getByRole("button", { name: "Create project" }).click();
      await editor.waitForURL(/created=1/);
      ids[slug] = idFrom(editor);
    }
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await addBlock(editor, "Projects grid");
    await inspector(editor).getByLabel(/^Title/).fill("Test chosen projects");
    const field = inspector(editor).getByRole("group", { name: /^Projects/ });
    // A new grid starts on the registry's default (the featured projects, automatically).
    await expect(field.getByLabel("Automatic")).toBeChecked();
    await expect(field.getByLabel("Which")).toHaveValue("featured");
    await field.getByLabel("Chosen by hand, in this order").check();
    await field.getByLabel(/^Add \(0 of at most/).selectOption({ label: "Test Builder Project B" });
    await field.getByLabel(/^Add \(1 of at most/).selectOption({ label: "Test Builder Project A" });
    await expect(field.locator(".adm-bld-list-name")).toHaveText(["Test Builder Project B", "Test Builder Project A"]);
    await field.getByRole("button", { name: "Move Test Builder Project A up" }).click();
    await expect(field.locator(".adm-bld-list-name")).toHaveText(["Test Builder Project A", "Test Builder Project B"]);
    await saveLayout(editor);
    const grid = (await sectionIds("page_id", ids.page)).find((s) => s.block_type === "generic.projects_grid")!;
    let f = await previewReady(editor);
    await expect(f.locator(`[data-section="${grid.id}"] .gb-record-body h3`)).toHaveText(["Test Builder Project A", "Test Builder Project B"]);
    // Automatic: the collection's own order; the selection is stored as a source, never a list of ids.
    await card(editor, "Projects grid").getByRole("button", { name: "Edit “Projects grid”" }).click();
    await inspector(editor).getByRole("group", { name: /^Projects/ }).getByLabel("Automatic").check();
    await expect(inspector(editor).getByLabel("Which")).toHaveValue("all");
    await saveLayout(editor);
    const [row] = await queryTestDb<{ settings: unknown }>("SELECT settings FROM page_sections WHERE id = ?", [grid.id]);
    expect((json(row.settings) as { projects: unknown }).projects).toMatchObject({ mode: "automatic", source: "all" });
    f = await previewReady(editor);
    await expect(f.locator(`[data-section="${grid.id}"]`)).toContainText("Test Builder Project");
  });

  test("two people on one layout: the second save is refused with the exact message, and the edits stay until a reload", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const owner = await as(browser, "owner");
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await builder(owner, `/admin/pages/${ids.page}/builder`);
    await card(owner, "Image").getByRole("button", { name: "Move “Image” down" }).click();
    await saveLayout(owner);
    await card(editor, "Text").getByRole("button", { name: "Show “Text”" }).click();
    await editor.getByRole("button", { name: "Save layout" }).click();
    const alert = editor.locator(".adm-bld").getByRole("alert");
    await expect(alert).toContainText(STALE);
    await expect(chip(editor)).toHaveText("Changed elsewhere: not saved");
    await expect(card(editor, "Text").locator(".adm-badge", { hasText: "Hidden" })).toHaveCount(0);
    editor.once("dialog", (d) => void d.accept());
    await alert.getByRole("button", { name: "Reload the latest version" }).click();
    await editor.waitForLoadState("load");
    await editor.locator(".adm-bld").waitFor();
    await expect(card(editor, "Text").locator(".adm-badge", { hasText: "Hidden" })).toBeVisible();
    const [event] = await queryTestDb<{ outcome: string }>("SELECT outcome FROM audit_events WHERE entity_type = 'page' AND entity_id = ? ORDER BY id DESC LIMIT 1", [ids.page]);
    expect(event.outcome).toBe("failed");
  });
});

// --- The site's own pages, services, reusable sections -----------------------------------------------------------------------

test.describe("the site's own pages and services", () => {
  test("About: an Editor edits its texts but not its structure; an Owner hides what the registry allows; locked parts say why", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin/pages/new");
    await owner.getByRole("link", { name: /^About/ }).click();
    await english(owner).getByLabel(/^Title/).fill("Test About");
    await owner.getByRole("button", { name: "Create page" }).click();
    await owner.waitForURL(/created=1/);
    ids.about = idFrom(owner);
    await builder(owner, `/admin/pages/${ids.about}/builder`);
    await owner.getByRole("button", { name: "Set up this layout" }).click();
    await owner.waitForURL(/done=setup/);
    expect(await cardTitles(owner)).toEqual(expect.arrayContaining(["Page opening", "Who RAWASY is", "Engineering approach", "Closing call to action"]));

    const editor = await as(browser, "editor");
    await builder(editor, `/admin/pages/${ids.about}/builder`);
    await expect(outline(editor).locator(".adm-bld-lock").first()).toContainText("changing its structure (adding, moving, hiding or removing sections, anchors, reusable links) needs a permission you don't hold");
    await expect(editor.locator(".adm-bld-library")).toHaveCount(0);
    await expect(card(editor, "Who RAWASY is").getByRole("button")).toHaveText(["Who RAWASY is", "Edit"]);
    await card(editor, "Who RAWASY is").getByRole("button", { name: "Edit “Who RAWASY is”" }).click();
    await expect(inspector(editor).getByLabel("Show this section")).toBeDisabled();
    await inspector(editor).getByLabel(/^Title/).fill("Test who we are");
    await saveLayout(editor);
    const [row] = await queryTestDb<{ content: unknown }>(
      "SELECT t.content FROM page_section_translations t JOIN page_sections s ON s.id = t.section_id WHERE s.page_id = ? AND s.block_type = 'about.overview' AND t.locale = 'en'",
      [ids.about],
    );
    expect((json(row.content) as { title: unknown }).title).toBe("Test who we are");

    await builder(owner, `/admin/pages/${ids.about}/builder`);
    const opening = card(owner, "Page opening");
    await expect(opening.getByRole("button", { name: "Move “Page opening” down" })).toBeDisabled();
    await expect(opening.getByRole("button", { name: "Remove “Page opening”" })).toBeDisabled();
    await expect(opening.locator(".adm-bld-lock")).toContainText("This block provides the page's required main heading.");
    await expect(card(owner, "Who RAWASY is").getByRole("button", { name: "Remove “Who RAWASY is”" })).toBeDisabled();
    await card(owner, "Engineering approach").getByRole("button", { name: "Hide “Engineering approach”" }).click();
    await saveLayout(owner);
    const approach = (await sectionIds("page_id", ids.about)).find((s) => s.block_type === "about.approach")!;
    expect(approach.is_visible).toBe(0);
    const f = await previewReady(owner);
    await expect(f.locator("#overview")).toHaveCount(1);
    await expect(f.locator("#approach")).toHaveCount(0);
  });

  test("a service: set up from its template by an Admin, who moves its parts; an Editor edits its texts only", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/services/new");
    await editor.getByLabel("Slug", { exact: true }).fill("test-builder-service");
    await editor.getByLabel("Section", { exact: true }).selectOption("metal");
    await editor.getByLabel("Icon / drawing").selectOption("laser-cutting");
    await english(editor).getByLabel(/^Name/).fill("Test Builder Service");
    await editor.getByRole("button", { name: "Create service" }).click();
    await editor.waitForURL(/created=1/);
    ids.service = idFrom(editor);
    await editor.getByRole("link", { name: "Edit page layout" }).click();
    await editor.waitForURL(`**/admin/services/${ids.service}/builder`);
    await expect(outline(editor)).toContainText("An Owner or Admin sets it up");
    const admin = await as(browser, "admin");
    await builder(admin, `/admin/services/${ids.service}/builder`);
    await admin.getByRole("button", { name: "Set up this layout" }).click();
    await admin.waitForURL(/done=setup/);
    const titles = await cardTitles(admin);
    expect(titles[0]).toBe("Service opening");
    expect(titles).toEqual(expect.arrayContaining(["Service overview", "What we provide", "Service call to action"]));
    // The first part the registry lets move: moved down one place by the Admin.
    let second = "";
    for (const title of titles.slice(1, -1)) {
      const down = card(admin, title).getByRole("button", { name: `Move “${title}” down` });
      // A part the registry keeps in place shows no move buttons at all.
      if ((await down.count()) === 1 && (await down.isEnabled())) {
        second = title;
        await down.click();
        break;
      }
    }
    expect(second, "a movable part of the service page").not.toBe("");
    const at = titles.indexOf(second);
    await saveLayout(admin);
    expect((await cardTitles(admin))[at + 1]).toBe(second);
    await builder(editor, `/admin/services/${ids.service}/builder`);
    await expect(card(editor, second).getByRole("button", { name: `Move “${second}” down` })).toHaveCount(0);
    await card(editor, "Service opening").getByRole("button", { name: "Edit “Service opening”" }).click();
    await expect(inspector(editor).locator(".adm-bld-group").first()).toBeVisible();
  });

  test("reusable sections: create, edit, link into a page, used by, detach, archive once unused", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/reusable-sections");
    await editor.getByRole("link", { name: "New reusable section" }).click();
    await editor.getByLabel("Name (shown in the admin only)").fill("Test reusable call to action");
    await editor.locator(".adm-choice", { hasText: "Call to action" }).first().locator("input").check();
    await editor.getByRole("button", { name: "Create the reusable section" }).click();
    await editor.waitForURL(/\/admin\/reusable-sections\/[0-9A-Z]{26}\?created=1/);
    ids.reusable = idFrom(editor);
    await inspector(editor).getByLabel(/^Title/).fill("Test reusable title");
    const before = new URL(editor.url()).searchParams.get("v");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await editor.waitForURL((url) => url.searchParams.get("done") === "saved" && url.searchParams.get("v") !== before);
    await expect(editor.getByRole("status").filter({ hasText: "Saved. Every page and service that links it" })).toBeVisible();

    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await editor.locator(".adm-bld-library summary").click();
    await editor.getByRole("button", { name: "Link “Test reusable call to action”" }).click();
    await expect(card(editor, "Call to action").locator(".adm-badge", { hasText: "Reusable: Test reusable call to action" })).toBeVisible();
    await saveLayout(editor);
    let f = await previewReady(editor);
    await expect(f.locator("main")).toContainText("Test reusable title");

    await open(editor, `/admin/reusable-sections/${ids.reusable}`);
    await expect(editor.locator(".adm-bld-inspector")).toContainText("Used by 1 section.");
    await expect(editor.getByRole("link", { name: /Test Builder Page/ })).toHaveAttribute("href", `/admin/pages/${ids.page}/builder`);

    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await card(editor, "Call to action").getByRole("button", { name: "Edit “Call to action”" }).click();
    await inspector(editor).getByRole("button", { name: "Detach (make a local copy)" }).click();
    await editor.waitForURL(/done=detached/);
    await expect(card(editor, "Call to action").locator(".adm-badge", { hasText: /^Reusable:/ })).toHaveCount(0);
    f = await previewReady(editor);
    await expect(f.locator("main")).toContainText("Test reusable title");
    const [section] = await queryTestDb<{ reusable_section_id: string | null; detached_from_id: string | null }>(
      "SELECT reusable_section_id, detached_from_id FROM page_sections WHERE page_id = ? AND block_type = 'generic.cta'",
      [ids.page],
    );
    expect(section).toEqual({ reusable_section_id: null, detached_from_id: ids.reusable });

    const owner = await as(browser, "owner");
    await open(owner, `/admin/reusable-sections/${ids.reusable}`);
    await expect(owner.locator(".adm-bld-inspector")).toContainText("Used by 0 sections.");
    await owner.getByRole("button", { name: "Archive", exact: true }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
    await expect(owner.locator(".adm-page-head .adm-badge", { hasText: "Archived" })).toBeVisible();
    await open(owner, "/admin/reusable-sections");
    await expect(owner.locator("main tbody tr", { hasText: "Test reusable call to action" })).toContainText("Archived");
  });

  test("a Reviewer sees and previews only; the server refuses a forged save", async ({ browser }) => {
    const reviewer = await as(browser, "reviewer");
    await builder(reviewer, `/admin/pages/${ids.page}/builder`);
    await expect(reviewer.locator(".adm-page-head .adm-badge", { hasText: "View only" })).toBeVisible();
    await expect(reviewer.getByRole("button", { name: "Save layout" })).toBeDisabled();
    await expect(reviewer.locator(".adm-bld-library")).toHaveCount(0);
    await expect(outline(reviewer).locator(".adm-bld-lock").first()).toContainText("You can view this layout but not change it.");
    await card(reviewer, "Heading").first().getByRole("button", { name: "View “Heading”" }).click();
    await expect(inspector(reviewer)).toContainText("You can view this layout but not edit it.");
    await previewReady(reviewer);
    // A save sent by hand from the Reviewer's page: refused by the server, nothing stored, audited.
    const before = await sectionIds("page_id", ids.page);
    const answer = await reviewer.evaluate(
      async ({ id, page }) => {
        const body = new FormData();
        body.append("0", JSON.stringify([JSON.stringify({ owner: { type: "page", id: page }, expectedVersion: 0, sections: [] })]));
        const response = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body });
        return response.text();
      },
      { id: actionId("saveLayoutAction"), page: ids.page },
    );
    expect(answer).toMatch(/"status":"error"/);
    expect(await sectionIds("page_id", ids.page)).toEqual(before);
    const [event] = await queryTestDb<{ outcome: string; action: string }>(
      "SELECT outcome, action FROM audit_events WHERE entity_type = 'page' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [ids.page],
    );
    expect(event).toEqual({ outcome: "denied", action: "layout.save" });
  });
});

// --- Phones, the preview tab, accessibility -------------------------------------------------------------------------------

test.describe("phones, the preview's own tab and accessibility", () => {
  test("390 px light and dark, and 320 px: one view at a time, edit and save, no sideways scroll", async ({ browser }) => {
    for (const [viewport, colorScheme] of [
      [{ width: 390, height: 844 }, "light"],
      [{ width: 390, height: 844 }, "dark"],
      [{ width: 320, height: 640 }, "light"],
    ] as const) {
      const phone = await signedIn(browser, "editor", { viewport, colorScheme });
      await builder(phone, `/admin/pages/${ids.page}/builder`);
      const tabs = phone.getByRole("group", { name: "Builder view" });
      await expect(tabs).toBeVisible();
      await expect(outline(phone)).toBeVisible();
      await expect(inspector(phone)).toBeHidden();
      await expect(phone.locator(".adm-bld-preview")).toBeHidden();
      expect(await pageOverflow(phone), `${viewport.width} ${colorScheme} outline`).toBe(0);
      await card(phone, "Image").getByRole("button", { name: "Edit “Image”" }).click();
      await expect(inspector(phone)).toBeVisible();
      await expect(outline(phone)).toBeHidden();
      expect(await pageOverflow(phone), `${viewport.width} ${colorScheme} edit`).toBe(0);
      await inspector(phone).getByLabel(/^Alt text/).fill(`Test chandelier photo ${viewport.width} ${colorScheme}`);
      await saveLayout(phone);
      // A rich text in the inspector — its paragraph's kind menu, buttons and marks — stays inside the screen too (the
      // kind menu's longest choice pushed it 4 px past a 320 px screen until each editor grid had one minmax(0, 1fr) track).
      await tabs.getByRole("button", { name: "Outline" }).click();
      await card(phone, "Text").getByRole("button", { name: "Edit “Text”" }).click();
      await expect(inspector(phone).locator(".adm-bld-rich-block select").first()).toBeVisible();
      expect(await pageOverflow(phone), `${viewport.width} ${colorScheme} rich text`).toBe(0);
      expect(await pastTheScreen(phone), `${viewport.width} ${colorScheme} rich text`).toEqual([]);
      await tabs.getByRole("button", { name: "Preview" }).click();
      await expect(phone.locator(".adm-bld-preview")).toBeVisible();
      await expect(phone.getByLabel("Preview width")).toBeVisible();
      await previewReady(phone);
      expect(await pageOverflow(phone), `${viewport.width} ${colorScheme} preview`).toBe(0);
      expect(await pastTheScreen(phone), `${viewport.width} ${colorScheme}`).toEqual([]);
      await phone.context().close();
    }
  });

  test("axe on the builder, the reusable editor and the list; labels, headings, the frame's title", async ({ browser }) => {
    const editor = await as(browser, "editor");
    for (const path of [`/admin/pages/${ids.page}/builder`, `/admin/reusable-sections/${ids.reusable}`, "/admin/reusable-sections"]) {
      await open(editor, path);
      if (path.endsWith("/builder")) await card(editor, "Image").getByRole("button", { name: "Edit “Image”" }).click();
      expect(await axe(editor), path).toEqual([]);
    }
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    await expect(editor.locator("main h1")).toHaveCount(1);
    await expect(editor.locator("iframe.adm-bld-frame")).toHaveAttribute("title", /^Preview of /);
    // Every control in the builder has a name.
    const unnamed = await editor.locator(".adm-bld :is(button, select, input, textarea)").evaluateAll((els) =>
      els.filter((el) => !(el as HTMLElement).closest("dialog:not([open])") && (el as HTMLInputElement).type !== "hidden").filter((el) => {
        const label = (el as HTMLInputElement).labels?.[0]?.textContent ?? "";
        return !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || label.trim() || (el.textContent ?? "").trim());
      }).map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toEqual([]);
  });

  test("the preview in its own tab: private, never indexed or stored, framed by the admin only; anonymous visitors sign in", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await builder(editor, `/admin/pages/${ids.page}/builder`);
    const [tab] = await Promise.all([editor.context().waitForEvent("page"), editor.getByRole("link", { name: "Open preview in a new tab" }).click()]);
    await tab.waitForLoadState("load");
    expect(new URL(tab.url()).pathname).toBe(`/admin/preview/page/${ids.page}`);
    expect(new URL(tab.url()).searchParams.get("frame")).toBeNull();
    await expect(tab.locator("main")).toContainText("Test builder heading");
    const response = await editor.request.get(`/admin/preview/page/${ids.page}?locale=en&theme=light&device=desktop`);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["cache-control"]).toBe("no-store");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]{22}==' 'strict-dynamic'/);
    // The builder's own page keeps the admin's policy: never framed.
    const own = await editor.request.get(`/admin/pages/${ids.page}/builder`);
    expect(own.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    await tab.close();
    // Anonymous: the sign-in page, never the preview.
    const anonymous = await browser.newContext();
    const visitor = await anonymous.newPage();
    const answer = await visitor.goto(`/admin/preview/page/${ids.page}?locale=en`);
    expect(new URL(visitor.url()).pathname).toBe("/admin/login");
    expect(await answer!.text()).not.toContain("Test builder heading");
    const direct = await anonymous.request.get(`/admin/preview/page/${ids.page}`, { maxRedirects: 0 });
    expect([303, 307]).toContain(direct.status());
    expect(await direct.text()).not.toContain("Test builder heading");
    // Unknown kinds and ids are not found.
    expect((await editor.request.get(`/admin/preview/project/${ids.page}`)).status()).toBe(404);
    expect((await editor.request.get("/admin/preview/page/01ARZ3NDEKTSV4RRFFQ69G5FAV")).status()).toBe(404);
    await anonymous.close();
  });
});

// --- The admin gate ----------------------------------------------------------------------------------------------------------

/** The id of one of the admin's Server Actions in this build (from Next's own manifest). */
function actionId(name: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { exportedName?: string; filename?: string }>;
  };
  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && v.filename?.startsWith("src/server/admin/actions/"));
  if (!found) throw new Error(`No Server Action ${name} in the build.`);
  return found[0];
}

/** A stand-in database: counts connection attempts and closes each at once. */
async function countingDatabase() {
  let attempts = 0;
  const db: Server = createServer((socket) => {
    attempts++;
    socket.destroy();
  });
  await new Promise<void>((done) => db.listen(0, "127.0.0.1", done));
  const address = db.address();
  return {
    port: typeof address === "object" && address ? address.port : 0,
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
const A5_ROUTES = [
  `/admin/pages/${GATE_ID}/builder`,
  `/admin/services/${GATE_ID}/builder`,
  "/admin/reusable-sections",
  "/admin/reusable-sections/new",
  `/admin/reusable-sections/${GATE_ID}`,
  `/admin/preview/page/${GATE_ID}`,
  `/admin/preview/service/${GATE_ID}?locale=ar&theme=dark&device=mobile&frame=1`,
  `/admin/preview/reusable/${GATE_ID}`,
];

/** Every A5 Server Action as a forged request: the admin's origin and a made-up session cookie, React's reply encoding. */
function builderActionRequests() {
  const headers = (name: string) => ({
    "next-action": actionId(name),
    origin: "https://admin.example.test",
    "x-forwarded-host": "admin.example.test",
    accept: "text/x-component",
    cookie: `__Host-rawasy_admin=${"A".repeat(43)}`,
  });
  const args = (value: unknown[]) => {
    const multipart = new FormData();
    multipart.append("0", JSON.stringify(value));
    return multipart;
  };
  const form = (fields: Record<string, string>) => {
    const multipart = new FormData();
    for (const [k, v] of Object.entries(fields)) multipart.append(`_1_${k}`, v);
    multipart.append("0", '[{"status":"idle"},"$K1"]');
    return multipart;
  };
  const owner = { type: "page", id: GATE_ID };
  return [
    { name: "saveLayoutAction", multipart: args([JSON.stringify({ owner, expectedVersion: 0, sections: [] })]) },
    { name: "initializeLayoutAction", multipart: args([{ owner, expectedVersion: 0 }]) },
    { name: "detachSectionAction", multipart: args([{ owner, expectedVersion: 0, sectionId: GATE_ID }]) },
    { name: "createReusableFromSectionAction", multipart: args([{ owner, expectedVersion: 0, sectionId: GATE_ID, name: "x", mode: "copy" }]) },
    { name: "saveReusableAction", multipart: args([JSON.stringify({ id: GATE_ID, expectedVersion: 0, name: "x", data: {} })]) },
    { name: "createReusableAction", multipart: form({ name: "x", blockType: "generic.cta" }) },
    { name: "setReusableArchivedAction", multipart: form({ id: GATE_ID, version: "0", archived: "1" }) },
  ].map(({ name, multipart }) => ({ name, options: { headers: headers(name), multipart, maxRedirects: 0 } }));
}

// --- A5 acceptance review: the builder's working copy and the generic photo frame -----------------------------------------

test.describe("A5 acceptance review", () => {
  /** A new generic page, its builder opened and its layout set up (the page's id). */
  async function newPageLayout(page: Page, slug: string, title: string): Promise<string> {
    await open(page, "/admin/pages/new");
    await page.getByRole("link", { name: "New generic page" }).click();
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await english(page).getByLabel(/^Title/).fill(title);
    await page.getByRole("button", { name: "Create page" }).click();
    await page.waitForURL(/created=1/);
    const id = idFrom(page);
    await builder(page, `/admin/pages/${id}/builder`);
    await page.getByRole("button", { name: "Set up this layout" }).click();
    await page.waitForURL(/done=setup/);
    return id;
  }
  const englishTitles = async (pageId: string) =>
    (
      await queryTestDb<{ content: unknown }>(
        "SELECT t.content FROM page_sections s JOIN page_section_translations t ON t.section_id = s.id AND t.locale = 'en' WHERE s.page_id = ? AND s.block_type = 'generic.heading' ORDER BY s.position",
        [pageId],
      )
    ).map((r) => (json(r.content) as { title?: string }).title);

  test("a stored section duplicated with unsaved edits: the copy stores the edits it shows", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const id = await newPageLayout(editor, "test-review-duplicate", "Test Review Duplicate");
    await addBlock(editor, "Heading");
    await inspector(editor).getByLabel(/^Title/).fill("Test stored title");
    await saveLayout(editor);
    expect(await englishTitles(id)).toEqual(["Test stored title"]);
    // The stored heading edited, then duplicated before any save: the copy (now chosen) shows the edited title.
    await card(editor, "Heading").getByRole("button", { name: "Edit “Heading”" }).click();
    await inspector(editor).getByLabel(/^Title/).fill("Test edited title");
    await card(editor, "Heading").getByRole("button", { name: "Duplicate “Heading”" }).click();
    expect(await cardTitles(editor)).toEqual(["Page opening", "Heading", "Heading"]);
    await expect(inspector(editor).getByLabel(/^Title/)).toHaveValue("Test edited title");
    await saveLayout(editor);
    expect(await englishTitles(id)).toEqual(["Test edited title", "Test edited title"]);
  });

  test("while a save is on its way the outline, library and inspector take no input, and Undo waits", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const id = await newPageLayout(editor, "test-review-saving", "Test Review Saving");
    await addBlock(editor, "Heading");
    await inspector(editor).getByLabel(/^Title/).fill("Test saving heading");
    // The save's Server Action (a POST to this page) is held until the checks below are done.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let caught = false;
    const path = `**/admin/pages/${id}/builder**`;
    await editor.route(path, async (route) => {
      if (route.request().method() === "POST" && !caught) {
        caught = true;
        await held;
        await route.continue();
      } else await route.fallback();
    });
    await editor.getByRole("button", { name: "Save layout" }).click();
    await expect(chip(editor)).toHaveText("Saving…");
    expect(caught).toBe(true);
    // Anything done now would be dropped when the stored layout replaces the working copy: nothing can be done.
    await expect(editor.locator(".adm-bld-grid")).toHaveAttribute("inert", "");
    await expect(editor.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(editor.getByRole("button", { name: "Redo" })).toBeDisabled();
    release();
    await editor.waitForURL((url) => url.searchParams.get("done") === "saved");
    await expect(chip(editor)).toHaveText("Saved");
    await expect(editor.locator(".adm-bld-grid")).not.toHaveAttribute("inert", /.*/);
    await editor.unroute(path);
    expect(await englishTitles(id)).toEqual(["Test saving heading"]);
  });

  test("a photo in a generic Image block, with the block's own entrance, is never drawn wider than its file", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const id = await newPageLayout(editor, "test-review-photo", "Test Review Photo");
    await addBlock(editor, "Image");
    await inspector(editor).getByRole("button", { name: "Choose…" }).click();
    const picker = editor.getByRole("dialog", { name: "Choose: Photo" });
    await picker.getByLabel("Search media").fill("chandelier-1");
    await picker.getByRole("button", { name: "Search", exact: true }).click();
    await picker.locator("button.adm-pick").filter({ hasText: "chandelier-1" }).first().click();
    await expect(picker).toBeHidden();
    await inspector(editor).getByLabel(/^Alt text/).fill("Test review photo");
    await saveLayout(editor);
    const image = (await sectionIds("page_id", id)).find((s) => s.block_type === "generic.image")!;
    // The release photo is 322 × 322 px; the desktop preview's section is far wider.
    for (const shape of ["original", "1x1"]) {
      if (shape !== "original") {
        await card(editor, "Image").getByRole("button", { name: "Edit “Image”" }).click();
        await inspector(editor).getByLabel("Shape").selectOption(shape);
        await saveLayout(editor);
      }
      const f = await previewReady(editor);
      const photo = f.locator(`[data-section="${image.id}"] .gb-photo`);
      await expect(photo).toHaveAttribute("data-motion", "reveal");
      expect(await photo.evaluate((el) => ({ max: getComputedStyle(el).maxWidth, width: el.getBoundingClientRect().width })), shape).toEqual({
        max: "322px",
        width: 322,
      });
    }
  });
});

test.describe("the admin gate", () => {
  test("off (production without ADMIN_ENABLED): every builder, reusable and preview address is the public 404 path; no A5 action runs", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3441, db.port, { APP_ENV: "production" });
    try {
      const { client } = server;
      for (const path of A5_ROUTES) {
        const r = await client.get(path, { maxRedirects: 0 });
        expect(r.status(), path).toBe(307);
        expect(r.headers().location, path).toBe(`/en${path}`);
        expect(r.headers()["content-security-policy"], path).toBeUndefined();
        expect(r.headers()["x-robots-tag"], path).toBeUndefined();
        expect((await client.get(`/en${new URL(path, "http://x").pathname}`)).status(), path).toBe(404);
      }
      for (const { name, options } of builderActionRequests()) {
        expect((await client.post("/admin/reusable-sections", options)).status(), name).toBe(307);
        await client.post("/en", options);
      }
      expect(db.attempts(), "no database connection was attempted").toBe(0);
    } finally {
      await server.stop();
      await db.close();
    }
  });

  test("on (production, ADMIN_ENABLED=1): the same requests reach the database, so “off” means the gate stopped them", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3442, db.port, { APP_ENV: "production", ADMIN_ENABLED: "1" });
    try {
      const { client } = server;
      for (const { name, options } of builderActionRequests()) {
        for (const path of ["/admin/reusable-sections", "/en"]) {
          const before = db.attempts();
          await client.post(path, options);
          expect(db.attempts(), `${name} at ${path}`).toBeGreaterThan(before);
        }
      }
      // An anonymous preview request is answered by the sign-in redirect (its session is looked up: the stand-in refuses).
      const preview = await client.get(`/admin/preview/page/${GATE_ID}`, { maxRedirects: 0 });
      expect(preview.status()).not.toBe(200);
    } finally {
      await server.stop();
      await db.close();
    }
  });
});

