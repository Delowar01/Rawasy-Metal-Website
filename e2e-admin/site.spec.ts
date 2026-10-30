/**
 * The site controls (Phase A6) end to end, on the production build against the admin suite's local MariaDB
 * (e2e-admin/server.mjs): the Site group in the admin navigation by role; Company & website (set up from today's website,
 * edited in both languages, phones, the map's place link left empty, the default share image from approved media, field
 * errors that keep what was typed, a stale second tab); Navigation (today's menus copied, the header's fixed shape, a
 * relabelled, hidden and reordered menu while another menu's typing survives, the server's rules, a stale tab);
 * Interface text (set up, search, an emptied value means today's text, too long refused); Theme (the Owner's alone, no
 * override can be entered, forged overrides refused and audited); Redirects (create, the rules, Arabic addresses,
 * deactivate and reactivate, read-only roles, a stale tab); a Reviewer's forged changes refused and audited; the
 * working copy in the private preview (the shell preview equals the public shell once set up from today's website, then
 * follows the working copy) while the public pages stay byte for byte as they were; every screen at 1280, 768, 390 and
 * 320 px in light and dark without anything past the screen, and axe; every A6 address and action behind the
 * ADMIN_ENABLED gate. No mutation is faked: every change goes through the pages and Server Actions. Test data only.
 *
 * Named to run after page-builder.spec.ts and before the parity project (preview-parity.spec.ts compares the preview
 * with the public pages, so the working copy must read as today's website there): afterAll empties the A6 working copy
 * again (the A6 tables' rows; the seed's singletons and keys stay).
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { expect, request as apiRequest, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { ageAuthentication, cli, cliEnv, freshCode, queryTestDb } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "site.owner@example.test", name: "Test Site Owner", password: "site owner phrase quarry", mfa: true },
  admin: { email: "site.admin@example.test", name: "Test Site Admin", password: "site admin phrase lagoon", mfa: true },
  editor: { email: "site.editor@example.test", name: "Test Site Editor", password: "site editor phrase thicket", mfa: false },
  reviewer: { email: "site.reviewer@example.test", name: "Test Site Reviewer", password: "site reviewer phrase beacon", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const userIds: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
const ids: Record<string, string> = {};
const SAVED = "Saved. The preview shows the working copy; visitors still see today's website.";
const STALE_SETTINGS = "The site settings changed after you opened them. Reload and review the latest version before saving.";
const STALE_MENU = "This menu changed after you opened it. Reload and review the latest version before saving.";
const STALE_REDIRECT = "This redirect changed after you opened it. Reload and review the latest version before saving.";
const INVALID = "Some fields need attention. Nothing was saved.";
const SCREENS = ["/admin/settings", "/admin/navigation", "/admin/interface-text", "/admin/redirects"] as const;

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

/** Waits for the screen a change opens again (`?…&v=<version>`): the stored version, never the router's cache. */
async function savedTo(page: Page, path: string, query: Record<string, string> = {}) {
  await page.waitForURL((url) => url.pathname === path && url.searchParams.has("v") && Object.entries(query).every(([k, v]) => url.searchParams.get(k) === v));
  await page.locator("main :is(h1, h2)").first().waitFor();
}

const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Elements of the page (visually hidden text aside) that end past the screen's right edge. */
const pastTheScreen = (page: Page) =>
  page.locator("main *").evaluateAll((els) =>
    els.filter((e) => !e.closest(".adm-sr-only") && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((e) => `${e.tagName.toLowerCase()}.${e.className}`),
  );
const main = (page: Page) => page.locator("main");
const card = (page: Page, id: string) => page.locator(`main [aria-labelledby="${id}"]`);
const menu = (page: Page, key: string) => card(page, `menu-${key}-title`);
const alertOf = (scope: Page | Locator) => scope.locator(".adm-editor-alert");

const AXE = require.resolve("axe-core/axe.min.js");
async function axe(page: Page) {
  await page.evaluate(readFileSync(AXE, "utf8"));
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (c: unknown, o: object) => Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);
  });
}

/**
 * The words and links of the page's header and footer, as drawn: their visible text, and every link's text and address
 * — the language links' addresses left out (the preview's keep the preview's own address; their words stay compared).
 */
const shellFacts = (page: Page) =>
  page.evaluate(() => {
    const parts = [...document.querySelectorAll<HTMLElement>("header.a2-header, footer.a2-footer")];
    return {
      count: parts.length,
      text: parts.map((p) => p.innerText.replace(/\s+/g, " ").trim()),
      links: parts.flatMap((p) => [...p.querySelectorAll<HTMLAnchorElement>("a")].map((a) => `${(a.textContent ?? "").replace(/\s+/g, " ").trim()} → ${a.hasAttribute("hreflang") ? "(language)" : a.getAttribute("href")}`)),
      names: parts.flatMap((p) => [...p.querySelectorAll<HTMLElement>("[aria-label]")].map((e) => e.getAttribute("aria-label"))),
    };
  });

/** The public pages' header and footer markup exactly as served and drawn (the freeze check of this spec). */
const PUBLIC_PAGES = ["/en", "/ar", "/en/contact", "/ar/contact", "/en/about"] as const;
const publicShell = async (page: Page, path: string) => {
  await page.goto(path);
  await page.locator("footer.a2-footer").waitFor();
  return page.evaluate(() => [...document.querySelectorAll("header.a2-header, footer.a2-footer")].map((e) => e.outerHTML).join("\n"));
};
const publicBefore: Record<string, string> = {};
const publicHtmlBefore: Record<string, string> = {};

/** One of the admin's Server Actions in this build (from Next's own manifest). */
function actionId(name: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { exportedName?: string; filename?: string }>;
  };
  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && v.filename?.startsWith("src/server/admin/actions/"));
  if (!found) throw new Error(`No Server Action ${name} in the build.`);
  return found[0];
}

/** Sends a Server Action by hand from a signed-in page (React's reply encoding of plain arguments). */
const forge = (page: Page, name: string, args: unknown[]) =>
  page.evaluate(
    async ({ id, args }) => {
      const body = new FormData();
      body.append("0", JSON.stringify(args));
      const response = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body });
      return response.text();
    },
    { id: actionId(name), args },
  );

const lastAudit = async (where: string, params: unknown[] = []) =>
  (
    await queryTestDb<{ action: string; outcome: string; entity_type: string; entity_id: string; summary: string; changes: unknown }>(
      `SELECT action, outcome, entity_type, entity_id, summary, changes FROM audit_events WHERE ${where} ORDER BY id DESC LIMIT 1`,
      params,
    )
  )[0];

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
    userIds[role] = seeded.id;
    if (seeded.secret) secrets[role] = seeded.secret;
  }
  // The release's own media (A4's importer: idempotent): the default share image is chosen among its approved photos.
  cli("media-import-release.mjs", []);
  const [photo] = await queryTestDb<{ id: string }>("SELECT id FROM media_assets WHERE legacy_key = 'projects/chandelier-1' AND usage_status = 'approved'");
  ids.photo = photo.id;
  const [pending] = await queryTestDb<{ id: string }>("SELECT id FROM media_assets WHERE usage_status = 'pending_review' AND deleted_at IS NULL ORDER BY id LIMIT 1");
  ids.pending = pending?.id ?? "";
});

