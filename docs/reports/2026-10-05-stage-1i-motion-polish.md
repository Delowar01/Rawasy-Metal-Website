# Stage 1I — Motion & interaction polish (Modern Commerce)

Date: 2026-10-05 (completed after midnight UTC; work began 2026-10-04) · Branch:
`claude/new-session-5eijs6` · Status: **built, returned for independent review** (not signed off by the builder;
nothing published or deployed; Stage 1J not begun).

## Summary

Stage 1I makes the Modern Commerce site behave as one motion system, without a redesign: no copy, facts,
media, layout, grid, card, hero, gallery, navigation or page-status change, and no new animation concept. It began
with a read-only inventory of every production motion system (25 of them, item 6), which found twelve genuine
inconsistencies and one race; QA then found a second race and one frame-rate shortfall (item 7). Each got the
smallest fix that solves it (item 8):

- **Reduced motion is a hard gate, now also live:** turning it on while a page is open stops the hero loop on the
  finished plate, finishes any signature, gives the system cursor back; four places that still moved with reduced
  motion (the Industries line, the client logos' fade, the About photo's settle, arrows and lifted links) are still.
- **Nothing runs unseen:** one-time signature runs rest off screen and while the page is hidden; the ambient, the hero's
  hot points and the machinery console rest while the page is hidden; the Capabilities fleet plate's scan waits until
  the plate is on screen.
- **Keyboard focus shows what hover shows** on every control that lifts, fills or moves an arrow; the focus ring is
  drawn in every frame of those transitions.
- **Consistency:** every hover lift on `--dur-2` (320 ms), the card photo zoom on `--dur-4`, the Industries line scaled
  instead of resized, phone rails revealing their cards together.
- **Frame rate:** the Projects filter's view transition no longer captures the whole page — 56 fps instead of 36 in
  the software-compositing benchmark; every measured scenario now meets the 55 fps floor.
- **Two races fixed:** the pointer's first move, and a hero readout frame that could write "00/07" after reduced motion
  stopped the loop (found by the preliminary full run, reproduced under CPU throttling, fixed and re-verified).

The resting states did not change: the homepage and 13 inner pages at reduced motion are **byte-identical in pixels**
to Stage 1F (142 capture pairs), 798 of 806 prerendered files are byte-identical (the other 8 differ by one
attribute), the Theme Lab's files, styles and pixels are unchanged.

QA run: lint, typecheck, build, `npm ci`, both audits (production: 0 vulnerabilities), the full e2e suite twice on the
final build (item 49: run 1, 532 of 533 — one new test read the page too early, fixed in a test-only commit; run 2,
**533 of 533**), frame rate in seven scenarios × EN/AR × both builds, long-task attribution, CLS on 64 loads per
build, a 336-state responsive matrix, axe in 92 states, rapid-interaction stress, and 18 evidence items.

---

## 1. `preserve/pre-stage-1i` SHA

`b1f4fe1a3076247c9302b2a4e72428dc40fda8d6` — created and pushed without force (the branch did not exist before),
verified with `git ls-remote`.

## 2. Starting SHA

`b1f4fe1a3076247c9302b2a4e72428dc40fda8d6` (local = `origin/claude/new-session-5eijs6`, clean tree, Stage 1F present,
`preserve/pre-stage-1f` = `c2aed5814c73bc18596a3d11f3955c80a13ef0dd`, no drift).

## 3. Implementation SHA

`c2fb607a38a1f1a0df47d3b57dfcf5187f5a2832` — "Polish the Modern Commerce motion system (Stage 1I)" (on `b1f4fe1`):
the product changes and the tests together. No product file changed after it. One test-only commit followed the first
final run: `528f53ac7b264b2fdd459299fc8d34caf1f3153e` — "Wait for the filter's view transition to end before reading it
(test only)" (item 49).

## 4. Branch HEAD

`b1f4fe1` → `c2fb607` (implementation) → `030c4f9` (CLAUDE.md and README.md) → `528f53a` (test only) → `4212bdc`
(a CLAUDE.md note) → the commit that adds this report, which is the branch HEAD. Its hash is given in the hand-over
message, since a commit cannot contain its own hash.

## 5. Files changed

Implementation commit (14 files, +922 / −85):

| File | Change |
|---|---|
| `src/components/commerce/useMedia.ts` (new) | a live media-query hook (`useSyncExternalStore`), the calm answer before hydration |
| `src/components/commerce/signature/useSignature.ts` | live reduced motion; every run rests off screen / hidden; replay waits for the run's own state |
| `src/components/commerce/hero/HeroPlate.tsx` | live reduced motion for the readout and the lean; the readout ignores a cancelled clock |
| `src/components/commerce/Cursor.tsx` | live fine pointer / reduced motion / forced colours; the first move reads what is under the pointer |
| `src/components/commerce/Motion.tsx` | `data-page-hidden`, `data-live` cleared while hidden; phone rails reveal together |
| `src/components/commerce/system.css` | focus = hover on the listed controls; lift and zoom durations on tokens; the scaled Industries line; reduced-motion fixes; the ambient's hidden rest |
| `src/app/(commerce)/commerce.css` | reduced motion: the clip reveal's photo |
| `src/components/commerce/capabilities/FleetPlate.tsx`, `capabilities.css` | the fleet plate joins the `data-live` gate; the picks' focus state |
| `src/components/commerce/projects/projects.css` | the filter's transition captures only the cards; the chips' focus state |
| `src/components/commerce/services/services.css`, `project-detail/project-detail.css` | focus states (call link, service links) |
| `e2e/commerce-motion.spec.ts` (new) | 22 tests: reduced motion (both ways), off screen / hidden, reveals, focus = hover, the Industries line, twenty-cycle stress, the filter's capture |
| `e2e/commerce-polish.spec.ts` | the TM-3 hero test allows the fleet plate's own scan (item 49) |

Test-only commit `528f53a`: `e2e/commerce-motion.spec.ts` (+8 / −3). Documentation: `CLAUDE.md` and `README.md`
(`030c4f9`), `CLAUDE.md` (`4212bdc`), this report (the last commit).

No content, media, route, page-status, dependency, theme-lab or fallback-404 file changed.

## 6. Motion inventory

Read-only, before any change, on the Stage 1F build (`b1f4fe1`): the code of every motion system (`commerce.css`,
`system.css`, the page sheets, `Motion.tsx`, `useSignature`, `HeroPlate`, `Cursor`, `ThemeSwitch`, `MachineShowcase`,
`MachineConsole`, `Gallery`, `SectorIndex`, `DocumentRegister`, `useDialogPointer`, the contents spy) and a runtime census:
every CSS transition, CSS animation and Web Animation the browser ran (sampled each frame from an init script) on 17
pages with motion allowed and with reduced motion, plus the phone homepage; a reveal probe (what is still hidden after a
full scroll, at 320–1440 px), and a stuck-state probe.

