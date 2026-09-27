# RAWASY Metal Website — Modern Commerce A V2: background motion correction

**Date:** 2026-09-27 · **Branch:** `claude/new-session-5eijs6` · **Implementation commits:** `cbae2d1` and `ee7e399` (this report is in the following commit)

**Status: the background correction is built and returned for your visual review. I have not approved it.**

- Only A V2's background system changed. Nothing else was redesigned: hero structure, cards, typography, services, machinery, projects, clients, contact, pointer, service animations and footer structure are as they were. The hero plate, the signatures and every section's markup are unchanged.
- A, B and C render exactly as before. The live website is unchanged (proof under item 17).
- A V2 is not migrated. Stage 1E was not started. No admin or backend work. No new facts.

## Why pass 2 looked static

Pass 2's background barely moved:

- the page's dot matrix was fixed paint and never moved;
- only the hero's two glows drifted, and only while the hero was on screen;
- the footer grid was still.

Everywhere below the hero, nothing moved.

## What changed

- **One site-wide ambient layer** (`src/components/theme-lab/a2/Ambient.tsx`) is fixed to the screen behind every section, from the hero to the footer. It has three layers, as the brief asks:
  - **A · micro-dots**, which drift a few pixels;
  - **B · three large soft colour fields** (orange, steel blue, muted teal), which drift and breathe;
  - **C · one precision motif: an illumination sweep.** A soft band of light passes *behind* the dots every 26 s, so only the dots it crosses light up, like light behind a perforated metal sheet.
- **Why the sweep:**
  - It is the part you can see in real time: it crosses the screen in 13 s, so a screen recording catches it.
  - It stays minimal, because only 2.3 px dots change colour.
  - It is a metal-fabrication image, not a blueprint, grid or CAD look.
  - Options 1–3 were not added. The dots' small drift is layer A's own movement (§9–10 give its timing and distance), not a second motif.
- **Section sheets are translucent**, so the ambient continues behind them (about 30 % shows through); cards stay opaque.
- **Small background adjustments:**
  - The hero's top wash is lighter, so the dots show near the top.
  - The hero's own glows run on a 30 s period, inside the brief's range (was 18 s).
  - The footer's local layer uses the same dots instead of a grid.
  - The dark contact panel carries faint still dots.
- **Calm and light:**
  - The layers change a few times a second, in steps well under a pixel, instead of redrawing 60 times a second.
  - The ambient rests while the page scrolls, as the website's own ambient does.
  - Phones get a lighter version.
- **The design-system sheet** has a new *Background motion* block, described under item 13.

## How to view

