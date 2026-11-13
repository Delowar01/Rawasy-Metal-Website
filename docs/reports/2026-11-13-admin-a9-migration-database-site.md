# RAWASY Metal Website — Admin / CMS Phase A9: Static-to-CMS Migration and the Database-Backed Public Website

**Brief:** "RAWASY METAL WEBSITE — A8 ACCEPTANCE & A9 IMPLEMENTATION AUTHORIZATION".
**Status:** A8 is technically closed (item 1). A9 is built — **local implementation only** — and awaits the Owner's
review; it is **not** self-approved or Owner-approved. Nothing was deployed: no hosting, DNS, SSL or cPanel change,
nothing merged into `main`, no staging or production database touched, no production credential, no SMTP or real
email, no real customer data, no live cutover. Every drill ran on disposable local MariaDB databases
(`rawasy_e2e_*` / `rawasy_t_*`) in this session's container. **The static release is unchanged and stays the rollback**
(item 6.1): `CONTENT_SOURCE` defaults to `static`, and a static build of A9 serves what the A8 closure build served.

## 1. A8 closure status

- **A8 is technically closed** on its reported implementation and evidence, as the brief records it. Its Low / Info
  backlog and the business decisions of its report's item 12 stay open; A9 decides none of them (item 11).
- Rollback checkpoint: GitHub branch **`preserve/pre-admin-a9`** at `babf932` (the A8 closure docs commit; the last A8
  code commit is `361aefc`), pushed before any A9 commit.
- The Owner defaults of the brief §2 are recorded in the project memory (`CLAUDE.md`) and followed by A9: required
  linked records must resolve (the composition guard, item 7, M2), optional ones only where the approved renderer leaves
  them out; no revision pruning, no scheduled publishing, no automatic backups, no audit export or automated retention;
  unpublishing per the registry; legal pages need a named reviewer (they stay unpublished without one); stored
  enquiries, SMTP, attachments and retention stay off; no staging content imported.
- A9 found four defects in earlier phases while importing today's website; each is corrected in its own commit with a
  test (`d4c5dec`; item 3.7). None reopens a phase's scope.

## 2. Starting and final SHAs

- **Start:** `babf932` (= `preserve/pre-admin-a9`).
- **A9 commits** (each on its own; every one typechecks and lints):

| Commit | What |
|---|---|
| `d4c5dec` | Corrections found by the content import: A3 gallery reference with an en dash; A5 `linksOptional` (the service hero's "See the work"); A8 a menu's collection item needs no label; A8 the projection keeps the public source fields |
| `f49898b` | A9.2 / A9.3 — the static content importer: reconciliation, import revisions, publication through A8 |
| `c20540a` | A9.4 — the database content source behind the content modules, the fail-closed page cache |
| `ccce85e` | A9.5 — public media delivery independent of `ADMIN_ENABLED` in a database-content release |
| `bcae91f` | A9.5 — redirects on the public website in database mode |
| `f59e19f` | A9.2 — the import CLI `npm run content:import`, reconciliation by outcome, legal pages once reviewed |
| `17f4c7b` | Tests: import, layouts, read model, page cache, redirects |
| `25b3c13` | Deployment: the packaging check takes a database-content build |
| `2f668d5` | A9.4 correction: time limits on the public database reads |
| `83a1892` | Tests: A2's sign-in timing test compares the two paths (it failed 5 / 8 alone on the A8 baseline) |
| `1daf089` | Docs: README section 11, `docs/admin/A9-CUTOVER-RUNBOOK.md` |
| `a53cc85` | The A9 security review's corrections (3 Medium, 4 Low, 2 Info) |
| `d9dbe64` | Tests: the review's findings, each failing on the code before |
| `c9d9121` | Tests: A6's site spec waits for the saved version and for hydration (two read races, item 8) |

- **Final code commit:** `c9d9121` (QA, drills and parity proofs ran on a fresh clone of it).
- **Final commit:** {{FINAL_SHA}} (this report and the project memory; docs only).

## 3. A9 features

### 3.1 A9.1 — hosting compatibility and resources

`docs/admin/A9-CUTOVER-RUNBOOK.md` §2: fourteen checks (H1–H14), each with how to verify it on the account, what it is
needed for and what it blocks. Nothing was checked on Namecheap (no access, by design): findings in item 9.

### 3.2 A9.2 — the content importer

`src/server/migration/{importer,records,layouts}.ts` and `scripts/content-import.mjs`:

```
npm run content:import -- --owner=<an active Owner's email> [--dry-run] [--legal-reviewer="<name>"] [--report=<file.json>]
```

- **What it imports** — every static content type, from `src/content/*` and the dictionaries only:
  - A3 records: services, projects and categories, machines, industries, clients, certificates (metadata);
  - the 13 fixed pages (home, about, services, capabilities, projects, industries, clients, certificates, contact,
    privacy, terms, the project page template, the 404), each with its A5 layout (and the six service layouts);
  - A6: the company and website settings, interface text, the four menus;
  - the A7 quote form; the orderings.
  - Media and references: by the release file's address, only items A4 delivers.
  - SEO: each page's title and description in both languages. Indexing, canonical addresses, alternates and the
    sitemap's rules stay code (`src/lib/page-meta.ts`, `NEXT_PUBLIC_SITE_URL`).
- **How:**
  - as an existing active Owner, in a short-lived session revoked at the end; audit actor `cli`;
  - through the editors' own services, in **one transaction**;
  - one `import` revision per aggregate, carrying the static source's fingerprint;
  - published through A8's strict pipeline, in dependency order.
- **Repeatable, never overwriting silently.** An aggregate is updated only when all three hold: the import wrote it,
  nobody changed it since, and today's source changed. Otherwise it is left as it is and listed (`edited_kept`,
  `conflict`). Anything archived or taken offline since stays so. A rerun with nothing changed writes nothing.
