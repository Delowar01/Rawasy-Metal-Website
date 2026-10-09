# Stage 1J — Release candidate: security, accessibility, SEO, performance and publication QA

Date: 2026-10-09 (begun 2026-10-08) · Branch: `claude/new-session-5eijs6` · Status: **release candidate ready for independent approval**
(not approved by the builder; **not deployed**: no hosting, DNS, tunnel or external publication; the pages are marked
`published` in code only).

## Summary

Stage 1J closes Phase 1's public website as a release candidate, in separate commits from the checkpoint
`preserve/pre-stage-1j` (`f69e2fa`):

- **Security:** Next.js 16.3.6 → **16.3.8** (patch, exact pin, its own commit `f299bb9`): the six Next.js advisories are
  fixed and `npm audit --omit=dev` reports **0 vulnerabilities**. The full audit still lists 5 high entries in the
  development-only lint chain (`braces` via `eslint-config-next`), whose only offered fix is a breaking downgrade with
  `--force` (not run). The served build is identical to 16.3.6's apart from the framework's own runtime.
- **Forced colours:** the Projects filter toggles' focus ring takes the system focus colour (`86bb8ac`): 2.02:1 → 11.31:1
  / 8.73:1.
- **Arabic layout shift:** the Arabic faces are preloaded on Arabic pages only (`ffd8c93`): fresh-cache CLS on Arabic
  pages 0.0458 / 0.0325 / 0.262 → **0**; English pages keep their two Latin preloads and nothing more.
- **View transitions** (final check, §14): all three animated page updates passed words below AA mid-way (the theme
  switch about 1:1, the cross-document fade on every page change, cards joining the gallery). Fixed in the smallest scope
  (`7abd622`): the theme changes at once, pages replace each other without a fade, joining/leaving cards show/go whole
  while staying cards still glide.
- **Theme Lab retired** (`e5b89b0`) and dead strings/exports removed with a usage proof (`0eefcd8`).
- **Share images** regenerated in the Modern Commerce design from the built site (`1158a5e`).
- **Publication** (`caf01fb`, its own commit): every route `review` → `published`; the sitemap lists **102** URLs.
- **Documentation:** README (Windows commands, tested Node), `.nvmrc`, `engines`, `.env.example` (`65e6eed`).
- **Found by this stage's QA and fixed:** keyboard focus inside rows that scroll sideways could rest on an item whose
  name was off screen (`bfda6b0`, item 37); the project pages' wrapped related-service links were too close to tap
  (WCAG 2.5.8 target spacing, `ace4bed`, item 33).

QA on the release candidate, in short:

- A fresh clone ran `npm ci`, lint, typecheck, build, the full E2E suite and `npm start`, and all passed (items 43,
  47–50): lint and typecheck clean, 109 pages built with no warning, **612 / 612** E2E tests (0 failed, 0 skipped,
  0 flaky) and 20 / 20 `npm start` checks.
- axe: **0 violations** on all 102 pages and both 404s (194 runs) and in 40 interactive states, with JavaScript.
- HTTP matrix: 154 requests, 0 server errors, 0 redirect loops.
- Layout: the responsive matrix (720 loads) and the reflow sweep (416 loads) found 0 issues.
- Keyboard: 3,002 Tab stops and 88 real journeys, none hidden under the sticky header.
- Performance: CLS ≤ 0.0012; LCP ≤ 1.19 s on desktop and ≤ 2.32 s on a throttled phone; scrolling ≥ 58.4 fps.
- Images: drawn at ≤ 1.00× of source size everywhere except the frozen homepage's cards (item 41, for the user to decide).

Each check ran on the build that was current when it was taken:

| Build | Checks |
| --- | --- |
| `caf01fb` (publication) | metadata (item 17), structured data (18), the HTTP matrix (32) |
| `bfda6b0` (keyboard fix) | performance (16, 40), image ratios (41), EN/AR parity (39), the Tab walk and journeys (§15, 37), full E2E 611 / 611 |
| `ace4bed` (final code) | axe (33), the responsive matrix (38), the text-only performance rows (16), the evidence (53) |
| `e1f85f0` (fresh clone) | lint, typecheck, build, full E2E and `npm start` (43, 47–50); the reflow sweep re-run (§17) |

