# RAWASY Metal Website — Stage 1D: individual service detail pages

**Date:** 2026-09-25 · **Branch:** `claude/new-session-5eijs6`
**Status:** built and tested, **returned for your visual review. Not self-approved.**
Stage 1E, the Stage 1F project detail pages, Stage 1G or later and Phase 2 have not been started.

## Summary

- **Six pages:** the in-development placeholders at `/en|ar/services/[slug]` are replaced by full
  pages for Laser Cutting, CNC Bending, Steel Structures, Metal Fabrication, Laser Engraving and
  Scaffolding.
- **One component set, six characters:** every page is built from one reusable set of components.
  Its character comes from its "look": a hero drawing of its own, the layouts of its scope, process
  and gallery, and the sequence of section surfaces in its colour role.
  - Laser Cutting: steel blue and orange, a cutting path.
  - CNC Bending: steel blue, a press-brake fold diagram.
  - Steel Structures: deep slate and steel, a structural axis grid.
  - Metal Fabrication: brass and graphite, a workshop bench.
  - Laser Engraving: brass and orange, an engraved plate.
  - Scaffolding: teal and graphite, modular bays.
- **Content:** everything restates the company profile and the existing service, machine, project
  and industry records. No new facts, specifications or claims.
  - Every process is labelled as a general workflow, not a certified procedure.
  - Sections without sourced content are left out: machinery on three pages, projects on two, the
    gallery on one.
- **A shared bug fixed:** line drawings that draw themselves on reveal never drew in Chromium unless
  the window was resized. This affected the approved homepage beam line and pillar icons, and the
  About sketch. It is now fixed in CSS only, with no HTML change (item 27).
- **QA:**
  - Lint, typecheck and build pass (109 static pages).
  - Browser tests: **121/121 passed** (86 existing, 34 new for the service pages, 1 new drawing
    regression test).
  - axe-core: 96 audits (six pages × EN/AR × light/dark × desktop/mobile, reduced and full motion),
    no serious or critical findings.
  - Visual matrix: 6 pages × 5 widths × EN/AR × light/dark = 120 captures. All returned HTTP 200,
    with no sideways overflow and no console errors or warnings.
  - V2 regression: server HTML identical for all 26 approved page variants, ARIA snapshots identical
    (20/20), and no layout, text or colour change in 200 screenshots (item 27).
  - Performance: each service page costs less to scroll than the approved About page, no new
    JavaScript, and CSS +13 KB uncompressed (item 22).

## Report items

### 1. Main commit
`70408b8f737aa1a67023a1c7fb0acc0b776ed42d` (`70408b8`): "Add Stage 1D service detail pages".

### 2. Branch SHA
The branch head is the docs commit that adds this report and the README and project-memory
updates on top of the main commit. Its SHA is in the chat report (this file is committed after the
main commit).

### 3. Files changed
Main commit: 31 files (21 added, 10 changed; +3,889 / −67 lines). The docs commit adds this report
and updates `README.md`, `CLAUDE.md` and `docs/ASSET_INVENTORY.md`.

**Added (21):**

- `src/components/service/`: `ServiceHero`, `ServiceSection`, `ServiceOverview`, `ServiceScope`,
  `ScopeGlyphs`, `ServiceProcess`, `ServiceMachines`, `ServiceApplications`, `ServiceGallery`,
  `ServiceWhy`, `RelatedServices`, `ServiceProjects`, `ServiceCTA`, `looks.ts`;
- `src/components/service/visuals/`: `CutPathVisual`, `FoldVisual`, `AxisPlateVisual`,
  `WorkbenchVisual`, `EngravedPlateVisual`, `ScaffoldVisual`;
- `src/content/service-details.ts`;
- `e2e/service-pages.spec.ts`.

**Changed (10):**

- `src/app/[locale]/services/[slug]/page.tsx`: the placeholder is replaced by the composed page. It
  keeps the Service and BreadcrumbList JSON-LD.
- `src/content/services.ts`: captioned galleries; project links narrowed to projects whose record
  lists the service.
- `src/content/types.ts`: `CaptionedMedia`, `ServicePoint`, `ServiceDetail`, `ServicePageContent`.
- `src/content/pages.ts`: `servicePage` shared labels.
- `src/content/repository.ts`: `getServicePageContent()`.
- `src/lib/page-meta.ts`: `service: "review"`.
- `src/app/globals.css`:
  - service-page styles and brass tokens, appended;
  - the draw-on-reveal fix for `.line-draw`, `.beam-draw` and `.pillar-icon`.
