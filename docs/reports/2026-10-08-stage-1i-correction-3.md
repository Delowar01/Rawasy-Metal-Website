# Stage 1I — Correction 3: the last two colour blends (Projects filter toggle, certificate preview open indicator)

Date: 2026-10-08 · Branch: `claude/new-session-5eijs6` · Status: **built, returned for independent review** (not signed
off by the builder; nothing published or deployed; Stage 1J not begun). **One QA requirement is not met:** the
production audit now reports six Next.js advisories published after correction 2 (item 30); their fix is a patch bump of
the pinned `next` 16.3.6 → 16.3.8, which this brief does not authorize — prepared, reverted, left for the user.

## Summary

Correction 2 (frozen and locked by the user) left two colour transitions that swap a label or an icon with its own fill
and pass through a blend of the two. This correction closes both, in CSS only, without changing anything at rest:

- **Projects filter toggle** (`.pj-chip`; text, AA 4.5:1). Its label colour and its fill eased towards each other over
  180 ms when a toggle was pressed or released. Held frame by frame on the correction 2 build (`848fd95`): **1.740:1
  light / 1.651:1 dark at 45 ms** (the figures correction 2 reported, reproduced exactly) and **1.026:1 / 1.001:1 at 53
  ms**, the true worst frame (with `ease` the two colours meet 29 % of the way through); below AA from 33 to 80 ms
  (light) and 31 to 85 ms (dark). Now only the border eases; the label and the fill change with `aria-pressed` in the
  same frame: **17.633:1 light / 13.952:1 dark in every frame**, pressed and released.
- **Certificate preview open indicator** (`.ct-plate-open`). It is **not a text label**: it is an `aria-hidden` plus
  icon inside the preview link — graphical, non-text content, so the target is **3:1** for the plus against its own
  circle. Its circle and its plus eased in opposite directions on hover and keyboard focus, and in the light theme their
  luminances crossed: **2.135:1 at 90 ms** (the 2.14:1 correction 2 reported) and **1.016:1 at 70 ms** (at 39 ms on the
  way back); below 3:1 from 49 to 103 ms going in and 23 to 57 ms going back. The dark theme never went below 6.047:1.
  Now the circle and the plus swap at once and the preview keeps its lift: **5.473:1 light / 6.047:1 dark from the first
  frame** (the hover/focus state), 17.633:1 / 13.952:1 at rest.

`e2e/commerce-motion-contrast.spec.ts` gains 19 tests on the same held-frame method as the 54 before them — axe on the
held frame, every text at full opacity through its ancestors, each text's colour against every pixel under its glyphs,
unrounded — plus what this brief asks: the toggle held at 0, 45, 53, 90, 135 and 180 ms and settled, both ways, with the
gallery's re-flow held with it and the choice, the projects shown, focus and the toggles' boxes checked in every frame;
the indicator held at 0, 39, 45, 70, 90, 135 and 180 ms and settled, by keyboard focus and by hover, there and back, its
plus measured against its circle by computed colour and per pixel, its semantics, the link and the dialog checked; in
EN/AR × light/dark × 1440 × 900 / 390 × 844; plus reduced motion and forced colours. On the correction 2 build they fail
(14 of 19 tests; **56 of 304 held frames** below their threshold, each one of the two defects); on the correction they
pass (19 of 19, **0 of 304**). The 54 existing tests are unchanged and pass.

Nothing else changed. The built CSS differs by exactly two declarations in two rules; all 25 JS chunks, 11 of 13
stylesheets and 805 of 806 prerendered files are identical to correction 2's (the other only moves Next.js's
`next-size-adjust` meta); **84 of 84 resting screens** (Projects: All, a category, All again; Certificates: rest, focus,
hover, dialog open, dialog closed; EN/AR × light/dark × 1440 / 390) are byte-identical; correction 1's 152 held frames
are identical frame for frame; reduced motion was never affected and stays still; forced colours now swap at once too
(they blended down to 1.13:1 before); performance shows no layout shift, no reproducible long task, equal frame times
and less style work.

QA run: `npm ci`, both audits, lint, typecheck, build, the full e2e suite (**606 of 606**, no retries), the new tests on
both builds, a millisecond sweep of both changes on both builds, 304 held frames per build, correction 1's 152 frames,
84 resting screen pairs, 16 forced-colours capture pairs plus self-comparisons, reduced-motion and forced-colours probes
on both builds, three performance runs (19 filter, 9 focus and 9 hover rounds per build), the freeze proofs and three
evidence sheets. **Not met:** `npm audit --omit=dev` exits 1 (one high entry, `next` 16.3.6; item 30). The fix was
prepared and verified in a trial (production audit 0, nothing added, `sharp` and `source-map-js` unchanged) and then
reverted unbuilt, because changing the pinned framework version is the user's decision and this session's permission
check stopped the upgraded toolchain.

## Terminology correction

Correction 2's report and `CLAUDE.md` called `.ct-plate-open` the certificate plate's "open" label. That is wrong. It is
the **certificate preview's open indicator** (a plus icon indicator): an `aria-hidden="true"` `span` holding one SVG
plus icon and no text, inside the preview link. It is graphical, non-text content, so its contrast target is **3:1** for
the plus against its own circle (WCAG 1.4.11), not the 4.5:1 of text. This report uses that name throughout; a short
erratum note at the end of the correction 2 report says the same (nothing else in it was rewritten), and `CLAUDE.md` now
says "open indicator".

---

## 1. Starting SHA

