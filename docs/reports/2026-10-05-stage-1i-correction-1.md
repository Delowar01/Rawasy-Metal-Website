# Stage 1I — Correction 1: no transient text-contrast failures during motion (Capabilities + certificate dialog)

Date: 2026-10-05 · Branch: `claude/new-session-5eijs6` · Status: **built, returned for independent review** (not signed
off by the builder; nothing published or deployed; Stage 1J not begun).

## Summary

The review found that two Stage 1I interactions passed text through a contrast-breaking opacity: the Capabilities
machine change (a button at about 160 ms of 600 ms) and the certificate dialog (two preview labels at about 160 ms of
320 ms). Both were measured, held at exact times, before anything changed: the console cross-faded **whole panels**, so
at 160 ms every word of the incoming machine sat at opacity 0.507 (the "Laser Cutting service" button at **3.44:1**)
while the outgoing machine's words were still drawn — 268 texts below AA in 8 views, two machines' words in all 8; the
dialog faded **as a whole**, so at 160 ms its words sat at 0.802 over the dimmed page (the preview labels at **3.30:1**
and 3.40:1), and closing they fell to 1.00:1.

The fix is CSS only, in the two places, and keeps the motion: words are never faded any more.

- **Capabilities:** a panel is shown or hidden whole. The coming machine's words are at full strength from the first
  frame (its data rises 8 px); the leaving machine's words go at once, while its photo and floor line fade out in 180 ms
  under the new one; the coming photo fades in and rises, the floor line draws — the same 180 / 600 ms timings.
- **Certificate dialog:** it rises 12 px at full opacity while the backdrop fades in; closing, it goes at once while the
  backdrop fades out. Native `<dialog>`, `showModal()`, focus handling and the pointer hand-off are untouched.

Held at 0–600 ms in EN/AR × light/dark × desktop/phone, the corrected build has **0 axe violations of any impact in 152
held frames, 0 texts below AA and 0 texts below full opacity**, and one machine's words in every frame (Stage 1I: 150,
268 and 8 texts below AA at 80, 160 and 240 ms; up to 40 in the dialog). A new spec (`commerce-motion-contrast.spec.ts`,
12 tests) holds both changes part-way and checks axe, opacity and per-pixel AA in every held frame; it fails on the
Stage 1I build and passes on the correction. Nothing else changed: of 806 prerendered files 804 are byte-identical and 2
differ only in where Next.js put its `next-size-adjust` meta, all 25 JS chunks are byte-identical, the CSS differs by
exactly the 9 removed and 10 added motion rules, the resting pixels are identical (142 capture pairs with motion
settled, 141 + 1 run-to-run variation with reduced motion), reduced motion and forced colours behave as before, and both
interactions run at 57.6–60 fps (mean, every run; the dialog faster than before).

QA run: lint, typecheck, build, `npm ci`, both audits (production: 0 vulnerabilities), the full e2e suite on the final
build (**545 of 545**, no retries), the new spec on both builds, 152 held frames per build in the proof matrix, 75 held
frames per build in forced colours, reduced motion on both builds, 142 + 142 resting capture pairs, 56 frame-rate runs
and 40 traced runs, the freeze proofs (files, CSS rules, JS), and 8 evidence sheets.

---

## 1. Starting SHA

`ba64a1b638a3b16987d627d52da48685f3ea7746` ("Add the Stage 1I report"). Preflight, before any change: `git fetch` of the
branch and the checkpoint; `git status` empty (clean tree); branch `claude/new-session-5eijs6`; local HEAD = remote HEAD
= `ba64a1b`; `git ls-remote`: `preserve/pre-stage-1i` = `b1f4fe1a3076247c9302b2a4e72428dc40fda8d6`, unchanged; no source
drift — between the Stage 1I implementation `c2fb607` and `ba64a1b` nothing under `src/` changed (only `CLAUDE.md`,
`README.md`, the report and the test-only fix in `e2e/commerce-motion.spec.ts`). The Stage 1I implementation was not
rewritten: the correction is new commits on top.

## 2. Correction implementation SHA

`1f7b9fc7784a6f7b7cd459e5fbef86968af81132` — "Keep words at full strength through the console and dialog motion (Stage
1I correction 1)" (on `ba64a1b`): the two CSS changes, the new spec, the one replaced assertion in the 1E spec and the
axe-core dev dependency, together. No product file changed after it.

## 3. Branch HEAD

`ba64a1b` → `1f7b9fc` (implementation) → `8854198` (this report, `CLAUDE.md`, `README.md`) → documentation-only
follow-ups to this report (the last one is HEAD; a commit cannot name its own hash, so HEAD is given in the hand-off
message), all pushed to `origin/claude/new-session-5eijs6` without force. `preserve/pre-stage-1i` still points to
`b1f4fe1`.

## 4. Files changed

Product (2 files, CSS only — no markup, script, content, media, route or status change):

- `src/components/commerce/capabilities/capabilities.css` — the console's panel rules and its motion block (item 6).
- `src/components/commerce/system.css` — the certificate dialog's opening and closing block (item 8).

Tests and tooling (4 files):

- `e2e/commerce-motion-contrast.spec.ts` (new, 12 tests) — the held mid-transition frames (item 9).
- `e2e/commerce-capabilities.spec.ts` — one assertion replaced, two added (item 18).
- `package.json`, `package-lock.json` — `axe-core` `4.13.0` as a dev dependency (the version already in the lock through
  `eslint-plugin-jsx-a11y`; only the root `devDependencies` line was added to each file, so `npm ci` installs the same
  374 packages as before — item 31).

Documentation (report commit): this report, `CLAUDE.md` (status, the "words never fade" motion rule, the new spec, five
gotchas) and `README.md` (status line, the new spec).

## 5. Capabilities: root cause

The Stage 1I console changed machine by cross-fading **whole panels**. Each machine is an `article.cm-panel` holding its
stage (index chip, process sketch and its caption, photo, floor line, power readout, source chip, scan line) and its
data (name, category, capability sentence, the facts list, "Request a quote" and the "… service" button). The rules were
`.js .mc .cm-panel { opacity: 0; visibility: hidden }`, the shown panel `{ opacity: 1; visibility: visible }`, and, with
motion allowed once the console runs, `opacity var(--dur-1) ease, visibility 0s linear var(--dur-1)` for the panel
leaving (180 ms out) and `opacity var(--dur-3) var(--ease) 0.08s` for the panel coming in (600 ms in, after 80 ms).

Every word inherits its panel's opacity, so every word passed through every opacity between 0 and 1. Held exactly (item
9), the incoming panel's words were at opacity 0 until 80 ms, then 0.507 at 160 ms, 0.790 at 240 ms, 0.917 at 320 ms,
0.992 at 480 ms and 0.9996 at 600 ms; the outgoing words were still at 0.259 at 80 ms and 0.007 at 160 ms. At 160 ms the
"Laser Cutting service" button text (`#15171a`) drawn at 0.507 over `#f9f9f7` composes to `#858687`: **3.44:1** — the
failure the review found (axe: `#fiber-laser-3kw > .cm-data > .cm-actions > .btn-secondary`, 3.48:1). It was not alone:
in the 8 views at 160 ms, **268 texts** were below AA (worst 1.002:1), and **both machines' words were drawn at once in
all 8**. axe resolved only that one node as a failure: it cannot compute a background through stacked or translucent
layers and leaves such text as "needs review" (99 colour-contrast nodes on this page at 160 ms and 94 at rest, on both
builds — the header over the ambient included), so the per-pixel measurement of item 10, which reads every text against
the pixels drawn under it, is the stricter check, and the new spec runs both.

