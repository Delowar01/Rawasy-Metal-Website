# RAWASY website — Stage 1C-V global visual enhancement pass

**Date:** 24 September 2026
**Branch:** `claude/new-session-5eijs6`
**Status:** built and tested, **returned for your visual review. Not self-approved.**

Stage 1C is still not approved. This pass is visual only:

- Content, routing, SEO, language and RTL behaviour are unchanged. So are the approval gate, form
  behaviour and certificate redaction.
- The homepage is still the only `published` page. All eight Stage 1C pages stay `review` (noindex,
  not in the sitemap).
- Stages 1D, 1E and 1F were not started.

## Summary

The site was flat: hairline rules on one background colour. It now reads as layered metal sheets on
a technical drawing:

- **Surfaces:** standard, elevated, recessed, raised and brushed-metal surfaces, with semantic depth
  shadows.
- **Technical frames:** 1px rules that draw in, corner marks, and an accent edge on hover and focus.
- **Section treatment:** architectural section rules and varied section backgrounds (engineering
  grid, fine grid, perforated field, dark band, image-led, split).
- **Imagery:** framed photographs with registration marks.
- **Motion:** slow ambient motion (drifting grids, scan lines, a pointer light on selected plates),
  kept restrained.

On the homepage, only the sections below the hero changed. The hero and the precision statement are
untouched, apart from the dark-mode contrast fix to tertiary text (item 25). Every section keeps its
structure, copy and order. All work is built from a small set
of reusable primitives, so later stages can use the same language.

---

## 1. Main commit SHA

`ed4a6225f145f1d434d1081f88f7adc4ec735a44`: "Add Stage 1C-V visual enhancement pass".

## 2. Branch SHA

The branch head is the docs commit that adds this report, README and project-memory updates, on
top of `ed4a622`. The exact SHA is given in the chat report, because a commit cannot contain its own
SHA.

## 3. Files changed

The main commit changes 45 files (+2,305 / −405). The package manifest is unchanged: no new
dependencies.

- **New:**
  - `src/components/visual/`: `TechnicalFrame`, `Backdrop` (with `ScanLine`), `SectionRule`,
    `PointerLight`, `Nameplate`.
  - `src/components/motion/LiveObserver.tsx`, `src/components/legal/LegalToc.tsx`,
    `src/lib/use-scroll-spy.ts`.
  - `e2e/visual-system.spec.ts`.
- **Design system:** `src/app/globals.css` (tokens, the visual-system layer, reveals, ambient motion,
  reduced motion).
- **Homepage:**
  - `src/components/home/`: `Intro`, `ProcessLine`, `ServiceExplorer`, `MachineExplorer`,
    `FeaturedProjects`, `IndustryList`, `WhyRawasy`, `Metrics`, `ClientMarquee`, `Certificates`,
    `ProjectCTA`.
  - `src/app/[locale]/page.tsx`.
- **Shared:**
  - `src/components/ui/SectionHeader.tsx`.
  - `src/components/inner/`: `InnerPageHero`, `EditorialSection`, `MediaFrame`, `InnerCTA`.
  - `src/app/[locale]/layout.tsx` (mounts `LiveObserver`).
- **Stage 1C pages:**
  - `src/app/[locale]/{about,services,industries,clients,certificates,contact}/page.tsx`.
  - `services/`: `ServiceRow`, `ServiceScrollSpy`, `ServicePlate`.
  - `industries/IndustryIndex`, `clients/ClientGrid`, `certificates/CertificateRegister`,
    `legal/LegalPageLayout`.
  - `contact/`: `QuoteForm`, `ContactMethods`.
- **Content:** `src/content/contact.ts` and `types.ts` (three form-group headings, EN/AR).
- **Docs commit:** this report, `README.md`, `CLAUDE.md`.

## 4. Reusable components

