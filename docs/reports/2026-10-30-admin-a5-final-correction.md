# Admin / CMS — A5 final security & data-preservation correction (30 October 2026)

Branch `claude/new-session-5eijs6`. Local implementation only: nothing deployed, `main` untouched, no pull request, no
merge, A6 not started, no production infrastructure changed. **A5 is not Owner-approved**: this report recommends; the
Owner's independent review decides.

## Summary and status

The two corrections the A5 acceptance review left for the Owner are done, each in its own commits, with full QA on a
fresh clone of the final code commit and a public freeze proof.

1. **Security dependencies (the Owner's authorized exception).** `next` 16.3.8 → **16.4.1** and `zod` 4.6.5 →
   **4.6.6**, the minimum patched versions, verified against the advisories (16.4.2 / 16.4.3 carry no security fix;
   zod 4.6.7 is 4.6.6's code with a new version number). Nothing else was upgraded; no `npm audit fix` was run. The
   one build incompatibility — 16.4's tracer reading `resolve(process.cwd())` in `src/server/media/storage.ts` as an
   access to the whole project — is fixed with `/* turbopackIgnore: true */` without changing the check or the storage.
   **`npm audit --omit=dev`: 0.**
2. **Unsaved builder work when a session ends.** A save made without a live session is now answered in the page —
   the edits stay, sign in again in a new tab, save again — instead of redirecting away; the editor names the person
   it was opened for, so one person's typing is never saved under another's session. While dirty, the page builder and
   the reusable section editor keep a copy of their working copy in the tab (`sessionStorage`), scoped to user, record
   and tab, offered back after sign-in and permission checks, restored only onto the version it was made from, never
   applied over newer content (download or discard instead), and cleared on save, discard, a confirmed leave, sign-out
   (all admin tabs), another user's sign-in and after 12 hours. The session limits, MFA and RBAC are unchanged; nothing
   polls.

Status: both corrections built and verified. On a fresh clone of the final code commit every suite is at or above its
baseline — unit 311 / 311, integration 425 / 425, admin 122 / 122, public 612 / 612 — the production audit is 0, and the
approved public website is unchanged against the 16.3.8 baseline: every difference in its build output is the new
framework's encoding of the same content, each one measured (item 6). Recommendation (item 8): **A5 READY FOR OWNER
CLOSURE.**

## 1. Starting and final commit SHA

- **Start:** `2e01a1f8f5c6fb8b79c0252f52edb3d61ecc1832` — local `HEAD` equal to `origin/claude/new-session-5eijs6`,
  working tree clean (checked, not assumed).
- **Preservation checkpoint:** GitHub branch `preserve/pre-admin-a5-final-correction` at `2e01a1f` (created and pushed
  before any change).
- **Commits, each on its own:**

  | Commit | What |
  |---|---|
  | `a116222` | Media storage: the application-folder check is not a file access (the tracing fix) |
  | `0613fe5` | Security: `next` 16.3.8 → 16.4.1, `zod` 4.6.5 → 4.6.6 |
  | `bbb53f2` | Builder and reusable editor: unsaved work survives a session that ends |
  | `96e9ded` | Tests: unsaved builder work when the session ends |
  | `eb2119a` | Kept builder work: a restored copy shows the media chosen before it was kept (found while testing) |
  | `b446189` | This report and the A5 technical report's final-correction section (documentation only; pushed while the fresh-clone public suite was still running, its result marked pending) |
  | (the next commit) | The public suite's result in this report; `CLAUDE.md` (documentation only) |

- **Final code commit:** `eb2119a`. **Final commit:** the second documentation commit on top of it (its SHA is given
  with the report's delivery). Pushed to `origin/claude/new-session-5eijs6` in two fast-forwards, `2e01a1f..b446189`
  and then the final documentation commit (no force push).

## 2. Exact changed files and dependencies

### 2.1 Dependencies

| Package | Before | After | Where |
|---|---|---|---|
| `next` | 16.3.8 | **16.4.1** | `package.json` (exact pin) and lockfile |
| `@next/env` | 16.3.8 | 16.4.1 | lockfile (dependency of `next`) |
| `@next/swc-*` (8 platform binaries: darwin arm64/x64, linux arm64/x64 gnu/musl, win32 arm64/x64) | 16.3.8 | 16.4.1 | lockfile (optional dependencies of `next`) |
| `zod` | 4.6.5 | **4.6.6** | `package.json` (exact pin) and lockfile |

Produced by `npm install --save-exact next@16.4.1 zod@4.6.6` on a clean `npm ci` (identical to the A5 review's
throwaway measurement): `package.json` 2 lines, lockfile 47 lines, 11 packages, nothing else. Unchanged: React / React
DOM 19.2.8, `sharp` 0.35.5 (deduplicated under `next`'s new `^0.35.5`), Node 22.22.2, MariaDB 11.4, `drizzle-orm`
0.45.3, `mysql2` 3.24.4, `@node-rs/argon2` 2.2.1, `eslint-config-next` 16.3.6 (dev), Playwright 1.56.1 (dev). (Commit
`0613fe5`'s message miscounts the platform binaries as nine; there are eight, plus `@next/env`.)

### 2.2 Files (`git diff --stat 2e01a1f eb2119a`, plus the documentation commit)

- Dependencies: `package.json`, `package-lock.json`.
- Tracing fix: `src/server/media/storage.ts` (one comment and the `turbopackIgnore` marker on `resolve(cwd)`).
- Server (admin): `src/server/admin/guards.ts` (`actionContext`'s `signedOut: "answer"`, `SIGNED_OUT_MESSAGE`),
  `src/server/admin/actions/state.ts` (`signedOut`), `src/server/admin/actions/builder-model.ts` (`signed_out` save
  state and its two messages), `src/server/admin/actions/builder.ts` (`editorContext`, `orEnded`, the five actions'
  `editor` argument), `src/server/admin/actions/media.ts` (the picker answers in its dialog).
- Client (admin): new `src/components/admin/builder/draft.ts`, `useDraft.ts`, `DraftNotice.tsx`; changed
  `Builder.tsx`, `ReusableEditor.tsx`, `src/components/admin/cms/useUnsavedChanges.ts` (`onLeave`),
  `src/components/admin/AuthForms.tsx` (sign-out forgets kept copies), `src/components/admin/Shell.tsx`
  (`DraftJanitor`), `src/app/(admin)/admin/(shell)/layout.tsx`, `src/app/(admin)/admin/_components/builder.tsx`
  (`viewer`), `src/app/(admin)/admin/admin.css` (`.adm-bld-notice` buttons wrap on phones).
- Tests: new `tests/unit/builder-draft.test.ts`; `e2e-admin/page-builder.spec.ts` (7 new tests, 2 updated).
- Documentation: this report, `docs/reports/2026-10-16-admin-a5-page-builder.md` (section "A5 FINAL CORRECTION" at the
  end), `CLAUDE.md`.
- **No public file changed:** nothing under `src/app/(commerce)`, `src/components/commerce`, `src/components/builder`,
  `src/content`, `src/i18n`, `src/fonts`, `src/lib`, `public/`, `src/proxy.ts`, the fallback 404, `next.config.ts`,
  `server.js` or `scripts/` (`git diff --stat 2e01a1f eb2119a -- <those paths>` is empty).

## 3. Security advisories resolved

Read on the GitHub Advisory Database on 30 October 2026; versions checked against the installed packages.

| Advisory | Severity | Affected | Patched | Here |
|---|---|---|---|---|
| **GHSA-2464-fhr4-w9xw** — Next.js: unauthenticated remote code execution in the Image Optimization API when SVG files are used (references CVE-2026-96889) | Critical, CVSS 4.0 9.5 | `next` ≥ 10.0.0 ≤ 15.5.27, ≥ 16.0.0 ≤ 16.4.0 | 15.5.28, **16.4.1** | Fixed by 16.4.1. (Its workaround, `sharp` ≥ 0.35.5, already held: one `sharp` 0.35.5.) |
| **GHSA-p3m5-59mp-jv5r** (CVE-2026-94482) — Next.js: denial of service in the App Router using Server Actions | High, 8.2 | ≥ 13.0.0 ≤ 15.5.27, ≥ 16.0.0 ≤ 16.4.0 | 15.5.28, **16.4.1** | Fixed by 16.4.1. Applied to every build of this branch since A2 (Server Actions compiled in, gate on or off); no workaround existed. |
| **GHSA-673q-mjm6-r5xr** — Next.js: unauthenticated remote code execution in `use cache` functions returning typed arrays | Critical, 9.5 | ≥ 16.0.0 ≤ 16.4.0 | **16.4.1** | Fixed by 16.4.1 (the project has no `use cache`; flagged by the audit all the same). |
| **GHSA-mrhx-c7xc-m3w5** (CVE-2023-54404) — Zod can exhaust memory while validating oversized constrained collections | High, 8.2 | `zod` < 4.6.6 | **4.6.6** | Fixed by 4.6.6: arrays, sets and maps with a size bound are now checked before their elements are parsed (diff of the published 4.6.5 and 4.6.6 packages). |

- The three Next advisories were published by the Next.js team on 14 October 2026 (16.4.1's release notes list exactly
  these three) and added to the GitHub Advisory Database on 22 October; the Zod advisory was published 1 October and
  updated 23 October.
- **Minimum verified safe versions.** `next` 16.4.2 and 16.4.3 (released after 16.4.1) are backported bug fixes with no
  security fix in their release notes; `zod` 4.6.7's published package differs from 4.6.6 only in its version number
  (diffed). npm's own suggestion (16.4.3, 4.6.7) was therefore not taken: 16.4.1 and 4.6.6 are the smallest change.
- **Audit:** `npm audit --omit=dev` → **found 0 vulnerabilities** (on the working checkout and on both fresh clones).
  `npm audit` (with development dependencies) → 4 moderate, the accepted dev-only chain `drizzle-kit` →
  `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild` ≤ 0.24.2 (GHSA-67mh-4wv8-2f99: the esbuild
  development server); its only offered fix is `--force` to `drizzle-kit` 0.18.1, a breaking downgrade — not done, as
  before. Nothing was suppressed.

### 3.1 The one build incompatibility

`next build` with 16.4.1 warned "Dynamic filesystem access causes tracing of the whole project" at
`src/server/media/storage.ts:81` (`const app = resolve(cwd)` in `dataDirFrom`, `cwd` defaulting to `process.cwd()`):
the traces of 47 admin and media routes then listed 434 source files instead of 24. `resolve()` there is a string
comparison (a data folder inside the release is refused), never a file access, so the call carries
`/* turbopackIgnore: true */` — the same marker A4 put on the run-time paths (`66de7be`). Behaviour unchanged:
`tests/unit/media-storage.test.ts` (the folder inside the application, the application folder itself, a relative path,
`public` / `public_html`) passes; the build has no warning; on all 84 traces the source and public files listed are
those of the 16.3.8 build (24 source, 148 public on the media routes, as before). No other change was needed: lint,
typecheck, the build and every suite pass on 16.4.1 as they are.

## 4. Session recovery implementation

### 4.1 Before

A builder save after the session had ended (2 hours idle, 12 hours absolute, signed out elsewhere) was redirected to
`/admin/login?session_ended=1` inside the app; the builder unmounted and its working copy was gone (`beforeunload` and
the link guard don't see an in-app redirect). Reproduced on `0613fe5` (the upgrade, before this correction) with a
probe: the save navigated to `/admin/login?session_ended=1`, the typed title was gone, nothing was offered after signing
in, the stored title unchanged. The same on the corrected build: the page stayed, the status read "Signed out: not
saved", the typed title was still in its field, the kept copy was offered after signing in (no console error).

### 4.2 Server: a save is answered, never redirected, and names its editor

- `actionContext(action, { signedOut: "answer" })`: without a fully signed-in session it returns a refusal marked
  `signedOut` ("Your session has ended, so nothing was saved.") instead of redirecting; nothing is done. Every other
  admin action keeps A2's redirect.
- The five builder actions — layout save, set-up, detach, make reusable, reusable save — start with `editorContext`:
  the admin's own checks with that option (gate, session, same origin), then the person: the editor names the user it
  was opened for (`editor`, a second argument); a session of anyone else (this browser signed in as someone else
  meanwhile) is refused (`signed_out`, reason `other_user`) and **audited** as denied — before the payload is read. A
  session that ends while the change runs (`SessionEndedError` inside its transaction) is answered the same way
  (`orEnded`). Permissions, the version check, validation and auditing inside the services are unchanged.
- The media picker inside these editors answers in its dialog ("Your session has ended. Sign in again in a new tab, then
  search again; nothing on this page is lost.") instead of navigating away (A3's content editors share the picker and
  gain the same).
- **Pre-save check.** The check is the save request's own first step (`editorContext`), before its payload is read:
  one request, so no window between a separate check and the save. No keep-alive: nothing calls the server while an
  editor is idle (tested: no request in 1.5 s of an idle dirty builder); the 2-hour idle and 12-hour absolute limits,
  `SessionKeeper`'s rotation, MFA, RBAC and A2's rule that an ended token never authenticates are unchanged.

### 4.3 Client: the edits stay, and a copy is kept in the tab

- **Signed out.** The editor shows "Your session has ended, so nothing was saved. Your changes are still here, and a
  copy is kept in this browser tab. Sign in again in a new tab, then come back to this tab and select “Save layout”."
  with a "Sign in again in a new tab" link (`/admin/login?session_ended=1`, `noopener`). A full sign-in there (password,
  and the second factor where required) gives the browser a new session; the same tab's next save goes through and is
  decided on the version it opened. For another user: "This browser is now signed in as someone else, so nothing was
  saved." — sign out in the other tab and sign in as yourself.
- **The kept copy** (`draft.ts`, `useDraft.ts`): while dirty, the working copy is written to `sessionStorage` half a
  second after a change and at once when the page goes (`pagehide`, unmount: a redirect, a reload, Back / Forward).
  - What it holds: the editor's own content only — a layout's sections (order, visibility, devices, anchors, links to
    reusable sections, data only for edited and new sections) or a reusable section's name and data; the version it was
    made on; the time; the cards of the public media items it names (titles, state, the admin thumbnail's address).
    Never a credential, token, cookie, session id, password, code or file; no private media item; no server model;
    no address but the admin's own thumbnail route (checked on read).
  - Scope: key `rawasy-draft:v1:<user>:<page|service|reusable>:<id>`; `sessionStorage` is this tab's alone and ends
    with it.
  - Offered back only in that record's editor, for that user, once the page's own sign-in (`requireActor`), view
    permission and edit permission (`model.can`) have passed — the editor is inert until the person decides:
    **Restore unsaved changes** (the copy is applied as one undoable step; the page saves it as usual) or **Discard
    them** (confirmation).
  - **Version first.** Restored only onto the version it was made from (and only if every stored section and block it
    names is still there). A copy made on an older version is never applied: "They can't be restored here: this layout
    was saved again since then (version 2, now 3), and restoring them would overwrite the newer version." — **Download
    the kept changes** (a JSON file to compare by hand) or **Discard them**. A stale save keeps the copy the same way
    (after "Reload the latest version").
  - Removed: after a save (the stored version replaces it); on discard; when leaving through a link is confirmed
    ("Leave this page and lose them?"); on sign-out — this tab and, through a `BroadcastChannel`, the admin's other open
    tabs of the browser; on any admin page of another user in this tab (`DraftJanitor` purges other users' copies);
    after 12 hours (the absolute session limit). Unreadable or tampered copies are removed, never applied.

### 4.4 Tests (regression)

- `tests/unit/builder-draft.test.ts` (16): keys and scope; freshness (12 h, = `SESSION_ABSOLUTE_MS`); unreadable and
  tampered copies (another user's work under this key, wrong record, version, time); purge (other users, expired) and
  clear; a layout's copy holds no server model, no address, no credential; restore only where every section fits; a
  removed section stays removed; media cards (public and named only; private, foreign address, unknown fields
  refused); the session limits unchanged (2 h / 12 h); no interval and no server call in the kept-copy code; every
  builder action starts with `editorContext`.
- `e2e-admin/page-builder.spec.ts`, "A5 final correction" (7): session ended → save answered in the page, text kept,
  sign-in in a new tab, the same tab saves (idle sends nothing; no credential in the copy; axe); reload after the
  session ended → restore on the same version, a photo chosen before comes back with its card, saved (axe, 320 px);
  **two editors**: the later save refused as changed elsewhere, nothing stored over the newer version, the kept edits
  offered for download or discarding only (axe); another person signed in in the browser → nothing saved, refusal
  audited, the first person's copy purged; sign-out clears this tab and the other admin tab; the reusable section
  editor; the media picker. Updated: the existing two-editor test discards the copy its reload now offers; the
  Reviewer's forged save names the Reviewer (and one naming nobody or someone else is refused before the payload is
  read, audited).
- **Fail before:** the 7 new tests each failed on `0613fe5` (run one by one on a fresh server and database: six at their
  first kept-copy check, the picker test at its signed-out message), and pass on `eb2119a`.

## 5. Full test results (fresh clone of `eb2119a`)

Fresh `git clone` of the branch (the local repository, at `eb2119a`, cloned before the push), Node 22.22.2, npm 10.9.7,
a local MariaDB 11.4.13 (Docker) with a throwaway database per suite, no `DB_*`, `ADMIN_ENABLED`, `APP_ENV`,
`RAWASY_DATA_DIR` or secrets in the build's environment. Browsers: this container's Chrome for Testing 153 headless
shell through untracked wrapper configs (`launchOptions.executablePath` only), as in the A5 review.

| Check | Baseline (A5 review, `9296266`) | This correction (`eb2119a`) |
|---|---|---|
| `npm ci` | ✓ | ✓ (403 packages; both `@next/swc-linux-x64` binaries present) |
| `npm audit --omit=dev` | 2 (next, zod) | **0** |
| `npm audit` (all) | 6 | 4 moderate — the accepted dev-only `drizzle-kit` → `esbuild` chain only |
| lint · typecheck | ✓ · ✓ | ✓ · ✓ |
| build (no database settings) | ✓, no warning | ✓ (Next.js 16.4.1, 147 static pages), **0 warnings** (no whole-project tracing) |
| `db:check` | ✓ | ✓ (6 migration files; seeds match the registries; no schema change) |
| packaging check (13 held back) | ✓ | ✓ (0 of 13 in the archive; 3,023 files) |
| unit | 295 / 295 | **311 / 311** (+16: `builder-draft.test.ts`) |
| integration | 425 / 425 | **425 / 425** |
| admin browser | 115 / 115 | **122 / 122** (24.0 min; +7: "A5 final correction") |
| public E2E (`server.js`, after the image warm-up) | 612 / 612 | **612 / 612** (first run, 22.5 min) |

Notes:
- **One run of each suite, in the order of the table; no retry, no test marked flaky, nothing skipped.** Times: unit
  6.4 s, integration 135.7 s, admin 24.0 min (1 worker), public 22.5 min (3 workers), after the image warm-up (`node
  scripts/warm-images.mjs`: 1,484 / 1,484 sizes, 0 failed, 100.8 s), against `server.js` on port 3400.
- **Security regression tests** are inside these suites and all pass: A2's sign-in, session, token, MFA, RBAC,
  privilege and promotion boundaries and races (`sign-in`, `sessions`, `tokens`, `mfa`, `rbac`, `privilege-boundary`,
  `promotion-boundary`, `review-races`, `admission`, `secrets` integration tests; `security`, `privilege`,
  `admin-gate` unit tests; the gate, forged and replayed actions and stale tabs in `gate.spec.ts` and
  `admin.spec.ts`), A3's (`cms-review`, `cms-featured-invariant`), A4's (`media-races`, `media-uploads`,
  `media-delivery`; `media-json-body`, `media-bundle`, `media-storage`) and A5's (`builder-review`, unit and
  integration; the canvas sandbox and forged builder actions in `page-builder.spec.ts`) — and this correction's: a
  forged save naming nobody or another user is refused before its payload is read and audited; a session that ended
  saves nothing; no cookie, password or e-mail address in a kept copy (no cookie in its download); another user's copy
  is never offered and is purged; sign-out clears every admin tab; the 2-hour / 12-hour limits are unchanged; no
  keep-alive request.
- **Desktop and mobile visual tests:** the public suite's sweeps (twelve sizes on Capabilities and the project pages,
  320–1440 px every 4 px on the homepage's Industries, phone menus and rows at 320 / 390, 200 % zoom, light / dark,
  forced colours, reduced motion, no JavaScript) and the admin suite's phone checks (the builder at 390 px light and
  dark and at 320 px; the media pickers and every content editor at 320 px; this correction's notices: axe, and no
  sideways scroll or element past the screen at 320 px). The pixel comparison of the public site is item 6.5.
- **Fails before:** the 7 new browser tests each failed on a build of `0613fe5` (item 4.4); the 16 new unit tests fail
  there too (their module does not exist before `bbb53f2`).

## 6. Public website preservation evidence

Baseline: the clean build of `9296266` (Next 16.3.8), whose sources equal the checkpoint `2e01a1f` but for two
documentation files the build never reads. Current: the clean build of the fresh clone (Next 16.4.1). Both served by
`server.js` from their own fresh copies (production settings, no admin variables, empty image caches).

### 6.1 Sources

`git diff --stat 2e01a1f eb2119a` touches no public file (item 2.2): the public site's code, content, fonts, routes,
images, proxy, 404s, `next.config.ts` and `server.js` are byte-identical to the checkpoint. Every difference in the
public output therefore comes from the framework upgrade — and each one found is listed below.

### 6.2 Build output (clean builds, `.next/server/app` outside the admin, preview and API)

| Comparison | Result |
|---|---|
| Public files | 890 / 890 in both, none missing or added. 114 byte-identical; the 601 pages, page data and prefetch segments differ in bytes — the 16.4 Flight encoding and the class names below — and are compared by content in the next rows; server bundles 101 the same, 74 Next's own code. |
| Visible HTML (scripts removed; build id, hashed file names, the router's sibling list and `next/font` class names normalised) | **104 / 104 pages equal** |
| Page data, resolved by content (`canon.mjs`, below) | **104 / 104 equal**; the one encoding-level note: 78 pages list one more async chunk `<script>` (2 → 3; the JS is the same, split once more) |
| Inline scripts besides Flight data: JSON-LD (208 blocks) and the theme boot script | **104 / 104 pages equal** |
| Fonts | the 43 font files byte-identical; the 12 `next/font` class names map one to one (the family prefix dropped, the hash kept) |
| Stylesheets (each page's sheets, class names normalised) | 7 distinct sheets; **3 rules differ**, all written by 16.4's CSS minifier: `.rounded-full{border-radius:3.40282e38px}` → `2147483647px` (Tailwind's `calc(infinity * 1px)`; only the homepage hero's two 32 px icon chips use it) and `@keyframes sk-bend-a` / `sk-bend-b` at 0–40 %: `rotate:none` → `rotate:0deg` (our source says `rotate: 0deg`; 16.3.8 had rewritten it). Both are identity / fully-round values; item 6.5 measures them. |
| Client JavaScript, module by module (below) | **every module of ours equal**; the 62 that differ are Next's runtime (their string literals are Next's and React's, none ours) |
| Final (`eb2119a`) against the upgrade alone (`0613fe5`) | **identical public output**: 890 / 890 files, server bundles 175 / 175, stylesheets and scripts by content on 104 / 104 pages — the session correction changes nothing public |

How the encoding was told apart from content (each with a negative control that is caught):
- **Flight data** (`canon.mjs`): every row reference resolved (including 16.4's string rows, row-referenced export names
  and the deferred back-references through the new root), elements read as `{ type, key, props }`, both router-state
  shapes rewritten to one tree (segment, React node, loading, partial flag, vary params, children), React fragments and
  Next's Outlet / Viewport / Metadata boundary markers treated as the containers they are (they render only their
  children), `children` arrays flattened; the framework's own tree flags compared apart. Controls: Privacy against
  Terms differs at the segment and the language links; a copy of Privacy's 16.4.1 payload with one class changed
  (`xl:block` → `lg:block`) is caught.
- **JavaScript** (`jscanon2.mjs`): each Turbopack module factory parsed (Babel) by its module id (ids come from module
  paths and match across the builds); `"use strict"` dropped; 16.4's mangled export names mapped back through each
  module's export list by position; every local binding renamed in scope order; numeric literals folded
  (`.7*11` = `7.699999999999999`); pure `===` operands in a fixed order; Server Action ids normalised (the action names
  kept); `next/image`'s entry paired by hand (a CommonJS re-export in 16.3.8, an ES re-export in 16.4.1, both of module
  `5500`'s `Image`). Control: two one-token edits in a copy of the 16.4.1 chunks (the certificate dialog's attribute
  name, the pointer's easing constant) are both reported.

### 6.3 HTTP (`server.js`, each build on its own fresh copy, empty image caches)

**231 / 231 answers equal**: the 102 sitemap pages as documents (status, the main headers — type, cache, robots,
location, CSP, framing, nosniff, referrer, vary, link, disposition — the visible HTML and the document's inline Flight
data by content), their 102 page-data requests (both servers answer Next's one 307 to the cache-keyed address, then the
payload by content), robots, sitemap (102 addresses), manifest, icons, both share images, a release photo and a
certificate preview, their optimized image, the localized and unknown-slug 404s, the retired theme-lab address,
`/admin/**` with the gate off (the public locale redirect and 404, as before A2), `/api/…`, `/media/u/…` (404) and the
optimizer refusing an uploaded address (400).

### 6.4 Public media and the 13 restricted files

- **1,484 / 1,484 optimized images byte-identical** (every `/_next/image` address the 102 pages offer, the same set in
  both builds' pages; each made by its own build's optimizer from an empty cache; same `sharp` 0.35.5).
- The 13 held-back files: 0 of 13 in the deployment archive (the packaging script's own check passes on the fresh clone;
  3,023 files, no held-back media), none referenced by any page, `/media/u/**` still 404 with the gate off, and
  `images.localPatterns` still refuses uploaded addresses (400).

### 6.5 Pixels and motion

- **Resting pixels** (reduced motion, every reveal shown, every photo decoded; 17 pages — home, About, the services
  overview, Laser Cutting, Laser Engraving, Steel Structures, Capabilities, Projects, two project pages, Industries,
  Clients, Certificates, Contact, Privacy, Terms, the 404 — in English and Arabic, light and dark, at 1440 and 390 px:
  136 views, 398 captures per build, pages taller than 15,000 px screen by screen): **page heights equal in all 136
  views; 357 captures identical at the first capture.** The other 41 were recaptured, each build twice, alternating:
  - English Projects, desktop, dark (1 capture: one gallery photo, 48,698 pixels — the same spot and count as the A5
    review's first-capture effect): **identical** on both builds in every recapture.
  - Arabic Projects, phone, dark (20 screens): **identical** in every recapture.
  - Arabic Projects, phone, light (20 screens): the baseline's two recaptures and the final build's first are
    identical; the final build's second differs from its own first. Cause: the gallery card of the tulip roundabout
    (a 464 px photo in a 380 px slot) is drawn from the `w=384` candidate, or — when the hero print's `w=640` file is
    already in the browser's memory cache — from that file, at the same size and place. Counted over 8 fresh loads per
    build, alternating: **5 × `w=384`, 3 × `w=640` on each build** — the browser's cache timing, the same on both, not
    the upgrade. (Both candidate files are byte-identical across the builds: item 6.4.)
- **The changed keyframes** (`sk-bend-a/b`, `rotate: none` → `0deg`): the Capabilities press-brake sketch held at 10
  moments of its run (0, 20, 40, 45, 50, 55, 60, 66, 80, 100 %) in EN / AR × light / dark, with every other clock
  stopped and the console's scan line hidden on both builds: the parts' computed rotation and transform and their boxes
  **equal in 40 / 40 frames** (`none` and `0deg` both resolve to no rotation; the bend's angles — 3.84615°, 7.69231° … —
  are identical); pixels **identical in 38 / 40**, the other two 3 pixels each — the size of the noise the baseline
  shows against itself (39 / 40 identical, one frame 3 pixels).
- **`.rounded-full`** (`3.40282e38px` → `2147483647px`): the homepage hero's two 32 px icon chips, the only use, are
  inside the resting-pixel captures above (the homepage at both widths, both languages, both themes): identical.

- The public E2E suite (item 5) is the behaviour proof: motion and reduced motion (`commerce-motion`), words never fading
  (`commerce-motion-contrast`), the hero loop and signatures (`commerce-home-depth`), fonts and the Arabic preloads
  (`commerce-fonts`), transitions, keyboard rows, SEO and structured data, the 404 status matrix, contact golden outputs,
  certificates' redaction hashes and digit guard, Capabilities' console and cold anchors, project pages.

## 7. Remaining blockers

**None** in A5's code or in this correction: no test failed, no public difference is left unexplained, and no advisory is
open in the production dependencies.

Not blockers, for the Owner (unchanged by this correction): the A6 decisions (acceptance review item 8.7) and the
carried A5 items and Low / Info backlog (the table below). "No Next.js upgrade" stays the locked rule: this correction
used the Owner's one-time authorization (16.3.8 → 16.4.1); any further version change returns to the Owner.

## 8. Recommendation

**A5 READY FOR OWNER CLOSURE.**

- The two items the acceptance review left open are closed: the production audit is 0 (`next` 16.4.1, `zod` 4.6.6, the
  minimum patched versions; nothing else upgraded), and a session that ends no longer costs unsaved builder or reusable
  section work (answered in the page; kept in the tab, restored only onto its own version).
- Every suite passes on a fresh clone of `eb2119a`, with 16 new unit tests and 7 new browser tests that each failed on
  the code before.
- The public website is unchanged: same sources; visible HTML, page data by content, structured data, fonts, HTTP
  answers and optimized images equal; the three rewritten CSS values measured to render the same; resting pixels equal
  once capture effects are told apart (both builds alike); the public E2E suite passes.

This is a recommendation, not acceptance: A5 is not Owner-approved until the Owner's independent review says so.

## 9. Whether A6 can safely begin after authorization

**Yes — once the Owner accepts A5 and authorizes A6, and not before.** Nothing A6 builds on is open: the framework is on
a patched version, the admin's session handling is settled for editors with unsaved work (A6's forms can reuse
`editorContext` and the kept-copy module if the Owner wants the same protection there), and the baselines are fresh
(unit 311, integration 425, admin 122, public 612). Before A6 starts: the Owner's answers to D-A6-1 … D-A6-7 (the
acceptance review's item 8.7), and a new rollback checkpoint `preserve/pre-admin-a6`. A6's public freeze proofs must
compare against a 16.4.1 build (this correction's final build), or normalise 16.4's encoding as item 6.2 describes.

## Remaining Low / Informational items, by milestone

Nothing below loses stored data or exposes anything; none is an A5 blocker. Milestones as the acceptance review proposed
them (its item 2.4 and 6.2), unless the Owner schedules an A5 follow-up correction instead.

| # | Item (acceptance review numbering) | Milestone |
|---|---|---|
| 2.4 #1 | Some refusals show "Needs attention" without the reason (anchor guard, newly linked reusable section, the reusable editor's section-level issues); other-language field errors hidden until that tab opens | A8 (with the editor's revision work), or an A5 follow-up |
| 2.4 #2 | Keyboard focus lost after Remove and some moves / panel switches | A8, or an A5 follow-up |
| 2.4 #3 | A "dirty" state a save can't clear (a value set back to the stored one) | A8, or an A5 follow-up |
| 2.4 #4 | "Layout saved." banner kept in the address after a later stale reload | A8, or an A5 follow-up |
| 2.4 #5 | Undo merges a structural change inside a repeater with typing in the same field | A8 (revisions) |
| 2.4 #6 | A 61st section is refused with the generic "couldn't be read" message | A5 follow-up (message only); the kept copy now also keeps the edits through the reload it suggests |
| 2.4 #7 | Info items (error shell for a thrown approved component, lost save answers, repeated announcements, dialog focus, a Duplicate past the maximum, empty frame titles, refused Composition variants) | A8, or an A5 follow-up |
| 2.4 #8 | Record grids on the Certificates page not read by the digit guard | A8 (the rendered-page check) |
| 2.4 #9 | Deadlocks between overlapping saves (one retry; availability only) | A8 / pre-production hardening (reordering, A3's relation diff) |
| 2.4 #10 | Forged in-payload changes answered `invalid` without an audit row | A8 (audit) |
| 6.2 #1 | Who chooses and orders the certificates a section shows | Owner decision, before A8's publishing |
| 6.2 #2 | A reusable section's edit needs `reusable_sections.edit` only | Owner decision, before a stricter owner can link one |
| 6.2 #4 | Pixel parity of the 29 bespoke blocks not compared | A9 (after the import), or seed test records earlier |
| 6.2 #6 | Public `/media/u/**` decoupled from `ADMIN_ENABLED` | A9 |
| 6.2 #7 | The reduced-motion pressed-button fix (`scale: none`) | waits for the Owner's go-ahead on the public CSS |

New, from this correction (Low / Info):
- **N1** A kept copy lives in its tab: another tab of the browser left on the sign-in page (not an admin page) does not
  hear a sign-out elsewhere and keeps its copy until another user signs in there or 12 hours pass; a browser without
  `BroadcastChannel` likewise. The copy is the editor's own content (no credential) and is offered only to its user.
  — A8 (or with A7's session work), if the Owner wants it closed.
- **N2** A kept copy made on an older version can only be downloaded or discarded (no merge). — A8's revisions (compare
  and merge) could offer more.
- **N3** Commit `0613fe5`'s message miscounts the `@next/swc-*` binaries (nine; there are eight). History is not
  rewritten for it.

## Items needing RAWASY's confirmation

Unchanged: RAWASY's own Google Maps place link (A6 provides the field; it stays empty until confirmed), the image rights
and flagged photos in `docs/ASSET_INVENTORY.md`, certificate numbers, QR codes and personal names (redacted unless
RAWASY approves).

## Known limitations

- The browser suites and captures ran on this container's Chrome for Testing 153 headless shell, not Playwright
  1.56.1's Chromium 141 (not installable here), through untracked wrapper configs — as in the A5 review.
- The fresh clone came from the local repository at `eb2119a` (cloned before the push); its commits are the ones pushed.
- The pixel and HTTP comparisons ran against the build of `96e9ded`; `eb2119a`'s public output equals it file for file
  (890 / 890, server bundles 175 / 175, stylesheets and scripts on 104 / 104 pages), the last commit having changed the
  admin builder only.
- The "fails before" runs of the 7 new browser tests and the behaviour probe ran on a build of `0613fe5` (the
  upgrade without the session correction).
- Segment prefetch files (`*.segment.rsc`) were compared as part of the file set only: the public site uses plain links
  without prefetch, so no public page requests them (pinned by `site.spec.ts`).
- Next 16.3.8's known image-optimizer defect (an uncached variant cut off in its first milliseconds never answers in
  that process) was not re-examined on 16.4.1; the image warm-up stays in the deployment checklist.

## How to run (local only)

As before: README, "Admin (local development)". Tests: `npm run test:unit`, `npm run test:integration`,
`npm run test:admin` (this correction's browser tests are the "A5 final correction" group in
`e2e-admin/page-builder.spec.ts`), `npm run test:e2e` after a build. Where Playwright's own Chromium is missing, point
the projects at an installed Chromium with `launchOptions.executablePath` in a local wrapper config.

## Next steps

1. The Owner's independent review of A5 with this report: the dependency patch, the session-end handling and the public
   freeze proof; the Owner decides whether A5 is accepted and closed (this report does not).
2. The Owner's decisions still open: the A6 decisions (acceptance review item 8.7), the carried A5 items (table above).
3. Only on the Owner's explicit go-ahead: A6, from a new rollback checkpoint `preserve/pre-admin-a6`, as planned in the
   acceptance review's item 8.
