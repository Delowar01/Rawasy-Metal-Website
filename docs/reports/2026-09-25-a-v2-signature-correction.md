# RAWASY Metal Website — Modern Commerce A V2: signature animation correction

**Date:** 2026-09-25 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `9cab60e` (this report is in the following commit)

**Status: the two signature animations are corrected and A V2 is returned for your visual review. I have not approved it.**

- Only the two signature animations were changed, plus what they need to fit: the order of the services grid and the design-system sheet.
- Header, hero, About, machinery, projects, industries, clients, compliance, contact and footer are untouched.
- The theme is not migrated. Stage 1E was not started. B and C were not touched.
- The live website is unchanged (proof in item 15).

## How to view

- Run `npm run build && npm start`, then open:
  - `/theme-lab/en/modern-commerce-a-v2#services` and `/theme-lab/ar/modern-commerce-a-v2#services`
  - `/theme-lab/en/modern-commerce-a-v2/system`: the two signatures now come first.
- Compare with the originals at `/en/services/laser-cutting` and `/en/services/laser-engraving`.
- Each signature plays once when half of it is on screen.
- To replay: hover its card with a mouse, or Tab to the card. On the design-system sheet, use the Replay buttons.

---

## Report items

### 1. Implementation commit SHA

`9cab60e` — "Rebuild A V2 signature animations on the service pages' drawings".

### 2. Branch SHA

The branch head is the commit that adds this report, directly on top of `9cab60e`. It is pushed to `claude/new-session-5eijs6`, and its SHA is given in the chat report.

### 3. Original components inspected

**Components:**
- `src/components/service/visuals/CutPathVisual.tsx`: `CutPathVisual` and its `NestingSheet` drawing (260 × 160).
- `src/components/service/visuals/EngravedPlateVisual.tsx`: the engraved plate drawing (400 × 280).
- The pieces around them:
  - `MediaFrame` (the cutting photo)
  - `Backdrop kind="fine"` (the fine grid)
  - `ScanLine` (8 s and 10 s loops)
  - `FrameMarks`
  - the reveal attributes (`data-reveal="fade"`, and `data-live` from `LiveObserver`)

**Their CSS in `src/app/globals.css`:**
- `.line-draw [pathLength]` and `[data-revealed]`: the 1.8 s line drawing through `--draw`.
- `.panel-raised`, `.backdrop-fine`, `.scan` with `@keyframes scan-y`.
- `.plate-brass`, `.rivets`, `.engrave .engr-cut` and `.engr-hi`.
- The tokens they use:
  - `--eng`, `--accent`, `--text-tertiary`, `--sheen`, `--scan`
  - `--brass-a/-b/-c`, `--brass-edge`, `--engr-cut`, `--engr-hi`, `--rivet`

**Rendered as well as read.** I captured `/en/services/laser-cutting`, `/en/services/laser-engraving` and `/theme-lab/en/modern-commerce-a-v2` at 250, 900, 1600, 3200 and 6000 ms.

**What A V2 had lost, laser cutting:**
- the nesting sheet with its fine grid and dashed edge
- the nested steel parts and the dimension rules
- the real part: chamfer, tab, three holes and a slot
- the lead-in, the pierce points and the cutting-head crosshair
- the line drawing and the scan

**What A V2 had lost, laser engraving:**
- the wide brushed-brass plate with its rivets
- the double border and corner marks
- the block of engraved lines and the guilloche rosette
- each groove's shadow and highlight
- the orange dashed beam and crosshair
- the Arabic mirroring

### 4. What was reused

**The drawings' exact geometry.** It now lives in two shared modules. The service pages and the A V2 signatures both draw from them.
- `nesting-sheet.ts` holds:
  - the sheet edge
  - the nested bracket, washer and small hole
  - both dimension rules
  - the lead-in and the part outline
  - the three holes and the slot
  - the four pierce points
  - the cutting-head crosshair
- `engraved-plate.ts` holds:
  - the double border and corner marks
  - the eight engraved lines with their groove widths
  - the rosette: ring, dotted ring, 24 + 18 ellipses and centre boss
  - the laser's beam and crosshair