| Brief's name | Built as | What it does |
| --- | --- | --- |
| TechnicalFrame | `TechnicalFrame`, `FrameMarks`, `.tf-host` (`src/components/visual/TechnicalFrame.tsx`) | 1px rules that draw in (horizontal, then vertical, 1.2 s), corner marks, a marker that runs the top edge once, and an accent top/start edge on hover, focus or `data-active`. Variants: full, `corners`, `hover` (corner marks only while hovered). |
| AnimatedBorder | The frame's `.tf-hl` (accent edges) and `.tf-m` (travelling marker) layers | Border sweep on hover/focus (0.48 s) and marker run (0.8 s). |
| SectionBackdrop / TechnicalGrid | `Backdrop` (`kind="grid" \| "fine" \| "perforated"`, optional `drift`) | Engineering grid, fine drawing grid or perforated field; drifts very slowly only while on screen. |
| ScanLine | `ScanLine` | A thin accent line that passes slowly through a technical area while on screen. |
| SurfacePanel / RaisedPanel | `.panel`, `.panel-raised`, `.panel-recessed`, `.panel-metal`, `.rivets` | Elevated sheet, raised sheet (lit top edge, shaded bottom edge, contact shadow), recessed tray, brushed plate with rivets. |
| ImageFrame | `MediaFrame` (`src/components/inner/MediaFrame.tsx`) | Photo on a technical frame: registration marks, offset outline, optional perforated plate behind, numbered caption (top or bottom, reading order unchanged), hover zoom, very subtle scroll parallax. Never wider than the source image. |
| ActiveRow | `.act-row` (+ `data-active`) | Accent start edge and surface shift for hovered, focused or active rows. |
| — | `SectionRule` | Architectural hairline above every section header: charcoal lead segment, rule that draws in the reading direction, measurement ticks. |
| — | `PointerLight` | A soft light that follows the mouse across a plate (desktop mouse only; never touch or reduced motion). |
| — | `Nameplate` | The registered company names on a riveted brushed-metal plate. |
| — | `LiveObserver` (`src/components/motion/`) | One IntersectionObserver that switches ambient layers on only while they are on screen. |
| — | `useScrollSpy` (`src/lib/use-scroll-spy.ts`), `LegalToc` | Shared "section being read" logic for the services index and the legal contents. |
| — | `.tech-tag`, `.reg-marks`, `.ruler`, `.rule-double`, `.redaction-swatch`, `.zoom-img`, `.parallax`, `.wipe-line` | Technical tags, crop/registration marks, measuring scale, double rules, redaction legend, photo zoom and parallax, the services cutting line. |

## 5. Tokens added / changed (`src/app/globals.css`)

**Added (light and dark):**

- Surfaces: `--surface-recessed`.
- Borders: `--border-faint`, `--border-ink`.
- Depth: `--shadow-low`, `--shadow-medium`, `--shadow-metal`, `--shadow-inset`, `--shadow-accent`,
  `--sheen`, `--edge-light`, `--edge-shade`.
- Plates: `--plate-a/b/c`, `--rivet`.
- States and light: `--row-tint`, `--light-spot`, `--scan`.
- Motion: `--dur-1..4` (0.24 / 0.48 / 0.8 / 1.2 s).
- Tailwind colours: `recessed`, `line-faint`, `line-ink`.
- Registered properties: `@property --chamfer` (button chamfer) and `@property --tfc` (frame colour),
  so both can transition.

**Changed:**

- Light: `--surface-elevated` #f8f7f4 → #f9f8f5.
- Dark (graphite layering):
  - Background and surfaces: `--background-deep` #141617 → #121415, `--surface` #1e2021 → #1d1f21,
    `--surface-elevated` #252728 → #24272a, `--surface-strong` #313334 → #2f3235.
  - `--band` #111213 → #0f1112.
  - `--text-tertiary` #8c8a85 → #95938d. This fixes the 4.35:1 contrast on raised panels noted in 1C;
    it is now 4.9:1.
- The no-JavaScript dark fallback block mirrors every dark value.
- `--shadow-soft`, `--border` and `--border-strong` keep their approved values. Two of them were
  briefly changed during this pass and restored during QA, so the site shell (such as the floating
  WhatsApp button) looks as approved.