| # | Component | Trigger | Properties | Duration | Easing | Delay / stagger | Reduced motion (before 1I) | Off screen / hidden (before 1I) | Repeats |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Generic reveal `[data-reveal]` (Motion.tsx + commerce.css) | ≥ 8 % in view (root margin −8 % at the bottom) | opacity + translateY 18 px (`fade`: opacity) | 700 ms (`--reveal-dur`; steel axes 1 s) | `--ease-out` | `--d`, 40–110 ms steps, at most 360 ms (920 ms inside the Steel Structures hero drawing, authored) | shown at once | one-shot | no (unobserved once shown) |
| 2 | Clip reveal `[data-reveal="clip"]` (homepage About photo) | as 1 | clip-path; the photo's scale 1.08 → 1 | 1.1 s; 1.6 s | ease-out | — | no clip, no scale — but the photo's 1.6 s transition still ran (D3) | one-shot | no |
| 3 | `PageHero` / `ServiceHero` (every inner page) | first paint | none (TM-3) | — | — | — | — | — | — |
| 4 | Homepage hero entrance `[data-enter]` | load | opacity + translateY 18 px (`a2-rise`) | 900 ms (`--dur-4`) | `--ease` | 0–420 ms | none | one-shot | no |
| 5 | Hero plate (HeroPlate + useSignature, Web Animations) | in view | dimensions, labels, pierces, slugs, kerfs, head, beam, nodes, rows (opacity, transform, stroke dash, clip-path) | rise 760 ms (cycle 1 only); cut 0–5.26 s, hold to 9.40 s, reset to 9.85 s, a cycle every 10 s | per keyframe | — | static finished plate — read once at load (D4) | pauses off screen and while hidden | every 10 s |
| 5b | Plate lean + reflection (mouse) | pointer move | transform (rotateX/Y), translate | 1 s | `--ease` | — | no lean — read once at load (D4) | — | — |
| 5c | Plate hot points (CSS `a2-node`) | `[data-live]` | opacity, scale | 3.6 s | ease-in-out | −0.9 s steps | none | paused off screen; hidden: only the browser's throttling (D6) | infinite |
| 6 | Service signatures `LaserCut` / `LaserEngrave` (Web Animations) | 50 % in view; replay on the host's mouse-enter / focus when idle | sheet/plate, parts, kerfs, head, reflections | run 7.6 s / 6.8 s (replays 7.1 / 6.3 s) | per keyframe | — | finished picture — read once at load (D4) | a started run kept running off screen and hidden (D5) | once + replays |
| 7 | The four other service drawings | reveal | stroke-dashoffset; the axes' scale | 1.8 s; 1 s | `--ease` | `--d` | drawn | one-shot | no |
| 8 | Site-wide ambient (two fixed layers, CSS) | always | translate / transform in whole-pixel steps, opacity | drift 32 s, breathe 28 s, sweep 26 s | `steps()` | — | still | rests while scrolling; hidden: only the browser's throttling (D6) | infinite |
| 9 | Pointer (`Cursor.tsx`) | mouse move / over | ring follow (rAF, 0.24 lerp, only while moving); ring scale, border, fill, shadow; dot scale; layer opacity | 320 / 180 / 180 ms | `--ease` / ease | — | off — but read once at load, also forced colours and fine pointer (D4) | — | — |
| 10 | Header | scroll / hover | colours, shadow; nav underline opacity + scale; chevron rotate | 320 / 600 / 320 ms | ease / `--ease` | — | colours only | — | — |
| 11 | Services dropdown (`a2-pop`) | open | opacity, translateY −6 px, scale 0.985 | 320 ms | `--ease` | — | none | — | — |
| 12 | Phone menu sheet (`a2-sheet`) + burger | open | opacity, translateY −8 px; the burger's lines translate / rotate / opacity | 320 / 180 ms | `--ease` | — | none | — | — |
| 13 | Theme switch | click | root view transition (cross-fade) | 250 ms (browser default) | linear | — | instant | — | — |
| 14 | Cross-document navigation | page change | `@view-transition { navigation: auto }`, root cross-fade | 250 ms (browser default) | linear | — | none | — | — |
| 15 | Buttons / links / cards | hover (cards also `:focus-within`) | colours 180 ms; lifts 320 ms; icon nudges 320 ms; card edge scaleX 600 ms; card photo scale 1.035 over a literal 0.9 s (D11); the primary button's shine 750 ms | | `--ease` / ease | — | the cards' lifts off, colours kept; arrows still moved (D12) | — | — |
| 16 | Homepage machine showcase | pick | panels opacity 600; image scale/translate 900; specs opacity/translate 600 (+120 ms); spot 900; picks lift 320 | | `--ease` | 120 ms | none | — | — |
| 17 | Capabilities console and fleet plate | pick / address / load | panel out 180, in 600 (+80 ms); photo translate 900 + opacity 600; floor line scale 900; data translate 600; console scan 1.5 s (+0.25 s); sketch 3.2 s (+0.35 s); fleet plate scan 2.2 s (+0.5 s, once, from the first paint); power bars scale 900 (+0.2 s) | | `--ease`, `--ease-io` | | none | console scan and sketch paused off screen (`--cm-play`); the fleet plate's scan ran off screen (a cold address deep in the page); hidden: no explicit pause (D6) | once per showing |
| 18 | Projects filter | chip | view transition of the 27 items (names only while `data-vt`) | 450 ms | (0.22, 1, 0.36, 1) | — | instant | — | — |
| 19 | Industries | pointer-enter / focus | preview cross-fade opacity 600; the active row's line **width** 0 → 100 % over 600 (D9) | | ease / `--ease` | — | preview instant; the row's line still animated (D1) | — | — |
| 20 | Clients wall (homepage + Clients) | switch / hover | knob translate 320, track colours 320; logos filter + opacity 600; tile lift 320 | | | — | lift off; the logo fade still ran 600 ms (D2) | — | — |
| 21 | Certificates | open / close / hover | dialog opacity + translate 12 px, backdrop opacity, `display`/`overlay` allow-discrete 320; the preview's lift 6 px over **600 ms** (D8: the only hover lift not at 320) | | | — | dialog and lift off | — | — |
| 22 | Contact | hover / submit | rows lift / arrow 320; fields 180; validation: none | | | — | lifts off; arrows still moved (D12) | — | — |
| 23 | Legal pages | scroll / click | contents colours 180; spy (IntersectionObserver); chevron 320; same-page glide (`scroll-behavior: smooth` after load) | | | — | instant jumps | — | — |
| 24 | Project pages (1F) | scroll | only the closing panel's reveal (700 ms); link colours 180 | | | — | none | — | — |
| 25 | Homepage rails on phones | reveal per card | as 1 | | | | | cards beyond the rail's visible part stayed transparent until swiped in, then faded and rose (D10) | |

