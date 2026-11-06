# RAWASY Metal Website — Admin / CMS Phase A8: Publishing, Revisions, References, Audit & Backup Safety

**Brief:** "RAWASY METAL WEBSITE — A7 FINAL ACCEPTANCE & A8 IMPLEMENTATION AUTHORIZATION".
**Status:** A7 is technically closed (its final privacy correction verified; the A7 report's last section). A8 is
built — **local implementation only** — and awaits the Owner's review; it is **not** self-approved or Owner-approved.
Nothing was deployed: no hosting, DNS, SSL or cPanel change, nothing merged into `main`, no production credential,
database or backup, no SMTP or real email, no real customer data. **The public website is unchanged** (T1 Option B):
publishing fills only the database's public read model, which no public page reads before the A9 cutover; redirects
resolve nowhere; the public quote form keeps its handoff. A9 is not started.

## 1. Starting and final commit SHAs

- **Start of this brief:** `343d55f` (local and remote, clean; A7's last code `19c08c7`; checkpoint
  `preserve/pre-admin-a7` at `da1fe11`).
- **A7 final correction and closure:** `2ce4889` (the inbox search out of every address), `db587d2` (its tests and the
  keyboard walkthrough), `c0e1074` (closure docs). **`preserve/pre-admin-a8` = `c0e1074`**, pushed before the first A8
  commit.
- **Last commit with code:** `361aefc` (the tree the fresh clone tested). Docs only after it.
- **Branch:** `claude/new-session-5eijs6`; every push fast-forward; nothing force-pushed; nothing merged into `main`.

| Commit | What (brief item) |
|---|---|
| `2ce4889` | A7 final correction: the inbox search never reaches an address (2) |
| `db587d2` | Tests: the inbox search's privacy and the keyboard walkthrough of the A7 screens (2) |
| `c0e1074` | Docs: A7 closure — QA, freeze, project memory (3) = `preserve/pre-admin-a8` |
| `10f19e8` | A8 schema: migrations 0010–0012 and their proofs (4) |
| `5ead275` | A8.1 / A8.3: a revision for every change, comparison, restore, the reference index |
| `c5ea813` | A8.2: publication checks, the public projection, the cache record, taking content offline |
| `7852a17` | A8.4: redirects on a published slug change |
| `6b514b0` | A8.2: the publishing workflow |
| `2da6e00` | A8.5: the audit log's query and its sealed search |
| `47d67ca` | A8 admin screens: panel, history, comparison, restore, Used by, audit log |
| `c3e0b68` | A8.6: encrypted backups, verification, restore, the runbook |
| `8628d63` | A8.7: carried hardening |
| `d123462` | Tests: workflow, aggregates, backups, the publishing core, the browser walkthrough |
| `84ed520` | Security review corrections: M1, L1–L4, Info |
| `cd9ef74` | Security review corrections: backups L5–L7 |
| `9b8b7f6` | Admin screens: nothing listed twice next to "Used by" (found by the admin suite) |
| `08b309d` | Tests of the review's findings, each failing on `d123462` |
| `d2803b9` | Admin screens: 24 px targets in the history and audit tables (found by the admin suite) |
| `13c5c29` | Admin wording: hints that said publishing comes later (found by the evidence capture) |
| `361aefc` | Admin screens: phone labels in the A8 tables (found by the evidence capture) |
| `e69fd18` | README: publishing, versions, audit and backups (docs) |
| (docs) | This report and the project memory |

Each commit builds on the code it uses:
all 17 A8 commits (`10f19e8` … `361aefc`), each checked out on its own, pass typecheck and the lint
of the files it changed (17 / 17).

## 2. A7 closure verification

The A7 report's last section, "A7 FINAL CORRECTION AND CLOSURE", holds the details. In short: the inbox search posts to
a Server Action that seals it into its own `__Host-` cookie (AES-256-GCM, bound to the user and two hours; HttpOnly,
Secure, SameSite=Strict), so no URL, history entry, redirect `Location`, link, audit row or log ever holds it; filters,
sort and pages keep working; Clear, sign-out and every sign-in remove it; the export reads the same sealed search. The
keyboard walkthrough of the A7 screens passed (Tab only, a visible focus ring at every stop). On a fresh clone of
`db587d2`: `npm ci`, production audit **0**, lint, typecheck, build (no warning), `db:check`, packaging (13 held back),
unit **369 / 369**, integration **529 / 529**, admin **166 / 166**, public **612 / 612**, every suite in its first run.
Public freeze against `preserve/pre-admin-a7`: no public source changed; 890 / 890 files; CSS and JS on 104 / 104
pages; HTTP 229 / 229; pixels 396 / 398 identical at once, the other two the browser's drawing of one photo (identical
bytes on both servers; 23 of 24 recaptures identical). **No material A7 defect remained; A7 was closed** and
`preserve/pre-admin-a8` pushed before A8. The A7 decisions the Owner keeps (no real collection, SMTP, attachments,
retention, consent wording) are unchanged and gated.

## 3. A8 features

Everything below is the admin's database and its tools. **No public page reads any of it** (T1 Option B): the public
website still renders `src/content/*`, publishing fills only the database's public read model (`published_documents`),
and redirects resolve nowhere until the A9 cutover.

