import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, INNER_PAGES, trackErrors } from "./helpers";

/**
 * Site-wide checks, one design since Stage TM-2.6: every internal link resolves; no page loads anything of the
 * previous design (its stylesheet, faces, shell, loader, page transition, cursor, floating WhatsApp button or GSAP) and
 * nothing is prefetched; which addresses reach which 404, and the fallback 404 for addresses outside any language
 * (src/app/global-not-found.tsx). The previous design's shell tests retired with it; the TM-2.6 report's assertion map
 * says where each behaviour is checked now.
 */

test("internal links on the homepage, the inner pages and the planned pages resolve", async ({ page, request }) => {
  test.setTimeout(180_000);
  const links = new Set<string>();
  for (const locale of ["en", "ar"]) {
    for (const route of ["", ...INNER_PAGES.map((p) => `/${p}`), "/capabilities", "/projects/geometric-lanterns"]) {
      await page.goto(`/${locale}${route}`, { waitUntil: "domcontentloaded" });
      const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
      for (const href of hrefs) {
        if (href && href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0] || "/");
      }
    }
  }
  const broken: string[] = [];
  for (const href of links) {
    const response = await request.get(href, { maxRedirects: 0 });
    if (response.status() >= 400) broken.push(`${href} → ${response.status()}`);
  }
  // Since Stage TM-2.5 the pages link each project to its place in the gallery (#<slug>, decision D4), so the crawl finds
  // the website's own pages only; commerce-projects.spec.ts checks every one of those anchors.
  expect(links.size).toBeGreaterThan(30);
  expect(broken).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Nothing of the previous design
// ---------------------------------------------------------------------------------------------------------------------

const PAGES = ["/en", "/ar/about", "/en/services/laser-cutting", "/en/projects", "/en/capabilities", "/en/projects/geometric-lanterns", "/en/contact"];
const MC_FACES = ["IBM Plex Sans Arabic", "Inter", "Plus Jakarta Sans", "Tajawal"];
/** Selectors only the previous design's stylesheet and shell had. */
const OLD_RULES = [".btn-face", ".page-wipe", ".loader", ".cursor-ring", ".grain"];

const stylesheetHas = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.styleSheets].some((s) => {
        try {
          return [...s.cssRules].some((rule) => rule.cssText.includes(sel));
        } catch {
          return false;
        }
      }),
    selector,
  );