**The drawing technique.** Paths with `pathLength="1"` are drawn with `stroke-dashoffset`, as `.line-draw` does on the service pages. The difference is that they now draw in working order.

**The materials:**
- Brass plate, taken from `.plate-brass`: the gradient at 118°, 3 px brushed hairlines, sheen, brass edge and rivets.
- Grooves: each drawn twice, the cut plus a highlight offset by 0.7, in the same colours.
- Nesting sheet: the 22 px fine grid in the steel tone, the sheen and a raised edge.
- Scan line: an orange line with a faint trailing glow.

**The colour roles:**
- Orange: the cut path, pierce points and head.
- Steel: nested parts.
- Grey: dimension rules.
- In the lab these come from A V2's own tokens (`--brand`, `--steel`, `--ink-3`), so the A V2 palette is kept.

**The composition:**
- The cutting head ends on the service page's crosshair spot (176, 92).
- The laser rests on the ring's top mark (282, 48) with its dashed beam.
- The plate mirrors in Arabic; the nesting sheet does not. Both match the service pages.

**A V2's playback rules**, from the hook `useSignature`:
- plays once when half in view
- replays on hover or focus, and on `sig:replay`
- shows the finished picture without JavaScript and with reduced motion

### 5. What was refactored

**Service visuals:**
- `src/components/service/visuals/nesting-sheet.ts` and `engraved-plate.ts` (new): the shared geometry.
- `CutPathVisual.tsx` and `EngravedPlateVisual.tsx` read their geometry from these modules. Their rendered HTML is unchanged (item 15).

**`useSignature.ts`:**
- Its root is now the illustration's HTML wrapper, not the SVG.
- `freeze` holds a named moment (`initial`, `active`, `finished`) for still frames.
- `samplePath()` moves the head along any path at a constant feed.
- `animate()` replaces `track()`. Each animation still ends with the run, but is only active between its first and last keyframe. That cut style work by about 70 % (item 12).

**Signatures:** `LaserCut.tsx`, `LaserEngrave.tsx` and `signature.css` are rewritten on the shared geometry.

**A V2 cards (`HomeA2.tsx`, `a2.css`):**
- `ServiceFeatureA2` now handles both signatures on sized stages (`a2-stage-sig`).
- `ServiceCardA2` is a photo card only.
- `.a2-svc-laser` became `.a2-svc-sig`: the card's edge takes the service's tone.

**Design-system sheet:**
- `SystemA2.tsx`: signature demos, still frames, cards and swatches.
- `SheetControls.tsx`: Replay targets the new root.
- `SystemSheet.tsx`: an optional `lead` slot. Options A, B and C render exactly as before.
- `options.ts`: notes, steps and still-frame labels in English and Arabic.

**Tests:** `e2e/theme-lab-a-v2.spec.ts` now has 21 tests (was 16). `CLAUDE.md` and `README.md` are updated.

### 6. What was removed from the previous A V2 animation

**Laser cutting:**
- the eight-point star
- the steel plate with four fixing holes
- the star kerf and the eight sparks
- the part lifting out of the plate (it moved, rotated and grew)
- the dark through-hole and the heat-tinted rim

**Laser engraving:**
- the medallion: double ring with ticks, two squares forming a star, the RAWASY mark
- the eight-pass raster reveal
- the zig-zag crosshair

**Code:**
- `signature/geometry.ts` (the star and polygon helpers) and `track()`
- their CSS, and the "Steel plate" and "Kerf" swatches
- the tests that expected a lifted part or a raster reveal

**Result:** one Laser Cutting signature and one Laser Engraving signature. The homepage carries exactly one of each, and none of the retired parts (tested).

### 7. Corrected Laser Cutting behaviour

The first run takes 7.6 s. A replay takes 7.1 s because the sheet is already on screen.

