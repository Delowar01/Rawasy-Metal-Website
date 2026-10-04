@AGENTS.md

# RAWASY Metal Website — project memory

## How the user wants reports

- When a task or stage is finished, send a **complete report inside one copyable code block**. Use a
  four-backtick markdown fence (````markdown) so it copies cleanly in one go.
- Cover: summary and status, what was delivered, QA actually run and its results (say plainly if
  something failed or was skipped), items needing RAWASY's confirmation, known limitations, how to
  run, and next steps.
- Also save the report as `docs/reports/YYYY-MM-DD-<topic>.md`, then commit and push it with the work.
- Latest report: `docs/reports/2026-10-04-stage-1f-project-details.md` (earlier: `2026-10-03-stage-1e-capabilities-machinery.md`, `2026-10-02-tm3-correction-2.md`,
  `2026-10-02-tm3-correction-1.md`, `2026-10-02-tm3-shared-polish.md`, `2026-10-02-tm2-6-retirement.md`, `2026-10-02-tm2-5-projects.md`, `2026-10-02-tm2-4-services.md`,
  `2026-10-01-tm2-3-about-industries-clients-certificates.md`, `2026-10-01-tm2-2-contact.md`, `2026-10-01-tm2-1-correction-1.md`,
  `2026-10-01-tm2-1-inner-kit-legal-404.md`,
  `2026-09-30-tm2-decision-register.md`,
  `2026-09-29-tm2-migration-plan.md`,
  `2026-09-29-tm1-navigation-correction.md`,
  `2026-09-28-tm1-homepage-migration.md`, `2026-09-28-a-v2-hero-loop.md`,
  `2026-09-28-a-v2-background-optimization.md`, `2026-09-27-a-v2-background-motion.md`, `2026-09-26-a-v2-refinement-pass-2.md`, `2026-09-25-a-v2-signature-correction.md`, `2026-09-25-modern-commerce-a-v2.md`, `2026-09-25-modern-commerce-theme-lab.md`, `2026-09-25-stage-1D-service-pages.md`, `2026-09-25-visual-redesign-v2.md`,
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
- **Stage 1D (the six service detail pages)**: TM-2 decision D3 kept 1D's content and structure; its visual approval
  was given on the migrated Modern Commerce versions, built in TM-2.4 ("TM-2.4 APPROVED — BEGIN TM-2.5"). Never
  self-approve a stage. **Stage 1E (Capabilities & Machinery) is approved** (the user's "STAGE 1E APPROVED — BEGIN STAGE
  1F"; report `2026-10-03-stage-1e-capabilities-machinery.md`; rollback checkpoint `preserve/pre-stage-1e` at `ca672d7`);
  Capabilities stays `review`. **Stage 1F (the project pages: source-strict project records, not case studies) is built**
  (report `2026-10-04-stage-1f-project-details.md`; rollback checkpoint: GitHub branch `preserve/pre-stage-1f` at
  `c2aed58`, the last commit before 1F) and awaits the user's independent review; the project pages are `review`. Do not
  start 1G or later until the user says so. Do not start Phase 2 (admin panel) during Phase 1.
- **The theme exploration is over: A V2 is the approved master design** (the user's "STAGE TM-1 — MODERN
  COMMERCE A V2 THEME MIGRATION" brief). The target was modern commerce × premium industrial B2B × manufacturing (a
  company selling capabilities, not ecommerce). Source of truth: `/theme-lab/{en,ar}/modern-commerce-a-v2`. Never
  create another theme or reinterpret the direction; A, B and C stay in the lab for comparison only (no work on B
  or C). Everything the A V2 briefs settled is accepted and binding for the migrated pages:
  - hero plate (`commerce/hero/HeroPlate.tsx`, the website's plate geometry): the whole sequence (dimensions, holes,
    star, slot, perforation, head, readout, finished plate) repeats every 10 s start to start — cut 0–5.26 s, hold
    to 9.40 s, reset to 9.85 s — only while on screen and the page is visible, resting where it is otherwise, never
    looping with reduced motion (static finished plate), no drift. Never restore the one-time playback. The plate's
    rise plays in cycle 1 only; the user has not decided whether it should repeat, so leave it until they say.
  - signatures: animate the service pages' own drawings (the Laser Cutting nesting sheet, the Laser Engraving brass
    plate), never a decorative star, logo, game look, big sparks, lifted part, medallion or new concept.
  - ambient: "visible + minimal", micro-dots, soft warm/steel colour with restrained teal and ONE precision motif
    (the periodic light sweep); never a blueprint, CAD, technical-grid or architecture look; no canvas, WebGL,
    particles or animated filters. Two moving full-screen layers at most (never the five-layer build), ≥ 55 fps in
    the software-compositing scroll benchmark at 1440 px, no ambient under body text below AA per pixel. Keep it
    visible; never go back to a static background.
  - pointer (desktop mouse only), softer light/dark themes (dark = blue-charcoal), modern cards/borders/shadows.
- **Stage TM-1 (homepage + design foundation) is visually approved** (the user's "TM-1 VISUALLY APPROVED — BEGIN
  TM-2.1"; reports `2026-09-28-tm1-homepage-migration.md` and `2026-09-29-tm1-navigation-correction.md`): `/en` and
  `/ar` run the Modern Commerce design on the website's real routes, with the navigation correction (the project
  cards open the Projects gallery, "Start a Project" opens the quotation form). **The homepage is frozen**: it is the
  regression baseline of every TM-2 batch and must not change. After each batch prove it against the batch's
  checkpoint build (normalised prerendered files and resolved payloads, CSS rules "additions only", pixel captures,
  the hero loop, signatures, ambient, cursor, header, footer and its links). Rollback checkpoint for TM-1: local tag
  `pre-tm1-a-v2-migration` and GitHub branch `preserve/pre-tm1-a-v2-migration` (both at `3260415`, the last commit
  before TM-1). Do not start 1E. Do not deploy.
- **TM-2 (migrating every inner page to Modern Commerce) is approved with conditions and runs batch by batch.** Baseline:
  `2026-09-29-tm2-migration-plan.md` (six batches, each approved before the next: 2.1 kit + Privacy + Terms + 404,
  2.2 Contact, 2.3 About + Industries + Clients + Certificates, 2.4 services overview + six service pages, 2.5
  Projects overview, 2.6 retire the previous design). The user's decisions D1–D13, seven extra requirements and the
  reconciled points are in `2026-09-30-tm2-decision-register.md`; follow both. **TM-2.1 (the inner-page kit, Privacy,
  Terms and the localized 404) is built** (report `2026-10-01-tm2-1-inner-kit-legal-404.md`; rollback checkpoint:
  GitHub branch `preserve/pre-tm2` at `5cfeaed`, the last commit before TM-2). It passed the user's independent review
  with two corrections, applied in correction 1 (report `2026-10-01-tm2-1-correction-1.md`: the 404's phone-menu
  language switch, and the TM-2.1 report's status matrix). **TM-2.1 is approved** (the user's "TM-2.1 APPROVED — BEGIN
  TM-2.2"). Keep TM-2.1's documented limitations as they are unless the user asks (no-JS 404 body, header blur, 44 rem
  legal measure, the 320 px 404 label wrap, the A V2 chunk count). **TM-2.2 (Contact) is approved** (the user's
  "TM-2.2 APPROVED — BEGIN TM-2.3"; report `2026-10-01-tm2-2-contact.md`; rollback checkpoint `preserve/pre-tm2.2` at
  `e5a3834`). **TM-2.3 (About, Industries, Clients, Certificates) is approved** (the user's "TM-2.3 APPROVED — BEGIN
  TM-2.4"; report `2026-10-01-tm2-3-about-industries-clients-certificates.md`; rollback checkpoint `preserve/pre-tm2.3`
  at `2026047`). **TM-2.4 (the services overview and the six service pages) is approved** (the user's "TM-2.4 APPROVED —
  BEGIN TM-2.5"; report `2026-10-02-tm2-4-services.md`; implementation commit `ffe62b9`; rollback checkpoint
  `preserve/pre-tm2.4` at `4b28ad2`).
  **TM-2.5 (the Projects overview, D4's exact project anchors and the shared first-jump fix) is approved** (the user's
  "TM-2.5 APPROVED — BEGIN TM-2.6"; report `2026-10-02-tm2-5-projects.md`; rollback checkpoint `preserve/pre-tm2.5` at
  `304a277`). **TM-2.6 (retiring the previous design) is approved** (the user's "TM-2.6 APPROVED — BEGIN TM-3"; report
  `2026-10-02-tm2-6-retirement.md`; rollback checkpoint `preserve/pre-tm2.6` at `9c7d2af`). **TM-3 (shared polish of the
  Modern Commerce design: the five deferred items) is built** (report `2026-10-02-tm3-shared-polish.md`; rollback
  checkpoint: GitHub branch `preserve/pre-tm3` at `de62bc5`, the last commit before TM-3). It passed the user's independent
  review with two corrections, applied in **TM-3 correction 1** (report `2026-10-02-tm3-correction-1.md`, on `2cec1b0`): the
  homepage's Industries cards stack in one column below 22.5 rem (the 320 px overflow), and the fallback 404's logo takes
  `CanvasText` in forced colours. Correction 1 passed review ("TM-3 Correction 1 passed independent review"); its one new
  finding (English Industries names past their card at 360–421 px) is fixed in **TM-3 correction 2** (report
  `2026-10-02-tm3-correction-2.md`; correction commit `0f53145` on `9e194e9`): the one-column rule moved to 27 rem. **TM-3
  and corrections 1–2 are approved and locked** (the user's "TM-3 FULLY APPROVED — BEGIN STAGE 1E"). Never self-approve.
  **Do not begin Stage 1G or later (1I, 1J included), theme-lab removal, OG regeneration, publication or any deployment
  until the user says so.** TM-3 fixed four of the five deferred items, CSS only (served HTML, page data and JS identical to TM-2.6): the
  colour switch's forced-colours drawing on every switch; the inner pages' hero shown with the first paint; the brand
  logo and the header's marks in forced colours; the phone menu sheet's pages scrolling above its foot (see "Modern
  Commerce design in production"). Still open, for the user to decide: (5) without JavaScript a font that swaps in after
  the first layout can still move an address's anchor landing (re-measured in TM-3; two standards-based CSS fixes were
  tried and rejected: root scroll snapping pulls a reader back to the section, and an `overflow-anchor` exclusion built
  on `:has(~ :target)` added 2.6–4.1 ms (+8–11 %) to each full style recalculation of the homepage, for every visitor);
  on desktop the About and services overview pages' largest paint is in the section under
  the hero, which keeps its reveal, so their LCP stays about 1.1–1.3 s; Arabic desktop pages show a CLS of 0.003–0.009
  (the Arabic fonts, not preloaded, swap in while the hero is visible; preloading them needs a root layout per language,
  1J); below 320 CSS px (a phone at 200 % page zoom) and with doubled text on phones the header overflows (pre-existing,
  outside the 320 px boundary). Also open: the OG share images (`scripts/generate-og.mjs`) are still rendered with the previous design's faces (a Stage
  1J / SEO-release task; do not regenerate them before), and the dictionary keys only the retired shell read stay until a
  usage audit.
  Decisions in short:
  - project cards on About and the service pages open their project's place in the migrated gallery,
    `/projects#<slug>` (since TM-2.5, still "View in the gallery"); the landing clears the header and the sticky filter
    bar. The homepage's six links stay on `#gallery`, unchanged.
  - machine links (`/capabilities#<slug>`, the homepage showcase and the service pages) land on the 1E page's machine
    panels since Stage 1E; About links the page itself (D5).
  - the services overview uses the `LaserEngrave` drawing; the flagged engraving photos go.
  - no floating WhatsApp button.
  - the previous design's blueprint/editorial decoration retires.
  - the four other service drawings are restyled, with no new sequences.
  - the Google Maps embed and URLs stay byte-identical, and only the frame is restyled.
  - the project placeholders moved to MC in TM-2.6; Capabilities left `PlannedPage` in Stage 1E and the project pages in
    Stage 1F, which retired `PlannedPage` and `planned.css` (no route used them any more).
  - the theme lab stays until the user authorizes its removal.
  - every migrated page stays `review`/noindex until 1J.

  Required:
  - validate the MC 404 and catch-all: real status codes, localization, SEO, unknown service/project slugs.
  - quote-form logic, validation, the prepared email/WhatsApp text and the no-backend note stay exact.
  - certificate redactions stay at the file level (byte-identical files).
  - the homepage stays visually unchanged.
  - every existing test assertion is kept or replaced by equivalent coverage.
  - no deployment.
- Publishing waits for the Stage 1J launch approval (the user's instruction in the 1C-V brief). Built
  pages stay `review` in `src/lib/page-meta.ts` (`noindex, follow`, left out of the sitemap) even after their
  design is approved: the 1C pages, the projects overview, the service pages, Capabilities (since Stage 1E) and the
  project pages (since Stage 1F). Nothing is `planned` any more. Only the homepage is `published`.
- Approved pages are frozen: after any shared change, compare them with the batch's checkpoint build (a `git worktree`
  of the checkpoint with `cp -al node_modules`): visible server HTML (scripts removed, `/_next/static` paths and the
  `next-size-adjust` meta position normalised), the CSS bytes and each page's stylesheet list, the RSC payloads resolved
  into one tree (Flight rows get renumbered and re-chunked when any prop changes, so compare resolved trees, not files),
  JS by module set (`jsalpha`-style token comparison) and screenshots in EN/AR, light/dark.
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
- Orange is an accent (roughly 10%) and the primary action colour; steel, teal and brass carry the rest of the
  colour, through surfaces, edges, icons and tags (never coloured paragraphs). Keep the design free of clutter, and
  never make it a rainbow.
- The clients page shows no numbering, grid references or client counts, and no partnership claims
  or testimonials (V2 brief). The homepage marquee shows no count either.

## Retired with the previous design (Stage TM-2.6)

The previous design is gone from the website (rollback: `preserve/pre-tm2.6`): its root layout
(`src/app/[locale]/layout.tsx`, `template.tsx`, `not-found.tsx`), `src/app/globals.css`, its fonts (Sora, Manrope, Noto
Kufi Arabic, Geist Mono; `src/app/fonts.ts`), its shell (`SiteHeader`, `SiteFooter`, language and theme controls, the
floating WhatsApp button, `PagePlaceholder`, `NotFoundView`), its motion (loader, page transition, custom cursor,
reveal and live observers, `BootFallback`, `lib/boot-script.ts`, `lib/theme.ts`, GSAP and `@gsap/react` with
`lib/gsap.ts`), its visual primitives (`TechnicalFrame`, `Backdrop`, `ScanLine`, `SectionRule`, `PointerLight`,
`Nameplate`, `MediaFrame`, `LineIcons`, `Phrases`, `ButtonLink` …), the parked `Legacy*Page.tsx` copies, the
cross-design link machinery (`commerceRoutes`, `commerceDynamicRoutes`, `crossDesignLink`) and the session intro flag
(`rawasy-intro`). Do not recreate any of them. Kept because the Modern Commerce design uses them: the hero plate
geometry (`src/components/home/hero/plate-geometry.ts`), the signature geometry
(`src/components/service/visuals/nesting-sheet.ts`, `engraved-plate.ts`; never move or refactor them without a brief),
`src/components/projects/types.ts`, `src/components/brand/Logo.tsx` and the `Tone` type in `src/lib/tones.ts`.

## Requirements to carry into later stages (from the 1C-V and V2 briefs)

- **1E Capabilities & Machinery** (built in Stage 1E, see "Capabilities & Machinery (Stage 1E)" under "Modern Commerce
  design in production") had to become one of the
  strongest pages, never a plain list: a machine selector, technical register, local grid/axis, a scanning line, an
  animated equipment diagram, related services, power figures, machine transitions and industrial depth; colour
  direction steel blue, graphite, orange active lines, clear cards and panels, visible borders, shadows. The machine
  photos are small profile exports, so the page never enlarges them (no "large machinery photography" until RAWASY
  supplies originals), and it shows no specification the profile does not give.
- **Projects overview** (built in V2, in the Modern Commerce design since TM-2.5, `review`): image-led, with a hero
  collage, featured project, editorial highlights, a filterable masonry gallery (`#gallery`, each project at `#<slug>`)
  and a text index at the end. Category filters are website classifications. Photos are small:
  `src/lib/project-cards.ts` picks photo / pair / framed cards, and the MC page never shows a photo above its source size.
- **1F project pages** (built in Stage 1F, see "Project pages (Stage 1F)" under "Modern Commerce design in production"):
  source-strict project records from the company profile, never case studies. Client, location, year, materials,
  scope, description, challenge and solution show only once a record holds them (none does); nothing is inferred from
  photos, signage, file names or anything else. Only the overview's gallery cards link the pages ("View project"); About
  and the service pages keep `/projects#<slug>` (D4), the homepage's six cards `#gallery`, the overview's featured project,
  highlights and index `#<slug>` (the Stage 1F brief kept all of them). The machine cards link `/capabilities#<slug>`.
- **Service pages (1D) rules:** each page shares one component set and gets its character from
  `src/components/commerce/services/looks.ts` (hero picture, scope / process / gallery layout, section surfaces).
  Machines, projects and galleries appear only when sourced: related projects are those in
  `services.ts` whose own record lists the service (CNC links one project; engraving and scaffolding
  none). Every process carries the "general workflow, not a certified procedure" note. Laser Engraving
  shows no photographs: the nameplates photo (third-party brand, part/serial numbers) and the two
  renders stay off it until RAWASY supplies or approves images. `projects/canopy-tree-1` stays out of
  the laser-cutting gallery (authorship). Gallery photos are never repeated in the same page's
  project cards.

## Typography rules

- The website's faces (Modern Commerce): **Plus Jakarta Sans** (English display, preloaded), **Inter** (English text,
  preloaded), **Tajawal** 500/700/800 (Arabic display and semibold Arabic UI), **IBM Plex Sans Arabic** 400/500 only
  (Arabic text; never for headings or at 600/700), the system monospace stack for technical figures. Fonts come only
  from `next/font` (`src/app/(commerce)/fonts.ts`) and are never requested from Google at runtime.
- Fonts are tokens (`--ff-display` / `--ff-body` from `--font-mc-*`), switched for Arabic by `:lang(ar)` /
  `[lang|="ar"]` in `system.css`. Mark inline text in the other language with `lang` (and `dir`).
- Arabic is never letter-spaced (`:lang(ar)` rule in `commerce.css`); Arabic paragraphs use line-height 1.85.
- Use `em`, not `ch`, for heading measures.

## Where things live

- Content (EN + AR): `src/content/*`, read through `src/content/repository.ts`. Phase 2 replaces the
  storage behind this layer.
- Media registry: `src/content/media.generated.ts`. It is generated, so never edit it by hand; run
  `npm run assets:extract -- <profile.pdf>`.
- Routes: `src/i18n/routes.ts` (`routes`, `RouteKey`, `routeStage`, `path()`, `href()`, `switchLocalePath()`).
  Publishing, indexing and the sitemap: `src/lib/page-meta.ts`.
- Every page: `src/app/(commerce)/[locale]/` with components in `src/components/commerce/*` (see below); inner-page
  metadata, breadcrumb trail and JSON-LD in `src/lib/inner-page.ts`; copy in `src/content/{about,pages,contact,legal}.ts`.
- Projects: the overview in `src/components/commerce/projects/*`, `src/lib/project-cards.ts`; showcased projects and
  withheld photos in `src/content/projects.ts` (`isShowcased`, `projectImages`, `withheldMedia`, and the project pages'
  `projectDetailMedia`). Project pages (Stage 1F): `src/components/commerce/project-detail/*`, labels in
  `projectDetailPage` (`src/content/pages.ts`), read through `getProjectDetailContent` (`src/content/repository.ts`).
- Capabilities & Machinery (Stage 1E): `src/components/commerce/capabilities/*`; machine facts only in
  `src/content/machines.ts` (profile p.7), the page's labels and notes in `src/content/capabilities.ts`.
- Clients wall: `src/components/commerce/clients/ClientsPage.tsx` with `planSpans` from `src/lib/logo-wall.ts`. Contact
  map: `src/components/commerce/contact/Location.tsx` + `src/lib/maps.ts` (address search only; replace with RAWASY's
  own Google Maps place link once confirmed; never invent coordinates).
- Quote form: `src/components/commerce/contact/QuoteForm.tsx`. No backend: it prepares the request for the visitor to
  send by email or WhatsApp. Never make it claim a request was sent. Its logic (from `type FieldName` to the privacy
  line) is the previous design's form code, unchanged; keep `e2e/commerce-contact.spec.ts`'s golden outputs passing.
- Service detail pages: `src/components/commerce/services/*`; copy in `src/content/service-details.ts` (per service)
  and `servicePage` in `src/content/pages.ts` (shared labels); captioned galleries and project links in
  `src/content/services.ts`.
- Browser tests: `e2e/*.spec.ts` with `playwright.config.ts`; run `npm run test:e2e` after a build (see "Tests" below).

## Before pushing

- Run `npm run lint`, `npm run typecheck`, `npm run build` and then `npm run test:e2e`.
- Check pages in a browser with Playwright: EN/AR × light/dark × desktop/mobile, console errors, and
  sideways overflow. In cloud sessions Chromium is at `/opt/pw-browsers`. An axe-core audit (installed
  in the scratchpad, not the project) is a cheap extra check.

## Modern Commerce design in production (Stages TM-1 and TM-2)

- One production design since TM-2.6. `src/app/(commerce)/[locale]/layout.tsx` is the website's root layout (its
  stylesheet, fonts, boot script, ambient, pointer and motion controller) for every page; the theme lab keeps its own
  root layout, and the fallback 404 (`src/app/global-not-found.tsx`) its own document. Links are plain `<a>` (no
  `next/link`, no prefetch): do not convert the site to `<Link>` without a brief. New components outside
  `components/commerce` or the route group need an `@source` line in `commerce.css`.
