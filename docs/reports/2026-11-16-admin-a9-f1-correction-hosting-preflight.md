# A9 — F-1 correction and Namecheap preflight assistance (2026-11-16)

**Brief:** "RAWASY METAL WEBSITE — A9 F-1 CORRECTION & STAGING PREFLIGHT ASSISTANCE".

**Authorized:**
1. a focused local correction of F-1;
2. read-only Namecheap verification assistance;
3. the final staging operator checklist.

**Not authorized, and not done:** staging deployment, production deployment, DNS changes, a migration on hosting, a
merge into `main`.

Nothing was deployed. No hosting account, cPanel setting, DNS record, SSL, staging or production database was touched.
`main` is unchanged, and no external message was sent. Every database used here was a disposable local MariaDB 11.4.13
(`rawasy_e2e_*`), dropped afterwards.

**Status:**

- **F-1 is corrected, locally, in database releases only.**
  - Before: a fixed page that is not live (Privacy and Terms until a legal reviewer is named, or any fixed page taken
    offline) answered Next.js's bare English 404.
  - Now it answers the website's own localized 404 — the approved page, unchanged — in English and Arabic, light and
    dark, with header, footer, a way home, "Page not found" and `noindex`.
- **The static release is byte-identical.** All 686 public page files, and the 36 stylesheets, scripts and fonts they
  name, are identical once the build id is normalised.