| Time | What happens |
| --- | --- |
| 0–0.56 s | The light steel nesting sheet rises into place. |
| 0.20–1.08 s | One scan pass crosses the sheet. |
| 0.34–1.18 s | The nested steel parts draw in. The dimension rules follow. |
| 0.70–1.00 s | The programmed cut and the pierce points show faintly, as on a nesting program. |
| 0.76–1.04 s | The cutting head activates at its park position. |
| 1.1–4.3 s | The interior cuts: hole 1, hole 2, the slot, then hole 3. |
| 4.3–6.6 s | The outer contour: pierce just off the part, lead-in, then the outline (chamfer and tab) back to its start. |
| 6.6–7.0 s | The head returns to the service page's crosshair spot. |
| 6.6–7.6 s | The heat settles and the fresh cut cools to the sheet's orange. The finished cut stays. |

**How each interior cut runs:**
1. The head travels with the beam off.
2. It pierces: a small flash, and the pierce point lights up.
3. It cuts a short lead-in to the edge, then the contour.
4. When the contour closes, the lead-in inside it drops out with the slug.

**Speed:**
- 0.18 units/ms for the holes and 0.20 for the slot. This is slower than the outline, as machines slow down for small holes.
- 0.26 units/ms for the outline.
- On a 1440 px screen the outline runs at about 500 px/s.

**Realism:**
- A small hot point: an orange halo with a light core, lit only while the beam is on.
- A glow that trails about 32 units behind the head, with a 6-unit bright tip.
- A faint heat tint left along the cut.
- No sparks, and nothing lifts out.

**Order.** Your list says "approximately". I cut the interior contours first, because that is the normal practice: the part cannot shift before its holes are cut. If you prefer the outline first, it is a one-line change.

**Playback:** once when half in view, never looped. It replays on mouse hover or keyboard focus of its card (not while it is running) and from Replay on the sheet.

### 8. Corrected Laser Engraving behaviour

The first run takes 6.8 s. A replay takes 6.3 s.

| Time | What happens |
| --- | --- |
| 0–0.46 s | The brass plate rises into place. |
| 0.12–1.10 s | A surface reflection glides across and settles into the plate's sheen. |
| 0.65–0.90 s | The laser crosshair activates on its rest mark, with the dashed beam. |
| 0.92–1.23 s | The laser moves to the border's top-left corner. |
| 1.2–2.2 s | The double border is engraved as the head runs round it. Each corner mark appears as the head passes. |
| 2.3–3.7 s | The engraved line block, line by line. The beam switches off between lines. |
| 3.8–5.0 s | The rosette: outer ellipses, inner ellipses, then the centre boss. The head works round the rosette as the pattern develops. |
| 5.0–5.7 s | The ring, from the rest mark all the way round to it. The dotted ring appears. |
| 5.8 s | The laser switches off: the solid beam and hot point go out, and the dashed beam of the resting laser returns. |
| 5.9–6.8 s | Light crosses the finished grooves. The final plate remains. |

- Every groove is drawn twice at once, shadow and highlight, so it reads as cut into the metal.
- The laser location is always visible: a crosshair with a hot point and a short solid beam while it engraves.
- There is no text, image, brand, part number or serial number.
- The flagged `services/engraving-nameplates` photo stays off every page (tested).
- In Arabic the plate mirrors, as on its service page.

### 9. Desktop result

**The services grid:**
- It now leads with the two signatures: Laser Cutting (7 of 12 columns) and Laser Engraving (5 of 12).
- The four other services follow as photo cards.
- Steel Structures moved from the featured row to the photo row, to give engraving a proper card. This is the one layout change; see "Needs your confirmation".

**Stage sizes:**
- 22 rem tall from 1024 px, 26 rem from 1280 px.
- The illustration always fills the stage, sized with container units.

| Width | Cutting sheet in its stage | Engraving plate in its stage |
| --- | --- | --- |
| 1440 | 544 × 336 px in 713 × 416 (76 % wide, 81 % tall) | 455 × 319 px in 503 × 416 (90 % wide) |
| 1024 | 440 × 272 px (82 % wide) | 332 × 233 px (87 % wide) |

**At 1440 px:**
- The cut line is 3.6 px wide on screen.
- The head's crosshair is about 21 px across, and its hot point glows about 33 px across.

**The rest of the card is A V2's own:** radius, border, shadow, lift, badge, icon chip, tags and link. The hover edge is orange for cutting and brass for engraving.

**Design-system sheet.** The two signatures now lead it. Each has:
- a live demo with a Replay button
- the steps and the timings
- three still frames: initial, active and finished

