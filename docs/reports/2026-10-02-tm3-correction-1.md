# Stage TM-3 — correction 1: 320 px homepage reflow and the fallback 404's logo in forced colours (report)

Date: 2026-10-02 · Branch: `claude/new-session-5eijs6` · Status: **built and returned for the user's independent
review**. Nothing was deployed. Stage 1E, 1F, 1I and 1J, the theme lab's removal, the OG images and the dictionary clean-up
were not started. The no-JS late-font residual was not touched.

## Summary

The two corrections from the TM-3 review, and nothing else:

1. **Homepage, 320 px.** Below 22.5 rem the two Industries lists stack in one column. At 320 px every name is whole,
   inside its card and beside its icon, in English and Arabic, light and dark, and the page no longer scrolls sideways
   (328 → 320 px). From 360 px the homepage is pixel-identical to TM-3 (360, 390, 834, 1024 and 1440 px).
2. **Fallback 404 in forced colours.** Its logo takes the forced text colour (`CanvasText`) in all four pairings of
   forced palette and stored theme. Before, it kept the theme's ink and vanished in both mismatched pairings. Normal-colour
   pixels are identical, and the page stays isolated.

The two changes are one Tailwind class and one CSS rule. JavaScript is byte-identical. The only markup change is that class,
on the homepage's two Industries lists. 13 new tests fail on the TM-3 build and pass on the correction. The full suite
passes **419 of 419** (none failed, flaky or skipped).

One finding outside the 320 px boundary is reported, not changed: at **360 and 390 px** the longest English Industries
names still run past their card's border (up to 17.9 px at 360, 2.9 px at 390). There is no sideways scroll. The brief keeps
360 and 390 unchanged, so the fix is left for your decision (item 20).

---

## 1. Starting SHA

`2cec1b08286c5e97212aee3000db4756d04f82fc`. Preflight:

- fetched;
- clean tree;
- local = remote;
- `preserve/pre-tm3` still at `de62bc5cf0ad291fc90fffce0a3b81e762f1ba9b`;
- the TM-3 implementation (`f7499cc`) and report (`2cec1b0`) present;
- no unreviewed drift.

No branch was created.

## 2. Correction commit SHA

