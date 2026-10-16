/**
 * The media library (Phase A4) end to end, on the production build against the admin suite's local MariaDB and its
 * temporary RAWASY_DATA_DIR (e2e-admin/server.mjs): an upload in parts with its progress bar and announcements, images
 * and a PDF pending review, English and Arabic details with a decorative alt text, the focal point from the keyboard,
 * folders, search and filters, flags, approval, restriction, versions (replace, restore), the public delivery route,
 * a certificate's private original (Owner only, step-up for the download) and its separate redacted preview, the
 * content pickers (project photos, client logos), Used by, the Trash and the archive, refusals for every role, phones,
 * dark mode, 320 px, axe, and every A4 route and media action behind the ADMIN_ENABLED gate. No mutation is faked: each
 * one goes through the pages, Server Actions and Route Handlers. Synthetic files only (generated pixels and a one-page
 * PDF that says it is a test document): no real certificate, number, QR code or person.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { expect, request as apiRequest, test, type APIRequestContext, type APIResponse, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { ageAuthentication, cliEnv, freshCode, queryTestDb, run } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "media.owner@example.test", name: "Test Media Owner", password: "media owner phrase canyon", mfa: true },
  admin: { email: "media.admin@example.test", name: "Test Media Admin", password: "media admin phrase harbour", mfa: true },
  editor: { email: "media.editor@example.test", name: "Test Media Editor", password: "media editor phrase meadow", mfa: false },
  reviewer: { email: "media.reviewer@example.test", name: "Test Media Reviewer", password: "media reviewer phrase lantern", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
const ids: Record<string, string> = {};
const ULID_IN_URL = /\/([0-9A-HJKMNP-TV-Z]{26})(?:\?|$)/;
const MEDIA_ITEM_URL = /\/admin\/media\/[0-9A-HJKMNP-TV-Z]{26}\?uploaded=1/;

async function signedIn(browser: Browser, role: Role, options: { viewport?: { width: number; height: number }; colorScheme?: "light" | "dark" } = {}): Promise<Page> {
  const context: BrowserContext = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 860 },
    colorScheme: options.colorScheme ?? "light",
    acceptDownloads: true,
  });
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

const idFrom = (page: Page) => ULID_IN_URL.exec(page.url())?.[1] ?? "";
const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** The badges under an item's title: its status and every warning, written out. */
const badges = (page: Page) => page.locator(".adm-page-head .adm-badges").first();
const english = (page: Page) => page.locator("#english");
const arabic = (page: Page) => page.locator("#arabic");

// --- Synthetic files -----------------------------------------------------------------------------------------------------

/** Random pixels stored without compression: a PNG larger than one 4 MiB upload part. */
const noisePng = (width: number, height: number) => sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
/** A flat image of one colour (each colour gives different bytes, so no upload is taken for a duplicate). */
function flatImage(width: number, height: number, [r, g, b]: [number, number, number], format: "png" | "jpeg" = "png") {
  const image = sharp({ create: { width, height, channels: 3, background: { r, g, b } } });
  return (format === "png" ? image.png() : image.jpeg()).toBuffer();
}

/** A minimal, valid one-page PDF that says it is a synthetic test document (no real content). */
function syntheticPdf(label: string): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>"];
  const stream = `BT /F1 12 Tf 20 100 Td (${label.replace(/[()\\]/g, "")}) Tj ET`;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

// --- Actions on the pages ------------------------------------------------------------------------------------------------

