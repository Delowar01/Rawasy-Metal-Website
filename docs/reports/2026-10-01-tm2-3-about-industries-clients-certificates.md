# RAWASY Metal — Stage TM-2.3: About, Industries, Clients and Certificates in the Modern Commerce design

Date: 2026-10-01 · Branch: `claude/new-session-5eijs6` · Status: **built, returned for independent review** (TM-2.4 and
every later batch not started; nothing deployed).

Summary: `/en|ar/about`, `/industries`, `/clients` and `/certificates` now run on the Modern Commerce root layout, at the
same addresses, still `review` (`noindex, follow`, not in the sitemap).

- **Copy and data are the previous pages', unchanged.** Every difference found by a word-level comparison of the two
  builds is listed in item 8; none rewrites copy.
- **Certificates:** only the eight redacted files, byte-identical before and after (SHA-1 checked on disk and as
  served). No preview is shown larger than the previous design showed it, in cards or in the dialog, at 8 widths in
  both languages. The dialog is a native `<dialog>`. While it is open, the custom pointer gives way to the system cursor.
- **Photos:** never shown above their source size. The previous About and Industries pages enlarged 154 image instances,
  up to 1.72×.
- **Frozen surfaces** (the homepage, Contact, Privacy, Terms, the 404, the Theme Lab) are byte-identical in their
  prerendered files, identical in JavaScript, and pixel-identical in 106 captures (one recaptured after a capture race,
  item 34).
- **Pages still in the previous design:** identical once the `prefetch: false` on their links to the four pages is set
  aside.
- **Checks:** lint, typecheck and build pass; 299 e2e tests pass.

Final QA found and fixed problems in my own work:

- **Clients:** logos shown at their natural size and spilling over their tiles (item 14). This was the most visible
  one.
