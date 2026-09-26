# RAWASY Metal Website — Modern Commerce A V2: refinement pass 2

**Date:** 2026-09-26 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `fc5f618` (this report is in the following commit)

**Status: A V2 pass 2 is built and returned for your visual review. I have not approved it.**

- Only A V2 changed: its homepage, its design-system sheet, and the two lab files it needs (lab data and lab labels).
- A, B and C render exactly as before. The live website is unchanged (proof in item 18).
- A V2 is not migrated. Stage 1E was not started. No admin or backend work.
- No new facts were introduced. Every figure shown (12,000 W, 6 service lines, phone numbers) comes from the existing content layer. The plate's dimensions are the approved website hero's drawing.

## How to view

- Run `npm run build && npm start`, then open:
  - `/theme-lab/en/modern-commerce-a-v2` and `/theme-lab/ar/modern-commerce-a-v2`
  - add `?theme=dark` (or use the sun / moon switch in the header) for the dark theme
  - `/theme-lab/en/modern-commerce-a-v2/system` for the updated design-system sheet
- The hero plate plays once when half of it is on screen (about 5 s). Reload to see it again, or use Replay on the sheet.
- The pointer, the plate's lean and the X / Y readout need a desktop mouse.

---

## Report items

### 1. Implementation commit SHA

`fc5f618` (full: `fc5f618bca1df857560413f3f0f42013a672ff01`) — "Refine A V2 (pass 2): plate hero, dark theme, pointer, softer backgrounds".

### 2. Branch SHA

The branch head is the commit that adds this report, directly on top of `fc5f618`. It is pushed to `claude/new-session-5eijs6`, and its SHA is given in the chat report.

### 3. Files changed

**New:**
- `src/components/theme-lab/a2/HeroPlate.tsx` — the hero plate: stage, plate, cut sequence, readout, pointer lean.
- `src/components/theme-lab/a2/Cursor.tsx` — the desktop pointer.
- `src/components/theme-lab/a2/ThemeSwitch.tsx` — the light / dark switch.
- `src/components/theme-lab/a2/theme-boot.ts` — applies the theme before first paint (`?theme=`, stored choice, system).

**Changed:**
- `src/components/theme-lab/a2/a2.css` — light and dark tokens, the background system, plate, stage, sheets, ambient layers, pointer, polish, sheet blocks, motion rules.
- `src/components/theme-lab/a2/HomeA2.tsx` — new hero composition; section sheets; theme switch; pointer.
- `src/components/theme-lab/a2/SystemA2.tsx` — new sheet blocks, updated palette, borders, shadows and token table.
- `src/components/theme-lab/a2/SheetControls.tsx` — Replay also drives the hero plate.
- `src/components/theme-lab/signature/useSignature.ts` — an options object (`freeze`, `replay`) and step marks for the readout.
- `src/components/theme-lab/signature/LaserCut.tsx`, `LaserEngrave.tsx` — the new `useSignature` call signature only.
- `src/components/theme-lab/data.ts` — the hero plate's labels (from `home.hero.plate`).
- `src/components/theme-lab/options.ts` — sheet labels in English and Arabic; the lab bar note for A V2.
- `src/components/theme-lab/ui.tsx` — the lab bar shows "Light and dark preview" on A V2 only.
- `e2e/theme-lab-a-v2.spec.ts` — updated for the new hero; 9 new tests.
- `CLAUDE.md`, `README.md` — project memory and documentation.

### 4. Hero animation changes

The website's approved hero plate (Stage 1B) is reinterpreted as A V2's signature visual. It uses the same geometry from `src/components/home/hero/plate-geometry.ts`:

- a 520 × 640 plate with one laser-cut corner
- the eight-point star
- the slot
- four bolt holes
- the perforation field
- its dimensions: 520.00, 640.00, R128, 45°×40, 240×28, 4×Ø22

**The visual:**
- A raised stage that follows the theme, with a spotlight and a faint measuring grid.
- A brushed steel plate with a soft cast shadow, cut walls with a lit lip, and the engraved RW—01 mark.
- The workshop photo (`site/laser-sparks`), warmed, glowing through every opening.
- Orange hot points at the measurement anchors.
- A translucent bar along the bottom holding the two figures that used to float over the photo (12,000 W peak fibre-laser power; 6 integrated service lines) and the readout "Part RW-01 · Cut sequence 07/07".

**The sequence** — about 5.2 s, once, when half in view, on one clock:

| Time | Step |
| --- | --- |
| 0–0.76 s | The plate rises onto its stage |
| 0.2–1.05 s | Dimensions draw in |
| 1.15–2.0 s | The four bolt holes are pierced |
| 2.0–3.0 s | The star is traced at a steady feed, from its pierce point |
| 3.3–3.75 s | The slot is traced |
| 3.9–4.4 s | The perforation field opens row by row, the head rastering back and forth |
| 4.5–5.2 s | The measurement nodes appear |

- The readout counts 00/07 → 07/07. Its light is orange while cutting and teal when done.
- The kerfs glow, then cool away. Slugs drop out.

**After the run:**
- The hot points breathe softly (3.6 s) only while the hero is on screen.
- With a desktop mouse, the plate leans towards the pointer (±4° / ±5°, 1 s ease) and its reflection follows.
- Over the plate, the readout shows X / Y in plate millimetres and the pointer becomes a crosshair.
- It never loops or replays on hover.
- Without JavaScript or with reduced motion, the finished plate shows at once.

**Composition changes:**
- The photo hero and its three floating cards are gone. Two figures moved into the stage bar. The third card (three service names) repeated the capability strip, so it was dropped.
- Calls to action: primary and secondary buttons, then a quick-contact row (phone and WhatsApp, from the content layer).
- The trust list now uses each statement's own icon, in quiet neutral chips.
- The headline grows up to 72 px on large screens (Arabic up to 64 px).

The screenshot `05-hero-before-after.png` shows the website hero, A V2 before, and pass 2 in light, dark and Arabic.

### 5. Empty-space / layout changes

- The content column is `min(1400px, 92vw)`; it was a fixed 1240 px.
- Alternate sections and the footer became sheets, inset 8–20 px from the screen edges, rounded 20–36 px. The page's dot matrix shows between them.
- The hero stage's height follows the screen height (26–34 rem). The hero fits the first view without growing on tall screens.

| Screen | Before · content / margin | Now · content / margin |
| --- | --- | --- |
| 1280 px | 1200 / 40 | 1178 / 51 |
| 1440 px | 1240 / 100 | 1325 / 58 |
| 1920 px | 1240 / 340 | 1400 / 260 |
| 2560 px | 1240 / 660 | 1400 / 580 |

At 1280 px the column is 22 px narrower than before, because 92 vw keeps a margin. From 1440 px up it is wider, and the sheets carry colour close to the edges, so large screens read as full without going edge to edge (`09-layout-width.png`).

### 6. Modern polish improvements

- **Section sheets.** Muted sheets (services, clients + compliance) have a lit top edge. Raised sheets (machinery, industries) have a border and a soft ambient shadow.
- **Footer.** A dark sheet with a measuring grid and a warm glow.
- **Primary buttons.** A lit vertical gradient, and a light that sweeps across on hover (not with reduced motion).
- **Card light.** Service cards, the six quick links and the contact rows show a soft light in their tone that follows the mouse. It fades in and out (registered `--spot` colour).
- **Hero.** Quick-contact links fill their icon chip with the tone on hover. The spec bar and readout sit on a translucent bar.
- **Theme switch.** A short cross-fade where View Transitions are supported (instant with reduced motion).

### 7. Custom cursor implementation

`Cursor.tsx`, one fixed overlay, `aria-hidden`:
- A 6 px orange laser point with a thin light rim, so it also shows on orange buttons.
- A 36 px precision ring that trails the point: it eases 24 % of the way per frame, and the loop stops once it catches up.

**States:**

| State | Look |
| --- | --- |
| At rest | Faint ring |
| Links, buttons, summaries, labels, cards | The ring opens into an orange halo |
| The hero plate | A crosshair |
| Pressed | The ring tightens |
| On dark surfaces (footer, contact panel, laser stage, dark samples) | The ring turns light |

**Rules:**
- **Desktop mouse only:** hover plus a fine pointer.
- The system cursor stays for touch, pens, reduced motion and forced colours. It is also kept over text fields (the I-beam) and the lab bar.
- The system cursor is hidden only after the mouse first moves.
- The point and ring move with the `translate` property on their own compositor layers.
- Nothing depends on the pointer, and keyboard focus is untouched.
- Measured cost: none detectable (item 14).

Previews: `08-cursor.png`, and the Pointer block on the sheet.

### 8. Background softening changes

**Light theme — warm mist instead of cool grey and pure white:**

| Role | Before | Now |
| --- | --- | --- |
| Page | #F4F6F9 | #F4F4F1 |
| Sections | #EBEFF4 | #ECECE8 |
| Cards | #FFFFFF | #FDFDFB (off-white) |
| Text | #111827 / #454E5C | #15171A / #454A50 |