- `npm run build && npm start`, then open `/theme-lab/en/modern-commerce-a-v2` and `/theme-lab/ar/modern-commerce-a-v2` (add `?theme=dark`, or use the sun / moon switch, for the dark theme).
- Watch for about 20 s without scrolling. The first light pass begins about 5 s after load, once the hero's intro has played. Then it comes every 26 s.
- The sweep is easiest to see in the hero's margins and the plain sections (About, Projects, Contact), and in the gaps beside the section sheets.
- The design-system sheet: `/theme-lab/en/modern-commerce-a-v2/system`, block *Background motion*.
- Reduced motion (OS setting): everything holds still.
- Please judge the motion on a normal browser (see item 11 on this container's software rendering).

---

## Report items

### 1. Implementation commit

`cbae2d1` (full: `cbae2d1f1b9eab33162e22b4609e079199761709`) — "Correct A V2's background motion: visible, minimal, site-wide".

Followed by `ee7e399` (full: `ee7e399f6e423d1b6f686e17f232000589edbd0c`) — "Tidy A V2 background notes: footer glows, measured scroll cost". It is a one-line copy fix on the sheet and a project-memory note. The build and the 78 theme-lab tests were re-run on it and pass.

### 2. Branch SHA

The branch head is the commit that adds this report, directly on top of `ee7e399`. It is pushed to `claude/new-session-5eijs6`, and its SHA is given in the chat report.

### 3. Exact background layers

From the bottom up (the brief's z-order, §13):

| # | Layer | What it is |
| --- | --- | --- |
| 0 | `.lab-a2` background | The page colour: `--bg`, #F4F4F1 light, #131820 dark. |
| 1 | `.a2-ambient-sweep` · **C** | A band of light 60 % of the screen wide, soft on both sides. It rests off screen, then crosses. It lies *beneath* layer A, so it only shows through the dots. In Arabic it crosses right to left. |
| 2 | `.a2-ambient-pattern` · **A** | The page colour as a sheet perforated with 2.3 px dots every 24 px (dot ink `--amb-dot`). It drifts 12 × 7 px. |
| 3 | `.a2-ambient-warm` · **B** | Orange field, 64 % of the screen's longer side, centred near the top right (top left in Arabic). |
| 4 | `.a2-ambient-cool` · **B** | Steel-blue field, 72 %, centred near the bottom left (bottom right in Arabic). |
| 5 | `.a2-ambient-teal` · **B** | Muted teal field, 42 %, right of centre. Desktop and tablet only. |
| — | Sections, cards, text | Sections are transparent or translucent sheets; cards are opaque; text sits on top. |
| — | Header, pointer | The header is sticky and frosted; the pointer is on top. |

**The container** `.a2-ambient`:

- fixed, inset 0, `z-index: -1`, inside `.lab-a2`, which is isolated;
- `overflow: hidden`, `pointer-events: none`, `contain: strict`;
- `aria-hidden`, and a size container, so the same CSS draws the sheet's frames.

**Local layers kept** (separate from the site-wide one):

- **Hero:** its own two glows, drifting while the hero is on screen. They make the hero the strongest point.
- **Footer:** its own layer — the same micro-dots (replacing pass 2's grid), a warm glow and a steel glow.
- **Dark contact panel:** faint still dots across its overlay.

No Canvas, WebGL, Three.js, particles, filter animation or animated blur. Only `transform` and `opacity` move.

### 4. Light theme opacities

| Layer | Value |
| --- | --- |
| Micro-dots | ink rgb(40 38 30) at **12 %** (brief 9–14 %) |
| Warm field | orange rgb(241 95 34) at **12 %** × breathing 0.55–1, so 6.6–12 % |
| Steel field | rgb(44 94 134) at **11 %** × 1–0.55, so 6–11 % |
| Teal field | rgb(27 111 101) at **7.5 %** × 0.45–1, so 3.4–7.5 % |
| Light sweep | orange at **60 %** at the band's centre, seen only through the dots |
| Hero's own glows | orange 13 %, steel 10 % |
| Section sheets | muted **70 %**, raised **72 %** opaque |
| Footer dots, contact panel dots | 9 %, 7 % (light steel-white on dark) |
| Phones | fields × 0.7 |

### 5. Dark theme opacities

| Layer | Value |
| --- | --- |
| Micro-dots | steel-white rgb(200 215 235) at **10 %** (brief 8–13 %) |
| Warm field | rgb(242 106 46) at **10 %** × 0.55–1 |
| Steel field | rgb(80 140 200) at **16 %** × 1–0.55 |
| Teal field | rgb(92 192 176) at **7 %** × 0.45–1 |
| Light sweep | warm light rgb(255 184 140) at **50 %** through the dots |
| Hero's own glows | orange 13 %, steel 15 % |
| Section sheets | muted **68 %**, raised **72 %** opaque |
| Footer dots, contact panel dots | 9 %, 7 % |
| Phones | fields × 0.7 |

The dark theme is blue-charcoal with a steel-blue field, restrained orange and a hint of teal. There is no neon, no black-and-orange gaming look and no pure black.

### 6. Animation timings

| Layer | Period | Pattern | Updates |
| --- | --- | --- | --- |
| Dots drift | 30 s | back and forth | 4 per second |
| Warm field | 32 s | back and forth | 4 per second |
| Steel field | 40 s | back and forth, starts 12 s in | 4 per second |
| Teal field | 28 s | back and forth, starts 7 s in | 4 per second |
| Light sweep | a pass every **26 s** | rests 5.2 s → crosses in **13 s** at a steady pace → rests 7.8 s past the far edge | 20 per second while crossing |
| Hero's own glows | 30 s (was 18 s) | back and forth, only while the hero is on screen | smooth |

- All within the brief: glow 28–45 s, pattern drift 24–40 s, sweep 18–30 s.
- The periods differ, so the composition never repeats quickly.
- **No reset jump.** The fields and dots reverse smoothly. The sweep restarts while it is off screen.
- The first pass starts about 5 s after load, once the hero's intro has played.
- **Stepped updates.** Every layer changes on one shared clock, in steps well under a pixel (0.1 px for the dots, 0.5 px for the fields). A step of that size is invisible, and the screen is redrawn a few times a second instead of 60.
- **While the page scrolls, the layers rest** where they are. They carry on from the same point 200 ms after the last scroll.

### 7. Movement distances

| Layer | Desktop (1440 × 900) | Phone (390 × 844) |
| --- | --- | --- |
| Dots | 12 × 7 px (brief 6–14) | still |
| Warm field | 66 × 44 px, scale 1.06 | ≈ 28 × 19 px |
| Steel field | 60 × 42 px, scale 1.05 | ≈ 26 × 18 px |
| Teal field | 40 × 28 px, scale 1.08 | off |
| Hero glows | ≈ 50 × 38 px | same keyframes |
| Light sweep | from fully off one edge to fully off the other (≈ 2,300 px in 13 s, ≈ 175 px/s) | ≈ 700 px in 13 s |

- The fields' distances follow the screen's shorter side and are capped (at most 66 px), within the brief's 30–80 px.
- The sweep is light, not an object. Nothing visible travels across the screen; the dots under the band change colour as it passes.

### 8. Section-sheet transparency changes

| Surface | Pass 2 | Now | Background seen |
| --- | --- | --- | --- |
| Hero | a 70 % light wash over the whole hero | 50 % wash over the top 32 rem only | all of it, plus the hero's own glows (strongest point) |
| Page sections (About, Projects, Contact) | transparent | unchanged | all of it |
| Muted sheets (Services; Clients and compliance) | opaque | **70 %** light / **68 %** dark | ≈ 30 % / 32 % |
| Raised sheets (Machinery, Industries) | opaque | **72 %** | ≈ 28 % |
| Cards and panels | opaque | unchanged | none |
| Dark contact panel (photo) | opaque | unchanged, plus its own still dots at 7 % | local |
| Footer | own grid and glows | own dots and glows | local |

- The sheets keep their sheen, borders and shadows. At 70–72 % they still read as panels, and cards stay more opaque than sections.
- **I did not use the brief's example of 97–98 %** (§6). At 97 %, only 3 % of a 12 % dot would show (about 0.4 %), so the background would vanish behind the sheets. That contradicts §5's 20–35 % for raised sheets. I followed §5 and re-measured readability (item 12).
- If you prefer a different balance, it is two tokens: `--sheet-muted-a` and `--sheet-raised-a`.

### 9. Reduced-motion behaviour

- Nothing moves: every ambient animation exists only under `prefers-reduced-motion: no-preference`.
- The dots and all three fields stay visible, at full strength.
- The light sweep rests off screen. The hero glows are still, as before.
- The sheet's first frame ("Still · reduced motion") shows exactly this state.
- Tested in both themes, and by the existing "nothing animates with reduced motion" tests.

### 10. Mobile behaviour

At 640 px and below, a lighter version:

- the dots hold still;
- the teal field is off;
- the warm and steel fields are smaller (56 % and 60 % of the longer side) and at 70 % strength;
- their movement scales down to about 28 × 19 px;
- the light band is 80 % of the screen wide and still passes every 26 s.

Three layers move instead of five. Scrolling on a phone stays at 60 fps (item 11).

### 11. Performance before and after

**How it was measured:**

- Pass 2 (`765b97a`) against this build, both production builds, headless Chromium in this cloud container.
- **This container has no GPU, so Chromium composites in software. That is the worst case.** A normal browser composites these layers on the GPU, where they cost very little. I could not measure on a GPU here.
- Median of three runs.
- **Scroll:** 5 s, top to bottom.
- **Idle:** 5 s, after the hero's intro. Measured at the top (the hero's own loops run in both builds) and at mid-page (Clients, reached by an instant jump), where only the new ambient moves.
- **CPU:** all browser processes together.

| Measure | Pass 2 | Now |
| --- | --- | --- |
| **1440 px · scroll**, first pass through the page (5 runs, 6.5 s after load) | 58–60 fps (median 59) | **30–33 fps (median 31)** |
| **1440 px · scroll**, a later pass (median of 3) | 60 fps, 0 frames over 50 ms | **38 fps**, 4 frames over 50 ms (worst 67 ms); 44 fps in an earlier run |
| 1440 px · idle 5 s at the top (the hero's own loops run in both) | CPU 95.8 %, 297 frames, main thread 50 ms | CPU 102.8 %, 181 frames, main thread 38 ms |
| **1440 px · idle 5 s at mid-page** | CPU 0.6 %, 0 frames, main thread 1 ms | **CPU 16.4 %, 67 frames (≈ 13 a second), main thread 4 ms** |
| **390 px phone (DPR 2) · scroll** | 60 fps, 0 frames over 50 ms | **60 fps, 0 frames over 50 ms** |
| 390 px · idle 5 s at the top | CPU 15 %, 301 frames | CPU 24.6 %, 301 frames |
| 390 px · idle 5 s at mid-page | CPU 0.4 %, 0 frames | CPU 7.2 %, 63 frames |
| Composited layers at the top (1440 / 390) | 48 / 16 | 54 / 21 |
| Layouts during idle | 0 | 0 |

CPU is the share of one core used by all browser processes. In this container that includes the software compositing, which a normal browser moves to the GPU.

- **Main thread: no cost.**
  - Idle at mid-page: 4 ms (pass 2: 1 ms) of main-thread time per 5 s, and 0 layouts.
  - In a 2 s window: the same handful of style checks as a still page, which the e2e test asserts.
  - The motion never restyles or lays out anything; I verified that Chromium runs these keyframes (including `var()`, `%` and container units) on the compositor.
- **What the measures bought (1440 px, software compositing, measured during the work):**
  - Stepped updates cut idle redraws at mid-page from about 43 to 20 a second during a light pass and 4 between passes. CPU went from 103 % to about 17 % of one core.
  - Resting while scrolling does not change the frame rate (31 fps with it, 32 without). I kept it because the page is calmer while you scroll, as on the website.
  - Phones are at 60 fps with or without the ambient.
- **What I tried and did not adopt:**
  - Hiding the light band while scrolling: no gain.
  - Dropping the animations for the length of a scroll, which lets Chromium merge the layers: about 44 fps on a first scroll here. The cost is a repaint of the whole background at the start of every scroll, which is cheap on a GPU but lands at the worst moment. That would make normal browsers slightly worse to help machines without a GPU.
- **What remains:**
  - **In software compositing, scrolling at 1440 px drops from about 60 to 31–38 fps** (31 on the first pass, while reveals and signatures also play). A moving layer between the page colour and the content makes Chromium composite the page content separately, and each extra full-screen layer is blended in software.
  - The layer count rises from 48 to 54: five ambient layers, plus the one carrying the page content. Only visible tiles are drawn.
  - Idle drawing rises from nothing to a few frames a second. An always-moving background cannot be free, but it is kept at a few redraws a second.
  - Removing the teal field (optional in §8) did not change the first-scroll frame rate in my runs (31 fps either way). I kept it because §4 lists three fields.

### 12. Contrast results

**axe-core** (WCAG 2.2 AA + best practice), 16 audits: EN/AR × light/dark × 1440/390 × homepage/design-system sheet.

- **As rendered:** 0 violations.
- **Worst case:** 0 violations. axe cannot see the ambient (decoration layers are skipped by its element stack). So a second run paints the ambient's worst area colour on the page itself — light rgb(204 212 218), the strongest field plus the hero's own glow; dark rgb(40 60 84), the lightest — with the translucent sheets composited over it.

**Rendered pixels over the live ambient.** Each text is captured with the text made transparent. The ambient is held at rest and with the light band centred behind the text. The text colour is compared with the worst background pixel (2nd / 98th percentile), for EN/AR × light/dark × 1440/390.

| Where | Light | Dark |
| --- | --- | --- |
| Body text on section sheets (Services, Machinery, Industries, Clients) | ≥ 7.37:1 | ≥ 8.37:1 |
| Headings on section sheets | ≥ 14.8:1 | ≥ 13.4:1 |
| Body text on page sections (hero lead, About, Projects) | ≥ 7.04:1 | ≥ 8.41:1 |
| Headings on page sections | ≥ 13.8:1 | ≥ 13.2:1 |
| Contact rows (cards) | 8.78:1 | 8.61:1 |

- **The single worst pixel.** On sheets, a lit dot directly behind a glyph still gives ≥ 5.96:1. On plain page sections it drops to **2.4–3.5:1**. That pixel is one 2.3 px dot of the texture, not the text's background; the area worst above is what text sits on. I report it so you can judge it.
- **Text over photos and gradients** (the pass 2 check) is unchanged. The dark contact panel's label is 12.2:1 (light) and 11.6:1 (dark) on its text area; it was 12.7:1, and the drop is the panel's new faint dots.
  - As in pass 2, the automated box around that label also takes in the eyebrow's light dot ring and reads 1.13:1. That ring is not behind the text.
- The e2e check of text contrast in both themes and both languages passes, including buttons, cards and Arabic.

### 13. Screenshots and frame sequence

All frames come from the production build. They show the live page with every background animation held at the same moment. One-time intros are finished, and the lab bar is hidden.

1. `01-light-0s.png` — light, 0 s, top of the homepage: the light rests off screen.
2. `02-light-10s.png` — light, 10 s, same position: the light band crosses the left third; the dots it crosses turn orange.
3. `03-light-20s.png` — light, 20 s, same position: the light has passed; the fields and dots have moved.
4. `04-dark-0s.png` — dark, 0 s.
5. `05-dark-10s.png` — dark, 10 s: the dots light up warm.
6. `06-dark-20s.png` — dark, 20 s.
7. `07-light-svc.png` — mid-page, Services (light): the ambient through the section sheet, at 0 s and 10 s, with 1:1 details.
8. `08-dark-proj.png` — mid-page, Projects (dark): the full ambient behind a page section, at 0 s and 10 s, with 1:1 details.
9. `09-mobile.png` — phone, 390 × 844, light and dark, at 0 s and 11 s.
10. `10-reduced-motion.png` — reduced motion, light and dark: still, with the dots and fields visible.
11. `11-sweep-sequence-light.png` — the sweep as a 1:1 sequence at 7, 10, 13 and 16 s (light). At 13 s the band is mostly behind the plate card.
12. `12-sweep-sequence-dark.png` — the same in dark.
13. `13-difference-0-20s.png` — what changed between 0 and 20 s, amplified ×8: drifting dots, shifting and breathing fields. The four small spots on the plate are its hot points, which breathe on their own.
14. `14-arabic-10s.png` — Arabic at 10 s: the light crosses right to left, and the warm field sits top-left.
15. `15-sheet-background-motion.png` — the design-system sheet's new *Background motion* block (English, light).

**The design-system sheet's new *Background motion* block:**

- light and dark rows of frames: still (reduced motion), 8 s (the light enters), 11 s (mid-screen), 14 s (leaving). They are the live layers held at those moments.
- a layer table: light and dark opacities, movement, timing, phone behaviour;
- a surface table: how much of the background each surface shows.

**Elsewhere on the sheet:**

- the token table lists `--amb-dot / --amb-sweep`, `--amb-warm / --amb-cool / --amb-teal` and `--sheet-muted-a / --sheet-raised-a`;
- the pass 2 "Ambient background" samples were replaced;
- the motion table and notes are updated.

### 14. Lint

`npm run lint` — passed, no warnings.

### 15. Typecheck

`npm run typecheck` — passed.

### 16. Build

`npm run build` — passed. Every route prerendered as before.

### 17. Tests

`npm run test:e2e` — **199 passed** in 5.2 min. Pass 2 had 191; A V2 now has 39 tests.

**Eight new tests:**

- one fixed ambient behind every section (homepage and sheet, EN/AR): hidden from assistive technology, never catches the pointer, fills the screen, the h1 stays on top;
- it moves on long periods (24–45 s) with the right directions, rests off screen, crosses to mid-screen, and stays within 12 × 7 px (dots) and 80 px (fields);
- no main-thread work once the page is still;
- it rests while the page scrolls, and its clocks hold;
- sheets translucent (65–80 %) while cards stay opaque, in both themes;
- the sheet's frames: still, 8, 11 and 14 s, in both themes, with the light entering from the reading side in both languages;
- the phone version: still dots, no teal field, fields at 70 %, the light still passes;
- reduced motion: nothing moves, the dots and fields stay visible, and the sweep rests off screen.

**One pass 2 test made robust.** The pointer test hovered the plate's centre while the plate's cut sequence was still running, so the opening could change under a still mouse. It failed twice under full-suite load. It now waits for the sequence to finish, and passed in every run since.

**The live website is untouched.** I compared this build with pass 2's build for every prerendered file:

- All 116 website pages are identical in HTML, and so are their RSC payloads. In one page, Next's `next-size-adjust` meta tag moved within `<head>`, which is known build noise.
- The website's stylesheet is byte-identical.
- Only the four A V2 lab pages and the two lab stylesheets changed.

---

## Needs RAWASY's or your confirmation

- Your visual judgement: is the motion visible enough, and minimal enough? The main controls are all tokens:
  - the sweep's strength (`--amb-sweep`);
  - the dots (`--amb-dot`);
  - the fields (`--amb-warm`, `--amb-cool`, `--amb-teal`);
  - the sheets' translucency (`--sheet-muted-a`, `--sheet-raised-a`).
- Whether to keep the teal field (the brief marks teal optional in dark mode) or run two fields. Two would be simpler, though I measured no scroll gain from dropping it.
- The open questions in `docs/ASSET_INVENTORY.md` are unchanged.

## Known limitations

- The performance figures come from software compositing in this container; please check the motion on a normal browser.
- On plain page sections, a lit dot can sit directly behind a glyph for a moment (item 12).
- The sheets are more translucent than the brief's 97–98 % example, to meet its 20–35 % for sheets (item 8).
- The header's frosted glass redraws when the background under it changes. With stepped updates that is at most 20 times a second during a light pass.

## Next steps

- Your visual review of the background. I will adjust only what you ask.
- No other work was started: A V2 is not approved or migrated, and no Stage 1E, B, C or Phase 2 work.
