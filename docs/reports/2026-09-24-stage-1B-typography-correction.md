# RAWASY — Stage 1B homepage typography and visual hierarchy correction

**Status: correction done and pushed. Stage 1B is NOT self-approved. The homepage is back with you
for approval.** Stage 1A stays approved. Stage 1C and all inner-page design work have not been started.

- Branch: `claude/new-session-5eijs6`
- Base: build `37ada0e`, report `dd35d86`

## 1. Commit

| | |
| --- | --- |
| Correction commit | `4b2d6ab73c09091eb44d2324690c0714050ab49b`, "Refine homepage Arabic typography and visual hierarchy" (one focused commit) |
| Report commit | Docs only (this file, `CLAUDE.md` and the README report pointer), made separately so the correction commit stays focused |

## 2. Files changed (22)

**Fonts and tokens**

- `src/app/fonts.ts`: Noto Kufi Arabic added; Plex narrowed to 400/500.
- `src/app/[locale]/layout.tsx` and `src/app/global-not-found.tsx`: Kufi variable wired in. The skip link uses the display face.
- `src/app/globals.css`:
  - per-language font roles
  - Arabic line-height tokens
  - new type scale
  - Arabic heading rules
  - mask-reveal and statement clipping room
  - buttons and arrow links use the display face

**New component**

- `src/components/ui/Phrases.tsx`: headings wrap at phrase boundaries.

**Homepage**

- `src/app/[locale]/page.tsx`: compact H2 for Why, Metrics, Clients and Certificates, and tighter header spacing.
- `src/components/ui/SectionHeader.tsx`: `size="compact"` option, and phrase-aware titles.
- Section components: `Hero.tsx`, `Intro.tsx`, `ServiceExplorer.tsx`, `MachineExplorer.tsx`, `WhyRawasy.tsx`, `Metrics.tsx` and `ProjectCTA.tsx`.

**Shell**

- `SiteHeader.tsx`: nav uses the display face.
- `LanguageSwitcher.tsx` and `WhatsAppButton.tsx`: display face.
- `SiteFooter.tsx`: phrase-aware statement.

**Other**

- `src/app/[locale]/services/page.tsx`: the placeholder list moves from semibold to medium, because Plex no longer ships 600. No design work.
- `scripts/generate-og.mjs` and `public/og/og-ar.png`: the Arabic share image headline is now in Kufi, on three lines.
- `README.md`: fonts and stage status.

## 3. Previous font configuration

| Role | Font | Loading |
| --- | --- | --- |
| English display and text | Archivo, variable width | `latin` subset, preloaded |
| Arabic display and text (everything) | IBM Plex Sans Arabic 400/500/600/700; headings used 700 | `preload: false` |
| Technical | Geist Mono | Preloaded |

Previous tokens:

```css
--ff-display: var(--font-archivo), var(--font-plex-arabic), …;
:root:lang(ar) { --ff-display: var(--font-plex-arabic), var(--font-archivo), …; }
```

## 4. New font configuration (all through `next/font`, self-hosted, no runtime Google requests)

| Role | Font | Weights | Loading |
| --- | --- | --- | --- |
| English display and text | Archivo | Variable | `latin`, preloaded, swap |
| Arabic display, headings, nav, buttons | **Noto Kufi Arabic** | Hero/statement 700, H1–H4 600, buttons 600, nav 500 | `arabic`, variable, preloaded, swap |
| Arabic body, leads, labels | IBM Plex Sans Arabic | 400 body and lead, 500 labels. No 600/700 is loaded or used | `arabic`, preloaded, swap |
| Technical labels and figures | Geist Mono | 400/500 | `latin`, preloaded |

The tokens follow the brief's pattern:

```css
--ff-display-en: var(--font-archivo);            --ff-body-en: var(--font-archivo);
--ff-display-ar: var(--font-noto-kufi-arabic);   --ff-body-ar: var(--font-plex-arabic);
:root, [lang|="en"]      { --ff-display: var(--ff-display-en), …; --ff-body: var(--ff-body-en), …; }
:root:lang(ar), [lang|="ar"] { --ff-display: var(--ff-display-ar), …; --ff-body: var(--ff-body-ar), …; }
[lang] { font-family: var(--ff-body); }   /* inline text in the other language re-resolves */
```

- Components pick a role (`t-*` classes, or `font-display` for UI), never a font.
- The stacks never mix scripts. next/font's metric-matched fallback (local Arial) would otherwise draw Arabic in Arial.
- Arabic sets `font-synthesis-weight: none`, so a stray bold can never fake-bold Plex.
- Arabic line-heights:
  - Body and lead: 1.85.
  - Tailwind small sizes: 1.7–1.8.
  - Headings: 1.36–1.6.

