# Stage TM-2.6 — retiring the previous design (report)

Date: 2026-10-02 · Branch: `claude/new-session-5eijs6` · Status: **built, awaiting the user's independent review** (not
self-approved). Nothing was deployed. Stage 1E, 1F, 1I and 1J, shared-polish work and the theme lab's removal were not
started.

## Summary

Every page of the website now runs on one root layout, the Modern Commerce design. Capabilities (Stage 1E) and the 34
project pages (Stage 1F) moved into it as **planned pages**: their addresses, titles, descriptions, stages, breadcrumbs,
`noindex, follow` and search metadata are unchanged (70 of 70 prerendered pages have identical metadata and JSON-LD),
and they are **text only** — the previous placeholder's project photo is gone, so the two AI-watermarked photos
(`stainless-landmark-1`, `billboard-structure-1`) are no longer shown, sent or requested anywhere. An unknown project
slug now answers 404 with this design's localized page. The fallback 404 (`global-not-found.tsx`) was rebuilt in the
Modern Commerce look, bilingual, with its own small stylesheet and the design's faces without preload; measurements on
the five required pages and the lab show no preload, stylesheet, font or script reaching them.

The previous design is deleted: its root layout, template and 404, `globals.css`, its fonts (Sora, Manrope, Noto Kufi
Arabic, Geist Mono), its shell, loader, page transition, cursor and observers, its visual primitives, the nine parked
`Legacy*Page.tsx` files and every component only they used (114 source files), GSAP and `@gsap/react`, and the
cross-design link machinery. The approved pages are unchanged: identical markup, stylesheets and resolved page data
(apart from the inline boot script, which lost the retired intro flag), and pixel-identical captures. Lint, typecheck
and build are clean (125 static pages); a fresh `npm ci` installs from the updated lockfile; the full browser suite
passes **377 of 377**.

---

## 1. `preserve/pre-tm2.6` SHA

`9c7d2af98ea1a8d10c383143862c5639713511e4` — created and pushed at the start of the batch (it did not exist before; no
force push). `preserve/pre-tm2.5` remains at `304a277a72d35c7473fc9a4c94e6f787df54c527`.

## 2. Starting SHA

`9c7d2af98ea1a8d10c383143862c5639713511e4` (TM-2.5 report commit). Verified at the start: fetched, clean tree, local =
remote, TM-2.5 commits `e0f6f9e`, `7d1fa0f`, `9c7d2af` present, no unreviewed drift.

## 3. Implementation SHA

`6f93a77fc0bbd4dda4e25735b5e53cabaf63cba9` — "Retire the previous design: one Modern Commerce root layout for every page
(TM-2.6)": 158 files changed, +1,295 / −17,085 lines.

## 4. Branch HEAD

The commit that adds this report and the CLAUDE.md update, directly on top of `6f93a77`; its SHA is given in the chat
summary (`git log -1 origin/claude/new-session-5eijs6`).

## 5. Dependency audit before deletion

A script (`deps.js`, in the session's proof folder) walked every static import, re-export, dynamic `import()` and CSS
`@import` from each entry group: the production Modern Commerce routes, the theme lab, the previous root layout, the
Capabilities placeholder, the project placeholders, the global 404, metadata routes / proxy / config, the tests and the
scripts.

| Before (TM-2.5 tree) | Files |
| --- | --- |
| Reached by the website, the lab or config (kept) | 170 |
| Reached only by the previous root, the placeholders or the old global 404 | 29 |
| Reached only by tests or scripts | 0 |
| Reached by nothing (the parked `Legacy*` pages and everything only they used, `lib/gsap.ts`) | 89 |

- `gsap` and `@gsap/react` were reached only through `src/lib/gsap.ts`, itself unreached: no page and no part of the lab
  used GSAP.
- The lab needed none of the deleted modules. One unreached file belongs to the lab
  (`src/components/theme-lab/signature/useSignature.ts`, a re-export): kept, the lab stays untouched.
- After the deletions: 175 files reached by the website/lab/config, 3 reached only by the fallback 404 (its own page,
  stylesheet and fonts), 1 unreached (that lab re-export); no package left unreached.

## 6. Routes moved

| Address | Before | After |
| --- | --- | --- |
| `/{en,ar}/capabilities` | `src/app/[locale]/capabilities/page.tsx` (previous root) | `src/app/(commerce)/[locale]/capabilities/page.tsx` |
| `/{en,ar}/projects/[slug]` | `src/app/[locale]/projects/[slug]/page.tsx` | `src/app/(commerce)/[locale]/projects/[slug]/page.tsx` + `not-found.tsx` |
| unknown project slug | previous design's 404 | this design's localized 404 (route-local boundary) |
| fallback 404 | previous design (`globals.css`, old fonts) | `src/app/global-not-found.tsx` + `global-not-found.css` in the MC look |
| `src/app/[locale]/layout.tsx`, `template.tsx`, `not-found.tsx` | the previous root | deleted |

The build's route table now has one `/[locale]` tree plus the theme lab; 125 static pages, as before.

## 7. Capabilities placeholder

`PlannedPage` (`src/components/commerce/planned/`), built from the inner-page kit only: breadcrumb Home → Capabilities,
the eyebrow "In development · 1E" / "قيد التطوير · 1E", the title and the description from `seo.capabilities` (wording
unchanged), "Back to homepage" and "Talk to RAWASY", and a pending note with the placeholder's sentence ("Its full design
follows the homepage approval, as part of build stage 1E."). Status `planned`; robots `noindex, follow`; canonical,
hreflang (en, ar, x-default), Open Graph and Twitter tags identical to before; no JSON-LD (as before). The header marks
Capabilities as the page and the footer marks its "Machinery" link. No machinery section, figure, table, photo or
drawing: the only figures are those already in the page's existing description (tested: no image, drawing, table, fact
list or further heading in `<main>`).

