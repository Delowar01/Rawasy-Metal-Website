# RAWASY Metal Website — Modern Commerce A V2: hero cutting animation loop

**Date:** 2026-09-28 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `1301f7a` (this report is in the following commit)

**Status: the hero loop is built and returned for your review. I have not approved it.**

- The whole hero cutting sequence now repeats every 10 s, start to start. Each cycle runs: the blank plate, the dimensions, the four bolt holes, the star, the slot, the perforation rows, the laser head and the readout counting 01–07. The finished plate then holds, a short reset follows, and the next cycle starts.
- The hero itself is unchanged: the same markup, geometry, plate, stage, readout, colours and type. The pointer's X / Y readout, the plate's lean, its reflection and the crosshair pointer work as before, including while the loop runs.
- Only the animation logic changed: the shared signature hook, and the plate's timeline and readout. The design-system sheet's description of the plate was updated to match.
- A V2 is not migrated and no next phase was started. A, B and C are unchanged, and so is the live website (item 15).

## In short

| | Before | Now |
| --- | --- | --- |
| The cut | Once (about 5.3 s), when the plate is half in view | **Every 10 s, start to start**, while the plate is on screen |
| After the cut | The finished plate stays; its hot points breathe | The finished plate holds for 4.1 s, a 0.45 s reset follows, then the next cycle |
| Readout | Counted 01–07 once | **Resets to 00/07 every cycle** and counts again; the light is orange while cutting |
| Off screen or in a hidden tab | The one-time cut ran on to its end | **The loop pauses where it is** and carries on from the same frame on return |
| Reduced motion, no JavaScript | The finished plate | The finished plate, **no loop** (unchanged) |
| Measured period | — | **10 000 ms, ±1 ms, cycle after cycle** (no drift) |

## How to view

- Run `npm run build && npm start`. Then open `/theme-lab/en/modern-commerce-a-v2` or `/theme-lab/ar/modern-commerce-a-v2`. Add `?theme=dark` for the dark theme.
- Stay on the hero for 20–30 s. The plate cuts, holds the finished part, resets and cuts again, every 10 s.
- Scroll away and come back: the loop rests off screen and carries on from where it was.
- The design-system sheet repeats the loop in its first block: `/theme-lab/en/modern-commerce-a-v2/system`. Its Replay button restarts the loop from the plate rising, and a timing line lists every phase.

---

## Report items

### 1. Implementation commit

`1301f7a` (full: `1301f7a363ba5ea06dedfabf8e8a275f03c39c1f`), "Loop A V2's hero cutting animation every 10 s".

It changes seven files:

- `signature/useSignature.ts`;
- `a2/HeroPlate.tsx`;
- `a2/SystemA2.tsx` and `options.ts`;
- `e2e/theme-lab-a-v2.spec.ts`;
- `CLAUDE.md` and `README.md`.

The first four hold the loop and the sheet's copy, the spec holds the tests, and the last two the notes.

### 2. Branch SHA

The branch head is the commit that adds this report, directly on top of `1301f7a`. It is pushed to `claude/new-session-5eijs6`. Its SHA is given in the chat report.

### 3. Exactly what was changed

**`src/components/theme-lab/signature/useSignature.ts`** (the shared signature hook):

- A run can now declare `loop` (its period in ms) and `onChange` (a callback for its readout).
- A looping run keeps its animations and restarts them together at the end of each cycle (item 5).
- It runs only while the plate is on screen and the page is visible, and rests otherwise (item 7).
- It counts cycles in `data-cycle` on the plate.
- `animate()` gains an optional `fill` argument, for the reset animations.
- **The two service-page signatures behave exactly as before:** they play once at 50 % in view and replay on hover or focus. I checked on both builds that neither starts at 10 % visible and both start at 50 %.

**`src/components/theme-lab/a2/HeroPlate.tsx`** (the hero plate):

- Every animation of the cut now spans exactly one 10 s cycle.
- New reset animations close the openings and fade the measurements at the end of each cycle.
- The plate's rise is intro-only, so it runs in the first cycle only.
- The readout resets to 00/07 every cycle and wakes only when its value changes (item 6).
- After the pointer leaves, the readout shows the live count. Before, it restored a fixed "07/07".
- **The markup is unchanged.** The server HTML of the A V2 homepage is identical to the previous build (item 15).

**`src/components/theme-lab/a2/SystemA2.tsx` and `src/components/theme-lab/options.ts`** (design-system sheet):

