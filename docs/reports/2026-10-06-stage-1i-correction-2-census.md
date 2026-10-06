# Stage 1I — Correction 2: census of motion that changes the opacity of text

Date: 2026-10-06 · Branch: `claude/new-session-5eijs6` · Base: `577b54f` (Stage 1I correction 1, approved) · Read-only:
written and measured on the base build before any system it lists beyond the homepage machinery was changed (brief §6).

## How the census was taken

- **Stylesheets.** Every rule in the production stylesheets (`commerce.css`, `system.css`, `services.css`, `projects.css`,
  `capabilities.css`, `project-detail.css`, `signature.css`) that transitions or animates `opacity` — directly, through
  `all`, or through keyframes that change it — listed by a parser over the source (comments stripped, `@media` / `@layer`
  nesting followed).
- **Scripts.** Every `animate()` call and view transition in `src/components/commerce` and the route group.
- **Pages.** Every element with `data-reveal` or `data-enter` on every page — the 51 prerendered pages and the 404, × EN/AR
  (1,230 elements) — classified by what it holds: visible text (aria-hidden text that is drawn counts as text), photos,
  drawings.
- **Held frames** on the base build (`577b54f`, served on port 3401), as in correction 1: each change made inside one page
  task (a reveal: by the page's own observer, caught in the same task), every animation it starts paused at exactly T ms,
  then axe-core 4.13.0 (WCAG 2.0–2.2 A/AA + best practice) on the frame, every visible text node's opacity through every
  ancestor, and each text's colour through that opacity against every background pixel under its glyphs (text and icons
  hidden, the frame otherwise unchanged), unrounded. EN/AR × light/dark at 1440 × 900 and 390 × 844, the reveals also at
  320 × 700.

## The census: production motion that changes the opacity of words

| # | System | Where it runs | Motion on the base build | Words it holds |
| --- | --- | --- | --- | --- |
| 1 | Homepage machinery panels (`.a2-mx-panel`) | Homepage `#machinery`, choosing a machine | The whole panel cross-fades: the leaving one out and the coming one in, 600 ms each (`--dur-3`) | Machine name (a link), capability, category badge, power and service tags, "Request a Quote" |
| 2 | Its specification row (`.a2-mx-spec`) | Same | Fades in and rises 8 px, 600 ms after 120 ms | The power and service tags |
| 3 | Scroll reveals, default (`[data-reveal]`) | 49 pages, as content comes into view | Opacity 0 → 1 and an 18 px rise, 700 ms, staggered per element (`--d`) | 380 elements per language hold words: headings, paragraphs, cards, steps, closing calls to action |
| 4 | Scroll reveals, "fade" (`[data-reveal="fade"]`) | Homepage, About, Clients and the service pages | Opacity 0 → 1, 700 ms, staggered | 108 elements per language hold words: section buttons, notes, timeline steps, tiles, captioned figures, the Clients page's names under the logos, the Steel Structures drawing's six axis letters (HTML, inside an `aria-hidden` drawing) |
| 5 | Homepage entrance (`[data-enter]`) | Homepage, on load | Each of the 8 items fades in and rises 18 px, 900 ms (`--dur-4`), delays 0–420 ms | Eyebrow, title, lead, both hero buttons, phone and WhatsApp, the four statements, the plate stage's figures and readout, the six-service strip |
| 6 | Services dropdown (`a2-pop`) | Desktop header (1280 px and up), opening | Fades in, drops 6 px and scales from 0.985, 320 ms (`--dur-2`) | The six services with their lines, "All services", the quote |
| 7 | Phone menu sheet (`a2-sheet`) | Header below 1280 px, opening | Fades in and drops 8 px, 320 ms | The pages, the Services row, language, theme, phone, the quote |
| 8 | Homepage project cards' label (`.a2-proj-cta`) | Homepage projects, hover or keyboard focus (fine pointer; always shown on touch) | Fades in and rises 6 px, 320 ms | "View in the gallery" / "عرض في معرض الأعمال" |
| — | Words inheriting opacity from another animated ancestor | — | None beyond 1–8 (correction 1's Capabilities console and certificate dialog are fixed and locked) | — |

Not in the list: the 61 text-bearing reveals per language inside the inner pages' heroes (shown with the first paint since
TM-3: they never fade), and the 58 reveals per language that hold no words (the service drawings and signatures, photo-only
figures, the homepage's and About's logo-only tiles, the homepage photo's clip reveal). Colour transitions are not opacity
motion; one that blends a text's colour into its own fill was found inside the homepage machine change during verification
(below).

### Excluded, as the brief directs (§6)

| Kind | What |
| --- | --- |
| Images | The client logos' colour cross-fade (`.logo-tile img`); the Industries preview's photo layers (`.in-preview-layer`: photos only; the caption outside them changes at once); the machine photos and floor shadows (homepage and Capabilities); photo-only figures and logo-only tiles among the reveals |
| Decorative SVG | The homepage hero plate (`.a2-plate` rise and its 10 s loop, including its dimension labels: SVG text in an `aria-hidden` drawing, and the loop is frozen by §5); the laser signatures (`LaserCut`, `LaserEngrave`); the service drawings (`.sv-draw`, `.sv-axis`, `.sv-row-sig`) |
| Pseudo-elements without words | Navigation underlines, the Industries line, card edges, the primary button's shine, the Capabilities scan lines and sketch glow |
| Backdrops | The certificate dialog's `::backdrop` |
| Ambient | The site-wide ambient (`a2-amb-*`) |
| Decorative glows and marks | The hero's hot points (`a2-node`), the custom pointer (`.a2-cursor`), the burger lines (`.a2-burger span`), the projects index arrows (`.pj-index-link .mc-icon`) |
| View-transition snapshots | The theme switch's page cross-fade (the browser's default 250 ms), the projects filter's re-flow (named cards; the page itself is not captured), the EN ⇄ AR page transition (`@view-transition`). Left as they are: by construction a cross-fade between the light and the dark page blends the two, so for a moment every colour is a mix of both themes; the brief excludes these snapshots and no defect beyond that was found, so this is noted for the user's decision rather than changed |