## 6. Homepage enhancements (below the hero only)

The hero and the precision statement are unchanged, apart from the dark-mode contrast fix to
tertiary text (item 25). No section was added, removed, reordered or rewritten.

- **Every section header:** an architectural section rule that draws in.
- **01 Who we are:**
  - The registered names sit on a riveted brushed-metal nameplate.
  - "Beyond metalwork" items are technical tags.
  - The vision sits in a recessed tray with an accent edge.
  - A faint drawing grid drifts behind the copy.
- **02 Key capabilities:**
  - An engineering grid drifts on the start side; the perforated field stays on the end side.
  - Each station has a raised icon tile. The tile shows a faint outline of its icon until the orange
    production line reaches it, then draws the icon and gains an accent top edge.
  - Hover or focus on a station: tint, accent edge, node highlight.
- **03 Services explorer:**
  - The active row gets a warm tint and a 2px marker.
  - The figure is framed: rules, corner and registration marks.
  - A cutting line now runs with the image wipe.
  - Highlights are technical tags; the mobile cards gain depth.
- **04 Machinery:**
  - The stage is a raised plate with a corner frame, a slow scan line and a pointer light.
  - Selector rows tint with an accent edge.
  - Specs sit on a double rule; the previous/next buttons are raised.
- **05 Selected work:** photos gain depth. Hover or focus shows corner marks, accent edges, a
  travelling marker and a deeper shadow.
- **06 Industries:**
  - Rows tint and draw an accent start edge on hover.
  - The floating preview is framed (accent corners, registration marks, "IND 0N" caption).
- **07 Why RAWASY:** the six pillars sit on one raised sheet. Hover shows a tint, accent edges and
  corner marks.
- **08 Metrics band:** the grid drifts slowly, a scan line passes, and a measuring scale runs above
  the figures.
- **09 Clients:**
  - Double rules frame the marquee.
  - A hovered logo cell lifts, shows accent corners and draws an accent line.
- **10 Certificates:**
  - Raised document cards with corner frames, "DOC 0N" labels and a pointer light on the
    perforated plate.
  - A stronger dialog: accent bar, sheen header, grid preview area, framed previews and a redaction
    legend.
- **11 Start a project:** a section rule; the three steps sit in a corner frame.

## 7. About enhancements

- **Hero:** the registered names on a riveted nameplate; the structural drawing lines are clearly
  visible now.
- **Workshop image:** a layered composition:
  - a perforated steel plate behind;
  - an offset outline;
  - a technical frame that draws in, with registration marks and a numbered caption.
- **Vision band (stronger):**
  - Drifting grid, perforated field and a slow scan line.
  - A larger statement with an accent diamond.
  - The four aims as a framed four-cell grid.
- **Process line:** each step's rail segment draws down to the next node as it scrolls in, and the
  node lights in a raised square.
- **Lists:** the service links, the "beyond metalwork" list and the "why" list use active rows. The
  "why" list sits on a raised sheet. The "beyond" section has a fine-grid backdrop.

## 8. Services enhancements

- **Hero:** perforated field with a pointer light; the service plate also has a pointer light.
- **Index column:** a recessed, split surface with a fine grid. The sticky index marks the service
  being read.
- **Rows:**
  - The row being read gets an accent top edge and a lit frame, and its outline numeral turns
    accent.
  - Stronger row separation and alternating composition.
  - Equipment is shown as technical tags.
- **Imagery:** the cover photo is framed, with its caption above. A second photo is raised and
  overlaps the cover's lower corner, alternating sides row by row.

## 9. Industries enhancements

- **Sector index:** rows tint, the active row keeps an accent edge, and each row is numbered.
- **Preview:** a raised panel on a fine grid with an accent frame and registration marks. A large
  outline numeral of the active sector settles in, and a sweep line crosses on each change.
- **Other sections:** strip photographs are framed with hover zoom. The classification note sits in
  a recessed panel.

## 10. Clients enhancements

