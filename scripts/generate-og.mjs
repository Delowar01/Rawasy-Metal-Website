/**
 * Renders the Open Graph share images (1200 × 630, public/og/og-en.png and og-ar.png) in the Modern Commerce design.
 *
 * Each card is drawn inside the website's own homepage, so it uses exactly what the site serves: its stylesheet and
 * dark-theme tokens, its self-hosted faces (Plus Jakarta Sans and Inter; Tajawal and IBM Plex Sans Arabic), the header's
 * logo and the hero's finished laser-cut plate. The words come from the content layer (the hero's eyebrow, location and
 * headline, the six service names); nothing is written here. No request leaves the site.
 *
 * Needs a production build being served, Playwright's Chromium and Node 22.18 or later (the content modules are
 * TypeScript, read with Node's type stripping):
 *   npm run build && npm start                     (in another terminal)
 *   node scripts/generate-og.mjs [http://localhost:3000]
 * --out=<folder> writes the two cards there instead of public/og (to review them first); --icon also renders
 * src/app/apple-icon.png from src/app/icon.svg.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { home } = await import("../src/content/home.ts");
const { services } = await import("../src/content/services.ts");

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? join(root, "public/og");
const W = 1200;
const H = 630;
/** Nothing the card says may come closer to its edges than this (platforms crop and round share images). */
const SAFE = 48;

const copy = (l) => ({
  eyebrow: `${home.hero.eyebrow[l]} · ${home.hero.location[l]}`,
  headline: home.hero.headline[l],
  services: services.map((s) => s.name[l]),
});

/** The card's layout. Colours, faces and components are the site's own (tokens on .mc, .eyebrow, .t-display). */
const STYLE = `
html, body { width: ${W}px; height: ${H}px; margin: 0; overflow: hidden; }
.og {
  position: relative; box-sizing: border-box; width: ${W}px; height: ${H}px; padding: 56px 64px;
  display: grid; grid-template-columns: minmax(0, 1fr) 468px; gap: 48px; align-items: stretch;
  background:
    radial-gradient(circle 384px at calc(100% - 192px) 120px, var(--amb-warm), transparent),
    radial-gradient(circle 432px at 168px calc(100% - 72px), var(--amb-cool), transparent),
    radial-gradient(circle 252px at 876px 466px, var(--amb-teal), transparent),
    radial-gradient(circle, var(--amb-dot) 1.15px, transparent 1.75px) 0 0 / 24px 24px,
    var(--bg);
  color: var(--ink);
}
[dir="rtl"] .og {
  background:
    radial-gradient(circle 384px at 192px 120px, var(--amb-warm), transparent),
    radial-gradient(circle 432px at calc(100% - 168px) calc(100% - 72px), var(--amb-cool), transparent),
    radial-gradient(circle 252px at calc(100% - 876px) 466px, var(--amb-teal), transparent),
    radial-gradient(circle, var(--amb-dot) 1.15px, transparent 1.75px) 0 0 / 24px 24px,
    var(--bg);
}
.og-text { display: flex; flex-direction: column; min-width: 0; }
.og-logo { display: block; height: 46px; width: auto; color: var(--ink); align-self: flex-start; }
.og-main { margin-block: auto; }
.og .t-display { margin: 26px 0 0; font-size: 64px; line-height: 1.04; text-wrap: nowrap; }
.og .t-display:lang(ar) { font-size: 56px; line-height: 1.32; }
.og-title span { display: block; }
.og-services {
  display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0; padding-top: 22px; border-top: 1px solid var(--line-strong);
  font-family: var(--ff-body); font-size: 17px; font-weight: 500; line-height: 1.55; color: var(--ink-2);
}
.og-services span { display: inline-flex; align-items: center; gap: 10px; white-space: nowrap; }
.og-services span::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--brand); }
.og-stage { display: flex; min-height: 0; }
.og-stage .a2-plate-stage { flex: 1 1 auto; }
.og-stage .a2-plate-area { height: auto; flex: 1 1 auto; }
/* Smaller than in the hero, so the plate's measurements stay inside the stage */
.og-stage .a2-plate-tilt { width: min(74cqw, calc(84cqh * 640 / 760)); }
`;

const browser = await chromium.launch();