`8f25531222845b2727761ccf57895f3132073a59` ("Fix the homepage's 320 px Industries overflow and the fallback 404's
logo in forced colours (TM-3 correction 1)"), directly on `2cec1b0`.

## 3. Branch HEAD

The commit that adds this report and the CLAUDE.md update, directly on top of the correction commit; its SHA is given in
the chat summary.

## 4. Files changed

| File | Change |
| --- | --- |
| `src/components/commerce/home/Industries.tsx` | +5 / −2: `max-[22.5rem]:grid-cols-1` on the two lists; the doc comment says why |
| `src/app/global-not-found.css` | +8: the forced-colours logo rule |
| `e2e/commerce-polish.spec.ts` | +6 tests: the Industries cards at 320 px (EN/AR × light/dark), the column count from 320 to 1440 px |
| `e2e/site.spec.ts` | +7 tests: the fallback's logo in forced colours (4 pairings), its normal colours (2), its isolation |
| `README.md` | the latest report and two test descriptions |
| `CLAUDE.md`, this report | documentation |

No other component, stylesheet, script, content, route or dependency changed.

## 5. Root cause of the 320 overflow

- Each Industries list was a two-column grid at every phone width. At 320 px the shell leaves 270 px, so each card is
  130 px.
- Inside a card: two 1 px borders, 12 px padding on each side, the 36 px icon chip and a 10 px gap. That leaves the name
  **58 px**.
- English names contain single words up to 108 px wide at the cards' 13.76 px: "Manufacturing" 108, "Infrastructure" 104,
  "Construction" 96, "Architecture" 93, "Commercial" 88. A word cannot wrap, so the text ran past its box.
- On TM-3, **7 of the 8 English names ran past their card's border, by 3.3–37.9 px.** The right column's
  "Infrastructure" ended at 328 px: 8 px of sideways scroll.
- What a reader saw was worse than the scroll. The next card and the section's sheet painted over the overflow, so names
  showed cut off: "Constructi", "Infrastructu", "Manufactu", "Architectu" (evidence 1). On a phone, the 8 px overflow also
  zoomed the whole page out slightly to fit.
- Arabic names are shorter: none left its card, but 5 of 8 overflowed their own text box into the card's padding.

## 6. Exact responsive fix

```tsx
<ul className="mt-3 grid grid-cols-2 gap-2.5 max-[22.5rem]:grid-cols-1 sm:gap-3 lg:grid-cols-4">
```

- **Built as** `@layer utilities { @media not all and (min-width: 22.5rem) { .max-\[22\.5rem\]\:grid-cols-1 {
  grid-template-columns: repeat(1, minmax(0, 1fr)) } } }`. It is the only rule added to the site stylesheet (130,780 →
  130,897 bytes, still one file on every page).
- **Below 22.5 rem** (under 360 CSS px at the default text size) the cards stack, one per row. At 320 px each card is
  270 px wide, with the name on one line beside its icon. The breakpoint is in rem, so a larger default text size
  switches sooner.
- **Unchanged:** the card, its padding and icon, the 13.76 px name, and the phone layout's hidden description. Nothing is
  truncated or hidden, and there is no `overflow-x: hidden`, transform or font change.
- **From 360 px** the rule is off (`min-width: 22.5rem` matches at exactly 360). The grid is two columns as before, four
  from 1024 px.
- **The section is taller at 320 px:** 805 → 1,012 px in English, 747 → 990 px in Arabic.
- **Markup:** the class appears on the two lists in `/en` and `/ar`. The resolved page data differs only in those two
  `className` strings; Arabic's raw payload rows were also re-chunked, which is the known Flight behaviour.

## 7. 320 containment proof

Measured on both builds, 320 × 700 phone, EN/AR × light/dark:

| At 320 px | TM-3 | Correction 1 |
| --- | --- | --- |
| Page width (scroll / client) | EN 328 / 320, AR 320 / 320 | **320 / 320** (all four) |
| Columns per list | 2 | **1** |
| Names whole in their own box | EN 0 / 8, AR 3 / 8 | **8 / 8** |
| Names past their card's border | EN 7 (3.3–37.9 px), AR 0 | **0** |
| Cards outside the screen or their grid | 0 | 0 |
| Gap between icon and name | 10 px | 10 px |
| Visible text past the screen edge | EN "Infrastructure" | **none** |

- **Focus:** the section's link ("Industries we serve") shows its whole 2 px ring inside the sheet and the screen. The
  cards take no focus.
- **Names:** every name matches the content layer's, untruncated (no ellipsis, no line clamp).
- **The rest of the homepage at 320 px:** with Industries hidden on both builds, the page is byte-identical screen by
  screen (4 × 17 screens, EN/AR × light/dark).
- **Five other pages at 320 px**, About, Projects, Contact, Laser Cutting and Capabilities in EN light and AR dark: no
  sideways scroll and no visible text past the screen, on both builds. The only text found past the edge is visually hidden
  screen-reader text (1 × 1 px, clipped), the same on both. 192 screens compared, all byte-identical.
- **axe-core** (WCAG 2.0/2.1/2.2 A + AA, best practice) on the homepage at 320, 360 and 390 px, EN/AR × light/dark (12 runs):
  **0 violations**.
- **Tests:** `commerce-polish.spec.ts`, "320×700, en/ar, light/dark" (4 tests).

## 8. 360 / 390 regression

- **Homepage screen by screen:** 360 px (16 screens each) and 390 px (15 / 14 each), EN/AR × light/dark. **All 122
  captures byte-identical.**
- **Full page at 834, 1024 and 1440 px**, EN/AR × light/dark: identical. One first-pass difference of 981 px inside a
  photo of the About section at 1024 px was 0 on recapture (image-decode noise).
- **The Industries section alone** at 360 and 390 px, EN/AR × light/dark: 0 differing pixels (evidence 3 and 4).
- **Tests:** two equal columns at 360, 390 and 834 px, four at 1024 and 1440, one at 320 and 359 (`commerce-polish.spec.ts`,
  EN and AR).
- **Found while measuring, not changed:** on TM-3 and the correction alike, the longest English names run past their
  card's border at these widths. There is no sideways scroll, and Arabic is fine.

  | Width | Name | Past its card's border |
  | --- | --- | --- |
  | 360 px | "Industrial & Manufacturing" | 17.9 px (across the neighbouring card's border) |
  | 360 px | "Infrastructure" | 13.9 px |
  | 360 px | "Construction" | 6.0 px |
  | 360 px | "Architecture & Façades" | 3.0 px |
  | 390 px | "Industrial & Manufacturing" | 2.9 px |

  The brief keeps 360 and 390 unchanged, so this is item 20.1.

## 9. Global-404 forced-colours fix

In `src/app/global-not-found.css`, after the logo's own rule:

```css
@media (forced-colors: active) {
  .g404-logo {
    color: CanvasText;
  }
}
```

Chromium keeps an inline SVG's own colour in forced colours, so the logo kept `color: var(--ink)`, the stored theme's
ink. Measured, served at a made-up address from each build's own `_not-found.html` (the existing test mechanism):

| Forced palette + stored theme | TM-3 logo ink | Correction 1 logo ink | Logo box drawn in the forced text colour (TM-3 → C1) |
| --- | --- | --- | --- |
| light + light | `#15171a` on white (visible) | `CanvasText` (black) | 0 % → 19.2 % |
| light + **dark** | `#eef1f4` on white (**invisible**) | `CanvasText` (black) | 0 % → 19.2 % |
| dark + **light** | `#15171a` on black (**invisible**) | `CanvasText` (white) | 0 % → 19.2 % |
| dark + dark | `#eef1f4` on black (visible) | `CanvasText` (white) | 18.3 % → 19.2 % |

- **Logo:** the orange piece keeps `#F15F22` in every pairing.
- **Unchanged on both builds, all four pairings:** the four buttons keep their 1 px borders and text in the forced link
  colour; the first link's 2 px focus ring shows; both language parts' headings and text are in `CanvasText`.
- **Not touched:** fonts, JS and normal colours (item 11).
- **Tests:** `site.spec.ts` "forced …, stored theme …" (4 tests). They check the forced text colour by computed style and
  by drawn pixels, plus the buttons, the ring and both parts.
- **axe under forced colours** reports colour-contrast on the fallback's badges and buttons in the mismatched pairings,
  **identically on TM-3**. These are false findings. Chromium's forced-colours emulation leaves `-webkit-text-fill-color`
  at the author's ink, and axe reads that, while `color` is forced and the text is drawn in the forced colour (verified in
  the drawn pixels). In normal colours axe finds **0 violations** on the fallback (8 runs: four pairings × 1440 / 320).

## 10. Global-404 isolation proof

- **Its own stylesheet**, still the only one it links: `1q-jxu5oo68em.css`, 17,129 bytes. It was `3dct6ciy1leb8.css`,
  17,070 bytes; one rule was added and none removed. No other page links it, and it carries no site rule.
- **Its own faces**, unchanged: the 12 non-preloaded MC faces it names. It has no font preload, and no other page names
  any of its font files.
- **No JS of its own:** no script chunk carries its markup, on either build. Its 7 scripts are Next.js's shared runtime,
  the same files as before.
- **Representative pages:** `/en`, `/ar/about`, `/en/projects`, `/en/services/laser-cutting` and
  `/theme-lab/en/modern-commerce-a-v2`. Their heads are identical to TM-3 once the site stylesheet's new hashed name is
  written the same; the lab's head is byte-identical. Each has the same stylesheets, the same two font preloads (Plus
  Jakarta Sans and Inter, `….p.woff2`) and the same scripts.
