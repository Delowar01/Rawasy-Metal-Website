/**
 * Preview parity (A5 brief §72): the bespoke blocks draw today's approved components. With today's words in the
 * builder's sections — written by `e2e-admin/seed-parity.mjs` from the static content layer, read only, into this run's
 * throwaway database (test input, not a content migration) — each part of a preview page is compared with the same part
 * of the public page on the same server: its DOM (elements, attributes, ARIA, headings, links, ids, class lists, in
 * order), its visible text, its media (sources, sizes, alt text, dimensions) and its pixels, in English and Arabic, light
 * and dark, at 1280 and 390 px. The pages: About (the opening, parts 01–10 and the closing call to action; the parts
 * whose records the seed does not create — projects, clients, certificates — are hidden and left out on both sides),
 * Contact and the Privacy policy (whole pages), the homepage (the hero, the capability strip, About, Services,
 * Machinery and Start a project; projects, industries, clients and compliance hidden and left out) and the Laser
 * Engraving service page (the whole page: the opening with its signature, the numbered sections and the closing). Reveals, the ambient, the header and the pointer are taken out of the pixel captures on both sides; the
 * motion runs reduced (the hero plate rests finished).
 *
 * Runs after every other admin spec, media.spec.ts included (the release import adds the site's own media, which that
 * spec's pickers must not see), in a browser of its own: the "parity" project of playwright.admin.config.ts.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { cli, cliEnv, queryTestDb } from "./helpers";

test.describe.configure({ mode: "serial" });

const ROOT = resolve(__dirname, "..");
const EDITOR = { email: "parity.editor@example.test", name: "Test Parity Editor", password: "parity editor phrase orchard" };
let ids: { about: string; contact: string; privacy: string; home: string; engraving: string };

/** The parts the seed leaves hidden (their records are not created): left out of the public page's list too. */
const HIDDEN: Record<string, string[]> = {
  about: ["work", "clients", "compliance"],
  contact: [],
  privacy: [],
  // The clients and compliance share one sheet on the homepage (its first id is the clients section's).
  home: ["projects", "industries", "clients"],
  engraving: [],
};
/** Where each page is on the public site, and what the preview shows it as. */
const PAGES: Record<string, { path: string; kind: "page" | "service" }> = {
  about: { path: "about", kind: "page" },
  contact: { path: "contact", kind: "page" },
  privacy: { path: "privacy", kind: "page" },
  home: { path: "", kind: "page" },
  engraving: { path: "services/laser-engraving", kind: "service" },
};
/**
 * The preview's admin-only notes where a section shows nothing (expected): Laser Engraving's gallery and projects stay
 * on (its opening links to them when they show) and have nothing to show, as on today's page.
 */
const NOTES: Record<string, number> = { about: 0, contact: 0, privacy: 0, home: 0, engraving: 2 };
/** The parts compared on each page, by key (an id of their own or their first id inside), in order. */
const COMPARED: Record<string, string[]> = {
  about: ["page-title", "overview", "what", "metal", "beyond", "vision", "approach", "process", "why", "workshop", "machinery", "page-cta-title"],
  contact: ["page-title", "quote", "location"],
  privacy: ["page-title", "who-we-are"],
  home: ["home", "shell", "about", "services", "machinery", "contact"],
  engraving: ["page-title", "overview", "scope", "process", "applications", "why", "related", "page-cta-title"],
};

test.beforeAll(async () => {
  execFileSync(process.execPath, [join(ROOT, "e2e-admin/seed-user.mjs"), "--email", EDITOR.email, "--name", EDITOR.name, "--roles", "editor"], {
    env: { ...cliEnv(), SEED_PASSWORD: EDITOR.password },
    encoding: "utf8",
  });
  // The release's own media (A4's importer: idempotent), then today's words in the sections.
  cli("media-import-release.mjs", []);
  ids = JSON.parse(execFileSync(process.execPath, [join(ROOT, "e2e-admin/seed-parity.mjs")], { env: cliEnv(), encoding: "utf8" }));
});