## 6. Capabilities: motion change

A panel is now shown or hidden **whole**, never faded: the panel rules lost their `opacity` (`visibility` and `z-index`
only), and the panel-level transitions are gone. What still moves is the media and one translate:

| Part | Machine coming in | Machine leaving |
| --- | --- | --- |
| Words (name, category, sentence, facts, buttons, chips, readout, caption) | Drawn at full strength from the first frame | Gone at once (the panel's `visibility: hidden`, no delay) |
| Data block (`.cm-data`) | Rises 8 px into place, `translate` 600 ms (`--dur-3`), unchanged rule | — |
| Photo | Fades in 600 ms after 80 ms and rises onto its floor in 900 ms (as before) | Fades out in 180 ms (`--dur-1`) under the new one: its `.cm-figure` keeps `visibility` for 180 ms (`visibility 0s linear var(--dur-1)`) |
| Floor line | Draws out from the centre (`scale` 900 ms), fades in 600 ms after 80 ms (as before) | Fades out in 180 ms, then hidden (same `visibility` delay) |
| Scan line, process sketch | One pass per showing, as before | Gone at once |

So the old machine's words never overlap the new one's, the timings the review asked to keep are kept (180 ms out — now
the photo and floor line, 600 ms in), and only translate (data, photo), scale (floor line) and the opacity of media
(photo, floor line) animate. Unchanged: the six machines and their facts, the address as the state (`#<slug>`,
`history.replaceState`, Back/Forward), the selector and its keyboard use, the live region, `inert` on hidden panels,
anchors and cold addresses, the no-JS list, the pre-hydration `:target` handover (immediate), reduced motion
(immediate), forced colours, layout. The CSS diff (built): 9 rules removed, 10 added, all in the console's and the
dialog's motion (item 23). The coming photo and floor line now carry the 80 ms delay themselves (the panel used to
supply it), so they still start after the leaving photo has mostly gone.

## 7. Certificate dialog: root cause

The dialog faded as a whole: `.mc .ct-dialog { opacity: 0; translate: 0 12px }`, `[open] { opacity: 1; translate: none
}`, `@starting-style { [open] { opacity: 0; translate: 0 12px } }` with `opacity var(--dur-2) ease` (320 ms) — in and
out, the closing one held in the top layer by the `overlay` / `display` transitions. Its surface is opaque at rest, but
at a partial opacity the dimmed page shows through it and every word in it is half-faded. Held exactly: opening, the
dialog was at 0.409 at 80 ms, **0.802 at 160 ms**, 0.960 at 240 ms; closing, 0.591 at 80 ms, 0.198 at 160 ms, 0.040 at
240 ms. At 160 ms of the opening the two preview labels ("English version", "Arabic version", `#454a50`) composed to
`#5c6165` / `#5d6166` over `#bbbcba` / `#bfc0be`: **3.30:1 and 3.40:1** (EN light, desktop) — the two labels the review
found. In the 8 views: 37 texts below AA at 80 ms (worst 1.237), 16 at 160 ms (worst 2.842) on opening; 34, 40 and 40 at
80, 160 and 240 ms on closing (worst 1.000); axe flagged 10 nodes (the two labels and the redaction note) at 80 ms
opening and at 80, 160 and 240 ms closing.

## 8. Certificate dialog: motion change

The dialog's words never fade. Opening: the dialog is at full opacity from the first frame and **rises 12 px** into
place (`translate` 320 ms, `--dur-2`, from `@starting-style`), while the **backdrop fades in** (320 ms, unchanged).
Closing: the dialog **goes at once** (its `opacity: 0` has no transition any more) while the **backdrop fades out** (320
ms); the `overlay` / `display` `allow-discrete` transitions still hold it in the top layer for those 320 ms, so the
backdrop can fade. Removed: the dialog's opacity transition, its closing translate. Unchanged: the native `<dialog>` and
`showModal()`, focus in and kept inside, Escape / close button / backdrop closing, focus returning to the trigger, the
system cursor inside and the custom pointer after (item 17), the redacted previews (no transition added to them; the
files are byte-identical, item 26), the dialog's size, the backdrop's colour and timing, reduced motion (no movement, as
before) and the no-JS links to the files.

## 9. Mid-transition axe matrix

Every frame below is **held, not sampled on a timer**: the change is made inside one page task, React's commit is
awaited, styles are read once, then every animation the change started is paused at exactly T ms (a CSS transition's
delay counts in T) and everything else is paused where it stands; the frame is checked as it is drawn. Nothing waits for
the motion to end. Two independent runs:

- **The proof matrix** (`probe.js`, both builds, same machine pairs and times on each): 8 views — EN/AR × light/dark ×
  1440 × 900 / 390 × 1300 phone — × 19 held frames (Capabilities 0, 80, 160, 240, 320, 480, 600 ms and settled; the
  dialog opening 0, 80, 160, 240, 320 ms and settled, closing 0, 80, 160, 240, 320 ms) = **152 frames per build**. Each:
  axe-core 4.13.0 on the whole page (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`),
  every text node shown with its opacity through every ancestor, and its per-pixel contrast (item 10).
- **The new spec** `e2e/commerce-motion-contrast.spec.ts` (12 tests, part of the suite): 6 views (EN/AR × light/dark at
  1440, EN light and AR dark at 390) × Capabilities held at 0, 80, 150, 160, 240, 300, 320, 450, 480, 600 ms (25 / 50 /
  75 % = 150 / 300 / 450 ms) and settled, and the dialog opening at 0, 80, 160, 240, 320 ms (25–100 %) and closing at
  80, 160, 240 ms. Each held frame must have **0 axe violations of any impact**, **no text below opacity 1**, every text
  at AA per pixel, one machine's words, and the pick's focus ring drawn. Results: item 35 (12 of 12 passed on the
  corrected build, alone and in the full run). The same spec run against the Stage 1I build fails where the review found
  the defect (all 12 tests fail; run with its checks made soft to list every frame, it finds on Capabilities two
  machines' — or the wrong machine's — words at 0–160 ms, half-faded words at 80–600 ms, words below AA per pixel at 80,
  150, 160 and 240 ms and axe violations at 150 / 160 ms in the English views; in the dialog no words at 0 ms,
  half-faded words in every opening and closing frame, words below AA at 80 ms opening (and 160 ms in the light views)
  and at 80–240 ms closing, axe violations at 80 ms opening and 80–240 ms closing in the English views).

Results of the proof matrix:

**Capabilities, machine change** (8 views per cell; Stage 1I → corrected)

| T (progress) | Views failing AA | Texts below AA | Worst ratio | Texts at opacity < 1 | axe violations (serious + critical) | Views with two machines' words |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms (0 %) | 0 → 0 | 0 → 0 | 4.776 → 4.776 | 0 → 0 | 0 (0) → 0 (0) | 0 → 0 |
| 80 ms (13 %) | 8 → 0 | 150 → 0 | 1.192 → 5.219 | 150 → 0 | 0 (0) → 0 (0) | 0 → 0 |
| 160 ms (27 %) | 8 → 0 | 268 → 0 | 1.002 → 5.473 | 300 → 0 | 2 (2) → 0 (0) | 8 → 0 |
| 240 ms (40 %) | 8 → 0 | 8 → 0 | 3.445 → 5.362 | 136 → 0 | 0 (0) → 0 (0) | 0 → 0 |
| 320 ms (53 %) | 0 → 0 | 0 → 0 | 4.825 → 5.296 | 136 → 0 | 0 (0) → 0 (0) | 0 → 0 |
| 480 ms (80 %) | 0 → 0 | 0 → 0 | 5.296 → 5.296 | 150 → 0 | 0 (0) → 0 (0) | 0 → 0 |
| 600 ms (100 %) | 0 → 0 | 0 → 0 | 5.300 → 5.300 | 150 → 0 | 0 (0) → 0 (0) | 0 → 0 |
| settled | 0 → 0 | 0 → 0 | 5.300 → 5.300 | 0 → 0 | 0 (0) → 0 (0) | 0 → 0 |

**Certificate dialog, opening** (8 views per cell; Stage 1I → corrected)

| T (progress) | Views failing AA | Texts below AA | Worst ratio | Texts at opacity < 1 | axe violations (serious + critical) |
| --- | --- | --- | --- | --- | --- |
| 0 ms (0 %) | 0 → 0 | 0 → 0 | no text → 5.633 | 0 → 0 | 0 (0) → 0 (0) |
| 80 ms (25 %) | 8 → 0 | 37 → 0 | 1.237 → 5.640 | 40 → 0 | 10 (10) → 0 (0) |
| 160 ms (50 %) | 4 → 0 | 16 → 0 | 2.842 → 5.679 | 40 → 0 | 0 (0) → 0 (0) |
| 240 ms (75 %) | 0 → 0 | 0 → 0 | 4.798 → 5.633 | 40 → 0 | 0 (0) → 0 (0) |
| 320 ms (100 %) | 0 → 0 | 0 → 0 | 5.633 → 5.633 | 0 → 0 | 0 (0) → 0 (0) |
| settled | 0 → 0 | 0 → 0 | 5.633 → 5.633 | 0 → 0 | 0 (0) → 0 (0) |

**Certificate dialog, closing** (8 views per cell; Stage 1I → corrected)

| T (progress) | Views failing AA | Texts below AA | Worst ratio | Texts at opacity < 1 | axe violations (serious + critical) |
| --- | --- | --- | --- | --- | --- |
| 0 ms (0 %) | 0 → 0 | 0 → 0 | 5.633 → no text | 0 → 0 | 0 (0) → 0 (0) |
| 80 ms (25 %) | 8 → 0 | 34 → 0 | 1.681 → no text | 40 → 0 | 10 (10) → 0 (0) |
| 160 ms (50 %) | 8 → 0 | 40 → 0 | 1.001 → no text | 40 → 0 | 10 (10) → 0 (0) |
| 240 ms (75 %) | 8 → 0 | 40 → 0 | 1.000 → no text | 40 → 0 | 10 (10) → 0 (0) |
| 320 ms (100 %) | 0 → 0 | 0 → 0 | no text → no text | 0 → 0 | 0 (0) → 0 (0) |

On the corrected build: **0 axe violations of any impact in all 152 held frames**, 0 texts below AA, 0 texts below full
opacity, one machine's words in every Capabilities frame. The worst ratios at rest are unchanged (5.300 console, 5.633
dialog), and mid-motion the corrected build stays at or above them except in one selector frame: at 0 ms both builds
show 4.776 in two light views (the rail's pick number turning from the previous pick's colour — a colour transition on
the selector, unchanged and above AA).

## 10. Per-frame contrast

Method (unchanged from Stage 1I): the held frame is captured with the text and icons inside the scope made transparent
(colour transitions this starts are finished at once; everything held stays held), and each text's colour, composed at
its cumulative opacity, is set against **every pixel under its glyph boxes**; the worst ratio counts, unrounded; AA is
4.5:1 (3:1 for large text). The nodes the review found:

Capabilities, the incoming machine's secondary button, at 160 ms (27 % of 600 ms), every view:

| View | Element | Stage 1I: opacity | effective text on background | ratio | Corrected: opacity | effective text on background | ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EN light 1440 | `a.btn.btn-secondary` "Laser Cutting service" | 0.507 | `#858687` on `#f9f9f7` | **3.441** ✗ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| EN dark 1440 | `a.btn.btn-secondary` "Laser Cutting service" | 0.507 | `#878c93` on `#1e242f` | **4.599** ✓ | 1 | `#eef1f4` on `#1e232c` | **13.907** ✓ |
| AR light 1440 | `a.btn.btn-secondary` "خدمة القص بالليزر" | 0.507 | `#868787` on `#fbfaf7` | **3.449** ✗ | 1 | `#15171a` on `#fdfcfa` | **17.515** ✓ |
| AR dark 1440 | `a.btn.btn-secondary` "خدمة القص بالليزر" | 0.507 | `#878c93` on `#1e252f` | **4.579** ✓ | 1 | `#eef1f4` on `#1c232d` | **13.952** ✓ |
| EN light 390 | `a.btn.btn-secondary` "Laser Cutting service" | 0.507 | `#868787` on `#fafaf7` | **3.447** ✗ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| EN dark 390 | `a.btn.btn-secondary` "Laser Cutting service" | 0.507 | `#878c93` on `#1e252f` | **4.579** ✓ | 1 | `#eef1f4` on `#1f232c` | **13.875** ✓ |
| AR light 390 | `a.btn.btn-secondary` "خدمة القص بالليزر" | 0.507 | `#868787` on `#fafaf7` | **3.447** ✗ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| AR dark 390 | `a.btn.btn-secondary` "خدمة القص بالليزر" | 0.507 | `#878c93` on `#1e252f` | **4.579** ✓ | 1 | `#eef1f4` on `#1d232c` | **13.938** ✓ |

The same node through the whole change, EN light 1440 (the incoming machine differs per time, so does the label):

| T (progress) | Element | Stage 1I: opacity | effective text on background | ratio | Corrected: opacity | effective text on background | ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms (0 %) | "Laser Cutting service" | — | not drawn | — | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| 80 ms (13 %) | "Laser Cutting service" | — | not drawn | — | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| 160 ms (27 %) | "Laser Cutting service" | 0.507 | `#858687` on `#f9f9f7` | **3.441** ✗ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| 240 ms (40 %) | "CNC Bending service" | 0.790 | `#454749` on `#fbfbf8` | **8.996** ✓ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| 320 ms (53 %) | "Metal Fabrication service" | 0.917 | `#282a2c` on `#fcfbf8` | **13.925** ✓ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| 480 ms (80 %) | "Laser Cutting service" | 0.992 | `#17191c` on `#fcfbf9` | **17.045** ✓ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| 600 ms (100 %) | "Laser Cutting service" | 1.000 | `#15171a` on `#fcfbf9` | **17.350** ✓ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |
| settled | "Laser Cutting service" | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ | 1 | `#15171a` on `#fcfbf9` | **17.365** ✓ |

Certificate dialog, the two preview labels while it opens, at 160 ms (50 % of 320 ms), every view:

| View | Label | Stage 1I: opacity | effective text on background | ratio | Corrected: opacity | effective text on background | ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EN light 1440 | "English version" | 0.802 | `#5c6165` on `#bbbcba` | **3.300** ✗ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| EN light 1440 | "Arabic version" | 0.802 | `#5d6166` on `#bfc0be` | **3.403** ✗ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| EN dark 1440 | "English version" | 0.802 | `#99a1ab` on `#1b232d` | **6.067** ✓ | 1 | `#b8c0ca` on `#202833` | **8.091** ✓ |
| EN dark 1440 | "Arabic version" | 0.802 | `#99a1ab` on `#1c242f` | **6.002** ✓ | 1 | `#b8c0ca` on `#202833` | **8.091** ✓ |
| AR light 1440 | "النسخة العربية" | 0.802 | `#5d6165` on `#bfbfbc` | **3.381** ✗ | 1 | `#454a50` on `#d7d7d3` | **6.196** ✓ |
| AR light 1440 | "النسخة الإنجليزية" | 0.802 | `#5e6266` on `#c2c3c0` | **3.480** ✗ | 1 | `#454a50` on `#d7d7d3` | **6.196** ✓ |
| AR dark 1440 | "النسخة العربية" | 0.802 | `#99a1ab` on `#1b232d` | **6.067** ✓ | 1 | `#b8c0ca` on `#202832` | **8.101** ✓ |
| AR dark 1440 | "النسخة الإنجليزية" | 0.802 | `#99a1ab` on `#1c242e` | **6.008** ✓ | 1 | `#b8c0ca` on `#202832` | **8.101** ✓ |
| EN light 390 | "English version" | 0.802 | `#5b6064` on `#b4b7b7` | **3.164** ✗ | 1 | `#454a50` on `#d5d5d1` | **6.075** ✓ |
| EN light 390 | "Arabic version" | 0.802 | `#5d6266` on `#c0c1bf` | **3.429** ✗ | 1 | `#454a50` on `#d5d5d1` | **6.075** ✓ |
| EN dark 390 | "English version" | 0.802 | `#9da4ae` on `#2e343d` | **5.001** ✓ | 1 | `#b8c0ca` on `#202833` | **8.091** ✓ |
| EN dark 390 | "Arabic version" | 0.802 | `#99a1ab` on `#1c242e` | **6.008** ✓ | 1 | `#b8c0ca` on `#202833` | **8.091** ✓ |
| AR light 390 | "النسخة العربية" | 0.802 | `#5b6065` on `#b5b9b9` | **3.210** ✗ | 1 | `#454a50` on `#d8d8d4` | **6.257** ✓ |
| AR light 390 | "النسخة الإنجليزية" | 0.802 | `#5e6266` on `#c2c3c1` | **3.481** ✗ | 1 | `#454a50` on `#d8d8d4` | **6.257** ✓ |
| AR dark 390 | "النسخة العربية" | 0.802 | `#9da4ae` on `#2e343d` | **5.001** ✓ | 1 | `#b8c0ca` on `#202833` | **8.091** ✓ |
| AR dark 390 | "النسخة الإنجليزية" | 0.802 | `#99a1ab` on `#1c242e` | **6.008** ✓ | 1 | `#b8c0ca` on `#202833` | **8.091** ✓ |

The first label through the opening and the closing, EN light 1440:

| Phase, T (progress) | Stage 1I: opacity | effective text on background | ratio | Corrected: opacity | effective text on background | ratio |
| --- | --- | --- | --- | --- | --- | --- |
| opening, 0 ms (0 %) | — | not drawn | — | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| opening, 80 ms (25 %) | 0.408 | `#848688` on `#afafaf` | **1.671** ✗ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| opening, 160 ms (50 %) | 0.802 | `#5c6165` on `#bbbcba` | **3.300** ✗ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| opening, 240 ms (75 %) | 0.961 | `#4a4f55` on `#cdcdca` | **5.172** ✓ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| opening, 320 ms (100 %) | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| opening, settled | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ |
| closing, 0 ms (0 %) | 1 | `#454a50` on `#d4d4d0` | **6.016** ✓ | — | not drawn | — |
| closing, 80 ms (25 %) | 0.592 | `#717478` on `#b1b2b1` | **2.197** ✗ | — | not drawn | — |
| closing, 160 ms (50 %) | 0.198 | `#a8aaa9` on `#c1c2bf` | **1.301** ✗ | — | not drawn | — |
| closing, 240 ms (75 %) | 0.040 | `#ced0cc` on `#d4d5d1` | **1.056** ✗ | — | not drawn | — |
| closing, 320 ms (100 %) | — | not drawn | — | — | not drawn | — |

In the corrected build the flagged nodes are at opacity 1 in every frame and keep their resting ratio (17.365 / 13.907
for the button, 6.016 / 8.091 for the labels at 1440; the labels' resting background includes the preview's shadow under
the glyphs). Every other text on both scopes is summarised in item 9; the corrected build's worst text in any held frame
is 4.776:1 on Capabilities (the rail's pick number "01" in the first frame of a change at 1440 light — the previous
pick's colours just starting to turn back, a selector transition this correction did not touch; 4.776 on Stage 1I too)
and 5.633:1 in the dialog.

## 11. EN / AR

Both languages in every matrix: 4 of the 8 proof views and 3 of the 6 spec views are Arabic (RTL, Tajawal / IBM Plex
Sans Arabic). Corrected: 0 texts below AA or below full opacity in any held frame in either language; worst Arabic 4.817
on Capabilities (the same first-frame pick number) and 5.633 in the dialog, English 4.776 and 5.640. On Stage 1I the
worst Arabic text read 1.008:1 (Capabilities) and 1.000:1 (closing); the Arabic button "خدمة القص بالليزر" read 3.449:1
at 160 ms (light) and reads 17.515:1 corrected.

## 12. Light / dark

Both themes in every matrix (4 + 4 proof views, 3 + 3 spec views). Stage 1I failed in both: worst 1.010 light / 1.002
dark on Capabilities at 160 ms, 1.237 / 1.441 opening and 1.000 / 1.000 closing. Corrected: worst 4.776 light / 6.047
dark on Capabilities, 5.633 light / 7.114 dark in the dialog (the resting values).

## 13. Phone / desktop

1440 × 900 and 390 × 1300 (phone emulation, touch) in every matrix: the phone views ran the same holds after the
selector's sideways glide came to rest (a glide is a scroll, not an animation, so it cannot be held; the held motion
stays held meanwhile). Corrected: 0 failures; worst 5.336 on phones and 4.776 at 1440 on Capabilities, 5.633 on both in
the dialog. Stage 1I's 4 phone views failed like the desktop ones (worst 1.002 Capabilities, 1.237 opening, 1.000
closing).