- **Containment:** photos sized past their stage (About's project cards, the Industries preview) and a stat unit
  crossing its card at 320 px (item 27).
- **Industries:** a class-name collision (item 12).
- **Contrast:** the vision panel's numbers, and a thumbnail shadow over text (item 28).
- **Forced colours:** three gaps (items 15, 28).

Each fix has a test or a check that failed before it. Three shared, frozen parts that I did not change are reported in
item 43 for your decision.

## 1. Preserve SHA

`preserve/pre-tm2.3` → `20260471386477016e0dd9dab5e2ae0c3ff1d44d`, created new and pushed without force.
`git ls-remote origin` shows it beside `preserve/pre-tm2.2` (`e5a3834`).

## 2. Starting SHA

`20260471386477016e0dd9dab5e2ae0c3ff1d44d` ("Add the TM-2.2 Contact report and record TM-2.2 in CLAUDE.md"). Before any
change:

- the worktree was clean;
- local HEAD equalled `origin/claude/new-session-5eijs6`;
- TM-2.2 was present;
- the eight certificate files matched the TM-2 plan's E4 hashes.

## 3. Implementation commit

`86a5f198c884ff1af395e27515f1b3ef3a00f45a` — "Migrate About, Industries, Clients and Certificates to the Modern Commerce design (TM-2.3)".

## 4. HEAD

The commit that adds this report and records TM-2.3 in CLAUDE.md, on top of item 3; both are pushed to
`claude/new-session-5eijs6`. A file cannot contain its own commit hash; the hash is given in the chat summary.

## 5. Files changed

Implementation commit: 31 files changed. Git shows the four previous route files as renamed to their parked copies.

New:

- Routes: `src/app/(commerce)/[locale]/{about,industries,clients,certificates}/page.tsx`.
- Pages:
  - `src/components/commerce/about/AboutPage.tsx`
  - `src/components/commerce/industries/{IndustriesPage,SectorIndex}.tsx`
  - `src/components/commerce/clients/ClientsPage.tsx`
  - `src/components/commerce/certificates/{CertificatesPage,DocumentRegister}.tsx`
- Kit: `src/components/commerce/inner/Figure.tsx`, `src/components/commerce/inner/useDialogPointer.ts`.
- Parked previous pages, verbatim and unrouted (they keep `globals.css` byte-identical; TM-2.6 deletes them):
  - `src/components/about/LegacyAboutPage.tsx`
  - `src/components/industries/LegacyIndustriesPage.tsx`
  - `src/components/clients/LegacyClientsPage.tsx`
  - `src/components/certificates/LegacyCertificatesPage.tsx`
- Tests: `e2e/commerce-company.spec.ts` (About, Industries, Clients), `e2e/commerce-certificates.spec.ts`.

Modified:

- `src/components/commerce/system.css`: a new block at the end of the components layer, its forced-colours rules, and
  two unlayered dialog-cursor rules. Nothing earlier in the file changed.
- `src/i18n/routes.ts`: the four keys added to `commerceRoutes`.
- `src/content/about.ts` and `src/content/types.ts`: one screen-reader label, `about.machinery.notStated` (item 8).
- `src/components/commerce/inner/ClosingCta.tsx`: its doc comment only.
- Eight existing specs, retargeted (item 33).

Deleted: `src/app/[locale]/{about,industries,clients,certificates}/page.tsx`. These are the previous design's route
files; their pages are the parked copies above.

Report commit: this report and `CLAUDE.md`.

## 6. Routes

- `/en|ar/about|industries|clients|certificates` now render under `src/app/(commerce)/[locale]/`.
- The URLs are unchanged; all eight answer 200.
- `generateMetadata` → `innerPageMetadata(key, locale)`, as before.
- The page renders inside `PageShell` with `getShellView(locale, { route: key, path })`, so the header and footer mark
  it with `aria-current="page"`.
- The four keys were added to `commerceRoutes` after the move. `crossDesignLink()` therefore gives every
  previous-design link to them `prefetch={false}`.
- A locale-less address still redirects to its locale (`proxy.ts`, unchanged). An unknown sub-path still gets the
  localized 404.

## 7. Shared components

Reused unchanged:

- `PageShell`, `PageHero` (split for About; stacked for Industries and Certificates; compact for Clients), `ClosingCta`;
- `Photo`, `Logo`, `Icon`, `delay` from `components/commerce/ui.tsx`;
- the tone maps in `components/commerce/tones.ts`.

Added to the kit, used only by these pages:

- **`Figure`**: a photo with its caption, never wider than its source (`max-width` = the source width, aspect ratio
  from the file).
- **`useDialogPointer`**: marks `html[data-cursor-modal]` while a dialog is open (item 21).
- **CSS kit classes**: `ip-index` (part and item numbers), `ip-down` (a jump further down), `ip-figure*`, `ip-table*`
  (the register and the machine table).

`ClosingCta` is used for the first time. Only its doc comment changed: an attempt to change its alignment class removed
a utility from the stylesheet, so it was reverted.

The page-specific classes are `ab-*`, `in-*`, `cl-*` and `ct-*`. No other page uses any of them; a scan found no batch
class styled anywhere else in the stylesheet. Nothing was built for TM-2.4 or TM-2.5, and no homepage primitive was
modified.

## 8. About parity

The fifteen parts, in the previous order:

1. hero
2. 01 Who we are
3. 02 What we do
4. 03 Core metal services
5. 04 Beyond metalwork
6. 05 Our vision
7. 06 Engineering approach
8. 07 How we work
9. 08 Why RAWASY
10. 09 In the workshop
11. 10 Machinery
12. 11 Selected work
13. 12 Clients
14. 13 Compliance
15. closing

Each of the 13 numbered parts is a named region (`section#id` with `aria-labelledby`). The test checks that order and
the 01–13 indices. Also kept:

- the vision statement as a `<blockquote>`;
- the machine table with its column header cells;
- the "named in the profile" and "website classification" source labels;
- no invented figures (the test rejects years, counts and percentages).

Content comparison: a word-level diff of `<main>`'s text, headings, links, images, labels and decorative text. It ran
on both builds, EN and AR, desktop and phone, with the certificate dialog open. Every difference, all four pages:

1. **D4 wording:** "View project" → "View in the gallery" (×4), "عرض المشروع" → "عرض في معرض الأعمال". The links
   now go to `/projects#gallery`.
2. **Retired D8 decoration:**
   - the "Fig. 01–07" / "شكل 01–07" figure labels (About 9, Industries 1, Certificates 3);
   - the "/" separators in part labels ("05/Our vision" → "05 Our vision");
   - the "DOC" glyph labels on the certificate cards and the dialog.
3. **Structural accessibility:**
   - The service cards' links are named by their title ("Laser Cutting"). Previously the link's name was the whole card
     text.
   - Item numbers stay on screen but are hidden from assistive technology where they are decoration: the service
     indices, process steps, vision aims and redaction points. They sit in ordered lists, which announce positions.
   - The seven workshop photos have empty alt text because their visible captions name them. Previously the alt
     repeated the caption; axe flagged that as `image-redundant-alt`.
   - The dialog's scrolling preview area is a labelled group: "Redacted preview" / "نسخة معاينة منقّحة".
   - One added screen-reader text: "Not stated in the company profile" / "غير مذكورة في الملف التعريفي", for the two
     machines whose power the profile does not give (shown "—", as before).
4. **Reading order inside the kit's hero:**
   - About: the page facts now come before the photo and its caption, and the registered-name card sits under the photo.
   - Industries: the facts now come before the photo strip.
   - The text is the same.
5. **Client logo files:** the wall shows the colour files under a CSS greyscale (the homepage wall's method) instead of
   the `-mono` silhouettes. The alt text is the same (item 14).

There is no CSS-capitalisation difference: the comparison reads text content.

## 9. About link interim (D4, D5)

- **Selected work:** four project cards (Tulip Roundabout Sculpture, Clock Tower Landmark, Palm-Leaf Shade Canopies,
  Geometric Lanterns). Each opens `/<locale>/projects#gallery` with "View in the gallery" / "عرض في معرض الأعمال". No
  card leads to a planned project page; the test fails on any `/projects/<slug>` link. Their category flags are
  `aria-hidden` duplicates of the card text.
- "All projects" opens `/projects`.
- **D5:** the Machinery part keeps its "Capabilities & machinery" link to `/capabilities` (the placeholder until 1E).

## 10. About media

- The same images as the previous page, nothing new and nothing flagged:
  - no AI-watermarked finished-installation photo;
  - no render;
  - no engraving nameplate.
- Measured on 412 image instances (8 widths × EN/AR): the largest display scale is **1.000** (never above source). The
  previous page showed 128 instances above source, up to 1.47×.
- Hero: the workshop photo at most its source width, with the caption and the registered names under it.
- Workshop: the seven photos at native size, with captions.
- Compliance: the redacted `-thumb` files, no larger than the previous thumbnails (a sheet at most 62 % of the card
  wide; the plate padding was tuned so it is not taller).
- **Fixed during QA:** the project cards' photo stage had an automatic grid row, so a tall photo set the row's height
  and the stage clipped the rest. The photo still showed at its own scale; only the box overflowed. The stage now has
  one fixed track, and the photo is cropped from its top at its own scale. The picture is the same as before (checked
  pixel by pixel at 1440 and 1024).

## 11. Industries structure

- **Hero:** breadcrumbs, title, intro, and the facts (sectors 08, named in our profile 04, from our work gallery 04).
  Below them, a strip of five sector photos with their numbered names. The tiles are capped at 253 px and 4:3, so no
  photo is enlarged.
- **`#sectors` sheet:**
  - "01 Sectors" with the two source labels as a legend;
  - the eight sectors as an ordered list. Each has its icon, number, name (`h3`), description, source label (four
    named in the company profile, four website classifications from the work gallery) and related services;
  - 21 service links in all. Laser engraving is never linked, as before;
  - the classification note ("02 How we classified these sectors").
- **Closing:** "Work in one of these sectors?", with its ways on.
- CollectionPage + BreadcrumbList JSON-LD, identical to before.

## 12. Industries preview

- **Desktop (≥ 64 rem):**
  - A pinned (sticky) preview beside the list shows the sector under the mouse, or the one holding keyboard focus (any
    of its links).
  - Changes are a short cross-fade.
  - The active row gets an orange underline and a filled icon.
  - The preview is `aria-hidden`; the list carries the content.
  - Its images are `min(100%, source px)`, never enlarged.
- **Phones and tablets:** no preview. A 64 px photo sits beside each sector's name (`alt=""`; the name is the text).
- **Arabic:** the preview sits on the left and the list reads from the right (tested).
- **Fixed during QA:**
  - The preview's layer had the same automatic-row problem as About's cards: photos taller than the stage, at 1024 and
    1280, overflowed it and were clipped. The layer now has one fixed track, with the same picture as before.
  - Two rules shared the class `in-index` (the list wrapper and each sector's number). On large screens every number
    became a two-column grid with a 3 rem gap. The Arabic display-face rule also put the sector descriptions in Tajawal
    instead of IBM Plex Sans Arabic. The wrapper is now `in-layout`. A test checks that the number sits beside its name
    and checks the Arabic faces.

## 13. Industries without JavaScript and with reduced motion

- **No JavaScript:** all eight sectors, eight source labels and 21 links are present. The preview shows the first
  sector; nothing is hidden.
- **Reduced motion:** the preview changes at once, with no cross-fade (tested). Reveals are opacity only.

## 14. Clients wall

- 21 logos on one labelled list (`ul#clients-wall`, labelled by its heading).
- Each tile shows the logo (`alt` = the client's name) and the name under it. The previous wall showed the names; the
  name text is `aria-hidden` because the alt already names the logo.
- Columns: 2 on phones, 4 from 48 rem, 6 from 64 rem. Wide logos take two cells only where that keeps every row full
  (`planSpans`, as before). Tested on desktop and phones.
- Monochrome by default and in colour on hover, using the homepage wall's method: the colour files under
  `grayscale(1) contrast(1.1)` at 0.84 opacity.
- Never mirrored: in Arabic the order follows the reading side, and every logo's `transform` and `scale` is `none`.
- Logo files untouched: no file under `public/media` changed. The `-mono` silhouettes the previous wall used remain on
  disk, unused.
- **Fixed during QA:** the logos were spilling out of their tiles. 8 logos on desktop and 10 on phones showed at their
  natural size, over the neighbouring tiles. The tile's logo box was a grid with an automatic row, so a large logo
  file set the row's height. It entered when the client names were restored under the logos, and the column and
  row-fullness tests did not see it. The box now has one fixed track. Both wall tests now fail if any logo or name
  leaves its tile; they failed before the fix and pass after it.

## 15. Colour toggle

- "Original colours" / its Arabic label: `button[aria-pressed][aria-controls="clients-wall"]`.
- Enter or Space toggles it and sets `data-colour` on the wall (the homepage's toggle and its Motion controller,
  unchanged). It has a visible focus ring.
- Without JavaScript it is hidden (`data-js-only`).
- **Fixed during QA:** in forced colours the switch drew its track and dot only with background colours, so it showed
  no state. The Clients page's switch (`.cl-toggle`) now draws them in system colours: an outlined track, a dot, and
  the Highlight fill when on. A test covers it. The homepage's switch is the same component and is left unchanged
  (item 43).

## 16. No-count proof

- The test reads the text of `<main>` in both languages and fails on any of these:
  - any digit at all (so no count, such as "21", and no numbering);
  - the previous design's "RW—C" references;
  - a lone letter A–G or number 1–7 (grid references);
  - claims ("trusted", "partner", "testimonial").
- The closing panel's links are not numbered either.
- The note under the wall is the previous page's text.

## 17. Hashes

| File | SHA-1 |
| --- | --- |
| `commercial-registration-en.webp` | `f3511dcc0c51ae4c54b75256853de35d7a299be6` |
| `commercial-registration-en-thumb.webp` | `7f27a975d9893dd00e46171534cdddc47dfb9ec5` |
| `commercial-registration-ar.webp` | `2fa3939705e69e0574fb79b025d05a676c1cd429` |
| `commercial-registration-ar-thumb.webp` | `af4a0ef12ad6b29e50b3648459caa3ab4fe799e1` |
| `vat-registration.webp` | `d725f4a14584bc59af9b883bb1c625da9b5dd7d1` |
| `vat-registration-thumb.webp` | `7681b9f1ab74134a69dacb6979e7917af1b9ceeb` |
| `commercial-activity-licence.webp` | `0b4405b6193b73dad562675d66615bdd87267421` |
| `commercial-activity-licence-thumb.webp` | `dd740fa944b546039ca83dc85514d9dc2cafe4a6` |

- All eight are identical before TM-2.3 (recorded at the start), after it, and as served (`image/webp`).
- The test checks the files on disk and the bytes the server returns.
- No file was re-encoded, resaved, recompressed, cropped or sharpened.
- Previews go through the image service at the previous `sizes` and q=75: the same variants as before.

## 18. Content-safety test

`commerce-certificates.spec.ts`, "no run of seven or more digits in the page's text, alt text, labels or structured
data", EN and AR, with each dialog opened. It fails on:

- any run of 7+ digits, Western or Arabic-Indic;
- digits written in groups (spaces, dots, dashes or slashes) that add up to 7+ digits, unless the group is one of the
  documents' own dates;
- "ISO" claims;
- "expir…", "1447" or "انتهاء" (the licence expiry stays hidden).

The test was not weakened. Nothing new is shown: no registration number, certificate number, QR content, personal name,
licence expiry or hidden identifier, and nothing is inferred from partial data.

## 19. Register

- Under the title, a table captioned "Document register" / "سجل الوثائق" with No. · Document · Issued by · Reference.
- The reference reads "Available on request" / "متاح عند الطلب".
- Each document name links to its card (`#commercial-registration`, `#vat-registration`,
  `#commercial-activity-licence`).
- On phones the issuer moves under the document name and the reference column folds away. No sideways scroll.
- Below the table: one card per document with the redacted preview, issuer, title, facts, reference and "View
  document".
- Then `#redaction`, the three points, including that the previews are not certified copies, and the closing ways on.
- WebPage + BreadcrumbList JSON-LD, identical to before.
- The cards that the register's links land on carry no reveal; one would move them after the jump. The anchors land
  below the sticky header (tested, `#redaction` too).

## 20. Dialog

- A native `<dialog>`, opened with `showModal()`. Its triggers are links to the redacted file itself, so they work
  without JavaScript and a modified click opens the file.
- Labelled by its `h2` (the document title). The close button takes focus and focus stays inside.
- Escape, the close button or a click on the backdrop closes it, and focus returns to the trigger.
- The preview area is a focusable labelled group, so a tall preview scrolls from the keyboard.
- Each image's alt names the document, its version and the redaction note.
- Sizes: the dialog previews equal the previous design's at every measured width, and the cards are at or below them
  (CSS caps derived from the previous grid). Measured at 8 widths × EN/AR, the largest preview is 0.48× its source.
- No filter, transform, scale or zoom. With motion allowed, a hover lifts the card preview 6 px (translate only); it
  never grows. The dialog fades and rises 12 px on opening; reduced motion removes the lift and the rise.

## 21. Dialog pointer

The problem: a modal dialog sits in the top layer, above the custom pointer, while the page hides the system cursor.
Without help, a desktop mouse user would have had no cursor inside the dialog.

The fix:

- `useDialogPointer` marks `html[data-cursor-modal]` while the dialog is open, however it opened or closed.
- The custom pointer fades out.
- Unlayered rules give the dialog and its backdrop `cursor: auto`, and its contents `cursor: revert-layer`, so buttons
  keep the hand.
- On close, the mark goes and the pointer returns.

Tests:

| Case | Result |
| --- | --- |
| Desktop mouse, before / open / closed | pointer on, then hidden with the system cursor in the dialog and the hand on the close button, then on again |
| Arabic | the same |
| Keyboard only | no custom pointer appears |
| Touch | nothing changes |
| Reduced motion | no custom pointer at all |

The approach is dialog-local, like Contact's `FramePointer`; `Cursor.tsx` is unchanged.

## 22. Keyboard and focus return

- Tests: Tab and Shift+Tab stay inside the open dialog; Escape closes it and focus returns to the trigger; the close
  button and the backdrop do the same.
- A keyboard pass over the four pages (EN/AR × 1440/390, 16 runs, 28–59 stops each) found:
  - every stop shows a focus ring: an outline, or a shadow that appears on focus (cards' resting shadows were not
    counted);
  - every stop is on screen and not covered by the sticky header;
  - the order follows reading order.

## 23. Arabic-first

- On `/ar/certificates` the bilingual commercial registration shows the Arabic version first, in the card and in the
  dialog.
- The dialog's close button sits at the start of the reading side.
- Both are tested.

## 24. EN / AR

All four pages in both languages with the same structure, sources and links. Faces:

- English: Plus Jakarta Sans for display, Inter for text.
- Arabic: Tajawal for display and semibold labels, IBM Plex Sans Arabic for text.

Arabic is never letter-spaced; tests check the faces on About and Industries.

## 25. RTL

- Everything mirrors: hero order, the Industries preview, the wall's reading order, the dialog's close button, arrows,
  and the band glows on the dark panels.
- Logos, the certificate images and the numerals are never mirrored.

## 26. Light / dark

Both themes on every page. The dialog takes the dark surface in the dark theme (tested). The vision panel and the
closing panel are dark in both themes.

## 27. Matrices

128 combinations: 1920×1080, 1440×900, 1280×800, 1024×768, 834×1112, 390×844, 360×780 and 320×700, × EN/AR ×
light/dark × the four pages. States tested on top of the page at rest:

- Industries with another sector previewed (≥ 1024);
- Clients with colours on;
- Certificates with each of the three dialogs open.

Result:

- no sideways overflow;
- nothing wider than or cut by the screen;
- no clipped text;
- no console errors;
- every dialog inside the screen, with its close button reachable and no sideways scroll inside it.

Content inside its box: on 64 page loads (4 pages × 8 sizes × EN/AR, the three dialogs opened on Certificates), no
image or text escapes a visible box (border, background or shadow) or is clipped by it. Scrolling regions — the dialog
body — are the one exception. On the build before these fixes the same check found:

- the About project-card and Industries preview stages (item 10, item 12);
- "12,000 W" crossing its card by 3 px at 320 px. Below 23 rem the stat figures now use a smaller size.

An e2e test now runs this check at 1440, 1024 and 320 on all four pages.

## 28. Accessibility

- **axe** (WCAG 2.0/2.1/2.2 A and AA plus best practice) on EN/AR × light/dark × 1440/390, the dialogs open, colours on
  and another sector previewed: 68 runs, run twice — as loaded, and with the ambient replaced by its worst-case colour.
  **No violations.**
  - Fixed during QA: `image-redundant-alt` (the workshop photos) and `scrollable-region-focusable` (the dialog body).
- **Text contrast:** 1,916 measurements across every text style on the four pages and in the dialog, EN/AR ×
  light/dark × 1440/390.
  - 1,404 are on opaque backgrounds.
  - 512 were measured pixel by pixel, at the ambient's worst moment, inside the text's own box, unrounded.
  - Every one passes AA. Lowest: 5.40:1 on opaque (the register's "No." header) and 5.44:1 per pixel (the closing
    panel's link text).
  - Fixed during QA:
    - The numbers on the dark vision panel were orange (3.3–4.0:1); they now take the panel's second text colour, as the
      closing panel's numbers do.
    - The compliance thumbnails' shadow fell across the issuer line (4.497:1); the plate now clips it.
- **Keyboard:** item 22.
- **200 % zoom** (720 × 450 CSS px): no overflow on the four pages in EN/AR. Every dialog stays inside the screen with
  its close button visible, and its preview scrolls from the keyboard.
- **320 px reflow:** part of the matrix; no overflow.
- **Forced colours** (light and dark):
  - no overflow;
  - the dialog keeps its border;
  - focus rings show.
  - Fixed: the switch's state (item 15), the redaction swatch (it now keeps its hatch instead of looking like an empty
    checkbox) and the active sector's line (it now takes the highlight colour instead of hiding the row's rule).
- **Reduced motion:** the generic test passes (nothing hidden). There is no preview cross-fade, no dialog movement and
  no custom pointer.
- **No JavaScript:** everything is present (items 13, 14, 20). The only partly transparent elements are the monochrome
  logos at 0.84, the same as with JavaScript.

## 29. Performance

Scroll benchmark at 1440: software compositing, top to bottom in 5 s, fresh browser per run, three runs, each reached
the bottom.

| Page | TM-2.3 mean fps | Previous page |
| --- | --- | --- |
| About EN / AR | 60.0 / 59.9 | 49.8 |
| Industries EN / AR | 60.0 / 59.7 | 45.2 |
| Clients EN | 60.0 | 46.9 |
| Certificates EN / AR | 59.9 / 60.0 | 46.4 |
| Homepage, interleaved, four runs each, EN / AR | 53.9 / 54.8 | checkpoint build: 54.0 / 54.8 |
| About / Industries / Clients EN, after the final layout fixes | 60.0 / 60.0 / 59.9 | — |

The homepage measures the same on both builds. This machine ran about 1 fps slower today than in the TM-2.2 run (55.0).

- No new moving layers, canvas, WebGL, particles, filters or backdrop blur.
- Transitions are opacity, translate and colour only.

First visit, transfer sizes at 1440:

| Page | Before | After | Requests |
| --- | --- | --- | --- |
| About EN | 1,025 KB | 583 KB | 86 → 41 |
| About AR | 1,065 KB | 721 KB | 88 → 49 |
| Industries EN | 940 KB | 517 KB | 61 → 26 |
| Clients EN | 887 KB | 556 KB | 71 → 34 |
| Certificates EN | 723 KB | 320 KB | 53 → 17 |

The drop is mostly the previous design's link prefetches and fonts. JavaScript per page is 485,659–490,092 bytes,
down from 592,282–607,074.

LCP is slower: about 1.1–1.4 s locally, against 0.2–0.45 s before. The kit's `PageHero` fades its text in after the
script starts, and Contact's LCP is the same today (1.04 s; 1.18 s on the checkpoint build). See item 43.

## 30. SEO

Server HTML, checkpoint build vs TM-2.3, EN and AR, four pages. Identical:

- title and description;
- canonical and hreflang (en, ar, x-default);
- robots `noindex, follow`;
- Open Graph and Twitter;
- JSON-LD: AboutPage, CollectionPage (Industries, Clients), WebPage (Certificates), each with BreadcrumbList and the
  organisation graph as before.

The only difference: `theme-color` now follows the Modern Commerce page colours (`#f4f4f1` / `#131820`), as on the
other Modern Commerce pages. The sitemap and robots.txt are byte-identical.

## 31. Publication / noindex

- All four pages stay `review` in `src/lib/page-meta.ts`: `noindex, follow`, not in the sitemap.
- Not deployed.

## 32. Cross-design prefetch

`commerceRoutes` gained exactly `about`, `industries`, `clients` and `certificates`.

Measured on seven previous-design pages (services, projects, service pages, capabilities, EN/AR, scrolled to the
bottom):

- **Checkpoint build:** they prefetched all eight addresses of the four pages (80 distinct prefetches).
- **TM-2.3:** none of any Modern Commerce page (72 prefetches).
- They no longer load the old pages' chunks: 20–43 KB less JavaScript each.

The tests:

- `commerce-company.spec.ts` checks that no previous-design page prefetches the four pages, and that `/en/projects` is
  still prefetched;
- the homepage, legal and Contact specs check their own pages.

## 33. Test mapping

Nine tests were removed. Each has an equal or stronger replacement:

| Removed (file) | Now covered by |
| --- | --- |
| "21 logos with names on one wall, six across on desktop, every row full" (stage-1c) | `commerce-company`: "21 named logos on one labelled wall, six across on desktop, every row full, every logo inside its tile" |
| "two across on phones, every row full" (stage-1c) | `commerce-company`: "two across on phones, every row full, every logo inside its tile" |
| "register, keyboard dialog, focus return and redaction" (stage-1c) | `commerce-certificates`: the register test, the anchors test, "keyboard: opens as a labelled modal…", the close/backdrop test, the decoration test |
| "Arabic shows the Arabic version of a bilingual document first" (stage-1c) | `commerce-certificates`: "Arabic shows the Arabic version… first; the close button sits at the start of the reading side" |
| "industries preview follows keyboard focus" (stage-1c) | `commerce-company`: "the preview follows keyboard focus and the mouse, and is hidden from assistive technology" |
| "no numbering, grid references or counts anywhere on the page" (redesign-v2) | `commerce-company`: "no numbering, grid references, counts or claims anywhere on the page" |
| "the colour switch reveals every logo's own colours, from the keyboard too" (redesign-v2) | `commerce-company`: "the colour switch shows every logo's own colours, from the keyboard too; hovering a tile shows its colours" |
| "hovering a cell reveals its colours" (redesign-v2) | the same test (hover part) |
| "a full company profile: fifteen parts, no invented figures" (redesign-v2) | `commerce-company`: "a full company profile: fifteen parts in order, each a named region, no invented figures" and "onward links…" |

Retargeted tests: same assertions, run on a page still in the previous design, because the page they used moved.

- `site.spec.ts`: theme, intro loader, page transition, the menu's focus trap, no-JS, server rendering. About → Projects
  or Services.
- `visual-system.spec.ts`:
  - decoration semantics → previous-design pages;
  - drift and scroll rest → Projects;
  - line drawing → Scaffolding;
  - no pointer light on touch → Services.
- `redesign-v2.spec.ts`: the English and Arabic typography tests, About → Services.
- `stage-1c.spec.ts`: the dark-theme test, Certificates → Services.
- `commerce-home.spec.ts`: stylesheet and font isolation, header journeys and the theme carry-over → Services and
  Projects.
- `commerce-inner.spec.ts` and `commerce-contact.spec.ts`: the no-prefetch lists → Services and Projects pages.
- `theme-lab-a-v2.spec.ts`: the site-theme check → Services.

`stage-1c.spec.ts`'s generic checks still run on the four pages through `INNER_PAGES`: routes and SEO, breadcrumbs,
overflow, reduced motion, no JS. The new specs add 17 + 23 tests. Among them, "nothing spills out of its card or is cut
off by it" checks every box on the four pages at 1440, 1024 and 320 (item 27).

## 34. Homepage regression

Checkpoint build `2026047` vs TM-2.3:

- **Prerendered files:** all 12 byte-identical.
- **JavaScript:** identical module set and code (181 modules, 532,036 bytes, EN and AR).
- **CSS:** the Modern Commerce stylesheet is additions only. Every rule of the checkpoint build is present unchanged
  (1,025 rules; 208 added, none changed; 108,470 → 129,829 bytes). `globals.css` (152,371 bytes), `lab.css` (54,497)
  and the signature sheet are byte-identical.
- **Pixels:** 106 captures with motion frozen: the homepage EN/AR at 1440 and at 390 viewport by viewport, plus
  Contact, the legal pages, the 404, the lab and previous-design pages. 105 were byte-identical in the final run.
  - The 106th, the lab's English full page, differed by 41 pixels under its header. A full-page capture resizes the
    window, which can set the lab header's "past hero" shadow mid-capture. The probes showed the checkpoint build
    doing the same in 2 of 3 runs.
  - Recaptured: byte-identical.
  - An earlier run had one `/ar/projects` viewport with resampling noise across a photo; its two recaptures were
    byte-identical.
- **Load-to-load noise, checked:** in the viewport captures used for the evidence images, some homepage loads differed
  by 126 pixels along two hairline leader lines of the hero plate (sub-pixel anti-aliasing). Two loads of the TM-2.3
  build differ in the same way (1 of 5 runs), so it is not a change. To confirm, none of the 208 added CSS rules (177
  distinct selectors) matches any element on the homepage, Privacy, Terms, Contact or the 404, in EN and AR.
- **Behaviour:** the hero loop, signatures, ambient, cursor, header, footer and its links are covered by the unchanged
  `commerce-home.spec.ts` (passing).
- **Frame rate:** the same on both builds (item 29).

## 35. Contact regression

- 12 of 12 prerendered files byte-identical.
- JavaScript identical (498,732 bytes).
- Pixel-identical.
- `commerce-contact.spec.ts` (golden email, WhatsApp and copied text, no-JS mailto, map) passes unchanged, apart from its
  retargeted no-prefetch list.

## 36. TM-2.1 regression

- Privacy and Terms: 24 of 24 files identical; JavaScript identical (487,134 bytes).
- The MC 404: +46 bytes of JavaScript (the route table's four new keys); its HTML is unchanged.
- The global 404's prerendered output: one segment moved into a new `_index` segment file (Next.js organises it that
  way now). Its HTML and full payload are identical.
- The HTTP status matrix in `commerce-inner.spec.ts` passes.
- Pixel-identical.

## 37. Theme Lab regression

- 96 of 96 prerendered files identical.
- `lab.css` byte-identical.
- JavaScript identical (532,674 bytes).
- Pixel-identical, EN and AR.
- The lab specs pass.

## 38. Lint

`npm run lint`: 0 errors, 0 warnings.

## 39. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): passes, 0 errors.

## 40. Build

`npm run build`: passes.

- 125 static pages generated.
- The four pages prerender as SSG in both locales under `(commerce)/[locale]`.
- No warnings.

## 41. e2e count

`npm run test:e2e`: **299 passed, 0 failed, 0 skipped** (7.9 min), on the build of the implementation commit.

- The previous run had 268 tests.
- Nine were removed and mapped (item 33).
- 40 are new: 17 in `commerce-certificates`, 23 in `commerce-company`.
- 268 − 9 + 40 = 299. Per file: stage-1c 32 → 27, redesign-v2 20 → 16; every other file unchanged.

## 42. Screenshots

22 evidence images, each ≤ 2400 px, sent with this report. All were captured on the final build with reduced motion
(finished plate, still ambient), except the two dialogs, which were captured after their opening transition.

| # | Image | Shows |
| --- | --- | --- |
| 1 | `01-about-en-light-desktop-top.png` | About, EN, light, desktop top |
| 2 | `02-about-ar-dark-desktop-top.png` | About, AR, dark, desktop top |
| 3 | `03-about-en-ar-middle.png` | About EN and AR, middle (vision and approach) |
| 4 | `04-about-mobile-en.png` | About EN on a phone, three screens |
| 5 | `05-about-mobile-ar.png` | About AR on a phone, three screens |
| 6 | `06-industries-en-preview.png` | Industries, EN preview |
| 7 | `07-industries-ar-preview-mirrored.png` | Industries, AR, mirrored |
| 8 | `08-industries-mobile-list.png` | Industries, mobile list |
| 9 | `09-clients-en-light.png` | Clients, EN, light |
| 10 | `10-clients-ar-dark.png` | Clients, AR, dark |
| 11 | `11-clients-colours-on.png` | Clients with colours on |
| 12 | `12-clients-phone.png` | Clients on a phone |
| 13 | `13-certificates-register-desktop.png` | Certificates register, desktop |
| 14 | `14-certificates-ar-page.png` | Certificates, AR page |
| 15 | `15-certificates-dialog-desktop.png` | Certificate dialog, desktop |
| 16 | `16-certificates-dialog-arabic.png` | Certificate dialog, Arabic |
| 17 | `17-certificates-phone.png` | Certificates on a phone |
| 18 | `18-certificates-redaction-section.png` | The redaction section |
| 19 | `19-regression-homepage.png` | Regression: homepage |
| 20 | `20-regression-contact.png` | Regression: Contact |
| 21 | `21-regression-privacy-terms-404.png` | Regression: Privacy, Terms and the 404 |
| 22 | `22-regression-theme-lab.png` | Regression: Theme Lab |

Each regression image puts the checkpoint build and TM-2.3 side by side, with the measured pixel difference in its
caption bar.

- They show two screens at 1440: the top, then 900 px down. These are viewport captures, because a full-page capture
  resizes the window and can flip the lab header's state mid-capture.
- All seven pairs measure 0 differing pixels.
- The homepage pairs come from loads without the plate's hairline noise (item 34).

## 43. Known limitations

Three shared, frozen parts are left as they are, for your decision:

1. **The homepage's colour switch** shows no on/off state in forced colours (fills are replaced). The Clients page
   draws its own. The same few rules on `.a2-toggle` would fix the homepage, but that changes a frozen component.
2. **`PageHero` fades its text in after the script starts.** Local LCP is about 1–1.4 s on every Modern Commerce inner
   page with a hero, Contact included. Showing the hero text without the fade would fix it on all of them.
3. **The footer's wordmark** disappears in forced colours (white on the forced page colour). This is pre-existing:
   identical on the checkpoint build's homepage.

Smaller points:

4. On phones the certificate card previews are a little smaller than before (390 px: 217×154 against 233×165). The cap
   leaves room for a scrollbar. The dialog previews are the same size as before.
5. The kit's hero puts the page facts before the photo (About) and the strip (Industries) in the reading order (item 8).
6. The client wall's monochrome is the homepage's CSS greyscale of the colour logos, not the previous `-mono`
   silhouettes, which were alpha-normalised for pale logos. Pale logos (Metal Details, Trolley Carriage) therefore read
   lighter than they did as silhouettes until hovered or switched to their colours (images 9–12). Using the
   silhouettes for the default state is a small change if you prefer it.
7. `ClosingCta` keeps the kit's bottom alignment of its text against the links on wide screens.
8. The global 404's prerendered segments are split differently by Next.js (item 36).
9. TM-2.1's documented limitations are unchanged: no-JS 404 body, header blur, the 44 rem legal measure, the 320 px
   404 label wrap.
10. Frame rates are from software compositing in a shared machine; the homepage reads about 54 here on both builds.

## 44. RAWASY confirmations

Unchanged by TM-2.3; all are in `docs/ASSET_INVENTORY.md`:

- original high-resolution photography (these pages show every photo at or below its source size);
- image rights for the stock-looking photos;
- portfolio authenticity and the AI-watermarked photos (kept off every featured spot, including About's cards);
- the renewed commercial activity licence (its expiry stays hidden);
- whether the CR and VAT numbers may be shown (still "Available on request");
- the 935 m² shop area and any other figure not yet approved for use;
- RAWASY's own Google Maps place link (Contact);
- the domain email;
- the services behind each project.

## How to run

```bash
npm ci
npm run lint && npm run typecheck && npm run build
npm run test:e2e              # starts or reuses next start on :3400
npx next start -p 3400        # then open /en/about, /ar/industries, /en/clients, /ar/certificates
```

Rollback to before TM-2.3: the GitHub branch `preserve/pre-tm2.3` (`2026047`).

## Next steps

- Independent review of TM-2.3. I have stopped here.
- On your go-ahead only: TM-2.4 (the services overview and the six service pages).
- Your decision on the three shared items in item 43.
- TM-2.5, TM-2.6, Stage 1E and 1F, the theme lab's removal and deployment all wait for your instruction.