## 8. Project placeholders

All 34 projects × 2 languages = 68 pages, `generateStaticParams` and `dynamicParams = true` unchanged. Each shows the
project's title and summary from the record, "In development · 1F", the same actions and pending note, the visible
trail Home → Projects → Project and the same BreadcrumbList JSON-LD. Metadata identical to before. The header marks
Projects as the section (`aria-current="true"`, drawn by the new 246-byte `planned.css`, the same rules `services.css`
uses for Services); the language switch keeps the slug and sets the cookie.

## 9. Project-media removal

The previous placeholder rendered each project's first photo — for `stainless-landmark-sculpture` and
`billboard-support-structure` that was the withheld AI-watermarked photo (a pre-existing finding from TM-2.5). The
planned page shows no project media at all:

- all 68 pages: no `<img>`/`<picture>`, no background image in `<main>`, no `/_next/image`, no `/media/projects/`, no
  registry id of any of the 57 project photos or the 3 withheld ones, in the HTML, the inline page data or the RSC page
  data (`commerce-planned.spec.ts`, every page);
- the two flagged pages in both languages: 0 images rendered, 0 image requests (test + evidence 7 and 8).

## 10. Known-project behaviour

200, this design, one h1 (the title), the summary, Stage 1F, `noindex, follow`, canonical, breadcrumb (visible and
JSON-LD), Projects marked in the header and in the phone menu sheet, the language switch keeps the project, the trail
leads back to the overview (whose own Projects link is then the page). No case-study part, no fact, no photo.

## 11. Unknown-project 404

`projects/[slug]/not-found.tsx` re-exports `(missing)/not-found` (the smallest route-local boundary, as for the service
slugs). `/en/projects/not-a-project`, `/ar/projects/not-a-project` and deeper paths (`/en/projects/a/b`, handled by the
catch-all) answer a real **404** with this design's localized page: title "Page not found | RAWASY" / "الصفحة غير موجودة |
رواسي", `noindex`, `lang`/`dir` per language, nothing marked current, the language switch keeping the unknown address
(desktop and phone sheet), the visitor's theme applied, one document load, and page-data requests answered 307 → 404
(no loop). Before, these addresses showed the previous design's 404 with the tab title "RAWASY".

## 12. Global 404

`global-not-found.tsx` in the Modern Commerce look: one raised sheet with the logo and a quiet "404"; one `h1` holding
both languages ("Page not found · الصفحة غير موجودة", each in its own `lang` span); one `section[lang][dir]` per language
with its `h2` ("Outside the blueprint" / "خارج المخطط"), the note, the body and two links (home, contact). Title "404 —
RAWASY · رواسي" and `noindex` unchanged; light by default, dark from the visitor's stored theme (the design's boot
script); no duplicate ids; no blueprint or grid. Built as `/_not-found` with status 404.

Reachability (verified on both builds, status codes identical): **no address reaches it today.** Addresses without a
language are redirected (307) to the visitor's language and answered there (`/foo`, `/not-a-route`, `/zz`, `/zz/foo` → the
localized 404; `/`, `/about` → the page). Paths outside the proxy (`/api/…`, `/media/…`, `/_next/…`, `/brand/…`, `/og/…`,
`/favicon.ico`, `/theme-lab/en/zz`) get Next.js's own minimal 404, exactly as in TM-2.5 (routing semantics unchanged).
The page is therefore tested from the build output (`site.spec.ts`).

