# RAWASY Metal Website — Modern Commerce A V2: background performance and contrast optimization

**Date:** 2026-09-28 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `4fa3001` (this report is in the following commit)

**Status: the optimized background is built and returned for your visual review. I have not approved it.**

- Only the site-wide ambient background changed, plus the text protection it needs (reading zones and less translucent section sheets). The hero, header, typography, cards, services, machinery, projects, clients, contact, footer structure, pointer and both laser animations are unchanged. The hero plate's markup is untouched.
- The idea is kept: a visible micro-dot pattern, warm orange and steel blue with a touch of teal, slow movement, and the one precision motif (a band of light crossing the dots), in both themes, across the whole page. It is not static.
- A V2 is not migrated. Stage 1E was not started. A, B and C are unchanged, and so is the live website (item 24).

## In short

| | Pass 2 (still background) | Five layers (previous) | Now |
| --- | --- | --- | --- |
| Moving background layers | 1 (the hero glow) | 6 | **2** |
| Scrolling the whole page, 1440 px (median of 10 runs) | 55.2 fps | 43.4 fps | **54.7 fps** |
| Scrolling the whole page, 390 px phone | 60.2 fps | 60.2 fps | **60.2 fps** |
| Idle mid-page, 1440 px: CPU · redraws a second | 0.6 % · 0 | 16 % · 13 | **6.8 % · 5** |
| Worst single pixel behind body text | — | 2.37:1 | **7.06:1** |

All figures come from software compositing in this container (no GPU), the worst case. Details are under items 15–18.

## What was wrong, and what changed

**Performance: three causes, each measured and removed.**

1. **Sub-pixel movement.** The five layers moved by fractions of a pixel (steps of 0.1–0.5 px, and a slight scale on the fields). Without a GPU, a layer at a changing fractional position is redrawn with filtering on every frame. In my prototypes, the same structure moved in whole-pixel steps went from 46 to 59 fps. Every moving layer now moves only in whole pixels.
2. **Too many full-screen layers.** Every frame blends each full-screen layer. The five moving layers (plus a sheet of dots) are now two: one opaque surface (page colour, micro-dots and colour) and the band of light above it. Measured in one batch on the same page: the same look built as a still dots layer under a translucent colour layer scrolled at 52.4 fps; as one opaque surface, 55.4, level with Pass 2 (55.2).
3. **A whole-page restyle at every scroll start and stop.** The rule that rests the background while the page scrolls ended in `> *`. Each start and end of a scroll therefore restyled 1,686 of the page's 1,767 elements (about 14 ms each). The rule now names the two layers: 2 elements and 0.5 ms per change, and a test guards it.

**My previous benchmark was wrong, and the figures here replace it.** The lab uses smooth scrolling (`scroll-behavior: smooth`). The benchmark called `scrollTo` on every frame, which restarted a smooth scroll each time, so the page barely moved (it reached 4–470 px of a 7,190 px page). The "31–38 fps" in the previous report was measured that way, near the top of the page. Every scroll figure below scrolls the whole page, top to bottom in 5 s, and I checked that each run reached the bottom. Measured properly, the five-layer build scrolled at about 45 fps rather than 31–38, and Pass 2 at 55–56.

**Contrast: text is protected by structure, not by darker text.**

- In the five-layer build, a lit dot of the light band or a strong patch of colour could sit directly behind text on the open sections (hero, About, Projects), where nothing covered the background. The worst single pixel behind body text measured 2.37–3.98:1.
- Now, text blocks on the open sections sit on a **reading zone**: a soft patch of page colour at 90 %, feathered at its edges. You do not see it as a shape; the dots and the light simply fade as they pass under the text. A scan of the homepage finds no text left directly on the background.
- **Section sheets are 88–92 % opaque** (were 68–72 %), and cards stay opaque.
- The worst single pixel behind any body text is now **7.06:1** (item 18).
- The background stays strongest where there is no text: the hero's margins, the gaps between sections, the sides of the sheets, around cards.

## How to view

