# RAWASY — Public Website (Phase 1)

Bilingual (English / Saudi Arabic) corporate website for **RAWASY UNITED INTERNATIONAL CO. LTD.**
(شركة رواسي المتحدة العالمية المحدودة): laser cutting, CNC bending, steel structures,
fabrication, laser engraving and scaffolding in Riyadh.

**Status: stages 1A (foundation) and 1B (homepage) are approved, and so is the Visual Redesign V2
pass over Stage 1C (core inner pages: about, services overview, industries, clients, certificates,
contact / quote, privacy, terms, plus the Projects overview brought forward from Stage 1F). Stage 1D,
the six service detail pages (laser cutting, CNC bending, steel structures, metal fabrication, laser
engraving, scaffolding), is built and awaits visual approval.** The remaining routes (project detail
pages, capabilities) are set up and localized, and show an "in development" page until their stage
is built and approved (see the approval gate in the Phase 1 brief).

**Development is paused for a theme exploration:** Modern Commerce directions are built in the
[theme lab](#theme-lab) for review. Option A was found closest to the target and is refined as
**A V2** (signature laser-cutting and laser-engraving illustrations, a fuller header, one motion
system), which awaits visual review. The current design stays live and unchanged until a theme is
approved.

| | |
| --- | --- |
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | Tailwind CSS v4 + semantic CSS tokens (`src/app/globals.css`) |
| Motion | GSAP 3 + ScrollTrigger (hero, scroll scenes), CSS/IntersectionObserver for reveals |
| Fonts | Sora (English display), Manrope (English text and UI), Noto Kufi Arabic (Arabic display), IBM Plex Sans Arabic (Arabic text), Geist Mono (technical labels), all self-hosted via `next/font` |
| Rendering | Static pages for every route in both languages (109 site pages + 16 theme-lab previews at build time) |

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /en or /ar
npm run build && npm start
npm run lint
npm run typecheck
npm run build && npm run test:e2e   # browser tests (Playwright, Chromium) against the production build
```

Optional environment variable: `NEXT_PUBLIC_SITE_URL` (canonical origin, default `https://www.rawasymetal.com`).

## Architecture

```
src/
  proxy.ts                 Locale negotiation: cookie → Accept-Language → /en
  app/
    [locale]/layout.tsx    Root layout: <html lang dir>, fonts, theme boot, header/footer
    [locale]/page.tsx      Homepage (13 sections)
    [locale]/…             about, services, services/[slug], capabilities, projects,
                           projects/[slug], industries, clients, certificates, contact,
                           privacy, terms, not-found, [...rest] (localized 404)
    global-not-found.tsx   Bilingual 404 fallback for anything outside the locale tree
    sitemap.ts robots.ts manifest.ts icon.svg apple-icon.png
  content/                 CMS-ready content (see below)
  i18n/                    Locale config, route map, UI dictionaries
  components/
    brand/                 Vector logo (from the official master artwork)
    layout/                Header, mobile menu, footer, language + theme controls, 404
    home/                  Homepage sections (hero plate, explorers, statement, …)
    inner/                 Inner-page system: hero variants, breadcrumbs, editorial section, media frame, CTA
    about/ services/ industries/ clients/ certificates/ contact/ legal/ projects/
                           Page-specific components for the stage 1C pages and the projects overview
    service/               Service detail pages (stage 1D): hero, scope, process, machines, applications,
                           gallery, why, related services, projects, CTA; `looks.ts` gives each service
                           its composition; `visuals/` holds the six hero drawings
    visual/                Visual system: technical frame, backdrops and scan line, section rule,
                           pointer light, nameplate
    motion/                Loader, reveal and live observers, custom cursor, page transition
    ui/                    Button, section header, image, icons
  lib/                     SEO helpers, inner-page metadata, theme engine, boot script, GSAP setup
e2e/                       Playwright browser tests (site shell + homepage, inner pages, V2, service pages)
scripts/
  extract-profile-assets.py  Pulls photos/logos/certificates out of the company profile PDF
  generate-og.mjs            Renders the EN/AR Open Graph images and Apple touch icon
docs/ASSET_INVENTORY.md      Asset sources, redactions and items awaiting confirmation
docs/reports/                Stage reports (latest: 2026-09-25, stage 1D service pages)
```

### Languages and RTL

- Every URL is language-prefixed and the two languages share paths (`/en/services/laser-cutting` ↔
  `/ar/services/laser-cutting`). The language switcher keeps visitors on the same page and
  remembers their choice in a cookie.
- Arabic sets `dir="rtl"` on `<html>`. Layouts use logical properties (`ms-`/`me-`/`start`/`end`),
  and direction-aware motion multiplies x-movement by the `--dir` CSS variable, so arrows, carousels,
  the process timeline, wipes and the laser-cut animation all mirror correctly.
- Arabic copy is written independently in professional Saudi business Arabic, not translated line
  by line.

### Content models (ready for the Phase 2 admin panel)

All copy and data live in `src/content/*` as typed, serialisable models with localized fields
(`Localized<T> = { en: T; ar: T }`): company, services, machines, projects, industries, clients,
certificates, pillars, metrics, process, navigation, SEO and homepage copy. Pages read content only
through the async functions in `src/content/repository.ts`, so the admin panel can replace the storage
without changing any components. Unknown facts (client, year, location, materials…) are optional
fields and are simply not shown. Nothing has been made up to fill them.

`src/lib/page-meta.ts` is the approval gate. Each route is `planned` (shows the in-development page),
`review` (built, awaiting approval) or `published`. Only published routes are indexed and listed in
the sitemap (currently the homepage); `planned` and `review` routes are served with `noindex`. When a
stage is approved, set its routes to `published`. The stage 1C routes, the projects overview and
the stage 1D service pages are `review`; publishing waits for the Stage 1J launch approval.

### Theme engine

Semantic tokens (`--background`, `--surface`, `--surface-elevated`, `--text-primary`, `--border`,
`--accent`, …) are defined once for light and once for dark. Components never duplicate styles
per theme. An inline boot script applies the stored or OS theme before first paint (no flash), the
choice persists in `localStorage`, and the page keeps following the OS until the visitor picks a
theme. Where supported, switching themes reveals the new theme with a circular wipe.

### Visual system

Precision engineering, metal fabrication and architectural detail: layered metal plates with visible
edges and shadows, colourful but controlled. Since V2 the palette has semantic roles, set on any
card, chip or tag with `data-tone` (`--tone`, `--tone-ink`, `--tone-surface`, `--tone-line`):

| Role | Colour | Used for |
| --- | --- | --- |
| `brand` | RAWASY orange `#F15F22` | primary actions, active states, key indicators |
| `eng` | steel blue `#355C70 / #416F82` | engineering, machinery, information surfaces |
| `proc` | industrial teal `#39766F` | process, capability, site support |
| `craft` | brass `#A98549 / #BEA069` | craftsmanship, certificates, premium details |
| slate / graphite | `#34434A`, `#1E2123` | dark bands and structured panels |

Each role has an ink colour for small text (AA on its surfaces, tested in both themes). Tokens:
borders `--border-subtle / --border / --border-strong / --border-ink` plus `--border-active` and
steel, teal and brass edges; shadows `--shadow-card / --shadow-raised / --shadow-image /
--shadow-floating / --shadow-inset` (older names are aliases). Section surfaces: `.sec-eng`,
`.sec-proc`, `.sec-craft` (tinted), `.sec-deep` (recessed) and `.sec-slate` (dark band). Cards:
`.card`, `.card-edge` (a 3px top edge in the tone), `.card-link` (lifts on hover and focus) and
`.card-arrow`; `.icon-chip`, `.tone-tag` and `.tone-ink`. Buttons: primary (orange), `secondary`
(graphite, steel on hover), `steel` and `teal` (contextual), `outline`.

Reusable pieces:

- `src/components/ui/LineIcons.tsx`: industrial line icons (services, site support, process,
  company) on a 32-unit grid, always decorative.
- `src/components/cards/`: `ServiceCard` (a service line as a card, optional photo and scope tags)
  and `SupportList` (site-support tiles).
- `src/components/visual/`: `TechnicalFrame` / `FrameMarks`, `Backdrop` (grid, fine grid,
  perforated; optionally drifting), `ScanLine`, `SectionRule`, `PointerLight`, `Nameplate`.
- `MediaFrame` (in `inner/`) is the image frame, never wider than the source image.
- Projects (`src/components/projects/`): hero collage, featured project, highlights, a filterable
  masonry gallery (`ProjectFilter` + view transitions) and a text index; `src/lib/project-cards.ts`
  chooses a card layout per project that respects the small source photos.
- Clients: `ClientWall` with `src/lib/logo-wall.ts` (plans double-width cells per breakpoint so every
  row is full; no numbers or counts).
- Contact: `LocationSection` with `src/lib/maps.ts` (a keyless Google Maps embed and directions link
  built from the verified address; no coordinates are stored).
- Service pages (`src/components/service/`): one set of components, composed per service by
  `looks.ts` (hero drawing, scope layout, process layout, gallery layout and the sequence of section
  surfaces). Laser cutting: steel blue and orange, a nesting sheet with the cut path. CNC bending: a
  press-brake elevation with fold lines. Steel structures: a slate drawing sheet with structural axes.
  Metal fabrication: brass and graphite, workshop photos on a bench plate. Laser engraving: an engraved
  brass plate and material swatches (no authentic engraving photo yet). Scaffolding: teal, a tower
  elevation drawn lift by lift. Copy is in `src/content/service-details.ts` and `servicePage` in
  `pages.ts`; sections without sourced content (machines, projects, gallery) are left out.

Decoration is always `aria-hidden`. Ambient motion runs only while on screen and never with reduced
motion; it animates transform and opacity only.

### Motion

- **Hero:** a brushed steel plate that the laser cuts in sequence (bolt holes, an eight-point
  star, a slot and a perforation field), with sparks, engineering dimensions, a CNC crosshair, a
  cursor-reactive reflection and scroll parallax.
- **Signature metal cut** (used once): a laser line runs through the statement "Precision in every
  cut. Strength in every structure." as you scroll, and the lettering splits along the cut.
- Line-mask headline reveals, curtain image reveals, structural line drawing (paths read an
  inherited `--draw` set on the revealed element), a production-line
  progress rail, a direction-aware machinery stage with a scan sweep, count-up metrics, and a
  slow client marquee.
- Visual system motion: frames draw in (horizontal, then vertical) with a marker running the top edge,
  image masks wipe in the reading direction, section rules draw, active rows light their edge, the
  services explorer runs a cutting line with its wipe, grids drift and scan lines pass slowly while
  on screen, and a pointer light follows the mouse on selected plates.
- **Reduced motion:** the intro, parallax, cursor tracking, page transitions and continuous motion
  (grid drift, scan lines, pointer light, travelling markers) are turned off, leaving simple fades
  and fully drawn frames. Without JavaScript, all content is visible.

### SEO

Each page has a localized title and description, a canonical URL, `hreflang` alternates (en, ar,
x-default), Open Graph and Twitter tags with EN/AR share images, and JSON-LD: Organization +
LocalBusiness + WebSite on the homepage, about and contact pages; a WebPage node (AboutPage,
CollectionPage or ContactPage where it fits) and a BreadcrumbList on every inner page; Service on
service routes. `sitemap.xml` includes language alternates.

### Quote form

The contact page's quote form has no delivery backend yet. It validates in the browser (with
accessible error messages in both languages), then prepares the request for the visitor to send
from their own email app or WhatsApp, or to copy. Drawings stay on the visitor's device and are
attached when they send. Nothing is uploaded, sent or stored by the website, and the page says so.
Without JavaScript the form falls back to a plain `mailto:` submission. Connecting an online
submission service (with storage, spam protection and a privacy-policy update) is a later decision.

