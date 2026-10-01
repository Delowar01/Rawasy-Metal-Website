@AGENTS.md

# RAWASY Metal Website — project memory

## How the user wants reports

- When a task or stage is finished, send a **complete report inside one copyable code block**. Use a
  four-backtick markdown fence (````markdown) so it copies cleanly in one go.
- Cover: summary and status, what was delivered, QA actually run and its results (say plainly if
  something failed or was skipped), items needing RAWASY's confirmation, known limitations, how to
  run, and next steps.
- Also save the report as `docs/reports/YYYY-MM-DD-<topic>.md`, then commit and push it with the work.
- Latest report: `docs/reports/2026-10-01-tm2-3-about-industries-clients-certificates.md` (earlier:
  `2026-10-01-tm2-2-contact.md`, `2026-10-01-tm2-1-correction-1.md`,
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
- **Stage 1D (the six service detail pages) is built and awaits the user's visual approval** (report
  `2026-09-25-stage-1D-service-pages.md`). TM-2 decision D3: keep 1D's content and structure; its final visual
  approval is given on the migrated Modern Commerce versions (TM-2.4). Never self-approve a stage. Do not start 1E (Capabilities &
  Machinery), 1F (project detail pages), 1G or later until the user says so; project detail pages
  and Capabilities stay `planned`. Do not start Phase 2 (admin panel) during Phase 1.
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
  before TM-1). The previous homepage's page code is parked, unrouted, in `src/components/home/LegacyHomePage.tsx`;
  the approved plan deletes it in TM-2.6 with the rest of the previous design. Do not start 1E. Do not deploy.
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
  `e5a3834`). **TM-2.3 (About, Industries, Clients, Certificates) is built** (report
  `2026-10-01-tm2-3-about-industries-clients-certificates.md`; implementation commit `86a5f19`; rollback checkpoint:
  GitHub branch `preserve/pre-tm2.3` at `2026047`, the last commit before TM-2.3) and awaits the user's independent
  review. Never self-approve. **Do not
  begin TM-2.4 (services overview + six service pages) or any later batch, Stage 1E or 1F, until the user explicitly
  approves TM-2.3.** TM-2.3 leaves two shared, frozen parts as they are for the user to decide: the homepage's colour
  switch shows no on/off state in forced colours (the Clients page draws its own), and the kit's `PageHero` fades its
  text in after the script starts (local LCP about 1–1.4 s on every MC inner page with a hero, Contact included).
  Decisions in short:
  - project cards on About and the service pages open per-project anchors in the migrated gallery (TM-2.5). Until
    then they open `/projects#gallery` with "View in the gallery". The anchors clear the header and the sticky filter
    bar. The homepage's six links stay unchanged.
  - Capabilities links stay on the placeholder until 1E.
  - the services overview uses the `LaserEngrave` drawing; the flagged engraving photos go.
  - no floating WhatsApp button.
  - the previous design's blueprint/editorial decoration retires.
  - the four other service drawings are restyled, with no new sequences.
  - the Google Maps embed and URLs stay byte-identical, and only the frame is restyled.
  - placeholders move to MC in TM-2.6, still noindex.
  - the theme lab stays until the user authorizes its removal.
  - every migrated page stays `review`/noindex until 1J.

  Required:
  - validate the MC 404 and catch-all across both root layouts: real status codes, localization, SEO, unknown
    service/project slugs.
  - quote-form logic, validation, the prepared email/WhatsApp text and the no-backend note stay exact.
  - certificate redactions stay at the file level (byte-identical files).
  - the homepage stays visually unchanged.
  - every existing test assertion is kept or replaced by equivalent coverage.
  - no deployment.