- **The sheet:** a raised panel with a corner frame and a ruled grid.
  - Column letters and row numbers run around it, like a drawing's grid references (A–G / 1–3 on
    desktop, A–C / 1–7 on phones).
  - Each cell is numbered, and the sheet ends in a title-block footer.
- **Hover:** the cell lifts, the logo shows its original colours (light theme), accent corner marks
  appear and an accent line draws beneath it.
- **Resting state:** corner marks appear only on hover, so the grid stays uncluttered.

## 11. Certificates enhancements

- **Document plates:**
  - Each document lies on a perforated table with a metal shadow and a pointer light.
  - Each has a "DOC 0N" index and a technical frame whose border turns accent on hover.
  - Captions carry a hatched redaction swatch.
- **Register table:** on a raised sheet, with row hover and an accent edge on the first cell.
- **Redaction section:** a perforated backdrop and a swatch legend; the list is on a raised sheet.
- **Dialog (stronger):** accent bar, sheen header with the DOC label, fine-grid preview area and
  framed previews.
- Redactions are unchanged: no numbers, QR codes or names were added.

## 12. Contact enhancements

- **Contact methods:** a raised sheet with a title block (ruler ticks). Active rows light an accent
  edge, and the arrows move on hover and focus.
- **Form container:** a raised, framed panel.
- **Grouped sections:** 01 Your details / 02 Project / 03 Details and drawings.
- **Fields:** technical field borders with an inset shadow. On focus, an accent edge draws beneath
  the field alongside the focus ring.
- **File drop area:** a framed, hatched recessed tray.
- **CTA hierarchy:** the submit row sits on a double rule. The primary action and the secondary
  actions are clearly separated.
- **Behaviour** (validation, prepared request, email/WhatsApp hand-off, no-JS fallback) is
  unchanged. All form tests pass.

## 13. Legal enhancements

- **Contents:** a technical contents sidebar, a recessed sticky rail. The entry being read gets an
  accent bar, dark text and `aria-current`. It follows the reading position and returns to the first
  entry at the top of the page.
- **Numbering:** section numbers in bordered squares.
- **Separators:** a charcoal lead segment on each separator; subtle borders.
- **Readability:** line lengths, sizes and line heights are unchanged.

## 14. Dark-theme improvements

- **Layered charcoal, never pure black:** background #17191a, deep sections #121415, surfaces
  #1d1f21, recessed #131516, raised #24272a, strong #2f3235, band #0f1112.
- **Depth:** dark shadows are deeper and carry a faint lit top edge and a 5% sheen, so raised sheets
  read as metal.
- **Tuned layers:** grid, perforation, plate and rivet colours were tuned for the dark surfaces.
- **Contrast:** tertiary text lifted to 4.9:1 on raised panels.

## 15. Light-theme improvements

- **Warm off-white, never pure white:** the page stays #f3f1ed. Raised sheets are #f9f8f5 with a soft
  sheen, and recessed trays are #e8e6e1.
- **Depth:** warm, low-contrast shadows, and brushed plates in warm greys.
- **Hover:** in the light theme, a hovered row lifts towards the light instead of darkening, so hover
  never lowers text contrast.

## 16. New animations

Interactions run 0.24–0.8 s and reveals 0.8–1.2 s. There is no bounce, spin, particles or constant
glow.

- **Frame reveal:** rules draw horizontally, then vertically (1.2 s). Corner marks fade in (0.8 s)
  and a marker runs the top edge (1.1 s).
- **Frame hover/focus:** the accent top and start edges draw (0.48 s) and the marker travels
  (0.8 s).
- **Section rule:** the hairline draws in the reading direction (1.2 s) and the ticks fade in.
- **Mask reveal:** in the reading direction (1.2 s), for ruler ticks and the metrics scale.
- **Buttons:** the laser-cut chamfer grows 12 → 17 px on hover and focus (0.48 s), and the outline
  button's border shifts to the text colour. The existing fill wipe and arrow move are kept.
- **Active rows:** accent edge and tint (0.48 s).
- **Process lines:**
  - About: rail segments draw (1.2 s) and the nodes light.
  - Homepage: station tiles light with an accent edge.
