# RAWASY Metal Website — Stage TM-2.1: inner-page kit, Privacy, Terms and the localized 404

**Date:** 2026-10-01 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `4001c3f` (this report is in the following commit)

**Status: TM-2.1 is built and returned for your independent review. I have not approved it.**

- Privacy Policy and Website Terms now use the Modern Commerce design at `/en|ar/privacy` and `/en|ar/terms`.
  Every section, anchor, date, pending note, link and search tag is unchanged.
- Unknown addresses under a language (`/en/…`, `/ar/…`) now show a Modern Commerce 404, with a real 404 status, in
  English and Arabic.
- The reusable kit for the next batches is in `src/components/commerce/inner/`.
- The homepage, every page still in the previous design and the theme lab are unchanged (items 21 and 22).
- lint, typecheck, build and all 240 browser tests pass.
- Not started: TM-2.2 (Contact) or any later batch, Stage 1E, Stage 1F and the theme lab's removal. Nothing was deployed.

---

### 1. Pre-TM-2 checkpoint branch and SHA

- **`preserve/pre-tm2`** on GitHub → **`5cfeaedf1fd7f455925d339e172361f2f56b26c5`**.
- The branch did not exist before. I created it with a normal push (no force), before any TM-2.1 change.
  `git ls-remote` confirms it still points at that commit.
- It holds everything up to the frozen migration plan and the corrected decision register: the approved TM-1 homepage,
  every page in the previous design and the theme lab.

### 2. Starting SHA

- **`5cfeaedf1fd7f455925d339e172361f2f56b26c5`** ("State the TM-2 register's checks as future verification requirements").
- Before starting I checked the following:
  - the working tree was clean;
  - the local branch and `origin/claude/new-session-5eijs6` were both at this commit;
  - the plan (`2026-09-29-tm2-migration-plan.md`) and the decision register (`2026-09-30-tm2-decision-register.md`)
    were unchanged since they were frozen.

### 3. Implementation commit SHA

- **`4001c3fd705029406373fdf4ab287a6e4689758a`**: "Migrate Privacy, Terms and the localized 404 to the Modern Commerce design (TM-2.1)".
  It holds the code and the tests.

### 4. Branch HEAD

- The commit that adds this report and the `CLAUDE.md` update, directly on top of `4001c3f`. It is pushed to
  `origin/claude/new-session-5eijs6` (normal push, no force). Its SHA is in the chat summary.

### 5. Files changed

**New (11):**
- `src/components/commerce/inner/`:
  - `PageHero.tsx`, `Breadcrumbs.tsx`, `ContentsNav.tsx`, `Document.tsx`;
  - `ClosingCta.tsx`, `NotFound.tsx`, `BootFallback.tsx`.
- `src/components/commerce/legal/LegalPage.tsx`
- `src/components/commerce/shell/SamePageLink.tsx`
- `src/app/(commerce)/[locale]/(missing)/not-found.tsx`
- `e2e/commerce-inner.spec.ts`

**Moved (3, with small edits):**
- `src/app/[locale]/privacy/page.tsx` → `src/app/(commerce)/[locale]/privacy/page.tsx`
- `src/app/[locale]/terms/page.tsx` → `src/app/(commerce)/[locale]/terms/page.tsx`
- `src/app/[locale]/[...rest]/page.tsx` → `src/app/(commerce)/[locale]/(missing)/[...rest]/page.tsx`

**Shared Modern Commerce files touched (7):**

| File | Change |
| --- | --- |
| `src/components/commerce/system.css` | One block appended at the end of the components layer ("Inner pages (Stage TM-2)"). Nothing before it changed. |
| `src/components/commerce/data.ts` | `getShellView` also accepts a page without a route (the 404). Footer links carry their route key. |
| `src/components/commerce/shell/Header.tsx` | An optional `sameAddressLink` for the 404's language links. |
| `src/components/commerce/shell/PageShell.tsx` | Passes `sameAddressLink` on to the header. |
| `src/components/commerce/shell/Footer.tsx` | Marks the page being viewed (`aria-current="page"`). |
| `src/i18n/routes.ts` | `commerceRoutes` gains `privacy` and `terms`. |
| `src/app/(commerce)/[locale]/layout.tsx` | Comment only. |

**Tests changed (3):** `e2e/stage-1c.spec.ts`, `e2e/visual-system.spec.ts` and `e2e/commerce-home.spec.ts` (item 23).

**Docs:** `CLAUDE.md` and this report.

**Left as they were, on purpose:**
- `src/content/legal.ts`: the legal content.
- The previous design's `src/components/legal/*`: no route uses it any more. The approved plan deletes the previous
  design's code in TM-2.6. Deleting it now could also change the previous design's generated CSS (its class names feed
  the Tailwind build), which is proven byte-identical.
- `src/app/[locale]/not-found.tsx`: it still serves unknown service and project slugs (item 10).
- Also unchanged:
  - `src/app/global-not-found.tsx`;
  - `src/proxy.ts`;
  - `src/lib/page-meta.ts`;
  - the sitemap and robots.