test("no page loads anything of the previous design, and nothing is prefetched", async ({ page }) => {
  test.setTimeout(120_000);
  const prefetched: string[] = [];
  const external: string[] = [];
  const scripts: Promise<string>[] = [];
  page.on("request", (r) => {
    if (r.headers()["next-router-prefetch"]) prefetched.push(r.url());
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
  });
  page.on("response", (r) => void (/\/_next\/static\/chunks\/.+\.js$/.test(r.url()) && scripts.push(r.text().catch(() => ""))));
  for (const url of PAGES) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // The Modern Commerce sheet, and none of the previous design's rules.
    expect(await stylesheetHas(page, ".mc .a2-header"), url).toBe(true);
    for (const rule of OLD_RULES) expect(await stylesheetHas(page, rule), `${url} ${rule}`).toBe(false);
    // The Modern Commerce faces only, two of them preloaded.
    const families = await page.evaluate(() => [...new Set([...document.fonts].map((f) => f.family.replace(/['"]/g, "")))].filter((f) => !f.endsWith(" Fallback")).sort());
    expect(families, url).toEqual(MC_FACES);
    await expect(page.locator('link[rel="preload"][as="font"]'), url).toHaveCount(2);
    // No previous shell: loader, page wipe, custom cursor ring, grain, floating WhatsApp button.
    await expect(page.locator(".loader, .page-wipe, .cursor-ring, .grain"), url).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('a[href*="wa.me"]')].filter((a) => getComputedStyle(a).position === "fixed").length), url).toBe(0);
  }
  // No GSAP in any script, no font from Google, no prefetch.
  for (const code of await Promise.all(scripts)) expect(code).not.toMatch(/greensock|_gsap\b|gsap\.(registerPlugin|timeline|to|from)\(/i);
  expect(external).toEqual([]);
  expect(prefetched).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Which addresses reach which 404
// ---------------------------------------------------------------------------------------------------------------------

test("addresses without a language are sent to one (then answered there); the proxy's excluded paths keep Next.js's own 404", async ({ request }) => {
  // Redirected by the proxy to the visitor's language — English here, Arabic when asked for — and answered there: the
  // localized 404 of an unknown page (a real 404), or the page itself.
  for (const [from, to, final, title] of [
    ["/foo", "/en/foo", 404, "Page not found | RAWASY"],
    ["/not-a-route", "/en/not-a-route", 404, "Page not found | RAWASY"],
    ["/zz", "/en/zz", 404, "Page not found | RAWASY"],
    ["/zz/foo", "/en/zz/foo", 404, "Page not found | RAWASY"],
    ["/", "/en", 200, null],
    ["/about", "/en/about", 200, null],
  ] as const) {
    const first = await request.get(from, { maxRedirects: 0 });
    expect(first.status(), from).toBe(307);
    expect(new URL(first.headers()["location"], "http://localhost").pathname, from).toBe(to);
    const answer = await request.get(to, { maxRedirects: 0 });
    expect(answer.status(), to).toBe(final);
    if (title) expect(await answer.text(), to).toContain(`<title>${title}</title>`);
  }
  const arabic = await request.get("/zz/foo", { maxRedirects: 0, headers: { "accept-language": "ar" } });
  expect(new URL(arabic.headers()["location"], "http://localhost").pathname).toBe("/ar/zz/foo");
  // Outside the proxy (its matcher leaves out api/, media/, _next/ …): a 404 straight away, unchanged since before TM-2.1.
  for (const url of ["/api/no-such", "/media/no-such.jpg", "/_next/no-such"]) {
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.status(), url).toBe(404);
    expect(await response.text(), url).not.toContain("g404");
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The fallback 404 (global-not-found.tsx)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Next.js builds the fallback 404 as the /_not-found page (status 404 in its metadata). No address of this website
 * reaches it today — the proxy gives every address a language first, and its excluded paths get Next.js's own page — so
 * it is checked from the build output, served by the test at a made-up address on the same server (its stylesheet,
 * faces and scripts load from the server as they would).
 */
const BUILT = path.join(process.cwd(), ".next/server/app/_not-found");
const FALLBACK = "/__fallback-404";

async function openFallback(page: Page) {
  const html = fs.readFileSync(`${BUILT}.html`, "utf8");
  await page.route(`**${FALLBACK}`, (route) => route.fulfill({ status: 404, contentType: "text/html; charset=utf-8", body: html }));
  return page.goto(FALLBACK, { waitUntil: "networkidle" });
}

test.describe("the fallback 404", () => {
  test.skip(!!process.env.E2E_BASE_URL, "reads this checkout's build output");

  test("is built as a 404 page: noindex, its title, no font preload, its own small stylesheet", async () => {
    expect(JSON.parse(fs.readFileSync(`${BUILT}.meta`, "utf8")).status).toBe(404);
    const html = fs.readFileSync(`${BUILT}.html`, "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain("<title>404 — RAWASY · رواسي</title>");
    expect(head).toMatch(/<meta name="robots" content="noindex"\/>/);
    expect(head).not.toMatch(/<link rel="preload"[^>]*as="font"/);
    const sheets = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    expect(sheets).toHaveLength(1);
    const css = fs.readFileSync(path.join(process.cwd(), ".next", sheets[0].replace("/_next/", "")), "utf8");
    expect(css).toContain(".g404");
    expect(css).not.toContain(".a2-header");
    expect(css).not.toContain(".btn-face");
  });

  test("both languages, each marked; one h1, a heading per language, no duplicate ids; the ways home and to contact", async ({ page }) => {
    const errors = trackErrors(page);
    const response = await openFallback(page);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("404 — RAWASY · رواسي");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('h1 [lang="en"]')).toHaveText("Page not found");
    await expect(page.locator('h1 [lang="ar-SA"]')).toHaveText("الصفحة غير موجودة");
    for (const [lang, dir, title, home, contact] of [
      ["en", "ltr", "Outside the blueprint", "/en", "/en/contact"],
      ["ar-SA", "rtl", "خارج المخطط", "/ar", "/ar/contact"],
    ]) {
      const part = page.locator(`main section[lang="${lang}"]`);
      await expect(part).toHaveAttribute("dir", dir);
      await expect(part.locator("h2")).toHaveText(title);
      expect(await part.getAttribute("aria-labelledby")).toBe(await part.locator("h2").getAttribute("id"));
      await expect(part.locator(`a[href="${home}"]`)).toHaveCount(1);
      await expect(part.locator(`a[href="${contact}"]`)).toHaveCount(1);
    }
    expect(await page.evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map((e) => e.id); return ids.filter((id, i) => ids.indexOf(id) !== i); })).toEqual([]);
    await expect(page.locator(".g404-code")).toHaveAttribute("aria-hidden", "true");
    // No previous-design leftovers: its grid, drawing or shell.
    await expect(page.locator(".loader, .page-wipe, .cursor-ring, .grain, .bg-grid")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the keyboard reaches the four links in reading order, each with a visible focus ring", async ({ page }) => {
    await openFallback(page);
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { href: el.getAttribute("href"), outline: getComputedStyle(el).outlineStyle };
      });
      expect(focused.outline).not.toBe("none");
      order.push(focused.href ?? "");
    }
    expect(order).toEqual(["/en", "/en/contact", "/ar", "/ar/contact"]);
  });

  test("takes the visitor's theme; fits a 320 px screen", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    await openFallback(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(19, 24, 32)");
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