## 13. Global font / CSS leak proof

Fresh browser per page, 1440 × 900, nothing cached, scrolled to the bottom; TM-2.5 build vs TM-2.6 build.

| Page | `<head>` font preloads | Stylesheets | Font requests | JS files / modules | Transferred |
| --- | --- | --- | --- | --- | --- |
| `/en` | 2 → 2 (same files) | `3o9i7rvw2l0_y.css` + `0scziq9tap0-i.css`, unchanged | 3 → 3 (same) | 9/181 → 9/180 | 907.1 → 903.0 KB |
| `/ar/about` | 2 → 2 | `3o9i7rvw2l0_y.css`, unchanged | 12 → 12 (same) | 8/172 → 8/172 | 721.4 → 721.1 KB |
| `/en/services/laser-cutting` | 2 → 2 | 3 sheets, unchanged | 3 → 3 | 9/178 → 9/177 | 525.5 → 524.8 KB |
| `/en/projects` | 2 → 2 | 2 sheets, unchanged | 3 → 3 | 9/175 → 9/175 | 727.6 → 727.4 KB |
| `/theme-lab/en/modern-commerce-a-v2` | 2 → 2 | 4 lab sheets, unchanged | 3 → 3 | 9/178 → 9/177 | 903.3 → 899.4 KB |

- The fallback 404's stylesheet (`3dct6ciy1leb8.css`, 17,070 bytes with its `@font-face` rules) and its non-preloaded
  font copies are referenced only by the fallback page; no other page's head lists them.
- JS: every module differing between the builds was identified. Beyond the minifier's renames: the client copies of
  `lib/utils` (intro key removed) and `i18n/config` (`localeConfig` no longer needed in the browser) shrank; the logo
  module (9,261 bytes, carried in a chunk shared with the old loader) left the homepage's and the lab's bundles, the
  hero plate now holding its two logo paths inline (its non-identifier token stream is identical once those paths are
  written in place); the old route table with `crossDesignLink` (948 bytes) left the service pages' bundle and
  `switchLocalePath` moved into `SamePageLink`.
- Inline `<head>` script: the boot script (508 → 450 characters) lost only the retired intro statement, on every page.

## 14. Previous root removal

`src/app/[locale]/layout.tsx`, `template.tsx` and `not-found.tsx` deleted (with the two placeholder routes). No
production route uses them, `globals.css`, the old shell, the loader, page wipe, floating WhatsApp button, custom cursor
or the old reveal/live observers (checked on 7 pages by `site.spec.ts`). The theme lab keeps its own root layout.

## 15. Previous shell removal

Deleted: `components/layout/*` (`SiteHeader`, `SiteFooter`, `LanguageSwitcher`, `ThemeControls`, `WhatsAppButton`,
`PagePlaceholder`, `NotFoundView`), `components/motion/*` (`Loader`, `PageTransition`, `CustomCursor`, `RevealObserver`,
`LiveObserver`, the old `BootFallback`), `lib/boot-script.ts`, `lib/theme.ts`, `lib/placeholder-route.tsx` and the grain
layer. The Modern Commerce `Cursor`, `Motion`, `Ambient`, `BootFallback` and `PageShell` are untouched (only
`BootFallback` stopped passing the retired intro key).

## 16. Previous CSS removal

`src/app/globals.css` deleted. Built stylesheets 13 → 12: gone are the previous design's sheet (152,715 bytes) and its two
font sheets (12,964 / 12,954 bytes); new are `planned.css` (246 bytes, planned pages only) and the fallback 404's sheet.
Every remaining stylesheet is byte-identical to TM-2.5: the Modern Commerce sheet (130,220 bytes), `signature.css`,
`services.css`, `projects.css`, `lab.css`.

## 17. Previous font removal

`src/app/fonts.ts` (Sora, Manrope, Noto Kufi Arabic, its own IBM Plex Sans Arabic and Geist Mono declarations) deleted;
`global-not-found-fonts.ts` now declares the Modern Commerce faces with `preload: false`. Build output: font files 69 →
52, preloaded (`.p.`) files 11 → 5; the Sora, Manrope and Noto Kufi files are gone. Geist Mono remains only as theme-lab
option B's own face (its four lab pages); no website page references it. Production typography: Plus Jakarta Sans,
Inter, Tajawal, IBM Plex Sans Arabic and the system monospace stack; no request to Google Fonts (tested).

## 18. GSAP decision / removal

Audited (item 5): unused by the website and by the lab. Removed with `npm uninstall gsap @gsap/react`, which also removed
`src/lib/gsap.ts`'s dependencies from `package.json` and their lockfile entries. `npm ls gsap @gsap/react` → `(empty)`.
No served script contains GSAP code (`site.spec.ts`).

