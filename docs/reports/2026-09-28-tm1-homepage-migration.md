# RAWASY Metal Website — Stage TM-1: Modern Commerce A V2 migration (homepage + design foundation)

**Date:** 2026-09-28 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `92099e0` (this report is in the following commit)

**Status: the homepage is migrated and returned for your visual review. I have not approved it.**

- `/en` and `/ar` now run the approved A V2 design on the website's real routes. That covers the header, the hero
  plate cutting on its 10 s loop, the capability strip, Who we are, the services with both signature animations,
  machinery, projects, industries, clients, compliance, the contact band and the footer. It works in light and dark,
  in English and Arabic.
- It matches the theme lab page for page. After hiding the lab's preview bar, the full-page pixel difference is
  0.04% on desktop and 0.3–0.5% on phones, all of it in the footer. The only differences are deliberate: real
  routes instead of in-page anchors, a WhatsApp link added to the footer, and the footer's copyright period fixed.
- Every other page keeps the previous design, unchanged. This is proved against the checkpoint build: identical
  HTML, identical CSS bytes, identical page data apart from one deliberate change (the old pages no longer prefetch
  the homepage), and identical screenshots.
- A rollback checkpoint was made first. The theme lab (A, A V2, B, C and the design-system sheets) is intact.
- I did not migrate the inner pages, start Stage 1E, or deploy. The browser suite passes: 224 of 224 tests.

## How to view

