# Stage TM-3 — shared polish of the Modern Commerce design (report)

Date: 2026-10-02 · Branch: `claude/new-session-5eijs6` · Status: **built and returned for the user's independent
review**. Nothing was deployed. Stage 1E, 1F, 1I and 1J, the theme lab's removal, the OG images and the dictionary clean-up
were not started.

## Summary

The five deferred shared items were worked through, CSS only:

1. **The colour switch** draws its track, dot and pressed fill in system colours in forced colours on the homepage too
   (the Clients page's drawing, now on every switch): off, on and focus are told apart.
2. **The inner pages' hero** (the kit's `PageHero` and the service pages' hero) shows with the first paint. Its title,
   text, photos and cards no longer wait for the script; its line drawings and the laser signatures still draw in. LCP on
   the hero-led pages fell from about 1.0–1.45 s to 0.14–0.44 s locally (0.4–0.8 s from 1.6–2.9 s on a 4× slower phone
   CPU), five runs per page and build.
3. **The footer wordmark** takes the forced text colour in forced colours (it was white on a white forced page). The
   header's logo had the same weakness when the site's stored theme differs from the forced palette, and the header's
   current page, language and theme marks vanished in forced colours (§9 and §18 ask for them to stay visible). The same
   forced-colours-only rules now cover them.
4. **The phone menu sheet**'s pages scroll inside the sheet, above the quote bar, so nothing passes under it. axe's
   target-size rule passes with the Services list open: 24 serious findings on TM-2.6, 0 on TM-3. A row reached with the
   keyboard comes into full view. On TM-2.6 the focused Projects row sat entirely behind the quote bar at 390 px.
5. **The no-JS late-font residual** was re-measured (unchanged: 10 of 162 landings on TM-3, 11 of 162 on TM-2.6, always the two
   legal pages at 1440) and traced. Two standards-based CSS fixes were tried; both were rejected for regressions, and the
   residual stays documented.

Served HTML, page data and JavaScript are byte-identical to TM-2.6. Normal-colour captures of every frozen page are
pixel-identical. Lint, typecheck and build are clean (125 static pages, 0 warnings), `npm ci` installs cleanly, and the
full browser suite passes **406 of 406** (none failed, flaky or skipped).

---

## 1. `preserve/pre-tm3` SHA

`de62bc5cf0ad291fc90fffce0a3b81e762f1ba9b`, created and pushed at the start (it did not exist; no force push).
`preserve/pre-tm2.6` is still at `9c7d2af98ea1a8d10c383143862c5639713511e4`.

## 2. Starting SHA

`de62bc5cf0ad291fc90fffce0a3b81e762f1ba9b`. Verified at the start: fetched, clean tree, local = remote, the TM-2.6
implementation (`6f93a77`) and report (`de62bc5`) commits present, no unreviewed drift.

## 3. Implementation SHA

`f7499ccd184ce8f00914b09bfbaadd4379b74985` ("Shared polish of the Modern Commerce design: forced-colours switch,
logo and header marks, hero shown with the first paint, phone menu scroll area (TM-3)"), directly on `de62bc5`.

## 4. Branch HEAD

The commit that adds this report and the CLAUDE.md update, directly on top of the implementation commit; its SHA is given
in the chat summary.

## 5. Files changed

| File | Change |
| --- | --- |
| `src/app/(commerce)/commerce.css` | +9: the hero rule after the reveal rules |
| `src/components/commerce/system.css` | +49 / −10: the sheet's scroll area; the forced-colours switch rules from `.cl-toggle` to every `.a2-toggle`; an unlayered forced-colours block (logo, header marks) |
| `src/components/commerce/inner/PageHero.tsx`, `services/ServiceHero.tsx` | doc comments only (no output change) |
| `e2e/commerce-polish.spec.ts` | new: 29 tests |
| `README.md` | the two lines that became stale (latest report, test list) |
| `CLAUDE.md`, this report | documentation |

No component markup, script, content, route or dependency changed.

## 6. Toggle forced-colours fix

The Clients page's TM-2.3 forced-colours rules were keyed on `.cl-toggle`. They now key on `.a2-toggle`, which both
switches carry:

- **Off:** the track is `Canvas` with a 1 px `ButtonText` border, and the dot is `ButtonText` at the start.
- **On:** the track and its border are `Highlight`, and the dot is `HighlightText` at the end (it still moves with
  `--dir`, so it is mirrored in Arabic).
- **Focus:** the page's 2 px outline ring, which forced colours keep.

`aria-pressed`, the script, the wall's `data-colour` and normal-colour pixels are unchanged (tests: normal knob has no
border and a white dot). Measured on TM-2.6 in forced light and dark, off and on were drawn identically (no border, dot in
the track's colour).

## 7. PageHero architecture change

The hero sits in the first view, so its reveal could only delay the first meaningful paint. One rule after the reveal
rules in `commerce.css`:

```css
.js .ip-hero [data-reveal]:not(.sv-draw):not(.sv-axis):not(.sv-bubble):not(.sv-cut-sheet):not(.sv-plate-stage) {
  opacity: 1;
  transform: none;
}
```

- Every `[data-reveal]` inside `.ip-hero` (the kit's `PageHero` and `ServiceHero`, which shares the class) is shown from
  the first paint: the text block, About's photo and name plate, the Projects collage, the services tiles, Contact's
  direct card, the Industries strip, the service photos and the workbench plate.
- The line drawings (`sv-draw`, the axis grid) and the two laser signatures' stages keep their reveal, so they still draw
  in once the script runs (optional decorative motion).
- Markup unchanged: the elements keep their attributes, so the served HTML stayed byte-identical. Motion's observer still
  marks them; nothing changes when it does.
- Final state identical to the revealed state (opacity 1, no transform).
- No-JS was already complete; reduced motion was already static; anchors are untouched (opacity and transform only);
  no hydration change (no script or markup change).
- The build merges this rule with `.js [data-reveal][data-shown]` (same declarations). It is written as chained `:not()`,
  not a `:not()` list, so an older browser that cannot read a list cannot drop the merged rule.
- Proof: with the page's scripts blocked (boot script run, reveals armed), every hero on 17 pages × 2 languages is shown
  while reveals outside the hero stay at opacity 0 (`commerce-polish.spec.ts`). With the script, the title's effective
  opacity is 1 in every frame from the first paint (sampled per frame on 5 pages).

## 8. LCP before/after

Fresh browser context per load, local server, both builds alternated, **5 runs each**. Values are medians (range), in ms.
Desktop is 1440 × 900; phone is 390 × 844.

| Page | Desktop TM-2.6 | Desktop TM-3 | Phone TM-2.6 | Phone TM-3 | LCP element |
| --- | --- | --- | --- | --- | --- |
| `/en/about` | 1252 (1204–1308) | 1268 (1252–1316) | 1188 (1164–1236) | **220** (212–260) | desktop: the lead under the hero; phone: hero photo |
| `/ar/about` | 1448 (1416–1472) | **440** (404–556) | 1316 (1292–1372) | **332** (304–400) | hero photo |
| `/en/contact` | 1160 (1096–1208) | **268** (240–272) | 1020 (996–1064) | **188** (172–276) | title / lead |
| `/en/projects` | 1328 (1296–1340) | **332** (296–364) | 1068 (1048–1092) | **224** (216–276) | hero print / lead |
| `/en/services/laser-cutting` | 1172 (1116–1224) | **292** (284–312) | 1040 (1024–1068) | **232** (220–240) | hero photo / lead |
| `/en/capabilities` | 1028 (1024–1032) | **208** (180–228) | 908 (904–920) | **140** (136–164) | title / lead |
| `/ar/contact` | 1232 | **324** | 1144 | **252** | lead |
| `/en/projects/geometric-lanterns` | 1052 | **224** | 948 | **140** | lead |
| `/en/clients` | 1120 | **280** | 984 | **144** | lead |
| `/ar/privacy` | 320 | 332 | 216 | 228 | a body paragraph (never revealed) |
| `/en/services` | 1112 | 1132 | 1004 | **172** | desktop: first service row's photo under the hero |

Title first seen (counted from the first paint at the earliest) / fully shown, desktop, TM-2.6 → TM-3:

| Page | Title first seen | Title fully shown |
| --- | --- | --- |
| About | 456 → 320 | 906 → 320 |
| `/ar/about` | 605 → 440 | 1055 → 440 |
| Contact | 439 → 268 | 889 → 268 |
| Projects | 457 → 332 | 907 → 332 |
| Laser Cutting | 460 → 292 | 910 → 292 |
| Capabilities | 315 → 208 | 765 → 208 |

On TM-3 the title is fully shown at the first contentful paint on every page.

Phone with a 4× slower CPU, 5 runs, TM-2.6 → TM-3:

| Page | LCP (ms) | Title fully shown (ms) |
| --- | --- | --- |
| About | 2528 → 492 | 2147 → 472 |
| `/ar/about` | 2904 → 824 | 2517 → 496 |
| Contact | 2276 → 416 | 2006 → 416 |
| Projects | 2612 → 456 | 2342 → 456 |
| Laser Cutting | 2428 → 368 | 2154 → 368 |
| Capabilities | 1612 → 396 | 1347 → 396 |

Where LCP did not improve, the largest element is outside the hero, in the section under it, which keeps its reveal:
About and the services overview on desktop. TM-2.6's LCP there was set by that section, and TM-3 leaves it as is (out of
the PageHero scope). FCP moved by −20 to +40 ms, within the runs' spread; on TM-3 the first paint now carries the hero.

Transferred bytes: +0.1–0.2 KB per page (the stylesheet). Requests are unchanged, and JS is unchanged (byte-identical
chunks, e.g. 144.6 KB transferred on About).

## 9. CLS before/after

Maximum of the 5 runs (every run gave the same value):

| Page | Desktop TM-2.6 | Desktop TM-3 | Phone TM-2.6 | Phone TM-3 |
| --- | --- | --- | --- | --- |
| Every English page measured, and every phone measurement | 0 | 0 | 0 | 0 |
| `/ar/about` desktop | 0.0003 | 0.0075 | 0 | 0 |
| `/ar/contact` desktop | 0.0004 | 0.0028 | 0 | 0 |
| `/ar/privacy` desktop | 0.0049 | 0.0085 | 0 | 0 |

The hero adds no layout change of its own: only opacity changes, and transforms do not count. The three Arabic desktop
increases come from the Arabic web fonts, which are deliberately not preloaded because one root layout serves both
languages. They swap in after the first paint, and now move hero text that is already visible; on TM-2.6 that text was
still transparent when they arrived. All values are far below the 0.1 "good" threshold. This is reported, not hidden.

## 10. Footer forced-colours fix

Chromium keeps an inline SVG's own colour in forced colours (its UA style gives `svg`
`forced-color-adjust: preserve-parent-color`). The footer logo's `text-white` therefore stayed white on a white forced
page: only the orange piece showed (evidence 5). Measured on TM-2.6:

- footer logo: invisible in forced light, in both themes;
- header logo: invisible whenever the stored site theme and the forced palette disagree (dark ink on black, or light ink
  on white).

Fix, outside the components layer so the logo's own utility cannot win:
`@media (forced-colors: active) { .mc :is(.a2-header, .a2-footer) svg[role="img"] { color: CanvasText } }`.
The lockup's charcoal parts follow the forced palette, and the orange piece keeps its colour. No background image is
involved. Links are unchanged (forced link colour), focus rings are unchanged (visible on 12 of 12 stops per page), and
normal-colour pixels are identical.

The same block, as part of §9 and §18 ("current-page state remains visible"), adds:

- **Current page and section** in the header and the phone sheet (`.a2-nav .nav-link`, `.a2-sheet-row`, `.a2-dd-item`
  with `aria-current`): underlined (2 px). Before, a tint, a bar or a colour marked them, all of which forced colours
  remove; the phone sheet's current row was indistinguishable.
- **Current language and pressed theme**: `Highlight` / `HighlightText`, as the projects' pressed chips already do. Before,
  a raised tile marked them, which disappeared.

## 11. Mobile-menu architecture fix

Before: the whole sheet scrolled, with the quote bar `position: sticky` at its bottom. Whatever lay at the sheet's bottom
edge passed behind the translucent bar:

- Call and WhatsApp at 390 px with Services closed;
- the Capabilities and Projects rows with Services open;
- language and theme at 320–360 px.

Now: `.mc .a2-sheet > nav { min-height: 0; overflow-y: auto; overscroll-behavior: contain }`.

- The nav (already `flex-1` in the sheet's column) is the scroll area. The bar sits below it and never overlaps it. The
  sheet itself no longer scrolls.
- The page behind stays locked (`html:has(… [data-menu][open]) { overflow: hidden }`, unchanged). Escape, focus return
  and the close on Tab-out are unchanged (Motion untouched).
- Targets keep their sizes: rows 56 px, service items ≥ 44 px, language and theme 44 px, "All services" 40 px.
- With Services closed and the content fitting (tablet), pixels are unchanged; the closed menu is unchanged everywhere.

## 12. Target-size result

- **axe-core** (WCAG 2.0/2.1/2.2 A + AA, best practice), the same 132-run matrix on both builds, including the menu at
  390 px with Services closed and open and its scroll area at the top, middle and end:
  - TM-2.6: `target-size` (serious) in 24 runs, the Projects row "partially obscured (smallest space 358 × 14.3 px)";
  - TM-3: **0 violations**, also with the ambient's worst-case colour painted in.
- **Geometry**, at 390 / 360 / 320 × EN / AR × Services closed / open, 640 × 360 (a 1280 × 720 window at 200 %), 1024 × 768
  and 834 × 1112:
  - the scroll area ends exactly at the bar, and the bar at the sheet's end;
  - no target's visible part reaches the bar;
  - Tab reaches 15 stops (22 with Services open), each fully in view with a ring;
  - the smallest target is 40 px; no sideways scroll.
- **Focus not obscured:** on TM-2.6 the Projects row reached with the keyboard was 56 of 56 px behind the quote bar
  (390 px, EN and AR), which fails WCAG 2.4.11. On TM-3 it comes into full view (evidence 7 and 9).

## 13. No-JS anchor re-measurement

Same matrix as TM-2.6, extended with Contact `#location` in Arabic, a Projects slug in each language and `#gallery`:

- 9 addresses × 1440 / 390 × fonts held back 0 / 300 / 1500 ms, fresh context, no JavaScript;
- **3 runs** per cell on both builds;
- the probe now counts each target's own `scroll-margin-top` (the Projects bar's 56 px).

| Build | Landings | Off by more than 1 px |
| --- | --- | --- |
| TM-2.6 | 162 | 11 |
| TM-3 | 162 | 10 |

Always `/en/privacy#contact` (107 px) and `/ar/terms#contact` (95 px) at 1440; every other cell is exact. Unchanged by
TM-3.

**Why, from a trace:**

- Without script, `load` can fire before the first layout (about 90 ms, nothing blocks it).
- The jump happens at that first layout.
- The web fonts the layout requests arrive 60–100 ms later and shorten the text above the target.
- Chromium's scroll anchoring then keeps a node above the target (the text under the header, inside the scroll padding),
  so the target moves.

**Two standards-based CSS fixes were tried** (injected into the stylesheet). Both held the landing in 3 of 3 traces, and
both were rejected:

1. Root scroll snapping to `:target` (`scroll-snap-type: y proximity` on `html:not(.js):has(:target)`): proximity snapping
   would also pull a reader back to the section whenever they stop scrolling near it.
2. Excluding the content before the target from anchoring (`overflow-anchor: none` on
   `:is(:has(~ :target), :has(~ * :target))`): a `:has()` sibling search on every element of every page, for every visitor.
   It added 2.6–4.1 ms (+8–11 %) to each full style recalculation of the homepage in three rounds; other pages −4 % to
   +20 %, noisy.

No timer or scroll script was added. The residual stays documented, as the brief directs.

## 14. Scripted anchor regression

The same 9 addresses × 2 widths × 3 font delays with JavaScript, sampled 4 times per load (at load, after
`document.fonts.ready`, two frames later and 700 ms later): **54 of 54 exact on both builds**. `commerce-anchors.spec.ts` and
the projects landing tests are green (item 36).

## 15. EN/AR

Every TM-3 check runs in both languages:

- the switch in forced light and dark;
- the logo on EN and AR pages;
- the menu at four sizes;
- the hero on 17 pages × 2 languages, and frame by frame on EN and AR pages;
- axe, the forced-colours matrix and the responsive matrix.

No copy changed. Arabic stays unspaced (the `:lang(ar)` rule is untouched).

## 16. RTL

- The switch's dot moves inline-end in Arabic (the existing `--dir` translate), and the forced-colours rules use logical
  properties (`inset-inline-start`).
- The menu sheet keeps the reading order (Tab order verified in Arabic: 22 stops) and the bar sits below the scroll area
  the same way.
- The current-row underline follows the text.
- Evidence 9 shows the Arabic menu.

## 17. Light/dark

- Normal-colour captures in light and dark: 0 differing pixels (item 31).
- Forced colours tested with light and dark forced palettes, and with the site's stored theme agreeing and disagreeing
  with the palette (4 pairings, logo test).
- The theme switch's pressed state is filled in forced colours.

## 18. Forced colours

Chromium's emulation (`forced-colors: active`; the palette follows `prefers-color-scheme`: black on white, or white and
yellow on black). It approximates Windows contrast themes but is not Windows: custom palettes such as Desert or Aquatic
and Windows' own system-colour mapping were not available here.