## 19. Legacy components deleted

114 source files deleted: the nine parked pages (the eight the brief names — `LegacyHomePage`, `LegacyAboutPage`,
`LegacyIndustriesPage`, `LegacyClientsPage`, `LegacyCertificatesPage`, `LegacyServicesPage`, `LegacyServicePage`,
`LegacyProjectsPage` — plus `LegacyContactPage`, parked in TM-2.2) and everything only the previous design used:
`components/{about,cards,certificates,clients,contact,industries,inner,legal,projects (except types.ts),service (except
the two geometry files),services,teasers,visual}/*`, the previous homepage's sections and its hero (`home/*` except
`hero/plate-geometry.ts`), `components/ui/*` (`ButtonLink`, `Icons`, `LineIcons`, `MediaImage`, `Phrases`,
`SectionHeader`), the shell and motion files (item 15), `lib/gsap.ts`, the previous root's layout, template and 404, its
Capabilities route, `globals.css` and `fonts.ts`. The previous project route moved into the Modern Commerce tree (git
records it as a rename). No `Legacy*` file is left in `src`. No backup copy was kept in the tree; `preserve/pre-tm2.6`
is the rollback.

## 20. Components intentionally retained, and why

- `components/home/hero/plate-geometry.ts` — the hero plate's geometry (Modern Commerce `HeroPlate`).
- `components/service/visuals/nesting-sheet.ts`, `engraved-plate.ts` — the signatures' geometry; not moved or
  refactored (brief §18).
- `components/projects/types.ts` — card types used by `lib/project-cards.ts`.
- `components/brand/Logo.tsx` — header, footer, hero plate, fallback 404, the lab.
- `lib/tones.ts` — keeps the `Tone` type used by the project cards (its unused `serviceTone` export was removed).
- The content layer, dictionaries, company data, media registry, certificate files, `page-meta`, `seo`, `inner-page`,
  `maps`, `logo-wall`, `project-cards`, `use-scroll-spy`, `utils`, `commerce-boot` (brief §19). Dictionary keys that
  only the retired shell read (for example `loader` and `placeholder.title`) stay as content.
- The whole theme lab (A, A V2, B, C, system pages, `lab.css`, tests, assets), including its unreached `useSignature`
  re-export and option B's Geist Mono.
- `scripts/generate-og.mjs` and the OG images (an offline generator; see item 26).

## 21. `crossDesignLink` / `commerceRoutes` retirement

`commerceRoutes`, `commerceDynamicRoutes`, the generated patterns and `crossDesignLink` removed from
`src/i18n/routes.ts`; `routes`, `RouteKey`, `routeStage`, `path()`, `href()` and `switchLocalePath()` kept. Nothing in
the website uses `next/link` (not converted, brief §12). The tests that exercised the machinery were retired (item 22).

## 22. Test assertion migration

The assertion map was written before any test was removed (full table in the appendix). In short:

- **Retired previous-design features (C):** the intro loader, the page transition, the old custom cursor, the old
  theme button, the V2 typography (Sora/Manrope/Noto Kufi/Geist Mono) and colour-role token pairs, the old decoration
  classes, the cross-design prefetch rules and `crossDesignLink` table, and the `skipIntro` helper (about 40 calls).
- **Replaced by Modern Commerce tests (A):** theme, language switch, menu sheet, reduced motion, no-JS, typography and
  self-hosting, decoration semantics, "no prefetch", the project and unknown-project behaviour, Capabilities — in
  `commerce-home`, `stage-1c`, `commerce-inner`, `commerce-projects` and the new specs.
- **Theme lab (B):** the lab's own contrast test covers the retired token-pair check; the lab's isolation test now also
  asserts the website's sheet never loads in the lab; its theme-key check runs on the Modern Commerce Capabilities page.
- New: `commerce-planned.spec.ts` (15 tests) and a rewritten `site.spec.ts` (7 tests). Deleted: `redesign-v2.spec.ts` (3)
  and `visual-system.spec.ts` (1); four cross-design prefetch tests (company, contact, inner, services).
- A Contact test found flaky during this batch, "the ready state …" (failed 2 of 160 on the TM-2.5 build and 5 of 160 on
  TM-2.6 before the fix): the trace showed Playwright scrolling the button into view with the page's smooth scrolling
  (on since TM-2.5) and clicking beside it, and one run clicking before the form's script took over. The quote-form
  tests now wait for the form to be enhanced and bring the button into view instantly before clicking: 160 of 160, and
  the whole Contact spec 4 times, 136 of 136. No product change.

