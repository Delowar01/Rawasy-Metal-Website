# RAWASY website — Stage 1C report: core inner pages

**Date:** 24 September 2026
**Branch:** `claude/new-session-5eijs6`
**Status:** Stage 1C is built, tested and pushed. It is **awaiting your visual review and approval**. It has not been self-approved, and Stage 1D has not been started.

## Summary

- Eight inner pages are built in English and Arabic: About, Services overview, Industries, Clients, Certificates & Compliance, Contact / Request a Quote, Privacy Policy and Website Terms. They share one inner-page system, and each page has its own hero variant.
- The localized 404 ("Outside the blueprint" / «خارج المخطط») was reviewed and needed no changes.
- The approved homepage is unchanged. Its server HTML is identical to the approved build in both languages.
- The quote form does not pretend to send anything. There is no delivery backend yet, so it prepares the request for the visitor to send by email or WhatsApp, or to copy, and it says so on the page.
- The Stage 1C routes stay behind the approval gate (noindex, not in the sitemap) until you approve them.

## 1. Main commit SHA

`74bf5c3e628a04f7129e572f747549c21aa1b42a`: "Build Stage 1C core inner pages".

## 2. Branch SHA

The branch head is the docs commit that adds this report, on top of `74bf5c3`. The exact SHA is given in the chat report, because a commit cannot contain its own SHA.

## 3. Files changed

The main commit changes 53 files (+5,170 / −121).

- **New pages** (existing placeholder routes replaced):
  - `src/app/[locale]/{about,services,industries,clients,certificates,contact,privacy,terms}/page.tsx`
- **New components:**
  - `src/components/inner/`: `InnerPageHero`, `Breadcrumbs`, `EditorialSection` (with `TechnicalDivider`), `MediaFrame`, `InnerCTA`
  - `src/components/legal/`: `LegalPageLayout`, `LegalPage`
  - `src/components/contact/`: `QuoteForm`, `ContactMethods` (`ContactMethod`, `ContactSheet`)
  - `src/components/clients/ClientGrid`
  - `src/components/certificates/CertificateRegister`
  - `src/components/industries/IndustryIndex`
  - `src/components/services/`: `ServicePlate`, `ServiceRow`, `ServiceScrollSpy`, `ServiceGlyph`
  - `src/components/about/StructuralSketch`
- **New content:** `src/content/about.ts`, `pages.ts`, `contact.ts`, `legal.ts`.
- **Updated content and types:** `types.ts`, `repository.ts`, `services.ts`, `industries.ts`, `seo.ts`, `navigation.ts`, `src/i18n/dictionaries.ts`, `src/i18n/routes.ts`.
- **Library:**
  - `src/lib/inner-page.ts` (new).
  - `src/lib/page-meta.ts`: approval states.
  - `src/lib/seo.tsx`: WebPage JSON-LD.
  - `src/lib/placeholder-route.tsx`, `src/app/sitemap.ts`.
  - `services/[slug]` and `projects/[slug]` pages: gate helper and short breadcrumb labels only.
- **Styles:** `src/app/globals.css`, additions only. New inner-page classes plus a reduced-motion rule. No existing rule was changed.
- **Icons:** `src/components/ui/Icons.tsx`. Seven icons were appended; no existing icon was changed.
- **Tests:** `playwright.config.ts`, `e2e/helpers.ts`, `e2e/site.spec.ts`, `e2e/stage-1c.spec.ts`.
- **Tooling:** `package.json` / `package-lock.json` (`@playwright/test` 1.56.1 and the `test:e2e` script), `.gitignore` (test output folders).
- **Docs commit:** this report, `README.md` and `CLAUDE.md`.

## 4. Pages completed