/** Uploads a file from the library's upload card and returns the new item's id (the page opens it). */
async function uploadInLibrary(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<string> {
  await open(page, "/admin/media");
  await page.getByLabel("Upload a file").setInputFiles({ name, mimeType, buffer });
  await page.waitForURL(MEDIA_ITEM_URL, { timeout: 60_000 });
  await page.locator("main h1").waitFor();
  return idFrom(page);
}

/**
 * Opens a confirmation dialog, fills its fields (label → value) and confirms. On success the dialog closes and the page
 * refreshes; a refusal stays in the dialog (`refused`), which is then closed with Cancel.
 */
async function confirm(page: Page, opener: Locator, fields: Record<string, string>, confirmLabel: string, refused?: string | RegExp) {
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(new RegExp(`^${label}`)).fill(value);
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
  if (refused) {
    await expect(dialog.getByRole("alert")).toContainText(refused);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await expect(dialog).toBeHidden();
}

const statusButton = (page: Page, name: string) => page.locator("#overview").getByRole("button", { name, exact: true });
/** A picker's own status line ("3 items can be chosen."): the first status in the dialog (its uploader has one too). */
const pickerStatus = (picker: Locator) => picker.locator('p[role="status"]').first();

/** The public names (`w320-<hash>.webp` …) of an item's current width variants, smallest first. */
async function variantNames(mediaId: string): Promise<string[]> {
  const rows = await queryTestDb<{ storage_key: string }>(
    "SELECT v.storage_key FROM media_variants v JOIN media_assets a ON a.current_file_id = v.file_id WHERE a.id = ? AND v.variant_key <> 'thumb' ORDER BY v.width",
    [mediaId],
  );
  return rows.map((r) => r.storage_key.slice(r.storage_key.indexOf("/") + 1));
}

const assetState = async (mediaId: string) =>
  (
    await queryTestDb<{ usage_status: string; visibility: string; deleted: number; published: number; lock_version: number }>(
      "SELECT a.usage_status, a.visibility, a.deleted_at IS NOT NULL AS deleted, (SELECT COUNT(*) FROM public_media p WHERE p.media_id = a.id) AS published, a.lock_version FROM media_assets a WHERE a.id = ?",
      [mediaId],
    )
  )[0];

const auditOf = (mediaId: string) =>
  queryTestDb<{ action: string; outcome: string; actor: string | null; summary: string }>(
    "SELECT e.action, e.outcome, u.email AS actor, e.summary FROM audit_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.entity_type = 'media' AND e.entity_id = ? ORDER BY e.id",
    [mediaId],
  );

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
 * A Server Action sent from inside a signed-in page with arguments of the person's choosing (what a modified page or a
 * script could send), in React's reply encoding: the FormData's fields as `_1_<name>` first, then part `0`.
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

/** A request from inside a signed-in page (its cookie, same origin): status, the headers that matter, the body's size. */
const fetchIn = (page: Page, url: string, init: { method?: string; body?: string } = {}) =>
  page.evaluate(
    async ({ url, init }) => {
      const response = await fetch(url, { method: init.method ?? "GET", headers: init.body ? { "Content-Type": "application/json" } : undefined, body: init.body });
      const bytes = (await response.arrayBuffer()).byteLength;
      const h = (name: string) => response.headers.get(name);
      return {
        status: response.status,
        type: h("content-type"),
        cache: h("cache-control"),
        disposition: h("content-disposition"),
        sniff: h("x-content-type-options"),
        bytes,
      };
    },
    { url, init },
  );

const AXE = require.resolve("axe-core/axe.min.js");
/** axe evaluated directly in the page: the admin's CSP refuses inline scripts and style tags. */
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

// --- Library and uploads ---------------------------------------------------------------------------------------------------

test.describe("the library and uploads", () => {
  test("an Editor uploads a photo in parts: a progress bar and announcements, then a pending item; nothing is public", async ({ browser, request }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/media");
    await expect(editor.locator("main h1")).toHaveText("Media library");
    // Hold the second part and the completion, so the progress and the processing state can be seen.
    let releasePart!: () => void;
    let releaseComplete!: () => void;
    const partHeld = new Promise<void>((done) => (releasePart = done));
    const completeHeld = new Promise<void>((done) => (releaseComplete = done));
    let parts = 0;
    await editor.route(/\/api\/admin\/media\/uploads\/[^/]+\/parts\/\d+$/, async (route) => {
      parts++;
      if (parts === 2) await partHeld;
      await route.continue();
    });
    await editor.route(/\/api\/admin\/media\/uploads\/[^/]+\/complete$/, async (route) => {
      await completeHeld;
      await route.continue();
    });
    const photo = await noisePng(1400, 1100);
    expect(photo.length, "two upload parts").toBeGreaterThan(4 * 1024 * 1024);
    await editor.getByLabel("Upload a file").setInputFiles({ name: "test-upload-photo.png", mimeType: "image/png", buffer: photo });
    const uploader = editor.locator(".adm-uploader");
    const bar = uploader.locator("progress.adm-progress");
    await expect(bar).toHaveAttribute("aria-label", "Uploading test-upload-photo.png");
    await expect.poll(() => parts).toBe(2);
    await expect(uploader.getByRole("status")).toHaveText(/^Uploading test-upload-photo\.png: \d+%$/);
    const percent = Number(await bar.getAttribute("value"));
    expect(percent, "the first 4 MiB part is counted").toBeGreaterThanOrEqual(85);
    expect(percent).toBeLessThan(100);
    await expect(editor.getByLabel("Upload a file")).toBeDisabled();
    await expect(uploader.getByRole("button", { name: "Cancel upload" })).toBeVisible();
    releasePart();
    await expect(uploader.getByRole("status")).toHaveText("Checking and processing test-upload-photo.png…");
    await expect(uploader.locator("progress.adm-progress")).toHaveAttribute("aria-label", "Processing test-upload-photo.png");
    releaseComplete();
    await editor.waitForURL(MEDIA_ITEM_URL, { timeout: 60_000 });
    await editor.unrouteAll({ behavior: "wait" });
    await editor.locator("main h1").waitFor();
    ids.photo = idFrom(editor);

    await expect(editor.locator("main h1")).toHaveText("test-upload-photo.png");
    await expect(badges(editor)).toHaveText("Pending review");
    await expect(editor.locator("main .adm-alert.is-success")).toHaveText("Uploaded. The item is pending review: nothing is public until it is approved and published.");
    await expect(editor.locator("#overview")).toContainText("Public class (deliverable only once approved)");
    await expect(editor.locator("#overview")).toContainText("Its status is Pending review, not Approved.");
    await expect(editor.locator("#overview img.adm-media-preview")).toBeVisible();
    await expect(editor.locator("#versions")).toContainText("Version 1");
    await expect(editor.locator("#versions")).toContainText("Current");
    const storage = editor.locator("#storage");
    await expect(storage).toContainText("Uploaded originals (persistent storage)");
    await expect(storage).toContainText("1400 × 1100 pixels");
    for (const size of ["320 px", "640 px", "1080 px", "admin thumbnail"]) await expect(storage).toContainText(size);
    // No server path or storage key on the page.
    const [file] = await queryTestDb<{ storage_key: string; storage_area: string }>(
      "SELECT f.storage_key, f.storage_area FROM media_files f JOIN media_assets a ON a.current_file_id = f.id WHERE a.id = ?",
      [ids.photo],
    );
    expect(file.storage_area).toBe("originals");
    const html = await editor.content();
    expect(html).not.toContain(file.storage_key);
    expect(html).not.toContain(run().dataDir);
    // Pending: no public_media row, and every variant's public address answers 404.
    expect(await assetState(ids.photo)).toMatchObject({ usage_status: "pending_review", visibility: "public", published: 0 });
    const names = await variantNames(ids.photo);
    expect(names).toHaveLength(3);
    for (const name of names) expect((await request.get(`/media/u/${ids.photo}/${name}`)).status(), name).toBe(404);
    expect((await auditOf(ids.photo)).map((e) => `${e.action}:${e.outcome}:${e.actor}`)).toContain("media.upload:success:media.editor@example.test");
  });

  test("a PDF document and a second photo: a document has no alt texts and no preview; both are pending review", async ({ browser, request }) => {
    const editor = await as(browser, "editor");
    ids.pdf = await uploadInLibrary(editor, "test-document.pdf", "application/pdf", syntheticPdf("Synthetic test document"));
    await expect(editor.locator("main h1")).toHaveText("test-document.pdf");
    await expect(badges(editor)).toHaveText("Pending review");
    await expect(editor.locator("#overview")).toContainText("PDF document");
    await expect(editor.locator("#overview .adm-media-thumb.is-doc")).toHaveText("PDF");
    await expect(editor.locator("#overview img")).toHaveCount(0);
    await expect(english(editor).getByLabel("English title")).toBeVisible();
    await expect(english(editor).getByLabel("English caption")).toBeVisible();
    await expect(english(editor).getByLabel(/alt text/)).toHaveCount(0);
    await expect(editor.locator("#organisation")).not.toContainText("Focal point");
    expect(await variantNames(ids.pdf)).toEqual([]);
    expect((await request.get(`/media/u/${ids.pdf}/document-00000000.pdf`)).status()).toBe(404);

    ids.photo2 = await uploadInLibrary(editor, "test-second-photo.jpg", "image/jpeg", await flatImage(900, 600, [40, 110, 160], "jpeg"));
    await expect(editor.locator("main h1")).toHaveText("test-second-photo.jpg");
    await expect(badges(editor)).toHaveText("Pending review");
  });
});

// --- Details --------------------------------------------------------------------------------------------------------------

test.describe("bilingual details and the focal point", () => {
  test("English and Arabic titles, alt texts and captions, a decorative Arabic alt, the focal point from the keyboard; saving never approves", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/media/${ids.photo}`);
    await english(editor).getByLabel("English title").fill("Test workshop photo");
    await english(editor).getByLabel("English alt text", { exact: true }).selectOption("text");
    await english(editor).getByLabel("English alt text, written").fill("Test steel sheet on a workbench");
    const arTitle = arabic(editor).getByLabel("Arabic title");
    await expect(arTitle).toHaveAttribute("dir", "rtl");
    await expect(arTitle).toHaveAttribute("lang", "ar");
    await expect(english(editor).getByLabel("English title")).toHaveAttribute("dir", "ltr");
    await arTitle.fill("صورة اختبار من الورشة");
    await arabic(editor).getByLabel("Arabic alt text", { exact: true }).selectOption("decorative");
    await expect(arabic(editor).getByLabel("Arabic alt text, written")).toHaveCount(0);
    const arCaption = arabic(editor).getByLabel("Arabic caption");
    await expect(arCaption).toHaveAttribute("dir", "rtl");
    await arCaption.fill("تعليق اختباري للصورة.");
    // The focal point: two sliders (the accessible control), moved with the arrow keys.
    const organisation = editor.locator("#organisation");
    await organisation.getByLabel("Set a focal point").check();
    const left = organisation.getByLabel(/^From the left/);
    await left.focus();
    for (let i = 0; i < 10; i++) await editor.keyboard.press("ArrowRight");
    const top = organisation.getByLabel(/^From the top/);
    await top.focus();
    for (let i = 0; i < 5; i++) await editor.keyboard.press("ArrowLeft");
    await expect(organisation.getByText("From the left: 60%")).toBeVisible();
    await expect(organisation.getByText("From the top: 45%")).toBeVisible();
    await expect(editor.locator(".adm-savebar-status")).toHaveText("Unsaved changes");
    // Plain text only: markup is refused and nothing is saved; the typed values stay.
    await english(editor).getByLabel("English caption").fill("<b>Test</b> caption");
    await editor.getByRole("button", { name: "Save details" }).click();
    await expect(editor.locator("main").getByRole("alert")).toContainText("plain text only");
    expect(editor.url()).not.toContain("saved=1");
    await expect(arTitle).toHaveValue("صورة اختبار من الورشة");
    await english(editor).getByLabel("English caption").fill("Test caption in English.");
    await editor.getByRole("button", { name: "Save details" }).click();
    await editor.waitForURL(/saved=1/);
    await editor.locator("main h1").waitFor();
    await expect(editor.locator("main h1")).toHaveText("Test workshop photo");
    await expect(editor.locator("main .adm-alert.is-success")).toHaveText("Saved the details.");
    await expect(badges(editor)).toHaveText("Pending review");
    await expect(editor.locator("#overview")).toContainText("60% from the left, 45% from the top");
    await expect(english(editor).getByLabel("English alt text, written")).toHaveValue("Test steel sheet on a workbench");
    await expect(arabic(editor).getByLabel("Arabic alt text", { exact: true })).toHaveValue("decorative");
    await expect(editor.locator(".adm-savebar-status")).toHaveText("No unsaved changes");
    // Stored as typed: '' is the deliberate decorative decision (NULL would mean "not decided").
    const rows = await queryTestDb<{ locale: string; title: string; alt_text: string | null; caption: string }>(
      "SELECT locale, title, alt_text, caption FROM media_translations WHERE media_id = ? ORDER BY locale",
      [ids.photo],
    );
    expect(rows).toEqual([
      { locale: "ar", title: "صورة اختبار من الورشة", alt_text: "", caption: "تعليق اختباري للصورة." },
      { locale: "en", title: "Test workshop photo", alt_text: "Test steel sheet on a workbench", caption: "Test caption in English." },
    ]);
    const [focal] = await queryTestDb<{ x: string; y: string }>("SELECT focal_x AS x, focal_y AS y FROM media_assets WHERE id = ?", [ids.photo]);
    expect([Number(focal.x), Number(focal.y)]).toEqual([0.6, 0.45]);
    expect(await assetState(ids.photo)).toMatchObject({ usage_status: "pending_review", published: 0 });
    // The second photo's alt texts stay undecided (NULL): nothing is written or translated for it.
    expect(await queryTestDb("SELECT locale FROM media_translations WHERE media_id = ? AND alt_text IS NOT NULL", [ids.photo2])).toEqual([]);
  });
});

// --- Folders, search and filters ------------------------------------------------------------------------------------------

test.describe("folders, search and filters", () => {
  test("folders: create, nest, rename, refuse duplicates and separators, move, reorder, delete only when empty", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/media/folders");
    const folder = (name: string) => editor.locator("li.adm-folder").filter({ has: editor.locator(".adm-folder-head strong", { hasText: new RegExp(`^${name}$`) }) });
    const create = async (name: string, inside?: string) => {
      await editor.getByLabel("New folder name").fill(name);
      await editor.getByLabel("Inside").selectOption(inside ? { label: inside } : "");
      await editor.getByRole("button", { name: "Create folder" }).click();
    };
    await create("Test Workshop");
    await expect(folder("Test Workshop")).toBeVisible();
    await create("Test Bending", "Test Workshop");
    await expect(folder("Test Bending")).toContainText("Test Workshop / Test Bending");
    await expect(folder("Test Bending")).toHaveClass(/is-depth-1/);
    await create("Test Workshop");
    await expect(editor.locator("main").getByRole("alert")).toContainText("A folder with this name is already there.");
    await create("Test/Separator");
    await expect(editor.locator("main").getByRole("alert")).toContainText("A folder name can't contain / or \\.");
    // Rename, then move to the top level, then reorder among the top-level folders.
    await folder("Test Bending").getByLabel("New name for Test Bending").fill("Test Bending Photos");
    await folder("Test Bending").getByRole("button", { name: "Rename" }).click();
    await expect(folder("Test Bending Photos")).toBeVisible();
    // A folder can't go under itself: its own path is never offered.
    const moveTo = folder("Test Workshop").getByLabel("Move Test Workshop to");
    await expect(moveTo.locator("option")).toHaveText(["Move to…"]);
    await folder("Test Bending Photos").getByLabel("Move Test Bending Photos to").selectOption("top");
    await folder("Test Bending Photos").getByRole("button", { name: "Move", exact: true }).click();
    await expect(folder("Test Bending Photos")).toHaveClass(/is-depth-0/);
    await expect(editor.locator(".adm-folder-head strong")).toHaveText(["Test Workshop", "Test Bending Photos"]);
    await folder("Test Bending Photos").getByRole("button", { name: "Move Test Bending Photos up" }).click();
    await expect(editor.locator(".adm-folder-head strong")).toHaveText(["Test Bending Photos", "Test Workshop"]);
    // An empty folder can be deleted; one holding an item can't.
    await confirm(editor, folder("Test Bending Photos").getByRole("button", { name: "Delete" }), {}, "Delete the folder");
    await expect(folder("Test Bending Photos")).toHaveCount(0);
    const [workshop] = await queryTestDb<{ id: string }>("SELECT id FROM media_folders WHERE name = 'Test Workshop'");
    ids.folder = workshop.id;
    await open(editor, `/admin/media/${ids.photo}`);
    await editor.locator("#organisation").getByLabel("Folder", { exact: true }).selectOption({ label: "Test Workshop" });
    await editor.getByRole("button", { name: "Save details" }).click();
    await editor.waitForURL(/saved=1/);
    await editor.locator("main h1").waitFor();
    await expect(editor.locator("#overview")).toContainText("Test Workshop");
    await open(editor, "/admin/media/folders");
    await expect(folder("Test Workshop")).toContainText("1 item");
    await expect(folder("Test Workshop").getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(folder("Test Workshop")).toContainText("Only an empty folder can be deleted.");
    // A forged delete of the non-empty folder is refused by the server too.
    await forgeAction(editor, "deleteFolderAction", { id: ids.folder });
    expect(await queryTestDb("SELECT id FROM media_folders WHERE id = ?", [ids.folder])).toHaveLength(1);
    await folder("Test Workshop").getByRole("link", { name: /Open in the library/ }).click();
    await editor.waitForURL(`**/admin/media?folder=${ids.folder}`);
    await expect(editor.locator(".adm-media-tile-title")).toHaveText(["Test workshop photo"]);
  });

  test("search and filters live in the address: text in English or Arabic, kind, status, missing alt, unused; grid and list", async ({ browser }) => {
    const editor = await as(browser, "editor");
    const titles = () => editor.locator(".adm-media-tile-title");
    await open(editor, "/admin/media");
    await editor.getByLabel("Search media").fill("workbench");
    await editor.getByRole("button", { name: "Apply" }).click();
    await editor.waitForURL(/[?&]q=workbench/);
    await expect(titles()).toHaveText(["Test workshop photo"]);
    await open(editor, `/admin/media?q=${encodeURIComponent("الورشة")}`);
    await expect(titles()).toHaveText(["Test workshop photo"]);
    await expect(editor.getByLabel("Search media")).toHaveValue("الورشة");
    await open(editor, "/admin/media?kind=document");
    await expect(titles()).toHaveText(["test-document.pdf"]);
    await expect(editor.getByLabel("Kind")).toHaveValue("document");
    await open(editor, "/admin/media?missing=alt");
    await expect(titles()).toHaveText(["test-second-photo.jpg"]);
    await expect(editor.getByLabel("Alt text not decided")).toBeChecked();
    const sorted = async () => (await titles().allTextContents()).sort();
    await open(editor, "/admin/media?status=pending_review");
    expect(await sorted()).toEqual(["Test workshop photo", "test-document.pdf", "test-second-photo.jpg"]);
    await open(editor, "/admin/media?unused=1&kind=image");
    expect(await sorted()).toEqual(["Test workshop photo", "test-second-photo.jpg"]);
    // The list view: one row per item, its status written out.
    await open(editor, "/admin/media?view=list&kind=image");
    const rows = editor.locator("main table.adm-table tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Test workshop photo" })).toContainText("Pending review");
    await expect(editor.getByLabel("View")).toHaveValue("list");
    await editor.getByRole("link", { name: "Clear filters" }).click();
    await editor.waitForURL((url) => url.pathname === "/admin/media" && url.search === "");
    await expect(titles()).toHaveCount(3);
  });
});

// --- Flags, approval, restriction ----------------------------------------------------------------------------------------

test.describe("rights, approval and restriction", () => {
  test("a Reviewer adds a blocking flag: the preview hides, the card shows no picture; only Owner or Admin clears it, with a reason", async ({ browser }) => {
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, `/admin/media/${ids.photo}`);
    await expect(reviewer.locator("#overview img.adm-media-preview")).toBeVisible();
    await reviewer.getByLabel("Add a flag").selectOption("third_party_branding");
    await reviewer.locator("#rights").getByLabel("Note (optional)").fill("Test note: a brand mark is visible.");
    await reviewer.getByRole("button", { name: "Add flag" }).click();
    await expect(badges(reviewer)).toContainText("Blocking flag");
    await expect(reviewer.locator("#overview .adm-media-hidden")).toContainText("Preview hidden.");
    await expect(reviewer.locator("#overview img.adm-media-preview")).toHaveCount(0);
    await expect(reviewer.locator("#rights")).toContainText("Third-party branding");
    await expect(reviewer.locator("#rights")).toContainText("Note: Test note: a brand mark is visible.");
    await expect(reviewer.locator("#rights").getByRole("button", { name: "Clear" })).toHaveCount(0);
    await expect(reviewer.locator("#rights")).toContainText("Only an Owner or Admin can clear a flag.");
    await reviewer.getByRole("button", { name: "Show the preview" }).click();
    await expect(reviewer.locator("#overview img.adm-media-preview")).toBeVisible();
    // The library's card shows no picture of a blocking-flagged item.
    await open(reviewer, "/admin/media?q=workbench");
    const tile = reviewer.locator(".adm-media-tile").filter({ hasText: "Test workshop photo" });
    await expect(tile.locator("img")).toHaveCount(0);
    await expect(tile.locator(".adm-media-thumb")).toHaveText("Hidden");
    await expect(tile).toContainText("Blocking flag");
    // A forged clear by the Reviewer or the Editor changes nothing.
    for (const role of ["reviewer", "editor"] as const) {
      const page = await as(browser, role);
      await open(page, `/admin/media/${ids.photo}`);
      await expect(page.locator("#rights").getByRole("button", { name: "Clear" })).toHaveCount(0);
      await forgeAction(page, "clearMediaFlagAction", { id: ids.photo, flag: "third_party_branding", token: String(Date.now()), note: "Forged attempt" });
    }
    expect(await queryTestDb("SELECT flag FROM media_flags WHERE media_id = ?", [ids.photo])).toEqual([{ flag: "third_party_branding" }]);
    // The Admin can't approve it while the flag is there; clearing needs a reason and leaves it pending review.
    const admin = await as(browser, "admin");
    await open(admin, `/admin/media/${ids.photo}`);
    await confirm(admin, statusButton(admin, "Approve for public use"), { "Approval note": "Test approval attempt" }, "Approve", "it has blocking flags: Third-party branding");
    await admin.locator("#rights").getByRole("button", { name: "Clear" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Clear the flag" }).click();
    await expect(dialog.getByLabel(/^Reason/)).toBeFocused();
    await dialog.getByLabel(/^Reason/).fill("Test: the mark is our own branding.");
    await dialog.getByRole("button", { name: "Clear the flag" }).click();
    await expect(dialog).toBeHidden();
    await expect(admin.locator("#rights")).toContainText("No flags.");
    await expect(badges(admin)).toHaveText("Pending review");
    const events = (await auditOf(ids.photo)).map((e) => `${e.action}:${e.outcome}:${e.actor}`);
    expect(events).toContain("media.flag_add:success:media.reviewer@example.test");
    expect(events).toContain("media.flag_clear:denied:media.reviewer@example.test");
    expect(events).toContain("media.flag_clear:denied:media.editor@example.test");
    expect(events).toContain("media.approve:failed:media.admin@example.test");
    expect(events).toContain("media.flag_clear:success:media.admin@example.test");
  });

  test("approval is its own action (Owner or Admin, with a note): an undecided alt refuses it; then the item is served publicly", async ({ browser, request }) => {
    const admin = await as(browser, "admin");
    await open(admin, `/admin/media/${ids.photo2}`);
    await confirm(admin, statusButton(admin, "Approve for public use"), { "Approval note": "Test baseline" }, "Approve", "decide the alt text in English and Arabic first");
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "pending_review", published: 0 });
    // Decorative in both languages is a deliberate decision.
    await english(admin).getByLabel("English title").fill("Test approved photo");
    await english(admin).getByLabel("English alt text", { exact: true }).selectOption("decorative");
    await arabic(admin).getByLabel("Arabic alt text", { exact: true }).selectOption("decorative");
    await admin.getByRole("button", { name: "Save details" }).click();
    await admin.waitForURL(/saved=1/);
    await admin.locator("main h1").waitFor();
    await expect(badges(admin)).toHaveText("Pending review");
    // The note is required.
    await statusButton(admin, "Approve for public use").click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(dialog.getByLabel(/^Approval note/)).toBeFocused();
    await dialog.getByLabel(/^Approval note/).fill("Test approval for the browser tests");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(badges(admin)).toHaveText("Approved");
    await expect(admin.locator("#overview")).toContainText("Yes (through the uploaded-media route");
    await expect(admin.locator("#overview")).toContainText("Test approval for the browser tests");
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "approved", published: 1 });
    // Served at its hashed public address with the A4 headers; never the original or the admin thumbnail.
    const names = await variantNames(ids.photo2);
    expect(names.map((n) => n.replace(/-[0-9a-f]{8}\.webp$/, ""))).toEqual(["w320", "w640"]);
    const served = await request.get(`/media/u/${ids.photo2}/${names[0]}`);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/webp");
    expect(served.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(served.headers()["etag"]).toMatch(/^"[0-9a-f]{64}"$/);
    expect(served.headers()["x-content-type-options"]).toBe("nosniff");
    expect(served.headers()["set-cookie"]).toBeUndefined();
    const metadata = await sharp(await served.body()).metadata();
    expect([metadata.format, metadata.width]).toEqual(["webp", 320]);
    expect(Math.abs(metadata.height! - (600 * 320) / 900)).toBeLessThan(1);
    for (const name of ["original.jpg", "thumb.webp", "w320.webp", names[0].replace(/[0-9a-f]{8}\.webp$/, "00000000.webp")]) {
      expect((await request.get(`/media/u/${ids.photo2}/${name}`)).status(), name).toBe(404);
    }
    // Next.js's image optimizer never takes an uploaded item's address (security review M1): it would keep serving its own
    // copy long after the item was withdrawn. The release's own pictures are optimized as before.
    const optimizer = (url: string) => request.get(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`, { headers: { accept: "image/avif,image/webp,*/*" } });
    for (const url of [`/media/u/${ids.photo2}/${names[0]}`, `/media/projects/../u/${ids.photo2}/${names[0]}`, `/media/u/${ids.photo2}/${names[0]}?v=1`]) {
      expect((await optimizer(url)).status(), url).toBe(400);
    }
    const release = readdirSync(join(ROOT, "public", "media", "projects")).find((name) => name.endsWith(".webp"))!;
    const optimized = await optimizer(`/media/projects/${release}`);
    expect(optimized.status()).toBe(200);
    expect(optimized.headers()["content-type"]).toBe("image/webp");
    // The Editor's page has no approval at all.
    const editor = await as(browser, "editor");
    await open(editor, `/admin/media/${ids.pdf}`);
    await expect(statusButton(editor, "Approve for public use")).toHaveCount(0);
  });

  test("restriction: Owner or Admin restricts at once (withdrawn); lifting it returns to review, never to approved", async ({ browser, request }) => {
    const admin = await as(browser, "admin");
    const name = (await variantNames(ids.photo2))[0];
    await open(admin, `/admin/media/${ids.photo2}`);
    await confirm(admin, statusButton(admin, "Restrict"), { Reason: "Test restriction: rights question raised." }, "Restrict");
    await expect(badges(admin)).toHaveText("Restricted");
    await expect(admin.locator("#overview")).toContainText("Test restriction: rights question raised.");
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "restricted", published: 0 });
    expect((await request.get(`/media/u/${ids.photo2}/${name}`)).status()).toBe(404);
    await confirm(admin, statusButton(admin, "Lift the restriction"), { Reason: "Test: question answered." }, "Lift it");
    await expect(badges(admin)).toHaveText("Pending review");
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "pending_review", published: 0 });
    await confirm(admin, statusButton(admin, "Approve for public use"), { "Approval note": "Test re-approval" }, "Approve");
    await expect(badges(admin)).toHaveText("Approved");
    expect((await request.get(`/media/u/${ids.photo2}/${name}`)).status()).toBe(200);
    // The first photo stays restricted (the pickers show it with its warning).
    await open(admin, `/admin/media/${ids.photo}`);
    await confirm(admin, statusButton(admin, "Restrict"), { Reason: "Test restriction kept for the picker tests." }, "Restrict");
    await expect(badges(admin)).toHaveText("Restricted");
  });
});

