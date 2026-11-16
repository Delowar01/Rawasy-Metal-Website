/**
 * A9 acceptance: the whole publishing path on a database-content release, end to end — the admin and the public
 * website from one server, on a disposable database filled by the real content import (e2e-dbmode/server.mjs).
 *
 * An Editor edits a project's title in both languages and saves; the public website keeps the live version. The Editor
 * submits it; still not public. A Reviewer approves and publishes; the next request of the public page, its Arabic page
 * and the gallery show the new titles (the cache generation moved; nothing old is served). An Admin rolls back to the
 * imported version from the history; the public pages follow. A fixed record of the approved composition can't be
 * unpublished (refused in the dialog, the page stays). The Admin unpublishes the project; its pages answer 404 and the
 * gallery and the sitemap drop it; publishing it again brings it back. The audit log holds each step with its actor.
 * A fixed page taken offline (About, the homepage, the privacy policy) answers the website's localized 404 in its own
 * language, never Next.js's bare page (A9 F-1), and returns when published again.
 * Nothing is faked: every step goes through the pages and Server Actions; the public answers are plain requests (no
 * cookie) and a browser page. Test data only.
 */
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { cliEnv, freshCode, queryTestDb } from "../e2e-admin/helpers";
import { publicEffectTexts } from "../src/server/admin/public-effect";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const SLUG = "gateway-welcome-signs";
const FIXED = "clock-tower-landmark";
const ORIGINAL = { en: "Gateway Welcome Signs", ar: "لوحات مداخل المحافظة" };
/** What the admin says about the public website on this release (a database-content one). */
const SAYS = publicEffectTexts(true);
const EDITED = { en: "Test Gateway Signs, edited in the admin", ar: "لوحات المداخل، نص اختبار من لوحة التحكم" };

const ROLES = ["admin", "editor", "reviewer", "owner"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "flow.owner@example.test", name: "Test Flow Owner", password: "database flow owner phrase lantern", mfa: true },
  admin: { email: "flow.admin@example.test", name: "Test Flow Admin", password: "database flow admin phrase harbour", mfa: true },
  editor: { email: "flow.editor@example.test", name: "Test Flow Editor", password: "database flow editor phrase willow", mfa: false },
  reviewer: { email: "flow.reviewer@example.test", name: "Test Flow Reviewer", password: "database flow reviewer phrase quarry", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
let projectId = "";
let fixedId = "";

async function as(browser: Browser, role: Role): Promise<Page> {
  if (pages[role]) return pages[role]!;
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
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
  pages[role] = page;
  return page;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main :is(h1, h2)").first().waitFor();
}

const panel = (page: Page) => page.locator("#publishing");

/** Opens a workflow step's dialog, fills it and confirms; waits until the dialog closes (a success). */
async function step(page: Page, button: string, confirm = button) {
  await panel(page).getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: confirm, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/** The public project page as a visitor's plain request gets it (no cookie): status, headers and its one h1. */
async function publicPage(browser: Browser, locale: "en" | "ar", slug = SLUG) {
  const context = await browser.newContext();
  try {
    const response = await context.request.get(`/${locale}/projects/${slug}`, { maxRedirects: 0 });
    const html = await response.text();
    const h1 = /<h1[^>]*id="page-title"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
    return { status: response.status(), cache: response.headers()["cache-control"], h1 };
  } finally {
    await context.close();
  }
}

/** What a visitor's browser draws: the project page's heading and the gallery card. */
async function drawn(browser: Browser, locale: "en" | "ar") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  try {
    const page = await context.newPage();
    await page.goto(`/${locale}/projects/${SLUG}`);
    const heading = (await page.locator("h1#page-title").textContent())?.trim();
    await page.goto(`/${locale}/projects`);
    const card = page.locator(`#${SLUG}`);
    const inGallery = (await card.count()) ? ((await card.textContent()) ?? "").replace(/\s+/g, " ") : null;
    return { heading, inGallery };
  } finally {
    await context.close();
  }
}

const generation = async () => Number((await queryTestDb<{ v: number }>("SELECT value AS v FROM cache_generation WHERE id = 1"))[0].v);

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
  projectId = (await queryTestDb<{ id: string }>("SELECT id FROM projects WHERE slug = ?", [SLUG]))[0].id;
  fixedId = (await queryTestDb<{ id: string }>("SELECT id FROM projects WHERE slug = ?", [FIXED]))[0].id;
});

test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

test.afterAll(async () => {
  for (const page of Object.values(pages)) await page?.context().close();
});

test("the imported website is live in database mode: the project page in both languages, kept by the page cache", async ({ browser }) => {
  for (const locale of ["en", "ar"] as const) {
    const first = await publicPage(browser, locale);
    expect(first).toEqual({ status: 200, cache: "private, no-cache", h1: ORIGINAL[locale] });
    expect(await publicPage(browser, locale)).toEqual(first);
  }
  expect(await drawn(browser, "en")).toEqual({ heading: ORIGINAL.en, inGallery: expect.stringContaining(ORIGINAL.en) });
});