- **Fails whole.** Any of these rolls the whole transaction back:
  - a refusal: an unknown or inactive owner, a validation or publication issue;
  - `--dry-run`;
  - a delivered held-back file.

  Either way a `content.import` audit event is written. Exit codes: 0 done, 1 usage, 2 refused (nothing written),
  3 database.
- **The 13 restricted files are never referenced.** The run refuses to start while any of them is delivered by the
  library.
- **Legal pages** are imported but published only when `--legal-reviewer` names who reviewed them. Without one they wait;
  a later run that names one publishes them without a new revision.
- **Nothing is invented.** No layout field, record or setting gets a value today's website does not hold. Unknown fields
  stay empty. The map's place link, an SEO description and the share image stay empty where they are empty today.

### 3.3 A9.3 — revisions and publishing

- The import writes ordinary A8 revisions and publishes through A8's `publish`: the same checks people pass.
  - **Strict validation:** both languages complete, layouts set up, media delivered, the certificate guard, slugs.
  - **The review step is not bypassed.** The importer acts as the Owner, who holds `publish`; legal pages also need a
    named reviewer.
- After the import, everything is edited, reviewed and published in the admin as in A8. History shows the `import`
  revision as the first version.

### 3.4 A9.4 — the database content source

- **The switch: `CONTENT_SOURCE`, fixed into a release at build.**
  - `static` (the default) is today's release and the rollback.
  - `database` resolves `@/content/load` to `src/content/live/load.ts`.
- **What the database build reads.** Before any public entry reads the content, the loader fills the content modules'
  own objects with what the published documents hold:
  - the published documents (`published_documents`);
  - the media A4 delivers (`public_media`);
  - the generation.

  It never reads working copies, admin-only fields or private records. The approved components are unchanged; they read
  the same modules.
- **Fail-closed.**
  - Every request reads the shared cache generation first (5 s limit). Content of another generation or epoch is never
    served.
  - The database unreachable or stalled answers 500, never stale and never the static content. A breaker of 5 failures
    opens for 60 s.
  - Logs carry error codes only.
- **The page cache** (`src/server/public/cache-handler.cjs`).
  - Pages render on demand. An entry is stamped with the generation read before its render, and served only while that
    generation holds.
  - It keeps 200 answers only, bounded to 400 entries and 128 MiB.
  - The build reads no database.
- **Pages a release does not publish** answer 404: an unpublished fixed page, a service or a project. The sitemap lists
  live pages only.
- **Headers.** A database release sends `Cache-Control: private, no-cache` on its pages and sitemap.

### 3.5 A9.5 — public media and redirects

- **Media:** `/media/u/**` answers in a database-content build whatever `ADMIN_ENABLED` says. A static build keeps
  today's rule.
  - Only items A4 delivers are served. Restricted, private and trashed items never are; a database outage answers 503.
  - Uploads are drawn as they are, never through the image optimizer.
- **Redirects:** an address no live page answers follows its active redirect.
  - **Pages win:** a redirect never applies at an address a live page answers.
  - **The target must be live:** a published service's or project's current address, a live fixed page, or a path one
    answers.
  - **No loops, chains or unsafe targets:** a target that is itself a source, is the source again, or is not live gives
    no redirect.
  - 308 when permanent, 307 otherwise. A static build resolves none, as before.

### 3.6 A9.6 — enquiries

- Unchanged: the public quote form prepares the email and WhatsApp text (handoff), and nothing public stores an
  enquiry.
- A7's prepared submission service is still reachable by no route or Server Action. It stays disabled by default.

### 3.7 Corrections to earlier phases found by the import (`d4c5dec`, each with a test)

