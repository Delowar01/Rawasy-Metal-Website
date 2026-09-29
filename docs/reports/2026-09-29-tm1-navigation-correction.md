# RAWASY Metal Website — Stage TM-1: final navigation correction

**Date:** 2026-09-29 · **Branch:** `claude/new-session-5eijs6` · **Correction commit:** `2b139e9` (this report is in the following commit)

**Status: both UX conditions are fixed. The migrated homepage is returned for your visual approval. I have not approved it.**

- The six homepage project cards now open the existing image-led Projects overview at its gallery. They are
  labelled "View in the gallery" / "عرض في معرض الأعمال", and no card leads to an unfinished project page.
- The hero's primary "Start a Project" now opens the quotation form (`/en/contact#quote`, `/ar/contact#quote`).
  "Explore Our Capabilities" still scrolls to the homepage's machinery section.
- Nothing else changed. The design, the hero animation, the signatures, the ambient, the cursor, the typography, the
  colours, every inner page and the theme lab are identical to the TM-1 build (item 3).
- I did not start TM-2 or Stage 1E, and I did not build project detail pages or deploy.

---

### 1. Project cards

**What changed.** Each of the six cards now links to `/<locale>/projects#gallery`: the Projects overview, opened at
its "02 / Gallery — All projects" section. That section is the image-led, filterable wall of every showcased project.
It opens unfiltered, so all six homepage projects are shown there (27 projects in total).

**Card label.** The label changed from "View project" / "عرض المشروع" to **"View in the gallery" / "عرض في معرض
الأعمال"**, so no card implies that a finished case-study page exists. The new wording uses the site's existing term for
the gallery, "معرض الأعمال".

**Why not project-specific anchors.** I tested them first. All six projects are in the gallery. But the gallery has a
sticky filter bar under the header, 69 px tall, or 117 px where its chips wrap onto two rows (1024–1366 px in English,
1024–1180 px in Arabic). A jump to a project's card left its top 53–101 px under that bar at every width I measured
(360 to 1440 px, both languages).

Landing cleanly would need changes to the previous design's Projects page:

- ids on every gallery item;
- plus either a fixed offset, which would break if the filter chips change, or new script to measure the bar.

That page is outside this correction, and the bar's height makes a fixed offset unreliable. So, as the brief
allows, the cards link to the gallery section. When the project pages are built (1F), the cards can point at them
again.

**Label display, unchanged.** The label is shown as before: on hover and keyboard focus on desktop, and always on
touch screens. It stays on one line inside every card, in both languages, on desktop and phone.

### 2. Hero primary CTA

- "Start a Project" / "ابدأ مشروعك" now links to `href(locale, "contact", { hash: "quote" })`: `/en/contact#quote` and
  `/ar/contact#quote`. It lands on the "01 / Quote request — Request a quote" form.
- "Explore Our Capabilities" / "اكتشف قدراتنا" still scrolls to `#machinery` on the homepage.
- The hero's design and animation are untouched. Only the link's `href` changed, and the 10 s plate loop, its timing
  and its readout are the same code.

### 3. Regression requirements

The correction was compared with a clean build of the TM-1 commit (`de4786f`), built side by side:

- **Every other page is identical.** All 818 other prerendered files match: HTML, page data and cache metadata, after
  normalising build ids and asset paths. That covers every inner page in both languages, the 404 pages and all 16
  theme-lab pages.
- **Homepage markup: only the intended changes.** On `/en` and `/ar`, the server HTML and the resolved page data
  differ only in the hero's primary `href`, the six card `href`s and the six card labels.
- **Every stylesheet is byte-identical:** the homepage's own CSS and its signature CSS, the previous design's two
  stylesheets, and the theme lab's stylesheets.
- **Untouched source files:** no change to the hero plate, the signatures (`LaserCut`, `LaserEngrave`,
  `useSignature`), `Ambient`, `Cursor`, `system.css`, `commerce.css`, the fonts, the root layouts, `globals.css`, any
  inner-page file, or any theme-lab file.
- **Pixel check:** full-page captures of the homepage before and after the correction are pixel-identical: `/en`
  light and `/ar` dark at 1440, `/en` dark and `/ar` light at 390, 0 differing pixels. The card label is hidden at
  rest on desktop, and the captures do not emulate a touch screen's always-visible label.

### 4. Verification

| Check | Result |
| --- | --- |
| Project cards | All 6 cards in EN and AR go to `/<locale>/projects#gallery` and carry the new label. No homepage link points at `/<locale>/projects/<slug>`. A real click (desktop, EN) and a tap (phone, AR) open the gallery in view, unfiltered, with all six homepage projects shown there. |
| Hero primary CTA | `/en` → `/en/contact#quote` and `/ar` → `/ar/contact#quote` with the Arabic page in RTL; the form is in view after the click. The secondary action stays `#machinery`. |
| Other quote actions | Unchanged: all 11 still go to `/<locale>/contact#quote`. |
| `npm run lint` | **Passed**, no warnings or errors |
| `npm run typecheck` | **Passed**, no errors |
| `npm run build` | **Passed**: 125 static pages, the same count as TM-1 |
| `npm run test:e2e` | **227 passed, 0 failed, 0 flaky** (6.7 min). That is the previous 224 plus 3 new tests: the hero's Start a Project in both languages, the six cards' destinations and labels, and a phone tap on a card in the swipe rail. The existing quote-action test also passes. |
| Rollback checkpoint | Still accessible. `preserve/pre-tm1-a-v2-migration` on GitHub points at `3260415bbafb946c7d3bbeef8783677cf610c172`, can be fetched, and contains the previous homepage route. The local tag `pre-tm1-a-v2-migration` points at the same commit, which is an ancestor of the branch head. |

Proof images were sent in the chat:

- `cards-desktop.png` and `cards-phone.png`: the cards before and after, with the label shown.
- `landings.png`: where a card click and "Start a Project" land, in EN on desktop and AR on a phone.

### Correction commit and branch SHA

- **Correction commit:** `2b139e9` (`2b139e9903ffa5f174dd3695f423723d20d963d2`), "Point the homepage's project cards and
  Start a Project at finished pages".
- **Branch head:** the commit that adds this report, directly on top of `2b139e9`, pushed to
  `claude/new-session-5eijs6`. Its SHA is given in the chat report.

### Notes (not changed; for your decision)

1. **Projects overview links.** The overview's own gallery cards and its closing index still link to the planned
   project pages (`/projects/<slug>`, in development until 1F). That page belongs to the previous design and was left
   unchanged, as the brief requires.
2. **Capabilities links.** The homepage's machinery cards link to `/capabilities#<machine>`, and the header's
   Capabilities link to `/capabilities`. That page is the planned "in development" page until 1E, as it was in the
   previous design's navigation.
3. **Plate entrance.** The plate's rising entrance still plays in cycle 1 only; your decision on that is still
   pending.

Stopped here. TM-2 and Stage 1E wait for your instruction.