- `src/components/inner/InnerPageHero.tsx`: `MetaStrip` exported; no output change.
- `e2e/visual-system.spec.ts`: a line-drawing regression test.

### 4. Reusable components
All in `src/components/service/`, composed per service by `looks.ts`:

| Component | What it does |
| --- | --- |
| `ServiceHero` | Breadcrumb, service number (eyebrow text plus a decorative outlined numeral), section, H1, tagline, profile summary, actions, the service's visual and the technical metadata strip (the V2 `MetaStrip`). |
| `visuals/*` | Six hero drawings: `CutPathVisual`, `FoldVisual`, `AxisPlateVisual`, `WorkbenchVisual`, `EngravedPlateVisual`, `ScaffoldVisual`. |
| `ServiceSection` | A numbered section on a chosen surface (base, recessed, steel, teal, brass or slate) with the shared `SectionHeader`. |
| `ServiceOverview` | The profile text (lead on an orange rule) and an "Includes" panel in the service's tone; optional photo. |
| `ServiceScope` | "What we provide" in six layouts: profile sections, formed profiles, linked phases, photo cards, material swatches, support tiles with photos. |
| `ScopeGlyphs` | Cross-section, formed-profile and engraved-motif drawings for the scope cards. |
| `ServiceProcess` | Rail (horizontal on desktop, vertical on phones; cut-path, fold or fine line), timeline with a note panel, or cycle with a return loop. Every layout carries the general-workflow note. |
| `ServiceMachines` | Machine cards (a grid, or one wide specification panel) linking to Capabilities. |
| `ServiceApplications` | Sectors with their basis (named in the profile, or a website classification), uses named in the profile, and the categories of the related work. |
| `ServiceGallery` | Mosaic (centred rows of framed prints at equal height), contact sheet with a caption legend, or a pair on a tray. Photos are never shown wider than the source; figure numbers continue through the page. |
| `ServiceWhy` | Sourced points on one divided panel. |
| `RelatedServices` | The V2 `ServiceCard`, reused. |
| `ServiceProjects` | The V2 `ProjectCard` and `projectCard()`, reused; a single project sits beside its gallery summary. |
| `ServiceCTA` | Dark closing band: the service's own prompt, "Request a quote" (the contact page's form), a direct call link, onward links and the service's line icon in its tone. |

Content: `src/content/service-details.ts` (per-service copy, EN/AR), `servicePage` in
`src/content/pages.ts` (shared labels) and captioned galleries in `src/content/services.ts`. Styles
are appended to `globals.css` (axis sheet, brass plates, engraved grooves, material swatches, process
rails).

### 5. Laser Cutting — `/services/laser-cutting` (01, Metal section)
Steel blue and orange; the language of the cutting path.

- **Hero:** the laser-sparks photo, framed at no more than its native size. A nesting-sheet card
  lies over its lower corner: the part's cut path in orange (lead-ins, pierce points, holes, a slot)
  among steel-blue nested parts. The path draws once on reveal and a scan line passes over the sheet.
  Engineering-grid backdrop.
- **Metadata strip:** 04 laser cutting systems · 12,000 W peak laser power · 360° bevel cutting ·
  sheet · tube · profile.
- **Sections:**
  1. Overview: the profile text, with an "Includes" panel.
  2. What we provide (steel tint): cross-section tiles for sheet, tube and pipe, C-channel, angle bar
     and H/I-beam, plus a wide orange-edged tile for 360° bevel cutting.
  3. How we work: a five-station rail joined by a dashed orange cut-path line.
  4. Machinery (slate band): the four laser machines.
  5. Applications: sectors from the industries records, uses from the profile, categories of the
     related work.
  6. Gallery: six work-gallery photos in centred rows of framed, captioned prints.
  7. Why RAWASY (steel tint): four points.
  8. Related services.
  9. Projects: four cards.
  10. Closing band: "Send us your drawing."

### 6. CNC Bending — `/services/cnc-bending` (02)
Steel blue; fold lines and angles.

