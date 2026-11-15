# A9 — Final acceptance review and staging readiness (2026-11-15)

**Brief:** "RAWASY METAL WEBSITE — A9 FINAL ACCEPTANCE REVIEW & STAGING READINESS". Production deployment and the
live cutover were not authorized, and nothing was deployed. No hosting account, staging or production database, DNS,
SMTP or `main` was touched. Every database here was a disposable local MariaDB 11.4.13 (`rawasy_e2e_*` / `rawasy_t_*`).

**Status:**

- **A9 is ready for a staging rehearsal**, on the conditions in items 9 and 10.
- **It is not ready for production.**
- This is a recommendation, not an approval: A9 is not self-approved.

**What changed in this review:**

- Two independent passes found **no High defect**:
  - my own verification of the brief's ten areas;
  - an independent, read-only code review by a separate agent.
- They found **two Medium defects (M-1, M-2) and three Low ones (L-1, L-2, L-3)**, plus two defects of my own finding:
  - the admin's texts about the public website were false in a database release;
  - a certificate without a preview took its page offline.
- All of them are corrected, each with a test that fails on the code before.
- The staging execution package is written for operator review.
- The full regression passed on a fresh clone from GitHub; item 3.3 has every failure, retry and skip.

**Regression on a fresh clone of `0de9452` from GitHub, every suite in its first run:**

| Check | Result |
|---|---|
| Production audit | 0 |
| Unit | **431 / 431** |
| Integration | **598 / 598** |
| Admin | **176 / 176** |
| Database-mode publishing E2E | **9 / 9** |
| Public, static release | **612 / 612** |
| Public, database release | **601 passed + 11 skipped**; the 11 pass **11 / 11** from the build's folder |
| Pixels | **624 / 624** identical, static against database |
| Static release against `d72413a`'s | **601 / 601** prerendered public files identical |

## 1. Starting and final SHAs

| | |
|---|---|
| Branch | `claude/new-session-5eijs6` (the only branch pushed to; no force-push, `main` unchanged) |
| Starting HEAD (verified) | `94662c9` (docs, on `d72413a`, the last A9 code commit); checkpoint `preserve/pre-admin-a9` at `babf932` |
| Final code commit | `4601919` |
| Final commit | the docs commit that adds this report and the project memory, on top of `038906d` (its SHA: `git log -1` on the branch) |
| Regression | a fresh clone of `0de9452` from GitHub (`4601919` + the staging package; the commits after it are docs only) |

**Commits of this review** (each typechecks and lints on its own; `npm run typecheck` per commit, 9 / 9):

| Commit | What |
|---|---|
| `cec9404` | The admin tells the truth about the public website in a database release (finding A-1) |
| `4ea9744` | Tests: the publishing path end to end on a database release (`npm run test:dbmode`); the admin's texts |
| `fc31364` | The content loader names its own queue overflow in its log ("local queue"; investigation 1) |
| `a77582c` | The media library's database-release text names every page that needs a photo (investigation 2) |
| `da06ba5` | **M-1:** a version a fixed place can't draw is refused at publication; a certificate without a preview is left out (A-2) |
| `2398bc2` | **M-2:** a database archive can leave out the release files the library no longer delivers |
| `2c4cb3c` | **L-1, L-3:** one failed shared load counts once; redirects follow only to what a live page answers; the tests of M-1, M-2, L-3 |
| `4601919` | **L-2:** the page cache keeps a bounded number of pending render stamps |
| `0de9452` | Docs: the staging execution package (`docs/admin/A9-STAGING-PACKAGE.md`); the runbook's limits |
| `038906d` | Docs: the staging package's publishing path checks the M-1 refusal |
| (final) | Docs: this report, the outage pass rule (65 s), the project memory |

## 2. Independent A9 acceptance findings

### 2.1 The ten areas of the brief (§2), verified

