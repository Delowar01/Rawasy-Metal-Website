# Stage 1F — Project pages (source-strict project records, Modern Commerce)

Date: 2026-10-04 · Branch: `claude/new-session-5eijs6` · Status: **built, returned for independent review** (not signed off
by the builder; nothing published or deployed).

## Summary

The 34 project records of `src/content/projects.ts` now have their own pages in English and Arabic
(`/<locale>/projects/<slug>`, 68 pages), in the Modern Commerce design. Each page is a **project record from the
company profile, not a case study**: it shows only what the record holds — the title, the existing summary (exactly),
the website's classifications, the related services, the gallery reference ("Company profile · Ref. 04" /
"Company profile · p.3") and the photos that may be shown. Client, location, year, materials, scope, description,
challenge and solution appear only once a record holds them; no record does, so no page shows them.

Photos follow one helper, `projectDetailMedia(project)`, by flag (never by title): a project awaiting authorship
(`confirm-authorship`) or product-ownership (`render`) confirmation shows none — as does any flag added later — and every
other project shows `projectImages(project)`, so the AI-watermarked files in `withheldMedia` never show anywhere. One
reusable page with data-driven variants: 17 pages with several photos (the first leads, the rest follow once each in
"More photographs"), 10 with one photo, 7 text pages (a typographic source plate, no picture or stand-in). Every photo is
shown at most at its source size (588 measurements, largest display/source ratio 1.0000).

The project route moved from `planned` to `review` (`noindex, follow`, not in the sitemap); `PlannedPage` and
`planned.css` retired (no route used them any more). The Projects overview's 27 gallery cards each gained one explicit
link, "View project" / "عرض المشروع"; nothing else on the overview changed, and every other page is byte-identical to the
Stage 1E build (served HTML, page data, CSS and JS, and pixels).

QA run: lint, typecheck, build, the full e2e suite (final run on the final build: 511 tests, 511 passed, 0 failed, 0
skipped, 0 flaky; each of the two full runs before it caught timing races in tests of frozen pages, fixed in test-only
commits); freeze proofs against the Stage 1E build; a 288-state responsive matrix (0 failing); axe in 36 states (0
violations); per-pixel contrast (0 failures on the project pages); scroll ≥ 59.9 fps; the 23 evidence screenshots (26
files).

---

## 1. `preserve/pre-stage-1f` SHA

`c2aed5814c73bc18596a3d11f3955c80a13ef0dd` — created and pushed without force (`git push origin
c2aed58…:refs/heads/preserve/pre-stage-1f`; the branch did not exist before), verified with `git ls-remote`.

## 2. Starting SHA

`c2aed5814c73bc18596a3d11f3955c80a13ef0dd` (local = `origin/claude/new-session-5eijs6`, clean tree; Stage 1E present;
`preserve/pre-stage-1e` = `ca672d78760234f5b13055f0e60cf1ffde004e39`; no drift).

## 3. Implementation SHA

`e5b814bffccd0719608190d80d8d4a44b09d27b8` — "Build the Stage 1F project pages from the project records" (on
`c2aed58`). Followed by two test-only commits (item 55): `cee1236ec5ab53c21d9f8b80d9ba1ac524af65ae` — "Read the homepage
switch only once its transitions end (test only)", and `cfc17d55e93ae189486f55840a1bcb9a1952290a` — "Wait for hydration
and for a glide to land in two tests (test only)". Product code is the implementation commit's in both.

## 4. Branch HEAD

Two documentation commits on top of `cfc17d5`: `00c8204200280927f6b788990765c1af70dd5a8f` adds this report and the
documentation, and the next one adds this report's "How to run" and "Next steps" sections. The branch HEAD (that second
commit) is given in the hand-over message, since a commit cannot contain its own hash.

## 5. Files changed

Implementation commit:

| File | Change |
| --- | --- |
| `src/content/projects.ts` | `projectDetailMedia()` — the project pages' photo rule (by flag). `projectImages`, `isShowcased`, `featuredProjects`, `withheldMedia` unchanged. |
| `src/content/types.ts` | `ProjectDetailPageContent` (labels only). |
| `src/content/pages.ts` | `projectDetailPage`: EN/AR labels (eyebrow, facts, source, photographs, photo alt pattern, the optional details' labels, back, quote, closing panel). |
| `src/content/repository.ts` | `getProjectDetailContent(slug)`. |
| `src/lib/page-meta.ts` | `project: "planned"` → `"review"`. |
| `src/app/(commerce)/[locale]/projects/[slug]/page.tsx` | Renders the project page; same `generateStaticParams`, `dynamicParams = true`, `notFound()`; JSON-LD WebPage + BreadcrumbList. |
| `src/components/commerce/project-detail/ProjectDetailPage.tsx` | New: the page (server component, no client code). |
| `src/components/commerce/project-detail/data.ts` | New: `projectDetailView()` — the page's view from the record only. |
| `src/components/commerce/project-detail/project-detail.css` | New: `pd-*` styles (4,160 bytes built), imported by the page only; also the header's Projects section mark (moved from `planned.css`). |
| `src/components/commerce/projects/Gallery.tsx`, `ProjectsPage.tsx`, `data.ts`, `projects.css` | The overview cards' "View project" link (`a.pj-card-go`); `ProjectView.href`; `categoryList()` shared with the project page; 7 added CSS rules. |
| `src/components/commerce/planned/PlannedPage.tsx`, `planned.css` | Deleted (no route uses them). |
| `e2e/commerce-project-detail.spec.ts` | New (33 tests), replaces `e2e/commerce-planned.spec.ts` (deleted). |
| `e2e/commerce-projects.spec.ts` | 3 tests rewritten for the card links and the built pages, 1 added. |
| `e2e/commerce-capabilities.spec.ts` | `pageStatus.project` now `review` (one assertion). |
| `e2e/commerce-home.spec.ts`, `commerce-inner.spec.ts`, `commerce-services.spec.ts`, `site.spec.ts`, `stage-1c.spec.ts` | Wording only (comments, two test titles); no assertion changed. |

Test-only commit `cee1236`: `e2e/commerce-polish.spec.ts` — the homepage switch test reads the switch only once its
transitions have ended (item 55).

Test-only commit `cfc17d5`: `e2e/commerce-capabilities.spec.ts` — "choosing a machine" polls its first read until the
page has hydrated; `e2e/commerce-inner.spec.ts` — the legal contents test lets the chosen entry's glide land before it
scrolls on (item 55). Every assertion kept.

Report commits: this report, `CLAUDE.md`, `README.md`, `docs/ASSET_INVENTORY.md` (items 19–22) in `00c8204`; this
report's "How to run" and "Next steps" in the commit after it.

## 6. Route architecture

- One route: `src/app/(commerce)/[locale]/projects/[slug]/page.tsx`. `generateStaticParams` = 2 locales × 34 records
  (68 pages, all prerendered, `●` SSG); `dynamicParams = true`; an unknown slug calls `notFound()` →
  `projects/[slug]/not-found.tsx` (re-exports `(missing)/not-found`): a real 404 with the localized Modern Commerce 404,
  `lang`/`dir` set, `noindex`. Deeper paths reach the catch-all 404. No second route, no redirect.
- `generateMetadata`: title = the record's title, description = its summary, canonical, hreflang en / ar / x-default,
  `robots: noindex, follow` (from `isPublished("project")`).
- Page: `getProjectDetailContent(slug)` → `projectDetailView(content, locale)` → `ProjectDetailPage` inside `PageShell`
  (`getShellView(locale, { route: "project", … })`: the header marks Projects as the section, `aria-current="true"`).
- Static generation: 125 pages before and after (no count change; the 68 project pages were already prerendered as
  planned pages).

## 7. Project count

**34 records — none added, none removed** (`expect(projects).toHaveLength(34)`, unique slugs). 27 are showcased in the
overview's gallery, 7 are held back (3 `confirm-authorship`, 2 `render`, 2 with only a watermarked photo). 68 pages
(34 × EN/AR), each answering 200.

## 8. planned → review

`src/lib/page-meta.ts`: `project: "review"` (the overview `projects` stays `review`; only `home` is `published`). Every
project page serves `<meta name="robots" content="noindex, follow"/>` (checked on all 68) and the sitemap still lists
only `/en` and `/ar`.

## 9. PlannedPage removal

Usage audited first: `PlannedPage` was used by the project route only (Capabilities left it in Stage 1E). With the project
pages built, no route uses it, so `PlannedPage.tsx` and `planned.css` were deleted. `planned.css`'s only other job — the
header's Projects section mark on a project page — moved unchanged into `project-detail.css`. Proof that nothing else
moved: the shared Modern Commerce stylesheet is byte-identical (1,250 rules, 0 removed, 0 added; same file
`0gk3s2azvb6o6.css`), so no utility disappeared with the deleted file. The dictionary's `placeholder` keys stay (the same
policy as the retired shell's keys: removed only after a usage audit).

## 10. Shared architecture

One page component for every record (`ProjectDetailPage.tsx`) fed by one view builder (`data.ts`) that reads only the
record, the media registry, the category labels and the service names. The kit's `PageHero` (split) gives the first-paint
hero (TM-3 rule, `PageHero` itself unchanged), `ClosingCta` the closing panel. No client JavaScript: the project pages'
script set is byte-identical to the planned pages' (10 files, 625,655 bytes). Labels live in the content layer
(`projectDetailPage`), so Phase 2 can replace the storage behind `getProjectDetailContent` without touching the page.

## 11. Layout variants

Chosen by the data, not by the project:

| Variant | Records | Hero aside | Below the hero |
| --- | --- | --- | --- |
| several photos | 17 | the first photo on its stage, the reference under it | "More photographs": the others, each once, at most at source size |
| one photo | 10 | that photo on its stage, the reference under it | — |
| no photo | 7 | the source plate: "Company profile", "Ref." and the reference set as type | — |

Then (all variants) the closing panel: Request a quote (`/contact#quote`), Back to Projects, Our services. Optional
details (rows: client, location, year, materials, scope; passages: description, challenge, solution) render only for the
fields a record holds; none does, so the part never appears (no empty section).

## 12. Media-safety helper

```ts
const photoSafeFlags: readonly ProjectFlag[] = ["ai-watermark"];
export function projectDetailMedia(project: Project): MediaId[] {
  if (project.flags?.some((flag) => !photoSafeFlags.includes(flag))) return [];
  return projectImages(project);
}
```

Equivalent to the brief's rule for the three flags in use (`confirm-authorship` → none; `render` → none; otherwise
`projectImages`, withheld files excluded), and safer for the future: any flag not listed in `photoSafeFlags` holds every
photo back until someone decides otherwise (tested with a made-up flag). Flags, never titles. `isShowcased`,
`featuredProjects`, `withheldMedia` and the overview's showcase behaviour are unchanged.