`848fd957a97b49ea3d20488a67d753684d4f816a` ("Correct the Theme Lab test counts and branch history in the correction 2
report"). Preflight, before any change: `git fetch origin claude/new-session-5eijs6 preserve/pre-stage-1i`; `git status`
empty (clean tree); branch `claude/new-session-5eijs6`; local HEAD = `origin/claude/new-session-5eijs6` = `848fd95`
exactly; `origin/preserve/pre-stage-1i` = `b1f4fe1a3076247c9302b2a4e72428dc40fda8d6`, unchanged. No product-source drift
after correction 2: `git diff f492577 HEAD -- src e2e public package.json package-lock.json next.config.ts
playwright.config.ts tsconfig.json eslint.config.mjs postcss.config.mjs` is empty; the two commits after the lockfile
patch (`8cb72b8`, `848fd95`) touch only `CLAUDE.md`, `README.md` and the correction 2 report. Correction 2's
implementation `75d7f73c12b59e49e2c7c436da0e8915badcd138` and lockfile patch `f492577c078cd2b3c9926920523ca3c10d274c24`
are in the history as the brief states.

## 2. Implementation SHA

`64f9e60577a32099f48d3763e4b85b12649891ce` — "Swap the filter toggle's and the certificate indicator's colours at once"
(on `848fd95`): the two CSS changes and the extended spec, together. Pushed before the final QA. No product source
changed after it.

## 3. Branch HEAD

`848fd95` → `64f9e60` (implementation) → the commit that adds this report, the `CLAUDE.md` and `README.md` updates and
the erratum note in the correction 2 report (HEAD; a commit cannot name its own hash, so HEAD is given in the hand-off
message), all pushed to `origin/claude/new-session-5eijs6` without force. `preserve/pre-stage-1i` still points to
`b1f4fe1`.

## 4. Files changed

| File | Change |
| --- | --- |
| `src/components/commerce/projects/projects.css` | `.mc .pj-chip`: `transition` from `background-color, border-color, color` (180 ms) to `border-color var(--dur-1) ease` only, with a comment saying why |
| `src/components/commerce/system.css` | `.mc .ct-plate-open`: its `transition` (`background-color, color`, 180 ms) removed; a comment above the hover/focus rule names it the open indicator and says why |
| `e2e/commerce-motion-contrast.spec.ts` | 19 tests added at the end (items 7–19); the header comment mentions correction 3 and one import (`projectCategories`) was added; the 54 existing tests are unchanged |
| `docs/reports/2026-10-08-stage-1i-correction-3.md` | this report |
| `docs/reports/2026-10-06-stage-1i-correction-2.md` | an erratum note appended at the end (terminology only) |
| `CLAUDE.md`, `README.md` | status (with the open `next` decision of item 30), latest report, the "words never fade" rule, the spec's description, seven gotchas |

Nothing else: no markup, component, content, media, route, metadata, dependency or configuration file changed (`git diff
848fd95 -- public src/content src/lib src/i18n src/app src/proxy.ts package.json package-lock.json` is empty). In the
built CSS exactly two rules differ, by exactly those declarations (item 34).

## 5. Project chip root cause

`.mc .pj-chip` (`src/components/commerce/projects/projects.css`) transitioned three properties over `--dur-1` (180 ms,
`ease`): `background-color`, `border-color` and `color`. Pressing a toggle swaps its label colour and its fill
(unpressed: `--ink` on `--surface`; pressed: `--surface` on `--ink`), and releasing swaps them back, so the two
transitions run towards each other: in every frame the label and the fill are blends of the same two colours taken from
opposite ends, and they meet. With `ease`, the colours are half-way 29 % of the way through the time (52.7 ms of 180),
where the label and its fill are one colour: **1.026:1 light, 1.001:1 dark at 53 ms** — lower than the 1.74:1 / 1.65:1
that correction 2 measured at 25 % (45 ms), which this correction reproduces exactly. A millisecond-by-millisecond sweep
of the held change (computed styles, every millisecond from 0 to 200) found that worst frame and the whole failing
window: the label is below 4.5:1 from 33 to 80 ms in the light theme (48 ms of the 180) and from 31 to 85 ms in the dark
(55 ms). Both directions fail alike (the toggle being pressed and the one being released change in the same frame), the
hero's quick toggles too (same class, same shared choice), and forced colours as well (the system colours blend the same
way: 1.13–3.04:1 at 45 and 53 ms). Reduced motion was never affected (`transition: none` there).

## 6. Project chip implementation

CSS only, one declaration:

```css
.mc .pj-chip {
  …
  /* Only the border eases. The label's colour and the fill swap at once when a toggle is pressed or released: a
     transition between the two passed through a blend of both, where the label fell to about 1:1 against its fill
     (Stage 1I correction 3). */
  transition: border-color var(--dur-1) ease;
}
```

The label's colour and the fill (in forced colours `ButtonText`/`ButtonFace` ⇄ `HighlightText`/`Highlight`) change in
the same frame as `aria-pressed`. Unchanged: the resting colours; the hover/focus border (`--ink-2`) and the pressed
border (`--ink`), which still ease over 180 ms; the check mark that replaces the category square when pressed (same
box); the focus ring; the dimensions; `Gallery.tsx`, the choice, the live region; and the gallery's re-flow
(`document.startViewTransition` + `flushSync`, only the cards named) — every held frame below holds that re-flow too, 59
animations of it per change on both builds. The border is never under the label; its frames are among those measured.

## 7. Project chip baseline held-frame contrast