| Area | How it was verified | Verdict |
|---|---|---|
| Importer and idempotency | Fresh import through the real CLIs on the fresh clone (113 aggregates created and published; the repeat: 113 unchanged, nothing published, no revision); the integration suite's import tests (all or nothing, edits kept, nothing republished that was taken offline) | holds |
| EN / AR reconciliation | The import's reconciliation (both languages carried and marked complete for every aggregate); the read model rebuilt from the published documents equals today's content except the listed, intended differences (`migration-import.test.ts`); the database release's visible HTML equals the static release's in both languages (item 5) | holds |
| Media and restricted assets | The 13 held-back files: no `public_media` row, refused import while any is delivered, never in an archive (packaging check), 404 on a packaged release. A withdrawal reaches every page at the next request. **Found M-2:** a withdrawn *release* photo stayed at its own address and in every later archive (corrected; item 3) | holds, after M-2 |
| A8 publication and revisions | The end-to-end test (item 4): save, submit, review, publish, roll back, unpublish, publish, each a revision and an audit event; the generation moves only on publication | holds |
| Database-mode rendering | The public suite against the database release; HTML, HTTP and pixel parity with the static release (item 5); the marker drill of A9 (every text from a published document) unchanged | holds |
| Cache generation | The E2E test reads the generation: unchanged by save and submit, moved by publish, rollback and unpublish. The reviewer traced every writer of public inputs (publish, rollback, offline, `public_media`, redirects) to a generation bump in the same transaction | holds |
| Fail-closed | The outage drill on the final build (item 2.3, investigation 3): 500 during the outage, never an old page; recovery in 29 s (cached) and 60 s (a fresh render), within the 65 s pass rule. A build whose page cache is not ours serves nothing (A9 drill, unchanged) | holds |
| Redirects | Pages win, one lookup, the target must be live. **Found L-3:** "live" counted an unpublished fixed page and a record the read model leaves out (corrected) | holds, after L-3 |
| Static rollback | The static build of the final code against `d72413a`'s: 601 / 601 prerendered public files identical, 98 / 98 static files; the public suite 612 / 612 on it; `CONTENT_SOURCE` unset or blank serves static content; a mismatch refuses to start (A9 drill) | holds |
| Permissions, security, audit | The E2E test's audit log check (each step with its actor; the refused unpublish recorded as failed); the composition guard refuses and audits; the reviewer found no permission path that bypasses a check | holds |

**L4 and L6, rechecked** (the brief: "Also recheck L4 and L6"):

**L4 — a render that overlaps a publication.**
- The reviewer traced Next.js 16.4.1's response-cache batcher (`response-cache/index.js`, `getBatcher`). Requests that
  arrive while one render of the same page is in flight share that render's result, and make no cache lookup of their
  own.
- So one response may show the content as it was when that render started.
- The delay is bounded by one render: milliseconds normally, tens of seconds at worst with a slow database.
- The shared result is stamped with the generation read before the render, so it is never served again after the
  publication.
- **Accepted:** documented (runbook §8). The only cost is that an editor who checks a page right after publishing is
  not guaranteed to see the new version on that first request.

**L6 — the release importer records invalidations per item.**
- `media-import-release` runs in a plain transaction, so each approved item records its own invalidation (about 108 on
  the first run).
- Correctness holds: everything commits atomically with the `public_media` rows, and public reads never wait on it.
- The cost: publications wait for the run's few seconds, and a `--refresh` overlapping an A4 change can deadlock once.
  InnoDB ends one side and `inTransaction` retries it.
- **Accepted:** it is a by-hand command, normally run once before the cutover. Collecting the tags and recording them
  once is the offered hardening.

### 2.2 The independent code review (`babf932..d72413a`, read only) and its disposition

| Finding | Severity | Verified | Disposition |
|---|---|---|---|
| **M-1** The composition guard stopped fixed records going offline, but an ordinary edit plus publication could still leave one undrawable: Laser Cutting without its cover → the homepage 500 in both languages; the collage's lantern without its photos → Projects 500; a strip industry without its photo → Industries 500 | Medium | Yes: the integration test fails on the code before (Laser Cutting's publication went through) | **Corrected** (`da06ba5`) |
| **M-2** A withdrawn release photo (restricted, archived, trashed, replaced) leaves every page but stays at `/media/<group>/<file>` and in the optimizer, and every later archive ships it (A1-MEDIA-STORAGE §12: neither the T7 relocation nor its documented alternative was done) | Medium | Yes: drill `r4.sh` on a database build — after the withdrawal `/en/clients` no longer named the logo, while its file and optimized copy still answered 200 | **Corrected** (`2398bc2`): the list and the packaging option, the emergency step, the admin's text |
| **L-1** Requests waiting on one shared snapshot load each counted its failure: one timed-out load with ≥ 5 waiting opened the 60 s breaker | Low | Yes, by reading `load.ts` | **Corrected** (`2c4cb3c`, `src/server/public/breaker.ts`) |
| **L-2** The page cache's pending render stamps had no bound (a render that fails never stores: about 170 bytes per distinct address for the process's life) | Low | Yes: unit test fails on the code before | **Corrected** (`4601919`: newest 1,600 kept) |
| **L-3** A redirect counted a fixed page as live while it was unpublished, and a published record the read model leaves out as live: both led to a 404 | Low | Yes: both integration tests fail with the old live-address semantics | **Corrected** (`2c4cb3c`, `liveAddressesOf`) |
| Visitor addresses decoded twice, so a stored source with `%25` / `%2F` never matches | Info | By reading | Documented: a missed redirect, harmless |
| `/media/u` is `public, max-age=31536000, immutable`: a shared cache in front could keep a withdrawn upload | Info | By reading | Documented: H14 checks what LiteSpeed caches; same reasoning as A9's L1 for pages |
| `decodeForm` writes to paths built from keys in the published document | Info | By reading: the A7 schema is strict, not reachable through the admin | Documented (hardening against direct database writes) |
| A refusal partway through a nested publish undoes nothing in an already-open transaction | Info | By reading: the import aborts on any refusal, so safe today | Documented (a hazard for a future caller) |
| The import's summary audit event swallows its own write errors | Info | By reading | Documented (the per-change events are inside the transaction) |
| Static `confirm-authorship` / `render` flags are carried as photo restrictions only | Info | By reading | Documented (a new photo added to such a project joins the portfolio): an Owner rule |
| A blur placeholder regenerated by maintenance doesn't move the generation | Info | By reading | Documented: cosmetic |
| The admin preview loads public content before it checks the session: an anonymous request triggers a content load, and a database outage gives 500 instead of the sign-in page | Info | By reading | Documented: no data is exposed (public content) |