### 404 behaviour

Unknown URLs are sent to the visitor's language and render **"Outside the blueprint" / "خارج
المخطط"** inside the site's header and footer, with a real HTTP 404 status. If the 404 comes from a
page during a dynamic render, Next.js 16 builds that page in the browser. `BootFallback` then
reapplies the theme and motion settings, so it still matches the rest of the site.

## Theme lab

Isolated Modern Commerce explorations of the homepage, each with a design-system sheet, in English
and Arabic (light theme). A V2 refines A; A stays for side-by-side comparison:

| Option | Homepage | Design system |
| --- | --- | --- |
| A · Clean Premium Commerce | `/theme-lab/en/modern-commerce-a` | `/theme-lab/en/modern-commerce-a/system` |
| **A V2 · Clean Premium Commerce, refined** | `/theme-lab/en/modern-commerce-a-v2` | `/theme-lab/en/modern-commerce-a-v2/system` |
| B · Bold Industrial Commerce | `/theme-lab/en/modern-commerce-b` | `/theme-lab/en/modern-commerce-b/system` |
| C · Minimal Luxury Commerce | `/theme-lab/en/modern-commerce-c` | `/theme-lab/en/modern-commerce-c/system` |

Replace `en` with `ar` for Arabic; `/theme-lab` redirects to A V2. The lab has its own root layout
and stylesheet (`src/app/theme-lab/`, `src/components/theme-lab/`), reuses the content layer, is
`noindex` (meta and `X-Robots-Tag`), and never appears in the sitemap or the site navigation. The
dark bar at the top of each preview switches option, view and language; links in the previews open
the current site. The signature illustrations live in `src/components/theme-lab/signature/` (SVG and
the Web Animations API, reusable on later pages). See `docs/reports/2026-09-25-modern-commerce-theme-lab.md`
and `docs/reports/2026-09-25-modern-commerce-a-v2.md`.