**Dark theme — new; blue-charcoal, never black:** page #131820, sections #171D26, surfaces #1C232D / #222A35 / #283140.

**Background token system (§12 of your brief):**

| Role | Token |
| --- | --- |
| Base background | `--bg` |
| Section background | `--bg-alt` |
| Recessed band | `--bg-deep` |
| Elevated surface | `--surface` |
| Muted surfaces | `--surface-2` / `--surface-3` |
| Accent surface | `--brand-soft` |
| Hero ambient layer | `--hero-top` + `--pattern-line` + `--glow-warm` / `--glow-cool` |
| Dark ambient layer | `--dark` + `--band-glow` |

The sheet shows each one with live light and dark swatches (`06-backgrounds.png`).

### 9. Ambient / pattern changes

**Layers:**
- **Page:** a dot matrix (22 px, ink at 8.5 %).
- **Hero:** a faint measuring grid (56 px) that fades out downwards, and two soft glows (warm and steel) that drift slowly (18 s, alternate).
- **Plate stage:** a measuring grid that fades towards its edges.
- **Footer:** a grid and a warm glow (static).
- **Hot points:** they breathe (3.6 s).

**Rules:**
- Motion runs only while the hero is on screen, and never with reduced motion.
- Every layer sits behind the content: `aria-hidden`, `pointer-events: none`, `z-index: -1`. A test checks this.
- Masks sit only on layers that never move.

### 10. Contrast improvements

**Measured ratios (WCAG 2.2 AA):**

| Pair | Light | Dark |
| --- | --- | --- |
| Headings | 16.30 | 15.71 |
| Body text on the page | 8.11 | 9.69 |
| Body text on cards | 8.78 | 8.61 |
| Secondary text, lowest surface | 5.27 | 5.13 |
| Orange text links, lowest surface | 4.82 | 6.67 |
| Tone text on its tint, lowest | 5.07 | 6.58 |
| Primary button text | 5.47 | 6.05 |
| Footer text | 9.46 | 10.59 |
| Field border (3:1) | 3.55 (was 1.94) | 3.22 |
| Focus ring (3:1) | 6.24 | 8.83 |
| Orange icons on their tint (3:1) | 3.32 (was 2.92) | 5.10 |
| Hero plate labels | 5.40 | 5.89 |

**Fixes:**
- Form-field borders now use `--line-ink`.
- Orange icons on their tint use `--brand-icon` #E3561C.
- Brass text is #7B5C24.

**Audits:**
- **axe-core:** 0 violations in 16 audits. That covers EN/AR × homepage/sheet × light/dark × 1440/390, on the production build.
- **Worst case:** 0 violations in 16 more audits with every gradient replaced by its worst-case solid colour.
- **Rendered pixels:** 64 text samples over photos and gradients, measured on the rendered pixels. All pass. The lowest: project titles 4.82 (large text, 3 needed) and the footer's quote button 5.47.
- One sample (the contact label) first read low. Its box included the eyebrow's light dot ring. Measured on the text alone, it is 12.7.
- **New test:** reads text contrast in both themes and languages on every run.

### 11. Light theme refinement