- `npm run build && npm start`, then open `http://localhost:3000/en` or `/ar`. Use the header switch for dark (the
  choice is stored under the website's own key, so it carries over to every other page, and back).
- To compare, open the lab: `/theme-lab/en/modern-commerce-a-v2` (add `?theme=dark`).
- Stay on the hero for 20–30 s to watch the plate cut, hold, reset and cut again. Scroll to Services to see both
  signatures play once.
- The header's links now go to the real pages. Every page except the homepage still uses the previous design:
  moving between the two is a full page load, by design (item 5).

---

### 1. Rollback checkpoint

| | |
| --- | --- |
| Worktree and branch | `/home/user/Rawasy-Metal-Website`, `claude/new-session-5eijs6`, clean before any change |
| HEAD recorded before TM-1 | `3260415` "Add A V2 hero loop report" (`3260415bbafb946c7d3bbeef8783677cf610c172`) |
| Preservation branch (GitHub) | **`preserve/pre-tm1-a-v2-migration`** at `3260415`, created through the GitHub API |
| Rollback tag | `pre-tm1-a-v2-migration` (annotated) at `3260415`, **local only**: the session's git proxy may push only its own branch; the push was refused 4 times with back-off, so the preservation branch is the remote checkpoint |
| The previous homepage | its page code is parked, unrouted, in `src/components/home/LegacyHomePage.tsx`; its sections in `src/components/home/` are untouched |
| Theme lab | A, A V2, B, C and every design-system sheet still build and pass their tests; the lab's stylesheets are byte-identical to the checkpoint |

To roll back, reset the branch to `preserve/pre-tm1-a-v2-migration`, or revert the implementation commit.

### 2. Main implementation commit SHA

`92099e0` — "Migrate the homepage to the Modern Commerce design (Stage TM-1)".

### 3. Current branch SHA

The branch head is the commit that adds this report, directly on top of `92099e0`, pushed to
`claude/new-session-5eijs6`. Its SHA is given in the chat report.

### 4. Files changed

65 files, +7,945 / −2,526 lines (most of the deletions are the lab modules moved to production).

- **New production design:**
  - Root layout and homepage: `src/app/(commerce)/[locale]/layout.tsx` and `page.tsx`.
  - Stylesheet and fonts: `src/app/(commerce)/commerce.css` and `fonts.ts`.
  - Theme boot: `src/lib/commerce-boot.ts`.
  - `src/components/commerce/`:
    - the design system (`system.css`);
    - the motion controller (`Motion.tsx`);
    - the shell and homepage data (`data.ts`), the tone and icon mapping (`tones.ts`) and the types (`types.ts`);
    - the shell (`shell/Header.tsx`, `Footer.tsx`, `PageShell.tsx`, `LocaleLink.tsx`);
    - the homepage sections (`home/Hero`, `About`, `Services`, `Machinery`, `Projects`, `Industries`, `Clients`,
      `Contact`, `SectionHead`, and `home/data.ts`).
- **Moved from the lab into production, one implementation for both:** `hero/HeroPlate.tsx`, `signature/`
  (`useSignature`, `LaserCut`, `LaserEngrave`, `signature.css`), `Ambient.tsx`, `Cursor.tsx`, `ThemeSwitch.tsx`,
  `Icon.tsx`, `ui.tsx` and `home/MachineShowcase.tsx`. The lab's files at the old paths now re-export them, and
  `src/app/theme-lab/lab.css` lists them as Tailwind sources.
- **Isolation of the previous design (no visual change):**
  - `src/app/globals.css`: two `@source not` lines.
  - `src/app/global-not-found.tsx` with the new `global-not-found-fonts.ts`.
  - `src/i18n/routes.ts`: `commerceRoutes` and `crossDesignLink()`.
  - `crossDesignLink()` applied in `SiteHeader`, `SiteFooter`, `PagePlaceholder`, `Breadcrumbs`, `InnerCTA` and
    `ButtonLink`.
- **Route:** `src/app/[locale]/page.tsx` moved to `src/components/home/LegacyHomePage.tsx`.
- **Tests:**
  - new: `e2e/commerce-home.spec.ts` (22 tests) and `e2e/a2-helpers.ts` (probes shared with the lab spec);
  - updated: `site.spec.ts`, `visual-system.spec.ts`, `redesign-v2.spec.ts` and `theme-lab-a-v2.spec.ts`.
- **Docs:** `README.md`, `CLAUDE.md` and this report.

### 5. Design-system integration

- **Where it lives:**
  - Tokens and components: `src/components/commerce/system.css`, a converted copy of A V2's `a2.css`, not a new
    theme. Every token and component is scoped to `.mc` on `<body>`, and dark mode redefines the same token names
    under `html[data-theme="dark"] .mc`.
  - Tailwind entry, base layer, reveals, view transitions, shell width, icon and skip-link rules:
    `src/app/(commerce)/commerce.css`.
  - The `@theme` mapping is the lab's, so utilities such as `bg-surface`, `text-ink-2` and `shadow-raised` resolve to
    the same tokens.
- **What it covers:**
  - typography (Plus Jakarta Sans, Inter, Tajawal 500/700/800, IBM Plex Sans Arabic 400/500, system monospace);
  - colour roles (brand orange, steel, teal, brass);
  - light and dark surfaces and the section sheets;
  - borders, shadows and radii;
  - buttons (primary, secondary, on-dark, sizes);
  - cards (edge, link, media);
  - sections, spacing (`--shell`, `--sec-y`) and reading zones;
  - one icon family (line and duotone);
  - reveal and signature animation utilities, the ambient, the pointer, and hover, focus and current states.
- **Kept out of production** (lab-only): the preview bar, `?theme=`, the lab's own theme key, scroll-spy, parallax,
  forced-theme samples, frozen sheet frames and replay buttons. The shared components keep two optional props that
  only the lab's sheet uses (`Ambient frame`, `useSignature freeze`).
- **Shared with the website:** the theme key, the language cookie and the intro flag.
- **Isolation:**
  - The homepage has its own root layout, so the two designs never share a document: no CSS leak, no font collision,
    no script clash.
  - The previous design's CSS is byte-identical to the checkpoint.
  - Six unused font preloads that `global-not-found` leaked onto every page are gone. It now uses non-preloading
    copies of its fonts.
  - Pages in the previous design no longer prefetch the homepage. A prefetch across root layouts is never used, and it
    was pulling about 75 KB of the new design's fonts into every old page.

### 6. Homepage migration

- The sections run in the brief's order, as in the lab: Header, Hero, Capability strip, Who we are, Services (the
  two signatures lead), Machinery teaser, Projects, Industries (company-profile sectors apart from website
  classifications), Clients, Trust / compliance, Contact CTA and Footer.
- All content comes from the content layer. No fact was rewritten or added.
- The server HTML was diffed against the lab page. Apart from the preview bar and the lab's wrapper class, the only
  differences are routes, `aria-current`, the added footer WhatsApp link and the copyright period.