test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

test.afterAll(async () => {
  for (const page of Object.values(pages)) await page?.context().close();
  // The working copy back to empty (today's website everywhere in the preview), for the parity project after this spec.
  await queryTestDb("UPDATE site_settings SET primary_whatsapp_phone_id = NULL, default_og_image_media_id = NULL");
  for (const table of ["company_phones", "site_setting_translations", "ui_string_translations", "menu_items", "design_token_overrides", "redirects"]) {
    await queryTestDb(`DELETE FROM ${table}`);
  }
});

// --- Before anything: the public shell as it is ----------------------------------------------------------------------------

test.describe("the starting point", () => {
  test("the public pages' header and footer, and their served HTML, recorded before any working copy exists", async ({ browser }) => {
    const context = await browser.newContext();
    const visitor = await context.newPage();
    for (const path of PUBLIC_PAGES) {
      publicBefore[path] = await publicShell(visitor, path);
      publicHtmlBefore[path] = await (await context.request.get(path)).text();
    }
    await context.close();
    expect(Object.keys(publicBefore)).toHaveLength(PUBLIC_PAGES.length);
    // The working copy is empty: nothing of A6 holds a company fact yet (the seed writes none).
    expect(await queryTestDb("SELECT 1 FROM site_setting_translations")).toEqual([]);
    expect(await queryTestDb("SELECT 1 FROM menu_items")).toEqual([]);
    expect(await queryTestDb("SELECT 1 FROM ui_string_translations")).toEqual([]);
    expect(await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM ui_strings")).toEqual([{ n: 34 }]);
    expect(await queryTestDb<{ key: string }>("SELECT `key` FROM menus ORDER BY `key`")).toEqual([
      { key: "footer_company" },
      { key: "footer_legal" },
      { key: "header_main" },
      { key: "header_services" },
    ]);
  });
});

// --- Roles -------------------------------------------------------------------------------------------------------------------

test.describe("the Site screens by role", () => {
  test("the Site group in the admin navigation: the Owner has five screens, the other roles four (Theme is the Owner's alone)", async ({ browser }) => {
    const expected: Record<Role, string[]> = {
      owner: ["Company & website", "Navigation", "Interface text", "Redirects", "Theme"],
      admin: ["Company & website", "Navigation", "Interface text", "Redirects"],
      editor: ["Company & website", "Navigation", "Interface text", "Redirects"],
      reviewer: ["Company & website", "Navigation", "Interface text", "Redirects"],
    };
    for (const role of ROLES) {
      const page = await as(browser, role);
      await open(page, "/admin");
      const nav = page.getByRole("complementary").getByRole("navigation", { name: "Admin sections" });
      const group = nav.locator(".adm-nav-group", { has: page.locator(".adm-nav-title", { hasText: /^Site$/ }) });
      expect(await group.getByRole("link").allTextContents(), role).toEqual(expected[role]);
    }
    // The theme screen itself: the Owner only, whatever the address.
    for (const role of ["admin", "editor", "reviewer"] as const) {
      const page = await as(browser, role);
      await open(page, "/admin/theme");
      await expect(main(page).getByRole("heading", { name: "You don't have access to this page" }), role).toBeVisible();
    }
    // Redirects: only Owner and Admin may create one.
    for (const role of ["editor", "reviewer"] as const) {
      const page = await as(browser, role);
      await open(page, "/admin/redirects");
      await expect(main(page).getByRole("link", { name: "New redirect" })).toHaveCount(0);
      await open(page, "/admin/redirects/new");
      await expect(main(page).getByRole("heading", { name: "You don't have access to this page" }), role).toBeVisible();
    }
  });

  test("before set-up every role reads that the working copy is empty; only Owner and Admin can copy today's website", async ({ browser }) => {
    for (const role of ROLES) {
      const page = await as(browser, role);
      for (const path of SCREENS.slice(0, 3)) {
        await open(page, path);
        await expect(main(page).getByRole("heading", { name: "Not set up yet" }), `${role} ${path}`).toBeVisible();
        await expect(main(page).getByText("Working copy only: the public website keeps today's settings, menus and text", { exact: false })).toBeVisible();
        const copy = main(page).getByRole("button", { name: /^Copy today's/ });
        if (role === "owner" || role === "admin") await expect(copy, `${role} ${path}`).toBeVisible();
        else {
          await expect(copy, `${role} ${path}`).toHaveCount(0);
          await expect(main(page).getByText("An Owner or Admin can set it up.")).toBeVisible();
        }
      }
    }
  });
});

// --- Company & website (A6.1) ------------------------------------------------------------------------------------------------

test.describe("company & website", () => {
  test("an Admin copies today's company details: the form holds the website's values; the map's place link and the SEO description stay empty", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/settings");
    await main(admin).getByRole("button", { name: "Copy today's company details" }).click();
    await savedTo(admin, "/admin/settings", { saved: "1" });
    await expect(main(admin).getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    // Today's values, as the public footer shows them.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto("/en");
    const email = ((await visitor.locator("footer.a2-footer a[href^='mailto:']").first().getAttribute("href")) ?? "").replace("mailto:", "");
    const phones = await visitor.locator("footer.a2-footer a[href^='tel:']").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
    await visitor.context().close();
    expect(email).toMatch(/@/);
    await expect(main(admin).getByLabel("Email", { exact: true })).toHaveValue(email);
    for (const [i, display] of phones.entries()) await expect(main(admin).getByLabel(`Number ${i + 1} as shown`)).toHaveValue(display);
    await expect(main(admin).getByLabel("RAWASY's own Google Maps place link (optional)")).toHaveValue("");
    await expect(main(admin).getByText("Pending RAWASY's confirmation: leave it empty until RAWASY confirms its own place link.", { exact: false })).toBeVisible();
    await expect(card(admin, "settings-en-title").getByLabel("Default SEO description (optional)")).toHaveValue("");
    await expect(card(admin, "settings-en-title").getByLabel("Legal name")).not.toHaveValue("");
    // Arabic: right to left, in Arabic.
    const arabicName = card(admin, "settings-ar-title").getByLabel("Legal name");
    await expect(arabicName).toHaveAttribute("dir", "rtl");
    await expect(arabicName).toHaveAttribute("lang", "ar");
    expect(await arabicName.inputValue()).toMatch(/[؀-ۿ]/);
    const [row] = await queryTestDb<{ maps_place_url: string | null; email: string }>("SELECT maps_place_url, email FROM site_settings WHERE id = 'site'");
    expect(row).toEqual({ maps_place_url: null, email });
    expect(await lastAudit("action = 'site_settings.setup'")).toMatchObject({ outcome: "success", entity_type: "site_settings", entity_id: "site" });
    // A second copy changes nothing (the working copy is set up).
    expect(await forge(admin, "setUpSettingsAction", [])).toContain("already set up");
  });

  test("edit both languages, the phones and the share image, and save: stored, audited by field name, shown in the preview, never on the public site", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/settings");
    const [{ v: version }] = await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM site_settings");
    await main(admin).getByLabel("Email", { exact: true }).fill("test.office@example.test");
    await card(admin, "settings-en-title").getByLabel("Company statement").fill("Test working statement for the preview.");
    await card(admin, "settings-ar-title").getByLabel("Company statement").fill("بيان تجريبي للمعاينة.");
    // A third number, shown, without WhatsApp; then moved up to second place.
    await main(admin).getByRole("button", { name: "Add a phone number" }).click();
    const count = await main(admin).locator("li.adm-site-row").count();
    await main(admin).getByLabel(`Number ${count} as shown`).fill("011 000 0000");
    await main(admin).getByLabel(`Number ${count} for links (+966…)`).fill("+966110000000");
    await main(admin).getByRole("button", { name: `Move up number ${count}` }).click();
    await expect(main(admin).getByLabel(`Number ${count - 1} as shown`)).toHaveValue("011 000 0000");
    // The default share image: an approved photo of the release, from the picker.
    await main(admin).getByRole("button", { name: "Choose default share image…" }).click();
    const picker = admin.getByRole("dialog", { name: "Choose default share image" });
    await picker.getByLabel("Search media").fill("chandelier-1");
    await picker.getByRole("button", { name: "Search", exact: true }).click();
    await picker.locator("button.adm-pick").filter({ hasText: "chandelier-1" }).first().click();
    await expect(picker).toBeHidden();
    await expect(admin.locator(".adm-savebar-status")).toHaveText("Unsaved changes");
    await admin.getByRole("button", { name: "Save settings" }).click();
    await savedTo(admin, "/admin/settings", { saved: "1" });
    await expect(main(admin).getByLabel("Email", { exact: true })).toHaveValue("test.office@example.test");
    await expect(main(admin).getByLabel(`Number ${count - 1} as shown`)).toHaveValue("011 000 0000");
    const [stored] = await queryTestDb<{ email: string; og: string; v: number }>("SELECT email, default_og_image_media_id AS og, lock_version AS v FROM site_settings");
    expect(stored).toEqual({ email: "test.office@example.test", og: ids.photo, v: version + 1 });
    const audit = await lastAudit("action = 'site_settings.update' AND outcome = 'success'");
    expect(audit).toMatchObject({ entity_type: "site_settings", entity_id: "site" });
    // The audit names the fields, never their values.
    expect(JSON.stringify(audit.changes)).not.toContain("test.office@example.test");
    expect(JSON.stringify(audit.changes)).toContain("email");
    // The preview's footer shows the working copy, in both languages.
    const preview = await admin.context().newPage();
    await preview.goto("/admin/preview/site/shell?locale=en&theme=light");
    await expect(preview.locator("footer.a2-footer")).toContainText("Test working statement for the preview.");
    await expect(preview.locator("footer.a2-footer a[href='mailto:test.office@example.test']")).toHaveCount(1);
    await expect(preview.locator("footer.a2-footer a[href='tel:+966110000000']")).toHaveCount(1);
    await preview.goto("/admin/preview/site/shell?locale=ar&theme=dark");
    await expect(preview.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(preview.locator("footer.a2-footer")).toContainText("بيان تجريبي للمعاينة.");
    await preview.close();
    // Visitors: nothing changed.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto("/en");
    await expect(visitor.locator("footer.a2-footer")).not.toContainText("Test working statement");
    await expect(visitor.locator("footer.a2-footer a[href='mailto:test.office@example.test']")).toHaveCount(0);
    await visitor.context().close();
  });

  test("errors: each named at its field, nothing stored, every typed value kept; a guessed map link and a pending photo are refused", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/settings");
    const before = await queryTestDb("SELECT * FROM site_settings");
    await main(admin).getByLabel("Website address").fill("http://rawasy.example.test");
    await main(admin).getByLabel("RAWASY's own Google Maps place link (optional)").fill("https://maps.example.test/place/rawasy");
    await card(admin, "settings-en-title").getByLabel("Brand name").fill("Test typed brand name kept");
    await card(admin, "settings-ar-title").getByLabel("Legal name").fill("");
    await admin.getByRole("button", { name: "Save settings" }).click();
    await expect(alertOf(admin)).toContainText(INVALID);
    await expect(main(admin).locator("#f-websiteUrl-error")).toBeVisible();
    await expect(main(admin).getByLabel("Website address")).toHaveAttribute("aria-invalid", "true");
    await expect(main(admin).locator("#f-mapsPlaceUrl-error")).toBeVisible();
    await expect(main(admin).locator("#f-texts-ar-legalName-error")).toBeVisible();
    await expect(card(admin, "settings-en-title").getByLabel("Brand name")).toHaveValue("Test typed brand name kept");
    await expect(main(admin).getByLabel("Website address")).toHaveValue("http://rawasy.example.test");
    expect(await queryTestDb("SELECT * FROM site_settings")).toEqual(before);
    // The server checks the share image again: a photo still in review is refused even when sent by hand.
    if (ids.pending) {
      const [{ v }] = await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM site_settings");
      const answer = await forge(admin, "saveSettingsAction", [{ ...(await settingsInput()), expectedVersion: v, defaultOgImageMediaId: ids.pending }]);
      expect(answer).toContain(INVALID);
      expect((await queryTestDb<{ og: string }>("SELECT default_og_image_media_id AS og FROM site_settings"))[0].og).toBe(ids.photo);
    }
  });

  test("two tabs: the second save is refused as stale with its typing kept, and reloads the latest version on request", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin/settings");
    const second = await owner.context().newPage();
    await open(second, "/admin/settings");
    await card(owner, "settings-en-title").getByLabel("City").fill("Test City One");
    await owner.getByRole("button", { name: "Save settings" }).click();
    await savedTo(owner, "/admin/settings", { saved: "1" });
    await card(second, "settings-en-title").getByLabel("City").fill("Test City Two");
    await second.getByRole("button", { name: "Save settings" }).click();
    await expect(alertOf(second)).toContainText(STALE_SETTINGS);
    await expect(card(second, "settings-en-title").getByLabel("City")).toHaveValue("Test City Two");
    const [stale] = await queryTestDb<{ outcome: string }>("SELECT outcome FROM audit_events WHERE action = 'site_settings.update' ORDER BY id DESC LIMIT 1");
    expect(stale.outcome).toBe("failed");
    await alertOf(second).getByRole("button", { name: "Reload the latest version" }).click();
    await expect(card(second, "settings-en-title").getByLabel("City")).toHaveValue("Test City One");
    await second.close();
  });
});

/** The settings form's input as the page sends it, from what is stored (for hand-made requests). */
async function settingsInput() {
  const [s] = await queryTestDb<Record<string, unknown>>("SELECT * FROM site_settings WHERE id = 'site'");
  const phones = await queryTestDb<{ id: string; display: string; e164: string; has_whatsapp: number; is_visible: number }>("SELECT * FROM company_phones ORDER BY position");
  const t = await queryTestDb<Record<string, unknown>>("SELECT * FROM site_setting_translations ORDER BY locale");
  const texts = Object.fromEntries(
    t.map((r) => [
      r.locale,
      {
        siteName: r.site_name,
        brandName: r.brand_name,
        legalName: r.legal_name,
        statement: r.statement,
        addressLines: typeof r.address_lines === "string" ? JSON.parse(r.address_lines as string) : r.address_lines,
        addressFull: r.address_full,
        streetAddress: r.street_address,
        city: r.city,
        country: r.country,
        visionStatement: r.vision_statement,
        visionAims: typeof r.vision_aims === "string" ? JSON.parse(r.vision_aims as string) : r.vision_aims,
        visionClosing: r.vision_closing,
        defaultSeoDescription: r.default_seo_description ?? "",
      },
    ]),
  );
  return {
    websiteUrl: s.website_url,
    email: s.email,
    postalCode: s.postal_code ?? "",
    geoLat: s.geo_lat === null ? "" : String(s.geo_lat),
    geoLng: s.geo_lng === null ? "" : String(s.geo_lng),
    geoIsApproximate: Boolean(s.geo_is_approximate),
    facebookUrl: s.facebook_url ?? "",
    mapsPlaceUrl: s.maps_place_url ?? "",
    mapsQuery: s.maps_query,
    defaultOgImageMediaId: s.default_og_image_media_id ?? "",
    phones: phones.map((p) => ({ id: p.id, display: p.display, e164: p.e164, hasWhatsapp: Boolean(p.has_whatsapp), isVisible: Boolean(p.is_visible) })),
    texts,
    status: { en: "complete", ar: "complete" },
  };
}

// --- Navigation (A6.2) --------------------------------------------------------------------------------------------------------

test.describe("navigation", () => {
  test("an Admin copies today's navigation: four menus with today's pages and labels; the header's shape is fixed where the design needs it", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/navigation");
    await main(admin).getByRole("button", { name: "Copy today's navigation" }).click();
    await savedTo(admin, "/admin/navigation");
    expect(await main(admin).locator("form.adm-site-menu h2").allTextContents()).toEqual(["Header navigation", "Services menu", "Footer company links", "Footer legal links"]);
    const header = menu(admin, "header_main");
    expect(await header.locator("li.adm-site-row").count()).toBe(8);
    await expect(header.getByLabel("Label (English)").nth(1)).toHaveValue("About");
    await expect(header.getByLabel("Label (Arabic)").nth(1)).toHaveValue("من نحن");
    // Services stays third: no page choice, no moving or removing it, and the first three always show.
    const services = header.locator("li.adm-site-row").nth(2);
    await expect(services).toContainText("opens the Services menu; stays third");
    await expect(services.getByLabel("Page")).toHaveCount(0);
    await expect(services.getByRole("button", { name: /^Move up/ })).toBeDisabled();
    await expect(services.getByRole("button", { name: /^Move down/ })).toBeDisabled();
    await expect(services.getByRole("button", { name: /^Remove/ })).toBeDisabled();
    for (const n of [0, 1, 2]) await expect(header.locator("li.adm-site-row").nth(n).getByLabel(/^Shown/)).toBeDisabled();
    await expect(header.locator("li.adm-site-row").nth(1).getByRole("button", { name: /^Move down/ })).toBeDisabled();
    // The Services menu: its live services and one label, nothing to move.
    const servicesMenu = menu(admin, "header_services");
    await expect(servicesMenu).toContainText("The live services");
    await expect(servicesMenu.getByRole("button", { name: /^(Move|Remove|Add)/ })).toHaveCount(0);
    expect(await lastAudit("action = 'menu.setup'")).toMatchObject({ outcome: "success" });
  });

  test("relabel, hide and reorder the header and save it; the footer's unsaved typing survives; the preview's header follows, the public one doesn't", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/navigation");
    const footer = menu(admin, "footer_company");
    await footer.getByLabel("Label (English)").first().fill("Test about the company");
    const header = menu(admin, "header_main");
    await header.getByLabel("Label (English)").nth(1).fill("Test About");
    await header.getByLabel("Label (Arabic)").nth(1).fill("تجربة من نحن");
    // Hide Industries (sixth), move Clients (seventh) above it.
    const rows = header.locator("li.adm-site-row");
    await rows.nth(5).getByLabel(/^Shown/).uncheck();
    await rows.nth(6).getByRole("button", { name: /^Move up/ }).click();
    await expect(rows.nth(5).getByLabel("Label (English)")).toHaveValue("Clients");
    await header.getByRole("button", { name: "Save header navigation" }).click();
    await savedTo(admin, "/admin/navigation", { saved: "header_main" });
    await expect(main(admin).getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    // The other menu kept its typing (it was not saved, and it is keyed by its own version).
    await expect(menu(admin, "footer_company").getByLabel("Label (English)").first()).toHaveValue("Test about the company");
    await expect(menu(admin, "footer_company").locator(".adm-savebar-status")).toHaveText("Unsaved changes");
    await menu(admin, "footer_company").getByRole("button", { name: "Save footer company links" }).click();
    await savedTo(admin, "/admin/navigation", { saved: "footer_company" });
    const stored = await queryTestDb<{ position: number; route_key: string; is_visible: number; en: string }>(
      "SELECT i.position, i.route_key, i.is_visible, t.label AS en FROM menu_items i JOIN menu_item_translations t ON t.item_id = i.id AND t.locale = 'en' WHERE i.menu_key = 'header_main' ORDER BY i.position",
    );
    expect(stored.map((r) => r.route_key)).toEqual(["home", "about", "services", "capabilities", "projects", "clients", "industries", "contact"]);
    expect(stored.find((r) => r.route_key === "industries")!.is_visible).toBe(0);
    expect(stored[1].en).toBe("Test About");
    // The preview: the working menus.
    const preview = await admin.context().newPage();
    await preview.goto("/admin/preview/site/shell?locale=en&theme=light");
    const nav = preview.locator("header.a2-header .a2-nav").first();
    await expect(nav).toContainText("Test About");
    await expect(nav).not.toContainText("Industries");
    await expect(preview.locator("footer.a2-footer")).toContainText("Test about the company");
    await preview.goto("/admin/preview/site/shell?locale=ar&theme=light");
    await expect(preview.locator("header.a2-header .a2-nav").first()).toContainText("تجربة من نحن");
    await preview.close();
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto("/en");
    await expect(visitor.locator("header.a2-header")).not.toContainText("Test About");
    await expect(visitor.locator("header.a2-header .a2-nav").first()).toContainText("Industries");
    await visitor.context().close();
  });

  test("the server's rules: a label too long, an empty Arabic label and a menu with too few items are refused at their fields", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/navigation");
    const before = await queryTestDb("SELECT * FROM menu_item_translations ORDER BY item_id, locale");
    const header = menu(admin, "header_main");
    await header.getByLabel("Label (English)").nth(3).fill("Test label that is much too long for the header");
    await header.getByLabel("Label (Arabic)").nth(4).fill("");
    await expect(header.locator("li.adm-site-row").nth(3).locator(".adm-site-count").first()).toHaveText("47 / 24");
    await header.getByRole("button", { name: "Save header navigation" }).click();
    await expect(alertOf(header)).toContainText(INVALID);
    await expect(header.locator("#menu-header_main-3-en-error")).toBeVisible();
    await expect(header.locator("#menu-header_main-4-ar-error")).toBeVisible();
    await expect(header.getByLabel("Label (English)").nth(3)).toHaveValue("Test label that is much too long for the header");
    expect(await queryTestDb("SELECT * FROM menu_item_translations ORDER BY item_id, locale")).toEqual(before);
    // Too few legal links, sent by hand: the server keeps the minimum.
    const [legal] = await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM menus WHERE `key` = 'footer_legal'");
    const answer = await forge(admin, "saveMenuAction", [{ key: "footer_legal", expectedVersion: legal.v, items: [] }]);
    expect(answer).toContain(INVALID);
    expect(await queryTestDb("SELECT * FROM menu_item_translations ORDER BY item_id, locale")).toEqual(before);
  });

  test("two tabs: the second save of the same menu is refused as stale", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin/navigation");
    const second = await owner.context().newPage();
    await open(second, "/admin/navigation");
    await menu(owner, "footer_legal").getByLabel("Label (English)").first().fill("Test privacy");
    await menu(owner, "footer_legal").getByRole("button", { name: "Save footer legal links" }).click();
    await savedTo(owner, "/admin/navigation", { saved: "footer_legal" });
    await menu(second, "footer_legal").getByLabel("Label (English)").first().fill("Test privacy two");
    await menu(second, "footer_legal").getByRole("button", { name: "Save footer legal links" }).click();
    await expect(alertOf(menu(second, "footer_legal"))).toContainText(STALE_MENU);
    await expect(menu(second, "footer_legal").getByLabel("Label (English)").first()).toHaveValue("Test privacy two");
    await second.close();
  });
});