- **Services overview:** the active row's edge (0.8 s).
- **Industries:** the numeral settles and a sweep line crosses (0.8 s).
- **Clients:** cell lift and accent line (0.8 s).
- **Form fields:** the accent edge draws on focus (0.48 s).
- **Homepage services explorer:** a cutting line runs with the existing image wipe. It uses the same
  0.95 s timing as the approved wipe.
- **Ambient, only while on screen:**
  - Grid drift: a 90 s loop, barely perceptible.
  - Scan lines: one pass every 11–14 s.
  - Pointer light: desktop mouse only.
  - Scroll-linked photo parallax of ±3%, where the browser supports it.

## 17. Reduced-motion behaviour

With `prefers-reduced-motion: reduce`:

- **Off:** `LiveObserver` does not run, so grids never drift. Scan lines and the pointer light are
  hidden. Parallax, photo zoom, the travelling markers and the cutting line are off.
- **Instant:** frames, rules and masks are shown fully drawn. Active-row, edge, cell, field and
  button transitions are instant. Process stations are shown lit.
- **Reveals:** simple opacity fades, as before.
- Static styling (surfaces, frames, corner marks, tints) stays, so the design is the same, just still.
- Covered by the browser tests: nothing in view stays hidden; ambient layers stay off; scan lines and
  the pointer light are hidden.

## 18. Responsive QA

- **AFTER matrix on the final production build:** 9 pages (homepage + 8) × 5 widths (1440, 1280,
  834, 390, 360) × EN/AR × light/dark = 180 full-page renders.
  - All 180 returned HTTP 200.
  - None scroll sideways.
  - There were no console errors or warnings.
- **BEFORE vs AFTER:** the BEFORE set is the same 180 renders of the approved 1C build.
  Twelve comparison sheets are attached.
- **Tests:** they check every inner page for sideways scrolling at 360, 390 and 834 px in both
  languages. The result is 0 px.
- **Per breakpoint:**
  - The services split surface and the legal contents rail are desktop only.
  - The client sheet switches to 3 columns with A–C / 1–7 references on phones.
  - Machinery selector chips keep an accent border on phones.
  - Section rules, frames and tags scale down without overflow.
- **Touch:** nothing depends on hover. Hover-only extras (tile corner marks, the pointer light,
  travelling markers) are decorative. All content, links and states work by tap and keyboard. The
  pointer light never switches on for touch (tested).
- **Screenshot limit:** Chromium cannot capture full-page images taller than about 16,000 px. The
  homepage at 390/360 px is about 21,000 px tall, so it was also captured viewport by viewport. The
  BEFORE set has the same limit.

## 19. Accessibility QA

- **axe-core 4.13 page audit** (WCAG 2.0/2.1/2.2 A–AA plus best practice): 80 page variants
  (homepage + 8 pages + 404 × EN/AR × light/dark × 1440/390).
  - 0 serious or critical violations.
  - The only findings left are the two moderate best-practice notes from the approved site shell:
    `landmark-unique` (header/footer navigation) and `region` (the floating buttons). They are
    unchanged since 1B/1C.
- **Interactive states:** quote-form errors, the prepared request, and the certificate dialog on the
  certificates page and on the homepage. 0 violations in 16 combinations.
- **Fixed during QA:**
  - **Recessed rails:** tertiary and accent small text on the new recessed rails (services index,
    legal contents, industries note) measured 4.34–4.41:1. It is now dark or secondary ink (7:1 or
    more).
  - **Active-row tint:** it lowered accent numbers to about 4.47:1. The tint was reduced to 5%
    (4.56:1).
  - **Light-theme hover:** the tint now lightens a row instead of darkening it, so hover never
    lowers contrast.
  - **Dark tertiary text:** lifted from 4.35 to 4.9:1 on raised panels.
  - **Selected machinery chip on phones:** the accent number measured 4.31:1 (present since 1B). It
    is now dark ink.