// --- Versions -------------------------------------------------------------------------------------------------------------

test.describe("versions", () => {
  test("replace: version 2 becomes current, the item returns to review and the old address stops; restore version 1; approve again", async ({ browser, request }) => {
    const admin = await as(browser, "admin");
    const v1Names = await variantNames(ids.photo2);
    await open(admin, `/admin/media/${ids.photo2}`);
    const versions = admin.locator("#versions");
    await versions.getByLabel("Replace with a new version").setInputFiles({ name: "test-second-photo-v2.png", mimeType: "image/png", buffer: await flatImage(800, 800, [180, 90, 40]) });
    await expect(versions.locator(".adm-uploader").getByRole("status")).toHaveText("Uploaded test-second-photo-v2.png. Status: Pending review.", { timeout: 60_000 });
    await expect(versions.locator(".adm-rel-item")).toHaveCount(2);
    await expect(versions.locator(".adm-rel-item").filter({ hasText: "Version 2" })).toContainText("Current");
    await expect(badges(admin)).toHaveText("Pending review");
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "pending_review", published: 0 });
    for (const name of v1Names) expect((await request.get(`/media/u/${ids.photo2}/${name}`)).status(), name).toBe(404);
    const v2Names = await variantNames(ids.photo2);
    expect(v2Names).not.toEqual(v1Names);
    // Restore version 1 (Owner/Admin): the newer version stays in the history.
    await confirm(admin, versions.getByRole("button", { name: "Make version 1 current" }), {}, "Make it current");
    await expect(versions.locator(".adm-rel-item").filter({ hasText: "Version 1" })).toContainText("Current");
    await expect(versions.locator(".adm-rel-item")).toHaveCount(2);
    await expect(badges(admin)).toHaveText("Pending review");
    expect(await variantNames(ids.photo2)).toEqual(v1Names);
    // Approved again: only the current version's addresses work.
    await confirm(admin, statusButton(admin, "Approve for public use"), { "Approval note": "Test approval of version 1" }, "Approve");
    await expect(badges(admin)).toHaveText("Approved");
    expect((await request.get(`/media/u/${ids.photo2}/${v1Names[0]}`)).status()).toBe(200);
    for (const name of v2Names) expect((await request.get(`/media/u/${ids.photo2}/${name}`)).status(), name).toBe(404);
    // Each version's original can be downloaded by the Admin (recorded in the audit log).
    const [older] = await queryTestDb<{ id: string }>("SELECT id FROM media_files WHERE media_id = ? AND version = 2", [ids.photo2]);
    const download = await fetchIn(admin, `/api/admin/files/${ids.photo2}?version=${older.id}`);
    // next.config.ts's static /api/admin/** headers answer "no-store" (the handler's own "private, no-store" is no stricter).
    expect(download).toMatchObject({ status: 200, type: "image/png", cache: "no-store", sniff: "nosniff" });
    expect(download.disposition).toContain("attachment");
    expect(download.disposition).toContain("test-second-photo-v2.png");
    const events = (await auditOf(ids.photo2)).map((e) => `${e.action}:${e.outcome}`);
    expect(events).toEqual(expect.arrayContaining(["media.replace:success", "media.restore_version:success", "media.original_download:success"]));
    // The Editor sees the versions but can't restore one.
    const editor = await as(browser, "editor");
    await open(editor, `/admin/media/${ids.photo2}`);
    await expect(editor.locator("#versions").getByRole("button", { name: /^Make version/ })).toHaveCount(0);
    await expect(editor.locator("#versions").getByRole("link", { name: /^Download/ })).toHaveCount(0);
  });
});