- **A3:** a project's gallery reference may contain an en dash, as the company profile's "07–08" does. Before, the import
  of today's projects was refused.
- **A5:** the service hero's "See the work" link is optional (`linksOptional`): it points at the gallery, else the
  projects, and is left out when neither is shown. Before, Laser Engraving's approved page had no valid layout.
- **A8:** a menu's collection item (the Services menu's live services) is labelled by its records. Before, the seeded
  Services menu could never be published.
- **A8:** the public projection keeps a record's source basis and pages, which the pages print ("Company profile ·
  p.7"). The source note and a certificate's expiry stay admin-only.

## 4. Import reconciliation

### 4.1 The drill

**Setup.** The drill database was `rawasy_e2e_a9d0c0de`, a disposable local MariaDB 11.4.13 database built from the
fresh clone of `c9d9121` with the real CLIs, exactly as the staging procedure runs them (runbook §3):

1. `db-migrate up`: 13 migration files.
2. `media:import-release`: 143 release files registered — 108 approved, 22 pending review, 13 restricted. 108 are
   delivered (`public_media`).
3. An Owner account.

**Runs** (each with a `--report` file, mode 0600):

| Run | Exit | Result |
|---|---|---|
| `--owner=<unknown address>` | **2** | "Refused at preflight (owner): The account named to run the import is not an active user. Nothing was written." |
| `--dry-run` | 0 | the full reconciliation below; `published_documents` afterwards: **0 rows** (rolled back) |
| real run, no legal reviewer | 0 | 113 created; 111 published; Privacy and Terms imported as working copies only |
| `--legal-reviewer="A9 local parity drill (not a legal review)"` | 0 | 0 created, 0 updated, **2 published** (Privacy and Terms; no new revision) |
| the same again | 0 | 0 created, 0 updated, 0 published: **every row unchanged** |

### 4.2 Reconciliation of the real run

The importer's own table, checked against the drill database:

| Type | Source | Created | Updated | Unchanged | Left as they are | Published by the run | Live |
|---|---:|---:|---:|---:|---:|---:|---:|
| project categories | 9 | 9 | 0 | 0 | 0 | 9 | 9 |
| services | 6 | 6 | 0 | 0 | 0 | 6 | 6 |
| machines | 6 | 6 | 0 | 0 | 0 | 6 | 6 |
| projects | 34 | 34 | 0 | 0 | 0 | 34 | 34 |
| industries | 8 | 8 | 0 | 0 | 0 | 8 | 8 |
| clients | 21 | 21 | 0 | 0 | 0 | 21 | 21 |
| certificates | 3 | 3 | 0 | 0 | 0 | 3 | 3 |
| pages (13 fixed, with their layouts) | 13 | 13 | 0 | 0 | 0 | 11 (+2 with the reviewer) | 11 → 13 |
| orderings | 7 | 7 | 0 | 0 | 0 | 7 | 7 |
| menus | 4 | 4 | 0 | 0 | 0 | 4 | 4 |
| site settings (with interface text) | 1 | 1 | 0 | 0 | 0 | 1 | 1 |
| quote form | 1 | 1 | 0 | 0 | 0 | 1 | 1 |
| **Total** | **113** | **113** | 0 | 0 | 0 | **111 (+2)** | **113** |

### 4.3 Checks of the outcome

- **Layouts and published documents.** 19 layouts were set up: the 13 pages and the 6 service pages.
  `published_documents` holds exactly 113 rows, one per aggregate.
- **Revisions.** There are 226: one `import` and one `publish` revision per aggregate. The cache generation moved from 0 (the
  seed) to 110.
- **References.** `missingReferences` is empty: every relation and media reference in a published document resolves to
  a live record or a delivered item.
- **Audit.** Four `content.import` events (actor `cli`): the dry run, the real run, the reviewer run and the repeat. Each
  record has its create and publish events.
- **The refused run** was not audited. It names no active account to attribute the event to; the CLI reports it (exit 2)
  and writes nothing. The Owner may want it logged; it is noted in item 11.
- **Found here and corrected** (`5b770ee`, with a test that fails on the code before): the dry run's event read like a
  real import. It now says "Content import dry run (nothing was written): …".
- **The A8 publish checks warned 43 times** that a linked record was not yet live. Records link each other, so some
  publish before the others. The importer checked at the end that **none remains unpublished**.

### 4.4 Left out on purpose (listed by the report)

**33 release files that today's content names are not referenced** by any published document:

- **12 of the 13 held back**, restricted in the library:
  - `services/engraving-nameplates`, `engraving-wood`;
  - the photos of the five flagged projects (`lattice-cubes-1`, `laser-cut-bench-1`, `seed-sculpture-1`,
    `litter-bins-1/2/3`, `canopy-tree-1`);
  - the withheld photos `wheat-monument-1`, `stainless-landmark-1`, `billboard-structure-1`.

  The thirteenth, `services/engraving-rotary`, is not named by today's content at all.