- **Hero (steel-tinted):** a side elevation of a press brake at the moment of the bend. It shows the
  ram and punch, a sectioned V-die, the flat blank (dashed), the formed part in orange, the bend arc,
  the centre line and the back gauge. No angles or sizes are given. A pointer light moves over the
  drawing, and the small (295 px) source photo sits as a raised inset at its own size.
- **Metadata strip:** CNC press brake · sheet and structural parts · accurate angles, consistent
  pieces.
- **Sections:**
  1. Overview.
  2. What we form (recessed): four cards with formed-profile drawings (sheet metal, structural
     components, complex shapes, repeat pieces).
  3. How we work (steel tint): a rail with fold marks.
  4. Machinery: one wide specification panel for the CNC Press Brake Machine.
  5. Applications.
  6. Gallery: the two remaining press-brake photos side by side on a tray.
  7. Why RAWASY (slate band).
  8. Related services.
  9. Projects: Perforated Metal Seating beside its gallery summary.
  10. Closing band: "Discuss your formed parts."

### 7. Steel Structures — `/services/steel-structures` (03)
Deep slate and steel; the structural grid and beams.

- **Hero:** the steel-beams-hall photo set on a deep slate drawing sheet. The structural grid runs
  out past the photo: lettered column axes A–D, numbered rows and dash-dot centre lines that draw in.
  An I-beam section symbol and a scan line complete it. The grid is a drawing convention, not
  dimensions, and is not mirrored in Arabic.
- **Metadata strip:** design · manufacture · assembly; industrial and commercial; concept to
  completion.
- **Sections:**
  1. Overview: the profile text with the steel-frame-dusk photo (Fig. 02).
  2. Design, manufacture, assembly (steel tint): three linked phase panels.
  3. How a structure comes together: a vertical timeline (requirements, design, manufacture,
     assembly, handover) beside a note panel.
  4. Applications: six sectors.
  5. Gallery (slate band): four photos.
  6. Why RAWASY.
  7. Related services (steel tint).
  8. Projects (recessed): four cards.
  9. Closing band: "Request a project quote."
- There is no machinery section: the profile ties no machine to steel structures.

### 8. Metal Fabrication — `/services/fabrication` (04)
Brass and graphite; the workshop.

- **Hero (brass tint, perforated field, pointer light):** two workshop photos (the lanterns and tower
  in fabrication, and a welder at work) pinned to a riveted, perforated brass bench plate. A weld seam
  runs in once on reveal.
- **Metadata strip:** small parts to large structures · cut · weld · grind · assemble · laser
  welding.
- **Sections:**
  1. Overview.
  2. The work of the workshop (recessed): four photo cards (welding, laser welding, grinding and
     finishing, assembly and structural fabrication).
  3. Understand, prepare, fabricate (brass tint): a six-step timeline.
  4. Machinery: the Laser Welding Machine panel.
  5. Applications: eight sectors.
  6. Gallery (graphite band): a contact sheet of five work-in-progress prints on paper mats, numbered,
     with a caption legend.
  7. Why RAWASY.
  8. Related services (brass tint).
  9. Projects: four cards.
  10. Closing band: "Discuss your fabrication requirement."

### 9. Laser Engraving — `/services/laser-engraving` (05)
Brass and orange; fine detail.

- **Hero:** a technical design treatment instead of a photo. A brushed brass plate is engraved with a
  guilloche rosette, a double border, corner marks and a block of engraved lines (a layout only, with
  no real text or data). Each groove is drawn twice, as cut and highlight, so it reads as engraved
  metal. An orange crosshair and beam mark the laser at work, with a scan line and a measuring rule
  below. The plate mirrors in Arabic.
- **Metadata strip:** metal · wood · plastics · leather; plates · logos · decorative detail;
  permanent, precise marking.
- **Sections:**
  1. Overview (brass tint).
  2. Four materials: swatches of brushed metal, wood grain, black acrylic and leather, each with an
     engraved motif and the profile's description of the result on that material.
  3. How we work (recessed): a rail with a fine double brass line.
  4. What engraving is used for (brass tint): identification plates, logos and labels, decorative
     detail (all named in the profile).
  5. Why RAWASY: three points.
  6. Related services.
  7. Closing band: "Send us your artwork."
- **Left out:** machinery (the profile names no engraving machine), a gallery (no authentic
  photographs; see item 21) and projects (none is recorded as engraved; see item 12).

