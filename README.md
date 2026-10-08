# RAWASY — Public Website (Phase 1)

Bilingual (English / Saudi Arabic) corporate website for **RAWASY UNITED INTERNATIONAL CO. LTD.**
(شركة رواسي المتحدة العالمية المحدودة): laser cutting, CNC bending, steel structures,
fabrication, laser engraving and scaffolding in Riyadh.

**Status:** the website runs one design, **Modern Commerce** (the approved A V2 direction from the
[theme lab](#design-origin), retired in Stage 1J): the website's laser-cut plate as the hero, cutting on a 10 s loop, signature
laser-cutting and laser-engraving animations built on the service pages' own nesting sheet and engraved plate,
light and dark themes, a precision pointer and a site-wide ambient background. It was migrated page by page
(Stage TM-1: the homepage; TM-2.1–TM-2.5: the legal pages and the localized 404, contact, about, industries,
clients, certificates, the services overview and the six service pages, the projects overview) and the previous
design was retired in TM-2.6. Capabilities & Machinery was built in Stage 1E: the six machines of the company
profile in a machinery console (a selector and a graphite equipment stage, each machine at `/capabilities#<slug>`),
a rated-power chart and a technical register, with no specification the profile does not give. The project pages
were built in Stage 1F: one page per project record (34, in both languages), showing only what the record holds — the
title, the summary, the website's classifications, the related services, the gallery reference in the company profile
and the photos that may be shown (none for a project whose authorship or product ownership is still to be confirmed,
never a withheld file). Stage 1I polished the motion into one system without changing a page at rest: live
reduced-motion and forced-colours handling, nothing animating unseen, keyboard focus showing what hover shows; its
correction 1 keeps every word at full strength while the Capabilities console changes machine and while the
certificate dialog opens and closes (only photos, lines and the backdrop fade), and its correction 2 does the same for
the homepage machinery, the scroll reveals, the homepage entrance, the Services dropdown, the phone menu and the
homepage project cards' label (words show whole and move; only photos, logos and drawings fade); correction 3 makes the
Projects filter toggles and the certificate previews' open indicator (a plus icon) swap their colours at once instead of
blending through low contrast. Every
page except the homepage is `review` (noindex); publishing waits for the Stage 1J launch approval.

| | |
| --- | --- |
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | Tailwind CSS v4 + semantic CSS tokens: `src/app/(commerce)/commerce.css` + `src/components/commerce/system.css`, page stylesheets beside their components (`services.css`, `projects.css`, `capabilities.css`, `project-detail.css`) |
| Motion | CSS transitions and the Web Animations API (hero plate, signatures), IntersectionObserver for reveals; no animation library |
| Fonts | Plus Jakarta Sans (English display), Inter (English text), Tajawal (Arabic display), IBM Plex Sans Arabic (Arabic text), the system monospace stack for technical figures. All self-hosted via `next/font` |
| Rendering | Static pages for every route in both languages (109 generated at build time) |

## Getting started

Tested with **Node.js 22.22.2** and **npm 10.9.7** (`.nvmrc`); other versions were not tested.

```bash
npm ci               # the exact dependency tree of package-lock.json (npm install also works)
npm run dev          # http://localhost:3000 → redirects to /en or /ar
npm run build && npm start
npm run lint
npm run typecheck
npm run build && npm run test:e2e   # browser tests (Playwright, Chromium) against the production build
```

Optional environment variable: `NEXT_PUBLIC_SITE_URL`, the public origin used in canonical URLs, alternates, share tags,
structured data, the sitemap and robots.txt (default `https://www.rawasymetal.com`; read at build time). See
`.env.example`; no other variable, key or secret is needed.

### On Windows

In PowerShell, call npm through its `.cmd` shim (the default execution policy can block `npm.ps1`); Command Prompt
works the same way. (The project's own checks run on Linux; these are the standard npm commands, not run on Windows
in this project's QA.)

```powershell
npm.cmd ci
npm.cmd run dev          # http://localhost:3000
npm.cmd run build
npm.cmd start            # serves the build on http://localhost:3000
```

If `next dev` or a build fails after switching branches, after an interrupted build or with an error about a missing
module or route type under `.next` (a stale build folder), stop every running `next` process, delete `.next` and build
again:

```powershell
Remove-Item -Recurse -Force .next      # PowerShell (Command Prompt: rmdir /s /q .next)
npm.cmd run build
```

## Architecture

```
src/
  proxy.ts                 Locale negotiation: cookie → Accept-Language → /en
  app/
    (commerce)/[locale]/   The website's root layout (stylesheet, fonts, theme boot, ambient, pointer, motion
                           controller) and every page: home, about, services, services/[slug], capabilities,
                           projects, projects/[slug], industries, clients, certificates, contact, privacy,
                           terms; (missing)/ holds the localized 404 and its catch-all
    global-not-found.tsx   Bilingual fallback 404 for anything outside the locale tree (own stylesheet and faces)
    sitemap.ts robots.ts manifest.ts icon.svg apple-icon.png
  content/                 CMS-ready content (see below)
  i18n/                    Locale config, route map, UI dictionaries
  components/
    brand/                 Vector logo (from the official master artwork)
    commerce/              The Modern Commerce design: shell (header, phone menu sheet, footer), homepage
                           sections, inner-page kit (`inner/`), the pages' components (about, services,
                           capabilities, projects, project-detail, industries, clients, certificates, contact,
                           legal), hero
                           plate, signature illustrations, ambient, pointer, theme switch, motion
    home/hero/             The hero plate's geometry
    service/visuals/       The nesting sheet's and engraved plate's geometry (shared by the signatures)
    projects/types.ts      Project card types (src/lib/project-cards.ts)
  lib/                     SEO helpers, inner-page metadata, page states, project cards, logo wall, maps,
                           scroll spy, the boot script
e2e/                       Playwright browser tests (pages, site-wide checks)
scripts/
  extract-profile-assets.py  Pulls photos/logos/certificates out of the company profile PDF
  generate-og.mjs            Renders the EN/AR Open Graph images from the built homepage (and the Apple touch icon)
docs/ASSET_INVENTORY.md      Asset sources, redactions and items awaiting confirmation
docs/reports/                Stage reports (latest: 2026-10-08, Stage 1I correction 3)
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

`src/lib/page-meta.ts` is the approval gate. Each route is `planned` (routed, not built yet), `review` (built,
awaiting approval) or `published`. Only published routes are indexed and listed in the sitemap (currently the
homepage); `planned` and `review` routes are served with `noindex, follow`. When a stage is approved, set its routes to
`published`. The inner pages, the projects overview, the service pages, Capabilities and the project pages are
`review` (no route is `planned` any more); publishing waits for the Stage 1J launch approval.

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
- Reveals on scroll (once each; a phone's sideways rail shows its cards together), the site-wide ambient
  (micro-dots and one periodic light sweep, resting while the page scrolls or is hidden), and a precision pointer
  for a desktop mouse.
- Nothing runs unseen: the hero loop, the signatures, the console's scans and the hot points rest off screen and
  while the page is hidden. Keyboard focus shows what hover shows. Interface transitions take their durations from
  four tokens (180 / 320 / 600 / 900 ms); the projects filter moves only the cards (a view transition without a
  full-page capture).
- **Reduced motion:** the finished plate and signatures at once, no loop, a still background and the system
  pointer — also when it is turned on while a page is open. Without JavaScript, all content is visible.

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

## Design origin

The Modern Commerce design was chosen in a theme lab: three isolated explorations of the homepage (A, B and C), then
A V2, the approved refinement of A (reports `docs/reports/2026-09-25-modern-commerce-theme-lab.md`,
`2026-09-25-modern-commerce-a-v2.md`, `2026-09-25-a-v2-signature-correction.md`, `2026-09-26-a-v2-refinement-pass-2.md`,
`2026-09-27-a-v2-background-motion.md`, `2026-09-28-a-v2-background-optimization.md`, `2026-09-28-a-v2-hero-loop.md` and
`2026-09-28-tm1-homepage-migration.md`). A V2's components moved to `src/components/commerce/` in Stage TM-1 and the lab
was retired in Stage 1J: `/theme-lab/…` addresses now get the localized 404. The signature illustrations
(`src/components/commerce/signature/`, SVG and the Web Animations API) animate the Laser Cutting and Laser Engraving
pages' drawings, whose geometry is shared through `src/components/service/visuals/nesting-sheet.ts` and
`engraved-plate.ts`. The hero plate (`src/components/commerce/hero/HeroPlate.tsx`) draws the website's plate from
`src/components/home/hero/plate-geometry.ts`; its cut repeats every 10 s while it is on screen (about 5 s of cutting, the
finished plate held, then a quick reset). The site-wide background (`src/components/commerce/Ambient.tsx`) is fixed
behind every section: one opaque surface (page colour, micro-dots and colour) and a band of light on the dot grid, moved
on the compositor in whole-pixel steps, kept out from under text by reading zones and near-opaque sheets, resting while
the page scrolls and still with reduced motion.

## Assets

`npm run assets:extract -- <company-profile.pdf>` regenerates `public/media/**` and
`src/content/media.generated.ts` (intrinsic sizes + blur placeholders). The supplied profile is a
low-resolution export, so photos are shown close to their native size. Replace them with the original
photography (same file names) before launch. See **[docs/ASSET_INVENTORY.md](docs/ASSET_INVENTORY.md)**
for provenance, certificate redactions and the list of facts and images RAWASY needs to confirm.

`npm run assets:og` regenerates the share images (`public/og/og-en.png`, `og-ar.png`, 1200 × 630) in the Modern Commerce
design. It draws each card inside the website's own homepage, so it needs the production build being served (`npm run
build && npm start`, or pass another address: `node scripts/generate-og.mjs http://localhost:3400`), Playwright's
Chromium and Node.js 22.18 or later (it reads the content modules with Node's TypeScript support). The cards use the
site's stylesheet, self-hosted faces, logo and hero plate, and the hero's own words; the script checks the faces, the
safe area, the direction and that no request leaves the site before it writes a file. `--out=<folder>` writes the cards
elsewhere for review; `--icon` also renders `src/app/apple-icon.png` from `src/app/icon.svg`.

## Testing

`npm run test:e2e` runs the Playwright suites in `e2e/` against the production build (it starts
`next start` on port 3400, or set `E2E_BASE_URL`): `commerce-home.spec.ts` (the homepage: sections, its
stylesheet and typefaces, the header, quote actions, project cards, language and theme, the 10 s hero loop, the
signatures, the ambient, the pointer, keyboard, reduced motion, no-JS, search metadata), `commerce-inner.spec.ts`
(the inner-page kit, Privacy, Terms, the localized 404 and its HTTP status matrix), `commerce-contact.spec.ts`
(Contact, with the quote form's golden outputs), `commerce-company.spec.ts` (About, Industries, Clients),
`commerce-certificates.spec.ts` (the redacted files, the register and the dialog), `commerce-services.spec.ts` (the
services overview and the six service pages), `commerce-projects.spec.ts` (the projects overview, its anchors and
filters), `commerce-capabilities.spec.ts` (Capabilities & Machinery: the six machines and their sources, the
power rule and a guard against unstated specifications, the photos' source size, the console, the 12 cold machine
addresses with late fonts, every machine link from the homepage and the service pages, the language switch keeping
the machine, a 20-cycle stress test, reduced motion, forced colours, no-JS, twelve screen sizes),
`commerce-project-detail.spec.ts` (the 34 project pages in both languages: the record's parts and nothing else, the
photo rule by flag, no withheld or held-back file in any page or its page data, no internal note or flag, search
metadata and structured data, photos never above their source size, Arabic, themes, forced colours, twelve sizes,
no-JS, an unknown project),
`commerce-polish.spec.ts` (the forced-colours switch, logo and header marks, the inner pages' hero shown with the first
paint, the phone menu sheet's geometry and keyboard order, the homepage's Industries cards at every width),
`commerce-motion.spec.ts` (the motion system: reduced motion from the start and turned on mid-visit, nothing left
running off screen or while hidden, reveals, keyboard focus equal to hover, twenty quick cycles of the menu,
dropdown, filters, clients switch and certificate dialog), `commerce-motion-contrast.spec.ts` (the Capabilities and
homepage machine changes, the certificate dialog, the scroll reveals, the homepage entrance, the Services dropdown, the
phone menu and the project cards' label held part-way: axe-core, full opacity and per-pixel AA contrast in every held
frame), `commerce-anchors.spec.ts` (first jumps to an address's
anchor with late fonts), `site.spec.ts` (internal links,
nothing of the previous design on any page, which addresses reach which 404, the fallback 404 and its logo in forced
colours),
`stage-1c.spec.ts` (generic inner-page checks: routes, SEO and the noindex gate, breadcrumbs, overflow, keyboard,
reduced motion, no-JS) and `commerce-home-depth.spec.ts` (the homepage in depth: the signatures, the hero plate's loop,
the pointer, the themes' contrast and the background motion; it took over the retired lab's A V2 checks). In a cloud
session
Chromium is preinstalled at `/opt/pw-browsers`; elsewhere run `npx playwright install chromium` once.

## Next stages

1I motion and interaction polish built, its corrections 1 and 2 approved and correction 3 in review (1F, the project
pages, is approved; 1G and 1H needed no
batch: their pages and the Arabic site were already built) · 1J SEO/performance QA and release. Phase 2 (admin
panel) follows Phase 1 approval.
