# Stage TM-3 — correction 2: the homepage's Industries cards at 360 / 390 px (report)

Date: 2026-10-02 · Branch: `claude/new-session-5eijs6` · Status: **built and returned for the user's independent
review**. Nothing was deployed. Stage 1E, 1F, 1I and 1J, the theme lab's removal and deployment were not started. The
fallback 404 and the no-JS anchor residual were not touched.

## Summary

One correction, as the brief scopes it: the homepage's Industries cards at normal phone widths.

1. **Cause.** Correction 1 stacked the cards only below 22.5 rem (360 px). From 360 to 431 px each list kept two cards
   per row, and a phone card sets its name beside its icon. That left the name 78 px at 360 px and 93 px at 390 px.
   English words up to 107.9 px wide ("Manufacturing") ran past their own box and up to 17.9 px past the card's border.
   The next card painted over the overflow, so names showed cut ("Manufacturinc").
2. **Fix.** The one-column rule now applies below **27 rem** (432 px at the default text size):
   `max-[22.5rem]:grid-cols-1` becomes `max-[27rem]:grid-cols-1` on the two lists. 27 rem was measured, not picked as a
   device width. It is the first whole pixel at which two cards hold every name in every face measured: the site's
   face from 422 px, the widest fallback face from 432 px. No type, padding, icon, gap or copy changed.
3. **Result.** At 320, 360 and 390 px, in English and Arabic, light and dark:
   - one column;
   - every card inside its grid;
   - every name whole on one line, inside its own box and its card, clear of its icon;
   - no overlap and no sideways scroll.

   The same holds at every width from 320 to 1440 px, measured every pixel, with and without the web fonts.
4. **Unchanged:**
   - 320 px, pixel-identical to correction 1;
   - everything from 432 px (two columns, four from 1024 px; 834, 1024 and 1440 px pixel-identical);
   - the rest of the homepage at 360 and 390 px, pixel-identical with the section hidden;
   - every other page, the fallback 404 and all JavaScript.

   The built difference is one CSS rule and one class string on two lists.
5. **Tests.** Correction 1's six Industries tests are replaced by eight that check containment, not only the column
   count. All eight fail on correction 1 and pass on correction 2.
6. **Full suite on the final build: 421 passed, 0 failed.** I ran it twice; the second run started from an empty image
   cache. An earlier run on the same build had 13 failures: 12 timeouts on photo-heavy pages and 1 timing race in an
   existing Clients test. During that run my own image processing was using the CPU (item 24).

All measurements below ran on the correction's build, which is byte-identical to the final build (item 23).

---

## 1. Starting SHA

`9e194e9db9f18b07233a31221c5e2f133c069598`. Preflight:

- fetched;
- clean tree;
- local = remote (`origin/claude/new-session-5eijs6` at the same commit);
- `preserve/pre-tm3` still at `de62bc5cf0ad291fc90fffce0a3b81e762f1ba9b` on GitHub;
- correction 1's fix (`8f25531`) and report (`9e194e9`) present;
- no unreviewed drift.

No branch was created.

## 2. Correction commit SHA