## 14. Reduced motion

Unchanged. Every transition the correction changed sits inside `@media (prefers-reduced-motion: no-preference)`; the
only change outside it drops the panels' resting `opacity: 0` / `1`, which makes no visible difference (a hidden panel
was and is `visibility: hidden`). With reduced motion the console and the dialog change at once, as before:

- **Probe (`rm.js`, both builds, EN light 1440, AR dark 1440, EN dark 390, AR light 390):** each change — a machine
  chosen, the dialog opened, the dialog closed — **created 0 animations or transitions** on either build, and its end
  state was in place in the same frame (the chosen panel drawn alone, its photo at opacity 1 / `translate: none`, its
  data in place; the dialog at opacity 1, `translate: none`, backdrop 1; closed: `display: none`). The frame right after
  each change was captured on both builds: identical in 12 of 12 (view × change) on the final run. On the EN dark phone
  the two dialog frames vary from run to run on **both** builds — the Stage 1I build compared with itself differed in
  the same pixels (open: 1 of 3 runs, 10,320 px; closed: 3 of 3, 127 px, at most 2 levels) — so they are not a change
  (item 22).
- **Resting pixels with reduced motion:** 141 of 142 capture pairs byte-identical, the one other the same run-to-run
  dialog variation (item 22).
- **The existing tests, unchanged:** `commerce-motion.spec.ts`'s reduced-motion tests (from the first paint on 11 pages
  and turned on while a page is open), `commerce-capabilities.spec.ts`'s "reduced motion" test (a machine change starts
  nothing; now also the photo opaque and on its floor and the data in place, at once), `commerce-certificates.spec.ts`'s
  "no custom pointer, and the dialog opens and closes without movement" — all pass (items 18, 23, 35).

