/**
 * The release media baseline (A4 brief §11–§14, §19): what the 143 files of today's `public/media` are, derived from the
 * repository — never typed by hand — and written to `src/server/media/release-baseline.json`, which
 * `npm run media:import-release` reads.
 *
 *   node scripts/media-release-baseline.mjs --write    after `npm run build`: (re)generate the baseline
 *   node scripts/media-release-baseline.mjs --check    after `npm run build`: fail (exit 1) when it would change
 *
 * Per file (media registry, src/content/media.generated.ts): the legacy key and address, width, height and blur
 * placeholder (the registry's), byte size and SHA-256 (the file in public/), whether the built site uses it (any
 * prerendered page or page data names its address), and its alt text per language as the built pages give it — one
 * consistent value across every use (a description, or "" where every use is decorative), else null: never invented.
 * Held back (the 13 files the packaging script excludes, by the same rules: `withheldMedia`, the photos
 * `projectDetailMedia` leaves out, and HELD_BACK_MEDIA of scripts/package-namecheap.mjs): restricted, with flags only
 * from their documented reasons (docs/ASSET_INVENTORY.md items 3, 4 and 12; the project records' flags). Used and not
 * held back: approved (the baseline of the approved public site, not a rights claim). Otherwise: pending review.
 * Needs Node 22.18 or later (the content modules are TypeScript, read with Node's type stripping).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Node warns that the content modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src/server/media/release-baseline.json");
const mode = process.argv[2];
if (process.argv.length !== 3 || !["--write", "--check"].includes(mode)) {
  console.error("Usage: node scripts/media-release-baseline.mjs --write | --check   (after npm run build)");
  process.exit(2);
}

const { mediaRegistry } = await import("../src/content/media.generated.ts");
const { projects, projectDetailMedia, withheldMedia } = await import("../src/content/projects.ts");

const EXPECTED_COUNT = 143;
const ids = Object.keys(mediaRegistry).sort();
if (ids.length !== EXPECTED_COUNT) {
  console.error(`The media registry lists ${ids.length} files, not ${EXPECTED_COUNT}. STOP: report the difference before importing.`);
  process.exit(1);
}

// --- The held-back files, by the packaging script's own rules --------------------------------------------------------

const packaging = readFileSync(join(root, "scripts/package-namecheap.mjs"), "utf8");
const heldMatch = /const HELD_BACK_MEDIA = (\[[^\]]*\]);/.exec(packaging);
if (!heldMatch) {
  console.error("scripts/package-namecheap.mjs no longer declares HELD_BACK_MEDIA as expected. STOP.");
  process.exit(1);
}
const HELD_BACK_MEDIA = JSON.parse(heldMatch[1]);

/** Asset inventory item 12 (Laser Engraving): the documented reason of each file HELD_BACK_MEDIA names. */
const ITEM_12 = {
  "services/engraving-nameplates": {
    flags: ["third_party_branding", "contains_identifiers", "rights_pending"],
    note: "Asset inventory item 12: shows third-party (HITACHI) branding with legible part and serial numbers; RAWASY's permission is not confirmed. Held back (packaging script HELD_BACK_MEDIA).",
  },
  "services/engraving-wood": {
    flags: ["product_render"],
    note: "Asset inventory item 12: a render, not a photograph of RAWASY's work. Held back (packaging script HELD_BACK_MEDIA).",
  },
  "services/engraving-rotary": {
    flags: ["product_render"],
    note: "Asset inventory item 12: a render, not a photograph of RAWASY's work. Held back (packaging script HELD_BACK_MEDIA).",
  },
};

/** id → { flags, note } for every held-back file. */
const held = new Map();
const add = (id, flag, note) => {
  const entry = held.get(id) ?? { flags: [], notes: [] };
  if (!entry.flags.includes(flag)) entry.flags.push(flag);
  if (!entry.notes.includes(note)) entry.notes.push(note);
  held.set(id, entry);
};
for (const id of withheldMedia) {
  add(id, "ai_watermark", "Asset inventory item 3: the photo carries the mark Google Gemini adds to AI-generated or AI-edited images. Held back until RAWASY confirms it (projects.ts withheldMedia).");
}
for (const project of projects) {
  const shown = new Set(projectDetailMedia(project));
  for (const id of project.media) {
    if (shown.has(id) || withheldMedia.includes(id)) continue;
    const flags = project.flags ?? [];
    if (flags.includes("confirm-authorship")) {
      add(id, "authorship_unconfirmed", "Asset inventory item 3: the piece may be someone else's work; the project awaits RAWASY's confirmation of authorship (project flag confirm-authorship).");
    }
    if (flags.includes("render")) {
      add(id, "product_render", "Asset inventory item 4: a catalogue render, not a photograph of delivered work; the project awaits RAWASY's confirmation (project flag render).");
    }
    if (!flags.includes("confirm-authorship") && !flags.includes("render")) {
      console.error(`${id}: held back by a project flag without a documented media reason (${flags.join(", ")}). STOP: report it.`);
      process.exit(1);
    }
  }
}
for (const id of HELD_BACK_MEDIA) {
  const reason = ITEM_12[id];
  if (!reason) {
    console.error(`${id} is in HELD_BACK_MEDIA without a documented reason here. STOP: report it.`);
    process.exit(1);
  }
  for (const flag of reason.flags) add(id, flag, reason.note);
}
if (held.size !== 13) {
  console.error(`${held.size} held-back files, not 13. STOP: report the difference.`);
  process.exit(1);
}
for (const id of held.keys()) {
  if (!mediaRegistry[id]) {
    console.error(`${id} (held back) is not in the media registry. STOP.`);
    process.exit(1);
  }
}

