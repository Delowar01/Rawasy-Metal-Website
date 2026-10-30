# Admin / CMS program — Phase A5: acceptance review, readiness and A6 preparation

Date: 2026-10-30 · Branch: `claude/new-session-5eijs6` · Brief: "RAWASY METAL WEBSITE — A5 FINAL REVIEW, ACCEPTANCE
READINESS & A6 PREPARATION" · Baseline: `preserve/pre-admin-a5` (`cc0cae2`) · Reported A5 code commit: `f2b73c9`.

## Summary and status

An independent acceptance review of Phase A5 (Page builder / visual editor), run in a fresh, isolated environment
(Node 22.22.2, a disposable local MariaDB 11.4, throwaway databases and data folders, fresh clones of the branch). It
covered the 14 scope points of the brief, the security findings and low-risk items A5 left, the preview's saved-content
limitation, every test suite against the A5 baselines, the public website's preservation against `preserve/pre-admin-a5`,
the Owner decisions, and an A6 plan. Two independent read-only code reviews (server side; client and rendering side)
ran alongside my own checks; every finding was verified against the code before anything was changed.

- **Four genuine A5 defects found and corrected**, each in its own commit with a regression test that fails on the code
  before (`959d399`) — one Low security gap in the certificate digit guard (`6ce90ed`) and three Medium builder defects:
  a duplicate stored old texts (`a215f74`), edits made during a save were silently dropped (`f8a439e`), and a generic
  block's photo was drawn wider than its file (`9296266`). None touches the public website.