- Styles: `src/app/(commerce)/commerce.css` (Tailwind `source(none)` with `@source` on `components/commerce` and the
  route group; base layer, reveals, view transitions, `.shell`, `.mc-icon`, skip link) and
  `src/components/commerce/system.css` (A V2's `a2.css` converted: every token and component scoped to `.mc` on
  `<body>`, dark tokens under `html[data-theme="dark"] .mc`, lab-only parts — sheet frames, forced-theme samples,
  replay buttons — left out, nav active state keyed on `aria-current="page"`). Class names keep the `a2-` prefix
  shared with the lab. `Icon` renders `mc-icon lab-icon` (each design styles its own class; drop `lab-icon` when the
  lab is deleted). Page stylesheets beside their components: `services/services.css`, `projects/projects.css`,
  `capabilities/capabilities.css`, `project-detail/project-detail.css` (never in `system.css`, see the chunk-size
  gotcha).
- Fonts (`src/app/(commerce)/fonts.ts`): Plus Jakarta Sans (English display) and Inter (English text) preloaded;
  Tajawal 500/700/800 (Arabic display) and IBM Plex Sans Arabic 400/500 (Arabic text) not preloaded (one root layout
  serves both languages); technical figures use the system monospace stack. Variables `--font-mc-*`. Arabic is never
  letter-spaced (`:lang(ar)` rule in `commerce.css`). `global-not-found.tsx` uses its own copies of the same four
  faces with `preload: false` (`src/app/global-not-found-fonts.ts`): with `experimental.globalNotFound` a preload
  declared there reaches every page, the lab included (TM-2.6 measured none). next/font names a preloaded file
  `….p.woff2` and a non-preloaded one without `.p`, so the fallback's Latin faces are separate files from the
  layout's (only the fallback page ever loads them).