- There are no flagged photos (the engraving nameplates, renders or AI-watermarked images). Clients show no counts.
- There is one `h1`, and headings never skip a level.

### 7. Header integration

- **Desktop:** the logo links home and is marked current. The nav is Home, About, Services (a menu), Capabilities,
  Projects, Industries, Clients, Contact, with the current page marked `aria-current="page"`.
- **Services menu:** the six services, "All services" and "Request a Quote". It closes with Escape (focus returns),
  an outside click or tabbing out.
- **Right side:** the language switch (EN / عربي), the theme switch and Get a Quote.
- **Phone sheet:** the same links with the services as a sub-list, plus language, theme, Call, WhatsApp and Get a
  Quote pinned at the bottom. It locks the page, closes with Escape (focus returns) or after a choice, and now also
  closes when keyboard focus tabs past its last link. That last rule is the only behaviour added to the lab's
  design, so the keyboard never lands on content hidden under the sheet.

### 8. Navigation verification

- **Header links:** `/en`, `/en/about`, `/en/capabilities`, `/en/projects`, `/en/industries`, `/en/clients` and
  `/en/contact` (and `/ar/…`), plus the six `/services/<slug>` pages and `/services`. There are no `theme-lab` URLs
  anywhere on the page.
- **Capabilities** is still the planned "in development" page, as it was in the previous design's navigation.
- **Quote actions:** all 11 go to `/<locale>/contact#quote` (header, Services menu, phone sheet, the six machines,
  the contact band, the footer) and land on the quotation form. The hero's own two actions stay in-page as in the lab.
- **Language switch:** opens the same page in the other language and sets the `NEXT_LOCALE` cookie; `/` then
  follows the choice.
- **Across the two designs:** from the homepage to a page in the previous design, that page opens without replaying
  its intro loader; its logo and Home link lead back.
- **Internal links:** every one on every page resolves (site.spec). `/en/no-such-page` is still the localized 404.

### 9. Footer integration

- **Links:** Get a Quote (to the quote form); the six services; About, Projects, Clients, Industries, Machinery
  (`/capabilities`) and Certificates; Privacy Policy and Website Terms; Back to top.
- **Contact:** both phones (`tel:+966537368310`, `tel:+966552616189`), `mailto:rawasymetal@gmail.com`, **WhatsApp**
  (`https://wa.me/966537368310`, added here because the brief asks for it) and the address.
- **No lab links and nothing invented.** The copyright reads "© 2026 RAWASY UNITED INTERNATIONAL CO. LTD. All rights
  reserved.", as on the other pages. The lab showed "LTD..".
- Language and theme are in the header (and the phone sheet), as in the lab.

### 10. Hero animation verification

The plate is recorded in real time on `/en` (3 cycles) and `/ar` (2 cycles):

| Check | Result |
| --- | --- |
| Period | 10 s start to start, every cycle (10,000–10,300 ms window), no drift |
| Cutting | 0–5.26 s: count 00 → 07, the last perforation row reached by 3.9–4.6 s, the laser light off at 5.26 s with every opening cut, the dimensions drawn and the nodes lit |
| Hold | Finished plate held until 9.40 s (≥ 3.6 s measured) |
| Reset | From 9.40 s, back to the blank plate by 9.85 s; readout back to 00/07 |
| Next cycle | At 10 s, from the blank plate |
| Off screen | Every loop animation pauses where it is; the clock and readout hold; on return it carries on from the same frame (< 1 s) |
| Hidden tab | Pauses; resumes on return |
| Mouse | The mouse leans the plate and reads X / Y while the loop carries on |
| Reduced motion | Static finished plate, no cycle, no animation |
| Layout shift | 0 |

The one-time playback was not restored. The plate's rise onto its stage plays in cycle 1 only, as before; your
decision on whether it should repeat is still pending (item 28). The proof is `hero-loop-frames.png`: real-time
frames of cycle 2 into cycle 3 on `/en` light desktop, `/ar` dark desktop and `/en` dark phone.

### 11. Laser Cutting verification