| Page | Hero variant | What it contains |
| --- | --- | --- |
| About RAWASY | Split: structural sketch + workshop photo, registered-name plate | Overview from the profile (p.2), vision (editorial), "Scaffolding and site support" (formwork, wood & steel props, new structures, rental, installation & dismantling, transport), how RAWASY works (Understand → Engineer → Fabricate → Inspect → Deliver → Install, labelled as a general framework agreed per client), why RAWASY (numbered spec list, different from the homepage), CTA to Services / Projects / Contact |
| Services overview | Split: service "plate" of six anchor cells, perforated backdrop | Sticky service index with scroll-spy; six editorial rows (alternating, staggered cover + supporting image, includes, equipment chips, link to the future detail route) |
| Industries | Stacked: staggered photo strip | Architectural list of 8 sectors with pinned image preview (hover/focus on desktop, thumbnails on mobile), related-service links, visible marker for profile-backed vs website-classified sectors, and a note explaining the classification |
| Clients | Compact, minimal | 21 logos on a ruled 7-column sheet (3 on phones), monochrome with colour on hover, factual intro, trademark note — no testimonials, rankings or partnership claims |
| Certificates & Compliance | Compact, formal | Document register table, three register entries with redacted previews and facts, accessible viewer dialog, "About the previews" section |
| Contact / Request a Quote | Split, action: "Request a quote" button + direct-contact sheet | Phones (call), WhatsApp, email, address, registered name (EN + AR); quote form with honest handoff |
| Privacy Policy | Compact + meta (last updated, applies to) | 14 numbered sections, contents list (pinned on desktop, disclosure on phones), pending-confirmation notes, privacy contact |
| Website Terms | Same layout | 9 numbered sections covering informational purpose, acceptable use, IP, content accuracy, quotations, external links, liability, updates, contact. No jurisdiction clause |
| Localized 404 | — | Reviewed at desktop and mobile in EN and AR. No refinement needed, so it is unchanged |

## 5. Components

- **Brief's list:**

  | Component | File |
  | --- | --- |
  | InnerPageHero | `inner/InnerPageHero` (split / stacked / compact; grid / perforated / fine / none backdrops; optional metadata strip) |
  | Breadcrumbs | `inner/Breadcrumbs` |
  | EditorialSection and TechnicalDivider | `inner/EditorialSection` |
  | MediaFrame | `inner/MediaFrame` (never enlarges a photo beyond its source width) |
  | ContactMethod | `contact/ContactMethods` |
  | QuoteForm | `contact/QuoteForm` |
  | ClientGrid | `clients/ClientGrid` |
  | CertificateGrid | `certificates/CertificateRegister`, a register rather than a grid |
  | LegalPageLayout | `legal/LegalPageLayout` |

- **Also added:** InnerCTA, IndustryIndex, ServicePlate, ServiceRow, ServiceScrollSpy, ServiceGlyph, StructuralSketch.
- **Helpers:** `lib/inner-page.ts` handles metadata, the breadcrumb trail and JSON-LD.
- **Styling:** everything uses the existing tokens and type scale (`t-h1`, `t-h2-compact`, `t-title`, `t-h3`, `t-lead`, `t-body`, `t-label`). There are no per-page font overrides.

## 6. Content changes

- All copy lives in the structured content layer and is read through `repository.ts`:
  - `about.ts`, `pages.ts` (services, industries, clients, certificates), `contact.ts`, `legal.ts`.
  - SEO titles and descriptions for the eight routes in `seo.ts`.
  - Short breadcrumb labels in `navigation.ts`.
- **Services:** each has a supporting image.
- **Industries:** each sector links to related services. The infrastructure sector uses a larger feature image, because its gallery photo is only 92×163 px.
- **Sourcing:** facts come only from the company profile. Nothing was invented: no years, counts, ISO, awards, tolerances, capacities, testimonials, guarantees or sustainability claims.
- **Softened profile wording:** "the highest standards… exceeding expectations" became "high standards… aiming to exceed expectations". "Decades of experience" and "international standards" are not used. The Vision 2030 mark is not used.
- **Process:** the six-step process is stated to be a general framework whose steps are agreed with each client.
- **Industries:** four sectors are named in the profile. The other four (architecture & façades, public realm & landmarks, street furniture & shade, signage & gateways) are marked on the page as website classifications based on the work gallery.
- **Registration numbers:** the Certificates page says they are available on request and that previews are not certified copies.

## 7. EN status

Complete on all eight pages. Copy, SEO, breadcrumbs, form messages and legal text are all present.