### 6. Inner-page kit architecture

Everything is in `src/components/commerce/inner/`. All parts are server components except `ContentsNav` and
`BootFallback`, which are small client components.

- **`PageHero`.** The page hero, in three layouts:
  - `compact`: text only (the legal pages);
  - `split`: text beside an aside (7/12 + 5/12), e.g. a photo or a drawing;
  - `stacked`: text, then a full-width element below it.

  It holds the breadcrumbs, the label, the page's only `h1`, the lead, page facts (a `dl` of label/value chips) and
  optional actions. The text sits on TM-1's reading zone (`.a2-read`).
- **`Breadcrumbs`.** A labelled `nav` with an ordered list. The current page carries `aria-current="page"`, and the
  chevrons mirror in Arabic.
- **`ContentsNav`.** "On this page" / "في هذه الصفحة": a labelled `nav` with a numbered list of anchor links.
  - From 1024 px it is pinned beside the text (`position: sticky`, below the header). If it is taller than the
    screen, it scrolls on its own.
  - Below 1024 px it is a disclosure above the text. It uses a real `button` with `aria-expanded` and
    `aria-controls`, and sits in the page flow, never over the content.
  - Without JavaScript the list is simply open and the button is hidden.
  - The section being read is marked with `aria-current`. The mark adds weight, a tint and an edge, so it never relies
    on colour alone. It uses the existing `useScrollSpy` (an IntersectionObserver, no scroll handler).
- **`Document`:**
  - `DocSection`: a `section` with its anchor id, labelled by its numbered `h2`;
  - `Prose`: paragraphs and lists, at a set line length;
  - `PendingNote`: `role="note"`, a text label ("Pending confirmation" / "بانتظار التأكيد") and a brass edge.
- **`ClosingCta`.** A dark panel with numbered link rows, for the pages that end with one (About, Industries and others
  in later batches). It is built and styled but not used yet: the legal pages have no closing call to action.