test("an Editor's saved edit stays in the admin: the public pages keep the live version", async ({ browser }) => {
  const editor = await as(browser, "editor");
  await open(editor, `/admin/projects/${projectId}`);
  await expect(panel(editor)).toContainText("Published");
  // The editor is told the truth about this release: what is published is what visitors see (not "until the cutover").
  await expect(panel(editor)).toContainText(SAYS.panelPublic);
  await expect(editor.locator("main")).toContainText(SAYS.statusPublic);
  await expect(editor.locator("main")).not.toContainText("cutover");
  await editor.locator("#english").getByLabel(/^Title/).fill(EDITED.en);
  await editor.locator("#arabic").getByLabel(/^Title/).fill(EDITED.ar);
  await editor.getByLabel("English is complete").check();
  await editor.getByLabel("Arabic is complete").check();
  const before = await generation();
  await editor.getByRole("button", { name: "Save draft" }).click();
  await editor.waitForURL(/[?&]saved=1/);
  await expect(panel(editor)).toContainText("Published · changes in draft");
  expect(await generation(), "a save publishes nothing").toBe(before);
  for (const locale of ["en", "ar"] as const) expect((await publicPage(browser, locale)).h1).toBe(ORIGINAL[locale]);
});

test("submitted for review: still not public", async ({ browser }) => {
  const editor = await as(browser, "editor");
  await open(editor, `/admin/projects/${projectId}`);
  await step(editor, "Submit for review");
  await expect(panel(editor)).toContainText("Published · changes in review");
  for (const locale of ["en", "ar"] as const) expect((await publicPage(browser, locale)).h1).toBe(ORIGINAL[locale]);
});