## 8. AR status

- Complete on all eight pages. The Arabic is professional Saudi business Arabic, written independently rather than translated line by line.
- **Fonts:** Noto Kufi Arabic for headings, buttons and navigation (600), IBM Plex Sans Arabic for body, labels and form text (400/500). No letter-spacing on Arabic text.
- **Dates:** Gregorian with Latin digits.
- **Phone field:** accepts Arabic-Indic digits.
- **Certificates:** Arabic pages show the Arabic version of the bilingual commercial registration first.

## 9. RTL status

- `dir="rtl"` is set, and layouts use logical properties throughout.
- Breadcrumb chevrons, arrows and "back" icons mirror, and so do grid orders (hero visuals, register entries, service rows, contact sheet).
- LTR islands (`dir="ltr"`) keep phone numbers, emails, file names and the EN legal name intact. Inline text in the other language carries `lang` and `dir`.
- Checked in every Arabic screenshot and by the tests (`dir` and `lang` on every route).

## 10. Light theme

Verified on all eight pages at five widths in both languages.

## 11. Dark theme

- Verified on all eight pages at five widths in both languages, using the same semantic tokens; there are no per-theme component styles.
- Dark-mode contrast issues found on raised panels were fixed (see 13).

## 12. Responsive QA

- **Screenshot matrix:** 160 full-page renders of the final build (8 pages × 5 viewports × EN/AR × light/dark):
  - Viewports: 1440×900, 1280×800, 834×1112, 390×844 and 360×780.
  - All returned HTTP 200, with 0 sideways overflow and 0 console errors or warnings.
- **Browser tests:** sideways overflow is re-checked at 360, 390 and 834 px for all 16 page variants, and at 1440 px on every route.
- **Type scale (measured):**

  | Element | Desktop | Mobile |
  | --- | --- | --- |
  | Page title | EN 70 px, AR 64 px | EN 38.5 px, AR 38 px |
  | Section H2 | 44 / 42 px | 29 / 28 px |
  | H3 | 28 / 26 px | 22 px |
  | Body | 16–17 px (lead 19 px) | — |

  These are all within the brief's targets.

## 13. Accessibility QA

- **axe-core 4.13** (WCAG 2.0/2.1/2.2 A–AA plus best practice) was run on 72 page variants: 9 routes including the 404 × EN/AR × light/dark × 1440/390.
- **Interactive states:** the form error state, the prepared request and the open certificate dialog were audited in 8 combinations (EN/AR × light/dark × 1440/390). There were 0 violations.
- **Fixed during QA:**
  - Contrast of the "Pending confirmation" label was 4.31:1.
  - Tertiary text on raised panels in dark mode was 4.35:1. Those panels now use secondary text.
  - Decorative outlined numerals were moved out of the text tree.
  - A duplicate "Service index" landmark name was renamed.
  - Client names were read twice (alt text plus caption). The caption is now hidden from assistive tech.
- **Remaining findings:** only two, both moderate and both from the approved site shell. They exist on the approved homepage too, so I did not touch them (see Known limitations).
- **Keyboard checks** (covered by the tests):
  - The skip link moves focus to the main content.
  - Certificate viewer: Enter opens it, focus lands on Close, Escape closes it, and focus returns to the trigger.
  - Services index links jump to the service; the industries preview follows keyboard focus.
  - Form errors move focus to an error summary whose links focus the fields.
  - "Edit request" returns focus to the first field.
- **Semantics:**
  - One `h1` per page, and labelled sections and landmarks.
  - Breadcrumbs use `aria-current`.
  - Form fields have labels, `aria-invalid`, `aria-describedby` for hints and errors, and required markers.
  - Live regions announce file and copy notices.
  - The certificate viewer is a native modal `<dialog>`.
- **Reduced motion and no JavaScript:** checked on every inner page.

## 14. SEO

- **Every page has:**
  - A localized title and description.
  - A canonical URL.
  - `hreflang` alternates for en, ar and x-default.
  - Open Graph and Twitter tags with the EN/AR share images.
  - JSON-LD: a WebPage node (AboutPage, CollectionPage or ContactPage where it fits) plus a BreadcrumbList.
