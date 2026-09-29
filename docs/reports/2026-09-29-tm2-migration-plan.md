# RAWASY Metal Website — Stage TM-2 pre-migration audit and implementation plan

**Date:** 2026-09-29 · **Branch:** `claude/new-session-5eijs6` · **Audited code:** `9a1cdae` (TM-1 plus the navigation
correction)

**Status: a read-only plan for your review. Nothing was built, changed or deployed, and nothing is approved.**

- No file under `src/`, `e2e/`, `public/` or the configuration changed. This commit adds this report and points
  `CLAUDE.md` at it; nothing else.
- TM-1 is untouched. The rollback checkpoint is intact: `preserve/pre-tm1-a-v2-migration` on GitHub and the local tag
  `pre-tm1-a-v2-migration`, both at `3260415`.
- I did not start TM-2, Stage 1E or Stage 1F.

---

## A. Summary

- **Scope.** 15 pages plus the localized 404, in English and Arabic: 32 routes.
  - The 15 pages: About, the services overview, the six service pages, the Projects overview, Industries, Clients,
    Certificates, Contact, Privacy and Terms.
- **What already exists.** TM-1 built the Modern Commerce (MC) foundation for production:
  - its own root layout, tokens, fonts, theme, ambient background, pointer and motion controller;
  - a header and footer that already link every inner page.
  - The homepage's sections also give us ready-made cards: services, machinery, projects, industries, clients,
    compliance and contact.
- **What is missing.** An inner-page kit:
  - page hero, breadcrumbs, long-form text and the legal contents list;
  - sticky section navigation, tables and a dialog;
  - form states, the gallery filter, figures with captions, a closing call to action and a 404 view.
  - All of this is styling within the approved A V2 system. It needs no new design concept.
- **Recommendation.** Six batches, and each waits for your approval before the next begins (section F):
  1. **TM-2.1** — the kit, Privacy, Terms and the localized 404
  2. **TM-2.2** — Contact (quotation form and Google Map)
  3. **TM-2.3** — About, Industries, Clients and Certificates
  4. **TM-2.4** — the services overview and the six service pages
  5. **TM-2.5** — the Projects overview
  6. **TM-2.6** — retiring the previous design, once every page is approved
- **Your decisions.** There are 13 (section G). The ones that matter most:
  - TM-2 starts only after you approve the TM-1 homepage.
  - Where project cards should link until the project pages (1F) exist.
  - What happens to the two flagged engraving images on the services overview.
  - Whether to keep the floating WhatsApp button.
  - Whether the four other service drawings get new animation. I recommend they do not.
- **Nothing is loosened.** Every pending approval and factual limitation stays as it is (section H).

## B. How the audit was done

- **Source code.** I read:
  - every route in `src/app/[locale]/` and every component those routes use;
  - the content files, `page-meta.ts`, `routes.ts` and `maps.ts`;
  - the MC foundation: `system.css`, `commerce.css`, `Motion.tsx`, `Cursor`, the shell and the homepage sections;
  - the browser tests and `docs/ASSET_INVENTORY.md`.
- **Build output.** In the prerendered HTML of the current build I counted, for each page:
  - images, with their media files;
  - links, including links to pages that are still planned;
  - anchors and structured data.
  - I counted the English pages; the Arabic pages have the same structure.
- **Framework documentation.** The Next.js 16 documentation bundled with the project: how `not-found.tsx` and
  `global-not-found.tsx` behave with two root layouts.
- **Found in the code and the documentation, not in a browser.** Four findings below come from reading, because this
  audit changes nothing:
  - the header's backdrop blur (`system.css`);
  - the pointer's `cursor: none` rule (`system.css`);
  - how the 404 is resolved (the Next.js documentation);
  - how cross-design links are matched (`routes.ts`).

## C. Cross-cutting plan (applies to every page)

### C1. How a page moves to the new design

- **The move.** `src/app/[locale]/<page>/page.tsx` moves to `src/app/(commerce)/[locale]/<page>/page.tsx`.
  - Its key is added to `commerceRoutes`.
  - It renders inside the MC `PageShell` with `getShellView(locale, { route, path })`.
- **One path, one design.** The same path cannot exist in both route trees: the build fails. So every move is atomic.
  A page is in one design or the other, never both, and there is no switch between them.
- **What stops applying.** On a moved page the previous design's parts no longer run:
  - the loader and the page-wipe transition (`template.tsx`);
  - the old header and footer, and the floating WhatsApp button;
  - the old cursor, the old reveal and ambient observers, and `BootFallback`.
- **What stays the same.**
  - Copy is still read from `src/content/*` through the repository.
  - Metadata, the breadcrumb trail and structured data still come from `src/lib/inner-page.ts`, so they can stay
    byte-identical.
- **Old components stay frozen.** A previous-design component is never edited during TM-2, because several are shared
  by pages that have not moved yet. For example:
  - `ProjectCard`: About, the gallery and the service pages;
  - `MediaFrame`: About, the services overview, the service pages and five of their drawings;
  - `InnerPageHero`: every inner page;
  - `NotFoundView`: the 404 and the global fallback.

  Migrated pages get their own MC components. Components used by a single page can be restyled in place when that
  page moves: `QuoteForm`, `LocationSection`, `CertificateRegister`, `ClientWall`, `IndustryIndex` and the gallery
  components.
- **Cross-design links and dynamic routes.** `crossDesignLink()` matches static routes only.
  - `href(locale, "service")` gives `/en/services/[slug]`, which never equals a real path.
  - Before the service pages move, it needs a pattern match for dynamic routes. Without one, previous-design pages
    would prefetch MC service pages and pick up their font hints: the leak TM-1 fixed.
- **Links on MC pages.** They stay plain `<a>` links (full page loads) until the whole site is MC, so no prefetch ever
  crosses designs in either direction.
  - MC already cross-fades between MC pages (`@view-transition { navigation: auto }` in `commerce.css`), so moving
    from one migrated page to another will fade.
  - Switching MC-to-MC links to `<Link>` is a TM-2.6 option, to be measured first. TM-2 does not need it.
- **Current page in the header.** The header marks the current page by route key. Service pages use the key
  `service`, so the Services item, and that service's entry in the dropdown, must also count it as current.

### C2. The localized 404 across two root layouts (this fixes the batch order)

- **How Next.js resolves it.** `notFound()` renders the nearest `not-found.tsx` in its own root layout.
  - The MC tree has no `not-found.tsx` today.
  - So a migrated route that calls `notFound()` would show Next's default page inside the MC layout. The service
    route does this for an unknown service.
- **TM-2.1 fixes this first.**
  - It adds `(commerce)/[locale]/not-found.tsx`: the MC view, with the locale from `next/root-params`, noindex and a
    real 404 status.
  - It moves the catch-all `[...rest]` into the MC tree, so unmatched `/en/…` and `/ar/…` addresses get the MC 404.
- **Two 404 looks for a while.** The previous design's `[locale]/not-found.tsx` must stay while old routes can still
  call it:
  - `/xx/services/<unknown>` until TM-2.4;
  - `/xx/projects/<unknown>` until the placeholder moves in TM-2.6.

  Until then those two address families show the previous design's 404. This is a known, temporary mix.
- **Theme on client-built 404s.** Next.js 16 builds some 404s in the browser. In the previous design `BootFallback`
  reapplies the theme after that. On the MC side this must be checked: the MC boot script runs in `<head>`.
- **The global fallback moves last.** `global-not-found.tsx` (the bilingual page for addresses outside any language)
  moves in TM-2.6, with MC fonts that do not preload.
  - It sits in every route's module graph, so its fonts and CSS must be proved again not to reach other pages. That
    leak happened once already, in TM-1.