### 10. Scaffolding — `/services/scaffolding` (06)
Teal and graphite; modular systems on site.

- **Hero (teal tint):** a scaffold tower elevation drawn lift by lift on a teal sheet. It shows the
  sole board, base plates, standards, ledgers, braces, boards, guardrails and ties to the building
  line, beside the scaffolding-2 site photo. It is a generic drawing, not a specification.
- **Metadata strip:** formwork · wood and steel props; rental · installation · transport;
  construction · maintenance · repair.
- **Sections:**
  1. Overview (recessed).
  2. Scaffolding, formwork and props: five support tiles (formwork systems, wood and steel props,
     rental services, installation and dismantling, transportation) beside the trailer and props
     photos, layered.
  3. Delivered, installed, taken down (teal tint): a five-step cycle (planning, transport,
     installation, in use, dismantling) with a return loop.
  4. Applications: construction and infrastructure; uses: construction projects, maintenance,
     repair.
  5. Gallery (slate band): four photos.
  6. Why RAWASY: safety first; strong, adaptable systems; a complete service; backed by a metal
     section.
  7. Related services.
  8. Closing band: "Plan your site support."
- "New Struck(s)" is still left out. There are no machines or projects for this service.

### 11. Machine relationships
Machine relationships come only from `machines.ts` (company profile p.7). Only the names and
rated powers printed in the profile are shown: no brands, bed sizes, thickness, speed or tolerance.

| Service | Machines (exact profile names) | Rated power shown |
| --- | --- | --- |
| Laser Cutting | 12000W Tube Cutting Machine · 12000W Fiber Laser Combo Machine · 6000W Fiber Laser Machine · 3000W Fiber Laser Machine | 12,000 W · 12,000 W · 6,000 W · 3,000 W |
| CNC Bending | CNC Press Brake Machine | none (the profile gives none, so the row is left out) |
| Metal Fabrication | Laser Welding Machine | none (not stated) |
| Steel Structures, Laser Engraving, Scaffolding | none in the profile | section hidden |

Each machine card links to `/{locale}/capabilities#<machine-slug>`, and each machinery section has a
"See all machinery" button. The Capabilities page is still the `planned` in-development page (item
28); Stage 1E can use the machine slugs as anchors.

### 12. Project relationships
A project appears on a service page only if both conditions hold:

- it is listed for that service in `services.ts`, **and its own record lists the service**;
- it is showcased (no withheld photos and no open authorship question).