## 15. Forced colours

Emulated with forced colours active (Playwright: the palette follows the colour scheme — the light palette draws
`Highlight` as `rgb(5, 0, 72)`, the dark one as `rgb(0, 230, 255)`), on both builds, in EN light, EN dark, AR light and
AR dark at 1440 and AR light at 390, each change held as in item 9 (Capabilities at 0, 80, 160, 240, 320 ms and settled;
the dialog opening at 0, 80, 160, 240, 320 ms and settled, closing at 80, 160, 240 ms; then Tab and Escape):

| Check (corrected build) | Result |
| --- | --- |
| Text at full opacity in every held frame | Capabilities 30 / 30 frames (Stage 1I: faded text in 20 of 30, down to 0.0071); dialog opening 30 / 30 (Stage 1I: 15 of 30 faded); closing: no dialog text drawn in 15 / 15 (Stage 1I: 75 half-faded texts) |
| One machine's words | 30 / 30 (Stage 1I: two machines in 5 of 30) |
| The chosen pick's ring: `::after`, `3px solid Highlight`, `forced-color-adjust: none`, opacity 1 | 30 / 30, from the first frame of the change (the state is `aria-current`, not a transition) |
| The chosen machine's name underlined | 30 / 30 |
| The previous pick loses its ring and underline in the same frame | 30 / 30 |
| Exactly one current pick | 30 / 30 |
| Keyboard focus ring on the pick: `2px solid Highlight`, `:focus-visible` | 30 / 30 |
| Scan line and floor line not drawn (as designed in forced colours) | 30 / 30 |
| Dialog border: `1px solid CanvasText` (black on the light palette, white on the dark) | 30 / 30 opening frames |
| Dialog opacity | 1 in every opening frame (Stage 1I: 0 → 0.41 → 0.80 → 0.96 → 1); 0 at once when closing |
| Focus inside the dialog while it opens | 30 / 30 |
| Tab inside the dialog: `2px solid Highlight` ring, `:focus-visible`; Escape closes it | 5 / 5 views |
| Pointer: the custom pointer stays off in forced colours (system cursor); `html[data-cursor-modal]` set while open, cleared on close | 30 / 30 open, 15 / 15 + 5 / 5 cleared |
| Page errors | 0 |

No state depends on opacity: the selection (ring, underline, `aria-current`), the focus ring, the dialog's border and
its modal mark are all set in the first frame and drawn in system colours. Evidence: item 36, sheet 8.

## 16. Keyboard and focus

- **The selector keeps focus through the change.** In every held Capabilities frame the chosen pick is
  `document.activeElement`, matches `:focus-visible` (keyboard modality) and draws its ring (`2px solid`): 64 / 64 proof
  frames (8 views × 8 times), 30 / 30 in forced colours (`Highlight`), and every held frame of the new spec (it fails on
  a missing ring). `aria-current="true"` is on the chosen pick in 64 / 64. The ring is never faded: the picks were never
  inside a panel, and no rule on them changed.
- **Selecting from the keyboard** (Tab to the next machine, Enter shows it, after 120 rapid changes) and the address /
  Back / Forward / live-region behaviour: the 1E spec, unchanged (item 18).
- **The dialog:** opening moves focus to Close, Tab stays inside, Escape closes it and focus returns to the trigger —
  `commerce-certificates.spec.ts` "keyboard: opens as a labelled modal, keeps focus inside, Escape closes it and focus
  returns to the trigger" (item 17); in forced colours Tab lands inside with a `2px solid Highlight` ring and Escape
  closes it in 5 / 5 views. Focus is inside the dialog in every held opening frame (30 / 30), so the rise never moves a
  focused element out of view.
- **Focus = hover** (Stage 1I): `commerce-motion.spec.ts`'s focus-parity tests, unchanged (item 23).

## 17. Dialog behaviour

Unchanged, and re-verified on the corrected build by `commerce-certificates.spec.ts` (17 tests, 17 of 17 passed, alone
and in the full run) and the probes:

- native `<dialog>` opened with `showModal()` from links to the redacted files (the no-JS fallback); labelled by its
  `h2`; focus to Close on opening, kept inside, Escape / the close button / a click on the backdrop close it, focus
  returns to the trigger;
- Arabic shows the Arabic version first; the dark theme takes the dark surfaces;
- the pointer: with a desktop mouse the custom pointer gives way to the system cursor over the dialog and its backdrop
  (`html[data-cursor-modal]`, `cursor: auto`) and comes back on close, by Escape, the button or the backdrop; Arabic the
  same; keyboard only and touch never turn the custom pointer on; reduced motion: no custom pointer and "opens and
  closes without movement" (`translate: none`, `transition-duration: 0s`, `opacity: 1`) — all passing as before;
- the previews: redacted files byte-identical (item 26), shown no larger than before, no filter or zoom, the same image
  service quality; no transition was added to them;
- new: in every held frame of the opening the dialog is at opacity 1 and its words at full strength (item 9), its border
  `1px solid` and focus inside it (item 15); closing, its words are gone in the first frame while the backdrop fades.

## 18. Capabilities behaviour