## 5. Typography scale, previous → new (px at 1440 / 390)

| Style | English | Arabic |
| --- | --- | --- |
| Hero display | 93 / 37 → **80 / 38** | 92 / 40 Plex 700 → **66 / 40** Kufi 700 |
| H1 (inner pages, 404) | 84 / 40 → **70 / 38** | 84 / 40 Plex 700 → **64 / 38** Kufi 600 |
| H2 (primary sections, CTA) | 59 / 32 (CTA 84 / 40) → **50 / 32** | 54 / 30 (CTA 84 / 40) → **48 / 31** |
| H2 compact (Why, Metrics, Clients, Certificates) | 59 / 32 → **44 / 29** | 54 / 30 → **42 / 28** |
| Intro statement | 59 / 34 → **46 / 30** | 59 / 34 Plex 700 → **42 / 29** |
| Precision statement (only expressive section) | 76 / 35 → **78 / 36** | 75 / 35 Plex 700 → **62 / 34** Kufi 700 |
| Machine name (new title size) | 59 / 32 → **34 / 26** | 54 / 30 → **32 / 24** |
| Machine power figure (outline) | 133 / 64 → **96 / 52** | same |
| Service names (H3) | 32 / 21 → **28 / 22** | 32 / 21 → **26 / 22** |
| H3 (process verbs, industries, menu) | 28 / 21 → **28 / 22** | 28 / 21 → **26 / 22** |
| H4 (project, certificate, pillar titles) | 18 (pillars 28) → **21 / 18** | same, Kufi 600 |
| Metric figures | 69 / 46 → **60 / 40** | same, Kufi 600 |
| Footer statement | 55 / 32 → **44 / 30** | 55 / 32 → **40 / 28** |
| Lead | 20.8 / 17.1 → **19 / 16.5** | same, line-height 1.9 → 1.85 |
| Body | 16–17 (unchanged) | 16–17, line-height 1.85 |
| Labels | 11.5 mono (unchanged) | 13.1 → **12.8** Plex 500 |
| Nav / buttons | 13.4 / 14.4 (unchanged) | 13.4 Kufi 500 / 14.4 Kufi 600 |

**At 1280:**

| | English | Arabic |
| --- | --- | --- |
| Display | 74 | 62 |
| H2 | 47 | 45 |

**At 834:**

| | English | Arabic |
| --- | --- | --- |
| Display | 56 | 51 |
| H2 | 40 | 38 |

**At 360:**

| | English | Arabic |
| --- | --- | --- |
| Display | 37 | 39 |
| H2 | 32 | 31 |

**Page height at 1440:**

| | English | Arabic |
| --- | --- | --- |
| Before | 15,250 | 15,268 |
| After | 14,598 | 14,791 |

**Section changes:**

- **Hero:** the headline sits beside an equal plate with no overlap at any width. There is more space before the lead and the actions.
  - The Arabic headline is on three lines: نُشكّل المعدن / بدقّة هندسية / ونصنع الممكن.
  - The actions are visible in the first screen at every width. For example, the bottom of the Arabic CTA sits at 721 of 900 px at 1440, and at 625 of 844 px at 390.
- **Headings wrap at phrase boundaries:**
  - Sentences and Arabic "…" pauses stay whole.
  - "a/an/the" and "في، من، إلى، على، عن، مع، حتى، أو" stay with the next word.
  - Examples: من لوح الصاج… / إلى الهيكل المكتمل.
  - شريك سعودي في المعادن، / من أول قصّة ليزر / حتى الهيكل المكتمل.
  - Six service lines. / One accountable partner.

## 6. Screenshots (sent in the session; not committed to the repo)

- **First screen, after the laser-cut sequence:** `first-screen-{1440,390}-{ar,en}-{light,dark}.png`.
  - 1440 × 900 at 1×.
  - 390 × 844 at 2×.
- **Full page:** `full-page-{1440,390}-{ar,en}-{light,dark}.jpg`.
- **Before and after hero:** `before-after-{1440,390}-{ar,en}-light.png`.

**Also reviewed during QA (not attached):**

- First screen and full page at 1280 × 800, 834 × 1112 and 360 × 780, in EN/AR × light/dark.
- Every section at 1440 and 390.
- 3× zoom crops of the Arabic hero and statement, including the state before the reveal.
- The mobile menu, the `/about` placeholder and the 404 in both languages.

## 7. Lint

`npm run lint`: **passed**, with 0 errors and 0 warnings.

## 8. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): **passed**.

## 9. Build

`npm run build`: **passed**. It compiled cleanly and generated 109 static pages.