// --- What the built site uses, and its alt texts ---------------------------------------------------------------------

const appDir = join(root, ".next/server/app");
if (!existsSync(appDir)) {
  console.error("No build in this folder: run `npm run build` first.");
  process.exit(2);
}
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = walk(appDir).filter((f) => /\.(html|rsc)$/.test(f) && !f.includes(`${appDir}/admin`) && !f.includes("/(admin)/"));
const bySrc = new Map(ids.map((id) => [mediaRegistry[id].src, id]));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const used = new Set();
const alts = new Map();
const addressPattern = /\/media\/[a-z0-9-]+\/[a-z0-9._-]+\.webp/g;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(addressPattern)) if (bySrc.has(match[0])) used.add(bySrc.get(match[0]));
  for (const match of text.matchAll(/url=(%2Fmedia%2F[A-Za-z0-9%._-]+)/g)) {
    try {
      const src = decodeURIComponent(match[1]);
      if (bySrc.has(src)) used.add(bySrc.get(src));
    } catch {
      // Not an address (a malformed escape): ignored.
    }
  }
  if (!file.endsWith(".html")) continue;
  const rel = file.slice(appDir.length + 1);
  const locale = /^ar(\.html$|\/)/.test(rel) ? "ar" : /^en(\.html$|\/)/.test(rel) ? "en" : null;
  if (!locale) continue;
  for (const tag of text.matchAll(/<img\b[^>]*>/g)) {
    const srcAttr = /\bsrc="([^"]+)"/.exec(tag[0]);
    if (!srcAttr) continue;
    let src = decode(srcAttr[1]);
    const proxied = /[?&]url=([^&]+)/.exec(src);
    if (proxied) src = decodeURIComponent(proxied[1]);
    const id = bySrc.get(src);
    if (!id) continue;
    const altAttr = /\balt="([^"]*)"/.exec(tag[0]);
    const entry = alts.get(id) ?? { en: new Set(), ar: new Set() };
    entry[locale].add(altAttr ? decode(altAttr[1]) : "\u0000missing");
    alts.set(id, entry);
  }
}

// --- The baseline -----------------------------------------------------------------------------------------------------

const items = ids.map((id) => {
  const reg = mediaRegistry[id];
  const path = join(root, "public", reg.src);
  if (!existsSync(path)) {
    console.error(`public${reg.src} (${id}) does not exist. STOP.`);
    process.exit(1);
  }
  const bytes = readFileSync(path);
  const altOf = (locale) => {
    const values = alts.get(id)?.[locale];
    if (!values || values.size !== 1) return null;
    const [value] = values;
    return value === "\u0000missing" ? null : value;
  };
  const h = held.get(id);
  const isUsed = used.has(id) && !h;
  return {
    legacyKey: id,
    src: reg.src,
    kind: "image",
    mime: "image/webp",
    width: reg.width,
    height: reg.height,
    blurDataUrl: reg.blurDataURL && reg.blurDataURL.length <= 600 ? reg.blurDataURL : null,
    byteSize: statSync(path).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    used: used.has(id),
    alt: { en: h ? null : altOf("en"), ar: h ? null : altOf("ar") },
    status: h ? "restricted" : isUsed ? "approved" : "pending_review",
    flags: h ? [...h.flags].sort() : [],
    note: h ? h.notes.join(" ") : null,
  };
});

const heldUsed = items.filter((i) => i.flags.length && i.used);
if (heldUsed.length) {
  console.error(`The built site uses held-back files: ${heldUsed.map((i) => i.legacyKey).join(", ")}. STOP.`);
  process.exit(1);
}

const baseline = {
  description:
    "Release media baseline (A4): generated by scripts/media-release-baseline.mjs from the media registry, the held-back rules and a build of the static site. Do not edit by hand.",
  count: items.length,
  items,
};
const json = `${JSON.stringify(baseline, null, 2)}\n`;
const summary = {
  files: items.length,
  approved: items.filter((i) => i.status === "approved").length,
  pending: items.filter((i) => i.status === "pending_review").length,
  restricted: items.filter((i) => i.status === "restricted").length,
  altText: items.filter((i) => i.alt.en && i.alt.ar).length,
  decorative: items.filter((i) => i.alt.en === "" && i.alt.ar === "").length,
  altMissing: items.filter((i) => i.status !== "restricted" && (i.alt.en === null || i.alt.ar === null)).length,
};
if (mode === "--write") {
  writeFileSync(OUT, json);
  console.log(`Wrote ${OUT.slice(root.length + 1)}:`, summary);
} else {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== json) {
    console.error("The release media baseline differs from what this build gives. Run --write after checking why (a changed file is a refresh: see the README).");
    process.exit(1);
  }
  console.log("Release media baseline OK:", summary);
}
