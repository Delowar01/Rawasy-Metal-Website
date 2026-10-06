# Stage 1I — Correction 2: words never fade anywhere (homepage machinery, reveals, entrance, menus, project label)

Date: 2026-10-06 · Branch: `claude/new-session-5eijs6` · Status: **built, returned for independent review** (not signed
off by the builder; nothing published or deployed; Stage 1J not begun).

## Summary

Correction 1 removed text-bearing opacity motion from the Capabilities console and the certificate dialog. Its own QA
found the same pattern on the homepage machine showcase, and named the site-wide scroll reveals as needing a check. This
correction first took a read-only **census** of every production motion that changes the opacity of words
(`docs/reports/2026-10-06-stage-1i-correction-2-census.md`, committed before anything it lists beyond the machinery was
changed): eight systems hold words that fade — the homepage machinery panels and their specification row, the default
and "fade" scroll reveals, the homepage entrance, the Services dropdown, the phone menu sheet and the homepage project
cards' "View in the gallery" label. Each was **held part-way** on the base build (`577b54f`) in EN/AR × light/dark at
1440 × 900 and 390 × 844 (the reveals also at 320 × 700): 628 frames, and every system failed — **1,230 words below AA
in 218 frames**, worst **1.000:1**; the machine change drew two machines' words together in 48 of 88 frames; axe caught
only part of it (the entrance's and the label's failures not at all).

The fix is CSS only, in two stylesheets, and keeps every motion's movement and timing — only the words no longer pass
through partial opacity:

- **Homepage machinery:** a panel is shown or hidden whole (`visibility`, `z-index`); the coming machine's words are at
  full strength from the first frame and its specification row rises 8 px; the leaving machine's words go at once while
  only its photo and floor shadow fade out (180 ms) under the new ones; the coming photo fades in (after 80 ms) and
  settles as before; the spotlight glides as before. The selector's power badge swaps colour at once (its 320 ms blend
  read 1.33:1), and in forced colours the chosen machine now carries a `Highlight` ring and underline.
- **Scroll reveals:** an element waits for its turn unseen (as before), then shows whole and rises 18 px over 700 ms; a
  "fade" one simply appears. What holds no words — service drawings and signatures, uncaptioned photos, logo-only tiles
  — still fades in. The reveal system itself is unchanged.
- **Homepage entrance, Services dropdown, phone menu sheet:** the same keyframes without the opacity step — the hero
  rises, the menus open and settle, words at full strength throughout.
- **Project cards' label:** shown at once on hover or keyboard focus, rising 6 px.