### 10. Mobile result

**Sizes at 390 px:**

| Signature | Illustration | Stage | Share of width |
| --- | --- | --- | --- |
| Cutting | 322 × 199 px | 356 × 267 px | 90 % |
| Engraving | 324 × 227 px | 356 × 297 px | 91 % |

**Readability on small screens:**
- The cut line gets heavier on small screens: 2.6 px on screen.
- The head and hot point are drawn 35 % larger.
- The engraved grooves are thicker.

**Playback (tested):**
- Each signature plays once as it enters the viewport.
- A touch never replays it, and scrolling away and back does not either.

**Overflow (tested):** no sideways scroll from 360 to 1440 px on the sheet, or from 360 to 1280 px on the homepage.

### 11. Reduced-motion result

**With reduced motion:**
- Both finished pictures show at once, and no animation runs (tested in EN and AR).
- Cutting shows:
  - the full part with its lead-in and pierce points
  - the head on its park spot
  - the nested parts, the dimension rules and a faint heat tint
- Engraving shows the fully engraved plate, with the dashed beam and crosshair on the rest mark.
- The sheet's Replay buttons are hidden.
- The still frames still show their three moments, because they are still images.

**Without JavaScript:**
- The same finished pictures show (tested).
- The still frames are hidden, because they need script to hold their moment.

### 12. Performance impact

Measured on the production build in headless Chromium. Each figure is the average of 3 runs over a 9.5 s window with the services section in view.

| | Previous A V2 (`16d0793`) | Corrected A V2 |
| --- | --- | --- |
| Animated time | 2.2 s | 7.3 s (longer on purpose: "not too fast") |
| Frames while animating, 1440 px | 60 fps, p95 16.8 ms, 0 % over 25 ms | 60 fps, p95 16.8 ms, 0.2 % over 25 ms |
| Frames while animating, 390 px | 60 fps, 0 % over 25 ms | 60 fps, 0.1 % over 25 ms |
| Long tasks | 0 | 0 |
| Main-thread time, 1440 px | 240 ms (script 39, style 23) | 705 ms (script 80, style 101), about 1.6 ms a frame |
| Main-thread time, 390 px | 237 ms | 529 ms |
| Page weight, 1440 px | 717 KB (script 153 KB, images 137 KB) | 693 KB (script 151 KB, images 114 KB) |
| Page weight, 390 px | 616 KB | 614 KB |
| Page elements | 1486 | 1582 |

- Only SVG, CSS and the Web Animations API are used, animating transform, opacity and stroke-dashoffset. The cut's cooling colour also animates `stroke`.
- There is no canvas, WebGL, GSAP or Three.js.
- Each signature runs once per view and then rests. Nothing loops.
- Before the per-animation windows, the corrected version cost 1.02 s of main thread at 1440 px (style 355 ms). The windows cut style work by about 70 %.
- Stylesheets: `signature.css` grew from 0.7 KB to 4.4 KB, in the lab only. The site CSS is byte-identical.

### 13. Lint

`npm run lint` — clean, no errors or warnings.

### 14. Typecheck

`npm run typecheck` — clean.

### 15. Build

`npm run build` passes. I built the approved commit `16d0793` in a separate worktree and compared every prerendered file, after normalising the build id, asset hashes and the router's theme-lab entry.

**HTML pages: 112 of 120 are byte-identical.**
- The 4 A V2 pages (homepage and sheet, EN and AR) changed, as intended.
- The 4 service pages changed only inside the embedded React payload:
  - `/en` and `/ar` versions of `/services/laser-cutting` and `/services/laser-engraving`
  - their visible markup is byte-identical to the approved build
  - the payload now carries the same attribute values from the shared constants, as numbers instead of text
  - the mapped lists (circles, dimension rules, ellipses) carry different React keys
  - what visitors see is unchanged
- Every other site page is identical.
- Options A, B and C are identical.

**Stylesheets:**
- The site CSS is byte-identical.
- Three lab-only stylesheets changed: the lab utilities, `a2.css` and `signature.css`.

### 16. Tests