Matrix: homepage, Clients, About, Projects, Contact, Capabilities and the localized 404 × forced light / dark × TM-2.6 / TM-3,
plus the phone menu.

| Check | TM-2.6 | TM-3 |
| --- | --- | --- |
| Colour switch | off and on identical | off outlined, on filled `Highlight`, focus ring |
| Footer wordmark | invisible in forced light | `CanvasText` |
| Header logo | invisible when the stored theme disagrees | `CanvasText` |
| Focus rings | 12 / 12 stops per page | 12 / 12 |
| Buttons | 1 px system borders | unchanged |
| Current navigation (desktop) | weight 600 only (bar and tint gone) | underlined + weight 600 |
| Current row (phone sheet) | indistinguishable | underlined |
| Current language, pressed theme | indistinguishable | `Highlight` fill |
| Project filter, pressed chip | `Highlight` (TM-2.5 rule) | unchanged |
| Pending note (Capabilities) | 4 px `CanvasText` edge | unchanged |

## 19. Responsive matrix

1440 × 900, 1024 × 768, 834 × 1112, 390 × 844, 360 × 780 and 320 × 700, EN and AR. Pages: home, About, Contact, Projects,
Clients, Laser Cutting, Capabilities, a project page and Privacy (108 cells). Each cell checked:

- sideways scroll;
- one h1, fully shown;
- every hero part inside the screen;
- the footer logo;
- the switch's row;
- with the burger shown, the sheet's geometry and the page lock.

Result: 107 cells clean. One finding, **pre-existing and identical on TM-2.6**: the homepage at 320 × 700 in English scrolls
8 px sideways, because the Industries cards' English text runs past the 130 px cards (to 328 px). The homepage is frozen
and this is not one of the five items, so it is left for your decision (item 38).

200 % zoom:

- as a 1280 × 720 window's CSS viewport (640 × 360): the menu works fully (item 12);
- a phone at 200 % page zoom (195 CSS px, below the 320 px reflow width) and doubled text on phones: the header itself
  overflows on both builds (pre-existing, unchanged).

## 20. Keyboard

- **The switch:** reached with Tab, a visible ring; Space and Enter switch it (tested in forced colours too).
- **The phone sheet:** opens with Enter on the burger.
- **Tab order** (390, Services open): Home, About, Services, the six services, All services, Capabilities, Projects,
  Industries, Clients, Contact, EN, عربي, Light, Dark, Call, WhatsApp, Get a Quote. Every stop is in full view with a
  2 px ring.
- **Leaving the sheet:** Tab past the last stop closes it; Escape closes it and returns focus to the burger (unchanged).
- **Focus rings:** visible on every stop in normal and forced colours.