## Held frames on the base build (`577b54f`)

628 frames: each change paused at 0 ms and at early, 25, 50, 75 and 100 % points of its own duration, and settled, in
EN/AR × light/dark at 1440 × 900 and 390 × 844 (the reveals also at 320 × 700). A reveal's times count from its own turn
(its stagger delay); the entrance's from its start (its items staggered over 420 ms). "Below full opacity" is a word's
opacity through every ancestor; "below AA" is the per-pixel ratio, unrounded (4.5, or 3 for large text).

| System | Frames | Frames with words below full opacity | Words below full opacity | Frames with words below AA | Words below AA | Worst ratio | Times (ms) with words below AA | axe serious/critical: frames / nodes | Frames with any axe finding (rules) | Frames with two machines' words |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage machine change | 88 (80 part-way) | 56 | 928 | 48 | 625 | 1.000 | 80, 150, 160, 240, 300, 450 | 26 / 65 | 26 (color-contrast) | 48 |
| Scroll reveals | 384 (336 part-way) | 240 | 560 | 114 | 234 | 1.140 | 35, 70, 175 | 105 / 360 | 105 (color-contrast, target-size) | |
| Homepage entrance | 72 (64 part-way) | 48 | 520 | 32 | 184 | 1.152 | 70, 140, 210, 330 | 0 / 0 | 0 (—) | |
| Services dropdown | 28 (24 part-way) | 16 | 224 | 8 | 76 | 1.136 | 30, 80 | 2 / 2 | 2 (color-contrast) | |
| Phone menu sheet | 28 (24 part-way) | 16 | 336 | 8 | 103 | 1.136 | 30, 80 | 7 / 11 | 7 (color-contrast) | |
| Project card label | 28 (24 part-way) | 16 | 16 | 8 | 8 | 1.205 | 30, 80 | 0 / 0 | 0 (—) | |

