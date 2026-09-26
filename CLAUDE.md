@AGENTS.md

# RAWASY Metal Website — project memory

## How the user wants reports

- When a task or stage is finished, send a **complete report inside one copyable code block**. Use a
  four-backtick markdown fence (````markdown) so it copies cleanly in one go.
- Cover: summary and status, what was delivered, QA actually run and its results (say plainly if
  something failed or was skipped), items needing RAWASY's confirmation, known limitations, how to
  run, and next steps.
- Also save the report as `docs/reports/YYYY-MM-DD-<topic>.md`, then commit and push it with the work.
- Latest report: `docs/reports/2026-09-26-a-v2-refinement-pass-2.md` (earlier:
  `2026-09-25-a-v2-signature-correction.md`, `2026-09-25-modern-commerce-a-v2.md`, `2026-09-25-modern-commerce-theme-lab.md`, `2026-09-25-stage-1D-service-pages.md`, `2026-09-25-visual-redesign-v2.md`,
  `2026-09-24-stage-1C-V-visual-enhancement.md`,
  `2026-09-24-stage-1C-core-inner-pages.md`,
  `2026-09-24-stage-1B-typography-correction.md`, `2026-09-24-phase-1-stages-1A-1B.md`).
- The user's stage briefs list numbered report items; answer every one of them, in order.

## Where the project stands

- Phase 1 is the public website only. Work is pushed on `claude/new-session-5eijs6`.
- **Stages 1A (foundation) and 1B (homepage) are approved.** Stage 1C (core inner pages: about,
  services overview, industries, clients, certificates, contact / quote, privacy, terms) is built
  (commit `74bf5c3`). The user found it too flat; Stage 1C-V (commit `ed4a622`) followed and was
  **not approved**. The **Visual Redesign V2** correction pass followed (report
  `2026-09-25-visual-redesign-v2.md`): new palette, borders, shadows, cards, Sora/Manrope, the
  Projects overview brought forward from 1F, a rebuilt About page, an expanded homepage intro, an
  unnumbered clients wall and a contact map. **The user approved V2 with conditions** (in the 1D
  brief): keep the V2 visual system, leave the contact map as it is, and keep the open items (RAWASY's
  Google Maps place link, image rights, the two moderate shell accessibility findings for 1I/1J).
- **Stage 1D (the six service detail pages) is built and awaits the user's visual approval** (report
  `2026-09-25-stage-1D-service-pages.md`). Never self-approve a stage. Do not start 1E (Capabilities &
  Machinery), 1F (project detail pages), 1G or later until the user says so; project detail pages
  and Capabilities stay `planned`. Do not start Phase 2 (admin panel) during Phase 1.