- **The 21 monochrome client logos** (`clients/*-mono`). They are pending review, not delivered, and no page draws them:
  the wall uses the colour files under a CSS greyscale.

The five flagged projects keep their flag as a note on the record and on each photo (restricted), not as a blocking A3
flag. Their pages show no photo, exactly as today.

### 4.5 Values the published documents do not hold (code-owned, by design)

These are the approved composition's own choices, which stay in code:

- the homepage's project order and the six showcase machines;
- the Projects collage and the Industries strip;
- the service looks and colour roles;
- the profile's figures;
- the quote form's validation;
- the composed "Company profile · p.N" line;
- the previous design's unused homepage copy.

Every other visible text comes from a published document: the marker drill (item 6.4) measures this on the rendered
pages. `tests/unit/migration-layouts.test.ts` lists each such text by name (`NOT_IN_LAYOUTS`).

## 5. Database publishing and cache verification

{{PUBLISHING}}

## 6. Static vs database parity evidence

**Setup.** Every comparison below is on the final code, `1eb7a30`, from a fresh clone. Two releases of that same commit
were compared:
- the **static release**, on port 3400;
- the **database release**, on port 3410, serving the drill database of item 4 as imported (with the placeholder legal
  reviewer, so that Privacy and Terms are live and comparable).

The earlier evidence on `c9d9121` (item 7.2, D1) gave the same parity figures. It is kept in the session's scratch
folder but not relied on.

### 6.1 The static release is preserved (the rollback baseline)

The A8 closure build (`babf932` = `preserve/pre-admin-a9`) was compared with the A9 static build:

{{FREEZE}}

### 6.2 Static vs database: HTML, HTTP and the browser's files

**Visible HTML** (scripts removed, build paths normalised, JSON-LD kept): **108 / 108 identical**. That covers the
102 sitemap addresses (EN and AR), plus `/en/not-a-page`, `/ar/no/such/page`, an unknown service, an unknown project,
`/en/admin` and `/theme-lab/en/x`.

**HTTP answers:** 224. For each, status, type, robots, location, `Cache-Control` and the body's hash were compared.
- **Status, type, robots and location:** identical on all 224.
- **`Cache-Control`:** differs on 210 answers, as intended (L1). The database release's pages and page data send
  `private, no-cache`; the static release's pages send `s-maxage=31536000`.
- **Bodies:** 3 differ.
  - `/api/nothing` and `/og/home-en.png` (an address neither release has) both answer Next's own 404 page. The
    database release puts the page's title and meta tags later in the stream: its root metadata awaits the content
    check. The tags themselves are the same.
  - `/en/not-a-page` differs the same way. On the database release this varies from request to request: 1 answer in
    12 streamed its metadata into the body, the other 11 were identical to the static release's. The static release
    gave 12 of 12 one way. React moves the streamed tags into `<head>`, so the browser shows the same page.

**The browser's files** (`.next/static`): 98 / 98.
- 82 are identical in name and bytes, the 9 stylesheets among them.
- 16 scripts differ in name only, in pairs of equal size. All 16 are admin chunks carrying Server Action references.
  Once the action ids (made per build) and the minifier's local names are normalised, all 16 are equal. No sitemap
  page of either release loads any of them.

### 6.3 Static vs database: the public browser suite

The full public suite (`E2E_BASE_URL` = the database release) gave **601 passed, 11 skipped, 0 failed**. The static
release passed 612 / 612.

The 11 skipped are the fallback 404's checks: they read the checkout's own build output, so they skip themselves
against an external server. Run from the database build's own folder against its own server, they passed
{{FALLBACK}}.

This suite covers, against the database release:
- the homepage and every inner page (structure, words, order);
- fonts and the Arabic preloads;
- images at their source size, the held-back photos never requested, the 13 files' absence;
- the certificate files' hashes and the digit guard;
- anchors and their landings, keyboard, focus;
- motion and reduced motion, forced colours, no-JS;
- the quote form's golden email / WhatsApp outputs and its no-JS mailto;
- the map frame;
- SEO, JSON-LD, canonical, hreflang, the sitemap;
- the 404s and their status codes;
- layout at twelve sizes.

### 6.4 Every visible text comes from the published documents: the marker drill

**Method.** In a copy of the imported drill database, every text of the 113 published documents got an invisible
marker (U+2063) appended, and the cache generation moved. Every page of the database release was then read, and each
visible text node without the marker listed.

**Result:** {{MARKER}}

**What carries no mark, and why** (86 distinct texts):
- **Code-owned by design.** Numbering (01–32, A–D) and punctuation. The language switch's codes ("EN", "عربي", "ع")
  and its labels. © and the year. The company profile's figures in `src/content/metrics.ts` (12,000 / 6,000 / 3,000,
  W, "Peak fibre-laser power" and their Arabic). The composed "Company profile · p.7" line.