## Assets

`npm run assets:extract -- <company-profile.pdf>` regenerates `public/media/**` and
`src/content/media.generated.ts` (intrinsic sizes + blur placeholders). The supplied profile is a
low-resolution export, so photos are shown close to their native size. Replace them with the original
photography (same file names) before launch. See **[docs/ASSET_INVENTORY.md](docs/ASSET_INVENTORY.md)**
for provenance, certificate redactions and the list of facts and images RAWASY needs to confirm.

`npm run assets:og` regenerates the share images. It needs Playwright/Chromium; behind an HTTPS
proxy, prefix it with `NODE_USE_ENV_PROXY=1`.

## Testing

`npm run test:e2e` runs the Playwright suites in `e2e/` against the production build (it starts
`next start` on port 3400, or set `E2E_BASE_URL`). `site.spec.ts` covers the shell and homepage
(loader, theme, language switching, mobile menu, explorers, transitions, reduced motion, no-JS,
internal links); `stage-1c.spec.ts` covers the inner pages (routes, language and direction, SEO and
the noindex gate, breadcrumbs, clients, certificate dialog, quote form, legal pages, 404, overflow at
360/390/834 px, keyboard, reduced motion, no-JS); `visual-system.spec.ts` covers the visual system
(ambient motion only on screen, reduced motion and touch, active rows and contents, focus frames,
decoration hidden from assistive technology); `redesign-v2.spec.ts` covers the V2 pass (projects
filters and grid, clients wall without numbering, contact map, fonts, colour-role contrast in both
themes, responsive layouts, reduced motion, keyboard); `service-pages.spec.ts` covers the six service
pages (routes in both languages, SEO and the noindex gate, sourced machine / project / related links,
the quote action, imagery rules, RTL, dark theme, overflow at 360/390/834 px, keyboard, reduced
motion, no-JS); `theme-lab.spec.ts` covers the theme lab (isolation from the site CSS, noindex and
redirects, sitemap and navigation, sections, typefaces per option, flagged photos, card link overlays,
overflow from 360 to 1280 px, no-JS, reduced motion); `theme-lab-a-v2.spec.ts` covers A V2 (header
and Services menu, scroll-spy, phone menu sheet, EN/AR mirroring, industries by source, the machinery
selector, the client colour switch, both signature animations and their replays, parallax and ambient
light, reduced motion, keyboard, no-JS, sheet overflow). In a cloud session Chromium is preinstalled at
`/opt/pw-browsers`; elsewhere run `npx playwright install chromium` once.

## Next stages

1E capabilities and machinery page · 1F project detail pages (the projects overview was built in
V2) · 1G (its clients,
certificates and contact pages moved into 1C) · 1H Arabic completion · 1I motion polish ·
1J SEO/performance QA and release. Phase 2 (admin panel) follows Phase 1 approval.