- It is the same component as the lab's (the corrected nesting-sheet version).
- One `.sig-cut` leads the services grid. It is idle until in view, then plays once: more than 20 animations on one
  clock, each a single iteration.
- It finishes on the service page's picture: the kerf drawn, the slugs dropped, four pierce points, the trail off,
  and the head parked at (176, 92).
- It behaves the same in English and Arabic.
- With reduced motion it shows the finished picture with no animation.
- No star cut, lifted part or other rejected concept is present.

### 12. Laser Engraving verification

- It is the same component as the lab's (the brass-plate version).
- One `.sig-engrave`, idle until in view, plays once.
- It finishes on the service page's plate: every groove drawn, the dots lit, the laser off with the beam at rest, and
  the head on the ring's top mark (282, 48). It is mirrored in Arabic as on its service page.
- With reduced motion it shows the finished picture.
- No medallion, raster or photograph. The flagged nameplates photo stays off the page.

### 13. Ambient background verification

- It is the optimized two-layer version, not the five-layer one.
- One fixed layer sits behind the page: `aria-hidden`, `z-index: -1`, `pointer-events: none`. It has two moving
  children:
  - the surface: micro-dots, warm and steel colour with restrained teal, drift 32 s, breathe 28 s;
  - the light sweep: 26 s.
- In Arabic the drift and sweep are reversed.
- It rests while the page scrolls (every layer paused, clocks holding) and resumes after.
- Reading zones and near-opaque sheets keep it out from under text.
- With reduced motion it holds still. Phones get the lighter version (shared CSS).
- Scroll: 56.4 fps at 1440 px in the software-compositing benchmark (target ≥ 55).

### 14. Cursor verification

- **Desktop mouse only:** it appears only once the mouse moves, and the point sits exactly on the mouse.
- **States:** "active" over links and cards, a crosshair ("plate") over the hero plate, tighter when pressed.
- **Text selection:** unaffected (triple-clicking the hero text selects it; `pointer-events: none`).
- **Text fields:** keep the system I-beam, and the laser pointer hides.
- **Touch:** no custom pointer; taps work.
- **Reduced motion and forced colours:** system cursor.
- **Keyboard:** never focusable and `aria-hidden`.
- **Look:** the same subtle point and ring as the lab.

### 15. EN status

`/en` is complete. It matches the lab (0.04% pixels, footer only), with English faces (Plus Jakarta Sans and Inter)
and no console errors.

### 16. AR status

`/ar` is complete:

- full RTL (`dir="rtl"`, `lang="ar-SA"`): the header, hero, cards, navigation, buttons, icons (directional ones
  flip) and footer are mirrored;
- the plate stays an object (not mirrored);
- Tajawal for headings and IBM Plex Sans Arabic for text, never letter-spaced;
- the section order is unchanged;
- 0.04% pixel difference from the lab.

### 17. Light/dark status

- **Themes:** light uses the soft neutral page (`#f4f4f1`); dark uses blue-charcoal (`#131820`).
- **Switching:** works in place with a cross-fade (none with reduced motion) and updates the browser's theme colour.
- **Persistence:** stored under the website's key, so a choice made on the homepage carries to every page in the
  previous design and back.
- **No flash:** the theme is set in `<head>` before the body exists, which the tests prove on the first paint.
- **System setting:** followed until a choice is made.
- **Without JavaScript:** the page is light.

### 18. Responsive QA

The matrix covers 1920×1080, 1440×900, 1280×800, 834×1112, 390×844 and 360×780, each in EN light, EN dark, AR light
and AR dark: **24 real Chromium renders, all passing**.

- No sideways scroll.
- No element past the viewport edge.
- The header fits (73 px) with the quote button inside the viewport.
- The `h1` never overflows.
- No console errors.

Full pages were walked and captured for every render. Contact sheets: `matrix-<width>.png`. The browser tests also
check sideways scroll from 360 to 1920 px in both languages and themes.

### 19. Accessibility QA

- **axe-core** (WCAG 2.2 AA and best practice) in 8 runs (EN/AR × light/dark × 1440/390): **0 violations**. With
  every gradient and the ambient forced to their worst-case solid colours: **0 violations**.
- Text on photos and gradients is marked "needs review" by axe, as in the lab. The page renders identically to the
  lab, whose per-pixel checks with the ambient light held behind text pass.