## 21. Accessibility / axe

- axe-core: 132 runs per pass on TM-3 (11 pages × EN/AR × light/dark × 1440/390, plus the phone menu at 3 scroll
  positions × Services closed/open on two pages), as loaded and with the ambient's worst-case colour: **0 violations**.
  TM-2.6, same matrix: 24 serious `target-size` (item 12). No serious or critical finding remains, and no target-size
  finding.
- Manual:
  - one h1 on every page;
  - focus and keyboard (item 20);
  - 200 % zoom and 320 reflow (item 19, one pre-existing homepage finding);
  - forced colours (item 18);
  - reduced motion: static; the hero has no transition;
  - no-JS: complete (unchanged).
- AA contrast: no colour changed in normal colours. In forced colours the system palette applies; `Highlight` /
  `HighlightText` and `CanvasText` on `Canvas` are the palette's own pairs.

## 22. Performance

Scroll frame rate, 1440, software compositing (top to bottom in 5 s, fresh browser per run, builds alternated):

| Page | TM-2.6 | TM-3 |
| --- | --- | --- |
| Homepage (3 runs + 4 runs) | 53.3 / 50.9 | 52.7 / 50.9 |
| About | 60.0 | 59.9 |
| Projects | 59.9 | 60.0 |
| Laser Cutting | 60.0 | 59.3 (one run 57.8) |
| Contact | 60.0 | 59.9 |

