/**
 * Forms and enquiries (Phase A7) end to end, on the production build against the admin suite's local MariaDB
 * (e2e-admin/server.mjs): the Enquiries group by role (the inbox for Owners and Admins only); the quote form's working
 * copy (set up from today's form, edited, the Owner's decisions closed to an Admin, field errors keeping what was typed, a
 * stale second tab, the preview drawing the working words in the approved component); synthetic enquiries stored through
 * the prepared submission service (e2e-admin/seed-enquiries.mjs: nothing on the website stores a request); the inbox
 * (summary, search, filters, sorting, empty states); an enquiry's page (the workflow step by step, closing without an
 * answer only with a reason, reopening, assignment, notes, history, a stale tab); a private attachment (downloaded by an
 * Admin, audited; "not found" to an Editor and to another enquiry's address); the CSV export (the Owner alone, after a
 * step-up; formulas as text); forged actions refused and audited; every screen at 1280, 768, 390 and 320 px in light and
 * dark with nothing past the screen, and axe; the A7 addresses and actions behind the ADMIN_ENABLED gate; and the public
 * Contact page byte for byte unchanged throughout. Synthetic data only.
 *
 * afterAll empties the A7 tables again (the form back to its seeded root).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FORM_IDS } from "../src/server/forms/registry";
import { countingDatabase, startGateServer } from "./gate-helpers";
import { ageAuthentication, cliEnv, freshCode, queryTestDb, run } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const FORM = FORM_IDS.quote;
const ROLES = ["owner", "admin", "editor", "reviewer"] as const;
type Role = (typeof ROLES)[number];
const USERS: Record<Role, { email: string; name: string; password: string; mfa: boolean }> = {
  owner: { email: "enq.owner@example.test", name: "Test Enquiry Owner", password: "enquiry owner phrase harbour", mfa: true },
  admin: { email: "enq.admin@example.test", name: "Test Enquiry Admin", password: "enquiry admin phrase meadow", mfa: true },
  editor: { email: "enq.editor@example.test", name: "Test Enquiry Editor", password: "enquiry editor phrase canyon", mfa: false },
  reviewer: { email: "enq.reviewer@example.test", name: "Test Enquiry Reviewer", password: "enquiry reviewer phrase orchid", mfa: false },
};
const secrets: Partial<Record<Role, string>> = {};
const pages: Partial<Record<Role, Page>> = {};
let stored: { id: string; reference: string; name: string }[] = [];
const contactBefore: Record<string, string> = {};

async function signedIn(browser: Browser, role: Role, options: { viewport?: { width: number; height: number }; colorScheme?: "light" | "dark" } = {}): Promise<Page> {
  const context: BrowserContext = await browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 860 }, colorScheme: options.colorScheme ?? "light", acceptDownloads: true });
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

/** Waits for the page a change opens again (`?…v=…`): the stored state, never the router's cache. */
async function reopened(page: Page, path: string) {
  await page.waitForURL((url) => url.pathname === path && url.searchParams.has("v"));
  await page.locator("main :is(h1, h2)").first().waitFor();
}

const main = (page: Page) => page.locator("main");
const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const pastTheScreen = (page: Page) =>
  page.locator("main *").evaluateAll((els) =>
    els.filter((e) => !e.closest(".adm-sr-only") && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((e) => `${e.tagName.toLowerCase()}.${e.className}`),
  );

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

function actionId(name: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")) as { node: Record<string, { exportedName?: string; filename?: string }> };
  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && v.filename?.startsWith("src/server/admin/actions/"));
  if (!found) throw new Error(`No Server Action ${name} in the build.`);
  return found[0];
}

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

const seedEnquiries = (options: Record<string, unknown>) =>
  JSON.parse(execFileSync(process.execPath, [join(ROOT, "e2e-admin/seed-enquiries.mjs"), JSON.stringify(options)], { env: { ...cliEnv(), RAWASY_DATA_DIR: run().dataDir }, encoding: "utf8" })) as typeof stored;

const version = async (id: string) => Number((await queryTestDb<{ v: number }>("SELECT lock_version AS v FROM enquiries WHERE id = ?", [id]))[0].v);