- `npm run build && npm start`, then open `/theme-lab/en/modern-commerce-a-v2` and `/theme-lab/ar/modern-commerce-a-v2`. Add `?theme=dark`, or use the sun / moon switch, for the dark theme.
- Watch for 20–30 s without scrolling. The first light pass begins about 5 s after load, then one comes every 26 s. It shows best in the hero's margins, below the hero's text and in the gaps between sections. Under text it fades almost away, by design.
- The design-system sheet: `/theme-lab/en/modern-commerce-a-v2/system`, block *Background motion*, now with a measured-cost table.
- Reduced motion (OS setting): everything holds still.

---

## Report items

### 1. Implementation commit

`4fa3001` (full: `4fa300199fdc7ebb013925095b9961f941690235`) — "Optimize A V2's background: one opaque surface and the light, text protected".

It changes eight files:

- `a2/a2.css`: the ambient, the reading zones, the sheet opacities and the motion rules;
- `a2/Ambient.tsx`: the two layers;
- `a2/HomeA2.tsx`: reading-zone classes only;
- `a2/SystemA2.tsx` and `options.ts`: the sheet;
- `e2e/theme-lab-a-v2.spec.ts`;
- `CLAUDE.md` and `README.md`.

### 2. Branch SHA

The branch head is the commit that adds this report, directly on top of `4fa3001`. It is pushed to `claude/new-session-5eijs6`, and its SHA is given in the chat report.

### 3. Old layer architecture (the five-layer build, `cbae2d1` / report `2026-09-27-a-v2-background-motion.md`)

From the bottom up:

| # | Layer | What it was | How it moved |
| --- | --- | --- | --- |
| 0 | `.lab-a2` background | The page colour | still |
| 1 | `.a2-ambient-sweep` | A soft band of light, 60 % of the screen wide, under the pattern | crossed every 26 s, 20 steps a second while crossing |
| 2 | `.a2-ambient-pattern` | The page colour as a sheet perforated with 2.3 px dots every 24 px | drifted 12 × 7 px in 0.1 px steps |
| 3 | `.a2-ambient-warm` | Orange field | 66 × 44 px, scale 1.06, breathing 0.55–1, in 0.5 px steps |
| 4 | `.a2-ambient-cool` | Steel-blue field | 60 × 42 px, scale 1.05, breathing |
| 5 | `.a2-ambient-teal` | Teal field (desktop and tablet) | 40 × 28 px, scale 1.08, breathing |
| — | Hero's two glows (`.a2-glow`) | Local orange and steel glows | smooth drift over 30 s while the hero was on screen |

- **Five moving full-screen layers** (three on phones), plus the hero's two moving glows.
- Every step was a fraction of a pixel, and the fields also scaled.
- Sheets were 68–72 % opaque. Nothing protected text on the open sections.

### 4. New layer architecture

From the bottom up:

| # | Layer | What it is | How it moves |
| --- | --- | --- | --- |
| 0 | `.lab-a2` background | The page colour | still |
| — | `.a2-ambient` | The fixed container: `z-index: -1` inside the isolated `.lab-a2`, `contain: strict`, a size container, `aria-hidden`, no pointer events | **paints nothing** |
| 1 | `.a2-ambient-field` · **the surface** | **One opaque layer:** the page colour, the micro-dots and the three colour fields | drifts 48 × 24 px in 2 × 1 px steps; breathes between 0.7 and 1 |
| 2 | `.a2-ambient-sweep` · **the light** | A band of orange dots on the same 24 px grid | crosses in 24 px steps every 26 s; drifts with the surface |
| — | Sections, cards, text | Sheets 88–92 % opaque; reading zones under text on the open sections; cards opaque | still |
| — | Header, pointer | unchanged | — |

- Exactly the brief's §3 suggestion: layer 1 is the micro-pattern and the colour fields combined; layer 2 is the sweep.
- Only `transform`, `translate` and `opacity` animate, always in whole pixels, on the compositor. There is no canvas, WebGL, particles, filter or blur animation.
- The hero's two glows are now still (§16): the surface already moves behind the hero, so the hero keeps its warmer look without two more moving layers. `HeroPlate` is unchanged.
- The footer and the dark contact panel keep their own still dots (§17).

### 5. Full-screen composited layers, before and after

Taken from the DevTools layer tree of each production build, at the top of the homepage, 6.5 s after load:

| Moving layers behind the content | Pass 2 | Five layers | Now |
| --- | --- | --- | --- |
| 1440 × 900 | 1: the hero glow (1008 × 942) | **6**: light 864 × 900, dot sheet 1488 × 948, warm 922 × 922, steel 1037 × 1037, teal 605 × 605, hero glow 1008 × 942 | **2**: surface 1536 × 996, light 864 × 996 |
| 390 × 844 | 1: the hero glow | **5**: light, dot sheet, warm, steel, hero glow | **2**: surface 486 × 940, light 384 × 940 |
| Page content composited over the background | no | yes | yes |
| All layers that draw content (1440 / 390) | 48 / 16 | 54 / 21 | 52 / 20 |

- Any moving background under the page makes Chromium composite the page content as its own layer above it ("overlaps other composited content"). The five-layer build already paid that, and it cannot be avoided without making the background still.
- The surface is opaque, so the compositor draws the whole background as one layer. The light is a second layer, and it is drawn only while it is on screen.

### 6. Dots

- **Where they are:** in the surface's own background, `radial-gradient(circle, var(--amb-dot) 1.15px, transparent 1.75px) 0 0 / 24px 24px`. That draws a 2.3 px dot every 24 px, with no separate dots layer.
- **Ink:** light rgb(40 38 30) at 13 %; dark rgb(200 215 235) at 11.5 %. The surface breathes between 0.7 and 1, so the dots range 9.1–13 % (light) and 8–11.5 % (dark). That is inside the previous brief's 9–14 % and 8–13 %. (The tokens were 12 % and 10 %, constant.)
- **Movement:** the dots move with the surface, one 2 × 1 px step every 1.33 s, 48 × 24 px over 32 s, back and forth. That is §6's option C: integrated into the moving surface.
- **Why not option A (static dots under a moving colour field):** it needs one more full-screen layer to blend on every frame. I built and measured it first: 52.4 fps, against 55.4 for the single surface in the same batch.
- **Registration:** the surface reaches 48 px (two dot columns) past each screen edge, so its dots stay on the 24 px grid whatever the drift. The light's dots are drawn on the same grid and carry the same drift.

### 7. Combined colour field

- **One element** (`.a2-ambient-field`) with three radial gradients, as §4 asks:
  - warm orange, high on the far side (top right; top left in Arabic);
  - steel blue, low on the near side (bottom left; bottom right in Arabic);
  - a little teal, right of centre (§5: kept, small).