const contexts: BrowserContext[] = [];
// Each test's tabs close when it ends, so no test keeps another's pages, photos and their decoded pixels in the browser.
test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

/** A signed-in Editor (content.view + preview.use) with reduced motion, at a width and in a colour scheme. */
async function session(browser: Browser, width: number, scheme: "light" | "dark"): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" });
  contexts.push(context);
  // google.com is blocked here: the Contact map's frame gets the same empty page on both sides.
  await context.route(/^https:\/\/www\.google\.com\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>map</title>" }));
  const login = await context.newPage();
  await login.goto("/admin/login");
  await login.getByLabel("Email", { exact: true }).fill(EDITOR.email);
  await login.getByLabel("Password", { exact: true }).fill(EDITOR.password);
  await login.getByRole("button", { name: "Sign in" }).click();
  await login.waitForURL((url) => !url.pathname.startsWith("/admin/login"));
  // The compared pages open in tabs of their own: no mouse has moved over them (a hovered card would differ).
  await login.close();
  return context.newPage();
}

/**
 * Loads a page fully: every image eager, loaded and decoded and the fonts in before the page is scrolled, then every
 * reveal shown (scrolled through) and back at the top. The page is not scrolled while its photos arrive: next/image
 * decodes and re-renders each photo as it loads, and instant scrolls among those commits are what froze Chromium's
 * renderer (playwright.admin.config.ts, the "parity" project).
 */
async function settle(page: Page, url: string) {
  await page.goto(url);
  await page.locator("main#main").waitFor();
  await page.evaluate(async () => {
    const decoded = () =>
      Promise.all(
        [...document.images].map((img) =>
          Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 8000))]),
        ),
      );
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
    await document.fonts.ready;
    await decoded();
    await frames();
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await frames();
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await document.fonts.ready;
    await decoded();
  });
}

interface PartSnapshot {
  key: string;
  dom: string[];
  text: string;
  media: string[];
}

/**
 * The page's parts (`main`'s children, scripts left out), each as its DOM in document order — elements with their
 * attributes sorted (the run-time state attributes of the motion and the image placeholders' inline background left
 * out; React's generated ids numbered by first appearance), text nodes with whitespace collapsed — its visible text and
 * its images.
 */