- **Tests:** `site.spec.ts` "stays on its own" (stylesheet, faces and no markup in any script, across six pages including
  `/ar` and the lab), alongside the existing "own small stylesheet, no font preload" test.

## 11. Normal-colour regression

TM-3 build (`2cec1b0`) beside the correction, motion frozen (reduced motion, reveals shown, images decoded). Phones are
captured screen by screen, wider views as full pages.

- **Homepage:** 360 / 390 / 834 / 1024 / 1440 px × EN/AR × light/dark. At 320 px it was compared with Industries hidden on
  both builds. All identical (item 8).
- **Five pages at 320 px:** identical (item 7).
- **TM-3's frozen work at 1440 / 390:**
  - About, Contact, Projects (both), Laser Cutting, Laser Engraving, Certificates (both), Clients (dark), Capabilities, a
    planned project page, the localized 404 and Privacy: identical.
  - Theme Lab A V2 in AR dark: identical. EN light differed by 2 pixels, each one colour level, in two passes. It is
    identical with the two servers captured in the other order, and the TM-3 server itself gave those two pixels
    differently across runs, so it is capture-order noise.
- **The fallback 404**, light and dark × 1440 / 390 / 320: **0 differing pixels** (evidence 9 and 10). A test also draws
  the page with and without its forced-colours rule, light and dark: pixel-identical.