### C3. The inner-page kit (new MC components)

- **Location.** New files go in `src/components/commerce/inner/` (and `commerce/<page>/` where a part belongs to one
  page).
- **Styling.** Styles are MC tokens scoped to `.mc`, in light and dark themes, in English and Arabic.
- **Build order.** The kit is built once in TM-2.1 and extended batch by batch:

| Kit part | Replaces (previous design) | First batch |
| --- | --- | --- |
| Page hero: split, stacked and compact; breadcrumb, eyebrow, H1, lead, actions, side or lower visual | `InnerPageHero`, `MetaStrip` | 2.1 |
| Breadcrumbs (labelled `nav`, current page) | `Breadcrumbs` | 2.1 |
| Section head (the homepage's `SectionHead`, with its reading zone over the ambient) | `SectionHeader`, `EditorialSection` | 2.1 |
| Long-form text: English and Arabic line lengths, Arabic line height, lists and links | legal typography | 2.1 |
| "Pending confirmation" callout | legal `pending` note | 2.1 |
| Sticky section navigation (disclosure on phones, pinned on desktop, current section), with an MC header-height token | `LegalToc`, `ServiceScrollSpy` | 2.1 |
| Closing call to action (the homepage's `a2-cta` pattern; with or without numbers) | `InnerCTA`, `ServiceCTA` | 2.1 |
| 404 view | `NotFoundView` | 2.1 |
| Form states: invalid (not colour alone), error text, error summary, select with a mirrored arrow, textarea, file list, fieldset and legend, "ready to send" panel | `form-control` and the old form panels | 2.2 |
| Map frame (embed and behaviour unchanged) | `LocationSection` frame | 2.2 |
| Figure: photo and caption, never shown wider than its source | `MediaFrame` | 2.3 |
| Data table (certificate register, machine table) | register table, `MachineTable` | 2.3 |
| Dialog (certificate viewer) | `CertificateRegister` styling | 2.3 |
| Logo wall (the homepage's logo tiles and colour toggle) | `ClientWall` | 2.3 |
| Service hero and drawing host; scope, process, gallery and machine blocks | `ServiceHero` and the service sections | 2.4 |
| Gallery filter chips and masonry wall | `FilterChips`, `ProjectGallery` | 2.5 |

- **Reveals.** MC reveals already support the default, `fade` and `clip` kinds (`commerce.css`). The previous design's
  `mask` reveal is not carried over. The draw-on-reveal of the four service drawings (the inherited `--draw` pattern)
  is ported to MC's `data-shown` (E5).

### C4. What does not carry over (A V2 rules; decision D8)

- **Retired on MC pages.** The previous design's precision-engineering decoration:
  - technical grid backdrops (`Backdrop` grid, fine and perforated, and their drift), `ScanLine`;
  - `FrameMarks` and `TechnicalFrame`, rulers and registration marks, `PointerLight`;
  - the page loader and the page wipe;
  - outlined numerals, "Figure NN" labels, the `Nameplate` and the About hero sketch.

  A V2 rules out a blueprint, CAD or technical-grid look, and allows at most two moving full-screen layers.
- **What MC pages get instead.**
  - The site-wide ambient: micro-dots and one light sweep.
  - The MC pointer on a desktop mouse.
  - Reveals.
  - The service pages' own drawings: the two approved signatures, and the other four drawings restyled.
- **No new decorative concept** without your brief.

### C5. Content, SEO and publication rules for every batch

- **Copy stays as it is.** It stays in the content layer. No text is rewritten, added or removed without your
  approval.
- **Hard-coded copy moves, unchanged.** Copy found inside a component moves into the content layer word for word. For
  example, the machine table's "Not stated in the company profile" / "غير مذكورة في الملف التعريفي".
- **Status does not change.** Every page keeps its status: `review` pages stay noindex and out of the sitemap. Only
  the homepage is published, and nothing is published before Stage 1J.
- **Search metadata stays byte-identical.** Title, description, canonical, language alternates, robots and structured
  data are proved identical in every batch. The sitemap and robots output do not change.

### C6. Gates for every batch (all must pass before I report it)

1. **Build and tests.** `npm run lint`, `npm run typecheck`, `npm run build` and the full `npm run test:e2e` pass.
2. **Content parity.** The visible text of each migrated page, in both languages, is compared with its previous-design
   version, and every difference is listed. The only differences expected are labels you approve.
3. **SEO parity.** `<head>` metadata and structured data are identical; statuses and the sitemap are unchanged.
4. **Untouched pages.**
   - Pages still in the previous design match the previous batch's build: HTML, CSS bytes, resolved page data and
     screenshots. The only allowed difference is `prefetch={false}` on links to newly migrated pages.
   - The homepage's markup is unchanged and its captures are pixel-identical. Shared CSS changes are additions only,
     and they are listed.
   - The theme lab is unchanged, including where it re-exports MC modules.
5. **Visual matrix.**
   - Every page in English and Arabic, light and dark, at 1440, 1024, 834, 390 and 360 px.
   - No sideways overflow and no console errors.
   - Captures are sent to you.
6. **Accessibility.**
   - axe reports no serious or critical findings.
   - The two moderate shell findings (`landmark-unique`, `region`) are gone. Both come from previous-design shell
     parts that MC does not have.
   - Keyboard path and visible focus.
   - Reduced motion, no JavaScript and forced colours.
   - Reflow at 320 px and 200 % zoom.
   - Text contrast measured pixel by pixel over the ambient.
7. **Performance.**
   - Scrolling at 55 fps or more at 1440 px. This is measured with software compositing (the worst case), jumping
     through the page to the bottom.
   - Idle redraws close to the homepage's.
   - No extra blurred layers over the moving background.
   - Image bytes and the largest paint no worse than the previous version.
8. **Rollback.** A `preserve/pre-tm2.N` branch is created before each batch, and each batch goes in its own commits
   with its own report.

### C7. Tests

- **No assertion is lost.** Every functional assertion moves with its page. None is dropped without an equivalent,
  and each batch report maps old tests to new ones.
- **Where the assertions are today.**
  - `stage-1c.spec.ts` (21 tests): routes and SEO, overflow, dark theme, the clients wall, the certificate dialog, the
    quote form, legal notes and contents, the 404, the skip link, the services index, the industries preview, reduced
    motion and no JavaScript.
  - `redesign-v2.spec.ts` (19 tests): the projects page, clients, the map, fonts, colour-role contrast and About's
    fifteen parts.
  - `service-pages.spec.ts` (16 tests): the six service pages.
- **New specs** (`e2e/commerce-*.spec.ts`) reuse the probes in `e2e/a2-helpers.ts`.
- **Tests that change on purpose.**
  - Font tests: Sora, Manrope and Noto Kufi Arabic give way to Plus Jakarta Sans, Inter, Tajawal and IBM Plex Sans
    Arabic.
  - The previous design's colour-role contrast test gives way to MC token contrast.
- **Retired last.** `site.spec.ts` and `visual-system.spec.ts` test the previous design's shell on inner pages. They
  keep a page in that design as their target until TM-2.6, then retire with it.

---

## D. Page-by-page audit (the ten points for each page)

### D1. About (`/about`) — the longest company page (15 parts)

1. **Current components and dependencies.**
   - **Hero.** `InnerPageHero` (split) with a `Nameplate` action, `StructuralSketch` plus a `MediaFrame` photo
     (preloaded) beside it, and a `MetaStrip`.
   - **Thirteen anchored sections:**
     - `#overview`: `SectionRule`, `Phrases`;
     - `#what`: `DivisionPanels`, linking to `#metal` and `#beyond`;
     - `#metal`: five `ServiceCard`s;
     - `#beyond`: `MediaFrame`, `SupportList`, a teal `ButtonLink` to Scaffolding;
     - `#vision`: a dark band with two `Backdrop`s (one drifting), a 13 s `ScanLine`, a blockquote, and the aims in
       `FrameMarks`;
     - `#approach`: `ApproachPanel`;
     - `#process`: `ProcessCards`;
     - `#why`: `PillarCards`;
     - `#workshop`: a dark band with `WorkshopSheet` photos;
     - `#machinery`: `MachineTable`, plus a steel `ButtonLink` to Capabilities;
     - `#work`: four `ProjectCard`s;
     - `#clients`: `LogoStrip` with six logos;
     - `#compliance`: `CertificateCards`.
   - **Closing and data.** A closing `InnerCTA`. Structured data: Organization/LocalBusiness, WebSite, AboutPage,
     BreadcrumbList. Copy: `src/content/about.ts`.
2. **New MC components.**
   - Page hero (split, photo beside the text) and section heads.
   - From the homepage: service cards (`home/Services.tsx`), project cards (`home/Projects.tsx`), logo tiles and
     compliance cards (`home/Clients.tsx`).
   - Machine cards in the homepage's machinery style. The machine selector is not included: it belongs to 1E.
   - A statement block for the vision, numbered steps (`step-num`), pillars (`a2-pillar`), figures, a machine table
     and the closing call to action.
3. **Content and functions to preserve.**
   - All 15 parts and the 13 anchors, and every sentence.
   - The split between metal work and "beyond metal".
   - "Not stated in the company profile" for unknown machine values (to be moved into the content layer unchanged).
   - Only sourced figures: no years, staff or counts.
   - The structured data.
4. **EN/AR and RTL.**
   - Arabic headings change from Noto Kufi Arabic to Tajawal (MC's Arabic display face); body text stays IBM Plex
     Sans Arabic. No letter-spacing.
   - Two-column parts and card rows mirror.
   - Figures and phone numbers keep `dir="ltr"`.
5. **Animation.**
   - MC reveals only.
   - The vision band's drifting grid and scan line, the frame marks and the sketch retire (C4); the site ambient
     takes their place.
   - Reduced motion: nothing moves. Without JavaScript: everything is visible.
6. **Images and assets.** 28 images (26 files):
   - machines: 6 transparent cut-outs;
   - projects: 9;
   - clients: 6 logos;
   - services: 4;
   - certificates: 3 redacted thumbnails.

   The photos are small exports from the profile, so they stay close to their native size.
7. **Navigation and CTAs.**
   - Links to the six service pages, the services overview, Clients, Certificates and Contact.
   - One link to Capabilities (planned; D5) and four to project pages (planned; D4).
   - The header marks About as the current page.
8. **SEO / publication.** `review`: noindex, not in the sitemap. Metadata and structured data unchanged.
9. **Accessibility.**
   - One H1, and an H2 per part (each part a region named by its heading).
   - The blockquote stays a blockquote, and the machine table keeps its header cells.
   - Content photos have alt text and decorative images have empty alt. Logos are named.
10. **Migration risks.**
    - The page is long and image-heavy over a moving background, so the scroll gate matters.
    - It reuses cards from four other pages, so those cards must be final first; they are built in the kit.
    - The hero photo must stay the largest paint.
    - Retiring the sketch, the `Nameplate` and the "Figure NN" labels changes the page's character (D8).

### D2. Services overview (`/services`)

1. **Current components and dependencies.**
   - **Hero.** `InnerPageHero` (split, perforated backdrop) with `ServicePlate` beside it: six cells linking to
     `#<service>`, with `PointerLight`.
   - **Service index.** `ServiceScrollSpy`: a sticky client-side index that marks the service in view with
     `data-active` and `aria-current="true"`.
   - **Six service rows.** `ServiceRow` × 6, anchored `#laser-cutting` … `#scaffolding`. Rows alternate sides, and
     each has a cover photo and a supporting photo, highlights, machines with rated power where stated, and a link to
     the detail page.
   - **Closing and data.** `InnerCTA`. Structured data: CollectionPage and BreadcrumbList. Copy: `services.ts` and
     `pages.ts`.
2. **New MC components.**
   - A page hero with a six-service index, and the sticky section navigation (kit).
   - Service rows: a pair of figures, highlight tags and machine chips.
   - The closing call to action.
   - With D6: the `LaserEngrave` drawing in the laser-engraving row, in place of the flagged photos.
3. **Content and functions to preserve.**
   - The six anchors.
   - Highlights, and machines and power only where the profile states them.
   - One link to each detail page.
   - The index's current-service state.
4. **EN/AR and RTL.**
   - Alternating rows mirror, and the sticky index reads from the right.
   - Its labels are localized.
5. **Animation.**
   - The index's state change and reveals.
   - With D6, the engraving drawing plays once when half in view, as on the homepage.
   - `PointerLight` retires.
6. **Images and assets.** 12 images: services 8, site 3, projects 1.
   - Two of them are flagged: `services/engraving-nameplates` (the engraving cover: HITACHI branding, part and serial
     numbers) and `services/engraving-wood` (a render).
   - V2 approved them here, but the homepage and the lab leave them out (D6).
7. **Navigation and CTAs.**
   - Six detail pages, one Capabilities link (planned) and Contact.
   - The homepage's "All services" link and the header's Services menu lead here.
8. **SEO / publication.** `review`; CollectionPage.
9. **Accessibility.**
   - The sticky index becomes a labelled `nav` with `aria-current`, reachable by keyboard.
   - Rows are headed sections, and photos have alt text.
10. **Migration risks.**
    - The flagged photos.
    - The sticky index needs the MC header height, and the scroll-spy thresholds must be re-tuned to MC spacing.
    - The page must go deeper than the homepage's Services section, not repeat it.

### D3. The six service pages (`/services/[slug]`)

1. **Current components and dependencies.** One route (`dynamicParams = true`; `generateStaticParams`; an unknown
   service gives `notFound()`).
   - **Hero.** `ServiceHero` takes its surface and backdrop from `looks.ts`. It carries the breadcrumb, the index
     number and two actions: a quote link to `/contact#quote` and "see work" (to `#gallery` or `#projects`). It also
     holds the service's drawing.
   - **Numbered sections.**
     - overview;
     - scope (six layouts);
     - process: rail, timeline or cycle, with the "general workflow, not a certified procedure" note;
     - machines, linking to `/capabilities` and `/capabilities#<machine>`;
     - applications: sectors by source, uses and categories;
     - gallery: mosaic, sheet or pair, with captions;
     - why, related services, and projects (linking to `/projects/<slug>`).
   - **Closing.** `ServiceCTA`: quote, call, and explore services and projects.
   - **Data.** Structured data: Service and BreadcrumbList. Copy: `service-details.ts`, `servicePage` labels in
     `pages.ts`; relations and galleries in `services.ts`.

| Service | Hero today | Sections | Images | Links to planned pages |
| --- | --- | --- | --- | --- |
| Laser cutting | photo with the nesting sheet laid over it, fine grid, scan line, frame marks | all 9 | 15 (machines 4, projects 9, site 2) | 5 Capabilities, 4 projects |
| CNC bending | photo and fold drawing, fine grid, `PointerLight`, frame marks | all 9 | 5 (services 3, machines 1, projects 1) | 2 Capabilities, 1 project |
| Steel structures | photo and axis plate drawing, scan line | 8 (no machinery) | 11 (services 4, projects 5, site 2) | 0 Capabilities, 4 projects |
| Fabrication | two photos and the workbench drawing | all 9 | 18 (services 6, projects 10, site 1, machines 1) | 2 Capabilities, 4 projects |
| Laser engraving | the engraved brass plate drawing only, scan line | 6 (no machinery, gallery or projects) | 0 | none |
| Scaffolding | photo and bay drawing, fine grid, frame marks | 7 (no machinery or projects) | 7 (services 6, site 1) | none |

2. **New MC components.**
   - A service hero with a drawing host, plus scope, process, gallery, machine, applications and related-service
     blocks, and project cards.
   - The closing call to action, with the call link.
   - The drawings:
     - laser cutting and laser engraving use the approved `LaserCut` and `LaserEngrave` signatures, the same
       components as on the homepage;
     - the other four drawings are restyled in MC colours.
3. **Content and functions to preserve.** The Stage 1D rules:
   - Related projects are only those whose own record lists the service: CNC bending links one; engraving and
     scaffolding link none.
   - Rated power appears only where it is stated.
   - Every process keeps the "general workflow" note.
   - Laser engraving shows no photographs.
   - `projects/canopy-tree-1` stays out of the laser-cutting gallery.
   - A gallery photo is never repeated in the same page's project cards, and no image is shown wider than its source.
   - An unknown service returns a 404, and the `#gallery` and `#projects` anchors stay.
   - Structured data unchanged.
4. **EN/AR and RTL.**
   - The mirroring each drawing has today stays: the engraved plate mirrors in Arabic, and process rails run
     right to left.
   - Sector labels are in Arabic, and figures keep `dir="ltr"`.
5. **Animation.** See E5.
6. **Images and assets.** As listed in the table.
   - `site/welder-sparks` (the fabrication hero) looks like stock; its licence is still open.
   - The machine cut-outs are transparent images.
7. **Navigation and CTAs.**
   - Two quote links per page (to `/contact#quote`) and a call link.
   - Machine cards link to `/capabilities#<machine>` (planned; D5), and project cards to `/projects/<slug>` (planned;
     D4).
   - Related services link to their pages; the breadcrumb runs Home › Services › the service.
8. **SEO / publication.** `review`; Service structured data; 12 static routes.
9. **Accessibility.**
   - Drawings are `aria-hidden`; the copy carries their meaning.
   - A signature replays on hover and on keyboard focus.
   - The process is an ordered list, gallery images have captions, and machines are named.
10. **Migration risks.**
    - One shared component set: a mistake shows on all six pages.
    - Stage 1D still awaits your approval (D3).
    - The dynamic route needs the `crossDesignLink` pattern (C1) and the MC 404 (C2).
    - The signatures are shared with the homepage and must not change for it.
    - Performance with a signature, photos and the ambient on one page.

### D4. Projects overview (`/projects`)

1. **Current components and dependencies.**
   - **Hero.** `InnerPageHero` with a three-photo collage (tulip roundabout, clock tower, suspended lantern) and a
     quick filter. The quick filter is `FilterChips`, shown only with JavaScript, and it scrolls to the gallery.
   - **Shared filter state.** `ProjectFilterProvider` (client) is shared by the hero chips and the gallery.
   - **Featured and highlights.** `FeaturedProject` (dark band; a button to the project page) and
     `ProjectHighlights` (links to project pages; outlined numerals).
   - **Gallery (`#gallery`).** `ProjectGallery`:
     - a sticky filter bar under the header, with a backdrop blur;
     - a masonry wall in CSS columns: 1, then 2 at 40 rem, 3 at 64 rem and 4 at 80 rem;
     - filtered-out items get `hidden`, and the "Showing …" count is announced with `aria-live`;
     - the chips are a `role="group"` with `aria-pressed`;
     - filter view transitions (`data-vt="filter"`) are skipped with reduced motion.
   - **Index and closing.** `ProjectIndex` (a numbered text list) and `InnerCTA`.
   - **Card and media rules.** `project-cards.ts` picks photo, pair or framed cards and never enlarges a photo.
     `projects.ts` withholds flagged media (authorship, renders). Structured data: CollectionPage.
2. **New MC components.**
   - Page hero with the collage (figures).
   - Filter chips (kit, in the `seg`/`tag` styles) and masonry cards (MC card media).
   - A featured sheet, highlights, the index and the closing call to action.
3. **Content and functions to preserve.**
   - The `section#gallery` anchor: the homepage's six cards land there.
   - All 27 showcased projects; categories stay website classifications.
   - The shared filter state, `hidden`, the announced count and focus staying on the chip.
   - Without JavaScript: every project visible and the chips hidden.
   - Withheld photos stay withheld, and the photo-size rules stay.
4. **EN/AR and RTL.**
   - Columns fill from the right, and chip order follows the reading direction.
   - Category labels are localized.
5. **Animation.**
   - Filter view transitions, skipped with reduced motion.
   - Reveals and hover lift.
   - MC already styles cross-page view transitions, so the filter's rules must stay scoped to `data-vt="filter"`.
     Today those rules live in the previous design's CSS; they move to MC.
6. **Images and assets.** 47 images (39 files), all `projects/*`. Most are 150–470 px wide, and the image-led MC
   layout must not enlarge them.
7. **Navigation and CTAs.**
   - Links to the 27 project pages, `/projects/<slug>` (planned; D4).
   - The hero chips scroll to `#gallery`.
   - Links to Services and Contact.
8. **SEO / publication.** `review`; CollectionPage.
9. **Accessibility.**
   - The chip group is labelled and uses `aria-pressed`, and the count is announced politely.
   - Hidden items leave the tab order.
   - Card focus is visible; keyboard tests exist today.
10. **Migration risks.** See E3:
    - the sticky bar's offset and blur;
    - the reveal and view-transition interplay;
    - 39 photos over the ambient;
    - D4, and the homepage's frozen card links.

### D5. Industries (`/industries`)

1. **Current components and dependencies.**
   - **Hero.** `InnerPageHero` (stacked) with a five-photo strip below it: construction, industrial, public realm,
     architecture, street furniture. The strip uses a clip reveal, zoom and `FrameMarks`.
   - **Sectors (`#sectors`).** `IndustryIndex` (client). On wide screens a pinned preview follows hover and focus; on
     phones there are static thumbnails. Each sector is marked by its source (stated in the company profile, or
     inferred) and links to related services.
   - **Closing and data.** A classification note, `InnerCTA`, CollectionPage.
2. **New MC components.**
   - Stacked page hero with a figure strip.
   - The industries list in the homepage's "by source" pattern, with an MC preview panel.
   - A note card and the closing call to action.
3. **Content and functions to preserve.**
   - The source labels (profile or inferred).
   - The preview works by keyboard as well as by mouse.
   - Links to five services (laser engraving is not linked).
   - The classification note.
4. **EN/AR and RTL.** The pinned preview moves to the other side in Arabic.
5. **Animation.** A preview cross-fade on hover or focus, and reveals. With reduced motion the preview swaps at once.
6. **Images and assets.** 21 images from 8 files: projects 4, services 2, site 2.
7. **Navigation and CTAs.** Five service pages, Services and Contact; the homepage's Industries section links here.
8. **SEO / publication.** `review`; CollectionPage.
9. **Accessibility.**
   - The preview never moves focus, and duplicate preview images are hidden from screen readers.
   - The sectors are a list. The existing test checks the preview on focus.
10. **Migration risks.**
    - The widget's inactive styles must depend on its script-ready attribute, or the no-JavaScript view breaks.
    - The photo strip is low-resolution in a wider layout.

### D6. Clients (`/clients`)

1. **Current components and dependencies.**
   - A compact hero, then `ClientWall`: a seamless wall whose double cells are planned by `planSpans` in
     `logo-wall.ts`.
   - The logos are monochrome, with colour on hover or through the "original colours" toggle.
   - A note, then `InnerCTA` without numbers. Structured data: CollectionPage.
2. **New MC components.**
   - Compact page hero.
   - The homepage's logo tiles and colour toggle (`button[data-toggle]`, already handled by `Motion.tsx`), across all
     21 logos.
   - Closing call to action without numbers.
3. **Content and functions to preserve.**
   - No numbering, counts or grid references, and no partnership claims or testimonials.
   - Every logo named in its alt text.
   - The toggle's pressed state, hover colour and the note.
4. **EN/AR and RTL.** Logos are never mirrored, and the wall follows the reading direction.
5. **Animation.** The colour transition on hover or toggle, and reveals.
6. **Images and assets.** 21 client logos.
7. **Navigation and CTAs.** Contact; the homepage's clients sheet links here.
8. **SEO / publication.** `review`; CollectionPage.
9. **Accessibility.** A labelled list, a toggle button with `aria-pressed`, and visible focus.
10. **Migration risks.**
    - The homepage already shows every client with the same tiles. This page must add value through layout alone,
      never through counts.
    - The existing tests expect 6 columns on desktop and 2 on phones. Those expectations follow the MC layout; the
      no-numbering rule does not change.

### D7. Certificates (`/certificates`)

1. **Current components and dependencies.**
   - **Hero and register.** A compact hero, and a register table below it with four columns: number, document (an
     anchor), issuer and reference. The reference column says "Available on request" / "متاح عند الطلب".
   - **Viewer.** `CertificateRegister` (client) opens a native `<dialog>` with `showModal`:
     - focus stays inside and returns to the trigger when it closes; Escape or a backdrop click closes it;
     - the triggers are links to the preview image, so they work without JavaScript;
     - on `/ar`, bilingual documents show their Arabic version first.
   - **Explanation and closing.** `#redaction` explains how numbers and codes were removed. Then `InnerCTA`.
     Structured data: WebPage.
2. **New MC components.**
   - Compact page hero and a data table.
   - The MC dialog, and document cards in the homepage's compliance style.
   - The closing call to action.
3. **Content and functions to preserve.**
   - The redacted image files only.
   - No registration numbers, QR codes or personal names in the data, alt text or structured data.
   - The licence expiry stays hidden, and the "not certified copies" note stays.
   - The Arabic-first rule and the no-JavaScript links.
   - The anchors: `#commercial-registration`, `#vat-registration`, `#commercial-activity-licence`, `#redaction`.
4. **EN/AR and RTL.** Arabic versions come first on `/ar`, and the dialog's close button mirrors.
5. **Animation.** The dialog fades open and closed, with no movement under reduced motion.
6. **Images and assets.** Three thumbnails on the page and four previews in the dialog: 8 files in
   `public/media/certificates/` (see E4).
7. **Navigation and CTAs.** Contact; the homepage's compliance cards link here.
8. **SEO / publication.** `review`; WebPage.
9. **Accessibility.**
   - The dialog is labelled, keeps focus inside, returns it, and closes on Escape.
   - The table keeps its header cells.
   - Alt text describes the document, never its numbers.
10. **Migration risks.** See E4:
    - the MC pointer inside a modal dialog;
    - nothing may reveal redacted areas;
    - focus return.

### D8. Contact (`/contact`)

1. **Current components and dependencies.**
   - **Hero.** `InnerPageHero` (split) with two actions: "Request a quote" (`#quote`) and "Find us" (`#location`).
     `ContactCards` sit beside it: two phones (`tel:`), WhatsApp, email, and the address (to `#location`).
   - **Quote section (`#quote`).** `EditorialSection` with three steps and a status note: there is no backend, and the
     request is prepared for the visitor to send. A `TechnicalFrame` surrounds the `QuoteForm` (656 lines, client).
   - **Map (`#location`).** `LocationSection`, the Google Map (E2).
   - **Data.** Structured data: Organization/LocalBusiness, WebSite, ContactPage, BreadcrumbList.
2. **New MC components.**
   - Split page hero, and contact rows (the homepage's `ContactRows`).
   - The form states (kit) and the map frame.
3. **Content and functions to preserve.** Everything in E1 and E2, plus the steps and the status note.
4. **EN/AR and RTL.**
   - Labels, hints and errors in both languages; `dir="ltr"` on phone and email, `dir="auto"` on free text.
   - Arabic-Indic digits are accepted, and the request is prepared in the page's language.
   - The map uses `hl=ar` on the Arabic page, and the select arrow mirrors.
5. **Animation.** Reveals, plus a quiet change to the "ready to send" state and the copy feedback. None under reduced
   motion.
6. **Images and assets.** No images. The map iframe (google.com) is blocked in cloud sessions, so the tests stub it.
7. **Navigation and CTAs.**
   - `#quote` is where every quote action lands: twelve on the homepage (header and footer included) and two on each
     service page.
   - `#location` is linked from the hero and the address.
   - Eight external links: phones, WhatsApp, email, directions and "open in Google Maps".
8. **SEO / publication.** `review`; ContactPage and Organization structured data.
9. **Accessibility.** See E1. The map iframe keeps its title, and contact rows keep their visible labels.
10. **Migration risks.**
    - Anchor landings under the MC header: MC uses a 5.5 rem scroll padding; the previous design used the header
      height plus 1 rem.
    - The homepage's "Start a Project" test must target the MC landing.
    - For the form and the map, see E1 and E2.

### D9. Privacy (`/privacy`) and Terms (`/terms`)

1. **Current components and dependencies.**
   - `LegalPage`, then `LegalPageLayout`: a compact hero, numbered sections, and `LegalToc` (client). The contents
     list is a disclosure on phones and pinned on desktop, and it marks the section being read with
     `aria-current="true"`.
   - Pending notes, and a closing `InnerCTA`. Structured data: WebPage.
   - Copy: `src/content/legal.ts`. Privacy was last updated 2026-09-25, Terms 2026-09-24.
2. **New MC components.** Compact page hero, breadcrumbs, long-form text, the sticky contents list, the
   "Pending confirmation" callout and the closing call to action.
3. **Content and functions to preserve.**
   - Every section and anchor: Privacy has 14 (`#who-we-are` … `#contact`), Terms 9 (`#about` … `#contact`).
   - The "last updated" dates.
   - The seven pending notes, visible and labelled "Pending confirmation" / "بانتظار التأكيد":
     - Privacy: sharing, hosting and logs, the Google Maps embed wording, retention periods, visitors' choices;
     - Terms: photo licences, liability wording.
   - The links in the text.
4. **EN/AR and RTL.**
   - Long Arabic text needs a generous line height (about 1.85), no letter-spacing, and line lengths set in `em`.
   - The contents list sits on the right in Arabic.
   - Email, phone and web addresses keep `dir="ltr"`.
5. **Animation.** Reveals and the contents list's state only; the text itself never moves.
6. **Images and assets.** None.
7. **Navigation and CTAs.**
   - The MC footer's legal links already point here.
   - Contents anchors, and a closing call to action to Contact.
8. **SEO / publication.** `review`; WebPage.
9. **Accessibility.**
   - The contents list is a labelled `nav` whose button has `aria-expanded`.
   - Each section has an H2.
   - Pending notes are marked by text as well as colour.
10. **Migration risks.**
    - The sticky contents list needs the MC header height.
    - Long text sits over the ambient: sheets and reading zones must keep it at AA contrast.
    - The pending notes must stay visible; the tests check them.

### D10. Localized 404

1. **Current components and dependencies.**
   - The catch-all `[locale]/[...rest]` calls `notFound()`.
   - `[locale]/not-found.tsx` (locale from `next/root-params`, noindex) renders `NotFoundView`: "Outside the
     blueprint", an outlined 404 on a grid, a cut line, and links to Home and Contact.
   - `global-not-found.tsx` shows the compact view for addresses outside any language.
2. **New MC components.** The MC 404 view, `(commerce)/[locale]/not-found.tsx`, and the catch-all moved into the MC
   tree (C2).
3. **Content and functions to preserve.** The localized title and text, noindex, a real 404 status, the links to Home
   and Contact, and the bilingual global fallback.
4. **EN/AR and RTL.** The language comes from the address.
5. **Animation.** The grid and cut line retire (C4). The MC view is typographic, over the site ambient. The copy
   "Outside the blueprint" stays unless you want it changed.
6. **Images and assets.** None.
7. **Navigation and CTAs.** The MC header and footer, plus Home and Contact.
8. **SEO / publication.** noindex, 404 status, never in the sitemap.
9. **Accessibility.** One H1, clear links and the page language.
10. **Migration risks.**
    - Two 404 looks during the transition (C2).
    - Fonts leaking from the global fallback (TM-2.6).
    - The theme on 404s built in the browser.

### Planned pages (outside TM-2)

- **Not built in TM-2.** Capabilities (`/capabilities`, 1E) and the project pages (`/projects/<slug>`, 1F) stay
  `planned` placeholders in the previous design.
- **An option at the end.** TM-2.6 could re-host the same placeholder text in MC (D11). That does not build 1E or 1F.

---

## E. Special attention

### E1. The quotation form (`src/components/contact/QuoteForm.tsx`)

**What it does today.** All of this must be preserved exactly.

- **No backend.** It checks the entries in the browser, then prepares the request for the visitor to send in one of
  three ways:
  - by email: a `mailto:` link with a subject and a CRLF-separated body;
  - by WhatsApp: a `wa.me` link with the text;
  - by copying it to the clipboard.

  It never says a request was sent, and its status note says so.
- **Fields.**
  - Full name, email, phone and message are required; phone accepts Arabic-Indic digits, and the message allows up
    to 4,000 characters.
  - Service is required: a select of the six services plus "Not sure".
  - Optional: company, project type, requirement and location.
  - Files: up to 5 files of up to 10 MB each (PDF, DWG, DXF, STEP/STP, JPG/JPEG, PNG). They stay on the device, and
    only their names go into the request.
- **Errors.**
  - After a failed submit, an error summary (`role="alert"`) receives focus.
  - Each field has `aria-invalid` and `aria-describedby` (hint and error).
  - `aria-live` announces file changes and the copy result.
  - The "ready" state receives focus; editing again returns focus to the first field.
- **Without JavaScript.** The form posts as `mailto:` (`method="post"`, `encType="text/plain"`) with the browser's own
  validation. A `<noscript>` note explains this, and the file picker is hidden.
- **Browser hints.** Autocomplete and input modes are set; `dir="ltr"` on email and phone, `dir="auto"` on free text.

**Migration approach.**

- **Restyle in place.** The contact page is the form's only user. Class names and wrappers change; ids, `name`s,
  attributes, handlers and the builders of the email, WhatsApp and copied text stay byte-for-byte.
- **New MC form styles.** MC has only a basic `.field` today (rest, hover, focus, disabled). The form needs:
  - an invalid state (border plus text, not colour alone), error text and an error summary;
  - a select with a mirrored arrow, a textarea, and a file list with remove buttons;
  - fieldset and legend, a required marker, and a "ready to send" panel worded as ready, never sent.
- **Proof.**
  - The form's controls, ids, names and ARIA attributes are unchanged, compared in the DOM.
  - For fixed inputs, the prepared email link, WhatsApp link and copied text are identical before and after, in
    English and Arabic.
- **Tests.**
  - The current validation, file, hand-off, direct-link and no-JavaScript `mailto:` tests keep their intent.
  - Added: golden outputs, completing the form by keyboard only, focus on the error summary, 200 % zoom and Arabic
    digits.

**Risks.**

- **The MC pointer.** Text fields keep the I-beam. A file input is not on that exception list, so it would show the
  I-beam too: the file button needs a pointer cursor.
- **Theme and scrolling.** The focus ring and browser autofill colours in the dark theme. The scroll padding for
  `#quote` and for jumps from the error summary.

### E2. The Google Map (`LocationSection.tsx`, `src/lib/maps.ts`)

- **Your V2 condition: "leave the contact map as it is".** These all stay exactly as they are:
  - the address-search embed: `maps?q=<address>&hl=<locale>&z=15&output=embed`;
  - the lazy iframe with its title, `referrerPolicy="strict-origin-when-cross-origin"` and `allowFullScreen`;
  - no API key and no invented coordinates;
  - the "Get directions" and "Open in Google Maps" links.
- **What could change (D10).**
  - The frame around the map could take MC borders, radius and shadow.
  - The drawn grid placeholder shown before the map loads is previous-design decoration. It would become a plain
    surface with the address.
- **Still open.**
  - RAWASY's own Google Maps place link, to replace the address search once confirmed.
  - The privacy page's pending note on the embed wording.
- **Proof and tests.**
  - The iframe's attributes and all map URLs are compared byte for byte.
  - Tests keep stubbing google.com. The live map must be checked on a normal network before launch.
- **Risk.** When the mouse moves into the iframe, the page stops receiving mouse events, and the frame shows its own
  cursor. The MC pointer must hide there, not freeze at the edge. Verify it.

### E3. The project-gallery filters (Projects overview)

- **Preserve.**
  - One filter state shared by the hero chips and the gallery.
  - `hidden` on filtered-out items, `aria-pressed` on chips, and the announced count.
  - Focus stays on the chip.
  - View transitions, skipped with reduced motion.
  - Without JavaScript: every project shown and the chips hidden.
  - The `#gallery` anchor, and the rule that photos are never enlarged.
- **Sticky bar.** Today it sits at the previous header's height and uses `backdrop-filter: blur(10px)`.
  - The MC header already blurs once the page scrolls. A second blurred sticky layer over the moving ambient is what
    the A V2 performance rules warn about.
  - The MC bar should be an opaque sheet, or it must pass the 55 fps gate with the blur.
  - Its top uses a new MC header-height token.
- **Reveals and transitions.** An item that the filter shows while it is on screen could fade in after the
  transition: a visible flash. Gallery items should either skip the reveal once filtering has started, or be marked
  shown by the filter.
- **Project links.** They depend on D4. A per-project anchor can land cleanly in the MC page if:
  - the gallery items carry ids;
  - the bar keeps one fixed height: one row of chips that scrolls sideways instead of wrapping;
  - a CSS scroll margin clears the MC header plus the bar, with no script.

  The previous design's bar wraps to 69 or 117 px, so a fixed offset was unreliable there (the navigation correction
  report). The homepage's cards stay as approved unless you ask.
- **Tests.** Filtering, hero quick filter, keyboard, card focus, column counts by width, the phone filter bar, reduced
  motion and no JavaScript all move over. Added: where `#gallery` lands under the MC header and bar.

### E4. Certificate redactions

- **Where the redaction lives.** In the image files themselves:
  - solid hatched blocks that leave nothing of the original;
  - thumbnails that are also blurred.

  Numbers, QR codes and personal names are absent from the data, alt text and structured data. The licence expiry is
  hidden.
- **What migration changes.** Only the page around the images. It keeps:
  - the same files, never re-encoded;
  - no CSS filters on the images and no zoom beyond today's preview;
  - the Arabic-first rule and the no-JavaScript links.
- **Proof baseline.** The eight files are checked byte-identical after every batch. Their SHA-1 prefixes today:

  | File | SHA-1 prefix |
  | --- | --- |
  | `commercial-activity-licence.webp` | `0b4405b6193b` |
  | `commercial-activity-licence-thumb.webp` | `dd740fa944b5` |
  | `commercial-registration-ar.webp` | `2fa3939705e6` |
  | `commercial-registration-ar-thumb.webp` | `af4a0ef12ad6` |
  | `commercial-registration-en.webp` | `f3511dcc0c51` |
  | `commercial-registration-en-thumb.webp` | `7f27a975d989` |
  | `vat-registration.webp` | `d725f4a14584` |
  | `vat-registration-thumb.webp` | `7681b9f1ab74` |

- **New test.** No run of seven or more digits appears in the main content's text, the alt text or the structured
  data.
- **Risk found (checked in the code).** MC hides the system cursor on everything inside `.mc` while the MC pointer is
  on (`html[data-cursor-on] .mc * { cursor: none }`).
  - A modal `<dialog>` sits in the browser's top layer, above the pointer element, and it inherits `cursor: none`.
  - So over the open viewer, desktop mouse users would see no pointer at all.
  - Fix in TM-2.3: turn the MC pointer off while a modal is open, or restore the system cursor inside it.

### E5. Service animations

- **Laser cutting: reused exactly as approved.** `LaserCut`, the nesting sheet: a scan pass, the parts draw in, the
  head pierces and cuts the holes and the slot, then the outer contour. A heat tint follows, then the head parks.
- **Laser engraving: reused exactly as approved.** `LaserEngrave`, the brass plate: the crosshair, the border and
  marks, the lines, the rosette and the ring, the light, then the rest mark. Mirrored in Arabic.
- **Same components as the homepage.** They play once when half in view and replay on hover or focus.
  - With reduced motion, and without JavaScript, the finished drawing shows.
  - The hero plate's loop stays homepage-only.
  - They replace `CutPathVisual` and `EngravedPlateVisual`, which draw the same geometry (`nesting-sheet.ts`,
    `engraved-plate.ts`).
- **The other four drawings** (`FoldVisual`, `AxisPlateVisual`, `WorkbenchVisual`, `ScaffoldVisual`):
  - they keep their current draw-on-reveal (the inherited `--draw` pattern) and are restyled in MC colours;
  - their grid backdrops, frame marks, scan lines and `PointerLight` retire;
  - new sequences for them would be a new concept, so only with your brief (D9).
- **Composition.** Each hero keeps its current pairing:
  - laser cutting pairs its photo with the drawing;
  - laser engraving shows the plate alone, since it has no photographs.
- **Rules.**
  - Animate transform and opacity only: no canvas, WebGL, particles or animated filters.
  - Decoration is `aria-hidden`.
  - Reduced motion and no JavaScript show the finished drawing.
  - The 55 fps gate applies.
- **Risk.** The signatures were tuned at the homepage's card size; the service hero is larger. Size is set by the
  container, never by editing the shared components. The homepage must stay pixel-identical.

---

## F. Recommended implementation sequence

| Batch | Pages (routes, EN + AR) | Size | What gets built | Main risks | Stops for |
| --- | --- | --- | --- | --- | --- |
| TM-2.0 | none | – | nothing: your approvals and decisions | – | homepage approval, answers to G |
| TM-2.1 | Privacy, Terms, localized 404 (4 + 404) | M | the kit, MC `not-found`, catch-all, header state for inner pages | sticky contents list, long Arabic text over the ambient | your approval of the kit |
| TM-2.2 | Contact (2) | M | form states, map frame, contact rows | form outputs, no JavaScript, map condition, pointer over the iframe | your approval |
| TM-2.3 | About, Industries, Clients, Certificates (8) | L | figures, tables, dialog, logo wall, statement block | redactions, dialog pointer, About's length | your approval |
| TM-2.4 | Services overview and six service pages (14) | L | section index, service hero, drawings, scope/process/gallery/machine blocks | one shared component set, signatures, flagged photos, dynamic route | your approval (and 1D, D3) |
| TM-2.5 | Projects overview (2) | M | filter chips, masonry wall, collage, featured, index | filters, sticky bar, reveal/transition interplay, 39 photos | your approval |
| TM-2.6 | none new | M | retiring the previous design | the global fallback's fonts, deleting shared code | your approval |

**TM-2.0 — before any code.**
- Your visual approval of the TM-1 homepage: inner pages must wait for it.
- Your answers to section G.
- A checkpoint branch, `preserve/pre-tm2`.

**TM-2.1 — the kit, Privacy, Terms and the localized 404.**
- **Why first.**
  - Text pages exercise the hero, breadcrumbs, long-form text, sticky contents list, callout and closing call to
    action, with no functional risk.
  - The MC `not-found.tsx` must exist before any migrated route can call `notFound()`.
- **Moves.** `privacy` and `terms` go to `(commerce)/[locale]/`, with a new `not-found.tsx` and the moved
  `[...rest]`. `commerceRoutes` gains `privacy` and `terms`.
- **Tests.** The legal and 404 assertions move from `stage-1c.spec.ts`.
- **Exit.** The gates in C6, then your approval of the kit's look on these pages.

**TM-2.2 — Contact.**
- **Why second.** It is the conversion page. Every "Request a quote" and "Start a Project" lands here, so the
  homepage-to-quote journey then stays in one design.
- **Exit.**
  - The form's outputs are proven identical, and the map's attributes and URLs are unchanged.
  - The gates, then your approval.

**TM-2.3 — About, Industries, Clients and Certificates.**
- **Why here.** These pages reuse the homepage's cards and add figures, tables and the dialog. Only the certificate
  dialog carries functional risk.
- **Option.** You can split this batch: Clients, Certificates and Industries first, then About alone.
- **Exit.**
  - The redaction baseline (E4) and the pointer fix for the dialog.
  - The gates, then your approval.

**TM-2.4 — the services overview and the six service pages.**
- **Why here.** It is the largest set, built on one shared component set, and by now the kit is proven.
- **Prerequisites.** `crossDesignLink` handles dynamic routes, and decisions D3, D6 and D9 are made.
- **Early look (if you want it).** Captures of the two signature pages before the other four are finished. All six
  share one route, so they move together.
- **Exit.** The gates, including 55 fps with a signature on the page, then your approval.

**TM-2.5 — the Projects overview.**
- **Why last among the pages.** It has the most complex interaction and the most images, and it carries decision D4.
- **Alternative.** Move it before TM-2.3, so the homepage's project cards land in the same design sooner. The cost is
  building the filters while the kit is still new.
- **Exit.** Filter behaviour matches, the performance gate passes, then your approval.

**TM-2.6 — retiring the previous design (only after every page is approved).**
- **Moves.** The placeholders (D11) and `global-not-found.tsx`.
- **Deletes** the previous design's:
  - root layout, shell, CSS, fonts and scripts;
  - GSAP and `src/lib/gsap.ts`;
  - `LegacyHomePage` and the old homepage sections;
  - visual primitives;
  - `crossDesignLink` and `commerceRoutes` (no longer needed);
  - old specs.
- **Also.** Rewrite `CLAUDE.md`. Delete the theme lab only with your approval (D12). Then consider `<Link>` between MC
  pages, measured first.
- **Out of scope.** 1E, 1F, Phase 2 and publishing (1J).

## G. Decisions I need from you

1. **D1 — Start condition.** TM-2 starts only after you visually approve the TM-1 homepage and this plan. The plate
   entrance question can stay open: it does not touch the inner pages.
2. **D2 — Batch order.** I recommend the order in F. The alternative is the Projects overview earlier.
3. **D3 — Stage 1D.** The six service pages still await your approval in the previous design.
   - I recommend approving their content and structure (sections, sourcing rules) now or at TM-2.4, and giving the
     visual approval on the MC version.
   - The alternative is reviewing their previous-design visuals first.
4. **D4 — Project links until 1F.** About (4 cards), the service pages (up to 4 each) and the Projects overview (27
   cards, the featured project, highlights and the index) all link to in-development project pages. Options:
   - (a) keep those links;
   - (b) follow the homepage rule: About and service cards open the gallery, and the overview's own cards become
     figures without a link;
   - (c) per-project anchors in the MC gallery: About and service cards open the exact card, the overview's cards
     become figures, and its index links to the cards.

   I recommend (c). The homepage's cards stay as approved unless you ask.
5. **D5 — Capabilities links.** The header, About, the services overview and the service pages' machine cards link to
   the planned Capabilities page. I recommend keeping them, as on the approved homepage; 1E gives them a destination.
6. **D6 — Engraving photos on the services overview.** I recommend showing the `LaserEngrave` drawing in their place,
   as the homepage does, until RAWASY supplies or approves photos. The alternative is to keep them (V2 approved them
   there).
7. **D7 — Floating WhatsApp button.** I recommend none, as on the approved homepage: WhatsApp is in the footer, on the
   contact page and in the quote hand-off. The alternative is an MC button placed inside a landmark.
8. **D8 — Previous-design decoration.** I recommend retiring everything listed in C4 on MC pages.
9. **D9 — The four other service drawings.** I recommend restyling them with their current draw-on-reveal and no new
   sequences.
10. **D10 — Map frame.** I recommend keeping the embed and its behaviour exactly, giving only the frame MC borders and
    radius, and using a plain placeholder. The alternative is to keep the frame's current look.
11. **D11 — Planned-page placeholders.** I recommend re-hosting the same "in development" text in MC during TM-2.6
    (noindex, same status), without building 1E or 1F.
12. **D12 — Theme lab.** I recommend keeping it until every page is approved in MC, and deleting it only when you say
    so.
13. **D13 — Publication.** Please confirm every migrated page stays `review` until Stage 1J.

## H. Pending approvals and factual limitations (all unchanged)

- **Approvals still open.**
  - **TM-1 homepage:** awaiting your visual approval. The plate's rising entrance (cycle 1 only) awaits your
    decision.
  - **Stage 1D:** the six service pages await your visual approval (D3).
- **V2 conditions.**
  - The contact map stays as it is.
  - RAWASY's Google Maps place link and the image rights are still open.
  - The two moderate shell findings are carried to 1I/1J. They are expected to clear on MC pages; this is checked per
    page.
- **Publication.** Inner pages are `review`; Capabilities and the project pages are `planned`; only the homepage is
  published. Publishing waits for Stage 1J.
- **Factual rules.**
  - Nothing is invented, and unknown fields stay empty.
  - Certificate numbers, QR codes and personal names stay redacted.
  - Flagged images stay off featured spots.
  - The clients page shows no counts, numbering or claims.
  - Arabic is never letter-spaced.
- **Out of scope.** 1E, 1F and Phase 2 are not started, and nothing is deployed.

## I. Risk register

| # | Risk | Where | Mitigation and gate |
| --- | --- | --- | --- |
| 1 | The quote form changes what it prepares, how it validates or how it works without JavaScript | Contact | Logic untouched; golden outputs; DOM and ARIA diff; tests |
| 2 | The map condition is breached | Contact | Embed byte-identical; frame only, and only if you agree (D10) |
| 3 | Filter regressions (hidden items and reveals, the sticky bar, transitions) | Projects | Tests carried over; reveal handling; opaque bar or measured blur |
| 4 | Redacted content exposed | Certificates | Same files (hash baseline); no filters or zoom; digit-run test |
| 5 | Signatures change on the homepage | Services | Reused as they are; sized by their container; homepage pixel-identical |
| 6 | Two 404 looks during the transition | Site-wide | MC 404 first; old one removed in TM-2.6 |
| 7 | Prefetch or font leaks across designs for dynamic routes | Services | `crossDesignLink` pattern match, proved on old pages |
| 8 | Performance on long, image-heavy pages over the ambient | About, Projects | 55 fps gate; no extra blurred layers |
| 9 | The MC pointer over a modal dialog or the map iframe | Certificates, Contact | Pointer off while a modal is open; hidden when the mouse enters the iframe |
| 10 | Anchor landings under the MC header (`#quote`, `#gallery`, `#location`, service and legal anchors) | Several | Header-height token; tests measure where they land |
| 11 | Low-resolution photos in a larger layout | Image pages | Size rules kept; asset inventory item 16 |
| 12 | Copy lost or changed in the new markup | All | Visible-text parity in both languages |
| 13 | Search metadata drift | All | `<head>` and structured-data parity; statuses unchanged |
| 14 | Test coverage lost when specs are rewritten | All | An assertion map in each batch report |
| 15 | Shared MC module changes reach the homepage or the lab | All | Additions only; homepage and lab proofs |
| 16 | Journeys cross designs during the transition (full page loads, two font sets) | Site-wide | Temporary; Contact goes early to keep the main journey in one design |
| 17 | Stage 1D approval becomes unclear | Services | D3 |

## J. QA for this audit

- **Nothing was run.** No lint, typecheck, build or browser tests ran for this audit, because no code changed.
- **Where the facts come from.** The source, and the prerendered output of the current build. That build is of
  `2b139e9`, and its code is identical to `9a1cdae`.
- **The last full run** (the navigation correction): lint and typecheck clean, the build produced 125 static pages,
  and all 227 browser tests passed.
- **Working tree.** Clean before this report; this commit adds only the report and the `CLAUDE.md` pointer.

## K. Items needing RAWASY's confirmation (unchanged; from `docs/ASSET_INVENTORY.md` and the legal pages)

- **Map.** RAWASY's own Google Maps place link, and the legal wording for the embed.
- **Photos and rights.**
  - Photos of RAWASY's own engraved work, or permission to use the nameplates photo.
  - Image rights for the stock-looking photos, including `site/welder-sparks`.
  - Original, high-resolution photography.
- **Portfolio.** Confirmation that every portfolio piece is RAWASY's, that the product renders are RAWASY products,
  and which services each project used.
- **Registration.** The renewed commercial activity licence, and approval (or not) to show the registration numbers.
- **Legal pending notes.** Recipients of project information, the hosting provider and its logs, retention periods,
  how requests are handled, photo licences, and a legal review of the liability wording.
- **Contact details.** The primary WhatsApp number, and a domain email address.
- **Wording.** The meaning of "New Struck(s)".

## L. Known limitations of this plan

- **Component needs are estimates.** They come from reading the source, not from prototypes. The kit's final look is
  for you to approve in TM-2.1.
- **Some risks are predictions.** Most performance and accessibility risks here still have to be verified at each
  gate. Four points are facts found in the code or in the Next.js documentation:
  - the header's blur;
  - the pointer's `cursor: none` rule;
  - how the 404 is resolved;
  - the static-only `crossDesignLink`.
- **Sizes are relative** (M, L). They are not time estimates.

## M. How to review, and next steps

- **How to review.** Start with sections F and G. A short "agree" or a change for each decision (D1–D13) is enough.
  Sections C–E are the evidence.
- **Nothing to run.** No code changed; this report is at `docs/reports/2026-09-29-tm2-migration-plan.md`.
- **Next.** Waiting for:
  - your visual approval of the TM-1 homepage;
  - your answers to D1–D13;
  - your go-ahead for TM-2.1.

  I will not start TM-2, 1E, 1F or Phase 2 before then, and nothing will be deployed.