test("the Reviewer approves and publishes: the next request shows it, in both languages and in the gallery", async ({ browser }) => {
  const reviewer = await as(browser, "reviewer");
  await open(reviewer, `/admin/projects/${projectId}`);
  const before = await generation();
  await panel(reviewer).getByRole("button", { name: "Approve and publish", exact: true }).click();
  await expect(reviewer.getByRole("dialog")).toContainText(`${SAYS.publishDialog}.`);
  await reviewer.getByRole("dialog").getByRole("button", { name: "Approve and publish", exact: true }).click();
  await expect(reviewer.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await expect(panel(reviewer)).toContainText("Published");
  expect(await generation()).toBeGreaterThan(before);
  for (const locale of ["en", "ar"] as const) expect(await publicPage(browser, locale)).toEqual({ status: 200, cache: "private, no-cache", h1: EDITED[locale] });
  expect(await drawn(browser, "en")).toEqual({ heading: EDITED.en, inGallery: expect.stringContaining(EDITED.en) });
  expect(await drawn(browser, "ar")).toEqual({ heading: EDITED.ar, inGallery: expect.stringContaining(EDITED.ar) });
});

test("an Admin rolls back to the imported version from the history: the public pages follow", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await open(admin, `/admin/history/project/${projectId}`);
  const rollback = admin.locator("main tbody tr").getByRole("button", { name: "Roll back to this" });
  await expect(rollback).toHaveCount(1);
  await rollback.click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("button", { name: "Roll back and publish", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  for (const locale of ["en", "ar"] as const) expect((await publicPage(browser, locale)).h1).toBe(ORIGINAL[locale]);
  expect(await drawn(browser, "ar")).toEqual({ heading: ORIGINAL.ar, inGallery: expect.stringContaining(ORIGINAL.ar) });
});

test("a record the approved composition needs can't be unpublished: refused in the dialog, the page stays", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await open(admin, `/admin/projects/${fixedId}`);
  await panel(admin).getByRole("button", { name: "Unpublish", exact: true }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(dialog).toContainText(/fixed place/);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect((await publicPage(browser, "en", FIXED)).status).toBe(200);
  expect(await queryTestDb("SELECT 1 FROM published_documents WHERE entity_type = 'project' AND entity_id = ?", [fixedId])).toHaveLength(1);
});

test("unpublished: the project's pages answer 404 and the gallery and the sitemap drop it; published again, it returns", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await open(admin, `/admin/projects/${projectId}`);
  await step(admin, "Unpublish");
  for (const locale of ["en", "ar"] as const) expect((await publicPage(browser, locale)).status).toBe(404);
  expect((await drawn(browser, "en")).inGallery).toBeNull();
  const context = await browser.newContext();
  const sitemap = await (await context.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain(`/projects/${SLUG}<`);
  expect(sitemap).toContain(`/projects/${FIXED}<`);
  await open(admin, `/admin/projects/${projectId}`);
  await step(admin, "Publish");
  for (const locale of ["en", "ar"] as const) expect(await publicPage(browser, locale)).toEqual({ status: 200, cache: "private, no-cache", h1: ORIGINAL[locale] });
  expect(await (await context.request.get("/sitemap.xml")).text()).toContain(`/projects/${SLUG}<`);
  await context.close();
});

test("the audit log holds every step with its actor", async () => {
  const rows = await queryTestDb<{ action: string; outcome: string; actor: string | null }>(
    "SELECT a.action, a.outcome, u.email AS actor FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.entity_id IN (?, ?) AND a.action LIKE 'project.%' ORDER BY a.id",
    [projectId, fixedId],
  );
  const seen = rows.map((r) => `${r.action} ${r.outcome} ${r.actor}`);
  for (const expected of [
    `project.update success ${USERS.editor.email}`,
    `project.submit success ${USERS.editor.email}`,
    `project.publish success ${USERS.reviewer.email}`,
    `project.rollback success ${USERS.admin.email}`,
    `project.unpublish success ${USERS.admin.email}`,
    `project.publish success ${USERS.admin.email}`,
  ])
    expect(seen).toContain(expected);
  expect(seen.some((s) => s.startsWith("project.unpublish ") && !s.includes(" success ") && s.endsWith(USERS.admin.email)), "the refused unpublish is audited").toBe(true);
});

test("the media library tells an editor that withdrawing a photo changes the public website", async ({ browser }) => {
  const editor = await as(browser, "editor");
  await open(editor, "/admin/media");
  await expect(editor.locator("main")).toContainText(SAYS.mediaLead);
  await expect(editor.locator("main")).not.toContainText("Nothing here changes the public website");
});

// A9 F-1 (the staging preflight): a fixed page that is not live answers the website's own localized 404 — its language,
// its header and footer, a way home, "Page not found" and noindex — never Next.js's bare English page, and nothing of the
// page that went offline. A live page carries none of it.
const LOCALES = ["en", "ar"] as const;
type Locale = (typeof LOCALES)[number];
const NOT_FOUND = {
  en: { title: "Page not found | RAWASY", h1: "Outside the blueprint", lang: "en", dir: "ltr" },
  ar: { title: "الصفحة غير موجودة | رواسي", h1: "خارج المخطط", lang: "ar-SA", dir: "rtl" },
} as const;
const pageId = async (key: string) => (await queryTestDb<{ id: string }>("SELECT id FROM pages WHERE system_key = ?", [key]))[0].id;

/** A fixed address as a visitor gets it: the plain answer (no cookie) and what a browser draws there. */
async function visit(browser: Browser, path: string, colorScheme: "light" | "dark" = "light") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme });
  try {
    const plain = await context.request.get(path, { maxRedirects: 0 });
    const html = await plain.text();
    const page = await context.newPage();
    const response = await page.goto(path);
    await page.locator("main h1").first().waitFor();
    const drawn = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      theme: document.documentElement.dataset.theme ?? "",
      title: document.title,
      h1: [...document.querySelectorAll("main h1")].map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim()),
      header: document.querySelectorAll("header.a2-header").length,
      footer: document.querySelectorAll("footer").length,
      home: [...document.querySelectorAll("main a")].some((a) => /^\/(en|ar)\/?$/.test(a.getAttribute("href") ?? "")),
      text: document.body.innerText,
    }));
    return { status: plain.status(), browserStatus: response?.status(), bytes: Buffer.byteLength(html), html, ...drawn };
  } finally {
    await context.close();
  }
}

/** The website's localized 404 at a fixed page's address, with nothing of the page that is offline. */
function expectLocalized404(result: Awaited<ReturnType<typeof visit>>, locale: Locale, offlineHeading: string, theme: "light" | "dark") {
  const want = NOT_FOUND[locale];
  expect(result.status).toBe(404);
  expect(result.browserStatus).toBe(404);
  expect(result.html).toMatch(/<meta name="robots" content="noindex"/);
  expect(result.html).toContain(`<title>${want.title}</title>`);
  expect({ lang: result.lang, dir: result.dir, theme: result.theme, title: result.title, h1: result.h1 }).toEqual({ lang: want.lang, dir: want.dir, theme, title: want.title, h1: [want.h1] });
  expect(result.header, "the website's header").toBe(1);
  expect(result.footer, "the website's footer").toBeGreaterThanOrEqual(1);
  expect(result.home, "a way home from the 404").toBe(true);
  expect(result.text).not.toMatch(/This page could not be found/);
  expect(result.text, "nothing of the page that is offline").not.toContain(offlineHeading);
  expect(result.html, "nothing of the page that is offline").not.toContain(offlineHeading);
}

const sitemapPaths = async (browser: Browser) => {
  const context = await browser.newContext();
  const xml = await (await context.request.get("/sitemap.xml")).text();
  await context.close();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
};