- **Organization + LocalBusiness** appears only on About and Contact, as well as the homepage.
- **Approval gate kept, not bypassed:**
  - `src/lib/page-meta.ts` now has three states: `planned`, `review` and `published`.
  - The eight Stage 1C routes are `review`. They are served with `noindex, follow` and left out of `sitemap.xml`, and the tests assert both.
  - Approving Stage 1C means changing those eight entries to `published`.

## 15. Form status

**Works now:**
- Client-side validation with accessible messages in EN and AR:
  - Required: name, email, phone, service and project details.
  - Email format; phone with 8–15 digits (Arabic-Indic digits accepted); at least 20 characters of detail.
- Files: type checking (PDF, DWG, DXF, STEP, JPG, PNG), 10 MB each, up to 5, with drag-and-drop and removal.
- An error summary that receives focus.
- A "ready to send" state (not "sent") that offers:
  - an email handoff (`mailto:` with subject and body)
  - a WhatsApp handoff (`wa.me` with the text)
  - Copy request
  - a reminder to attach files, and Edit.
- The page states that the website does not send or store anything.
- Without JavaScript, the form submits to `mailto:` with native validation, and the file picker is hidden.

**Pending:**
- No online delivery: no server endpoint, email service, storage, upload hosting, spam protection or confirmation emails.
- Files are never uploaded; visitors attach them in their own app.
- Long requests can hit mailto length limits in some email apps. The page says so and offers Copy.
- Connecting a backend needs your decision on provider, recipient and retention, plus a privacy-policy update.

## 16. Certificate / redaction status

- **Shown:** only the three redacted previews from the profile (CR in EN + AR, VAT, Commercial Activity Licence).
- **Never shown:** registration numbers, QR codes, barcodes and personal names. They are covered by solid blocks, and nothing sensitive is in the data.
- **Licence expiry date:** redacted in the image and absent from the data.
- **Labels:** "Redacted preview" captions, a note in the viewer dialog, and "Sensitive details stay covered" with a "not certified copies" line.
- **Reference column:** reads "Available on request".
- **No ISO claims:** the tests assert that the page has no ISO, expiry or 1447 text.

## 17. Source / image concerns