- Theme: `src/lib/commerce-boot.ts` (inline in `<head>`) sets `js` and applies the stored theme under the website's key
  `rawasy-theme` or the system setting (the session intro flag `rawasy-intro` was retired with the loader in TM-2.6).
  Page colours `PAGE_COLORS` in `components/commerce/data.ts` (light `#f4f4f1`, dark `#131820`) feed the viewport
  `themeColor`, and `ThemeSwitch` updates `meta[name="theme-color"]`. Without JavaScript the page is light.
- First jump to an address's anchor (the TM-2.5 shared fix, every MC page): `commerce.css` sets `scroll-behavior: smooth`
  only on `html[data-smooth-scroll]`, which `commerceBoot` adds after the load event, `document.fonts.ready` and two
  frames (`BootFallback` runs it on a page that has already loaded). Until then jumps are instant, and Chromium keeps an
  instant fragment jump on its target through layout changes until the load event, so late fonts no longer leave a
  landing short (a smooth first jump kept its first destination). Same-page links glide afterwards, as before; reduced
  motion keeps `scroll-behavior: auto`. Without script the attribute never comes and jumps stay instant: a font that
  swaps in after the load event can still move a no-JS landing (3 of 36 cold-load cells measured in TM-2.5, 13 before).
- Shell (`components/commerce/shell/`): `Header` (real routes, Services menu of the six services + "All services" +
  quote, `aria-current="page"`, language, theme, quote, phone menu sheet), `Footer` (real routes, both phones,
  email, WhatsApp, address, legal pages, back to top), `PageShell` (skip link, header, `<main id="main">`, footer),
  `LocaleLink` (a plain `<a>` to the same page in the other language that sets the `NEXT_LOCALE` cookie).
  `getShellView(locale, { route, path })` builds everything the shell needs from the content layer. Every quote
  action goes to `href(locale, "contact", { hash: "quote" })`, the hero's "Start a Project" included (the user's
  navigation correction); its secondary action still scrolls to `#machinery`.