test("A9 F-1: About taken offline answers the website's localized 404 in each language; published again, it returns", async ({ browser }) => {
  const id = await pageId("about");
  const live = { en: await visit(browser, "/en/about"), ar: await visit(browser, "/ar/about", "dark") };
  for (const locale of LOCALES) {
    expect(live[locale].status).toBe(200);
    expect(live[locale].html, "a live page carries no 404").not.toContain(NOT_FOUND[locale].h1);
  }
  const heading = { en: live.en.h1[0], ar: live.ar.h1[0] };
  const admin = await as(browser, "admin");
  await open(admin, `/admin/pages/${id}`);
  await step(admin, "Unpublish");
  expectLocalized404(await visit(browser, "/en/about"), "en", heading.en, "light");
  expectLocalized404(await visit(browser, "/ar/about", "dark"), "ar", heading.ar, "dark");
  const offline = await sitemapPaths(browser);
  expect(offline).not.toContain("/en/about");
  expect(offline).toContain("/en/contact");
  await open(admin, `/admin/pages/${id}`);
  await step(admin, "Publish");
  for (const locale of LOCALES) {
    const back = await visit(browser, `/${locale}/about`);
    expect({ status: back.status, h1: back.h1 }).toEqual({ status: 200, h1: [heading[locale]] });
  }
  expect(await sitemapPaths(browser)).toContain("/en/about");
});

test("A9 F-1: the homepage taken offline answers the localized 404; the other pages stay; published again, it returns", async ({ browser }) => {
  const id = await pageId("home");
  const live = { en: await visit(browser, "/en"), ar: await visit(browser, "/ar") };
  const contactBefore = await visit(browser, "/en/contact");
  for (const locale of LOCALES) expect(live[locale].html, "a live page carries no 404").not.toContain(NOT_FOUND[locale].h1);
  expect(contactBefore.html, "a live page carries no 404").not.toContain(NOT_FOUND.en.h1);
  const admin = await as(browser, "admin");
  await open(admin, `/admin/pages/${id}`);
  await step(admin, "Unpublish");
  expectLocalized404(await visit(browser, "/en"), "en", live.en.h1[0], "light");
  expectLocalized404(await visit(browser, "/ar", "dark"), "ar", live.ar.h1[0], "dark");
  const contact = await visit(browser, "/en/contact");
  expect({ status: contact.status, h1: contact.h1 }).toEqual({ status: 200, h1: contactBefore.h1 });
  // Measured for the report: while the homepage is offline its boundary (beside the website's root layout) draws the 404
  // into every page's data; once it is live again, nothing.
  console.log(`F-1 bytes /en/contact: homepage live ${contactBefore.bytes}, homepage offline ${contact.bytes}`);
  await open(admin, `/admin/pages/${id}`);
  await step(admin, "Publish");
  for (const locale of LOCALES) {
    const back = await visit(browser, `/${locale}`);
    expect({ status: back.status, h1: back.h1 }).toEqual({ status: 200, h1: live[locale].h1 });
  }
  const after = await visit(browser, "/en/contact");
  expect(after.bytes, "nothing of the 404 left in a live page").toBe(contactBefore.bytes);
});

test("A9 F-1: the privacy policy taken offline by the Owner answers the localized 404; published again with a reviewer, it returns", async ({ browser }) => {
  const id = await pageId("privacy");
  // The policy's own words (its title is also the footer's link label, which the 404 keeps).
  const policy = { en: "Information you share with us", ar: "المعلومات التي تشاركها معنا" };
  const live = { en: await visit(browser, "/en/privacy"), ar: await visit(browser, "/ar/privacy", "dark") };
  for (const locale of LOCALES) {
    expect(live[locale].status).toBe(200);
    expect(live[locale].text).toContain(policy[locale]);
  }
  const owner = await as(browser, "owner");
  await open(owner, `/admin/pages/${id}`);
  await step(owner, "Unpublish");
  expectLocalized404(await visit(browser, "/en/privacy"), "en", policy.en, "light");
  expectLocalized404(await visit(browser, "/ar/privacy", "dark"), "ar", policy.ar, "dark");
  expect(await sitemapPaths(browser)).not.toContain("/en/privacy");
  // A legal page is published again only with a named reviewer (A8); test data, not a legal review.
  await open(owner, `/admin/pages/${id}`);
  await panel(owner).getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByLabel("The legal text has been reviewed by").fill("Database-mode E2E test (not a legal review)");
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  for (const locale of LOCALES) {
    const back = await visit(browser, `/${locale}/privacy`);
    expect({ status: back.status, h1: back.h1 }).toEqual({ status: 200, h1: live[locale].h1 });
  }
  expect(await sitemapPaths(browser)).toContain("/en/privacy");
});