On the corrected build the same 628 frames hold **0 words below full opacity, 0 below AA (worst 5.074:1) and 0
colour-contrast findings**, one machine's words in every frame. The contrast spec gains 42 held-frame tests (54 in all);
they fail on the base build (41 of 42) and pass on the correction. Correction 1's held frames are unchanged (0 below AA,
0 partial, 0 axe in 152 frames, frame for frame as approved). Nothing else changed: of 806 prerendered files 804 are
byte-identical and 2 differ only in where Next.js put its `next-size-adjust` meta, all 25 JS chunks are byte-identical,
12 of 13 stylesheets are identical and the shared one differs by exactly the 12 removed and 20 added rules; the resting
pixels are unchanged (765 of 778 screens identical; the other 13 are run-to-run noise that each build shows against
itself, or the baseline's own leftover paint, identical when drawn afresh); reduced motion and no-JS behave as before
(and the no-JS machinery no longer shows two machines), forced colours gain a mark for the chosen machine, and every
interaction runs at 58–60 fps with no long task. **One measured worsening:** the Arabic homepage's CLS at 1440, 0.0390 →
0.0459 — the same late Arabic-font shift (Stage 1J), now counted on hero words that are visible instead of fading in
(item 25).

QA run: `npm ci`, both audits (production 0 — after a lockfile-only patch for two advisories published since correction
1, proven to change nothing served), lint, typecheck, build, the full e2e suite (**587 of 587**, no retries), the
extended spec on both builds, 628 held frames per build in the proof matrix, correction 1's 152 frames, reduced motion /
no-JS / forced colours on both builds, 778 resting screen pairs plus self-comparisons and repaints of the 9 views that
differed, 72 frame-rate windows, 120 + 12 load measurements, the freeze proofs, 1,484 optimized-image comparisons and 16
evidence sheets.

---

## 1. Starting SHA

`577b54f07a7697e21243bdeb8451d34d34a36f7f` ("Name the report commit in the Stage 1I correction 1 report's branch
history"). Preflight, before any change: `git fetch` of the branch and the checkpoint; `git status` empty (clean tree);
branch `claude/new-session-5eijs6`; local HEAD = remote HEAD = `577b54f`; `git ls-remote`: `preserve/pre-stage-1i` =
`b1f4fe1a3076247c9302b2a4e72428dc40fda8d6`, unchanged; no product drift after correction 1 — between its implementation
`1f7b9fc` and `577b54f` nothing under `src/`, `e2e/`, `public/`, `package.json`, `package-lock.json` or `next.config.ts`
changed (only `CLAUDE.md`, `README.md` and the correction 1 report). Correction 1 is not rewritten: this correction is
new commits on top, and its Capabilities and certificate-dialog changes are untouched (item 27).

## 2. Implementation SHA

`75d7f73c12b59e49e2c7c436da0e8915badcd138` — "Stop text from fading in the homepage machinery, reveals, entrance and
menus" (on `34e88ed`, the census commit): the CSS changes in two stylesheets and the extended spec, together. No product
source changed after it. One more product-level commit followed, on its own: `f492577c078cd2b3c9926920523ca3c10d274c24`
— "Patch sharp and source-map-js for two advisories published after correction 1" (`package-lock.json` only; items
33–35), which changes nothing the site serves.

## 3. Branch HEAD

`577b54f` → `34e88ed` (the census, docs only, committed and pushed before the systems it lists were changed) → `75d7f73`
(implementation) → `f492577` (lockfile patch) → the report commit that adds this file and updates `CLAUDE.md` and
`README.md` = HEAD, all pushed to `origin/claude/new-session-5eijs6` without force (a commit cannot name its own hash;
it is given in the hand-off message). `preserve/pre-stage-1i` still points to `b1f4fe1`.

## 4. Files changed

Product (2 files, CSS only — no markup, script, content, media, route, metadata or status change):

- `src/components/commerce/system.css` — the homepage machinery (panels, photos, specification row, the power badge's
  colour swap), the project cards' label, the dropdown and sheet keyframes, the entrance keyframes, and the chosen
  machine's forced-colours mark (items 7, 11–13, 20).
- `src/app/(commerce)/commerce.css` — the scroll reveals (item 10).

Tests (1 file): `e2e/commerce-motion-contrast.spec.ts` — 42 new tests beside correction 1's 12, 54 in all (items 14–15).

Dependencies (1 file): `package-lock.json` — `sharp` 0.35.4 → 0.35.5 and `source-map-js` 1.2.1 → 1.2.2 (items 33–35);
`package.json` unchanged.

Documentation: `docs/reports/2026-10-06-stage-1i-correction-2-census.md` (its own commit), this report, `CLAUDE.md`
(status, the "words never fade" rule now applied everywhere, the spec's coverage, new gotchas) and `README.md` (status,
the spec, the latest report).

## 5. Full census

The census is its own document, committed before any system it lists beyond the homepage machinery was changed:
`docs/reports/2026-10-06-stage-1i-correction-2-census.md`. In short:

| # | System | Motion on the base build | Words it holds | Decision |
| --- | --- | --- | --- | --- |
| 1 | Homepage machinery panels (`.a2-mx-panel`) | Whole panel cross-fade, 600 ms in and out | Name, capability, category badge, tags, quote button | Fixed (item 7) |
| 2 | Its specification row (`.a2-mx-spec`) | Fade + 8 px rise, 600 ms after 120 ms | Power and service tags | Fixed (item 7) |
| 3 | Scroll reveals, default (`[data-reveal]`) | Opacity 0 → 1 + 18 px rise, 700 ms, staggered | 380 elements per language on 49 pages | Fixed (item 10) |
| 4 | Scroll reveals, "fade" | Opacity 0 → 1, 700 ms, staggered | 108 elements per language | Fixed (item 10) |
| 5 | Homepage entrance (`[data-enter]`, `a2-rise`) | 8 items fade in and rise 18 px, 900 ms, delays 0–420 ms | Every hero word, the plate stage's figures, the service strip | Fixed (item 11) |
| 6 | Services dropdown (`a2-pop`) | Fade + 6 px drop + scale, 320 ms | Six services, their lines, "All services", the quote | Fixed (item 12) |
| 7 | Phone menu sheet (`a2-sheet`) | Fade + 8 px drop, 320 ms | Pages, services row, language, theme, phone, quote | Fixed (item 12) |
| 8 | Homepage project cards' label (`.a2-proj-cta`) | Fade + 6 px rise, 320 ms, on hover / keyboard focus | "View in the gallery" | Fixed (item 13) |
| — | Words inheriting opacity from another animated ancestor | None beyond 1–8 (correction 1's console and dialog are fixed and locked) | — | — |

Excluded as the brief directs (images, decorative SVG, pseudo-elements without words, backdrops, ambient, glows,
view-transition snapshots) — each listed with its reason in the census. Not in the list because they never fade: the 61
text-bearing reveals per language inside the inner heroes (shown with the first paint since TM-3) and the 58 reveals per
language that hold no words. Method: a parser over every production stylesheet (every rule animating or transitioning
`opacity`, directly, through `all` or through keyframes), every `animate()` call and view transition in the commerce
code, and every `data-reveal` / `data-enter` element on all 52 addresses in EN and AR (1,230 elements in all) classified
by what it holds.

## 6. Machinery before

On the base build the whole panel cross-faded (600 ms out, 600 ms in) and the specification row faded after 120 ms. Held
at 0, 80, 150, 160, 240, 300, 450, 600, 720 and 900 ms and settled in EN/AR × light/dark × 1440 / 390 (88 frames):

| Held at | Views with words below AA | Words below AA | Worst ratio | Words below full opacity | axe colour-contrast nodes | Views with two machines' words |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms (0 %) | 0 / 8 | 0 | 5.074 | 0 | 0 | 0 |
| 80 ms (13 %) | 8 / 8 | 117 | 2.102 | 120 | 12 | 8 |
| 150 ms (25 %) | 8 / 8 | 152 | 1.272 | 176 | 36 | 8 |
| 160 ms (27 %) | 8 / 8 | 116 | 1.249 | 144 | 8 | 8 |
| 240 ms (40 %) | 8 / 8 | 80 | 1.042 | 112 | 8 | 8 |
| 300 ms (50 %) | 8 / 8 | 72 | 1.009 | 144 | 1 | 8 |
| 450 ms (75 %) | 8 / 8 | 88 | 1.000 | 176 | 0 | 8 |
| 600 ms (100 %) | 0 / 8 | 0 | 5.062 | 56 | 0 | 0 |
| 720 ms, 900 ms, settled | 0 / 8 | 0 | 5.074–5.473 | 0 | 0 | 0 |

In all: 625 words below AA in 48 of 88 frames, worst 1.000:1 (a word at opacity 0.0001 over the stage), two machines'
words drawn together in 48 frames, axe colour-contrast in 26 frames (65 nodes). Examples (EN light, 1440): at 80 ms the
coming machine's "Rated power … 12,000" at opacity 0.49 read 2.17:1; at 160 ms "3,000" at 0.15 read 1.25:1; at 450 ms
the leaving machine's words at 0.0001 read 1.00:1 beside the coming one's. Every language, theme and view failed alike
(75–80 words below AA per view, worst 1.000 in each, axe 4–15 nodes, more on dark). Correction 1's report had measured
7–19 nodes per frame at 160 ms in two views; the full matrix confirms and extends it.

## 7. Homepage machinery: implementation

The panels are shown or hidden **whole**, never faded — the same rule as correction 1's console:

| Part | Machine coming in | Machine leaving |
| --- | --- | --- |
| Words (name, capability, category badge, tags, "Request a Quote") | Drawn at full strength from the first frame | Gone at once (the panel's `visibility: hidden`, no delay) |
| Specification row (`.a2-mx-spec`) | Rises 8 px into place, `translate` 600 ms after 120 ms (as before, without the fade) | — |
| Photo | Fades in 600 ms after 80 ms and settles (`scale` 0.94 → 1, 10 px rise, 900 ms, as before) | Fades out in 180 ms under the coming machine: the image keeps `visibility` for 180 ms (`visibility 0s linear var(--dur-1)`) while its opacity goes to 0 |
| Floor shadow under the photo (`.a2-mx-img::after`) | Fades in with the photo | Fades out with the photo, then hidden |
| Stage spotlight (`--spot-x`) | Glides 900 ms, unchanged | — |
| Stacking | The shown panel `z-index: 1`, every other panel `z-index: 0` (grid items: no positioning needed), so a leaving photo always passes under the coming machine's words | — |

CSS only, in `system.css`'s machinery block:

- `.a2-mx-panel` lost `opacity` and its transitions (`visibility` and `z-index` only); the shown-panel rule lost them
  too.
- The inactive photo gains `opacity: 0`, the inactive floor shadow `opacity: 0`; `.a2-mx-spec` keeps only its
  `translate` transition, and its inactive state only its `translate: 0 8px`.
- One `@media (prefers-reduced-motion: no-preference)` block carries the photo's and the shadow's fade in (600 ms after
  80 ms) and fade out (180 ms, held visible meanwhile). With reduced motion the existing rule keeps every part still and
  the change immediate.
- The selector's power badge (`.a2-mx-pick .badge-power`) lost its 320 ms colour transition: found during verification
  (item 13), its text and fill used to blend through each other (1.33:1 at 80 ms); they now swap at once.
- Forced colours (unlayered, beside the header's marks): the chosen machine's card gets a 3 px ring in `Highlight` on
  `::after` (`forced-color-adjust: none`) and its words underlined — the state was invisible there before (the tint, the
  orange edge and the shadow are dropped by forced colours), as on the Capabilities page since 1E.

Unchanged: the data, the order, the six panels and their markup, the picks and their keyboard use, `aria-current`,
`aria-hidden` and `tabindex` on hidden panels, the no-script `:target` list, RTL, the links, the photos and their sizes,
the layout and dimensions, the stage at rest, both themes.

## 8. Machinery after

Same 88 frames on the corrected build (EN/AR × light/dark × 1440 / 390, held at 0, 80, 150, 160, 240, 300, 450, 600, 720
and 900 ms and settled):

| Held at | Views with words below AA | Words below AA | Worst ratio | Words below full opacity | axe findings | Views with two machines' words |
| --- | --- | --- | --- | --- | --- | --- |
| every time, 0 → 900 ms and settled | 0 / 8 | 0 | 5.074 (light) / 6.047 (dark) | 0 | 0 (any rule) | 0 |

From the first held frame (0 ms) the coming machine's words are drawn at full strength and are the only machine words on
the stage; the leaving machine's photo fades out under them (180 ms) while the coming photo fades in (after 80 ms) and
settles; the specification row rises 8 px at full strength. The spec (item 14) holds the change at 0, 80, 150, 160, 300,
450, 600 and 900 ms and settled and checks exactly one machine's words (the panel chosen), the focus ring on the pick,
axe, cumulative opacity and per-pixel AA in each frame. Settled, the stage is pixel-identical to the baseline (item 26).

## 9. Generic reveal audit

Census rows 3 and 4: 380 default and 108 "fade" reveals per language hold words (1,230 `data-reveal` / `data-enter`
elements across the 52 addresses × EN/AR were classified). Held on the baseline at 0, 35, 70, 175, 350, 525 and 700 ms
of a reveal's own run (its stagger delay counted) and settled — a default reveal on the homepage ("Who we are") and
About, a "fade" one on the homepage and Laser Cutting — in EN/AR × light/dark at 1440 × 900, 390 × 844 and 320 × 700
(384 frames):

| Held at | Default: views below AA / words / worst | "Fade": views below AA / words / worst | axe colour-contrast (both) |
| --- | --- | --- | --- |
| 0 ms | 0 / 0 / — (nothing drawn yet) | 0 / 0 / — | 0 |
| 35 ms (5 %) | 24 / 88 / 1.140 | 24 / 24 / 1.385 | 76 nodes |
| 70 ms (10 %) | 24 / 78 / 1.566 | 24 / 24 / 1.917 | 75 nodes |
| 175 ms (25 %) | 12 / 14 / 3.779 | 6 / 6 / 4.228 | 161 nodes |
| 350, 525, 700 ms and settled | 0 | 0 | 0 |

234 words below AA in 114 frames, worst 1.140:1, at all three widths and in both languages and themes. **Fixed** (item
10). On the corrected build the same 384 frames hold 0 words below full opacity and 0 below AA (worst 6.755:1 default /
7.973:1 "fade"), 0 colour-contrast findings. Final pixels are unchanged (item 26). The only axe findings left in those
frames are `target-size` on three of the homepage's capability-strip links partly under the sticky header at that scroll
position, in EN at 320 px and AR at 390 px: identical on the baseline, in every frame of those views including the
settled one, so they come from the scroll position, not the motion (item 14).

## 10. Reveal changes

CSS only, in `commerce.css`'s reveal block. The reveal system stays (the observer, `data-reveal`, `data-shown`, the
stagger, the 18 px rise, 700 ms, `--ease-out`, the clip reveal, the inner heroes shown with the first paint):

- **Words never fade.** `.js [data-reveal]` keeps `opacity: 0` until the element's turn, but its opacity no longer
  transitions over 700 ms: `opacity 0s` with the element's own stagger delay (`transition-delay: var(--d)`). At its turn
  the element shows whole, at full strength, and rises 18 px into place (`transform`, 700 ms, unchanged). A "fade"
  reveal (no rise) simply appears at its turn.
- **What holds no words still fades in**, exactly as before (`opacity` and `transform` 700 ms with the stagger delay):
  the service drawings and signatures (`.sv-draw`, `.sv-axis`, `.sv-cut-sheet`, `.sv-plate-stage`, `.sv-row-sig`,
  `.sv-cycle-return`), photos without a caption (`.ip-figure:not(:has(figcaption))`) and the logo-only tiles of the
  homepage wall and About (`#client-wall > li`, `.ab-logos > li`). This rule sits in `@media (prefers-reduced-motion:
  no-preference)`.
- A wrapper that holds both a photo and words (a card with its photo, a captioned figure) is treated as words: it shows
  whole and rises. No new animation was added to images inside cards (their hover transitions stay as they are).
- Final pixels are the same (the shown state is unchanged: opacity 1, no transform); before its turn an element is
  invisible as before (so the bottom band of the screen at rest is unchanged); without script nothing is hidden (`.js`);
  with reduced motion everything is shown at once (the existing rule).

## 11. Entrance audit

The homepage entrance (`[data-enter]`, 8 items, `a2-rise` 900 ms with delays 0–420 ms) faded every hero word in from 0
(held on the baseline: 184 words below AA in 32 of 72 frames, worst 1.152:1 — "Peak fibre-laser power" at opacity 0.10
at 140 ms; axe found nothing in any of its frames — the per-pixel check found the failures). Fixed: the `a2-rise`
keyframes keep only the 18 px rise. Every hero word is now at full strength from the first paint and rises into place on
the same timing; the hero's geometry at rest, the plate (its own rise and its 10 s loop, `HeroPlate.tsx` unchanged) and
the capability strip's place are unchanged. The largest paint is no longer held back by the fade (item 25).

## 12. Menu and dropdown audit

Both opened with a fade from 0 (`a2-pop` 320 ms: fade, 6 px drop, scale from 0.985; `a2-sheet` 320 ms: fade, 8 px drop):
at 30 ms every word in them was below AA and at 80 ms (25 %) some still were (held on the baseline: the dropdown 76
words below AA, the sheet 103, worst 1.136:1 for both; item 15). Fixed: both keyframes keep only their transform — the
panel opens whole, its words at full strength, and settles into place on the same 320 ms. Nothing else in the menus
changed: `details`/`summary` semantics, Escape, outside click, focus return, closing when focus leaves, the page scroll
lock, the sheet's own scroll area and its quote button, keyboard order, RTL, forced colours.

## 13. Other systems

- **The homepage project cards' label** ("View in the gallery", `.a2-proj-cta`) faded in over 320 ms on hover or
  keyboard focus (1.21:1 at 30 ms, 3.01:1 at 80 ms): it now shows at once, at full strength, and rises 6 px (its opacity
  no longer transitions). Hover and keyboard focus still show it alike (`:hover`, `:focus-within`); on touch screens it
  is always shown, as before.
- **The machine selector's power badge** (found by axe in the held frames of the machine change on dark phones, after
  the machinery fix): its colour transition blended the figure's colour into its own fill (1.33:1 at 80 ms). It now
  swaps at once. This is a colour transition, not an opacity one; it is fixed because it sits inside the interaction
  this correction covers.
- **Other colour transitions** that change a text's colour and its fill together were then held at 25, 50 and 75 % of
  their run and their colours read (EN light and dark): the header links, the primary and secondary buttons, the
  Industries service tags and the legal contents links stay at or above 5.38:1 throughout. Two do not: the Projects
  filter chip when pressed (1.74:1 light, 1.65:1 dark at 25 % of 180 ms) and the certificate plate's "open" label on
  hover (2.14:1 at 50 %, light). They are colour, not opacity, motion — outside the census — so they are reported for
  the user's decision (item 41), not changed.
- **View transitions** (theme switch, projects filter, EN ⇄ AR): excluded by the brief (item 5).
- Nothing else in the census holds words that fade.

## 14. Held-frame axe results

axe-core 4.13.0 (the declared dev dependency; WCAG 2.0–2.2 A/AA + best practice) on every held frame.

- **The probe** (628 frames per build, the six systems, EN/AR × light/dark × 1440 / 390, reveals also 320): baseline —
  colour-contrast (serious; no critical finding) in 108 frames, 390 nodes: the machine change 26 frames / 65 nodes, the
  reveals 73 frames (312 nodes), the dropdown 2 / 2, the sheet 7 / 11 (the entrance and the project label: none, though
  every one of their words was below AA part-way — the per-pixel check found them). Corrected — **0 colour-contrast
  findings and 0 critical findings in all 628 frames.** The one rule left is `target-size` (serious) in 32 frames, the
  same 32 on the baseline: the homepage reveal views at 320 px (EN) and 390 px (AR), where the scroll position that
  brings the "Who we are" block into view leaves three capability-strip links (`.a2-quick`: CNC bending, laser
  engraving, scaffolding) partly under the sticky header (axe: "partiallyObscured", 13.5–23.3 px of them visible). It is
  in every frame of those four views, settled included, on both builds: a scroll-position finding, not motion, and
  outside this correction (the header and the strip are unchanged). The spec's reveal frames (About and Laser Cutting)
  and every other spec frame expect axe to return nothing at all, and pass.
- **The spec** (`e2e/commerce-motion-contrast.spec.ts`, 54 tests): `expect(await axe(page)).toEqual([])` — no violation
  of any rule or impact — in every held frame: 12 correction 1 tests (Capabilities, certificate dialog) and 42 new ones
  (item 15 lists them). On the corrected build 54 / 54 pass (and again in the full suite, item 39). Run against the
  baseline build (the same file, unchanged), it fails 41 of its 42 new tests, each at its first failing frame: the 12
  reveal tests (at the reveal's first frame its words were still at opacity 0, the fade's start), the 8 machine tests
  (two machines' words), the 8 entrance tests (the items' opacity), the 4 dropdown and 4 sheet tests (words below full
  strength), the 4 project-label tests (the label not shown at full strength) and the no-script test (right after a pick
  the first machine was still drawn, fading out, beside the chosen one). The 13 that pass there are correction 1's 12
  and the reduced-motion test (the baseline was already immediate with reduced motion).

## 15. Per-pixel contrast results

Method (correction 1's, unchanged): each held frame; the scope's text (itself, its descendants and their
pseudo-elements) hidden with transitions off; the frame captured; each visible text's colour, multiplied by its opacity
through every ancestor, composed over every pixel under its glyph boxes (clipped to overflow ancestors, stopping at a
modal dialog or a fixed panel); the worst pixel's ratio, unrounded, against 4.5:1 (3:1 for large text: ≥ 24 px, or ≥
18.66 px bold). Text inside an `aria-hidden` SVG drawing (the hero plate's "RW—01" label, its own decorative rise) is
not counted.

| System | Baseline: words below AA (worst) | Corrected: words below AA (worst) | Corrected: words below full opacity |
| --- | --- | --- | --- |
| Homepage machine change | 625 (1.000) | 0 (5.074) | 0 |
| Scroll reveals | 234 (1.140) | 0 (6.755) | 0 |
| Homepage entrance | 184 (1.152) | 0 (5.443) | 0 |
| Services dropdown | 76 (1.136) | 0 (5.473) | 0 |
| Phone menu sheet | 103 (1.136) | 0 (5.443) | 0 |
| Project card label | 8 (1.205) | 0 (5.363) | 0 |
| **All 628 frames** | **1,230 in 218 frames** | **0** | **0** |

The spec's 42 new tests (each frame: axe, cumulative opacity = 1 for every text shown, per-pixel AA, the right text set,
the focus ring where there is one):

| Test | Views | Held at |
| --- | --- | --- |
| Scroll reveals (a default reveal on About, a "fade" one on Laser Cutting; the reveal's own words counted) | EN/AR × light/dark × 1440, 390, 320 (12) | 0, 175, 350, 525, 700 ms of the reveal's own run and settled; a fresh document per frame |
| Homepage machine change (one machine's words only: the chosen panel; the pick's focus ring drawn) | EN/AR × light/dark × 1440, 390 (8) | 0, 80, 150, 160, 300, 450, 600, 900 ms and settled |
| Homepage entrance (the 8 items at opacity 1) | same (8) | 0, 70, 140, 330, 660, 990, 1,320 ms and settled |
| Services dropdown (≥ 8 words; its button's focus ring) | EN/AR × light/dark × 1440 (4) | 0, 80, 160, 240, 320 ms and settled; a fresh document each |
| Project card label ("View in the gallery" shown, on keyboard focus) | same (4) | 0, 80, 160, 240, 320 ms and settled; two cards in turn |
| Phone menu sheet (≥ 8 words; its button's focus ring) | EN/AR × light/dark × 390 (4) | 0, 80, 160, 240, 320 ms and settled; a fresh document each |
| Reduced motion: the entrance, a machine change, the dropdown and a reveal start nothing and show every word | EN, AR at 1440 (1) | at once |
| Without script: one machine at a time (the first, or the one the address names), at full strength | EN, AR at 1440 (1) | — |

## 16. EN / AR

Probe, both languages alike (314 frames each): baseline EN 615 words below AA in 109 frames (worst 1.000), AR 615 in 109
(worst 1.000); corrected EN 0, AR 0 (worst 5.074 both), 0 words below full opacity. Arabic keeps its faces (Tajawal
headings, IBM Plex Sans Arabic text), no letter-spacing, right-to-left order, the machinery's selector and panels
mirrored as before; the entrance and reveals rise the same way (vertical only); the dropdown and the sheet open from the
same side as before. The spec runs every system in both languages.

## 17. Light / dark

Baseline light 659 words below AA in 118 frames, dark 571 in 100 (worst 1.000 both); corrected 0 and 0 (worst 5.074
light, 5.363 dark). axe on the baseline flagged more machine nodes in dark (9–15 per view against 4–5 in light). The
spec runs every system in both themes.

## 18. Desktop / phone

Baseline 1440: 591 words below AA in 94 frames; 390: 557 in 86; 320 (reveals): 82 in 38 (worst 1.000 / 1.000 / 1.143).
Corrected: 0 / 0 / 0 (worst 5.074 / 5.074 / 6.755). The dropdown exists from 1280 px (desktop), the sheet below it
(phones); the machinery and the entrance at both; the reveals at all three.

## 19. Reduced motion

Stage 1I's gate holds; nothing in this correction runs with reduced motion. On both builds, EN/AR × 1440 / 390, with
`prefers-reduced-motion: reduce` from the first paint:

| Check | Baseline | Corrected |
| --- | --- | --- |
| Homepage entrance | no `a2-rise`; all 8 items at opacity 1 | the same |
| Hero plate | static finished plate (no cycle, nothing running, opacity 1) | the same |
| Pointer | system cursor (`data-cursor-on` never set) | the same |
| Machine change | immediate: no animation on the stage, one machine shown; the picks' own colour and shadow changes (12 transitions, unchanged) and **the two power badges' colour transitions (12 more)** | immediate: no animation on the stage, one machine shown; the picks' 12 transitions only — the badges swap at once |
| Machine change held at 0 ms (same task, every new animation paused at 0) | — | differs from the baseline in exactly two regions, the two power badges (71 × 21 px each at 1440; one badge in view at 390): the intended instant swap |
| Machine change finished | — | **identical to the baseline** in all 4 views |
| A reveal scrolled into view | opacity 1, no transform, nothing started | the same |
| Project label on keyboard focus | opacity 1 at once, nothing started | the same |
| Dropdown (1440) / sheet (390) opened | open, opacity 1, no `a2-pop` / `a2-sheet` started | the same; the frame right after opening **identical** to the baseline in all 4 views |

The spec's reduced-motion test (item 15) checks the same on the corrected build: no `a2-rise`, the 8 items at opacity 1,
no animation on the stage after a machine change and one machine's words, no animation in the dropdown, no reveal
animation, every word at full strength and AA. The existing reduced-motion tests (`commerce-motion.spec.ts`: reduced
motion from the first paint on 11 pages and turned on while a page is open; `stage-1c.spec.ts` and the other specs'
reduced-motion tests) ran unchanged in the full suite (item 39).

## 20. Forced colours

Both builds, forced colours with the light palette (EN) and the dark palette (AR), 1440 and 390:

| Check | Baseline | Corrected |
| --- | --- | --- |
| The chosen machine in the homepage selector | **no mark** once focus leaves it (forced colours drop its tint, orange edge and shadow) | a 3 px ring in `Highlight` (`::after`, `forced-color-adjust: none`) and its name and power underlined — opacity is never the state signal |
| Keyboard focus on a pick | 2 px solid system-colour outline, `:focus-visible` | the same (drawn with the ring around it) |
| Services dropdown (1440) / phone sheet (390) open | open, opacity 1, 1 px solid border, system background; the sheet underlines the current page | the same |
| Links, buttons, text | system colours, unchanged | unchanged |

The existing forced-colours tests (the TM-3 polish spec, the company and project-detail specs, correction 1's) ran
unchanged in the full suite.

## 21. No-JS

Both builds without JavaScript, EN/AR × 1440 / 390, on 14 pages (the homepage, About, the services overview, Laser
Cutting, Metal Fabrication, Steel Structures, Scaffolding, Industries, Clients, Certificates, Contact, Capabilities,
Projects and a project page):

- **Every `data-reveal` and `data-enter` element is visible at opacity 1** on every page, both builds (the reveal rules
  sit under `.js`, which only the boot script sets; nothing waits for an attribute the script sets).
- **Homepage machinery:** the first machine shows at load; choosing a machine (a plain `#id` link) shows **exactly that
  machine** on the corrected build. The baseline drew two machines for 600 ms after a pick (the leaving panel fading out
  at 0.48 beside the chosen one at 0.52 — the same defect without script).
- **Dropdown and sheet:** `details` disclosures open with all their links (8 / 19), at full opacity at once on the
  corrected build (the baseline's opened panel was still fading in when read).
- The spec's no-script test (item 15) checks the machinery in EN and AR.

## 22. Keyboard / focus

- Held frames keep the focus visible: the machine pick's focus ring in every frame of the machine change (spec: `ring`
  and `:focus-visible` checked at 0 → 900 ms and settled), the Services button's ring in every dropdown frame, the menu
  button's ring in every sheet frame, and the project card label shown by keyboard focus in every frame.
- Hover and keyboard focus stay equivalent: the project label shows on `:hover` and `:focus-within` alike (and always on
  touch screens); the pick, dropdown and sheet behave as before; `commerce-motion.spec.ts`'s focus-equals-hover tests
  ran unchanged in the full suite.
- Menus keep `details`/`summary`, Escape, outside click, focus return and closing when focus leaves (no script changed).
- In forced colours the chosen machine now has a non-focus mark too (item 20).

## 23. fps

Headless Chromium (software compositing, the worst case), the mouse off the page, every action from inside the page,
both builds alternately; 3 runs × EN/AR = 6 measurements per row; frames = `requestAnimationFrame` intervals over the
window. Target ≥ 55 fps.

| Scene | View | Baseline: mean fps (lowest run) · p95 · worst frame | Corrected: mean fps (lowest run) · p95 · worst frame |
| --- | --- | --- | --- |
| Homepage scrolled top to bottom (8.5 s) | 1440 | 58.6 (58.1) · 16.8 ms · 50.1 ms | **58.8 (58.1)** · 16.8 ms · 50.1 ms |
| | 390 | 60.0 (59.9) · 16.7 ms · 33.3 ms | **60.0 (60.0)** · 16.8 ms · 16.8 ms |
| Homepage: a machine every 700 ms (8.4 s, 12 changes) | 1440 | 59.7 (58.5) · 16.7 ms · 233.3 ms | **60.0 (59.9)** · 16.7 ms · 33.3 ms |
| | 390 | 60.0 (59.8) · 16.7 ms · 49.9 ms | **60.0 (60.0)** · 16.8 ms · 16.8 ms |
| Services dropdown opened / closed every 500 ms (8 s) | 1440 | 59.7 (58.0) · 16.7 ms · 216.7 ms | **59.9 (59.6)** · 16.7 ms · 50.0 ms |
| Phone menu sheet opened / closed every 600 ms (8.4 s) | 390 | 59.9 (59.4) · 16.7 ms · 66.6 ms | **60.0 (59.9)** · 16.7 ms · 33.3 ms |

Every run of every scene is at or above 58 fps on both builds; the corrected build is equal or slightly ahead in each
row, within the runs' spread (its machine panels, menus and entrance no longer animate opacity). Properties animated in
these windows, on both builds: transforms (`transform`, `translate`, `scale`, `rotate`), `opacity` (photos, the
ambient), colours and shadows, `clip-path`, SVG strokes, `visibility` and `--spot-x` — the same set, **no layout
property, no `filter` or `backdrop-filter`**. Layout shift in every window: 0.

## 24. Long tasks

In the measured interaction windows (72 windows in all): **none on the corrected build**; the baseline had one each in
two windows (218 ms during a machine change, EN 1440, run 3; 101 ms during the dropdown, AR 1440, run 1), not repeated
in its other runs. On load, before any interaction (hydration), both builds show the same pattern: 2–5 long tasks per
load (median 3 at 1440, 2 at 390); total per load at 1440 mean 324 ms (corrected) vs 318 ms (baseline), at 390 274 vs
250 ms, with standard deviations of 78–119 ms over 18 loads each — no difference beyond the spread. No JavaScript
changed (item 4).

## 25. CLS / LCP

Arabic font loading untouched, as the brief says. Fresh context per load (no cache), 3 loads per build and row, medians;
CLS = the sum of the shifts without input within 2.5 s of load, the maximum over the loads:

| Page · view | Baseline: LCP (element) · FCP · CLS | Corrected: LCP (element) · FCP · CLS |
| --- | --- | --- |
| `/en` · 1440 | 292 ms (header quote button) · 292 · 0 | **280 ms (the hero title)** · 280 · 0 |
| `/ar` · 1440 | 448 ms (header quote button) · 448 · **0.0390** | **384 ms (the hero title)** · 384 · **0.0459** |
| `/en` · 390 | 208 ms (header quote button) · 208 · 0 | **204 ms (the hero title)** · 204 · 0 |
| `/ar` · 390 | 324 ms (header quote button) · 324 · 0 | **332 ms (the hero title)** · 332 · 0 |
| `/en/about` · 1440 / 390 | 1,168 (`p.ab-lead`) / 184 ms · 284 / 184 · 0 / 0 | 1,192 / 176 ms · 272 / 176 · 0 / 0 |
| `/ar/about` · 1440 / 390 | 308 / 280 ms · 308 / 280 · 0.0075 / 0 | 348 / 252 ms · 348 / 252 · 0.0075 / 0 |
| `/en/services` · 1440 / 390 | 1,028 / 168 ms · 208 / 168 · 0 / 0 | 1,052 / 168 ms · 244 / 168 · 0 / 0 |
| `/ar/services` · 1440 / 390 | 1,120 / 204 ms · 268 / 204 · 0.0037 / 0 | 1,136 / 224 ms · 288 / 224 · 0.0037 / 0 |
| `/en/services/laser-cutting` · 1440 / 390 | 248 / 164 ms · 248 / 164 · 0 / 0 | 272 / 168 ms · 272 / 168 · 0 / 0 |
| `/ar/services/laser-cutting` · 1440 / 390 | 352 / 276 ms · 352 / 276 · 0.0198 / 0 | 344 / 272 ms · 344 / 272 · 0.0198 / 0 |
| `/en/capabilities` · 1440 / 390 | 256 / 180 ms · 256 / 180 · 0 / 0 | 268 / 192 ms · 268 / 192 · 0 / 0 |
| `/ar/capabilities` · 1440 / 390 | 344 / 264 ms · 344 / 264 · 0.0046 / 0 | 348 / 288 ms · 348 / 288 · 0.0046 / 0 |

- **Hero text is not delayed — it is visible from the first paint.** On the homepage the largest paint is now the hero
  title at the first contentful paint (280 / 384 / 204 / 332 ms). On the baseline the title was still at opacity 0 at
  that paint and never became the largest paint (the header's quote button did). The other pages' LCP and FCP moved by
  −40 to +40 ms in either direction, within the spread of three loads. The English About page and both services
  overviews at 1440 keep their largest paint in the section under the hero (its reveal waits for the script, as before:
  1.0–1.2 s, a known item since TM-3).
- **CLS: identical on every page and view but one.** On the Arabic homepage at 1440 it is **0.0390 on the baseline and
  0.0459 on the corrected build**, the same on every load (6 more loads each with the shift's sources recorded: 0.03897
  every time vs 0.04587 every time). It is one shift, at 400–500 ms, when the Arabic faces (not preloaded — the Stage 1J
  item) replace the fallback and the hero's lower part moves down 62–72 px. Its geometry is the same on both builds. On
  the baseline the entrance's items were still fading in from opacity 0 at that moment and Chromium did not count them:
  its entries name the capability strip's container, the header's quote button, the hero's reading zone and two other
  boxes. On the corrected build those items are drawn at full strength, and the strip (`nav.a2-strip`) and the
  statements list (`ul.a2-trust`) are counted too. So this correction adds no movement, but the existing movement is now
  scored more fully (+0.0069). It stays far below 0.1 ("good"), and the fix is the Arabic font preload of Stage 1J
  (per-language root layouts), not touched here. **It is reported as the one measured worsening** (item 41).
- No layout shift in any interaction window (item 23).

## 26. Resting pixel regression

Method (`rest.js`): the baseline build (`577b54f`) and the corrected build side by side, the same steps on each: a fresh
context, the stored theme, the page walked top to bottom (lazy images loaded and decoded), then screen by screen: each
screen scrolled to, transitions waited out, every finite animation finished and paused until nothing runs for four
frames; with motion allowed, the decorations on their own clocks hidden on both builds (the ambient, the scan lines, the
hero's looping plate and readout — the reduced-motion captures show them still). Compared byte for byte.

**88 views, 778 screens:** the homepage in EN/AR × light/dark × 1440 × 900 / 390 × 844, each settled with motion
allowed, with reduced motion, and with a machine chosen and settled (both modes) — 32 views; About, the services
overview, Capabilities, Projects, Certificates, Contact and a project page (`clock-tower-landmark`) in the same 8
combinations, settled — 56 views.

**765 of 778 screens are identical; 79 of 88 views in every screen** — every inner page except the services overview,
the homepage settled with reduced motion, the homepage with a machine chosen and motion allowed, and the homepage with
motion allowed except one screen. **9 views differ, in 13 screens**, by a few pixels at rounded corners or in one
drawing's glow:

| View (screens) | Plain difference | Same build against itself (repeated runs) | Drawn afresh (scroll away and back) |
| --- | --- | --- | --- |
| Homepage, a machine chosen, reduced motion — 1440 EN light, EN dark, AR light, AR dark; 390 AR dark (1 each) | 15 / 43 / 70 / 68 / 3 px, at most 1–3 levels of 255, at the corners of the chosen and previous picks and their power badges | EN dark: the baseline 42 px and the corrected build 29 px against themselves, at the same corners | **identical** in 4 of 5 (EN dark still 13 px ≤ 2 levels at the same corners: the view that also varies within each build). In AR light / AR dark the baseline's plain capture differs from its own fresh one by exactly the 70 / 68 px, and its fresh capture equals the corrected build's plain one |
| Homepage, motion settled, 1440 EN light (screen 3 of 9) | 9,679 px, ≤ 28 levels: the laser-cutting drawing's heat glow on its outer contour | In another run the corrected build reproduced the baseline's capture byte for byte (and both builds' plain captures differ from their fresh ones by the same 9,679 px) | **identical** (all 9 screens) |
| Services overview, 1440 EN light, EN dark, AR dark (3, 3 and 1 screens) | 1–2 px, ≤ 10 levels: the corners of the contents list's current row | Both builds differ from themselves by the same 1–2 px at the same corners (baseline EN dark, AR dark; corrected EN light, AR dark) | 2 views still differ by 1–2 px at those corners — the same noise |

So every difference is either run-to-run rendering noise that each build shows against itself, or the baseline's own
leftover paint: after the base build's colour transition on the power badge (removed here), Chromium's incremental
repaint left corner pixels a level or two apart from the same state drawn afresh — in AR light and AR dark the corrected
build's plain capture already equals the fresh drawing, and the baseline's fresh drawing equals it. A second repaint
method (the window 1 px wider and back) also gave identical pixels on all 9 views (36 screens), but it re-picks the
machine thumbnails' image candidates on both builds, so the scroll method is the one quoted. **The resting state is
unchanged.** `rest.js` (with `PORTS` for self-comparisons and `REPAINT=scroll` / `REPAINT=1`) is kept in the session's
proof folder; the homepage comparison sheet is evidence 12.

## 27. Correction 1 regression

Correction 1's own held-frame probe, unchanged, on the corrected build: the Capabilities machine change (0, 80, 160,
240, 320, 480, 600 ms and settled) and the certificate dialog's opening (0, 80, 160, 240, 320 ms and settled) and
closing (0, 80, 160, 240, 320 ms), EN/AR × light/dark × 1440 / 390 — **152 frames: 0 texts below AA, 0 texts below full
opacity, 0 axe violations of any impact, one machine's words in every frame, the focus kept** (worst ratios 4.776 on
Capabilities, 5.633 in the dialog). Frame for frame it equals correction 1's own approved run: the same texts in the
same order in all 152 frames and identical worst ratios. Its 12 spec tests pass (item 39). No rule of the console or the
dialog changed (the CSS diff touches neither; item 4).

## 28. Stage 1E regression

`commerce-capabilities.spec.ts`: 72 of 72 passed in the full run (item 39). The Capabilities page's markup, page data
and script are byte-identical (12 prerendered files, item 4's freeze proofs) and its own stylesheet (`capabilities.css`,
26,515 bytes) is byte-identical; the shared MC sheet's changed rules match nothing on it except the reveals (its
`[data-reveal]` elements now show whole and rise instead of fading) and the header's menus. Resting pixels: 8 of 8 views
identical (68 screens, item 26). Correction 1's console frames are unchanged (item 27). The homepage's machine links
into Capabilities are unchanged and tested.

## 29. Stage 1F regression

`commerce-project-detail.spec.ts`: 33 of 33 passed in the full run. All 476 prerendered project-page files are
byte-identical and their stylesheet (`project-detail.css`, 4,180 bytes) and JS are identical; on these pages the changed
rules reach only the reveals below the hero (the closing call to action) and the header's menus. Resting pixels of the
project page (`clock-tower-landmark`): 8 of 8 views identical (32 screens).

## 30. Project-media safety

No content, media, route or metadata changed: `git diff 577b54f -- public src/content src/lib src/i18n src/proxy.ts` is
empty and the only files changed under `src/` are the two stylesheets. The withheld, flagged and AI-watermarked photos
stay where Stage 1F put them; `commerce-project-detail.spec.ts`'s photo rule by flag (including a flag added later), the
per-page request checks and the "no note or flag anywhere" checks, and `commerce-projects.spec.ts`'s withheld-photo
checks pass in the full run. Photos that the reveals fade in (uncaptioned figures) still fade; no image got a new
filter, transform or size.

## 31. Certificate hashes

The eight redacted files are byte-identical: `git diff 577b54f -- public` is empty, and `commerce-certificates.spec.ts`
checks the SHA-1 of each file on disk and of each served response against its fixed values
(`commercial-activity-licence(.webp, -thumb.webp)`, `commercial-registration-{ar,en}(.webp, -thumb.webp)`,
`vat-registration(.webp, -thumb.webp)`): 17 of 17 passed in the full run. The dialog and its previews are untouched
(item 27).

## 32. Theme Lab regression

No lab file changed (`src/app/theme-lab/**`, `src/components/theme-lab/**`); its 96 prerendered files, its stylesheet
(`lab.css`'s build: same file name and bytes) and its JS are identical (item 4). The lab keeps its own copies of the
keyframes (`a2-pop`, `a2-rise` with their fades): the brief's frozen reference is not edited. `theme-lab.spec.ts` and
`theme-lab-a-v2.spec.ts`: 45 of 45 and 39 of 39 passed in the full run.

## 33. `npm audit`

Exit 1: **5 high-severity findings, all one development chain** — `braces` (GHSA-vfj7-8cjw-p6xm) → `micromatch` →
`fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`, fixable only with `npm audit fix --force` (a breaking
downgrade to `eslint-config-next@14.2.35`), not run. The same finding as Stage 1I and correction 1.

When this correction's commands were first run, `npm audit` also reported **two new production advisories** published
after correction 1 (its production audit was 0 on the same lockfile): GHSA-wq5f-xc86-pv6w (`sharp` < 0.35.5, its bundled
librsvg) and GHSA-68fv-2mgg-jv7q (`source-map-js` 1.0.0–1.2.1, CVSS 7.5) — 7 high in all. `npm audit fix` **without**
`--force` cleared them by updating the lockfile only: `sharp` 0.35.4 → 0.35.5 (its platform binaries; libvips 1.3.3 →
1.3.4) and `source-map-js` 1.2.1 → 1.2.2 — 28 lockfile entries changed in version and hash, none added or removed,
`package.json` unchanged, no new dependency (commit `f492577`, on its own). Proof that nothing served changed: the build
after it is identical to the build every measurement ran on (all prerendered files but one `next-size-adjust` position,
all 38 static JS and CSS files byte-identical), and **all 1,484 optimized images the pages reference are
byte-identical** fetched from the old `sharp` (the baseline server) and the new one, both with empty image caches.

## 34. `npm audit --omit=dev`

Exit 0: **`found 0 vulnerabilities`** (after the lockfile patch above; before it, the two advisories made it 2 high).

## 35. `npm ci`

Exit 0: "added 374 packages, and audited 375 packages", from the patched lockfile (run first on the unpatched one with
the same counts). `npm ls axe-core`: 4.13.0, the declared dev dependency (deduped under `eslint-plugin-jsx-a11y`); no
dependency added.

## 36. `npm run lint`

Exit 0, no warnings.

## 37. `npm run typecheck`

Exit 0 (`next typegen` + `tsc --noEmit`).

## 38. `npm run build`

Exit 0: compiled, 125 static pages generated (after `npm ci`, on `f492577`). Compared with the baseline build
(`577b54f`): 804 of 806 prerendered files byte-identical after normalising build ids and hashed paths, and the other two
(`en/about.html`, `ar/about.html`) differ only in where Next.js placed `<meta name="next-size-adjust">` inside `<head>`
(a known build-to-build position change; the visible markup and page data are identical); all 25 JS chunks identical; 12
of 13 stylesheets identical (the Theme Lab's and every page sheet included) and the shared MC sheet different by exactly
the intended rules (12 removed, 20 added, +1,032 bytes); every page keeps its stylesheet list.

## 39. E2E

`npm run test:e2e`: Playwright's own `next start` on the build of item 38 (`f492577`, no server left running before), 3
workers, nothing else running, **no retries** (`playwright.config.ts` sets none, so a test that fails once counts as
failed and "flaky" cannot occur). Started 2026-10-06 17:47:01 UTC.

| Run | Tests at | Total | Passed | Failed | Skipped | Flaky | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Final | `f492577` | 587 | **587** | **0** | **0** | **0** | 20.4 min |

587 = correction 1's 545 + the 42 new tests of `commerce-motion-contrast.spec.ts`. Per spec: anchors 15, capabilities
72, certificates 17, company 22, contact 34, home 25, inner 20, motion-contrast 54, motion 22, polish 37, project-detail
33, projects 52, services 58, site 14, stage-1c 28, theme-lab-a-v2 45, theme-lab 39 — every spec passed in full.

Runs before the final one (on the corrected build, the same CSS):

| Run | Result |
| --- | --- |
| `commerce-motion-contrast.spec.ts`, corrected build | 54 / 54 passed (5.8 min) |
| The same spec against the baseline build (`E2E_BASE_URL=http://localhost:3401`) | 41 failed, 13 passed, as intended: it detects every system of the census (item 14) |

No test was skipped, quarantined, given retries or loosened, and no other test file changed. In
`commerce-motion-contrast.spec.ts` correction 1's 12 tests keep every assertion; three measuring corrections in the
helpers they share with the new tests apply to all 54 (item 15): a text's own box is hidden with its descendants when
the background under it is captured (before, a scope's own words were measured against themselves); glyph boxes are cut
to every ancestor that clips them, up to a modal dialog or a fixed panel (words scrolled out of the phone sheet are not
drawn, so they are not measured); and text inside an `aria-hidden` SVG drawing is left out (the hero plate's "RW—01"
dimension label, decorative SVG that the brief's census excludes and §5 freezes). Correction 1's 12 tests pass with them
on the corrected build and on the baseline (`577b54f`, which carries correction 1's fixes).

## 40. Evidence

Sixteen sheets (brief §26), sent with this report. Every held frame is the one measured in items 6–15: the change paused
at exactly T ms, with the words shown, those below full opacity, those below AA (per pixel, unrounded) and axe's serious
findings printed under each tile (green: none; red: failing).

| § 26 | Sheet | What it shows |
| --- | --- | --- |
| 1 | `01-machinery-before.png` | Baseline: the homepage machine change at 0, 80, 160, 300, 450, 600 ms and settled, EN light / AR dark × 1440 / 390 — whole panels cross-fading, two machines' words together, down to 1.00:1 |
| 2 | `02-machinery-after.png` | Corrected, the same frames: one machine's words at full strength in every frame; only the photo fades and rises |
| 3 | `03-machinery-0-25-50-75-100.png` | 0 / 25 / 50 / 75 / 100 % of the 600 ms change, baseline above corrected (EN light 1440, AR dark 390) |
| 4 | `04-reveal-held.png`, `04b-reveal-fade-held.png` | A default reveal (About) and a "fade" reveal (Laser Cutting, homepage) at 0, 35, 70, 175, 350, 525, 700 ms of their own run and settled, 1440 / 390 / 320 |
| 5 | `05-entrance.png` | The homepage entrance at 70, 140, 330, 660, 990 ms and settled (EN light 1440, AR dark 390) |
| 6 | `06-dropdown.png` | The Services dropdown opening at 0, 30, 80, 160, 320 ms and settled (EN light, AR dark, 1440) |
| 7 | `07-phone-menu.png` | The phone menu sheet opening, the same times (EN light, AR dark, 390) |
| — | `08-project-label.png` | The project card's label on keyboard focus, the same times (EN light, AR dark, 1440) |
| 8–10 | `09a-matrix-160ms-before.png`, `09b-matrix-160ms-after.png` | The machine change at 160 ms in all eight EN/AR × light/dark × 1440/390 combinations, both builds |
| 11 | `10-reduced-motion.png` | Reduced motion: the machine change held at 0 ms (the only difference: the power badges, which now swap at once), finished (identical), the menu just opened (identical) |
| 12 | `11-forced-colours.png` | Forced colours, both builds: the chosen machine (now ringed and underlined), the focus ring, the dropdown and the sheet |
| 13 | `12-resting-homepage.png` | The homepage at rest, both builds and their difference (motion settled, reduced motion, a machine chosen), plus the two kinds of difference found and their proofs (the baseline's own leftover paint; the laser drawing's run-to-run glow) |
| 14 | `13-c1-capabilities.png` | Correction 1's Capabilities machine change on the corrected build at 0, 80, 160, 320, 600 ms (EN light, AR dark) |
| 15 | `14-c1-certificate.png` | Correction 1's certificate dialog opening and closing on the corrected build (EN light, AR dark) |

The visual quality of the result is for the independent review; the builder does not sign it off.

## 41. Remaining Stage 1J items

Unchanged by this correction, all waiting for the user's word:

- Per-language root layouts so the Arabic fonts can be preloaded on Arabic pages (the Arabic CLS noted since TM-3;
  untouched here, as the brief says). It now also carries this correction's one measured worsening: the Arabic
  homepage's CLS at 1440 is 0.0459 instead of 0.0390, because the hero words that the late font swap moves are visible
  now rather than fading in (item 25); preloading the Arabic faces removes the shift itself.
- OG share images regenerated with the Modern Commerce faces (`scripts/generate-og.mjs`).
- Publication: page statuses from `review` to `published`, the sitemap, indexing, `robots`.
- Theme Lab removal (and dropping `lab-icon` from `Icon`), once authorized.
- RAWASY's own Google Maps place link; the photo, image-rights and AI-watermark questions in `docs/ASSET_INVENTORY.md`.
- The dev-tooling audit finding (item 33), if a non-breaking upgrade appears.
- The dictionary keys only the retired shell read (usage audit).
- For information: two production advisories published after correction 1 (`sharp`, `source-map-js`) were patched in the
  lockfile without `--force` (commit `f492577`, items 33–35); it changes nothing the site serves.
- New, for the user to decide (outside this brief, reported, not changed):
  - two **colour** transitions that swap a text's colour with its fill and pass through a blend of the two: the Projects
    filter chip when pressed (its label 1.74:1 light / 1.65:1 dark at 25 % of 180 ms) and the certificate plate's "open"
    label on hover (2.14:1 at 50 %, light). They are not opacity motion, so outside the census; the machine selector's
    power badge (the same pattern inside the machine change) was fixed here;
  - the **view-transition** cross-fades the brief excludes (the theme switch, the EN ⇄ AR page change; the projects
    filter's re-flow moves named cards only): a light ⇄ dark cross-fade blends the two pages for ~250 ms by
    construction;
  - axe's `target-size` "partially obscured" on three homepage capability-strip links when the page is scrolled so they
    sit under the sticky header on phones and at 320 px (item 14): a scroll-position finding, on both builds.

## Items needing RAWASY's confirmation

None new. The open questions are unchanged (`docs/ASSET_INVENTORY.md`): RAWASY's own Google Maps place link, photo and
image rights, the AI-watermarked and authorship-flagged images, licence renewal and registration details. Nothing in
this correction depends on them.

## Known limitations

- **CLS on the Arabic homepage at 1440: 0.0390 → 0.0459** (item 25). The movement is the one the late Arabic font swap
  always caused (Stage 1J's preload removes it); with the hero words no longer fading in, Chromium now counts them in
  the score. Below 0.1 ("good"); every other page and view is unchanged.
- **Colour blends outside this brief:** two colour transitions still swap a text's colour with its fill through a blend
  — the Projects filter chip when pressed (1.74:1 light / 1.65:1 dark at 25 % of 180 ms) and the certificate plate's
  "open" label on hover (2.14:1 at 50 %, light). They are colour, not opacity, motion, so the census left them out; they
  are reported for the user's decision (item 41). The machine selector's power badge, which does the same inside the
  machine change, was fixed here.
- **View transitions** (the theme switch's cross-fade, the EN ⇄ AR page change) blend two whole pages for about 250 ms
  by construction; the brief excludes these snapshots, and they are unchanged.
- **axe `target-size`** reports three homepage capability-strip links as partly covered by the sticky header when the
  page is scrolled so that they sit under it (phones and 320 px): a scroll-position finding on both builds, not motion.
- **The held frames are exact, real time is not:** the matrices hold each change at a chosen time and read the frame
  Chromium draws there. With no text opacity left in any of the eight systems, no frame is left in which words can be
  half-faded.
- **Unchanged from Stage 1I and correction 1** (not touched here): the Arabic font CLS (needs per-language root layouts,
  Stage 1J), the header's blur, the no-JS 404 body, the 200 % zoom header overflow below 320 CSS px, and the dev-tooling
  audit finding (item 33).

## How to run

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e                                        # starts next start on :3400 (or reuses it)
npx playwright test e2e/commerce-motion-contrast.spec.ts  # the held part-way frames only (54 tests)
E2E_BASE_URL=http://localhost:3401 npx playwright test e2e/commerce-motion-contrast.spec.ts  # against another build
```

To see it: `/en` — choose machines in the machinery section (the words change at once, the photo fades and rises),
scroll down (each block shows whole at its turn and rises), open Services (it opens whole and settles), focus a project
card with the keyboard (its label shows at once). DevTools → Animations can slow everything to 10 % to watch each frame.

## Next steps

- **Independent review** of Stage 1I correction 2.
- For the user to decide (item 41): the Arabic homepage's CLS change (resolved by the Stage 1J Arabic font preload), the
  two colour blends (Projects chip, certificate open label), the view-transition cross-fades, and the capability strip's
  target size under the sticky header.
- **Not started**, waiting for the user's word: Stage 1J, publication, indexing changes, sitemap expansion, OG
  regeneration, the Theme Lab's removal and deployment.

---

Stopped after Stage 1I correction 2. Not begun: Stage 1J, publication, indexing changes, sitemap expansion, OG
regeneration, Theme Lab removal, deployment. Returned for independent review.