// --- Certificates ---------------------------------------------------------------------------------------------------------

test.describe("certificate documents", () => {
  test("the Owner's private original: acknowledged, private storage, never public or approvable; the download needs a fresh step-up", async ({ browser, request }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin/certificates/new");
    await expect(owner.getByText("Public and private files are kept apart.")).toBeVisible();
    await owner.getByLabel("Slug", { exact: true }).fill("test-media-certificate");
    await english(owner).getByLabel(/^Title/).fill("Test Media Certificate");
    await english(owner).getByLabel(/^Issuer/).fill("Test Body");
    await owner.getByRole("button", { name: "Create certificate" }).click();
    await owner.waitForURL(/created=1/);
    await owner.locator("main h1").waitFor();
    ids.certificate = idFrom(owner);
    const section = owner.locator("#private-original");
    await expect(section.getByRole("heading", { name: "Private original (Owner only)" })).toBeVisible();
    await expect(section).toContainText("No private original yet.");
    await expect(section).toContainText("This file can never be published.");
    await expect(section.locator('input[type="file"]')).toHaveCount(0);
    await section.getByLabel("I understand that this file can never be published").check();
    await section.getByLabel("Upload private original").setInputFiles({ name: "test-private-original.pdf", mimeType: "application/pdf", buffer: syntheticPdf("Synthetic private test document") });
    await expect(section.locator(".adm-media-summary")).toContainText("Private — never publishable", { timeout: 60_000 });
    const [doc] = await queryTestDb<{ media_id: string }>("SELECT media_id FROM certificate_documents WHERE certificate_id = ? AND role = 'private_original'", [ids.certificate]);
    ids.private = doc.media_id;
    expect(await assetState(ids.private)).toMatchObject({ visibility: "private", usage_status: "internal", published: 0 });
    const [file] = await queryTestDb<{ storage_area: string; variants: number }>(
      "SELECT f.storage_area, (SELECT COUNT(*) FROM media_variants v WHERE v.file_id = f.id) AS variants FROM media_files f WHERE f.media_id = ?",
      [ids.private],
    );
    expect(file).toEqual({ storage_area: "private", variants: 0 });
    // Its page: never publishable, no approval, no preview; not deliverable at any public address.
    await open(owner, `/admin/media/${ids.private}`);
    await expect(owner.locator("main .adm-alert.is-warning")).toContainText("This file can never be published.");
    await expect(badges(owner)).toContainText("Private — never publishable");
    await expect(badges(owner)).toContainText("Internal (private)");
    await expect(statusButton(owner, "Approve for public use")).toHaveCount(0);
    await expect(owner.locator("#overview img")).toHaveCount(0);
    expect((await fetchIn(owner, `/api/admin/media/${ids.private}/preview/thumb`)).status).toBe(404);
    expect((await request.get(`/media/u/${ids.private}/document-00000000.pdf`)).status()).toBe(404);
    // The download needs a step-up within the last 10 minutes: refused when the sign-in is older, served after one.
    await ageAuthentication(USERS.owner.email);
    await open(owner, `/admin/media/${ids.private}`);
    await expect(owner.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
    await expect(owner.getByRole("link", { name: "Download the private original" })).toHaveCount(0);
    const refused = await fetchIn(owner, `/api/admin/files/${ids.private}`);
    expect(refused.status).toBe(403);
    await owner.getByLabel("Password", { exact: true }).fill(USERS.owner.password);
    await owner.getByLabel("Authentication code").fill(await freshCode(secrets.owner!));
    await owner.getByRole("button", { name: "Confirm" }).click();
    const link = owner.getByRole("link", { name: "Download the private original" });
    await expect(link).toBeVisible();
    const [download] = await Promise.all([owner.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe("test-private-original.pdf");
    const served = await fetchIn(owner, `/api/admin/files/${ids.private}`);
    expect(served).toMatchObject({ status: 200, type: "application/pdf", cache: "no-store", sniff: "nosniff" });
    expect(served.disposition).toContain("attachment");
    const events = (await auditOf(ids.private)).map((e) => `${e.action}:${e.outcome}`);
    expect(events).toEqual(expect.arrayContaining(["media.private_upload:success", "media.download:denied", "media.private_download:success"]));
    expect(events.filter((e) => e === "media.private_download:success").length).toBeGreaterThanOrEqual(2);
  });

  test("the redacted preview is a separate public-class upload that starts pending; an Admin never sees the private original", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, `/admin/certificates/${ids.certificate}`);
    const media = owner.locator("#media");
    await expect(media).toContainText("A redacted public-class image only. A private original can never be chosen.");
    await media.getByRole("button", { name: "Add preview…" }).click();
    const picker = owner.getByRole("dialog", { name: "Add to redacted public previews" });
    await expect(pickerStatus(picker)).toHaveText(/can be chosen/);
    await picker.getByLabel("Search media").fill("test-private-original");
    await picker.getByLabel("Search media").press("Enter");
    await expect(picker.getByText("Nothing to choose for this search.")).toBeVisible();
    expect(owner.url(), "Enter in the picker's search never submits the certificate").toContain(`/admin/certificates/${ids.certificate}`);
    // Upload the redacted copy in the picker: it is chosen once uploaded, pending review.
    await picker.getByLabel("Or upload a new file").setInputFiles({ name: "test-redacted-preview.png", mimeType: "image/png", buffer: await flatImage(1000, 700, [230, 230, 225]) });
    await expect(picker).toBeHidden({ timeout: 60_000 });
    const entry = media.locator(".adm-media-entry");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("test-redacted-preview.png");
    await expect(entry).toContainText("Pending review");
    await expect(entry).toContainText("choosing it never approves it");
    await entry.getByLabel("Language of preview 1").selectOption("en");
    await owner.getByRole("button", { name: "Save draft" }).click();
    await owner.waitForURL(/saved=1/);
    await owner.locator("main h1").waitFor();
    const docs = await queryTestDb<{ role: string; media_id: string; locale: string | null }>(
      "SELECT role, media_id, locale FROM certificate_documents WHERE certificate_id = ? ORDER BY CAST(role AS CHAR)",
      [ids.certificate],
    );
    expect(docs.map((d) => [d.role, d.locale])).toEqual([
      ["private_original", null],
      ["public_preview", "en"],
    ]);
    ids.preview = docs[1].media_id;
    expect(ids.preview).not.toBe(ids.private);
    expect(await assetState(ids.preview)).toMatchObject({ visibility: "public", usage_status: "pending_review", published: 0 });
    // The editor tells them apart: the preview in the Media section, the original in its own Owner-only section.
    await expect(owner.locator("#media .adm-media-entry")).not.toContainText("Private");
    await expect(owner.locator("#private-original .adm-media-summary")).toContainText("Private — never publishable");
    // A modified page that puts the private original among the previews is refused, and nothing changes.
    await owner.evaluate((privateId) => {
      const input = document.querySelector<HTMLInputElement>('input[name="mediaList.previews"]')!;
      const entries = JSON.parse(input.value) as unknown[];
      input.value = JSON.stringify([...entries, { media: privateId, locale: null }]);
    }, ids.private);
    await owner.getByRole("button", { name: "Save draft" }).click();
    await expect(owner.locator("main").getByRole("alert")).toContainText("The chosen media item can't be used here.");
    expect(await queryTestDb("SELECT media_id FROM certificate_documents WHERE certificate_id = ? AND role = 'public_preview'", [ids.certificate])).toEqual([{ media_id: ids.preview }]);
    // The Admin: no private section, no private item anywhere, and the private upload purpose does not exist for them.
    const admin = await as(browser, "admin");
    await open(admin, `/admin/certificates/${ids.certificate}`);
    await expect(admin.locator("#private-original")).toHaveCount(0);
    await expect(admin.getByRole("navigation", { name: "Sections of this form" }).getByRole("link", { name: "Private original" })).toHaveCount(0);
    await expect(admin.locator("#media .adm-media-entry")).toHaveCount(1);
    await admin.goto(`/admin/media/${ids.private}`);
    await expect(admin.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await open(admin, "/admin/media?q=private");
    await expect(admin.locator(".adm-media-tile-title")).toHaveCount(0);
    await expect(admin.getByLabel("Visibility")).toHaveCount(0);
    expect((await fetchIn(admin, `/api/admin/files/${ids.private}`)).status).toBe(404);
    const opened = await fetchIn(admin, "/api/admin/media/uploads", {
      method: "POST",
      body: JSON.stringify({ purpose: "private_original", filename: "test.pdf", size: 1000, certificateId: ids.certificate }),
    });
    expect(opened.status).toBe(404);
    // The Owner's library filter shows it as private.
    await open(owner, "/admin/media?visibility=private");
    await expect(owner.locator(".adm-media-tile")).toHaveCount(1);
    await expect(owner.locator(".adm-media-tile")).toContainText("Private — never publishable");
  });
});

// --- Content media --------------------------------------------------------------------------------------------------------

test.describe("media in content", () => {
  test("project photos: the picker offers public-class items with warnings (never a private one); keyboard order; saved, audited, stale-safe", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/projects/new");
    await editor.getByLabel("Slug", { exact: true }).fill("test-media-project");
    await english(editor).getByLabel(/^Title/).fill("Test Media Project");
    const photos = editor.locator("#media fieldset.adm-media-list");
    await expect(photos.locator("legend")).toContainText("Photos (0 of at most 40)");
    await photos.getByRole("button", { name: "Add photo…" }).click();
    const picker = editor.getByRole("dialog", { name: "Add to photos" });
    const pick = (label: string) => picker.locator("button.adm-pick").filter({ hasText: label });
    await expect(pick("Test approved photo")).toBeVisible();
    await expect(pick("Test approved photo").locator(".adm-badges")).toHaveText("Approved");
    await expect(pick("Test workshop photo").locator(".adm-badges")).toHaveText("Restricted");
    await expect(pick("test-redacted-preview.png").locator(".adm-badges")).toHaveText("Pending review");
    // Images only here, and never the private original (whoever asks: this Editor can't know it exists).
    await expect(pick("test-document.pdf")).toHaveCount(0);
    await expect(picker.locator("button.adm-pick")).toHaveCount(3);
    await pick("Test approved photo").click();
    await expect(picker).toBeHidden();
    await expect(photos.getByRole("button", { name: "Add photo…" })).toBeFocused();
    await photos.getByRole("button", { name: "Add photo…" }).click();
    await expect(pick("Test approved photo"), "a chosen item is not offered twice").toHaveCount(0);
    await pick("Test workshop photo").click();
    const entries = photos.locator(".adm-media-entry");
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(1)).toContainText("Restricted");
    await expect(entries.nth(1)).toContainText("Not public until approved and published; choosing it never approves it.");
    // Keyboard order: the second photo moves up with Enter on its button, announced politely.
    await photos.getByRole("button", { name: "Move photo 2 up" }).focus();
    await editor.keyboard.press("Enter");
    await expect(entries.nth(0)).toContainText("Test workshop photo");
    await expect(photos.locator('span.adm-sr-only[role="status"]')).toHaveText("Test workshop photo moved to position 1 of 2.");
    await expect(photos.getByRole("button", { name: "Move photo 1 down" })).toBeFocused();
    await editor.getByRole("button", { name: "Create project" }).click();
    await editor.waitForURL(/created=1/);
    await editor.locator("main h1").waitFor();
    ids.project = idFrom(editor);
    const stored = await queryTestDb<{ media_id: string; position: number }>("SELECT media_id, position FROM project_media WHERE project_id = ? ORDER BY position", [ids.project]);
    expect(stored).toEqual([
      { media_id: ids.photo, position: 1 },
      { media_id: ids.photo2, position: 2 },
    ]);
    // Choosing never approves or publishes anything.
    expect(await assetState(ids.photo)).toMatchObject({ usage_status: "restricted", published: 0 });
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "approved", published: 1 });
    const [created] = await queryTestDb<{ changes: string }>("SELECT CAST(changes AS CHAR) AS changes FROM audit_events WHERE action = 'project.create' AND entity_id = ?", [ids.project]);
    expect((JSON.parse(created.changes) as { media: Record<string, number> }).media.photos).toBe(2);
    // Used by: the item's page lists the project.
    await open(editor, `/admin/media/${ids.photo2}`);
    await expect(editor.locator("#used-by").getByRole("link", { name: "Test Media Project" })).toBeVisible();
    // Stale: a second tab saves first; the older tab's save is refused and its choice stays on screen.
    const other = await signedIn(browser, "editor");
    await open(editor, `/admin/projects/${ids.project}`);
    await open(other, `/admin/projects/${ids.project}`);
    await other.locator("#media").getByRole("button", { name: "Move photo 1 down" }).click();
    await other.getByRole("button", { name: "Save draft" }).click();
    await other.waitForURL(/saved=1/);
    await editor.locator("#media").getByRole("button", { name: "Remove photo 2" }).click();
    await editor.getByRole("button", { name: "Save draft" }).click();
    await expect(editor.locator("main").getByRole("alert")).toContainText("This content changed after you opened it.");
    await expect(editor.locator("#media .adm-media-entry")).toHaveCount(1);
    expect((await queryTestDb<{ media_id: string }>("SELECT media_id FROM project_media WHERE project_id = ? ORDER BY position", [ids.project])).map((r) => r.media_id)).toEqual([ids.photo2, ids.photo]);
    await other.context().close();
  });

  test("client logos: colour and monochrome slots, an upload inside the picker, no SVG", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, "/admin/clients/new");
    await editor.getByLabel("Slug", { exact: true }).fill("test-media-client");
    await english(editor).getByLabel(/^Name/).fill("Test Media Client");
    const colour = editor.locator("#media fieldset.adm-media-slot").filter({ hasText: "Logo (colour)" });
    const mono = editor.locator("#media fieldset.adm-media-slot").filter({ hasText: "Logo (monochrome)" });
    await expect(colour).toContainText("A raster logo (no SVG upload).");
    await colour.getByRole("button", { name: "Choose logo (colour)…" }).click();
    let picker = editor.getByRole("dialog", { name: "Choose logo (colour)" });
    await picker.locator("button.adm-pick").filter({ hasText: "Test approved photo" }).click();
    await expect(colour.locator(".adm-media-summary")).toContainText("Test approved photo");
    // An SVG is refused by the server whatever the browser sends; nothing is created.
    const before = (await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM media_assets"))[0].n;
    await mono.getByRole("button", { name: "Choose logo (monochrome)…" }).click();
    picker = editor.getByRole("dialog", { name: "Choose logo (monochrome)" });
    await picker.getByLabel("Or upload a new file").setInputFiles({ name: "test-logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    await expect(picker.getByRole("alert")).toBeVisible();
    expect((await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM media_assets"))[0].n).toBe(before);
    await picker.getByLabel("Or upload a new file").setInputFiles({ name: "test-mono-logo.png", mimeType: "image/png", buffer: await flatImage(400, 200, [20, 20, 20]) });
    await expect(picker).toBeHidden({ timeout: 60_000 });
    await expect(mono.locator(".adm-media-summary")).toContainText("test-mono-logo.png");
    await expect(mono.locator(".adm-media-summary")).toContainText("Pending review");
    await editor.getByRole("button", { name: "Create client" }).click();
    await editor.waitForURL(/created=1/);
    await editor.locator("main h1").waitFor();
    const [client] = await queryTestDb<{ logo: string; mono: string }>("SELECT logo_media_id AS logo, logo_mono_media_id AS mono FROM clients WHERE slug = 'test-media-client'");
    expect(client.logo).toBe(ids.photo2);
    expect(await assetState(client.mono)).toMatchObject({ visibility: "public", usage_status: "pending_review", published: 0 });
    // Removing the mono logo empties its slot.
    await mono.getByRole("button", { name: "Remove" }).click();
    await expect(mono).toContainText("None chosen.");
    await editor.getByRole("button", { name: "Save draft" }).click();
    await editor.waitForURL(/saved=1/);
    expect((await queryTestDb<{ mono: string | null }>("SELECT logo_mono_media_id AS mono FROM clients WHERE slug = 'test-media-client'"))[0].mono).toBeNull();
  });

  test("the Trash and the archive: items leave the library and the pickers and come back to review; content keeps what it had", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, `/admin/media/${ids.pdf}`);
    await confirm(admin, statusButton(admin, "Move to the Trash"), {}, "Move to the Trash");
    await expect(badges(admin)).toContainText("In the Trash");
    await expect(admin.locator("main .adm-alert.is-info")).toContainText("This item is in the Trash");
    await expect(english(admin).getByLabel("English title")).toBeDisabled();
    await open(admin, "/admin/media?kind=document");
    await expect(admin.locator(".adm-media-tile-title")).toHaveCount(0);
    await open(admin, "/admin/media?trash=1");
    await expect(admin.locator("main h1")).toHaveText("Media Trash");
    await expect(admin.locator(".adm-media-tile-title")).toHaveText(["test-document.pdf"]);
    // Not offered by the certificate's picker (documents allowed there) while in the Trash.
    await open(admin, `/admin/certificates/${ids.certificate}`);
    await admin.locator("#media").getByRole("button", { name: "Add preview…" }).click();
    let picker = admin.getByRole("dialog", { name: "Add to redacted public previews" });
    await expect(pickerStatus(picker)).toHaveText(/can be chosen/);
    await expect(picker.locator("button.adm-pick").filter({ hasText: "test-document.pdf" })).toHaveCount(0);
    await picker.getByRole("button", { name: "Close" }).click();
    await open(admin, `/admin/media/${ids.pdf}`);
    await confirm(admin, statusButton(admin, "Restore from the Trash"), {}, "Restore");
    await expect(badges(admin)).toHaveText("Pending review");
    // Archived: kept, read-only for new choices, back to review on restore.
    await confirm(admin, statusButton(admin, "Archive"), {}, "Archive");
    await expect(badges(admin)).toHaveText("Archived");
    await open(admin, `/admin/certificates/${ids.certificate}`);
    await admin.locator("#media").getByRole("button", { name: "Add preview…" }).click();
    picker = admin.getByRole("dialog", { name: "Add to redacted public previews" });
    await expect(pickerStatus(picker)).toHaveText(/can be chosen/);
    await expect(picker.locator("button.adm-pick").filter({ hasText: "test-document.pdf" })).toHaveCount(0);
    await picker.getByRole("button", { name: "Close" }).click();
    await open(admin, `/admin/media/${ids.pdf}`);
    await confirm(admin, statusButton(admin, "Restore from the archive"), { Reason: "Test: needed again." }, "Restore");
    await expect(badges(admin)).toHaveText("Pending review");
    // A trashed photo stays in the project that had it, marked; restored, it keeps its restriction.
    await open(admin, `/admin/media/${ids.photo}`);
    await confirm(admin, statusButton(admin, "Move to the Trash"), {}, "Move to the Trash");
    await open(admin, `/admin/projects/${ids.project}`);
    const kept = admin.locator("#media .adm-media-entry").filter({ hasText: "Test workshop photo" });
    await expect(kept).toContainText("In the Trash");
    await admin.getByRole("button", { name: "Save draft" }).click();
    await admin.waitForURL(/saved=1/);
    expect(await queryTestDb("SELECT media_id FROM project_media WHERE project_id = ? AND media_id = ?", [ids.project, ids.photo])).toHaveLength(1);
    await open(admin, `/admin/media/${ids.photo}`);
    await confirm(admin, statusButton(admin, "Restore from the Trash"), {}, "Restore");
    await expect(badges(admin)).toHaveText("Restricted");
    const events = (await auditOf(ids.pdf)).map((e) => e.action);
    expect(events).toEqual(expect.arrayContaining(["media.trash", "media.untrash", "media.archive", "media.unarchive"]));
  });
});