Hover and keyboard focus (D7): hover-only emphasis on the buttons (fill, lift, arrow, shine), arrow links (underline and
arrow), the service call link, the machine picks (homepage lift; Capabilities border and shadow), the filter chips, the
clients switch, the certificate cards (lift and the "open" fill), the closing panel's links (lift and arrow), the
Industries service links and the project pages' service links. Newer components already used `:is(:hover,
:focus-visible)` (project card links, index links, contact rows, fleet bays, power rows); cards use `:focus-within`.

Measured, no defect: rapid filter changes (a second choice during the first, 120–400 ms apart: the same item groups as
after a 2 s gap; `data-vt` and item names never left behind); reveal staggers ≤ 360 ms outside an authored drawing; the
tallest reveal block 2.8 screens at 320 px (far below the 11.5 screens at which the 8 % threshold could not be met);
the reveals still hidden after a full scroll on phones are `display: none` there (services overview supports, the
scaffolding return, an Industries strip tile), apart from D10.

## 7. Inconsistencies found

| | Where | What was wrong |
|---|---|---|
| D1 | Industries, reduced motion | The rule meant to stop the sector line, `.mc :is(…, .in-row::before, …) { transition: none }`, holds a pseudo-element inside `:is()`, which browsers drop: the line still slid in over 600 ms with reduced motion. |
| D2 | Client logos (homepage, Clients), reduced motion | The colour switch still faded every logo over 600 ms. |
| D3 | Homepage About photo, reduced motion | The clip reveal was off, but the photo's own 1.6 s scale transition still ran when it was revealed. |
| D4 | Signatures, hero plate (readout, lean), pointer | Reduced motion (and, for the pointer, forced colours and the fine pointer) was read once when the page loaded: turned on while a page was open, the hero loop kept cutting, a signature kept running, the plate kept leaning and the custom pointer stayed. |
| D5 | Service signatures (one-time runs) | Once started, a run kept going off screen and while the page was hidden (only loops rested), so a visitor who scrolled away came back to a finished picture they never saw drawn; the replay guard was a fixed time (`busyUntil`) rather than the run's own state. |
| D6 | Ambient, hero hot points, machinery console | Nothing paused them while the page was hidden (another tab): they relied on the browser's throttling. The Capabilities fleet plate's one-time scan also ran from the first paint wherever the plate was, so a cold address deep in the page played it off screen. |
| D7 | Buttons, links, picks, chips, switch, certificate cards, closing-panel links, service links | Hover-only emphasis: keyboard focus showed the focus ring but not the fill, lift, arrow or underline that hover showed. |
| D8 | Certificate cards | The preview's lift took 600 ms; every other hover lift takes 320 ms (`--dur-2`). |
| D9 | Industries | The active row's line animated `width` (a layout property, each frame laid out). |
| D10 | Homepage rails on phones | Each card revealed on its own as it was swiped into view, so a swipe landed on blank or half-faded cards. |
| D11 | Card photos | The hover zoom used a literal `0.9s` beside the identical token `--dur-4` (900 ms). |
| D12 | Arrows and lifted links, reduced motion | With reduced motion the cards kept still, but the arrows still nudged and the closing panel's links still lifted. |
| (race) | Pointer | A mouse that was already over an element while the page started was not "seen" until it entered another element: `data-cursor-on` hid the system cursor while the custom pointer was not drawn (the certificates pointer test failed once in about 40 runs on both builds). |
| (race, found in QA) | Hero readout | After D4, turning reduced motion on while the loop ran could leave the readout at "00/07" instead of the finished "07/07": a readout frame already queued ran after the loop was cancelled, before the cancel event reached its listener, and read the empty clock as 0 (the preliminary full run; reproduced in 2 of 16 trials at 6× CPU throttling, 0 of 24 without). |
| (fps, found in QA) | Projects filter | The view transition captured the whole page as well as the cards: two full-screen pictures cross-faded for 450 ms, about 25 frames a second in the software-compositing benchmark (35.8 / 37.3 fps over a filter every 900 ms, on Stage 1F as well). |

## 8. Changes made

Each change answers one finding of item 7; nothing else moved. No new animation, no new motion concept, no new token, no
library.

| | Change | Files |
|---|---|---|
| D1 | The sector line has its own reduced-motion selector (`.mc .in-row::before { transition: none }`), outside the `:is()` list. | `system.css` |
| D2 | Reduced motion: `.mc .logo-tile img { transition: none }` — the logos take their colour at once, like the previews and machine panels. | `system.css` |
| D3 | Reduced motion: `.js [data-reveal="clip"] img { transition: none }`. | `commerce.css` |
| D4 | A small hook, `useMedia(query, serverAnswer)` (`useSyncExternalStore` over `matchMedia`, the calm answer before hydration), replaces the one-time `matchMedia` reads: `useSignature` (every run stops and its finished picture shows when reduced motion is turned on, and runs again when it is turned off), `HeroPlate` (the readout shows the finished count, the lean settles back) and `Cursor` (the system cursor comes back when reduced motion or forced colours are turned on, or the mouse stops being a fine pointer). | `useMedia.ts` (new), `useSignature.ts`, `HeroPlate.tsx`, `Cursor.tsx` |
| D5 | Every signature run, not only the loop, rests where it is while it is off screen or the page is hidden, and carries on from there when it is back (its observer stays connected); a replay waits until the run's own animations have ended (`busy()` reads their play state) instead of a fixed time. | `useSignature.ts` |
| D6 | `Motion.tsx` marks `html[data-page-hidden]` while the page is hidden and clears `data-live` on every `[data-ambient]` section then: the site-wide ambient rests (`html:is([data-scrolling], [data-page-hidden])`), and so do the hero's hot points and the console's scan and sketch (their existing `[data-live]` gates). The Capabilities fleet plate became a `[data-ambient]` section and its one-time scan uses the console's `--cm-play` gate: it waits, invisible at its first frame, until the plate is on screen. | `Motion.tsx`, `system.css`, `FleetPlate.tsx`, `capabilities.css` |
| D7 | `:focus-visible` beside `:hover` on the listed controls (buttons of every variant with their arrow and shine, arrow links, the service call link, the machine picks on both pages, the switch, the filter chips, the certificate cards' lift and "open" fill, the closing panel's links and arrows, the Industries and project-page service links). The focus ring is unchanged. | `system.css`, `services.css`, `projects.css`, `capabilities.css`, `project-detail.css` |
| D8 | The certificate preview's lift: `--dur-3` → `--dur-2` (320 ms, as every other lift). | `system.css` |
| D9 | The sector line is full width and scaled (`scale: 0 1` → `1`, from the row's start: `transform-origin` left, right in Arabic) instead of resized; its two resting states are the same pixels as before. | `system.css` |
| D10 | When a reveal inside a `.rail` that scrolls sideways (phones) is shown, every other card of that rail is shown with it. Where the rail is a grid (wider screens) cards still reveal one by one. | `Motion.tsx` |
| D11 | `.card-media img`: `0.9s` → `var(--dur-4)` (the same 900 ms). | `system.css` |
| D12 | Reduced motion: the arrows (buttons, arrow links, closing-panel links, contact rows) and the closing panel's links keep still on hover and focus; colour, underline and focus ring show the state. | `system.css` |
| race | `Cursor.tsx`: the first mouse move after the listeners exist reads what is under the pointer, so the system cursor is never hidden without the laser pointer shown. | `Cursor.tsx` |
| readout | The readout's frame ignores a cancelled clock (`playState === "idle"`), so only the finished count remains (0 of 32 throttled trials after the fix). | `HeroPlate.tsx` |
| fps | `:root[data-vt="gallery-filter"] { view-transition-name: none }`: only the cards are captured and move (as before, 450 ms), the rest of the page updates at once instead of cross-fading; 56 fps instead of 36 (item 34). | `projects.css` |

## 9. Changes deliberately not made

- **The hero loop**: timing, cycle, rise, reset and pausing untouched (only its readout and lean now follow a live
  reduced-motion change, D4).
- **The signature sequences** (Laser Cutting, Laser Engraving) and the four other service drawings: no new step, timing
  or easing. The drawings' one-time 1.8 s draw is not paused off screen: it starts only when the drawing is revealed (on
  screen) and lasts under two seconds.
- **The reveal** (700 ms, 18 px, `--ease-out`, staggers ≤ 360 ms): already one coherent system. The Steel Structures
  hero drawing's 920 ms stagger is authored into that drawing and stays.
- **The projects filter's view transition (450 ms)**: not moved onto a token — the root's view-transition pseudo-elements
  sit outside `.mc`, where the motion tokens are defined, so a token there would need a second definition; and the rapid
  re-choice race measured in the inventory does not exist.
- **The header's pop and sheet (320 ms), the dialog (320 ms), the primary button's shine (750 ms), the theme switch and
  page-change cross-fades (browser default 250 ms)**: consistent already, or the browser's own; no global page
  transition, loader or overlay was added.
- **The ambient**: still the same two layers; only its rest while hidden was added (no third layer, particles,
  canvas, WebGL or animated blur).
- **The pointer**: same size, look and behaviour; only when it is on (D4) and the first-move fix.
- **Capabilities' console**: transitions, sketch and scan timings unchanged (the console was already gated on
  `data-live`); only the fleet plate's scan joined that gate.
- **Contact**: the form, its validation and its outputs, the map and its frame — untouched. No floating WhatsApp.
- **Content, layout, grids, cards, heroes, galleries, navigation, the project pages' architecture**: untouched (item 37–38).
- **The Theme Lab**: no file of the lab changed (item 42).

## 10. Motion tokens

The tokens were already in place (`system.css`, scoped to `.mc`), and no new one was added:

| Token | Value | Used for |
|---|---|---|
| `--dur-1` | 180 ms | colour, border and underline changes; the panel hand-off out; the burger |
| `--dur-2` | 320 ms | lifts (now every one, the certificate preview included), arrows, knobs, the dropdown, the sheet, the dialog |
| `--dur-3` | 600 ms | cross-fades (previews, machine panels), card edges, the sector line |
| `--dur-4` | 900 ms | the hero entrance, slow photo moves (now the card photo zoom too) |
| `--ease` | cubic-bezier(0.22, 1, 0.36, 1) | every eased change |
| `--ease-io` | cubic-bezier(0.65, 0, 0.35, 1) | scans and sketches |
| `--reveal-dur` / `--ease-out` | 700 ms / the `--ease` curve | reveals (`commerce.css`) |

Near-duplicates folded onto existing tokens: the card photo's literal `0.9s` (= `--dur-4`) and the certificate preview's
600 ms lift (→ `--dur-2`, as every lift). Timings that differ on purpose were left alone (item 9): signatures, the hero
loop, scans and sketches, the primary shine, the filter view transition.

## 11. PageHero

Unchanged: every inner page's hero (the kit's `PageHero` and the service pages' `ServiceHero`) shows with the first paint
(TM-3); only the service drawings and laser signatures inside it draw in once the script runs. The TM-3 tests still
prove it (the hero shown with its script blocked; the title fully shown in every frame from the first paint on five
pages). One of those tests counted every running animation in the hero apart from the drawings and signatures; on
`/ar/capabilities` it now also allows the fleet plate's scan, which since D6 can still be passing 2.6 s after load,
and it checks that only the scan's own two keyframes run there (item 49).

## 12. Generic reveals

Same 700 ms fade and 18 px rise, same easing and staggers, still one-shot (the element is unobserved once shown; tested:
scrolled back up and down again, nothing reveals twice). Change: D10 — on phones, a sideways rail shows all its cards
with the first one, so a swipe never lands on a blank card; where the rail is a grid (wider screens) its cards still
reveal one by one as they come into view (tested by position, not DOM order). Reduced motion: shown at once (no
change). No script: shown (no change).

## 13. Homepage hero

The loop is unchanged: a cycle every 10 s (cut 0–5.26 s, hold to 9.40 s, reset to 9.85 s), the rise in cycle 1
only, running only while on screen and the page is visible, the static finished plate with reduced motion, no drift
(`commerce-home.spec.ts` and `theme-lab-a-v2.spec.ts` pass unchanged). New: reduced motion turned on while the page is
open stops the loop at once on the finished plate (the readout shows "07/07", no running mark, no lean), and turned off
again starts it from cycle 1 (tested). The readout's X / Y under the mouse is information, not motion, and still works
with reduced motion (as before).

## 14. Ambient

The same two layers, unchanged in look and timing. It rests while the page scrolls (as before) and now also while
the page is hidden (`html[data-page-hidden]`, set from `visibilitychange`; tested by faking a hidden page): it resumes
where it stopped. No third layer, particles, canvas, WebGL or animated filter. Scroll benchmark: item 34.

## 15. Cursor

Same size, look and behaviour; desktop mouse only (`(hover: hover) and (pointer: fine)`); never on touch, pens, with
reduced motion or in forced colours; never inside a modal dialog (the TM-2.3 rules); text fields keep the I-beam;
selection and forms are untouched. New: those conditions are live (D4) — turning on reduced motion or forced colours
gives the system cursor back at once (tested), turning reduced motion off brings the pointer back on the next move —
and the first-move fix (the race in item 7).

## 16. Header, dropdown, phone menu sheet

No visual or timing change (320 ms pop and sheet, 180 ms burger). Twenty quick open/close cycles each (tested): the
sheet ends closed, the page free to scroll, nothing moving, no listener added, and the keyboard still opens it; the
dropdown ends closed, Escape returns focus to its summary, no listener added. Rapid-interaction measurements: item 32.

## 17. Service signatures

The sequences are untouched (no new step, timing or concept; `commerce-services.spec.ts` "unforked signatures and their
replays" passes). New: a run that leaves the screen rests where it is and carries on when it is back, so it never plays
unseen (tested); a replay still starts on hover or focus once the run has ended; reduced motion turned on mid-run shows
the finished picture at once (tested).

## 18. Capabilities

The console (selector, panels, stage, scan, sketch, register, transitions) is untouched: panel out 180 ms, in 600 ms
(+80 ms), opacity and `translate` only, scan and sketch once per showing and paused off screen. The 1E tests pass
unchanged (including its 20-cycle selector stress, Back/Forward, pre-hydration hand-off and the 12 cold addresses × fonts
held back). New: the scan, sketch and fleet plate rest while the page is hidden; the fleet plate's one-time scan waits,
invisible at its first frame, until the plate is on screen (D6, tested on a cold `#fiber-laser-6kw` address: paused at
0 ms with opacity 0 for 3 s, then it passes once when the plate is scrolled into view). The machine picks' border and
shadow show on keyboard focus too (D7).