- The hero-plate note, steps, motion table and timing line now describe the 10 s loop instead of "plays once, never loops", in English and Arabic.
- One step was added: "Held, then reset: again every 10 s".
- The phone-preview note mentions the loop.

**`e2e/theme-lab-a-v2.spec.ts`:**

- The hero-plate tests were rewritten for the loop, and new tests were added (item 14).

**`CLAUDE.md` and `README.md`:**

- Project memory and documentation for the loop, and three new gotchas.

**Not changed:**

- CSS (`a2.css` is untouched; every stylesheet in the build is byte-identical).
- The background motion, typography, colours, header, sections, clients, footer and custom cursor.
- The theme structure, and A, B and C.
- The website.

### 4. Loop timing breakdown

One cycle is 10.00 s, start to start. The times below are measured from the running animations (cycle 2 onwards).

| Time in the cycle | What happens | Readout |
| --- | --- | --- |
| 0–0.2 s | The blank plate, ready. The laser is parked and not visible. | 00/07 · light orange |
| 0–0.76 s | The plate rises onto its stage (**first cycle only**). | |
| 0.20–1.19 s | Six dimension lines draw in, then their labels fade in. | |
| 1.15 / 1.27 / 1.39 / 1.51 s | The four bolt holes are pierced. Each opens 0.16–0.36 s after its pierce, and the flashes fade by 2.03 s. | 01 → 04/07 |
| 1.75–1.98 s | The head moves to the star and pierces it. | 05/07 at 1.98 s |
| 1.98–2.98 s | The star is traced at a steady feed. Its slug drops out by 3.46 s. | |
| 3.28–3.75 s | The slot is traced. Its slug is gone by 3.97 s. | 06/07 at 3.28 s |
| 3.90–4.38 s | The perforation field is cut, four rows in a raster; each row opens behind the head. | 07/07 at 3.90 s |
| 4.52–5.26 s | The nodes light at the measurement anchors, then the hot points. | light teal at 5.26 s |
| **5.26–9.40 s** | **The finished plate holds (4.14 s).** Every opening is cut, the dimensions are drawn, the nodes are lit and the laser is off. | 07/07 |
| 9.40–9.85 s | The reset: the nodes go out, the measurements fade and the openings close. | 00/07 at 9.40 s |
| 9.85–10.0 s | The blank plate. | 00/07 |
| 10.0 s | The next cycle starts. | light orange |

The split is about 5 s of cutting (0–5.26 s) and about 5 s for the finished result. The last opening is cut at 4.38 s, and the reset starts 5.0 s later. The finished plate is fully still for 4.14 s.

### 5. How the replay was implemented

The loop reuses the same animations; nothing is destroyed or recreated.

- **One clock per cycle.** Each part of the plate has a Web Animation whose delay, active time and end delay add up to exactly 10 000 ms. The whole cycle is therefore a single timeline that can be paused, stepped or restarted as one. During the hold, no animation is in its active phase, so nothing is sampled.
- **The reset is part of the timeline.** From 9.4 s, reset animations take over the parts they change. They use `fill: "forwards"`, so they have no effect before they begin. They end on exactly the values the cut starts from, so the last frame of one cycle is the first frame of the next.
- **Restart.** When the cycle's clock finishes, the hook restarts every animation of the run with one start time: the previous start plus 10 000 ms. They therefore stay in step with each other, and the period cannot drift.
  - If the end of a cycle is handled more than 250 ms late (a stalled tab), the next cycle starts at once rather than jumping ahead.
  - No DOM, class or animation is recreated, so nothing can flicker.
  - Measured over five cycles: consecutive starts exactly 10 000 ms apart (±1 ms).
- **`persist()`.** The browser removes a finished animation that a later finished animation fully overrides (the cut, overridden by its reset). In my first build this made the second cycle's openings never open. The loop now marks its animations as persistent.
- **Intro only once.** The plate's rise onto its stage is a separate 760 ms animation, played in the first cycle only.
- **Hover does not restart the loop.** Hovering the plate only reads X / Y and leans the plate (tested).
- **Replay on the sheet.** The sheet's Replay button restarts from cycle 1, with the rise.

### 6. How the readout reset was handled