- Publishing waits for the Stage 1J launch approval (the user's instruction in the 1C-V brief). Built
  pages stay `review` in `src/lib/page-meta.ts` (noindex, left out of the sitemap) even after their
  design is approved: the 1C pages, the projects overview and the service pages. Only the homepage is
  `published`.
- The pages still in the previous design must not change (except for a genuine shared-component bug) until their
  own migration is approved. After any shared change, compare them with the checkpoint build (a `git worktree` of
  `3260415` with `cp -al node_modules`): visible server HTML (scripts removed, `/_next/static` paths and the
  `next-size-adjust` meta position normalised), the site CSS bytes, the RSC payloads resolved into one tree (Flight
  rows get renumbered and re-chunked when any prop changes, so compare resolved trees, not files) and screenshots in
  EN/AR, light/dark.
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

The previous design's visual system: every page except the migrated homepage, until each is migrated.

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

These are the previous design's rules (every page except the migrated homepage). Pages in the Modern Commerce
design use A V2's faces (see "Modern Commerce design in production" below).

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
- Design tokens and motion CSS of the previous design: `src/app/globals.css`. The homepage (Modern Commerce):
  `src/app/(commerce)/[locale]/`, `src/components/commerce/*` (see below). `src/components/home/*` holds the previous
  homepage's sections (parked with `LegacyHomePage.tsx`) and the hero plate geometry (`hero/plate-geometry.ts`).
- Inner pages: shared system in `src/components/inner/*` and `src/lib/inner-page.ts` (metadata,
  breadcrumb trail, JSON-LD); page components in `src/components/{about,services,projects,industries,
  clients,certificates,contact,legal}` (About, Industries, Clients, Certificates and Contact there are the parked
  `Legacy*Page.tsx` copies since TM-2.2/2.3; the live pages are in `src/components/commerce/*`); shared cards in
  `src/components/cards/*` and teasers in `src/components/teasers/*`; copy in `src/content/{about,pages,contact,legal}.ts`.
- Projects: `src/components/projects/*`, `src/lib/project-cards.ts`; showcased projects and withheld
  photos in `src/content/projects.ts` (`isShowcased`, `projectImages`).
- Clients wall (since TM-2.3): `src/components/commerce/clients/ClientsPage.tsx` with `planSpans` from
  `src/lib/logo-wall.ts` (the previous design's `ClientWall.tsx` stays for its parked page). Contact map (since TM-2.2):
  `src/components/commerce/contact/Location.tsx` + `src/lib/maps.ts` (address search only; replace with
  RAWASY's own Google Maps place link once confirmed; never invent coordinates).
- Quote form (since TM-2.2): `src/components/commerce/contact/QuoteForm.tsx`. No backend: it prepares the request for
  the visitor to send by email or WhatsApp. Never make it claim a request was sent. Its logic (from `type FieldName` to
  the privacy line) is a verbatim copy of the previous design's `src/components/contact/QuoteForm.tsx`, which stays,
  unrouted, until TM-2.6: change both or neither, and keep `e2e/commerce-contact.spec.ts`'s golden outputs passing.
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

## Modern Commerce design in production (Stages TM-1 and TM-2)

- Two designs, two root layouts. `src/app/(commerce)/[locale]/layout.tsx` + `page.tsx` serve the migrated pages
  (the homepage; since TM-2.1 Privacy, Terms and the localized 404) with their own stylesheet, fonts, boot script,
  ambient, pointer and motion controller; `src/app/[locale]/layout.tsx` still serves every other page in the previous
  design. Moving between them is a full page load (Next.js: navigating across root layouts), so no CSS, font or script
  ever crosses over. To migrate a page later: move its route into `(commerce)/[locale]/`, add its key to
  `commerceRoutes` in `src/i18n/routes.ts`, and extend the Tailwind `@source` lines if its components live elsewhere.
- `commerceRoutes` + `crossDesignLink(href)` (`src/i18n/routes.ts`): every `<Link>` in the previous design's shell
  (header, footer, breadcrumbs, `ButtonLink`, CTA, placeholder) spreads `{...crossDesignLink(href)}`, which adds
  `prefetch={false}` for a page in the new design (and nothing otherwise, so other links' payloads are unchanged).
  A prefetch across designs can never be used, and its RSC payload carries the other design's font preload hints:
  React added Inter and Plus Jakarta Sans preloads (~75 KB) to every old page before this.
- Styles: `src/app/(commerce)/commerce.css` (Tailwind `source(none)` with `@source` on `components/commerce` and the
  route group; base layer, reveals, view transitions, `.shell`, `.mc-icon`, skip link) and
  `src/components/commerce/system.css` (A V2's `a2.css` converted: every token and component scoped to `.mc` on
  `<body>`, dark tokens under `html[data-theme="dark"] .mc`, lab-only parts — sheet frames, forced-theme samples,
  replay buttons — left out, nav active state keyed on `aria-current="page"`). Class names keep the `a2-` prefix
  shared with the lab. `globals.css` has `@source not` lines for `(commerce)` and `components/commerce`, so the
  previous design's CSS stays byte-identical. `Icon` renders `mc-icon lab-icon` (each design styles its own class;
  drop `lab-icon` when the lab is deleted).
- Fonts (`src/app/(commerce)/fonts.ts`): Plus Jakarta Sans (English display) and Inter (English text) preloaded;
  Tajawal 500/700/800 (Arabic display) and IBM Plex Sans Arabic 400/500 (Arabic text) not preloaded (one root layout
  serves both languages); technical figures use the system monospace stack. Variables `--font-mc-*`. Arabic is never
  letter-spaced (`:lang(ar)` rule in `commerce.css`). `global-not-found.tsx` uses its own non-preloading copies of
  the previous design's fonts (`src/app/global-not-found-fonts.ts`); with `experimental.globalNotFound` its preloads
  otherwise reached every page (six unused files on the new homepage and the lab).
- Theme: `src/lib/commerce-boot.ts` (inline in `<head>`) sets `js`, applies the stored theme under the website's key
  `rawasy-theme` (shared with the previous design, so a choice carries across both) or the system setting, and marks
  the session's intro as seen (`rawasy-intro`), so the previous design's loader does not play after the homepage.
  Page colours `PAGE_COLORS` in `components/commerce/data.ts` (light `#f4f4f1`, dark `#131820`) feed the viewport
  `themeColor`, and `ThemeSwitch` updates `meta[name="theme-color"]`. Without JavaScript the page is light.
- Shell (`components/commerce/shell/`): `Header` (real routes, Services menu of the six services + "All services" +
  quote, `aria-current="page"`, language, theme, quote, phone menu sheet), `Footer` (real routes, both phones,
  email, WhatsApp, address, legal pages, back to top), `PageShell` (skip link, header, `<main id="main">`, footer),
  `LocaleLink` (a plain `<a>` to the same page in the other language that sets the `NEXT_LOCALE` cookie).
  `getShellView(locale, { route, path })` builds everything the shell needs from the content layer. Every quote
  action goes to `href(locale, "contact", { hash: "quote" })`, the hero's "Start a Project" included (the user's
  navigation correction); its secondary action still scrolls to `#machinery`.
- Homepage sections (`components/commerce/home/`): Hero (+ capability strip), About, Services (the two signatures
  lead), Machinery (`MachineShowcase`), Projects, Industries, Clients + Compliance (one sheet), Contact;
  `getHomeView(locale)` in `home/data.ts`. Markup follows the lab's `HomeA2.tsx` one to one (proved by diffing the
  server HTML: only routes, `aria-current`, the added footer WhatsApp link, the copyright period, the hero's primary
  action and the project cards differ).
- Until the project pages (1F) exist, the six homepage project cards open the Projects overview at its gallery
  (`href(locale, "projects", { hash: "gallery" })`, label `home.projects.inGallery`: "View in the gallery" / "عرض في
  معرض الأعمال"), never a planned detail page. Per-project anchors were measured and rejected: the gallery's sticky
  filter bar (69 px, 117 px where its chips wrap) would cover the top of the target card, and a clean landing needs
  ids plus an offset or script on the previous design's page. TM-2 decision D4 keeps these six homepage links
  unchanged. The migrated gallery (TM-2.5) gets per-project anchors for About and the service pages. In 1F, point
  the cards at `href(locale, "project", …)` again with a "View project" label.
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
  and JSON-LD still from `innerPageMetadata` / `innerPageJsonLd`). `commerceRoutes` is `home`, `privacy`, `terms`,
  `contact`, `about`, `industries`, `clients`, `certificates` (static routes only: a dynamic route needs a pattern
  match in `crossDesignLink` before it moves).
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
  layer. The previous design's page is parked verbatim, unrouted, in `src/components/contact/LegacyContactPage.tsx`
  (moving the route file away removed a utility only it used from `globals.css`; parked, the stylesheet stays
  byte-identical); it and `src/components/contact/*` go in TM-2.6.
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
    unlayered dialog cursor rules after the layer; nothing earlier changed. The four previous pages are parked verbatim,
    unrouted, as `src/components/{about,industries,clients,certificates}/Legacy*Page.tsx` (so `globals.css` stays
    byte-identical); they go in TM-2.6.
- The localized 404: `(commerce)/[locale]/(missing)/[...rest]/page.tsx` (the catch-all, `notFound()`) and
  `(missing)/not-found.tsx`. The `(missing)` group is deliberate: a `not-found.tsx` beside the layout is rendered into
  the payload of every page under it (it added ~52 KB raw / 7.8 KB gzip to the homepage). A migrated route that calls
  `notFound()` (services and projects slugs in TM-2.4 / 2.5) needs this boundary above it or its own; check the
  homepage payload after. Unknown service and project slugs keep the previous design's 404 until their routes move.
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
  and Arabic). The site-shell tests in `site.spec.ts` and `visual-system.spec.ts` run on pages of the previous design;
  `stage-1c.spec.ts`'s generic inner-page checks (routes and SEO, breadcrumbs, overflow, reduced motion, no JS) still
  cover every migrated inner page through `INNER_PAGES`.