- **The homepage's and the service pages' signatures,** paused at 0.3 / 1.2 / 2.6 / 4.2 s and finished, 20 frames:
  - Each frame matched exactly in at least one of three passes.
  - The few frames that differed (23–116 px) moved from pass to pass, as in TM-3.
  - Their code and styles are byte-identical.
- **In all:** 1,154 captures (577 pairs) in four passes. Nothing differs apart from the Industries section at 320 px and
  the noise above.
- **One method was replaced.** A first section-by-section capture at 320 px could not be compared: the TM-3 build's 8 px
  overflow zooms the whole English phone page out, and every section below the taller Industries moves by a fraction of a
  pixel. It was replaced by the comparison with Industries hidden on both builds (item 7).

## 12. TM-3 regression

- **Build output:**
  - All 27 JavaScript files are byte-identical.
  - 10 of 12 stylesheets are byte-identical. The other two each gained one rule (items 6 and 9); none was removed, so
    TM-3's switch, logo, header-mark, hero and menu-sheet rules are intact.
  - 1,027 of 1,058 server files are identical once the build id and stylesheet names are normalised. The other 31 are 23
    file-trace hash files and the homepage's 8 HTML and page-data files (the class).
- **Tests:** all 29 TM-3 polish tests are green on the final build, with the whole suite (item 18).
- **Frozen parts:** PageHero's first paint, both colour switches, the header and footer in forced colours, the menu sheet
  and its targets, normal navigation, the signatures, the project filters, Contact, Certificates and the planned pages.
  All are covered by their specs, green; their captures are in item 11.

## 13. No-JS anchor status unchanged

No change was attempted: no timer, scroll script, `:has()` anchoring selector or root snapping. The legal pages' HTML is
byte-identical, and the one new site rule cannot match them. Re-measured once on both builds with the TM-3 matrix (9
addresses × 1440 / 390 × fonts held back 0 / 300 / 1500 ms, fresh context):

| Build | Landings | Off by more than 1 px at the end | Where |
| --- | --- | --- | --- |
| TM-3 (`2cec1b0`) | 54 | 4 | `/en/privacy#contact` (107 px) and `/ar/terms#contact` (95 px), at 1440 |
| Correction 1 | 54 | 5 | the same two addresses and offsets, at 1440 |

- With JavaScript: **54 of 54 exact on both builds** (sampled at load, after the fonts, two frames later and 700 ms
  later).
- The no-JS count varies from run to run on the same build. TM-3's report measured 11 and 10 of 162 over three runs, 3 to
  4 per run. The addresses and offsets are TM-3's.