- **Keyboard:**
  - the skip link comes first and lands on `<main>`;
  - focus is visible;
  - the header, Services menu, cards, machine selector and colour toggle all work from the keyboard;
  - the phone sheet closes with Escape (focus returns) and when focus tabs out.
- **Structure:** landmarks are banner, main and contentinfo, plus labelled navigation regions; one `h1`, with no
  skipped heading levels.
- **Motion, touch and language:**
  - reduced motion: everything is still, with the finished plate and pictures;
  - touch: no custom pointer;
  - Arabic: readable at 1.85 line height and never letter-spaced;
  - labels: every icon-only control has an accessible name, and decoration is `aria-hidden`.

### 20. Performance comparison

All figures are from this container: local production server, no network throttling, headless Chromium with
software compositing (the worst case). Medians of 3 runs.

Cold load, desktop 1440 (phone 390 in brackets):

| | Requests | Transferred | Font files | FCP | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| Migrated homepage | 22 (16) | 434 KB (369) | 3 (2) | 304 ms (236) | 304 ms (236) | 0 (0) |
| Lab A V2 | 23 (18) | 437 KB (374) | 3 (2) | 280 ms (224) | 280 ms (224) | 0 (0) |
| Previous homepage (checkpoint) | 47 (29) | 872 KB (746) | 7 (7) | 312 ms (260) | 1,736 ms (1,700) | 0 (0) |

Running cost:

| | Migrated | Lab A V2 |
| --- | --- | --- |
| Full-page scroll at 1440 (plate cutting) | 56.4 fps (56.2–56.6) | 56.6 fps (56.2–56.6) |
| Full-page scroll at 390 | 60.2 fps | 60.2 fps |
| 10 s on the hero while it cuts: renderer / GPU CPU, main-thread tasks | 1.35 s / 3.56 s, 0.61 s | 1.48 s / 3.64 s, 0.67 s |
| Same, style recalcs / layouts | 399 / 274 | 407 / 280 |
| 10 s scrolled away (loop paused): renderer / GPU, tasks, recalcs | 0.23 s / 0.66 s, 0.007 s, 2 | 0.24 s / 0.68 s, 0.008 s, 2 |
| Mouse circling the plate while it cuts | 55.3 fps; lean and X / Y updated on every move | 57 fps (runs down to 49) |

The migrated homepage costs the same as the approved lab, and its first load is about half the previous homepage's
(less JavaScript, 3 font files instead of 7, and no loader holding back the largest paint). No new libraries.

### 21. SEO status

- **Homepage metadata:** title, description, canonical, `hreflang` (en, ar, x-default), Open Graph, Twitter and
  JSON-LD (Organization + LocalBusiness, WebSite) are **identical to the previous homepage**. Only the browser's
  theme colour changed, to the new page colours.
- **Publication status:** the homepage stays `published` and indexable. Every other page keeps its status (`review`
  or `planned`, `noindex`).
- **Unchanged files:** `sitemap.xml` is identical to the checkpoint (only `/en` and `/ar`), and so are `robots.txt`
  and the manifest.
- **Theme lab:** stays `noindex, nofollow` (meta and header), outside the sitemap and every navigation.
- **Not deployed.**

### 22. Inner-page regression results

Compared with the checkpoint build (`3260415`, built side by side):

- **Server HTML (visible markup):** all 101 prerendered pages in the previous design are identical, in both
  languages, including the 404 and the planned pages. Scripts are removed, asset paths normalised, and so is the
  position of Next's `next-size-adjust` meta, which moves between two builds of the same tree.
- **CSS:** the previous design's two stylesheets are byte-identical.
- **Page data (RSC):** all 101 payloads resolve to identical trees except for `prefetch: false` on links to the
  homepage. That is deliberate: the navigation is a full page load, so the prefetch was wasted and pulled the new
  design's fonts in.
- **Screenshots, 1440, 13 pages × EN/AR × light/dark:**
  - 48 of 52 are byte-identical;
  - 4 (`/industries`) differ in one 74 × 58 px spot by 1–7 colour levels. The checkpoint build differs from itself in
    the same spot, so this is rendering noise.