- **Semantics:** the aria trees of 9 pages × EN/AR × 1440/390 were compared with the approved build.
  - They are identical everywhere except the quote form, which now groups its fields into three named
    groups: "Your details", "Project" and "Details and drawings". These are the brief's "grouped
    sections".
  - Every role, name, label, hint and value inside the form is unchanged.
  - The services cover captions sit above the photos visually, but stay after them in the reading
    order.
- **Decoration:** every frame, backdrop, scan line, light, rule, mark and scale is `aria-hidden`. A
  test enforces this on 9 pages.
- **Focus:** keyboard focus gets the same frame, edge and marker states as hover (tested). Keyboard
  behaviour is unchanged: skip link, dialogs, form and indexes.
- **Legal contents:** the rail marks the section being read with `aria-current`.
- **Motion and no-JS:** motion is optional (item 17). Without JavaScript every page is fully visible
  (tested).

## 20. Performance impact

- **No new libraries:** no WebGL, Three.js, canvas, video or new dependencies. Motion uses CSS,
  IntersectionObserver and the existing GSAP only.
- **Transfer size (gzip), approved 1C → 1C-V:**
  - CSS: 19.5 → 24.1 KB (+4.6 KB). The bundler now serves the font-face CSS as a second small file.
  - JavaScript per page: +0.7 to +1.5 KB (`LiveObserver`, `PointerLight`, `LegalToc`, scroll spy).
  - HTML per page: +0.8 to +2.6 KB (decorative markup).
- **Runtime:** headless Chromium with software rendering, 1440×900, average of 3 runs, both builds
  measured back to back:

  | Page | Scroll fps (1C → 1C-V) | Main-thread work while scrolling | Idle 4 s, ambient motion in view |
  | --- | --- | --- | --- |
  | Home | 57 → 53 | 1,394 → 1,861 ms | 247 → 284 ms |
  | About | 57 → 54 | 351 → 496 ms | 5 → 10 ms |
  | Services | 59 → 51 | 440 → 638 ms | 8 → 9 ms |
  | Clients | 53 → 47 | 83 → 113 ms | 2 → 11 ms |

- **Optimisations made during QA:** before them, the pages scrolled at 42–50 fps.
  - Ambient layers run only while on screen and pause while the page is scrolling.
  - Moving layers are faded with overlays instead of masks. A mask over a moving layer cost about
    8–10 fps.
  - Frame markers and the file drop area no longer animate `background-position` or `inset`.
  - `LiveObserver` ignores text-only DOM changes.
- **Animated properties:** every looping or scroll-time animation uses transform or opacity only.
  Hover colour and shadow transitions are limited to small elements.
- **Caveat:** these are relative figures from a software-rendered test browser. A GPU-composited
  browser does the compositing work far more cheaply. A check on a real mid-range phone belongs in
  1J (performance QA).

## 21. Lint

`npm run lint` (ESLint): **passed**, 0 errors and 0 warnings.

## 22. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): **passed**, 0 errors.

## 23. Build

`npm run build` (Next.js 16.3.6, Turbopack): **passed**. 109 static pages were generated, with no
build warnings.

## 24. Browser tests

`npm run test:e2e` (Playwright, Chromium, against the production build): **60 passed**, 0 failed,
0 flaky (1.2 min).

- `site.spec.ts` (shell and homepage): 9.
- `stage-1c.spec.ts` (inner pages): 41.
- `visual-system.spec.ts` (new): 10:
  - decoration hidden from assistive technology;
  - ambient motion only on screen;
  - ambient motion rests while scrolling;
  - pointer light follows the mouse;
  - the services cutting line;
  - reduced motion;
  - touch;
  - services active row;
  - legal contents state;
  - focus frame parity.

No existing test had to be changed.

## 25. Homepage regression result

- **Hero markup:** the hero's server HTML (from `<main>` to the first section below the hero) is
  **byte-identical** to the approved build, in English and Arabic.