`0f5314575e65215d906af37e7eb11c523b6c4827` ("Contain the homepage's Industries names at phone widths: one column below
27 rem (TM-3 correction 2)"), directly on `9e194e9`.

## 3. Branch HEAD

The commit that adds this report and the CLAUDE.md update, directly on the correction commit. Its SHA is given in the
chat summary.

## 4. Files changed

| File | Change |
| --- | --- |
| `src/components/commerce/home/Industries.tsx` | +4 / −2: `max-[27rem]:grid-cols-1` replaces `max-[22.5rem]:grid-cols-1` on the two lists; the doc comment gives the measured reason |
| `e2e/commerce-polish.spec.ts` | +145 / −87: correction 1's Industries block (6 tests) replaced by 8 tests; the file's header |
| `README.md` | +2 / −2: the latest report; the polish spec's description |
| `CLAUDE.md`, this report | documentation |

Built, the site stylesheet changes one rule (130,897 → 130,892 bytes, still one stylesheet on every page):

```css
/* correction 1 */ @media not all and (min-width:22.5rem){.max-\[22\.5rem\]\:grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}}
/* correction 2 */ @media not all and (min-width:27rem){.max-\[27rem\]\:grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}}
```

No other component, stylesheet, script, content, route or dependency changed. The fallback 404 was not touched.

## 5. Exact root cause

- **Correction 1 stopped at 360 px.** Its rule stacked the cards below 22.5 rem only. From 360 to 431 px each list kept two
  cards per row.
- **A phone card's fixed parts take 72 px.** Below 640 px a card sets its name beside the icon. The fixed parts are two
  1 px borders, 12 px of padding on each side, the 36 px icon chip and a 10 px gap. A card is half the grid less 5 px.
  The grid is the screen less 2 × 25 px up to 400 px: an 8 px sheet inset, a 16 px gutter and a 1 px sheet border on
  each side. Above 400 px the gutter is 4 vw.
- **So the name had 78 px at 360 px and 93 px at 390 px.** At the cards' 13.76 px bold, single English words are wider and
  cannot wrap:

  | Word | Width (measured) |
  | --- | --- |
  | "Manufacturing" | 107.9 px |
  | "Infrastructure" | 103.9 px |
  | "Construction" | 96.0 px |
  | "Architecture" | 93.0 px |
  | "Commercial" | 88.2 px |
  | "Landmarks" | 80.3 px |
- **On correction 1:**
  - At 360 px, 6 of the 8 English names ran past their own box, by 2.3–29.9 px. 4 of them ran past the card's border:
    "Manufacturing" by 17.9 px, "Infrastructure" by 13.9 px, "Construction" by 6 px, "Architecture" by 3 px.
  - At 390 px, 3 names ran past their own box (3–14.9 px), and "Manufacturing" ran 2.9 px past the border.
  - Names ran past their own box at every width from 360 to 421 px; in the fallback face, up to 431 px.
  - The neighbouring card painted over the overflow, so readers saw cut names ("Manufacturinc", evidence 2).
  - The page did not scroll sideways, which is why a page-overflow check could not catch it.
- **Arabic** names are shorter: on correction 1 they stayed inside their cards in two columns, on two or three lines.

## 6. Responsive strategy selected

**Strategy B**: one column below the narrowest width at which two columns contain every name, which is 27 rem.

## 7. Why that strategy

Strategy A (keep two columns from 360 px) cannot contain the names within the brief's limits:

- **The shortfall.** The name needs up to 29.9 px more at 360 px and 14.9 px more at 390 px. The card's other 72 px are
  its border, padding, icon and gap.
- **Every way to find that room is forbidden or a redesign:**
  - smaller type ("materially smaller typography");
  - breaking the words ("Manufactu|ring", by `break-all`, `overflow-wrap: anywhere` or hyphenation: the unnatural break);
  - clipping or an ellipsis;
  - shrinking the icon, padding and gap together. Freeing 30 px at 360 px leaves a 24 px icon, 6 px padding and a 4 px
    gap: crowding the icon;
  - a new card layout, such as the name under the icon. That redesigns the section.
- **What the brief prescribes.** "Content containment has priority", and Strategy B is its stated fallback.
- **Nothing new to design.** One column is correction 1's existing 320 px layout: the same cards, one per row.

## 8. Chosen breakpoint

**27 rem, which is 432 px at the default text size.**

- **Class:** `max-[27rem]:grid-cols-1`.
- **Built as:** `@media not all and (min-width: 27rem)`.
- **Columns:** one through 431 px, two from 432 px, four from 1024 px (64 rem, unchanged).

It was derived from measured card and content widths: every 1 px from 320 to 1440 px, fractional layout values, each
line of text from `Range.getClientRects()` against its box:

| Face of the names (13.76 px, bold) | "Manufacturing" | Two columns first hold every name at |
| --- | --- | --- |
| Plus Jakarta Sans (the site's face) | 107.9 px | 422 px (26.4 rem) |
| Arial metrics (next/font's fallback: `local(Arial)` at 104.98 %; Liberation Sans here) | about 99 px | 403 px |
| DejaVu Sans Bold (the system face where Arial is missing, as on this Linux machine) | 112.3 px | 432 px (27 rem) |

- **The fallback face must fit too.** The faces use `display: swap`, so the fallback face shows until the web font arrives,
  and for good if it fails. 27 rem is the first whole pixel at which the widest measured face fits: 0.4 px to spare,
  against 4.8 px for the site's face.
- **It is in rem,** so it follows the reader's text size, like the cards' type, icon, padding and gap.
- **It is not a device width.** Phones from 360 to 430 px all get one column, and two columns start at 432 px.

## 9. 320 results

Unchanged from correction 1, and pixel-identical to it.

| At 320 px, EN and AR × light and dark | Result |
| --- | --- |
| Columns | 1 |
| Page width (scroll / client) | 320 / 320 |
| Cards inside their grid and the screen | 8 of 8 per language |
| Names whole, inside their own box and their card, clear of the icon | 8 of 8 per language |
| Spare room for the longest word beside the icon | EN 90.1 px (85.6 in the fallback face); AR 134 px |
| Closest text to the inside of a card border | EN 18.1 px; AR 58 px |
| Overlaps, ellipses, line clamps | none |
| Pixels against correction 1 | identical (74 of 74 screens) |

## 10. 360 results

| At 360 px | Correction 1 | Correction 2 |
| --- | --- | --- |
| Columns | 2 | **1** |
| Card width | 150 px | 310 px |
| English names past their own box | 6 of 8 (2.3–29.9 px) | **0** |
| English names past the card's border | 4 of 8 (up to 17.9 px) | **0**: closest text 58 px inside (fallback face 42.4) |
| "Manufacturing" against its box | 29.9 px over | **130.1 px to spare** (fallback face 125.6) |
| Arabic | 2 columns, inside the cards, 2–3 lines | 1 column, one line each, 174 px to spare |
| Page width (scroll / client) | 360 / 360 | 360 / 360 |
| Section height | EN 786 px, AR 720 px | EN 1,012 px, AR 963 px |

Checked in EN and AR × light and dark (browser tests, item 24).

## 11. 390 results

| At 390 px | Correction 1 | Correction 2 |
| --- | --- | --- |
| Columns | 2 | **1** |
| Card width | 165 px | 340 px |
| English names past their own box | 3 of 8 (3–14.9 px) | **0** |
| English names past the card's border | 1 of 8 (2.9 px) | **0**: closest text 58 px inside |
| "Manufacturing" against its box | 14.9 px over | **160.1 px to spare** (fallback face 155.6) |
| Arabic | 2 columns, inside the cards | 1 column, one line each, 204 px to spare |
| Page width (scroll / client) | 390 / 390 | 390 / 390 |
| Section height | EN 716 px, AR 683 px | EN 960 px, AR 964 px |

Checked in EN and AR × light and dark (browser tests, item 24).

## 12. Boundary probes

The boundary is 27 rem = 432 px. The two numbers in a cell are the site's face / the fallback face.

| Width | Columns | Longest word, spare room | Closest text to a card border | Against correction 1 |
| --- | --- | --- | --- | --- |
| 431 (boundary − 1) | 1 | 198.6 / 194.2 px | 58 / 58 px | was 2 columns: 4.3 px to spare in the site's face, 0.1 px over in the fallback face |
| 432 (boundary) | 2 | 4.8 / 0.4 px | 16.8 / 12.4 px | identical (0 pixels differ) |
| 433 (boundary + 1) | 2 | 5.3 / 0.8 px | 17.3 / 12.8 px | identical (0 pixels differ) |

- **Arabic:**
  - 431 px: 1 column, 242.5 px to spare.
  - 432 px: 2 columns, 48.7 px to spare, closest text 17.7 px from the border.
  - 433 px: 2 columns, 49.2 px to spare, closest text 12.2 px from the border.
- **A browser test pins the boundary:** at 431 / 432 / 433 px it checks the columns 1 / 2 / 2 and full containment in
  both languages, and again with the web fonts blocked.

## 13. 375 / 393 / 412 / 430 results

Two numbers in a cell are the site's face / the fallback face.

| Width | Columns | Card | Longest word, spare room | Closest text to a card border | Correction 1 there (two columns) |
| --- | --- | --- | --- | --- | --- |
| 375 | 1 | 325 px | 145.1 / 140.6 px | 58 / 57.4 px | 22.4 px over its box, 10.4 px past the border |
| 393 | 1 | 343 px | 163.1 / 158.6 px | 58 / 58 px | 13.4 px over its box, 1.4 px past the border |
| 412 | 1 | 361.1 px | 181.1 / 176.7 px | 58 / 58 px | 4.4 px over its box (7.6 px inside the border) |
| 430 | 1 | 377.6 px | 197.7 / 193.3 px | 58 / 58 px | 3.9 px to spare; the fallback face 0.6 px over its box |

Arabic: one column at all four widths, with 189–241.6 px to spare. There is no sideways scroll anywhere.

**Full sweeps** ran every 1 px from 320 to 1440 px, in both languages, with and without the web fonts:

- **Columns:** one from 320 to 431 px, two from 432 to 1023 px, four from 1024 to 1440 px.
- **No defect found:** no sideways scroll, no card outside its grid, no overlap, no name scrolling, no text past its card.
- **Rounding only:** at a few isolated widths one line box reads 0.02 px past its own box. In English, with the web
  fonts, that is 604, 642, 1031 and 1260 px; in Arabic, 734, 1121, 1215 and 1305 px. This is Chromium's 1/64 px layout
  rounding, at the same widths on correction 1, and the browser tests allow 0.1 px for it.

## 14. EN / AR

- **One rule for both languages.** The class sits on the shared lists, so Arabic keeps English's column architecture:
  one column to 431 px, two from 432 px, four from 1024 px.
- **Arabic:**
  - right to left, with the icon at the start (right);
  - every name whole on one line from 320 to 431 px; at 432 px, 48.7 px to spare;
  - no letter spacing: the `:lang(ar)` rule is unchanged, and every Arabic name computes `letter-spacing: normal` on
    both builds;
  - no clipping, and icons aligned with their names (evidence 4–6).
- **Names** match the content layer in reading order (the profile's sectors, then the website's classifications), in
  both languages. No copy changed.

## 15. Light / dark

- The rule changes layout only, no colour.
- The browser tests check each language in light and dark at 320, 360 and 390 px, with every containment check and the
  focus ring.
- axe ran in both themes (item 16), and so did the pixel regression (item 17).

## 16. Accessibility

- **axe-core 4.13.0** on the whole homepage at 320, 360 and 390 px, EN and AR × light and dark: 12 runs (WCAG 2.0 / 2.1 /
  2.2 A and AA plus best practice), **0 violations**.
- **Focus:** "Industries we serve" shows its whole 2 px ring inside the sheet and the screen at 320, 360 and 390 px, in all
  four language and theme pairs (browser test). The cards take no focus, as before.
- **Names:** readable, one line each at phone widths, the same 13.76 px bold. Nothing collides: no text under the icon,
  no card over another (browser tests).
- **Reading order:** unchanged. The DOM order is the same, so a screen reader reads the same list.
- **200 % text** (the browser's own text size, through CDP `Page.setFontSizes`, which also scales rem breakpoints):
  - At 1280, 1440 and 1920 px wide, EN and AR: two columns, every name inside its card (closest 1.6 px inside the
    content box) and no sideways scroll.
  - On a phone, 150–200 % text equals a screen of 195–287 CSS px, below the site's 320 px boundary. The header's controls
    already overflow there, on both builds (pre-existing, item 26). At 150 % (390 and 430 px) the cards stay inside. At
    200 % on a 390 px phone (= 195 px) five English names run past their box, as on correction 1.
- **Reflow (WCAG 1.4.10):** the 320 CSS px case is item 9.

## 17. Homepage regression

**Static comparison with correction 1's build** (build id normalised):

- **Server files:** 1,036 of 1,058 prerendered files are identical. The other 22:
  - 8 are the homepage's own: for `en` and `ar`, the HTML, the page data and two segment payloads. The only change in
    each is `max-[22.5rem]` → `max-[27rem]`: the class on the two lists, in the markup and in the page data.
  - 14 differ only in file-trace hashes (`*.nft.json`).
- **JavaScript:** 27 of 27 files identical; the build-id manifests match once the id is normalised.
- **CSS:** 11 of 12 stylesheets byte-identical; the site sheet changes its one rule (item 4).

**Pixels, correction 1 against correction 2** (reduced motion, 1× scale):

| Captures | Result |
| --- | --- |
| 320 px, EN and AR × light and dark, screen by screen | 74 of 74 identical |
| 360 and 390 px with the Industries section hidden on both builds, EN and AR × light and dark | 132 of 132 identical |
| 834, 1024 and 1440 px, full page, EN and AR × light and dark | 12 of 12 identical (after the recapture below) |
| The homepage's two signatures at 300, 1,200, 2,600 and 4,200 ms, EN light and AR dark | identical in every capture (5 per build) |
| The signatures' finished frames | the same renderings on both builds (below) |

- **Recapture.** In the first pass three full-page captures differed:
  - AR light 1440 px: 81,145 px, the About photo;
  - AR light 834 px: 1,673 px;
  - EN dark 834 px: 5 px, at the header's menu button.

  I recaptured them twice, the second time capturing the builds in the opposite order. Each build produced both
  renderings, and every capture of one build matches a capture of the other. They are capture noise (image decoding and
  load timing), not the build.
- **Finished frames.** A signature's finished frame, with every animation held at its end, varies from capture to capture
  on both builds. Three frames do: the homepage's (EN light, AR dark) and Laser Engraving's (AR dark). They have two
  renderings each, 51–116 px apart, and no pixel differs by more than one level in one colour channel: rounding inside
  the engraved plate. Over 5 to 11 captures per build and frame, each build produced each rendering. On the homepage's
  EN-light frame, correction 1 gave 10 + 1 and correction 2 gave 3 + 2. Laser Cutting's finished frame never varied.
- **Unchanged by construction:** the hero loop, the signatures, the ambient, the pointer, the header, the footer and its
  links. Their scripts and markup are identical, and `commerce-home.spec.ts` passes in full (25 tests).
- **The only normal-colour difference** is the Industries section at the widths where the new rule applies, 360–431 px
  (evidence 2, 3, 5–7, 10 and 11).

## 18. Correction 1 regression

- **The 320 px fix is kept.** 320 px is below 27 rem, and it is pixel-identical (74 screens). Its tests now run at 320,
  360 and 390 px.
- **The fallback 404 is untouched.** `global-not-found.css` and `global-not-found.tsx` are unchanged, and the built page
  is identical. Its six normal-colour captures (light and dark × 1440, 390 and 320 px) are identical. All 7 of its tests
  pass: the logo in forced colours in 4 pairings, normal colours (2), isolation (1).

## 19. TM-3 regression

- **The TM-3 rules are untouched.** Its fixes are CSS rules other than the one that changed: the inner pages' hero with
  the first paint, the switches, the logos and header marks in forced colours, and the phone menu sheet.
- **Its tests pass:** all 29 TM-3 tests in `commerce-polish.spec.ts` (37 in the file with the 8 new ones).
- **Other pages are pixel-identical to correction 1:**
  - About at 1440 px; Contact (AR) at 390 px; Projects at 390 px (24 screens); Laser Cutting at 1440 px;
    Capabilities at 320 px; the localized 404 at 1440 px;
  - the service pages' signatures (Laser Cutting EN light, Laser Engraving AR dark) at 300, 1,200, 2,600 and 4,200 ms.
- **The other page specs pass** in both clean runs:

  | Spec | Tests |
  | --- | --- |
  | `commerce-anchors` | 15 |
  | `commerce-certificates` | 17 |
  | `commerce-company` | 22 |
  | `commerce-contact` | 34 |
  | `commerce-inner` | 20 |
  | `commerce-planned` | 18 |
  | `commerce-projects` | 51 |
  | `commerce-services` | 58 |
  | `site` | 14 |
  | `stage-1c` | 26 |
  | `theme-lab` | 39 |
  | `theme-lab-a-v2` | 45 |

## 20. `npm ci`

Exit 0: 374 packages added, 375 audited, 0 vulnerabilities. The one notice is the existing eslint 9.39.5 deprecation.
`package.json` and the lockfile are unchanged.

## 21. Lint

`npm run lint` (eslint): 0 errors, 0 warnings.

## 22. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): 0 errors.

## 23. Build

`npm run build` from an empty `.next`, after `npm ci`:

- exit 0, with 0 warnings and 0 errors;
- **125 static pages** (unchanged), compiled in 7.1 s;
- byte-identical to the build the QA ran on: 1,058 of 1,058 server files and 93 of 93 static files (12 stylesheets, 27
  scripts, 54 fonts and media), with the build id normalised.

## 24. E2E

`npm run test:e2e` runs 421 tests on 3 workers, with no retries configured. Every run used the final build:

| Run | Conditions | Passed | Failed | Flaky | Skipped | Retries | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right after the build from an empty `.next`, so the image cache was empty; my image composition and build comparisons ran alongside | 408 | 13 | 0 | 0 | 0 | 16.4 min |
| 2 | image cache warm, nothing else running | **421** | **0** | 0 | 0 | 0 | 12.0 min |
| 3 | image cache emptied again, nothing else running | **421** | **0** | 0 | 0 | 0 | 12.4 min |

- **Run 1's 13 failures:**
  - **12 page timeouts:** 8 in the Projects spec, the four company pages' containment sweep, two Stage 1C inner-page
    checks (at 834 px, and without JavaScript), and the lab's option C without JavaScript. Each waited on `load` or
    `networkidle` while the server optimized photos into its empty cache and my own work used the CPU.
  - **1 timing race** in an existing Clients test, explained below.
- **Why the 13 are not regressions:**
  - They cover pages whose served files are byte-identical to correction 1.
  - Runs 2 and 3 passed all of them on the same build.
  - The empty cache alone does not cause them: run 3 started from one and passed, and so did the Projects spec run on its
    own from an empty cache (51 of 51, 1.2 min).
- **The Clients race.** In `commerce-company.spec.ts`, "in forced colours the switch still shows its state" waits until
  the dot starts moving, then reads the track colour once. The track's background is still in its 320 ms transition then.
  Under load it read the start colour (`Canvas`, white) once.
  - It passed in runs 2 and 3, as in every earlier stage.
  - I did not change it, because it is outside this correction. It is recorded in CLAUDE.md, with the fix: poll the
    colour.
- **The 8 new tests** (`commerce-polish.spec.ts`, "corrections 1 and 2: the homepage's Industries cards"):

  | Tests | What they check |
  | --- | --- |
  | 1–4 | EN and AR × light and dark at 320, 360 and 390 px: one column; the names equal to the content layer's; no problem found; no sideways scroll; the whole focus ring on "Industries we serve" |
  | 5–6 | English, Arabic at 375, 393, 412, 430, 431, 432, 433, 640, 834, 1023, 1024 and 1440 px: the expected columns, no problem found |
  | 7 | every 4 px from 320 to 1440 px, plus 431, 433, 639, 641, 1023 and 1025, in both languages |
  | 8 | the web fonts blocked (the fallback face), in English at 320, 360, 390, 431, 432, 433, 640 and 1024 px |

  "A problem" is any of these:
  - the page scrolls sideways;
  - a card leaves its grid or the screen, is not one column wide, or stands more or less than one gap from its
    neighbour in the row;
  - two cards overlap;
  - a name scrolls (`scrollWidth > clientWidth`) or is shortened (an ellipsis or a line clamp);
  - a text is not drawn, or its box leaves the card;
  - a line of text runs past its own box, past the card's content box (0.1 px allowed for layout rounding) or under the
    icon.
- **The new tests fail without the correction.** Run against correction 1's build, all 8 fail. They name the wrong column
  count (two columns from 360 px) and the names running past their boxes. The sweep alone lists 181 problems in English,
  at 19 widths from 360 to 431 px.
- **Counts:** 421 = 419 (correction 1) − 6 (correction 1's Industries tests, replaced) + 8. `commerce-polish.spec.ts` has
  37: the 29 TM-3 tests and the 8 new ones.
- **Nothing was weakened.** No other test was changed, removed or weakened. Every assertion of correction 1's six tests
  is kept, at more widths: column counts, names, cards in the screen and the grid, cards one column wide and a gap apart,
  names whole and drawn, text inside the card and clear of the icon, no sideways scroll, the focus ring. The column
  boundary moved from 360 to 432 px.

## 25. Screenshots

Sent with this report, each at most 2,400 px. Each shows correction 1 (before) beside correction 2. Every card's border
box is outlined in magenta and every name's drawn text in cyan, so a name past its card shows cyan outside magenta. Each
image's caption gives the measurements. Light theme; the dark theme is covered by the tests and the pixel regression.

1. EN 320 px: one column before and after (0 pixels differ)
2. EN 360 px: two columns → one column ("Manufacturing" 29.9 px past its box and 17.9 px past the border before)
3. EN 390 px: two columns → one column (14.9 px past its box and 2.9 px past the border before)
4. AR 320 px: one column before and after (0 pixels differ)
5. AR 360 px: two columns → one column, as in English
6. AR 390 px: two columns → one column, as in English
7. EN 431 px (breakpoint − 1): one column
8. EN 432 px (breakpoint, 27 rem): two columns before and after (0 pixels differ)
9. EN 433 px (breakpoint + 1): two columns before and after (0 pixels differ)
10. EN 412 px: two columns → one column
11. EN 430 px: two columns → one column
12. Desktop and tablet regression: EN 834, 1024 and 1440 px (0 pixels differ at each)

## 26. Remaining deferred items

Not changed in this correction:

1. **No-JS late-font residual** (TM-3 item 13). Not worked on, as the brief requires.
2. **About and the services overview, desktop LCP about 1.1–1.3 s.** Their largest paint is in the section under the hero.
3. **Arabic desktop CLS 0.003–0.009.** The Arabic web fonts swap in while the hero is visible; preloading them needs a
   root layout per language (1J).
4. **Below 320 CSS px, and doubled text on phones:** the header's controls overflow (a phone at 200 % page zoom, or
   150–200 % text). Pre-existing and identical on correction 1, outside the 320 px boundary (item 16).
5. **axe under forced-colours emulation** reports false colour-contrast findings on the fallback 404. A limit of the test
   method, not a defect.
6. **OG share images:** a Stage 1J / SEO-release task (`scripts/generate-og.mjs`).
7. **Dictionary keys** that only the retired shell read: kept until a usage audit.
8. **The Clients switch test's timing race** (item 24). It is in an existing test, outside this correction's scope. Its
   fix, polling the track colour, is for your decision.

The Industries section is taller on phones from 360 to 431 px, because the cards now take a row each. In English it is
226 px taller at 360 px and 244 px taller at 390 px. That is the expected cost of containment, not an open item.

---

## How to run

```bash
npm ci
npm run lint && npm run typecheck
npm run build && npm run test:e2e   # with nothing heavy running alongside (CLAUDE.md)
npx next start -p 3400              # then /en and /ar at 320, 360, 390, 431, 432 and 433 px wide
```

## Next steps

Return TM-3 correction 2 for independent review. Not started, by instruction: Stage 1E, 1F, 1I and 1J, the theme lab's
removal and deployment.