test.beforeAll(async () => {
  for (const role of ROLES) {
    const user = USERS[role];
    const out = execFileSync(
      process.execPath,
      [join(ROOT, "e2e-admin/seed-user.mjs"), "--email", user.email, "--name", user.name, "--roles", role, ...(user.mfa ? ["--mfa"] : [])],
      { env: { ...cliEnv(), SEED_PASSWORD: user.password }, encoding: "utf8" },
    );
    const seeded = JSON.parse(out) as { secret: string | null };
    if (seeded.secret) secrets[role] = seeded.secret;
  }
});

test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

test.afterAll(async () => {
  for (const page of Object.values(pages)) await page?.context().close();
  for (const table of ["enquiries", "email_outbox", "enquiry_reference_counters", "form_fields", "form_translations"]) await queryTestDb(`DELETE FROM ${table}`);
  await queryTestDb("UPDATE forms SET delivery_mode = 'handoff', is_enabled = 1, notification_emails = NULL, retention_days = NULL, accept_files = 0, accepted_extensions = '.pdf,.jpg,.jpeg,.png', consent_mode = 'notice'");
});

// --- Starting point and roles ------------------------------------------------------------------------------------------------

test.describe("the starting point and the roles", () => {
  test("the public Contact page is recorded; the seed holds the quote form's root only; no enquiry exists", async ({ browser }) => {
    const context = await browser.newContext();
    for (const path of ["/en/contact", "/ar/contact"]) contactBefore[path] = await (await context.request.get(path)).text();
    await context.close();
    expect(await queryTestDb("SELECT `key`, delivery_mode FROM forms")).toEqual([{ key: "quote", delivery_mode: "handoff" }]);
    expect(await queryTestDb("SELECT 1 FROM enquiries")).toEqual([]);
  });

  test("the Enquiries group: the inbox for Owners and Admins; Forms for every role; the inbox is closed to Editors and Reviewers", async ({ browser }) => {
    const expected: Record<Role, string[]> = { owner: ["Enquiry inbox", "Forms"], admin: ["Enquiry inbox", "Forms"], editor: ["Forms"], reviewer: ["Forms"] };
    for (const role of ROLES) {
      const page = await as(browser, role);
      await open(page, "/admin");
      const group = page.locator(".adm-nav-group", { has: page.locator(".adm-nav-title", { hasText: /^Enquiries$/ }) });
      expect(await group.getByRole("link").allTextContents(), role).toEqual(expected[role]);
    }
    for (const role of ["editor", "reviewer"] as const) {
      const page = await as(browser, role);
      await open(page, "/admin/enquiries");
      await expect(main(page).getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
    }
  });
});

// --- The form's working copy ---------------------------------------------------------------------------------------------------

test.describe("the quote form's working copy", () => {
  test("an Editor reads it but can't set it up; an Admin copies today's form", async ({ browser }) => {
    const editor = await as(browser, "editor");
    await open(editor, `/admin/forms/${FORM}`);
    await expect(main(editor).getByText("An Owner or Admin can set it up.")).toBeVisible();
    const admin = await as(browser, "admin");
    await open(admin, "/admin/forms");
    await expect(main(admin).getByRole("row", { name: /Quote request form/ })).toContainText("Not set up");
    await main(admin).getByRole("link", { name: "Quote request form" }).click();
    await main(admin).getByRole("button", { name: "Copy today's form" }).click();
    await reopened(admin, `/admin/forms/${FORM}`);
    await expect(main(admin).getByText("Saved. The preview shows the working copy; visitors still see today's form.")).toBeVisible();
    await expect(main(admin).locator("#f-copy-en-submit")).toHaveValue("Prepare request");
    await expect(main(admin).locator("#f-copy-ar-submit")).toHaveValue("تجهيز الطلب");
    await expect(main(admin).locator("#f-copy-ar-submit")).toHaveAttribute("dir", "rtl");
    expect(await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM form_fields")).toEqual([{ n: 10 }]);
  });

  test("an Admin edits texts; the Owner's decisions are closed to an Admin; errors keep what was typed", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, `/admin/forms/${FORM}`);
    for (const value of ["store", "store_and_notify"]) await expect(main(admin).locator(`input[name="deliveryMode"][value="${value}"]`)).toBeDisabled();
    await expect(main(admin).getByLabel("Accept files with stored submissions")).toBeDisabled();
    await expect(main(admin).locator("#f-settings-retentionDays")).toBeDisabled();
    // A required field without its message: refused at the field, the typing kept.
    const fullName = main(admin).locator("li.adm-form-field", { has: admin.locator("summary", { hasText: "Full name" }) });
    await fullName.locator("details").evaluate((d) => ((d as HTMLDetailsElement).open = true));
    await fullName.getByLabel("Message when missing").first().fill("");
    await main(admin).locator("#f-copy-en-submit").fill("Test prepare the request");
    await main(admin).getByRole("button", { name: "Save form" }).click();
    await expect(main(admin).locator(".adm-editor-alert")).toContainText("Some fields need attention. Nothing was saved.");
    await expect(main(admin).locator("#f-copy-en-submit")).toHaveValue("Test prepare the request");
    await fullName.getByLabel("Message when missing").first().fill("Test: enter your full name.");
    await main(admin).getByRole("button", { name: "Save form" }).click();
    await reopened(admin, `/admin/forms/${FORM}`);
    await expect(main(admin).locator("#f-copy-en-submit")).toHaveValue("Test prepare the request");
    expect((await queryTestDb<{ s: string }>("SELECT translation_status AS s FROM form_translations WHERE locale = 'ar'"))[0].s).toBe("needs_review");
  });

  test("a second tab's save after a change is refused as stale, its typing kept", async ({ browser }) => {
    const admin = await as(browser, "admin");
    const other = await admin.context().newPage();
    await open(other, `/admin/forms/${FORM}`);
    await open(admin, `/admin/forms/${FORM}`);
    await main(admin).locator("#f-copy-en-groups-details").fill("Test your details");
    await main(admin).getByRole("button", { name: "Save form" }).click();
    await reopened(admin, `/admin/forms/${FORM}`);
    await main(other).locator("#f-copy-en-noscript").fill("Test stale tab");
    await main(other).getByRole("button", { name: "Save form" }).click();
    await expect(main(other).locator(".adm-editor-alert")).toContainText("This form changed after you opened it.");
    await expect(main(other).locator("#f-copy-en-noscript")).toHaveValue("Test stale tab");
    await other.close();
  });

  test("the preview draws the working words in the approved quote section; the website's Contact page stays today's", async ({ browser }) => {
    const admin = await as(browser, "admin");
    const preview = await admin.context().newPage();
    await preview.goto(`/admin/preview/form/${FORM}?locale=en&theme=light`);
    await expect(preview.locator("#quote")).toBeVisible();
    await expect(preview.locator('#quote button[type="submit"]')).toHaveText(/Test prepare the request/);
    await expect(preview.locator("#quote")).toContainText("Test your details");
    await preview.goto(`/admin/preview/form/${FORM}?locale=ar&theme=dark`);
    await expect(preview.locator('#quote button[type="submit"]')).toHaveText(/تجهيز الطلب/);
    await preview.close();
    const visitor = await browser.newContext();
    for (const path of ["/en/contact", "/ar/contact"]) expect(await (await visitor.request.get(path)).text(), path).toBe(contactBefore[path]);
    await visitor.close();
  });

  test("the Owner switches the form to storing (local tests only); the website's form still hands off", async ({ browser }) => {
    const owner = await as(browser, "owner");
    await open(owner, `/admin/forms/${FORM}`);
    await main(owner).locator('input[name="deliveryMode"][value="store"]').check();
    await main(owner).getByRole("button", { name: "Save form" }).click();
    await reopened(owner, `/admin/forms/${FORM}`);
    expect((await queryTestDb<{ m: string }>("SELECT delivery_mode AS m FROM forms"))[0].m).toBe("store");
    expect((await queryTestDb<{ action: string; outcome: string }>("SELECT action, outcome FROM audit_events WHERE entity_type = 'form' ORDER BY id DESC LIMIT 1"))[0]).toEqual({ action: "form.update", outcome: "success" });
  });
});

