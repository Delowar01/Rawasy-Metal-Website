# RAWASY Metal Website — TM-2.1 correction 1: the 404's phone-menu language switch and the report's status matrix

**Date:** 2026-10-01 · **Branch:** `claude/new-session-5eijs6` · **Correction commit:** `751460b` (this report is in the following commit)

**Status: both corrections are applied. TM-2.1 is returned for your approval. I have not approved it.**

- **The 404's phone menu now shows EN and عربي**, like every other page. Choosing a language keeps the whole unknown
  address (`/en/foo/bar` ↔ `/ar/foo/bar`).
  - Below 400 px the compact header language control is hidden, so the menu is a phone's only language switch.
  - On the 404 that menu group was empty before, so a visitor on such a phone could not change language.
- **Item 11 of the TM-2.1 report now separates two things:**
  - what stayed the same: status codes, redirects, titles and `noindex`;
  - what TM-2.1 changed: generic unknown addresses show the Modern Commerce 404, where 5cfeaed showed the previous
    design's.
- **Nothing else changed:** no redesign, no change to the documented limitations, no TM-2.2 and no deployment.

---

### 1. Correction commit SHA

- **`751460b2fa9ab79879742d4488eac7153cfe0a51`**: "Fix the 404's phone-menu language switch and correct the TM-2.1 status matrix".
- It holds the fix, the two new tests and the corrected TM-2.1 report.

### 2. Branch HEAD

- The commit that adds this report and the `CLAUDE.md` update, directly on top of `751460b`. It is pushed to
  `origin/claude/new-session-5eijs6` (normal push, no force). Its SHA is in the chat summary.

### 3. Exact source change

One element in one file, `src/components/commerce/shell/Header.tsx`. No other source file changed.

```diff
                   <div>
                     <p className="text-[0.8rem] font-semibold text-ink-2">{ui.language}</p>
-                    <LanguageSwitch shell={shell} className="mt-2 w-full [&>a]:h-11 [&>a]:flex-1 [&>a]:text-[0.95rem]" />
+                    <LanguageSwitch
+                      shell={shell}
+                      sameAddressLink={SameAddress}
+                      className="mt-2 w-full [&>a]:h-11 [&>a]:flex-1 [&>a]:text-[0.95rem]"
+                    />
                   </div>
```

- **Why it broke.** The header renders the language switch in three places: the desktop bar, the compact phone
  control, and the menu sheet.
  - The 404 has no address of its own on the server. It passes `SamePageLink` into the header, which follows the
    address being viewed.
  - In TM-2.1 that link reached the desktop bar and the compact control, but not the menu sheet. On the 404 the sheet's
    switch therefore rendered two empty entries.
- **Normal pages.** `SameAddress` is not set there, and their shell carries real addresses. The switch takes exactly
  the same `LocaleLink` path as before, and the built pages are identical (item 10).
- **No new code ships.** There is no new import and no new client component. `SamePageLink` is still loaded only by
  the 404, and the classes are unchanged.

### 4. Test added

Two tests in `e2e/commerce-inner.spec.ts`, under `localized 404 › phone menu`, at 390 × 844 on a touch phone.

**1. "the menu sheet's language switch on the 404 shows both languages and keeps the unknown address, in each
language"**, run for `/en/foo/bar` and `/ar/foo/bar`:
- the response is a real 404, in the Modern Commerce design;
- the menu button carries its label, and opening it shows the labelled site menu;
- the sheet's language group (found by its label, "Language" / "اللغة") lists EN and عربي, and both are visible;
- the current language is marked (`aria-current="true"`) and points to the same address;
- the other language points to the same unknown path in that language, and is not marked;
- Escape closes the sheet and returns focus to its button;
- choosing the other language opens `/ar/foo/bar` (or `/en/foo/bar`). From English the test taps; from Arabic it uses
  the keyboard (focus, then Enter). After the switch:
  - the status is still a real 404;
  - `lang` and `dir` change;
  - the localized `h1` shows;
  - `NEXT_LOCALE` is set to the new language;
  - there are no console errors.

**2. "on a page with an address of its own the menu's language switch is unchanged, and the 404's is built the same
way":**
- on `/en/privacy` the sheet lists EN (current, `/en/privacy`) and عربي (`/ar/privacy`);
- the 404's sheet group is compared with Privacy's: the same elements, classes, labels, current mark and text, with
  only the addresses differing;
- on Privacy, switching opens `/ar/privacy` right to left and sets `NEXT_LOCALE=ar`, as before.

**Proof that the tests catch the bug.** I ran both tests against the unfixed build first, and both failed: the 404's
group showed `[]` where `EN, عربي` was expected. Both pass on the fixed build. The homepage's existing phone-menu test
still checks its own sheet link (`/ar` → `/en`).

**Before and after.** Contact sheet `c1-mobile-menu-before-after.png` (sent in the chat). It shows the open menu on
`/en/foo/bar` and `/ar/foo/bar`, before and after the fix, with Privacy for reference.
- Before: the group was empty, 8 px tall.
- After: both languages, 52 px tall, exactly as on Privacy.

### 5. Corrected report wording

`docs/reports/2026-10-01-tm2-1-inner-kit-legal-404.md`, item 11, now reads:

> Measured with curl on the approved build (5cfeaed) and on TM-2.1, side by side. The "page that answers" columns
> and the page-data chains were checked again in a browser, on both builds, in correction 1.
>
> *Corrected after review (TM-2.1 correction 1).* The first version of this item said "every row is identical on
> both". That was true of the status codes and redirects only, not of the page that answers.
>
> - **Unchanged on every row:**
>   - the status codes;
>   - the redirects, including the one page-data redirect;
>   - the 404 titles and `noindex`, because both designs' 404s use the same dictionary title and robots rule;
>   - the sitemap and robots bodies.
> - **Changed by TM-2.1: the page that answers a generic unknown address under a language.**
>   - At 5cfeaed the catch-all `src/app/[locale]/[...rest]/page.tsx` called `notFound()`. That rendered the previous
>     design's localized 404: `src/app/[locale]/not-found.tsx`, with `NotFoundView` from `src/components/layout/`.
>   - TM-2.1 moved the catch-all into Modern Commerce (item 10), so these addresses now get the Modern Commerce 404.
>   - Unknown service and project slugs get the previous design's 404 on both builds.
>   - 5cfeaed never showed the Modern Commerce 404.

The table now has separate columns. Its rows are as before:

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

**How the columns were checked.** I loaded every address in a browser on both builds, side by side:
the approved build (5cfeaed, on port 3401) and this correction (port 3400).
- For each one I recorded:
  - the status;
  - the design of the page that loads (Modern Commerce pages carry `body.mc`);
  - its `h1`;
  - the page-data chain.
- Every row matches the table.
- At 5cfeaed every 404 row loads the previous design's page.
- Now:
  - `/en|ar/no-such-page`, `/en|ar/foo/bar`, `/en/services/laser-cutting/extra` and `/en/privacy/extra` load the
    Modern Commerce page;
  - the four unknown slugs still load the previous design's page.
- On both builds:
  - the generic addresses' page data answers 307 → 200;
  - the unknown slugs' page data answers 307 → 404.

No measured value changed: every status, redirect, title and `noindex` result is as reported before.

### 6. lint

`npm run lint` (eslint): **passed**, exit 0, no warnings.

### 7. typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): **passed**, exit 0.

### 8. build

`npm run build`: **passed**, and all 125 static pages were generated.

### 9. e2e results

`npm run test:e2e` (Chromium, against the production build): **242 passed, 0 failed, 0 skipped, 0 flaky** (6.7 min). That is the 240 earlier tests plus the 2 new
ones.

### 10. Confirmation that no other visual or functional behaviour changed

**Built output compared with the reviewed TM-2.1 build (`c4b6d85`), side by side:**
- **Built files.** Most are identical once build ids and hashed file names are normalised:
  - homepage 12/12, Privacy and Terms 24/24, theme lab 96/96;
  - the global fallback and metadata files 17/17;
  - the previous design's pages: 671 identical.
- **Two exceptions, neither a change:**
  - In `en/projects.html` the only difference is where Next.js places its `next-size-adjust` meta tag in `<head>`. The
    file length is the same; `CLAUDE.md` records this as known build noise.
  - The 28 files missing from the new build are cache files the old server wrote while answering unknown slugs in
    earlier tests. They are not build output.
- **CSS.** All three stylesheets are byte-identical: Modern Commerce (95,201 bytes), the previous design (152,191) and
  the theme lab (54,497).
- **JavaScript.** All 39 chunk files are identical in name and bytes, so no page gained or lost any code. Normal pages
  load no new JavaScript.
- **The 404** is rendered on each request, so I compared its live page data before and after the fix, for
  `/en/foo/bar`, `/ar/foo/bar` and `/en/no-such-page`.
  - It differs in one place only: the menu sheet's language group had two empty entries and now has the two
    `SamePageLink` links.
  - The links carry the same labels, `lang`, `hreflang` and current mark as the desktop switch.
  - The only other difference is two per-request React keys, which change on every request anyway.

**Verification asked for in the brief (§5):**

| # | Check | Result |
| --- | --- | --- |
| 1 | `/en/foo/bar` phone menu contains EN and عربي | Yes (new test 1; screenshots) |
| 2 | `/ar/foo/bar` phone menu contains EN and عربي | Yes (new test 1; screenshots) |
| 3 | Changing language keeps `/foo/bar` | Yes, both directions, by touch and by keyboard (new test 1) |
| 4 | `NEXT_LOCALE` is updated | Yes: `ar`, then `en` (new test 1) |
| 5 | Normal-page language switching is unchanged | Yes (new test 2; the homepage's phone-menu test; the existing desktop switch tests); built pages identical |
| 6 | The homepage regression tests still pass | Yes: `commerce-home.spec.ts` in full (the hero loop, signatures, pointer, header, footer, project cards, "Start a Project") |
| 7 | Privacy and Terms are unchanged | Yes: built files 24/24 identical; their tests pass |
| 8 | The real 404 HTTP status is still 404 | Yes (item 5's table; new test 1; "real HTTP status codes") |

**Untouched:**
- legal content, metadata, publication statuses, the sitemap and robots;
- the hero loop, signatures, background and pointer;
- project links, the Contact page and the theme lab.

Nothing was deployed.

### Known limitations: unchanged, as instructed

These stay documented in the TM-2.1 report (item 29), and I did not attempt them:
- the 404 body without JavaScript;
- the header blur in Chromium;
- the 44 rem English legal-text column;
- the 404 label wrapping at 320 px;
- the A V2 chunk count.

### Outstanding RAWASY confirmations

Unchanged: see the TM-2.1 report, item 30.

### How to run

```bash
npm run build && npm run start      # then open http://localhost:3000/en/foo/bar at a phone width and open the menu
npx playwright test e2e/commerce-inner.spec.ts -g "phone menu"   # the two new tests (server on port 3400)
npm run test:e2e                    # the full suite
```

### Next steps

- **Your approval of TM-2.1**, with this correction. TM-2.2 (Contact) waits for it; I have not started it.