- **`NotFoundView` and `BootFallback`.** See item 9.
- **Page surfaces.** The hero sits on the page background with its reading zone. The body sits in an inset sheet
  (TM-1's `sec-sheet sec-muted`) holding opaque cards (contents, document). Body text never sits directly on the
  moving background.
- **Styles.** One block at the end of `system.css`'s components layer adds 94 rules:
  - Every selector is scoped under `.mc`. Nearly all target the kit's own `ip-*` classes.
  - Two shared rules sit outside the kit: `.mc .t-h1`, and the footer's marked link. The homepage has no element
    either can match.
  - Two harmless utilities, `.sticky` and `.contents`, which Tailwind made from words in code comments.

  Only Modern Commerce tokens are used, with no new colours: steel for section numbers and bullets, brass for pending
  notes, orange for the current contents entry and primary actions.
- **D8.** None of the retired decoration is used:
  - no grid backdrops, scan lines, frame marks, technical frames, registration marks or rulers;
  - no pointer light, outlined numerals, "Figure NN" captions or nameplates;
  - no page loader, page wipe or blueprint drawings.

  The only motion is TM-1's:
  - the unchanged background, one fixed layer with its two moving children (no extra full-screen layer);
  - the hero text's reveal fade;
  - the pointer, on desktop with a mouse;
  - the contents' current mark.
- **How a page is put together.** `PageShell` → `PageHero` → body sheet (`ContentsNav` + document cards) → optional
  `ClosingCta`. `components/commerce/legal/LegalPage.tsx` builds Privacy and Terms this way from `src/content/legal.ts`.

### 7. Privacy migration

- The route `/[locale]/privacy` moved into the Modern Commerce root layout. `LegalPage.tsx` renders it from the
  unchanged content file.
- **All 14 sections**, in order, with their anchors:
  - `who-we-are`, `information`, `quote-form`, `use`, `sharing`;
  - `cookies`, `analytics`, `technical`, `links`, `security`;
  - `retention`, `choices`, `changes`, `contact`.
- **Dates and pending notes:**
  - "Last updated 25 September 2026" (`<time datetime="2026-09-25">`);
  - "Applies to: This website, in English and Arabic";
  - the five pending notes, unchanged (sections 05, 08, 09, 11 and 12; item 30).
- **Contact block** (section 14): the email, both phones and the address. The email and phones stay left to right in
  Arabic.
- **Text.** Every paragraph and list item is the content file's own text. The tests compare each one with
  `src/content/legal.ts` in both languages. I wrote no legal text.
- **Compared with the previous version:**
  - The visible text of `<main>` has the same 114 lines in each language.
  - In Arabic every line is identical.
  - In English the only difference is that some labels are no longer set in capitals. The previous design capitalised
    them with CSS: the breadcrumb, the label, the page facts, the contents title, the pending-note labels and the
    contact labels. The words are the same.
- Search tags, structured data and status: items 12 and 13.

### 8. Terms migration

- **All 9 sections**, in order, with their anchors:
  - `about`, `use`, `intellectual-property`, `accuracy`, `quotations`;
  - `links`, `liability`, `changes`, `contact`.
- "Last updated 24 September 2026" and "Applies to", as before.
- The two pending notes, unchanged (sections 03 and 07; item 30), and the contact block in section 09.
- The visible text has the same 73 lines in each language, with the same caveat about the capitalised labels as
  Privacy. Search tags, structured data and status are identical.

### 9. Localized 404 implementation

- `src/app/(commerce)/[locale]/(missing)/not-found.tsx` renders the Modern Commerce header and footer around
  `NotFoundView`.
- **Copy.** Only the existing dictionary text, unchanged:

  | | English | Arabic |
  | --- | --- | --- |
  | Title | "Outside the blueprint" | "خارج المخطط" |
  | Lead | "The page you're looking for isn't part of this structure." | "يبدو أن الصفحة التي تبحث عنها ليست ضمن هذا المخطط." |
  | Label | "Ref. — not found in drawing set" | "مرجع — غير موجودة في مجموعة المخططات" |
  | Home action | "Back to homepage" | "العودة للرئيسية" |
  | Contact action | "Contact RAWASY" | "تواصل مع رواسي" |

- **Design.** It is deliberately plain:
  - one raised sheet on the page background;
  - a large "404" as decoration, hidden from assistive technology;
  - the title and the lead;
  - Home (primary, orange) and Contact (secondary).

  The previous design's drawing grid and cut line are gone.
- **Page details.**
  - One `h1`, and the right `lang` and `dir`. In Arabic the layout and the arrows mirror.
  - Title "Page not found | RAWASY" / "الصفحة غير موجودة | رواسي", with `noindex`.
- **Shell.** No page is marked current. The language switch keeps the unknown address (`/en/foo/bar` ↔ `/ar/foo/bar`)
  and remembers the choice.
  - It does this through `SamePageLink`, which the 404 passes into the header.
  - An earlier build had the header import it directly. That added 1,084 bytes of JavaScript to every Modern Commerce
    page, the homepage included. I fixed it before committing (item 21).
- **Built in the browser.** Next.js 16 builds this 404 in the browser (item 10). `BootFallback` then re-applies the
  visitor's theme and the script-only controls, and restores the page title. The tab would otherwise show "RAWASY".

### 10. Catch-all routing

- The catch-all moved from the previous design's tree to `src/app/(commerce)/[locale]/(missing)/[...rest]/page.tsx`
  (`notFound()`, `dynamicParams = true`), with the localized 404 beside it.
- **Why the `(missing)` route group.** A `not-found.tsx` beside the Modern Commerce layout is rendered into the page
  data of every page under it.
  - That added the whole 404 page (header, footer and all; about 52 KB raw, 7.8 KB gzipped) to the homepage.
  - Inside the group only the catch-all carries it, and the homepage's files stay identical.
  - A later route that calls `notFound()` (service and project slugs) will need this boundary above it, or its own.
- **Which 404 answers.** Next.js picks the most specific route.
  - These fall through to the catch-all and get the **Modern Commerce 404**:
    - an unknown page (`/en/no-such-page`);
    - a deeper path that no route matches (`/en/foo/bar`, `/en/services/laser-cutting/extra`, `/en/privacy/extra`).
  - An unknown slug of a route still in the previous design (`/en/services/<unknown>`, `/en/projects/<unknown>`) is
    matched by that route, which calls `notFound()`. It shows the **previous design's localized 404**, also with a
    real 404 status. These follow their routes into the new design in TM-2.4 and TM-2.5.
- **Unchanged:**
  - `src/proxy.ts`: an address without a language gets a 307 to `/{locale}/…`, chosen by the visitor's language;
  - `global-not-found.tsx`;
  - no `dynamicParams = false` on any layout (it caused redirect loops before).
- **No loops.** A page-data request is redirected once (307) to its cache-keyed address, as for every page, and is
  then answered. The browser loads the 404 document once (tested).

### 11. Real HTTP status matrix

Measured with curl on the approved build (5cfeaed) and on TM-2.1, side by side. The "page that answers" columns
and the page-data chains were checked again in a browser, on both builds, in correction 1.

*Corrected after review (TM-2.1 correction 1).* The first version of this item said "every row is identical on both".
That was true of the status codes and redirects only, not of the page that answers.

- **Unchanged on every row:**
  - the status codes;
  - the redirects, including the one page-data redirect;
  - the 404 titles and `noindex`, because both designs' 404s use the same dictionary title and robots rule;
  - the sitemap and robots bodies.
- **Changed by TM-2.1: the page that answers a generic unknown address under a language.**
  - At 5cfeaed the catch-all `src/app/[locale]/[...rest]/page.tsx` called `notFound()`. That rendered the previous
    design's localized 404: `src/app/[locale]/not-found.tsx`, with `NotFoundView` from `src/components/layout/`.
  - TM-2.1 moved the catch-all into Modern Commerce (item 10), so these addresses now get the Modern Commerce 404.
  - Unknown service and project slugs get the previous design's 404 on both builds.
  - 5cfeaed never showed the Modern Commerce 404.

| Request | Status (both builds) | Page that answers at 5cfeaed | Page that answers in TM-2.1 |
| --- | --- | --- | --- |
| `/en/no-such-page`, `/ar/no-such-page` | 404 | previous design's localized 404 | **Modern Commerce 404** |
| `/en/foo/bar`, `/ar/foo/bar` | 404 | previous design's localized 404 | **Modern Commerce 404** |
| `/en/services/laser-cutting/extra`, `/en/privacy/extra` | 404 | previous design's localized 404 | **Modern Commerce 404** |
| `/en/services/not-a-service`, `/ar/services/not-a-service` | 404 | previous design's localized 404 | previous design's localized 404 (until TM-2.4) |
| `/en/projects/not-a-project`, `/ar/projects/not-a-project` | 404 | previous design's localized 404 | previous design's localized 404 (until TM-2.5) |
| `/no-such-page` (browser language English) | 307 → `/en/no-such-page`, then 404 | as `/en/no-such-page` | as `/en/no-such-page` |
| `/foo/bar` (browser language Arabic) | 307 → `/ar/foo/bar`, then 404 | as `/ar/foo/bar` | as `/ar/foo/bar` |
| `/api/no-such` | 404 | Next.js's own fallback (outside the language handling) | the same |
| `/en`, `/ar` | 200 | Modern Commerce homepage (published) | the same |
| `/en/privacy`, `/ar/privacy`, `/en/terms`, `/ar/terms` | 200 | previous design, `noindex, follow` | **Modern Commerce**, `noindex, follow` |
| `/en/about`, `/ar/contact`, `/en/services/laser-cutting`, `/ar/projects` | 200 | previous design, `noindex, follow` | the same |
| `/sitemap.xml`, `/robots.txt` | 200 | the sitemap and robots | bodies identical |
| `/en/no-such-page`, `/ar/foo/bar` as page data (`RSC: 1`) | 307 → `?_rsc`, then 200 | the previous design's 404, as page data | the Modern Commerce 404, as page data |
| `/en/services/not-a-service` as page data | 307 → `?_rsc`, then 404 | previous design | previous design |
| `/en/privacy` as page data | 307 → `?_rsc` | as for every page | as for every page |

These are covered by real-response tests in `commerce-inner.spec.ts`:
- "real HTTP status codes";
- "no page-data or prefetch loop";
- "without JavaScript the 404 still answers 404";
- "outside any language".

### 12. SEO parity

- **Privacy and Terms** (EN and AR), compared in the browser with the approved build:
  - all 22 head tags are identical: title, description, canonical, the three hreflang alternates, robots, and the Open
    Graph and Twitter tags;
  - both JSON-LD blocks (WebPage and BreadcrumbList) are identical.
- **The 404.** The server's response carries the localized title and `noindex` in both languages (tested).
- **Homepage.** Its HTML and page data are identical (item 21), so its head, structured data and `published` status
  are unchanged.
- **Sitemap and robots.** The sitemap still lists only `/en` and `/ar`, and robots.txt is unchanged (bodies identical
  to the approved build).

### 13. Publication / noindex status

- `src/lib/page-meta.ts` is unchanged. Privacy and Terms stay `review`: `noindex, follow` and outside the sitemap.
- The homepage stays `published`.
- The 404 is `noindex`.
- Nothing was published or deployed.

### 14. EN / AR

- **English.** TM-1's faces: Plus Jakarta Sans for headings and Inter for text. The legal text runs at 17 px with a
  1.72 line height, in a 44 rem column (82–83 characters a line, measured). A tighter column is a one-value change
  if you prefer one (item 29).
- **Arabic** is fully right to left:
  - the contents sit on the right;
  - the breadcrumb chevrons and the arrows mirror;
  - the note edge and the current-entry bar sit on the starting side.
- **Arabic faces:**
  - Tajawal for headings and for labels set in bold weights;
  - IBM Plex Sans Arabic 400/500 for text, never above 500 (the kit's semibold labels switch to Tajawal in Arabic);
  - never letter-spaced;
  - text at 17.2 px in a 42 rem column, line height 1.85 (31.82 px).
- **Left to right in Arabic.** Email, phone numbers and URLs stay left to right (`dir="ltr"`, tested).
- **Copy.** Unchanged: the Arabic legal text is the site's existing Arabic.

### 15. Light / dark

- Both themes appear on every page and size in the matrix (item 16). The captures show:
  - Privacy: EN light and AR dark;
  - Terms: EN dark and AR light;
  - the 404: both themes.
- Dark uses TM-1's blue-charcoal tokens. The page colour (`#131820`) and the browser theme colour follow, as on the
  homepage.
- The visitor's theme also applies on the 404 that Next.js builds in the browser (tested: dark stays dark, and the
  theme switch shows the right state).

### 16. Responsive QA

- **96 views:**
  - pages: Privacy, Terms and the 404;
  - EN/AR × light/dark;
  - sizes: 1920 × 1080, 1440 × 900, 1280 × 800, 1024 × 768, 834 × 1112, 390 × 844, 360 × 780 and 320 × 700.
- **In every view:** the right status (200 or 404), one `h1`, the requested theme applied, no sideways scrolling and no
  console errors.
- **Contents:** pinned beside the text from 1024 px; a disclosure in the page flow at 834 px and below.
- **Anchor jumps.** Each section heading lands 19 px below the header. Only the last sections, which cannot scroll
  further, land lower (up to 110 px below at 1920 × 1080). No heading lands under the header.
- **Also in the test suite:**
  - every anchor of both pages at 1440 and 390 px, in both languages;
  - no sideways scrolling at 360, 390 and 834 px.

### 17. Accessibility

- **axe-core: 0 violations** in 24 audits: Privacy, Terms and the 404 × EN/AR × light/dark × 1440/390, with the phone
  contents opened.
- **Contrast over the moving background.** axe leaves text over the background and gradients as "needs review". I
  measured that text pixel by pixel, at the background's worst moment (the colour field at full strength, the light
  band centred behind the text). Each was measured in 8 variants (EN/AR × light/dark × 1440/390), and **none is below
  AA**:

  | Text | Worst ratio | Needed |
  | --- | --- | --- |
  | Breadcrumb link | 7.47 : 1 | 4.5 |
  | Breadcrumb current page | 14.21 : 1 | 4.5 |
  | Page title (`h1`) | 14.21 : 1 | 3 |
  | Lead | 7.54 : 1 | 4.5 |
  | Page-fact label | 8.61 : 1 | 4.5 |
  | Page-fact value | 13.95 : 1 | 4.5 |
  | 404 title | 12.02 : 1 | 3 |
  | 404 lead | 7.33 : 1 | 4.5 |

  Text inside the opaque cards (document, contents, notes) is checked by axe directly: 0 violations.