## 10. Automated browser tests (Playwright, Chromium, production build)

**Existing suite: 31/31 passed.** It covers:

- The loader.
- Themes: following the OS, persisting the choice, and no flash on load.
- Language switching: lands on the equivalent page, `dir`/`lang`, and the cookie.
- The mobile menu: focus trap, Escape and scroll lock.
- The service explorer, machine tabs (keyboard) and certificate dialog.
- Page transitions, reduced motion, and no-JS content.
- 46 internal links.
- No console errors.

**Typography probe** (5 widths × EN/AR):

- Every size, weight, font and line count listed above.
- No horizontal overflow on any of the 20 full-page renders (5 widths × EN/AR × light/dark).
- No console errors or warnings.

**Font audit** (DevTools protocol, fonts actually rendered):

| Page | Fonts rendered |
| --- | --- |
| Arabic | Kufi 700/600/500, Plex 400/500 and Geist Mono only |
| English | Archivo and Geist Mono, plus Kufi 500 for the "عربي" link and the Arabic nameplate |

- 0 elements drawn in a system or fallback font.
- 0 Plex text at weight 600 or above.

**Loading:**

- 0 requests leave the site. Fonts are self-hosted.
- Unthrottled: the preloaded fonts are ready within 62 ms and all fonts by 272 ms. The first paint is at 352 ms, so CLS is 0.
- Throttled to Slow-4G, cold cache:

| | Arabic | English |
| --- | --- | --- |
| CLS | 0.005 | 0.003 |

- In the throttled Arabic load, the hero text is revealed at 3.75 s, after Kufi was ready at 2.75 s. No fallback font was visible.

**Arabic clipping:** in the zoomed crops of the hero (1440/390/360) and the statement, the marks (ُ ّ) and descenders are intact. Nothing shows below the masks before the reveal.

## 11. Regressions found and fixed during this pass

1. **Faux bold.** Plex no longer ships 600/700, so semibold Arabic UI would have been faked in bold. Affected:
   - WhatsApp label
   - skip link
   - machine tabs
   - metric titles
   - language link
   - services placeholder list

   These now use Kufi or 500. A synthesis guard was added.
2. **Arabic headings ended lines on prepositions** at the new sizes ("…من / أول", "…إلى / الهيكل"). Fixed with phrase-aware wrapping.
3. **English headings broke mid-sentence** ("Six service lines. One / accountable…", "Have a drawing, a / concept…"). Sentences are now kept whole.
4. **Latin line-heights on Arabic text.** Arabic `text-sm/xs/lg` and "relaxed" text inherited Latin line-heights (1.33–1.63). Now 1.7–1.85.
5. **Hero reveal.** The taller Kufi lines would have let hidden lines peek below the mask. The hidden offset is now 105% + 0.3em, with extra room above for marks.
6. **Statement halves clipped Kufi marks and descenders.** Padding was added. English mobile now wraps as "Precision in / every cut.".
7. **Heading measures shifted as fonts loaded.** They used `ch`, which depends on which font's "0" has loaded. They now use `em`.
8. **Nameplate orphan.** "…CO. / LTD." now reads "RAWASY UNITED INTERNATIONAL / CO. LTD." because labels use `text-wrap: pretty`.

## 12. Stage 1C

**Not started.** No inner-page design work was done. The only inner-page edit is the weight fix in item 11.1. That fix was needed because a font weight was removed.

## Notes for your review

- **Preloads are shared by both languages.** Both languages share one root layout, so every page preloads every page's fonts:
  - English pages preload Plex Arabic (≈69 KB), which they don't use.
  - English pages preload Kufi (124 KB), used only by the "عربي" link and the nameplate.
  - Arabic pages preload Archivo (90 KB), which they don't use.

  Recommended for 1J: a root layout per language, so each language preloads only its own fonts.
- **Arabic line-height.** 1.75–1.95 is applied to paragraphs and leads (1.85). Headings use 1.36–1.6, because 1.75 or more on 40–66 px Kufi breaks the headline into separate floating lines. Please confirm.
- **English display on phones.** On phones the English display is 37–38 px rather than the 48 px minimum in the brief's example clamp. At 48 px, "POSSIBILITY." does not fit on 360–390 px screens.
- **Single-word last lines remain only at sentence boundaries:**
  - "One accountable / partner." (EN, 390/360)
  - "Registered. Licensed. / Accountable." (EN, 1280 and phones)
  - "مسجّلون ومرخّصون… / وملتزمون." (AR, phones)
- **Unchanged and unrelated:** `/favicon.ico` serves Next's default 404. The same happens on `dd35d86`.