- **Hero pixels:** the first viewport was rendered statically (reduced motion) at 5 widths × EN/AR ×
  light/dark = 20 captures.
  - Light theme: identical, apart from a shade change of at most 1/255 inside the floating WhatsApp
    button (the elevated surface token moved from #f8f7f4 to #f9f8f5).
  - Dark theme: tertiary labels and dimension lines are up to 9/255 lighter. This is the contrast fix
    in item 14.
- **Buttons:** during QA I found that a new resting bevel on buttons also changed the hero's buttons.
  I removed it, so buttons look exactly as approved at rest. They gain only the chamfer movement and
  the border shift on hover and focus.
- **Structure, content and links:** the homepage accessibility tree is identical to the approved
  build in both languages at 1440 and 390 px. No section was added, removed, reordered or reworded.
  All homepage tests pass: loader, theme, language, mobile menu, explorers, certificate dialog, page
  transition, reduced motion, no-JS and internal links.
- **Publication:** the homepage is still the only `published` page. The 1C routes are still `review`:
  noindex and left out of the sitemap (tested).
- **Intentional visual changes:** limited to the sections below the hero (item 6), plus the contrast
  fix on the machinery chips on phones.

## 26. Stage 1D

**Not started.** No service-detail pages were built. `/services/[slug]` still shows the
"in development" page and stays `planned`.

## 27. Stage 1E

**Not started.** Capabilities & Machinery was not built; `/capabilities` stays `planned`. Its
requirements from this brief are recorded in the project memory (`CLAUDE.md`) for when 1E starts:

- It must be one of the strongest pages, not a plain list.
- Large machinery photography and a machine selector.
- Technical specifications, power figures and technical measurement detail.
- Grid/axis backgrounds, a scanning-line animation and an animated equipment diagram.
- Related services, machine image transitions and industrial depth.

## 28. Stage 1F

**Not started.** Projects and project detail pages were not built; `/projects` and
`/projects/[slug]` stay `planned`. The brief's direction is recorded in `CLAUDE.md`:

- **Projects page:** image-led, with a featured cinematic image, 2-column editorial rows, masonry,
  filters, project numbers, hover interactions, captions and reveals. The text index stays
  secondary.
- **Project detail pages:** hero, gallery, title, category, scope and service. Materials, location,
  year and client appear only if verified. Then challenge, solution and related projects. Unknown
  facts stay hidden.

---

## Items needing RAWASY's confirmation

- **No new facts or claims were added.** The technical labels ("DOC 01", "IND 03", "RW—C · 01",
  "Fig. 01", axis ticks and grid references) are drawing-style identifiers, not company data.
- **New copy: three short form-group headings.** EN "Your details / Project / Details and drawings";
  AR "بياناتك / المشروع / التفاصيل والمخططات". Please check the Arabic wording.
- **Still open from earlier stages:** photography and image rights, AI-watermarked images, licence
  renewal, registration numbers and similar. See `docs/ASSET_INVENTORY.md`.

## Known limitations

- **Photos:** still the low-resolution images extracted from the company profile. Frames never
  enlarge them beyond their native size.
- **Browser support:**
  - The scroll-linked photo parallax needs `animation-timeline` support (Chrome and Edge). Other
    browsers show the photos static.
  - The chamfer and frame-colour transitions rely on `@property`. Browsers without it switch
    instantly.
- **Touch:** hover-only decoration (tile corner marks, the pointer light, travelling markers) does
  not appear on touch screens, by design.
- **Remaining axe notes:** the two moderate best-practice notes from the approved site shell
  (item 19).
- **Scroll smoothness:** slightly below 1C in a software-rendered test browser (item 20).
- **New copy:** the three form-group headings are new, and the Arabic needs RAWASY's review.

## How to run

```bash
npm install
npm run dev                          # http://localhost:3000
npm run lint && npm run typecheck
npm run build && npm run test:e2e    # Playwright against the production build (port 3400)
```

## Next steps

1. Your visual review of the homepage (below the hero) and the eight Stage 1C pages. Comparison
   sheets are attached to the session.
2. On approval of 1C / 1C-V, continue with Stage 1D (service-detail pages), using the same visual
   system.
3. Publishing (`review` → `published`) stays with Stage 1J, as instructed.