| Service | Projects shown |
| --- | --- |
| Laser Cutting | Geometric Lanterns (#23), Perforated Canopy Screen (#16), Clock Tower Landmark (#05), Suspended Lantern (p.3) |
| CNC Bending | Perforated Metal Seating (#22) |
| Steel Structures | Palm-Leaf Shade Canopies (#18), Gateway Welcome Signs (#10), Car-Park Shade Structures (#19), Curved Steel Frames (#32) |
| Metal Fabrication | Heritage Cannon Replicas (#11), Dome Finial & Crescent (#09), Sculpture Fabrication (#29), Lattice Tower Replica (p.3) |
| Laser Engraving | none, so the section is hidden |
| Scaffolding | none, so the section is hidden |

**Data corrections** in `services.ts`:

- Stainless Steel Handrails (#31) was removed from CNC Bending. Its record lists fabrication only.
- Calligraphic Sculptures (#13) and Heritage Cannon Replicas (#11) were removed from Laser
  Engraving. Both are recorded as laser-cut, not engraved.

RAWASY can confirm the services behind each project (item 30). Cards link to
`/{locale}/projects/<slug>`, which stay the `planned`, noindex in-development pages until 1F.

Gallery photos are never repeated in the same page's project cards. The project categories feed
the "Seen in our work" tags under Applications.

### 13. Related services
| Page | Related services (V2 `ServiceCard`s, each in its own tone) |
| --- | --- |
| Laser Cutting | CNC Bending, Metal Fabrication, Laser Engraving |
| CNC Bending | Laser Cutting, Metal Fabrication, Steel Structures |
| Steel Structures | Metal Fabrication, CNC Bending, Scaffolding |
| Metal Fabrication | Laser Cutting, CNC Bending, Steel Structures |
| Laser Engraving | Laser Cutting, Metal Fabrication |
| Scaffolding | Steel Structures, Metal Fabrication |

The brief's examples are followed exactly: Laser Cutting → CNC, Fabrication, Engraving; Steel →
Fabrication, CNC; Scaffolding → Steel, Fabrication. The section also has an "All services" link.

### 14. EN status
Complete on all six pages. All copy is sourced (company profile p.3–7 and the existing records);
the process steps are general workflow text with the disclaimer. Titles and descriptions come from
the approved service records ("Laser Cutting | RAWASY"…).

### 15. AR status
Complete on all six pages, written as professional Saudi business Arabic (not line-by-line
translation). Arabic uses Noto Kufi Arabic for headings and the tagline (as on the approved services
overview) and IBM Plex Sans Arabic for body text; no letter-spacing on Arabic. Localized titles,
descriptions, breadcrumbs and structured data ("القص بالليزر | رواسي"…).

### 16. RTL status
Full structural mirroring: hero columns, breadcrumbs and arrows, the process rails and the cycle
(the first station sits at the right), cards, the layered scope photos, the CTA band and the
engraved plate. Checked by test (hero and process order) and by eye in every AR capture.
Technical drawings that are drawing conventions (the axis sheet's A–D grid, the press-brake
elevation, the profile sections) are deliberately not mirrored. Fixed during QA: the hero's outlined
numeral carried `dir="ltr"`, which flipped its logical position in Arabic; it now sits at the end of
the text column.

### 17. Light/dark status
Both themes on all six pages.

- **Light:** the warm off-white base with steel, teal and brass tints.
- **Dark:** the graphite base with blue-grey panels.
- **Brass plates:** new light and dark tokens (`--brass-*`, `--engr-*`).
- **Physical materials:** the engraving swatches (metal, wood, acrylic, leather) and the machine
  photo plates keep their own colours in both themes.
- **Tests:** the dark theme is covered by a test and by axe in both themes (item 19).

### 18. Responsive QA
**Visual matrix:** 6 pages × 5 widths (1440, 1280, 834, 390, 360) × EN/AR × light/dark = 120
full-page captures. All returned HTTP 200, with no sideways overflow and no console errors or
warnings. Tests also check for no sideways scrolling at 360, 390 and 834 px on all twelve page
variants.

**Desktop (1440, 1280):**

- **Hero:** text and visual side by side.
- **Grids:** scope grids of four or five columns; the process runs as a horizontal rail or cycle.
- **Machines:** four machine cards in a row, or a wide specification panel.
- **Projects:** four staggered cards.

**Tablet (834):**

- **Hero:** the visual stacks under the text.
- **Grids:** two columns.
- **Process:** rails turn vertical.

**Phones (390, 360):**

- **Layout:** one column. Rails run vertically with a start-side line; the cycle becomes a list
  (the return loop is desktop only).
- **Swatches and plates:** the engraving swatches stay two across, and the machine photo plates are
  shorter.
- **Photos:** gallery prints show at their native size, and the contact sheet wraps.
- **Hero drawings:** they scale with the viewport and keep their layered photos.
- **Overall:** every page stays visually rich on phones.

**Review sheets** (sent with this report; each 2,400 px tall; long pages cut into columns):

- one desktop sheet per page (1440: EN light | AR dark): `01a`–`06a`;
- one mobile sheet per page (390: EN light | AR dark): `01b`–`06b`.
- The Laser Cutting and Metal Fabrication phone pages are about 17,500 px tall, and Chromium blanks
  full-page captures beyond about 16,000 px. Those two sheets show the first 16,000 px, which runs
  through the closing band into the footer.

### 19. Accessibility QA
- **axe-core (WCAG 2.2 AA + best practice):** 96 audits, covering 6 pages × EN/AR × light/dark ×
  1440/390, with both reduced and full motion. No serious or critical findings.
  - **Fixed during QA:** small orange figure numbers on a recessed tray and a deep section measured
    4.23–4.43:1. The figure numbers are now `text-ink-2` with an orange mark, and the scaffolding
    scope moved to the base surface.
  - **Unchanged from V2 (moderate, shell, planned for 1I/1J):** `landmark-unique` (the header and
    footer language switchers share the label "Language") and `region` (the WhatsApp button sits
    outside a landmark).
- **Structure (tested):** one H1 per page, heading levels never skip (h1 → h2 → h3), a labelled
  breadcrumb, and every image with alt text. Captions describe what is visible.
- **Decoration:** every drawing, pattern, numeral and swatch is `aria-hidden` (tested, including
  the new decoration classes).
- **Keyboard (tested):** the quote action is reachable by Tab with a visible focus ring; cards are
  single links that open with Enter; focus frames match hover.
- **Touch:** nothing depends on hover. The pointer light is desktop mouse only.
- **Reduced motion (tested):** reveals are opacity-only, drawings are shown complete, scan lines and
  grid drift are off.
- **No JavaScript (tested):** all content is visible.
- **Hand checks:** axe cannot check gradients, so text on gradients was checked by hand. The brass
  plates, bench plate and material swatches carry no text. The axis-sheet labels are light slate text
  on dark slate.

### 20. SEO status
- Service pages are `review` in `src/lib/page-meta.ts` (they were `planned`). They are `noindex,
  follow` and left out of `sitemap.xml`; both are checked by test.
- Localized `<title>` and description, canonical, `hreflang` (en, ar, x-default), Open Graph and
  Twitter tags.
- JSON-LD `Service` (name, description, serviceType, URL, area served, provider `@id` of the site's
  Organization) plus a three-level `BreadcrumbList` (Home → Services → service).
- One H1 per page, and heading levels never skip (tested).

### 21. Image/source concerns
**Laser Engraving:** the page shows no photographs.

- `services/engraving-nameplates` shows third-party HITACHI branding with legible part and serial
  numbers. It is not used on the page (not even small), as the brief asked.
- `engraving-wood` and `engraving-rotary` are renders, so they stay off too.
- The hero is the drawn engraved plate instead, and the materials section uses drawn swatches.
- Note: the V2 services overview still uses the nameplates photo as the engraving cover and the wood
  render as its second image. That is unchanged, because it was approved in V2. Please say if it
  should change.

**Laser Cutting:** `projects/canopy-tree-1` (authorship question) is excluded from the gallery. The
gallery now draws on RAWASY's own work-gallery photos rather than the stock-looking covers.

**Withheld and flagged images** (AI-watermarked photos, renders, open authorship) appear on no
service page. This is tested.

**Stock-looking images still in use** (all already listed in the asset inventory):

- Laser Cutting: `site/laser-sparks` (hero), `site/laser-head`.
- CNC Bending: the three bending photos.
- Steel Structures: `site/steel-beams-hall`, `site/steel-frame-dusk`, `services/steel-structures-1…4`.
- Metal Fabrication: `services/fabrication-welding`, `-grinding`, `-laser-welding`, and the newly used
  `site/welder-sparks` (fabrication hero).
- Scaffolding: the scaffolding photos.

Their licences need confirming.

**Resolution:** the source photos are small (mostly 150–550 px wide). Every photo is shown at or
below its native width (the contact sheet allows 1.15×). The CNC hero photo (295 px) is a small
inset rather than a large hero. This is tested for the mosaic, pair and card frames.

**Captions** describe only what is visible. They double as alt text; decorative drawings are
`aria-hidden`.

### 22. Performance comparison
**Method:** production builds side by side (approved V2 on one port, 1D on another), measured in
the same session: 1440 × 900, light theme, three runs each (CDP metrics). "Scroll" = main-thread
task and style time for one full scroll at 45 px per frame. "Idle" = 4 s with the page's ambient
motion on screen. Transfer is uncompressed bytes after a full scroll.

- **Frame rate:** headless Chromium in this container caps frames at about 30 fps, so every page
  reads 29–35 fps. The task times are the meaningful comparison.
- **The earlier V2 report's 55–59 fps** came from a different container, so those figures are not
  comparable with these.

| Page | Scroll task | Style | Worst frame | Idle 4 s | HTML | Images |
| --- | --- | --- | --- | --- | --- | --- |
| V2 `/en` (homepage) | 2,956 ms | 383 ms | 105 ms | 250 ms | 504 KB | 666 KB |
| 1D `/en` (homepage) | 3,015 ms | 420 ms | 120 ms | 251 ms | 504 KB | 666 KB |
| V2 `/en/about` | 1,756 ms | 356 ms | 102 ms | 9 ms | 354 KB | 228 KB |
| 1D `/en/about` | 1,741 ms | 347 ms | 99 ms | 8 ms | 354 KB | 228 KB |
| V2 `/en/services` | 962 ms | 251 ms | 93 ms | 8 ms | 225 KB | 200 KB |
| 1D `/en/services` | 999 ms | 257 ms | 81 ms | 7 ms | 225 KB | 200 KB |
| V2 laser-cutting (placeholder) | 105 ms | 6 ms | 75 ms | 11 ms | 98 KB | 0 KB |
| 1D Laser Cutting | 1,109 ms | 264 ms | 85 ms | 12 ms | 267 KB | 195 KB |
| 1D CNC Bending | 819 ms | 205 ms | 78 ms | 10 ms | 209 KB | 41 KB |
| 1D Steel Structures | 927 ms | 209 ms | 76 ms | 13 ms | 244 KB | 178 KB |
| 1D Metal Fabrication | 988 ms | 224 ms | 110 ms | 14 ms | 271 KB | 154 KB |
| 1D Laser Engraving | 570 ms | 125 ms | 77 ms | 8 ms | 175 KB | 0 KB |
| 1D Scaffolding | 794 ms | 174 ms | 111 ms | 11 ms | 212 KB | 170 KB |

**Reading:**

- **Service pages vs approved pages:** each service page costs less to scroll than the approved About
  page and about the same as the services overview. Idle cost with ambient motion on screen is the
  same as the V2 pages (7–14 ms per 4 s).
- **Homepage, About and services overview:** unchanged within run-to-run noise.
- **JavaScript:** none new (768–783 KB on every page, as before). The service pages are server
  components; they reuse the existing reveal and live observers and the pointer light.
- **CSS:** 147 KB → 160 KB uncompressed, from the appended service-page styles.
- **Constraints respected:** no animation library, WebGL, canvas, video, blur or CSS filters. The
  drawings are inline SVG, drawn once with `stroke-dashoffset` transitions. Ambient motion (grid
  drift, scan lines) runs only while on screen and never with reduced motion.

### 23. Lint
`npm run lint` (ESLint): **passed**, no errors or warnings.

### 24. Typecheck
`npm run typecheck` (`next typegen && tsc --noEmit`): **passed**.

### 25. Build
`npm run build` (Next.js 16.3.6, Turbopack): **passed**. 109 static pages, the same count as V2,
because the twelve service routes were already prerendered as placeholders. All six services are
prerendered in EN and AR (`/[locale]/services/[slug]`, SSG). Nothing on the service pages needs
client JavaScript beyond components the site already ships (the reveal and live observers, and the
pointer light).

### 26. Browser tests
`npm run test:e2e` against the production build: **121/121 passed** in 3.3 minutes.

| Suite | Tests | What it covers |
| --- | --- | --- |
| `site.spec.ts` | 9 | shell, homepage, theme, language switch, mobile menu (unchanged) |
| `stage-1c.spec.ts` | 43 | inner pages (unchanged) |
| `visual-system.spec.ts` | 11 | V2 visual system, plus **1 new** regression test: line work draws once revealed, with no resize (homepage beam and pillars, About sketch, two service heroes) |
| `redesign-v2.spec.ts` | 24 | V2 pass (unchanged) |
| `service-pages.spec.ts` | **34 new** | see below |

What the 34 new service-page tests cover:

- **Routes (12):** six routes × EN/AR. Each checks HTTP 200, `lang`/`dir`, one H1 with the service
  name, heading order, the three-level breadcrumb, the `Service` and `BreadcrumbList` JSON-LD,
  canonical and `hreflang`, `noindex`, the Open Graph title, no placeholder text, the process
  disclaimer, no sideways scrolling and no console errors.
- **Review gate:** the sitemap excludes the service pages, and an unknown slug is a 404.
- **Relations (6, one per service):** exact machine links to `/capabilities#…`, exact project links
  (only projects whose record lists the service), exact related-service links and order, the quote
  links (hero and closing band) to `/contact#quote`, and a `tel:` link.
- **Rated power:** shown only where the profile states it.
- **Quote link:** lands on the contact page's request form.
- **Images:**
  - every image has alt text;
  - the engraving page has no photographs;
  - the nameplates photo, the renders and `canopy-tree-1` are absent;
  - withheld AI-watermarked photos appear on no service page;
  - photographs are not shown wider than their frames allow;
  - decoration is hidden from assistive technology.
- **Layout:** RTL mirroring of the hero and the process, the dark theme, and no sideways scrolling at
  360, 390 and 834 px (EN and AR, all six pages).
- **Keyboard:** the quote action is reachable by Tab with a visible focus ring; cards are focusable
  links that open with Enter.
- **Reduced motion:** nothing in view stays hidden, drawings are complete and scan lines are off.
- **No JavaScript:** all content is rendered and visible.

### 27. V2 regression
Two production builds were compared side by side: the approved V2 commit (`3a91869`, built in a
git worktree) and this build.

- **Server HTML:** **26/26 identical** (10 approved pages plus a planned project page, the
  capabilities page and the 404, in EN and AR), after normalising `/_next/static` paths. This
  includes the homepage hero markup.
- **ARIA snapshots:** **20/20 identical** (10 approved pages × EN/AR).
- **Screenshots:** 200 screens (10 approved pages × 5 widths × EN/AR × light/dark). Reveals were
  forced visible and lazy images loaded, because those are timing effects, not code.
  - **179/200 pixel-identical.**
  - The other 21 differ only where a photo was still loading in one of the two captures (for
    example, the homepage services-explorer photo was blank in one run and loaded in the other), or
    by sub-pixel image decoding (at most 0.17% of pixels). There are no layout, text, colour or
    spacing changes. The contact map is unchanged.
- **Shared files touched:**
  - `globals.css`: new service-page classes and brass tokens, appended; plus the drawing fix below.
  - `InnerPageHero.tsx`: `MetaStrip` is now exported; no output change.
  - `types.ts`, `pages.ts`, `repository.ts`: additions only.
  - `services.ts`: galleries now carry captions; the project-link corrections in item 12. Neither
    field is used by any V2 page.
  - `page-meta.ts`: `service` moved from `planned` to `review`.

**One intentional visible change:** draw-on-reveal line work.

- **Before:** in the approved build, the homepage structural beam, the six "Why RAWASY" pillar icons
  and the About hero's structural sketch never drew in Chromium after a normal scroll. A selector like
  `[data-revealed] [pathLength]` is not re-evaluated for SVG descendants when the attribute appears.
  QA screenshots never showed the problem, because full-page captures resize the window, and that
  restyles everything.
- **Fix:** the revealed element now sets an inherited `--draw` custom property, which the paths read.
  The drawings now appear as they did in the approved screenshots.
- **Verification:** a side-by-side proof after a normal scroll (V2 blank, 1D drawn) is attached. A
  regression test now checks that the drawings complete without a resize.
- **Reduced motion:** the beam and pillar icons now show complete. Before, they stayed blank.
- **Your call:** this touches the approved homepage in CSS only. Please say if you would rather keep
  it back.

### 28. Stage 1E not started
Not started. `/capabilities` is still the `planned` in-development page. Service pages only link
to it (machine cards and a "See all machinery" button), as the brief allows.

### 29. Project detail pages not started
Not started. `/projects/[slug]` are still the `planned` in-development pages (noindex). Service pages
link to them from the project cards, as the brief allows. Stage 1G or later and the Phase 2 admin
panel were not started either.

### 30. Outstanding RAWASY confirmations
1. **Engraving photography:** photos of RAWASY's own engraved work (own products, no third-party
   brands or data), or permission to show the HITACHI nameplates photo.
2. **Image licences:** the stock-looking service photos (item 21), including `site/welder-sparks`,
   newly used on the fabrication hero.
3. **Services per project:** which services each gallery project used. This would let CNC Bending link
   the stainless handrails (#31) and Laser Engraving link the calligraphic sculptures (#13) or cannon
   replicas (#11), if engraving was used.
4. **Machinery:** whether any machine besides those on profile p.7 serves steel structures,
   engraving or scaffolding (for example an engraving laser). Nothing was assumed.
5. **Still open from V2:**
   - RAWASY's own Google Maps place link (the contact map still uses an address search, unchanged);
   - image rights and high-resolution originals;
   - authenticity of flagged portfolio items;
   - the renewed commercial activity licence;
   - registration numbers;
   - "New Struck(s)";
   - a domain email address.
6. **Accessibility findings for 1I/1J:** the two moderate shell findings (duplicate "Language" label
   on the header and footer switchers; the WhatsApp button outside a landmark).

All are recorded in `docs/ASSET_INVENTORY.md` (items 12–15 are new).