## 19. Projects filters

Unchanged: the 450 ms view transition, names only during `data-vt`, the choice applied at once with reduced motion,
without the API or from the quick toggles; `#<slug>` and `#gallery` land unfiltered (`commerce-projects.spec.ts` passes).
Twenty quick filter cycles (tested): the last choice is pressed and shown, no transition name or `data-vt` left, hidden
cards out of reach. The chips' hover border shows on keyboard focus too (D7).

## 20. Industries preview

The preview's 600 ms cross-fade is unchanged (instant with reduced motion). The active row's line is now scaled instead
of resized (D9; tested in EN and AR: scale `1` and full row width when active, `0 1` at rest, grown from the row's start
— the left in English, the right in Arabic) and is instant with reduced motion (D1, tested). The service links' hover
fill shows on keyboard focus too (D7).

## 21. Clients switch

Unchanged on the wall: knob 320 ms, logos 600 ms (instant with reduced motion since D2, tested). Twenty quick cycles
(tested): the switch's state and the wall agree, nothing moving, no listener added. The forced-colours tests that once
raced the knob's transition (Stage 1E, TM-3 polish) still wait for it to settle; nothing was reintroduced.

## 22. Certificates dialog

Unchanged: 320 ms open/close (opacity and 12 px), off with reduced motion, `showModal()`, Escape / close button /
backdrop, focus return, the system cursor inside the dialog (the custom pointer fades out). The card's preview lift now
takes 320 ms like every lift (D8) and shows on keyboard focus too, with the "open" fill (D7). Twenty quick cycles
(tested): closed, focus back on its card, the pointer's modal mark gone, no listener added.

## 23. Contact

Untouched: the form (`QuoteForm.tsx`), its validation and golden outputs (`commerce-contact.spec.ts` passes), the map
iframe and its URLs, the frame pointer. The contact rows' arrows keep still with reduced motion (D12). No floating
WhatsApp button.

## 24. Project pages

No zoom, parallax or Ken Burns; the title, summary, facts and every photo are shown with the first paint (no reveal on
them; evidence 10 and 11 capture the first screen at DOMContentLoaded); only the shared closing panel fades in when scrolled to, as on
every inner page. The service links' hover colour shows on keyboard focus too (D7). Media safety: item 39.

## 25. Anchor regression