- **Counting.** The readout counts the seven steps (four holes, the star, the slot, the perforation field) against the cycle's clock. At 9.4 s it returns to **00/07**, as the reset begins, and the next cycle counts 01–07 again.
- **The light.** It is orange while the laser cuts (0–5.26 s) and teal for the hold and the reset.
- **No per-frame polling.** The readout no longer reads the clock every frame. It sleeps until its next change (the next step, the end of the cut, or the reset) and updates on the next frame: about nine wake-ups per cycle.
- **Under the pointer.** While the mouse reads X / Y, the count keeps updating underneath. On leaving, the readout shows the count where the cycle is, for example 00/07 early in a new cycle. It used to put back a fixed 07/07.
- **Resting and resuming.** The readout is refreshed once the pause or the restart has taken effect, on the next frame. A test found that refreshing it straight away could leave it one step behind (03/07 where the plate had reached 04/07). That is fixed and tested.
- **Under heavy load.** If the main thread stalls for more than 120 ms (the spacing of the bolt holes), the readout can skip a digit, for example 02 → 04. It always shows the count for the frame it draws, never a stale one.

### 7. Off-screen behaviour

- **First cycle.** It starts when half the plate is in view, as before. On a phone, the plate is below the first screen, so it starts once you scroll to it.
- **Pausing.** Afterwards, the loop runs while any part of the plate is on screen. Once the plate is completely off screen, every animation pauses where it is: the time, the openings, the head and the count all hold, and the light turns teal. A hidden tab pauses it the same way.
- **Resuming.** When the plate comes back into view, or the tab becomes visible, the loop carries on from the same frame and the same cycle, with the same period. It does not jump, restart halfway or show a stale readout. If a cycle ends while the loop rests, the next cycle waits at its first frame.
- **Tested.** Scrolled to Contact, the loop's time stood still for 1.5 s and the readout matched the resting frame. Back on the hero, it resumed within a second of the frame it rested at. A hidden tab paused it too.
- **Hot points.** Their breathing already paused off screen, and it still does (unchanged).

### 8. Reduced-motion behaviour

- **Reduced motion.** With `prefers-reduced-motion: reduce`, the hook stops before creating any animation: there is no loop, no cycle and no animation. The markup's finished plate shows at once: every opening cut, the dimensions drawn, the nodes lit and the readout at 07/07. It stays that way (tested in English and Arabic: still no animation after 1.2 s).
- **Other motion.** The hot points do not breathe, and nothing else on the page runs, as before.
- **Without JavaScript.** The finished plate shows, unchanged.

### 9. Performance impact

All figures come from this container: headless Chromium with software compositing and no GPU, the worst case. "Before" is the build of the previous commit (`749a2a2`). Both builds ran one after another, never in parallel. So that both scroll over the same animation, the old build was made to cut again with its own replay event.

**Desktop and phone scrolling (frames per second, median of 5 runs, range in brackets)**

| Scenario | Before (one-time cut) | Now (loop) |
| --- | --- | --- |
| 1440 px: scrolling within the hero while the plate cuts (0 → 480 px → 0 in 4 s) | 60.3 (59.8–60.3) | **60.3** (59.8–60.3) |
| 1440 px: whole page, top to bottom in 5 s, starting 1 s into a cut | 56.4 (55.4–57.2) | **57.0** (56.6–57.2) |
| 1440 px: whole page during the finished plate's hold (the previous pass's benchmark) | 56.8 (55.6–57.6) | **57.0** (56.0–57.2) |
| 390 px phone: within the hero while the plate cuts | 60.3 (54.0–60.3) | **60.3** (60.3–60.3) |
| 390 px phone: whole page from mid-cut | 60.2 (58.8–60.2) | **60.2** (60.2–60.2) |

The two builds scroll the same, within run-to-run noise. Scrolling away from the hero, the loop pauses once the plate leaves the screen (its clock stopped at 1.55 s). The old build's cut ran on off screen to its end.

**Hero responsiveness** (1440 px: the mouse circles over the plate for 3 s while it cuts; median of 5)

| | Before | Now |
| --- | --- | --- |
| Frame rate | 58.7 fps | **60.0 fps** |
| 95th-percentile frame time | 16.8 ms | **16.8 ms** |
| Lean and X / Y updated | on every mouse move (176 of 176) | **on every mouse move** (179 of 179) |

**Idle CPU: one 10 s window with the page still** (renderer CPU time · main-thread task time, median of 3)

| Where | Before, at rest | Before, during its one cut | Now, one loop cycle |
| --- | --- | --- | --- |
| 1440 px, hero on screen | 0.44 s · 0.07 s | 0.94 s · 0.41 s | **0.96 s · 0.42 s** |
| 390 px phone, plate on screen | 0.41 s · 0.07 s | 0.95 s · 0.44 s | **1.02 s · 0.49 s** |
| 1440 px, hero off screen | 0.15 s · 0.004 s | — | **0.13 s · 0.004 s** |

