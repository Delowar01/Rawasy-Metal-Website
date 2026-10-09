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
blending through low contrast. Stage 1J prepared the release candidate: Next.js 16.3.8 (security patch), the Arabic
faces preloaded on Arabic pages only, the theme and page changes made without a fade, keyboard focus kept whole inside
sideways rows, the share images regenerated, the theme lab retired and **every page `published`** (indexable, in the
sitemap). It awaits the release approval; nothing is deployed.

| | |
| --- | --- |
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | Tailwind CSS v4 + semantic CSS tokens: `src/app/(commerce)/commerce.css` + `src/components/commerce/system.css`, page stylesheets beside their components (`services.css`, `projects.css`, `capabilities.css`, `project-detail.css`) |
| Motion | CSS transitions and the Web Animations API (hero plate, signatures), IntersectionObserver for reveals; no animation library |
| Fonts | Plus Jakarta Sans (English display), Inter (English text), Tajawal (Arabic display), IBM Plex Sans Arabic (Arabic text), the system monospace stack for technical figures. All self-hosted: the Latin faces through `next/font`, the Arabic faces from `src/fonts` (the same files, preloaded on Arabic pages only) |
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
docs/reports/                Stage reports (latest: 2026-10-08, Stage 1J release candidate)
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
awaiting approval) or `published`. Only published routes are indexed and listed in the sitemap; `planned` and
`review` routes are served with `noindex, follow`. Since Stage 1J every route is `published` (the release candidate:
102 addresses in the sitemap); a new route starts as `planned` or `review` until its stage is approved.

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
  while the page is hidden. Keyboard focus shows what hover shows, and inside a row that scrolls sideways (the machine
  selectors, the projects' category bar, the phone rails) the row moves until the focused item shows whole. The theme
  switch and page changes apply at once (no cross-fade: a fade took words below AA mid-way). Interface transitions take their durations from
  four tokens (180 / 320 / 600 / 900 ms); the projects filter moves only the cards (a view transition without a
  full-page capture).
- **Reduced motion:** the finished plate and signatures at once, no loop, a still background and the system
  pointer — also when it is turned on while a page is open. Without JavaScript, all content is visible.

### SEO

Each page has a localized title and description, a canonical URL, `hreflang` alternates (en, ar,
x-default), Open Graph and Twitter tags with EN/AR share images, and JSON-LD: Organization +
LocalBusiness + WebSite on the homepage, about and contact pages; a WebPage node (AboutPage,
CollectionPage or ContactPage where it fits) and a BreadcrumbList on every inner page; Service on
service routes. `sitemap.xml` lists every published page (102 addresses: the homepage, ten inner pages, six services
and 34 projects, in both languages) with `en` / `ar` / `x-default` alternates; `robots.txt` allows everything and names
the sitemap. The share images (`public/og/og-{en,ar}.png`) are drawn from the built homepage by
`scripts/generate-og.mjs`.

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
`commerce-fonts.spec.ts` (the Arabic faces preloaded on Arabic pages only, their files and no layout shift),
`commerce-transitions.spec.ts` (the theme and page changes without a fade, the gallery's cards),
`commerce-keyboard.spec.ts` (keyboard focus inside the sideways rows at 320 px, 390 px and 200 % zoom),
`stage-1c.spec.ts` (generic inner-page checks: routes, SEO and the publication gate, breadcrumbs, overflow, keyboard,
reduced motion, no-JS) and `commerce-home-depth.spec.ts` (the homepage in depth: the signatures, the hero plate's loop,
the pointer, the themes' contrast and the background motion; it took over the retired lab's A V2 checks). In a cloud
session
Chromium is preinstalled at `/opt/pw-browsers`; elsewhere run `npx playwright install chromium` once.

## Namecheap Stellar Plus deployment

The production host is Namecheap Stellar Plus shared hosting: cPanel → **Setup Node.js App**, which runs the app under
Phusion Passenger. Prepared and tested locally only (report `docs/reports/2026-10-09-namecheap-stellar-plus-adapter.md`);
nothing goes online until RAWASY approves the release, and the legal pages' "before launch" notes are resolved first.

- **`server.js`** is the startup file: a minimal custom server that hands every request to Next.js's own request
  handler (the one `next start` uses), so the proxy, routes, 404s and the image optimizer behave as tested. `npm start`
  runs it. It reads `PORT` (default 3000), `HOSTNAME` (default `0.0.0.0`) and `NODE_ENV` (production unless set
  otherwise); under Passenger the port and address do not matter, as Passenger hands the app its own socket.
- **Node.js 22.x** (tested on 22.22.2; if the panel's 22.x differs, npm only warns about `engines`). Do not move the
  project to Node 20 for hosting.
- **Build on a clean Linux machine, not on the host**, from a fresh clone of the approved commit, and pack the archive
  right after the build (a server started there writes cache files into `.next`):

  ```bash
  npm ci
  NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
  node scripts/package-namecheap.mjs
  ```

  `scripts/package-namecheap.mjs` (deployment only; Node 22.18 or later and `tar`) writes `../rawasy-app.tar.gz` with
  `server.js package.json package-lock.json next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs .nvmrc src
  public .next`, less `.next/cache`, the route cache a server writes into `.next/server/route-cache` and the media
  RAWASY has held back, prints the `tar` command it ran, and writes the archive's listing beside it
  (`../rawasy-app.tar.gz.txt`). The held-back media are the photos `src/content/projects.ts` keeps off the website
  (`withheldMedia`, and every photo of a project whose flags keep its photos off the website) and the three Laser
  Engraving images the asset inventory keeps off every page (`docs/ASSET_INVENTORY.md`, item 12: the nameplates photo
  with third-party branding and part and serial numbers, awaiting permission, and two renders), listed by media ID in
  the script's `HELD_BACK_MEDIA`. Each is mapped to its file through the media registry; today these thirteen files:
  in `public/media/projects/`, `billboard-structure-1.webp`, `canopy-tree-1.webp`, `laser-cut-bench-1.webp`,
  `lattice-cubes-1.webp`, `litter-bins-1.webp`, `litter-bins-2.webp`, `litter-bins-3.webp`, `seed-sculpture-1.webp`,
  `stainless-landmark-1.webp`, `wheat-monument-1.webp`; in `public/media/services/`, `engraving-nameplates.webp`,
  `engraving-rotary.webp`, `engraving-wood.webp`. They stay in Git; only the archive leaves them out, so the host
  answers 404 for them. The script then checks the archive and, if any check fails, deletes it and exits with an error:
  none of the held-back files is in it and no page refers to one; every public file the pages, page data, styles and
  scripts refer to is in it; every sitemap page's HTML and page data are in it with the public files they refer to; and
  it holds nothing else and lacks nothing else (no `.git`, `node_modules` — the host installs its own: never upload one,
  least of all a Windows one —, `.next/cache`, `e2e`, `docs`, `scripts`, test results, Playwright reports, screenshots,
  evidence or `.env` file). `node scripts/package-namecheap.mjs --check=<archive>` re-checks an archive made from the
  same build before it is uploaded.
- **cPanel → Setup Node.js App → Create application:** Node.js version **22.x** · Application mode **Production** ·
  Application root **`rawasy-app`** (a folder in the account's home, never `public_html`) · Application URL
  **www.rawasymetal.com** with an empty path (the domain entry the panel lists for it) · Application startup file
  **`server.js`** · one environment variable, **`NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com`** (the build already
  holds it; set it here too). No other variable, key or secret.
- **Install and start:** stop the application, upload the archive with File Manager and extract it into `rawasy-app`
  (replacing any starter `server.js` the panel created), press **Run NPM Install** (with the prebuilt `.next` only the
  production dependencies are needed: Next.js, React and `sharp`), then **Start App** (**Restart** after an update). For
  an update, stop the app and delete the old `rawasy-app/.next`, `rawasy-app/public` and `rawasy-app/src` before
  extracting the new archive, so no stale build, photo or source file stays. The panel adds Passenger lines to the
  `.htaccess` in the domain's document root: leave them. Files of an older site left in the document root can answer
  instead of the app: back them up before moving them out.
- **Smoke checklist** after every start: `/` answers 307 to `/en` (`/ar` for an Arabic browser); `/en`, `/ar`, a service,
  `/en/capabilities`, a project page, `/en/contact` and `/en/privacy` answer 200 with their page; `/en/not-a-page` shows
  the 404 page with status 404; `/sitemap.xml` lists 102 `https://www.rawasymetal.com/` addresses and `/robots.txt` names
  it; `/media/projects/clock-tower-1.webp` answers 200 and held-back media such as
  `/media/projects/wheat-monument-1.webp` and `/media/services/engraving-nameplates.webp` answer 404;
  `/_next/image?url=%2Fmedia%2Fprojects%2Fclock-tower-1.webp&w=640&q=75` opened in a browser comes back as WebP (`sharp`
  needs glibc 2.28 or later: `ldd --version` in cPanel's Terminal); HTTPS works on rawasymetal.com and www.rawasymetal.com.
  The first request after a start or an idle spell is slower: Passenger starts the app on demand.
- **Logs:** the application's entry in Setup Node.js App (with its log file where the panel offers one); CloudLinux
  usually writes the app's own output to `stderr.log` in the application root; cPanel → Metrics → Errors shows the web
  server's errors.
- **Known issue** (Next.js 16.3.8, the same with `next start`): if a visitor cancels the very first request for an
  image size, that size can stay blank until the app restarts. Restart clears it; a size already in the image cache
  (`.next/cache/images`, kept across restarts) is not affected. See the adapter report, item 12, and its correction 1.
- **Image cache warm-up, after the first start of every new build** (the smoke checklist done; again after an update,
  which deletes `.next`): from your own computer, never on the host or inside the app, in the project folder, against
  the address where the new app answers (the domain only once it points to the app):

  ```bash
  node scripts/warm-images.mjs https://www.rawasymetal.com
  ```

  It reads the sitemap, collects every optimized image size the pages offer (1,484 in this build) and asks for each once,
  as a browser would: at most 2 requests at a time (`--concurrency`, 1 to 4, never more), each answer read to its end,
  100 ms between one worker's requests (`--pause`), never cancelled early (a request still unanswered after 60 s,
  `--timeout`, counts as timed out). It stops starting requests, and lets the running ones finish, when the host answers
  429, 503 or 508 (busy or at its resource limit), after 5 problems in a row or 10 in all, or on Ctrl+C. It prints the
  totals (discovered, warmed, new or already cached, failed, timed out, not attempted) and writes
  `warm-images-report.json`. Locally the 1,484 sizes took about 100 s; a second run, all cached, 3 s. If anything failed
  or timed out, read the report first: a size that timed out is the defect above, so **Restart** the app in cPanel, then
  ask again for exactly those sizes with `node scripts/warm-images.mjs https://www.rawasymetal.com
  --retry=warm-images-report.json`. Launch order: Start App, the smoke checklist, the warm-up until it reports 0 failed
  and 0 timed out, and only then normal traffic. Never loop it, schedule it or run several at once, and never load-test
  the host.
  Shared hosting has resource limits: watch cPanel → Metrics → **Resource Usage** (CPU, physical memory, entry
  processes, number of processes, I/O) during and after the warm-up.
- **DNS:** change nothing (nameservers or records) until the current nameservers, MX, SPF, DKIM, DMARC, A and CNAME
  records and the mail service in use are written down: switching to Namecheap's hosting nameservers can drop the mail
  records.
- **Rollback:** keep the previous archive and application folder until the new release is verified; to roll back, stop
  the app, put the previous folder back (or delete `.next`, `public` and `src` and extract the previous archive), Run NPM
  Install, Restart, and warm the image cache again. The code rollback point is the approved release candidate `422c397`.
  Never delete an existing site's files without a backup.

To run the browser tests against `server.js` locally: `npm run build`, then `NODE_ENV=production PORT=3400 node server.js`
in one terminal and `npm run test:e2e` in another (Playwright reuses a server already answering on its port).

## Next stages

Stages 1A–1I are approved (1G and 1H needed no batch: their pages and the Arabic site were already built). Stage 1J,
the release candidate (security, accessibility, SEO, performance and publication QA), is built and awaits independent
approval (report `docs/reports/2026-10-09-stage-1j-release-candidate.md`); deployment happens only on the user's
go-ahead. The Namecheap Stellar Plus hosting adapter (`server.js`, above) is prepared and tested locally and awaits
independent review. Phase 2 (admin panel) follows Phase 1 approval.