- **Structure.**
  - One `h1` per page, with the sections as `h2`; no level is skipped (tested).
  - Landmarks: header, main and footer.
  - Each `nav` is labelled: main navigation, the phone menu ("Site menu"), language, breadcrumbs ("Breadcrumb" /
    "مسار التنقل") and contents ("On this page" / "في هذه الصفحة").
- **Keyboard only.** I tabbed through Privacy EN, Terms AR and both 404s from the top.
  - The order is skip link → header → breadcrumbs → contents → document links → footer.
  - Every stop shows a focus ring, and nothing focused hides under the sticky header. The skip link appears above the
    header, as on the homepage.
  - The phone disclosure works with Enter and Space, and its entries jump to their sections (tested).
- **Pending notices.** `role="note"` with the text label "Pending confirmation" / "بانتظار التأكيد", so they never rely
  on colour alone.
- **Forced colours (high contrast).** Cards keep their 1 px borders, notes their 4 px edge and the current entry its
  weight, with no overflow.
- **Reflow and zoom.**
  - 320 px: no sideways scrolling.
  - 200 % zoom (a 1280 × 800 window = 640 × 400 CSS px), for Privacy, Terms and the 404 in EN and AR: no overflow, one
    `h1`, nothing clipped; the contents become the disclosure and the header uses its menu.