`commerce-anchors.spec.ts` is green.

## 14. `npm ci`

Exit 0: 374 packages added, 0 vulnerabilities (the existing deprecation notice for eslint 9.39.5). `package.json` and the
lockfile are unchanged.

## 15. Lint

`npm run lint`: 0 errors, 0 warnings.

## 16. Typecheck

`npm run typecheck`: 0 errors.

## 17. Build

`npm run build` after `npm ci`: 0 warnings, 0 errors; **125 static pages** (unchanged). It is byte-identical to the build
the QA ran on: 1,058 of 1,058 server files, all 12 stylesheets and every script chunk.

## 18. E2E

`npm run test:e2e` on the final build: **419 passed, 0 failed, 0 flaky, 0 skipped** (11.8 min, exit 0, no retries).

- TM-3 had 406; correction 1 adds 13 (6 in `commerce-polish.spec.ts`, 7 in `site.spec.ts`).
- **All 29 TM-3 polish tests pass**: 35 in that file with the 6 new ones.
- On the TM-3 build all 13 new tests fail, while the 4 existing fallback-404 tests pass. The new tests fail without the
  corrections.
- Every existing assertion is kept; no test was removed or weakened.

## 19. Screenshots

Sent with this report (each at most 2400 px). Every image shows TM-3 (before) beside correction 1:

1. Homepage EN 320: Industries, before and after (light and dark)
2. Homepage AR 320: Industries after (before for reference; after in light and dark)
3. Homepage EN 360: Industries unchanged (0 differing pixels, light and dark)
4. Homepage EN 390: Industries unchanged (0 differing pixels, light and dark)
5. Fallback 404, forced light palette with the light theme stored
6. Fallback 404, forced dark palette with the dark theme stored
7. Fallback 404, forced light palette with the **dark** theme stored (the logo vanished before)
8. Fallback 404, forced dark palette with the **light** theme stored (the logo vanished before)
9. Fallback 404, normal light: 1440 and 390, 0 differing pixels
10. Fallback 404, normal dark: 1440 and 390, 0 differing pixels

Evidence 3 and 4 also show the 360 / 390 finding (item 8): the English names touching or crossing their card's border, the
same on both builds.

## 20. Remaining deferred items

Not changed in this correction, for your decision:

1. **360 / 390 px, English Industries names past their card** (found in this correction; item 8). Up to 17.9 px at 360
   and 2.9 px at 390, with no sideways scroll; pre-existing. The brief kept these widths unchanged. Raising the one-column
   rule to about 26 rem (416 px) would contain every English name, but changes the 360 and 390 px homepage.
2. **No-JS late-font residual** (TM-3 item 13): documented release information, unchanged (item 13).
3. **About and the services overview, desktop LCP ~1.1–1.3 s**: the largest paint is in the section under the hero.
4. **Arabic desktop CLS 0.0028–0.0085**: the Arabic web fonts swap in while the hero is visible (1J, a root layout per
   language).
5. **Below 320 CSS px** (a phone at 200 % page zoom) and doubled text on phones: the header overflows. Pre-existing,
   outside the 320 px boundary, documented separately.
6. **axe under forced-colours emulation** reports false colour-contrast findings on the fallback 404 (item 9). This is a
   limit of the test method, not a defect.
7. **OG share images**: a Stage 1J / SEO-release task (`scripts/generate-og.mjs`, `npm run assets:og`), not touched.
8. **Dictionary keys** only the retired shell read: kept until a usage audit.

---

## How to run

```bash
npm ci
npm run lint && npm run typecheck
npm run build && npm run test:e2e
npx next start -p 3400   # then /en at 320 px wide; the fallback 404 is checked from the build output (site.spec.ts)
```

## Next steps

Return TM-3 correction 1 for independent review. Not started, by instruction: Stage 1E, 1F, 1I and 1J, the theme lab's
removal, OG regeneration, the dictionary clean-up and deployment.
