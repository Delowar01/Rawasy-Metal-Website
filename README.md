# RAWASY — Public Website (Phase 1)

Bilingual (English / Saudi Arabic) corporate website for **RAWASY UNITED INTERNATIONAL CO. LTD.**
(شركة رواسي المتحدة العالمية المحدودة): laser cutting, CNC bending, steel structures,
fabrication, laser engraving and scaffolding in Riyadh.

**Status:** the website runs one design, **Modern Commerce** (the approved A V2 direction from the
[theme lab](#theme-lab)): the website's laser-cut plate as the hero, cutting on a 10 s loop, signature
laser-cutting and laser-engraving animations built on the service pages' own nesting sheet and engraved plate,
light and dark themes, a precision pointer and a site-wide ambient background. It was migrated page by page
(Stage TM-1: the homepage; TM-2.1–TM-2.5: the legal pages and the localized 404, contact, about, industries,
clients, certificates, the services overview and the six service pages, the projects overview) and the previous
design was retired in TM-2.6. Capabilities (Stage 1E) and the project detail pages (Stage 1F) are routed and
localized and show an "in development" page until their stage is built and approved. Every page except the
homepage is `review` or `planned` (noindex); publishing waits for the Stage 1J launch approval.

| | |
| --- | --- |
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | Tailwind CSS v4 + semantic CSS tokens: `src/app/(commerce)/commerce.css` + `src/components/commerce/system.css`, page stylesheets beside their components (`services.css`, `projects.css`, `planned.css`) |
| Motion | CSS transitions and the Web Animations API (hero plate, signatures), IntersectionObserver for reveals; no animation library |
| Fonts | Plus Jakarta Sans (English display), Inter (English text), Tajawal (Arabic display), IBM Plex Sans Arabic (Arabic text), the system monospace stack for technical figures. All self-hosted via `next/font` |
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
  proxy.ts                 Locale negotiation: cookie → Accept-Language → /en; theme-lab redirects
  app/
    (commerce)/[locale]/   The website's root layout (stylesheet, fonts, theme boot, ambient, pointer, motion
                           controller) and every page: home, about, services, services/[slug], capabilities,
                           projects, projects/[slug], industries, clients, certificates, contact, privacy,
                           terms; (missing)/ holds the localized 404 and its catch-all
    global-not-found.tsx   Bilingual fallback 404 for anything outside the locale tree (own stylesheet and faces)
    theme-lab/[locale]/    The theme lab's own root layout and previews (noindex)
    sitemap.ts robots.ts manifest.ts icon.svg apple-icon.png
  content/                 CMS-ready content (see below)
  i18n/                    Locale config, route map, UI dictionaries
  components/
    brand/                 Vector logo (from the official master artwork)
    commerce/              The Modern Commerce design: shell (header, phone menu sheet, footer), homepage
                           sections, inner-page kit (`inner/`), the pages' components (about, services,
                           projects, industries, clients, certificates, contact, legal, planned), hero
                           plate, signature illustrations, ambient, pointer, theme switch, motion (shared
                           with the theme lab's A V2, which re-exports them)
    home/hero/             The hero plate's geometry
    service/visuals/       The nesting sheet's and engraved plate's geometry (shared by the signatures)
    projects/types.ts      Project card types (src/lib/project-cards.ts)
    theme-lab/             The theme lab's options A, A V2, B and C
  lib/                     SEO helpers, inner-page metadata, page states, project cards, logo wall, maps,
                           scroll spy, the boot script
e2e/                       Playwright browser tests (pages, site-wide checks, theme lab)
scripts/
  extract-profile-assets.py  Pulls photos/logos/certificates out of the company profile PDF
  generate-og.mjs            Renders the EN/AR Open Graph images and Apple touch icon
docs/ASSET_INVENTORY.md      Asset sources, redactions and items awaiting confirmation
docs/reports/                Stage reports (latest: 2026-10-02, Stage TM-3 correction 1)
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
the sitemap (currently the homepage); `planned` and `review` routes are served with `noindex, follow`. When a
stage is approved, set its routes to `published`. The inner pages, the projects overview and the service pages
are `review`, Capabilities and the project pages `planned`; publishing waits for the Stage 1J launch approval.

### Theme engine

Semantic tokens (`--bg`, `--surface`, `--ink`, `--line`, `--brand`, the steel, teal and brass tones …) are defined
once in `src/components/commerce/system.css`, scoped to `.mc` on `<body>`, and redefined for the dark theme
(blue-charcoal, never black) under `html[data-theme="dark"]`. An inline boot script (`src/lib/commerce-boot.ts`)
applies the stored or system theme before the first paint, the choice persists in `localStorage`
(`rawasy-theme`), and the page follows the system until the visitor picks a theme. Without JavaScript the page is
light.

### Visual system

A bright commercial system for an industrial company: off-white raised cards on a soft warm mist, visible borders,
layered shadows with a lit top edge, orange actions and steel / teal / brass accents set with `data-tone`, never a
rainbow. Sections alternate open areas (text on reading zones) with muted and raised sheets. The service pages
draw their character from their own pictures: the two signature animations (Laser Cutting's nesting sheet, Laser
Engraving's brass plate) and four restyled drawings. Photos are never shown above their source size. Decoration is
always `aria-hidden`.

### Motion

- **Hero:** the website's laser-cut plate, cut in sequence (bolt holes, a star, a slot, the perforation rows)
  with its measurements and readout, repeating every 10 s while on screen and the page is visible.
- **Signatures:** the laser cutting of the nesting sheet and the engraving of the brass plate, once in view and
  again on hover or focus.
- Reveals on scroll, the site-wide ambient (micro-dots and one periodic light sweep, resting while the page
  scrolls), and a precision pointer for a desktop mouse.
- **Reduced motion:** the finished plate and signatures at once, no loop, a still background and the system
  pointer. Without JavaScript, all content is visible.

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
المخطط"** inside the site's header and footer, with a real HTTP 404 status; so do unknown service and project
slugs. If the 404 comes from a page during a dynamic render, Next.js 16 builds that page in the browser.
`BootFallback` then reapplies the theme and the script-only controls and restores the title. The bilingual
fallback 404 (`global-not-found.tsx`) is built as `/_not-found`; the proxy's excluded paths (`/api/…`,
`/media/…`, `/_next/…`) still get Next.js's own minimal 404.

## Theme lab

Isolated Modern Commerce explorations of the homepage, each with a design-system sheet, in English
and Arabic (light theme; A V2 also dark, from the header switch or `?theme=dark`). A V2 refines A; A
stays for side-by-side comparison:

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
the current site. A V2 was approved and its components moved to `src/components/commerce/` in Stage TM-1
(the lab's files re-export them, so the lab and the homepage run the same code). The signature
illustrations live in `src/components/commerce/signature/` (SVG and
the Web Animations API, reusable on later pages); they animate the Laser Cutting and Laser Engraving
pages' drawings, whose geometry is shared through `src/components/service/visuals/nesting-sheet.ts`
and `engraved-plate.ts`. A V2's hero plate (`src/components/commerce/hero/HeroPlate.tsx`) redraws the
website hero's plate from `src/components/home/hero/plate-geometry.ts`; its cut repeats every 10 s while it is on
screen (about 5 s of cutting, the finished plate held, then a quick reset). Its site-wide background
(`src/components/commerce/Ambient.tsx`) is fixed behind every section: one opaque surface (page colour,
micro-dots and colour) and a band of light on the dot grid, moved on the compositor in whole-pixel steps, kept out
from under text by reading zones and near-opaque sheets, resting while the page scrolls and still with reduced
motion. See `docs/reports/2026-09-25-modern-commerce-theme-lab.md`,
`docs/reports/2026-09-25-modern-commerce-a-v2.md`, `docs/reports/2026-09-25-a-v2-signature-correction.md`,
`docs/reports/2026-09-26-a-v2-refinement-pass-2.md`, `docs/reports/2026-09-27-a-v2-background-motion.md` and
`docs/reports/2026-09-28-a-v2-background-optimization.md`, `docs/reports/2026-09-28-a-v2-hero-loop.md` and
`docs/reports/2026-09-28-tm1-homepage-migration.md`.

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
`next start` on port 3400, or set `E2E_BASE_URL`): `commerce-home.spec.ts` (the homepage: sections, its
stylesheet and typefaces, the header, quote actions, project cards, language and theme, the 10 s hero loop, the
signatures, the ambient, the pointer, keyboard, reduced motion, no-JS, search metadata), `commerce-inner.spec.ts`
(the inner-page kit, Privacy, Terms, the localized 404 and its HTTP status matrix), `commerce-contact.spec.ts`
(Contact, with the quote form's golden outputs), `commerce-company.spec.ts` (About, Industries, Clients),
`commerce-certificates.spec.ts` (the redacted files, the register and the dialog), `commerce-services.spec.ts` (the
services overview and the six service pages), `commerce-projects.spec.ts` (the projects overview, its anchors and
filters), `commerce-planned.spec.ts` (Capabilities, the 34 project pages with no project media, an unknown project),
`commerce-polish.spec.ts` (the forced-colours switch, logo and header marks, the inner pages' hero shown with the first
paint, the phone menu sheet's geometry and keyboard order, the homepage's Industries cards at 320 px),
`commerce-anchors.spec.ts` (first jumps to an address's anchor with late fonts), `site.spec.ts` (internal links,
nothing of the previous design on any page, which addresses reach which 404, the fallback 404 and its logo in forced
colours),
`stage-1c.spec.ts` (generic inner-page checks: routes, SEO and the noindex gate, breadcrumbs, overflow, keyboard,
reduced motion, no-JS) and `theme-lab.spec.ts` / `theme-lab-a-v2.spec.ts` (the theme lab). In a cloud session
Chromium is preinstalled at `/opt/pw-browsers`; elsewhere run `npx playwright install chromium` once.

## Next stages

1E capabilities and machinery page · 1F project detail pages (the projects overview was built in
V2) · 1G (its clients,
certificates and contact pages moved into 1C) · 1H Arabic completion · 1I motion polish ·
1J SEO/performance QA and release. Phase 2 (admin panel) follows Phase 1 approval.
