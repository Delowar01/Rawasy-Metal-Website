# RAWASY — Public Website (Phase 1)

Bilingual (English / Saudi Arabic) corporate website for **RAWASY UNITED INTERNATIONAL CO. LTD.**
(شركة رواسي المتحدة العالمية المحدودة): laser cutting, CNC bending, steel structures,
fabrication, laser engraving and scaffolding in Riyadh.

**Status: stages 1A (foundation) and 1B (homepage) are approved. Stage 1C (core inner pages:
about, services overview, industries, clients, certificates, contact / quote, privacy, terms) is
built and awaiting design approval.** The remaining routes (service and project detail pages,
capabilities, projects) are set up and localized, and show an "in development" page until their
stage is built and approved (see the approval gate in the Phase 1 brief).

| | |
| --- | --- |
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | Tailwind CSS v4 + semantic CSS tokens (`src/app/globals.css`) |
| Motion | GSAP 3 + ScrollTrigger (hero, scroll scenes), CSS/IntersectionObserver for reveals |
| Fonts | Archivo (English), Noto Kufi Arabic (Arabic display), IBM Plex Sans Arabic (Arabic body), Geist Mono, all via `next/font` |
| Rendering | Static pages for every route in both languages (109 pages at build time) |

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
    about/ services/ industries/ clients/ certificates/ contact/ legal/
                           Page-specific components for the stage 1C pages
    motion/                Loader, reveal observer, custom cursor, page transition
    ui/                    Button, section header, image, icons
  lib/                     SEO helpers, inner-page metadata, theme engine, boot script, GSAP setup
e2e/                       Playwright browser tests (site shell + homepage, stage 1C pages)
scripts/
  extract-profile-assets.py  Pulls photos/logos/certificates out of the company profile PDF
  generate-og.mjs            Renders the EN/AR Open Graph images and Apple touch icon
docs/ASSET_INVENTORY.md      Asset sources, redactions and items awaiting confirmation
docs/reports/                Stage reports (latest: 2026-09-24, stage 1C core inner pages)
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
stage is approved, set its routes to `published`. The stage 1C routes are `review`.

### Theme engine

Semantic tokens (`--background`, `--surface`, `--surface-elevated`, `--text-primary`, `--border`,
`--accent`, …) are defined once for light and once for dark. Components never duplicate styles
per theme. An inline boot script applies the stored or OS theme before first paint (no flash), the
choice persists in `localStorage`, and the page keeps following the OS until the visitor picks a
theme. Where supported, switching themes reveals the new theme with a circular wipe.

### Motion

- **Hero:** a brushed steel plate that the laser cuts in sequence (bolt holes, an eight-point
  star, a slot and a perforation field), with sparks, engineering dimensions, a CNC crosshair, a
  cursor-reactive reflection and scroll parallax.
- **Signature metal cut** (used once): a laser line runs through the statement "Precision in every
  cut. Strength in every structure." as you scroll, and the lettering splits along the cut.
- Line-mask headline reveals, curtain image reveals, structural line drawing, a production-line
  progress rail, a direction-aware machinery stage with a scan sweep, count-up metrics, and a
  slow client marquee.
- **Reduced motion:** the intro, parallax, cursor tracking, page transitions and continuous motion are
  turned off, leaving simple fades. Without JavaScript, all content is visible.

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
360/390/834 px, keyboard, reduced motion, no-JS). In a cloud session Chromium is preinstalled at
`/opt/pw-browsers`; elsewhere run `npx playwright install chromium` once.

## Next stages

1D service pages · 1E machinery explorer page · 1F projects and gallery · 1G (its clients,
certificates and contact pages moved into 1C) · 1H Arabic completion · 1I motion polish ·
1J SEO/performance QA and release. Phase 2 (admin panel) follows Phase 1 approval.