function parts(page: Page, hidden: string[]): Promise<PartSnapshot[]> {
  return page.evaluate((hidden) => {
    // The preview's admin-only notes (a section shown on no page: "Preview only — … is not shown") are not part of it.
    const NOTE = ".gb-absent";
    const STATE = new Set(["data-shown", "data-live", "data-cycle", "data-running", "data-dark", "data-press", "data-pointer", "data-frozen", "data-state"]);
    // React's generated ids (useId): "_R_…_" in this React, "«r…»" and ":r…:" in earlier ones.
    const REACT_ID = /_[rR]_[0-9a-zA-Z]+_|«[rR][0-9a-zA-Z]+»|:[rR][0-9a-zA-Z]+:/g;
    const main = document.querySelector("main#main")!;
    const own = (id: string | null | undefined) => (id && !new RegExp(REACT_ID.source).test(id) ? id : "");
    const keyOf = (el: Element) =>
      own(el.id) || own(el.getAttribute("aria-labelledby")) || [...el.querySelectorAll("[id]")].map((d) => own(d.id)).find(Boolean) || el.classList[0] || el.tagName.toLowerCase();
    return [...main.children]
      .filter((el) => el.tagName !== "SCRIPT" && el.tagName !== "TEMPLATE" && !el.matches(NOTE))
      .map((part) => {
        const ids = new Map<string, string>();
        const numbered = (m: string) => {
          if (!ids.has(m)) ids.set(m, `«id${ids.size}»`);
          return ids.get(m)!;
        };
        // The laser signatures name their SVG gradients "lc"/"le" + the React id without its punctuation.
        const norm = (value: string) => value.replace(REACT_ID, numbered).replace(/\b(lc|le)([rR][0-9a-zA-Z]+)/g, (_, prefix: string, id: string) => `${prefix}${numbered(id)}`);
        const dom: string[] = [];
        const walk = (node: Node, depth: number) => {
          const pad = "  ".repeat(depth);
          if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
            if (text) dom.push(`${pad}"${text}"`);
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as Element;
          if (el.tagName === "SCRIPT") return;
          const attrs = [...el.attributes]
            .filter((a) => !STATE.has(a.name))
            .map((a) => {
              let value = a.value;
              if (el.tagName === "IMG" && a.name === "style") {
                value = value
                  .split(";")
                  .map((d) => d.trim())
                  .filter((d) => d && !d.startsWith("background"))
                  .join(";");
              }
              return `${a.name}=${JSON.stringify(norm(value))}`;
            })
            .sort();
          dom.push(`${pad}<${el.tagName.toLowerCase()}${attrs.length ? " " + attrs.join(" ") : ""}>`);
          for (const child of el.childNodes) walk(child, depth + 1);
        };
        walk(part, 0);
        const media = [...part.querySelectorAll("img")].map(
          (img) => `${img.getAttribute("src")} | ${img.getAttribute("srcset") ?? ""} | ${img.getAttribute("sizes") ?? ""} | alt="${img.alt}" | ${img.width}×${img.height} | natural ${img.naturalWidth}×${img.naturalHeight}`,
        );
        return { key: keyOf(part), dom, text: (part as HTMLElement).innerText.replace(/\s+/g, " ").trim(), media };
      })
      .filter((p) => !hidden.includes(p.key));
  }, hidden);
}

/** The first differing line of two DOM listings, with a little context, for the failure message. */
function firstDifference(a: string[], b: string[]): string {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return `line ${i + 1}:\n  public:  ${a[i] ?? "(end)"}\n  preview: ${b[i] ?? "(end)"}\n  before:  ${a[i - 1] ?? ""}`;
  }
  return "none";
}