// --- Interface text (A6.3) ----------------------------------------------------------------------------------------------------

test.describe("interface text", () => {
  test("set up, search by name, key and either language; an emptied value means today's text; too long refused; the preview follows", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/interface-text");
    await main(admin).getByRole("button", { name: "Copy today's interface text" }).click();
    await savedTo(admin, "/admin/interface-text", { saved: "1" });
    await expect(main(admin).getByText("Set: English 34 / 34, Arabic 34 / 34", { exact: false })).toBeVisible();
    expect(await main(admin).locator("section.adm-site-ui-group h2").allTextContents()).toEqual([
      "Accessibility labels",
      "Controls",
      "Common words",
      "Footer",
      "Navigation",
      "Page not found",
    ]);
    // Search: by key, by description, by an Arabic value.
    const search = main(admin).getByLabel("Find a text");
    await search.fill("backToTop");
    expect(await main(admin).locator("li.adm-site-row").count()).toBe(1);
    await search.fill("skip link");
    await expect(main(admin).locator("li.adm-site-row").first()).toContainText("a11y.skipToContent");
    await expect(main(admin).locator("#ui-common-backToTop-ar")).toHaveCount(0);
    await search.fill("");
    const arabicBack = await main(admin).locator("#ui-common-backToTop-ar").inputValue();
    expect(arabicBack).toMatch(/[\u0600-\u06ff]/);
    await search.fill(arabicBack);
    await expect(main(admin).locator("#ui-common-backToTop-ar")).toBeVisible();
    await search.fill("no such interface text at all");
    await expect(main(admin).getByText("No text matches", { exact: false })).toBeVisible();
    await search.fill("");
    // The language switch's label is written in the language it leads to.
    await expect(main(admin).locator("#ui-a11y-languageSwitch-en")).toHaveAttribute("lang", "ar");
    await expect(main(admin).locator("#ui-a11y-languageSwitch-en")).toHaveAttribute("dir", "rtl");
    await expect(main(admin).locator("#ui-a11y-languageSwitch-ar")).toHaveAttribute("lang", "en");
    // Too long: refused at its field, typing kept, nothing stored.
    const before = await queryTestDb("SELECT * FROM ui_string_translations ORDER BY string_key, locale");
    await main(admin).locator("#ui-a11y-skipToContent-en").fill("Test skip link label that is far too long for its forty characters");
    await admin.getByRole("button", { name: "Save interface text" }).click();
    await expect(alertOf(admin)).toContainText(INVALID);
    await expect(main(admin).locator("#ui-a11y-skipToContent-en-error")).toBeVisible();
    await expect(main(admin).locator("#ui-a11y-skipToContent-en")).toHaveValue("Test skip link label that is far too long for its forty characters");
    expect(await queryTestDb("SELECT * FROM ui_string_translations ORDER BY string_key, locale")).toEqual(before);
    // Fixed, one changed, one emptied (today's text then shows).
    await main(admin).locator("#ui-a11y-skipToContent-en").fill("Test skip to the content");
    await main(admin).locator("#ui-common-backToTop-en").fill("Test back to top");
    const todayQuote = ((await main(admin).locator("#ui-controls-getQuote-ar-today span").textContent()) ?? "").trim();
    await main(admin).locator("#ui-controls-getQuote-ar").fill("");
    await expect(main(admin).locator("#ui-controls-getQuote-ar-count")).toContainText("empty: today's text shows");
    await admin.getByRole("button", { name: "Save interface text" }).click();
    await savedTo(admin, "/admin/interface-text", { saved: "1" });
    await expect(main(admin).locator("#ui-common-backToTop-en")).toHaveValue("Test back to top");
    await expect(main(admin).locator("#ui-controls-getQuote-ar")).toHaveValue("");
    expect(await queryTestDb("SELECT 1 FROM ui_string_translations WHERE string_key = 'controls.getQuote' AND locale = 'ar'")).toEqual([]);
    const audit = await lastAudit("action = 'ui_text.update' AND outcome = 'success'");
    expect(audit.summary).toBe("Edited the interface text: 3 values.");
    // The preview: the working text, and today's where the working value is empty.
    const preview = await admin.context().newPage();
    await preview.goto("/admin/preview/site/shell?locale=en&theme=light");
    await expect(preview.locator("footer.a2-footer")).toContainText("Test back to top");
    await expect(preview.locator("a.skip-link")).toHaveText("Test skip to the content");
    await preview.goto("/admin/preview/site/shell?locale=ar&theme=light");
    await expect(preview.locator("header.a2-header")).toContainText(todayQuote);
    await preview.close();
  });
});