**The reviewer also confirmed:**
- the importer is idempotent, all or nothing, and never overwrites an edit;
- the read model reads only the four public tables;
- the projection strips the admin-only fields;
- generation consistency, fail-closed behaviour and content-source detection hold, including the blank and mismatch
  cases (probed with the real modules);
- the static rollback behaves as before.

**My own findings** (before the independent review):
- **A-1** (`cec9404`): in a database release the admin still said what a static release does. It said "Unchanged: the
  public pages keep reading today's approved content until the content cutover (A9)", the publish dialog said "The
  public website keeps showing today's approved pages", and twelve other texts said the same. A publication, a rollback
  or an unpublication changed the public pages at the next request. A Reviewer could publish believing nothing public
  changes.
  - All 14 texts now come from one module, `src/server/admin/public-effect.ts`. It holds two sets, picked by the
    build's content source; the static set is the old text, word for word.
  - A unit test fails on any such claim written elsewhere in the admin.
- **A-2** (in `da06ba5`): a certificate without a redacted preview was kept by the read model. Its card read the first
  preview, so withdrawing `certificates/vat-registration` or `…/commercial-activity-licence` took the Certificates page
  offline (500) in both languages. It is now left out, like a certificate without its thumbnail.

### 2.3 The five behaviours investigated (brief §3)

All measured on database builds with copies of an imported local database.

**1. HTTP 500 under many uncached requests.**

Measured on one process with the A9 pool (2 connections, 50 waiting):

| Burst | Answers |
|---|---|
| unknown addresses × 30 | all 404 |
| unknown addresses × 52 | all 404 |
| unknown addresses × 60 | 8 × 500 |
| unknown addresses × 100 | 48 × 500 |
| unknown addresses × 200 | 148 × 500 |
| cached `/en` × 30 / 100 / 200 / 400 | all 200 |
| 10 unknown + 20 cached | all as expected |

- The homepage answered 200 right after every burst. Nothing stale is ever served.
- The 500s are the pool shedding what it cannot queue. The breaker ignores them (A9 review M1).
- The log said "database read failed (Error)", which reads like a database outage; it now says "local queue".
- The platform's 30 entry processes cap concurrency below the 52 one process takes.
- **Not a blocker:** a documented limitation, measured on staging (§11.3).

**2. A whole page 500 when a fixed-position photo is withdrawn.**

Every one of the 108 delivered items was withdrawn in turn, with the generation moved and the 102 sitemap pages
probed:

- **On the code before: 17 items took a page offline** (the list is in item 8, decision O3).
- **On the final build: 15 items** (the 102 pages before and after: 0 problems):
  - `site/laser-sparks`, `projects/clock-tower-1` → the homepage 500 (and Laser Cutting 404);
  - four strip photos → Industries 500;
  - `projects/suspended-lantern-1` → Projects 500;
  - seven service photos → that service 404;
  - `site/steel-beams-hall` → both Industries 500 and Steel Structures 404.
  - The server logs name only `TypeError … (reading 'slug' / 'gallery')`, the components' fixed lookups; the
    certificate's `(reading 'height')` is gone.
- The certificate previews no longer take their page offline (A-2).
- What remains is the approved composition's own photos:
  - the homepage's Laser Cutting photos;
  - the Projects collage;
  - the Industries strip.