- **Development is stopped for a theme exploration** (the user's "STOP FURTHER DEVELOPMENT — MODERN
  COMMERCE THEME EXPLORATION ONLY" brief). The user finds the current direction too much like
  architecture / engineering editorial; the target is modern commerce × premium industrial B2B ×
  manufacturing (a company selling capabilities, not ecommerce). The theme lab holds three isolated
  homepage previews with design-system sheets (report `2026-09-25-modern-commerce-theme-lab.md`):
  A · Clean Premium Commerce, B · Bold Industrial Commerce, C · Minimal Luxury Commerce, light theme
  only. **Never choose the winner, and do nothing further until the user selects one**: no 1E–1J, no
  Phase 2, no new pages or features, no changes to the live routes. The current design stays live
  until a theme is approved; after that the dark equivalent comes next (the user's order).
- **A is the closest direction but not approved; A V2 is built and awaits visual review** (the user's
  "OPTION A V2 / REFINE OPTION A ONLY" brief, report `2026-09-25-modern-commerce-a-v2.md`). Work only
  on A V2 when asked; never on B or C. A stays available for comparison. Never self-approve A V2 and
  never migrate the site to it until the user explicitly approves it.
- **A V2 refinement pass 2 is built and awaits visual review** (the user's "MODERN COMMERCE A V2 —
  REFINEMENT PASS 2" brief, report `2026-09-26-a-v2-refinement-pass-2.md`): the website's approved
  hero plate reinterpreted as A V2's hero (`a2/HeroPlate.tsx`), a wider content column, softened light
  and dark backgrounds with a background token system, a dark theme (A V2 only), a precision pointer,
  section sheets, quiet ambient layers, a contrast audit and an updated sheet. A V2 is still not
  approved: never migrate it, and no 1E, Phase 2, B or C work.
- **A V2's signature animations were corrected** (the user's "SIGNATURE ANIMATION CORRECTION" brief,
  report `2026-09-25-a-v2-signature-correction.md`): the user rejected the star cut and the medallion
  engraving. The signatures must animate the service pages' own drawings (the Laser Cutting nesting
  sheet, the Laser Engraving brass plate) inside the A V2 cards: never a decorative star, a logo, a
  game look, big sparks, a lifted part or a new concept. The corrected version awaits visual review
  (A V2 as a whole is still not approved).
- Publishing waits for the Stage 1J launch approval (the user's instruction in the 1C-V brief). Built
  pages stay `review` in `src/lib/page-meta.ts` (noindex, left out of the sitemap) even after their
  design is approved: the 1C pages, the projects overview and the service pages. Only the homepage is
  `published`.
- Unless a brief asks for homepage work (as 1C-V and V2 did, below the hero only), the approved
  homepage must not change except for a genuine shared-component bug. (V2's Sora headline and orange
  primary buttons also reach the hero: both were the user's instructions, and the hero markup is
  byte-identical to 1C-V.) After shared changes, compare it with
  the approved build: server HTML (normalise `/_next/static` paths), aria snapshots and screenshots
  at the five widths, EN/AR, light/dark.
- Open questions for RAWASY (photos, image rights, AI-watermarked images, licence renewal, registration
  numbers and so on) are listed in `docs/ASSET_INVENTORY.md`.

## Rules from the brief

- Never invent facts: years, staff, project counts, capacities, tolerances, machine brands or specs,
  clients, locations, certificates, awards, testimonials or statistics. Unknown content fields stay empty.
- Arabic copy is professional Saudi business Arabic, written on its own terms rather than translated
  literally. Never letter-space Arabic text.
- Every change must work in EN (LTR) and AR (RTL), light and dark, desktop, tablet and mobile, with
  reduced motion and without JavaScript.
- Certificate numbers, QR codes and personal names stay redacted unless RAWASY approves showing them.
  Images flagged in the asset inventory (AI watermark, authorship, renders) stay off featured spots.
- Orange is an accent (roughly 10%) and the primary action colour; the supporting roles below carry
  the rest of the colour. Keep the design free of clutter, and never make it a rainbow.
- The clients page shows no numbering, grid references or client counts, and no partnership claims
  or testimonials (V2 brief). The homepage marquee shows no count either.

## Visual system (V2, on top of 1C-V)

- Direction: precision engineering × metal fabrication × architectural detail. Premium, engineered,
  layered metal plates; colourful but controlled; clear boxes and panels so each section, service
  and fact reads as its own unit. Never flashy, neon, cyberpunk, gradient-heavy, generic SaaS or
  generic construction. Light theme is warm off-white (never pure white); dark is graphite with
  blue-grey panels (never pure black, never a black-and-orange gaming look).
- Colour roles (semantic, never random), set with `data-tone` on cards, chips and tags
  (`--tone/-ink/-surface/-line`): `brand` orange = primary actions and active states; `eng` steel
  blue = engineering, machinery, information; `proc` teal = process, capability, site support;
  `craft` brass = craftsmanship, certificates, premium details; slate/graphite = dark bands. Service
  tones live in `src/lib/tones.ts`. Colour comes through surfaces, edges, icons and tags, never
  through coloured paragraphs; small text uses the role inks (`.tone-ink`), which pass AA.
- Sections: `.sec-eng`, `.sec-proc`, `.sec-craft` (tinted), `.sec-deep` (recessed), `.sec-slate`
  (dark band, with `on-band`). Vary the background sequence down a page; the homepage runs neutral →
  teal → neutral → graphite → steel → neutral → deep → neutral → graphite → neutral → brass → dark.
- Cards: `.card`, `.card-edge` (3px tone edge), `.card-link` (+ `.card-arrow`), `.icon-chip`,
  `.tone-tag`; `LineIcon` (`src/components/ui/LineIcons.tsx`) for services, support, process and
  company icons. Buttons: primary orange, `secondary` graphite, `steel` / `teal` contextual, `outline`.
  Not every button is orange.
- Border tiers `--border-subtle / --border / --border-strong / --border-ink` + `--border-active`
  and steel/teal/brass edges; shadows `--shadow-card / --shadow-raised / --shadow-image /
  --shadow-floating / --shadow-inset` (the 1C-V names are aliases).
- Primitives in `src/components/visual/`: `TechnicalFrame` / `FrameMarks` (with the `.tf-host`
  class; variants: full rules, `lines="corners"`, `lines="hover"`), `Backdrop` (grid, fine, perforated;
  `drift`), `ScanLine`, `SectionRule`, `PointerLight`, `Nameplate`. CSS helpers: `.panel`,
  `.panel-raised`, `.panel-recessed`, `.panel-metal`, `.act-row` (+ `data-active`), `.tech-tag`,
  `.reg-marks`, `.ruler`, `.rule-double`, `.zoom-img`, `.parallax`, `.redaction-swatch`.
  `MediaFrame` is the image frame. Reuse these; do not invent one-off decoration.
- Depth tokens: `--shadow-low`, `--shadow-medium`, `--shadow-metal`, `--shadow-inset`, `--sheen`,
  `--edge-light/-shade`; surfaces `--surface-recessed/-elevated/-strong`; borders `--border-faint`,
  `--border-ink`; motion `--dur-1..4` (0.24/0.48/0.8/1.2 s).
- Ambient motion (grid drift, scan lines) runs only while on screen (`LiveObserver` sets `data-live`),
  rests while the page scrolls (`data-scrolling` on `<html>`) and never runs with reduced motion.
  Animate transform and opacity only. The pointer light is desktop mouse only. All decoration is
  `aria-hidden` (the `visual-system.spec.ts` test checks this).
- Never put `mask-image` or `opacity` on an element whose child moves: it is recomposited every frame
  (it cost about 8–10 fps while scrolling). Fade a drifting `Backdrop` with `--bd-fade` (a gradient
  to the section colour) and dim it with `--bd-opacity`.
- Buttons: V2 made the primary button orange at rest (brief §24), which also shows in the hero
  (its markup is unchanged). Do not add a resting bevel (tried in 1C-V, removed because it changed
  the hero). To prove the hero is unchanged after shared CSS work, compare its server HTML (from
  `<main>` to `#intro`, byte-identical) and reduced-motion first-viewport renders with the approved
  build. Animated full-page captures differ by animation phase, not by code.
- Contrast: small text on `--surface-recessed` and metal plates uses `text-ink-2` or `text-ink`, never
  `text-ink-3` or `text-accent-ink` (4.3–4.4:1 in light mode). The active-row tint is 5% accent and
  the light-theme hover tint lightens (`--row-tint`), so hover never lowers contrast. axe cannot
  check gradient backgrounds, so work those out by hand.

## Requirements to carry into later stages (from the 1C-V and V2 briefs)

- **1E Capabilities & Machinery** must become one of the strongest pages, never a plain list: large
  machinery photography, a machine selector, technical specifications, grid/axis backgrounds, a
  scanning-line animation, an animated equipment diagram, related services, power figures, machine
  image transitions, technical measurement detail and industrial depth. V2 locked its colour
  direction: steel blue, graphite, orange active lines, clear cards and panels, technical tables,
  visible borders, shadows and scan lines.
- **Projects overview** (built in V2, `review`): image-led, with a hero collage, featured project,
  editorial highlights, a filterable masonry gallery and a text index at the end. Category filters are
  website classifications. Photos are small: `src/lib/project-cards.ts` picks photo / pair / framed
  cards and never enlarges a photo much beyond its native size.
- **1F project detail pages:** hero, gallery, title, category, scope, service; materials, location,
  year and client only if verified; challenge, solution, related projects. Unknown facts stay hidden.
  The service pages already link to `/projects/<slug>` and the machine cards to `/capabilities#<slug>`
  (use the machine slugs as anchors in 1E).
- **Service pages (1D) rules:** each page shares one component set and gets its character from
  `src/components/service/looks.ts` (hero drawing, scope / process / gallery layout, section surfaces).
  Machines, projects and galleries appear only when sourced: related projects are those in
  `services.ts` whose own record lists the service (CNC links one project; engraving and scaffolding
  none). Every process carries the "general workflow, not a certified procedure" note. Laser Engraving
  shows no photographs: the nameplates photo (third-party brand, part/serial numbers) and the two
  renders stay off it until RAWASY supplies or approves images. `projects/canopy-tree-1` stays out of
  the laser-cutting gallery (authorship). Gallery photos are never repeated in the same page's
  project cards.

## Typography rules (1B correction, English changed in V2)

- English (V2): **Sora** for display and headings (H1, major H2, key statements), **Manrope** for
  body, navigation, forms and buttons, **Geist Mono** for technical labels only (machine data,
  references, dimensions). Arabic display, headings, navigation and buttons: **Noto Kufi Arabic** (hero and
  statement 700, headings 600, buttons 600, nav 500). Arabic body, leads and labels: **IBM Plex Sans
  Arabic 400/500 only**. Never use Plex for headings or at 600/700. Technical labels: Geist Mono.
  Fonts come only from `next/font` (`src/app/fonts.ts`) and are never requested from Google at runtime.
- Fonts are tokens, not per-component overrides: `--ff-display-en/-ar` and `--ff-body-en/-ar` resolve
  through `:root:lang(ar)` and `[lang]`. Components pick a role (`t-*` classes, or `font-display` for UI
  that should be Kufi in Arabic). Mark inline text in the other language with `lang` (and `dir`).
- Scale classes: `t-display` (hero), `t-h1`, `t-h2`, `t-h2-compact` (calmer supporting sections),
  `t-title`, `t-h3`, `t-h4`, `t-lead`, `t-body`, `t-caption`, `t-label`, `t-stat` (figures). The
  precision statement is the only large expressive size; `.vision-quote`, outlined numerals and
  `t-stat` values are the smaller typographic accents. Arabic paragraphs use line-height 1.85 and headings 1.36–1.6, with no letter-spacing.
- Heading text goes through `<Phrases>` (`src/components/ui/Phrases.tsx`) so lines break at phrase
  boundaries. Use `em`, not `ch`, for heading measures.

## Where things live

- Content (EN + AR): `src/content/*`, read through `src/content/repository.ts`. Phase 2 replaces the
  storage behind this layer.
- Media registry: `src/content/media.generated.ts`. It is generated, so never edit it by hand; run
  `npm run assets:extract -- <profile.pdf>`.
- Routes: `src/i18n/routes.ts`. Publishing, indexing and the sitemap: `src/lib/page-meta.ts`.
- Design tokens and motion CSS: `src/app/globals.css`. Homepage sections: `src/components/home/*`.
- Inner pages: shared system in `src/components/inner/*` and `src/lib/inner-page.ts` (metadata,
  breadcrumb trail, JSON-LD); page components in `src/components/{about,services,projects,industries,
  clients,certificates,contact,legal}`; shared cards in `src/components/cards/*` and teasers in
  `src/components/teasers/*`; copy in `src/content/{about,pages,contact,legal}.ts`.
- Projects: `src/components/projects/*`, `src/lib/project-cards.ts`; showcased projects and withheld
  photos in `src/content/projects.ts` (`isShowcased`, `projectImages`).
- Clients wall: `src/components/clients/ClientWall.tsx` + `src/lib/logo-wall.ts`. Contact map:
  `src/components/contact/LocationSection.tsx` + `src/lib/maps.ts` (address search only; replace with
  RAWASY's own Google Maps place link once confirmed; never invent coordinates).
- Quote form: `src/components/contact/QuoteForm.tsx`. No backend: it prepares the request for the
  visitor to send by email or WhatsApp. Never make it claim a request was sent.
- Service detail pages: route `src/app/[locale]/services/[slug]/page.tsx`; components in
  `src/components/service/*` (hero drawings in `visuals/`, per-service composition in `looks.ts`);
  copy in `src/content/service-details.ts` (per service) and `servicePage` in `src/content/pages.ts`
  (shared labels); captioned galleries and project links in `src/content/services.ts`.
- Browser tests: `e2e/*.spec.ts` with `playwright.config.ts`; run `npm run test:e2e` after a build.
  `visual-system.spec.ts` covers ambient motion, active states, the pointer light, line drawing and
  decoration semantics; `redesign-v2.spec.ts` covers projects filters, the clients wall, the map, fonts
  and colour-role contrast; `service-pages.spec.ts` covers the six service pages.

## Before pushing

- Run `npm run lint`, `npm run typecheck`, `npm run build` and then `npm run test:e2e`.
- Check pages in a browser with Playwright: EN/AR × light/dark × desktop/mobile, console errors, and
  sideways overflow. In cloud sessions Chromium is at `/opt/pw-browsers`. An axe-core audit (installed
  in the scratchpad, not the project) is a cheap extra check.

## Theme lab (Modern Commerce exploration)

- Routes: `/theme-lab/{en|ar}/modern-commerce-{a|a-v2|b|c}` and `…/system`, under their own root layout
  (`src/app/theme-lab/[locale]/layout.tsx`, `lab.css`), so no site header, footer, loader or site CSS.
  `src/proxy.ts` lets `/theme-lab/{locale}/…` through with `X-Robots-Tag: noindex, nofollow` and
  redirects bare lab URLs to a locale and A V2 (`LAB_DEFAULT`); option keys and slugs live in
  `options.ts`. Pages carry `noindex, nofollow`; they are not in
  `routes`, the sitemap or any navigation. The lab bar at the top is preview chrome.
- Code: `src/components/theme-lab/` — `data.ts` (everything from the content layer; engraving cover
  and flagged photos excluded), `Icon.tsx` (one icon family: line or duotone per option), `ui.tsx`
  (photos, lab bar), `SystemSheet.tsx`, and per option `{a,b,c}/Home*.tsx`, `System*.tsx`, `*.css`
  (tokens and components scoped to `.lab-a/.lab-b/.lab-c`), `fonts.ts` (loaded only on that option).
- A V2 (`a2/`): `HomeA2.tsx` (header with Services dropdown and phone menu sheet, hero, capability
  strip, about, services, machinery, projects, industries by source, clients, compliance, contact,
  footer), `MachineShowcase.tsx` (client; `:target` fallback without JS), `SystemA2.tsx` +
  `SheetControls.tsx` (replays, phone preview), `a2.css` (`.lab-a2` tokens — every colour a token; the
  dark theme under `html[data-theme="dark"] .lab-a2` redefines the names, `.a2-theme-light/-dark`
  force either inside the other). It reuses A's fonts (`a/fonts.ts`). LabMotion's A V2 extras
  key on new attributes only (`data-parallax`, `data-hero`, `data-ambient`, `details[data-dropdown]`,
  `button[data-toggle]`, `details[data-menu][data-sheet]`), so A, B and C behave as before.
- A V2 pass 2: `theme-boot.ts` sets `data-theme` before paint (`?theme=light|dark`, else the stored
  choice under `rawasy-lab-a2-theme`, else the system; never the site's `rawasy-theme`) and
  `ThemeSwitch.tsx` changes it (view-transition cross-fade). `HeroPlate.tsx` is the hero: the website
  plate's geometry (`src/components/home/hero/plate-geometry.ts`) on a stage with a spec bar (children)
  and a readout; bolt holes pierced, star and slot traced, perforation rows opened, one clock via
  `useSignature(…, { replay: false })`; the mouse leans it (inline transforms) and reads X / Y.
  `Cursor.tsx` is the desktop-mouse pointer (`html[data-cursor-on]`, set only once the mouse moves;
  touch, pens, reduced motion and forced colours keep the system cursor; text fields keep the I-beam).
  `--shell: min(1400px, 92vw)`; `.sec-sheet` (`.sec-muted`, `.sec-raised`) and the footer are sheets
  inset `--sheet-m` from the screen edges; ambient: page dot matrix, hero grid and glows, footer grid.
- A V2 performance rules (measured in pass 2): nothing inside the plate SVG animates continuously (the
  hot points' breathing is HTML over it) and the SVG carries no filter; the shadow is a static
  drop-shadow rastered with the plate; no `backdrop-filter` or `will-change` + `filter` on layers that
  sit under continuous animation (both are re-applied on every compositor frame); the lean is inline
  transforms on the plate (`will-change: transform`) instead of a custom property on the hero (that
  restyled the whole SVG per mouse move); write the readout only when it changes.
- Signature illustrations (`signature/`) animate the service pages' drawings, whose geometry lives in
  `src/components/service/visuals/nesting-sheet.ts` and `engraved-plate.ts` (shared with
  `CutPathVisual` and `EngravedPlateVisual`). `LaserCut.tsx`: the nesting sheet appears with one scan
  pass, nested parts draw in, the head activates at its park spot, then cuts the holes and the slot
  (pierce, lead-in, contour) before the outer contour from its lead-in, at a steady feed, with a hot
  point, a trailing glow and a heat tint that settles; interior lead-ins drop out with the slug; the
  head parks where the service page shows it. `LaserEngrave.tsx`: the brass plate and its reflection,
  the crosshair moves to the start, engraves the double border and corner marks, the line block, the
  rosette and the ring (grooves drawn twice, highlight and cut), light crosses, the laser switches off
  on its rest mark; mirrored in Arabic. Markup is the finished state; `signature.css` arms the start
  state only under `.js` + `prefers-reduced-motion: no-preference`; `useSignature` plays once at 50 %
  in view and replays on host (`[data-sig-host]`) mouse-enter or focus (not while running);
  `sig:replay` (`detail.intro`) forces a run; `freeze` holds a named moment (`initial`, `active`,
  `finished`) for the sheet's still frames. `animate()` puts every animation on one clock that ends
  with the run (delay, active window, end delay, fill both), so captures and tests pause them all at
  one `currentTime`. The two signatures lead the A V2 services grid and the design-system sheet
  (`SystemSheet`'s optional `lead`).
- `lab.css` builds Tailwind from lab sources only (`source(none)` + `@source`); `globals.css` has
  `@source not` lines so lab classes never reach the site CSS. Semantic utilities (`bg-surface`,
  `text-ink-2`, `rounded-card`, `shadow-raised`…) resolve to whichever option's tokens are in scope.
- Proof that the site is untouched: build the approved commit in a worktree and compare every
  prerendered file (normalise build id, `/_next/static` paths and the router's
  `"siblings":["theme-lab"]` entry for `[locale]`); site CSS must be byte-identical.
  `e2e/theme-lab.spec.ts` covers isolation, noindex, redirects, sections, flagged photos, overflow,
  no-JS, reduced motion and whole-card link overlays for every option; `e2e/theme-lab-a-v2.spec.ts`
  covers A V2's behaviour. Next's `<meta name="next-size-adjust">` can move within `<head>` between
  builds of the same tree; treat that position change as noise.
- When a theme is chosen, the lab is the reference; delete it once the site carries the new theme.

## Gotchas learned

- Do not add `dynamicParams = false` to `app/[locale]/layout.tsx`. It turns fallbacks off for the whole
  route tree, which causes `NoFallbackError`s and redirect loops on prefetches of 404 pages. `proxy.ts`
  already sends every non-locale URL to `/{locale}/…`, where the catch-all renders the localized 404.
- A `notFound()` hit during a dynamic render is built in the browser by Next.js 16 (real 404 status).
  `BootFallback` then reapplies the theme and motion settings.
- To stop a server in a cloud session, run `pkill -f "[n]ext-server"` as its own command. Never use a
  `pkill -f`/`pgrep -f` pattern that appears literally in the same command (for example
  `"next start -p 3400"`): it matches your own shell and kills it (exit 144). Bracket one letter.
- After a rebuild, stop any `next start` left running from before (check `pgrep -fa "[n]ext-server"`
  and `/proc/<pid>/cwd`). Otherwise the tests reuse the stale server and assets fail with 500s.
- Styles inside `@layer components` lose to Tailwind utilities (`.grid`, `.flex`) whatever their
  specificity. Rules that must win, like `html:not(.js) .js-only`, go outside the layers.
- Playwright's `javaScriptEnabled: false` still parses `<noscript>` as text. Check noscript content in
  the server HTML instead.
- Reveal fades also run with reduced motion (opacity only), so content in the bottom band of the
  viewport stays hidden until scrolled into view. Visibility checks must leave that band out.
- Dark `--text-tertiary` was raised to `#95938d` in 1C-V (4.9:1 on `--surface-elevated`, which the
  old value failed at 4.35:1). Light `--text-tertiary` still fails on `--surface-recessed` (4.41:1).
- Decorative outlined numerals use `.outline-num` with `data-n` (drawn by `::before`), so they stay out
  of the text and accessibility trees.
- Both locales share one root layout, so every preloaded font is preloaded on every page (EN pages load
  the Arabic fonts and vice versa). Splitting preloads per language needs a root layout per language (1J).
- `html` has `scroll-padding-top` (header + 1rem), so anchor jumps already clear the header. Do not add
  `scroll-mt-*` to sections as well: the two add up (the gallery landed 168px down).
- `.js [data-reveal]` rules are unlayered, so on an element that also lifts on hover (`.card-link`) they
  cancel the hover transform. Put `data-reveal` on a wrapper around the card.
- Chromium does not restyle SVG descendants for selectors like `[data-revealed] [pathLength]` when
  the attribute appears, so line drawings stayed undrawn until the next resize (full-page captures
  resize, which hid the bug until 1D). Draw-on-reveal paths read an inherited `--draw` that the
  revealed element sets (`.line-draw`, `.beam-draw`, `.pillar`); keep that pattern for new drawings.
- `MediaFrame` always adds `relative`; passing `absolute` in its `className` loses. Wrap it in a
  positioned element instead.
- `dir="ltr"` on an element also flips its own logical insets (`end-0` becomes the right edge in
  Arabic). Leave `dir` off decorative numerals; digits render the same either way.
- google.com is blocked in cloud sessions: the map iframe cannot load there. Tests and captures stub
  `https://www.google.com/*` with Playwright routing; check the live map on a normal network.
- The project does not use Prettier (lines run to about 130–140 characters); do not run `npx prettier`.
- `services/engraving-nameplates` (the laser-engraving cover) shows a third-party brand name and part
  and serial numbers. Keep it off new featured spots until RAWASY confirms it may be shown.
- Backgrounding `cd dir && cmd &` in Bash runs the `cd` in the background job; later lines still run in
  the old directory. Use absolute paths for background jobs.
- For a side-by-side build of an older commit, use a `git worktree` with `cp -al node_modules`.
  Turbopack rejects a symlinked `node_modules` that points outside the project.
- Chromium full-page screenshots taller than about 16,000 px come out blank at the bottom (the 390 px
  homepage). Capture those pages viewport by viewport.
- A reveal animation and a hover animation on the same pseudo-element restart each other when the
  `animation` value switches. Give each its own element or pseudo-element (see `.tf-m`).
- `cqw` inside `@keyframes` resolves against the nearest query container, so give the animated
  element's parent `container-type: inline-size`.
- To show a caption above an image but keep it after the image in the reading order, use a flex
  column and `order-first` (see `MediaFrame`); moving it in the DOM changes the accessibility tree.
- With `experimental.globalNotFound`, `global-not-found.tsx` sits in every route's module graph, so
  its `next/font` faces (the site's six files) are preloaded on every page — even under another root
  layout such as the theme lab. A segment `not-found.tsx` does not change that.
- Chromium lays out the content of a closed `<details>` (it can cause sideways overflow); hide it with
  `details:not([open]) > :not(summary) { display: none }`.
- A whole-card link overlay (`.stretch::after`) or hover edge (`::before`) needs a positioned card.
  Without one it attaches to a far ancestor or the page: in the lab it covered the hero and drew an
  orange line across the top (hovering a pseudo-element hovers its element).
- A family name in a plain font stack (e.g. "Noto Sans Arabic") matches a `next/font` @font-face with
  that name and downloads it. Noto Sans Arabic is about 163 KB per weight for the Arabic range.
- For language-specific type rules that must also apply to `lang="ar"` specimens inside an English
  page, write `.x .t-h2:lang(ar)`, not `.x:lang(ar) .t-h2`.
- A custom property that uses another one (`--stage: radial-gradient(… var(--spot-x) …)`) is resolved
  where it is declared, so changing `--spot-x` on a child does nothing. Write the gradient on the
  element that owns the changing variable (and register it with `@property` to transition it).
- A cut-out SVG part filled with an `objectBoundingBox` gradient shows a seam against its plate; use
  `gradientUnits="userSpaceOnUse"` in plate coordinates so the part matches until it moves.
- Playwright's `click()` re-scrolls an element that is still moving (a reveal transition) and may
  align it to the top first; wait for reveals to finish before asserting scroll positions.
- A hydration flag set with `setState` in `useEffect` fails lint (`react-hooks/set-state-in-effect`);
  use `useSyncExternalStore(subscribe, () => true, () => false)`.
- Inactive-state styles of a script-driven widget (e.g. hidden machine panels) must be scoped to its
  script-ready attribute (`[data-js]`), or the no-JS fallback inherits them.
- Container query units (`cqw`, `cqh`) measure the container inside its padding; do not subtract the
  padding again when sizing a child to fit.
- A line hidden with `stroke-dasharray: 1 1; stroke-dashoffset: 1` still paints its round or square
  cap at the path's start. Hide it with a dash that ends short of the path (`1 1.1` and `1.05`).
- WAAPI animations that span a whole run on hold keyframes are sampled every frame (style
  recalculation); give each one a delay and an end delay around its active window instead.
- A new child slot in a shared server component (`{lead}`) changes the React payload of every page
  that uses it, even when empty; render it together with an existing child when it is set.
- Moving JSX attribute literals into shared numeric constants keeps the HTML identical but changes the
  React payload (numbers instead of strings, list keys); compare the visible markup separately.
- `next dev` never fires `load` for a lab page with JavaScript disabled; check no-JS on a build.
- The `pkill -f "[x]…"` bracket trick fails if the unbracketed text appears anywhere else in the same
  command (a restart of that server, for example): kill in one command, restart in the next. To stop
  one of two `next start` servers, kill the `next-server` whose `/proc/<pid>/cwd` is that checkout.
- An element positioned with `transform: translate()` and sized with `scale` moves off its point: the
  `scale` property applies outside `transform`, so it scales the translation. Position with `translate`.
- `getAnimations({ subtree: true })` includes CSS animations and transitions; to check a Web Animations
  run, keep `a.constructor === Animation`. Sheet specimens reuse live classes (`.a2-cursor`), so test
  locators must exclude them (`:not(.a2-cursor-spec)`).
- Tailwind's opacity modifiers (`bg-surface/85`) compute to `oklab(…)` and `color-mix()` to
  `color(srgb …)`: tests that read colours should convert them through a 1 × 1 canvas.
- axe marks text on gradients and photos as "needs review", not as a pass: audit those with a
  worst-case solid override and with rendered-pixel measurements (the pass-2 report explains both).