// --- The inbox ----------------------------------------------------------------------------------------------------------------

test.describe("the inbox", () => {
  test("synthetic enquiries stored through the prepared submission service; the summary, the list and the search", async ({ browser }) => {
    stored = seedEnquiries({ count: 3, files: 1, mode: "store_and_notify", names: ["Test Alpha Visitor", "اختبار باء", "=HYPERLINK(\"http://evil.example.test\",\"x\")"] });
    const year = new Date(Date.now() + 3 * 3600_000).getUTCFullYear(); // Riyadh's year (UTC+3)
    expect(stored.map((s) => s.reference)).toEqual([1, 2, 3].map((n) => `Q-${year}-0000${n}`));
    const admin = await as(browser, "admin");
    await open(admin, "/admin/enquiries");
    await expect(main(admin).locator(".adm-stat", { hasText: /^3\s*New$/ })).toBeVisible();
    const rows = main(admin).locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText(stored[2].reference);
    await expect(main(admin).locator("tbody")).toContainText("اختبار باء");
    await main(admin).getByLabel("Search").fill(stored[0].reference.toLowerCase());
    await main(admin).getByRole("button", { name: "Show" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Test Alpha Visitor");
    await open(admin, "/admin/enquiries?q=nothing-matches-this");
    await expect(main(admin).getByText("No enquiry matches these filters.")).toBeVisible();
    await open(admin, "/admin/enquiries?status=closed");
    await expect(main(admin).getByText("No enquiry matches these filters.")).toBeVisible();
    await open(admin, "/admin/enquiries?sort=oldest");
    await expect(rows.first()).toContainText(stored[0].reference);
  });

  test("an enquiry's page: the request, the workflow step by step, the reason to close without an answer, reopening, history", async ({ browser }) => {
    const admin = await as(browser, "admin");
    const path = `/admin/enquiries/${stored[0].id}`;
    await open(admin, path);
    await expect(main(admin).getByRole("heading", { name: `Enquiry ${stored[0].reference}`, level: 1 })).toBeVisible();
    await expect(main(admin).locator(".adm-enq-dl")).toContainText("Test Alpha Visitor");
    await expect(main(admin).locator(".adm-enq-dl")).toContainText("Custom piece or one-off"); // the label, not the stored key
    await expect(main(admin).locator(".adm-enq-dl")).not.toContainText("custom-piece");
    expect(await admin.title()).not.toContain("Alpha");
    for (const step of ["Open", "Mark answered", "Close"]) {
      await main(admin).getByRole("button", { name: step, exact: true }).click();
      await reopened(admin, path);
    }
    await expect(main(admin).locator(".adm-enq-history")).toContainText("Answered → Closed");
    await main(admin).getByRole("button", { name: "Reopen" }).click();
    await reopened(admin, path);
    await main(admin).getByRole("button", { name: "Close without an answer" }).first().click();
    const submit = main(admin).locator(".adm-enq-reason").getByRole("button", { name: "Close without an answer" });
    await expect(submit).toBeDisabled();
    await main(admin).getByLabel(/Why is it closed without an answer/).fill("Test duplicate of another request.");
    await submit.click();
    await reopened(admin, path);
    await expect(main(admin).locator(".adm-enq-history")).toContainText("Test duplicate of another request.");
    expect((await queryTestDb<{ s: string }>("SELECT status AS s FROM enquiries WHERE id = ?", [stored[0].id]))[0].s).toBe("closed");
  });

  test("assignment, a note, and a stale tab's change refused", async ({ browser }) => {
    const admin = await as(browser, "admin");
    const path = `/admin/enquiries/${stored[1].id}`;
    const other = await admin.context().newPage();
    await open(other, path);
    await open(admin, path);
    await main(admin).getByLabel("Assigned to").selectOption({ label: USERS.owner.name });
    await main(admin).getByRole("button", { name: "Assign" }).click();
    await reopened(admin, path);
    await expect(main(admin).locator(".adm-enq-history")).toContainText(`Assigned to ${USERS.owner.name}.`);
    await expect(main(admin).locator(".adm-enq-history")).not.toContainText("@"); // who acted, by name only
    await main(admin).getByLabel("Add an internal note").fill("Test note: call back on Sunday.");
    await main(admin).getByRole("button", { name: "Add note" }).click();
    await reopened(admin, path);
    await expect(main(admin).locator(".adm-enq-notes")).toContainText("Test note: call back on Sunday.");
    await main(other).getByRole("button", { name: "Open", exact: true }).click();
    await expect(main(other).locator(".adm-alert.is-error")).toContainText("This enquiry changed after you opened it.");
    await other.close();
    const audit = await queryTestDb<{ entity_label: string | null; summary: string }>("SELECT entity_label, summary, changes FROM audit_events WHERE entity_type = 'enquiry'");
    expect(audit.length).toBeGreaterThan(5);
    for (const row of audit) {
      if (row.entity_label !== null) expect(row.entity_label).toMatch(/^Q-\d{4}-\d{5,}$/);
      expect(JSON.stringify(row)).not.toMatch(/Alpha|باء|call back|HYPERLINK|example\.test/);
    }
  });

  test("a private attachment: downloaded by an Admin (audited); not found to an Editor, to another enquiry's address and without a session", async ({ browser }) => {
    const [file] = await queryTestDb<{ id: string; enquiry_id: string }>("SELECT id, enquiry_id FROM enquiry_files");
    const url = `/api/admin/enquiries/${file.enquiry_id}/files/${file.id}`;
    const admin = await as(browser, "admin");
    await open(admin, `/admin/enquiries/${file.enquiry_id}`);
    const [download] = await Promise.all([admin.waitForEvent("download"), main(admin).getByRole("link", { name: /Download/ }).click()]);
    expect(download.suggestedFilename()).toBe("test-drawing-1.pdf");
    const answer = await admin.context().request.get(url);
    expect(answer.status()).toBe(200);
    expect(answer.headers()["content-type"]).toBe("application/pdf");
    expect(answer.headers()["content-disposition"]).toMatch(/^attachment;/);
    expect(answer.headers()["x-content-type-options"]).toBe("nosniff");
    expect(answer.headers()["cache-control"]).toMatch(/no-store/);
    expect((await answer.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'enquiry.file_download' AND outcome = 'success'"))[0].n).toBeGreaterThanOrEqual(1);
    const editor = await as(browser, "editor");
    expect((await editor.context().request.get(url)).status()).toBe(404);
    expect((await admin.context().request.get(`/api/admin/enquiries/${stored[2].id}/files/${file.id}`)).status()).toBe(404);
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(url)).status()).toBe(401);
    await anonymous.close();
  });

  test("the CSV export: not offered to an Admin; the Owner after a step-up; formulas written as text", async ({ browser }) => {
    const admin = await as(browser, "admin");
    await open(admin, "/admin/enquiries");
    await expect(main(admin).getByRole("heading", { name: "Export" })).toHaveCount(0);
    expect(await forge(admin, "exportEnquiriesAction", [{}])).toContain("You don't have permission to do this.");
    await ageAuthentication(USERS.owner.email);
    const owner = await as(browser, "owner");
    await open(owner, "/admin/enquiries");
    await expect(main(owner).getByRole("button", { name: "Export CSV" })).toHaveCount(0);
    await owner.context().close();
    pages.owner = undefined;
    const fresh = await as(browser, "owner");
    await open(fresh, "/admin/enquiries");
    const [download] = await Promise.all([fresh.waitForEvent("download"), main(fresh).getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^rawasy-enquiries-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await download.path())!, "utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example.test"",""x"")"`);
    expect(csv).toContain('"اختبار باء"');
    expect((await queryTestDb<{ summary: string }>("SELECT summary FROM audit_events WHERE action = 'enquiry.export' AND outcome = 'success'"))[0].summary).toMatch(/Exported 3 enquiries/);
  });

  test("a Reviewer's and an Editor's forged changes are refused and audited; nothing changes", async ({ browser }) => {
    const before = await version(stored[2].id);
    for (const role of ["reviewer", "editor"] as const) {
      const page = await as(browser, role);
      await open(page, "/admin");
      for (const [name, args] of [
        ["changeEnquiryStatusAction", [stored[2].id, { expectedVersion: before, to: "open", note: "" }]],
        ["assignEnquiryAction", [stored[2].id, { expectedVersion: before, assignee: "" }]],
        ["addEnquiryNoteAction", [stored[2].id, { body: "Test forged note" }]],
        ["saveFormAction", [FORM, { expectedVersion: 0 }]],
        ["setUpFormAction", [FORM]],
      ] as [string, unknown[]][]) {
        expect(await forge(page, name, args), `${role} ${name}`).toContain("You don't have permission to do this.");
      }
    }
    expect(await version(stored[2].id)).toBe(before);
    expect(await queryTestDb("SELECT 1 FROM enquiry_notes WHERE body = 'Test forged note'")).toEqual([]);
    expect((await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM audit_events WHERE outcome = 'denied' AND action IN ('enquiry.status', 'enquiry.assign', 'enquiry.note', 'form.update', 'form.setup')"))[0].n).toBeGreaterThanOrEqual(10);
  });

  test("the prepared submission service is reachable by nothing in the build", async () => {
    const manifest = readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8");
    expect(manifest).not.toContain("submitEnquiry");
    expect(manifest).not.toContain("enquiries/submission");
  });
});

// --- Layout and accessibility ------------------------------------------------------------------------------------------------

test.describe("layout and accessibility", () => {
  test("every A7 screen at 1280, 768, 390 and 320 px, light and dark: nothing past the screen; axe clean at 1280 light and 390 dark", async ({ browser }) => {
    test.setTimeout(300_000);
    const screens = ["/admin/forms", `/admin/forms/${FORM}`, "/admin/enquiries", `/admin/enquiries/${stored[1].id}`];
    for (const [width, scheme] of [
      [1280, "light"],
      [768, "dark"],
      [390, "dark"],
      [320, "light"],
    ] as const) {
      const page = await signedIn(browser, "admin", { viewport: { width, height: 900 }, colorScheme: scheme });
      for (const path of screens) {
        await open(page, path);
        await page.locator("main details").evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)));
        expect(await pageOverflow(page), `${path} at ${width}`).toBeLessThanOrEqual(0);
        expect(await pastTheScreen(page), `${path} at ${width}`).toEqual([]);
        if ((width === 1280 && scheme === "light") || (width === 390 && scheme === "dark")) expect(await axe(page), `${path} at ${width} ${scheme}`).toEqual([]);
      }
      await page.context().close();
    }
  });
});

// --- The gate and the public site -----------------------------------------------------------------------------------------

test.describe("the admin gate and the public site", () => {
  test("off (production without ADMIN_ENABLED): every A7 address is the public 404 path, the file route 404, no database connection", async () => {
    test.setTimeout(120_000);
    const db = await countingDatabase();
    const server = await startGateServer(3453, db.port, { APP_ENV: "production" });
    try {
      const { client } = server;
      for (const path of ["/admin/enquiries", `/admin/enquiries/${FORM}`, "/admin/forms", `/admin/forms/${FORM}`, `/admin/preview/form/${FORM}?locale=en`]) {
        const r = await client.get(path, { maxRedirects: 0 });
        expect(r.status(), path).toBe(307);
        expect(r.headers().location, path).toBe(`/en${path}`);
      }
      expect((await client.get(`/api/admin/enquiries/${FORM}/files/${FORM}`)).status()).toBe(404);
      const headers = (name: string) => ({ "next-action": actionId(name), origin: "https://admin.example.test", "x-forwarded-host": "admin.example.test", accept: "text/x-component", cookie: `__Host-rawasy_admin=${"A".repeat(43)}` });
      for (const name of ["setUpFormAction", "saveFormAction", "changeEnquiryStatusAction", "exportEnquiriesAction"]) {
        const multipart = new FormData();
        multipart.append("0", JSON.stringify([FORM]));
        expect((await client.post("/admin/forms", { headers: headers(name), multipart, maxRedirects: 0 })).status(), name).toBe(307);
      }
      expect(db.attempts(), "no database connection was attempted").toBe(0);
    } finally {
      await server.stop();
      await db.close();
    }
  });

  test("the public Contact page, served now, is byte for byte what it was before any of this", async ({ browser }) => {
    const visitor = await browser.newContext();
    for (const path of ["/en/contact", "/ar/contact"]) expect(await (await visitor.request.get(path)).text(), path).toBe(contactBefore[path]);
    await visitor.close();
  });
});