## Theme lab (Modern Commerce exploration)

- Since TM-1 the A V2 modules the homepage uses live in `src/components/commerce/` (paths below such as
  `a2/HeroPlate.tsx`, `a2/Ambient.tsx`, `a2/Cursor.tsx`, `a2/ThemeSwitch.tsx`, `a2/MachineShowcase.tsx`, `Icon.tsx`,
  `ui.tsx` and `signature/` are now the lab's re-exports: edit the commerce files). `lab.css` lists them with
  `@source` so the lab's utilities stay complete. Keep the lab working for comparison until the site carries the
  new design everywhere.

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
  in view and replays on host (`[data-sig-host]`) mouse-enter or focus (not while running), or, for a run
  with `loop` (the hero plate), repeats while on screen and the page is visible (IntersectionObserver at 0 and
  0.5, `visibilitychange`), pausing every animation where it is otherwise;
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
  `<head>`. Links from the previous design to a Modern Commerce page go through `crossDesignLink()`.
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
  something restores it (`BootFallback`'s `title`).
- A page-data request (`RSC: 1`) without its `_rsc` cache key is redirected once (307) to the address with it, for every
  page; a test of "no page-data loop" should expect one 307 and then an answer (the MC 404 sends its payload with 200,
  the previous design's unknown slug a 404).
- `/api/…` addresses are outside the proxy, so no locale handling: Next.js answers 404 and the browser shows its default
  title "404: This page could not be found.".
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
- Moving a route file out of the previous design's tree takes the Tailwind utilities only it used out of `globals.css`
  (`text-[var(--proc-ink)]` when Contact moved). Park the old page unrouted (like `LegacyHomePage.tsx`) until TM-2.6 so
  the previous design's stylesheet stays byte-identical. Tailwind also turns identifiers into utilities: the form's
  `isolate()` helper added `.isolate` to the MC stylesheet.
- A grid's implicit `auto` track grows to a `nowrap` child's max-content (a long file name), and the sheet's
  `overflow: clip` hides the result: no sideways scroll, but the remove button was cut off on phones. Give nested grids
  with truncating text `grid-template-columns: minmax(0, 1fr)`. A page-overflow check misses this; compare element
  boxes with the viewport too.
- A no-JS `mailto:` form submission can be observed with Playwright through a CDP session
  (`Page.frameRequestedNavigation`, reason `formSubmissionPost`). With `enctype="text/plain"` the browser's mail-as-body
  step turns "+" into a space (HTML spec), so "+966" arrives as " 966" — the previous design did the same.
- Over a cross-origin iframe the page gets no mouse events, but Chromium still fires `pointerover` on the `<iframe>`
  element in the page (and again on whatever is under the mouse when it comes back).
- Previous-design links prefetched the old Contact route and with it its JS (the QuoteForm chunk, ~16 KB) on every
  page; with `prefetch: false` on Contact links those pages load 16 KB less. Measure JS by chunk list and module set:
  a lazily loaded chunk can arrive after "network idle" in one run and not another.
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
