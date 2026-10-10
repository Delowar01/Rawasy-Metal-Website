/**
 * The admin end to end (Phase A2), on a production build against a fresh local MariaDB (e2e-admin/server.mjs):
 * anonymous access, headers and CSP nonce, the public proxy, the first Owner from the CLI, required 2FA set-up, the
 * second factor and recovery codes, sessions, invitations and activation, role enforcement, disabling, step-up,
 * cross-origin and anonymous mutations, keyboard use, the responsive shell and an axe audit. No real credential is used.
 */
import { expect, request as apiRequest, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  ageAuthentication,
  beginSetUp,
  bootstrapLink,
  enrol,
  finishSetUp,
  freshCode,
  hotp,
  linkIn,
  mailTo,
  PASSWORDS,
  queryTestDb,
  run,
  signIn,
  stepUpIfAsked,
  verify,
} from "./helpers";

test.describe.configure({ mode: "serial" });

// Every test signs in from this machine's one address: each starts with the sign-in counters cleared, so the suite's own
// sign-ins never add up to the per-address limit (30 in 15 minutes; the limits are proven in tests/integration).
test.beforeEach(async () => {
  await queryTestDb("DELETE FROM rate_limits");
});

const OWNER = { email: "owner@example.test", name: "Olivia Owner" };
const EDITOR = { email: "edward.editor@example.test", name: "Edward Editor" };
const ADMIN = { email: "ada.admin@example.test", name: "Ada Admin" };
let ownerSecret = "";
let ownerCodes: string[] = [];

/** Where a request with a session that has ended (revoked, rotated, signed out elsewhere) lands: sign-in, saying so. */
const SESSION_ENDED = /\/admin\/login\?session_ended=1$/;

async function newPage(browser: Browser, viewport = { width: 1280, height: 860 }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  return context.newPage();
}

/**
 * Elements with a style attribute, Next's route announcer aside: Next creates it after hydration and styles it (and the
 * live region in its shadow root) through `style.cssText`, the CSS object model, which a nonce CSP allows; a style
 * attribute in served markup or set with `setAttribute` would be blocked. Playwright's CSS locators pierce shadow roots,
 * so `locator("[style]")` counted the announcer twice.
 */
const styledElements = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[style]")].filter((e) => e.localName !== "next-route-announcer").map((e) => e.outerHTML.slice(0, 120)),
  );
const STYLE_ATTRIBUTE = /<[a-z][^>]*\sstyle=/i;

const AXE = require.resolve("axe-core/axe.min.js");
async function axe(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (o: object) => Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } }).axe.run({
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);
  });
}