Unchanged, and re-verified on the corrected build by `commerce-capabilities.spec.ts` (72 tests, 72 of 72 passed, alone
and in the full run): the six machines and their facts (six-record parity, the power rule, the unstated-specification
guard), the address as the state (`#<slug>`, `replaceState`, the `mc:machine` event, the live region), choosing by mouse
and keyboard, the 20-cycle stress test (120 changes, then every listener compared), Back / Forward, the language switch
keeping the machine in all three header switches, pre-hydration (`:target` and the first panel), the 12 cold addresses ×
desktop / phone × late fonts, every machine link from the homepage and the service pages followed and landed, photos
(alt, loaded once, never above source size, not mirrored), decoration hidden from assistive technology, reduced motion,
forced colours, no-JS (every panel a list item), twelve sizes.

One assertion was replaced, none removed: the stress test's last check read "one panel at opacity 1", which no longer
tells the panels apart (with no panel faded, all six compute opacity 1). It became "one panel drawn" — the only panel
with any visible part (the panel or any descendant `visibility: visible`) is the last chosen one — plus "only that
machine's photo is opaque" (the others `opacity: 0`), next to the existing "every photo back in place". The
reduced-motion test gained two checks: the photo is opaque and on its floor, and the data in place, at once. The six
machines, hash, selector, Back/Forward, anchors, no-JS, reduced motion, facts and layout are as before: the console's
markup, script and page data are byte-identical (item 23).

## 19. Performance

`perf.js`, the Stage 1I method: headless Chromium (software compositing, the worst case), the mouse off the page, every
action from inside the page; a machine chosen every 700 ms for 8.4 s (12 changes), or the dialog opened and closed every
700 ms; frames = `requestAnimationFrame` intervals; mean fps = frames / time. Both builds, EN and AR, 1440 × 900 and 390
× 844 (phone emulation); 4 runs per cell for Capabilities, 3 for the dialog (56 runs in all):

| Scene | View | Runs (1I + C1) | Stage 1I: mean fps, median (lowest) | Corrected: mean fps, median (lowest) | p95 frame, Stage 1I → corrected (worst run) |
| --- | --- | --- | --- | --- | --- |
| Capabilities | EN 1440 | 4 + 4 | 58.6 (58.1) | 60.0 (57.6) | 16.8 → 16.8 ms |
| Capabilities | AR 1440 | 4 + 4 | 59.7 (58.8) | 58.8 (58.0) | 16.8 → 16.8 ms |
| Capabilities | EN 390 | 4 + 4 | 60.0 (60.0) | 60.0 (58.5) | 16.7 → 16.8 ms |
| Capabilities | AR 390 | 4 + 4 | 59.2 (58.2) | 60.0 (59.6) | 16.8 → 16.8 ms |
| Certificate dialog | EN 1440 | 3 + 3 | 55.1 (53.3) | 59.4 (59.2) | 33.3 → 16.8 ms |
| Certificate dialog | AR 1440 | 3 + 3 | 52.9 (52.1) | 59.5 (59.4) | 33.4 → 16.8 ms |
| Certificate dialog | EN 390 | 3 + 3 | 59.9 (59.5) | 59.6 (59.0) | 16.8 → 16.8 ms |
| Certificate dialog | AR 390 | 3 + 3 | 59.9 (59.3) | 59.9 (59.5) | 16.8 → 16.7 ms |

Every corrected run is at or above **57.6 fps** (≥ 55 in all 28). The dialog got faster at 1440: Stage 1I faded the
whole 1,088 px dialog over the page every frame (52.1–56.6 fps, p95 33 ms); now only its backdrop fades and the dialog
moves by `translate`. Properties that any animation or transition moved during the windows (both builds, identical
lists): Capabilities — `background-color`, `border-*-color`, `box-shadow`, `color` (the selector's picks), `opacity`
(photo, floor line, scan), `scale`, `translate`, `rotate`, `transform`, `stroke-dashoffset` (the sketch), `visibility`;
dialog — `translate`, `opacity` (the backdrop), `transform`, `overlay`, `display`. **No layout property** (no width,
height, inset, margin or padding) and **no `filter` / `backdrop-filter`** is animated.

## 20. Long tasks

In the 56 frame-rate runs above, the `longtask` observer saw a single task over 50 ms in 4 runs, at random points: once
on Stage 1I (69 ms, AR phone, Capabilities) and three times on the corrected build (60 ms AR 1440, 58 ms EN phone, 92 ms
EN 1440, all Capabilities); in the other 52 runs none. To find out what they were, the same two scenes were traced
(`ltcap.js`: a Chromium performance trace of the renderer's main thread over each window, 5 runs × 2 builds × desktop
and phone × 2 scenes = 40 traced runs): **no task over 50 ms in any of the 40**, on either build, and the main thread's
work per window is the same on both (median busy time — Capabilities: Stage 1I 1,426 / 1,333 ms, corrected 1,365 / 1,321
ms, desktop / phone; dialog: 385 / 370 ms and 416 / 355 ms; each within the other's run-to-run spread). The occasional
long task is not reproducible and appears on both builds, so it is not attributable to the change; the correction
removes work rather than adding it (no script, markup or data changed; each change starts fewer animations: 29–31
instead of 30–32 per machine change, 2 instead of 3 on opening the dialog, 3 instead of 5 on closing it).

## 21. CLS

0 in every run: the `layout-shift` observer recorded **0.0000** in all 56 frame-rate runs on both builds (machine
changes and dialog cycles included). Nothing in the correction moves layout: the panels are stacked in one grid area and
switch by `visibility`; the dialog is in the top layer and moves by `translate`.

## 22. Resting pixel regression

The resting states of both pages, captured on the Stage 1I build (`ba64a1b`, its own server) and the corrected build,
screen by screen at the window's size (a full-page capture resizes the window), lazy images loaded and decoded, compared
byte for byte. Views: Capabilities at rest (every screen of the page), Capabilities after a machine change has settled
(the console, every screen of it), Certificates at rest (every screen), the dialog **fully open**, the dialog **fully
closed** again — each in EN/AR × light/dark × 1440 × 900 / 390 × 844: 40 views, 142 capture pairs per mode.

| Mode | Capture pairs | Byte-identical | Notes |
| --- | --- | --- | --- |
| Motion allowed, settled (decorations held: the site-wide ambient and the scan lines hidden on both builds, every finite animation finished, repeated until nothing ran for 4 frames) | 142 | **142** | — |
| Reduced motion (nothing can drift) | 142 | **141** | the dialog open, 390 px, EN dark: see below |

The one pair that differed is not a change: the open dialog on a 390 px phone (EN, dark, reduced motion) is drawn one of
two ways from run to run — 10,320 pixels around the first preview's lower edge and its label, at most 23 levels apart.
Re-captured: Stage 1I vs corrected 6 more times (3 differed), corrected vs corrected 3 times (0 differed) and **Stage 1I
vs Stage 1I 3 times (1 differed, by exactly the same 10,320 pixels**, same box, same maximum). Layout (every rect to
1/1000 px), the chosen image candidates, the decoded image sizes and the optimizer's bytes (SHA-256 of the served
preview) are identical on both servers, and with reduced motion none of the dialog's changed rules apply (they all sit
inside `prefers-reduced-motion: no-preference`). With motion allowed (the earlier, weaker freeze), 23 of 40 views
differed, all where a decoration keeps its own clock — the ambient's stepped drift and breathing, the fleet plate's and
the console's scan lines, a floor line caught mid-way — which the stricter freeze above holds on both builds; the
correction changed none of those rules.