| System · view | Frames | Frames with words below full opacity | Words below full opacity | Frames with words below AA | Words below AA | Worst ratio | Times (ms) with words below AA | axe serious/critical: frames / nodes | Frames with any axe finding (rules) | Two machines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage machine change · desktop | 44 (40 part-way) | 28 | 464 | 24 | 311 | 1.000 | 80, 150, 160, 240, 300, 450 | 12 / 31 | 12 (color-contrast) | 24 |
| Homepage machine change · phone | 44 (40 part-way) | 28 | 464 | 24 | 314 | 1.000 | 80, 150, 160, 240, 300, 450 | 14 / 34 | 14 (color-contrast) | 24 |
| Scroll reveals · desktop | 128 (112 part-way) | 80 | 160 | 38 | 70 | 1.368 | 35, 70, 175 | 37 / 170 | 37 (color-contrast) | |
| Scroll reveals · phone | 128 (112 part-way) | 80 | 200 | 38 | 82 | 1.140 | 35, 70, 175 | 36 / 88 | 36 (color-contrast, target-size) | |
| Scroll reveals · small | 128 (112 part-way) | 80 | 200 | 38 | 82 | 1.143 | 35, 70, 175 | 32 / 102 | 32 (color-contrast, target-size) | |
| Homepage entrance · desktop | 36 (32 part-way) | 24 | 336 | 16 | 126 | 1.152 | 70, 140, 210, 330 | 0 / 0 | 0 (—) | |
| Homepage entrance · phone | 36 (32 part-way) | 24 | 184 | 16 | 58 | 1.345 | 70, 140, 210, 330 | 0 / 0 | 0 (—) | |
| Services dropdown · desktop | 28 (24 part-way) | 16 | 224 | 8 | 76 | 1.136 | 30, 80 | 2 / 2 | 2 (color-contrast) | |
| Phone menu sheet · phone | 28 (24 part-way) | 16 | 336 | 8 | 103 | 1.136 | 30, 80 | 7 / 11 | 7 (color-contrast) | |
| Project card label · desktop | 28 (24 part-way) | 16 | 16 | 8 | 8 | 1.205 | 30, 80 | 0 / 0 | 0 (—) | |

Every system holds words below AA part-way through, at 25 % of its run included (the machinery from 80 to 450 ms); axe
found none of the entrance's or the project label's failures and only some of the others — the per-pixel check is the
stricter one, as in correction 1. axe's `target-size` findings in the reveal rows are the homepage's capability strip
partly under the sticky header at that scroll position on phones: the same in every frame of those views, settled
included (a scroll-position finding, not motion).

## Decision (brief §7)

All eight rows fail, so all are fixed — CSS only, the motion kept, words never faded:

| # | System | Fix |
| --- | --- | --- |
| 1–2 | Homepage machinery | Panels shown or hidden whole (`visibility`, `z-index`); the photos and their floor shadow cross-fade (out 180 ms, in 600 ms after 80 ms); the specification row only rises |
| 3–4 | Scroll reveals | Words show whole at their turn and rise (a "fade" one simply appears); what holds no words — drawings, photos without a caption, logo-only tiles — still fades in |
| 5 | Homepage entrance | The items rise at full strength from the first paint |
| 6–7 | Dropdown and phone sheet | They open whole and settle into place (transform only) |
| 8 | Project card label | Shown at once on hover or focus, rising 6 px |

Found while verifying the machinery fix (axe, in its held frames on dark phones): the machine selector's power badge
blends its figure's colour into its own fill over 320 ms (1.33:1 at 80 ms). It is a colour transition, not opacity, but
it sits inside the machine change this correction covers, so it is fixed with it (the colours swap at once). Two more
colour transitions of the same kind were measured outside the census and are reported, not changed (the brief's census is
about opacity): the Projects filter chip pressed (its label 1.74:1 light / 1.65:1 dark at 25 % of 180 ms) and the
certificate plate's open label on hover (2.14:1 at 50 %, light) — from the held frame's computed colours.