### A8.1 Revisions

- **Every change leaves a version.** `contentTransaction` (A3's single entry for content changes) records which
  aggregate roots a change locked (`lockRoot`, `lockOrdering`, the builder's, settings', menus' and the form's root
  locks; a create counts from version −1) and, as the transaction closes, writes one revision for every root whose
  `lock_version` moved — in the same transaction, so a change and its revision commit or roll back together. 13
  aggregate types: pages, services, machines, projects, project categories, industries, clients, certificates,
  reusable sections, collection orders, menus, site settings (with the interface text) and the quote form.
- **Immutable snapshots.** A revision stores the aggregate's canonical snapshot (sorted keys, bookkeeping columns
  left out: who / when edited, completion stamps), its SHA-256, a number per aggregate (1, 2, 3 …), kind (`save`,
  `submit`, `publish`, `unpublish`, `archive`, `restore`), author, time, the languages it changed, the revision it
  followed, the one it restored from, a note, and for a publication `live_from` / `live_until`. Nothing updates or
  deletes a revision; a save that changes nothing writes none.
- **History** (`/admin/history/<type>/<id>`): every version with what, who and when (Riyadh time), the live one
  marked; compare any two versions or a version with the working copy.
- **Comparison** (`…/compare?a=…&b=…`): field by field, per language, English and Arabic side by side (Arabic cells
  `lang="ar" dir="rtl"`); repeated items (children, layout sections, menu items, form fields, phones) matched by their
  id, so a moved item is an order change and an edited one a change of that item.
- **Restore** makes a new `restore` revision through the same save services as an edit (A3's `updateItem`, A5's
  `saveLayout` / `saveReusable`, A6's settings, interface text and menus, A7's form, the ordering service), with all
  their validation, on the version the page showed: never a rewrite of history, never a publication, and a version
  that would fail today's rules is refused with the reasons.
- **Concurrency:** every step is decided under the root's row lock on the version the page showed; a stale page is
  refused ("This content changed after you opened it. Reload and review the latest version before continuing."), never
  overwritten. Audit events carry the revision before and after.

### A8.2 Publishing workflow

- **States** (A1 §2): Draft, In review, Published, Published · changes in draft, Published · changes in review,
  Archived, shown on every record's publishing panel with what blocks publishing.
- **Steps** (A1 T1–T13), each one transaction on the record's row lock, the version the page showed and the seeded
  permission keys (`workflowKeys`): **Submit for review** (`<resource>.edit` + `.submit`, optional note), **Request
  changes** (`.review`, a comment required — stored in `review_comments`, plain text ≤ 2,000, never in the audit
  text), **Withdraw**, **Approve and publish** (`.publish`, or `.publish_reviewed` when someone else submitted the
  version — never one's own), **Publish** directly (`.publish`), **Unpublish** (`.publish`), **Discard the draft**
  (back to the live version), **Restore** (`.restore`) and **Roll back** to an earlier *published* version (a new
  publication of it). Legal pages need `legal.publish` (the Owner's) and the name of whoever reviewed the legal text (A1 §4.3, its own
  field); certificates are published by the Owner (`certificates.publish`). Menus, settings
  and the form have no review keys in the registry: they are published directly by `<resource>.publish` holders.
  No role name, no new key, no new approval role.
- **Strict validation at publish** (A1 §4.2), on the exact version going live: both languages complete (and marked
  so), required fields and child texts, a layout set up with every section complete, every media item one A4
  delivers (`public_media`, share-locked), no blocking project flag, A3's certificate digit guard on the rendered page
  (A5 I4: the record texts and media alt texts a certificate block draws, from their live versions), a slug unique
  among live versions, redirects that do not collide. Linked records that are not live are **warnings** (the public
  renderer leaves them out), not blocks — an Owner decision noted in item 12.
- **Projection:** `published_documents` gets the version's public document (no admin-only field: provenance, flags,
  a certificate's expiry date, the form's notification addresses and retention, language states, hidden sections or
  items), its published references and one cache generation per publication (`cache_generation` +1,
  `cache_invalidations` per tag) — the fail-closed cache record A9's handler will read.
- **Taking content offline:** unpublish, archive (A1 T12: archive takes the live version down with it), a blocking flag
  added to a live project (safety first: offline at once, back only by a new publish once cleared) and a reusable
  section's archive remove the live document and clear the record's published pointer in the same statement as its
  status.
- **Stale publication prevented:** a publish names the version the page showed; anything saved since refuses it.

### A8.3 Reference index

- `content_references` (A1): what each working copy and each live version names — media, records, reusable sections,
  link targets — rebuilt with every revision in the same transaction, the published scope with every publication.
  `npm run content:references` rebuilds it whole (after the migration, after a restore; recorded in
  `system_job_runs`).
- **Used by:** a media item's page lists everything that names it, sections and reusable sections included (A4/A5
  limitation lifted); archive controls name the live pages that link the record and the working copies that still use
  it; publishing warns about linked records that are not live.
- Archive of a reusable section is still refused while a section uses it (A5); archive takes a live version offline;
  restore from the archive returns a draft (A3).

### A8.4 Redirect lifecycle

