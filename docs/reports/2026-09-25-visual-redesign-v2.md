# RAWASY Metal Website — Visual Redesign V2 (major correction pass)

**Date:** 2026-09-25 · **Branch:** `claude/new-session-5eijs6`
**Status:** built and tested, **returned for your visual review. Not self-approved.**
The 1C-V direction was not approved; this pass replaces it. Stage 1D has not started.

## Summary

- **Palette:** RAWASY orange now works with a controlled set of semantic colour roles: steel blue
  for engineering and machinery, teal for process and site support, brass for craftsmanship and
  certificates, and deep slate and graphite for dark bands.
- **Structure:** content now sits in visible cards and panels, with borders and shadows you can
  actually see.
- **Typography:** English moved to Sora (headings) and Manrope (text and UI).
- **Projects overview:** built now (brought forward from 1F). It is image-led, with category filters.
- **About:** rebuilt as a fifteen-part company profile.
- **Homepage:** the "Who we are" section is expanded.
- **Clients:** a new unnumbered logo wall.
- **Contact:** a Google map section.
- **Every other page:** varied section backgrounds.

**QA results:**
- Lint, typecheck and build pass (109 static pages).
- Browser tests: **86/86 passed**.
- axe-core: 104 audits with no serious or critical findings. Two moderate best-practice findings
  are unchanged from 1C-V (see item 23).
- Visual matrix: 10 pages × 5 widths × EN/AR × light/dark = 200 captures, all HTTP 200, no sideways
  overflow, no console errors or warnings.
- The homepage hero's server HTML is byte-identical to 1C-V. Two global changes still show in the
  hero, both as the brief asked: the Sora headline and orange primary buttons.
- Scroll frame rate is the same or better than 1C-V on every page measured.

## Report items

### 1. Main commit SHA
`c4812d6971b4a046f0a775ec6339d2461000d945` (`c4812d6`): "Add visual redesign V2: palette, cards, Sora/Manrope, Projects overview".

### 2. Current branch SHA
The branch head is the docs commit that adds this report, README and project-memory updates on top of `c4812d6`. Its SHA is given in the chat report (this report is committed after the main commit).

### 3. Files changed
Main commit: 67 files (27 added, 2 removed, 38 changed; +4,618 / −805 lines).

- **New, Projects:** `src/components/projects/` (FeaturedProject, ProjectCard, ProjectFilter,
  ProjectGallery, ProjectHighlights, ProjectIndex, ProjectsCollage, types) and
  `src/lib/project-cards.ts`.
- **New, About and shared:**
  - `src/components/about/` (ApproachPanel, DivisionPanels, MachineTable, PillarCards,
    ProcessCards, WorkshopSheet);
  - `src/components/cards/` (ServiceCard, SupportList);
  - `src/components/teasers/` (CertificateCards, LogoStrip);
  - `src/components/ui/LineIcons.tsx`, `src/lib/tones.ts`.
- **New, Clients and Contact:** `src/components/clients/ClientWall.tsx` with `src/lib/logo-wall.ts`;
  `src/components/contact/ContactCards.tsx` and `LocationSection.tsx` with `src/lib/maps.ts`.
- **Removed:** `ClientGrid.tsx`, `ContactMethods.tsx` (replaced).
- **Changed:**
  - `globals.css`: tokens, sections, cards, projects, clients wall, form groups, map.
  - `fonts.ts`, `layout.tsx`, `global-not-found.tsx`, `NotFoundView.tsx`: Sora and Manrope.
  - Pages: home, about, services, projects, industries, clients, certificates, contact.
  - Components: Intro, WhyRawasy, Certificates, ServiceRow, CertificateRegister, InnerCTA,
    LegalPageLayout, LegalToc, QuoteForm, ButtonLink.
  - Content and types: about, contact, home, legal, pages, projects, repository, types; plus
    `page-meta.ts` (projects → review) and `inner-page.ts`.
- **Tests:** new `e2e/redesign-v2.spec.ts`; updated `helpers.ts` (projects added to the inner
  pages), `stage-1c.spec.ts` and `visual-system.spec.ts`.
- **Other:** `scripts/generate-og.mjs` (Sora) and `public/og/og-en.png`.
- **Docs commit:** this report, `README.md` and `CLAUDE.md`.

### 4. New global palette