// --- Permissions ----------------------------------------------------------------------------------------------------------

test.describe("permissions", () => {
  test("a Reviewer views and flags only; an Editor can't approve, restrict, trash or download; forged requests are refused and audited", async ({ browser }) => {
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, "/admin/media");
    await expect(reviewer.getByRole("heading", { name: "Upload" })).toHaveCount(0);
    await open(reviewer, `/admin/media/${ids.pdf}`);
    await expect(reviewer.locator("#overview")).toContainText("Your roles don't allow status changes for this item.");
    await expect(reviewer.getByRole("button", { name: "Save details" })).toHaveCount(0);
    await expect(english(reviewer).getByLabel("English title")).toBeDisabled();
    await expect(reviewer.getByLabel("Add a flag")).toBeVisible();
    await expect(reviewer.locator("#versions").getByLabel("Replace with a new version")).toHaveCount(0);
    await open(reviewer, "/admin/media/folders");
    await expect(reviewer.getByText("Your roles let you view folders, not change them.")).toBeVisible();
    const reviewerUpload = await fetchIn(reviewer, "/api/admin/media/uploads", { method: "POST", body: JSON.stringify({ purpose: "new", filename: "test.png", size: 1000 }) });
    expect(reviewerUpload.status).toBe(403);
    const pdfBefore = await assetState(ids.pdf);
    await open(reviewer, `/admin/media/${ids.pdf}`);
    await forgeAction(reviewer, "saveMediaMetadataAction", { _id: ids.pdf, lockVersion: String(pdfBefore.lock_version), "en.title": "Changed by a forged request" });
    const editor = await as(browser, "editor");
    await open(editor, `/admin/media/${ids.pdf}`);
    for (const name of ["Approve for public use", "Restrict", "Archive", "Move to the Trash"]) await expect(statusButton(editor, name)).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Save details" })).toBeVisible();
    await forgeAction(editor, "approveMediaAction", { id: ids.pdf, version: String(pdfBefore.lock_version), note: "Forged approval" });
    await forgeAction(editor, "trashMediaAction", { id: ids.pdf });
    await forgeAction(editor, "restrictMediaAction", { id: ids.photo2, reason: "Forged restriction" });
    expect(await assetState(ids.pdf)).toMatchObject({ usage_status: "pending_review", deleted: 0, lock_version: pdfBefore.lock_version });
    expect(await assetState(ids.photo2)).toMatchObject({ usage_status: "approved", published: 1 });
    expect((await fetchIn(editor, `/api/admin/files/${ids.photo2}`)).status).toBe(403);
    expect((await fetchIn(editor, `/api/admin/files/${ids.private}`)).status).toBe(404);
    expect((await fetchIn(editor, `/api/admin/media/${ids.private}/preview/thumb`)).status).toBe(404);
    await editor.goto(`/admin/media/${ids.private}`);
    await expect(editor.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const denied = (await auditOf(ids.pdf)).filter((e) => e.outcome === "denied").map((e) => `${e.action}:${e.actor}`);
    expect(denied).toEqual(expect.arrayContaining(["media.update:media.reviewer@example.test", "media.approve:media.editor@example.test", "media.trash:media.editor@example.test"]));
    // The dashboard's media facts are real counts (and say that no quota is known).
    const owner = await as(browser, "owner");
    await open(owner, "/admin");
    const card = owner.locator("main section").filter({ has: owner.getByRole("heading", { name: "Media", exact: true }) });
    await expect(card).toContainText("The hosting account's disk quota is not known here, so none is shown.");
    const counts = await queryTestDb<{ s: string; n: number }>("SELECT usage_status AS s, COUNT(*) AS n FROM media_assets WHERE deleted_at IS NULL GROUP BY usage_status");
    const fact = (term: string) => card.locator("dt").filter({ hasText: new RegExp(`^${term}$`) }).locator("xpath=following-sibling::dd[1]");
    for (const [term, status] of [["Pending review", "pending_review"], ["Approved", "approved"], ["Restricted", "restricted"]]) {
      const n = counts.find((c) => c.s === status)?.n ?? 0;
      await expect(fact(term), term).toHaveText(String(n));
      if (n) await expect(fact(term).getByRole("link"), term).toHaveAttribute("href", `/admin/media?status=${status}`);
    }
    await expect(fact("Private documents")).toHaveText("1");
  });
});