Every other page: no rule that changed can match anything on it — of the 120 prerendered HTML pages only
`/{en,ar}/capabilities` (the panels: 36 elements) and `/{en,ar}/certificates` (the dialog: 1) contain an element the
changed selectors target (`.cm-panel`, `.cm-figure`, `.cm-photo`, `.cm-floor-active`, `.ct-dialog`). The homepage, the
other inner pages, the project pages and the Theme Lab are therefore unchanged by construction; their files are proved
identical in item 23.

## 23. Stage 1I regression

Everything the review accepted in Stage 1I is untouched: no script, markup or page data changed (the correction is CSS
in two motion blocks), so the reduced-motion gate, off-screen and hidden-page pausing, focus = hover, the Projects
filter's view transition, the pointer's first-move fix and the hero readout fix are the same code. Proved on the final
build against the Stage 1I build (`ba64a1b`, built in a worktree with `cp -al node_modules`):

| Proof | Result |
| --- | --- |
| Prerendered files (HTML, RSC payloads, metadata, segments; build id and hashed paths normalised) | **804 of 806 byte-identical**, the other 2 (`en/about.html`, `ar/projects.html`) differing only in where `<meta name="next-size-adjust">` sits inside `<head>` (build-to-build noise; visible markup and page data identical) — homepage 12 / 12, Capabilities 12 / 12, About–Industries–Clients–Certificates 48, Contact 12, legal 24, Projects overview 12, project pages 476, services 96, Theme Lab 96, other 18. (The QA build of the same tree was 806 / 806.) |
| JavaScript | **all 25 chunks byte-identical** (same names, same contents); every page's script list identical (29 pages checked, the lab's included) |
| Stylesheets | **11 of 13 files byte-identical** (the Theme Lab's included); the shared MC sheet is 69 bytes smaller (the dialog's 3 rules rewritten) and the Capabilities sheet 211 bytes larger (its panel rules and motion block: 6 rules out, 7 in); every page keeps its stylesheet count; across all pages exactly **9 rules removed and 10 added**, the ones in items 6 and 8 |
| Elements the changed rules can match | only `/{en,ar}/capabilities` (36: the six panels, figures, photos and floor lines) and `/{en,ar}/certificates` (1: the dialog), of 120 prerendered HTML pages |
| `commerce-motion.spec.ts` (the Stage 1I motion system, 22 tests) | 22 of 22 passed, alone and in the full run |
| The homepage (frozen) | its 12 prerendered files, its JS and its stylesheet list identical; its stylesheet's only change is the dialog's rules, which match nothing on it |

## 24. Stage 1E regression

`commerce-capabilities.spec.ts`: 72 of 72 passed, alone and in the full run (72 tests; item 18 lists what they cover and
the one replaced assertion). The page's data, markup and script are byte-identical (item 23); its stylesheet changed
only in the console's panel rules and motion block (6 rules removed, 7 added, +211 bytes). The fleet plate, power chart,
register, service lines, source note, JSON-LD and the machine links from the homepage and the service pages are
unchanged and tested.

## 25. Stage 1F regression

`commerce-project-detail.spec.ts`: 33 of 33 passed in the full run. All 476 prerendered project-page files are
identical, their stylesheet (`project-detail.css`, 4,180 bytes) and JS are identical, and no rule that changed can match
an element on them.

## 26. Certificate hashes

The eight redacted files are byte-identical: SHA-1 of each file on disk and of each served response equals the values
fixed in `commerce-certificates.spec.ts` (`commercial-activity-licence(.webp, -thumb.webp)`,
`commercial-registration-{ar,en}(.webp, -thumb.webp)`, `vat-registration(.webp, -thumb.webp)`: `0b4405b6…`, `dd740fa9…`,
`2fa39397…`, `af4a0ef1…`, `f3511dcc…`, `7f27a975…`, `d725f4a1…`, `7681b9f1…`), and `git diff ba64a1b -- public` is
empty. The test passes (17 of 17 passed, alone and in the full run). No filter, zoom or transition was added to the
previews.

## 27. Project-media safety

No content, media or route changed: `git diff ba64a1b -- public src/content src/app src/lib src/i18n src/proxy.ts` is
empty. The withheld, flagged and AI-watermarked photos stay where Stage 1F put them; `commerce-project-detail.spec.ts`'s
photo rule by flag (including a flag added later), the per-page request checks and the "no note or flag anywhere" checks
pass in the full run (item 35), and `commerce-projects.spec.ts`'s withheld-photo checks likewise.

## 28. Theme Lab

No lab file changed (`src/app/theme-lab/**`, `src/components/theme-lab/**`); its 96 prerendered files, its stylesheets
(same file names and bytes) and its JS are identical (item 23). The lab never renders the console or the certificate
dialog, so neither change reaches it. `theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` pass in the full run (item 35).

## 29. `npm audit`

5 high-severity findings, all one development chain: `braces` (GHSA-vfj7-8cjw-p6xm, stack exhaustion on deeply nested
patterns) → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`. The offered fix is `npm
audit fix --force`, which would install `eslint-config-next@14.2.35` (a breaking downgrade of the lint config); not run,
as the brief says. The same finding as in Stage 1I; `axe-core` adds none.

## 30. `npm audit --omit=dev`

`found 0 vulnerabilities` — no production vulnerability.

## 31. `npm ci`

Exit 0: "added 374 packages, and audited 375 packages" — the same count as Stage 1I: `axe-core@4.13.0` was already
installed (through `eslint-config-next` → `eslint-plugin-jsx-a11y`), and `npm ls axe-core` now shows it as a direct dev
dependency with the plugin's copy deduped. The lockfile change is the one root `devDependencies` line, which `npm ci`
accepted (it fails on a lockfile out of step with `package.json`).

## 32. `npm run lint`

Exit 0, no warnings.

## 33. `npm run typecheck`

Exit 0 (`next typegen` + `tsc --noEmit`).

## 34. `npm run build`

Exit 0: compiled, 125 static pages generated (build after `npm ci`, on `1f7b9fc`). Compared with the Stage 1I build
(item 23): 804 of 806 prerendered files byte-identical after normalising build ids and hashed paths, and the other 2
(`en/about.html`, `ar/projects.html`) differ only in where Next.js placed `<meta name="next-size-adjust">` inside
`<head>` (a known build-to-build position change of the same tree; the visible markup and page data are identical);
every JS chunk identical; 11 of 13 stylesheets identical, the other 2 by exactly the intended rules.

## 35. E2E

`npm run test:e2e`: Playwright's own `next start` on the build of item 34 (`1f7b9fc`), 3 workers, nothing else running,
**no retries** (`playwright.config.ts` sets none, so a test that fails once counts as failed and "flaky" cannot occur).
Started 2026-10-05 13:21:36 UTC.

| Run | Tests at | Total | Passed | Failed | Skipped | Flaky | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Final | `1f7b9fc` | 545 | **545** | **0** | **0** | **0** | 18.0 min |

545 = Stage 1I's 533 + the 12 of `commerce-motion-contrast.spec.ts`. Per spec: anchors 15, capabilities 72, certificates
17, company 22, contact 34, home 25, inner 20, motion-contrast 12, motion 22, polish 37, project-detail 33, projects 52,
services 58, site 14, stage-1c 28, theme-lab-a-v2 45, theme-lab 39 — every spec passed in full.

Runs before the final one, in order (all on the corrected QA build, the same CSS as the final build):

| Run | Result |
| --- | --- |
| `commerce-motion-contrast.spec.ts`, corrected build | 12 / 12 passed (1.5 min) |
| The same spec against the Stage 1I build (`E2E_BASE_URL=http://localhost:3401`) | 12 / 12 failed, as intended: it detects the defect (item 9) |
| The same with its checks made soft (a scratch copy, deleted after), Stage 1I build | 12 / 12 failed; every failing frame is listed in item 9 |
| `commerce-capabilities` + `commerce-certificates` + `commerce-motion`, corrected build | 111 / 111 passed (4.5 min) |