Semantic roles are set with `data-tone` on cards, chips, tags and panels. Each role provides
`--tone`, `--tone-ink` (small text), `--tone-surface` and `--tone-line`.

| Role | Light | Dark | Used for |
| --- | --- | --- | --- |
| Brand (orange) | `#F15F22`, text `#B8440F` | `#F15F22`, text `#FF7A3D` | primary buttons, active states, key indicators |
| Engineering (steel blue) | `#416F82`, ink `#355C70`, surfaces `#E6EDF0` / `#D8E3E8` | `#5F8EA2`, ink `#92B8C9`, surfaces `#17222A` / `#1D2B34` | machinery, technical and information areas, steel buttons |
| Process (teal) | `#39766F`, ink `#2F6660`, surfaces `#E4EEEB` / `#D4E5E0` | `#56978D`, ink `#8CC7BC`, surfaces `#152320` / `#1B2D29` | process, capability, site support, teal buttons |
| Craft (brass) | `#A98549`, ink `#7A5C26`, surfaces `#F3ECDF` / `#E9DDC6` | `#BEA069`, ink `#D6BE8C`, surfaces `#211D16` / `#2A251B` | craftsmanship, certificates, workshop plates |
| Deep slate | `#34434A` (panel `#3D4E56`) | `#1E2A30` (panel `#25343B`) | dark technical blocks (projects feature, workshop, vision panel) |
| Graphite band | `#1E2123` | `#0F1213` | statement, metrics, CTA bands |
| Base | background `#F3F1ED`, elevated `#FBFAF7`, recessed `#E6E3DD` | background `#16191B`, elevated `#232A2E`, recessed `#121517` | warm off-white / graphite with blue-grey panels |

Section surfaces: `.sec-eng`, `.sec-proc`, `.sec-craft` (tinted, each with its own tinted grid),
`.sec-deep` (recessed) and `.sec-slate` (dark band). Colour comes through surfaces, edges, icons and
tags. Paragraphs stay in the neutral inks.

### 5. Typography system

| Role | English | Arabic |
| --- | --- | --- |
| Display, H1, major H2, key statements | **Sora** 600–700, tight tracking | Noto Kufi Arabic 600–700 (unchanged) |
| Body, navigation, forms, buttons | **Manrope** 400–700 | IBM Plex Sans Arabic 400/500 (unchanged) |
| Technical labels (references, machine data, dimensions) | Geist Mono 500 | IBM Plex Sans Arabic 500 |

- Hierarchy: `t-display`, `t-h1` (650), `t-h2`, `t-h2-compact`, `t-title`, `t-h3`, `t-h4` (Manrope
  700), `t-lead`, `t-body`, and the new `t-caption` and `t-stat` (tabular display figures). Sizes and
  tracking were re-tuned for Sora; `font-variation-settings` was removed.
- Typographic accents only: outlined project and step numbers, the vision quote (`.vision-quote`),
  machinery and capability figures (`t-stat`) and the precision statement.
- Arabic was reviewed with no size increase: Kufi stays on headings and Plex on text, there is no
  letter-spacing (enforced globally), and the line heights are unchanged.
- All fonts are self-hosted through `next/font`. The tests check that no request goes to Google
  Fonts at runtime.
- The English share image (`public/og/og-en.png`) was regenerated in Sora.

### 6. Border system

- `--border-subtle` (light 10% / dark 9%), `--border` (17% / 15%), `--border-strong` (30% / 26%),
  `--border-ink` (62% / 45%).
- `--border-active` (orange), and `--border-steel`, `--border-teal`, `--border-brass` for tinted
  edges.
- Usage:
  - Cards carry a 1px border and a 3px coloured top edge (`.card-edge`).
  - Active and hovered cards take their tone's edge.
  - Form fields have a stronger bottom edge.
  - The clients wall uses 1px dividers.
  - Double rules and corner marks from 1C-V remain.

### 7. Shadow system

Theme-aware tokens:
- `--shadow-card`: contact shadow plus a short soft drop.
- `--shadow-raised`: top-edge light, bottom-edge shade and a deeper drop, for lifted plates and
  hovered cards.
- `--shadow-image`: photos and prints.
- `--shadow-floating`: pinned photos, hovered logo cells.
- `--shadow-inset`: form groups, wells, recessed plates.