- **Decoration** (background, pointer, icons, the 404 numeral, the duplicate contents title) is hidden from assistive
  technology (tested).

### 18. Reduced motion

- Nothing in view stays hidden (tested on both pages). The hero text appears without movement.
- The background holds still (TM-1's behaviour), and the kit's state transitions are switched off.
- Anchor jumps are instant.

### 19. No JavaScript

- **Privacy and Terms.** All content is rendered and visible (tested at 1440 and 390 px):
  - the contents list is open and its button hidden;
  - every section is there;
  - the page is light (TM-1's rule).
- **The 404 without JavaScript.** The server still answers 404 with the localized title and `noindex`, but the page
  body is empty.
  - Next.js 16 builds a 404 raised during a dynamic render in the browser.
  - This is true in both designs and on the approved build too: it is not new in TM-2.1 (item 29).

### 20. Performance

- **Nothing new moves.** No new animation, blur, filter, canvas or particles:
  - the same background (one fixed layer with its two moving children);
  - no extra full-screen layer;
  - the contents pin with `position: sticky`;
  - the current section is found with an IntersectionObserver (no scroll handler).
- **Scroll benchmark.** Headless Chromium (software compositing, the worst case) at 1440 × 900. Each run scrolls instantly
  to a new position every frame, top to bottom in 5 s, in a fresh browser, and is checked to reach the bottom.
  Target ≥ 55 fps.

  | Page | Runs (fps) | Mean | 95th-percentile frame | Reached the bottom |
  | --- | --- | --- | --- | --- |
  | Privacy EN | 60.0 / 60.0 / 60.0 | 60.0 | 16.7 / 16.7 / 16.7 ms | yes |
  | Privacy AR | 60.0 / 60.0 / 60.0 | 60.0 | 16.7 / 16.7 / 16.7 ms | yes |
  | Terms EN | 60.0 / 60.0 / 60.0 | 60.0 | 16.7 / 16.7 / 16.7 ms | yes |
  | Terms AR | 60.0 / 60.0 / 60.0 | 60.0 | 16.8 / 16.8 / 16.8 ms | yes |
  | 404 EN | 60.0 / 60.0 / 60.0 | 60.0 | 16.8 / 16.7 / 16.8 ms | yes |
  | Homepage, TM-2.1 | 56.2 / 56.6 / 55.6 | 56.1 | 33.3 / 33.2 / 33.3 ms | yes |
  | Homepage, approved build | 55.6 / 56.0 / 50.4 | 54.0 | 33.3 / 33.3 / 33.3 ms | yes |
  | Privacy EN, previous design (approved build) | 56.0 / 55.2 / 50.2 | 53.8 | 33.3 / 33.3 / 33.4 ms | yes |

  The legal pages and the 404 hold 60 fps. The homepage is unchanged and measures the same on both builds; single
  runs vary by a few fps in this container.

- **Page weight.** What a first visit downloads at 1440 × 900, with nothing cached, after scrolling to the bottom:

  | Page | Total | HTML | CSS | JS | Fonts | Images | Other | Requests |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Homepage EN | 901 KB | 58 KB | 22 KB | 160 KB | 84 KB | 578 KB | 0 KB | 61 |
  | Privacy EN | 274 KB | 26 KB | 20 KB | 144 KB | 84 KB | 0 KB | 0 KB | 13 |
  | Terms AR | 419 KB | 25 KB | 20 KB | 144 KB | 230 KB | 0 KB | 0 KB | 22 |
  | 404 EN | 260 KB | 12 KB | 20 KB | 145 KB | 84 KB | 0 KB | 0 KB | 13 |
  | Privacy EN, previous design | 715 KB | 29 KB | 31 KB | 192 KB | 270 KB | 0 KB | 193 KB | 58 |
  | Terms AR, previous design | 782 KB | 29 KB | 31 KB | 192 KB | 329 KB | 0 KB | 202 KB | 61 |

  The legal pages and the 404 are much lighter than the homepage, and lighter than the same pages in the previous
  design. On the previous design's Privacy page, all 34 "other" requests are page-data prefetches of the pages it links
  to, made as their links come into view. The Modern Commerce pages use plain links, which load a page only when it
  is opened.

### 21. Homepage regression proof

Compared with a clean build of the approved commit (5cfeaed), built side by side.

- **Files.** All 12 homepage files are identical once build ids and hashed file names are normalised: the EN/AR HTML,
  the page data and its segments.
- **CSS.** The Modern Commerce stylesheet keeps all 808 approved rules unchanged. The 94 added rules are the kit's
  (item 6), and the homepage has no element they can match: no `ip-*` class, no `t-h1`, no marked footer link.
- **JavaScript.** In both languages the homepage loads the same 180 modules, at the same total of 644,630 bytes.
  - Turbopack moved one module (the service icons) into the neighbouring chunk. So 8 of the 10 chunk files are
    byte-identical, and the other two hold the same 72,973 bytes between them.
  - An earlier build had added 1,084 bytes here (the 404's language link, imported by the shared header). I fixed it
    before committing: the 404 now passes that link in itself.
- **Pixels.** 65 captures, with reduced motion and every image loaded:
  - homepage, full page: EN light and AR dark at 1440;
  - homepage, screen by screen: EN dark at 390 (15 screens) and AR light at 390 (14 screens);
  - six pages in the previous design: About, Contact, Certificates, Projects, Industries and Laser Cutting.

  In the final run, 63 captures are byte-identical. Two EN dark phone screens differed by 21 pixels in total, each by
  1–2 colour levels out of 255, which is invisible. I captured that view again, twice on each build, and all four runs
  were identical (15 of 15 screens). So this was one-off rendering noise, not a change. The full-page homepage
  captures show 0 differing pixels (contact sheet 5).
- **Behaviour.** The homepage spec (`commerce-home.spec.ts`) passes in full:
  - the 10 s hero loop (cycle timing, resting off screen and in a hidden tab, and the static finished plate with
    reduced motion);
  - the signatures, the background and the pointer;
  - the header, the footer, the language switch and the theme;
  - the six project cards → `/projects#gallery`, and "Start a Project" → `/contact#quote`;
  - no sideways scrolling from 360 to 1920 px.
- **Scroll.** The homepage measures the same on both builds (item 20).

### 22. Theme Lab regression proof

- **Source.** No lab file was touched: `git diff` is empty for `src/app/theme-lab` and `src/components/theme-lab`.
- **CSS.** `lab.css` (54,497 bytes) and `signature.css` (4,446 bytes) are byte-identical.
- **Built files.** 80 of the 96 built lab files are identical. The other 16 are the A V2 homepage and system sheet, in
  EN and AR.
  - Their visible markup is identical.
  - Their page data differs by one more JavaScript chunk tag: Turbopack split the shared Modern Commerce modules into
    11 chunks instead of 10 (645,154 → 645,268 bytes, +114).
  - Options A, B and C are identical.
- **Tests.** `theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` pass in the full run.

### 23. Old test → new test mapping

Six tests moved out of the specs for the previous design. Every assertion is kept or replaced by a stronger one:

| Old test | Its assertions | New test(s) |
| --- | --- | --- |
| `stage-1c › legal pages › privacy: contents, sections, pending notes and contact` | more than 5 sections; one contents link per section; each anchor exists; "Pending confirmation" shown; one `time[datetime^="2026-09-"]`; the mailto link in `address` (English only) | `commerce-inner › legal pages › privacy (en)` and `privacy (ar)`: the exact section ids in order; one contents link per section, to `#id`; each pending note in its section, labelled, and none elsewhere; `time[datetime]` = the content's date; the email (left to right) and both phones; every paragraph and list item of the content; one `h1`, then `h2`s; the new design; no overflow or console errors |
| `stage-1c › legal pages › terms: …` | the same, for Terms | `commerce-inner › legal pages › terms (en)` and `terms (ar)`, the same checks |
| `stage-1c › legal pages › the table of contents is a disclosure on phones` | `/ar/privacy` at 390 px: entries hidden, then shown after opening | `commerce-inner › phone › the contents are a disclosure above the text`: the same page and size; hidden → tap → shown; `aria-expanded` and `aria-controls`; in the page flow; Enter, Space and Tab to an entry; Enter jumps to the section; no overflow. The `<details>` became a button with `aria-expanded`, as the brief asks. |
| `stage-1c › localized 404 › en` and `› ar` | `/{locale}/no-such-page`: status 404, the `h1` text, `dir` | `commerce-inner › localized 404 › an unknown page shows the new design's 404 in each language`: status 404, the `h1`, `lang` and `dir`, one `h1`, title, `noindex`, Home and Contact links, no current page, the language switch keeps the address; plus `› real HTTP status codes` (`/en/no-such-page` and `/ar/no-such-page` → 404 with title and `noindex`) and `commerce-home.spec.ts` (`/en/no-such-page` → 404 in the new design) |
| `visual-system › decorative layers are hidden from assistive technology` (its path list included `/ar/privacy`) | the decoration on `/ar/privacy` is `aria-hidden` | `/ar/privacy` left the list (the test checks the previous design's decoration); `commerce-inner › legal pages › decoration is hidden from assistive technology` checks `/ar/privacy`, `/en/terms` and both 404s |
| `visual-system › legal contents mark the section being read` | `/en/privacy`: the first entry is marked; clicking the third marks it, and only it; back at the top, the first is marked again | `commerce-inner › legal pages › the contents mark the section being read, and a chosen entry at once`: the same steps, plus the address's `#hash`, a section reached by scrolling is marked, and the contents stay below the header |

**Still covering Privacy and Terms from `stage-1c.spec.ts`** (unchanged; they run on the new pages):
- "routes, language and SEO": status, `lang`/`dir`, one `h1`, breadcrumbs, JSON-LD, canonical, hreflang, social tags,
  `noindex`;
- "the sitemap lists published pages only";
- "no sideways scrolling" at 360, 390 and 834 px;
- "reduced motion on inner pages";
- "inner pages without JavaScript".

**New, with no earlier equivalent:**
- the shell's current-page marks;
- anchor landings;
- no prefetch from the previous design;
- the contents without JavaScript;
- the HTTP status matrix;
- the previous design's 404 for unknown slugs;
- the theme on the 404 built in the browser;
- no page-data loop;
- the 404 without JavaScript;
- the fallback outside any language;
- the sitemap and robots.

**Count:** 227 tests before − 6 moved + 19 new = **240**.

### 24. lint

`npm run lint` (eslint): **passed**, exit 0, no warnings.

### 25. typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): **passed**, exit 0.

### 26. build

`npm run build`: **passed**, and all 125 static pages were generated. Privacy and Terms are prerendered for both
languages, and the catch-all is dynamic.

### 27. e2e results

`npm run test:e2e` (Chromium, against the production build): **240 passed, 0 failed, 0 skipped, 0 flaky**
(6.6 min). `commerce-inner.spec.ts` contributes 19 tests.

### 28. Screenshots

Sent in the chat as contact sheets (not committed, as in earlier stages), with motion on except for the homepage proof.
They were taken just before the last fix: it changed where the header gets the 404's language link, but no markup or CSS.
The final build then passed the same matrix, accessibility and pixel checks.

1. `1-privacy-desktop.png`: Privacy EN light and AR dark at 1440 × 900 (top; section 05 with its pending note; section 14
   with the contact block).
2. `2-terms-desktop.png`: Terms EN dark and AR light at 1440 × 900 (top; section 03 with its pending note; section 09).
3. `3a-privacy-mobile.png`: Privacy on a 390 × 844 phone, EN light and AR dark (top; contents opened; a section with a
   pending note).
4. `3b-terms-mobile.png`: the same for Terms, EN dark and AR light.
5. `4-not-found.png`: the 404 in EN light and AR dark at 1440, and on phones at 390 (EN dark, AR light) and 320 px.
6. `5-homepage-before-after.png`: the homepage, approved build vs TM-2.1, EN light and AR dark, full page, with the
   amplified difference (black: 0 differing pixels).

### 29. Known limitations

1. **The 404 without JavaScript shows an empty page.** The status, title and `noindex` are right. Next.js 16 builds a
   404 raised during a dynamic render in the browser. The previous design and the approved build behave the same, and
   changing it needs a different 404 mechanism, so I left it as it was.
2. **Unknown service and project slugs** still show the previous design's 404 (real 404 status) until those routes move
   (TM-2.4, TM-2.5).
3. **`/api/…` addresses**, which are outside the language handling, still get Next.js's own 404, as before.
4. **The scrolled header has no blur in Chromium.**
   - The CSS build keeps only the `-webkit-` prefixed `backdrop-filter`, which Chromium ignores. So text scrolled under
     the header shows faintly through it (80 % opaque).
   - The approved homepage looks the same. Fixing it would change the frozen homepage, so it waits for your decision.
5. **The hero's reading zone** (TM-1's text protection, 90 % page colour) is faintly visible as a lighter panel over the
   warm glow in the light theme.
6. **Unused kit parts.** `ClosingCta` and the `split` / `stacked` hero layouts are built but no page uses them yet. Their
   first real use, and your visual check, come in TM-2.2/2.3.
   - The migration plan listed a closing call to action for the legal pages. The pages have none in their content, so
     I added none.
7. **At 320 px**, the 404's small label wraps onto two lines.
8. **A V2 lab JavaScript.** The theme lab's A V2 pages load their unchanged JavaScript in 11 chunks instead of 10
   (+114 bytes), because Turbopack re-split the shared modules.
9. **Unused previous-design components.** `src/components/legal/*` is now unused. It stays until TM-2.6, so that the
   previous design's CSS stays byte-identical.
10. **Homepage scroll rate.** In this container single homepage runs vary between about 50 and 56 fps, on both builds
    alike (means 56.1 on TM-2.1 and 54.0 on the approved build; item 20). That reflects this machine; the homepage
    itself is unchanged.
11. **The 404's tab title.** The 404 is built in the browser, and its tab title is restored once the page is ready. For
    a moment the tab can show "RAWASY".
12. **English text column.** It is 44 rem wide: 82–83 characters a line at 17 px. If you prefer a tighter measure
    (for example 40 rem, about 75 characters), it is a one-value change in the kit's CSS.

### 30. Outstanding RAWASY confirmations

**On these pages** (the pending notes, unchanged and shown on the pages):

| Page and section | What RAWASY needs to confirm |
| --- | --- |
| Privacy 05, Sharing | The statement, and whether other parties (for example subcontractors or transport providers) receive project information. |
| Privacy 08, Technical information | The hosting provider and its log settings, before launch. |
| Privacy 09, Other services | The Google Maps embed wording, with its legal adviser, before launch. |
| Privacy 11, How long we keep information | Specific retention periods. |
| Privacy 12, Your choices | How requests are handled, and any legal requirements that apply. |
| Terms 03, Intellectual property | Licences for the stock and supplier photography used on the site (see the asset inventory). |
| Terms 07, Liability | Legal review of the wording, before launch. |

**Still open from earlier stages:**
- RAWASY's own Google Maps place link;
- image rights and the AI-watermarked images;
- the licence renewal and registration numbers;
- the certificate redactions (numbers, QR codes and names stay hidden until approved);
- the rest of the list in `docs/ASSET_INVENTORY.md`.

---

### How to run

```bash
npm install
npm run build && npm run start      # http://localhost:3000/en/privacy, /ar/terms, /en/no-such-page
npm run lint && npm run typecheck
npm run test:e2e                    # after a build; starts or reuses a server on port 3400
npx playwright test e2e/commerce-inner.spec.ts   # this batch's tests only
```

To roll back TM-2: the branch `preserve/pre-tm2` (`5cfeaed`).

### Next steps

- **Your review of TM-2.1.** If you approve it, TM-2.2 (Contact) is next. I will not start it until you say so.
- **Open decisions you may want to take:**
  - the header blur (item 29.4);
  - the empty 404 without JavaScript (item 29.1);
  - the English text column's width (item 29.12).