// --- Phones, dark mode, accessibility -------------------------------------------------------------------------------------

test.describe("phones, dark mode, accessibility and the CSP", () => {
  test("390 px light and dark, and 320 px: library, item, folders and the picker without sideways scrolling; axe; no inline styles", async ({ browser }) => {
    for (const setting of [
      { viewport: { width: 390, height: 844 }, colorScheme: "light" as const },
      { viewport: { width: 390, height: 844 }, colorScheme: "dark" as const },
      { viewport: { width: 320, height: 700 }, colorScheme: "light" as const },
    ]) {
      const page = await signedIn(browser, "editor", setting);
      const label = `${setting.viewport.width} ${setting.colorScheme}`;
      for (const path of ["/admin/media", "/admin/media?view=list", `/admin/media/${ids.photo2}`, "/admin/media/folders", "/admin"]) {
        await open(page, path);
        expect(await pageOverflow(page), `${label} ${path}`).toBeLessThanOrEqual(0);
        const styled = await page.evaluate(() => [...document.querySelectorAll("[style]")].filter((e) => e.localName !== "next-route-announcer").length);
        expect(styled, `${label} ${path}: no inline style attributes`).toBe(0);
      }
      if (setting.colorScheme === "dark") {
        const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(background).toBe("rgb(14, 18, 23)");
      }
      await open(page, `/admin/projects/${ids.project}`);
      await page.locator("#media").getByRole("button", { name: "Add photo…" }).click();
      const picker = page.getByRole("dialog", { name: "Add to photos" });
      await expect(pickerStatus(picker)).toHaveText(/can be chosen/);
      expect(await pageOverflow(page), `${label} picker`).toBeLessThanOrEqual(0);
      const box = await picker.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(setting.viewport.width);
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await expect(page.locator("#media").getByRole("button", { name: "Add photo…" })).toBeFocused();
      await page.context().close();
    }
    // Every content editor with media fields at 320 px, as the Owner (a certificate shows its redacted previews and its
    // private originals): the pickers' long labels ("Choose logo (monochrome)…") wrap instead of widening the page.
    const owner = await signedIn(browser, "owner", { viewport: { width: 320, height: 700 } });
    for (const path of [`/admin/certificates/${ids.certificate}`, "/admin/certificates/new", "/admin/clients/new", "/admin/services/new", "/admin/machinery/new", "/admin/industries/new", `/admin/projects/${ids.project}`]) {
      await open(owner, path);
      expect(await pageOverflow(owner), `320 owner ${path}`).toBeLessThanOrEqual(0);
      const wide = await owner.evaluate(() =>
        [...document.querySelectorAll("main .adm-btn")].filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && (r.left < -0.5 || r.right > document.documentElement.clientWidth + 0.5);
        }).length,
      );
      expect(wide, `320 owner ${path}: every button inside the screen`).toBe(0);
    }
    await owner.context().close();
    // axe on the library (grid and list), an item and the folders, light and dark.
    for (const colorScheme of ["light", "dark"] as const) {
      const page = await signedIn(browser, "editor", { colorScheme });
      for (const path of ["/admin/media", "/admin/media?view=list", `/admin/media/${ids.photo2}`, "/admin/media/folders"]) {
        await open(page, path);
        await page.waitForLoadState("networkidle");
        expect(await axe(page), `${colorScheme} ${path}`).toEqual([]);
      }
      const html = await (await page.request.get(`/admin/media/${ids.photo2}`)).text();
      expect(html).not.toMatch(/<[a-z][^>]*\sstyle=/i);
      await page.context().close();
    }
  });
});