No test was skipped, quarantined, given retries or loosened, and no wait was added to any existing test. One assertion
was replaced (item 18): "exactly one panel at opacity 1" can no longer tell the panels apart once no panel is faded (all
of them compute 1), so it became "exactly one panel with anything drawn" plus "only that machine's photo opaque" — the
same fact, checked more strictly.

## 36. Evidence

Eight sheets (§21), sent with this report; the frames are held exactly as in item 9, EN light and AR dark at 1440:

1. `01-capabilities-before.png` — Stage 1I, the change from the first machine to the 3 kW laser at 0, 80, 160, 320 and
   600 ms: whole panels cross-fade — at 80 ms the old machine's words are at 26 % over the still-empty new panel, at 160
   ms the new machine's are at 51 % (the button at 3.44:1).
2. `02-capabilities-corrected.png` — the same change corrected, at the same times: the new machine's words at full
   strength in every frame; only the photos cross-fade (the old one out in 180 ms), the new one rising, and the floor
   line draws.
3. `03-dialog-before.png` — Stage 1I, the dialog opening at 0, 80, 160, 240, 320 ms and closing at 0, 80, 160, 240 ms:
   the dialog and its words fade with the backdrop.
4. `04-dialog-corrected.png` — corrected: opening, the words at full strength from 0 ms while the dialog rises and the
   backdrop fades in; closing, the dialog is gone at 0 ms and only the backdrop fades.
5. `05-capabilities-settled.png` — Capabilities after a machine change, settled: Stage 1I | corrected | difference
   (reduced motion and motion allowed, EN and AR): 0 differing pixels.
6. `06-certificates-settled.png` — the page at rest, the dialog fully open, fully closed: Stage 1I | corrected |
   difference: 0 differing pixels.
7. `07-reduced-motion.png` — reduced motion, the frame right after each change on both builds (EN 1440, AR 390):
   identical, nothing moving.
8. `08-forced-colours.png` — forced colours, corrected: 160 ms into a machine change and settled (the `Highlight` ring
   and underline, the focus ring, words at full strength), the dialog opening at 160 ms, open, and closing at 160 ms.

Not signed off by the builder: the sheets are for the independent review.

## 37. Remaining Stage 1J items

Unchanged by this correction, all waiting for the user's word:

- Per-language root layouts so the Arabic fonts can be preloaded on Arabic pages (the Arabic CLS noted since TM-3).
- OG share images regenerated with the Modern Commerce faces (`scripts/generate-og.mjs`).
- Publication: page statuses from `review` to `published`, the sitemap, indexing, `robots`.
- Theme Lab removal (and dropping `lab-icon` from `Icon`), once authorized.
- RAWASY's own Google Maps place link; the photo, image-rights and AI-watermark questions in `docs/ASSET_INVENTORY.md`.
- The dev-tooling audit finding (item 29), if a non-breaking upgrade appears.
- The dictionary keys only the retired shell read (usage audit).
- New, for the user to decide (outside this correction's brief): whether the "words never fade" rule should also cover
  the scroll reveals and the homepage machine showcase (see Known limitations).

## Items needing RAWASY's confirmation

None new. The open questions are unchanged (`docs/ASSET_INVENTORY.md`): RAWASY's own Google Maps place link, photo and
image rights, the AI-watermarked and authorship-flagged images, licence renewal and registration details. Nothing in
this correction depends on them.

## Known limitations

- **Text still fades elsewhere** (outside this correction's brief, which limited it to Capabilities and the certificate
  dialog and froze the rest): the scroll reveals fade text in (opacity 0 → 1 with an 18 px rise over 700 ms) on every
  page, and the homepage machine showcase changes machine with a 600 ms cross-fade of whole panels, text included — the
  same pattern this correction removed from the console (held at 80–480 ms, its stage drew two machines' words at once
  in every frame, 7–19 texts below AA, worst 1.000:1, and axe flagged 2–3 nodes at 160 ms, EN light and AR dark). The
  homepage is frozen; applying the rule there is a decision for the user.
- **axe is not enough on its own** for moving text: it left 94–99 colour-contrast nodes on Capabilities as "needs
  review" (stacked or translucent layers) and flagged one node where 268 texts were below AA. The new spec pairs it with
  the per-pixel check.
- **The held frames are exact, real time is not:** the matrices hold each change at a chosen time (a transition's delay
  counted) and read the frame Chromium draws there; a real display samples whatever frames it renders. With no text
  opacity left in either change, there is no frame left in which the words can be half-faded.
- **Unchanged from Stage 1I** (not touched here): the Arabic font CLS (needs per-language root layouts, Stage 1J), the
  header's blur, the no-JS 404 body, the 200 % zoom header overflow below 320 CSS px, and the dev-tooling audit finding
  (item 29).

## How to run

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e                                        # starts next start on :3400 (or reuses it)
npx playwright test e2e/commerce-motion-contrast.spec.ts  # the held mid-transition frames only
E2E_BASE_URL=http://localhost:3401 npx playwright test e2e/commerce-motion-contrast.spec.ts  # against another build
```

To see it: `/en/capabilities#console` (choose machines: the words change at once, the photo fades and rises),
`/en/certificates` (open a document: the dialog rises at full strength, the backdrop fades; close it). DevTools →
Animations can slow both to 10 % to watch every frame.

## Next steps

- **Independent review** of Stage 1I correction 1.
- For the user to decide: whether the "words never fade" rule should also cover the scroll reveals and the homepage
  machine showcase (both outside this brief; the homepage is frozen).
- **Not started**, waiting for the user's word: Stage 1J, publication, sitemap expansion, OG regeneration, the Theme
  Lab's removal and deployment.

---

Stopped after Stage 1I correction 1. Not begun: Stage 1J, publication, sitemap expansion, OG regeneration, Theme Lab
removal, deployment. Returned for independent review.