In dark mode the shadows are deeper and panels get a light top edge, so graphite layers separate.
The 1C-V names (`--shadow-low/-medium/-metal/-soft`) are aliases.

### 8. Homepage changes

The hero is unchanged, except that its headline now uses Sora (your typography instruction).

Below the hero:
- Controlled background sequence: neutral → **teal** (key capabilities) → neutral (services) →
  graphite (precision statement) → **steel** (machinery) → neutral (projects) → recessed
  (industries) → neutral (Why RAWASY) → graphite (metrics) → neutral (clients) → **brass**
  (certificates) → dark CTA.
- Why RAWASY is now six tone-edged cards with the drawn line icons.
- Certificates are brass-edged cards on brass plates.
- The client marquee stays, with no count or numbering.

### 9. Homepage About changes

"Who we are" now explains the company before visitors go deeper:
- the company statement and two paragraphs;
- the registered-name plate;
- **What we do:** six service cards (Laser Cutting, CNC Bending, Steel Structures, Metal
  Fabrication, Laser Engraving, Scaffolding), each with a line icon, a tone edge and its tagline;
- **Beyond metalwork:** a teal site-support panel (formwork systems, wood and steel props, rental,
  installation and dismantling, transportation), sourced from profile p.2 and p.6;
- a brass workshop plate with two genuine workshop photos at close to native size;
- a deep-slate **vision** panel with the vision statement and closing line;
- the CTAs **About RAWASY** (graphite) and **Explore services** (outline).

All copy comes from the company profile.

### 10. About page changes

Fifteen parts, each with its own surface:
1. introduction (hero with the workshop photo and registered-name plate);
2. who RAWASY is;
3. what RAWASY does (two division panels: the metal section and the scaffolding section);
4. core metal services (five cards with icons and scope tags, on steel);
5. scaffolding and site support (photo, teal support tiles, a teal button);
6. vision (graphite band with aims);
7. engineering approach (steel figure plates for 12,000 W, 360°, 04 and 06, plus the capability
   statements);
8. how RAWASY works (six numbered cards on teal);
9. why RAWASY (six pillar cards);
10. workshop imagery (a contact sheet of seven genuine workshop photos on slate);
11. machinery teaser (a technical table of the six machines with rated power, and a steel button to
    Capabilities);
12. projects teaser (four project cards);
13. clients teaser (six logos, no count);
14. compliance teaser (three brass certificate cards);
15. contact CTA.

Nothing is invented: no founding year, headcount, revenue, project count or capacity. "New
structures" was removed from the support list because the profile's "New Struck(s)" is still
unclear (asset inventory item 7).

### 11. Projects overview changes

It was an in-development placeholder; now it is built (`/en/projects`, `/ar/projects`, status `review`):
- **Hero:** layered collage of three project photos on a slate plate, title, short intro,
  compact category chips, technical metadata.
- **Featured project:** tulip roundabout sculpture on a deep-slate band. Large framed photo with an
  inset, reference number, factual description, category tags, View project.
- **Highlights:** four projects in an asymmetric two-column editorial layout on steel, with pinned
  thumbnails and outlined reference numbers.
- **Gallery:** image-led masonry (1 / 2 / 3 / 4 columns), 27 cards, sticky filter bar.
- **Card hover and focus:** lift, active border, image zoom 1.035, shade change, category flag, the
  title shifts, arrow in, deeper shadow.
- **Index:** a three-column text list at the end, as secondary navigation.

### 12. Project image strategy

The profile's photos are mostly 150–470 px wide, so each card picks a layout by source size:
- *photo:* one photo at card width, only if it is at least 250 px wide;
- *pair:* two small photos side by side;
- *framed:* one small photo at native size on a tinted grid plate.

Highlights and the featured photo enlarge at most 1.25–1.3×. The hero uses a collage of prints.