// --- The admin gate -------------------------------------------------------------------------------------------------------

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
      RAWASY_DATA_DIR: run().dataDir,
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
const GATE_HEADERS = {
  origin: "https://admin.example.test",
  "x-forwarded-host": "admin.example.test",
  cookie: `__Host-rawasy_admin=${"A".repeat(43)}`,
};
/** Every A4 Server Action that takes a form, as a forged request with a made-up session (React's reply encoding). */
function mediaActionRequests() {
  return (
    [
      ["saveMediaMetadataAction", { _id: GATE_ID, lockVersion: "0" }],
      ["addMediaFlagAction", { id: GATE_ID, flag: "rights_pending", note: "" }],
      ["clearMediaFlagAction", { id: GATE_ID, flag: "rights_pending", token: "1", note: "x" }],
      ["approveMediaAction", { id: GATE_ID, version: "0", note: "x" }],
      ["restrictMediaAction", { id: GATE_ID, reason: "x" }],
      ["trashMediaAction", { id: GATE_ID }],
      ["restoreVersionAction", { id: GATE_ID, file: GATE_ID, version: "0" }],
      ["createFolderAction", { name: "Gate test" }],
      ["deleteFolderAction", { id: GATE_ID }],
    ] as const
  ).map(([name, fields]) => {
    const multipart = new FormData();
    for (const [k, v] of Object.entries(fields)) multipart.append(`_1_${k}`, v);
    multipart.append("0", '[{"status":"idle"},"$K1"]');
    return { name, options: { headers: { ...GATE_HEADERS, "next-action": actionId(name), accept: "text/x-component" }, multipart, maxRedirects: 0 } };
  });
}
/** pickMediaAction takes a plain object (the picker calls it directly): React's encoding of one argument. */
function pickRequest() {
  const multipart = new FormData();
  multipart.append("0", JSON.stringify([{ q: "", kinds: ["image"], page: 1 }]));
  return { headers: { ...GATE_HEADERS, "next-action": actionId("pickMediaAction"), accept: "text/x-component" }, multipart, maxRedirects: 0 };
}
/** The A4 Route Handlers, each with the method it answers (a made-up session, the admin's origin). */
function mediaRouteRequests(client: APIRequestContext): [string, () => Promise<APIResponse>][] {
  const json = { headers: { ...GATE_HEADERS, "content-type": "application/json" }, maxRedirects: 0 };
  return [
    ["POST /api/admin/media/uploads", () => client.post("/api/admin/media/uploads", { ...json, data: { purpose: "new", filename: "x.png", size: 10 } })],
    ["PUT …/parts/1", () => client.put(`/api/admin/media/uploads/${GATE_ID}/parts/1`, { headers: GATE_HEADERS, data: Buffer.alloc(10), maxRedirects: 0 })],
    ["POST …/complete", () => client.post(`/api/admin/media/uploads/${GATE_ID}/complete`, { ...json, data: {} })],
    ["DELETE …/uploads/id", () => client.delete(`/api/admin/media/uploads/${GATE_ID}`, { headers: GATE_HEADERS, maxRedirects: 0 })],
    ["GET /api/admin/files/id", () => client.get(`/api/admin/files/${GATE_ID}`, { headers: GATE_HEADERS, maxRedirects: 0 })],
    ["GET …/preview/thumb", () => client.get(`/api/admin/media/${GATE_ID}/preview/thumb`, { headers: GATE_HEADERS, maxRedirects: 0 })],
    ["GET /media/u/…", () => client.get(`/media/u/${GATE_ID}/w320-0123abcd.webp`, { maxRedirects: 0 })],
  ];
}
const A4_PAGES = ["/admin/media", "/admin/media/folders", `/admin/media/${GATE_ID}`];