The fresh clone builds the same output as `ace4bed` (item 43). Between these builds, `bfda6b0` changed one JS chunk and
`ace4bed` changed one CSS rule on the project pages. Every prerendered page and payload is otherwise identical (the
changed files' names aside), so the earlier results carry over.

## Findings answered outside the numbered items (§13–§17)

### §13 Motion regression (Stage 1I locked)

`e2e/commerce-motion-contrast.spec.ts` — **73 / 73** after the font and framework changes (on `86bb8ac`), again with the
transition fix (213 / 213 related specs on `7abd622`) and in the full runs (item 50). Corrections 1–3 are untouched:
no text opacity and no colour blend came back.

### §14 View transitions — final check: fixed in the smallest scope

Measured with held frames (each transition paused at fixed times; ink of each text against its background, median per
text box) on the build before the fix (`86bb8ac`):

| Transition | What happened | Measured |
| --- | --- | --- |
| Theme switch (same-document, the browser's default 250 ms root cross-fade) | every word passed through its own background | **1.00–1.12:1 at 75–100 ms** for every text (43 / 43 desktop, 24–29 / 24–29 in the phone sheet), EN/AR × both directions × 1440 / 390 |
| EN ⇄ AR and every other same-origin navigation (`@view-transition { navigation: auto }`, 250 ms) | the new page's words faded in over the old page's words fading out | new words 1.00:1 at 0 ms, ~2–3:1 at 100–125 ms (light), ~3–3.6:1 (dark); 41–43 of 43 texts below AA through 75 ms; phones the same |
| Projects filter re-flow (450 ms, named elements) | cards the choice brought in faded in | their picture at opacity 0 / 0.44 / 0.72 / 0.87 / 0.94 at 0 / 50 / 100 / 150 / 200 ms; captions below AA until ~150–200 ms |

All three are "unreadable transient text / obvious contrast failure" under §14, so each was fixed in the smallest scope
(`7abd622`): `ThemeSwitch` applies the theme at once (it already did with reduced motion); `commerce.css` no longer opts
into cross-document transitions (a new page replaces the last one); during a gallery choice the cards it brings in show
whole at once and the cards it leaves out go at once, while the cards that stay still glide to their places (the
approved re-flow). No flashing, the direction switch is a plain page load in the other language, and reduced motion
still disables everything (it already did). `e2e/commerce-transitions.spec.ts` (12): 12 / 12 on the fix, 11 / 12 fail
on `86bb8ac` for the intended reasons (the reduced-motion test passes on both).

### §15 Homepage capability strip / sticky header

The correction 2 finding was axe's `target-size` "partially obscured" on three capability-strip links at one artificial
phone scroll position, where the strip passes under the sticky header — normal sticky-header scrolling, not focus. Real
journeys on the release build:

- **Tab** through 14 pages at 1440, 390, 320 and 640 × 360 (200 % zoom): 3,002 stops — at 1440 and 390 px none under the
  header; at 320 px and 200 % zoom none hidden, and the only stops partly under the header are items taller than the
  visible area (item 37). The homepage's capability-strip links are never covered when focused (0 of their stops at any
  size).
- **Direct navigation** to 10 addresses with anchors (`/en/contact#quote`, `/ar/projects#clock-tower-landmark`,
  `/en/capabilities#fiber-laser-6kw`, `/en#machinery`, `/ar#projects` …) then 8 Tabs; **normal scrolling** (mouse
  wheel to mid-page) then 8 Tabs and 8 Shift+Tabs on 5 pages; **a link followed from mid-page, Back, then 8 Tabs** on 2
  pages — at the same 4 sizes (**zoom** included): 88 journeys, 688 stops, none hidden, none with its label hidden; the
  only partly covered stops are the homepage's 416 px project cards in a 360 px window (200 % zoom), after `/ar#projects`.
- The browser scrolls a focused element clear of the header (the page's `scroll-padding-top` is the header plus 1 rem),
  so no focusable link receives focus materially hidden under the sticky header. Nothing changed in the header; axe is
  not suppressed anywhere (its `target-size` rule runs in every audit of item 33).

### §16 No-JS 404: documented, not faked

A 404 from a dynamic render (the catch-all and unknown service / project slugs) answers **HTTP 404** with Next.js's
error shell (`<html id="__next_error__">`, the localized `<title>` — "Page not found | RAWASY" / "الصفحة غير موجودة |
رواسي" — and `noindex`); with JavaScript the Modern Commerce 404 is then built in the browser from the inlined page data,
so without JavaScript its body is empty. Cause (in Next 16.3.8, `app-render.js`): React's server renderer cannot render
an error boundary, so `notFound()` thrown during the page's render escapes the shell and Next renders the error document
with status 404. A proxy rewrite to a prerendered localized 404 page cannot carry a status (Next's `resolve-routes`
passes a status only for redirects, not for `x-middleware-rewrite`), so it would answer **200** — forbidden ("Do not
fake a 200 response"). The only status-preserving alternative the Next docs leave (`not-found.md`: decide before
streaming) is for the proxy itself to recognise every unknown address and answer it with a 404 body — duplicating the
route table (102 pages, the 34 project and 6 service slugs, the assets) in the proxy and serving page HTML from it: a
disproportionate routing change for a no-JavaScript-only case. Left as documented since TM-2.1: real 404, `noindex`,
localized title, the full Modern Commerce 404 with JavaScript.

### §17 320 CSS px and 200 % zoom

Every page (102 + the two localized 404s) at **320 × 700** (a phone) and **640 × 360** (a 1280 × 720 window at 200 %
zoom), 208 loads each check:

- **No horizontal overflow:** page `scrollWidth` = viewport on all 208; no visible text past the screen's sides (text
  inside a deliberately sideways-scrolling row excluded; visually hidden text — the narrow Contact rows' action word in a
  1 px clipped box, `.sr-only` — skipped after it was first flagged and verified as not drawn); one `h1` shown; the header
  inside the screen; status 200 (404 for the two unknown addresses).
- **Navigation reachable:** the menu button shown whole on every page; the menu sheet opens and **every row in it (21 per sheet with the Services list
  opened; 4,368 row checks) scrolls into view inside the screen and clear of the sheet's foot**; its quote
  button shown whole; Escape closes it and returns focus to the menu button.
- **No clipped primary action:** the header's quote action and **every action in the page** (buttons, the closing
  panels' links, the form's submit; 1,136 action checks) inside the screen's sides, words inside the box, not cut off by
  a clipping ancestor.
- Result: **0 issues** in 208 + 208 loads. Console: nothing but each 404 page reporting its own intended 404 status.
- Keyboard at these sizes: item 37 (the sideways rows' fix applies at 320 px and 200 % zoom).

Below the boundary (documented separately, unchanged, not a target): under 320 CSS px — a phone at 200 % page zoom, or
doubled text on a phone — the header's controls overflow (pre-existing since TM-3; outside the WCAG 1.4.10 reflow
target of 320 CSS px). The sweeps first ran on the publication build (`caf01fb`). They were repeated on the final
build, served by the fresh clone's `npm start` (item 43), with the same result: 208 + 208 loads, 0 issues, 4,368 sheet
rows and 1,136 actions checked.

## Report items

### 1. `preserve/pre-stage-1j`

GitHub branch `preserve/pre-stage-1j` → **`f69e2facae3d2541daa55ff20aa75cc8631ec804`** (created new, no force push; the
last commit before Stage 1J, the Stage 1I correction 3 report).

### 2. Starting SHA

**`f69e2fa`** (`f69e2facae3d2541daa55ff20aa75cc8631ec804`): `claude/new-session-5eijs6` at the start, equal to the
checkpoint. Working tree clean.

### 3. Next 16.3.8 security commit

**`f299bb9`** — "Patch Next.js 16.3.6 → 16.3.8 (security release)". `package.json`'s `"next"` line and exactly 10
lockfile entries (`next`, `@next/env`, the eight `@next/swc-*`), each 16.3.6 → 16.3.8; nothing added or removed. React
19.2.8, `sharp` 0.35.5, `source-map-js` 1.2.2 and `eslint-config-next` 16.3.6 unchanged. Fixes GHSA-cjq9-62q9-8jv4 (high:
SSRF in Image Optimization), GHSA-4jqv-mc3x-m676 and GHSA-mcj8-r9mp-w47p (SSG/ISR cache poisoning), GHSA-f87g-xv8r-7p7x,
GHSA-3w37-wq28-93x7 and GHSA-39w2-rjm5-chcv. No jump to 16.4.x; no `npm audit fix --force`.

### 4. Forced-colours focus fix commit

**`86bb8ac`** — the Projects filter toggles draw their own system colours in forced colours (`forced-color-adjust:
none`), which also kept the site's `--focus` as their ring: **2.02:1** against a light palette's page colour with the
site's dark theme (3.05:1 dark palette / light theme). One rule in the existing forced-colours block gives the ring
`Highlight`: **11.31:1** (light palette) and **8.73:1** (dark palette) in all four palette/theme pairings, EN/AR, bar and
hero toggles, plain and pressed, 1440 and 390. Pressed state, normal colours and layout unchanged. Test:
`commerce-projects.spec.ts` "category toggles in forced colours" (4 pairings × EN/AR, keyboard only, the ring measured
per pixel); its scroll timing was hardened in test-only `65a9df4` (failed 1 in 16 under load before, 40 of 40 after).

### 5. Arabic font / CLS commit

**`ffd8c93`** — "Preload the Arabic faces on Arabic pages only (Arabic CLS)"; test-only follow-up `4da97d5` (the site
spec's preload count). See items 15 and 16.

### 6. SEO / publication commit

**`caf01fb`** — "Publish every page: review -> published (Stage 1J)". `src/lib/page-meta.ts` is the only source change;
the specs that asserted `review` now assert `published`, and `site.spec.ts` checks the sitemap's exact inventory, its
alternates, a 200 for every URL and robots.txt. The metadata and structured-data audits (items 17–18) needed no source
change.

### 7. Theme Lab retirement commit

**`e5b89b0`** — "Retire the theme lab (Stage 1J)"; the dead-code removal that followed is **`0eefcd8`**; test-only
follow-up **`db5740f`** (the header's scrolled / past-hero check kept from the lab spec). See items 23–24.

### 8. OG commit

**`1158a5e`** — "Regenerate the share images in the Modern Commerce design (Stage 1J)". See item 22.

### 9. Final release-candidate SHA

The release candidate is the head of `claude/new-session-5eijs6` after this stage: the last of the documentation
commits on top of **`e1f85f0`**. A commit cannot name its own hash, so the hand-off message gives it (`git log -1`).

- `e1f85f0` is the tree the fresh clone tested (item 43).
- The commits after it change documentation only. They write the fresh-clone results into this report (and one
  status sentence into `CLAUDE.md`), rename the report from `2026-10-08-…` to its completion date, `2026-10-09-…` (as
  the brief asks), and update the two references to its name in `README.md` and `CLAUDE.md`.
- The last code change is **`ace4bed`**; `e1f85f0` and everything after it change documentation only.

### 10. Files changed

`f69e2fa` → the final commit: **107 files** (24 added, 40 modified, 42 deleted, 1 renamed; 2,801 lines inserted, 12,582 deleted):

| Area | Added | Modified | Deleted / renamed |
| --- | --- | --- | --- |
| Theme Lab: `src/app/theme-lab/**`, `src/components/theme-lab/**`, `e2e/theme-lab.spec.ts` | — | — | 42 deleted |
| `src/fonts`: 14 Arabic `woff2` files, `arabic.css`, `woff2.d.ts`, two OFL licences | 18 | — | — |
| Other `src` files: root layout, `fonts.ts`, `commerce.css`, `system.css`, `projects.css`, `project-detail.css`, `Motion.tsx`, `ThemeSwitch.tsx`, `Icon.tsx`, `ui.tsx`, `Ambient.tsx`, `Logo.tsx`, the three geometry modules, `navigation.ts`, `config.ts`, `dictionaries.ts`, `routes.ts`, `page-meta.ts`, `proxy.ts`, the fallback 404's fonts | — | 22 | — |
| `e2e`: new `commerce-fonts`, `commerce-keyboard`, `commerce-transitions`; `theme-lab-a-v2` renamed `commerce-home-depth` | 3 | 9 | 1 renamed |
| `public/og`: the two share images | — | 2 | — |
| `scripts/generate-og.mjs` | — | 1 | — |
| Root config: `package.json`, `package-lock.json`, `.gitignore`; new `.nvmrc`, `.env.example` | 2 | 3 | — |
| Documentation: `README.md`, `CLAUDE.md`, `docs/ASSET_INVENTORY.md`; new: this report | 1 | 3 | — |

`git diff --stat f69e2fa` reproduces this. Each 1J commit holds one concern (items 3–8, 37).

**Source hygiene (§47):** the tracked tree (393 files) was checked for the brief's list:

- No QA script outside the test tooling: `scripts/` holds the asset extractor and the OG generator, both documented.
- No captures or proof folders: `docs/` holds Markdown only, and the evidence lives outside the repository.
- No server, tunnel or `.vercel` file. No `.next`, `node_modules`, test results or logs (all ignored by `.gitignore`).
- No secret: the tree was searched for key, token and password assignments and for private keys.
- No `console.log` or `debugger` in `src`, and no commented-out implementation.
- No focused or skipped test, except one conditional skip for runs against an external server (`site.spec.ts` reads
  this checkout's build output).
- Nothing useful was deleted: the lab spec's production checks moved to `commerce-home-depth.spec.ts` (item 23).

### 11. Dependency versions

| Package | Range in `package.json` | Installed (lockfile) | Change in 1J |
| --- | --- | --- | --- |
| next | 16.3.8 | 16.3.8 | 16.3.6 → 16.3.8 |
| @next/env, @next/swc-* (8) | (from next) | 16.3.8 | 16.3.6 → 16.3.8 |
| react / react-dom | 19.2.8 | 19.2.8 | — |
| sharp | (from next) | 0.35.5 | — |
| source-map-js | (from postcss) | 1.2.2 | — |
| tailwindcss / @tailwindcss/postcss | ^4 | 4.3.3 | — |
| typescript | ^5 | 5.9.3 | — |
| eslint / eslint-config-next | ^9 / 16.3.6 | 9.39.5 / 16.3.6 | — |
| @playwright/test (playwright-core) | 1.56.1 | 1.56.1 | — |
| axe-core | 4.13.0 | 4.13.0 | — |
| @types/node / @types/react(-dom) | ^20 / ^19 | 20.19.43 / 19.3.0 | — |

Since the checkpoint the lockfile differs in exactly those 10 `version` lines (and their `resolved` / `integrity`). Node
**22.22.2**, npm **10.9.7** (item 44).

### 12. `npm audit`

Exit 1: **5 high**, all one development-only chain: `braces` (GHSA-vfj7-8cjw-p6xm, stack exhaustion on deeply nested
patterns; every version affected) ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ← `eslint-config-next`. The
only offered fix is `npm audit fix --force`, which would install `eslint-config-next@14.2.35` (a breaking downgrade of the
lint config); not run (the brief forbids `--force`). Nothing of this chain reaches the served site: it runs only in
`npm run lint`.

### 13. `npm audit --omit=dev`

Exit 0: **found 0 vulnerabilities** (on `f299bb9`, again on the release candidate, and in the fresh clone, item 43).

### 14. Next patch regression (16.3.6 vs 16.3.8)

Both built from clean trees (`f69e2fa` in a worktree; `f299bb9`), compared file by file:

- **HTML:** 120 prerendered pages: 118 identical after normalising build ids and `/_next/static` paths, 2 (`/en/about`,
  `/ar/about`) differ only in the position of Next's `next-size-adjust` meta (a known build-to-build noise).
- **Page data:** 120 `.rsc` + 441 segment payloads identical; 5 route bodies identical.
- **CSS:** 13 of 13 stylesheets byte-identical (394,549 B). **Fonts:** 50 of 50 identical. **Media:** identical.
- **JS:** 22 of 25 chunks identical; 3 differ only by the framework: `window.next.version`, the router chunk (+236 B, the
  new `selectAppPageEntry`) and the Turbopack runtime (chunk names, local renames). Total 924,473 → 924,709 B.
- **Build metadata:** `.meta` files gained 16.3.8's `routeCache` key; server page bundles differ (framework).
- **HTTP:** 158 requests (pages, redirects, 404s, files, the image optimizer's rejections) identical in status, headers
  that matter and normalised bodies; statuses 200 ×113, 307 ×14, 308 ×2, 400 ×13, 404 ×16.
- **Image optimizer:** with empty image caches on both, all **1,807** `/_next/image` URLs the 120 pages reference answer
  200 `image/webp`, **byte-identical** between versions; 133 direct `/media` URLs identical. It rejects remote,
  protocol-relative, self-absolute, recursive and non-image URLs and bad `w`/`q` with 400, as before.
- **Browser:** 23 pages × light/dark × 1440/390 + no-JS + 8 cold anchors × 2 widths: titles, `h1`, `lang`/`dir`,
  hydration, statuses and consoles identical; 0 page errors; anchors at the scroll padding (88 px; 144 px under the
  projects bar). Pixel differences were run-to-run noise (3 screens re-run 8× each showed both renderings on both
  versions).
- **Server logs:** identical (only the 4 deliberate invalid-image requests logged).
- Full e2e on `f299bb9`: **606 / 606** passed.

### 15. Arabic font architecture

Problem: `next/font` preloads a face on every page of the layout that loads it, keyed by route file; both languages
share one root layout and every route file, so it could not preload by language (the Arabic faces were not preloaded and
swapped in while the hero was visible).

Now (`ffd8c93`):

- The **Latin faces** (Plus Jakarta Sans, Inter) stay on `next/font` and are preloaded on every page (2 files) — English
  pages load nothing more.
- The **Arabic faces** (Tajawal 500/700/800, IBM Plex Sans Arabic 400/500) are declared in `src/fonts/arabic.css` with
  the 14 files `next/font` itself downloaded, **byte for byte**, and the rules it generated (same families, weights,
  subsets, unicode ranges, `font-display: swap`, size-adjusted Arial fallbacks). Turbopack serves them from
  `/_next/static/media` under content hashes; licences `src/fonts/OFL-*.txt`. No runtime request to Google.
- The root layout preloads, with React's `preload()` (the same link `next/font` writes), the **8 files every Arabic page
  draws first** — Tajawal 700/800 and Plex 400/500, Arabic and Latin ranges — **on Arabic pages only** (counted on 21 page
  types × 5 widths: 1440, 1024, 834, 390, 320). Tajawal 500 is not on every first screen, so it still loads on demand
  (an unused preload is wasted and warns).
- Same URLs, routes, metadata and layouts; no fixed heights, hidden text, opacity, delayed rendering or skeletons;
  Arabic is still never letter-spaced. Census: the same face files per page as before (210 / 210 loads).
- Tests: `e2e/commerce-fonts.spec.ts` (7): the preloads per language, the files' hashes and that they are served and used,
  the layout shift. On the build before, 3 fail (preloads, hashes/served, CLS at 1440).

### 16. FCP / LCP / CLS

Arabic CLS (fresh cache, local, before → after `ffd8c93`): `/ar` 0.0458 → 0, `/ar/about` 0.0325 → 0,
`/ar/services/steel-structures` 0.262 → 0 (every one of 5 rounds), others ≤ 0.0045 → 0 (max 0.0001, Capabilities at
1440). FCP at 1440 fell: `/ar` 460 → 388 ms, About 444 → 324, Services 360 → 252, Steel Structures 368 → 288,
Capabilities 416 → 296, Projects 392 → 348; at 390: `/ar` 392 → 260, About 312 → 208, Services 264 → 176.

Release build (fresh context, cache disabled, local server; see item 40 for the method and the full comparison):

| Page | Desktop FCP / LCP / CLS | Phone FCP / LCP / CLS | Phone, throttled (1.6 Mbit/s, 150 ms, 4× CPU): FCP / LCP / CLS |
| --- | --- | --- | --- |
| `/en` | 332 / 332 ms / 0 | 224 / 224 ms / 0 | 1,868 / 1,868 ms / 0 |
| `/ar` | 296 / 296 ms / 0 | 228 / 228 ms / 0 | 2,320 / 2,320 ms / 0 |
| `/en/about` | 276 / 1,188 ms / 0 | 184 / 184 ms / 0 | 1,592 / 1,592 ms / 0 |
| `/ar/about` | 268 / 268 ms / 0 | 184 / 184 ms / 0 | 2,172 / 2,172 ms / 0 |
| `/en/services` | 200 / 1,040 ms / 0 | 148 / 148 ms / 0 | — |
| `/en/services/laser-cutting` | 408 / 408 ms / 0 | 192 / 192 ms / 0 | 1,572 / 1,572 ms / 0 |
| `/ar/services/laser-cutting` | 268 / 268 ms / 0 | 192 / 192 ms / 0 | 2,016 / 2,016 ms / 0 |
| `/en/capabilities` | 292 / 292 ms / 0 | 180 / 180 ms / 0 | 1,456 / 1,456 ms / 0 |
| `/ar/capabilities` | 232 / 232 ms / 0.0001 | 208 / 208 ms / 0 | 1,880 / 1,880 ms / 0 |
| `/en/projects` | 296 / 296 ms / 0 | 240 / 240 ms / 0 | 1,708 / 1,708 ms / 0 |
| `/en/projects/clock-tower-landmark` (media-rich) | 204 / 204 ms / 0 | 128 ms / — / 0 | 1,120 / 1,136 ms / 0 |
| `/en/projects/billboard-support-structure` (text-only) | 208 / 208 ms / 0 | 132 / 132 ms / 0 | 1,096 / 1,096 ms / 0 |
| `/ar/projects/billboard-support-structure` (text-only) | 176 / 176 ms / 0.0012 | 132 / 132 ms / 0 | 1,516 / 1,516 ms / 0 |
| `/en/certificates` | 196 / 196 ms / 0 | 144 / 144 ms / 0 | — |
| `/en/contact` | 292 / 292 ms / 0 | 152 / 152 ms / 0 | 1,192 / 1,192 ms / 0 |
| `/ar/contact` | 324 / 324 ms / 0.0001 | 156 / 156 ms / 0 | 1,692 / 1,692 ms / 0 |

Worst values over all 62 loads: desktop LCP 1,188 ms (`/en/about`: its largest paint is the lead under the hero, which
keeps its reveal — documented since TM-3), CLS 0.0012; phone LCP 240 ms, CLS 0; throttled phone LCP 2,320 ms (`/ar`),
CLS 0. All under the targets (CLS < 0.1, LCP < 2.5 s locally). "—": not in the throttled set; the phone LCP of the
media-rich project page was not reported by Chromium in either build's run. The 62 loads ran on the `bfda6b0` build
(`ace4bed` changes one rule of the project pages' stylesheet, no other page). The two text-only rows are a second run of
the same script on the final `ace4bed` build (both text-only project pages, `billboard-support-structure` and
`street-litter-bins`, EN/AR, 12 loads; the other one's worst: 196 ms desktop, 144 ms phone, 1,508 ms throttled, CLS 0),
with the pre-1J build measured right after for item 40; scroll 60 fps.

### 17. Metadata matrix

Every published route (**102**: 51 EN + 51 AR) checked from the served pages: status 200; `lang` (`en` / `ar-SA`) and
`dir`; a title and a description, **unique within each language**; one canonical (absolute, its own URL); alternates
exactly `en`, `ar` and `x-default` (→ English) with absolute URLs; `og:url`, `og:title`, `og:description` (= the page's),
`og:type` website, `og:locale` / `og:locale:alternate` (`en_US` / `ar_SA`), `og:site_name`, `og:image` = the language's
share image (1200 × 630, with alt); `twitter:card` `summary_large_image` with the same title, description and image; no
`robots` rule and no `X-Robots-Tag` (indexable); exactly one `h1`; breadcrumbs (below). **0 issues.** Titles 15–70
characters; descriptions 41–194 (the two shortest are Arabic project summaries — approved content, not rewritten). Unknown
addresses (`/en/no-such-page`, `/ar/no-such-page`, an unknown service and project, `/en/about/extra`, `/no-such-page`,
`/xx/nope`): **404**, `noindex`, localized title ("Page not found | RAWASY" / "الصفحة غير موجودة | رواسي"). The 404's
document carries `noindex` twice (Next's error shell and the page metadata; both the same value, harmless).

### 18. Structured-data audit

Every page's JSON-LD parses, uses `https://schema.org`, and holds only content-layer facts. Types by route: Home —
Organization + LocalBusiness, WebSite; About — the same + AboutPage, BreadcrumbList; Contact — the same + ContactPage,
BreadcrumbList; Services, Industries, Clients, Projects — CollectionPage + BreadcrumbList; Capabilities — CollectionPage +
BreadcrumbList + ItemList (the six machine names and their `#<slug>` URLs, no specifications); each service — Service +
BreadcrumbList; each project, Certificates, Privacy, Terms — WebPage + BreadcrumbList. Breadcrumb positions are 1…n from
the language's home to the page's own URL. The organization node: legal and short names (EN/AR), URL, logo, share image,
description, email, both phones, postal address (street, Riyadh, 14325, SA), area served (Saudi Arabia), the company's
Facebook page and its six services — all from `src/content/company.ts`. **None** of: `aggregateRating`, `review(s)`,
`foundingDate`/`foundingLocation`, `numberOfEmployees`, client counts, `award(s)`, credentials or certifications,
`dateCreated`/`datePublished`, `contentLocation`/`locationCreated`, `material`, `temporalCoverage`, `geo` or a place id
(searched by property name on every page). Every URL in the data is on `https://www.rawasymetal.com` and is a page, the
logo or a share image, except the company's own Facebook page.

### 19. Publication states

`src/lib/page-meta.ts`, in `caf01fb` only:

| Route key | Before | After |
| --- | --- | --- |
| home | published | published (unchanged) |
| about, services, capabilities, projects, industries, clients, certificates, contact, privacy, terms | review | **published** |
| service (the six service pages) | review | **published** |
| project (the 34 project pages) | review | **published** |

No route is `planned` or `review` any more; nothing placeholder is published. The localized 404 (catch-all and unknown
service/project slugs) and the fallback 404 stay `noindex`.

### 20. Sitemap — exact count

`/sitemap.xml` (driven by `isPublished()`): **102 URLs** = (homepage + 10 inner pages + 6 services + 34 projects) × 2
languages. Absolute `https://www.rawasymetal.com/…`, no duplicates, no 404, Theme Lab or system address; each entry has
three `xhtml:link` alternates (`en`, `ar`, `x-default` → English): **306**; `changefreq` monthly, priority 1 (the two
homepages) / 0.7, no invented `lastmod`. Every URL answers **200** (fetched).

### 21. robots.txt

```
User-Agent: *
Allow: /

Host: https://www.rawasymetal.com
Sitemap: https://www.rawasymetal.com/sitemap.xml
```

Crawling allowed everywhere (`/en`, `/ar`, `/_next/static`, `/media`, `/og`); no staging `Disallow`; the sitemap URL is
correct. Unchanged by this stage.

### 22. OG images

`scripts/generate-og.mjs` was rewritten (it fetched the previous design's faces from Google Fonts and drew its grid). Each
card is now drawn inside the website's own built homepage (script off, reduced motion, dark theme), so it uses the site's
stylesheet, tokens and self-hosted faces (Plus Jakarta Sans and Inter; Tajawal and IBM Plex Sans Arabic), the header's
logo and the hero's finished plate. Words come from the content layer only: the hero's eyebrow and location, its
three-line headline, the six service names. Before writing, the script checks every text is drawn in the site's faces at
the weight shown, sits **48 px** inside the edges and inside its column, that the Arabic card is right-to-left, that the
plate's photograph loaded, and that no request left the site. Results: `public/og/og-en.png` 1200 × 630 RGB, 403,534 B
(sha1 `1bc83e5…`); `public/og/og-ar.png` 1200 × 630 RGB, 398,739 B (sha1 `742713d…`); two runs byte-identical; same
paths, so the metadata (`og:image`, `twitter:image`, 1200 × 630, alt) is unchanged and points to them on every page. No
Theme Lab dependency (generated from the lab-free build). Evidence: `25-og-en.png`, `25-og-ar.png` (item 53).

### 23. Theme Lab removal

Removed `src/app/theme-lab/**` and `src/components/theme-lab/**` (41 files: the lab's root layout, `lab.css`, options A,
A V2, B and C with their sheets, styles, fonts, data, lab bar, re-exports and LabMotion) and `e2e/theme-lab.spec.ts`;
`theme-lab-a-v2.spec.ts` became `e2e/commerce-home-depth.spec.ts` (the same production checks on `/en` and `/ar`; the
lab-only ones dropped: lab bar, sheet frames and replays, the lab's own theme key). `proxy.ts` lost its lab branch:
`/theme-lab/…` now gets a language like any address and the localized **404** (307 → 404, `noindex`). `Icon` renders
`mc-icon` only — the usage audit showed `lab-icon` was styled only by the lab's sheets. Proof: the build has 109 pages
(125 before); no `theme-lab`, `lab-icon` or `lab-bar` in any built file, route manifest, sitemap, robots, navigation,
preload or prefetch; 7 production stylesheets identical and every page's stylesheet list identical; 6 lab-only sheets
gone; JS per page the same module sets (one module renumbered, Next's `process` shim, same code; −24 to −298 B per page);
the service pages load 11 chunks instead of 10 (+66 B, Turbopack re-split the shared chunks once the lab left the graph);
page data identical once the `lab-icon` class and the router's `theme-lab` sibling entry are taken out; fonts 68 → 43
files (lab faces gone). Kept: Ambient's `frame` and the signatures' `freeze` options (no page passes them; noted for a
later cleanup). Git history is the archive.

### 24. Dead-code / dictionary audit

Deleted in `0eefcd8` (each with no reader left in `src`, `scripts` or `e2e`; `tsc` over all of them is the proof — it
found one test reader, rewritten to name the retired strings itself):

| Item | Last reader (proof) |
| --- | --- |
| `loader.*` (EN/AR) | previous design's loader — retired in TM-2.6 `6f93a77` |
| `cursor.*` | previous design's cursor (`<CustomCursor labels={dict.cursor}>` in the previous root layout) — TM-2.6 `6f93a77` |
| `placeholder.*` | the in-development page — last reader removed in TM-2.6 `6f93a77` |
| `a11y.switchToDark`, `switchToLight`, `whatsapp`, `previous`, `next` | previous shell — TM-2.6 `6f93a77` |
| `a11y.closeMenu`, `controls.menu`, `controls.close` | Theme Lab (`theme-lab/data.ts`) — retired in 1J `e5b89b0` |
| `footer.statement` | Theme Lab (`theme-lab/data.ts`, options B and C) — `e5b89b0` |
| `footer.preferences`, `common.figure` | previous design — TM-2.6 `6f93a77` |
| `common.viewAll` | no reader in the history (defined in 1A/1B) |
| `LogoMark` (Logo.tsx), `footerServices` (navigation.ts) | previous shell — TM-2.6 `6f93a77` |
| `routeStage` (routes.ts) | the in-development page — Stage 1F `e5b814b` |
| `getDirection` (config.ts) | never read (layouts use `localeConfig`) |
| `iconNames` (Icon.tsx) | the lab — TM-1 `92099e0` moved its last reader |
| `metricIcon` (ui.tsx) | Theme Lab options A and B — `e5b89b0` |
| `platePolygon`, `CUTS`, `Cut` (plate-geometry.ts) | previous design's hero — TM-2.6 `6f93a77` |

Kept: every key the site reads (`notFound.*` included), content, the content repository's accessors, the signature and
ambient options.

### 25. Asset safety

Every built page and its page data (601 files) scanned for media: 108 distinct files from `certificates`, `clients`,
`machines`, `projects`, `services`, `site`. **0 problems:** the three withheld AI-watermarked files
(`wheat-monument-1`, `stainless-landmark-1`, `billboard-structure-1`) are referred to by no page; the seven photos of the
five `confirm-authorship` / `render` projects (lattice cubes, laser-cut bench, seed sculpture, litter bins ×3, canopy tree)
appear nowhere (those project pages are text-only and the projects are not in the gallery); the engraving nameplates
cover and the two engraving renders appear nowhere. `public/media` (client logos, certificates, machines, projects,
services) is unchanged since the checkpoint. No new image, stock or rights assumption was introduced (the share images
reuse the site's logo and the hero's plate drawing).

### 26. Project-media safety

`projectDetailMedia()` unchanged since Stage 1F. `e2e/commerce-project-detail.spec.ts` (all 34 records, the flag rule
including a flag added later, every page's HTML and page data referring to exactly its allowed photos, each flagged
project's network requests, the wheat monument's watermarked photo never shown, no `note` or flag rendered) passes on
the release build (item 50), and the static scan in item 25 agrees: the 5 `confirm-authorship` / `render` projects
(and the 2 whose only photos are withheld) are the 7 text-only pages, and none of the 7 is in the gallery.

### 27. Certificate hashes / privacy

The 8 certificate files (`public/media/certificates/*.webp`) match the spec's SHA-1 values exactly (e.g.
`commercial-activity-licence.webp` `0b4405b…`, `vat-registration.webp` `d725f4a…`) and are unchanged since the
checkpoint. The page refers to 7 of them (redacted previews and files). `commerce-certificates.spec.ts` (hashes, the
guard against 7+ digit runs, grouped digits, ISO dates and expiry words) and its 17 tests cover the rest of §32: the
Arabic version first on `/ar`, the native modal `<dialog>` labelled by its heading, keyboard (focus kept inside,
Escape, focus returned to the trigger), the close button and the backdrop, the pointer handing over to the system cursor
and back (mouse, keyboard, touch, Arabic, reduced motion), previews never larger than before; correction 1's dialog
motion and correction 3's open-indicator contrast are held frame by frame in `commerce-motion-contrast.spec.ts`. No
registration number, QR code or personal name appears.

### 28. Contact / map

`src/lib/maps.ts`, `Location.tsx` and the quote form are unchanged since the checkpoint (no file under
`src/components/commerce/contact` or `src/lib/maps.ts` changed). The map is still the truthful address search (no
invented coordinates or place id; RAWASY's own place link is still awaited — item 51). `commerce-contact.spec.ts` (24
tests, EN/AR) covers every §29 point: no "submitted" success (the ready state offers three ways to send, never a
success message); the email and WhatsApp handoffs with their golden texts; copy (and a failing copy that says so and
selects the text); the no-JS `mailto:` submission observed through the browser; attachment names only, nothing uploaded;
up to five files of 10 MB each and the eight allowed types, refusals announced, removal; `#quote` and `#location`
landings below the header; the map frame (attributes and both Google links unchanged); the phone, email and WhatsApp
actions; the dark theme; phones. No floating WhatsApp button. google.com is blocked in this environment, so the live
map itself was not loaded here (stubbed in tests and captures).

### 29. All project URLs

All **68** project pages (34 × EN/AR) answer 200, indexable, in the sitemap; an unknown project slug answers **404**
(`noindex`, the localized 404 in this design); deeper paths reach the catch-all 404 (item 32). `commerce-project-detail.
spec.ts` (24) covers the §30 list: the 34 records (27 in the gallery, 7 held back; 17 pages with several photos, 10 with
one, 7 text-only), every page's HTML and page data referring to exactly its allowed photos, no `note`, flag or unsourced
optional detail anywhere (checked on made-up records too), the sitemap entries, the header mark, language switch and the
ways on. `commerce-projects.spec.ts` (32): the overview's 27 anchors, the index and the featured project / highlights
landing on `#<slug>` clear of the header and the bar (cold loads included), a link to a hidden project clearing the
choice first, one "View project" link per gallery card opening its page, and D4: About's and the service pages' cards
on `/projects#<slug>`, the homepage's six on `#gallery` (unchanged).

### 30. All service URLs

All **12** service pages (6 × EN/AR) and both overviews answer 200, indexable, in the sitemap, each with its Service +
BreadcrumbList data; an unknown service slug answers 404 (`noindex`) and its page data 404. `commerce-services.spec.ts`
covers the routes and SEO, the dynamic route's language switch, sourced relations only (CNC links one project,
engraving and scaffolding none), D4 / D5 links, the "general workflow" process note, imagery at or below source size,
the unforked signatures and four drawings, reduced motion, no-JS, layout and keyboard.

### 31. All machine anchors

`commerce-capabilities.spec.ts` (28 tests; 72 cases with its loops) on the release build: the 6 machines × EN/AR as cold
addresses (`/capabilities#<slug>`) on a desktop and a phone, with the fonts held back 300 and 1,200 ms — each shows that
machine and lands below the header; the language switch keeps the machine fragment in all three switches (desktop bar,
phone control, menu sheet); Back and Forward return to each machine; before hydration and without JavaScript the
`:target` panel shows (every machine a list entry with its photo, facts and links); the six records' data only, power
for the four lasers only and "Not stated in the company profile" for the press brake and laser welding, and the guard
against unstated specifications per text node (no sizes, tonnage, speeds, tolerances, models or makers); the photos
loaded once, at or below source size at six widths, never mirrored; the power chart and the register; every machine link
from the homepage showcase and the six service pages followed and landed (6 × 2 + 6 × 2); correction 1's rules (no
text opacity during a change) held frame by frame in `commerce-motion-contrast.spec.ts`. Stage 1J adds keyboard focus
in the selector on phones (item 37).

### 32. 404 / status matrix

154 requests on the publication build (`caf01fb`; the later commits change no route, header or markup), every redirect followed to its end (at most 10 hops; a repeated address counts as a
loop): **0 server errors, 0 redirect loops**.

| Address class | Answer |
| --- | --- |
| The 102 published pages | **200** at once (no redirect), indexable, no `X-Robots-Tag` |
| `/`, `/about`, `/capabilities`, `/services/laser-cutting`, `/projects/clock-tower-landmark` (no language) | 307 → the language from the cookie or `Accept-Language` (`/ar…` for an Arabic browser or `NEXT_LOCALE=ar`; English otherwise) → 200 |
| Trailing slashes (`/en/`, `/en/about/` …) | 308 → the address without it → 200 |
| Unknown pages, unknown service and project slugs, deeper paths (`/en/nope`, `/ar/services/nope`, `/en/projects/nope`, `/en/projects/a/b`, `/en/about/x` …) | **404**, `noindex`, localized title |
| Unknown addresses without a language (`/foo.php`, `/fr/about`, `/EN/about`) | 307 → `/en/…` → **404** `noindex` (one redirect, as designed) |
| The retired Theme Lab (`/theme-lab`, `/theme-lab/en/modern-commerce-a-v2`, `/theme-lab/en/modern-commerce-b/system` …; `/en/theme-lab`) | 307 → `/en/theme-lab/…` → **404** `noindex` (one redirect at most) |
| `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `icon.svg`, `apple-icon.png`, `og/og-en.png`, `og/og-ar.png` | 200 |
| Missing files (`/favicon.ico`, `/media/nope.webp`, `/og/nope.png`, `/api/x`, `/_next/static/nope.js`) | 404 |
| Page-data requests (`RSC: 1`) | 307 once to the cache-keyed address, then 200 (an unknown service or project slug: 404) |

The Next patch's own regression matrix (item 14) also covers the image optimizer's rejections (400).

### 33. Accessibility

axe-core 4.13.0 (WCAG 2.0–2.2 A / AA + best practice) on the final build:

- **Every published page** (102) and both localized 404s at 1440 × 900 (light), and every page type (15, both
  languages) in the dark theme at 1440 and in both themes on a 390 px phone: **194 runs — 0 violations of any impact.**
- **Interactive states** (EN/AR, light/dark, desktop and/or phone): the Projects gallery filtered, the certificate
  dialog open, the Contact form showing its errors, Capabilities on another machine, the Services dropdown open, the
  phone menu sheet open — **40 runs, 0 violations**.
- **Modes:** 320 px (10 runs) and 200 % zoom (8) **0**; reduced motion (6) **0**; forced colours with a light palette
  (10) **0**; with a dark palette axe reports `color-contrast` on the primary buttons and the power badge — the
  documented false positive of Chromium's forced-colours emulation (axe reads `-webkit-text-fill-color`, still the
  author's dark ink, while the text is drawn in the forced colour): measured from the drawn pixels, **19.56:1** (yellow
  on black) for each flagged element, EN and AR.
- **No JavaScript** (each page's own server HTML with its scripts removed): 56 of 60 runs **0**; the 4 others are the
  no-JS 404, whose document is Next's error shell `<html id="__next_error__">` (hard-coded without `lang` in
  `app-render.js`): `html-has-lang` (serious) and, its body being empty, `landmark-one-main` and `page-has-heading-one`
  (moderate) — part of the §16 limitation; with JavaScript the 404 is clean (above).
- **Found and fixed in this stage:** the `target-size` failure on the two project pages with three related services
  at 390 px (`ace4bed`, item 37 for the keyboard fix). Before that fix the 194-run matrix reported exactly those 2 runs.

Required "0 critical, 0 serious": met on every page and state with JavaScript; the only serious finding left is the
no-JS 404's framework shell (documented, item 52) and the verified forced-colours false positive.

### 34. Forced colours

Fixed in this stage: the Projects toggles' focus ring (`86bb8ac`, item 4). axe clean with a light palette and only the
verified emulation artefact with a dark one (item 33). The suite's forced-colours tests pass (the toggles' ring in four
palette / theme pairings, the switches, the logo and the header's marks, the chosen machine's ring, the fallback 404's
logo, the certificate preview and dialog, the motion-contrast forced-colours tests). Evidence:
`22-forced-colours-filter-focus.png`.

### 35. Reduced motion

Unchanged and complete: with reduced motion the hero shows its finished plate, the signatures their finished drawing,
the ambient holds still, reveals show at once, the Capabilities stage changes at once and the system pointer stays —
also when turned on while a page is open (`commerce-motion.spec.ts`, 11 pages). The view-transition fix (§14) changes
nothing here: with reduced motion the theme, the page and the gallery already changed at once
(`commerce-transitions.spec.ts` reduced-motion test, passing before and after). The keyboard row fix moves a row at
once in every mode. axe with reduced motion: 0 violations. Evidence: `23-reduced-motion-home-en.png`.

### 36. No-JS

Every page is complete from the server without JavaScript (the suite's no-JS tests on every page type: content
visible, no script-only control drawn, the Capabilities console a list of every machine, the Projects gallery showing
every project with every anchor landing, the quote form falling back to `mailto:`, the certificate links opening the
redacted files). axe on the no-JS rendering: item 33. The one limitation is the dynamic 404 (§16): real 404 status,
`noindex` and localized title, empty body and no `lang` without JavaScript.

### 37. Keyboard

**Found and fixed in this stage (`bfda6b0`):** Tab inside a row that scrolls sideways could stop on an item left mostly
off screen with its name hidden — Chromium does not scroll such a row while 32 px or more of the focused item are
visible. Measured on the publication build: the Arabic Capabilities selector at 320 px kept the second machine pick at
56 of its 240 px (for as long as one waited); Projects category toggles stayed half cut off at 320 px and at 200 % zoom;
the homepage's machine picks at 390 px and 200 % zoom and its project cards at 200 % zoom likewise. An inventory of
every sideways scroller holding focusable items (15 page types × 6 widths × EN/AR) found exactly four rows: the
homepage's machine picks and project cards (320–834 px), the Capabilities selector (320–640) and the Projects category
bar (320–1024). Fix: one `focusin` listener in the motion controller, keyboard focus only (`:focus-visible`), moves the
nearest sideways row at once until the item shows whole; the page never moves sideways and a tap or click changes
nothing. `e2e/commerce-keyboard.spec.ts`: 25 / 25 on the release build; on the build before, 22 of its 24 row tests
fail. Built output: one JS chunk changed (+504 B, and so its file name). The stylesheets are identical, and the 601
prerendered pages and payloads are identical apart from that chunk's name.

Tab walk on the `bfda6b0` build, with the fix (`obscured.cjs`): 14 pages (both languages, every page type) × 1440 × 900, 390 × 844,
320 × 700 and 640 × 360 (200 % zoom), Tab from the top to the footer's last link — **3,002 focus stops**, every walk
reaching the end (at most 116 stops; no trap). After each stop (and the browser's own scroll) a 7 × 5 grid over what
the focus ring surrounds is checked against what is drawn on top:

- 1440 and 390 px (1,584 stops): **0** covered by the sticky header or the projects' pinned bar, **0** hidden, **0**
  with their visible label hidden.
- 320 px and 200 % zoom (1,418 stops): **0** entirely hidden; 25 partly under the header, every one an item taller than
  the visible area (367–853 px against 287 px under the header at 640 × 360; one 774 px card at 320 × 700) — their top
  edge necessarily passes under the header while most of the item and its label show. One of them, the 853 px "clock
  tower" highlight card on Projects at 200 % zoom, has its title below the fold when focused (the browser centres the
  card; its ring and photo show) — a card taller than the window, not the header (item 52).

Real journeys (`journeys.cjs`): direct navigation to anchored addresses, wheel scrolling, Shift+Tab and Back, at the
same four sizes — 88 journeys, 688 stops, none hidden (§15).

Covered by the suite as well: the header (skip link, Services menu with Escape and focus return, language and theme
switches), the phone menu sheet (order, Escape, focus back on the menu button, closing when focus leaves it), the
Projects filters (Enter / Space toggle, focus kept), project cards (one link each in the tab order), the Capabilities
machines (Tab in order, Enter shows one and keeps focus), the Clients switch, the certificate dialog (modal, focus kept
inside, Escape, focus returned), the Contact form (error summary, its links, the file picker, the ready state) and the
footer. No positive `tabindex` anywhere: the Tab order is the DOM's reading order. Keyboard focus shows what hover shows
(Stage 1I).

### 38. Responsive matrix

`responsive.cjs` on the final build (`ace4bed`), each load in a fresh browser context: 15 page types (home, About,
Services, Laser Engraving, Capabilities, Projects, the media-rich project `clock-tower-landmark`, the text-only project
`billboard-support-structure`, Industries, Clients, Certificates, Contact, Privacy, Terms, the localized 404) × EN/AR ×
light/dark × **12 sizes** — the seven phones of §40 (430 × 932, 412 × 915, 393 × 852, 390 × 844, 375 × 812, 360 × 780,
320 × 700; phone emulation with touch) and the five windows of §41 (1920 × 1080, 1440 × 900, 1280 × 800, 1024 × 768,
834 × 1112) — **720 loads**:

| Check (every load) | Result |
| --- | --- |
| Status | 200 × 672; 404 × 48 (the localized 404, every size) |
| `lang` / `dir`, the stored theme applied | right on all 720 (`dir="rtl"` on every Arabic load) |
| Horizontal overflow (page width = window) | **0** |
| Text drawn past the screen's sides | **0** (see the note below) |
| One `h1`, shown; the header inside the screen | 720 / 720 |
| Every action in the page (buttons, the closing panels' links, the form's submit) inside the screen, its words inside its box, not cut off by a clipping ancestor | **0** problems |
| Certificate dialog: close button on screen, ≥ 24 px, on top | 48 / 48 Certificates loads |
| Projects: the pinned category bar below the header (never under it), every toggle reachable and on screen | 48 / 48 Projects loads |
| Console errors, page errors, failed requests | none, except each 404 page reporting its own 404 status (google.com stubbed) |

**0 issues.** The check raised one flag, on the homepage at 1024 × 768 (EN, both themes): the machine pick "12000W Fiber
Laser Combo Machine". Its name is truncated with an ellipsis inside its own box (`truncate`: the text range is 263 px
wide, the box clips it at 956 px of the 1,024 px window). The full name heads the panel beside it. This is the frozen
homepage design (TM-1, unchanged), and nothing is drawn past the screen. 320 px and 200 % zoom on every page: §17 (208 +
208 loads). Keyboard at every size: item 37. EN/AR parity: item 39.

### 39. EN / AR / RTL parity

All 51 page pairs compared in the browser (1440 × 900, after walking each page): headings by level, sections, list
items, forms and fields, dialogs, every image file, links by kind (internal, anchor, phone, e-mail, WhatsApp, external)
and every internal link target with the language taken out — **identical in 50 pairs**; Certificates differs only by
showing the English registration first in English and the Arabic one first in Arabic (by design). Arabic, on every
page: `dir="rtl"`; Arabic text set only in Tajawal and IBM Plex Sans Arabic; no letter-spaced Arabic text; no
photograph, logo, document or video mirrored; every run of digits in a phone or WhatsApp link set left to right (a
`dir="ltr"` isolate). Same services, project records, machines, clients, certificates and contact actions (the content
layer feeds both languages; `site.spec.ts` and the page specs check them per language).

### 40. Performance

Method (`perf.cjs`): each load in a fresh browser context with the cache disabled, against the local production
server; FCP, LCP (and its element), CLS (largest session window), total blocking time after FCP (long tasks), transfer
size by type and request count; three profiles — desktop 1440 × 900, phone 390 × 844 (DPR 2), and phone with
Lighthouse's mobile throttling (150 ms RTT, 1.6 Mbit/s, 4× CPU); 12 page types × EN/AR (62 loads); then the scroll
benchmark at 1440 (software compositing, 12 px per frame to the bottom, mouse off the page) on 7 pages. The same script
ran on the pre-1J build (`f69e2fa`, Next 16.3.6) right after, on the same machine, nothing else running:

| | Release candidate | Pre-1J (`f69e2fa`) |
| --- | --- | --- |
| Desktop: worst LCP / CLS / TBT | 1,188 ms / 0.0012 / 26 ms | 1,204 ms / **0.0998** / 22 ms |
| Phone: worst LCP / CLS / TBT | 240 ms / 0 / 8 ms | 292 ms / 0 / 9 ms |
| Throttled phone: worst LCP / CLS / TBT | **2,320 ms / 0 / 365 ms** | 2,668 ms / **0.1066** / 556 ms |
| Scroll benchmark, slowest page | **58.4 fps** (p95 16.8 ms) | 58.8 fps |
| Arabic pages, desktop CLS | 0 – 0.0012 | 0.0011 – 0.0998 |
| Arabic pages, desktop FCP | 196 – 324 ms | 224 – 412 ms |

- **Locally (the established method) no regression** from the font change, the Next patch, the OG work or the lab's
  removal: Arabic pages paint first faster on 10 of 14 desktop loads (−12 to −116 ms; the other 4 +4 to +36 ms) and 13
  of 14 phone loads (−108 ms to +16 ms), and their layout shift is gone (desktop worst 0.0998 → 0.0012); English pages
  are unchanged within run-to-run noise (single loads −32 to +104 ms on desktop, −32 to +28 ms on a phone; e.g. Laser
  Cutting 304 → 408 ms on desktop but 176 → 192 ms on a phone and 1,712 → 1,572 ms throttled).
- **Throttled phone (1.6 Mbit/s, 4× CPU) — a measured trade-off of the Arabic preload:** the 8 preloaded Arabic files
  (~210 KB) now share the slow link with the stylesheet, so Arabic pages without a large first-screen picture paint
  later — the two text-only project pages +232 / +288 ms (1,284 → 1,516 ms), Contact +208 ms, the media-rich project
  +60 ms — while the others paint earlier (homepage −348 ms, Capabilities −388 ms, Projects −196 ms, About −52 ms, Laser
  Cutting −32 ms). The worst throttled LCP still falls (2,668 → 2,320 ms), every page stays under 2.5 s, and the
  throttled layout shift on Arabic pages is gone (worst 0.1066 → 0). English throttled pages: −140 to +24 ms. Option for
  the user (not done): preload only the files the first screen's Arabic headings and lead use, trading some of the
  shift fix back for earlier paint on slow links.
- **Bytes and requests** per page are identical to the pre-1J build except: JS +0–1 KB (the motion controller's focus
  handler), the service pages one more small chunk (+66 B; Turbopack re-split once the lab left the module graph), and
  `/ar` phone 19 KB fewer image bytes (fewer lazy images reached in the first 3 s). Font bytes are identical: English
  pages preload only their 2 Latin files (75 KB), and at desktop widths the language switch's "العربية" label loads
  Tajawal 700's Arabic file (9 KB) on demand, as before (English Contact also sets some Arabic text, 131 KB in all);
  Arabic pages load 211–230 KB as before — the preload changes when the Arabic files arrive, not which.
- **Scroll:** every page ≥ 58.4 fps (target ≥ 55); p95 frame time 16.7–16.8 ms; every run reached the bottom.
- Long tasks: TBT ≤ 26 ms on desktop and ≤ 8 ms on phone; under 4× CPU throttling 127–365 ms (was up to 556 ms).

### 41. Image-size ratios

Every image on all 102 pages at 1440 and 390 px (DPR 1; lazy images loaded by walking each page): 1,196 images, 108
distinct files, all in the media registry, 0 broken, 0 without an `alt` attribute (420 empty `alt`s are decorative or
named by their caption or link — the established pattern). The **effective display scale** is measured as the browser
draws it: `object-fit: cover` fills its box (the larger axis ratio), `contain` fits it (the smaller), otherwise the box
width over the source width.

| Folder | Largest scale, every page but the homepage | Largest scale on the homepage |
| --- | --- | --- |
| machines | **1.00×** (`fiber-laser-combo-12kw`, `/ar/capabilities`, 439 px = source) | 0.81× |
| projects | **1.00×** (`clock-tower-1` on About) | **1.84×** (`wave-sculpture-1`, 390 px phone card) |
| services (About / workshop / service photos) | **1.00×** | **1.23×** (`fabrication-workshop`, 1440) |
| site | 0.996× | 0.76× |
| certificates (previews) | **0.39×** | — |
| clients | 0.46× | 0.30× |

- **Met on every page except the homepage:** no machine, project, About / workshop or certificate image is drawn above
  its source size.
- **The homepage's cards enlarge some photos** (22 of its images over 1.0×): its project tiles and the two service
  tiles crop the profile's small photos into fixed frames, up to 1.40× on desktop and 1.84× on a phone (a 370 × 208
  photo cropped into a 277 × 382 portrait card). This is the homepage design approved in TM-1 and frozen since (the
  A V2 report recorded "large tiles enlarge them by up to about 1.3–1.5×"); the phone figure is higher than that note.
  Not changed here (no redesign of the frozen homepage). **For the user's decision:** keep it, or cap the homepage
  card photos at their source size (a visible change to the frozen homepage); RAWASY's original photography (item 51)
  removes the issue either way.
- Certificate dialog previews (open only on demand) are held at or below the previous design's size by
  `commerce-certificates.spec.ts`; the Capabilities stage photo at six widths for every machine by
  `commerce-capabilities.spec.ts`.

### 42. Console / server warnings

- **Server:** the final build's `next start` (port 3400) served every check run on `ace4bed`: the axe matrices, the
  720-load responsive matrix, the text-only performance run and the evidence captures. Its log holds only its 5 start-up
  lines: no warning, no error, no image-optimizer failure. The same is true of the `bfda6b0` server's log (the
  performance, image, parity and keyboard runs) and of the fresh clone's `npm start` after its smoke checks and the
  §17 re-run (item 43).
- **Browser console:** console errors, page errors and failed requests (any response of 400 or more) were recorded on
  all 720 responsive loads and all 208 reflow loads, both on the final build. The only entries are each localized 404
  page reporting its own intended "Failed to load resource: … 404" for its document. There are no uncaught errors,
  hydration warnings, React errors or 404 asset requests. The suite asserts the same (`trackErrors`: no page error and no console error except a 404 status) in
  16 of its 19 spec files, on every page they load (item 50).
- **Build:** item 49.

### 43. Fresh clone

Run at **`e1f85f0`**. That commit holds every source, test, configuration and documentation file of the release
candidate; the commits after it only write these results into this report and rename it (item 9).

1. `git clone --branch claude/new-session-5eijs6 https://github.com/Delowar01/Rawasy-Metal-Website` into a new, empty
   directory. HEAD was `e1f85f0`, the tree clean, and no `node_modules`, `.next`, image cache or test cache was copied
   from the working checkout.
2. Node **v22.22.2** and npm **10.9.7**, matching `.nvmrc` and `engines` (no engine warning).
3. `npm ci`: exit 0, 374 packages added, 375 audited, 14 s. Its one notice, `npm warn deprecated eslint@9.39.5` (the
   lint tool's end-of-support notice), is development-only and predates 1J. `npm audit --omit=dev` found 0
   vulnerabilities; `npm audit` lists the same 5 development-only high entries as item 12.
4. `npm run lint`, `npm run typecheck`, `npm run build`: exit 0 each (items 47–49).
5. **The clone builds exactly what the QA measured** (the `ace4bed` build from the working checkout):
   - `.next/static`: 74 of 74 files identical, apart from the build-id folder's name;
   - prerendered pages and page data: 889 of 890 files identical once the build id is normalised; the one left,
     `en/about.html`, differs only in the position of Next's `next-size-adjust` meta (known build-to-build noise).
6. `npm run test:e2e` with `E2E_PORT=3500`, so Playwright started the clone's own `next start` and reused no server.
   Nothing else ran alongside. Result: **612 passed**, 0 failed, 0 skipped, 0 flaky, in 21.7 min (item 50).
   Playwright relayed no output from the server, so no warning or error.
7. `npm start` (`next start -p 3600` on the clone's build): ready in 150 ms, and **20 / 20 checks passed**:
   - `/` answers 307 → `/en`, and eight pages answer 200 (both homepages, About, Capabilities, Laser Cutting, a
     media-rich and a text-only project, Contact);
   - an unknown page and an unknown project answer 404 with `noindex`, and `/theme-lab` 307 (then the 404);
   - `sitemap.xml` (102 `<loc>`), `robots.txt` (its sitemap line, no `Disallow`) and both share images answer 200;
   - the image optimizer answers 200 WebP for a browser's `Accept` and 200 JPEG for `*/*` (format negotiation), and
     400 for a remote URL; a missing `/media` file answers 404.

   The same server then took the §17 re-run (416 browser loads). Its log holds only its start-up lines: no warning, no
   error, no image-optimizer failure.

### 44. Node / npm versions

**Node.js 22.22.2** and **npm 10.9.7**: every build, test and measurement of this stage ran on them, and the fresh clone
(item 43) too. Recorded deliberately in `.nvmrc` (`22.22.2`) and `package.json` `"engines": { "node": "22.22.2" }` —
the exact tested version, no range claimed (other versions were not tested; npm only warns on a mismatch).
`package-lock.json` is unchanged by this (npm ci accepts the field as it is). `scripts/generate-og.mjs` needs Node
22.18 or later (type stripping), which 22.22.2 is.

### 45. Windows README

README "Getting started" → "On Windows": `npm.cmd ci`, `npm.cmd run dev`, `npm.cmd run build`, `npm.cmd start` (the
`.cmd` shim avoids PowerShell's execution policy blocking `npm.ps1`), and the stale-build recovery — stop every running
`next`, delete `.next` (`Remove-Item -Recurse -Force .next` / `rmdir /s /q .next`) and build again. No machine-specific
path. Stated honestly: these are the standard npm commands; the project's checks run on Linux and were not run on
Windows here.

### 46. `.env.example`

One variable, the only one the code reads (`src/lib/seo.ts`): `NEXT_PUBLIC_SITE_URL`, the public origin for canonical
URLs, alternates, share tags, structured data, the sitemap and robots.txt — optional, public, read at build time,
default `https://www.rawasymetal.com`. **There is no runtime secret, API key or private credential**: the site has no
backend (the quote form hands off to the visitor's email or WhatsApp). `.gitignore` keeps ignoring `.env*` except
`.env.example`. (`E2E_PORT`, `E2E_BASE_URL` and `CI` are test-runner switches documented in `playwright.config.ts`, not
application settings.)

### 47. Lint

`npm run lint` (ESLint 9.39.5 with `eslint-config-next` 16.3.6) in the fresh clone: **exit 0, no warnings, no errors**
(11 s). It also ran clean (no output) on the working checkout for the commits that changed scripts or TypeScript:
`f299bb9`, `ffd8c93`, `7abd622`, `e5b89b0`, `bfda6b0` and `ace4bed`.

### 48. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`, TypeScript 5.9.3) in the fresh clone: **exit 0**, route types
generated, no error (9 s).

### 49. Build

`npm run build` (Next.js 16.3.8, Turbopack) in the fresh clone: **exit 0**, compiled in 6.0 s, **109 static pages** (the 102
published pages, `/_not-found`, Next's `/_global-error`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `icon.svg`,
`apple-icon.png`), the catch-all as a dynamic route, and the proxy. **No warning** in the log (20 s in all). `next/font`
downloads its Google faces at build time (the layout's two Latin faces and the fallback 404's four) and the build serves
them itself; nothing is requested from Google at runtime. The output is the one every QA run measured (item 43).

### 50. Full E2E

`npm run test:e2e` in the fresh clone at `e1f85f0` (item 43): Playwright 1.56.1, Chromium, 3 workers, no retries
configured, against the clone's own production server, with nothing else running.

| Total | Passed | Failed | Skipped | Flaky | Retries | Time |
| --- | --- | --- | --- | --- | --- | --- |
| **612** | **612** | **0** | **0** | **0** | 0 (none configured) | 21.7 min (00:17:28 → 00:39:12 UTC) |

The suite has 19 spec files. Stage 1J added `commerce-fonts.spec.ts` (7), `commerce-transitions.spec.ts` (12) and
`commerce-keyboard.spec.ts` (25), plus one test in `commerce-project-detail.spec.ts` (the target spacing). It retired
`theme-lab.spec.ts` with the lab and turned `theme-lab-a-v2.spec.ts` into `commerce-home-depth.spec.ts` (item 23).
Every other assertion was kept, or updated where Stage 1J changed the expected behaviour: `review` → `published`, the
lab's addresses now answering 404, the Arabic preloads, and the retired strings named in the test itself.

Earlier full runs in this stage:

| Build | Result |
| --- | --- |
| `f299bb9` (the Next patch) | 606 / 606 |
| `bfda6b0` (before the target-spacing test existed) | 611 / 611 |

The specs touched by each later commit were run on that commit (e.g. 213 / 213 on `7abd622`, 90 / 90 project specs on
`ace4bed`).

### 51. Remaining external RAWASY confirmations

External business confirmations, not code defects (the site already withholds or omits everything unconfirmed; details
in `docs/ASSET_INVENTORY.md`):

1. RAWASY's own **Google Maps place link** (the map uses the truthful address search until then; no coordinates or
   place id invented).
2. **Photography:** originals for the low-resolution profile exports (heroes ≥ 2,000 px, cards ≥ 1,200 px), the six
   machines, and RAWASY's own engraved work.
3. **Image rights** for the stock-looking covers and service photos (CNC bending, steel structures, welding,
   scaffolding, `site/welder-sparks`).
4. **Portfolio authenticity:** the three projects awaiting authorship confirmation (#02 lattice cubes, #17 seed
   sculpture, p.3 canopy tree), the three AI-watermarked photos (#07, #14, #21) and the two catalogue renders (#12
   bench, #28 bins) — their pages stay text-only until then.
5. **Project facts** per project (client, location, year, materials, scope; services used) — none shown until supplied;
   summaries on the seven text-only pages describe photos those pages do not show (may be reworded).
6. **Machine descriptions** ("Combo", "flatbed", "handheld", the service of each machine, any other machines) and
   whether the makers' markings on the cut-outs may stay visible.
7. **Certificates:** the renewed Commercial Activity Licence (the expiry shown in the profile is past; the date is hidden)
   and approval before any CR / VAT number is shown (withheld).
8. Smaller items: the term "New Struck(s)" (omitted), the 935 m² shop area (not used), the primary WhatsApp number, a
   domain e-mail address instead of Gmail, one workshop photo shown on two project pages.
9. **Release logistics (the user's / RAWASY's decision):** the production domain (`https://www.rawasymetal.com` is
   assumed by `NEXT_PUBLIC_SITE_URL`), hosting and DNS, and when to deploy. An online submission service for the quote
   form remains a later decision.

### 52. Known limitations

Each measured and left deliberately (none blocks the release candidate):

1. **Browsers:** every automated check ran in Chromium (Playwright's build). Safari (iOS and macOS) and Firefox were not
   tested in this environment; a manual pass on real devices is recommended before going live.
2. **No-JS dynamic 404:** real 404 status, `noindex` and localized title, but an empty body without JavaScript (§16; a
   fix needs a disproportionate routing change or a fake 200).
3. **Below 320 CSS px** (a phone at 200 % page zoom, or doubled text on a phone) the header's controls overflow;
   outside the 320 px reflow target (§17), pre-existing since TM-3.
4. **Cards taller than the window** (at 200 % zoom the visible height below the header is 287 px): a focused card's
   ring cannot fit; part of it is off screen or under the header (never the whole card; item 37).
5. **Desktop LCP of About and the services overview** is the section under the hero (it keeps its reveal): 1.0–1.2 s
   locally (TM-3); every other page's LCP is its first paint.
6. **Without JavaScript**, a font that swaps in after the first layout can still move an address's anchor landing
   (TM-3 item 5, two CSS fixes tried and rejected for cost; open for the user).
7. **The live Google map** was not loaded here (google.com is blocked in this environment; stubbed in tests and
   captures). Check it once on a normal network.
8. **Header blur:** the CSS build keeps only `-webkit-backdrop-filter`, so the scrolled header is 80 % opaque without
   blur in Chromium — the approved TM-1 look, unchanged.
9. **`npm audit`** (development dependencies): 5 high in the lint-only `braces` chain; the only fix is a breaking
   `--force` downgrade (item 12). The served application audits clean.
10. **`/favicon.ico`** answers 404: the pages declare `icon.svg` and the Apple touch icon, which browsers use; only
    tools that request `/favicon.ico` directly get the 404 (the same on the pre-1J build).
11. **The 404 document** carries its `noindex` meta twice (Next's error shell and the page's metadata; same value).
12. **robots.txt** keeps its `Host:` line (non-standard, ignored by Google; harmless; unchanged).
13. **Sitemap** without `lastmod` (no invented dates).
14. **Measured locally:** performance figures come from a local production server (no CDN, no real network); field
   data will differ. The share images are the dark theme in each language.
15. Ambient's `frame` and the signatures' `freeze` options stay unused since the lab's retirement (noted for a later
   cleanup; removing them would touch approved modules).
16. Windows commands documented, not run on Windows (item 45).

### 53. Screenshot / evidence inventory

Captured from the final build (`ace4bed`, local `next start`; no Theme Lab, which no longer exists). The pages are at
rest: reveals walked, entrances finished, lazy images loaded. Unless stated otherwise the window is 1440 × 900 and the
capture is the full page. google.com is blocked in this environment, so the Contact map shows a labelled stand-in. Sent
with this report as three contact sheets (`1j-evidence-pages.png`, `1j-evidence-states.png`,
`1j-evidence-fonts-og.png`) and the full-resolution set (`1j-evidence-full.zip`).

| File | §51 item |
| --- | --- |
| `01-home-en-light-desktop.png` | Home EN, light, desktop |
| `02-home-ar-dark-desktop.png` | Home AR, dark, desktop |
| `03-home-en-phone.png` | Home EN, phone (390 × 844, first screen) |
| `04-home-ar-phone.png` | Home AR, phone (390 × 844, dark, first screen) |
| `05-about-en-light.png` | About |
| `06-services-ar-light.png` | Services |
| `07-service-laser-cutting-en-dark.png` | one service page (Laser Cutting, dark) |
| `08-capabilities-en-light.png` | Capabilities |
| `09-projects-all-en-light.png` | Projects, All |
| `10-projects-filtered-ar-dark.png` | Projects filtered (Architectural Metal, AR, dark; the gallery at the top) |
| `11-project-media-rich-en-light.png` | media-rich project (`clock-tower-landmark`) |
| `12-project-text-only-ar-light.png` | text-only project (`billboard-support-structure`, AR) |
| `13-industries-en-dark.png` | Industries |
| `14-clients-ar-light.png` | Clients |
| `15-certificates-en-light.png` | Certificates |
| `16-certificate-dialog-ar-dark.png` | certificate dialog (AR first, dark) |
| `17-contact-en-light.png` | Contact |
| `18-privacy-en-light.png`, `19-terms-ar-dark.png` | Privacy / Terms (first screen) |
| `20-404-en-light.png`, `21-404-ar-dark-phone.png` | 404 (desktop EN; phone AR dark) |
| `22-forced-colours-filter-focus.png` | forced colours (light palette, site dark theme): the focused filter toggle's `Highlight` ring |
| `23-reduced-motion-home-en.png` | reduced motion: the hero's finished plate, nothing moving |
| `24-ar-font-first-load-1…4-*.png` (+ `.json`) | Arabic fonts on first load: `/ar/about` with an empty cache, four frames of the load (0 / 600 / 914 / 1,638 ms; the first is before the first paint), the Arabic faces in place from the first painted frame; the JSON lists the 10 preloaded files (2 Latin + 8 Arabic) |
| `25-og-en.png`, `25-og-ar.png` | OG EN / OG AR (the committed `public/og` files) |

The visual quality of the release is for the independent review; the builder does not sign it off.

### 54. Deployment readiness verdict

**Ready for independent release review.** It is not approved (the builder does not approve its own work) and it is not
deployed.

On the release candidate, every gate of the brief that the code controls is met:

- **Security:** `npm audit --omit=dev` finds 0 vulnerabilities (Next.js 16.3.8).
- **Accessibility:** 0 axe violations of any impact on every page and interactive state with JavaScript. Keyboard
  reaches everything, and focus is never hidden under the sticky header. Forced colours, reduced motion and no-JS
  were checked.
- **SEO and publication:** 102 pages published, with complete metadata and structured data built from approved facts
  only; the sitemap lists 102 URLs; robots.txt is open; real 404s carry `noindex`.
- **Performance:** CLS ≤ 0.0012; LCP ≤ 2.32 s on a throttled phone; scrolling ≥ 58.4 fps.
- **Build quality:** lint, typecheck and build are clean, and the fresh clone ran 612 / 612 E2E tests.

Open for the user's decision before going live. None of these is a code defect that blocks the candidate:

1. The release approval itself: an independent review of this report and the evidence.
2. Hosting, domain and DNS. The build assumes `https://www.rawasymetal.com` (`NEXT_PUBLIC_SITE_URL`).
3. Two measured trade-offs, each offered as an option: the frozen homepage's card photos (up to 1.84× on a phone, item
   41) and the Arabic preload on slow links (item 40).
4. Accepting the documented limitations (item 52), above all the empty no-JS body of the dynamic 404 and testing in
   Chromium only. A manual pass in Safari and Firefox, and of the live Google map on a normal network, is recommended.
5. RAWASY's confirmations (item 51). The site already withholds everything unconfirmed, so these improve the content
   rather than block the release.

Nothing was deployed or published externally, no tunnel was opened and no DNS was changed. Production deployment waits
for the user's explicit approval.