- Warm mist page with off-white raised cards.
- Section sheets with lit edges; a softer border scale (#E4E4DF / #D6D6D0 / #BAB9B2 / #87877F for fields).
- Shadows with a lit top edge and a warm, soft ambient.
- A light hero stage with a white spotlight; a brushed steel plate with bright highlights.
- An off-white translucent spec bar.
- Everything stays inside the V2 colour roles: orange for actions, steel, teal and brass for their roles, and no rainbow. The trust chips were made neutral for this reason.

### 12. Dark theme refinement

- **Palette:** blue-charcoal (#131820 page, #171D26 sections, #1C232D surfaces). The tones are lifted so they read on dark (orange #F26A2E, steel #7FB0D8, teal #5CC0B0, brass #D7B273).
- **Shadows:** deeper, with a faint top edge.
- **Hero:** a blue-charcoal stage with a cool spotlight, and a darker brushed steel plate with quieter grain and sheen.
- **Header:** a dark translucent header.
- **Kept light on purpose:** client logos stay on light tiles, so their dark marks stay legible.
- **Pointer:** it turns light on dark surfaces.
- **Mechanics:**
  - The theme comes from the header switch or `?theme=dark` and is stored under the lab's own key (`rawasy-lab-a2-theme`).
  - The website's theme setting is never touched (a test checks this).
  - Without JavaScript the page stays light.
  - The dark theme is A V2 only. B and C stay light.

### 13. System-sheet changes

**New blocks:**
- **Hero plate** (first): a live run with Replay, its steps and timings, and still frames of its initial, cutting and finished states.
- **Backgrounds and surfaces:** each role, its token, and live light and dark swatches.
- **Light and dark tones:** the same components in both themes, side by side.
- **Contrast:** the table in item 10.
- **Pointer:** specimens of the five states, and its rules.
- **Ambient background:** samples of the page, hero and dark-band layers.
- **Layout width:** the table in item 5.

**Updated:**
- The summary.
- The palette, with a new dark group and the new values.
- Borders, including fields at 3:1.
- Shadows, including the brand shadow.
- The motion table: hero plate, ambient loops, pointer.
- The token table, now with light and dark columns.
- The lab bar reads "Light and dark preview" on A V2.

Screenshots: `10-system-sheet-en-light.png` and `10b-system-sheet-ar-dark.png`.

### 14. Performance impact

Measured on the production builds, before (`399585c`) against pass 2, median of three runs, in headless Chromium, which renders with a software GPU.

| Case | Frames before | Frames after | Main thread before | Main thread after |
| --- | --- | --- | --- | --- |
| Desktop, first 6 s (hero plays) | 347 | 335 | 759 ms | 1052 ms |
| Desktop, 5 s scroll | 299 | 300 | 412 ms | 380 ms |
| Desktop, 3 s of mouse movement over the hero | 181 | 163 | 1272 ms | 1241 ms |
| Phone, first 6 s | 348 | 347 | 692 ms | 723 ms |
| Phone, 5 s scroll | 301 | 301 | 534 ms | 576 ms |

- No long tasks during scroll or mouse movement.
- The extra main-thread time on desktop load is the plate's single 5-second run.

**Tuning.** My first build cost more. I fixed it:
- The hot points' breathing moved out of the SVG into composited HTML. It had repainted the whole plate every frame.
- SVG and blur filters were removed from the moving drawing. The shadow is now a static drop-shadow.
- No `backdrop-filter`, and no `will-change` combined with a filter, under continuous animation.
- The lean is set by inline transforms, not by a custom property on the whole hero. That had restyled the SVG on every mouse move.
- The readout text is written only when it changes.

**What remains.** Mouse movement over the hero renders 163 frames in 3 s against 181 before. I isolated the cause:
- without the lean: 181
- without the pointer: no change

So the remaining cost is the software compositor projecting the tilted plate. The main thread is unchanged, and a hardware GPU normally composites a perspective-transformed layer cheaply. If you prefer, the lean can be removed and the gap closes.

**Weight and loading:**

| Measure | Before | After |
| --- | --- | --- |
| Page weight | 693 KB | 706 KB (+9 KB JS, +3 KB CSS, +4 KB HTML, all transfer size) |
| A V2 stylesheet, uncompressed | 32 KB | 47 KB |
| LCP, English 1440 | 484 ms | 356 ms |
| LCP, Arabic 1440 | 644 ms | 444 ms |
| LCP, 390 | 240 ms | 268 ms |
| CLS, English | 0 | 0 |
| CLS, Arabic | 0.029 | 0.035 (font swap; good is below 0.1) |

### 15. Accessibility impact

**Decoration and real text:**
- Hidden from assistive technology: the plate, readout, grid, glows, pointer and ambient layers.
- The spec bar's two figures are real text.

**Pointer and keyboard:**
- The pointer never interferes with keyboard focus, and focus rings are unchanged.
- Touch, pens, reduced motion and forced colours keep the system cursor.

**The theme switch:**
- It is a labelled group of two toggle buttons (`aria-pressed`).
- It is only present with JavaScript.

**Reduced motion:** the finished plate, no breathing, no drift, no lean, no pointer, no button sweep, instant theme change.

**Without JavaScript:** everything shows, the plate finished (tested).

**Hero targets:** the quick-contact links are at least 44 px tall.

**Arabic:**
- The readout's Arabic words use the Arabic face with no letter-spacing (tested).
- The plate is an object, so it is never mirrored.

**Contrast:** as in item 10.

### 16. Lint

`npm run lint`: clean (no errors, no warnings).

### 17. Typecheck

`npm run typecheck`: clean.

### 18. Build

`npm run build`: passes, and all 16 lab pages are prerendered.

**The website is unchanged.** I compared every prerendered file with the approved build of `399585c`, normalising the build ID, asset hashes and the router's theme-lab entry:
- **RSC payloads:** 570 of 582 are identical. The 12 that differ are the four A V2 pages' payloads.
- **Meta files:** 125 of 125 are identical.
- **HTML:** on the final build, 115 of the 120 prerendered pages are identical, including A, B and C. The other five:
  - the four A V2 pages;
  - `/en/projects`, whose only difference is the position of `<meta name="next-size-adjust">` in `<head>`. That is the known build noise noted in CLAUDE.md; an earlier build of the same website code matched it exactly.
- **CSS:** the website's stylesheet is byte-identical. Only the lab's two stylesheets changed: `lab.css` and A V2's.

### 19. Tests

`npm run test:e2e`: **191 passed** (4.7 min). This includes the 31 A V2 tests.

**Updated:** the EN/AR mirror test, the tilt test, and the sheet test (the plate now leads). The reduced-motion and no-JS tests now also check the finished plate and the system cursor.

**New tests:**
- the plate's cut order (bolt holes, then star, slot and perforation rows), its readout reaching 07/07, and no replay on hover
- the mouse lean and the X / Y readout
- the plate is never mirrored in Arabic, and its Arabic readout words are not letter-spaced
- the pointer's states, the lab bar keeping the system cursor, and the point sitting exactly on the mouse
- text fields keep the I-beam, and keyboard focus never meets the pointer
- no custom pointer on touch screens
- `?theme=`, the stored choice and the switch, with the website's theme key untouched
- text contrast in both themes and both languages
- no sideways scroll from 360 to 1920 px in both languages and both themes
- ambient layers behind the content

Not in the suite:
- axe (not a project dependency)
- the rendered-pixel checks
- the performance runs

These ran from scripts, as reported in items 10 and 14.

### 20. Screenshots / previews

Sent in the chat (each at most 2400 px tall):

| File | Contents |
| --- | --- |
| `01-home-en-light.png` | Homepage, English, light, 1440 px |
| `02-home-ar-light.png` | Homepage, Arabic, light, 1440 px |
| `03-home-en-dark.png` | Homepage, English, dark, 1440 px |
| `04-home-ar-dark.png` | Homepage, Arabic, dark, 1440 px |
| `05-hero-before-after.png` | Website hero, A V2 before, pass 2 light; pass 2 dark, Arabic light, Arabic dark |
| `06-backgrounds.png` | Before light / after light / after dark, and the sheet's background, ambient and tone blocks |
| `07-contrast.png` | The contrast table, light and dark |
| `08-cursor.png` | Live pointer states in light and dark, and the sheet's pointer block |
| `09-layout-width.png` | 1920 px before and after, the width table, and the sheet's hero-plate block |
| `10-system-sheet-en-light.png`, `10b-system-sheet-ar-dark.png` | The updated design-system sheet |
| `11-phone.png`, `11b-phone-en-light-full.png`, `11c-phone-ar-dark-full.png` | Phone: hero and plate in EN/AR × light/dark, and full pages |

---

## Needs your decision

1. **The plate as A V2's hero**, replacing the photo hero and its floating cards.
2. **Section sheets** (inset rounded panels) as the section treatment.
3. **The pointer:** keep it, tone it down, or remove it.
4. **The plate's lean:** keep it, or remove it to close the remaining frame gap in item 14.
5. **The dark palette**, and whether the dark theme later carries over to the website.

Nothing new is needed from RAWASY for this pass. The open items in `docs/ASSET_INVENTORY.md` are unchanged.

## Known limitations

- **Plate timing and position:**
  - The plate plays when half of it is on screen.
  - On phones it sits below the hero text, so it plays as it is scrolled to.
  - On the design-system sheet, the live demos also wait to be in view.
- **The X / Y readout** is approximate while the plate is leaning (it uses the plate's on-screen box).
- **Width at 1280 px:** the content column is 22 px narrower than before.
- **The pointer** appears only after the mouse first moves (by design).
- **The theme cross-fade** needs View Transitions; elsewhere the theme switches instantly.
- **Performance figures** are from a headless software renderer; real GPUs will differ.

## How to run

```bash
npm install
npm run lint && npm run typecheck
npm run build && npm run test:e2e
npm start
```

Then open `/theme-lab/en/modern-commerce-a-v2`, and `…?theme=dark` for the dark theme.

## Next steps

Your visual review of A V2 pass 2. Nothing else was started. There is no migration, no Stage 1E, no Phase 2, and no work on B or C.