## 23. Route matrix (EN and AR, final build)

| Page | Design root | HTTP | State | robots | Sitemap | Header / footer mark |
| --- | --- | --- | --- | --- | --- | --- |
| Home | MC | 200 | published | (indexable) | yes | Home (page) |
| About | MC | 200 | review | noindex, follow | no | About (page) / footer About |
| Services overview | MC | 200 | review | noindex, follow | no | Services menu (page) |
| Six service pages | MC | 200 | review | noindex, follow | no | Services (true) + the service (page) / footer service |
| Capabilities | MC | 200 | planned | noindex, follow | no | Capabilities (page) / footer "Machinery" |
| Projects overview | MC | 200 | review | noindex, follow | no | Projects (page) |
| Project pages (34) | MC | 200 | planned | noindex, follow | no | Projects (true) |
| Industries, Clients | MC | 200 | review | noindex, follow | no | the page |
| Certificates | MC | 200 | review | noindex, follow | no | footer Certificates |
| Contact | MC | 200 | review | noindex, follow | no | Contact (page) |
| Privacy, Terms | MC | 200 | review | noindex, follow | no | footer link |
| Localized 404, unknown service, unknown project | MC | 404 | — | noindex | no | none |
| Fallback 404 (`/_not-found`) | own document (`body.g404`) | 404 | — | noindex | no | — |

Every row checked in both languages (`lang`/`dir` en/ltr, ar-SA/rtl).

## 24. Publication / noindex matrix

Homepage `published` (indexable, in the sitemap); inner pages, the projects overview and the service pages `review`
(`noindex, follow`); Capabilities and the 68 project pages `planned` (`noindex, follow`); every 404 `noindex`; the theme
lab `noindex, nofollow` plus `X-Robots-Tag`. Unchanged; Stage 1J remains the gate.

## 25. Zero old-design asset leak proof

On `/en`, `/ar/about`, `/en/services/laser-cutting`, `/en/projects`, `/en/capabilities`, `/en/projects/geometric-lanterns`
and `/en/contact` (`site.spec.ts`, plus the measurements in item 13): the Modern Commerce sheet only, none of the
previous design's rules (`.btn-face`, `.page-wipe`, `.loader`, `.cursor-ring`, `.grain`); exactly the four MC faces and
2 font preloads; no loader, page wipe, cursor ring, grain or floating WhatsApp link; no GSAP code in any script; no
Google Fonts request; no prefetch request. The planned pages, which carried six old font preloads and the old 152 KB
sheet in TM-2.5, now load 270–287 KB instead of 496–518 KB.

## 26. Dead-code scan

Terms: Legacy, crossDesignLink, commerceRoutes, commerceDynamicRoutes, SiteHeader, SiteFooter, WhatsAppButton,
PageTransition, CustomCursor, Loader, RevealObserver, LiveObserver, globals.css, Sora, Manrope, Noto_Kufi, gsap,
@gsap/react.

- Source and runtime (`src`): **0 matches**. Lockfile: 0 (`gsap`).
- Tests: 3 explained matches — `e2e/site.spec.ts` asserts no GSAP code is served; `e2e/theme-lab.spec.ts` keeps
  Sora/Manrope/Noto Kufi as faces the lab must not declare; a comment in `e2e/commerce-home.spec.ts` stating they are gone.
- Scripts: `scripts/generate-og.mjs` (offline; renders the committed OG images with the previous design's faces fetched
  at generation time). Kept unchanged: regenerating changes the share cards, which is the user's call (item 42).
- Documentation (exempt): `CLAUDE.md` (its "Retired with the previous design" section names them), `README.md` (one
  mention in the test list), and the historical reports in `docs/reports/`.

## 27. Package / lockfile state

`dependencies`: `next` 16.3.6, `react` and `react-dom` 19.2.8 (gsap and @gsap/react gone); `devDependencies` unchanged.
The lockfile agrees with `package.json`: npm also wrote the lockfile's root entry for `@playwright/test` as the pinned
`1.56.1` that `package.json` already had (it read `^1.56.1`); the installed version is unchanged.

## 28. `npm ci`

Run after the final source change: exit 0, 374 packages added, 0 vulnerabilities (one pre-existing deprecation notice for
eslint 9.39.5). `npm ls` lists two optional wasm packages as extraneous, as it does on the TM-2.5 checkout.

## 29. Anchor regression

`commerce-anchors.spec.ts` green. The cold scripted matrix (fresh context, fonts held back 0 / 300 / 1500 ms, 1440 and
390): all 36 cells of Contact `#quote` / `#location`, Privacy and Terms `#contact`, Laser Cutting `#gallery` and
Fabrication `#projects` land exactly, on TM-2.5 and TM-2.6 alike. The projects overview's direct `#<slug>` cells read
−56 px on both builds: the bar's designed 56 px `scroll-margin` (16 px under the bar), which this probe does not count.