- It fails closed: nothing stale or half-drawn is shown.
- A4 refuses no safety-increasing change, by design, so the withdrawal itself is allowed.
- Publication can no longer *cause* it (M-1).
- Withdrawing a photo used by a service page without a fixed place leaves that service out: its page 404s and every list
  drops it.
- The admin says this, in a database release, on the media library page.
- **Not a staging blocker. For production, an Owner decision** (item 8, O3).

**3. Database outage and recovery.** On the final build, with the database stopped:

- every page 500 in 5–30 ms (an unknown address too);
- `/media/u` 503;
- release files and the static release 200;
- after the database started, cached pages back in 29 s (the page cache's 30 s breaker) and a fresh render in 60 s
  (the content loader's 60 s breaker; the staging pass rule is now 65 s);
- a database restart while serving: 3 s;
- the logs name codes only (`ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST`) and the two fixed messages.

Earlier, with the database stopped:

- every page 500 in about 20 ms;
- `/media/u` 503;
- release files and the static release 200;
- after the database started, cached pages back in 29 s and fresh renders in 59 s;
- a database restart while serving: 2 s;
- logs name codes only (`ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST`).

With the database paused (stalled): 500 within 5 s, recovery 31 s. **Holds.**

**4. The homepage showcase's hydration race.**
- **Mechanism (read only; the component is frozen):** `MachineShowcase.tsx` attaches its `choose` handler only once
  hydrated (`ready` via `useSyncExternalStore`). A pick clicked before that follows its `#m-<slug>` link without
  `preventDefault`, so the active machine stays the first. The clicked panel's title link keeps `tabIndex=-1`, and the
  test's next click on it times out. Nothing is lost for a visitor: the click still jumps to the machine's card, and a
  second click chooses it.
- **Measured on the final builds (the 12 tests × 10 at 8 workers, twice each):**
  - static release: 1 / 120 and 0 / 120, so **1 / 240**;
  - database release: 1 / 120 and 1 / 120, so **2 / 240**;
  - earlier rounds: 4 / 240 and 2 / 240.
  - Every failure had the same signature: the clicked machine's title link stayed `tabindex="-1"`.
  - It is the same race at the same rate on both releases, so it is not an A9 regression.
- **Not a blocker.** The same on both releases and on every build since A2. Its fix is a public component change, the
  Owner's call (item 8, O8).

**5. The 404's metadata placement.**
- Next.js 16 streams metadata for browsers and for Googlebot (6 / 6 streamed into the body), and blocks it into
  `<head>` for HTML-limited bots: facebookexternalhit, Twitterbot, bingbot and Slackbot (0 / 6 streamed).
- Status 404 and `noindex` either way.
- This is documented framework behaviour (`htmlLimitedBots`), the same on both releases.
- **Not a blocker; no change.**

## 3. Corrections and regression evidence

### 3.1 The corrections, each with a test that fails on the code before

| Correction | Test | Negative control |
|---|---|---|
| A-1 the admin's texts | `tests/unit/public-effect.test.ts` (4): both sets have the same keys; the database set makes no "cutover / today's / public read model" claim; no admin file writes such a claim outside the module | the drift test fails on `94662c9` (the old claims on the admin's screens); `e2e-dbmode` test 2 failed on the old database build |
| M-1 refusal at publication; A-2 certificate left out | `migration-import.test.ts`: "a record in a fixed place can't be published…" (Laser Cutting without its cover, the lantern without photos, construction without its photo); "any other record … with a warning"; "a certificate without a redacted preview is left out" | all three fail with `decode.ts` and `validate.ts` from before the correction (`a77582c`) put back: the publications went through, the certificate was kept |
| M-2 the release-file list | "the release files the library does not deliver are listed…" (every release file but the delivered ones, a photo restricted after the import, the 13) | — (new function); the drill `r4.sh` shows the behaviour before and after |
| L-1 one failure per shared load | `tests/unit/public-breaker.test.ts` (4) | — (new module; the old loader counted each waiting request) |
| L-2 bounded stamps | `public-cache.test.ts` "the stamps of renders that never store are bounded…" | fails on the old `cache-handler.cjs` (1 of 18) |
| L-3 live addresses | "a redirect to a fixed page's address follows only while that page is published"; the scaffolding case in the M-1 warning test | both fail with the old live-address semantics put back |

**M-1 behaviour:**
- One definition of what the approved components can draw, `src/server/public/drawable.ts`, read by the read model
  (`decode.ts`) and by publication (`validate.ts`).
- A version of a record in a fixed place that its place can't draw is **refused** (`composition.drawable`):
  - the homepage's two laser services;
  - the Projects collage's three projects;
  - the Industries strip's five sectors.
- Any other undrawable version gets a **warning**, and the read model leaves it out.

**M-2 behaviour:**
- `npm run media:maintenance -- --release-withheld=<file>` writes the release files the library does not deliver now.
- `scripts/package-namecheap.mjs --withhold=<file>` leaves them out of a database archive and checks it, as for the 13.
- The staging package §4 says when to use it.
- The emergency step between releases (§10.1): delete the file and the image cache, then restart.
- **Drilled locally:**
  - after the withdrawal, the file and its optimized copy answered 200;
  - the list named it, among 36 (22 pending, 13 held back, 1 withdrawn);
  - the archive left it out and its check passed;
  - after the emergency step, the file and its optimized copy answered 404, the page 200, the other logos 200.

### 3.2 Regression on a fresh clone (from GitHub, `0de9452`; disposable local databases)

| Check | Baseline (brief) | Result |
|---|---|---|
| `npm ci`, Node | — | passed; Node v22.22.2; `@next/swc-linux-x64-gnu` present |
| `npm audit --omit=dev` | 0 | **0** (all: 12 moderate, dev-only, unchanged) |
| lint · typecheck · `db:check` | — | passed · passed · 13 migration files, seeds match the registries; both builds without a warning |
| Release baseline check · packaging (static, database) | — | passed · static PASS (13 held back, 3,612 files, 102 sitemap pages with their 111 public files) · database PASS (13 held back, 2,860 files, the page cache handler in) · database with the `--withhold` list PASS (35 held back) · static with a list naming a file its pages use: refused, archive deleted (as designed) |
| Unit | 422 / 422 | **431 / 431** (+4 breaker, +1 page cache, +4 the admin's texts) |
| Integration | 593 / 593 | **598 / 598** (+5: M-1, A-2, M-2, L-3), none skipped |
| Admin | 176 / 176 | **176 / 176**, first run, no retry |
| Database-mode publishing E2E (new) | — | **9 / 9** (34.3 s) |
| Public, static release | 612 / 612 | **612 / 612**, first run (after the image warm-up: 1,484 / 1,484) |
| Public, database release | 601 + 11 separately | **601 passed + 11 skipped**; the 11 fallback-404 checks **11 / 11** from the build's folder (warm-up 1,484 / 1,484; no route-cache file written) |
| Fresh content import through the CLIs | — | 13 migrations applied; release media 143 registered, again 143 unchanged; dry run 113 created and rolled back; import 113 created, 113 published; **repeat 113 unchanged, 0 published** |

### 3.3 Every failure, retry and skip

**In the fresh-clone regression:**
- **No suite failed, and no test was retried** (the configs set no retries).
- **Skipped:** the 11 fallback-404 checks in the database release's public run, by design (they read the build's
  output and skip against an outside server). They ran separately from the build's folder: 11 / 11.
- **The race measurement:** 3 failures in 480 targeted runs (static 1 / 240, database 2 / 240). All three are the
  known hydration race (item 2.3, 4). In the suites' own single runs, those 12 tests passed on both releases.
- **Intended refusals:**
  - the static archive packed with a list that names a file its pages use: refused, exit 1, archive deleted;
  - `media:maintenance` exit 2 in drill `r4.sh`: the drill withdrew a photo by SQL, so `public_media` disagreed with the
    deliverability rule.

**During the work (each fixed before the final commit, none in product code):**
- **The per-commit check, first attempt:** bare `tsc --noEmit` failed on all 9 commits in a fresh worktree (Next's
  route types were not generated). With the project's `npm run typecheck`: 9 / 9 passed.
- **The E2E spec's first run (`dbmode-1`):** 2 passed, 1 failed, 5 did not run. My expected label was wrong: a live
  record in review reads "Published · changes in review". The spec was corrected; 9 / 9 since.
- **The negative control on the build before A-1 (`dbmode-neg`):** 1 passed, 1 failed, 7 did not run. Intended.
- **The first withdrawn-photo map (`r3.sh`):** stopped with exit 1. My script wrote JSON columns back as
  `[object Object]`; it was fixed and rerun (`r3b.sh`).
- **The public-effect unit test's first version:** it failed on a static text without the word "cutover". The test's
  pattern was widened; the text was unchanged.
- **My part-1 script** labelled the static archive with the 35-file list "must fail". It passed, correctly (no listed
  file is used by a static page); the real negative control is the refusal above.

**On the working tree, before the clone:** unit 431 / 431, the A9 import file 20 / 20 (19 / 19 before the M-2 test),
the publishing files 44 / 44. The negative controls of item 3.1 failed as intended.

## 4. End-to-end publishing test results

`npm run test:dbmode`:
- config `playwright.dbmode.config.ts`, specs in `e2e-dbmode/`;
- `e2e-dbmode/server.mjs` refuses anything but a database build;
- it makes a `rawasy_e2e_<hex>` database and runs the migrations, the release media import, an import Owner and the
  real content import through the CLIs;
- then it starts `server.js` with the admin on.

The spec signs in as an Admin (with 2FA), an Editor and a Reviewer, on `gateway-welcome-signs`, a project outside the
fixed composition:

| # | Step | Checked |
|---|---|---|
| 1 | The imported page is live | 200 in EN and AR, `Cache-Control: private, no-cache` |
| 2 | The Editor saves a new title in both languages | the panel reads "Published · changes in draft" and the database release's text; the public pages and the generation unchanged |
| 3 | The Editor submits | "Published · changes in review"; public unchanged |
| 4 | The Reviewer approves and publishes | the dialog's database-release sentence; the generation moves; the new titles in EN, AR and the gallery at the next request |
| 5 | The Admin rolls back from Version history | the original titles return |
| 6 | The Admin tries to unpublish `clock-tower-landmark` | refused ("fixed place"); its page stays 200 |
| 7 | The Admin unpublishes the test project, then publishes it | 404 in EN and AR, gone from the gallery and the sitemap; then back |
| 8 | The audit log | every step with its actor, and the refused unpublish |
| 9 | The media library | the database release's text |

**Results:**
- 9 / 9 on the corrected working tree (31.9 s).
- 9 / 9 on the fresh clone of `0de9452` (34.3 s).
- Negative control on the database build before A-1: test 1 passed, test 2 failed on the admin's text, and the serial
  spec ran no further.

## 5. Final public parity evidence

The static release (3400) and the database release (3410) of the final code, on a copy of the database freshly
imported through the CLIs:

- **Visible HTML:** the 102 sitemap pages identical. The three 404 addresses probed differ only in where their
  metadata streams (A9's known difference; item 2.3, 5).
- **HTTP:** 224 answers.
  - Status, type, robots and location are equal on all 224.
  - `Cache-Control` differs where it is meant to: the database release sends `private, no-cache` on 210 answers — the
    102 documents and 102 page-data answers, the two unknown-slug 404s, the sitemap and the three catch-all 404s.
  - The other 12 are equal in every field: `/`, the admin addresses (404 with the admin off), the files, the held-back
    files (404) and `/media/u` (404).
  - Bodies differ only on the three 404 pages (metadata placement) and on Next.js's own 404 body for `/api/nothing` and
    `/og/home-en.png` (404 on both releases).
- **Resting pixels:** every sitemap page and the two 404s × 1440 / 834 / 390 × light / dark (reduced motion, images
  eager and decoded): **624 / 624 identical, all at the first capture** (A9 on `1eb7a30`: 624 / 624, one on a
  recapture).
- **The static release against `d72413a`'s:**
  - 98 / 98 static files byte-identical;
  - **601 / 601 prerendered public files** (HTML and page data) identical once the build id is normalised, referring to
    the same static files;
  - the 16 chunks that differ are admin chunks no public page refers to.
  - The static release is A8's, and stays the rollback.
- **Build output:** the database build has no prerendered public pages, as designed. Its static files equal the static
  build's (98 / 98); 16 chunk names differ (the content-source alias), as in A9.

## 6. Hosting readiness checklist

The exact cPanel procedure for H1–H14 is `docs/admin/A9-STAGING-PACKAGE.md` §1, each check with its pass rule.
Nothing was verified on the account: no session has access to it, and the brief forbids it. **Every row is unverified
until the operator records it.**

| Check | What it verifies | Needs |
|---|---|---|
| H1 | Node.js 22.18+ in Setup Node.js App; startup file `server.js` | Hosting operator |
| H2 | glibc ≥ 2.28; sharp loads | Hosting operator |
| H3 | Terminal, SSH, port forwarding (else the operations-folder fallback) | Hosting operator, release engineer |
| H4 | MariaDB version, settings, grants, authentication plugin; `U` = `max_user_connections` | Hosting operator |
| H5 | Connection budget `P × (L + 1) + R ≤ U`, peak measured | Hosting operator |
| H6 | Process count and lifecycle (Passenger) | Hosting operator |
| H7 | Memory: `P × RSS` with 25 % headroom; no Resource Usage faults | Hosting operator |
| H8 | Response times (proposed: first render p95 ≤ 2 s, cached ≤ 0.5 s) | Release engineer |
| H9 | Data folder 0700 outside `public_html`; ≥ 5 GB, ≥ 60,000 inodes free | Hosting operator |
| H10 | ModSecurity and request size: a 15 MB synthetic upload | Hosting operator |
| H11 | Cron available (nothing scheduled) | Hosting operator |
| H12 | Account backups; the Owner's backup key pair; an encrypted backup verified | **Owner**, hosting operator |
| H13 | DNS recorded; the staging subdomain (a DNS change: Owner's authorization) | **Owner**, hosting operator |
| H14 | AutoSSL; staging access control (IP allowlist preferred); `TRUSTED_PROXY_HOPS` by the audit log's address | Hosting operator |

**Needs the Owner:**
- every authorization;
- the staging host;
- the backup key pair and the escrowed `AUTH_ENCRYPTION_KEY`;
- the legal reviewer decision;
- the admin on staging.

**Needs the hosting operator:** everything in cPanel and Terminal.

**A development session can do none of these.**

## 7. Staging execution package

`docs/admin/A9-STAGING-PACKAGE.md`, for operator review; nothing in it has been run. Every command is marked
read-only or "writes", and says where it runs (server, engineer's machine, browser).

| § | Content |
|---|---|
| 0 | Roles: Owner, hosting operator, release engineer |
| 1–2 | H1–H14 exact procedures; what each blocks |
| 3 | The environment checklist (every variable, `CONTENT_SOURCE` unset) |
| 4 | Preflight on a fresh clone (install, audit, lint, typecheck, suites); the two archives with checksums; the `--withhold` list for every database archive after an import |
| 5 | Backups and key escrow (`AUTH_ENCRYPTION_KEY` generated by the Owner; the backup key pair; an encrypted backup before each migration and around the import, verified by the Owner) |
| 6 | The operations path: the archive carries no `scripts/` or `drizzle/`, so the CLIs run from the engineer's clean clone through an SSH tunnel with a 0600 env file (fallback: an operations folder on the host) |
| 7 | Migrations and the content import: status, up, release media (and again), dry run, real run, repeat ("unchanged" everywhere), backup |
| 8 | The Owner account (`admin-bootstrap.mjs`, the setup link, 2FA) |
| 9 | Deploying the database release (stop, upload, checksum, extract, variables, Run NPM Install, start, warm-up) |
| 10 | Smoke tests (public checks; the publishing path by hand in 8 steps, including the M-1 refusal); §10.1 the withdrawn-release-photo emergency step |
| 11 | Performance and recovery (timings, 20 + 20 concurrent requests, a one-minute database outage, a restart) |
| 12 | Rollback to the static release of the same commit (≤ 5 minutes, CMS data untouched) |
| 13 | GO / NO-GO (item 10) |
| 14 | Record sheet |

The runbook (`docs/admin/A9-CUTOVER-RUNBOOK.md`) points to it. Its §8 adds two limits: the release photo withdrawn
after the import, and the fixed places' photos.

## 8. Remaining Owner decisions

**For staging:**
1. **O1 — Authorize the staging rehearsal**, naming the staging host. This includes the subdomain's DNS record (H13).
2. **O2 — S7, S8:** name the legal pages' reviewer, or rehearse with Privacy and Terms unpublished (404); and decide
   whether staging runs the admin (`ADMIN_ENABLED=1`).

**For production:**

3. **O3 — Fixed-place photos.** Withdrawing a photo of the approved composition takes its page offline in both
   languages until it is delivered again. Options:
   - accept it with an operating rule: never withdraw those photos without a replacement ready; the admin warns;
   - or authorize a change to the frozen public components so they draw without it.

   Before A-2 the affected items were these 17; on the final build 15 (the two certificate previews now leave their
   certificate out):

   | Withdrawn item | Effect |
   |---|---|
   | `site/laser-sparks`, `projects/clock-tower-1` | home 500; Laser Cutting 404 |
   | `projects/palm-canopies-1`, `perforated-canopy-1`, `tulip-roundabout-1`, `site/site-engineers` | Industries 500 |
   | `site/steel-beams-hall` | Industries 500; Steel Structures 404 |
   | `projects/suspended-lantern-1` | Projects 500 |
   | `certificates/vat-registration`, `commercial-activity-licence` | Certificates 500 (A-2: now left out) |
   | seven service photos | that service 404 |
4. **O4 — Release photos withdrawn after the cutover** (M-2). Use the `--withhold` list for every database archive,
   and the emergency step. Or adopt A1's T7 relocation in a later phase: the release files moved to the data folder
   and served after a `public_media` check, which takes an address offline at once.
5. **O5 — Accept A9's limits:**
   - the public structure stays code;
   - L4's one-render window;
   - burst shedding above 52 uncached requests per process.
6. **O6 — The admin in production** (`ADMIN_ENABLED`). Without it, nothing published can change after the cutover.
7. **O7 — Backups:** an off-site location, retention and key custody (H12). Owner default: no automatic production
   backups before that.
8. **O8 — The homepage showcase's hydration race:** leave it, or authorize the public component fix.
9. **O9 — Carried, undecided:**
   - A8 item 12: reference warnings vs blocks, revision retention, scheduled publication, audit export, who unpublishes,
     slug rollback;
   - A9 item 11: logging a refused import;
   - the public CSS items: the reduced-motion press, the header blur;
   - the legal pages' pending notes, which block launch in either release;
   - RAWASY's asset confirmations;
   - the gated features: stored enquiries, SMTP, attachments, retention;
   - domain, DNS, SSL and `main`.

## 9. Recommendation

**A9: READY for a staging rehearsal. BLOCKED for production** until the conditions below are met. This is a
recommendation, not an approval.

**Why ready for staging:**
- No High or open Medium finding after two independent passes.
- Every confirmed defect is corrected, with a test that fails on the code before.
- Every suite passed on a fresh clone at or above its baseline (item 3.2), and item 3.3 lists every failure, retry and
  skip.
- The database release draws the same website as the static one (item 5).
- It fails closed and recovers (item 2.3).
- The publishing path works end to end through the admin's own screens (item 4).
- The static release stays the rollback, unchanged.

**Conditions before staging:** O1, O2; and staging GO (item 10), which includes H1–H4, H9, H13, H14.1–2 and the key
escrow.

**Blocked for production until:**
- a passed staging rehearsal on the same commit, with H1–H14 recorded;
- O3–O7 decided;
- the legal pages reviewed and their pending notes resolved;
- RAWASY's asset confirmations;
- the explicit go-ahead for the domain, DNS, SSL and the cutover.

## 10. Staging GO / NO-GO criteria

From the staging package §13, unchanged in substance.

**GO for the staging deployment** (§9 of the package) — all of:
1. The Owner's written authorization for staging, naming the host.
2. H1, H2, H3 (or the §6 fallback), H4, H9 and H13 recorded as passing; H14.1–2 ready to verify.
3. The §4 preflight passed on the approved commit, both archives' checksums recorded.
4. §5: the staging key generated and escrowed; the backup key pair exists, its private key with the Owner.
5. S7 and S8 decided.

**GO for the rehearsal's acceptance** — all of:
1. Migrations exit 0; the import's repeat reads "unchanged" on every row; the backups verified by the Owner.
2. Every §10 public check passes; the publishing path passes all eight steps (the M-1 refusal included).
3. §11: H5–H8 within their pass rules; the outage test fails closed and recovers within 65 s; no 429 / 503 / 508.
4. §12: a rollback to the static release rehearsed and timed (≤ 5 minutes), CMS data unchanged.
5. H10 and H14.3 passed if the admin runs.

**NO-GO** (stop, roll back, report) — any of:
- a page served with old content after a publication, or any page served while the database is unreachable;
- a held-back file answering 200, or a private or restricted item delivered;
- a working copy or draft text on a public page;
- a migration exit other than 0, or an import repeat that is not all "unchanged";
- staging reachable without its access control, or indexed;
- a resource limit hit under §11's load;
- logs with SQL, credentials or personal data;
- any step needing production, DNS beyond the staging record, SMTP or a credential nobody authorized.

## Known limitations

**Documented, not changed:**
- the public structure is code;
- fixed-place photos fail their page closed (O3);
- a withdrawn release photo stays reachable until a release leaves it out, unless the emergency step is used (O4);
- L4's one-render window;
- burst shedding above 52 uncached requests per process;
- the homepage hydration race (O8);
- the Info items of item 2.2.

**Parity is proven with scratch tools, not a committed suite** (as in A9). They live in the session scratchpad:
`htmlcmp.mjs`, `httpcmp.mjs`, `pixels.cjs`, `assetscmp.mjs`, `spotmap.mjs`, `r4.sh`.

## How to run

The README covers the local MariaDB. On a fresh clone:

```bash
npm ci
npm run lint
npm run typecheck
npm run db:check
npm run test:unit
npm run test:integration
npm run build && npm run test:admin && npm run test:e2e
CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build && npm run test:dbmode
```

## Next steps

1. The Owner reviews this report, the staging package and the runbook.
2. The Owner decides O1 and O2.
3. Only then, a separately authorized staging rehearsal following the package, with its record sheet returned for the
   staging GO.