The shared late-font-safe system (TM-2.5) is untouched: `html[data-smooth-scroll]` after load and fonts, instant first
jumps, no script scrolling, no `setTimeout`. Stage 1I adds no scroll of its own (the Capabilities selector's deferred
sideways scroll is 1E's, unchanged). Covered by the final suite, all passing (item 49):

- Contact `#quote` and `#location`, the legal contents anchors and two service pages' section anchors, cold, with the
  fonts held back 300 / 1200 ms, at 1440 and 390 (`commerce-anchors.spec.ts`), plus same-page glides, history, reduced
  motion and no-JS;
- Projects `#gallery` and every `#<slug>` (unfiltered landings, the hidden-target click, cold loads, clear of the header
  and the bar; `commerce-projects.spec.ts`);
- all six Capabilities machine anchors × desktop/phone × fonts +300/+1200 ms, and every machine link from the homepage
  and the service pages followed and landed (`commerce-capabilities.spec.ts`).

## 26. Reduced motion

A hard gate, tested both ways:

- **From the first paint** (`commerce-motion.spec.ts`): on 11 pages, walked to the bottom with their controls used (menu,
  dropdown, switch, machine picks, filters, preview, dialog), the only gradual changes the browser runs are colours and
  shadows: no position, size, opacity or sequence.
- **Turned on while a page is open** (new in 1I): the hero loop stops on the finished plate ("07/07", no running mark, no
  lean), a signature mid-run shows its finished picture at once, and the system cursor comes back. Turned off, the hero
  loop and the pointer resume.
- **Per part:** the Industries line, the client logos and the About photo change at once (D1–D3); arrows and lifted links
  keep still, with colour, underline and focus ring still showing the state (D12); the projects filter applies at once
  (no view transition), as before.
- The census after the change: with reduced motion the only non-colour property any page transitions is `--spot` (the
  machine showcase's spot-light position, a colour gradient).

## 27. Forced colours

The TM-3 work is untouched (no forced-colours rule changed). The final suite's forced-colours tests pass: the header's
current page and section marks, the language and theme buttons, both switches (homepage and Clients), the fallback 404's
logo, the projects chips, the Capabilities pick (`Highlight` ring and underlined name), certificates and project pages.
New in 1I: turning forced colours on while a page is open gives the system cursor back (tested). axe in forced colours:
item 33. Evidence 17.

## 28. No JavaScript

No change to the no-JS architecture: every new rule is either under `.js` or a state that script sets
(`data-page-hidden`, `data-live`, `:focus-visible` states that need no script). The final suite's no-JS tests pass on
every page (`stage-1c.spec.ts` covers all inner pages; the homepage, Contact, Projects, Capabilities, project pages and
the motion spec have their own). Without script the fleet plate's scan never runs (its rule is under `.js`) and nothing
waits for `data-live`. Evidence 18.

## 29. EN / AR

Every motion test that depends on direction runs in both languages (the Industries line, the cursor and plate
behaviours, the menu, filters and dialog cycles in English; the TM-3/1E/1F suites in both). The resting-state proof
covers both languages (item 37–38); the frame-rate and CLS measurements cover both (items 34, 36).

## 30. RTL

- The sector line grows from the row's start: the right edge in Arabic (`transform-origin` via `--line-from`; tested).
- The signatures' mirroring in Arabic, the ambient sweep's reversed direction and the arrows' `--dir` are unchanged.
- The rail rule (D10) reads `scrollWidth > clientWidth`, which holds in either direction.
- No new physical `left`/`right` in any motion rule.

## 31. Responsive matrix

336 states — 12 sizes (1920×1080, 1440×900, 1280×800, 1024×768, 834×1112, 430×932, 412×915, 393×852, 390×844,
375×812, 360×780, 320×700) × EN/AR × light/dark — on the seven pages whose motion changed or rests differently (the
homepage, Laser Cutting, Capabilities, Projects, Industries, Certificates, the longest project page), motion allowed
(`matrix.js`). Per state, after a walk down the whole page: no sideways scroll; no visible element outside the screen
(except inside a sideways scroller); every rendered reveal shown and fully opaque (no stuck opacity or stale
transform); the theme and direction applied; no console error.

**335 states passed; 1 failed once:** the Arabic homepage at 1024×768 light, where four of the six homepage service
cards were still unrevealed after the walk. Repeated six times on each build (Stage 1F and 1I), every run showed every
reveal: the walk (a screen every 60 ms) had passed those cards during a busy moment, so the observer never saw them on
screen, and they reveal as soon as they are scrolled into view. Not a regression, and not in the grid the rail rule
touches (they are a plain grid at 1024). The suite's own size tests also pass (twelve sizes on Capabilities and the
project pages, the TM-3 sweeps from 320 to 1440 px).

## 32. Rapid-interaction stress

Test-only loops, twenty cycles each, in the final suite (`commerce-motion.spec.ts` and 1E's `commerce-capabilities.spec.ts`):

| Control | End state checked | Listeners | Other |
|---|---|---|---|
| Phone menu sheet (20 open/close) | closed, page free to scroll, nothing moving | none added | the keyboard still opens it |
| Services dropdown (20) | closed, Escape returns focus to its summary | none added | |
| Projects filters (20 choices) | the last choice pressed and shown, one pressed chip, no `data-vt`, no item named, hidden cards unreachable, the live region names the choice | none added | no console error |
| Capabilities selector (20, 1E) | one active panel, the address and the pick agree | the page's own compared by type and source | Back/Forward |
| Clients switch (20, Clients page) | state and wall agree, nothing moving | none added | |
| Certificate dialog (20 open/close) | closed, focus back on its card, the pointer's modal mark gone | none added | |

Measured besides (`interact.js`, 40 actions each — one every other frame, from inside the page, EN and AR, both builds):
no long task in any run, no console error, the end states as above; 59.5–60 fps for the sheet, the dropdown, the
selector, both switches and the dialog. The filters under that synthetic pace (a new choice every 33 ms) run at 26–28 fps
on both builds: each choice makes the browser capture the moving cards (≈ 100 ms per capture in software compositing).
At a realistic pace the filter holds 56 fps (item 34).

## 33. Accessibility

**axe-core** (WCAG 2.0/2.1/2.2 A and AA plus best practice; `axe.js`), 92 states on the Stage 1I build:

- final states of 14 pages (the homepage, About, Services, Laser Cutting, Capabilities, Projects, two project pages,
  Industries, Clients, Certificates, Contact, Privacy, the 404) × EN/AR × light/dark, motion allowed, after a walk;
- moving states held where they stand: the hero mid-cut, the dropdown open, a machine changing (160 ms in), the Laser
  Cutting signature mid-run, the certificate dialog opening (160 ms in), the clients switch pressed, a filter applied
  (EN light and AR dark each), the phone menu sheet open (EN/AR);
- the machine change and the dialog once settled (EN/AR); reduced motion (homepage, Capabilities, a project page,
  EN/AR); forced colours (homepage, Capabilities, Certificates, Industries); phones (homepage, Capabilities, Projects,
  EN light / AR dark).

Result: **90 states with 0 violations.** The other 2 are frames held mid-fade: the console's incoming panel 160 ms into
its 600 ms fade (one secondary button) and the certificate dialog 160 ms into its 320 ms fade (two preview labels),
where text at partial opacity has, for that moment, lower contrast ("serious", colour contrast). The same two frames
give the same result on Stage 1F (pre-existing, inherent to any fade), and both interactions once settled have 0
violations in both languages. Nothing else on the site reports a violation, including every phone, reduced-motion and
forced-colours state.

**Manual and scripted checks:**

- Keyboard: focus = hover on every listed control (tested); Escape, outside click, focus return and focus leaving the
  dropdown and the sheet (twenty-cycle tests and the existing header tests); the dialog's focus containment, Escape,
  backdrop and return (the TM-2.3 tests, plus twenty cycles).
- **The focus ring during the transition:** sampled every frame for 400 ms after keyboard focus on 12 controls (the two
  button kinds, an arrow link, a machine pick, the switch, a certificate card, a closing-panel link, a Capabilities pick,
  a filter chip, an Industries service link, a project-page service link, the call link): the 2 px ring is drawn in
  every frame from the first.
- Screen-reader announcements: unchanged (the filter's "Showing: …" live region, the machine console's announcement,
  the switch's `aria-pressed`, the dialog's label); the twenty-cycle filter test checks the live region names the last
  choice.
- Reduced motion, forced colours, no JS: items 26–28. Zoom and reflow: the TM-3 tests at 200 % zoom and 320 px pass;
  the matrix goes down to 320.
- Animation never carries state alone: chosen chips carry a check mark, the chosen machine `aria-current` and an
  underlined name in forced colours, the switch `aria-pressed`, the dialog is a modal with its own label.

## 34. Frame rate

Method: the established software-compositing benchmark — headless Chromium (software compositing, the worst case),
1440 × 900, a fresh context per run, the mouse off the page, every action from inside the page (no mouse travel), frames
timed with `requestAnimationFrame` over the whole window (transitions included, nothing excluded); mean fps = frames ÷
time; p95 and worst frame time. Both builds, EN and AR (`perf.js`).

| Scenario | Stage 1F (EN / AR) | Stage 1I (EN / AR) | p95 1I | worst 1I |
|---|---|---|---|---|
| Hero loop running, 12 s at the top of the homepage (a reset included) | 60 / 60 | 60 / 60 | 16.8 / 16.7 ms | 16.8 / 16.8 ms |
| Homepage scrolled top to bottom (8.5 s) | 59.4 / 58.8 | 58.3 / 58.7 | 16.8 / 16.8 ms | 50 / 33.4 ms |
| Laser Cutting signature playing (7 s) | 60 / 60 | 60 / 60 | 16.8 / 16.7 ms | 16.8 / 16.8 ms |
| Laser Engraving signature playing (7 s) | 60 / 60 | 60 / 59.9 | 16.7 / 16.7 ms | 16.8 / 33.4 ms |
| Capabilities, a machine every 700 ms (8.4 s) | 60 / 60 | 60 / 60 | 16.8 / 16.7 ms | 16.8 / 16.8 ms |
| Projects, a filter every 900 ms (8.1 s, nine view transitions) | 35.8 / 37.3 | **56.4 / 56.3** | 16.8 / 16.8 ms | 116.7 / 133.3 ms |
| Longest project page (4 photos) scrolled down and up (6 s) | 60 / 60 | 60 / 60 | 16.7 / 16.7 ms | 16.8 / 16.8 ms |

Every scenario meets the brief's 55 fps floor. The Projects filter did not before Stage 1I: each choice cross-faded two
full-screen pictures of the page for 450 ms, about 25 frames a second in this benchmark (a frame-by-frame trace: one
capture frame of 83–167 ms, then frames of 33–50 ms for the whole transition). Naming only the cards that are on screen
did not help (the capture frame shrank, the transition frames did not); not capturing the page itself did, so the
filter's transition now moves the cards only (item 8): 16.7 ms frames through the transition, and one capture frame of
67–133 ms per choice, which is the worst frame above. The rest of the page updates at once instead of fading.

## 35. Long tasks

Main-thread tasks over 50 ms, from a `PerformanceObserver` installed before any page script, and a performance trace to
see what they are made of (`ltattr.js`):

- **During interactions: none.** No task over 50 ms in any measured window on either build: the hero loop with a reset,
  the homepage scroll, both signatures, machine changes, filter transitions, the longest project page, the 40-action
  stress runs (menu, dropdown, filters, selector, switches, dialog) and the walk down 32 pages × 2 sizes.
- **First load:** each page has one to four tasks of 50–273 ms while it loads, on both builds alike. The trace splits the
  largest one into the browser's first style, layout and text shaping (`performLayout`, `ShapeTextIncludingFirstLine`,
  `recalcStyle`): 171 ms on the English homepage, 273 ms on the Arabic one (Arabic text shaping alone 111 ms), 121–170 ms
  on the inner pages, 52 ms on the longest project page. The only production-JavaScript task is the homepage's
  hydration call, 53–56 ms (54 ms on Stage 1F). No image decoding appears in a long task. The first request after a
  server start is slower (one cold load measured 1.3 s on Stage 1F); those are server warm-up, not the page.

## 36. CLS

Layout-shift entries without recent input, from the first paint through the load, a walk down the whole page and back
(`loads.js`; 16 pages × EN/AR × desktop 1440 / phone 390 = 64 loads per build):

- **Stage 1I adds no layout shift**: every page's CLS equals Stage 1F's (largest difference 0.0005).
- English pages: 0 everywhere (the 404: 0.0006). Phones: 0 on every page in both languages.
- Arabic desktop pages: 0.002–0.039 (homepage 0.039, Laser Cutting 0.020, the stainless project 0.019, Clients 0.016,
  Certificates 0.011, the rest below 0.009), all from the Arabic web fonts swapping in (not preloaded; the 1J item).
- **`/ar/services/steel-structures`: 0.259 on both builds**, a pre-existing shift, not motion: with the fonts blocked
  its CLS is 0, and with the fonts delayed 1.5 s the same 0.259 shift happens when they arrive — the hero's Arabic text
  sets taller in Tajawal / IBM Plex Sans Arabic than in the fallback and pushes the drawing and the next section down.
  Above the 0.1 "good" threshold; it belongs with the Arabic font loading work deferred to 1J (item 52).
- Motion itself: reveals and the hero use transforms and opacity only (no shift during the walks), the machine switch,
  the dialog and the menu shift nothing (0 in the interaction runs), and the filter changes geometry only by the content
  it filters, as the brief allows.

## 37. Homepage resting-state regression

Every prerendered homepage file (`en.html`, `ar.html`, their page data and segments: 12 files) is byte-identical to the
Stage 1F build after normalising build ids and asset paths (`compare.py`). Pixels: the Stage 1F build and the Stage 1I
build side by side with reduced motion (the finished, still state), images loaded, transitions ended and every remaining
animation held at its start (`pixels.js`): EN/AR × light/dark at 1440 (full page) and at 390 (screen by screen, 15
screens each) — **68 captures, every pair byte-identical**. The homepage's stylesheets: the same two files, the shared
one 843 bytes larger (the rules in item 8). Its JavaScript: the same ten files, 990 bytes more (`useMedia`, the
controller, the pointer, the readout guard).

## 38. Inner-page regression

- **Files:** of the build's 806 prerendered files, 798 are byte-identical to Stage 1F; the other 8 are the two
  Capabilities pages (HTML, page data and two segments each), and removing the one new attribute (`data-ambient` on the
  fleet plate) makes all 8 identical too.
- **Pixels (`pixels.js`), all byte-identical:** at reduced motion, finished state, EN light and AR dark at 1440 — About,
  Services, Laser Cutting, Capabilities, Projects, a project with photos (clock tower), a text-only project (stainless
  landmark), Industries, Clients, Certificates, Contact, Privacy and the 404 (26 full-page captures). In Arabic on a
  phone screen by screen — About, Capabilities, the clock tower project and Industries (46 captures). The Projects
  captures were repeated on the final build after the filter change (item 8); they are byte-identical as well.
- **Stylesheets:** every page keeps its stylesheet list (same count; the shared sheet +843 B, `capabilities.css` +124 B,
  `projects.css` +76 B, `services.css` and `project-detail.css` +20 B each, the signatures' sheet unchanged).

## 39. Project media safety regression

Untouched: `projectDetailMedia`, `withheldMedia`, `projectImages`, the `confirm-authorship` / `render` / AI-watermark
rules, `projects.ts` (no file under `src/content` changed). All 476 prerendered project-page files are byte-identical to
Stage 1F, and the final suite's `commerce-project-detail.spec.ts` passes (the photo rule by flag, the 68 pages and their
page data referring to exactly their allowed photos, each flagged project's requests, no note or flag rendered).

## 40. Stage 1E regression

Capabilities keeps its six machines, selector, fragments, grid, scans, schematics, power chart and register (no
change to `machines.ts`, `capabilities.ts`, `MachineConsole`, `Schematic`, `PowerChart`, `Register`). The only change is
the fleet plate's scan gate (item 18). `commerce-capabilities.spec.ts` (the 1E suite, incl. the 20-cycle selector,
the 12 cold addresses with fonts held back, every machine link followed) passes unchanged; its pages differ only by the
`data-ambient` attribute; their resting pixels are byte-identical.

## 41. Stage 1F regression

Project pages and the overview's "View project" links: no change (476 project-page files and the overview's 12 files
byte-identical; pixels identical; `commerce-project-detail.spec.ts` and `commerce-projects.spec.ts` pass). The project
pages' service links gained the hover colour on keyboard focus (`.pd-link:is(:hover, :focus-visible)`), a state, not a
resting change.