## 30. No-JS cold anchor measurement

Same 36 cells without JavaScript, 1.5 s after load, two runs per build in the same session: TM-2.6 **3 and 4 of 36** off
by more than 1 px; TM-2.5 5 and 5 of 36 (the TM-2.5 report measured 3). Always `/en/privacy#contact` and
`/ar/terms#contact` at 1440 (95–107 px, a font swapping in after the load event). Deferred, unchanged; no timer or scroll
script added.

## 31. Contact regression

`commerce-contact.spec.ts` green (24 tests): validation and error summary, the email / WhatsApp / copied-text golden
outputs, clipboard failure, files, the no-JS `mailto:` submission, the map's unchanged embed and links, `FramePointer`,
landings. Markup, page data and CSS identical to TM-2.5; captures pixel-identical (EN light 1440, AR dark 390). The
test-only race fix is described in item 22.

## 32. Certificate safety regression

`commerce-certificates.spec.ts` green: the eight file hashes, the digit-run guard, the register, the dialog (keyboard,
backdrop, Arabic first), the pointer. Captures pixel-identical (EN light 1440, AR dark 390).

## 33. Service / signature regression

`commerce-services.spec.ts` green (39 tests: structures, anchors, machine links, D4/D5, the unforked signatures and
replays, the four drawings). `services.css` and `signature.css` byte-identical; Laser Cutting and Laser Engraving
captures pixel-identical; the homepage signature frames (5 moments × EN/AR) identical within capture noise (a second
run 0 px; base-vs-base differs by up to 232 px).

## 34. Projects / D4 regression

`commerce-projects.spec.ts` green (30 tests): the 27 anchors, D4 links on About and the service pages, the homepage's six
`#gallery` links, the shared choice (`hidden`, `aria-pressed`, the announcement), the 56 px bar, the masonry wall, source
sizes, cold landings. `projects.css` byte-identical; captures pixel-identical (the first run's 39 px at one text line
did not reproduce in two further runs).

## 35. Homepage regression

Markup identical (both languages), page data identical apart from the inline boot script, CSS identical, captures
pixel-identical (EN light 1440, AR dark 1440, EN dark 390 × 15 screens, AR light 390 × 14). `commerce-home.spec.ts` green:
the 10 s loop, signatures, the six links, ambient, theme, cursor, header, footer. JS: −9.3 KB (item 13), behaviour
unchanged. Scroll: 54.1 → 54.0 fps at 1440.

## 36. Theme Lab regression

All 16 lab pages build; markup identical 16/16; page data identical byte for byte (64/64 payloads); `lab.css` and the lab's
other sheets byte-identical; font preloads unchanged; captures pixel-identical (A V2 EN light, AR dark, the system
sheet); `theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` green (54 tests); still `noindex`. Nothing the lab needed was
deleted.

## 37. Accessibility

- axe-core (WCAG 2.0/2.1/2.2 A and AA, best practice): 72 runs — Capabilities, a project page, the unknown-project 404,
  the fallback 404 and Home, About, Laser Cutting, Projects, Contact × EN/AR × light/dark × 1440/390, plus the phone menu
  sheet — **0 violations**, as loaded and with the ambient's worst-case colour painted in.
- Per-pixel text contrast on the new pages (216 measurements): every text at or above AA (lowest 5.40:1); the only
  values below are the `aria-hidden` "404" numeral of the approved TM-2.1 component (decorative). Fallback 404 from its
  tokens: lowest 4.55:1 (the pressed primary button), focus ring 6.76:1 / 7.84:1.
- Manual: one `h1`; breadcrumbs with `aria-current="page"`; the header and footer marks (item 23); focus order and a
  visible ring on every stop; `lang`/`dir` on the page and on each language part of the fallback; 320 px reflow and
  200 % zoom with no sideways scroll; forced colours (buttons and the note keep system-colour borders); reduced motion
  and no-JS tests green.
- Carried, unchanged: the phone menu sheet's "Projects" row fails axe's target-size rule while the Services list is open
  — the same on TM-2.5 and on every page, the new ones included (deferred item 4).

## 38. Performance / weight (TM-2.5 → TM-2.6)