- **One Medium finding left for the Owner** (it follows A2's accepted session rule): unsaved builder edits are lost when
  the session ends before they are saved. Options and a recommendation in items 2.2 and 6.
- **One project-wide gate now fails, not caused by A5's code:** `npm audit --omit=dev` reports 2 production advisories
  (next 16.3.8, zod 4.6.5) published after A5's QA. The fix is a version change that needs the Owner's authorization
  ("no Next.js upgrade" is a locked decision); nothing was upgraded. Exposure and the measured patch in item 6.
- **Tests:** unit 295 / 295, integration 425 / 425, admin 115 / 115, public 612 / 612 on a fresh clone of the final commit
  (baselines 294 / 425 / 112 / 612; the additions are this review's four regression tests).
- **Public website:** unchanged. The corrected build's public output is identical to `959d399`'s, and against
  `preserve/pre-admin-a5` it shows exactly the differences the A5 report documented (files and resolved payloads, CSS on
  104 / 104 pages, JS on 94 / 104, 229 HTTP answers, 398 resting-pixel captures).
- **Recommendation: READY**, on one condition outside A5's code — the Owner-authorized dependency patch (item 7). This
  is a technical recommendation: **A5 is not Owner-approved** until the Owner says so.
- **A6 is not started.** Its plan is item 8. Nothing was deployed or merged; `main`, hosting, DNS, SSL and cPanel were
  not touched; no production credential was used.

## 1. Starting branch and HEAD (verified, not assumed)

- Local and remote `claude/new-session-5eijs6` were at **`959d399`** ("Admin A5: report, project memory and README"), a
  documentation-only commit (`CLAUDE.md`, `README.md`, the A5 report) on top of **`f2b73c9`**, which is exactly the
  reported final A5 code commit `f2b73c9f451e20c2577a6db0b8f9fb14388bdd04`. Working tree clean; 37 commits since
  `preserve/pre-admin-a5`.
- Remote: `main` at `474f61f` (untouched), `preserve/pre-admin-a5` at `cc0cae2` (the A5 rollback checkpoint), 21
  `preserve/*` branches in all, unchanged.
- The full A5 brief's text was not available in this session (only the A5 report and the project memory); the review
  relies on the A5 report, A1's specifications and the code.

## 2. A5 findings and corrections

Sources: my own checks (the scope points in 2.0, the suites in item 3, the public proofs in item 5, a browser
walkthrough of the builder) and two
independent read-only reviews run in parallel, one of the server side (services, permissions, validation, concurrency,
audit, migration, the preview's access) and one of the client and rendering side (the builder, the inspector, the
preview's renderers). Every finding below was checked against the code before anything was changed; the four
corrections were each reproduced first, by a test that fails on `959d399`.

### 2.0 The scope, point by point (brief §3)

Each point was checked three ways where it applies: the tests that cover it (all run in this review, item 3), the code
(read by me and by the two independent reviews), and the browser: my own walkthrough on a throwaway database and data
folder (an Owner and an Editor; the homepage builder set up from its template at 1280 / 768 / 390 / 320 px, light and
dark, every tab; the preview switched to Arabic, dark and phone; the preview page's own tab in four language, theme and
width settings; anonymous access; About's and a Contact details block's inspectors at five widths).

| # | Scope point | Evidence | Result |
|---|---|---|---|
| 1 | All 87 block types | The registry, loaded from the clone: 87 keys, all unique, 59 bespoke + 28 generic, `generic.reusable` the only one not storable; `builder-renderers.test.ts`: the 86 storable blocks are exactly the renderer map's (a missing renderer fails the typecheck); `builder-registry.test.ts` (40 tests: strict schemas, upcasting, future versions, limits); preview parity: 30 of the 59 bespoke blocks equal the public page's DOM, text, media and pixels (15 tests) | ✓ (29 bespoke blocks not compared pixel by pixel: an Owner decision since A5, item 6) |
| 2 | Page and service builders | `page-builder.spec.ts` (18 with this review's 3): generic page set-up, the site's own pages (About, homepage in my walkthrough), a service from its template; integration `builder-sections.test.ts` (28) | ✓ |
| 3 | Desktop, tablet, mobile | Walkthrough of the homepage builder at 1280 (three panels), 768, 390, 320 (tabs Outline / Preview / Edit), light and dark: page overflow 0 and no element past the screen in all 20 views; long-option inspectors at 1280 / 1024 / 768 / 390 / 320: 0; the spec's 390 / 320 test | ✓ |
| 4 | English LTR and Arabic RTL | Arabic inputs `dir="rtl" lang="ar"` (spec); the preview switched to Arabic: `lang="ar-SA"`, `dir="rtl"` in the frame and on its own tab; parity in Arabic (EN/AR × light/dark) | ✓ |
| 5 | Light and dark | The admin in both schemes (walkthrough, spec); the preview's theme control: `data-theme="dark"` in the frame and on its own tab; design tokens ≥ 4.5:1 on every surface in both themes (`builder-tokens.test.ts`) | ✓ |
| 6 | Inspector controls | Settings, texts in both languages, rich text, links, media, selections, screens, anchors, design tokens: `builder-content` (21), `builder-editing` (9) unit tests, the spec | ✓ |
| 7 | Visibility, ordering, duplication, deletion | Integration: devices kept on, locked parts, duplicate ids, removal positions; spec: hide, phone-only, reorder, remove dialog. **C2 corrected** (a duplicate with unsaved edits stored old texts) | ✓ after `a215f74` |
| 8 | Reusable sections, link, detach | `builder-reusable.test.ts` (11), F2 review tests (latest committed state), the spec's reusable test | ✓ |
| 9 | Undo / redo, unsaved-change warning | The spec's undo / redo / leave-warning / Ctrl+Z test. **C3 corrected** (edits during a save were dropped). Not corrected, Owner decision: a session that ends with unsaved edits (item 2.2); documented: the "dirty" state a no-change save cannot clear (2.4 #3) | ✓ after `f8a439e`, with 2.2 open |
| 10 | Authenticated preview and its restrictions | Walkthrough: `no-store`, `X-Frame-Options: SAMEORIGIN`, `X-Robots-Tag: noindex, nofollow`, its own CSP (`frame-ancestors 'self'`, `style-src-attr 'unsafe-inline'`), anonymous → sign-in, no console error; canvas sandbox tested; the preview draws the saved working copy as specified (2.5) | ✓ |
| 11 | Media selection and restricted assets | Integration: private items refused like unknown ones, trashed / archived / unready not newly chosen, kinds checked; preview: images only from `public_media` (placeholders otherwise, "Not available" for private); the 13 held-back files stay out of the package (packaging check). **C4 corrected** (generic photos above their source size) | ✓ after `9296266` |
| 12 | RBAC (Owner, Admin, Editor, Reviewer) | Permission keys re-decided in each transaction (server review: no role names, no input authority); integration RBAC tests; spec: Editor texts only on About and a service, Reviewer read-only and a forged save refused; walkthrough: an Editor on the homepage gets no structure controls and no library | ✓ |
| 13 | Draft saving, optimistic concurrency, stale protection | Owner root `FOR UPDATE` + `lock_version` (server review); integration: two editors, eight reorders at once, the exact stale message; spec: "two people on one layout" | ✓ (C3 above) |
| 14 | Security, validation, audit, migration consistency | Server review (no Blocker / High / Medium); F1–F6 and final-pass tests; `0005` equals `schema-builder.ts`, only four tables added (migration A–G); audit by kind, never texts. **C1 corrected** (the certificate guard); Info items 2.4 #8–10 documented | ✓ after `6ce90ed` |

### 2.1 Corrected (four commits, each with its own regression test)

| # | Severity | Finding | Root cause | Correction | Test (fails on `959d399`) |
|---|---|---|---|---|---|
| C1 | Low (security) | The certificate digit guard missed numbers and expiry words split by invisible characters outside Unicode category Cf: the combining grapheme joiner U+034F, variation selectors (U+FE00–FE0F, U+E0100–E01EF), Mongolian variation selectors, U+17B4/17B5, the Hangul fillers U+115F, U+1160, U+3164, U+FFA0. "Registration 1010‹U+034F›123‹U+034F›456" passed on the Certificates page, the compliance and certificate blocks, and A3's certificate texts. | The A5 final pass's L2 fix removed `\p{Cf}` only; plain text accepts these characters. | `6ce90ed`: `guardText` and the expiry check remove `[\p{Cf}\p{Default_Ignorable_Code_Point}]` (the union: nothing read before is read differently), for the guard's reading only; stored text unchanged, Arabic joiners still plain text. | `builder-review.test.ts` "every other invisible character…" (9 characters × grouped, between every digit, expiry wording, "valid until", the builder's certificate check; controls) — failed `expected true, actual false`. |
| C2 | Medium | Duplicating a stored section that had unsaved edits stored the copy with the **old** texts, while the inspector showed the copy with the edits. | The copy was always sent without data (`dataChanged: false`), so the server cloned the stored section. | `a215f74`: the copy of a stored section with unsaved edits carries its data (the server already takes a duplicate's data); unchanged sections are still cloned by the server; a linked section's copy is still another link. | `page-builder.spec.ts` "a stored section duplicated with unsaved edits…" — failed: stored `["Test edited title", "Test stored title"]`. |
| C3 | Medium | While "Saving…" showed, the outline (move, duplicate, hide, remove), the library, a section's screens / visibility / anchor and Undo / Redo still changed the working copy; the save's reload then dropped that change while the screen said "Layout saved." The immediate actions (set up, detach, make reusable, link) had no such lock at all. | The grid became `inert` only after the save answered (`reloading`); `saving` and `busy` disabled the inspector's fields only. | `f8a439e`: the grid is inert and Undo / Redo (buttons and Ctrl+Z) wait while a save or an immediate action is under way, as they already did while the stored layout loads. | "while a save is on its way…" (the Server Action held with `page.route`) — failed: the grid's `inert` attribute was `null` while saving. |
| C4 | Medium | A photo in a generic Image or Gallery block was drawn wider than its file whenever an entrance was set — their default. A 322 px release photo was drawn 1,177.6 px wide (3.66×) in the desktop preview. | `BlockImage` spread the reveal's props after its `style`; the reveal carries a `style` of its own (its delay), which replaced the `max-width` cap. | `9296266`: the reveal's style joins the cap instead of replacing it (both photo branches). Nothing public changes: generic blocks are drawn only by the admin's preview. | "a photo in a generic Image block…" (own shape and 1:1) — failed: `max-width: none`, width 1,177.6 px. |

Re-run after the corrections (on the corrected build, before pushing): lint, typecheck, build (no warning), unit 295 /
295, integration 425 / 425, and the admin specs these touch — `cms.spec.ts`, `page-builder.spec.ts`,
`preview-parity.spec.ts`: 50 / 50. Public output of the corrected build: identical to `959d399`'s (item 5).

### 2.2 Not corrected: an Owner decision (Medium)

- **A session that ends while the builder holds unsaved edits loses them on the next server request.** Editing is
  client-side and the idle limit (2 h, A2's locked default) moves only with a server request; after it, or the 12 h
  absolute limit, or a sign-out elsewhere, "Save layout" (and any other Server Action: a media search, a link) is
  redirected to `/admin/login?session_ended=1` inside the app, which unmounts the builder — `beforeunload` and the link
  guard do not see an in-app redirect. The reusable editor behaves the same. It follows A2's accepted rule ("a stale
  request or tab goes to `/admin/login?session_ended=1`", A2 Correction 1), so I did not change it silently. Options
  for the Owner: (a) a pre-save session check in the builder that keeps the working copy and asks to sign in again in
  another tab; (b) a per-tab draft kept in `sessionStorage` and offered back after signing in; (c) keep the session
  alive while edits are unsaved (changes A2's idle policy — not recommended). Recommended: (a), or (a) + (b).

### 2.3 Not reproduced

- **Inspector overflow from long option labels** (client review, "plausible"): measured on the corrected build with
  About's page opening ("Composition", options up to 50 characters) and a Contact details block ("Details shown", 71
  characters) at 1280, 1024, 768, 390 and 320 px: page overflow 0, nothing wider than the inspector (at 320 px the
  select is 262 px in a 288 px inspector). No change.

### 2.4 Documented, not blockers (Low / Info; candidates for a later correction or A8)

Client side (verified by reading; none loses stored data):
1. Some refusals show only "Needs attention" without a reason: issues on a section's anchor (the certificate anchor
   guard), on a newly linked reusable section (archived, removed, guard) and the reusable editor's section-level issues
   (the 48 KB limit); field errors in the other language stay hidden until its tab is opened.
2. Keyboard focus is lost after Remove (the focused card is removed) and on some moves and narrow-screen panel switches;
   the A5 report's "focus stays on the control after a move" holds only for moves that keep the button.
3. A "dirty" state that a save cannot clear: any `onChange` marks a section changed even when the value is the stored
   one; the server answers "Nothing to save" with the same version, the builder does not rebase, so "Unsaved changes",
   the leave warning and the disabled Detach / Make reusable stay until Undo or a reload (the reusable editor handles
   this case).
4. The "Layout saved." banner stays in the address (`done=saved`) and shows again after a later stale reload.
5. Undo merges a structural change inside a repeater, rich text or selection with typing in the same field; anchor
   edits of two sections share one undo step.
6. A 61st section is refused with "The layout couldn't be read. Reload the builder and try again." (Zod's `.max(60)`
   answers before the structure check's clear message), and reloading drops the edits.
7. Info: an error inside an approved component falls back to Next's error shell (status 500, no boot script) while
   `SectionBoundary` still shows its placeholder; a save whose answer is lost reports "didn't reach the server" and a
   retry is stale; identical consecutive status messages are not announced again; the Remove dialog opens before its
   label renders and focuses "Remove the section"; archiving a reusable section with unsaved edits drops them; a stored
   section's Duplicate can pass the block's maximum (the server refuses); empty video / map titles give `title=""`; the
   page opening's Composition select offers variants the server always refuses.

Server side (verified by reading; no Blocker, High or Medium):
8. Info: on the Certificates page the record grids (projects, services, machines, clients, industries) draw A3 record
   texts that the digit guard does not read (only certificate records are guarded) — the same class as the accepted I4
   (alt text); A8's rendered-page check, or no record grids on that page, would close it.
9. Info: deadlocks between saves are wider than L3 describes (availability only, one retry): a builder save that newly
   links a record whose own save links back (page ↔ service, project ↔ service) can deadlock, and the reusable range
   lock (`reusableUses`) can make any section-adding save wait for a reusable section's edit. Same accepted class; the
   reordering / relation-diff hardening stays offered.
10. Info: refusals of forged input inside a layout save (changing a stored section's block type or reusable link,
    texts for a linked section, linking an archived or missing reusable section) answer `invalid` without an audit row,
    while forged structure changes are audited as `denied`.

### 2.5 The preview shows saved content: does it match the specification?

Yes. A1-PUBLISHING-VERSIONS §11 defines the preview as the **working copy** (the stored draft) drawn with the
production components; the A5 report's preview architecture (item 27) and known limitations (item 52: "the preview
shows the saved working copy; unsaved edits are not drawn; the canvas reloads after each save") say the same, and the
builder tells the user so while edits are unsaved ("The preview shows the last saved layout. Save to see your changes
in it."). Nothing the builder holds unsaved is sent to the frame (`Canvas.tsx`), which keeps the frame a faithful
rendering of what is stored and keeps unsaved input out of a second rendering path. No live-editing architecture is
needed or proposed. One documentation note: A1 §11 describes the mechanism as Next's draft mode on the public routes;
A5 used a private admin route group (`/admin/preview/…`) instead, which leaves the frozen public routes and the public
boot script untouched under T1 Option B; the A5 report describes the route but does not call it a change from A1 §11.

## 3. Test results (exact counts; nothing reported as passed that did not run)

Environment: fresh `git clone` of the branch per run, Node 22.22.2 (`.nvmrc`), npm 10.9.7, `npm ci`, a local MariaDB
11.4.13 (Docker) with a throwaway `rawasy_t_*` / `rawasy_e2e_*` database per suite, no `DB_*`, `ADMIN_ENABLED`,
`APP_ENV`, `RAWASY_DATA_DIR` or secrets in the build's environment. Browser: Playwright 1.56.1 expects Chromium 141,
which this container does not have; the environment forbids `playwright install`, so the suites ran on its Chrome for
Testing 153 headless shell through untracked wrapper configs (`launchOptions.executablePath` only; every project's
own settings kept).

| Check | A5 baseline (fresh clone of `f2b73c9`) | This review, `959d399` (fresh clone) | Final, `9296266` (fresh clone) |
|---|---|---|---|
| `npm ci` | ✓ | ✓ (a first attempt silently lost the optional `@next/swc-linux-x64-gnu` on a failed download; a fresh clone and install were correct; the QA script now checks for it) | ✓ (both SWC binaries present) |
| `npm audit --omit=dev` | 0 | **2 (1 critical: next; 1 high: zod)** — new advisories, item 6.1 | **2** (the same) |
| `npm audit` (all) | the accepted dev-only `drizzle-kit` chain | 6: 4 moderate (the same dev-only `drizzle-kit` → `esbuild` chain) + next + zod | 6 (the same) |
| lint · typecheck | ✓ · ✓ | ✓ · ✓ | ✓ · ✓ |
| build (no database settings) | ✓, no warning | ✓, no warning, 147 static pages | ✓, no warning, 147 static pages |
| `db:check` | ✓ | ✓ (6 migration files, seeds match the registries) | ✓ (the same) |
| packaging check (13 held back) | ✓ | ✓ (0 of 13 in the archive, 111 / 111 referenced public files, 2,779 files) | ✓ (the same) |
| unit | 294 / 294 | 294 / 294 | **295 / 295** |
| integration | 425 / 425 | 425 / 425 | **425 / 425** |
| admin browser | 112 / 112 | 112 / 112 (23.1 min) | **115 / 115** (23.6 min) |
| public E2E (against `server.js`, after the image warm-up) | 612 / 612 | not run on this commit (its public output equals the final's) | **612 / 612** (24.4 min, the first full run; warm-up 1,484 / 1,484) |

The four new regression tests failed on `959d399` and pass on `9296266` (item 2.1). Before pushing, the corrected tree
also passed lint, typecheck, build (no warning), unit 295 / 295, integration 425 / 425 and the admin specs it touches
(`cms`, `page-builder`, `preview-parity`: 50 / 50).

## 4. Security and regression review

- **Server side** (independent review, read-only, plus scripts against the real pure functions): no Blocker, High or
  Medium. One Low — the certificate guard's invisible characters — corrected (C1); three Info items documented (2.4 #8–10).
  Confirmed correct: every builder Server Action calls `actionContext` (gate, session, same origin) before reading its
  input; permissions re-decided inside the transaction from permission keys (never role names), after the owner's root
  lock, with the per-owner contract matrix as documented; a Reviewer refused everywhere and audited; size and depth
  bounded before parsing, strict schemas, function defaults, typed rich-text and link models (no free URL, no HTML);
  `FOR UPDATE` + `lock_version` on every change, locking reads for reusable sections (F2), dense positions through a free
  range; reusable link / duplicate / detach / archive rules; the preview's gate, permissions, CSP, `SAMEORIGIN` and
  media rule; one audit event per operation without texts; `0005` equal to `schema-builder.ts`, no existing table
  changed.
- **Client and rendering side** (independent review, read-only): no Blocker or High. Three Medium defects confirmed and
  corrected (C2–C4); one Medium (the session end) left to the Owner (2.2); one Medium "plausible" not reproduced (2.3);
  Low / Info items documented (2.4 #1–7). Confirmed correct: `postMessage` checks source, origin and shape on both
  sides; every frame sandboxed; no HTML path (no `dangerouslySetInnerHTML` on content, links only through
  `resolveLink`, `rel` on new tabs, styles hold numbers or tokens only); the save payload matches the strict schema;
  double submits prevented; leave protection on `beforeunload` and same-origin links; Arabic fields `dir="rtl"
  lang="ar"`; adapters guard every absent record; restricted projects show no photo.
- **Dependencies:** the new production advisories (item 6.1) — the only security item this review could not close.
- **Regression:** every suite at or above its baseline (item 3); the public output proofs in item 5.

## 5. Public website preservation (against `preserve/pre-admin-a5`)

- **Sources.** Since `cc0cae2`: no change in `src/content`, `src/i18n`, `src/fonts`, `public/`,
  `src/app/(commerce)`, `next.config.ts`, `server.js`, robots, sitemap or manifest. The frozen files are byte-identical:
  `home/Machinery.tsx`, `home/MachineShowcase.tsx`, `system.css`, `commerce.css`, `commerce-boot.ts`. The changes are
  A5's documented ones: 24 files of `src/components/commerce` (sections exported as components fed the same data),
  `src/lib/project-cards.ts` (`cardImages()`), `src/proxy.ts` (the preview's admin branch) and `src/lib/admin-headers.ts`
  (admin). This review's four commits touch no public file.
- **Build output** (clean builds, no database settings; `.next/server/app` outside the admin, preview and API):
  890 / 890 files, none missing or added; 712 byte-identical or equal once the build id, hashed asset names and the
  router's sibling list are normalised; 3 differ — `/en/terms`'s HTML, page data and segment — and their **resolved**
  Flight trees are equal (67 rows each) and the visible HTML is equal (a negative control, Privacy against Terms, is
  caught). Stylesheets identical on **104 / 104** pages. Scripts identical on **94 / 104**; on the other 10 (home,
  Capabilities, Certificates, Industries, Projects, EN and AR) one chunk each differs, and a token diff shows exactly the
  conditional `...x.unoptimized?{unoptimized:!0}:{}` spread plus minifier renames of one-letter locals (the homepage hero's
  timing constants `+720 / +60 / +140 / +860` unchanged). This matches the A5 report.
- **Final against `959d399`:** identical public output — 890 / 890 files equal (normalised), server code for the public
  routes 175 / 175, stylesheets and scripts identical on all 104 pages.
- **HTTP** (the baseline and the final build, each served by `server.js` from its own fresh copy of its clean build,
  production settings, no admin variables): 229 answers compared — the 102 sitemap pages as documents, their page-data
  requests (Next's one 307 to the cache-keyed address; the payload files themselves are compared above), robots, sitemap
  (102 addresses), manifest, icons, a share image, a release photo and its optimized image, the localized and fallback
  404 paths, unknown service and project slugs, the retired theme-lab address, the admin addresses with the gate off
  (`/admin/**` → the locale redirect → the localized 404, as before A2), `/api/…`, `/media/u/…` (404) and the optimizer
  refusing an uploaded address (400). Status, the main headers (type, cache, robots, location, CSP, framing, nosniff,
  referrer, vary, link) and the normalised body: **228 equal**; the 229th, `/en/terms`, has equal status, headers and
  length, an equal visible HTML and an equal resolved payload once its inline Flight rows are read in order (67 rows) —
  the renumbering above.
- **Pixels** (resting state: reduced motion, every reveal shown, every photo decoded; 17 pages — home, About, the
  services overview, Laser Cutting, Laser Engraving, Steel Structures, Capabilities, Projects, two project pages,
  Industries, Clients, Certificates, Contact, Privacy, Terms and the 404 — in English and Arabic, light and dark, at
  1440 and 390 px: 136 views, pages taller than 15,000 px captured screen by screen): 398 captures per build, **397
  identical**, page heights equal in all 136 views. The 398th (English Projects, desktop, dark) differed in one gallery
  photo (a 337 × 229 px box, the same source size chosen on both builds). Recaptured twice on each build: the baseline
  differs **from itself** by exactly the same 48,698 pixels (its first capture against its second), and its second
  capture equals both final captures (0 pixels) — an effect of that first capture, not of either build.
- **Release package:** the 13 held-back files are not in the archive (both commits), the check passes; nothing refers to
  `/media/u`; the image optimizer still refuses uploaded addresses (`images.localPatterns`).

## 6. Remaining risks and Owner decisions

### 6.1 New since A5's QA (this review)

1. **Production dependency advisories — the "production vulnerabilities 0" baseline now fails.** `npm audit --omit=dev`
   on an unchanged lockfile reports 2 (1 critical, 1 high), from advisories added to the GitHub Advisory Database on
   22–23 October 2026, after A5's QA (20 October). Per advisory (GitHub advisory pages, read 30 October 2026):

   | Advisory | Package (pinned) | Patched | Applies here? |
   |---|---|---|---|
   | GHSA-2464-fhr4-w9xw, critical (CVSS 9.5): RCE in the Image Optimization API on glibc Linux through `sharp` | next 16.3.8 | next 16.4.1; workaround "ensure sharp ≥ 0.35.5" | The workaround holds: one `sharp`, 0.35.5 (A4 pinned it; `npm ls sharp` shows next's deduped onto it). npm still flags `next`. |
   | GHSA-p3m5-59mp-jv5r, high (8.2): DoS (CPU) through crafted Server Action requests; "no workaround besides upgrading" | next 16.3.8 | next 16.4.1 | **Yes, for any build of this branch**: A2–A5 compiled Server Actions into every build, gate on or off; Next receives and decodes an action request before the action's own code (where the gate is checked) runs, so the gate cannot be relied on against a request-handling flaw. The approved public release candidate before A2 had no Server Action. Nothing is deployed, so nothing is exposed today. |
   | GHSA-673q-mjm6-r5xr, critical (9.5): RCE in `use cache` functions returning typed arrays | next 16.3.8 | next 16.4.1 | No `use cache` / Cache Components in the project; the advisory still asks everyone to upgrade. |
   | GHSA-mrhx-c7xc-m3w5, high (8.2): memory exhaustion validating oversized arrays | zod 4.6.5 | zod 4.6.6 | Admin-only: every Server Action checks the gate, session and origin before it parses; bodies are capped (Server Actions 1 MB, layout 900 KB, upload JSON streamed with a cap). |

   The fix is a version change of `next` (16.3.8 → 16.4.1 or later; npm proposes 16.4.3) and `zod` (4.6.5 → 4.6.6 or
   later; npm proposes 4.6.7). "No Next.js upgrade" is a locked Owner decision (A2 Correction 1) and the project's rule
   is that a dependency change the brief does not authorize is the Owner's, so **I did not change either**. Measured in
   a throwaway clone of `9296266`, not committed: `npm install --save-exact next@16.4.1 zod@4.6.6` changes
   `package.json` (2 lines) and `package-lock.json` (47 lines: `next`, `@next/env`, the nine `@next/swc-*` packages,
   `zod`; `sharp` stays 0.35.5, deduplicated); `npm audit --omit=dev` **0** (the full audit keeps only the dev-only
   `drizzle-kit` chain); unit 295 / 295; `next build` passes (147 static pages) **but** (a) warns again "Dynamic
   filesystem access causes tracing of the whole project", at `src/server/media/storage.ts:81` (`resolve(cwd)`: A4
   removed such warnings with `/* turbopackIgnore: true */`, which this version's tracer needs here too), and (b)
   changes the bytes of every public page: `next/font`'s CSS-module class names are shortened
   (`plus_jakarta_sans_…-module__dT6wSG__variable` → `dT6wSG_variable`, on `<html>` and in the font stylesheet), so
   stylesheets differ on 103 / 104 pages, scripts on 104 / 104, and every prerendered file. Integration, the admin and
   public suites and a pixel proof were not run on it. The patch is therefore a correction of its own — the version
   change, the tracing fix, full QA and a freeze proof that normalises the new class names and compares pixels — not a
   drop-in. **Decision for the Owner:** authorize the patch as its own correction (full QA, public freeze proof — a Next
   minor release can change served output — and the image warm-up check), before A6's implementation starts and before
   any staging or deployment.
2. **A session that ends with unsaved builder edits loses them** (item 2.2): choose (a) a pre-save session check, (b) a
   per-tab draft, or both; (c) keep-alive is not recommended (it changes A2's idle policy).
3. **Low / Info backlog** (item 2.4): schedule as an A5 follow-up correction or with A8 (none loses stored data).

### 6.2 Carried from A5 (unchanged; documented, not decided)

| # | Decision | Status after this review |
|---|---|---|
| 1 | Who chooses and orders the certificates a section shows (Editors today, `pages.edit` / `reusable_sections.edit`; A3 keeps the collection's own order to Owner / Admin) | Unchanged; nothing exposed (redacted previews only). Related new Info 2.4 #8: record grids on the Certificates page are not read by the guard. |
| 2 | A reusable section's edit needs `reusable_sections.edit` only, not each linking owner's permission | Unchanged; no stricter owner can link one today (legal pages take no additions). Decide before they do. |
| 3 | The retried deadlock (L3) and the hardening (reorder; A3's relation diff) | Unchanged; the server review found the class somewhat wider (2.4 #9). Availability only, one retry. |
| 4 | Pixel parity of the 29 bespoke blocks not compared | Unchanged: compare after A9's import, or seed test records earlier. |
| 5 | The homepage machinery showcase draws its six machines in its frozen order | Unchanged; `home/Machinery.tsx` and `MachineShowcase.tsx` byte-identical to the baseline (pinned by the public suite). |
| 6 | A9 decouples public `/media/u/**` from `ADMIN_ENABLED` | Recorded for A9; unchanged. |
| 7 | The reduced-motion pressed-button fix (`scale: none`) | Waits for the Owner's go-ahead on the public CSS; unchanged (public CSS identical to the baseline). |

### 6.3 What is an A5 acceptance blocker, and what is deferred

- **A5 defects found by this review:** four, all corrected with tests (C1–C4). None remains open in A5's own code.
- **Open decisions that are not A5 code defects:** the dependency patch (6.1 #1: project-wide, needs the Owner's
  authorization) and the session-end behaviour (6.1 #2: follows A2's accepted rule).
- **Deferred by design to later phases:** publishing and revisions (A8), the public site's switch to the database and
  `/media/u` decoupling (A9), site settings / menus / interface text (A6), forms (A7), media "used by" for sections
  (A8's reference index), the rendered-page certificate check (A8).

## 7. A5 acceptance recommendation

**READY — for the Owner's acceptance review of A5, with one condition that lies outside A5's code.**

Evidence:
- All 14 scope points verified by tests, code and browser (item 2.0); the preview's saved-content behaviour matches the
  specification (item 2.5).
- Every genuine A5 defect this review found — one Low security gap and three Medium builder defects — is corrected, each
  with a regression test that fails before and passes after (item 2.1). Neither independent review found a Blocker or
  a High; no A5 defect is left open.
- Every suite at or above its baseline on a fresh clone of the final commit: unit 295 / 295, integration 425 / 425,
  admin 115 / 115, public 612 / 612 (item 3).
- The public website is unchanged against `preserve/pre-admin-a5` beyond the differences A5 documented, and the final
  commit's public output equals `959d399`'s (item 5).

The condition: the brief's baseline "production vulnerabilities 0" now fails (2), because of advisories published after
A5's QA against `next` 16.3.8 and `zod` 4.6.5 (item 6.1). It is not an A5 code defect and I may not fix it: the patch
(`next` 16.4.1, `zod` 4.6.6; measured: production audit 0) changes framework versions, which is the Owner's decision. I
recommend authorizing it as its own correction, with full QA and a public freeze proof, before A6's implementation
starts and before any staging or deployment. **If the Owner counts the production audit among A5's acceptance
criteria, A5 is BLOCKED on that patch alone.**

Recommended alongside, not blocking: decide how a session that ends with unsaved builder edits should behave (item 2.2).

A5 is **not** Owner-approved: this review recommends; the Owner's independent review decides.

## 8. A6 implementation plan (Global Site Controls) — prepared, not implemented

A6 is the sixth locked phase ("A6 Global site controls: menus, site settings, interface text, theme tokens, SEO
defaults, redirect management", A1-ARCHITECTURE §1). This plan reuses A1's design and A2–A5's code. Nothing here is
built; it starts only when the Owner approves A5 and says so.

### 8.1 Ground rules carried over (unchanged)

- **T1 Option B.** Everything A6 edits is a database working copy, used by the admin and A5's private preview only. The
  public site keeps reading `src/content/*` and `src/i18n/dictionaries.ts` until A9's single cutover; no public route,
  layout or component reads the database; production and staging keep `ADMIN_ENABLED` unset.
- **No publishing in A6.** As in A3–A5, no Publish button and no revisions in use: the `menus.publish`,
  `settings.publish` and `theme.publish` keys stay unused until A8 (publishing, versions). *Owner to confirm (D-A6-1).*
- **Frozen public site.** `getShellView`, the header, the footer, `company.ts`, `navigation.ts`, `dictionaries.ts`,
  `seo.tsx`, `maps.ts`, `robots.ts` and `sitemap.ts` are not changed. If a pure function must be shared, it is exported
  unchanged and proved "pages unchanged" (A5's protocol: files, resolved payloads, CSS, JS module sets, HTTP, pixels,
  against a new `preserve/pre-admin-a6` checkpoint).
- **Facts are never invented.** Each field starts from today's content layer (copied, never rewritten); unknown fields
  stay empty (the Google Maps place link, coordinates beyond the approximate district).

### 8.2 What A6 adds, by A1 table

| Area | A1 tables (A1-DATABASE-SCHEMA, "Navigation, site settings, theme, interface text and redirects") | Today's static source (seeded from it, unchanged) | Permission keys (seeded since A2) |
|---|---|---|---|
| Company information, contact details, social links, map | `site_settings` (singleton `site`), `site_setting_translations`, `company_phones` | `src/content/company.ts` (legal and brand names, statement, address, city, country, postal code, approximate geo, phones with WhatsApp, email, website, Facebook, vision), `src/lib/maps.ts` (address search) | `settings.edit` (Owner, Admin) |
| Header, footer and navigation | `menus` (slots `header_main`, `header_services`, `footer_company`, `footer_legal`), `menu_items`, `menu_item_translations` | `src/content/navigation.ts` (`headerNav`, `footerNav`, `legalNav`); the Services dropdown is the `services` collection | `menus.edit` (Owner, Admin) |
| Interface text | `ui_strings` (keys defined in code), `ui_string_translations` | `src/i18n/dictionaries.ts` (groups `a11y`, `controls`, `common`, `footer`, `notFound` …) | `settings.edit` |
| Theme controls | `theme_settings` (singleton `theme`), `design_token_overrides` (registry keys, typed values; empty = the approved design) | the A V2 tokens in `system.css` (read-only reference) | `theme.edit` (Owner only, sensitive) |
| Redirects | `redirects` (308/307, normalised `source_path`, typed targets, `reason` manual / slug_change / import) | none today | `redirects.view` (all roles), `redirects.manage` (Owner, Admin) |
| Global SEO configuration | `site_setting_translations.site_name`, `default_seo_description`; `site_settings.default_og_image_media_id` (A4 media) | `src/content/seo.ts` (`siteName`), `src/lib/seo.tsx` (organization JSON-LD), `/og/og-{locale}.png` | `settings.edit`; `seo.advanced` stays per record (A3) |

One migration (`drizzle/0006_site_controls.sql`: the ten A1 tables plus `redirects`, InnoDB `utf8mb4_unicode_520_ci`,
`ascii_bin` keys, A1's checks) and one generated seed (`0007`: the four menu slots and every `ui_strings` key from a
code registry, by `scripts/generate-access-seed.mjs`; `npm run db:check` compares them). No new permission: the keys
above exist since A2's seed.

### 8.3 Server code (framework-free, `src/server/site/`)

- `settings.ts`, `menus.ts`, `ui-strings.ts`, `theme.ts`, `redirects.ts`: each change in A3's `contentTransaction`
  (actor and session locked, then the aggregate root `FOR UPDATE`, the page's `lock_version` compared, "This content
  changed after you opened it…" on a stale save), permission re-decided inside from the registry, audited with keys and
  states only (never texts or URLs' query strings), refusals audited as `denied` / `failed`.
- Validation reuses what exists: A3's plain-text rules and translation states (`text.ts`, `completeness.ts`, one
  definition as in `translated.ts`), A5's typed link targets (`builder/links.ts`: page, service, project, anchor,
  `https:`, `tel:` / `mailto:`, WhatsApp) and anchor checks (`renderedIds`, `recordIds`), A5's token vocabulary and
  contrast rule (`builder/design.ts`: every surface × tone ≥ 4.5:1 in both themes), A4's media rule for the default
  share image (public-class, approved, deliverable). Phones in E.164; email per A2's normaliser; social and map links
  `https:` on an allow-listed host; no free URL kind, CSS, HTML or script anywhere.
- Menus: one level of nesting, per-device visibility, targets that exist and are not archived (share-locked when newly
  linked, as A3), the quote button and the language / theme controls stay fixed parts of the header (not menu items),
  `aria-current` computed by code (TM-1/TM-2 rules).
- Interface text: keys only from the code registry (generated from `dictionaries.ts`, with a drift test like A3's
  completeness tests); per-key maximum length; the language-switch label keeps its other-language `lang`.
- Redirects: `source_path` normalised (`/en/old-page`: locale, no trailing slash, no query, ASCII), never a path any
  route answers (checked against `routes.ts`, `reserved-slugs.ts`, record slugs and the 404 rules), no chains or loops
  (targets resolve in one step), 308 or 307, `last_hit_at` at most once a day. In A6 they are stored, validated and
  listed; **they resolve only where the database is the public source, i.e. from A9's cutover** (the static release
  never reads them). Automatic redirects on a published slug change belong with publishing (A8). *Owner to confirm
  (D-A6-4).*

### 8.4 Preview integration (the only place A6 is "seen")

A5's `PreviewCanvas` builds its header and footer with today's `getShellView` and the bespoke blocks read
`company.ts`. A6 adds a server-side `shellViewFromWorkingCopy(locale, route)` in `src/server/site/` that returns the same
`ShellView` type from the working copies (settings, menus, interface text), and the preview passes it (and the working
copy's company facts) to the same components. The public `getShellView` keeps its bytes, so every public payload stays
identical. Theme overrides apply only in the preview, as `data-*` / token values on the preview's root.

### 8.5 Admin screens (A2 shell, nonce CSP, English admin)

`/admin/settings` (company, contact, phones, social, map, SEO defaults; EN / AR side by side, `dir="rtl" lang="ar"`),
`/admin/navigation` (the four slots, items with Up / Down / Remove — no dragging, as A4/A5), `/admin/interface-text`
(grouped, both languages, length counters, search), `/admin/theme` (Owner only; each token with its default, the
contrast result in both themes, a reset), `/admin/redirects` (server-side list, filters, new / edit / deactivate, the
conflict check's message). Every new grid uses `minmax(0, 1fr)` columns and long buttons wrap (A4/A5's 320 px rules).

### 8.6 Tests and proofs (as A3–A5)

Unit (registries, validation, normalisation, contrast, the interface-text drift test), integration (the role × permission
matrix for each new action, optimistic concurrency, audit by kind, menu targets, redirect conflicts / chains / loops,
migration A–G on an A5 database), admin browser tests (each screen at 1280 / 768 / 390 / 320, light / dark, axe, the
preview showing the working copy, a Reviewer refused), the public suite, and the public freeze proof against
`preserve/pre-admin-a6`. One commit per step: schema and seed; registries; services; Server Actions; screens; preview
integration; tests; README and docs; review fixes.

### 8.7 Owner decisions needed before A6 starts

- **D-A6-1** No publishing in A6 (working copies and preview only; publish in A8) — confirm.
- **D-A6-2 Social links.** A1 has one `facebook_url` column. Keep that, or add a small `site_social_links` table
  (platform from a fixed list, `https:` URL, order, visibility) — a schema addition beyond A1's catalogue, like A3's three.
- **D-A6-3 Theme controls.** Which tokens, if any, may be overridden. The approved A V2 design is binding (orange as a
  ~10 % accent, no new theme): recommended — build the mechanism with an **empty** token list and add tokens only as the
  Owner approves them one by one.
- **D-A6-4 Redirects.** Stored and validated in A6; resolved from A9's cutover; automatic slug-change redirects with
  publishing (A8) — confirm.
- **D-A6-5 Interface text scope.** `dictionaries.ts` only (A1 §10), or also the few shell labels kept in content files
  (`navigation.ts` titles, "All services").
- **D-A6-6 Public security headers** (A1-SECURITY-RBAC §14, proposed "for A2/A6"): they change public response headers,
  not appearance — in A6, at A9, or not.
- **D-A6-7 The default share image** as an A4 media setting (today `/og/og-{locale}.png` stays in the release until A9).
- RAWASY's own Google Maps place link (still pending): A6 provides the field; it stays empty until RAWASY confirms it.

## 9. Final commit and push status

- Corrections: `6ce90ed`, `a215f74`, `f8a439e`, `9296266`, pushed to `origin/claude/new-session-5eijs6` as a
  fast-forward from `959d399` (no force push).
- This report and the project memory (`CLAUDE.md`): the commit after `9296266`, pushed the same way (its SHA is given
  with the report's delivery).
- `main` untouched (`474f61f`), no pull request, no merge, nothing deployed, no production feature activated, A6 not
  started.

## Items needing RAWASY's confirmation

Unchanged by this review: RAWASY's own Google Maps place link (A6 provides the field; it stays empty until confirmed),
the image rights and flagged photos in `docs/ASSET_INVENTORY.md`, and certificate numbers, QR codes and personal names
(redacted unless RAWASY approves — the guard corrected in C1 enforces this on every certificate text).

## Known limitations of this review

- The A5 brief's own text was not available (item 1); the review used the A5 report, A1's specifications and the code.
- The browser suites ran on Chrome for Testing 153 (this container's), not Playwright 1.56.1's Chromium 141 (item 3).
- The public E2E suite ran on the final commit only; `959d399`'s public output equals the final's (item 5).
- The independent reviews were read-only reviews of the code at `959d399`; their Low / Info items were verified by
  reading, not each reproduced in a browser (item 2.4 says which were measured).
- The dependency patch was measured in a throwaway clone only (item 6.1); its full QA and freeze proof belong to the
  correction the Owner may authorize.

## How to run (local only)

As for A5: README, "Admin (local development)" (a local MariaDB 11.4, `.env.local` with `APP_ENV=local`, `DB_*`, a
throwaway `AUTH_ENCRYPTION_KEY`, a `RAWASY_DATA_DIR` outside the project; `npm run db:check`; migrate; build; start;
bootstrap the first Owner). Tests: `npm run test:unit`, `npm run test:integration` and `npm run test:admin` (with
`TEST_DB_HOST/PORT/USER/PASSWORD`; this review's browser tests are the "A5 acceptance review" group in
`e2e-admin/page-builder.spec.ts`), `npm run test:e2e` for the public site. Where Playwright's own Chromium is not
installed, point the projects at an installed Chromium with `launchOptions.executablePath` in a local wrapper config.

## Next steps

1. The Owner's independent review of A5, with this report and the four correction commits; the Owner decides whether
   A5 is accepted (this report does not accept it).
2. The Owner's decisions: the dependency patch (6.1 #1), the session-end handling (6.1 #2), the A5 items carried (6.2)
   and the A6 decisions (8.7).
3. Only on the Owner's explicit go-ahead: A6, from a new rollback checkpoint `preserve/pre-admin-a6`, as planned in
   item 8.