test.describe("anonymous visitors", () => {
  test("every admin page sends anonymous visitors to sign-in; unknown admin addresses get the admin's 404", async ({ page }) => {
    for (const path of ["/admin", "/admin/users", "/admin/users/roles", "/admin/account", "/admin/account/security", "/admin/account/sessions"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
    const missing = await page.goto("/admin/does-not-exist");
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.goto("/admin/login/verify");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("admin responses: noindex, no-store, nonce CSP (a fresh nonce on every request), no framing", async ({ page, request }) => {
    const first = await request.get("/admin/login");
    const second = await request.get("/admin/login");
    const h = first.headers();
    expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    expect(h["cache-control"]).toBe("no-store");
    expect(h["referrer-policy"]).toBe("same-origin");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["permissions-policy"]).toContain("camera=()");
    const nonceOf = (csp: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1];
    const csp = h["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    const n1 = nonceOf(csp);
    const n2 = nonceOf(second.headers()["content-security-policy"]);
    expect(n1).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(n2).not.toBe(n1);
    await page.goto("/admin/login");
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.nonce));
    expect(scripts.length).toBeGreaterThan(0);
    expect(new Set(scripts).size).toBe(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, nofollow/);
    expect(await styledElements(page)).toEqual([]);
    const html = await (await request.get("/admin/login")).text();
    expect(html).not.toMatch(/<script(?![^>]*nonce=)[^>]*>/);
    expect(html).not.toMatch(STYLE_ATTRIBUTE);
  });

  test("the public site's locale proxy and pages are unchanged; /api stays outside the proxy, its admin namespaces locked down", async ({ request }) => {
    const root = await request.get("/", { maxRedirects: 0 });
    expect(root.status()).toBe(307);
    expect(root.headers().location).toMatch(/\/en$/);
    const ar = await request.get("/", { maxRedirects: 0, headers: { "accept-language": "ar" } });
    expect(ar.headers().location).toMatch(/\/ar$/);
    const about = await request.get("/about", { maxRedirects: 0 });
    expect(about.headers().location).toMatch(/\/en\/about$/);
    const near = await request.get("/administrator", { maxRedirects: 0 });
    expect(near.headers().location).toMatch(/\/en\/administrator$/);
    for (const path of ["/en", "/ar/about", "/en/services/laser-cutting"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-security-policy"]).toBeUndefined();
      expect(response.headers()["x-robots-tag"]).toBeUndefined();
    }
    expect((await request.get("/en/admin")).status()).toBe(404);
    // The namespaces of every planned API endpoint (A1: uploads, private files, preview, cron) get the static API headers.
    for (const path of ["/api/admin", "/api/admin/media/uploads/x", "/api/internal/scheduler"]) {
      const api = await request.get(path);
      expect(api.status(), path).toBe(404);
      expect(api.headers()["cache-control"], path).toBe("no-store");
      expect(api.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
      expect(api.headers()["x-content-type-options"], path).toBe("nosniff");
      expect(api.headers()["referrer-policy"], path).toBe("no-referrer");
      expect(api.headers()["content-security-policy"], path).toBe("default-src 'none'; frame-ancestors 'none'; sandbox");
    }
    // Any other /api address has no route: Next.js's own 404, as before A2 (no admin or API header).
    for (const path of ["/api/anything", "/api/administrator", "/api/internals"]) {
      const other = await request.get(path);
      expect(other.status(), path).toBe(404);
      expect(other.headers()["content-security-policy"], path).toBeUndefined();
      expect(other.headers()["x-robots-tag"], path).toBeUndefined();
    }
    const robots = await (await request.get("/robots.txt")).text();
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(robots).not.toContain("/admin");
    expect(sitemap).not.toContain("/admin");
  });
});

test.describe("the first Owner", () => {
  test("bootstrap link → password → sign-in → required 2FA set-up → recovery codes → dashboard", async ({ page }) => {
    const link = bootstrapLink(OWNER.email, OWNER.name);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Set up the Owner account" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("password12345");
    await page.getByLabel("Repeat the new password").fill("password12345");
    await page.getByRole("button", { name: "Set password and activate" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("common or leaked");
    await page.getByLabel("New password", { exact: true }).fill(PASSWORDS.owner);
    await page.getByLabel("Repeat the new password").fill(PASSWORDS.owner);
    await page.getByRole("button", { name: "Set password and activate" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?welcome=1$/);
    // The link works once.
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await expect(page).toHaveURL(/\/admin\/login\/enrol$/);
    const [cookie] = (await page.context().cookies()).filter((c) => c.name === "__Host-rawasy_admin");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/", expires: -1 });
    expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The shell is not reachable until 2FA is set up.
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login\/enrol$/);
    const enrolled = await enrol(page, PASSWORDS.owner);
    ownerSecret = enrolled.secret;
    ownerCodes = enrolled.codes;
    await page.getByRole("link", { name: /I saved them/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: `Welcome, ${OWNER.name}` })).toBeVisible();
    // Only one Owner can be bootstrapped.
    expect(() => bootstrapLink("second@example.test", "Second")).toThrow();
  });

  test("sign-out, then the second factor: a wrong code fails, a fresh code signs in", async ({ page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await page.waitForURL("**/admin/login/verify");
    await page.getByLabel("Authentication code").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("didn't work");
    await page.getByLabel("Authentication code").fill(await freshCode(ownerSecret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.locator('summary[aria-label^="Account:"]').click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?signed_out=1$/);
    expect((await page.context().cookies()).some((c) => c.name === "__Host-rawasy_admin")).toBe(false);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("a recovery code signs in once and the dashboard says how many are left", async ({ page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await page.waitForURL("**/admin/login/verify");
    await page.getByRole("button", { name: "Use a recovery code instead" }).click();
    // Typed in capitals with spaces for dashes: the same code (case, spaces and dashes are ignored).
    await page.getByLabel("Recovery code").fill(ownerCodes[0].toUpperCase().replaceAll("-", " "));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin\?recovery=9$/);
    await expect(page.getByText("9 recovery codes left")).toBeVisible();
    await page.context().clearCookies();
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await page.waitForURL("**/admin/login/verify");
    await page.getByRole("button", { name: "Use a recovery code instead" }).click();
    await page.getByLabel("Recovery code").fill(ownerCodes[0]);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Each code works once");
  });

  test("unknown email and wrong password give the same answer", async ({ page }) => {
    await signIn(page, "nobody@example.test", "a wrong password 123");
    const unknown = await page.locator("main").getByRole("alert").textContent();
    await signIn(page, OWNER.email, "a wrong password 123");
    const wrong = await page.locator("main").getByRole("alert").textContent();
    expect(unknown).toBe(wrong);
    expect(unknown).toContain("Sign-in failed");
  });
});

test.describe("recovery codes (A2 Correction 1: 100 bits)", () => {
  test("the step-up accepts a recovery code instead of the app's code, once", async ({ page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await ageAuthentication(OWNER.email);
    await page.goto("/admin/users/invite");
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
    await page.getByRole("button", { name: "Use a recovery code instead" }).click();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORDS.owner);
    await page.getByLabel("Recovery code").fill(ownerCodes[1]);
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("button", { name: "Send invitation" })).toBeVisible();
    // The same code a second time is refused.
    await ageAuthentication(OWNER.email);
    await page.goto("/admin/users/invite");
    await page.getByRole("button", { name: "Use a recovery code instead" }).click();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORDS.owner);
    await page.getByLabel("Recovery code").fill(ownerCodes[1]);
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("didn't match");
    await expect(page.getByRole("button", { name: "Send invitation" })).toHaveCount(0);
  });
});

test.describe("users, invitations and roles", () => {
  test("the Owner invites an Editor and an Admin after confirming it's them; the links arrive in the mail sink", async ({ page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    // The sign-in itself (password and code) is the confirmation for the next 10 minutes ...
    await page.goto("/admin/users/invite");
    await expect(page.getByRole("button", { name: "Send invitation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toHaveCount(0);
    // ... after which a sensitive page asks again, and the form shows only once confirmed.
    await ageAuthentication(OWNER.email);
    await page.goto("/admin/users/invite");
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send invitation" })).toHaveCount(0);
    await stepUpIfAsked(page, PASSWORDS.owner, ownerSecret);
    await expect(page.getByRole("button", { name: "Send invitation" })).toBeVisible();
    for (const person of [
      { ...EDITOR, role: "Editor" },
      { ...ADMIN, role: "Admin" },
    ]) {
      await page.goto("/admin/users/invite");
      await page.getByLabel("Email", { exact: true }).fill(person.email);
      await page.getByLabel("Name", { exact: true }).fill(person.name);
      await page.getByRole("checkbox", { name: new RegExp(`^${person.role}`) }).check();
      await page.getByRole("button", { name: "Send invitation" }).click();
      await expect(page.locator("main").getByRole("status")).toContainText(`Invitation sent to ${person.email}`);
      expect(mailTo(person.email)).toHaveLength(1);
    }
    await page.goto("/admin/users");
    await expect(page.getByRole("row", { name: new RegExp(EDITOR.name) })).toContainText("Invited");
  });

  test("the Editor activates the account, signs in without 2FA (optional for Editors) and sees no user management", async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto(linkIn(mailTo(EDITOR.email).at(-1), "invite"));
    await expect(page.getByRole("heading", { name: "Accept your invitation" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill(PASSWORDS.editor);
    await page.getByLabel("Repeat the new password").fill(PASSWORDS.editor);
    await page.getByRole("button", { name: "Set password and activate" }).click();
    await expect(page).toHaveURL(/welcome=1/);
    await signIn(page, EDITOR.email, PASSWORDS.editor);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
    for (const path of ["/admin/users", "/admin/users/roles", "/admin/users/invite"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
    }
    await page.context().close();
  });

  test("the Admin must set up 2FA; then manages Editors but not the Owner, and cannot grant Admin", async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto(linkIn(mailTo(ADMIN.email).at(-1), "invite"));
    await page.getByLabel("New password", { exact: true }).fill(PASSWORDS.admin);
    await page.getByLabel("Repeat the new password").fill(PASSWORDS.admin);
    await page.getByRole("button", { name: "Set password and activate" }).click();
    await signIn(page, ADMIN.email, PASSWORDS.admin);
    await expect(page).toHaveURL(/\/admin\/login\/enrol$/);
    const { secret } = await enrol(page, PASSWORDS.admin);
    await page.getByRole("link", { name: /I saved them/ }).click();
    await page.goto("/admin/users");
    await page.getByRole("link", { name: OWNER.name }).click();
    await expect(page.getByText("only an Owner can manage them")).toBeVisible();
    await page.goto("/admin/users");
    await page.getByRole("link", { name: EDITOR.name }).click();
    await stepUpIfAsked(page, PASSWORDS.admin, secret);
    await expect(page.getByRole("checkbox", { name: /^Admin/ })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: /^Owner/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reset two-factor" })).toHaveCount(0);
    await page.goto("/admin/users/roles");
    await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
    await page.context().close();
  });

  test("disabling the Editor ends their session at once and sign-in then fails like any wrong password", async ({ browser, page }) => {
    const editor = await newPage(browser);
    await signIn(editor, EDITOR.email, PASSWORDS.editor);
    await expect(editor).toHaveURL(/\/admin$/);
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/users");
    await page.getByRole("link", { name: EDITOR.name }).click();
    await stepUpIfAsked(page, PASSWORDS.owner, ownerSecret);
    await page.getByRole("button", { name: "Disable account" }).click();
    const dialog = page.getByRole("dialog", { name: `Disable ${EDITOR.name}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Disable" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
    await editor.goto("/admin");
    await expect(editor).toHaveURL(SESSION_ENDED);
    await signIn(editor, EDITOR.email, PASSWORDS.editor);
    await expect(editor.locator("main").getByRole("alert")).toContainText("Sign-in failed");
    await editor.context().close();
  });

  test("roles chosen while the account showed Invited are refused once its invitation was accepted meanwhile (A2 Correction 1)", async ({ browser, page }) => {
    const IVY = { email: "ivy.invited@example.test", name: "Ivy Invited" };
    const rolesOfIvy = async () =>
      (
        await queryTestDb<{ role_key: string }>(
          "SELECT ur.role_key FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.email_normalized = ? ORDER BY ur.role_key",
          [IVY.email],
        )
      ).map((r) => r.role_key);
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/users/invite");
    await stepUpIfAsked(page, PASSWORDS.owner, ownerSecret);
    await page.getByLabel("Email", { exact: true }).fill(IVY.email);
    await page.getByLabel("Name", { exact: true }).fill(IVY.name);
    await page.getByRole("checkbox", { name: /^Editor/ }).check();
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.locator("main").getByRole("status")).toContainText(`Invitation sent to ${IVY.email}`);
    // The Owner opens the account while it is invited and chooses to add Admin ...
    await page.goto("/admin/users");
    await page.getByRole("link", { name: IVY.name }).click();
    await stepUpIfAsked(page, PASSWORDS.owner, ownerSecret);
    await expect(page.getByText("Invited", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /^Admin/ }).check();
    // ... while the invitation is accepted elsewhere, with the first link (which its inviter may still hold).
    const other = await newPage(browser);
    await other.goto(linkIn(mailTo(IVY.email).at(-1), "invite"));
    await other.getByLabel("New password", { exact: true }).fill(PASSWORDS.reviewer);
    await other.getByLabel("Repeat the new password").fill(PASSWORDS.reviewer);
    await other.getByRole("button", { name: "Set password and activate" }).click();
    await expect(other).toHaveURL(/welcome=1/);
    await other.context().close();
    // The change was decided on an invited account: refused, and nothing changed.
    await page.getByRole("button", { name: "Save roles" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("This account changed after you opened this page");
    expect(await rolesOfIvy()).toEqual(["editor"]);
    // Reloaded, the page shows the account as it is; a change decided on that is the Owner's to make (positive control).
    await page.reload();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /^Admin/ }).check();
    await page.getByRole("button", { name: "Save roles" }).click();
    await expect(page.locator("main").getByRole("status")).toContainText("Roles of Ivy Invited");
    expect(await rolesOfIvy()).toEqual(["admin", "editor"]);
  });
});

test.describe("sessions and request integrity", () => {
  test("the Owner sees the other sessions (one stopped at the second step) and signs them out", async ({ browser, page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/account/sessions");
    // Earlier tests left sessions behind: start from this one alone.
    const rows = page.locator(".adm-list > li");
    if ((await rows.count()) > 1) {
      await page.getByRole("button", { name: "Sign out all other sessions" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Sign them out" }).click();
    }
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("This session");
    const other = await newPage(browser);
    await signIn(other, OWNER.email, PASSWORDS.owner);
    await verify(other, ownerSecret);
    const halfway = await newPage(browser);
    await signIn(halfway, OWNER.email, PASSWORDS.owner);
    await halfway.waitForURL("**/admin/login/verify");
    await page.reload();
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: "Second step not completed" })).toHaveCount(1);
    // Sign out the full session from its own row ...
    // (Text filters ignore case, and every other row holds its "Sign out this session?" dialog: filter on the badges.)
    const badge = (text: string) => page.locator(".adm-badge", { hasText: text });
    const full = rows.filter({ hasNot: badge("This session") }).filter({ hasNot: badge("Second step not completed") });
    await full.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("dialog", { name: "Sign out this session?" }).getByRole("button", { name: "Sign it out" }).click();
    await expect(rows).toHaveCount(2);
    await other.goto("/admin");
    await expect(other).toHaveURL(SESSION_ENDED);
    // ... and the half-finished one with the others: its second step no longer works.
    await page.getByRole("button", { name: "Sign out all other sessions" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Sign them out" }).click();
    await expect(rows).toHaveCount(1);
    await halfway.goto("/admin/login/verify");
    await expect(halfway).toHaveURL(SESSION_ENDED);
    await other.context().close();
    await halfway.context().close();
  });

  test("a session signed out from the list ends even when it rotated after the list was shown (A2 Correction 1)", async ({ browser, page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/account/sessions");
    const rows = page.locator(".adm-list > li");
    if ((await rows.count()) > 1) {
      await page.getByRole("button", { name: "Sign out all other sessions" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Sign them out" }).click();
    }
    await expect(rows).toHaveCount(1);
    // Another device signs in, and the list shows its session ...
    const other = await newPage(browser);
    await signIn(other, OWNER.email, PASSWORDS.owner);
    await verify(other, ownerSecret);
    await page.reload();
    await expect(rows).toHaveCount(2);
    // ... which then rotates there (a step-up), while this page still lists it as it was.
    await ageAuthentication(OWNER.email);
    await other.goto("/admin/users/invite");
    await expect(other.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
    await stepUpIfAsked(other, PASSWORDS.owner, ownerSecret);
    await expect(other.getByRole("button", { name: "Send invitation" })).toBeVisible();
    // Signing out the listed session signs the device out: not "That session has already ended".
    const badge = (text: string) => page.locator(".adm-badge", { hasText: text });
    await rows.filter({ hasNot: badge("This session") }).getByRole("button", { name: "Sign out" }).click();
    const dialog = page.getByRole("dialog", { name: "Sign out this session?" });
    await dialog.getByRole("button", { name: "Sign it out" }).click();
    await expect(dialog).toBeHidden();
    await expect(rows).toHaveCount(1);
    await other.goto("/admin");
    await expect(other).toHaveURL(SESSION_ENDED);
    await other.context().close();
  });

  test("the sign-in action answers only the admin's own pages: refused cross-origin or cross-site, accepted from the admin", async ({ page }) => {
    await page.goto("/admin/login");
    const captured = await captureAction(page, "/admin/login", async () => {
      await page.getByLabel("Email", { exact: true }).fill(OWNER.email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORDS.owner);
      await page.getByRole("button", { name: "Sign in" }).click();
    });
    const sessionCookie = (response: { headers: Record<string, string> }) => (response.headers["set-cookie"] ?? "").includes("__Host-rawasy_admin");
    const fromAttacker = await replay(captured, { origin: "https://attacker.example" });
    expect(sessionCookie(fromAttacker)).toBe(false);
    const crossSite = await replay(captured, { "sec-fetch-site": "cross-site" });
    expect(sessionCookie(crossSite)).toBe(false);
    // The same request, unchanged, does sign in (so the refusals above are the checks, not a broken replay).
    const genuine = await replay(captured, {});
    expect(sessionCookie(genuine)).toBe(true);
  });

  test("a protected action replayed cross-site, from another origin or without the session changes nothing; refusals are audited", async ({ browser, page }) => {
    const other = await newPage(browser);
    await signIn(other, OWNER.email, PASSWORDS.owner);
    await verify(other, ownerSecret);
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/account/sessions");
    // Capture "Sign out all other sessions" without letting it reach the server.
    const captured = await captureAction(page, "/admin/account/sessions", async () => {
      await page.getByRole("button", { name: "Sign out all other sessions" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Sign them out" }).click();
    });
    const cookie = (await page.context().cookies()).find((c) => c.name === "__Host-rawasy_admin");
    expect(cookie).toBeDefined();
    const withSession = { cookie: `__Host-rawasy_admin=${cookie?.value}` };
    const otherStillIn = async () => {
      await other.goto("/admin");
      await expect(other).toHaveURL(/\/admin$/);
    };
    const deniedBefore = await deniedOriginAudits();
    await replay(captured, { ...withSession, "sec-fetch-site": "cross-site" });
    await otherStillIn();
    expect(await deniedOriginAudits()).toBe(deniedBefore + 1);
    await replay(captured, { ...withSession, origin: "https://attacker.example" });
    await otherStillIn();
    await replay(captured, {});
    await otherStillIn();
    // The genuine request (same origin, with the session) does sign the other session out.
    await replay(captured, withSession);
    await other.goto("/admin");
    await expect(other).toHaveURL(SESSION_ENDED);
    await other.context().close();
  });
});

test.describe("an old session token never gains what a newer session was given (A2 Correction 1)", () => {
  const BOUNDARY = { email: "boundary.reviewer@example.test", name: "Bea Boundary" };

  test("Test A: the password-only token of a sign-in never inherits the second factor", async ({ browser }) => {
    const legit = await newPage(browser);
    await signIn(legit, OWNER.email, PASSWORDS.owner);
    await legit.waitForURL("**/admin/login/verify");
    const pending = await sessionToken(legit);
    // A witness session shows whether an authenticated action replayed with the old token takes effect.
    const witness = await newPage(browser);
    await signIn(witness, OWNER.email, PASSWORDS.owner);
    await verify(witness, ownerSecret);
    await witness.goto("/admin/account/sessions");
    const signOutOthers = await captureAction(witness, "/admin/account/sessions", async () => {
      await witness.getByRole("button", { name: "Sign out all other sessions" }).click();
      await witness.getByRole("dialog").getByRole("button", { name: "Sign them out" }).click();
    });
    // Before the second factor a copy of the pending token reaches the second step and nothing else.
    expect(await visit(pending, "/admin/login/verify")).toEqual({ status: 200, location: undefined });
    expect((await visit(pending, "/admin")).location).toMatch(/\/admin\/login\/verify$/);
    // The legitimate browser completes the second factor and receives a new token.
    await legit.getByLabel("Authentication code").fill(await freshCode(ownerSecret));
    await legit.getByRole("button", { name: "Verify" }).click();
    await legit.waitForURL(/\/admin$/);
    const verifiedAt = Date.now();
    const fresh = await sessionToken(legit);
    expect(fresh).not.toBe(pending);
    // The old pending token is refused at once — no page, no authenticated action, no 30-second window.
    for (const path of ["/admin", "/admin/users", "/admin/account/sessions", "/admin/login/verify"]) {
      expect((await visit(pending, path)).location, path).toMatch(SESSION_ENDED);
    }
    const replayed = await replay(signOutOthers, { cookie: `${COOKIE}=${pending}` });
    expect(newToken(replayed)).toBeNull();
    await witness.goto("/admin");
    await expect(witness).toHaveURL(/\/admin$/);
    expect(Date.now() - verifiedAt).toBeLessThan(30_000);
    // The new token works, and the same request sent with it does sign the others out (the replay itself is sound).
    expect(await visit(fresh, "/admin")).toEqual({ status: 200, location: undefined });
    await replay(signOutOthers, { cookie: `${COOKIE}=${fresh}` });
    await witness.goto("/admin");
    await expect(witness).toHaveURL(SESSION_ENDED);
    await witness.context().close();
    await legit.context().close();
  });

  test("Test B: a token from before a step-up never gains the step-up", async ({ browser }) => {
    const legit = await newPage(browser);
    await signIn(legit, OWNER.email, PASSWORDS.owner);
    await verify(legit, ownerSecret);
    // Capture an invitation (a sensitive action) without sending it, while the sign-in still counts as a confirmation.
    await legit.goto("/admin/users/invite");
    const invite = await captureAction(legit, "/admin/users/invite", async () => {
      await legit.getByLabel("Email", { exact: true }).fill(BOUNDARY.email);
      await legit.getByLabel("Name", { exact: true }).fill(BOUNDARY.name);
      await legit.getByRole("checkbox", { name: /^Reviewer/ }).check();
      await legit.getByRole("button", { name: "Send invitation" }).click();
    });
    // Ten minutes later the confirmation has expired; a copy of this token is kept (the attacker's).
    await ageAuthentication(OWNER.email);
    const old = await sessionToken(legit);
    // The legitimate user confirms again: a new token with a fresh 10-minute window.
    await legit.goto("/admin/users/invite");
    await expect(legit.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
    await stepUpIfAsked(legit, PASSWORDS.owner, ownerSecret);
    await expect(legit.getByRole("button", { name: "Send invitation" })).toBeVisible();
    const fresh = await sessionToken(legit);
    expect(fresh).not.toBe(old);
    // The old token is refused: no page, and the sensitive action does nothing.
    expect((await visit(old, "/admin/users/invite")).location).toMatch(SESSION_ENDED);
    await replay(invite, { cookie: `${COOKIE}=${old}` });
    expect(await usersWithEmail(BOUNDARY.email)).toBe(0);
    // The same request sent with the new token goes through (the replay itself is sound).
    await replay(invite, { cookie: `${COOKIE}=${fresh}` });
    expect(await usersWithEmail(BOUNDARY.email)).toBe(1);
    await legit.context().close();
  });

  test("Test D: rotations racing on one session: at most one new token; the old one ends and is never revived", async ({ browser }) => {
    const legit = await newPage(browser);
    await signIn(legit, OWNER.email, PASSWORDS.owner);
    await verify(legit, ownerSecret);
    const old = await sessionToken(legit);
    // The session has been in use for 30 minutes: the shell asks for a rotation as soon as a page opens.
    await ageSession(old);
    const rotation = await captureAction(legit, "/admin", async () => {
      await legit.goto("/admin");
    });
    const before = await ownerSessionRows();
    const raced = await Promise.all([1, 2, 3].map(() => replay(rotation, { cookie: `${COOKIE}=${old}` })));
    const issued = raced.map(newToken).filter((t): t is string => t !== null);
    expect(issued).toHaveLength(1);
    expect(await ownerSessionRows()).toBe(before + 1);
    const [fresh] = issued;
    // The old token is refused at once and cannot be rotated again: nothing is resurrected or duplicated.
    expect((await visit(old, "/admin")).location).toMatch(SESSION_ENDED);
    expect(newToken(await replay(rotation, { cookie: `${COOKIE}=${old}` }))).toBeNull();
    expect(await ownerSessionRows()).toBe(before + 1);
    expect(await visit(fresh, "/admin")).toEqual({ status: 200, location: undefined });
    // The browser still holds the old cookie (its own rotation never reached the server): it lands on the sign-in
    // page, which says the session ended.
    await legit.goto("/admin");
    await expect(legit).toHaveURL(SESSION_ENDED);
    await expect(legit.locator("main").getByRole("status")).toContainText("Your session has ended");
    await legit.context().close();
  });

  test("Test D: a request still carrying the old token ends at sign-in; a tab of the browser that received the new cookie goes straight back in", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const first = await context.newPage();
    await signIn(first, OWNER.email, PASSWORDS.owner);
    await verify(first, ownerSecret);
    const old = await sessionToken(first);
    const second = await context.newPage();
    await second.goto("/admin/account");
    await ageSession(old);
    // The first tab opens a page; the shell rotates the session and the browser receives the new cookie in that response.
    const rotated = first.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
    await first.goto("/admin");
    await rotated;
    await expect.poll(() => cookieValue(context)).not.toBe(old);
    // A request that left with the old token (the second tab's, already on its way) is refused and sent to sign-in ...
    expect((await visit(old, "/admin/account")).location).toMatch(SESSION_ENDED);
    // ... where the second tab, whose browser holds the new cookie by now, goes straight back into the admin.
    await second.goto("/admin/login?session_ended=1");
    await expect(second).toHaveURL(/\/admin$/);
    await context.close();
  });
});

const COOKIE = "__Host-rawasy_admin";

const cookieValue = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === COOKIE)?.value ?? "";

/** The session token a page's browser holds. */
async function sessionToken(page: Page): Promise<string> {
  const value = await cookieValue(page.context());
  expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  return value;
}

/** Makes a session look 31 minutes old, so the shell's periodic rotation is due (in this run's test database). */
async function ageSession(token: string) {
  await queryTestDb("UPDATE sessions SET created_at = created_at - INTERVAL 31 MINUTE WHERE token_hash = UNHEX(SHA2(?, 256))", [token]);
}

/** A page request sent with one session token from a fresh client: its status and where it redirects. */
async function visit(token: string, path: string): Promise<{ status: number; location: string | undefined }> {
  const client = await apiRequest.newContext({ baseURL: `http://localhost:${run().port}` });
  try {
    const response = await client.get(path, { headers: { cookie: `${COOKIE}=${token}` }, maxRedirects: 0 });
    return { status: response.status(), location: response.headers().location };
  } finally {
    await client.dispose();
  }
}

/** The new session token a response sets, if any. */
const newToken = (response: { headers: Record<string, string> }) =>
  new RegExp(`${COOKIE}=([A-Za-z0-9_-]{43})`).exec(response.headers["set-cookie"] ?? "")?.[1] ?? null;

async function usersWithEmail(email: string): Promise<number> {
  const [row] = await queryTestDb<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE email_normalized = ?", [email.toLowerCase()]);
  return Number(row?.n ?? 0);
}

async function ownerSessionRows(): Promise<number> {
  const [row] = await queryTestDb<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email_normalized = ?",
    [OWNER.email],
  );
  return Number(row?.n ?? 0);
}

interface CapturedAction {
  url: string;
  headers: Record<string, string>;
  body: Buffer;
}

/** Runs `act` and captures the Server Action request it sends to `path`, which is stopped before it reaches the server. */
async function captureAction(page: Page, path: string, act: () => Promise<void>): Promise<CapturedAction> {
  let captured: CapturedAction | null = null;
  await page.route(`**${path}`, async (route) => {
    const r = route.request();
    if (r.method() !== "POST" || !r.headers()["next-action"]) return route.continue();
    const headers = await r.allHeaders();
    for (const name of ["cookie", "host", "content-length", "connection"]) delete headers[name];
    captured = { url: r.url(), headers, body: r.postDataBuffer() ?? Buffer.alloc(0) };
    await route.abort();
  });
  await act();
  await expect.poll(() => captured !== null).toBe(true);
  await page.unroute(`**${path}`);
  return captured as unknown as CapturedAction;
}

/** Sends a captured Server Action again from a fresh client (no cookies unless one is given), with some headers changed. */
async function replay(action: CapturedAction, changes: Record<string, string>) {
  const client = await apiRequest.newContext();
  try {
    const response = await client.post(action.url, { headers: { ...action.headers, ...changes }, data: action.body, maxRedirects: 0 });
    return { status: response.status(), headers: response.headers(), body: await response.text() };
  } finally {
    await client.dispose();
  }
}

const REFUSED_ORIGIN = "Refused: the request did not come from the admin's own pages.";
const REFUSED_STEP_UP = "Refused: a recent re-authentication is required.";

/** Refusals recorded in the audit log, of every action or of one. */
async function deniedAudits(summary: string, action?: string): Promise<number> {
  const [row] = await queryTestDb<{ n: number }>(
    `SELECT COUNT(*) AS n FROM audit_events WHERE outcome = 'denied' AND summary = ?${action ? " AND action = ?" : ""}`,
    action ? [summary, action] : [summary],
  );
  return Number(row?.n ?? 0);
}

/** Refusals of a mutation that did not come from the admin's own pages, as recorded in the audit log. */
const deniedOriginAudits = () => deniedAudits(REFUSED_ORIGIN);

test.describe("two-factor set-up", () => {
  test("the set-up answers only the admin's own pages, a replacement only after a recent confirmation; refusals are audited", async ({ page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/account/security");
    await page.getByRole("button", { name: "Replace authenticator app" }).click();
    await expect(page.getByText("Your current authenticator app keeps working until the new one is confirmed.")).toBeVisible();
    // Capture the replacement's start ("Continue") without letting it reach the server.
    const captured = await captureAction(page, "/admin/account/security", async () => {
      await page.getByLabel("Password", { exact: true }).fill(PASSWORDS.owner);
      await page.getByRole("button", { name: "Continue" }).click();
    });
    const cookie = (await page.context().cookies()).find((c) => c.name === "__Host-rawasy_admin");
    expect(cookie).toBeDefined();
    const withSession = { cookie: `__Host-rawasy_admin=${cookie?.value}` };
    const START = "auth.mfa_replacement_started";
    const crossSiteBefore = await deniedAudits(REFUSED_ORIGIN, START);
    const crossSite = await replay(captured, { ...withSession, "sec-fetch-site": "cross-site" });
    expect(crossSite.body).not.toContain("otpauth://");
    expect(await deniedAudits(REFUSED_ORIGIN, START)).toBe(crossSiteBefore + 1);
    const foreign = await replay(captured, { ...withSession, origin: "https://attacker.example" });
    expect(foreign.body).not.toContain("otpauth://");
    // The same request from the admin's own page does start it (the replay works; nothing is stored until confirmed) ...
    const genuine = await replay(captured, withSession);
    expect(genuine.body).toContain("otpauth://");
    // ... but not once the last confirmation of identity is more than 10 minutes old.
    await ageAuthentication(OWNER.email);
    const stepUpBefore = await deniedAudits(REFUSED_STEP_UP, START);
    const stale = await replay(captured, withSession);
    expect(stale.body).not.toContain("otpauth://");
    expect(await deniedAudits(REFUSED_STEP_UP, START)).toBe(stepUpBefore + 1);
  });

  test("an abandoned replacement leaves the current app working; a confirmed one replaces the app and its recovery codes", async ({ browser, page }) => {
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin/account/security");
    await page.getByRole("button", { name: "Replace authenticator app" }).click();
    await beginSetUp(page, PASSWORDS.owner);
    // Started, not confirmed: another browser still completes a sign-in with the current app.
    const other = await newPage(browser);
    await signIn(other, OWNER.email, PASSWORDS.owner);
    await verify(other, ownerSecret);
    await expect(other).toHaveURL(/\/admin$/);
    // Confirmed: the new app works; the previous one does not; the other sessions were signed out; this page's own
    // token from before the replacement is refused (A2 Correction 1), while the page goes on with its new one.
    const beforeReplacement = await sessionToken(page);
    const replaced = await finishSetUp(page, "Use the new authenticator app");
    expect((await visit(beforeReplacement, "/admin")).location).toMatch(SESSION_ENDED);
    expect(await sessionToken(page)).not.toBe(beforeReplacement);
    expect(replaced.secret).not.toBe(ownerSecret);
    const previous = ownerSecret;
    ownerSecret = replaced.secret;
    ownerCodes = replaced.codes;
    await other.goto("/admin");
    await expect(other).toHaveURL(SESSION_ENDED);
    await signIn(other, OWNER.email, PASSWORDS.owner);
    await other.waitForURL("**/admin/login/verify");
    await other.getByLabel("Authentication code").fill(hotp(previous, Math.floor(Date.now() / 30_000)));
    await other.getByRole("button", { name: "Verify" }).click();
    await expect(other.locator("main").getByRole("alert")).toContainText("didn't work");
    await other.getByLabel("Authentication code").fill(await freshCode(ownerSecret));
    await other.getByRole("button", { name: "Verify" }).click();
    await expect(other).toHaveURL(/\/admin$/);
    await other.context().close();
  });
});

test.describe("accessibility and layout", () => {
  test("keyboard: skip link, menus and forms work without a mouse; focus is visible", async ({ page }) => {
    await page.goto("/admin/login");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("name", /email|password/);
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    await page.goto("/admin");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText("Skip to content");
    const outline = await page.locator(":focus").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe("solid");
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
    const summary = page.locator('summary[aria-label^="Account:"]');
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".adm-account-panel")).toBeVisible();
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`the shell at ${width} px: no sideways scrolling, menu or sidebar as fits`, async ({ browser }) => {
      const page = await newPage(browser, { width, height: 800 });
      await signIn(page, OWNER.email, PASSWORDS.owner);
      await verify(page, ownerSecret);
      const paths = ["/admin", "/admin/users", "/admin/users/invite", "/admin/users/roles", "/admin/account", "/admin/account/security", "/admin/account/sessions"];
      for (const path of paths) {
        await page.goto(path);
        await page.locator("main h1").first().waitFor({ state: "visible" });
        // The page never scrolls sideways (the permission matrix scrolls inside its own box).
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${width}`).toBeLessThanOrEqual(0);
      }
      // "View website" sits in the top bar from 640 px, in the phone menu below.
      await expect(page.locator(".adm-top").getByRole("link", { name: /View website/ })).toBeVisible({ visible: width >= 640 });
      if (width < 1024) {
        await expect(page.locator(".adm-side")).toBeHidden();
        await page.locator("summary", { hasText: "Menu" }).click();
        const menu = page.locator(".adm-menu-panel");
        await expect(menu.getByRole("link", { name: "Users", exact: true })).toBeVisible();
        await expect(menu.getByRole("link", { name: /View website/ })).toBeVisible({ visible: width < 640 });
      } else {
        await expect(page.locator(".adm-side")).toBeVisible();
        await expect(page.locator("summary", { hasText: "Menu" })).toBeHidden();
      }
      await page.context().close();
    });
  }

  for (const width of [320, 390]) {
    test(`new recovery codes at ${width} px: every code on one line inside the list, no sideways scrolling`, async ({ browser }) => {
      const page = await newPage(browser, { width, height: 800 });
      await signIn(page, OWNER.email, PASSWORDS.owner);
      await verify(page, ownerSecret);
      await page.goto("/admin/account/security");
      await page.getByRole("button", { name: "Create new recovery codes" }).click();
      await page.getByRole("heading", { name: "Save your recovery codes" }).waitFor();
      const codes = await page.locator(".adm-codes li").allTextContents();
      expect(codes).toHaveLength(10);
      ownerCodes = codes;
      const fit = await page.evaluate(() => {
        const list = document.querySelector(".adm-codes") as HTMLElement;
        const box = list.getBoundingClientRect();
        const style = getComputedStyle(list);
        const inner = { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
        return [...list.querySelectorAll("li")].map((li) => {
          const range = document.createRange();
          range.selectNodeContents(li);
          const lines = range.getClientRects().length;
          const text = range.getBoundingClientRect();
          return { lines, inside: text.left >= inner.left - 0.1 && text.right <= inner.right + 0.1 };
        });
      });
      for (const code of fit) expect(code).toEqual({ lines: 1, inside: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.context().close();
    });
  }

  test("axe finds no violations on the sign-in, dashboard, users and security pages", async ({ page }) => {
    await page.goto("/admin/login");
    expect(await axe(page)).toEqual([]);
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    for (const path of ["/admin", "/admin/users", "/admin/account", "/admin/account/security", "/admin/account/sessions"]) {
      await page.goto(path);
      await page.locator("main h1").first().waitFor({ state: "visible" });
      expect(await axe(page), path).toEqual([]);
    }
  });

  test("no inline style attributes and no CSP violations on admin pages", async ({ page }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as unknown as { __csp: string[] }).__csp = [...((window as unknown as { __csp?: string[] }).__csp ?? []), e.violatedDirective];
      });
    });
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy/.test(m.text())) violations.push(m.text());
    });
    await signIn(page, OWNER.email, PASSWORDS.owner);
    await verify(page, ownerSecret);
    for (const path of ["/admin", "/admin/users", "/admin/users/roles", "/admin/account/security"]) {
      await page.goto(path);
      await page.locator("main h1").first().waitFor({ state: "visible" });
      expect(await styledElements(page), path).toEqual([]);
      expect(await (await page.request.get(path)).text(), path).not.toMatch(STYLE_ATTRIBUTE);
      expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []), path).toEqual([]);
    }
    expect(violations).toEqual([]);
  });
});

test("the run used only the local test database", () => {
  const state = run();
  expect(state.database).toMatch(/^rawasy_e2e_[0-9a-f]{8}$/);
  expect(process.env.TEST_DB_HOST ?? "127.0.0.1").toMatch(/^(127\.0\.0\.1|localhost)$/);
});
