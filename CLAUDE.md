@AGENTS.md

# RAWASY Metal Website — project memory

## How the user wants reports

- When a task or stage is finished, send a **complete report inside one copyable code block**. Use a
  four-backtick markdown fence (````markdown) so it copies cleanly in one go.
- Cover: summary and status, what was delivered, QA actually run and its results (say plainly if
  something failed or was skipped), items needing RAWASY's confirmation, known limitations, how to
  run, and next steps.
- Also save the report as `docs/reports/YYYY-MM-DD-<topic>.md`, then commit and push it with the work.
- Latest report: `docs/reports/2026-09-24-stage-1C-core-inner-pages.md` (earlier:
  `2026-09-24-stage-1B-typography-correction.md`, `2026-09-24-phase-1-stages-1A-1B.md`).
- The user's stage briefs list numbered report items; answer every one of them, in order.

## Where the project stands

- Phase 1 is the public website only. Work is pushed on `claude/new-session-5eijs6`.
- **Stages 1A (foundation) and 1B (homepage) are approved.** Stage 1C (core inner pages: about,
  services overview, industries, clients, certificates, contact / quote, privacy, terms) is built
  (commit `74bf5c3`) and **awaiting the user's approval**. Never self-approve a stage.
- Do not start stage 1D (or later stages) until the user approves 1C. Do not start Phase 2 (admin
  panel) during Phase 1.
- When a stage is approved, set its routes to `published` in `src/lib/page-meta.ts` (they are
  `review` until then: noindex and left out of the sitemap).
- The approved homepage must not change unless a genuine shared-component bug requires it. After
  shared changes, compare it with the approved build: server HTML (normalise `/_next/static` paths)
  and full-page screenshots at the five widths, EN/AR, light/dark.
- Open questions for RAWASY (photos, image rights, AI-watermarked images, licence renewal, registration
  numbers and so on) are listed in `docs/ASSET_INVENTORY.md`.

## Rules from the brief

- Never invent facts: years, staff, project counts, capacities, tolerances, machine brands or specs,
  clients, locations, certificates, awards, testimonials or statistics. Unknown content fields stay empty.
- Arabic copy is professional Saudi business Arabic, written on its own terms rather than translated
  literally. Never letter-space Arabic text.
- Every change must work in EN (LTR) and AR (RTL), light and dark, desktop, tablet and mobile, with
  reduced motion and without JavaScript.
- Certificate numbers, QR codes and personal names stay redacted unless RAWASY approves showing them.
  Images flagged in the asset inventory (AI watermark, authorship, renders) stay off featured spots.
- Orange is an accent (roughly 10%). Keep the design free of clutter.

## Typography rules (set by the user in the 1B correction)

- English: Archivo. Arabic display, headings, navigation and buttons: **Noto Kufi Arabic** (hero and
  statement 700, headings 600, buttons 600, nav 500). Arabic body, leads and labels: **IBM Plex Sans
  Arabic 400/500 only**. Never use Plex for headings or at 600/700. Technical labels: Geist Mono.
  Fonts come only from `next/font` (`src/app/fonts.ts`) and are never requested from Google at runtime.
- Fonts are tokens, not per-component overrides: `--ff-display-en/-ar` and `--ff-body-en/-ar` resolve
  through `:root:lang(ar)` and `[lang]`. Components pick a role (`t-*` classes, or `font-display` for UI
  that should be Kufi in Arabic). Mark inline text in the other language with `lang` (and `dir`).
- Scale classes: `t-display` (hero), `t-h1`, `t-h2`, `t-h2-compact` (calmer supporting sections),
  `t-title`, `t-h3`, `t-h4`, `t-lead`, `t-body`, `t-label`. The precision statement is the only
  expressive size. Arabic paragraphs use line-height 1.85 and headings 1.36–1.6, with no letter-spacing.
- Heading text goes through `<Phrases>` (`src/components/ui/Phrases.tsx`) so lines break at phrase
  boundaries. Use `em`, not `ch`, for heading measures.

## Where things live

- Content (EN + AR): `src/content/*`, read through `src/content/repository.ts`. Phase 2 replaces the
  storage behind this layer.
- Media registry: `src/content/media.generated.ts`. It is generated, so never edit it by hand; run
  `npm run assets:extract -- <profile.pdf>`.
- Routes: `src/i18n/routes.ts`. Publishing, indexing and the sitemap: `src/lib/page-meta.ts`.
- Design tokens and motion CSS: `src/app/globals.css`. Homepage sections: `src/components/home/*`.
- Inner pages: shared system in `src/components/inner/*` and `src/lib/inner-page.ts` (metadata,
  breadcrumb trail, JSON-LD); page components in `src/components/{about,services,industries,clients,
  certificates,contact,legal}`; copy in `src/content/{about,pages,contact,legal}.ts`.
- Quote form: `src/components/contact/QuoteForm.tsx`. No backend: it prepares the request for the
  visitor to send by email or WhatsApp. Never make it claim a request was sent.
- Browser tests: `e2e/*.spec.ts` with `playwright.config.ts`; run `npm run test:e2e` after a build.

## Before pushing

- Run `npm run lint`, `npm run typecheck`, `npm run build` and then `npm run test:e2e`.
- Check pages in a browser with Playwright: EN/AR × light/dark × desktop/mobile, console errors, and
  sideways overflow. In cloud sessions Chromium is at `/opt/pw-browsers`. An axe-core audit (installed
  in the scratchpad, not the project) is a cheap extra check.

## Gotchas learned

- Do not add `dynamicParams = false` to `app/[locale]/layout.tsx`. It turns fallbacks off for the whole
  route tree, which causes `NoFallbackError`s and redirect loops on prefetches of 404 pages. `proxy.ts`
  already sends every non-locale URL to `/{locale}/…`, where the catch-all renders the localized 404.
- A `notFound()` hit during a dynamic render is built in the browser by Next.js 16 (real 404 status).
  `BootFallback` then reapplies the theme and motion settings.
- To stop a server in a cloud session, run `pkill -f "[n]ext-server"` as its own command. Never use a
  `pkill -f`/`pgrep -f` pattern that appears literally in the same command (for example
  `"next start -p 3400"`): it matches your own shell and kills it (exit 144). Bracket one letter.
- After a rebuild, stop any `next start` left running from before (check `pgrep -fa "[n]ext-server"`
  and `/proc/<pid>/cwd`). Otherwise the tests reuse the stale server and assets fail with 500s.
- Styles inside `@layer components` lose to Tailwind utilities (`.grid`, `.flex`) whatever their
  specificity. Rules that must win, like `html:not(.js) .js-only`, go outside the layers.
- Playwright's `javaScriptEnabled: false` still parses `<noscript>` as text. Check noscript content in
  the server HTML instead.
- Reveal fades also run with reduced motion (opacity only), so content in the bottom band of the
  viewport stays hidden until scrolled into view. Visibility checks must leave that band out.
- In dark mode `--text-tertiary` on `--surface-elevated` is 4.35:1, which fails AA for small text. Use
  `text-ink-2` on raised panels. The approved homepage's certificate cards still have this; the token
  fix waits for the user's approval.
- Decorative outlined numerals use `.outline-num` with `data-n` (drawn by `::before`), so they stay out
  of the text and accessibility trees.
- Both locales share one root layout, so every preloaded font is preloaded on every page (EN pages load
  the Arabic fonts and vice versa). Splitting preloads per language needs a root layout per language (1J).
- For a side-by-side build of an older commit, use a `git worktree` with `cp -al node_modules`.
  Turbopack rejects a symlinked `node_modules` that points outside the project.