Excluded until RAWASY confirms them:
- AI-watermarked photos (wheat monument #07 installation, stainless landmark, billboard structure);
- projects flagged for authorship (illuminated cubes, seed sculpture, canopy tree);
- catalogue renders (bench, litter bins).

That leaves 27 of 34 projects showcased. The wheat monument appears only with its genuine workshop
photos.

### 13. Project filters

- **Categories:** All, Architectural Metal, Structures, Fabrication, Public Realm, Decorative
  Metal, Shade & Canopies, Laser-Cut Work, Custom Work. They are website classifications and are
  labelled as such.
- **Controls:** real toggle buttons (`aria-pressed`). A polite live region announces "Showing: …"
  (no counts).
- **Animation:** the wall re-flows with a view transition where supported; reduced motion switches
  it off.
- **Quick filter:** the hero's chips set the gallery filter and scroll to it.
- **Phones:** the filter bar scrolls sideways without scrolling the page.
- **Without JavaScript:** all projects are shown and the filters are hidden.

### 14. Clients page changes

- **Wall:** a seamless logo wall on a steel-tinted section. Cells are joined by 1px dividers, and
  wide logos get double-width cells.
- **Layout:** planned per breakpoint (6 / 4 / 2 columns) so every row is full and the profile order
  is kept.
- **Colour:** a few cells carry steel, teal or brass tints. Hovering a cell lifts it and shows the
  logo's own colours on a paper plate (dark theme included).
- **Keyboard and touch:** an **Original colours** switch shows every logo in colour.
- **Wording:** the trademark note stays. There are no partnership claims or testimonials.

### 15. Client numbering and counts removed

Confirmed. The clients page no longer shows:
- cell numbers (01, 02, …);
- A–G / 1–3 grid references;
- the "RW—C · 01" sheet code;
- any count;
- numbers on the closing CTA rows.

The homepage marquee shows no count. A browser test checks the page text for all of these.

### 16. Contact page changes

- **Hero:** contact cards (phone in steel, WhatsApp in teal, email in steel, address in brass), a
  primary **Request a quote** button and a graphite **Find us** button.
- **Quote section:** on a recessed band. Each field group is its own panel with a header bar; fields
  are raised above a recessed plate with a stronger bottom edge; labels are semibold and hints use
  higher-contrast ink.
- **Location section:** follows the form (details below).

### 17. Google Maps implementation

- **Source:** the verified address text from `company.ts` (profile p.16): "Al Mashael, Sulay, Riyadh
  14325, Saudi Arabia". No coordinates are invented; the old approximate `geo` value is not used.
- **Embed:** a keyless address search (`https://www.google.com/maps?q=…&hl=en|ar&z=15&output=embed`),
  in an `<iframe>` with `loading="lazy"`, a descriptive localized `title`,
  `referrerpolicy="strict-origin-when-cross-origin"` and no API key.
- **Links:** **Get directions** (steel button) opens
  `https://www.google.com/maps/dir/?api=1&destination=…` in a new tab (`rel="noopener noreferrer"`,
  with an "opens in a new tab" note for screen readers). **Open in Google Maps** is a text link.
- **Design:**
  - a framed map with corner marks and a shadow;
  - a plan-grid placeholder with a pin, shown until the map loads;
  - a caption ("Google Maps · located from the address");
  - beside it, the address with a pin icon, the registered name in both languages, and the phone
    and email.
- **Layout:** side by side on desktop, stacked on phones (details first).
- **Privacy policy:** the "Other services" section now mentions the embedded map, with a
  pending-confirmation note.

**Limitation:** google.com is blocked in this cloud environment, so the live map could not be viewed
here. Screenshots and tests use a stub for the embed. Please check the map on a normal connection.

### 18. Services visual changes

- Each of the six services is now its own panel with a tone edge (steel for laser cutting, CNC
  bending and steel structures; brass for fabrication and engraving; teal for scaffolding).
- Each panel carries a large line-icon chip and an outlined index.
- Scope bullets and equipment appear as tone tags.
- Each panel has a contextual button: steel, graphite or teal.
- The scroll spy still marks the panel being read with an orange edge.

### 19. Certificate visual changes

- **Register table:** brass edge and a brass header row.
- **Documents:** each document is a brass-edged card on a brass-tinted band. Previews sit on brass
  grid plates, with brass labels and a brass hover on the viewer button.
- **Redaction list:** numbered in brass.
- **Homepage and About:** certificate cards use the same brass treatment.
- Orange remains only for focus and primary actions.

### 20. Light-theme improvements

- Warm off-white base with steel, teal and brass tinted sections.
- Visible 17–30% borders and real contact shadows, so cards and panels clearly sit above or below
  the surface.
- Coloured icon chips and tags.
- Not beige-and-orange only.

### 21. Dark-theme improvements

- Graphite base with blue-grey elevated panels, deeper shadows and top-edge light.
- Steel and teal tinted sections, and restrained brass on certificates.
- A deep-slate band for dark technical blocks.
- Orange only for actions.
- Logo reveals use a light paper plate, so colour logos stay legible.
- No black-and-orange look.

### 22. Responsive QA
- **Visual matrix:** 200 captures against the production build: home, about, services, projects,
  industries, clients, certificates, contact, privacy and terms at 1440 / 1280 / 834 / 390 / 360 in
  EN and AR, light and dark. All returned 200, with no sideways overflow and no console errors or
  warnings. About and contact were recaptured after the final contrast fixes.
- **Browser tests:** no sideways scrolling on any inner page (now including projects) at 360, 390
  and 834 px in both languages.
  - Projects: the gallery is 4 / 2 / 1 columns at 1440 / 834 / 390, and the filter bar scrolls
    sideways on phones without moving the page.
  - Clients: the wall is 6 columns on desktop and 2 on phones, with every row full.
  - Contact: map and details sit side by side on desktop and stack on phones, details first.
- **Layouts:**
  - Projects: masonry 1 / 2 / 3 / 4 columns (640 / 1024 / 1280 px); on tablets the highlights
    alternate sides; on phones cards are full-width and image-led, with pairs of small photos where
    a project has them.
  - About: cards step 1 → 2 → 3 columns and the workshop sheet centres its prints.
  - Contact: cards step 1 → 2 columns.
- Chromium blanks full-page captures past about 16,000 px, so the mobile Projects and About sheets
  show the first 16,000 px.

### 23. Accessibility QA
- **axe-core** (WCAG 2.0 / 2.1 / 2.2 A + AA and best practice): 104 audits covering 11 pages
  (404 included) × EN/AR × light/dark × 1440/390, plus two interactive states (a project filter
  chosen, the clients colour switch on). **No serious or critical findings.**
- **Pre-existing findings:** two moderate best-practice findings remain, identical in the 1C-V
  build, both in the approved shared shell. The header and footer each have a nav labelled
  "Language", and the floating WhatsApp button sits outside a landmark. I suggest fixing them in
  1I / 1J.
- **Fixed during QA:**
  - orange "Fig." numbers on the slate workshop band (3.1:1): now a lifted orange `#FFA072`,
    above 5:1;
  - orange step numbers on the recessed quote band (4.43:1): now teal ink, 5.4:1;
  - definition-list order in the engineering figures;
  - "not stated" in the machine table is now screen-reader text rather than an `aria-label` on a
    span;
  - highlight images no longer repeat the project name the link already gives.
- **Contrast test:** 20 text/surface pairs (role inks on their surfaces, captions, buttons, slate
  text, logo plates) reach 4.5:1 or more in both themes; a browser test checks this.
- **Keyboard:**
  - filter chips work with Enter and Space;
  - project cards show the focus ring;
  - the colour switch works with Space;
  - Get directions and Open in Google Maps are reachable links;
  - skip link, services index and industries preview are unchanged.
- **Screen readers:**
  - filter changes are announced through a polite live region ("Showing: …", no counts);
  - external links say "opens in a new tab";
  - the map `<iframe>` has a descriptive, localized title;
  - the clients wall is a labelled list under an h2, and every logo keeps its company name as alt
    text;
  - decoration stays `aria-hidden`, and the test now also covers the new layers.
- **Reduced motion:** no view transition when filtering, no card lift or zoom, and ambient layers
  stay still. Content in view is never left hidden.
- **Without JavaScript:** all projects are listed, the filters are hidden, the colour switch still
  works (pure CSS) and the map embed loads.

### 24. Performance comparison
Headless Chromium, 1440×900, light theme, average of 3 runs. Each run scrolls the whole page
(45 px per frame), then idles 4 s with an ambient area in view.

| Page | 1C-V scroll fps | V2 scroll fps | 1C-V worst frame | V2 worst frame | 1C-V scroll CPU | V2 scroll CPU | Idle 4 s CPU (1C-V → V2) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 56 | 56 | 51 ms | 49 ms | 1,685 ms | 1,812 ms | 250 → 278 ms |
| About | 58 | 59 | 42 ms | 40 ms | 431 ms | 1,024 ms | 9 → 14 ms |
| Services | 56 | 55 | 38 ms | 42 ms | 567 ms | 616 ms | 8 → 10 ms |
| Clients | 50 | 58 | 39 ms | 42 ms | 100 ms | 120 ms | 11 → 5 ms |
| Contact | 54 | 54 | 43 ms | 42 ms | 116 ms | 160 ms | 2 → 1 ms |
| Projects (new) | — | 54 | — | 67 ms | — | 883 ms | 12 ms |

- **Frame rate:** unchanged or better everywhere.
- **Scroll CPU:** grows with page length. About doubled from 7,631 to 15,176 px and gained 13
  sections, so its scroll work roughly doubled. The homepage is 6% longer and costs 7.5% more.
- **Idle cost:** essentially unchanged.
- **Projects:** the worst frame (67 ms) comes from decoding photos on the first pass through a
  27-card gallery.
- **Motion added:** view transitions, only when filtering. No blur, `background-position`, canvas,
  WebGL or video animation.

### 25. Lint
`npm run lint` passes with no errors or warnings.

### 26. Typecheck
`npm run typecheck` (`next typegen && tsc --noEmit`) passes.

### 27. Build
`npm run build` passes. 109 static pages are generated in both languages. The sitemap still lists only `/en` and `/ar`: every review page stays noindex and out of the sitemap.

### 28. Browser tests
`npm run test:e2e`: **86 passed, 0 failed** against the final production build. The new
`redesign-v2.spec.ts` (24 tests) covers:
- **Projects:** page order, excluded photos and projects, filters (click, keyboard, hero quick
  filter, live region), hover and focus, column counts, the phone filter bar, reduced motion,
  no-JS.
- **Clients:** no numbering, grid references or counts; colour switch; hover reveal.
- **Contact map:** embed attributes, directions link, layout.
- **Fonts:** Sora, Manrope and Geist Mono self-hosted; Arabic fonts.
- **Contrast:** colour roles in light and dark.
- **Content:** the About profile and the homepage intro.

Earlier specs were updated for the new markup (clients wall, contact cards, privacy date), and
projects joined the shared inner-page checks (routes, SEO, noindex, overflow, reduced motion,
no-JS, internal links).

One legal-contents test failed once under parallel load earlier in the session. It passed in three
repeated runs and in the final full run.

### 29. Stage 1D not started
Confirmed. There are no service detail pages; the `service` route is still `planned`.

### 30. Project detail pages not started
Confirmed. `/[locale]/projects/[slug]` is still `planned` (in-development page, noindex). Project
cards link to those routes. No project information was invented.

### 31. Capabilities remains Stage 1E
Confirmed. `capabilities` is still `planned`. Only its colour direction is locked (steel blue,
graphite, orange active lines, machine photography, cards and panels, technical tables, visible
borders, shadows, scan lines). The About machinery teaser links to it.

## Items needing RAWASY's confirmation

1. **Google Maps place link:** the map and directions use an address search. Please send RAWASY's
   own Google Maps place link (or confirm the pin) so directions lead to the exact site.
2. **Laser-engraving photo:** the engraving cover photo shows a third-party brand name ("HITACHI")
   and part and serial numbers. Please confirm it may be shown. It is kept off the new featured spots.
3. **"New Struck(s)":** still unclear, so it is omitted.
4. **Project authenticity and AI marks:** seven projects and three photos are still withheld (see
   item 12 and `docs/ASSET_INVENTORY.md`).
5. **Stock-like photos:** the stock-like service photos (CNC, steel, scaffolding) need licence
   confirmation or RAWASY's own photography.
6. **Privacy wording:** the Google Maps paragraph in the privacy policy needs confirmation from your
   legal adviser.

## Known limitations

- The live Google map could not be loaded in this environment (network policy). It is stubbed in
  tests and screenshots.
- The profile's photos are low resolution. Layouts respect that, but original photography would
  lift every page.
- Chromium full-page screenshots taller than about 16,000 px are blank at the bottom. The mobile
  Projects and About sheets show the first 16,000 px.
- Project and service detail pages are still in-development placeholders (1F and 1D).

## How to run

`npm install` · `npm run dev` (http://localhost:3000/en) · `npm run lint` · `npm run typecheck` ·
`npm run build` · `npm run test:e2e` (after a build).

## Next steps

Your visual review of V2. Once V2 is approved, Stage 1D (service detail pages) can start. 1E
(capabilities and machinery) and 1F (project detail pages) follow, and publication stays at 1J.