- **From the documents, but not markable by the probe:**
  - numbers and dates formatted from record values (powers such as "12 kW", the legal pages' dates);
  - root fields the probe leaves unmarked (gallery references "p.3", "07–08");
  - texts whose key is `type`, which the probe never marks so that rich-text node types stay valid ("Type" / "النوع");
  - split strings, where the mark sits on the last piece: the e-mail's local part (the component splits it at "@") and
    the privacy line before its link.

**Not one sentence of page copy came from code** where a published document holds it.

### 6.5 Pixels

**Method** (static vs database, the final build):
- every sitemap page and the two 404s;
- at 1440 × 900, 834 × 1112 and 390 × 844;
- in light and dark: 624 cells;
- with reduced motion, every image eager and decoded, and the page walked to its end and back before a full capture
  (phones in 4,000 px slices).

**Result: 624 / 624 identical**, 623 at the first capture. The one recapture was the Arabic Projects page (desktop,
dark): the gallery's photo-size choice is timing-dependent, a known gotcha. Its second capture was identical on both
releases.

### 6.6 Speed and memory (local; the account is to be measured, H7 / H8)

| | Static release | Database release |
|---|---|---|
| Image warm-up (1,484 sizes, 102 pages) | 1,484 / 1,484, page median 15 ms, p95 47 ms | 1,484 / 1,484, page median 13 ms, p95 44 ms |
| First render of a page after start or publication | prerendered | 40–290 ms |
| A cached page | 2–9 ms | 5–11 ms (one generation read) |
| Resident memory after warm-up, the public suite and the pixel run | 534 MB | 559 MB (peak 559 MB) |

### 6.7 The homepage hydration race (tracked; an independent assessment)

{{RACE}}

## 7. Security review

### 7.1 The independent review

A separate reviewer read the A9 diff (`babf932..83a1892`) read-only, without my conclusions. It found **no High**
finding: 3 Medium, 4 Low and Info items. All were verified. They were corrected in `a53cc85`, with tests in `d9dbe64`;
nine of those tests fail on `83a1892` and pass after.

**M1 — a withdrawn photo was not invalidated.**
- Before: a media withdrawal (restriction, blocking flag, Trash, archive) did not move the cache generation, so a
  database release kept drawing a withdrawn photo until an unrelated publication. Redirect saves and (de)activations
  were the same.
- Correction: every change of `public_media`, and every redirect save or (de)activation, moves the generation in the
  same transaction.

**M2 — the approved composition could lose a record it needs.**
- Before: records the approved components need could be unpublished or archived, and the page then drew half a
  composition. Those records are the homepage's two laser services, the Projects collage's three projects, the
  Industries strip's five industries, a service that live machines name as their main one, and the settings, menus and
  form.
- Correction, part 1: `src/server/publishing/composition.ts` refuses that in A8 unpublish and A3 archive, with the
  reason, audited.
- Correction, part 2: the read model leaves out what cannot be drawn (a service without its code look or photos, a
  machine without its main service or photo, a client, industry or certificate without its picture) and drops dangling
  relations.

**M3 — an import could republish what people had taken offline.**
- Before: a later import could republish an aggregate taken offline after its import.
- Correction: an unchanged aggregate is published only if it was never published. Anything archived or taken offline
  since stays so. A collection order holding records the import did not write is left to people.

**L1 — shared caches could keep pages for a year.** A database release now sends `Cache-Control: private, no-cache`;
Next.js would have sent `s-maxage` of a year, which a shared cache in front could keep.

**L2 — the page cache had no byte bound.**
- Correction: it stores 200 answers only (404s cannot crowd out pages), bounds bytes (128 MiB) as well as entries,
  queue-limits its pool, and fails at once for 30 s after five failed reads.

**L3 — the loader's breaker counted local load.** The pool's own full queue no longer counts towards opening it.

**L4 — the 13 held-back files.** The import refuses to run while any of them is delivered by the library.

**I1 — a read-model failure could pass unnoticed.** Any decoding failure, and a section at a block version the release
does not read, fails the load. Only a page without a layout map is skipped.

**I3 — a stopped import left no audit.** An import stopped by an error (not a refusal) is audited too.

**Accepted and documented, not changed:**
- **I2:** a render that overlaps a publication may mix the old and new content for that one response. The cache never
  keeps it, because its stamp is older than the publication.
- **I4:** the live loader's lint boundary is indirect: `@/content/load` is resolved by an alias at build.
- **The restricted release files in `public/media` of a checkout:** a server run straight from a checkout serves them.
  The deployment archive leaves the 13 out for both releases (the packaging check).
- **A blocking flag or a withdrawn photo on a fixed spot of the composition** fails that page closed instead of drawing
  it without the photo. It recovers once the photo is approved again or replaced. Measured in item 5:
  - the collage's photos withdrawn → both Projects overviews answered 500;
  - the project's own page drew without photos, as a flagged project's does;
  - the other pages were unaffected;
  - with the photos restored, all answered 200.

  A4 never refuses a safety-increasing change (restricting, flagging), so the guard cannot refuse the withdrawal
  itself. Whether the overview should instead draw the collage without that print is a design decision for the Owner
  (item 11).

### 7.2 Found by the drills after the review (each corrected, with tests failing on the code before)

The independent review read the code. The drills ran it, as a deployment would, and found four more defects:

**D1 — High: the database release was neither fail-closed nor current at run time** (`f2f3ddf`).
- *Cause.* Next.js evaluates `next.config.ts` again when a server starts. The server's environment had no
  `CONTENT_SOURCE`, so the database build ran with the static configuration: no page cache handler, Next.js's own
  memory and file-system cache instead.
- *Measured on `c9d9121`:*
  - after a publication, the old pages were still served: the marker drill found 0 of 17,688 text nodes from the
    marked documents;
  - with the database paused, pages answered 200 in 3–4 ms;
  - 764 route-cache files were written into `.next`.
- *Fixed.* A server takes the source its build was made with, from the build's own record, and refuses to start when its
  environment names the other one.
- *Earlier evidence.* The parity evidence gathered before the fix (item 6) compared content that was rendered from the
  database on each first request; only its caching was wrong. Every check was taken again on the final commit.

**D2 — Medium: a stalled database held requests open** (`4404741`).
- *Measured.* After the first 500 (5 s), further page requests got no answer within 40 s. The page cache's one pooled
  connection stayed held, and mysql2's per-query timeout starts only once a query is sent.
- *Fixed.* Hard limits that cover waiting for a connection (5 s), and the page cache's pool is dropped after a failed
  read.
- *After the fix.* Every page answered 500 within 5 s.

**D3 — Medium: the in-use guard added with D1 proved nothing** (`4404741`).
- *Measured.* Its negative control — a database build whose record was edited to the static configuration — still
  answered 200 from Next.js's file-system cache. Next.js also builds a cache from the configuration embedded in the
  bundle, and that one constructs the handler regardless.
- *Fixed.* The mark is now set where the server's configuration installs the handler.
- *After the fix.* The control answers 500 on every page and logs the reason.

**D4 — Low: the public stylesheet gained a rule** (`1eb7a30`).
- *Measured.* A comment's bare word "static" added `.static{position:static}` to the public stylesheet. No element used
  it.
- *Fixed.* The comment is reworded; the stylesheets are A8's again, byte for byte.

**Also found and corrected:** the dry run's audit event read like a real import (`5b770ee`, item 4).

### 7.3 The brief's §6 checks

| Check | Evidence |
|---|---|
| **Drafts never leak** | The read model reads only `published_documents` and `public_media`. Integration test "a working copy never reaches it": an edited working copy stays out until published. The marker drill (item 6.4): every text drawn by the database release comes from a published document or from code. |
| **Private media stays private** | Private items never get a `public_media` row (A4). `/media/u/<unknown or private>` answers 404 in both releases (item 6.2). Integration tests: "no held-back, restricted, pending or private item is referenced by any published document"; "a photo restricted in the library leaves the public site at once". |
| **Restricted certificates stay protected** | Certificate copy passes A8's guard at publication. The redacted files are the same bytes. The public certificate suite (hashes, the digit guard over the page) passes against the database release (item 8). Private originals are never public-class. |
| **Publish and unpublish update the projections** | Integration tests: "an unpublished record leaves the public site, and every published list that named it"; "a repeated import … publishes the legal pages". The marker drill: a changed generation is served on the next request. |
| **Cache invalidation fails closed** | Unit tests (`public-cache.test.ts`, 8). The fail-closed drill (item 5): with the database paused, the warm database release answered errors, never a cached page. |
| **A failed migration leaves no partial public content** | One transaction. Integration test "a refused import and a dry run write nothing at all". The held-back preflight. A failed run in the drill (unknown owner) wrote nothing (item 4). |
| **Rollback to static loses no CMS data** | The rollback drill (item 5): the database server stopped, the static release served, the published documents, revisions and generation unchanged. |
| **No customer or legal information is invented** | The importer copies `src/content/*` and the dictionaries only, and leaves unknown fields empty. `migration-layouts.test.ts` proves decode(encode(today)) = today, and lists every text no layout carries. No enquiry is created. Legal pages publish only with a named reviewer. |

MFA, RBAC, sessions, validation, transactions and audit are unchanged; the import goes through them, as an Owner with
an audited `cli` actor.

## 8. Test results

{{TESTS}}

## 9. Hosting compatibility findings

**Nothing was checked on the Namecheap account** — no access from this session, by design (brief §5). The platform
facts are A1-ARCHITECTURE §7.1's (official Namecheap pages): LiteSpeed, MariaDB 11.4.9, Node.js 22.22, Stellar Plus 2 GB
memory, `maxEntryProc` 30, I/O 50 MB/s, 300,000 inodes, cron no more often than every 5 minutes and at most 5 at once, no
daemons. None of them is a measurement of the RAWASY account.

What a database release needs from the host, beyond the static release:

| Need | Why | Status |
|---|---|---|
| MariaDB reachable from the app, `utf8mb4_unicode_520_ci`, an auth plugin mysql2 speaks (`mysql_native_password`; not ed25519 / PARSEC) and the migration grants | every public request reads the generation | to verify (H4) |
| Connections: `P × (L + 1) + R ≤ U` — one more per process than A1 planned (the page cache's own pool) | e.g. P = 4 processes, L = 2: 4 × 3 + 5 = 17 ≤ `max_user_connections` | to verify (H5, H6) |
| Memory: each process keeps its own page cache (≤ 400 pages, ≤ 128 MiB) on top of Next.js | 2 GB account limit, `maxEntryProc` 30 | to verify (H7); local figure in item 6.6 |
| Per-request rendering on a miss | the first visitor after a publication waits for the render | local: item 6.6; to verify (H8) |
| `NEXT_PUBLIC_SITE_URL` at build and at run time | canonical and share addresses never come from the database | ready (the build refuses without it) |
| No cron job, no daemon, no new port | — | ready: A9 schedules nothing |
| glibc ≥ 2.28 (sharp 0.35.5, A4) | media processing and the image optimizer | to verify (H2) |
| SSH or cPanel Terminal | migrations, release media, the import, backups, the 2FA reset CLI | to verify (H3) |

Found while preparing the drills and corrected: a database that *stalls* (rather than refusing) would have held every
public request open; reads now have time limits (`2f668d5`, item 5). The cutover runbook's §2 has the full checklist.

## 10. Staging-readiness checklist

Staging itself is **not authorized yet** (brief §5): every row below that touches it waits for the Owner's go-ahead for
that environment.

| # | Item | Status |
|---|---|---|
| S1 | The code: importer, database content source, page cache, media, redirects, packaging of a database build | ready (this phase; awaiting review) |
| S2 | The rehearsal procedure through the real CLIs (migrate, release media, Owner bootstrap, import dry run / real / repeat, build, package, deploy, warm-up, parity, fail-closed check) | written (runbook §3); rehearsed locally end to end (items 4–6) |
| S3 | A staging cPanel app with its own database and data folder | **missing** — Owner / hosting |
| S4 | H1–H5, H9 (Node, glibc, Terminal, MariaDB settings and grants, connection budget, data folder) | **to verify** on the account |
| S5 | Staging's own `AUTH_ENCRYPTION_KEY`, escrowed offline (A1-SECURITY-RBAC §12) | **missing** — Owner |
| S6 | The Owner account on staging (bootstrap link, password, 2FA) | after S3 |
| S7 | The legal pages' reviewer named, or the Owner's decision to rehearse with them unpublished (404) | **Owner decision** |
| S8 | Whether staging runs the admin (`ADMIN_ENABLED=1`) | **Owner decision** |
| S9 | Parity proof on staging with the A9 tools (visible HTML, HTTP, files, public suite, pixels) | after S3–S6 |
| S10 | H6–H8 measured during the staging warm-up and suite (processes, memory, response times) | after S9 |
| S11 | A backup before each migration (`db-migrate` requires one outside `APP_ENV=local` once tables exist) | procedure ready; location and key custody **Owner** (H12) |

Staging content is test content: it is not imported into production (Owner default).

## 11. Remaining business, legal and infrastructure blockers

Nothing in A9 decides or activates any of these.

**Legal and content (RAWASY / the Owner):**

1. **The legal pages.**
   - **Reviewer.** A database release publishes Privacy and Terms only once a named legal reviewer is given to the import
     (Owner default). Until then they stay unpublished, and `/en/privacy`, `/ar/privacy`, `/en/terms` and `/ar/terms`
     answer 404 there, though the footer links them. The drill named a placeholder reviewer, "A9 local parity drill (not
     a legal review)", only to compare the pages; that is not a review.
   - **Pending notes.** They still block launch in either release.
2. **RAWASY's confirmations** in `docs/ASSET_INVENTORY.md`, unchanged by A9: the Google Maps place link, image rights,
   AI-watermarked images, the 13 held-back files, licence renewal, registration numbers.
3. **The public structure stays code** (item 12, condition). Sections of a system page that are hidden, moved or added
   in the page builder show in the admin preview only. The Owner should accept this as A9's limit, or ask for a later
   phase that lets the layouts drive the public structure.
4. **A withdrawn photo on a fixed spot** (item 7.1). Today the page that needs the photo fails closed: withdrawing the
   Projects collage's photo makes both Projects overviews answer 500 until it is restored. The alternative — the
   component drawing its collage without that print — would change approved public code. Owner's choice.
5. **Logging a refused import.** An import refused because the named account is not an active Owner writes no audit
   event (there is no account to attribute it to); the CLI reports it and writes nothing. Should it be logged as a
   system event?
6. **The admin in production** (`ADMIN_ENABLED=1`). Without it, the published content cannot be changed after the
   cutover.
7. **Carried from A8 item 12, undecided:**
   - reference warnings vs blocks;
   - revision retention;
   - scheduled publication;
   - backups (schedule, retention, off-site location, key custody);
   - audit export and retention;
   - who reviews the legal pages;
   - who unpublishes;
   - slug rollback;
   - the A5 Low items.
8. **Still gated:** visitor enquiry collection, SMTP and real email, stored attachments, a retention period, consent
   wording.
9. **Public CSS waiting for the Owner:**
   - the Owner-approved reduced-motion press fix (`scale: none`);
   - the homepage showcase's hydration race, tracked (item 6.7);
   - the header blur.
10. **Dev-only advisories.** `npm audit` lists 12 moderate dev-only entries (the lint and drizzle-kit toolchains; the
   production audit is 0). A fix exists only as a breaking downgrade.

**Infrastructure (the Owner / hosting):**

11. H1–H14 unverified on the account (item 9). In particular, the connection budget and memory of a database release
   are unmeasured there.
12. No staging environment.
13. No off-site backup location, retention or key custody. No escrowed `AUTH_ENCRYPTION_KEY`.
14. Domain, DNS and SSL: untouched. They need the Owner's explicit go-ahead.
15. `main` is not fast-forwarded. Every phase since 1J lives on `claude/new-session-5eijs6`.

## 12. A9 acceptance recommendation

{{RECOMMENDATION}}

## 13. Production cutover and rollback runbook (for approval only)

The full runbook is **`docs/admin/A9-CUTOVER-RUNBOOK.md`**. It is prepared for the Owner's approval only; none of it
was run on Namecheap, staging or production. In short:

**Preconditions:**
- the Owner's written go-ahead for production;
- the staging rehearsal (runbook §3) passed on the same commit;
- H1–H8 and H12 verified;
- the legal reviewer named, or the Owner's decision to cut over with those pages unpublished;
- a maintenance window and a content freeze.

**Cutover:**

1. **Back up** the production database: encrypted with the Owner's public key, verified, copied off the account. Do it
   before the migrations and again before the import (A8-BACKUP-RESTORE.md).
2. **Migrate** (`node scripts/db-migrate.mjs up --backup-file=<fresh backup>`).
3. **Register the release media** (`npm run media:import-release`; the 13 held back stay restricted).
4. **Bootstrap the Owner** if not done.
5. **Import:**
   1. `npm run content:import -- --owner=<email> --dry-run`, then read the reconciliation with the Owner.
   2. The real run, with `--report=<file>` and, as the Owner decided, `--legal-reviewer="<name>"`. Keep the report with
      the cutover record.
   3. Repeat it once: every row must read "unchanged".
6. **Build the database release** from the **same commit** as the live static release
   (`CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=<address> npm run build`), then `node scripts/package-namecheap.mjs`,
   which reports "Content source of this build: database".
7. **Deploy** as the README describes: upload, extract, Run NPM Install, restart.
8. **Warm up:** `node scripts/warm-images.mjs <address>`, then one request per sitemap page.
9. **Smoke checks** (runbook §6):
   - every sitemap page answers 200 in both languages;
   - unknown addresses answer the localized 404;
   - the sitemap lists only live pages;
   - the 13 held-back files answer 404;
   - the quote form's handoff is exact;
   - one harmless test publication appears on the next request and disappears after its rollback.

   Any failure means rollback at once.

**Rollback:**

1. Redeploy the **static release archive** of the same commit: upload, extract, restart. The static content is served at
   once, with no database step.
2. Leave the database as it is. Edits made after the cutover stay there; a later import leaves every aggregate edited
   since its import untouched and lists it.
3. Only if the database itself must go back: restore the pre-import backup into an empty database. That starts a new
   cache epoch.
4. Keep the static archive deployable until the Owner accepts A9.

**How to run A9 locally** (README section 11): `CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com
npm run build`, a local database migrated with the release media and an Owner, `npm run content:import -- --owner=…`,
then `NODE_ENV=production PORT=3410 DB_NAME=… node server.js`.