// --- Theme (A6.4) -------------------------------------------------------------------------------------------------------------

test.describe("theme", () => {
  test("the Owner sees the approved design and no override to make: no field, and no action of the build can set one; removing overrides is the Owner's, with a recent sign-in", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, "/admin/theme");
    await expect(main(owner).getByText("No design token is approved for overriding", { exact: false })).toBeVisible();
    await expect(main(owner).getByText("Overrides: none.")).toBeVisible();
    await expect(main(owner).locator("input, textarea, select, [contenteditable]")).toHaveCount(0);
    expect(await main(owner).locator("tbody tr").count()).toBe(10);
    await expect(main(owner).locator("tbody th").first()).toHaveText("--brand");
    // Nothing in this build can set an override: no screen offers one until the Owner approves a token (D-A6-3), so Next
    // registers no Server Action for it and no request can reach the service (whose refusals the integration tests check).
    expect(() => actionId("setTokenOverrideAction")).toThrow("No Server Action setTokenOverrideAction in the build.");
    // Removing overrides: the Owner, with nothing to remove, changes nothing; an Admin is refused before anything is read.
    const [{ v }] = await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM theme_settings");
    expect(await forge(owner, "resetThemeAction", [{ expectedVersion: v }])).toContain("The theme is already the approved design.");
    const admin = await as(browser, "admin");
    await open(admin, "/admin/settings");
    expect(await forge(admin, "resetThemeAction", [{ expectedVersion: v }])).toMatch(/"status":"error"/);
    expect(await lastAudit("action = 'theme.reset' AND entity_id = ?", [userIds.admin])).toMatchObject({ outcome: "denied", entity_type: "user", summary: "Refused: missing permission theme.edit." });
    // The Owner's sign-in more than 10 minutes old: a recent sign-in is asked for first (audited).
    await ageAuthentication(USERS.owner.email);
    expect(await forge(owner, "resetThemeAction", [{ expectedVersion: v }])).toContain('"stepUp":true');
    expect(await lastAudit("action = 'theme.reset' AND entity_id = ?", [userIds.owner])).toMatchObject({ outcome: "denied", summary: "Refused: a recent re-authentication is required." });
    expect(await queryTestDb("SELECT * FROM design_token_overrides")).toEqual([]);
    expect((await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM theme_settings"))[0].v).toBe(v);
  });
});