- **Sizes** are in container units (32 %, 36 % and 21 % of the screen's longer side), so the colour scales with the screen and draws the sheet's frames too.
- **Strength** uses the same tokens as before (light: orange 12 %, steel 11 %, teal 7.5 %; dark: 10 %, 16 %, 7 %), times the breathing (0.7–1).
- **Movement:** `translate` in 24 steps of 2 × 1 px over 32 s, and `opacity` in 28 steps over 28 s, both back and forth. That is under two changes a second. The three fields now move together; §4 says independent movement is not required.
- **Why this is cheap:**
  - the surface is opaque, so the compositor draws the background as a single layer;
  - its breathing fades it toward the page colour beneath: a blend, not an extra layer;
  - measured: 54.4 fps breathing, 54.6 without.

### 8. Sweep

- **What it is:** `.a2-ambient-sweep`, a band of orange dots above the surface (`--amb-sweep-img`, an SVG data URI). It is a 24 px dot pattern masked by a soft horizontal profile: nothing at the band's edges, 60 % at its centre (dark theme: warm light at 50 %).
- **Size:** 864 px wide on desktop (384 px up to 1024 px), full height.
- **Movement:** it moves in 24 px steps, one dot column at a time, so its dots always sit exactly on the surface's dots. The dots it passes light up; nothing travels between them.
- **Timing:** every 26 s it rests 5.2 s off screen, crosses in 13 s (96 steps at 1440 px, about 7 a second), then rests 7.8 s off the far edge. In Arabic it crosses right to left. It also carries the surface's drift, on the same clock.
- **§7 — kept, because it is performant:**
  - while it rests off screen, the compositor does not draw it;
  - while it crosses, it costs under 1 fps: removing it on the first optimized structure gained 0.8 fps;
  - a band two-thirds as wide scrolled the same (55.2 against 55.0 fps), so its look is unchanged.

### 9. Text-protection strategy

Structural, as §8 asks. Text colours are unchanged.

- **Reading zones** sit on the open sections:
  - the hero's text column;
  - About's text column;
  - the Projects heading and intro (`SectionHead read`);
  - About's "Why RAWASY" label (the only other text on the open background, found by a scan);
  - the design-system sheet's main column.
- **How a zone works:**
  - Each zone is a `::before` of page colour at 90 % (`--read-a`), `z-index: -1` inside an isolated block.
  - It is feathered with a mask: 1.5 rem at the sides (or the page gutter, where that is narrower, so it never reaches past the screen) and 1 rem at the top and bottom.
  - It does not read as a shape. The dots, the light and the colour fade as they pass under the text and come back around it.
- **Section sheets** are 88–92 % opaque (item 10).
- **Cards, panels, buttons and the contact block** are opaque.
- **The ambient is strongest where there is no text:** the hero's margins, the gaps between sections, the sides of the sheets, around cards (§9).
- **Cost:** none measurable (54.8 fps without the zones, 55.0 with them).

### 10. Section-sheet opacity changes

| Sheet | Light: before → now | Dark: before → now | Background seen now |
| --- | --- | --- | --- |
| Muted (Services; Clients and compliance) | 70 % → **90 %** | 68 % → **88 %** | about 10 % (light), 12 % (dark) |
| Raised (Machinery, Industries) | 72 % → **92 %** | 72 % → **90 %** | about 8 % (light), 10 % (dark) |

- Both are within §10's 85–94 %.
- Borders, sheen and shadows are unchanged. The background still reads faintly through the sheets and fully at their edges and in the gaps between them.

### 11. Light appearance

- A warm-mist page with grey micro-dots, a soft warm glow high on the right, steel blue low on the left and a hint of teal.
- Every 26 s a band of orange dots crosses left to right, lighting the dots it passes.
- Strongest in the hero's margins, below the hero's text, in the gaps between sections and beside the sheets; faint under text.
- Frames: proofs 01–03, 07 and 10.

### 12. Dark appearance

- A blue-charcoal page with steel-white micro-dots, a steel-blue field, restrained orange and a hint of teal.
- The light is warm peach dots at 50 %.
- No neon, no black-and-orange gaming look, no pure black.
- Frames: proofs 04–06, 08 and 10.

### 13. Mobile behaviour

At 640 px and below:

- the colour is at 70 % and the teal is off;
- the surface drifts 24 × 12 px (2 × 1 px steps over 32 s);
- the light band is 384 px wide and still crosses every 26 s (about 3 steps a second while crossing).

Two layers move, as on desktop. The five-layer build moved three on phones. Scrolling stays at 60 fps (item 17). Proof 09.

### 14. Reduced motion

- Nothing moves: every ambient animation lives under `prefers-reduced-motion: no-preference`.
- The surface stays at full strength, so the dots and colour are visible. The light rests off screen.
- The design-system sheet's first frame ("Still · reduced motion") shows exactly this.
- Tested in both themes (e2e). Proof 13.

### 15. Desktop scrolling performance, before and after

**How it was measured**

- Three production builds side by side:
  - Pass 2 (`765b97a`);
  - the five-layer build (`d6fdef1`, the previous commit);
  - this build.
- Headless Chromium in this container. **There is no GPU here, so Chromium composites in software: the worst case.** A normal browser composites these layers on the GPU at very little cost. I could not measure that here.
- **Scrolling:** a fresh page, 6.5 s after load, scrolled from top to bottom in 5 s with one instant step per frame. Every run reached the bottom.
- The builds take turns, run by run, so changes in the machine's speed hit all three alike. Absolute figures move by 1–3 fps between batches; compare within a row.

| 1440 × 900 | Pass 2 | Five layers | Now |
| --- | --- | --- | --- |
| **Scroll, 10 runs: median (range)** | 55.2 fps (53.8–56.8) | 43.4 fps (40.0–45.2) | **54.7 fps (53.6–55.6)** |
| Frames over 50 ms in those 10 runs | 7 | 40 | 15 |
| Scroll, 5 runs of the full benchmark: median (range) | 55.0 (54.6–55.6) | 43.6 (38.2–45.2) | 53.6 (51.6–54.8) |
| Main-thread time during a scroll (5 runs) | 1,515 ms | 1,315 ms | 1,548 ms |
| After the last change (the About label's zone), 5 runs | 53.0 | — | 53.0 |

**Against the brief's targets:**

- **Minimum (consistently above 50 fps): met.** In 20 runs the new build never fell below 51.6 fps.
- **Ideal (≥ 55): not quite.** The median is 53.6–54.7, against Pass 2's 55.0–55.2 measured alongside, which puts the new build within 1–2.5 % of Pass 2. It does not reach 55 in every run; neither does Pass 2 (53.8–56.8 here).

**Attribution** (5 runs each, same batch):

| Variant | fps |
| --- | --- |
| No ambient at all | 55.8 |
| The new ambient | 55.0 |
| Without the reading zones | 54.8 |
| With a light band two-thirds as wide | 55.2 |
| Pass 2 | 55.2 |

The whole background now costs under 1 fps.

**The path** (all whole-page scrolls):

- five layers: 43–45 fps;
- first optimized structure (a still dots layer, one translucent colour layer and the light): 52.4–54.0;
- one opaque surface and the light: 53.0–55.0 across five batches, with Pass 2 at 53.0–55.2 alongside.

Also measured:

- **Sub-pixel against whole-pixel moves** of the same prototype layers: 46 against 59 fps. (An early prototype, measured before I found the benchmark flaw, so it isolates compositing cost near the top of the page.)
- **Opacity on a layer whose child moves** (one way to breathe the surface): 46.8 fps. Rejected. The light carries the surface's drift instead.
- **125 % and 150 % display scaling:** a surface resting at a fractional device pixel costs nothing (150 %: 54.8 fps against 53.0 at a whole pixel).
- **The rest while scrolling is not relied on (§15).** With the rest disabled, the light keeps moving through a scroll at the same frame rate (52.6 fps either way). It stays for calm, and it now costs 0.5 ms per start or stop instead of a whole-page restyle.
- **Main thread:** the same work as Pass 2 (traced); the motion itself runs entirely on the compositor.

### 16. Idle CPU, before and after

| Idle 5 s, 1440 px (5 runs, medians) | Pass 2 | Five layers | Now |
| --- | --- | --- | --- |
| **Mid-page (Clients): CPU** | 0.6 % | 16 % | **6.8 %** |
| Mid-page: frames drawn | 0 | 66 (13 a second) | **26 (5 a second)** |
| Mid-page: main thread · style recalcs · layouts | 1 ms · 0 · 0 | 3 ms · 0 · 0 | 2 ms · 0 · 0 |
| Top, hero on screen: CPU | 85.4 % | 102.6 % | **56.2 %** |
| Top: frames drawn | 301 | 203 | 301 |

- **What CPU means here:** one core's share, for all browser processes together, in software compositing. A GPU would take most of it.
- **Mid-page, where only the background moves:** 6.8 % and 5 redraws a second, less than half of the five-layer build's 16 % and 13. That is the price of a background that is always alive, against Pass 2's still one.
- **At the top:** the hero plate's four hot points breathe continuously (unchanged), so every build redraws 60 times a second. The five-layer build could not keep up (203 of 300). The new build uses a third less CPU than Pass 2 there, because the hero's glows no longer drift.

### 17. Mobile performance

| 390 × 844, DPR 2 (5 runs, medians) | Pass 2 | Five layers | Now |
| --- | --- | --- | --- |
| **Scrolling the whole page** | 60.2 fps | 60.2 fps | **60.2 fps** |
| Frames over 50 ms | 0 | 0 | 0 |
| Idle at the top: CPU · frames in 5 s | 14.6 % · 301 | 24.2 % · 301 | **7.0 % · 22** |
| Idle mid-page: CPU · frames in 5 s | 0.6 % · 0 | 7.8 % · 63 | **4.2 % · 7** |

- **At the top:** on a phone the hero's hot points sit below the first screen, so only the background moves there: 22 frames in 5 s. Pass 2 and the five-layer build redrew 60 times a second, because of the hero glows' smooth drift.
- **Main-thread time during the phone scroll:** 1,557 / 1,632 / 1,692 ms. The trace shows the same work as Pass 2; the spread is paint and reveal timing, not the background.

### 18. Contrast results

**axe-core** (WCAG 2.2 AA + best practice), 16 audits: EN/AR × light/dark × 1440/390 × homepage/design-system sheet.

- **As rendered:** 0 violations.
- **Worst case:** 0 violations. For this run the ambient is replaced by its worst area colour painted on the page itself, with the sheets composited over it.
- **"Needs review":** axe lists text on the reading zones for manual review, because it cannot compute a background under a pseudo-element. That is 693 items on the sheet, whose whole main column is a zone. The per-pixel checks below cover them.

**Per pixel, before and after.** The method (the same as the e2e test):

- the element's own text, icons and decorations are hidden;
- the colour is held at full strength;
- the light band is centred behind the text, on the dot grid;
- every pixel of the text's box is compared with the text colour, and the single worst pixel decides.

8 variants each: EN/AR × light/dark × 1280/390.

| Text | Five layers: worst pixel (variants below AA) | Now |
| --- | --- | --- |
| Hero lead | 3.27:1 (4 of 8) | **7.57:1** (0) |
| Hero points | 3.98:1 (2 of 8) | **14.19:1** (0) |
| Hero label (an opaque pill) | 10.78:1 | 10.78:1 |
| About text | **2.37:1** (4 of 8) | **7.53:1** (0) |
| About heading (large text, 3:1) | 3.84:1 | 14.19:1 |
| About "Why RAWASY" label | 3.98:1 (2 of 8) | **14.19:1** (0) |
| Projects intro | **2.40:1** (4 of 8) | **7.54:1** (0) |
| Services intro (sheet) | 5.98:1 | 7.06:1 |
| Clients intro (sheet) | 5.98:1 | 7.06:1 |
| Industries heading (sheet) | 9.77:1 | 12.01:1 |

**Full per-pixel audit of the new build:**

- **Scope:** 44 texts and labels, covering the homepage's open sections and sheets and the design-system sheet's headings and notes.
- **Variants:** EN/AR × light/dark × 1440/390, each with the light behind the text and away from it.
- **Result:** 528 captures, **0 below AA**.
- **Lowest body-text pixel:** 7.06:1 in light (on a sheet), 7.50:1 in dark. That is the text's contrast on the plain surface: the background no longer lowers it measurably.

**Text directly on the background:** a scan (no opaque surface, sheet or zone under it) found one text, About's "Why RAWASY" label. It now has its own zone, and the scan finds none in EN/AR at 1440 and 390 px.

**e2e:** the per-pixel test covers 10 texts in both themes and languages. Pass 2's text-contrast tests still pass.

### 19. Visual frame comparison

- **Proof 10** compares the five-layer build with this one at the same moment (10 s): the hero in light, and About in light and dark.
- **Kept:**
  - the dot grid;
  - the colours and where they sit;
  - the light: orange dots lighting up across a band, on the same 26 s cycle and 13 s crossing;
  - both themes;
  - the hero's warm look.
- **Measured.** About, 10 s against 0 s, counting the pixels the light turns orange:

  | Theme | Outside the text: before → now | Under the text: before → now |
  | --- | --- | --- |
  | Light | 1,161 → 1,049 (90 %, same strength) | 91 % fewer |
  | Dark | 364 → 498 | 94 % fewer |

  In the open space the effect is kept (the brief asked for 80–90 %); under text it is almost gone, as intended.
- **What looks different, by design:**
  - the light and colour fade under text blocks;
  - the sheets are more opaque, so the background reads mostly at their edges and in the gaps between them;
  - the colour fields move together, without scaling;
  - the dots drift and breathe with the colour (48 × 24 px over 32 s) instead of drifting 12 × 7 px on their own;
  - the hero's glows are still.
- **Proof files:**
  1. `01`–`06` — the hero at 0, 10 and 20 s, in light and dark.
  2. `07`–`08` — About, Services, Projects and Contact at 10 s.
  3. `09` — phone.
  4. `10` — before / after.
  5. `11`–`12` — text protection at 2×.
  6. `13` — reduced motion.
  7. `14` — Arabic.
  8. `15` — the sheet block.

### 20. Lint

`npm run lint` — passed, no warnings.

### 21. Typecheck

`npm run typecheck` — passed.

### 22. Build

`npm run build` — passed; 125 static pages generated, as before.

### 23. Tests

`npm run test:e2e` on the final build: **202 passed** in 5.5 min. The five-layer pass had 199; A V2 now has 42 tests.

**New tests:**

- **Scroll restyle:** marking the page as scrolling restyles only the two moving layers. Traced: at most 4 elements per change, where it used to be about 1,700.
- **Reading zones:** they cover the text, stay on screen (1280 and 360 px) and sit under it, in both languages, on the homepage and the sheet.
- **Per-pixel contrast:** no single pixel behind 10 texts drops below AA with the light directly behind them, in both themes and languages.

**Rewritten for the new architecture:**

- the fixed layer and its opaque surface;
- two moving layers in whole-pixel steps, with the light drifting in step with the surface (sampled over 64 s);
- the main-thread cost;
- resting while scrolling (4 animations);
- sheets at 85–94 %;
- the sheet's frames;
- the phone version;
- reduced motion.

**Two bugs in my own new test helper, found and fixed during this pass.** They made test failures look like design failures:

- It read the text colour after hiding the text. The computed style is live, so it compared everything with black.
- It hid the measured element's own `::before`. For the "Why RAWASY" label, that is its reading zone.

**Also fixed:** the first reading zones reached 24 px past a 16 px phone gutter and made the page scroll sideways. They now stop at the gutter, and the overflow tests (360–1920 px) pass.

### 24. Proof that the main website is unchanged

Every prerendered file was compared with the previous commit's build (`d6fdef1`):

- **All 116 website pages:** HTML identical, and so are their RSC payloads.
- **The website's stylesheets:** byte-identical (the same two files, sha256 `ca4c9ecf…` and `72e06447…`).
- **A, B and C:** HTML identical. The stylesheet the lab options share gained two utility classes used by the new sheet table (`max-w-[62em]`, `min-w-[44rem]`); nothing else in it changed.
- **What changed:** only the four A V2 pages, in HTML and RSC.
- **One extra file set:** `en/services/not-a-service` is in this build's folder but is not build output. It is the 404 that the running server cached while the e2e suite checked it, written three minutes after the build.

---

## Needs your confirmation

- **Your visual judgement.** The light now fades under text and the sheets are more opaque: is the background still alive enough? Every control is a token:
  - `--read-a`: the reading zones' strength;
  - `--sheet-muted-a` / `--sheet-raised-a`: the sheets;
  - `--amb-sweep-img`: the light's strength;
  - `--amb-dot`: the dots;
  - `--amb-warm` / `--amb-cool` / `--amb-teal`: the colour.
- **The dots now move and breathe with the colour** (the brief's option C). If you prefer still dots (option A), they cost one more full-screen layer: 52.4 against 55.4 fps in the same batch here.
- The open questions in `docs/ASSET_INVENTORY.md` are unchanged.

## Known limitations

- **Software compositing only.** Every figure comes from this container, without a GPU. Please judge the motion on a normal browser.
- **Scrolling at 1440 px is 1–2.5 % below Pass 2 here** (median 54.7 against 55.2 over 10 runs). The new build does not reach 55 fps in every run; neither does Pass 2.
- **Idle cost:** mid-page idle CPU is 6.8 % against Pass 2's 0.6 %. That is the cost of a background that is always alive: about 5 redraws a second.
- **axe cannot check text on the reading zones** and lists it as "needs review"; the per-pixel audit covers it.
- **The previous report's scroll figures were wrong.** Its 31–38 fps came from the flawed benchmark; the corrected five-layer figure is 43–45 fps. Its conclusion (five layers were too slow) still holds.

## Next steps

- Your visual review of the optimized background. I will adjust only what you ask.
- No other work was started: A V2 is not approved or migrated, and there is no Stage 1E, B, C or Phase 2 work.