## 42. Theme Lab regression

No file of the lab changed (`src/app/theme-lab/**`, `src/components/theme-lab/**`): its 96 prerendered files and its
stylesheets are byte-identical to Stage 1F, and so are its pixels (A V2 EN/AR, its system sheet, option A). Options A,
B and C load the same JavaScript as before. Option A V2 and its system sheet load 507 bytes more: since TM-1 the lab's A V2
re-exports the production pointer, hero plate and signature hook ("one implementation, one animation controller"), so it
shares their Stage 1I corrections (live reduced motion, signatures resting off screen, the pointer's first move, the
readout guard). No new motion was added to the lab, and its own controller (`LabMotion`) is unchanged.
`theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` pass.

## 43. `npm audit`

5 high-severity findings, all one development chain: `braces` (GHSA-vfj7-8cjw-p6xm, stack exhaustion on deeply nested
patterns) → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`. The offered fix is
`npm audit fix --force`, which would install `eslint-config-next@14.2.35` (a breaking downgrade of the lint config); not
run, as the brief says. The same development-tooling finding as before.

## 44. `npm audit --omit=dev`

`found 0 vulnerabilities` — no production vulnerability, so no stop.

## 45. `npm ci`

Exit 0: "added 374 packages, and audited 375 packages". No dependency changed in Stage 1I (`package.json` and
`package-lock.json` untouched).

## 46. `npm run lint`

Exit 0, no warnings.

## 47. `npm run typecheck`

Exit 0 (`next typegen` + `tsc --noEmit`).

## 48. `npm run build`

Exit 0: compiled, 125 static pages generated. This build (after `npm ci`) is identical to the build every measurement in
this report was taken on: all 806 prerendered files identical, all 38 static chunks identical by content.

## 49. E2E

`npm run test:e2e`: Playwright's own `next start` on the build of item 48, 3 workers, nothing else running, **no
retries** (`playwright.config.ts` sets none, so a test that fails once counts as failed and "flaky" cannot occur). The
suite has 533 tests: Stage 1F's 511 and the 22 of the new `commerce-motion.spec.ts`.

| Run | Tests at | Total | Passed | Failed | Skipped | Flaky | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `c2fb607` | 533 | 532 | 1 | 0 | 0 | 14.3 min |
| 2 (final) | `528f53a` | 533 | **533** | **0** | **0** | **0** | 14.2 min |

Run 1's one failure was in a test new in this stage, `commerce-motion.spec.ts` "a filter choice moves only the
gallery's items: the page itself is not captured": it read the page a fixed 900 ms after the click, and under the
suite's load the view transition was still running then (the `data-vt` mark, the root's `none` and the 27 card names
still set — the state the same test checks *during* the transition). The gallery clears both in the transition's own
`finished` handler, so nothing can stay behind; the read came too early. Reproduced with a probe (`vtprobe.js`: the same
read in a fresh page under CPU throttling, 10 trials each): the 450 ms transition takes 711–799 ms from click to
`finished` without throttling (its captures, in software compositing), so the fixed read failed 0 of 10 at 1×, 2 of 10
at 4× and 10 of 10 at 6×. The test-only commit `528f53a` reads once the transition's own `finished` has settled, plus
one task (so the page's `finally` has run): 10 of 10 at 1×, 4× and 6×, then 30 of 30 repeated in Playwright (3 workers)
and 22 of 22 for the spec; every assertion is unchanged. The spec's other fixed wait after motion was checked the same
way: "a reveal runs once" reads 900 ms after its walk, and the last reveal fade ends 520–589 ms after the walk at 1×, 4×
and 6× (`revealmargin.js`), so it stays as it is.

Run 2 (the final run, on the same build, started 2026-10-05 00:04 UTC): **533 of 533 passed**, the 22 motion tests
included; no test was skipped, retried or changed between the two runs except the one in `528f53a`.

**Earlier runs in this stage** (on the QA builds, before the final build), in order, with every failure:

| Run | Result | Failures, cause and what was done |
| --- | --- | --- |
| Specs of the changed areas, first run | 164 passed, 3 failed | `commerce-certificates` "desktop mouse: the custom pointer gives way to the system cursor inside the dialog": the pointer was never shown — the pointer's first-move race (item 7; it failed about once in 40 runs on Stage 1F too) → fixed in the product (`Cursor.tsx`), the test unchanged. Two `commerce-services` layout tests: no assertion failed — `ENOENT` on their trace files, because a second Playwright run of mine emptied the shared `test-results` folder mid-run; both passed in the next run of those specs. |
| `commerce-motion.spec.ts`, first run (20 tests then) | 15 passed, 5 failed | Two focus = hover tests hovered the first `.link-arrow`, which is hidden at 1440 → they take the first visible one (test error). "Scrolled straight through …": 2 animations running off screen on `/en/capabilities`, the fleet plate's scan → a product finding (D6), fixed in the product. The wide-screen rail test took the last card in source order, which is not the lowest in the grid → it compares positions (test error). The sector line in Arabic: its fractional `transform-origin` was compared as text with a rounded width → compared as numbers within 1 px, the width likewise (test error). |
| `commerce-motion.spec.ts`, second run | 18 passed, 2 failed | The two focus = hover comparisons: Playwright hovered a card that was still being revealed, re-scrolled it with a smooth glide, and the page moved under the mouse → `still()`: wait until the target is revealed and nothing on, around or inside it runs, then hover (test only, timing). |
| The two focus tests, repeated | 4 of 9, then 10 of 15, then 15 of 15 passed | The same cause; then the first `still()` counted the hero entrance — finished, but kept by its fill — as moving → it counts running animations only. |
| `commerce-motion.spec.ts` twice | 40 passed | |
| Preliminary full run | 528 passed, 3 failed | `commerce-motion` live reduced-motion hero test: the readout read "00/07" — the readout race (item 7), a product bug → fixed in `HeroPlate.tsx`. `commerce-polish` `/ar/capabilities` hero test: 2 running animations in the hero, the fleet plate's scan, which since D6 starts once the plate is on screen and can still be passing 2.6 s after load → the test leaves out that scan's two layers, by name (`cm-scan-line`, `cm-scan-trail`), and a new motion test checks the scan's gate directly. `commerce-polish` Industries sweep (320–1440 px): no assertion failed — Playwright's trace zip was cut short under load; it passed in the next run of that spec and in the final runs. |
| Specs of the changed areas after the fixes | 200 passed | capabilities, home, motion, polish, lab A V2 |
| Projects + motion after the filter fix | 74 passed | |

**Every timing-related test change in this stage** (none drops an assertion; no test was skipped, quarantined or given
retries):

1. `commerce-motion.spec.ts` `still()` before a hover or focus: the target revealed and nothing running on it; the
   comparison itself (every listed property under hover equals the same under keyboard focus) is unchanged.
2. `commerce-motion.spec.ts`, live reduced-motion hero test: the mouse moves only once the loop runs (hydration), since
   the pointer cannot see a move made before its listeners exist.
3. `commerce-polish.spec.ts`, the TM-3 hero test on `/ar/capabilities`: the fleet plate's scan (a consequence of D6) is
   left out by name; every other running animation in the hero still fails the test.
4. `commerce-motion.spec.ts`, the filter's capture test (`528f53a`, after run 1): it reads after the transition's own
   `finished` instead of a fixed 900 ms; the same three facts are checked during and after the transition.

## 50. Screenshots and evidence

19 sheets for the brief's 18 items, from the Stage 1I build (sent with this report; `evidence.js`). Moving states are
filmstrips: for each frame a fresh page, the action, a wait, then every animation and transition held where it stands
and captured. Times are measured inside the page — from a replay of the run where the item has its own clock (the hero
loop and the signature are restarted with their `sig:replay` event, so the times are their own), from the transition's
start for the filter (its capture time is given), otherwise from the action.

| # | File | What it shows |
|---|---|---|
| 1 | `01-homepage-hero-loop.png` | the loop from cycle 1: 0.4 s rise and dimensions, 1.6 s holes, 2.8 s star traced, 4.0 s slot and perforations, 5.3 s finished and held, 9.6 s reset, 10.4 s cycle 2; the readout follows (00 → 04 → 05 → 07 → 00) |
| 2 | `02-homepage-scrolling.png` | the Services section revealed on the way down (60 / 250 / 450 / 900 ms): heading and cards rise 18 px and fade, the signatures begin |
| 3 | `03-service-signature.png` | the Laser Cutting signature from the start of its run, at 2×: 0.3 s the sheet appears, 1.5 s the parts drawn and the first pierce, 2.7–3.9 s the holes and the slot, 5.1 s the outer contour from its lead-in, 7.7 s finished, the head parked |
| 4 | `04-capabilities-machine-transition.png` | choosing the fourth machine: out (0–180 ms), in (from 80 ms), then the scan passing (0.7–1.3 s) |
| 5 | `05-projects-filter.png` | a filter choice, timed from the transition's start (capture 128–150 ms): the cards move and fade, the page itself is not captured; the chips' colours change live |
| 6 | `06-industries-preview.png` | a sector chosen by keyboard focus: the preview cross-fades, the line scales out from the row's start (0–700 ms) |
| 7 | `07-certificate-dialog.png` | the dialog opening (0–400 ms): opacity and 12 px |
| 8 / 8b | `08-clients-toggle.png`, `08b-clients-wall.png` | the switch pressed (knob 320 ms) and the logo wall taking its colour (600 ms) |
| 9 | `09-mobile-menu.png` | the phone menu sheet opening (390 × 844, 0–400 ms): the burger turns into the close mark, the sheet fades in |
| 10 | `10-project-detail-media.png` | the clock tower project at rest (full page) and its first screen held at DOMContentLoaded: the record and its lead photo already shown |
| 11 | `11-project-detail-text-only.png` | the stainless landmark (AR, dark) at rest and at DOMContentLoaded: the record shown; the shared closing panel fades in once the script runs |
| 12 | `12-en-desktop.png` | EN, light, 1440: first screens of six pages at rest |
| 13 | `13-ar-desktop.png` | AR, dark, 1440: the same six pages |
| 14 | `14-en-phone.png` | EN, light, 390: the same six pages |
| 15 | `15-ar-phone.png` | AR, dark, 390: the same six pages |
| 16 | `16-reduced-motion.png` | reduced motion: the hero's finished plate, the Laser Engraving plate finished, the console without scan or sketch, the Industries line at once (AR, dark) |
| 17 | `17-forced-colours.png` | forced colours: the homepage, the chosen machine (`Highlight` ring, underlined name), the clients switch pressed, a certificate card focused |
| 18 | `18-no-javascript.png` | without script: the homepage's finished plate, Capabilities at `#fiber-laser-6kw` as a list of panels, a project page (AR), Industries |

