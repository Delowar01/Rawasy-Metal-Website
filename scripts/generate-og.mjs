/**
 * Renders the Open Graph share images (1200×630, EN + AR) and the Apple touch
 * icon from an HTML template, so Arabic is shaped correctly and brand fonts
 * are used. Requires Playwright + Chromium:
 *   npx playwright --version  (or: npm i -D playwright)
 *   node scripts/generate-og.mjs
 * Behind an HTTPS proxy: NODE_USE_ENV_PROXY=1 node scripts/generate-og.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = readFileSync(join(root, "public/brand/rawasy-logo-on-dark.svg"), "utf8");
const mark = readFileSync(join(root, "src/app/icon.svg"), "utf8");
const photo = `data:image/webp;base64,${readFileSync(join(root, "public/media/site/laser-sparks.webp")).toString("base64")}`;

function star(cx, cy, R) {
  const r = (R * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8);
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 8;
    const rad = k % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

const copy = {
  en: {
    dir: "ltr",
    headline: "Engineering<br/>metal into<br/>possibility<em>.</em>",
    services: "Laser Cutting · CNC Bending · Steel Structures · Fabrication · Engraving · Scaffolding",
    place: "Riyadh · Saudi Arabia",
  },
  ar: {
    dir: "rtl",
    headline: "نُشكّل المعدن بدقة هندسية<br/>ونصنع الممكن<em>.</em>",
    services: "قص بالليزر · ثني CNC · هياكل حديدية · تصنيع معدني · حفر بالليزر · سقالات",
    place: "الرياض · المملكة العربية السعودية",
  },
};

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Sans+Arabic:wght@500;700&family=Geist+Mono:wght@500&display=block";

/**
 * Fetch the Google Fonts CSS in Node and inline the latin + arabic subsets as
 * data URLs, so rendering never depends on the browser's network stack.
 * (Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1.)
 */
async function inlineFonts() {
  const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
  const css = await (await fetch(FONTS_URL, { headers: { "user-agent": ua } })).text();
  const blocks = css.split("/* ").filter((b) => /^(latin|arabic) \*\//.test(b));
  let out = blocks.map((b) => b.replace(/^[a-z-]+ \*\/\s*/, "")).join("\n");
  for (const url of new Set([...out.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))) {
    const data = Buffer.from(await (await fetch(url)).arrayBuffer()).toString("base64");
    out = out.replaceAll(url, `data:font/woff2;base64,${data}`);
  }
  if (!out.includes("@font-face")) throw new Error("Could not load brand fonts from Google Fonts");
  return out;
}

const fontCss = await inlineFonts();

const page = (l) => `<!doctype html><html lang="${l}" dir="${copy[l].dir}"><head><meta charset="utf-8"/>
<style>${fontCss}

*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#17191a;color:#eceae5;overflow:hidden;position:relative;
font-family:${l === "ar" ? "'IBM Plex Sans Arabic'" : "Archivo"},sans-serif}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(236,234,229,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(236,234,229,.05) 1px,transparent 1px);background-size:60px 60px}
.logo{position:absolute;top:64px;inset-inline-start:72px;width:230px}
.logo svg{width:100%;height:auto}
h1{position:absolute;inset-inline-start:72px;bottom:150px;font-weight:${l === "ar" ? 700 : 640};
font-size:${l === "ar" ? 64 : 70}px;line-height:${l === "ar" ? 1.3 : 0.98};letter-spacing:${l === "ar" ? 0 : "-0.035em"};
${l === "ar" ? "" : "text-transform:uppercase;font-variation-settings:'wdth' 112;"}max-width:720px}
h1 em{font-style:normal;color:#f15f22}
.meta{position:absolute;inset-inline:72px;bottom:64px;display:flex;justify-content:space-between;gap:32px;white-space:nowrap;
font-family:'Geist Mono',monospace;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#a8a6a1}
.ar .meta{font-family:'IBM Plex Sans Arabic';letter-spacing:0;font-size:18px}
.rule{position:absolute;inset-inline:72px;bottom:112px;height:1px;background:rgba(236,234,229,.14)}
.rule::before{content:"";position:absolute;inset-inline-start:0;top:0;height:1px;width:96px;background:#f15f22}
.plate{position:absolute;top:70px;inset-inline-end:64px;width:330px;height:390px}
</style></head><body class="${l}"><div class="grid"></div>
<div class="logo">${logo}</div>
<svg class="plate" viewBox="0 0 330 390">
<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b3d3e"/><stop offset=".45" stop-color="#2a2c2d"/><stop offset="1" stop-color="#222425"/></linearGradient>
<clipPath id="s"><path d="${star(165, 170, 104)}"/></clipPath>
<mask id="cut"><rect width="330" height="390" fill="#fff"/><path d="${star(165, 170, 104)}" fill="#000"/>
<circle cx="40" cy="40" r="8" fill="#000"/><circle cx="290" cy="40" r="8" fill="#000"/><circle cx="40" cy="350" r="8" fill="#000"/><circle cx="290" cy="350" r="8" fill="#000"/>
<rect x="95" y="300" width="140" height="18" rx="9" fill="#000"/></mask></defs>
<g clip-path="url(#s)"><image href="${photo}" x="30" y="40" width="270" height="270" preserveAspectRatio="xMidYMid slice"/></g>
<rect x="95" y="300" width="140" height="18" rx="9" fill="#f15f22" opacity=".55"/>
<polygon points="0,0 300,0 330,30 330,390 0,390" fill="url(#m)" mask="url(#cut)"/>
<polygon points="0,0 300,0 330,30 330,390 0,390" fill="none" stroke="rgba(236,234,229,.25)"/>
<path d="${star(165, 170, 104)}" fill="none" stroke="#f15f22" stroke-width="1.5"/>
</svg>
<h1>${copy[l].headline}</h1><div class="rule"></div>
<div class="meta"><span>${copy[l].services}</span><span>${copy[l].place}</span></div>
</body></html>`;

const browser = await chromium.launch();
mkdirSync(join(root, "public/og"), { recursive: true });
for (const l of ["en", "ar"]) {
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(page(l), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const loaded = await p.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  if (!loaded.length) throw new Error("Brand fonts did not load — check network access to fonts.googleapis.com");
  await p.screenshot({ path: join(root, `public/og/og-${l}.png`) });
  await p.close();
}
const p = await browser.newPage({ viewport: { width: 180, height: 180 } });
await p.setContent(`<style>*{margin:0}svg{width:180px;height:180px;display:block}</style>${mark.replace('rx="14"', 'rx="0"')}`);
await p.screenshot({ path: join(root, "src/app/apple-icon.png") });
await browser.close();
console.log("OG images + apple icon written");