test.describe("the admin gate", () => {
  test("off (production without ADMIN_ENABLED): every A4 page, route and media action stops before the database", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3433, db.port, { APP_ENV: "production" });
    try {
      const { client } = server;
      for (const path of A4_PAGES) {
        const r = await client.get(path, { maxRedirects: 0 });
        expect(r.status(), path).toBe(307);
        expect(r.headers().location, path).toBe(`/en${path}`);
        expect((await client.get(`/en${path}`)).status(), path).toBe(404);
      }
      for (const [name, send] of mediaRouteRequests(client)) {
        const response = await send();
        expect(response.status(), name).toBe(404);
        expect(response.headers()["cache-control"], name).toBe("no-store");
      }
      for (const { name, options } of mediaActionRequests()) {
        expect((await client.post("/admin/media", options)).status(), name).toBe(307);
        await client.post("/en", options);
      }
      expect((await client.post("/admin/media", pickRequest())).status()).toBe(307);
      await client.post("/en", pickRequest());
      expect(db.attempts(), "no database connection was attempted").toBe(0);
    } finally {
      await server.stop();
      await db.close();
    }
  });

  test("on (production, ADMIN_ENABLED=1): the same requests reach the database, so “off” means the gate stopped them", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3434, db.port, { APP_ENV: "production", ADMIN_ENABLED: "1" });
    try {
      const { client } = server;
      for (const { name, options } of [...mediaActionRequests(), { name: "pickMediaAction", options: pickRequest() }]) {
        const before = db.attempts();
        await client.post("/en", options);
        expect(db.attempts(), name).toBeGreaterThan(before);
      }
      for (const [name, send] of mediaRouteRequests(client)) {
        const before = db.attempts();
        const response = await send();
        // Each one looks the made-up session up (or, for /media/u, the item) and finds the database unreachable.
        expect(response.status(), name).toBe(503);
        expect(db.attempts(), name).toBeGreaterThan(before);
      }
    } finally {
      await server.stop();
      await db.close();
    }
  });
});