## 13. Withheld proof

`withheldMedia` = `projects/wheat-monument-1`, `projects/stainless-landmark-1`, `projects/billboard-structure-1` (asserted).
For all 68 pages, both the served page and its page data (`RSC: 1`) are scanned: the set of media files they refer to
(plain or URL-encoded) equals exactly the page's allowed photos, and no withheld file appears by path, encoded path or
registry id. In the browser, each flagged project's requests are recorded in both languages: no request for a withheld
file.

## 14. confirm-authorship proof

`illuminated-lattice-cubes` (#02), `perforated-seed-sculpture` (#17), `canopy-tree-sculpture` (p.3): no `<img>`, no
`picture`, no image preload, no `/_next/image` or `/media/` reference in the page or its page data, no image request,
no background picture in `main`, no other project's photo — in both languages (tests by flag). Each shows the source
plate.

## 15. render proof

`laser-cut-bench` (#12) and `street-litter-bins` (#28): the same checks as item 14 — no file of theirs (or anyone's)
reaches the page, the page data or the network. Their summaries are shown exactly as the records hold them (see known
limitations: the bench's summary says "(design render)").

## 16. AI-watermark behaviour

`ai-watermark` alone does not hide a project: its files in `withheldMedia` never show, its other files may. Result:
the wheat monument shows its two workshop photos; the stainless landmark and the billboard structure, whose only photo is
withheld, become text pages. No flag is ever shown as a badge or explained on the page.

## 17. Wheat Stalks Monument

Shows `wheat-monument-2` (lead) and `wheat-monument-3` ("More photographs"), never `wheat-monument-1` (watermarked
finished photo): absent from the markup, the page data and the requests, in EN and AR (dedicated test). Reference
"Company profile · Ref. 07–08" (raw value kept).

## 18. Stainless Steel Landmark

Text page: title, summary, classifications (Public Realm · Architectural Metal), related service (Metal Fabrication),
source plate "Company profile / Ref. 14". No image of any kind, no image request (tested by flag).

## 19. Billboard Support Structure

Text page as item 18 (Structures · Industrial; Steel Structures · Metal Fabrication; Ref. 21). No image, no request.

## 20. Internal-note protection

Two records carry a `note` (the wheat monument, the gateway signs). Tests on all 68 pages, page and page data: the note
text never appears, nor the words "watermark", "Badr"/"بدر", `"note"`, `"flags"`, `ai-watermark`, `confirm-authorship`.
The page component receives only the view (`projectDetailView`), which never copies `note` or `flags`.

## 21. Source audit

Every visible fact traces to the record or the shared registries: title and summary (record, verbatim), classifications
(record's `categories` with `projectCategories` labels), related services (record's `services` with the services'
names), gallery reference (record's `galleryRef`, raw), photos (record's `media` through `projectDetailMedia`), labels
(`projectDetailPage`, which reuses the website's existing wording where it exists: "Selected work", "Ref.", "Request a
quote").
Nothing from EXIF, signage, file names, web search, social media, location assumptions, inference or common practice.
The photo alt text is the title, or "title, photo n of N" (no invented captions or phases).

## 22. Optional fields

No record holds client, location, year, materials, scope, description, challenge or solution (audited: 0 of 34 for each).
The rule is tested on made-up records (`projectDetailView`): a field shows with its own label only when present; empty
values (" ", "", empty lists) count as absent; materials join per language. On every real page the facts are exactly
"Classification" and "Related services"; no detail label (EN or AR), no "Value"/"Duration", and no stand-in value ("—",
"N/A", "TBC", "Not stated", "Confidential", "Unknown"…) appears.

## 23. Category parity

On all 68 pages the Classification list equals the record's `categories`, in order, with the `projectCategories` labels
in the page's language. No new category.

## 24. Service parity

On all 68 pages the Related services list equals the record's `services`, in order, each linking
`/<locale>/services/<slug>` with the service's name. Wording "Related services" / "الخدمات المرتبطة".

## 25. galleryRef

Shown as a source, under the lead photo or on the plate: "Company profile · Ref. 04", "Company profile · Ref. 07–08",
"Company profile · p.3" (a page reference takes no "Ref."); Arabic "الملف التعريفي · المرجع 04". The raw value sits in
a left-to-right isolate and is asserted equal to the record's `galleryRef` on every page; "Project number" / "Job
number" never appear.

## 26. Image-size measurements

All 27 pages with photos × EN/AR × 1920, 1440, 1024, 834, 390, 320 px: **588 measurements, largest display/source ratio
1.0000** (the tulip at 1920: 464 × 356 shown for a 464 × 356 file), **0 photos outside their frame**. The e2e suite repeats
this at 1440 and 390 on every page with photos, and at twelve sizes on the representatives. A photo keeps its width
attribute (`max-width: 100%`, `height: auto`); frames fit the photo; no full-bleed hero.

## 27. No-JS

Every variant is complete from the server (six representatives × EN/AR in the suite): title, facts, photos, closing
panel; no hidden reveal; light theme. Links work without script. Evidence 16.

## 28. Reduced motion

Nothing in view stays hidden (four pages); the hero, its photo or plate included, is at opacity 1 at once. The pages add
no animation; the gallery has no reveal.

## 29. EN/AR

Both languages on all 68 pages: the same record (title and summary in the page's language), the language switch keeps
the slug in all three header switches (desktop, phone control, menu sheet) and leads to the same record, `NEXT_LOCALE`
set. Slugs are never translated.

## 30. RTL

`dir="rtl"`: "More photographs" reads from the right (first photo rightmost, one row at 1440), photos never mirrored
(no negative transform or scale on any photo or ancestor), references and slugs left to right, Tajawal headings, IBM
Plex Sans Arabic text, no letter-spacing on Arabic.

## 31. Light/dark

Both themes on every variant (page colour, stage, print and plate surfaces asserted per theme; the matrix runs all 288
states in both). Evidence 2, 7, 12, 14.

## 32. Forced colours

Links keep their underline, the reference dot and the plate's edge take `CanvasText`, borders and focus rings stay
visible, nothing relies on a background; axe clean in forced colours. Evidence 15, 15b.

## 33. Responsive matrix

12 sizes (1920×1080, 1440×900, 1280×800, 1024×768, 834×1112, 430×932, 412×915, 393×852, 390×844, 375×812, 360×780,
320×700) × EN/AR × light/dark × six representatives (several photos: clock tower; one photo: palm canopies; watermark
with workshop photos: wheat; watermark with none: stainless; authorship: lattice cubes; render: bench) = **288 states,
0 failing**: no sideways scroll, nothing outside the screen, no text outside its box, no cut title, no photo above its
source size or outside its frame, no console error, the right theme and direction. 200 % zoom (640 × 360 CSS px): no
overflow on the six representatives in either language.

## 34. Accessibility

- axe-core 4.13 (WCAG 2.0/2.1/2.2 A and AA + best practice), 36 states (the six representatives × EN/AR × light/dark at
  1440, three phone pages × EN/AR, forced colours on two pages, the overview × EN/AR × light/dark): **0 violations, 0
  serious/critical**. "Needs review" items are colour contrast over gradients, measured per pixel instead.
- Per-pixel contrast (unrounded, text hidden for the background capture, header hidden in place): **0 text nodes below
  AA on all 32 project-page runs** (7 pages × EN/AR × light/dark at 1440, 2 at 390). The overview: 0 below AA among the
  new "View project" links; 2 pre-existing nodes, the aria-hidden "Ref. 04" caption on a print of the hero collage
  (identical ratios on the Stage 1E build: unchanged, frozen part).
- Manual (scripted): one `h1`; outline h1 → h2 More photographs → h2 closing panel; landmarks header / main / footer and
  labelled navs; breadcrumb with `aria-current="page"`; photos with alt text; keyboard: 26 stops from the top of the clock
  tower page to the footer, 10 in `main` (the two breadcrumb links, the three service links, quote, back, the closing
  panel's three links; 24 and 8 on the Arabic stainless page), every stop with a visible focus ring and fully in view
  once the page has glided to it; the classification and service separators are not read out (`content: "·" / ""`).

## 35. Overview CTA

Each of the 27 showcased gallery cards (`li#<slug>`, id unchanged) holds one link under its classifications: "View
project" / "عرض المشروع", accessible name "View project: <title>", to `/<locale>/projects/<slug>`; the card itself is not
a link. Hidden cards' links leave the tab order with them. Tab order: featured, highlights, the bar's nine toggles, the 27
card links in wall order, then the index. The featured project, the highlights and the Project Index still jump to
`#<slug>`. Evidence 17, 17b.

## 36. Overview regression

- Files: 8 of the overview's 12 prerendered files differ; resolved page data differs only by the `view` label and one
  `href` per project (27). CSS: the overview sheet gained 7 rules, removed none; JS +214 bytes (the card link in the
  gallery chunk).
- Pixels (EN/AR × light/dark, animations held): hero, featured project and highlights **0 pixels differ**; the Project
  Index and the closing panel **0 pixels differ** with the wall hidden on both builds (the taller wall moves them down);
  the wall itself **0 pixels differ** with the new link hidden on the Stage 1F build — the link is the only change.
- All 27 anchors, `#gallery`, filters, the one-row sticky bar, ordering, the index, direct anchors and no-JS: the existing
  overview tests pass unchanged.

## 37. Homepage links

Unchanged: the six cards open `/projects#gallery`. Homepage files identical (12/12), stylesheets and scripts identical,
pixels identical (EN/AR × light/dark at 1440 full page and the 390 projects section: 0 pixels differ). Evidence 20.

## 38. About D4

About's four cards still open `/projects#<slug>`. Files identical (the only change in two About files is the position of
Next's `next-size-adjust` meta in `<head>`, known build noise); pixels of `#work` identical in all four states. Evidence 22a.

## 39. Service D4

The service pages' project cards still open `/projects#<slug>`; all 96 service files identical; pixels of Laser Cutting's
and Fabrication's `#projects` identical in all four states. Evidence 22b.

## 40. Contact

Contact files identical (12/12); `#quote` pixels identical in all four states; the project pages' quote links are exactly
`/<locale>/contact#quote` (no query, no prefill — the form opens empty, tested); `QuoteForm` untouched, its golden-output
tests pass.

## 41. Stage 1E

Capabilities files identical (12/12), stylesheets and scripts identical, full-page pixels identical (EN/AR × light/dark).
The 1E spec passes; its one status assertion now reads `pageStatus.project === "review"`. Evidence 21.

## 42. Certificates

Certificate files identical; the eight file hashes and the digit guard pass in the full suite
(`commerce-certificates.spec.ts`).

## 43. Theme Lab

All 96 lab files identical; lab JS identical; pixels identical (A V2 EN, A, the A V2 system sheets). One A V2 Arabic
capture showed a 27 px band under the header in one of three captures; three captures per build showed the same build
differing from itself in that band (capture timing), the other captures identical across builds. No project-detail lab
page was made. Evidence 23.

## 44. SEO

All 68 pages: `<title>` "<project title> | RAWASY/رواسي", description = the record's summary, canonical, hreflang en / ar /
x-default, Open Graph and Twitter from `buildMetadata`, `robots: noindex, follow`. No fake facts.

## 45. Structured data

Exactly two blocks per page: `WebPage` (name, description, url, inLanguage, isPartOf the site, about the organization —
its keys asserted) and `BreadcrumbList` (Home → Projects → project, with URLs). No client, date, location, material,
award or image.

## 46. noindex / sitemap

`noindex, follow` on all 68; the sitemap lists `/en` and `/ar` only (asserted).

## 47. All known routes

68/68 answer 200 (34 × EN/AR, request-level test), each with its own record.

## 48. Unknown 404

`/en|ar/projects/not-a-project` (and deeper paths) → 404 with the localized Modern Commerce 404, `<title>` in the
language, `noindex`, `lang`/`dir`, language switch keeping the address, theme applied, no redirect; page data: one 307
to the cache-keyed address, then 404 (no loop). Evidence 19.

## 49. Performance

Headless Chromium (software compositing, the worst case), 1440 px, cold loads, compared with the planned pages on the
Stage 1E build:

| Page | Requests | Transferred | JS | CSS | Images | LCP | CLS | Scroll |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EN clock tower (3 photos) | 22 (16) | 315.2 KB (288.3) | 9 files 154.0 KB (=) | 27.8 KB (26.7) | 19.3 KB | 360 ms (296) | 0 | 59.9 fps |
| AR clock tower | 31 (25) | 462.1 KB (434.9) | = | 27.8 KB | 19.3 KB | 412 ms (384) | 0.002 (0.0027) | 60.1 fps |
| EN palm canopies (1 photo) | 18 (16) | 305.6 KB | = | 27.8 KB | 10.7 KB | 368 ms (320) | 0 | 60.1 fps |
| AR palm canopies | 27 (25) | 452.5 KB | = | 27.8 KB | 10.7 KB | 372 ms (388) | 0.0025 (0.0027) | 60.1 fps |
| EN stainless (text) | 16 (16) | 290.4 KB (288.3) | = | 27.8 KB | 0 | 296 ms (308) | 0 | 60.0 fps |
| AR stainless | 25 (25) | 440.5 KB (434.9) | = | 27.8 KB | 0 | 364 ms (388) | 0.0189 (0.015) | 60.1 fps |

Image requests: each photo is fetched once, at one size; the counts also include data-URI images that transfer nothing
(each photo's blur placeholder and the ambient's light sweep, which every page has): 7 on the clock tower page = 3 photos
+ 3 placeholders + the sweep; 1 on a text page = the sweep.

Overview (5 cold loads each, median): EN LCP 368 ms (Stage 1E 416), AR 568 ms (540), CLS identical (0 / 0.0049);
same 72 / 81 requests, +0.8 KB. No WebGL, canvas, particles, video, third-party script, extra ambient layer or
backdrop filter. The Arabic CLS comes from the Arabic faces swapping in (not preloaded; the documented 1J item), as on
the planned pages.

## 50. npm audit / `npm audit --omit=dev`

`npm audit`: 5 high, all development-only (braces → micromatch → fast-glob → `@next/eslint-plugin-next` →
`eslint-config-next`); exit 1. `npm audit --omit=dev`: **0 vulnerabilities**. No production vulnerability, so nothing to
stop for; `npm audit fix --force` not run; nothing downgraded.

## 51. npm ci

`npm ci`: added 374 packages, audited 375; exit 0.

## 52. lint

`npm run lint`: 0 problems (one unused-constant warning in the new spec was fixed by asserting the breadcrumb's
accessible name with it); exit 0.

## 53. typecheck

`npm run typecheck`: exit 0.

## 54. build

`npm run build`: exit 0; 125 static pages (unchanged); the 68 project pages prerendered (SSG).

## 55. E2E

`npm run test:e2e`: Playwright's own `next start` on the final build, 3 workers, nothing else running. Three full runs
on the same build, with the same product code (only the two test-only commits came between them):

| Run | Tests at | Total | Passed | Failed | Skipped | Flaky | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `e5b814b` | 511 | 510 | 1 | 0 | 0 | 22.3 min |
| 2 | `cee1236` | 511 | 509 | 2 | 0 | 0 | 19.8 min |
| 3 (final) | `cfc17d5` | 511 | **511** | **0** | **0** | **0** | 19.0 min |

Flaky is 0 by construction: the suite runs without retries, so a test that fails once counts as failed.

The three failures were reads that raced the page under the suite's load, in tests of frozen pages (none in a project-page
test). Each was diagnosed from its failure output and fixed in a test-only commit that keeps every assertion:

1. Run 1 — `commerce-polish.spec.ts` "the homepage's colour switch in forced colours › ar, forced dark": the test polled
   until the dot's `translate` changed, then read the track colour at once, mid-transition (the start colour,
   `rgb(0, 0, 0)`). `cee1236`: it waits until the knob has no running animation before each read. The six switch tests
   × 10: 60/60 passed.
2. Run 2 — `commerce-capabilities.spec.ts` "choosing a machine shows it alone, marks it, writes its address …": its first
   read came straight after network idle and once saw the console before hydration (no active panel, no inert panels).
   `cfc17d5`: that read polls, as the test's later reads already did.
3. Run 2 — `commerce-inner.spec.ts` "the contents mark the section being read, and a chosen entry at once": the instant
   jump to `#information` came while the click's smooth glide to `#quote-form` was still running, and the glide carried
   the page on. `cfc17d5`: the test waits until the chosen section has landed below the header before scrolling on.

After `cfc17d5`, those two tests and the six switch tests × 15 (3 workers): 120/120 passed. Then run 3: 511/511.

Assertion map (`commerce-planned.spec.ts` → `commerce-project-detail.spec.ts`, every assertion kept or replaced by
equivalent or stronger coverage):

| Retired test | Now |
| --- | --- |
| every project, both languages: 200, title, summary, "In development · 1F", planned/noindex, trail | "68 pages … answer 200" (status, title, description, canonical, hreflang, `noindex, follow`, trail JSON-LD) and "both languages: the record's …" (h1, lead, trail, eyebrow "Selected work", no "In development"); "text only" → the photos exactly as allowed |
| no project media on a planned page | "source safety": each page and its page data refer to exactly its allowed photos; flagged projects' requests |
| stainless / billboard: no image | "flagged projects › … (ai-watermark)": no image, request, preload or background picture |
| header marks Projects, language switch, trail back | same test (+ the same record in the other language) |
| phone: sheet marks Projects, switch keeps the project, no overflow at 390/320 | same test (+ the compact control, a page with photos) |
| reduced motion | same (+ two more pages, hero at opacity 1) |
| no-JS | "every kind of page is complete from the server" (the placeholder note no longer exists: facts, closing panel, photos instead) |
| unknown project: 404 matrix, localized 404 ×2, phone sheet | same three tests |
| decoration hidden | same (+ a text page, separators not read out) |

Elsewhere: `commerce-projects.spec.ts` — "no page links to a project page" → "only the overview's gallery cards link
the project pages" (same 18 pages × 2 languages, exactly 27 card links on the overview); "project pages are planned" →
"… are built" (robots now asserted exactly); "gallery cards are not links or tab stops" → "a gallery card is not a link:
it holds one, the only tab stop in it" (full tab order asserted); added "each card's link" (text, accessible name, href,
follow). `commerce-capabilities.spec.ts`: `pageStatus.project` "planned" → "review".

## 56. Screenshots

In the scratchpad evidence set (`f1/evidence/`), sent with this report:
01 multi-photo EN light desktop (clock tower) · 02 media-rich AR dark (cannon replicas) · 03 single photo (palm
canopies) · 04 wheat, workshop photos only · 05 stainless, text page · 06 billboard, text page (AR) · 07 laser-cut bench,
no render (dark) · 08 confirm-authorship, no image (lattice cubes) · 09 reference area (suspended lantern hero, p.3) ·
10 classification and related services (AR) · 11 phone EN · 12 phone AR (dark) · 13 320 px reflow (AR) · 14 dark ·
15 / 15b forced colours (photo page; text page, AR dark) · 16 no-JS · 17 / 17b overview with the "View project" links
(EN; AR dark) · 18 direct URL `/ar/projects/clock-tower-landmark` · 19 unknown project 404 · 20 homepage regression ·
21 Stage 1E regression · 22a / 22b About and service D4 regression · 23 Theme Lab regression (each regression image:
Stage 1E build beside Stage 1F build, 0 pixels differ).

## 57. Known limitations

- Photos stay small: the profile's exports are 92–470 px wide, shown at most at source size; pages with one small photo
  (e.g. 154 px) show it on a stage that is mostly plate. Originals are the real fix (inventory item 16).
- Summaries describe the profile's photos; on the seven text pages they describe photos the page does not show (e.g. the
  bench's "(design render)", the billboard's "standing in open desert"). Kept exactly as the records hold them (brief
  §23); RAWASY may reword (inventory item 21).
- `services/fabrication-workshop` appears on two project pages (geometric lanterns, lattice tower replica): both records
  list it, and it shows both pieces (inventory item 22).
- Arabic pages: CLS 0.002–0.019 from the Arabic faces swapping in (not preloaded; one root layout serves both languages —
  a 1J item, unchanged).
- Pre-existing, unchanged (frozen overview): the hero collage's aria-hidden "Ref. 04" print caption measures below AA
  where the next print overlaps it (same on Stage 1E).
- No "more work" or previous/next navigation (the brief preferred none without a defined order); Back to Projects and
  the closing panel lead on.
- Still open from earlier stages: no-JS late-font anchor drift (TM-3 item 5), Arabic font preloads, OG images in the
  previous design's faces (1J), header overflow below 320 CSS px.

## 58. RAWASY confirmations

1. Per project, what may be published: client, location, year, materials, scope, description, challenge, solution
   (inventory item 19) — none is shown until confirmed. The gateway signs' photos show a governorate's name on the
   signage; no location is published.
2. Authorship of #02 illuminated lattice cubes, #17 perforated seed sculpture, p.3 canopy tree sculpture (their pages
   show no photo until confirmed).
3. Whether #12 laser-cut bench and #28 street litter bins are RAWASY products, and whether renders may be shown.
4. The AI-watermarked photos of #07 wheat monument, #14 stainless landmark, #21 billboard structure — or genuine photos.
5. The summaries that describe photos (inventory item 21), and the workshop photo on two pages (item 22).
6. The services behind each project (inventory item 14), which drive the Related services.
7. Original, higher-resolution project photography (inventory item 16).

---

## How to run

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e        # starts next start on :3400 (or reuses it); E2E_BASE_URL for another server
npx playwright test e2e/commerce-project-detail.spec.ts
```

Pages: `/en/projects/<slug>` and `/ar/projects/<slug>` for the 34 records, for example
`/en/projects/clock-tower-landmark` (several photos), `/en/projects/palm-leaf-shade-canopies` (one photo),
`/ar/projects/stainless-landmark-sculpture` (text page); the overview's "View project" links at `/en/projects#gallery`.

## Next steps

- **Independent review** of Stage 1F.
- RAWASY's answers (item 58) change project records only: a confirmed photo or detail appears on its page without a code
  change.
- **Not started**, waiting for the user's word: Stage 1G and later (1I and 1J included), the theme lab's removal, OG
  regeneration, publication and deployment.

---

Stopped after Stage 1F. Not begun: Stage 1I, Stage 1J, Theme Lab removal, OG regeneration, publication, deployment.
Returned for independent review.
