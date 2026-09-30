# RAWASY Metal Website — Stage TM-2 decision register (plan frozen)

**Date:** 2026-09-30 · **Branch:** `claude/new-session-5eijs6` · **Frozen baseline:**
`docs/reports/2026-09-29-tm2-migration-plan.md` (commit `7a45eb1`, unchanged)

**Status: your review approved the TM-2 audit with conditions. The plan is frozen as the migration baseline. TM-2.1 has
not started.**

- **The gate.** TM-2.1 starts only when you issue exactly: **"TM-1 VISUALLY APPROVED — BEGIN TM-2.1"**. TM-1's
  visual approval is not yet recorded.
- **This commit.** It records your decisions in this register and in `CLAUDE.md`. No source code, test, asset or
  configuration changed, and the plan file itself is untouched.
- **Nothing is live.** Nothing is deployed. The rollback checkpoint is intact: `preserve/pre-tm1-a-v2-migration` on
  GitHub and the local tag `pre-tm1-a-v2-migration`, both at `3260415`.

---

## 1. Decision register (as issued)

| # | Your decision | What it means in the batches |
| --- | --- | --- |
| D1 | TM-1 homepage visual approval is required before coding TM-2. | No TM-2 code until the gate phrase above. |
| D2 | Accept the proposed six-batch sequence. | TM-2.1 kit, Privacy, Terms, 404 → 2.2 Contact → 2.3 About, Industries, Clients, Certificates → 2.4 services overview and six service pages → 2.5 Projects overview → 2.6 retirement. Each batch is approved before the next. |
| D3 | Preserve existing Stage 1D content and structure; final visual approval on the migrated MC versions. | The service pages keep every section, sourcing rule and note. Their visual approval happens at TM-2.4, on the MC versions. |
| D4 | Option C: project-specific anchors in the migrated gallery; keep the six homepage project links unchanged. | TM-2.5 gives each gallery card an anchor that clears the header and the filter bar. About and service-page cards open the exact card. The overview's own cards become figures, and its index links to the cards. The homepage keeps `/projects#gallery`. See 3a and 3b. |
| D5 | Preserve Capabilities placeholder destinations until Stage 1E. | `/capabilities` and `/capabilities#<machine>` stay as they are. |
| D6 | Use the approved LaserEngrave drawing; exclude flagged photos. | TM-2.4: the services overview's engraving row shows `LaserEngrave`. `engraving-nameplates` and `engraving-wood` leave the page. |
| D7 | No floating WhatsApp button. | MC inner pages follow the homepage: WhatsApp stays in the footer, on Contact and in the quote hand-off. |
| D8 | Retire previous-design blueprint/editorial decoration. | Everything in plan C4: grid backdrops and drift, scan lines, frame marks, rulers, registration marks, `PointerLight`, loader, page wipe, outlined numerals, "Figure NN" labels, `Nameplate`, About sketch. |
| D9 | Restyle the other four existing service drawings without inventing new animation sequences. | Fold, axis plate, workbench and bay drawings are restyled in MC colours. Only their existing draw-on-reveal is kept. |
| D10 | Preserve the Google Maps embed and URLs; frame styling only. | The embed URL, iframe attributes, lazy loading and both map links stay byte-identical. Only the frame and the look of the pre-load placeholder change; the placeholder's grid goes under D8. |
| D11 | Move planned placeholders into MC during TM-2.6, retaining noindex. | Same text, status `planned`, noindex. This does not build 1E or 1F. |
| D12 | Preserve Theme Lab until you authorize its removal. | TM-2.6 does not delete the lab without your word. |
| D13 | All migrated inner pages remain review/noindex until Stage 1J. | `page-meta.ts` statuses do not change, and the sitemap does not change. |

## 2. Additional requirements, and where each is met