Not a judgement of visual quality: the evidence shows the behaviour for review.

## 51. Known limitations

1. **The Projects filter's capture frame.** Each choice makes the browser capture the moving cards once: one frame of
   67–133 ms in the software-compositing benchmark (the worst frame in item 34). Under a synthetic stress (a new choice
   every other frame) the filter runs at 26–28 fps on both builds. A real GPU composites this far faster; not measured
   here.
2. **The rest of the Projects page no longer fades during a filter change** (the consequence of item 8's frame-rate
   fix): content below the wall moves to its new place at once while the cards move. Visible only when the filtered wall
   is short enough to bring the index into view.
3. **`/ar/services/steel-structures` CLS 0.259** (both builds; the Arabic web fonts, not motion; item 36), and the other
   Arabic desktop pages' 0.002–0.039 from the same fonts — waiting for 1J's per-language font loading.
4. **The Theme Lab's A V2 shares the production pointer, hero plate and signature hook** (since TM-1), so its JavaScript
   carries the same corrections (item 42); its files, styles and pixels are unchanged and its own controller is
   untouched.
5. **The service drawings' one-time 1.8 s draw is not paused off screen** (it starts only when revealed, on screen).
6. **The rail rule (D10) only applies where a rail scrolls sideways**; on wider screens cards still reveal one by one, as
   before.