**Where the time goes in one cycle** (trace, 1440 px; main-thread style + layout + paint, and raster, per second of each phase)

| Phase | Main thread | Raster | Frames drawn |
| --- | --- | --- | --- |
| Cutting (0.2–5.3 s) | 41 ms/s (0.7 ms per frame) | 7 ms/s | 59/s |
| Hold (5.3–9.4 s) | 3.5 ms/s, the same as the page at rest | 0 | 10/s (the background's steps) |
| Reset (9.4–10 s) | 38 ms/s, for 0.45 s | 1 ms/s | 53/s |

The phone's figures are the same within 3 ms/s (cutting 38 ms/s, hold 2.8 ms/s, reset 40 ms/s).

**What this means**

- **Each cycle costs what the old one-time cut cost.** It is 2 % more at 1440 px and 7 % more on the phone; the difference is the 0.45 s reset. The readout is cheaper than before: about nine wake-ups a cycle instead of a check on every frame of the cut.
- **While the hero is on screen, the page now does that work every 10 s.** At 1440 px, the renderer's idle CPU goes from 4.4 % to 9.6 % of one core, and main-thread work from 0.7 % to 4.2 %. That is the loop itself: the cut is 5.3 s of SVG animation in every 10 s. At 0.7 ms per frame it leaves the frame budget almost untouched, as the scrolling and pointer figures show. On a normal machine with GPU raster, the absolute cost is lower.
- **Off screen and in hidden tabs, it costs nothing**, the same as the old build at rest.
- **No per-frame work during the hold.** Every animation is in its delay or end delay; the only frames are the background's.

### 10. Screenshots and frame sequence

The frames are taken from the running page, in real time, without pausing it. Each capture took 0.15–0.4 s, and each label gives the plate's clock at capture, the cycle and the readout. The images are sent with this report in the chat.

1. **`01-cycle-en-light.png`: one whole cycle** (English, light, 1440 px), ten frames:
   - blank and ready (00/07, light orange);
   - the dimensions drawing;
   - the four holes (04/07);
   - the star (05/07);
   - the slot (06/07);
   - the perforation (07/07);
   - the nodes lighting;
   - the finished plate held (light teal);
   - the reset closing the openings (00/07);
   - cycle 3, blank again.
2. **`02-cycle-ar-dark.png`: Arabic, dark.** Holes, star, perforation, held and reset, with the same timing. The plate is not mirrored.
3. **`03-cycle-phone.png`: phone (390 × 844).** English dark and Arabic light, at the same five moments. The readout keeps its size and its Arabic words.
4. **`04-no-drift.png`: the same moment (7.0 s) in cycles 3, 4 and 5.** The same plate and the same readout. Only 0.06 % of pixels differ: the breathing hot points, and the moving background at the stage's rounded corners.
5. **`05-pointer-reduced.png`: the pointer and reduced motion.** During a cut, the pointer reads X / Y (the crosshair on the plate, which leans) while the star is being traced. With reduced motion, the finished plate shows with no cycle and no animations, and is still the same 10 s later.
6. **`06-hero-in-page.png`: the hero in its page** (English, light, 1440 × 900), holding the finished plate.
7. **`07-sheet-plate.png`: the design-system sheet's hero-plate block**, with the new description, the eighth step and the timing line. The Arabic version was checked as well.

### 11. Lint

`npm run lint` passed, with no warnings.

### 12. Typecheck

`npm run typecheck` passed.

### 13. Build

`npm run build` passed: 125 static pages, as before.

### 14. Tests

`npm run test:e2e` on the final build: **205 passed** in 5.7 min (the previous pass had 202). The loop-related tests then passed **42 of 42** over three repetitions, with three browsers in parallel.

**New or rewritten (A V2 · hero plate, and A V2 · hero plate on a phone):**

1. **The full sequence replays automatically.** Four cycles recorded live in the page: each starts from the blank plate (nothing cut, no measurements, no nodes, laser off). Each cuts all 10 openings, draws the 6 dimensions and lights all 8 nodes and hot points.
2. **About 10 s start to start.** On the animations' own clock, cycle starts are exactly one period apart (tolerance 10 000–10 300 ms).
3. **The readout resets every loop.** In each cycle it rises from 01 to 07 and returns to 00 before the next cycle. 07/07 comes at 3.9 s, 00/07 at 9.4 s.
4. **The finished state holds before the restart.** The light turns off at 5.26 s with every opening cut. The reset follows at least 3.6 s later (measured 4.1 s).
5. **Reduced motion does not loop.** No cycle and no animation, in English and Arabic; the finished plate stays.
6. **Off screen it rests.** Every loop animation pauses and the time holds. The readout matches the resting frame. On return it carries on from the same frame. A hidden tab pauses and resumes it too.
7. **Hover and pointer still work.** X / Y reads over the plate and the plate leans. The reading holds through a reset into the next cycle while the light keeps working. On leaving, the live count returns (00/07 early in a cycle), then keeps counting. Hovering never restarts the cycle. The crosshair pointer test passes.
8. **English and Arabic.** The same loop is recorded in Arabic. The plate is not mirrored, and its Arabic words keep the Arabic face with no letter-spacing.
9. **Phone (390 × 844, touch).** The first cycle waits until the plate is in view, then the same 10 s loop runs. A tap never reads X / Y. The readout keeps its size and never overflows.
10. **No overflow or layout shift.** Layout shift after the loop starts is 0.000 (desktop English and Arabic, phone). There is no sideways scroll.

**Also:**

- Each cycle cuts in order: holes, then the star, then the slot and rows, stepped on one clock.
- Every loop animation spans exactly 10 000 ms, and the reset ends on the blank plate.
- The design-system sheet's Replay restarts the loop from cycle 1 at 00/07.
- The idle test checks that the plate's loop rests off screen.

**Adjusted:**

- One existing check ("marking the page as scrolling restyles only the two moving layers") now reads styles once before its first trace marker. Chromium moves the animation clock on with each new task, so the first style read inside the markers was also re-sampling every running animation: the hero's entrance, the plate and the ambient, 34–38 elements. After the change, both this build and the previous one measure 2 elements per change.
- The per-frame style work of the loop itself was measured separately and equals the old one-time cut's (item 9).

**Two failures from my own new tests, both fixed in the tests:**

- An exact 01–07 sequence failed once under full parallel load (a late frame skipped 03).
- The pointer test clicked the hero's button, which jumps to Contact, where the loop correctly rests. The test now scrolls back first.

### 15. Proof that the main website is unchanged

Every prerendered file (120 pages, with their RSC payloads) was compared with the build of the previous commit (`749a2a2`), after normalising the build id and asset hashes:

- **The website's 104 pages:** HTML and RSC identical. `en/projects.html` differs only in where Next places its `<meta name="next-size-adjust">` inside `<head>`, the known build-to-build noise noted in CLAUDE.md; without that tag it is identical. (Earlier reports counted A, B and C's 12 lab pages in a figure of "116 website pages"; the exact count is 104.)
- **Stylesheets:** all nine files byte-identical, website and lab.
- **A, B and C (12 lab pages):** identical.
- **A V2 homepage (EN and AR):** HTML and RSC identical. The hero's markup did not change; only its script did.
- **What changed:** only the two A V2 design-system sheets (EN and AR), which carry the updated copy.
- **One extra file set:** `en/services/not-a-service` sits in this build's folder but is not build output. It is the 404 that the running server cached while the e2e suite checked it.

