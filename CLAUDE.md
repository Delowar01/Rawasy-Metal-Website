@AGENTS.md

# RAWASY Metal Website — project memory

## How the user wants reports

- When a task or stage is finished, send a **complete report inside one copyable code block**. Use a
  four-backtick markdown fence (````markdown) so it copies cleanly in one go.
- Cover: summary and status, what was delivered, QA actually run and its results (say plainly if
  something failed or was skipped), items needing RAWASY's confirmation, known limitations, how to
  run, and next steps.
- Also save the report as `docs/reports/YYYY-MM-DD-<topic>.md`, then commit and push it with the work.
- Latest report: `docs/reports/2026-09-24-phase-1-stages-1A-1B.md`.

## Where the project stands

- Phase 1 is the public website only. Stages 1A (foundation) and 1B (homepage) are done and pushed on
  `claude/new-session-5eijs6`.
- The homepage is at the **approval gate**. Do not design the inner pages (stages 1C–1J) until the user
  approves the homepage direction. Do not start Phase 2 (admin panel) during Phase 1.
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

## Where things live

- Content (EN + AR): `src/content/*`, read through `src/content/repository.ts`. Phase 2 replaces the
  storage behind this layer.
- Media registry: `src/content/media.generated.ts`. It is generated, so never edit it by hand; run
  `npm run assets:extract -- <profile.pdf>`.
- Routes: `src/i18n/routes.ts`. Publishing, indexing and the sitemap: `src/lib/page-meta.ts`.
- Design tokens and motion CSS: `src/app/globals.css`. Homepage sections: `src/components/home/*`.

## Before pushing

- Run `npm run lint`, `npm run typecheck` and `npm run build`.
- Check pages in a browser with Playwright: EN/AR × light/dark × desktop/mobile, console errors, and
  sideways overflow. In cloud sessions Chromium is at `/opt/pw-browsers`.

## Gotchas learned

- Do not add `dynamicParams = false` to `app/[locale]/layout.tsx`. It turns fallbacks off for the whole
  route tree, which causes `NoFallbackError`s and redirect loops on prefetches of 404 pages. `proxy.ts`
  already sends every non-locale URL to `/{locale}/…`, where the catch-all renders the localized 404.
- A `notFound()` hit during a dynamic render is built in the browser by Next.js 16 (real 404 status).
  `BootFallback` then reapplies the theme and motion settings.
- To stop a server in a cloud session, run `pkill -f "[n]ext-server"` as its own command. If the pattern
  also appears in the current command line, it kills your own shell.