/** Takes the ambient, the header, the pointer and the reveals out of the picture (both sides, through the CSSOM). */
async function still(page: Page) {
  await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      .a2-ambient, .a2-cursor { display: none !important; }
      header.a2-header { visibility: hidden !important; }
      [data-reveal], [data-enter] { opacity: 1 !important; transform: none !important; translate: none !important; transition: none !important; animation: none !important; }
      * { caret-color: transparent !important; }
    `);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
}

const CASES = [
  { page: "about", locale: "en", width: 1280, scheme: "light" },
  { page: "about", locale: "ar", width: 1280, scheme: "dark" },
  { page: "about", locale: "en", width: 390, scheme: "light" },
  { page: "contact", locale: "en", width: 1280, scheme: "light" },
  { page: "contact", locale: "ar", width: 390, scheme: "dark" },
  { page: "privacy", locale: "en", width: 1280, scheme: "dark" },
  { page: "privacy", locale: "ar", width: 1280, scheme: "light" },
  { page: "privacy", locale: "en", width: 390, scheme: "light" },
  { page: "home", locale: "en", width: 1280, scheme: "light" },
  { page: "home", locale: "ar", width: 1280, scheme: "dark" },
  { page: "home", locale: "en", width: 390, scheme: "dark" },
  { page: "engraving", locale: "en", width: 1280, scheme: "light" },
  { page: "engraving", locale: "ar", width: 1280, scheme: "dark" },
  { page: "engraving", locale: "ar", width: 390, scheme: "light" },
] as const;

for (const c of CASES) {
  test(`${c.page} (${c.locale}, ${c.width} px, ${c.scheme}): every part's DOM, text, media and pixels equal the public page's`, async ({ browser }) => {
    const prev = await session(browser, c.width, c.scheme);
    const pub = await prev.context().newPage();
    const { path, kind } = PAGES[c.page];
    await settle(pub, `/${c.locale}${path ? `/${path}` : ""}`);
    await settle(prev, `/admin/preview/${kind}/${ids[c.page as keyof typeof ids]}?locale=${c.locale}&theme=${c.scheme}`);
    // Exactly the expected admin-only notes, and no section that failed to draw.
    expect(await prev.locator("main#main > .gb-absent").count()).toBe(NOTES[c.page]);
    expect(await prev.locator(".gb-failed:not(.gb-absent)").count()).toBe(0);
    // The public page follows the browser's colour scheme here (nothing stored); the preview takes the theme it was asked for.
    expect(await pub.evaluate(() => document.documentElement.dataset.theme ?? "light")).toBe(c.scheme);
    expect(await prev.evaluate(() => document.documentElement.dataset.theme)).toBe(c.scheme);
    expect(await prev.evaluate(() => document.documentElement.lang)).toBe(await pub.evaluate(() => document.documentElement.lang));

    const a = await parts(pub, HIDDEN[c.page]);
    const b = await parts(prev, []);
    expect(a.map((p) => p.key), "the public page's parts").toEqual(COMPARED[c.page]);
    expect(b.map((p) => p.key), "the same parts, in the same order").toEqual(a.map((p) => p.key));
    for (const [i, part] of a.entries()) {
      expect(b[i].dom, `${part.key}: DOM — first difference at ${firstDifference(part.dom, b[i].dom)}`).toEqual(part.dom);
      expect(b[i].text, `${part.key}: visible text`).toBe(part.text);
      expect(b[i].media, `${part.key}: media`).toEqual(part.media);
    }

    await still(pub);
    await still(prev);
    // The public list may hold hidden parts between the compared ones: pixels are taken part by part, by place.
    const all = await pub.evaluate(() => {
      const generated = /_[rR]_[0-9a-zA-Z]+_|«[rR][0-9a-zA-Z]+»|:[rR][0-9a-zA-Z]+:/;
      const own = (id: string | null | undefined) => (id && !generated.test(id) ? id : "");
      return [...document.querySelectorAll("main#main > :not(script, template)")].map(
        (el) => own(el.id) || own(el.getAttribute("aria-labelledby")) || [...el.querySelectorAll("[id]")].map((d) => own(d.id)).find(Boolean) || el.classList[0] || el.tagName.toLowerCase(),
      );
    });
    const results: string[] = [];
    const shown = await prev.evaluate(() => [...document.querySelectorAll("main#main > :not(script, template)")].map((el) => !el.matches(".gb-absent")));
    const previewPlaces = shown.flatMap((keep, i) => (keep ? [i] : []));
    for (const [i, part] of a.entries()) {
      const at = all.indexOf(part.key);
      const r = await pixelsAt(pub, prev, at, previewPlaces[i], part.key);
      results.push(`${part.key}: ${r.size}, ${r.differing} differing`);
    }
    expect(results.filter((r) => !/ 0 differing$/.test(r)), results.join("\n")).toEqual([]);
  });
}

/**
 * Pixels of one part on each side (same width, same theme), by its place among `main`'s children on that side (the public
 * page may show more parts than the preview): the number of pixels whose colour differs, and the two sizes.
 */
async function pixelsAt(pub: Page, prev: Page, publicIndex: number, previewIndex: number, label: string) {
  // Each part alone at the top of the page on both sides: its decorations that follow the viewport or the page (dot
  // patterns, the next part's edge) are then drawn the same way, wherever the part sits in its page.
  const shot = async (page: Page, index: number) => {
    await page.evaluate((index) => {
      const kids = [...document.querySelectorAll<HTMLElement>("main#main > :not(script, template)")];
      kids.forEach((el, i) => el.style.setProperty("display", i === index ? "" : "none"));
      window.scrollTo({ top: 0, behavior: "instant" });
    }, index);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const png = await page.locator("main#main > :not(script, template)").nth(index).screenshot({ animations: "disabled", caret: "hide" });
    await page.evaluate(() => document.querySelectorAll<HTMLElement>("main#main > :not(script, template)").forEach((el) => el.style.removeProperty("display")));
    return png;
  };
  const [a, b] = [await shot(pub, publicIndex), await shot(prev, previewIndex)];
  const [ra, rb] = await Promise.all([sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
  const size = `${ra.info.width}×${ra.info.height} / ${rb.info.width}×${rb.info.height}`;
  const keep = async (name: string, png: Buffer) => {
    const path = test.info().outputPath(`${label}-${name}.png`);
    writeFileSync(path, png);
    await test.info().attach(`${label}-${name}.png`, { path, contentType: "image/png" });
  };
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) {
    await keep("public", a);
    await keep("preview", b);
    return { size, differing: -1 };
  }
  let differing = 0;
  const diff = Buffer.from(ra.data);
  for (let i = 0; i < ra.data.length; i += 4) {
    const same = ra.data[i] === rb.data[i] && ra.data[i + 1] === rb.data[i + 1] && ra.data[i + 2] === rb.data[i + 2];
    if (!same) differing++;
    // The diff picture: the public pixels faded, the differing ones red.
    if (same) for (let k = 0; k < 3; k++) diff[i + k] = 255 - Math.round((255 - ra.data[i + k]) * 0.25);
    else [diff[i], diff[i + 1], diff[i + 2]] = [230, 0, 0];
  }
  if (differing) {
    await keep("public", a);
    await keep("preview", b);
    await keep("diff", await sharp(diff, { raw: { width: ra.info.width, height: ra.info.height, channels: 4 } }).png().toBuffer());
  }
  return { size, differing };
}

test("a control: one changed word in a section's text is caught by the DOM, the text and the pixels", async ({ browser }) => {
  const prev = await session(browser, 1280, "light");
  const pub = await prev.context().newPage();
  const [row] = await queryTestDb<{ id: string; content: unknown }>(
    "SELECT t.section_id AS id, t.content FROM page_section_translations t JOIN page_sections s ON s.id = t.section_id WHERE s.page_id = ? AND s.block_type = 'about.overview' AND t.locale = 'en'",
    [ids.about],
  );
  const original = typeof row.content === "string" ? row.content : JSON.stringify(row.content);
  const changed = JSON.parse(original) as { title: string };
  changed.title = `${changed.title} Test`;
  await queryTestDb("UPDATE page_section_translations SET content = ? WHERE section_id = ? AND locale = 'en'", [JSON.stringify(changed), row.id]);
  try {
    await settle(pub, "/en/about");
    await settle(prev, `/admin/preview/page/${ids.about}?locale=en&theme=light`);
    const [a, b] = [await parts(pub, HIDDEN.about), await parts(prev, [])];
    const at = a.findIndex((p) => p.key === "overview");
    expect(b[at].text).not.toBe(a[at].text);
    expect(b[at].dom).not.toEqual(a[at].dom);
    expect(b[at].text).toContain("Test");
    await still(pub);
    await still(prev);
    const all = await pub.evaluate(() => [...document.querySelectorAll("main#main > :not(script, template)")].map((el) => el.id));
    const r = await pixelsAt(pub, prev, all.indexOf("overview"), at, "control-overview");
    expect(r.differing === -1 || r.differing > 0, r.size).toBe(true);
    // Every other part still matches (the change stays in its own part).
    for (const [i, part] of a.entries()) if (i !== at) expect(b[i].dom, part.key).toEqual(part.dom);
  } finally {
    await queryTestDb("UPDATE page_section_translations SET content = ? WHERE section_id = ? AND locale = 'en'", [original, row.id]);
  }
});