---

## Needs your confirmation

- **Your visual judgement of the loop.** The rhythm is 5.3 s of cutting, a 4.1 s hold and a 0.45 s reset. It is set by two constants in `HeroPlate.tsx`: `LOOP` (10 000) and `RESET` (9 400).
- **The reset style.** The measurements fade and the openings close with a soft fade, then the blank plate starts again. It is calm and quick. If you prefer another transition (for example, a hard cut to the blank plate), tell me.
- **The design-system sheet's demo plate loops too**, as in the hero. Its three still frames are unchanged.
- The open questions in `docs/ASSET_INVENTORY.md` are unchanged.

## Known limitations

- **Software compositing only.** Every figure comes from this container, without a GPU. Please judge the motion in a normal browser.
- **Cost while the hero is on screen.** The loop repeats the cut's cost every 10 s, as a loop must: at 1440 px the renderer's idle CPU with the hero on screen goes from 4.4 % to 9.6 % of one core (item 9). Off screen and in hidden tabs, it costs nothing.
- **Resuming mid-cut.** Returning to the hero can land mid-cut, because the loop carries on from where it rested. It does not restart the cycle.
- **Readout under heavy load.** A main-thread stall longer than 120 ms can skip one hole's digit (item 6).

## Next steps

- Your review of the hero loop. I will adjust only what you ask.
- No other work was started: A V2 is not approved or migrated, and there is no Stage 1E, B, C or Phase 2 work.