- Shared polish (TM-3, CSS only):
  - The inner pages' hero (`.ip-hero`: the kit's `PageHero` and the service pages' `ServiceHero`) shows with the first
    paint: a rule after the reveal rules in `commerce.css` keeps `[data-reveal]` inside `.ip-hero` at opacity 1 / no
    transform, except the line drawings and the laser signatures (`.sv-draw`, `.sv-axis`, `.sv-bubble`, `.sv-cut-sheet`,
    `.sv-plate-stage`), which still draw in once the script runs. The markup keeps its `data-reveal` attributes (so the
    served HTML stayed identical). Write such exclusions as chained `:not()`, never a `:not()` list (gotcha below).
  - The phone menu sheet: its `nav` is the scroll area (`.mc .a2-sheet > nav { min-height: 0; overflow-y: auto }`), the
    foot with the quote button sits below it, so nothing ever passes under the foot, a row reached with the keyboard is
    scrolled into full view, and axe's target-size rule passes with the Services list open. The sheet itself no longer
    scrolls; the page behind stays locked by the `html:has(… [data-menu][open])` rule.
  - Forced colours: every `.a2-toggle` (the homepage's and the Clients page's switch) draws its track, dot and pressed
    fill in system colours (the forced-colours block at the end of `system.css`'s components layer); outside the layer
    (so no utility wins), the brand logo in the header and the footer takes `CanvasText`, the header's current page and
    section marks (`.a2-nav .nav-link`, `.a2-sheet-row`, `.a2-dd-item` with `aria-current`) are underlined, and the
    current language and the pressed theme button take `Highlight` / `HighlightText` (as the projects' pressed chips do).
    Normal colours are unchanged.
- Homepage sections (`components/commerce/home/`): Hero (+ capability strip), About, Services (the two signatures
  lead), Machinery (`MachineShowcase`), Projects, Industries, Clients + Compliance (one sheet), Contact;
  `getHomeView(locale)` in `home/data.ts`. Markup follows the lab's `HomeA2.tsx` one to one (proved by diffing the
  server HTML: only routes, `aria-current`, the added footer WhatsApp link, the copyright period, the hero's primary
  action and the project cards differ). Industries (TM-3 corrections 1 and 2): below 27 rem its two lists stack in one
  column (`max-[27rem]:grid-cols-1` on the two `ul`s, built as `@media not all and (min-width:27rem)`); two columns from
  27 rem (432 px), four from 1024. Derived from measurement: a phone card sets its name beside the 36 px icon chip, so it
  needs the name's longest word plus 72 px (borders, 12 px padding, chip, 10 px gap); two cards hold "Manufacturing" from
  422 px in Plus Jakarta Sans and from 432 px in the widest fallback face measured (DejaVu Sans, where `local(Arial)`
  is missing); 360–421 px let English names run up to 17.9 px past their card before (correction 1's 22.5 rem rule).
  Arabic names are shorter but take the same columns.
- The six homepage project cards open the Projects overview at its gallery (`href(locale, "projects", { hash:
  "gallery" })`, label `home.projects.inGallery`: "View in the gallery" / "عرض في معرض الأعمال"), never a project page.
  Per-project anchors were measured and rejected: the gallery's sticky filter bar (69 px, 117 px where its chips wrap)
  would cover the top of the target card, and a clean landing needs ids plus an offset or script. TM-2 decision D4
  keeps these six homepage links unchanged, and the Stage 1F brief kept them on `#gallery` (the homepage is frozen).
  Since TM-2.5 the migrated gallery has an anchor per project (`#<slug>`), which About and the service pages use.
- Motion: `components/commerce/Motion.tsx` is the production controller (reveals, `data-scrolled`,
  `data-scrolling` cleared 200 ms after the last scroll, menus and dropdowns with Escape / outside click / focus
  return and closing when keyboard focus leaves them, the sheet's `--menu-top`, toggles, `data-past-hero`, `data-live` on `[data-ambient]`); no scroll-spy or
  parallax (the header links pages now). `Ambient`, `Cursor` (scoped to `.mc`), `HeroPlate`, the signatures
  (`useSignature`, `LaserCut`, `LaserEngrave`, `signature.css`), `MachineShowcase`, `ThemeSwitch`, `Icon` and `ui`
  live in `components/commerce/` and the lab re-exports them: one implementation, one animation controller.
- Inner pages (TM-2.1): the kit is `components/commerce/inner/` — `PageHero` (compact / split / stacked; text on an
  `.a2-read` zone; breadcrumbs, eyebrow, the one `h1#page-title`, lead, a `dl` of page facts, actions), `Breadcrumbs`,
  `ContentsNav` (client; the shared `useScrollSpy` marks the section with `aria-current`; pinned from 64 rem below the
  header, a disclosure button with `aria-expanded` / `aria-controls` above the text on smaller screens, simply open
  without script), `Document` (`DocSection` = `section#id` + numbered `h2#id-title`, `Prose`, `PendingNote` =
  `role="note"` with its text label and a brass edge), `ClosingCta` (first used by the TM-2.3 pages; the legal pages
  have none),
  `NotFoundView` and `BootFallback`. Its styles are the "Inner pages (Stage TM-2)" block (`ip-*` classes) at the end
  of `system.css`'s components layer; nothing earlier in the file changed. `components/commerce/legal/LegalPage.tsx`
  renders Privacy and Terms from `src/content/legal.ts` (routes `(commerce)/[locale]/privacy|terms/page.tsx`, metadata
  and JSON-LD still from `innerPageMetadata` / `innerPageJsonLd`).
- Contact (TM-2.2): route `(commerce)/[locale]/contact/page.tsx` → `components/commerce/contact/ContactPage.tsx`: the
  split `PageHero` with a "Direct contact" card of `ContactRow`s (`ContactRows.tsx`: both phones, WhatsApp, email, the
  address → `#location`; the action word is visually hidden on rows narrower than 24 rem, the arrow stays; emails may
  wrap only after "@"), `section#quote` on a muted sheet (how it works, the no-backend note, the form card; no reveal
  there, so every quote action lands on a form that is already shown), and `Location.tsx` (`section#location`: the
  address card and the map; the iframe's attributes, `maps.ts` URLs and both links are the previous design's,
  byte-identical; the frame's own surface shows the address until the map loads). `FormIcon.tsx` holds the four form
  glyphs (kept out of `Icon.tsx`, which the homepage bundles). `FramePointer.tsx` marks `html[data-cursor-away]` while
  the mouse is over an iframe (the page receives no mouse events there), which hides the MC pointer; `Cursor.tsx` is
  unchanged. Styles: the "Contact page (Stage TM-2.2)" block (`cp-*`, `qf-*`) at the end of `system.css`'s components
  layer.
- About, Industries, Clients, Certificates (TM-2.3): routes `(commerce)/[locale]/{about,industries,clients,certificates}/
  page.tsx` → `components/commerce/{about/AboutPage, industries/IndustriesPage (+ SectorIndex, client), clients/
  ClientsPage, certificates/CertificatesPage (+ DocumentRegister, client)}.tsx`. Copy and data are the previous design's,
  unchanged (one added label: `about.machinery.notStated`, the screen-reader text for an unstated power); the numbering
  (01, 02 …) and the clients' names under their logos were kept for parity, numbers `aria-hidden` where the previous
  page hid them. Kit additions: `inner/Figure.tsx` (a photo never wider than its source: `max-width` = source width)
  and `inner/useDialogPointer.ts`. Photos are never shown above their source size (the previous design enlarged some
  up to 1.7×); the Industries strip tiles stay ≤ 253 px; the preview images are `min(100%, source px)`.
  - Certificates: only the redacted files, as they are (hashes checked in `commerce-certificates.spec.ts`, which also
    fails on any run of 7+ digits, grouped digits, ISO dates or expiry words in the page; never weaken it). Previews go
    through the optimizer at the previous design's `sizes` and q=75, and a CSS cap derived from the previous grid
    (1520 px container, the old gutter clamp, 24/32/48 px card padding, 5 of 12 columns, 78 % / 82 % plate) keeps every
    card and dialog preview at or below the previous size (`certsize.js` in the TM-2.3 proofs). No filter, transform,
    zoom or reveal on a certificate image. The native `<dialog>` opens with `showModal()` from links to the raw files
    (no-JS fallback), is labelled by its `h2`, closes with Escape, the close button or the backdrop, returns focus,
    puts the Arabic version first on `/ar`, and its body is a focusable labelled group (it scrolls). The register's
    anchored cards carry no reveal (its transform moved them after the jump).
  - The dialog and the pointer: a modal dialog sits in the top layer above the MC pointer, so `useDialogPointer` marks
    `html[data-cursor-modal]` while one is open (the pointer fades out) and unlayered rules give the dialog, its
    backdrop and its contents the system cursor back (`cursor: auto` on the dialog, `cursor: revert-layer` on its
    descendants so buttons keep the hand).
  - Clients: the homepage's wall pattern (colour files under a CSS greyscale, colour on hover and with the
    `aria-pressed` switch, `.cl-toggle` adds forced-colours drawing); 2 / 4 (48 rem) / 6 (64 rem) columns with
    `planSpans`, never mirrored; each tile a logo box (`.cl-logo`, one fixed grid track) and the name; no counts, claims
    or numbering.
  - Styles: the "About, Industries, Clients and Certificates (Stage TM-2.3)" block (`ip-index/-down/-figure/-table`,
    `ab-*`, `in-*`, `cl-*`, `ct-*`) at the end of `system.css`'s components layer, plus its forced-colours rules and the
    unlayered dialog cursor rules after the layer; nothing earlier changed.
- Services (TM-2.4): routes `(commerce)/[locale]/services/page.tsx` → `components/commerce/services/ServicesPage.tsx`
  (split `PageHero` with six jump tiles, `ContentsNav` index beside six `ServiceRow`s, `ClosingCta`) and
  `(commerce)/[locale]/services/[slug]/page.tsx` (`generateStaticParams` = locales × the six slugs, `dynamicParams =
  true`, `notFound()` for an unknown slug, metadata as in 1D) → `ServicePage.tsx`. 1D's content, section order and
  conditions are kept (`looks.ts` per service: hero picture, scope/process/gallery layouts, icons; `parts.tsx`
  `SvSection`/`SvHead`/`surfaceAt` alternate plain/muted/raised sheets; `ServiceBlocks.tsx` holds the sections;
  `ServiceHero.tsx`, `HeroVisual.tsx`, `ServiceCta.tsx` with quote, call and onward links, no floating WhatsApp).
  Laser Cutting and Laser Engraving (and the overview's engraving row) render the homepage's `LaserCut` /
  `LaserEngrave` unchanged, sized by their stage (`.sv-cut-sheet`, `.sv-plate-stage`, `.sv-row-sig`), the host
  `[data-sig-host]` being the hero or the row; the four other drawings are restyled MC copies in `drawings.tsx`
  (`PressBrake`, `AxisGrid`, `WeldSeam`, `ScaffoldTower`) that only draw on reveal (inherited `--draw`, armed under `.js`
  + motion allowed; the axis lines scale in through unlayered rules) and `glyphs.tsx` (profile, fold, engraving motif).
  Photos never above their source size; captioned photos have `alt=""` (the caption names them); the flagged
  engraving photos are never built (D6). Project cards reuse About's `ab-proj` card and open `/projects#<slug>` since
  TM-2.5 (`#gallery` before; "View in the gallery", D4); machines link `/capabilities#<slug>` (D5); power only where the profile states it.
  - Styles: `components/commerce/services/services.css`, imported by `ServicesPage.tsx` and `ServicePage.tsx` only, its
    rules in the same `components` layer plus two unlayered axis rules. Never put them in `system.css`: the extra
    24 KB pushed the layout's stylesheet past Turbopack's chunk size (≈130 KB merged before, 154 KB after) and split
    it into two files on every MC page, homepage included (one more request, a changed `<head>`). Since the move
    `system.css` is byte-identical to TM-2.3's and the MC sheet only gained the utilities the service components use.
  - Header and footer: on a service page the Services summary carries `aria-current="true"` (the section) and the
    service's dropdown/sheet item `aria-current="page"`; the footer marks the service link. All through conditional
    spreads (`herePage`), so the other pages' payloads stay identical; the overview keeps the frozen header's own mark
    (the summary as the page).
  - `services/[slug]/not-found.tsx` re-exports `(missing)/not-found`: an unknown slug answers 404 with the MC localized
    404 (browser-built, like the catch-all). The boundary rides in the six service pages' payloads only (≈49 KB raw /
    11 KB gzip resolved each); the homepage, the overview and every other page are unchanged.
- Projects overview (TM-2.5): route `(commerce)/[locale]/projects/page.tsx` → `components/commerce/projects/
  ProjectsPage.tsx` (server; `data.ts`: `projectView` = the previous card's data from `projectCard()` without its link,
  `filterOptions` = the classifications with a showcased project; tones `eng/proc/craft` → `steel/teal/brass`). The
  previous page's order: split `PageHero` (the quick category toggles as its action, three prints as its aside), the
  featured project (dark panel), the highlights (`a.card-link` cards, muted sheet), `section#gallery` (bar + wall,
  `Gallery.tsx`), the index (`ol` of `#<slug>` links) and `ClosingCta`. Copy, references, categories, photos and order
  are the content layer's; the blueprint decoration is retired (D8). No link to `/projects/<slug>`: the featured
  project, the highlights and the index jump to `#<slug>` ("View in the gallery"); a gallery card is not a link and
  takes no focus.
  - The choice (`Gallery.tsx`, client): `ProjectFilterProvider` holds one choice for the hero's `QuickFilter` and the
    bar (`role="group"`, `aria-pressed` buttons, a check marks the pressed one, not colour alone; a polite live region
    says "Showing: …"). The page always opens on "All" (nothing stored), so `#gallery` and an address's `#<slug>` find
    every project. Items the choice leaves out are `hidden`. A link to a hidden project clears the choice first (a
    capture-phase document click listener with `flushSync`, before the browser's own jump: no scrolling of ours); an
    address or history entry naming one clears it on `hashchange`, then `scrollIntoView`. Never scroll to an item while
    it is `hidden`; no per-breakpoint `scrollTo` arithmetic.
  - The bar: `.pj-bar`, sticky at `top: var(--hh)`, one row of fixed height (`--pj-bar-h: 3.5rem` on `.pj-gallery`),
    opaque, no blur; its chips never wrap and scroll sideways. The landing under it is CSS only:
    `.js .mc :is(.pj-list, .pj-item) { scroll-margin-top: var(--pj-bar-h) }` on top of the page's `scroll-padding-top`,
    so a project lands 16 px under the bar at every width. Without script the bar and the quick toggles are not drawn
    (`data-js-only`, the MC attribute; the previous design's `js-only` class is not styled in the MC sheet), no margin
    is added and every project shows.
  - A choice re-flows the wall with `document.startViewTransition` + `flushSync`; the items carry names (`--vt-name`)
    only while `:root[data-vt="gallery-filter"]` (unlayered rules), so the theme switch and page changes never capture
    27 elements. With reduced motion, without the API, from the quick toggles, or while the bar is pinned over the wall
    (the wall then restarts under the bar with an instant `scrollIntoView`) the choice applies at once.
  - The wall: CSS columns 1 / 2 / 3 / 4 (40 / 64 / 80 rem), `break-inside: avoid`, no reveal on items (links land on
    them). Photos never above their source size: single photos `width: min(100%, <source> px)`, pairs
    `flex: <ratio> 1 0` with `max-width` = source, prints `max-width` = source (`Prints`: extra prints at 78 %, at most
    30 % of the lead photo).
  - Styles: `components/commerce/projects/projects.css` (9.6 KB built, with the chips' forced-colours rules), imported by
    `ProjectsPage.tsx` only, like `services.css` (never in `system.css`).
  - D4 elsewhere: About's four cards and the service pages' project cards link `href(locale, "projects", { hash: slug })`
    (href only; their pixels did not change). The homepage's six cards keep `#gallery`.
- Capabilities & Machinery (Stage 1E): route `(commerce)/[locale]/capabilities/page.tsx` (static, `innerPageMetadata`,
  `PageShell` with `sameAddressLink={MachineAddressLink}`) → `components/commerce/capabilities/CapabilitiesPage.tsx`
  (server). Data: `data.ts` `getCapabilitiesView(locale)` reads `getCapabilitiesPageContent()` (machines.ts + the page's
  copy in `src/content/capabilities.ts`, which holds labels and notes only, never machine facts) and puts the machines
  in `MACHINE_ORDER`, the homepage showcase's order (combo, tube, 6 kW, 3 kW, press brake, welding; machines.ts keeps
  the profile's). Parts in order: the split `PageHero` (facts 06 machines · 04 laser cutting systems · 12,000 W peak,
  the reused wording; `FleetPlate` aside: six bays on a graphite plate, each a `#<slug>` link), `#power` (`PowerChart`:
  bars for the four rated lasers, the two others listed in words, never a 0 bar), `#console` (`MachineConsole`),
  `#register` (`Register`: a `table` with a sr-only caption, `th scope` cols/rows from 64 rem, one labelled card per
  machine below), `#service-lines` (the three services and their machines), `#source` (the source note), `ClosingCta`.
  JSON-LD: CollectionPage (tied to the site's organization) + BreadcrumbList + an ItemList of the six names and
  `#<slug>` URLs, no specifications.
  - Facts: only the records' fields; power only for the four lasers ("Not stated in the company profile" for the press
    brake and laser welding, everywhere), no sums; page 7 prints only names (power inside four of them) and photos, so
    the types, capability sentences and services are the records' wording and the copy never calls them the profile's
    (a sentence that did was corrected before review). Never name a maker: some cut-outs show maker markings.
  - The console (client): plain links `a.cm-pick[href="#<slug>"]` in `nav[aria-label]` (no tabs widget); each machine an
    `article#<slug>[data-machine]` panel (raw slug ids, never prefixed). The address is the state: `useSyncExternalStore`
    over `location.hash` (server snapshot `null` → `data-ready` only once hydrated); a choice is
    `history.replaceState` + the `mc:machine` event (`machine-address.ts`), announced in a polite live region; hidden
    panels are `inert`; `aria-current="true"` marks the pick. Machine links elsewhere on the page are plain fragment
    links (a history entry each). Before hydration CSS shows the `:target` panel or the first; transitions are keyed on
    `[data-ready]` and live inside `prefers-reduced-motion: no-preference`. Panels share the console's grid tracks
    (subgrid: rail | stage | data), so a landing shows the selector and the stage together.
  - Cold addresses (`/capabilities#<slug>`): the browser's own fragment jump with the TM-2.5 rules (no script scroll).
    Two fixes keep it exact with late fonts: the selector's first sideways scroll (phones) waits for
    `html[data-smooth-scroll]` (a MutationObserver, no timer), and `.cm-rail ol { overflow-anchor: none }` (see gotchas).
  - Without script the console is a list: every panel with its own stage (`html:not(.js) .mc .cm-shot`), photo, facts and
    links; the picks jump to the panels. Language links: `MachineAddressLink` (client, passed only by this route) keeps a
    machine fragment (`/en/capabilities#fiber-laser-6kw` ↔ `/ar/capabilities#fiber-laser-6kw`) in all three header
    switches; it derives the path from `usePathname` and never imports `@/i18n/routes` (that re-split shared chunks on
    other pages). `Header.tsx` hands a given `sameAddressLink` to every switch, not only on an unknown address (the 404
    behaves as before; other pages pass none).
  - The stage (`capabilities.css`, imported by `CapabilitiesPage.tsx` only, `cm-*` classes; `sk-*` for `Schematic.tsx`):
    graphite in both themes (lighter edge on dark), a local grid (24/96 px, masked) and a floor axis with unnumbered
    ticks (no figures, no X/Y), the photo on its floor (`MachinePhoto`: width = min(box, source, box height × ratio), one
    `sizes` for every instance so each file loads once, never above its source), an orange floor line drawn from the
    centre, a readout, an index chip and a source chip, the `aria-hidden` process sketch (five kinds, captioned
    "illustrative, not to scale", plays once per showing, finished with reduced motion / no script, not mirrored in
    Arabic) and the scan line (`.cm-scan`: `translate` + opacity only, one pass per showing, paused off screen through
    `--cm-play` / `[data-live]`, not drawn at rest, without script, with reduced motion or in forced colours). Machine
    changes: opacity and `translate` only. Forced colours: the chosen pick gets a `Highlight` ring on `::after` and an
    underlined name; bars in `CanvasText`; the sketch in system colours.
  - Tests: `e2e/commerce-capabilities.spec.ts` (72): content and publication, structured data, six-record parity, the
    power rule, the unstated-specification guard (per text node), photos (alt, loaded once, ≤ source at six widths, not
    mirrored), the console (choose, keyboard, a 20-cycle stress test with the page's own listeners compared by type and
    source, Back/Forward, pre-hydration, language switch EN/AR in all three switches, theme, Arabic faces, phone rail),
    the 12 cold addresses × desktop/phone × fonts +300/+1200 ms, every machine link from the homepage showcase (6 × 2) and
    the service pages (6 × 2) followed and landed, the homepage machinery files' hashes, decoration hidden, reduced
    motion, forced colours, no-JS, twelve sizes.
- Project pages (Stage 1F): `(commerce)/[locale]/projects/[slug]/page.tsx` (`generateStaticParams` = locales × all 34
  records, `dynamicParams = true`, `notFound()` for an unknown slug; metadata: the record's title and summary, canonical,
  hreflang, `noindex, follow`; JSON-LD: WebPage + BreadcrumbList only) → `components/commerce/project-detail/
  ProjectDetailPage.tsx` (server, no client code) with `data.ts` (`projectDetailView(content, locale)`: the record only).
  One page, three variants from the data: several photos (the first leads the hero beside the text, the others follow in
  "More photographs", never repeated), one photo, no photo (a text hero with the source plate: "Company profile" and the
  gallery reference set as type, no picture or stand-in). The kit's `PageHero` (split; shows with the first paint) holds
  the breadcrumb, eyebrow "Selected work", the title, the record's summary exactly, the facts (Classification: the
  record's categories with `projectCategories` labels; Related services: the record's services, linked) and the ways
  on (quote `/contact#quote`, Back to Projects); the gallery reference is the lead photo's caption or the plate:
  "Company profile · Ref. 04", "… · p.3" (raw value, left to right; never "project/job number"). Optional details
  (client, location, year, materials, scope; description, challenge, solution) render only for fields a record holds
  (none yet: the part never shows; never "—", "N/A", "Not stated"). `ClosingCta`: quote, Back to Projects, services.
  - Photos: `projectDetailMedia(project)` in `projects.ts` — none if any flag other than `ai-watermark` (so
    `confirm-authorship`, `render` and any flag added later hold every photo back), otherwise `projectImages` (withheld
    files excluded). Never another project's photo, a render, a stand-in or a generated image. Each photo shows at most
    at its source size (the `img` keeps its width attribute, `max-width: 100%`; frames fit the photo), alt text from
    approved text only: the title, or "title, photo n of N".
  - Never rendered: the record's `note`, its `flags` (no badges, no ownership talk), any detail it does not hold.
  - Styles: `project-detail/project-detail.css` (`pd-*`), imported by the page component only; it also carries the
    header's Projects section mark (`aria-current="true"`, moved from the retired `planned.css`).
  - The overview's gallery cards carry one "View project" link each (`a.pj-card-go`, an sr-only suffix names the
    project); the card itself is no link. `projects/[slug]/not-found.tsx` re-exports `(missing)/not-found` (an unknown
    project slug, a real 404 in this design; deeper paths reach the catch-all).
- The fallback 404 (`src/app/global-not-found.tsx`, TM-2.6): one bilingual page in the MC look (its own
  `global-not-found.css` with the MC tokens written out, light and dark via `data-theme`, the MC faces without preload,
  the boot script): one `h1` with both languages, a `section[lang][dir]` per language with its `h2`, home and contact
  links. Next.js builds it as `/_not-found` (404); no address reaches it today (the proxy gives every address a language,
  and its excluded paths — `/api`, `/media`, `/_next` … — get Next.js's own minimal 404, unchanged), so `site.spec.ts`
  checks it from the build output. In forced colours its logo takes `CanvasText` (`@media (forced-colors: active)` in
  `global-not-found.css`, TM-3 correction 1), like the site's header and footer logos since TM-3.
- The localized 404: `(commerce)/[locale]/(missing)/[...rest]/page.tsx` (the catch-all, `notFound()`) and
  `(missing)/not-found.tsx`. The `(missing)` group is deliberate: a `not-found.tsx` beside the layout is rendered into
  the payload of every page under it (it added ~52 KB raw / 7.8 KB gzip to the homepage). A route that calls
  `notFound()` (the service slugs since TM-2.4, the project slugs since TM-2.6) needs this boundary above it or its own;
  check the homepage payload after.
  The 404 uses `getShellView(locale, { route: null, path: null })` (nothing marked current) and passes `SamePageLink`
  (client, `usePathname`) to `PageShell`'s `sameAddressLink`, so its language switch keeps the unknown address and no
  other page loads that code. The header renders `LanguageSwitch` in three places (desktop bar, compact phone control,
  menu sheet): `sameAddressLink` must reach all three (the sheet's was missed in TM-2.1 and fixed in correction 1;
  `commerce-inner.spec.ts` tests the sheet's on the 404). The footer marks the current page with
  `aria-current="page"` through a conditional spread (no `$undefined` props, so the homepage payload stays identical).
- Tests: `e2e/commerce-home.spec.ts` (the homepage) with probes shared with the lab spec in `e2e/a2-helpers.ts`;
  `e2e/commerce-inner.spec.ts` (the kit, Privacy, Terms, the 404 and its real HTTP status matrix);
  `e2e/commerce-contact.spec.ts` (Contact: explicit golden outputs of the email, WhatsApp and copied text, the form,
  files, the real no-JS mailto submission through CDP `Page.frameRequestedNavigation`, the map, the pointer over the
  frame, `#quote` / `#location` landings, RTL); `e2e/commerce-company.spec.ts` (About, Industries, Clients: parts and
  order, D4 links, the machine table, photo scale, faces, the preview, the wall and its tiles, the switch in forced
  colours, no-JS; and, on all four pages, nothing spilling out of or cut off by its box);
  `e2e/commerce-certificates.spec.ts` (file hashes, the digit guard, register, anchors, previews no larger than before,
  the dialog with keyboard, backdrop, Arabic-first, no-JS, and the pointer with mouse, keyboard, touch, reduced motion
  and Arabic); `e2e/commerce-services.spec.ts` (the overview and six service pages: routes and SEO, the dynamic route's
  language switch, 404 and page-data answer, sourced relations, D4/D5 links, the process note,
  imagery and source size, the unforked signatures and their replays, the four drawings, reduced motion, no-JS,
  layout, anchors, keyboard, pointer); `e2e/commerce-projects.spec.ts` (the projects overview: parts and order, the 27
  projects and their ids, withheld photos, featured/highlights parity, SEO, the index, `#<slug>` and `#gallery` arriving
  unfiltered, the hidden-target click, landings clear of the header and bar, cold loads, D4 on About, the service pages
  and the homepage, project pages linked only by the cards' "View project" (one per showcased project), the built
  project pages, the shared choice, keyboard, the one-row bar at eight widths, Arabic, the wall's columns, each card's
  one link in the tab order, photo source size, focus = hover, the ambient, reduced motion, no-JS); `e2e/commerce-anchors.spec.ts` with `e2e/anchor-helpers.ts` (the first-jump fix: fresh
  context, fonts held back 300 / 1200 ms, 1440 and 390, on Contact, the legal and two service pages; same-page glide,
  history, reduced motion, no-JS); `e2e/commerce-capabilities.spec.ts` (Stage 1E, see "Capabilities & Machinery" above);
  `e2e/commerce-project-detail.spec.ts` (Stage 1F, replacing `commerce-planned.spec.ts`: the 34 records and the photo
  rule by flag (a flag added later included), the optional-detail rule on made-up records, all 68 pages served (status,
  title, description, canonical, hreflang, noindex, WebPage + BreadcrumbList only), each page and its page data
  referring to exactly its allowed photos, no note or flag anywhere, the sitemap, every page in the browser (title,
  summary, classifications, services, reference, photos in order with their alt, headings, no unconfirmed detail, ways
  on, language switch), each flagged project's requests, the wheat monument, photo source size and frames at 1440 and
  390 on every page with photos, Arabic order and faces, the header mark, the quote link and an empty form, the phone
  sheet, twelve sizes, light/dark, forced colours, reduced motion, no-JS, the unknown-project 404); `e2e/commerce-polish.spec.ts` (TM-3: the switch, the logo and the header's marks in
  forced colours, the inner pages' hero with its script blocked and frame by frame, the phone menu sheet's geometry,
  keyboard order and target sizes at 390 / 360 / 320 and 200 % zoom; corrections 1 and 2: the homepage's Industries cards
  at 320, 360 and 390 px in EN/AR × light/dark, around the 27 rem boundary and at common widths, a sweep from 320 to 1440
  px every 4 px, and the fallback face — each checking the page, every card and its share of the row, every text drawn
  and inside its own box and its card, the icon and overlaps, not only the column count); `e2e/site.spec.ts` (internal
  links, nothing of the
  previous design on any page and no prefetch, which addresses reach which 404, the fallback 404 from the build output,
  and since correction 1 its logo in forced colours in four palette/theme pairings, its normal-colour pixels with and
  without that rule, and its isolation); `stage-1c.spec.ts`'s generic
  inner-page checks (routes and SEO, breadcrumbs, overflow, reduced motion, no JS) still cover every inner page through
  `INNER_PAGES`. `redesign-v2.spec.ts` and `visual-system.spec.ts` retired with the previous design (TM-2.6 report:
  assertion map).

## Theme lab (Modern Commerce exploration)

- Since TM-1 the A V2 modules the homepage uses live in `src/components/commerce/` (paths below such as
  `a2/HeroPlate.tsx`, `a2/Ambient.tsx`, `a2/Cursor.tsx`, `a2/ThemeSwitch.tsx`, `a2/MachineShowcase.tsx`, `Icon.tsx`,
  `ui.tsx` and `signature/` are now the lab's re-exports: edit the commerce files). `lab.css` lists them with
  `@source` so the lab's utilities stay complete. The site carries the design everywhere since TM-2.6; the lab stays,
  working and unchanged, until the user authorizes its removal.

- Routes: `/theme-lab/{en|ar}/modern-commerce-{a|a-v2|b|c}` and `…/system`, under their own root layout
  (`src/app/theme-lab/[locale]/layout.tsx`, `lab.css`), so no site header, footer or site CSS.
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
  `useSignature(…, { replay: false })`; the mouse leans it (inline transforms) and reads X / Y. The cut loops
  (`loop: 10000` in its run): every animation spans exactly one cycle (`animate(el, LOOP, …)`), resets
  (`fill: "forwards"`, from `RESET` = 9.4 s) close the openings and fade the measurements back to the first frame,
  and on the clock's `finish` the hook restarts the same Animation objects with `startTime = last start + loop`
  (phase-locked, no drift; more than 250 ms late starts now). The plate's rise is intro-only (`keep`, its own
  760 ms). `data-cycle` counts cycles. The readout sleeps between changes (the marks, the end of the cut, the
  reset) with a timer, then the next frame; the hook calls `onChange` at each start, and at each rest and resume
  once it has taken effect (`Animation.ready`: a pause lands on the next frame, so reading the clock at once is a
  step behind).
  `Cursor.tsx` is the desktop-mouse pointer (`html[data-cursor-on]`, set only once the mouse moves;
  touch, pens, reduced motion and forced colours keep the system cursor; text fields keep the I-beam).
  `--shell: min(1400px, 92vw)`; `.sec-sheet` (`.sec-muted`, `.sec-raised`) and the footer are sheets
  inset `--sheet-m` from the screen edges. (Pass 2's page dot matrix, hero grid and footer grid were replaced
  by the site-wide ambient below.)
- A V2 site-wide ambient (`a2/Ambient.tsx`, "Site-wide ambient" in `a2.css`): one fixed layer inside
  `.lab-a2` (isolated) at `z-index: -1`, so page colour → ambient → sections → content → header/pointer. The
  container paints nothing; two children move. `-field` is the surface: one opaque layer with the page colour, the
  micro-dots (2.3 px every 24 px) and the colour (warm, steel and a little teal as three radial gradients, `cq*`
  sized, mirrored in Arabic), `inset: -48px`; it drifts 48 × 24 px in 2 × 1 px `steps(24)` over 32 s and breathes
  0.7–1 in `steps(28)` over 28 s over the page colour. `-sweep` (above it) is the light: an SVG data-URI band of
  orange dots on the same grid (`--amb-sweep-img`), moved in 24 px steps (`transform`) across the screen every 26 s
  (rests 20 %, crosses in 50 %; reversed in Arabic; `--sw-w` / `--sw-n` / `--sw-steps` per breakpoint) and given
  the surface's drift on the same clock (`translate`), so its dots stay on the surface's dots. Tokens
  `--amb-dot/-sweep-img/-warm/-cool/-teal`. Text stays clear structurally: sheets are 88–92 % opaque
  (`--sheet-muted-a` / `--sheet-raised-a`), cards stay opaque, and text on the open sections sits on `.a2-read`
  reading zones (a `::before` of page colour at `--read-a` 90 %, feathered by `--read-x` = min(1.5 rem, gutter)
  so it never passes the screen edge; the sheet page's `main.shell` keeps its zone inside itself); `SectionHead`
  takes `read`. The hero glows are still. The dark contact panel and the footer carry their own still dots. Sheet
  frames: `<AmbientA2 frame={seconds | "still"} />` holds both layers' animations with `--at` and places the band
  with `--f` (`round(down, …, 24px)`). It rests while the page scrolls (LabMotion's `html[data-scrolling]`, cleared
  200 ms after the last scroll); phones fade the colour to 70 %, drop the teal, halve the drift and use a 384 px
  band; reduced motion holds it still (the surface at full strength, the band off screen).
- A V2 performance rules (measured in pass 2): nothing inside the plate SVG animates continuously (the
  hot points' breathing is HTML over it) and the SVG carries no filter; the shadow is a static
  drop-shadow rastered with the plate; no `backdrop-filter` or `will-change` + `filter` on layers that
  sit under continuous animation (both are re-applied on every compositor frame); the lean is inline
  transforms on the plate (`will-change: transform`) instead of a custom property on the hero (that
  restyled the whole SVG per mouse move); write the readout only when it changes.
- Ambient performance (headless Chromium = software compositing, the worst case): an animated fixed layer
  between the page colour and the content moves the page content into its own composited layer (reason
  "Overlap"), so every frame blends the content over the background. Each extra full-screen layer is one more
  blend: a still dots layer under a translucent colour layer scrolled at 52 fps, the same look as one opaque
  surface at 55 (Pass 2: 55–56). Sub-pixel movement (smooth easing, `scale`) makes a moving layer a filtered redraw
  on every frame; whole-pixel `steps()` moves cost almost nothing (46 vs 59 fps for the same structure), and a
  layer resting at a fractional device pixel (125 % / 150 % zoom) costs nothing extra. Never put `opacity` on a
  layer whose child animates (it needs an offscreen surface every frame: 47 fps); give the child the parent's
  movement instead. Pausing at runtime does not help (paused animations stay composited). `steps()` on one clock
  keeps idle redraws near 5 a second. Keyframes with `var()`, `%` and `cq*` units still run on the compositor (0
  main-thread style recalcs). Layer "memory" from layer bounds is misleading (Chromium rasters tiles near the
  viewport only, and solid-colour layers need none).
- Scroll benchmarks must call `scrollTo({ top, behavior: "instant" })`: the lab sets `scroll-behavior: smooth`, so
  `scrollTo(0, y)` on every frame restarts a smooth scroll and the page barely moves (the background-motion pass's
  31–38 fps figures were measured that way, near the top of the page). Check that the run reached the bottom.
- Signature illustrations (`signature/`) animate the service pages' drawings, whose geometry lives in
  `src/components/service/visuals/nesting-sheet.ts` and `engraved-plate.ts` (the previous design's service drawings
  shared them until TM-2.6). `LaserCut.tsx`: the nesting sheet appears with one scan
  pass, nested parts draw in, the head activates at its park spot, then cuts the holes and the slot
  (pierce, lead-in, contour) before the outer contour from its lead-in, at a steady feed, with a hot
  point, a trailing glow and a heat tint that settles; interior lead-ins drop out with the slug; the
  head parks where the service page shows it. `LaserEngrave.tsx`: the brass plate and its reflection,
  the crosshair moves to the start, engraves the double border and corner marks, the line block, the
  rosette and the ring (grooves drawn twice, highlight and cut), light crosses, the laser switches off
  on its rest mark; mirrored in Arabic. Markup is the finished state; `signature.css` arms the start
  state only under `.js` + `prefers-reduced-motion: no-preference`; `useSignature` plays once at 50 %
  in view and replays on host (`[data-sig-host]`) mouse-enter or focus (not while running), or, for a run
  with `loop` (the hero plate), repeats while on screen and the page is visible (IntersectionObserver at 0 and
  0.5, `visibilitychange`), pausing every animation where it is otherwise;
  `sig:replay` (`detail.intro`) forces a run; `freeze` holds a named moment (`initial`, `active`,
  `finished`) for the sheet's still frames. `animate()` puts every animation on one clock that ends
  with the run (delay, active window, end delay, fill both), so captures and tests pause them all at
  one `currentTime`. The two signatures lead the A V2 services grid and the design-system sheet
  (`SystemSheet`'s optional `lead`).
- `lab.css` builds Tailwind from lab sources only (`source(none)` + `@source`), and `commerce.css` from the MC sources
  only, so lab classes never reach the site CSS. Semantic utilities (`bg-surface`,
  `text-ink-2`, `rounded-card`, `shadow-raised`…) resolve to whichever option's tokens are in scope.
- Proof that the site is untouched: build the approved commit in a worktree and compare every
  prerendered file (normalise build id, `/_next/static` paths and the router's
  `"siblings":["theme-lab"]` entry for `[locale]`); site CSS must be byte-identical.
  `e2e/theme-lab.spec.ts` covers isolation, noindex, redirects, sections, flagged photos, overflow,
  no-JS, reduced motion and whole-card link overlays for every option; `e2e/theme-lab-a-v2.spec.ts`
  covers A V2's behaviour. Next's `<meta name="next-size-adjust">` can move within `<head>` between
  builds of the same tree; treat that position change as noise.
- The lab is the reference for the approved design; delete it only when the user authorizes it.

## Gotchas learned

- Do not add `dynamicParams = false` to the root layout (`app/(commerce)/[locale]/layout.tsx`). It turns fallbacks off for the whole
  route tree, which causes `NoFallbackError`s and redirect loops on prefetches of 404 pages. `proxy.ts`
  already sends every non-locale URL to `/{locale}/…`, where the catch-all renders the localized 404.
- To stop a server in a cloud session, run `pkill -f "[n]ext-server"` as its own command. Never use a
  `pkill -f`/`pgrep -f` pattern that appears literally in the same command (for example
  `"next start -p 3400"`): it matches your own shell and kills it (exit 144). Bracket one letter.
- After a rebuild, stop any `next start` left running from before (check `pgrep -fa "[n]ext-server"`
  and `/proc/<pid>/cwd`). Otherwise the tests reuse the stale server and assets fail with 500s.
- Styles inside `@layer components` lose to Tailwind utilities (`.grid`, `.flex`) whatever their
  specificity. Rules that must win, like `html:not(.js) .mc [data-js-only]`, go outside the layers.
- Playwright's `javaScriptEnabled: false` still parses `<noscript>` as text. Check noscript content in
  the server HTML instead.
- Reveal fades also run with reduced motion (opacity only), so content in the bottom band of the
  viewport stays hidden until scrolled into view. Visibility checks must leave that band out.
- Both locales share one root layout, so every preloaded font is preloaded on every page (hence only the two Latin
  faces are preloaded). Splitting preloads per language needs a root layout per language (1J).
- `html` has `scroll-padding-top` (header + 1rem), so anchor jumps already clear the header. Do not add
  `scroll-mt-*` to sections as well: the two add up (the gallery landed 168px down).
- `.js [data-reveal]` rules are unlayered, so on an element that also lifts on hover (`.card-link`) they
  cancel the hover transform. Put `data-reveal` on a wrapper around the card.
- Chromium does not restyle SVG descendants for selectors like `[data-revealed] [pathLength]` when
  the attribute appears, so line drawings stayed undrawn until the next resize (full-page captures
  resize, which hid the bug until 1D). Draw-on-reveal paths read an inherited `--draw` that the
  revealed element sets (the service drawings in `commerce/services/drawings.tsx`); keep that pattern for new drawings.
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
  `animation` value switches. Give each its own element or pseudo-element.
- `cqw` inside `@keyframes` resolves against the nearest query container, so give the animated
  element's parent `container-type: inline-size`.
- To show a caption above an image but keep it after the image in the reading order, use a flex
  column and `order-first`; moving it in the DOM changes the accessibility tree.
- With `experimental.globalNotFound`, `global-not-found.tsx` sits in every route's module graph, so a `next/font` face
  it declares with a preload is preloaded on every page — even under another root layout such as the theme lab (the
  previous design's six files were, until they got `preload: false`). Its CSS and JS stay on its own page.
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
- axe (and `document.elementsFromPoint`) skip `pointer-events: none` layers, so axe never sees A V2's ambient:
  audit it by painting its worst-case colour on the page itself, and measure rendered pixels (per pixel, with
  the light held behind the text: an average hides a lit dot under a letter).
- `getComputedStyle()` is live: read the values you need before changing the element (a contrast helper that hid
  the text first read "transparent" as the text colour and measured everything against black).
- A per-pixel contrast check must hide what the element draws itself (its icons and `::before` / `::after`
  decorations, e.g. the eyebrow's orange dot), keeping only its own background and what lies behind it.
- An attribute toggled on `<html>` restyles whatever the rightmost compound of the rules keyed on it can match:
  `html[data-scrolling] … .a2-ambient > *` restyled 1,686 of 1,767 elements per toggle (about 14 ms). Name the
  targets (`> :is(.a2-ambient-sweep, .a2-ambient-field)`: 2 elements, 0.5 ms).
- `offsetTop` is relative to the offset parent (A V2's sheets are positioned, so `#clients` reads 0). To jump in
  scripts and tests use `el.scrollIntoView({ behavior: "instant" })`; a smooth scroll through Services also
  starts the signatures, so idle measurements must jump and wait out one-time runs.
- Playwright's attribute polling can miss an attribute that lives ~200 ms (`data-scrolling`); sample it inside
  the page (in the scroll event) instead. Wait for `data-live` on the A V2 hero before relying on LabMotion.
- A finished filling Web Animation that a later filling animation fully overrides on the same element (the plate's
  cut and its reset) is removed by the browser ("replaced"), so replaying it later does nothing: call `persist()`
  on animations a loop reuses. Chromium keeps a finished animation's `startTime`, and setting it plays it again.
- Readouts that change for ~120 ms (the plate's 01–04/07) are too short for Playwright's polling; wait with
  `waitForFunction(…, { polling: "raf" })` or record changes inside the page (MutationObserver in an init script).
- Chromium moves the animation clock on with each new task, so the first style read of a script task re-samples every
  running animation (the hero entrance, the plate): a trace measuring what one change restyles must read styles once
  before its first marker.
- A `<Link>` prefetch of a page under another root layout still runs, is never used (the navigation is a full page
  load) and its RSC payload carries that layout's font preload hints, which React adds to the current page's
  `<head>`. (Why the previous design needed `crossDesignLink()`; the website now uses plain links.)
- Moving a component out of the lab's folder takes its utilities out of `lab.css` (Tailwind scans only the listed
  sources): the lab's stylesheet shrank 2 KB until the moved files were added back with `@source`. Check a moved
  component's CSS bytes against the previous build.
- Flight payloads (`.rsc` files and the inline `self.__next_f` scripts) renumber and re-chunk their rows when any prop
  changes; to prove "only this prop changed", resolve each payload into one tree (inline `$L`/`$` row references,
  name client modules by id and export, keep `$<row>:path` back-references by path) and compare the trees. Parse
  rows as `<hex id>:` up to the newline, except text rows `<id>:T<hex length>,` (byte length) and hint rows with an
  empty id (`:HL[…]`).
- The `pkill -f` self-kill also happens when the pattern appears anywhere in the same command, a heredoc included
  (`pkill -f difflib` in a script that uses difflib killed its own shell).
- A `notFound()` during a dynamic render (the catch-all) is answered 404 with an error shell (`<html id="__next_error__">`,
  the right `<title>` and `robots` meta) and the page is built in the browser, in both designs and before TM-2.1 too:
  without JavaScript a 404 body is empty. The browser tab then shows the layout's default title ("RAWASY") unless
  something restores it (`BootFallback` reapplies the theme and script-only controls and restores the `title`).
- A page-data request (`RSC: 1`) without its `_rsc` cache key is redirected once (307) to the address with it, for every
  page; a test of "no page-data loop" should expect one 307 and then an answer (the catch-all's 404 sends its payload
  with 200, a route's own unknown slug — services, projects — a 404).
- `/api/…`, `/media/…`, `/_next/…` addresses are outside the proxy, so no locale handling: the root layout's `notFound()`
  for the invalid locale answers 404 and the browser shows Next.js's default page ("404: This page could not be
  found."), not `global-not-found.tsx` (the same on the TM-2.5 and TM-2.6 builds).
- Tailwind v4 makes utilities from any word in a scanned source, comments included: "sticky" and "contents" in comments
  of the kit added `.sticky` / `.contents` rules to the MC stylesheet (harmless, but they show up in "additions only"
  CSS checks). Compare CSS rules with declarations as sets: Tailwind's `@layer properties` order is not stable.
- The CSS build keeps only `-webkit-backdrop-filter` when a rule declares it with `backdrop-filter`, so Chromium shows
  the scrolled MC header with no blur (80 % opaque; text scrolled under it stays faintly visible). It is the approved
  TM-1 look, and a blur over the moving ambient would be re-applied every frame (see the A V2 performance rules);
  restoring it would change the frozen homepage, so it waits for the user.
- Changing which pages import a shared client module makes Turbopack re-split the shared chunks of other routes (the
  lab's A V2 JS moved by +114 bytes in TM-2.1 with no source change there). Compare JS by total and contents, not by
  chunk file names.
- A client component imported by a shared server component ships in the bundle of every page that renders the shared
  one, even where it never renders: importing `SamePageLink` in the MC header added 1,084 bytes (with the route table
  it pulls in) to the homepage. Pass a rarely needed client component in as a prop from the route that needs it.
  Compare JS per page by module set and total bytes: Turbopack also moves modules between chunks when the route
  graph changes (the homepage's 180 modules stayed identical while one moved to the neighbouring chunk).
- Lazy images make full-page before/after captures differ by loading progress, not code: set every image to
  `loading="eager"` and await `decode()` before capturing, and let the header settle ~700 ms after each scroll.
- Tailwind turns identifiers into utilities: the form's `isolate()` helper added `.isolate` to the MC stylesheet.
- A grid's implicit `auto` track grows to a `nowrap` child's max-content (a long file name), and the sheet's
  `overflow: clip` hides the result: no sideways scroll, but the remove button was cut off on phones. Give nested grids
  with truncating text `grid-template-columns: minmax(0, 1fr)`. A page-overflow check misses this; compare element
  boxes with the viewport too.
- A no-JS `mailto:` form submission can be observed with Playwright through a CDP session
  (`Page.frameRequestedNavigation`, reason `formSubmissionPost`). With `enctype="text/plain"` the browser's mail-as-body
  step turns "+" into a space (HTML spec), so "+966" arrives as " 966" — the previous design did the same.
- Over a cross-origin iframe the page gets no mouse events, but Chromium still fires `pointerover` on the `<iframe>`
  element in the page (and again on whatever is under the mouse when it comes back).
- Measure JS by chunk list and module set: a lazily loaded chunk can arrive after "network idle" in one run and not
  another.
- Element screenshots taller than the viewport are stitched from several scroll positions, so a sticky header shows
  up mid-image: make the header static for those captures only.
- `next start` writes render-cache files into `.next/server/app` when it serves an unknown slug; compare a copy of the
  clean build (taken right after `next build`), not the live folder.
- A reveal's transform on an anchor target moves it after the jump (the card landed 3 px under the header): no
  `data-reveal` on elements that links land on.
- Removing a word from a JSX class list can remove a Tailwind utility from the MC stylesheet (`lg:items-end` from
  `ClosingCta`), which breaks "additions only": check the CSS rules after any class edit in a shared component.
- `cursor: auto` on every descendant blocks the inherited hand on a button's icon; inside the dialog use
  `cursor: revert-layer` for descendants.
- Forced colours replace fills with the page colour: a switch, swatch or bar drawn only with `background` disappears
  (the colour switch showed no state). Draw it in system colours (`ButtonText`, `Highlight`, `Canvas`) with
  `forced-color-adjust: none`, scoped to the component.
- Two unrelated rules with one class name merge silently: `.in-index` was both the Industries wrapper (a two-column
  grid) and each sector's number, so every number became a grid with a 3 rem gap, and the Arabic display-face rule
  leaked Tajawal into the descriptions. Before a batch ships, list each new class's elements and rules.
- A contrast probe must compare unrounded ratios (4.497 rounded to 4.5 "passed") and measure only the text's content
  box (a pill's rounded corners showed the photo beside it, reading 1:1). A drop shadow can fall across text outside
  its own box: the document thumbnails' shadow dipped the issuer line under AA until the plate clipped it.
- A grid box with one implicit `auto` row lets its image's natural height size the row, so `height: 100%` /
  `min(100%, …)` on the image resolves against that row: the Clients logos showed at their natural size over the
  neighbouring tiles, and tall photos overflowed About's project stages and the Industries preview (clipped). Give a
  single-item media box `grid-template: minmax(0, 1fr) / minmax(0, 1fr)`. Overflow and viewport checks miss this:
  check that every image and text stays inside its own box (`commerce-company.spec.ts` "nothing spills out…").
- With `next/image`, an image whose source is narrower than the chosen srcset candidate (the optimizer never upscales)
  reports a `naturalWidth` below its file size (the `w` descriptor overstates it). Measure display scale against the
  media registry's size, not `naturalWidth`.
- A full-page screenshot resizes the window, which can flip IntersectionObserver-driven state mid-capture (the lab
  header's "past hero" shadow appeared in some captures and not others, on both builds). Recapture, or compare
  viewport captures, before calling such a difference a regression.
- Turbopack merges a layout's global stylesheets into one CSS chunk only up to a size limit (between the 130 KB that
  merged and the 154 KB that did not): when `system.css` grew by 24 KB in TM-2.4, every MC page, the homepage included,
  started loading the MC sheet as two files. Page-specific CSS goes in its own file imported by that page's components
  (`services/services.css`); after any CSS change compare each page's `<link rel="stylesheet">` list with the checkpoint.
- `.a2-read`'s reading zone is a `::before` at `z-index: -1` inside an isolated stacking context, so it paints over the
  element's own border: a rule on a text block in a reading zone (`.sv-note`, `.sv-lead`) is drawn with `::after`.
- An `<img>` sized only by `max-width` / `max-height` with `width` / `height: auto` in a grid cell collapses to 0 × 0
  until it loads and can outgrow its card after: give it `width` / `height: min(100%, <source> px)` (the project
  cards' paired photos).
- A page opened at an address's anchor must jump instantly until it has loaded: Chromium keeps an instant fragment jump
  on its target through layout changes (fonts, images) until the load event, but a smooth first jump keeps its first
  destination, so with `scroll-behavior: smooth` on `html` a font arriving ~300 ms late left landings 64–309 px short,
  under the header, on every MC page until TM-2.5 (`html[data-smooth-scroll]` now). Test landings in a fresh context
  with the fonts held back (route `**/*.woff2`): a warm cache hides the problem.
- A signature replay (`useSignature`, not the intro) adds a fade of the finished work (LaserCut: one; LaserEngrave: one
  per `.sig-engr` layer) and keeps the intro's `keep` animations: a replay holds more animations than the first run.
  To prove "no duplicates", compare replay with replay, not with the intro.
- When the module graph changes, the minifier renames the locals of unchanged modules (same length, same logic): a
  module-by-module JS comparison then shows "changed" code. Compare token streams with identifiers renamed by first
  appearance, property names kept (`jsalpha.js` in the TM-2.4 proofs), and treat inlined modules separately.
- Comment words are utilities too: "container" in a TSX comment added `.container` (six rules) to the MC stylesheet.
  Tailwind's scanner skips `.css` files, so words in stylesheet comments are safe.
- The `pkill -f "[x]…"` self-kill also happens when the unbracketed name appears in a path later in the same command
  (`$S/tm24/matrix24.js` in a heredoc): stop the process in a command of its own.
- Identifiers become utilities as well: a state variable named `filter` added `.filter` to the MC stylesheet (TM-2.5
  renamed it `choice`). Avoid utility names as bare words in MC TSX — `filter`, `transition`, `table`, `static`, `grow`,
  `shrink`, `collapse`, `invisible`, `rounded`, `underline`, `italic`, `container`, `invert`, `resize` — in code and
  comments alike; method calls such as `.filter(` were not picked up.
- Script-only controls carry the attribute `data-js-only` (hidden by `html:not(.js) .mc [data-js-only]` in `system.css`);
  a `js-only` class has no rule in the MC sheet, so it would show without script.
- Playwright retries a pointer action with `element.scrollIntoView({ block })`, which follows `scroll-behavior: smooth`,
  and acts at once: the mouse lands before the glide moves the page, and the element under it changes. That made the
  Industries preview test fail 2 in 20 on the TM-2.4 build (a `focus()` had just glided the list). Let the page come to
  rest (a few frames at the same `scrollY`) before hovering after a `focus()` or any other glide.
- A scroll benchmark with the mouse left over the page loses about 7 fps (hover states restyle as content moves under the
  pointer; the homepage too). Choose with the keyboard, or move the mouse off the page, before measuring.
- A hover or focus state read after a fixed wait can be mid-transition under load (−2.998 px instead of −3 px): poll the
  expected state, or wait for `el.getAnimations().length === 0`.
- When Turbopack merges or splits module factories, an unchanged module can read as "changed" in `jsalpha.js` (module 957
  on the previous design's pages in TM-2.5): read its source in both chunks before calling it a change.
- When a module loses all its client importers but one, Turbopack inlines what that one uses and drops the module from
  the bundle: in TM-2.6 the logo module (9.3 KB, kept in a shared chunk for the old loader) left the homepage's and the
  lab's JS, and the hero plate now carries its two logo paths inline; `switchLocalePath` moved into `SamePageLink` the
  same way. Prove such a change by comparing the non-identifier token streams with the paths written in place.
- The fallback 404 cannot be requested by any address (see "The fallback 404" above): to see it, serve
  `.next/server/app/_not-found.html` at a made-up address with Playwright's `route.fulfill` (its assets load from the
  server).
- The CSS build merges rules with the same declarations into one selector list (the hero's reveal override joined
  `.js [data-reveal][data-shown]`). A Selectors 4 list inside `:not(a, b)` would make an older browser drop the whole
  merged rule, the original included: write `:not(a):not(b)`.
- In forced colours Chromium keeps an inline SVG's own colour (the UA gives `svg` `forced-color-adjust:
  preserve-parent-color`), so a logo coloured by a utility (`text-white`) stayed white on the forced page colour. Give it
  `color: CanvasText` in a forced-colours rule outside the components layer (a layered rule loses to the utility).
- Forced colours drop backgrounds and box shadows: a state drawn only with a tint, a bar, a raised tile or a colour (the
  header's current page, the current language, the pressed theme) disappears. Underline it or give it the selection
  colours (`Highlight` / `HighlightText` with `forced-color-adjust: none`). Playwright emulates the palette from
  `prefers-color-scheme` (`forcedColors: "active"` + `colorScheme`).
- Playwright's route glob `**/_next/static/chunks/**/*.js` does not match a file directly in `chunks/`: route with a regex
  and count the matches, or a "script blocked" test silently runs with its script.
- Without JavaScript, `load` can fire before the first layout (nothing blocks it); the fragment jump happens at that
  layout, and the web fonts it requests arrive after it. Chromium's scroll anchoring then keeps a node above the target
  (the text under the header, inside the scroll padding), so the target moves by the text's change (95–107 px on the
  legal pages at 1440). See the TM-3 report, item 13, before trying to fix it.
- LCP of text that fades in from opacity 0 is recorded when the fade ends (the reveal's start + 0.7 s), not when it starts.
- Capture scripts: lazy images far down the projects gallery do not load just because a script sets `loading = "eager"`;
  walk the page a screen at a time first, and cap every image wait with a timeout (one capture run hung on three images).
- The site's narrowest supported width is 320 CSS px. A phone at 200 % page zoom (390 → 195 CSS px) overflows in the header
  on every build; test 200 % zoom as a desktop window's CSS viewport (1280 × 720 → 640 × 360).
- A page-overflow check misses text that runs past its card without leaving the screen (the homepage's Industries names at
  360 / 390 px): compare each text's line boxes (`Range.getClientRects()`) with its own card, too.
- In phone emulation (`isMobile`) a page wider than the screen is zoomed out to fit, so a before/after capture of a page that
  overflowed differs everywhere; and every section below a part whose height changed shifts by a fraction of a pixel. To
  prove "the rest is unchanged", hide the changed part on both builds and compare the pages screen by screen.
- Chromium's forced-colours emulation leaves `-webkit-text-fill-color` at the author's colour while `color` is forced and
  the text is drawn in the forced colour; axe-core's colour-contrast rule reads the fill colour, so in forced colours it
  reports false "serious" findings (the fallback 404's badges and buttons when the stored theme disagrees, on TM-3 and
  correction 1 alike). Check the computed `color` and the drawn pixels instead.
- Tailwind's arbitrary `max-[27rem]:` variant builds `@media not all and (min-width:27rem)`: at exactly 432 px the rule is
  off (`min-width` matches).
- `scrollWidth` / `clientWidth` are rounded to whole pixels and hide up to about half a pixel of overhang: measure text
  against its box with `Range.getClientRects()` and the box's `getBoundingClientRect()`, allowing 0.1 px for Chromium's
  1/64 px layout rounding (isolated widths show 0.02 px "overhang" on every build).
- The fallback face of a `next/font` family is `local(Arial)` with a size adjustment; where Arial is missing (this Linux
  box) the stack falls through to the system sans (DejaVu Sans, wider). Measure text fits with the web fonts blocked as
  well (`page.route(/\.woff2$/, abort)`), since `display: swap` shows the fallback first.
- Larger text through the browser's own setting (CDP `Page.setFontSizes`) scales rem media queries too; injecting
  `html { font-size }` does not. At phone widths 150–200 % text equals a screen below 320 CSS px, where the header's
  controls already overflow (`div.ms-auto` in the header; pre-existing).
- Run the e2e suite with nothing heavy alongside it (the cloud machine has 4 CPUs; the suite uses 3 workers). In TM-3
  correction 2 a run with image composition and build comparisons alongside, right after a build from an empty `.next`
  (so the image optimizer refilled `.next/cache/images` on demand), failed 13 tests: 12 page timeouts on photo-heavy
  pages (Projects, the company pages' containment sweep, inner pages without JS, the lab's option C) and the Clients race
  below. The same build then passed 421 / 421 twice, once from an empty image cache. `next build` keeps that cache;
  `rm -rf .next` empties it.
- `commerce-company.spec.ts`'s "in forced colours the switch still shows its state" used to read the track colour once,
  right after the dot started moving (its `translate` turns from `none` to `0px` on the transition's first frame), and
  under heavy load read the start colour (`Canvas`) once in TM-3 correction 2. Since the Stage 1E preflight (`86d80a1`,
  test only) it waits until the knob's transitions have ended (`getAnimations({ subtree: true })` sees the `::after`
  slide too) and checks the settled system colours. Read a state after its transition, never on a moving frame.
- `commerce-polish.spec.ts`'s homepage switch test (forced colours) had the same race until Stage 1F: it polled until the
  dot's `translate` changed, then read the track at once, and the Stage 1F full run read the start colour (`rgb(0, 0, 0)`,
  ar forced dark) once. Since `cee1236` (test only) it waits until the knob has no running animation before each read.
- Two more reads raced the page under the full suite's load in Stage 1F (fixed in `cfc17d5`, test only): the 1E spec's
  "choosing a machine" read the console straight after network idle and once saw it before hydration (no active panel,
  no inert panels: the address store's server snapshot is `null`), and the legal contents test jumped to `#information`
  while the click's glide to `#quote-form` was still running, so the glide carried the page on past the jump. Poll any
  state that hydration sets (`expect.poll`), and let a glide land (its target at the scroll padding, or the page at its
  end) before an instant scroll.
- Any programmatic scroll during page load, even `scrollBy` on an inner scroller (the 1E selector on phones), ends
  Chromium's fragment anchoring (the instant jump is no longer kept on its target through layout changes), so a font
  arriving later moves the landing (2.16 px on the Arabic phone `#laser-welding` with fonts +300 ms). Defer such scrolls
  until `html[data-smooth-scroll]` (after load and fonts); watch the attribute with a MutationObserver, not a timer.
- Scroll anchoring picks a node near the top of the screen; with a sub-pixel landing it can pick one inside a sideways
  scroller (the selector's centred thumbnail) and move the page when that scroller's layout changes (−8.58 px under CPU
  load, −24 px reproduced deterministically). `overflow-anchor: none` on the scroller's list keeps the anchor outside.
- Class prefixes are global: `cp-*` belongs to Contact (`cp-down` is its arrow), so Capabilities uses `cm-*` (and `sk-*`
  for its sketch). List each new prefix's rules in `system.css` and the page sheets before using it.
- Comment words became utilities again in 1E: "table" (also inside "route table") added `.table`, "container" added
  `.container`. Reword comments in MC TSX ("rows and columns", "size container" only in `.css` files).
- A client component that imports `@/i18n/routes` (or a server data module that imports it) re-splits shared chunks on
  other routes: `MachineAddressLink` importing it changed `SamePageLink`'s chunk on the service and project pages (+552
  bytes). Derive paths from `usePathname`, and import only types from server data modules in client code.
- In forced colours the author's `outline-color` is overridden, so a selected state drawn as a coloured outline looks
  like focus or vanishes: draw it on `::after` with `forced-color-adjust: none` and `Highlight`, plus a text cue.
- A CSS animation restarts only when `animation-name` changes: give the sketch's animations only to the shown panel
  (each showing replays them). The `animation` shorthand resets `animation-play-state`, so carry the play state inside
  the shorthand through a variable (`--cm-play`), set to `running` by `[data-live]`.
- `:is()` cannot hold pseudo-elements (`:is(.a::before, .b)` drops the rule): write separate selectors.
- Transitions that may run before hydration (the `:target` panel handing over to `[data-active]`) showed two panels at
  once: key them on the hydrated state (`[data-ready]`). A later reduced-motion override can lose to a more specific
  rule: put transitions inside `@media (prefers-reduced-motion: no-preference)` instead.
- For contrast probes, hide the sticky header with `visibility: hidden`, not `position: absolute` (that moved the page and
  measured the breadcrumbs under the header: false failures).
- A cloud session stops a background command at its own time limit (30 min unless a longer `timeout` is given): a
  `next start` launched that way died in the middle of a full e2e run (Stage 1E: 66 tests failed with
  `ERR_CONNECTION_REFUSED`). Give the server the longest limit (2 h) or let Playwright start it, and check that every
  failure is a real assertion before reading a run.
- A long-running `next start` can get one image-optimizer variant stuck: in Stage 1E,
  `/_next/image?url=/media/services/scaffolding-2.webp&w=828&q=75` never answered on a server that had served a full e2e
  run (curl: no reply in 15 s), so the theme lab's option C sweep timed out at 834 px on every try. A fresh server on
  the same build and cache answered in 0.16 s, and the test passed. Probably the same cause as the lab C timeout in TM-3
  correction 2. When a photo-heavy page times out on `networkidle`, list the requests still open; if one image hangs,
  restart the server (or let Playwright start its own) before reading the run.
- `DOMDebugger.getEventListeners` (DevTools protocol) also reports Playwright's own window listeners (its injected
  script has no URL; around each click it adds hit-target listeners — click, mousedown, pointerdown… — and under load
  a set can still be there when read). Count only listeners whose script has a URL (the site's chunks).
- A worktree build after `rm -rf .next` failed in Stage 1F with `next/font/google queries have exactly one entry`
  (Module not found …/font/google/font) on the lab's Google faces; copying the main checkout's `.next/cache` into the
  worktree's `.next/cache` before `next build` fixed it. Keep the cache when rebuilding a checkpoint.
- A flex item with `width: 100%` inside a `fit-content` flex container (the project gallery) wrapped onto extra rows: the
  container sizes from the items' contributions, then each item claims the full width. Size a photo by its own width
  attribute (`max-width: 100%`, `height: auto`) and let its frame fit it; never stretch the frame.
- React 19 adds `<link rel="preload" as="image">` (with the srcset) to `<head>` for an image with `fetchPriority="high"`.
  A "no image on this page" check must allow it only on pages that show the photo.
- A request filter on `/media/` also matches the fonts under `/_next/static/media/`: test the URL's pathname start
  (`/media/`, `/_next/image`).
- Contrast probes: the header must be hidden with `visibility: hidden` (also the overview's pinned `.pj-bar`), never made
  `position: absolute` (Stage 1F re-hit this through the 1E script: the breadcrumbs slid under the header and read
  1.2–2.0:1). Also turn transitions off in the "text hidden" style: links that fade their colour (`.ip-crumbs a`) are
  still half drawn 120 ms later.
- Pixel captures that pause every animation at 0: a transition still running (the header's shadow after the scroll back
  to the top) freezes at its start and differs by timing. Wait until no `CSSTransition` runs, then pause.
- A keyboard focus that the page scrolls to glides there (`scroll-behavior: smooth` once loaded) and a revealed part fades
  in on the way: measure a focused element's position after it is in view (poll), not on the next frame.
- DevTools network events report `data:` URIs too: each `next/image` blur placeholder and the ambient's light sweep arrive
  as type `Image` with 0 bytes (the 3-photo clock tower page: 7 "images" = 3 photos + 3 placeholders + the sweep). Count
  photo downloads by URL (`/_next/image`, `/media/`), not by resource type.