**`npm run test:e2e`: 181 passed, 0 failed** (run twice: before and after the performance change). `theme-lab-a-v2.spec.ts` now has 21 tests. The signature tests check:

**Artwork:**
- Every line of the service page's nesting sheet is in the cutting signature.
- The engraving has every engraved line and corner mark of the service plate, and the same number of ellipses.
- There is one signature of each, and none of the retired parts (EN and AR).

**Laser cutting:**
- Nothing runs before it is visible. It plays once in view, one pass of 6–8.5 s, then finishes.
- It replays on hover, and the card's edge turns orange.
- The head follows the correct path. Sampled every 20 ms with the beam on, it stays within 0.8 units of the part's geometry. It cuts hole 1, hole 2, the slot and hole 3, then the outer contour, and ends on the service page's crosshair spot.

**Laser engraving:**
- It plays once in view and replays on keyboard focus.
- The grooves visibly develop: none at first, never fewer as time goes on, at least 7 distinct stages, all at the end.
- The laser moves across more than 250 × 150 units of the plate.

**Both signatures:**
- The finished state persists, in EN and AR.
- The plate mirrors in Arabic; the sheet does not.
- Each fills more than half its stage at 1440 and 390 px, and the cut line is at least 2 px on screen.
- No image, text or third-party element is inside the engraving. The flagged nameplates photo is on no page.

**Phone:** plays once as it enters the viewport, and touch or scrolling back never replays it.

**Design-system sheet:**
- The signatures come first.
- Replay works.
- The still frames show nothing drawn, then part of it, then all of it.

**Reduced motion (EN and AR) and no-JS:** the finished pictures show at once, and nothing animates.

**Accessibility:** axe (WCAG 2.2 AA and best practice) found no violations in 16 audits. That covers the homepage and the sheet in EN and AR, at 1440 and 390 px, with reduced and full motion.

### 17. Side-by-side screenshots

Sent in the chat (not committed):

**`proof-laser-cutting.png`:**
- A (the service page hero: photo and nesting sheet) beside B (the A V2 Laser Cutting card).
- Both drawings at the same detail.
- Ten frames of the corrected sequence.
- The retired star cut.

**`proof-laser-engraving.png`:**
- A (the service page's brass plate) beside B (the A V2 Laser Engraving card).
- Both plates at the same detail.
- Ten frames of the corrected sequence.
- The retired medallion.

**`proof-phone-arabic.png`:**
- A and B at 390 px, for cutting and engraving, in English and Arabic.
- The Arabic services grid at 1440 px.

---

## Needs your confirmation

1. **Cutting order.** The holes and slot are cut first, then the outer contour, as is usual in laser cutting. Your list put the lead-in and outline earlier, but said "approximately". Say if you prefer the outline first.
2. **Services grid.** Laser Engraving moved into the featured row beside Laser Cutting. Steel Structures moved to the photo row. The alternative was keeping engraving in a small card, which the brief ruled out.
3. **Timing.** 7.6 s for cutting and 6.8 s for engraving: slower than before, as asked. Tell me if either should be shorter or longer.
4. **Heat tint.** A very faint heat tint stays along the finished cut. The service page's drawing has none. It can settle to nothing if you prefer.
5. **Sparks.** None were added. A few small, controlled sparks at the cutting point are possible if you want them.
6. **Stages.** The cutting stage keeps A V2's dark navy behind the light steel sheet, echoing the original's sheet over the dark cutting photo. The engraving stage keeps A V2's warm cream.

## Known limitations

- The service pages' React payload changed encoding (item 15). Their visible HTML is identical to the approved build.
- The sheet's still frames need JavaScript, so they are hidden without it.
- Performance figures come from headless Chromium on a fast machine. Real phones will spend more main-thread time, though the work per frame stays small.
- The timing lines on the design-system sheet are written out by hand. Update them if the timings change.
- The lab is light theme only. The dark theme follows only after a theme is approved.

## Next steps

- A V2, with the corrected signatures, awaits your visual review. I have not approved it.
- Nothing is migrated to the site, and Stage 1E and later stages are not started, until you say so.
- The signatures are reusable. Once the theme is approved, they can serve the service pages and the Capabilities page.