- Equal within run-to-run noise. The homepage's absolute figure followed the machine's load in this session on both builds
  (the TM-2.6 report read 54.1 / 54.0).
- No new layer, canvas, WebGL, animated filter or blur. The hero override removes transitions rather than adding them; the
  forced-colours rules apply only in forced colours; the sheet rule applies only while the menu is open.
- JS is byte-identical. CSS is +560 bytes (130,220 → 130,780, still one file on every page).

## 23. Homepage regression

- Markup and page data identical to TM-2.6 (only the build id and the stylesheet's hashed name differ).
- JS chunks identical; CSS changes only in forced colours and the open menu.
- Captures pixel-identical: EN light 1440, AR dark 1440, EN dark 390 × 15 screens, AR light 390 × 14.
- The hero plate's loop, signatures, ambient, pointer, header and footer: `commerce-home.spec.ts` green.
- Normal colours unchanged by test (switch, logo, header marks).

## 24. Service / signature regression

- `LaserCut`, `LaserEngrave`, `useSignature`, `signature.css`, `HeroPlate`, `plate-geometry`, `nesting-sheet` and
  `engraved-plate` are untouched (byte-identical JS and CSS).
- The homepage signatures paused at 0.3 / 1.2 / 2.6 / 4.2 s and finished, EN and AR: 0 px on two reruns (first pass 67 and
  116 px, within the known capture noise).
- The Laser Cutting and Laser Engraving hero signatures at the same moments: 0 px.
- Their stages still reveal and play after load.
- `commerce-services.spec.ts` green.

## 25. Projects / D4 regression

- The 27 anchors, filter state, `#gallery`, About's and the service pages' exact anchors, the homepage's `#gallery` links,
  the one-row bar, the masonry and the planned project pages: markup identical; `commerce-projects.spec.ts` green.
- Cold scripted anchors exact (item 14).
- Captures identical. In the first pass, the TM-2.6 server process had three image-optimizer requests stuck (they timed out
  after 15 s by `curl` while TM-3 answered in 3 ms). After restarting that server the Projects captures were byte-identical
  (26 of 26).

## 26. Contact golden regression

Markup, page data and JS are identical. `commerce-contact.spec.ts` is green: validation, the email / WhatsApp / copied-text
golden outputs, clipboard, files, the no-JS `mailto:` submission, the map and `FramePointer`. Captures are identical. The
hero's direct-contact card now shows with the first paint (item 7).

## 27. Certificate safety

The eight certificate files are untouched; `commerce-certificates.spec.ts` checks their hashes and the digit-run guard
(green). Dialog and pointer behaviour are unchanged. Captures are identical (EN light 1440, AR dark 390).

## 28. Planned-page safety

Capabilities and the 68 project pages are `planned` / `noindex, follow`, text only (markup identical).
`commerce-planned.spec.ts` checks every project page and its page data for project media: none, including
`stainless-landmark-sculpture` and `billboard-support-structure` (green; evidence 19). Their hero now shows with the
first paint.

## 29. Global-404 isolation

- `_not-found.html` is identical. Its own stylesheet (`3dct6ciy1leb8.css`, 17,070 bytes) is byte-identical, and it loads
  no site stylesheet, so none of the TM-3 rules reach it.
- Font preloads on every page are unchanged (markup identical).
- Theme lab: unaffected (item 30). `site.spec.ts`'s fallback-404 tests are green.
- Noted, not changed (the page is frozen and no address reaches it): its logo follows the site's theme ink, so in forced
  colours it shares the header's former edge case (item 38).

## 30. Theme Lab regression

- All 16 lab pages build.
- Markup and page data identical; the lab's four stylesheets byte-identical (it never loads the site sheet).
- Captures identical: A V2 EN light, AR dark and the system sheet (first-pass 41 px from the lab header's "past hero"
  shadow, a known capture flip; 0 px on two reruns).
- `theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` green. Still `noindex`.

## 31. Normal-colour pixel comparisons

TM-2.6 vs TM-3, motion frozen (reduced motion, every reveal shown, images decoded), 40 views. Full pages at 1440; screen by
screen at 390.

Pages: home, Privacy, Terms, the localized 404 (two addresses), Contact, About, Industries, Clients, Certificates, the
services overview, Laser Cutting, Laser Engraving, Projects, an unknown service, Capabilities, two project pages, an
unknown project and Theme Lab A V2 (and its system sheet). Plus the signature moments: 394 captures in all.

**Result: 0 differing pixels** after the reruns described in items 24, 25 and 30. The settled hero is identical, as
required. Normal colours differ only in the open phone menu (item 11), as intended.

## 32. `npm ci`

Exit 0: 374 packages added, 0 vulnerabilities (the existing deprecation notice for eslint 9.39.5). `package.json` and the
lockfile are unchanged.

## 33. Lint

`npm run lint`: 0 errors, 0 warnings.

## 34. Typecheck

`npm run typecheck`: 0 errors.

## 35. Build

`npm run build`: 0 warnings, 0 errors; 125 static pages (unchanged). The build after `npm ci` is byte-identical to the
one the QA ran on (1,058 of 1,058 server files, all 12 stylesheets, all 24 script chunks).

## 36. E2E

`npm run test:e2e` on the final build: **406 passed, 0 failed, 0 flaky, 0 skipped** (12.1 min, exit 0). TM-2.6 had 377; the new `commerce-polish.spec.ts` adds 29.

- 24 of its tests fail on the TM-2.6 build, and the 5 "normal colours unchanged" guards pass on both builds, so the new
  tests fail without the fixes.
- Every existing assertion is kept; no test was removed.

## 37. Screenshots

Sent with this report (each at most 2400 px):

1. Homepage switch, normal colours (light / dark, off / on)
2. Switch, forced colours, off
3. Switch, forced colours, on and on + focus
4. Footer wordmark, normal
5. Footer wordmark, forced colours
6. Phone menu 390, Services closed
7. Phone menu 390, Services open, then Projects reached with the keyboard
8. Phone menu 320, Services open
9. Arabic phone menu 390, Services open
10. About hero before its script runs and settled
11. Contact hero before its script runs and settled
12. Projects hero before its script runs and settled
13. Capabilities hero before its script runs and settled
14. Regression sheet: homepage
15. Regression sheet: signatures (homepage and service heroes)
16. Regression sheet: Projects
17. Regression sheet: Contact
18. Regression sheet: Certificates
19. Regression sheet: planned project pages
20. Regression sheet: Theme Lab

Images 1–13 show TM-2.6 beside TM-3. Images 14–20 show TM-2.6 beside TM-3 in normal colours, all pixel-identical.

## 38. Remaining deferred items

Not changed in TM-3, for your decision:

1. **The no-JS late-font residual** (item 13): documented; both standards-based fixes found regress the site.
2. **About and the services overview, desktop LCP ~1.1–1.3 s**: the largest paint is in the first section under the hero,
   which keeps its reveal. Showing that first section with the first paint as well would fix it; it is outside PageHero.
3. **Arabic desktop CLS 0.0028–0.0085** (item 9): the Arabic web fonts swapping in while the hero is visible. Fixing it
   needs those fonts preloaded on Arabic pages, which needs a root layout per language (planned for 1J).
4. **Homepage, 320 px, English**: the Industries cards' text overflows them, giving 8 px of sideways scroll. Pre-existing,
   frozen homepage.
5. **Below 320 CSS px** (a phone at 200 % page zoom) and doubled text on phones: the header overflows. Pre-existing, under
   the 320 px reflow width.
6. **The fallback 404's logo in forced colours** follows the site's theme ink, so it is invisible only when the stored
   theme and the forced palette disagree (no address reaches this page today). The fix is one line in
   `global-not-found.css`, left as is because the page is frozen.
7. **Dictionary keys** only the retired shell read: kept until a usage audit (brief §24).

## 39. Stage 1J OG task reminder

`scripts/generate-og.mjs` still renders the committed OG share images with the previous design's faces. They were not
modified or regenerated in TM-3. This is a Stage 1J / SEO-release task: update the generator to the Modern Commerce faces
and run `npm run assets:og` then, so the share cards change once, with the launch.

---

## How to run

```bash
npm ci
npm run lint && npm run typecheck
npm run build && npm run test:e2e
npx next start -p 3400   # then /en, /ar, a phone width with the menu open, forced colours in DevTools
```

## Next steps

Return TM-3 for independent review. Not started, by instruction: Stage 1E, Stage 1F, Stage 1I, Stage 1J, the theme lab's
removal and deployment.