The new tests on the correction 2 build (`848fd95`, `E2E_BASE_URL=http://localhost:3401`): a category toggle pressed
from the keyboard ("All" released), then "All" pressed again (the category released), each held at T ms with the
gallery's re-flow held at the same T, in EN/AR × light/dark × 1440 × 900 / 390 × 844 — 112 held frames. Each frame: axe;
every label at full opacity; each label's colour against every pixel under its glyphs (labels hidden, the held frame
otherwise unchanged; unrounded); every toggle's label against its fill by computed colour (the hero's toggles, scrolled
out of view, included); the choice, the projects shown, focus and the toggles' boxes.

| Held at | 0 ms | 45 ms (25 %) | 53 ms (worst) | 90 ms (50 %) | 135 ms (75 %) | 180 ms (100 %) | settled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Light | 17.633 | **1.740** | **1.026** | 6.303 | 14.827 | 17.633 | 17.633 |
| Dark | 13.952 | **1.651** | **1.001** | 5.184 | 11.706 | 13.952 | 13.952 |

The same in both directions, both locales and both sizes, per pixel and computed alike (to the third decimal). **32 of
112 frames fail** (45 and 53 ms, both ways, all eight views), each with both changing toggles below 4.5:1, the hero's
toggles too. axe flags 24 of those 32 (`color-contrast`, serious) and misses the other 8 — the dark theme at 53 ms,
where label and fill are 1.001:1, practically one colour — which is why the per-pixel and computed checks carry the
test. All 8 chip tests fail on this build.

## 8. Project chip corrected held-frame contrast

