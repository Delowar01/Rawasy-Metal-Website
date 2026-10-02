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

  // Stage TM-3 correction 1: forced colours keep an inline SVG's own colour, so the lockup's ink followed the stored
  // theme and vanished when the forced palette disagreed with it (dark ink on a black page, light ink on a white one).
  for (const scheme of ["light", "dark"] as const)
    for (const theme of ["light", "dark"] as const)
      test(`forced ${scheme}, stored theme ${theme}: the logo takes the forced text colour and shows; the buttons, the focus ring and both parts stay readable`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("rawasy-theme", t), theme);
        await page.emulateMedia({ forcedColors: "active", colorScheme: scheme });
        await openFallback(page);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const seen = await page.evaluate(() => {
          const probe = (colour: string) => {
            const span = document.createElement("span");
            span.style.color = colour;
            document.body.append(span);
            const value = getComputedStyle(span).color;
            span.remove();
            return value;
          };
          const logo = document.querySelector(".g404-logo")!;
          return {
            text: probe("CanvasText"),
            canvas: probe("Canvas"),
            page: getComputedStyle(document.body).backgroundColor,
            logo: getComputedStyle(logo).color,
            piece: getComputedStyle(logo.querySelector(".piece-top")!).fill,
            parts: [...document.querySelectorAll(".g404-part :is(h2, .g404-body)")].map((el) => getComputedStyle(el).color),
            buttons: [...document.querySelectorAll(".g404-btn")].map((el) => {
              const style = getComputedStyle(el);
              return { colour: style.color, border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}` };
            }),
          };
        });
        expect(seen.text).toBe(scheme === "light" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
        expect(seen.page).toBe(seen.canvas);
        expect(seen.logo).toBe(seen.text);
        expect(seen.piece).toBe("rgb(241, 95, 34)");
        expect(seen.parts).toEqual(Array(4).fill(seen.text));
        expect(seen.buttons).toHaveLength(4);
        for (const button of seen.buttons) {
          expect(button.colour).not.toBe(seen.canvas);
          expect(button.border).toBe(`1px solid ${button.colour}`);
        }
        // As drawn: the lockup's box holds its ink in the forced text colour, not only the page colour and the orange piece.
        const shot = await page.locator(".g404-logo").screenshot();
        const ink = await page.evaluate(
          async ([png, text]) => {
            const image = new Image();
            image.src = `data:image/png;base64,${png}`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0);
            const [r, g, b] = text.match(/\d+/g)!.map(Number);
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) < 60) count++;
            return count / (canvas.width * canvas.height);
          },
          [shot.toString("base64"), seen.text] as const,
        );
        expect(ink).toBeGreaterThan(0.1);
        // The first link's focus ring.
        await page.keyboard.press("Tab");
        const ring = await page.evaluate(() => {
          const style = getComputedStyle(document.activeElement!);
          return { href: document.activeElement!.getAttribute("href"), style: style.outlineStyle, width: parseFloat(style.outlineWidth), colour: style.outlineColor };
        });
        expect(ring.href).toBe("/en");
        expect(ring.style).toBe("solid");
        expect(ring.width).toBeGreaterThanOrEqual(2);
        expect(ring.colour).not.toBe(seen.canvas);
      });

  for (const theme of ["light", "dark"] as const)
    test(`normal colours, ${theme}: the logo keeps the theme's ink, and the page is drawn pixel for pixel as without its forced-colours rule`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("rawasy-theme", t), theme);
      await openFallback(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector(".g404-logo")!).color)).toBe(theme === "light" ? "rgb(21, 23, 26)" : "rgb(238, 241, 244)");
      const drawn = await page.screenshot({ fullPage: true });
      // The same page with the forced-colours rule taken out of its stylesheet.
      const rule = "@media (forced-colors:active){.g404-logo{color:canvastext}}";
      let removed = false;
      await page.route(/\/_next\/static\/chunks\/[^/]+\.css$/, async (route) => {
        const response = await route.fetch();
        const css = await response.text();
        removed ||= css.includes(rule);
        await route.fulfill({ response, body: css.replace(rule, "") });
      });
      await page.reload({ waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      expect(removed).toBe(true);
      expect((await page.screenshot({ fullPage: true })).equals(drawn)).toBe(true);
    });

  test("stays on its own: no other page links its stylesheet or its faces, and no script carries its markup", async ({ request }) => {
    const html = fs.readFileSync(`${BUILT}.html`, "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    const [sheet] = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    const css = fs.readFileSync(path.join(process.cwd(), ".next", sheet.replace("/_next/", "")), "utf8");
    expect(css).toContain("@media (forced-colors:active){.g404-logo{color:canvastext}}");
    const faces = [...css.matchAll(/url\(\.\.\/media\/([^)]+\.woff2)\)/g)].map((m) => m[1]);
    expect(faces.length).toBeGreaterThan(0);
    for (const url of ["/en", "/ar", "/ar/about", "/en/projects", "/en/services/laser-cutting", "/theme-lab/en/modern-commerce-a-v2"]) {
      const page = await (await request.get(url)).text();
      expect(page, url).not.toContain(sheet);
      expect(page, url).not.toContain("g404");
      for (const face of faces) expect(page, `${url} ${face}`).not.toContain(face);
    }
    // The page ships no script of its own: no chunk carries its markup.
    const chunks = path.join(process.cwd(), ".next/static/chunks");
    const scripts = fs.readdirSync(chunks).filter((file) => file.endsWith(".js"));
    expect(scripts.filter((file) => fs.readFileSync(path.join(chunks, file), "utf8").includes("g404"))).toEqual([]);
  });
});