| Page | Transferred | Requests | JS files / decoded bytes / modules | CSS requests | Font requests (preloads) | Scroll fps 1440 |
| --- | --- | --- | --- | --- | --- | --- |
| Homepage `/en` | 907.1 → 903.0 KB | 61 → 61 | 9 / 532,036 / 181 → 9 / 522,700 / 180 | 2 → 2 | 3 (2) → 3 (2) | 54.1 → 54.0 |
| About `/ar/about` | 721.4 → 721.1 KB | 49 → 49 | 8 / 485,659 / 172 → 8 / 485,480 / 172 | 1 → 1 | 12 (2) → 12 (2) | 59.9 → 59.9 |
| Laser Cutting | 525.5 → 524.8 KB | 31 → 31 | 9 / 532,928 / 178 → 9 / 531,579 / 177 | 3 → 3 | 3 (2) → 3 (2) | 60.0 → 59.9 |
| Projects | 727.6 → 727.4 KB | 60 → 60 | 9 / 491,323 / 175 → 9 / 491,144 / 175 | 2 → 2 | 3 (2) → 3 (2) | 60.0 → 59.9 |
| Contact | 331.5 → 331.3 KB | 16 → 16 | 8 / 498,732 / 174 → 8 / 498,553 / 174 | 1 → 1 | 5 (2) → 5 (2) | 60.0 → 59.8 |
| Capabilities | 495.8 → 270.4 KB | 23 → 14 | 8 / 494,047 / 173 → 8 / 485,480 / 172 | 2 → 2 | 6 (6) → 3 (2) | — |
| A project page | 517.6 → 286.8 KB | 27 → 15 | 9 / 508,839 / 183 → 9 / 513,061 / 174 | 2 → 2 | 6 (6) → 3 (2) | — |

Chunking: Turbopack re-split the shared chunks when the previous design's routes left the graph (the main chunk's name
changed; contents explained module by module in item 13). Scroll figures: 3 runs each, software compositing; differences
are within run-to-run noise.

## 39. SEO / sitemap / robots

`sitemap.xml` lists `/en` and `/ar` only (unchanged); `robots.txt` unchanged. The 70 moved pages have identical titles,
descriptions, robots, canonical and alternate links, Open Graph and Twitter tags and JSON-LD; only `theme-color` now
follows the Modern Commerce page colours, as on every other page.

## 40. Visual evidence

Sent with this report (each image at most 2400 px):

1. Capabilities EN light desktop · 2. Capabilities AR dark desktop · 3. Capabilities phone (EN light, AR dark) ·
4. project page EN light · 5. project page AR dark · 6. project pages on a phone (AR light; the menu sheet with Projects
marked) · 7. stainless-landmark-sculpture, no image (EN light, AR dark) · 8. billboard-support-structure, no image (EN
light, AR dark) · 9. unknown project 404 (EN light, AR dark) · 10. the fallback 404 (light, dark) · 11. the fallback 404
on a phone (light, dark).

Regression sheets, TM-2.5 build vs TM-2.6 (all pixel-identical): 12 homepage · 13 Contact · 14 About · 15 Laser Cutting ·
16 Certificates · 17 Projects overview · 18 Privacy, Terms, the localized 404, Industries, Clients · 19 Theme Lab A V2.
Whole-capture comparison: 31 views (home, Contact, About, Industries, Clients, Certificates, the services overview, Laser
Cutting, Laser Engraving, Projects, Privacy, Terms, the 404, an unknown service, Theme Lab A V2 and its system sheet)
— 0 differing pixels after a second run of the two noisy captures.

## 41. Deferred shared-polish items (not changed)

1. The homepage's colour switch shows no on/off state in forced colours.
2. `PageHero` fades its text in after the script starts (LCP about 1–1.4 s on inner pages with a hero; the planned
   pages too).
3. The footer's wordmark disappears in forced colours.
4. The phone menu sheet's last row: target size / "partly obscured" while the Services list is open (item 37).
5. The no-JS late-font residual (item 30).

Also unchanged on purpose: the collage reference, the Arabic ordering on page 3, the filter animation and the mouse-over
scroll figure.

## 42. Items needing RAWASY's (or the user's) confirmation

- RAWASY: their own Google Maps place link; image rights; the AI-watermarked photos (`stainless-landmark-1`,
  `billboard-structure-1`, `wheat-monument-1`) and the projects flagged for authorship or as renders; the engraving
  nameplates photo; licence renewal and registration numbers (all in `docs/ASSET_INVENTORY.md`).
- The user: whether to regenerate the OG share images with the Modern Commerce faces (`npm run assets:og` after
  updating `scripts/generate-og.mjs`); whether to remove the dictionary keys only the retired shell read.

## 43. Lint

`npm run lint`: 0 errors, 0 warnings.

## 44. Typecheck

`npm run typecheck`: 0 errors.

## 45. Build