The same 112 frames on the corrected build: **0 below AA, 0 axe findings, every label at full opacity**, and the ratio
is the same in every frame — **17.633:1 light, 13.952:1 dark** — pressed and released, per pixel and computed, the
hero's toggles included. In every frame: the pressed toggle is the only one pressed in the bar and in the hero, it holds
the keyboard focus with its ring drawn (`:focus-visible`, 2 px outline), the projects shown are exactly those of the
choice (`hidden` on the others, checked against each item's classifications), the live line names the choice, and the
toggles keep their boxes to 0.01 px (nothing moves when a toggle changes state). Each change still starts motion (the
border's transitions and the re-flow's animations were held in every frame). All 8 chip tests pass.

## 9. Certificate indicator root cause

`.mc .ct-plate-open` (`src/components/commerce/system.css`, certificates block) transitioned `background-color` and
`color` over `--dur-1` (180 ms, `ease`). At rest the circle is `--ink` and the plus (the icon's stroke, `currentColor`)
is `--surface`; on hover and keyboard focus the circle is `--brand` and the plus `--on-brand`. In the light theme a dark
circle with a light plus turns into an orange circle with a dark plus: the plus darkens while the circle lightens, so
their luminances cross part-way — **1.016:1 at 70 ms** on the way to the hover/focus state and **at 39 ms** on the way
back; 2.135:1 at 90 ms is the 2.14:1 correction 2 reported. The millisecond sweep puts the plus below 3:1 from 49 to 103
ms on the way in (55 ms) and from 23 to 57 ms on the way back (35 ms). In the dark theme the plus is dark at both ends
(`--surface` #1c232d → `--on-brand` #111418) while the circle goes from light grey to orange, so the ratio never fell
below 6.047:1: the defect was light-theme only, as the brief said. Reduced motion was never affected.

## 10. An aria-hidden plus icon, not text

Confirmed in the markup (`DocumentRegister.tsx`) and asserted in every held frame by the new tests: `.ct-plate-open` is
a `span` with `aria-hidden="true"` holding one 18 px SVG plus (`<Icon name="plus" />`, itself `aria-hidden`), **no text
node**, drawn in full inside its preview, the plus at opacity 1. It sits inside the preview link `a.ct-plate` (`href` =
the redacted file, `aria-haspopup="dialog"`, `aria-label` "View document: …" / "عرض الوثيقة: …"), which is the one link
of the figure with nothing focusable inside it. It is graphical, non-text content: the target is **3:1** for the plus
against its own circle, measured by computed colour and per pixel (the plus hidden, the held frame captured, the plus's
colour set against every pixel under it). axe does not measure it (its colour-contrast rule is for text; it reported
nothing in any of the 24 failing frames of item 12).

## 11. Certificate indicator implementation

CSS only: the `transition` declaration of `.ct-plate-open` is removed, so its circle and its plus swap colours in the
same frame as the preview's `:hover` / `:focus-visible`; the comment above the hover/focus rule now reads:

```css
/* The open indicator (a plus icon, aria-hidden) takes the brand fill on hover and keyboard focus. Its circle and its plus
   swap colours at once, never through a blend of the two, where the plus fell to about 1:1 against its circle (Stage 1I
   correction 3); the preview's lift keeps its motion. */
.mc .ct-plate:is(:hover, :focus-visible) .ct-plate-open { background: var(--brand); color: var(--on-brand); }
```

The preview's lift (`.ct-plate-img`: `translate 0 -6px`, 320 ms, `--ease`) keeps its motion; hover and keyboard focus
give the same end state; the resting dark circle with a light plus and the brand circle with a dark plus are unchanged;
the reduced-motion rule that lists `.ct-plate-open` is left as it was (it still states that nothing there moves). No
markup, file, preview, size or dialog behaviour changed.

## 12. Baseline graphical contrast

The new tests on the correction 2 build: the first preview's indicator held at T ms after keyboard focus and after blur
(all views) and after the mouse arrives and leaves (desktop), EN/AR × light/dark × 1440 × 900 / 390 × 844 — 192 held
frames (32 per desktop view, 16 per phone view). The plus against its circle (per pixel = computed in every frame):

| Light | 0 ms | 39 ms | 45 ms (25 %) | 70 ms | 90 ms (50 %) | 135 ms (75 %) | 180 ms (100 %) | settled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| To hover / focus | 17.633 | 5.096 | 3.622 | **1.016** | **2.135** | 4.654 | 5.473 | 5.473 |
| Back to rest | 5.473 | **1.016** | **1.460** | 5.096 | 9.055 | 15.658 | 17.633 | 17.633 |

| Dark | 0 ms | 39 ms | 45 ms | 70 ms | 90 ms | 135 ms | 180 ms | settled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| To hover / focus | 13.952 | 10.546 | 9.885 | 7.895 | 7.049 | 6.202 | 6.047 | 6.047 |
| Back to rest | 6.047 | 7.895 | 8.413 | 10.546 | 11.828 | 13.575 | 13.952 | 13.952 |

Hover and keyboard focus behave identically. **24 of 192 frames fail** — every light-theme frame at 70 and 90 ms on the
way in and at 39 and 45 ms on the way back (8 per light desktop view, 4 per light phone view) — and axe reports none of
them. The 4 light-theme indicator tests fail; the 4 dark ones pass on this build too.

## 13. Corrected graphical contrast

The same 192 frames on the corrected build: **0 below 3:1, 0 axe findings**. The plus has its end colour from the first
frame: **5.473:1 light / 6.047:1 dark** in every frame on the way to the hover/focus state, 17.633:1 / 13.952:1 on the
way back. In every frame the indicator is `aria-hidden="true"`, holds no text, is drawn in full inside its preview and
its plus is at opacity 1; the preview is in the expected state (`:hover` or `:focus-visible`, or neither); focus frames
have the preview focused with its ring, blur and hover frames have no focus; and the preview's lift was held in every
frame (it still moves). After the frames: at rest the circle is `--ink` and the plus `--surface`; with keyboard focus
the circle is `--brand` and the plus `--on-brand`; hover gives exactly the focus state (circle, plus and lift); Enter
opens the dialog as a modal with Close focused, and Escape closes it with focus back on the preview. All 8 indicator
tests pass.

## 14. EN / AR

Every held-frame test runs in both languages, with identical results per frame: the chip's ratios and the indicator's
are the same in EN and AR on both builds (items 7, 8, 12, 13). In Arabic the bar starts at the right ("الكل", "أعمال
معدنية معمارية" are the two toggles measured, in the display face), and the indicator sits at the inline end (left); the
tests find both by their own boxes, and the mouse goes to the corner away from the indicator on either side. The
reduced-motion test covers EN (light) and AR (dark), the forced-colours probe both languages.

## 15. Light / dark

Light: the chip failed at 45 / 53 ms (1.740 / 1.026) and the indicator at 39–90 ms (down to 1.016) on the baseline; both
pass every frame now (17.633, 5.473). Dark: the chip failed alike (1.651 / 1.001); the indicator never did (≥ 6.047);
both pass every frame now (13.952, 6.047). Resting colours are unchanged in both themes (items 13, 20).

## 16. Desktop / phone

1440 × 900 and 390 × 844 (phone emulation with touch): the chip tests and the indicator's keyboard tests run at both,
the indicator's hover tests on the desktop only (no hover on a touch screen). The preview and its indicator are present
at 390 (checked: visible, drawn in full in the preview). Results are identical per frame across the two sizes. On phones
the bar scrolls sideways; the two toggles measured sit at its start and the glyph boxes are cut to the scrolling row.

## 17. Keyboard / focus

The toggles are pressed from the keyboard (focused with keyboard modality, then activated): in every held frame the
pressed toggle holds focus, matches `:focus-visible` and draws its 2 px ring, and nothing in the bar moves. The
indicator's frames include keyboard focus and blur: focus frames have the preview focused with its ring, blur frames
none. Keyboard focus gives exactly the hover state (computed circle, plus and lift), Enter opens the dialog (modal,
Close focused) and Escape returns focus to the preview. `commerce-motion.spec.ts`'s "keyboard focus shows what hover
shows" (certificate cards and filter chips among them) passes in the full run (item 35).

## 18. Reduced motion

New test (EN light, AR dark, 1440): a toggle pressed and released, and the preview focused, blurred, hovered and left,
each held at 0 ms — **no animation starts**, the choice and the projects are right at once, every label is at full
contrast (17.633:1 / 13.952:1) and the plus at 5.473:1 / 6.047:1 from the first frame. Probe on both builds (EN and AR):
identical — 0 animations for a toggle (22 projects hidden at once for the category), 0 for the preview's focus and
hover, the lift `none`: reduced motion already had `transition: none` for both, so it never showed the defect and
nothing in it changed. `commerce-motion.spec.ts`'s reduced-motion tests (including "nothing moves … through its
controls" on Projects and Certificates) pass in the full run.

## 19. Forced colours

On the baseline the toggle's blend happened in forced colours too (system colours eased into each other: 2.28 / 1.47:1
at 45 ms, 1.24 / 1.27:1 at 53 ms with a light forced palette; 3.04 / 1.13:1 and 1.67 / 1.69:1 with a dark one). Now:

- **Toggles**: the pressed one is `Highlight` with `HighlightText` and shows the check mark in place of the category
  square — its state is not colour alone — and the others `ButtonFace` / `ButtonText` with their square, from the first
  frame (held at 0 and 53 ms and settled, both ways: 19.09:1 / 21.00:1 light palette, 13.76:1 / 21.00:1 dark palette).
  The focused toggle draws its 2 px ring. New test (light and dark palette); it fails on the baseline at 0 ms and passes
  here.
- **Certificate preview**: reached with Tab, named ("View document: Commercial Registration" / "عرض الوثيقة: السجل
  التجاري"), its focus ring in system colours (19.09:1 / 13.76:1 against its card); Enter opens the dialog as a modal
  with Close focused; Escape returns focus to the preview. The indicator is decoration (`aria-hidden`; the preview's
  name says what it does), and it stays visible: its circle takes the forced background and its plus the link colour,
  13.99:1 (light palette) / 19.56:1 (dark palette). Identical on both builds, EN and AR, with the site in either theme.
- The forced-colours captures of the bar and the preview (settled, four pairings × EN/AR) are identical between the
  builds in 14 of 16 cases; the other two (the Arabic bar) differ only in the one row of pixels below the bar where the
  first gallery photo shows after the re-flow, not in the toggles — and the corrected build differs from itself in that
  same row in three Arabic captures, so it is run-to-run noise, not a change.
- **Observed, not changed (pre-existing, identical on both builds):** the toggles draw their own states with
  `forced-color-adjust: none`, so their focus ring keeps the site's `--focus` colour instead of a system colour. Against
  the bar it reads 6.88:1 (light palette, site light), 3.05:1 (dark palette, site light), 10.41:1 (dark palette, site
  dark) and **2.02:1 when a light forced palette meets the site's dark theme**. This predates correction 3 and the brief
  asks for no redesign without a real regression; it is reported for the user's decision (item 36).

## 20. Resting pixel regression

The correction 2 build (`848fd95`, port 3401) against the corrected build (port 3400), screen by screen (`rest3.js`), in
EN/AR × light/dark × 1440 × 900 / 390 × 844. Each state is settled before it is captured: every finite animation
finished, every transition ended, images decoded, the site-wide ambient hidden on both builds (it runs on its own
clock), and the screen drawn afresh (the page taken to its far end and back, so Chromium's incremental repaint cannot
keep what a transition left — correction 2's gotcha), except the hovered state, which keeps the mouse where it is.

- **Projects:** "All" as loaded, one category pressed from the keyboard, "All" again — the gallery screen (the bar and
  the wall) and the hero screen (its quick toggles) each time: 48 pairs.
- **Certificates:** the first preview at rest, with keyboard focus, hovered (desktop), its dialog fully open, and closed
  again with focus back on the preview: 36 pairs.

**84 of 84 pairs are byte-identical.** No resting colour changed, so nothing called for the "stop and explain" of §14.
Only the two Certificates pages contain the indicator and only the two Projects pages contain the toggles (and load the
changed projects sheet); no element on any other page matches either changed rule (checked in all 120 prerendered HTML
files), and every page's served HTML, page data and JS are as before (item 34). The forced-colours captures are in item
19.

## 21. The 54 existing motion-contrast tests

Unchanged — `git diff` of the spec touches only its header comment, one import and the appended block (no line of the 54
tests, their helpers or their times changed) — and they pass: **73 of 73** in a run of the whole spec on the corrected
build (54 existing + 19 new, 9.1 min, nothing else running), and again in the full suite (item 35). The new tests reuse
the 54's own helpers (`open`, `axe`, `textsShown`, `contrastOf`, `release`, `still`, `focusShown`, `ratio`) without
changing them; their extra checks (computed colours, the plus's 3:1, the state checks) are additions.

## 22. Correction 1 regression

Correction 1's own held-frame probe, unchanged, on the corrected build (`TAG=c3check`): the Capabilities machine change
and the certificate dialog's opening and closing, EN/AR × light/dark × 1440 / 390 — **152 frames: 0 texts below AA, 0
below full opacity, 0 axe violations of any impact, one machine's words in every frame, the focus kept** (worst ratios
4.776 on Capabilities, 5.633 in the dialog). Frame for frame it equals the run in correction 1's own report and
correction 2's regression run: the same texts in the same order, the same worst ratio, failures and axe count in all 152
frames. Its 12 tests in the spec pass (item 21). No rule of the console or the dialog changed: the CSS diff is the two
declarations of item 4.

## 23. Correction 2 regression

Correction 2's 42 tests pass in the spec run and in the full suite (items 21, 35): the homepage machine change, the
scroll reveals (also at 320 × 700), the homepage entrance, the Services dropdown, the phone menu sheet, the project
cards' label, its reduced-motion and no-JS tests. None of correction 2's rules changed (the two changed rules are the
toggle's and the indicator's), the homepage's 12 prerendered files are identical, all JS is identical, and the homepage
loads no stylesheet whose rules changed in a way its elements can match (item 20).

## 24. Projects regression

`commerce-projects.spec.ts` passes in the full run (item 35) — parts and order, the 27 projects and their ids, the
withheld photos, the choice shared by the hero and the bar, keyboard, the one-row bar at eight widths, Arabic, the wall,
each card's one link, `#<slug>` landings, reduced motion, no-JS. `commerce-motion.spec.ts`'s filter tests pass (twenty
quick choices with listener counts; "a filter choice moves only the gallery's items": the root is not captured). The
re-flow is unchanged: 59 view-transition animations per change on both builds, held in every frame of the new tests. In
every held frame the choice, the projects shown, the live line and the toggles' boxes were right (item 8). The resting
pixels of All, a category and All again are identical (item 20), and the overview's 12 prerendered files and the 476
project-page files are identical (item 34).

## 25. Certificates regression

`commerce-certificates.spec.ts` passes in the full run (item 35) — the file hashes and the digit guard, the register,
the anchors, previews no larger than before, the dialog with keyboard, backdrop, Arabic first, no-JS, the pointer.
Correction 1's dialog tests pass (items 21–22). The new tests confirm the preview is still one link, opens the dialog
from the keyboard and gets focus back (item 13), and the resting pixels at rest, focused, hovered, with the dialog open
and closed are identical (item 20). The certificates pages' prerendered files are identical (item 34).

## 26. Certificate hashes

The redacted files are byte-identical: `git diff 848fd95 -- public` is empty, and `commerce-certificates.spec.ts` checks
the SHA-1 of each file on disk and of each served response against its fixed values (`commercial-activity-licence(.webp,
-thumb.webp)`, `commercial-registration-{ar,en}(.webp, -thumb.webp)`, `vat-registration(.webp, -thumb.webp)`); it passed
in the full run. No preview, file, size or dialog changed.

## 27. Project-media safety

No content, media, route or metadata changed (`git diff 848fd95 -- public src/content src/lib src/i18n src/app
src/proxy.ts` is empty; the only product files changed are the two stylesheets). The withheld, flagged and
AI-watermarked photos stay where Stage 1F put them: `commerce-project-detail.spec.ts` (the photo rule by flag, a flag
added later included, the per-page request checks, no note or flag anywhere) and `commerce-projects.spec.ts`'s
withheld-photo checks pass in the full run. No image got a new filter, transform or size.

## 28. Theme Lab regression

No lab file changed (`src/app/theme-lab/**`, `src/components/theme-lab/**`); its 96 prerendered files, its stylesheets
and its JS are identical (item 34). `theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` pass in the full run (item 35).

## 29. `npm audit`

Exit 1: **6 high-severity entries.** Five are the same development chain as correction 2 — `braces`
(GHSA-vfj7-8cjw-p6xm) → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`, fixable only by
`npm audit fix --force` (a breaking downgrade to `eslint-config-next@14.2.35`); not run, out of scope (§7). The sixth is
**new since correction 2: `next` 16.0.0 – 16.3.7**, the production dependency (item 30).

## 30. `npm audit --omit=dev`

**Exit 1: 1 high — the production audit is not 0, so this requirement of §19 is not met.** Six Next.js advisories that
correction 2's audit did not report (its production audit was 0 on 2026-10-06 with this same lockfile), all fixed in
`next` 16.3.8:

| Advisory | npm severity (CVSS) | Affected | Summary |
| --- | --- | --- | --- |
| GHSA-cjq9-62q9-8jv4 | high (6.5) | ≥ 16.0.0 < 16.3.8 | Server-side request forgery in Image Optimization |
| GHSA-4jqv-mc3x-m676 | moderate (5.3) | ≥ 16.0.0 < 16.3.8 | Cache poisoning of SSG and ISR pages in self-hosted applications |
| GHSA-mcj8-r9mp-w47p | moderate (4.8) | ≥ 16.0.0 < 16.3.8 | Cache poisoning in SSG/ISR rendering (cross-user content substitution, persistent denial of service) |
| GHSA-f87g-xv8r-7p7x | moderate (5.3) | ≥ 16.0.0 < 16.3.8 | Information disclosure in App Router metadata image routes via a `dynamicParams` bypass |
| GHSA-3w37-wq28-93x7 | moderate (4.2) | ≥ 16.3.0 < 16.3.8 | A pending `use cache` fill can leak Draft Mode content |
| GHSA-39w2-rjm5-chcv | low (5.4) | ≥ 16.0.0 < 16.3.8 | Information disclosure in the development server's MCP endpoint |

For context, without judging exploitability: the site prerenders its pages and serves its photos through the image
optimizer (local files only, no remote image patterns); it has no metadata image routes (the share images are static
files), no `use cache` and no Draft Mode; nothing is deployed.

`package.json` pins `"next": "16.3.6"` exactly, so `npm audit fix` without `--force` cannot apply a fix, and npm offers
only `npm audit fix --force` (to 16.4.0), which the brief forbids. The smallest fix is a patch bump of the pin to
**16.3.8** (released 2026-09-30). I prepared it (`npm install next@16.3.8 --save-exact`): one line in `package.json` and
10 lockfile entries changed version (`next`, `@next/env` and the eight `@next/swc-*` platform binaries), none added or
removed; `sharp` stayed 0.35.5 and `source-map-js` 1.2.2 (16.3.8 declares the same dependencies as 16.3.6); with it,
`npm audit --omit=dev` printed `found 0 vulnerabilities` and `npm audit` only the 5-high development chain. **I reverted
it before building anything.** Changing the framework version this project pins is a dependency decision this brief does
not give me (it asks for a CSS correction, no added dependencies and no `--force`), and this session's permission check
also stopped the upgraded toolchain from being run — so the upgrade was never built or tested. The committed lockfile is
unchanged (`next` 16.3.6), and every measurement, the build and the e2e run in this report use it.

**For the user to decide:** bump `next` to 16.3.8 (a patch release; the brief's other rules are kept), in its own commit
with the same proofs as correction 2's lockfile patch — build compared with this one, every optimized image compared,
the full suite — or to keep 16.3.6 until Stage 1J.

## 31. `npm ci`

Exit 0: "added 374 packages, and audited 375 packages" (the same counts as correction 2), from the committed lockfile;
its summary also printed the 6 high-severity entries of item 29. `npm ls`: `next` 16.3.6, `sharp` 0.35.5,
`source-map-js` 1.2.2 (deduped), `axe-core` 4.13.0 (the declared dev dependency, deduped under
`eslint-plugin-jsx-a11y`). No dependency added. It ran three times: on the committed lockfile, on the trial of item 30,
and on the committed lockfile again after reverting it (the first and the last with these counts and versions; the final
commands ran on the last).

## 32. `npm run lint`

Exit 0, no warnings.

## 33. `npm run typecheck`

Exit 0 (`next typegen` + `tsc --noEmit`; "Types generated successfully").

## 34. `npm run build`

Exit 0: compiled, 125 static pages generated (`64f9e60`, committed lockfile). It is the build every measurement in this
report ran on, byte for byte: **806 of 806 prerendered files and all 38 static JS and CSS files identical** to the copy
taken right after the measured build. Against the correction 2 build (`848fd95`): 805 of 806 prerendered files identical
after normalising build ids and hashed paths, and the other (`en/about.html`) differs only in where Next.js placed
`<meta name="next-size-adjust">` in `<head>` (a known build-to-build position change; markup and page data otherwise
identical); **all 25 JS chunks identical**; **11 of 13 stylesheets identical** (the Theme Lab's and every other page
sheet included); the two that differ hold exactly the two changed rules:

| Stylesheet | Bytes | Rule | Declaration removed | Declaration added |
| --- | --- | --- | --- | --- |
| shared Modern Commerce sheet (`system.css`) | 132,721 → 132,650 | `.mc .ct-plate-open` | `transition: background-color var(--dur-1) ease, color var(--dur-1) ease` | — |
| Projects sheet (`projects.css`) | 10,303 → 10,242 | `.mc .pj-chip` | `transition: background-color …, border-color …, color var(--dur-1) ease` | `transition: border-color var(--dur-1) ease` |

Every page keeps its stylesheet list (one sheet, two on Projects). No layout property is animated: the corrected build
animates a subset of what the correction 2 build did (the toggle's border colour, the preview's `translate`).

## 35. Full E2E

`npm run test:e2e`: Playwright's own `next start` on the build of item 34 (`64f9e60`, committed lockfile; no server left
running before), 3 workers, nothing else running, **no retries** (`playwright.config.ts` sets none, so a test that fails
once counts as failed and "flaky" cannot occur). Started 2026-10-08 17:36:02 UTC, ended 17:59:39 UTC.

| Run | Tests at | Total | Passed | Failed | Skipped | Flaky | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Final | `64f9e60` | 606 | **606** | **0** | **0** | **0** | 23.6 min |

606 = correction 2's 587 + the 19 new tests of `commerce-motion-contrast.spec.ts`. Per spec: anchors 15, capabilities
72, certificates 17, company 22, contact 34, home 25, inner 20, motion-contrast 73, motion 22, polish 37, project-detail
33, projects 52, services 58, site 14, stage-1c 28, theme-lab-a-v2 45, theme-lab 39 — every spec passed in full.

Runs before the final one (the same CSS and tests):

| Run | Result |
| --- | --- |
| The 16 new held-frame tests, corrected build | 16 / 16 passed (2.0 min) |
| The same 16 against the correction 2 build (`E2E_BASE_URL=http://localhost:3401`) | 12 failed, 4 passed, as intended: all 8 toggle tests and the 4 light-theme indicator tests fail; the 4 dark-theme indicator tests pass (that theme never failed) |
| The new reduced-motion and forced-colours tests, corrected build | 3 / 3 passed |
| The same 3 against the correction 2 build | the 2 forced-colours tests fail (the pressed toggle still blending at 0 ms), the reduced-motion test passes (that mode never moved) |
| `commerce-motion-contrast.spec.ts` in full, corrected build | 73 / 73 passed (9.1 min) |

No test was skipped, quarantined, given retries or loosened, and no other test file changed.

## 36. Remaining Stage 1J items

Unchanged by this correction, all waiting for the user's word:

- Per-language root layouts so the Arabic fonts can be preloaded on Arabic pages (the Arabic CLS noted since TM-3, and
  correction 2's one measured worsening: the Arabic homepage's CLS at 1440, 0.0390 → 0.0459). Not touched here.
- OG share images regenerated with the Modern Commerce faces (`scripts/generate-og.mjs`).
- Publication: page statuses from `review` to `published`, the sitemap, indexing, `robots`.
- Theme Lab removal (and dropping `lab-icon` from `Icon`), once authorized.
- RAWASY's own Google Maps place link; the photo, image-rights and AI-watermark questions in `docs/ASSET_INVENTORY.md`.
- The dev-tooling audit chain (item 29), if a non-breaking upgrade appears.
- The dictionary keys only the retired shell read (usage audit).
- Still open from earlier stages, unchanged and outside this brief (§7): the view-transition cross-fades (theme switch,
  EN ⇄ AR; the projects filter's re-flow is untouched here), axe's `target-size` observation on the homepage capability
  strip under the sticky header, the header blur, the no-JS 404 body, and the header below 320 CSS px / phones at 200 %
  zoom.
- **New, for the user to decide:** the patch bump of `next` 16.3.6 → 16.3.8 for the six Next.js advisories published
  after correction 2 (item 30) — prepared and measured, reverted unbuilt; needed before any deployment at the latest.
- **New, for the user to decide (pre-existing, not changed):** in forced colours the Projects filter toggles keep the
  site's `--focus` colour for their focus ring (they opt out of forced colours to draw their pressed state), which reads
  2.02:1 against the bar when a light forced palette meets the site's dark theme (item 19). The pressed state itself is
  clear in every pairing (system colours and the check mark).
- Closed by this correction: the two colour blends correction 2 reported (the Projects filter toggle; the certificate
  preview's open indicator, which that report called a label).

## Performance (brief §17)

A focused before/after check (`perf3.js`), 1440 × 900, EN light, motion allowed, the two builds interleaved: 12 filter
choices from the keyboard per round on Projects, and 12 keyboard focus/blur and 12 hover in/out cycles per round on the
first certificate preview. Three runs: 3 rounds of all three, 6 rounds of all three, then 10 rounds of the filter alone
(after one long task in the first run).

| Per 12 changes | Correction 2 build | Correction 3 build |
| --- | --- | --- |
| Filter: transitions started on the toggles | 288 (background, 4 border sides, colour × 4 toggles × 12) | 192 (4 border sides × 4 × 12) |
| Filter: long tasks | 0 in 19 rounds | 1 in 19 rounds (115 ms, first run, round 3); 0 in the 16 rounds after |
| Filter: frame interval, 95th percentile | 33.40 / 33.35 / 33.35 ms | 33.40 / 33.37 / 33.35 ms |
| Filter: worst frame | 50.1 / 66.7 / 66.7 ms | 50.1 / 133.3 / 66.8 ms |
| Filter: frames over 50 ms (run 3) | 8 of 3,239 | 6 of 3,238 |
| Filter: style recalculation | 520 / 461 / 456 ms | 421 / 430 / 415 ms |
| Filter: layouts | 197 / 198 / 199 | 196 / 196 / 199 |
| Preview focus: transitions | 36 (lift, circle, plus) | 12 (lift) |
| Preview focus: long tasks · worst frame | 0 · 16.8 / 33.4 ms | 0 · 83.4 / 16.8 ms |
| Preview hover: long tasks · worst frame | 1 in 9 rounds (72 ms) · 16.8 / 116.7 ms | 0 · 16.8 / 33.4 ms |
| Preview focus / hover: style recalculation | 93 / 85 · 149 / 142 ms | 73 / 68 · 136 / 127 ms |
| Layout shifts (all scenarios) | 0 | 0 |

The filter's 33 ms frames are the gallery's re-flow in this headless browser's software compositing, the same on both
builds. Single slow frames and the odd long task appear on both builds and never twice in the same scenario: none is
reproducible, and 10 further filter rounds on each build had no long task. There is no layout shift, no new animation
(the correction runs a third fewer transitions on the toggles and two thirds fewer on the preview) and no regression;
style work is lower on every scenario.

## Evidence

Three sheets, sent with this report (the held frames are those of items 7–13, paused at exactly T ms):

| Sheet | What it shows |
| --- | --- |
| `c3-held-frames-light.png` | Light, EN 1440: the filter toggle pressed at 0, 45, 53, 90 and 180 ms, and the indicator at 0, 45, 70, 90 and 180 ms on the way to focus and 39 ms on the way back — the correction 2 build above the correction, each tile labelled with its ratio (red: below its threshold) |
| `c3-held-frames-dark.png` | The same in the dark theme (the indicator never failed there) |
| `c3-forced-colours.png` | The correction in forced colours, four palette/theme pairings × EN/AR: the pressed toggle (system highlight and the check mark, its focus ring) and the focused preview with its plus |

The visual quality of the result is for the independent review; the builder does not sign it off.

## Items needing RAWASY's confirmation

None new. The open questions are unchanged (`docs/ASSET_INVENTORY.md`): RAWASY's own Google Maps place link, photo and
image rights, the AI-watermarked and authorship-flagged images, licence renewal and registration details. Nothing in
this correction depends on them.

## Known limitations

- **The production audit is not 0** (item 30): six Next.js advisories in the pinned `next` 16.3.6, fixed in 16.3.8 — a
  dependency change left for the user's decision. Nothing is deployed.
- **Forced colours, the filter toggles' focus ring** (item 19): 2.02:1 against the bar with a light forced palette and
  the site's dark theme; 3.05:1 or more in the other three pairings. Pre-existing and identical on both builds;
  reported, not changed (the brief asks for no forced-colours redesign without a real regression).
- **The toggle's border still eases** over 180 ms, by design (the brief allows it where every frame stays compliant): a
  pressed toggle shows its dark fill at once and its border settles into it; the label is never under the border.
- Everything correction 2 listed that this brief keeps out of scope still stands: the Arabic homepage's CLS (Stage 1J's
  font preload), the view-transition cross-fades, the capability strip's `target-size` observation.

## How to run

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e                                                   # starts next start on :3400 (or reuses it)
npx playwright test e2e/commerce-motion-contrast.spec.ts           # the held part-way frames (73 tests)
npx playwright test e2e/commerce-motion-contrast.spec.ts -g "correction 3"   # this correction's 19
E2E_BASE_URL=http://localhost:3401 npx playwright test e2e/commerce-motion-contrast.spec.ts -g "correction 3"  # another build
```

To see it: `/en/projects` — at the gallery, press a filter toggle (its label and fill swap at once, its border eases,
the cards re-flow as before); `/en/certificates` — hover a preview or reach it with Tab (the plus indicator turns orange
with a dark plus at once while the preview lifts). DevTools → Animations can slow everything to 10 % to watch each
frame.

## Next steps

- **Independent review** of Stage 1I correction 3.
- For the user to decide: the `next` 16.3.8 security patch bump (item 30), the forced-colours focus ring of the filter
  toggles (item 36), and the items correction 2 left open that this brief keeps out of scope.
- **Not started**, waiting for the user's word: Stage 1J, the Arabic root layout / font preload, publication, sitemap
  and indexing changes, `robots` changes, OG regeneration, the Theme Lab's removal and deployment.

---

Stopped after Stage 1I correction 3. Not begun: Stage 1J, Arabic root-layout/font preload, publication,
sitemap/indexing, robots changes, OG regeneration, Theme Lab removal, deployment. Returned for independent review.