async function card(l) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    // The page's markup holds the plate finished and every part shown; without the script nothing moves or waits.
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const outside = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(base) && !r.url().startsWith("data:")) outside.push(r.url());
  });
  const response = await page.goto(`${base}/${l}`, { waitUntil: "load" });
  if (!response?.ok()) throw new Error(`${base}/${l} answered ${response?.status()}: is the production build being served?`);

  await page.evaluate(
    ({ style, text }) => {
      const html = document.documentElement;
      html.setAttribute("data-theme", "dark");
      const logo = document.querySelector("header a svg");
      const stage = document.querySelector(".a2-hero .a2-plate-stage");
      if (!logo || !stage) throw new Error("the homepage's logo or hero plate was not found");
      const plate = stage.cloneNode(true);
      plate.querySelector(".a2-plate-bar")?.remove();
      const mark = logo.cloneNode(true);
      mark.removeAttribute("class");
      mark.setAttribute("class", "og-logo");

      const css = document.createElement("style");
      css.textContent = style;
      document.head.append(css);

      const og = document.createElement("main");
      og.className = "og";
      const column = document.createElement("div");
      column.className = "og-text";
      const middle = document.createElement("div");
      middle.className = "og-main";
      const eyebrow = document.createElement("p");
      eyebrow.className = "eyebrow";
      eyebrow.textContent = text.eyebrow;
      const title = document.createElement("h1");
      title.className = "t-display og-title";
      for (const line of text.headline) title.append(Object.assign(document.createElement("span"), { textContent: line }));
      middle.append(eyebrow, title);
      const list = document.createElement("p");
      list.className = "og-services";
      for (const name of text.services) list.append(Object.assign(document.createElement("span"), { textContent: name }));
      column.append(mark, middle, list);
      const aside = document.createElement("div");
      aside.className = "og-stage";
      aside.append(plate);
      og.append(column, aside);
      document.body.replaceChildren(og);
    },
    { style: STYLE, text: copy(l) },
  );

  // The faces the card draws with, and the plate's photograph, before the picture is taken.
  const check = await page.evaluate(async () => {
    const parts = [...document.querySelectorAll(".og-text .eyebrow, .og-title span, .og-services span")];
    // (a load also tries the faces' metric fallbacks, local(Arial), which a system without Arial rejects: what counts is
    // the check below)
    await Promise.all(parts.map((el) => document.fonts.load(fontOf(el), el.textContent).catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    function fontOf(el) {
      const s = getComputedStyle(el);
      return `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    }
    // A text is drawn in its family when every character of it is covered (unicode-range) by a loaded face of the
    // family at the weight the browser picks for it (CSS font matching: a 600 takes Tajawal's 700).
    const ranges = (face) =>
      face.unicodeRange.split(",").map((part) => {
        const [a, b = a] = part.trim().replace(/^U\+/i, "").split("-");
        return [parseInt(a.replace(/\?/g, "0"), 16), parseInt(b.replace(/\?/g, "f"), 16)];
      });
    const span = (face) => face.weight.split(" ").map(Number).concat(face.weight.includes(" ") ? [] : [Number(face.weight)]);
    const pick = (family, wanted) => {
      const faces = [...document.fonts].filter((f) => f.family.replace(/"/g, "") === family);
      if (faces.some((f) => span(f)[0] <= wanted && wanted <= span(f)[1])) return wanted;
      const weights = [...new Set(faces.map((f) => span(f)[0]))].sort((x, y) => x - y);
      const up = weights.filter((x) => x >= wanted);
      const down = weights.filter((x) => x < wanted).reverse();
      if (wanted > 500) return up[0] ?? down[0];
      if (wanted < 400) return down[0] ?? up[0];
      return up.find((x) => x <= 500) ?? down[0] ?? up[0];
    };
    const loaded = [...document.fonts].filter((f) => f.status === "loaded");
    const drawnIn = (family, weight, text) => {
      const w = pick(family, weight);
      const faces = loaded.filter((f) => f.family.replace(/"/g, "") === family && span(f)[0] <= w && w <= span(f)[1]);
      return [...text.replace(/\s/g, "")].every((c) => faces.some((f) => ranges(f).some(([x, y]) => c.codePointAt(0) >= x && c.codePointAt(0) <= y)));
    };
    const texts = parts.map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const boxes = [...range.getClientRects()].map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
      const style = getComputedStyle(el);
      const family = style.fontFamily.split(",")[0].replace(/"/g, "").trim();
      const weight = Number(style.fontWeight);
      const drawn = drawnIn(family, weight, el.textContent);
      return { text: el.textContent, family, weight, drawn, boxes };
    });
    const column = document.querySelector(".og-text").getBoundingClientRect();
    for (const t of texts) t.outside = t.boxes.some((b) => b.left < column.left - 0.1 || b.right > column.right + 0.1);
    const images = [...document.images].map((img) => ({ src: img.currentSrc, ok: img.complete && img.naturalWidth > 0 }));
    return { dir: document.documentElement.dir, lang: document.documentElement.lang, texts, images };
  });

  const problems = [];
  const families = l === "ar" ? ["Tajawal", "IBM Plex Sans Arabic"] : ["Plus Jakarta Sans", "Inter"];
  for (const t of check.texts) {
    if (!families.includes(t.family)) problems.push(`"${t.text}" is set in ${t.family}, not the site's ${families.join(" / ")}`);
    if (!t.drawn) problems.push(`"${t.text}": ${t.family} ${t.weight} has not loaded`);
    if (t.outside) problems.push(`"${t.text}" runs out of its column`);
    for (const b of t.boxes)
      if (b.left < SAFE - 0.1 || b.right > W - SAFE + 0.1 || b.top < SAFE - 0.1 || b.bottom > H - SAFE + 0.1)
        problems.push(`"${t.text}" leaves the safe area (${JSON.stringify(b)})`);
  }
  if (check.dir !== (l === "ar" ? "rtl" : "ltr")) problems.push(`the page's direction is ${check.dir}`);
  if (!check.images.length || check.images.some((i) => !i.ok)) problems.push(`the plate's photograph did not load: ${JSON.stringify(check.images)}`);
  if (outside.length) problems.push(`requests outside the site: ${outside.join(", ")}`);
  if (problems.length) throw new Error(`og-${l}.png not written:\n  ${problems.join("\n  ")}`);

  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: join(out, `og-${l}.png`) });
  const faces = [...new Set(check.texts.map((t) => `${t.family} ${t.weight}`))];
  console.log(`og-${l}.png  ${W} × ${H}  lang=${check.lang} dir=${check.dir}  ${faces.join(", ")}`);
  await context.close();
}

for (const l of ["en", "ar"]) await card(l);

if (args.includes("--icon")) {
  const mark = readFileSync(join(root, "src/app/icon.svg"), "utf8");
  const p = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await p.setContent(`<style>*{margin:0}svg{width:180px;height:180px;display:block}</style>${mark.replace('rx="14"', 'rx="0"')}`);
  await p.screenshot({ path: join(root, "src/app/apple-icon.png") });
  console.log("apple-icon.png  180 × 180");
}
await browser.close();