- **Not upscaled:** frames never exceed the source width, and small photos show at native size.
- **About hero:** the authentic workshop photo.
- **Services supporting images** (CNC bending, steel frame, welding, scaffolding props) are among the photos the asset inventory flags as possible stock or supplier imagery. Licences still need confirming.
- **Laser engraving cover:** the nameplate photo shows a third-party brand (Hitachi) and part or serial numbers. I recommend replacing it.
- **Flagged project images:** no image flagged for an AI watermark (#07, #14, #21) is used on the Stage 1C pages.
- **Licence preview:** still shows the street, district and 935 m² shop area printed on the document. These are not in the brief's sensitive categories, but please confirm.

## 18. Information needed from RAWASY

1. Approval of Stage 1C, after which I publish the eight routes.
2. **Legal (for legal review):**
   - Privacy: whether any third parties (for example subcontractors or transport) receive project data, retention periods, how access and deletion requests are handled, and the hosting provider and its logs.
   - Terms: wording on liability and the IP licence.
   - Whether a governing-law clause is wanted. There is none now.
3. **Quote form:**
   - Whether to connect a backend, and the address that should receive requests (currently rawasymetal@gmail.com).
   - Whether both numbers use WhatsApp (the link uses +966 53 736 8310).
4. **Certificates:**
   - The renewed Commercial Activity Licence (the profile copy expires 1447/04/04 AH).
   - Whether the CR status is still "Active".
   - OK to show the street, district and shop area as printed.
   - OK to say "registration numbers available on request".
5. **Services wording:** "New structures" (the profile says "New Struck") — what does it mean? And what service is "fixing openings"? It is omitted for now.
6. **Industries:** confirmation of the four website-classified sectors.
7. **Clients:** permission to show the 21 logos, and the correct EN/AR names.
8. **Images:** licences for stock-like photos, a replacement for the nameplate photo, and original high-resolution photography.
9. **Opening hours:** not shown, because none were provided.

## 19. Lint

`npm run lint`: pass (0 errors, 0 warnings).

## 20. Typecheck

`npm run typecheck`: pass.

## 21. Build

`npm run build`: pass. 109 static pages, the same count as before.

## 22. Browser tests

- `npm run test:e2e`: **50/50 passed** (Playwright 1.56.1, Chromium, about 58 s) on the committed code.
  - `site.spec.ts`: the stage 1A–1B checks, ported from the old scratch QA script, with the About check updated for the new headline.
  - `stage-1c.spec.ts`: routes, EN/AR, RTL, theme, breadcrumbs, SEO and the gate, clients, the certificate dialog, form validation, files and handoff, the no-JS fallback, legal pages, 404, overflow, console errors, keyboard, reduced motion, no-JS.
- **Failures on the way:** two failures in earlier runs were test assumptions. One test looked for noscript text as an element; Playwright's no-JS mode parses `<noscript>` as text, so the test now checks the server HTML. The other checked reveals in the viewport's bottom band.
- **Real bug found and fixed:** the file picker was not hidden without JavaScript (a CSS layer-order issue).
- A separate run that failed with 500 errors came from a stale server, not the code. It passed after a restart.

## 23. Homepage regression

- **Server HTML:** `/en` and `/ar` are byte-identical to the approved build (commit `50de6ac`) once asset hashes are normalised.
- **React payload:** identical apart from the build ID.
- **Pixels:** full-page screenshots at 5 widths × EN/AR × light/dark were compared, 20 pairs per run.
  - 19/20 are pixel-identical.
  - The remaining pair differs only by faint decoding noise inside one photo (mean difference about 6/255, no layout change). In an earlier run the noise appeared in a different pair, so it is capture noise.
- **Shared files touched:** all additive (icons, dictionary, content types, CSS classes). The homepage publication state is unchanged.

## 24. Screenshots and viewports reviewed

- **Viewports:** 1440×900, 1280×800, 834×1112, 390×844 and 360×780, each in EN light, EN dark, AR light and AR dark, for all eight pages (160 full-page renders).
- **Reviewed as contact sheets:**
  - The first screen of every render.
  - Full-length overviews at 1440 in EN light, EN dark and AR dark, and at 390 in AR dark.
  - Close-ups of dark panels.
- **State screenshots:** form errors, the prepared request (AR, dark), the certificate viewer (AR desktop; EN mobile, dark), the privacy contents on mobile (AR, dark) and the industries list on mobile.
- **Regression captures:** 40 homepage screenshots.
- A set of these images was sent with the chat report.

## 25. Stage 1D not started

Confirmed. Service detail routes (`/services/[slug]`) are still `planned` and show the in-development page. The overview links to them only as future routes. Nothing from 1D–1J or Phase 2 has been started.

## Known limitations

- **Pre-existing in the approved shell or homepage** (left unchanged, fix on your approval):
  - The header and footer "Language" navs share a name.
  - The floating WhatsApp button sits outside any landmark.
  - On the homepage certificate cards, dark-mode tertiary text measures 4.35:1. Lightening the dark `--text-tertiary` token slightly would fix every instance.
  - Fonts for both languages are preloaded on every page (planned for 1J).
  - Development-only React warning about the boot script on 404 pages. It does not appear in production.
- **Quote form:** no delivery backend (see 15).
- **Services index:** after an instant jump back to the top, it keeps the last highlighted service until you scroll. Normal scrolling updates it.
- **Legal pages:** they intentionally show "Pending confirmation" notes until the points in 18 are settled.
- **Photos:** the profile photos are low-resolution exports, so they are shown near native size.

## How to run

```bash
npm install
npm run dev                          # http://localhost:3000
npm run lint && npm run typecheck
npm run build && npm run test:e2e    # browser tests against the production build (port 3400)
npm start                            # production server
```

## Next steps

1. You review Stage 1C: the pages, both languages, both themes, and the screenshots.
2. On approval, set the eight Stage 1C routes to `published` in `src/lib/page-meta.ts`.
3. Then Stage 1D (service detail pages), only after your go-ahead.