- **Screenshots, 390, 10 pages in EN light and AR dark:** 20 of 20 byte-identical.
- **Behaviour:** the inner-page suites all pass (stage-1c, service-pages, redesign-v2, visual-system, site): no route
  errors, hydration errors or font collisions.

### 23. Lint

`npm run lint`: **passed**, no warnings or errors.

### 24. Typecheck

`npm run typecheck`: **passed**, no errors.

### 25. Build

`npm run build`: **passed**. 125 static pages (109 site pages and 16 theme-lab pages), the same count as the
checkpoint.

### 26. Browser tests

`npm run test:e2e`: **224 passed, 0 failed, 0 flaky** (6.5 min) on the final build.

- **New: `commerce-home.spec.ts` (22 tests).** Covers:
  - the homepage in both languages;
  - its own stylesheet and typefaces, and none of the other design's;
  - the header's real routes and the Services menu;
  - all 11 quote actions;
  - moving to and from the previous design;
  - the language switch and cookie, RTL, and the footer;
  - the phone menu (including tab-out) and touch;
  - the shared theme set before the first paint, and the system setting;
  - overflow at 360–1920 px in both themes;
  - the 10 s loop (3 cycles EN, 2 AR), rest off screen and in a hidden tab, X / Y;
  - both signatures, the ambient, the pointer and keyboard;
  - reduced motion, no-JS and search metadata.
- **Updated:**
  - The old homepage's own tests (the explorers, the intro block) were removed with it.
  - The shell tests (loader, theme, mobile menu, page transition, reduced motion, no-JS) and the visual-system tests
    now run on inner pages, which keep that design.
  - The lab spec's check that the website's theme is untouched now reads an inner page.

### 27. Screenshots/comparison sheets

Sent in the chat with this report (each ≤ 2400 px):

- `compare-en-light-desk.png`, `compare-en-dark-desk.png`, `compare-ar-light-desk.png`,
  `compare-ar-dark-desk.png`, `compare-en-light-mob.png` and `compare-ar-dark-mob.png`: the lab next to the migrated
  homepage, full page.
- `hero-loop-frames.png`: the loop in real time on `/en` and `/ar`.
- `matrix-1920.png`, `matrix-1440.png`, `matrix-1280.png`, `matrix-834.png`, `matrix-390.png` and `matrix-360.png`:
  the 24-render responsive matrix.

Intentional differences from the lab:

1. No preview bar.
2. Header links go to the pages instead of scrolling to sections, so the current page is marked instead of the
   section being read.
3. The logo links home.
4. Quote actions add `#quote` to land on the form.
5. The language switch opens the real page (`hreflang="ar-SA"`, as on the rest of the site).
6. The footer gains a WhatsApp link, and its copyright loses the stray period.
7. The theme is the website's (no `?theme=`).
8. The phone sheet closes when keyboard focus leaves it.

### 28. Outstanding issues

1. **Your visual review of the homepage.** I have not approved it. The inner pages stay in the previous design
   until you approve the homepage.
2. **The plate's rising entrance** still plays in cycle 1 only; your decision on repeating it is still pending.
3. **Two designs side by side:** moving between the homepage and any other page is a full page load. The previous
   design's page wipe runs before it, then the new page loads. This ends as pages migrate.
4. **Temporary code to delete once the migration is approved:**
   - the previous homepage (`LegacyHomePage.tsx` and its sections);
   - the icon's second class (`lab-icon`) and the lab-only props of the shared components;
   - later, the theme lab itself.
5. **The web manifest** keeps the previous design's colours (it is site-wide). Update it when more pages migrate.
6. **Still open for RAWASY:** the Google Maps place link, image rights and AI-watermarked images, the licence
   renewal, registration numbers, and so on (`docs/ASSET_INVENTORY.md`). Also the two moderate shell accessibility
   findings kept for 1I / 1J (previous design).
7. **Performance figures** are local and unthrottled. Real-network numbers belong to 1J.

## Next steps

After your review of the migrated homepage, and only on your instruction:

- corrections to it, or its approval;
- then, with your approval, the controlled migration of the inner pages.

Stage 1E and Phase 2 stay on hold until you say so.