- Publishing a page, service or project under a new slug adds a 308 redirect from each language's old address to the
  record (by id, one step to its current address). Taking an address back reactivates its redirect; the new address's
  own redirect is retired (pages win). The publication is refused when a redirect would collide with another
  redirect's source, create a chain, or take an address another live record answers (A6 L2's follow-up). Redirects
  stay inactive on the public site until A9.

### A8.5 Audit log viewer

- `/admin/audit` (`audit.view`: Owner and Admin), under "Safety": outcome (success / denied / failed), kind of record,
  record, person, action, Riyadh day range, 10–100 a page, every filter bounded and validated; one record's log from
  its history page. The **search** (summaries, records, people) is sealed into its own `__Host-` cookie
  (AES-256-GCM, bound to the user, 2 hours, HttpOnly, Secure, SameSite=Strict) — never in an address, a link, a
  redirect or a log — and cleared at sign-in and sign-out, like A7's inbox search. Changes pass through A2's
  `redactChanges`; A7's rule holds (audit rows carry references, ids, statuses and counts, never personal enquiry
  contents, message bodies, file names, notes, comments or search words).

### A8.6 Backup and restore (operator tools, local drill only)

- `npm run backup -- keygen | create | verify | restore` (`scripts/backup.mjs`, `src/server/backup/`): a consistent
  `mariadb-dump --single-transaction` (sessions, tokens, rate limits and sign-in attempts as schema only), the data
  folder (public and private media, enquiry attachments; without `tmp/`), `config.json` (variable names and the key
  versions rows need — never a value) and a manifest of SHA-256s; with the Owner's public key every file is encrypted
  (AES-256-GCM, a fresh data key wrapped with RSA-OAEP-SHA-256). It refuses a backup or key folder inside a Git
  repository, passes database credentials in a 0600 option file (never on a command line), restores only into an
  empty database and an empty folder, verifies every file first, then starts a new cache epoch and records the
  restore.
- `docs/admin/A8-BACKUP-RESTORE.md`: the runbook, restore drills, and the key-escrow procedure. **No production backup
  was taken and no key has been escrowed**; the drill ran on disposable local databases only (item 8).

### A8.7 Carried hardening

| Item | Origin | Now |
|---|---|---|
| Overlapping saves of a project and a service deadlocked (settled by one retry) | A3 Correction 1 / A4 §88 | Relation rows written as a diff: kept rows change position only, so a save locks only the targets it adds |
| Input the builder never sends went unaudited | A5 acceptance review item 10 | A layout save with a forged block type, link or linked texts is audited as a failed change |
| More than 60 sections answered "couldn't be read" | A5 acceptance review item 6 | Said as such ("A layout holds at most 60 sections …") |
| Builder: "Nothing to save" left the editor marked unsaved; only the first issue shown; Reload kept the done marker | A5 Low items | Fixed (`Builder.tsx`) |
| Certificate guard did not read what certificate blocks draw from other records | A5 final pass I4 | Checked at publish on the rendered page |
| Top-level menu positions unique only by the service | A6 I1 | `top_position` + unique index (0012) |
| Redirects re-checked on later changes | A6 L2 | Slug-change redirects decided under locks at publish |
| Enquiry ↔ privacy text | A7 | An enquiry records the privacy page's live revision once one exists |
| A record archived while live | A1 T12 | Its live version goes offline with it |

Deferred, with the milestone each belongs to, in item 12.

## 4. Migrations and versioning model