1. **The MC 404 and catch-all across both root layouts (TM-2.1).** Tested with real HTTP responses, not only rendered
   pages:
   - **Unknown pages.** `/en/<unknown>`, `/ar/<unknown>` and multi-segment unknown paths return status 404 with the
     MC view. Each has the right `lang` and `dir`, a localized title, `noindex`, and no sitemap entry.
   - **Unknown service or project.** `/en|ar/services/<unknown>` and `/en|ar/projects/<unknown>` also return 404.
     They show the previous design's 404 until their routes move (TM-2.4 and TM-2.6), then the MC one; the tests
     follow each move.
   - **Also tested:**
     - addresses without a language still redirect, then 404;
     - known pages in both designs still return 200;
     - a 404 built in the browser keeps the theme;
     - prefetch and page-data requests for 404 addresses do not loop;
     - the bilingual global fallback still works until TM-2.6.
2. **No unfinished project page presented as a finished case study.**
   - No migrated link points at a project page.
   - The TM-2.5 anchors clear both the MC header and the sticky filter bar (3b).
3. **The quotation form (TM-2.2).**
   - Logic, field validation and the no-backend disclosure are kept byte-for-byte.
   - For fixed inputs in English and Arabic, the prepared email link, WhatsApp link and copied text match the current
     ones exactly (golden outputs).
   - Controls, ids, names and ARIA attributes are compared in the DOM.
   - The no-JavaScript `mailto:` form is kept.
4. **Certificate redactions at the image-file level (TM-2.3).**
   - The eight files stay byte-identical to the hashes in plan E4, and are never re-encoded.
   - No CSS filter or extra zoom is added.
   - A test checks that no run of seven or more digits appears in the main text, the alt text or the structured data.
5. **The TM-1 homepage stays visually unchanged (every batch).**
   - Its markup is unchanged and its captures are pixel-identical.
   - Changes to shared MC modules are additions only, and they are listed.
6. **Browser-test assertions preserved (every batch).**
   - Each batch report maps every existing assertion to its new equivalent.
   - None is dropped without replacement coverage.
7. **Localhost and GitHub only.** No deployment.

## 3. Points reconciled within your decisions (no answer needed before TM-2.1)

- **3a. D4 and the batch order.** About (TM-2.3) and the service pages (TM-2.4) move before the gallery that carries
  the anchors (TM-2.5). The previous design's gallery must not change, so it cannot hold anchors in the meantime.
  - In TM-2.3 and TM-2.4, their project cards will open `/projects#gallery` with the homepage's approved label, "View
    in the gallery" / "عرض في معرض الأعمال".
  - TM-2.5 switches them to `/projects#<slug>`.
  - At no point do they link to an unfinished project page. Tell me if you would prefer another interim.
- **3b. Anchors, the sticky bar and filters (TM-2.5).**
  - **Landing position.** MC's scroll padding already clears the header (5.5 rem), and the two offsets add up. So a
    card's scroll margin adds only the height of the filter bar. The bar keeps one fixed height: one row of chips
    that scrolls sideways instead of wrapping.
  - **Filters.** If a filter hides the target card, an in-page link to it clears the filter first. Arriving from
    another page, the gallery opens unfiltered. Without JavaScript, every card is visible.
  - **Tests.** They check that the card lands below the bar at every tested width, in English and Arabic.
- **3c. The 404 headline.** "Outside the blueprint" / its Arabic line is copy, not decoration, so it stays under the
  copy rule unless you ask to change it. Its grid and cut line retire under D8.

## 4. Frozen state

- **Plan.** `docs/reports/2026-09-29-tm2-migration-plan.md` is unchanged since `7a45eb1`. This register sits beside
  it and records the decisions that settle its section G.
- **Code.** The code is the same as at `9a1cdae`.
- **When the gate phrase arrives.**
  1. Create a `preserve/pre-tm2` checkpoint at the then-current head.
  2. Start TM-2.1: the kit, Privacy, Terms and the localized 404.

## 5. QA

- **Nothing was run.** No build or browser test ran, because this commit is documentation only.
- **The last full run** (the navigation correction): lint and typecheck clean, 125 static pages built, 227 of 227
  browser tests passed.

## 6. Items needing RAWASY's confirmation

- Unchanged; see plan section K and `docs/ASSET_INVENTORY.md`.

## 7. Known limitations

- **3a and 3b are my reading.** They reconcile D4 with the approved batch order and do not change any decision.
  Please correct them if you meant otherwise.

## 8. Next step

- Waiting for **"TM-1 VISUALLY APPROVED — BEGIN TM-2.1"**. Until then there is no implementation and no deployment.