`npm run build`: 0 warnings, 0 errors; 125 static pages (unchanged). The build after `npm ci` is identical to the one the
QA ran on (markup of all 121 pages, all 12 stylesheets and all 24 script chunks).

## 46. E2E count

`npm run test:e2e` on the final build: **377 passed, 0 failed, 0 skipped, 0 flaky** (11.2 min, 3 workers). TM-2.5 had 369.

---

## How to run

```bash
npm ci
npm run lint && npm run typecheck
npm run build && npm run test:e2e
npx next start -p 3400   # then /en, /ar, /en/capabilities, /en/projects/geometric-lanterns
```

## Next steps

Return TM-2.6 for independent review. Not started, by instruction: Stage 1E (Capabilities & Machinery), Stage 1F (project
detail pages), Stages 1I and 1J, the shared-polish items, removing the theme lab, deployment.

---

## Appendix — assertion map (written before any test was removed)

Legend: A = replaced by a Modern Commerce test · B = covered by a Theme Lab test · C = retired previous-design feature.

| Spec · test | Assertion | Disposition |
| --- | --- | --- |
| site · intro loader shows once per session | loader shown, then `no-loader` | C — loader retired |
| site · theme | follows the OS, toggles, persists, applied before hydration | A — commerce-home theme tests; commerce-planned Capabilities theme |
| site · language switch keeps the page | project page EN→AR keeps the slug, RTL, cookie | A — commerce-planned project language test |
| site · mobile menu | opens, locks the page, Escape returns focus, focus trapped | A — commerce-home menu sheet (closes when focus leaves: approved TM-1 behaviour); commerce-planned phone tests |
| site · client navigation runs the page transition | `.page-wipe` runs | C — page transition retired |
| site · reduced motion | no loader, no `.cursor-ring`, nothing hidden | C (loader, old cursor) · A — stage-1c and commerce-planned reduced motion |
| site · without JavaScript | Capabilities rendered, nothing hidden | A — commerce-planned without JavaScript |
| site · internal links resolve | crawl, no 4xx/5xx | kept, extended to Capabilities and a project page |
| stage-1c · dark theme toggles back | on Capabilities with the old theme button | A — same test with the MC theme control |
| stage-1c · skip link | Tab → skip link → `main#main` | A — kept on the MC Capabilities page |
| redesign-v2 · English typography | Sora / Manrope / Geist Mono, self-hosted | C (faces) · A — site "nothing of the previous design" (no Google request), commerce-home faces |
| redesign-v2 · Arabic typography | Noto Kufi / Plex, no letter-spacing | C · A — commerce-planned Arabic faces test |
| redesign-v2 · colour roles light/dark | 20 old token pairs ≥ 4.5:1 | C · B — theme-lab-a-v2 contrast test; per-pixel contrast in QA |
| visual-system · decoration hidden | old decoration classes | C · A — commerce-planned decoration test |
| commerce-home · its own stylesheet and typefaces | homepage part | kept |
| commerce-home · same test, old project page part | prefetch, old faces, 6 preloads | C · A — the same test now checks the project page has the MC sheet, faces, 2 preloads |
| commerce-home · previous-design pages open from the header | `no-loader`, `body.mc` absent | A — "Capabilities opens from the header in this design…" (`no-loader` C) |
| commerce-home · theme kept on the previous design's pages | old theme button | A — same test on the MC Capabilities page |
| commerce-inner · previous design never prefetches the legal pages | prefetch, faces | C · A — site "nothing is prefetched" |
| commerce-inner · unknown project keeps the previous 404 | `body.mc` = 0 | A — both slugs answer the MC 404 |
| commerce-inner · HTTP matrix, page-data loop, fallback | project slug 404 | kept (MC title now asserted) |
| commerce-company · previous design never prefetches the four pages | prefetch | C · A — site "nothing is prefetched" |
| commerce-contact · previous design links to Contact without prefetching | prefetch | C · A — same |
| commerce-services · links from the previous design never prefetch | `crossDesignLink` table, prefetch | C · A — same |
| commerce-services · Capabilities keeps its placeholder | "In development", "1E" | kept |
| commerce-projects · project pages stay in the previous design | old design, `crossDesignLink` | A — "project pages are planned (Stage 1F)…" + commerce-planned |
| theme-lab-a-v2 · the website's own theme is untouched | checked on the old Capabilities page, no `.a2-cursor` | B — kept on the MC page (the `.a2-cursor` marker C) |
| theme-lab · isolation | no `.btn-face`, no old faces | B — kept, plus no MC sheet in the lab |
| helpers · `skipIntro` | sets `rawasy-intro` | C — loader and intro flag retired |