| File | What |
|---|---|
| `0010_publishing.sql` | `published_documents` (the public read model; one per record, slug unique per type, its revision kept by a RESTRICT key), `content_references` (scope working / published), `review_comments`, `cache_generation` (a singleton), `cache_invalidations` (generation > 0), `system_job_runs`. InnoDB, `utf8mb4_unicode_520_ci`, keys `ascii_bin`. No existing table changes. |
| `0011_seed_publishing.sql` | The cache generation's row (epoch `01KA0000000000000000000000`, value 0), generated from `src/server/publishing/registry.ts` and checked by `npm run db:check`. Nothing is published by a migration. |
| `0012_menu_positions.sql` | `menu_items.top_position` (filled from `position` for today's top-level items), `uq_menu_items_top_position`, `ck_menu_items_top`. MariaDB refuses a generated column over `parent_id` (its foreign key cascades: error 1901), so the column is written by the menu service. |

**Beyond A1's catalogue** (reported, not silently added): no `scheduled_publications` (scheduling needs the cron and
`CRON_SECRET` set-up, not in this brief); `field_path` ASCII; the singleton and positive-generation checks.
`revisions` (A3's table, empty until now) is used as A1 specified.

**Versioning model.** The working copy is the editable state (A3–A7 tables); a revision is an immutable canonical
snapshot of one aggregate; `current_revision_id` points at the newest, `published_revision_id` at the live one (A3's
check constraints already refuse a published state without it); `published_documents` holds the live projection.
Snapshots carry a schema version (1); a later shape is read through upcasters (A1 §9.2), none needed yet. The
transaction that changes content writes its revisions as it closes (`contentTransaction` is re-entrant for the same
user, so a restore that replays a record's save and its layout's save is one change). Lock order is A3's (actor rows,
session, the aggregate's root FOR UPDATE, newly linked targets share-locked, own rows), then the revision rows of that
aggregate (`FOR UPDATE` of the newest), then `published_documents`, `content_references`, `redirects`,
`cache_generation`.

**Proofs:** `tests/integration/publishing-migration.test.ts` (A–G, as A5–A7: an empty database takes all 13 files; an A7
database with accounts, content, media, sections, menus with nesting and an enquiry takes exactly the three A8 files; a
second run is a no-op; the hash and order checks refuse a changed or reordered file; charsets, collations and every
constraint; no earlier row lost or changed, only `menu_items` gains its column, filled for top-level items only;
`db:check`). The A3–A7 migration tests take the three files.

## 5. Publishing and rollback verification

On MariaDB 11.4 (synthetic data, a fresh `rawasy_t_*` database per file):

| Behaviour | Where it is proven |
|---|---|
| A create is revision 1, a change revision 2, a save that changes nothing adds none; author, kind, languages changed | `publishing-workflow` "revisions" (5 tests) |
| Comparison field by field, per language; a revision of another record is never read through this one | `publishing-workflow`; `tests/unit/publishing-core.test.ts` (id-matched lists, moves vs edits) |
| Restore is a new revision from the old one; history never rewritten; a Reviewer can't restore; a stale version is refused and audited | `publishing-workflow` |
| An incomplete version can't be submitted; a complete one goes to review (a sealed `submit` revision with its note) | `publishing-workflow` |
| An Editor can't publish; a Reviewer must comment to send back; withdraw; a Reviewer approves someone else's submission (never their own) | `publishing-workflow`, `publishing-core` (the key matrix) |
| After publishing, an edit is a draft and the live document stays the published revision | `publishing-workflow` |
| Discard returns to the live version (and stays a draft when a field the person may not change differs: L2) | `publishing-workflow`, `publishing-review` |
| Rollback publishes an earlier **published** version again (a non-published one refused; an Editor denied); the replaced live version is closed (`live_until`); history gains `restore` then `publish` | `publishing-workflow` |
| Unpublish and archive take the live document offline; an archived record can't be published | `publishing-workflow` |
| A legal page's publish / unpublish / rollback needs a step-up; a missing legal review refused and audited | `publishing-review` |
| Every aggregate type: a page's layout is part of its versions and comes back with a restore; reusable sections, menus (live projection: visible items only), settings with the interface text, the form (projection without notification addresses or retention), collection orders keep versions and restore | `publishing-aggregates` |
| Enquiries never become revisions; an enquiry records the live privacy revision | `publishing-aggregates` |
| The browser: the workflow by role through the panel's dialogs, history, compare with Arabic `dir="rtl"`, restore, Admin unpublish, a Reviewer's forged publish refused and audited, the public website untouched | `e2e-admin/publishing.spec.ts` (10) |

## 6. Reference-integrity tests

| Behaviour | Where |
|---|---|
| A project's services are indexed; the service's "Used by" lists the project, working and live scopes | `publishing-workflow` |
| Linked records that are not live are warnings, not blocks (Owner decision pending, item 12) | `publishing-workflow` |
| Media that A4 does not deliver blocks a publication | `publishing-workflow` |
| A blocking flag refuses publishing; added to a live project it takes it offline at once (no version change) | `publishing-workflow` |
| The certificate guard reads what the Certificates page would draw from other records' live versions | `publishing-aggregates` |
| A reusable section in use by a working layout, or shown by a live version, can't be archived | A5's `builder-reusable`, `publishing-review` L1 |
| Relation rows written as a diff: kept rows stay, order changes move positions, only removals and additions | `publishing-aggregates` |
| A live slug change adds a 308 redirect per language; moving back retires the redirects from the address taken again; a conflicting old address refuses the publication; a first publication tells about a redirect from its new address | `publishing-workflow`, `publishing-review` L4 |
| The index stays correct under concurrency: concurrent creates and first publications by different people, an archive with an order's publication — no deadlock | `publishing-review` L3 |
| Rebuilding the index whole (`npm run content:references`) after a restore | the restore drill (item 8) |
| No duplicate listing next to A3 / A4 / A5's own "Used by" | `e2e-admin/cms.spec.ts`, `media.spec.ts`, `page-builder.spec.ts` (each failed on `d123462`) |

## 7. Security and audit review

An independent review (a separate agent, read-only, given the code and the guarantees to check, not my conclusions) read
`git diff c0e1074..d123462`. **No High finding; 1 Medium, 7 Low, Info.** Every Medium and Low is corrected
(`84ed520`, `cd9ef74`), each with a test that fails on `d123462` (`08b309d`).

| # | Severity | Finding | Correction | Test (fails on `d123462`) |
|---|---|---|---|---|
| M1 | Medium | A legal page's publish, unpublish and rollback (`legal.publish`, a sensitive key) needed no re-authentication within 10 minutes (A1-SECURITY-RBAC §3.7; A7's export enforces it) | The workflow refuses any step whose keys include a sensitive one without a step-up in the last 10 minutes (`step_up`, audited as denied); the panel shows the step-up form | `publishing-review`: publish / unpublish / rollback by an Owner signed in 11 minutes earlier refused and audited; a fresh sign-in and a client's publication unaffected (control) |
| L1 | Low | A reusable section unused in working layouts but shown by a page's live version could be archived, pulling it from that live page unseen | Archive also refused while the published reference index names it (share-locked) | `publishing-review` L1 |
| L2 | Low | "Discard draft changes" always set "no draft" although the restore keeps fields the person may not change | "No draft" only when the working copy equals the live version; otherwise it stays a draft and says so | `publishing-review` L2 (an Admin's noindex change, an Editor's discard) |
| L3 | Low | Lock-order cycle (archive: cache generation → collection order; an order's publication: the reverse) and gap locks (a locking read of a revision, document, slug or reference that does not exist yet) on which concurrent creates and first publications deadlocked | The cache record is the transaction's last write; the newest revision through the locked root's pointer; the live document read only when the root names one, then inserted or updated by its key (never `ON DUPLICATE KEY UPDATE`); references rewritten only when they existed; the live-slug check a plain read with the unique index deciding | `publishing-review` L3: 12 rounds each, deadlocks counted on the file's own connections — **12 / 12 rounds deadlocked on `d123462`, 0 now** |
| L4 | Low | A first publication did not check a redirect from its new address | Checked: told (and retired when it points at the same record) | `publishing-review` L4 |
| L5 | Low | `files.tar.gz` (private originals, enquiry attachments) took umask permissions; plaintext dumps could stay behind after a failure | Private 0700 staging inside the backup folder, every file 0600, folder 0700, nothing left after a failure | `backup-review` (integration): modes, no staging folder, a failed dump leaves an empty folder |
| L6 | Low | Backups unauthenticated (anyone writing to the storage, with the public key from the server, could forge one); restore trusted the SQL and the archive | The manifest's SHA-256 printed at creation, to be recorded outside the backup, checked by verify / restore (`--manifest-sha256`, required outside local); archive members read without extracting and refused unless regular files and folders with relative names; the client loads a dump with `--sandbox` | `backup-review` (unit: crafted headers, GNU / pax names; integration: a replaced manifest and an archive with a symbolic link refused, nothing written) |
| L7 | Low | Symbolic links not resolved; only Git folders refused; unencrypted backups allowed anywhere | Paths resolved; refused inside a repository, the application's folder and `public_html`; `--unencrypted` needed outside local; `--` before tar's names | `backup-review` (unit): a link into the repository, the application folder, `public_html` |
| Info | — | Rollback's missing-legal-review refusal not audited; the reviewer kept only in the revision message; `_` as a LIKE wildcard in the action filter; the search action echoed raw filters into its redirect; an order's restore used the wall clock; tar without `--` | All corrected (the reviewer also in the publish event's changes, A1 §4.3) | `publishing-review` (rollback audit, action filter) |
| Info | — | `live_until` is updated on old revisions | Kept and documented: the snapshot, its hash and every other column never change; `live_until` closes the live interval (A1 §1) | — |
| Info | — | The four-eyes rule compares with the submitter, not the author | As A1 T6 specifies; listed for the Owner (item 12) | — |
| Info | — | The form's projection carries `honeypotEnabled`, `minFillSeconds` | Kept: the public form needs both to render its checks (no secret) | — |
| Info | — | Any role can take a live project offline with a blocking flag | As the brief intends (safety first), audited | — |

**Guarantees the review found holding** (its items 1–11): authority from the session only (every action calls
`actionContext` first, every key exists in the seeded registry, `canApprove`, legal and certificate keys right);
optimistic concurrency on every step under the root lock; revisions written through the save services, rollback only to
published versions, refusals rolled back whole; public isolation (no public file changed, nothing public imports
`src/server`, the projection drops admin-only fields, undeliverable and private media refused, a blocking flag takes a
project offline); "Used by" exposes nothing a role can't see; redirects without loops or chains; the audit viewer's
filters bound and escaped, its search only in a sealed cookie, `redactChanges` on display, new events carry codes and
counts only; review comments plain text, length-capped, never in audit rows; backup credentials in a 0600 option file,
no secret in the backup, no shell; the privacy revision recorded under a share lock; no `dangerouslySetInnerHTML`, no
open redirect.

**Found by the admin suite, not the review:** the reference index's list repeated A3's, A4's and A5's own "Used by"
lists (three admin tests failed on `d123462` with two matching headings or links); corrected in `9b8b7f6` (working
copies already listed are left out; the reusable section's page shows no second list). The admin suite's second run found axe's
`target-size` on a dense audit log (links in a wrapped table cell 17 px apart): `d2803b9` gives the history and audit
tables' links and summaries 24 px targets, and the spec now seeds the dense case itself. The evidence capture found two
wording and layout defects, corrected in `13c5c29` (hints that still said publishing comes in a later phase) and
`361aefc` (the phone tables' Before / After and column labels).

**Audit coverage (A8.5):** every workflow step, restore, rollback, discard, refusal (denied / failed) and stale page is an
audit event with the revisions before and after; summaries name records, versions, codes and counts — never a comment's
text, a search, a person's message or a file name; the viewer distinguishes success / denied / failed and is `audit.view`
only (Owner, Admin).

## 8. Backup and restore drill evidence

**Local and disposable only:** the throwaway Docker MariaDB 11.4.13 of this session, a synthetic source database
(`rawasy_t_drill_src_*`: five test clients, three published, a published project, three media rows, test sessions), a
synthetic data folder (originals, derivatives, a private original, an enquiry attachment, and a `tmp/` upload that must
not be backed up), keys generated into a temporary folder and deleted at the end. The MariaDB client programs ran inside
the container through a local wrapper (the host has none). No production system, credential or data was touched.

| Step | Result |
|---|---|
| `keygen` | key pair written (fingerprint printed); the tool says nothing has been escrowed |
| `create` into the repository | **refused** (exit 2) |
| `create --public-key` | 4 files + manifest, 88 tables, encrypted; **manifest fingerprint printed** |
| Plaintext markers in the encrypted files | 0 in every file (gzip-decoded and raw) |
| File modes | folder 700, every file 600, **no staging folder left** |
| `verify` with a wrong fingerprint | **refused** (exit 4: "does not match the fingerprint recorded when the backup was made") |
| `verify` with the recorded fingerprint and the private key | verified: hashes, decryption, contents' hashes, complete dumps |
| `create` through a symbolic link into the application / repository | **refused** (exit 2: the link is followed) |
| `create --no-files` (plain, local) | 3 files, says "NOT encrypted" and how to keep it |
| `verify` with another key | **refused** (exit 4: not the key it was encrypted for) |
| One changed byte in `database.sql.gz.enc` | **refused** (exit 4: does not match its SHA-256) |
| `restore` into a new database and folder (sandboxed client, recorded fingerprint) | restored: 88 tables, files, a new cache epoch |
| `restore` into the same (now non-empty) database | **refused** (exit 2) |
| `restore` into a non-empty data folder | **refused** (exit 2) |
| `CHECKSUM TABLE … EXTENDED`, source vs restored | **84 / 88 tables identical**; the 4 that differ are the intended ones: `sessions` (4 rows in the source, 0 restored: never backed up), `cache_generation` (new epoch `01M6R0…` instead of `01KA0…`), `system_job_runs` (the restore's own row; the source's backup rows came after the dump), `audit_events` (the source's backup audit rows came after the dump) |
| Live documents and revisions | 4 / 4 and 17 / 17 (source / restored) |
| Files by SHA-256 | 4 / 4 identical; `tmp/` (1 file in the source) not restored |
| `db-migrate status` on the restored database | 13 applied, 0 pending, charsets right |
| `npm run content:references` on the restored database | rebuilt: 19 aggregates, 0 changed |

Also proven by tests: `tests/unit/backup-crypto.test.ts` (4: round trip, a changed byte, a cut-off file, another key),
`tests/unit/backup-review.test.ts` (4) and `tests/integration/backup-review.test.ts` (5) — item 7.

**Not done (Owner / pre-staging):** no production or staging backup, no schedule, no off-site copy, no key escrowed —
`docs/admin/A8-BACKUP-RESTORE.md` §3–§6 is the procedure, to be run by the Owner or an operator the Owner names.

## 9. Full test results

**Fresh clone of `361aefc` from GitHub** (`git clone --branch claude/new-session-5eijs6`), Node 22.22.2, the session's
throwaway MariaDB 11.4.13, Chrome for Testing 153 through an untracked wrapper config (Playwright 1.56.1's own Chromium
can't be installed here). Every suite ran once on that clone; only the public suite ran twice (below):

| Check | Result | Baseline |
|---|---|---|
| `npm ci` · both SWC binaries | ✓ · ✓ | |
| `npm audit --omit=dev` | **0** | 0 |
| `npm audit` (all) | 12 moderate, dev-only (the accepted lint and drizzle-kit chains, unchanged since A6's closure; no non-breaking fix) | 12 |
| lint · typecheck | ✓ · ✓ | |
| build | ✓, no warning, 0 dynamic-filesystem warnings | |
| packaging check (13 held back) | ✓ | |
| `db:check` | ✓ (13 migration files, seeds match the registries) | 10 files |
| unit | **392 / 392** (A8: +23) | 369 |
| integration | **578 / 578** (A8: +49) | 529 |
| admin (browser) | **176 / 176** (A8: +10), first run | 166 |
| public E2E (on `server.js`, after the image warm-up) | **611 / 612** in the first run (the known race, below); **612 / 612** in a second full run (17.8 min) | 612 |
| every A8 commit on its own (17): typecheck · lint of its files | **17 / 17 · 17 / 17** | |

**The public suite's one failure in its first run** is the homepage showcase's known hydration race (CLAUDE.md
gotcha, found in A2 at the same rate on its baseline): `commerce-capabilities.spec.ts` "/ar → #cnc-press-brake: the
homepage showcase's link opens Capabilities on that machine". The clicked machine's link stayed `tabindex=-1`, not
visible. A8 changed no public source, file or answer (item 11). Its 12 tests × 10:
- 120 / 120 at 3 workers on the A8 build;
- at 8 workers, 119 / 120 on the A8 build and **119 / 120 on the A7 baseline build** (`db587d2`), with the same
  failure each time.

The component and its tests stay frozen (the Owner's decision). The failure is reported here, and the second run
was a full run of the whole suite, not a retry of that one test.

New A8 tests: unit `publishing-core` (15), `backup-crypto` (4), `backup-review` (4); integration
`publishing-migration` (6), `publishing-workflow` (16), `publishing-aggregates` (13), `publishing-review` (9),
`backup-review` (5); browser `e2e-admin/publishing.spec.ts` (10). Inherited tests that A8 changed, each keeping its rule:
A3's "no revision exists" (now: a save publishes nothing), A3's "no publishing button" on a new record, the A3–A7
migration tests (they take 0010–0012), A5's and A6's working-copy notes (the new wording).

**Runs during development, for the record:** the first full admin run on `d123462` had 3 failures (the duplicated "Used
by" lists) and 32 tests that did not run behind them in their serial groups; the second (after the review fixes)
174 / 176 with one failure (axe `target-size` on a dense audit log) and the one test behind it; both corrected
(`9b8b7f6`, `d2803b9`) and the affected specs rerun green (publishing 10 / 10, page builder and site 49 / 49).

## 10. Mobile / desktop evidence

`rawasy-a8-evidence.zip` (not committed; the session's scratchpad): **64 captures** and 8 contact sheets. They were
taken on the final build (`361aefc`) with the admin suite's throwaway server and database, synthetic data only.

- Eight A8 screens — a client's publishing panel, version history, two comparisons (the live version against the working
  copy; the first version against the live one), the audit log, one record's audit log, and the settings' and the
  form's compact panels — at **1280 light / dark, 768, 390 light / dark and 320 px** (48).
- The workflow as it happens (1280): not ready to publish (what blocks), the submit dialog with a note, in review (the
  submitter's and the reviewer's views), the request-changes dialog, changes requested (the comment shown to the
  editor), published, published with changes in draft, **a stale page's step refused** in its dialog, the restore
  dialog, after a restore (13).
- The audit log searched and filtered (1280, 390): the words stay in the box; the measured address holds only the
  filter (`?outcome=success`).
- Roles: an Editor refused the audit log; an Editor's panel (no Unpublish); a Reviewer reading the history.
- **0 horizontal overflow** and 0 elements past the screen in all 64 (measured on each capture).
- A first capture found two defects. Both were corrected before the fresh clone, and the final capture shows them fixed: hints that still said publishing comes later
  (`13c5c29`), and the phone comparison's missing Before / After labels (`361aefc`, now tested at 390 and 320 px).
- Accessibility: axe (WCAG 2.0–2.2 A/AA + best practice) finds nothing on the panel, history, comparison and audit
  log in light and dark (`publishing.spec.ts`, with a dense audit log seeded); keyboard: every publishing step reached
  by Tab with a visible ring, the dialog takes focus and Escape returns it.
- The admin is English (A2's locked default); Arabic content is shown right to left (`lang="ar" dir="rtl"`) in the
  editors and the comparison.

## 11. Public preservation proof

Baseline: `preserve/pre-admin-a8` (`c0e1074`; its public sources equal `db587d2`'s, whose fresh-clone clean build is the
baseline). Current: the clean build of the fresh clone of `361aefc`, the last commit with code. Each server ran from its own
copy of its build (ports 3470 / 3471), so neither saw the other's render cache.

| Check | Result |
|---|---|
| Public sources | `git diff c0e1074 361aefc` touches no public path. It changes only `src/server/**`, the admin and preview route groups, `src/components/{admin,builder}/**`, tests, `drizzle/`, `scripts/`, docs, `drizzle.config.ts` (its schema list) and `package.json` (two scripts: `content:references`, `backup`). No dependency or lockfile change |
| Build output | **890 / 890** public files, none added or missing, **0 different** (114 byte-identical, 601 equal once the build id is normalised). The server chunks are grouped differently (143 identical, 32 regrouped) because the admin code grew |
| Public server entries | **16 / 16** built from identical sources (299 source files, 49 of ours), by their source maps |
| Stylesheets and scripts | CSS identical on **104 / 104** pages, JS identical on **104 / 104** |
| HTTP | **229 / 229** answers equal (102 documents, 102 page-data requests, 25 others) |
| Resting pixels (reduced motion, EN / AR × light / dark × desktop 1440 / phone 390) | **378 / 398** identical at once. The other 20 are the Arabic phone Projects gallery (light): the browser picks one photo's srcset size (`tulip-roundabout-1.webp` at `w=384` or `w=640`), the same choice A6 and A7 met. Two rounds of recaptures (3 per build per theme each, 24 in all): both builds made both choices, and every pair that made the same choice differs by **0 pixels** (16 pairs light, 22 dark). Page heights are equal in all 136 views |
| The read model | Publishing fills the database's public read model (`published_documents`) and its own records: revisions, the reference index, slug redirects, the cache record and the audit log. No public page reads any of them before A9: public files may not import `src/server/**` (lint rule, passed), and `src/content/repository.ts` is unchanged. `e2e-admin/publishing.spec.ts` publishes a test client and checks the public `/en/clients` does not show it. A slug redirect resolves nowhere (the proxy and `server.js` are unchanged) |
| Public quote form | Unchanged (handoff): no public route or Server Action stores an enquiry, as in A7 |

**The public website is unchanged.**

## 12. Remaining Owner / legal decisions

Carried, unchanged and gated (nothing in A8 activates them): real visitor enquiry collection and its public route,
SMTP and real email, stored attachments, a retention period and its schedule, consent wording, the legal pages'
pending notes, every production / staging host or account step, the dependency audit's dev-only entries.

New with A8 (each proposed, none decided or activated):

1. **Reference warnings vs blocks.** A1 §4.2 lists "references resolve" among the strict checks. A8 refuses
   publication for undeliverable media, blocking flags and certificate copy, but only *warns* when a linked record is
   not live (the renderer leaves it out, as A1 §6 describes for unpublishing). Keep warnings, or block?
2. **Revision retention** (A1 §9.4): proposed — sealed revisions kept; unsealed saves older than 90 days pruned to the
   latest 20 per record, by a logged daily job. Not implemented: no pruning runs.
3. **Scheduled publication** (A1 §7): not built (needs the 5-minute cron and `CRON_SECRET` on staging).
4. **Backups:** schedule (proposed nightly 03:15 Riyadh and before every migration / release), retention (proposed 14
   daily, 8 weekly, 6 monthly), off-site location, who holds the escrowed backup key and `AUTH_ENCRYPTION_KEY` copies,
   the first staging restore drill. Nothing is scheduled and nothing has been escrowed.
5. **Audit log:** export (A1 §14 proposes Owner-only CSV with a step-up), retention, and whether to add a hash chain
   for tamper evidence. None built.
6. **Legal pages' reviewer:** A8 asks the publisher to name who reviewed the legal text (A1 §4.3); who that
   reviewer is, and whether a separate sign-off record is wanted, is the Owner's.
7. **Who unpublishes:** the registry gives unpublish to `<resource>.publish` holders (Owner, Admin; Reviewers hold
   `publish_reviewed`, not `publish`, so they approve but do not unpublish). Confirm.
8. **Rollback after a slug change** re-applies the old slug's redirect plan; confirm that rolling back an address is
   acceptable without a separate confirmation.
9. **A5 Low items still open:** focus after removing a section, merging undo steps (A5 report backlog).

## 13. Acceptance recommendation

**Recommendation: READY for the Owner's review** (not self-approved, not Owner-approved).

- Every A8 item of the brief is built (A8.1–A8.7), locally, with T1 Option B intact: publishing fills the database's
  public read model only; no public page, route, cache, redirect or form changed; nothing deployed.
- The A7 closure came first, verified, with `preserve/pre-admin-a8` pushed before any A8 commit.
- The independent security review found no High issue; its Medium and seven Lows are corrected, each with a test that
  fails on the code before. Four more defects are corrected too, two found by the admin suite and two by the
  evidence capture.
- On a fresh clone from GitHub every suite passed, above the A7 baselines
  (unit 392 / 392, integration 578 / 578, admin 176 / 176, public 612 / 612).
  The public suite passed in its second full run: its first run hit the homepage showcase's known race, which the A7 baseline shows at the same
  rate (item 9). The production audit is 0, and every A8 commit typechecks and lints on its own.
- The restore drill passed on disposable local databases; the runbook says plainly that nothing has been escrowed and
  no production backup exists.
- The public website is proven unchanged against `preserve/pre-admin-a8` (item 11).

What remains is the Owner's, not a defect: the decisions in item 12 (reference warnings vs blocks, revision retention,
scheduling, backup schedule / retention / off-site / escrow holders, audit export and retention, the legal reviewer,
who unpublishes), and A9's preconditions (item 14).

## 14. A9 cutover plan (plan only; A9 not started)

A1-MIGRATION-PLAN §3.2 is the outline; A8 adds what the publishing layer now provides. Nothing below is done.

1. **Pre-staging account checks** (A1-ARCHITECTURE §7.3): process count, `max_user_connections`, `wait_timeout`, upload
   limits, ModSecurity, glibc/sharp, cron, SSH, backup location and quota. Key escrow of `AUTH_ENCRYPTION_KEY` and the
   backup key (A8 runbook §6) before any real data.
2. **Staging:** migrations 0000–0012, the complete importer (static source → working copies → one `import` revision per
   aggregate → publication through A8's pipeline), A6's redirects re-checked against every address (`normalizeSitePath`,
   pages win), `npm run content:references`, a backup and a restore drill into a scratch database.
3. **The database-mode release:** `CONTENT_SOURCE=database` fixed at build; `src/content/repository.ts` reads
   `published_documents` (same functions, same types); the fail-closed `cacheHandler` reading `cache_generation` /
   `cache_invalidations` (A1 §8.2); `/media/u/**` decoupled from `ADMIN_ENABLED` (A5 note); redirects resolved through
   `normalizeSitePath`; the public enquiry route wired to A7's submission service only if the Owner decides.
4. **Parity proof** (A1-MIGRATION-PLAN §8): the database-mode release against the static release of the same commit —
   files, CSS/JS, resolved payloads, HTTP, images, pixels, the full public suite — before anything goes live.
5. **Cutover:** content freeze, fresh backup, migrations, import, deploy, warm-up, smoke checks; the static release kept
   deployable as the immediate rollback until the Owner accepts A9.
6. **Owner decisions needed before A9 starts:** B16 (staging content not carried over), enquiry collection, SMTP,
   retention, the items in item 12.