7. **The readout race (item 7) was reproducible only under load** (2 of 16 trials at 6× CPU throttling, 0 of 24 without).
   The fix is verified with the same throttled probe (0 of 32), not by a deterministic test: the suite's live
   reduced-motion test passes, but cannot force the race.
8. **Earlier TM-3 limitations stay as documented** (no-JS anchor landings with fonts that swap in after the first layout;
   About/services LCP in the section under the hero; the header below 320 CSS px; the OG images' faces).

## 52. Deferred Stage 1J items

- Per-language root layouts so the Arabic fonts can be preloaded on Arabic pages (fixes the Arabic CLS, including the
  Steel Structures page's 0.259, and the Arabic LCP/CLS noted since TM-3).
- OG share images regenerated with the Modern Commerce faces (`scripts/generate-og.mjs`).
- Publication: page statuses from `review` to `published`, the sitemap, indexing, `robots`.
- Theme Lab removal (and dropping `lab-icon` from `Icon`), once authorized.
- RAWASY's own Google Maps place link; the photo, image-rights and AI-watermark questions in `docs/ASSET_INVENTORY.md`.
- The dev-tooling audit finding (item 43), if a non-breaking upgrade appears.
- The dictionary keys only the retired shell read (usage audit).

## How to run

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e        # starts next start on :3400 (or reuses it); E2E_BASE_URL for another server
npx playwright test e2e/commerce-motion.spec.ts
```

To see the motion: the homepage (`/en`, `/ar`: hero loop, reveals, Services signatures, machinery showcase, clients
switch), `/en/services/laser-cutting` (signature, focus states), `/en/capabilities#fiber-laser-6kw` (the fleet plate's
scan waits until it is scrolled into view), `/en/projects` (the filter), `/en/industries` (the sector line),
`/en/certificates` (the dialog and the cards' lift). Reduced motion and forced colours can be switched while a page is
open (DevTools → Rendering → Emulate CSS media feature); another tab in front hides the page (everything rests).

## Next steps

- **Independent review** of Stage 1I.
- Left open by this stage's measurements: the layout shift from the Arabic web fonts (items 36, 51), which needs Stage
  1J's per-language font loading (item 52).
- **Not started**, waiting for the user's word: Stage 1J, publication, sitemap expansion, OG regeneration, the Theme
  Lab's removal and deployment.

---

Stopped after Stage 1I. Not begun: Stage 1J, publication, sitemap expansion, OG regeneration, Theme Lab removal,
deployment. Returned for independent review.