// --- Redirects (A6.5) -----------------------------------------------------------------------------------------------------------

test.describe("redirects", () => {
  test("an Admin creates one from an old address to a page of the website; the list shows it; the rules refuse a live page, a loop and a chain", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/redirects");
    await expect(main(admin).getByText("No redirect yet.")).toBeVisible();
    await expect(main(admin).getByText("redirects take effect only when the website switches to the database (A9)", { exact: false })).toBeVisible();
    await main(admin).getByRole("link", { name: "New redirect" }).click();
    await admin.waitForURL("**/admin/redirects/new");
    await main(admin).getByLabel("Old address").fill("/en/old-company-page/");
    await main(admin).getByLabel("New address").fill("/en/about");
    await admin.getByRole("button", { name: "Create redirect" }).click();
    await savedTo(admin, "/admin/redirects", { saved: "created" });
    const row = main(admin).locator("tbody tr").first();
    await expect(row).toContainText("/en/old-company-page");
    await expect(row).toContainText("/en/about");
    await expect(row).toContainText("Permanent (308)");
    await expect(row).toContainText("Active");
    const [stored] = await queryTestDb<{ id: string; source_path: string; target_type: string; target_path: string; status_code: number; is_active: number }>(
      "SELECT id, source_path, target_type, target_path, status_code, is_active FROM redirects",
    );
    expect(stored).toMatchObject({ source_path: "/en/old-company-page", target_type: "path", target_path: "/en/about", status_code: 308, is_active: 1 });
    ids.redirect = stored.id;
    expect(await lastAudit("action = 'redirect.create' AND outcome = 'success'")).toMatchObject({ entity_type: "redirect", entity_id: stored.id });
    // The rules, each at its field.
    const attempt = async (source: string, target: string) => {
      await open(admin, "/admin/redirects/new");
      await main(admin).getByLabel("Old address").fill(source);
      await main(admin).getByLabel("New address").fill(target);
      await admin.getByRole("button", { name: "Create redirect" }).click();
      await expect(alertOf(admin)).toContainText(INVALID);
      // Read without waiting: only the field at fault has an error line.
      return { source: (await main(admin).locator("#f-sourcePath-error").allTextContents()).join(" "), target: (await main(admin).locator("#f-targetPath-error").allTextContents()).join(" ") };
    };
    expect((await attempt("/en/about", "/en/contact")).source).toContain("This address belongs to the website's own pages or files.");
    expect((await attempt("/en/old-company-page", "/en/contact")).source).toContain("This address already has a redirect.");
    expect((await attempt("/en/old-loop", "/en/old-loop")).target).toContain("isn't a page of the website");
    expect((await attempt("/en/old-chain", "/en/old-company-page")).target).toContain("isn't a page of the website");
    expect((await attempt("https://rawasy.example.test/en/x", "/en/about")).source).toContain("without the domain");
    expect((await attempt("/en/old%E2%80%8Bpage", "/en/about")).source).toContain("invisible formatting marks");
    expect((await attempt("/en/old-page", "/en/no-such-page")).target).toContain("isn't a page of the website");
    await expect(main(admin).getByLabel("Old address")).toHaveValue("/en/old-page");
    expect(await queryTestDb("SELECT id FROM redirects")).toEqual([{ id: stored.id }]);
  });

  test("an Arabic old address reads in Arabic, is stored encoded, and found by an Arabic search; deactivate and reactivate", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/redirects/new");
    await main(admin).getByLabel("Old address").fill("/ar/صفحة-قديمة");
    await main(admin).getByLabel("New address").fill("/ar/contact");
    await main(admin).getByLabel("Temporary (307)").check();
    await admin.getByRole("button", { name: "Create redirect" }).click();
    await savedTo(admin, "/admin/redirects", { saved: "created" });
    const [stored] = await queryTestDb<{ id: string; source_path: string; status_code: number }>("SELECT id, source_path, status_code FROM redirects WHERE source_path LIKE '/ar/%'");
    expect(stored.source_path).toBe("/ar/%D8%B5%D9%81%D8%AD%D8%A9-%D9%82%D8%AF%D9%8A%D9%85%D8%A9");
    expect(stored.status_code).toBe(307);
    await expect(main(admin).locator("tbody tr", { hasText: "/ar/صفحة-قديمة" })).toContainText("Temporary (307)");
    await main(admin).getByLabel("Address contains").fill("قديمة");
    await main(admin).getByRole("button", { name: "Show" }).click();
    await admin.waitForURL(/q=/);
    expect(await main(admin).locator("tbody tr").count()).toBe(1);
    // Its own page reads the same, and saving it unchanged keeps the stored address.
    await main(admin).getByRole("link", { name: "/ar/صفحة-قديمة" }).click();
    await admin.waitForURL(`**/admin/redirects/${stored.id}`);
    await expect(main(admin).getByLabel("Old address")).toHaveValue("/ar/صفحة-قديمة");
    await admin.getByRole("button", { name: "Save redirect" }).click();
    await savedTo(admin, `/admin/redirects/${stored.id}`, { saved: "1" });
    expect((await queryTestDb<{ source_path: string }>("SELECT source_path FROM redirects WHERE id = ?", [stored.id]))[0].source_path).toBe(stored.source_path);
    // Deactivate, then reactivate (checked again).
    await main(admin).getByRole("button", { name: "Deactivate" }).click();
    await savedTo(admin, `/admin/redirects/${stored.id}`, { saved: "1" });
    await expect(main(admin).getByRole("button", { name: "Reactivate" })).toBeVisible();
    expect((await queryTestDb<{ a: number }>("SELECT is_active AS a FROM redirects WHERE id = ?", [stored.id]))[0].a).toBe(0);
    await open(admin, "/admin/redirects?state=inactive");
    expect(await main(admin).locator("tbody tr").count()).toBe(1);
    await open(admin, `/admin/redirects/${stored.id}`);
    await main(admin).getByRole("button", { name: "Reactivate" }).click();
    await savedTo(admin, `/admin/redirects/${stored.id}`, { saved: "1" });
    await expect(main(admin).getByRole("button", { name: "Deactivate" })).toBeVisible();
    expect(await lastAudit("action = 'redirect.activate'")).toMatchObject({ outcome: "success", entity_id: stored.id });
    ids.arabicRedirect = stored.id;
  });

  test("an Editor reads redirects only; two tabs of one redirect: the second save is refused as stale", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/redirects/${ids.redirect}`);
    await expect(main(editor).getByLabel("Old address")).toBeDisabled();
    await expect(main(editor).getByRole("button", { name: /^(Save redirect|Deactivate)$/ })).toHaveCount(0);
    const answer = await forge(editor, "setRedirectActiveAction", [{ id: ids.redirect, expectedVersion: 0, active: false }]);
    expect(answer).toMatch(/"status":"error"/);
    expect(await lastAudit("action = 'redirect.deactivate' AND entity_id = ?", [userIds.editor])).toMatchObject({ outcome: "denied", summary: "Refused: missing permission redirects.manage." });
    const owner = await as(browser, "owner");
    await open(owner, `/admin/redirects/${ids.redirect}`);
    const second = await owner.context().newPage();
    await open(second, `/admin/redirects/${ids.redirect}`);
    await main(owner).getByLabel("Note (optional, admin only)").fill("Test note one");
    await owner.getByRole("button", { name: "Save redirect" }).click();
    await savedTo(owner, `/admin/redirects/${ids.redirect}`, { saved: "1" });
    await main(second).getByLabel("Note (optional, admin only)").fill("Test note two");
    await second.getByRole("button", { name: "Save redirect" }).click();
    await expect(alertOf(second)).toContainText(STALE_REDIRECT);
    await expect(main(second).getByLabel("Note (optional, admin only)")).toHaveValue("Test note two");
    await second.close();
  });
});

// --- Security ---------------------------------------------------------------------------------------------------------------

test.describe("security and audit", () => {
  test("a Reviewer's hand-made changes are refused by every A6 action before anything is read, each refusal audited; nothing changes", async ({ browser }) => {
    const reviewer = await as(browser, "reviewer");
    await open(reviewer, "/admin/settings");
    const tables = ["site_settings", "site_setting_translations", "company_phones", "menu_items", "menu_item_translations", "ui_string_translations", "theme_settings", "design_token_overrides", "redirects"];
    const snapshot = async () => Promise.all(tables.map((t) => queryTestDb(`SELECT * FROM ${t} ORDER BY 1`)));
    const before = await snapshot();
    const calls: [string, unknown[], string, string][] = [
      ["setUpSettingsAction", [], "site_settings.setup", "settings.edit"],
      ["saveSettingsAction", [{ expectedVersion: 0 }], "site_settings.update", "settings.edit"],
      ["setUpUiTextAction", [], "ui_text.setup", "settings.edit"],
      ["saveUiTextAction", [{ expectedVersion: 0, values: {} }], "ui_text.update", "settings.edit"],
      ["setUpNavigationAction", [], "menu.setup", "menus.edit"],
      ["saveMenuAction", [{ key: "header_main", expectedVersion: 0, items: [] }], "menu.update", "menus.edit"],
      ["resetThemeAction", [{ expectedVersion: 0 }], "theme.reset", "theme.edit"],
      ["saveRedirectAction", [{ id: "", expectedVersion: 0, sourcePath: "/en/x", targetType: "path", targetPath: "/en", targetId: "", statusCode: 308, note: "" }], "redirect.create", "redirects.manage"],
      ["setRedirectActiveAction", [{ id: ids.redirect, expectedVersion: 0, active: false }], "redirect.deactivate", "redirects.manage"],
    ];
    for (const [name, args, action, permission] of calls) {
      expect(await forge(reviewer, name, args), name).toMatch(/"status":"error"/);
      expect(await lastAudit("action = ? AND entity_id = ?", [action, userIds.reviewer]), name).toMatchObject({ outcome: "denied", entity_type: "user", summary: `Refused: missing permission ${permission}.` });
    }
    expect(await snapshot()).toEqual(before);
  });

  test("signed out, every A6 address goes to the sign-in page and the shell preview shows nothing", async ({ browser }) => {
    const context = await browser.newContext();
    for (const path of [...SCREENS, "/admin/theme", "/admin/redirects/new", `/admin/redirects/${ids.redirect}`, "/admin/preview/site/shell?locale=en"]) {
      const answer = await context.request.get(path, { maxRedirects: 0 });
      expect([303, 307], path).toContain(answer.status());
      expect(answer.headers().location, path).toMatch(/\/admin\/login/);
      expect(await answer.text(), path).not.toContain("test.office@example.test");
    }
    await context.close();
    // Unknown ids: not found (an admin screen streams after its loading skeleton, so it says so in the page, as A4's do;
    // the preview has no skeleton and answers 404).
    const owner = await as(browser, "owner");
    await owner.goto("/admin/redirects/01ARZ3NDEKTSV4RRFFQ69G5FAV");
    await expect(owner.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect((await owner.request.get("/admin/preview/site/footer")).status()).toBe(404);
    expect((await owner.request.get("/admin/preview/site/shell?locale=xx")).status()).toBe(200);
  });
});

// --- The preview and the public site ------------------------------------------------------------------------------------------------

test.describe("the working copy in the preview, the public site unchanged", () => {
  test("set up from today's website, the shell preview draws today's header and footer word for word (English and Arabic)", async ({ browser }) => {
    // A fresh working copy of today's values (the edits above removed: the settings, menus and texts copied again).
    await queryTestDb("UPDATE site_settings SET primary_whatsapp_phone_id = NULL, default_og_image_media_id = NULL");
    for (const table of ["company_phones", "site_setting_translations", "ui_string_translations", "menu_items"]) await queryTestDb(`DELETE FROM ${table}`);
    const admin = await as(browser, "admin");
    for (const [path, button] of [
      ["/admin/settings", "Copy today's company details"],
      ["/admin/navigation", "Copy today's navigation"],
      ["/admin/interface-text", "Copy today's interface text"],
    ] as const) {
      await open(admin, path);
      await main(admin).getByRole("button", { name: button }).click();
      await savedTo(admin, path);
    }
    const preview = await admin.context().newPage();
    const visitor = await (await browser.newContext()).newPage();
    for (const locale of ["en", "ar"] as const) {
      await preview.goto(`/admin/preview/site/shell?locale=${locale}&theme=light`);
      await preview.locator("footer.a2-footer").waitFor();
      // The public page with no current page marked: the localized 404 (route and path null, as the shell preview).
      await visitor.goto(`/${locale}/test-no-such-page`);
      await visitor.locator("footer.a2-footer").waitFor();
      const [a, b] = [await shellFacts(preview), await shellFacts(visitor)];
      expect(a.count).toBe(2);
      expect(a, locale).toEqual(b);
    }
    await preview.close();
    await visitor.context().close();
  });

  test("the public pages' header and footer and their served HTML are exactly as before the working copy existed", async ({ browser }) => {
    const context = await browser.newContext();
    const visitor = await context.newPage();
    for (const path of PUBLIC_PAGES) {
      expect(await publicShell(visitor, path), path).toBe(publicBefore[path]);
      // Served HTML: equal once the per-request nonce-free parts are compared (the public pages are static: byte for byte).
      expect(await (await context.request.get(path)).text(), path).toBe(publicHtmlBefore[path]);
    }
    await context.close();
  });
});

// --- Phones, tablets and accessibility ----------------------------------------------------------------------------------------------

test.describe("every screen at four widths, light and dark", () => {
  test("1280, 768, 390 and 320 px: nothing past the screen; axe finds nothing at 1280 light and 390 dark", async ({ browser }) => {
    test.setTimeout(300_000);
    const paths = [...SCREENS, "/admin/theme", "/admin/redirects/new", `/admin/redirects/${ids.redirect}`, "/admin/redirects?state=active&q=old"];
    for (const colorScheme of ["light", "dark"] as const) {
      for (const width of [1280, 768, 390, 320]) {
        const page = await signedIn(browser, "owner", { viewport: { width, height: 860 }, colorScheme });
        for (const path of paths) {
          await open(page, path);
          expect(await pageOverflow(page), `${path} ${width} ${colorScheme}`).toBe(0);
          expect(await pastTheScreen(page), `${path} ${width} ${colorScheme}`).toEqual([]);
          if ((width === 1280 && colorScheme === "light") || (width === 390 && colorScheme === "dark")) expect(await axe(page), `${path} ${width} ${colorScheme}`).toEqual([]);
        }
        // The navigation's open error state and the settings' errors at this width too.
        await open(page, "/admin/settings");
        await main(page).getByLabel("Website address").fill("http://x.example.test");
        await page.getByRole("button", { name: "Save settings" }).click();
        await expect(alertOf(page)).toBeVisible();
        expect(await pastTheScreen(page), `settings errors ${width} ${colorScheme}`).toEqual([]);
        await page.context().close();
      }
    }
  });

  test("the shell preview in its own tab: private and never indexed; Arabic right to left; light and dark", async ({ browser }) => {
    const owner = await as(browser, "owner");
    const response = await owner.request.get("/admin/preview/site/shell?locale=ar&theme=dark");
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.headers()["cache-control"]).toBe("no-store");
    const tab = await owner.context().newPage();
    await tab.goto("/admin/preview/site/shell?locale=ar&theme=dark");
    await expect(tab.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(tab.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(tab.locator("main")).toContainText("Preview only");
    // The language switch keeps the preview.
    await tab.locator("header.a2-header a[data-preview-locale='en']").first().click();
    await tab.waitForURL((url) => url.pathname === "/admin/preview/site/shell" && url.searchParams.get("locale") === "en");
    await expect(tab.locator("html")).toHaveAttribute("dir", "ltr");
    await tab.close();
  });
});

// --- The admin gate ------------------------------------------------------------------------------------------------------------

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
const A6_ROUTES = [...SCREENS, "/admin/theme", "/admin/redirects/new", `/admin/redirects/${GATE_ID}`, "/admin/preview/site/shell?locale=ar&theme=dark"];

/** Every A6 Server Action as a forged request: the admin's origin and a made-up session cookie, React's reply encoding. */
function siteActionRequests() {
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
  return [
    { name: "setUpSettingsAction", multipart: args([]) },
    { name: "saveSettingsAction", multipart: args([{ expectedVersion: 0 }]) },
    { name: "setUpUiTextAction", multipart: args([]) },
    { name: "saveUiTextAction", multipart: args([{ expectedVersion: 0, values: {} }]) },
    { name: "setUpNavigationAction", multipart: args([]) },
    { name: "saveMenuAction", multipart: args([{ key: "header_main", expectedVersion: 0, items: [] }]) },
    { name: "resetThemeAction", multipart: args([{ expectedVersion: 0 }]) },
    { name: "saveRedirectAction", multipart: args([{ id: "", expectedVersion: 0, sourcePath: "/en/x", targetType: "path", targetPath: "/en", targetId: "", statusCode: 308, note: "" }]) },
    { name: "setRedirectActiveAction", multipart: args([{ id: GATE_ID, expectedVersion: 0, active: false }]) },
  ].map(({ name, multipart }) => ({ name, options: { headers: headers(name), multipart, maxRedirects: 0 } }));
}

test.describe("the admin gate", () => {
  test("off (production without ADMIN_ENABLED): every A6 address is the public 404 path; no A6 action runs", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3451, db.port, { APP_ENV: "production" });
    try {
      const { client } = server;
      for (const path of A6_ROUTES) {
        const r = await client.get(path, { maxRedirects: 0 });
        expect(r.status(), path).toBe(307);
        expect(r.headers().location, path).toBe(`/en${path}`);
        expect(r.headers()["content-security-policy"], path).toBeUndefined();
        expect((await client.get(`/en${new URL(path, "http://x").pathname}`)).status(), path).toBe(404);
      }
      for (const { name, options } of siteActionRequests()) {
        expect((await client.post("/admin/settings", options)).status(), name).toBe(307);
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
    const server = await startGateServer(3452, db.port, { APP_ENV: "production", ADMIN_ENABLED: "1" });
    try {
      const { client } = server;
      for (const { name, options } of siteActionRequests()) {
        for (const path of ["/admin/settings", "/en"]) {
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