- **Live pages in a database release:** the same visible HTML, and 8–17 bytes of HTML and 7–15 bytes of page data more per page (two `null` rows in each page's data).
- **No frozen public asset changed, no new design.**
- **One cost, in one abnormal state only:** while the homepage itself is offline, every other page carries the 404 in
  its data (+50,596 bytes on `/en/contact`). It is back to exactly the same bytes once the homepage is published again.
  The way to avoid that state is an Owner decision (item 6, O10).
- **Regression on a fresh clone:** every suite passed in its first run (unit 435, integration 598, admin 176, database mode 12, public 612 on the static release and 601 + 11 skipped on the database release, the expected 28 on the staging configuration); the resting pixels 624 / 624 identical between the static and database releases.
- **Hosting: H1–H14 remain UNVERIFIED.** No account evidence has been received yet. The ordered read-only checklist is
  now `docs/admin/A9-STAGING-PACKAGE.md` §1A (item 5).
- **Recommendation:**
  - phase A (read-only) can start now;
  - a staging deployment still waits for the phase A evidence and the Owner's decisions;
  - production stays BLOCKED.
- **Stopping at the approval gate.**

## 1. Starting and final commit SHAs

| | |
|---|---|
| Start, verified | `0812a98`, equal to `origin/claude/new-session-5eijs6`; working tree clean; `main` `474f61f`, unchanged |
| F-1 correction | `117478b` — the boundaries, the per-request check, the database-only page extension |
| F-1 tests | `2813ccc` — the unit test and three database-mode browser tests |
| Docs | this report, the staging package's §1A and F-1 updates, the project memory: the commit after `2813ccc` (the branch head) |
| Rollback checkpoint | `preserve/pre-admin-a9` `babf932`; and the static release of any of these commits (byte-identical public pages) |

The code that changed since the A9 acceptance report's QA: `next.config.ts` (three lines in its database branch),
`src/content/live/load.ts` (one function), and two new kinds of file — `src/content/live/fixed-not-found.tsx` and
eleven `not-found.db.tsx`.

## 2. The F-1 correction and its evidence

**The defect (found by the staging preflight).** In a database-content release a fixed page that is not live called
`notFound()` through `ensureContent(page)`. Only the `(missing)` group, `services/[slug]` and `projects/[slug]` had a
not-found boundary, so Next.js answered with its own bare page:
- "404 — This page could not be found.", black on white;
- English on the Arabic address too, no `lang`;
- no header, footer or way back;
- titled "RAWASY", and blank without JavaScript.

That is what Privacy and Terms would show on staging until a legal reviewer is named, and any fixed page an Owner or
Admin takes offline.

**The correction (database releases only, the approved design reused).**
- **One boundary per fixed route.** Each of the 11 fixed routes has a not-found boundary, `not-found.db.tsx`, beside its
  page; the homepage's sits beside the root layout. Each comes from `fixedPageBoundary("<page key>")` in
  `src/content/live/fixed-not-found.tsx`.
- **It reuses the approved 404.** The boundary draws the `(missing)` group's localized 404 — the approved page, imported
  unchanged — with that page's own metadata ("Page not found", `noindex`). There is no new design and no new text.
- **It draws only while the page is not live.** It decides on `isLiveForRequest(page)` (new in `src/content/live/load.ts`):
  the request's own content read, the same one the page decides on, so the two never disagree. While the page is live,
  the boundary draws nothing.
- **Nothing leaks.** The 404 is drawn from the published content only (header, footer, interface text), never from a
  working copy. A database outage fails it closed with the rest of the page (500). A 404 is never kept by the page cache
  (it stores 200 answers only), so a page published again answers on the next request.
- **The static build never sees the files.** `.db.tsx` is a page extension only in a database build (`pageExtensions` in
  `next.config.ts`'s database branch). Next.js reads a convention file's extension from its first dot
  (`getConventionFileBaseName`). With the default extensions, `not-found.db.tsx` is therefore not a not-found file at all,
  and the static build is untouched.

**Why not a plain `not-found.tsx` beside each page.** The `(missing)` group's own comment and TM-2.4 measured the cost:
Next.js renders a segment's boundary into the page data of every page under it, about 50 KB raw. That would have changed
the frozen public pages of both releases.

**Evidence:**

*Static release.* Two clean builds compared file by file: the commit before (`0812a98`) and the correction.
- **Public pages:** all 686 public page files are byte-identical once the build id is normalised (`server/app/en/**`,
  `server/app/ar/**`, `_not-found`): HTML, page data and segments.
- **The files they name:** the 36 stylesheets, scripts and fonts are identical.
- **Absent from the build:** no file of the build contains the correction's code.
- **What else differs:** a build in another folder starts with an empty `.next/cache`, which holds the per-build Server Actions key, so the
  admin and server chunks that carry action ids differ (the fresh clone: 405 files). Built with the earlier build's cache,
  the correction's static build is byte-identical to the build before in **2,929 of 2,931 files**, admin and server chunks
  included. The other two are `trace` and `trace-build`, the build's own timing logs. For comparison, two builds of the
  commit before in one folder differ in their `required-server-files` only.

*Database release, before vs after on one database* (imported without a legal reviewer: the proposed staging
configuration). Visible HTML of the 98 sitemap pages and the 6 error addresses: identical, 104 of 104. Bytes: every live page grows by 8–17 bytes of HTML and 7–15 bytes of page data (the boundaries' two `null` rows; 1,632 and 1,438 bytes over all 98 pages), the statuses are identical.

*What a visitor gets at the legal addresses.* Browser probe, before vs after:

| `/en/privacy`, `/ar/privacy`, `/en/terms`, `/ar/terms` | Before (`0812a98`) | After |
|---|---|---|
| Status | 404 | 404 |
| With JavaScript | Next.js's "This page could not be found.", no `lang`, no header or footer | the localized 404: `lang` `en` / `ar-SA`, `dir` ltr / rtl, the theme chosen (light and dark), header, footer, a link home, "Outside the blueprint" / «خارج المخطط» |
| Title | "RAWASY" | "Page not found \| RAWASY" / «الصفحة غير موجودة \| رواسي» |
| `robots` | `noindex` | `noindex` |
| Without JavaScript | blank | blank, as every 404 of this design (the known TM-2.1 limit), now with the right title |

The probe ran on the fresh clone's builds: EN and AR, light and dark, with and without JavaScript, 24 views a side. The
unknown address `/en/not-a-page` is the same localized 404 before and after.

*Regression tests (each fails on the code before).*
- **`tests/unit/fixed-not-found.test.ts`** (4 tests; 0 / 4 pass on `0812a98`):
  - the configuration Next.js loads for each kind of release (only a database build reads `.db.tsx`);
  - Next's own reading of the file name;
  - every fixed page's boundary and its page key;
  - nothing else using the extension.
- **`e2e-dbmode/publish-flow.spec.ts`** (3 new tests, through the admin's real screens). About, the homepage and the
  privacy policy (taken offline by the Owner, who alone holds `legal.publish`) answer the localized 404 in English
  (light) and Arabic (dark) with:
  - `lang`, `dir`, the title, `noindex`, the header and footer, a way home;
  - nothing of the offline page.

  Live pages carry no 404; the sitemap drops the offline page; published again, each returns 200. On the build before,
  the first of them fails (Next's bare page has no `main`) and the serial suite stops there.

**The one cost: the homepage offline.**
- While the homepage itself is offline, its boundary sits beside the root layout and so draws the 404 into every other
  page's data: `/en/contact` measured 157,325 bytes with the homepage live and 207,921 with it offline.
- Published again, it is back to exactly 157,325 bytes.
- The homepage can only be offline if an Owner or Admin unpublishes it.
- Avoiding even that state is decision O10 below.

**Should essential fixed pages be protected from accidental unpublication?** (assessed, not implemented).

*Today:*
- Unpublishing a fixed page needs `pages.publish` (Owner, Admin); a legal page needs `legal.publish` (the Owner, with a
  step-up within 10 minutes).
- Every unpublication goes through a confirmation dialog and is audited.
- Fixed pages can never be archived (A3). The composition guard (A9) protects the records the components need, the
  settings, the menus and the form — not the pages.
- Since this correction, a page taken offline shows the website's own 404 and leaves the sitemap; the header and footer
  links to it then lead to that 404.

*Assessment and recommendation (O10, the Owner's decision):*
- **Legal pages: no protection.** They must stay withdrawable, and they start unpublished.
- **Homepage: refuse unpublication in a database release** ("publish a corrected version instead", as the composition
  guard already says for the settings and menus).
  - This bypasses no lawful withdrawal: any homepage content can be withdrawn by publishing a corrected version, live
    on the next request.
  - It also removes the one costly state above.
- **The pages the header links and every quote button reaches** (About, Services, Capabilities, Projects, Industries,
  Clients, Contact): **keep them withdrawable**. Make the unpublish dialog name the consequence (the header's link, or
  every "Get a Quote" button for Contact, leads to the 404 while it is offline). Optionally make unpublishing one an
  Owner-only step with a step-up.
- **Why none is implemented here.** The A9 Owner default is binding: "unpublishing per the permission registry". Changing
  who may unpublish, or refusing it, is the Owner's decision.

## 3. Regression test results

Run on a fresh clone of `2813ccc` (cloned from the local repository, then pushed unchanged), every suite in its first
run, Node.js 22.22.2, local MariaDB 11.4.13:

| Check | Result |
|---|---|
| `npm ci`; Next's native compiler for this platform present | pass |
| `npm audit --omit=dev` | **0** vulnerabilities |
| `npm audit` (with dev tools) | 12 moderate, dev-only (the accepted lint and `drizzle-kit` chains; unchanged) |
| Lint · typecheck · `db:check` | pass · pass · pass (13 files) |
| Unit | **435 / 435** (431 before + the 4 F-1 tests) |
| Integration | **598 / 598** |
| Static build · database build | pass, no warning · pass, no warning |
| Release baseline check | pass |
| Packaging (static, database) | both PASS (13 held back; every public file and sitemap page present) |
| Static build vs the commit before | public pages 686 / 686 and the 36 files they name identical; the whole build 2,929 / 2,931 identical with the same Server Actions key (the other two the build's timing traces) |
| Fresh content import (legal reviewer named), then a repeat | 113 created, 113 published; the repeat reads "unchanged" on all 113 |
| Static vs database (legal pages published) | visible HTML 105 identical, 3 different — A9's three 404 addresses; HTTP 224 answers: `Cache-Control` as designed (210), 5 bodies (Next's own 404s, byte-for-byte A9's); no route-cache file in the database build |
| Database-mode suite (`test:dbmode`) | **12 / 12** (9 before + the 3 F-1 tests) |
| Admin suite (`test:admin`) | **176 / 176** (29.6 min) |
| Public suite, static release (after the image warm-up) | **612 / 612** |
| Public suite, database release, legal pages published | **601 passed + 11 skipped** (the fallback-404 checks, which skip against an outside server; **11 / 11** from the build's folder); no route-cache file after it |
| Staging configuration: import without a legal reviewer | 113 created, 111 published (`privacy`, `terms` kept as working copies) |
| Staging configuration: database release before vs after F-1, one database | visible HTML 104 / 104 identical (98 sitemap pages, 6 error addresses); statuses identical; +8–17 bytes HTML and +7–15 bytes page data per live page |
| Staging configuration: browser probe, 24 views a side | before: Next's bare page at the four legal addresses; after: the localized 404 (see item 2) |
| Staging configuration: public suite | 573 passed, 11 skipped, **28 failed — exactly the expected list** (the package's §10.2); none outside it; one fewer than before F-1 |
| Resting pixels, static vs database (624 cells: 104 addresses × 3 widths × 2 themes) | **624 / 624 identical**, every one on its first capture (reduced motion, every image decoded, whole pages) |
| Outage drill on the final database release | database stopped: every address 500 within milliseconds (the homepage, About, Privacy, an unknown address), never a stale page, the static release 200 meanwhile; started: the homepage back after 31 s, a page rendered afresh after 60 s; restarted while serving: back after 34 s; logs name error codes only (as in A9; pass ≤ 65 s) |
| Before the regression, in the working tree | the static build of the change and of `0812a98` compared file by file (identical public output); the database release before and after on one database (104 / 104 visible HTML identical); the unit test 0 / 4 and the first database-mode F-1 test failing on the code before |

## 4. Public visual parity

Resting pixels, the static release against the database release of the fresh clone (legal pages published):
- **What was captured:** every sitemap page and both 404s, at 1440, 834 and 390 px, in light and dark — **624 / 624 cells
  identical**, every one on its first capture.
- **How:** with reduced motion, every image eager and decoded, and each page walked to its end and back, then captured
  whole (in 4,000 px slices on phones).

With the visible HTML (105 addresses identical, the 3 known 404 placements apart) and the HTTP answers (as designed), the
database release still draws exactly the approved static website.

The static release itself is unchanged by this correction: 686 / 686 public page files, and the files they load, are
byte-identical (item 2). So no public pixel can have moved.

The new behaviour is visible only where a fixed page is not live. There it is the approved localized 404, captured in the
browser probe (item 2) in EN / AR × light / dark.

## 5. H1–H14 checklist for the RAWASY account

**Status now:** 0 PASS · 0 FAIL · 14 UNVERIFIED. No account evidence has been received in this session.

The procedure is in the existing package, not a new checklist: `docs/admin/A9-STAGING-PACKAGE.md` §1A (phase A, read
only, the order A1–A14), then §1 (phase B, the steps marked *writes*, after the staging authorization).

**What to send:**
- one screenshot per panel step;
- the Terminal output (A4) and the phpMyAdmin row (A5), pasted as text.

**What never to send:** a password, 2FA code, API token, private key, `~/.my.cnf` or database dump.

**Never click:** Create, Save, Run AutoSSL, Generate or Download a backup, or Manage SSH keys.

| Check | Phase A step (read only) | What decides it in phase A | Still needs phase B | Status |
|---|---|---|---|---|
| H1 Node.js 22, Passenger | A1, A4 (`/opt/alt/alt-nodejs22`, the selector listing), A6 | a Node.js 22 of 22.18 or later installed | creating the app; `require('next')` after Run NPM Install | UNVERIFIED |
| H2 glibc for sharp | A4 (`ldd`, Node's own glibc) | glibc 2.28 or later | `require('sharp')` after Run NPM Install | UNVERIFIED |
| H3 Terminal, SSH, forwarding | A4 (Terminal opens), A11 | SSH offered, its port | adding a key; `ssh … 'echo ok'`; the tunnel | UNVERIFIED |
| H4 MariaDB | A1, A5 | version 10.11 or later; charset, `sql_mode`, timeouts recorded | the staging database and user; their grants; `db-migrate.mjs status` | UNVERIFIED |
| H5 Connection budget | A5 (`max_user_connections`) | `U` recorded: 11 or more for two processes (else `DB_POOL_LIMIT=1`) | the peak during §11 | UNVERIFIED |
| H6 Processes | A2, A4 (`ps`), A6 | limits recorded | process count and lifetime under the app | UNVERIFIED |
| H7 Memory, CPU, entry processes | A2 | memory (2 GB?), entry processes (30?), CPU recorded; no current faults | RSS under load (≤ 75 %) | UNVERIFIED |
| H8 Response times | — | — | measured on staging (§11.2) | UNVERIFIED |
| H9 Data folder, quota, inodes | A3, A4 (`df`, `quota`) | 5 GB and 60,000 inodes free | creating `~/rawasy-data-staging` (0700) | UNVERIFIED |
| H10 ModSecurity, uploads | A7 | ModSecurity state recorded | the 15 MB test upload in the staging admin | UNVERIFIED |
| H11 Cron | A8 | the page opens, nothing created | — | UNVERIFIED (passes in phase A) |
| H12 Backups, keys | A9 | the account's backups recorded | the Owner's key pair; one encrypted staging backup verified | UNVERIFIED |
| H13 Staging DNS | A12, A13, A14 | today's records captured; where DNS is managed; `staging.` unused | the Owner's DNS authorization; the subdomain | UNVERIFIED |
| H14 HTTPS, access, proxy | A1, A10 | AutoSSL available; LiteSpeed named | AutoSSL for the subdomain; `.htaccess` allowlist and `X-Robots-Tag`; `TRUSTED_PROXY_HOPS` from the audit log | UNVERIFIED |

When the evidence arrives, each row is read against its rule and the record sheet (§14) is filled. Nothing is marked
PASS on a platform page's word.

## 6. Remaining Owner actions

1. **D1 — authorize phase A** (read only), and name who will hold the cPanel login; then send the A1–A14 evidence.
2. **D2 — the staging host:** `staging.rawasymetal.com` or another name, and later the DNS record (a DNS change).
3. **D3 — the staging defaults** of the package's §0.1:
   - admin on behind the allowlist;
   - Privacy and Terms unpublished — they now show the localized 404;
   - no enquiries, SMTP or notifications;
   - no production data;
   - not indexed.
4. **D4 — the legal pages on staging:** keep them unpublished (recommended) or name a staging-only reviewer label.
5. **D5 — the access control:** the public addresses to allow, or basic authentication.
6. **D6 — keys:** staging's `AUTH_ENCRYPTION_KEY` and the backup key pair, made and kept offline by the Owner.
7. **D7 — the disruptive tests on staging:** the outage minute, the 20 + 20 requests, the public suite.
8. **D8 — written authorization of the staging deployment**, after phase A passes.
9. **O10 (updated by this correction) — protecting fixed pages:** refuse unpublishing the homepage in a database release
   (recommended), and name the consequence in the unpublish dialog for the pages the header links. Legal pages stay
   withdrawable.
10. **Production decisions O3–O9** of the acceptance report stay open (not needed for staging), and so do RAWASY's
    confirmations in `docs/ASSET_INVENTORY.md`.

## 7. Staging GO / NO-GO recommendation

| | Recommendation |
|---|---|
| Code for a staging rehearsal | **GO** — F-1 corrected; every regression suite passed on a fresh clone; the static release is unchanged |
| Phase A (read only, on the account) | **GO now** — it changes nothing (D1) |
| Staging deployment | **NO-GO until** phase A's evidence shows no FAIL and D2–D8 are given in writing |
| Production | **BLOCKED** — the acceptance report's blockers, the legal review, the media rights, O3–O10 |

**Stopping here, at the approval gate.**

## QA actually run

- **Everything in item 3**, run on a fresh clone of `2813ccc` (cloned from the local repository, then pushed unchanged),
  with Node.js 22.22.2 and the local MariaDB 11.4.13.
- **The negative controls** listed in item 2.
- **Two interruptions, both reported:**
  - The container had restarted before this work: Docker was down, and the default Node.js was 22.22.0. Docker and the
    database were restarted, and the session's Node.js 22.22.2 was used for everything.
  - The regression's runner was stopped at its 2-hour background limit during the pixel comparison, after 392 of 624
    cells (all identical). The script resumed from its own progress file on the same servers and database, and the
    outage drill followed.
- **Clean-up:** every disposable database was dropped (the regression's seven, the experiment's two and the database-mode runs' own), and no server was left running.
- **Nothing ran against Namecheap.**

## Items needing RAWASY's confirmation

- The phase A evidence (A1–A14).
- The staging host name.
- O10.
- The legal reviewer (production).
- The items of `docs/ASSET_INVENTORY.md`.

## Known limitations

- **H1–H14 are unverified.** This session has no account access, and Namecheap's pages are blocked here.
- **Without JavaScript the localized 404's body is blank.** This is the same for every 404 of this design (TM-2.1); the
  title and status are right.
- **The homepage-offline cost** (above) until O10 is decided.
- **The parity tools are still session scratch tools**, not committed (offered before; still offered).

## How to run

- **Unit:** `npm run test:unit`.
- **Database mode** (includes the F-1 tests):
  `CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build && npm run test:dbmode`.
- **The legal pages unpublished, locally:** a database build, then the CLIs of `e2e-dbmode/server.mjs` with no
  `--legal-reviewer`, then `node server.js` with `DB_NAME`; open `/en/privacy` and `/ar/privacy`.

## Next steps

1. The Owner reads this report and the package's §1A.
2. The Owner gives D1 and sends the A1–A14 evidence.
3. The engineer reads the evidence and returns the filled H1–H14 table.
4. With no FAIL and D2–D8 given, the staging rehearsal (phase B) may be authorized in writing.

