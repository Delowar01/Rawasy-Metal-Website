# RAWASY Metal Website — Admin / CMS Phase A7: Forms & Enquiries

**Brief:** "RAWASY METAL WEBSITE — A6 FINAL ACCEPTANCE & A7 FORMS / ENQUIRIES IMPLEMENTATION".
**Status:** A7 is built — **local implementation only** — and awaits the Owner's review. It is not self-approved, and
A8 is not started. Nothing was deployed: no hosting, DNS, SSL or cPanel change, nothing merged into `main`, no
production credential, no SMTP, no real email. **The public website is unchanged and collects nothing:** the quote form
keeps today's handoff (the visitor sends the prepared email or WhatsApp message), no public route or Server Action
stores an enquiry, and no new production endpoint exists (T1 Option B).
**A6:** corrected and formally closed first (the A6 report's "A6 FINAL CORRECTION AND CLOSURE" section); the rollback
checkpoint `preserve/pre-admin-a7` was pushed before the first A7 commit.

## 1. Starting and final commit SHAs

- **Start of this brief:** `bb1bbcb` (local and remote, clean; docs only after `10f862b`, A6's last code; checkpoint
  `preserve/pre-admin-a6` at `7722640`).
- **A6 closure:** `fcc37c9` (the correction), `da1fe11` (closure docs). **`preserve/pre-admin-a7` = `da1fe11`**, pushed
  before the first A7 commit.
- **Last commit with code:** `19c08c7` (the tree the fresh clone tested). Docs only after it: this report and the project memory, with the results added as they finished.
- **Branch:** `claude/new-session-5eijs6`; every push fast-forward, nothing force-pushed, nothing merged into `main`.

| Commit | What |
|---|---|
| `fcc37c9` | A6 final correction: the Contact preview reads the company settings' working copy |
| `da1fe11` | Docs: A6 closure — QA, public freeze, the checkpoint |
| `476bf2f` | A7 schema, migration 0008, generated seed 0009 (brief item 3) |
| `f6a845c` | The quote form's working copy and submission validation (item 4) |
| `230c715` | Enquiry storage (the prepared submission service), the inbox and the workflow (item 5) |
| `02cf850` | Notifications (outbox) and private attachments (item 7) |
| `ca33ed0` | CSV export and retention, configurable and inactive (item 8) |
| `67e3054` | Admin screens: forms, the inbox, an enquiry, the form preview (item 6) |
| `06a90a4` | Tests: unit, MariaDB integration, migration proofs, the browser spec (item 9) |
| `e3071c1` | The security review's corrections: 6 Low, 5 Info (item 9) |
| `7f0d2ca` | Tests of those findings, each failing on `06a90a4` (item 9) |
| `c1ed475` | README: forms and enquiries (item 10) |
| `19c08c7` | Correction found by the evidence capture: the project type's label, who assigned by name (item 9) |
| (docs) | This report and the project memory, results added as the runs finished (item 10) |

The services were committed before the screens that call them (items 7 and 8 before 6), so each commit builds on the
code it uses.

## 2. A6 closure verification

Summary (the full record is the A6 report's last section):

- **The correction** (`fcc37c9`): inside the authenticated admin preview the Contact page's location card, map and
  quotation section read the A6 working copy (optional `place` / `reach` inputs on the approved components; the public
  routes pass neither and keep today's static values). Unconfigured values fall back to today's. EN / AR, light / dark
  tested in the browser; negative control fails.
- **Acceptance checks** on a fresh clone of `fcc37c9`: production audit 0; lint, typecheck, build without warning;
  `db:check`; packaging (13 held back); unit 338 / 338; integration 470 / 470; admin 147 / 147; public 611 / 612 in the first run (a
  reduced-motion transitions timeout under extra load: 20 / 20 alone on both builds) and 612 / 612 in a second run.
- **Public preservation** against `preserve/pre-admin-a6`: build output (890 / 890 files, CSS and JS on 104 / 104
  pages), server sources, HTTP 229 / 229 answers equal, pixels 378 / 398 identical at once (the other 20: the Arabic phone gallery's srcset
  choice, made by both builds; 0 pixels between same-choice captures).
- **Closed** under the brief's authorization; accepted Low / Info items allocated to A8 / A9 (I1, I5, I6, L2's
  follow-up). Checkpoint `preserve/pre-admin-a7` pushed before A7.

## 3. A7 features

All of it is admin-side and local. Test data only ("Test …", `example.test`).

### A7.1 Form management (`/admin/forms`, `/admin/forms/[id]`)

- **The quote form as a CMS definition** (A1 `forms`, `form_translations`, `form_fields`, `form_field_translations`).
  The seed holds the form's root only (delivery `handoff`). **Copy today's form** (Owner, Admin: `forms.edit`) fills the
  working copy from the website's own form, word for word in both languages: 10 fields, their labels, placeholders,
  hints and error messages, the form's headings, button, notes, no-JS note, privacy line and messages
  (`src/server/forms/copy.ts`, from `quoteFormText()` and `src/content/contact.ts`).
- **Versioned working copy:** one save of the whole form (`lock_version`; a second tab's save after a change is
  refused as stale, its typing kept; audited). English and Arabic are equals: each language's status (missing /
  incomplete / draft / complete / needs review) is A3's `planTranslationStatus` from what changed and the form's
  "complete" / "does not affect the other language" boxes, never from the browser.
- **Fields:** required or optional (name, email and message are locked required, as today; phone and the others may be
  toggled), minimum and maximum lengths within each field's bounds, order fixed by group (details → project →
  message, today's), labels, placeholders, hints, both error messages; a field's type, key and choices are code.
- **Consent:** `notice` (today's privacy line, `{link}` once) or `checkbox` (a label and an error message in both
  languages). No consent wording is invented: choosing the box requires the Owner's words in both languages.
- **Handoff settings (controlled):** delivery mode `handoff` (default, today's) / `store` / `store_and_notify`;
  accepting files, their types, the consent mode — **the Owner only** (`forms.delivery_mode`); the retention period —
  the Owner only (`enquiries.delete`); an Admin sees them read-only and a forged change is refused and audited. The
  notification addresses, the honeypot, the minimum fill time (1–60 s, today 3), the file count (1–5) and size (1–10 MB)
  are validated settings.
- **Admin preview** (`/admin/preview/form/[id]?locale=&theme=`): the approved quote section (`QuoteSection` /
  `QuoteForm`, unchanged) drawn with the working words, EN / AR, light / dark. The public form is untouched.

### A7.2 Enquiry storage (prepared, gated)

- **Records** (`enquiries`): reference, form, language, status, assignment, submission time, source page, the visitor's
  fields as typed (trimmed), service (key, id, label at the time), project type, consent time, address and browser (for
  abuse review, under retention), spam and notification state, keep-until date, anonymization, `lock_version`.
- **References `Q-YYYY-NNNNN`:** the year in Riyadh time; numbered from a per-year counter row taken exclusively by one
  upsert and read back under that lock inside the enquiry's transaction — gapless (a rolled-back submission returns its
  number), unique (index + CHECK), proven under 20 concurrent submissions.
- **Status history, notes, files, audit** (`enquiry_status_history`, `enquiry_notes`, `enquiry_files`,
  `audit_events`), all written in the same transaction.
- **The submission service** (`src/server/enquiries/submission.ts`) is prepared for the approved cutover and **reachable
  by nothing in the build**: no route, no Server Action, no import from `src/app` (the browser spec checks the action
  manifest). Only the tests and the local test seed call it, against synthetic data.

### A7.3 Enquiry management (`/admin/enquiries`, `/admin/enquiries/[id]`)

- **Inbox** (Owner, Admin: `enquiries.view`): summary cards (new, open, answered, not assigned, assigned to me, last 7
  days) and the dashboard's Enquiries card; search (reference, name in any script, company, email, phone), filters
  (status, active, assignment), sorts (newest, oldest, reference, status), 25 a page (10–100); empty, filtered-empty,
  loading (the shell's streaming skeleton) and error states (A2's `guarded`).
- **An enquiry's page:** the request (each value as text, in its own direction; Email and Phone links), project details,
  attachments (secure download), notifications (state, attempts, last error code, "Send again" for a failed one), the
  workflow, assignment, internal notes and the history (status steps with who / when / reason, assignments).
- **CSV export:** the Owner only (`enquiries.export`), within 10 minutes of a full sign-in (step-up).
- Every screen at 1280, 768, 390 and 320 px, light and dark, keyboard-operable, axe-clean (item 7).

### A7.4 Workflow

New → Open → Answered → Closed; Answered or Closed → Open (reopen); New or Open → Closed "without an answer" only with a
reason (kept in the history). Every other move is refused. Each change runs in one transaction with the enquiry's row
locked, re-decides `enquiries.manage` there, compares the version the page showed (stale → refused, typing kept) and is
audited. Assignment only to an active Owner or Admin (read under share locks). Notes are plain text, staff only.

### A7.5 Anti-spam and validation (in the prepared service)

In order, each refusal before anything is stored: exact Origin (and `Sec-Fetch-Site`); declared body and text-field
limits (64 KB, 32 KB of text, plus the form's file budget); the form must store; per address 5 in 10 minutes and 20 a
day (IPv6 by its /64); the honeypot (any value but an empty string trips it); a signed timing token (HMAC-SHA256, key
derived from `AUTH_ENCRYPTION_KEY` for its own purpose, at least the form's minimum fill time old, at most 2 hours,
single use); strict field validation against the working definition (today's rules and the form's own messages;
unknown fields refused; control and direction-override characters refused); per email address (A2's normalization) 5
an hour. Then the form is re-read under a share lock and must still be the version the checks read. No CAPTCHA and no
third-party service.

### A7.6 Notifications

`email_outbox` rows are written in the enquiry's transaction for `store_and_notify`: the reference and an admin link
only — **no personal data in mail**. `npm run email:outbox` (by hand; no HTTP route, no schedule) sends through A2's
mailer: `disabled` (default: rows stay pending and say `mail_disabled`) or the local `sink`. Claims are leased by one
conditional UPDATE; an outcome is written only while its own claim holds; retries back off 1, 5, 15, 60, 240 minutes;
after 5 attempts `failed`, and an Owner or Admin may queue it again (audited). **No SMTP and no provider chosen**: a
future transport plugs into `Mailer` (item 9).

### A7.7 Attachments (infrastructure; public acceptance off)

Accepted only when the Owner turns files on for a storing form (off in the seed). The bytes decide (A4's signatures:
PDF with its end marker, JPEG, PNG — never SVG, office or executable files) and must agree with an extension on the
form's list; count and size limits; stored in the private `enquiries` area of `RAWASY_DATA_DIR` (outside the release,
under a key the server makes, opened under the real root with `O_NOFOLLOW`); downloaded only through
`/api/admin/enquiries/{id}/files/{file}` by `enquiries.view` (the file must belong to the enquiry in the address), as an
attachment (`nosniff`, `no-store`, sandbox CSP), the saved name always ending in the stored extension, every download
and refusal audited. Never a public URL, never the image optimizer.

### A7.8 Export and retention

- **CSV:** RFC 4180 quoting, a BOM for spreadsheet programs, every cell that a spreadsheet would read as a formula
  (`=`, `+`, `-`, `@`, tab, CR after leading spaces) written as text with a leading apostrophe; at most 5,000 rows;
  anonymized rows blank; built in memory and saved by the browser (never stored on the server); audited with the count
  and the filters' kinds, never the search text.
- **Retention:** configurable (`forms.retention_days`, 30–3,650 days, the Owner only) and **inactive**: no period is
  chosen, nothing runs on a schedule, the admin offers no deletion. `npm run enquiries:retention` shows what a period
  would affect; `--apply` (refused with no period) anonymizes (personal fields, notes, reasons, files, mail bodies;
  unsent mail cancelled), keeping references, dates and history steps; audited with counts.

## 4. Migrations and seed

- **`drizzle/0008_forms_enquiries.sql`** (from `src/server/db/schema-forms.ts`): 10 tables — `forms`,
  `form_translations`, `form_fields`, `form_field_translations`, `enquiries`, `enquiry_reference_counters`,
  `enquiry_files`, `enquiry_notes`, `enquiry_status_history`, `email_outbox` — all `utf8mb4_unicode_520_ci`, ASCII keys
  `ascii_bin`, ULID ids, `DATETIME(3)` UTC; checks: the form key, retention 30–3,650 or NULL, fill time, file limits,
  positions, the reference pattern, enumerations; foreign keys to users, services, the form and the enquiry (files,
  notes and history cascade with their enquiry).
- **`drizzle/0009_seed_forms_enquiries.sql`** (generated by `scripts/generate-access-seed.mjs` from
  `src/server/forms/registry.ts`, checked by `npm run db:check`): the quote form's root row only — `handoff`, enabled,
  honeypot on, 3 s, the privacy notice, no stored attachments, 5 files / 10 MB / `.pdf,.jpg,.jpeg,.png` when allowed, no
  retention period. No field, text or enquiry: set-up copies today's form.
- No new permission: A2's registry already holds `forms.edit` / `forms.publish` / `forms.delivery_mode` and
  `enquiries.view` / `manage` / `export` / `delete`.
- **Proofs on MariaDB** (`tests/integration/forms-migration.test.ts`, A–G): applied on an empty database and over A6's
  data; idempotent re-run; journal order and hashes; charsets and collations; the seed equal to the registry; A2–A6
  data untouched; the A3–A6 migration tests take the two new files.

## 5. Security, RBAC and privacy review

**RBAC (registry keys only, never role names):**

| Action | Key(s) | Owner | Admin | Editor | Reviewer |
|---|---|---|---|---|---|
| Read the form definitions, the forms list | `content.view` | ✓ | ✓ | ✓ | ✓ |
| Set up / save the form's words and fields | `forms.edit` | ✓ | ✓ | – | – |
| Delivery mode, attachments, their types, the consent mode | `forms.edit` + `forms.delivery_mode` | ✓ | – | – | – |
| The retention period | `forms.edit` + `enquiries.delete` | ✓ | – | – | – |
| The form preview | `content.view` + `preview.use` | ✓ | ✓ | ✓ | ✓ |
| The inbox, an enquiry, its attachments | `enquiries.view` | ✓ | ✓ | – | – |
| Workflow, assignment, notes, a notification retry | `enquiries.manage` | ✓ | ✓ | – | – |
| CSV export | `enquiries.export` + a step-up within 10 minutes | ✓ | – | – | – |

Every screen checks the session (`requireActor`) and its key; every Server Action calls `actionContext` (admin gate,
session, same origin, permission; the export's key is sensitive, so the step-up is enforced there) before it reads its
input; every service re-decides the key inside its transaction (`contentTransaction`: the actor's and session's rows
locked first), locks the form's or enquiry's row, compares the version the page showed and audits refusals (`denied`)
and stale changes (`failed`). The attachment route checks the gate, the session, the origin and `enquiries.view`, and
answers "not found" to anyone else and to a file under another enquiry's address.

**Privacy:**
- Enquiries and attachments are private: never public, never in the preview's data, never in a public URL, never
  through the image optimizer; attachments in a private storage area outside the release.
- Audit summaries, labels and changes carry the reference, ids, statuses and counts — never a name, address, phone,
  message, note, reason, file name or search text (tested on every audit row the specs produce). The received event
  stores no client address (the enquiry row holds it, under retention).
- Page titles carry no personal data ("Enquiry", the reference only in the heading). Notification mail carries the
  reference and an admin link only.
- Exception recorded for the Owner: the inbox's search is a GET form (like every list), so typed search terms are in
  the list's address (item 9).
- No privacy-policy wording or consent declaration was invented: the consent box needs the Owner's words; retention
  has no period.

**Independent security review** (a separate reviewer, static review of every A7 file and the A6 correction, no files
changed): **no High or Medium**. 6 Low and 5 Info, all addressed in their own commit with tests that fail on the code
before (`tests/unit/enquiries-review.test.ts` 5, `tests/integration/enquiries-review.test.ts` 11):

| # | Finding | Correction |
|---|---|---|
| L1 | A long attachment name cut for the download header could end in another extension (`….bat.pdf` → `….bat`) | `downloadName`: the stored and the downloaded name always end in the extension the bytes proved |
| L2 | A visitor's email could carry mailto parameters (`?bcc=…&body=…`) into the Email link; Arabic digits left the Phone link empty | The domain is held to letters, marks, digits, dots and hyphens; `mailtoHref` percent-encodes the address; `telHref` dials Arabic digits |
| L3 | `?sort=constructor` reached `sql.raw` through `in` (a 500; no injection: fixed text) | `Object.hasOwn(SORTS, …)` |
| L4 | The received event copied the client address into the audit trail; close-without-answer reasons survived anonymization | No address in that event; retention clears the reasons |
| L5 | Retention counted files it could not remove; strays were invisible | Only removed files counted, the others returned and printed (exit 4); the media maintenance report lists strays in the `enquiries` area (keys only, left out of the view for roles without private access) |
| L6 | The honeypot checked only string values | Any value but an empty string trips it |
| I7 | Rate-limit keys easy to vary (email case and compatibility forms; one IPv6 /64 = 2^64 addresses) | Per-email key through A2's `normalizeEmail`; per-address key by the IPv6 /64 (`addressBucket`) |
| I8 | Settings read before the transaction (files turned off mid-submission went unnoticed); a chunked body declares no size | The form is re-read under a share lock and must be the version the checks read (`changed`); the stream cap is written into the service's contract for A9's route |
| I9 | Search terms in the inbox's address | Documented for the Owner (item 9); the screen's comment corrected |
| I10 | A sender slower than its lease could overwrite another sender's claim; an anonymized enquiry's failed row could be retried and sent empty | Outcomes written only while the claim holds (`superseded` counted); a row without a body is cancelled; retention cancels unsent rows; a retry of an anonymized enquiry is refused |
| I11 | A storage failure's error carried the driver's message, which holds the INSERT's values | `SubmissionStoreError`: the error code only, no cause kept |

Checked sound by the review: nothing reaches the submission service; every authorization point above; no IDOR on
attachments; bound parameters only; the timing token (purpose-derived key, constant-time comparison, skew 60 s,
single use); reference allocation; the signature checks (no SVG); CSV formula neutralisation; no markup rendering
(`dangerouslySetInnerHTML` nowhere); the A6 correction's optional inputs.

## 6. Test results

Fresh clone of `19c08c7` (the last code), Node 22.22.2, MariaDB 11.4.13 (local Docker), Playwright 1.56.1 driving the
container's Chrome for Testing 153 through untracked wrapper configs (as in A5 and A6). Every suite in its first run:

| Check | Result | Baseline (A6 closure) |
|---|---|---|
| `npm ci` | pass (403 packages; `@next/swc-linux-x64-gnu` present) | |
| `npm audit --omit=dev` | **0 vulnerabilities** | 0 |
| `npm audit` (all) | 12 moderate, dev-only (item 9) | 12 |
| `npm run lint` / `npm run typecheck` | pass / pass | |
| `npm run build` (no database settings) | pass, **no warning** | |
| `npm run db:check` | pass: **10** migration files, seeds match the registries | 8 |
| Packaging check | PASS: 0 of 13 held-back files in the archive; 111 / 111 public files; 102 sitemap pages | same |
| Unit | **364 / 364** | 338 |
| Integration (MariaDB) | **529 / 529** | 470 |
| Admin browser (every spec, the parity project included) | **164 / 164** in the first run (29.3 min) | 147 |
| Public E2E (against `server.js`, after the warm-up: 1,484 / 1,484 sizes) | **612 / 612** in the first run (23.5 min) | 612 |

**New A7 tests:**
- **Unit (26):** `forms-registry` (12: the quote form's fields, words and choices equal to the website's form; limits; the
  workflow; references), `enquiries-submission` (9: the timing token, field checks, CSV cells, project-type labels),
  `enquiries-review` (5: the review's L1, L2, L3, I7).
- **Integration (59):** `forms-definitions` (9: set-up, saves, stale, the Owner's settings, statuses, audit),
  `enquiries-submission` (15: every refusal before storage, references gapless under 20 concurrent submissions,
  attachments by their bytes, nothing left behind, notifications without personal data), `enquiries-workflow` (17:
  lists, the workflow, stale pages, roles, assignment, notes, the audit trail's privacy, downloads, export, retention,
  the outbox), `forms-migration` (7: proofs A–G), `enquiries-review` (11: the review's findings); the A3–A6 migration
  tests take 0008/0009.
- **Admin browser (17, `e2e-admin/enquiries.spec.ts`):** the Enquiries group by role; the form's set-up, editing, the
  Owner's settings closed to an Admin, errors with typing kept, a stale tab, the preview; synthetic enquiries through
  the prepared service; the inbox (summary, search, filters, sorting, empty states); an enquiry's workflow step by step,
  the reason, reopening, assignment, notes, a stale tab; a private attachment (Admin download audited; 404 to an Editor,
  to another enquiry's address; 401 without a session); the CSV export (not offered to an Admin, the Owner after a
  step-up, formulas as text, audited); forged actions of a Reviewer and an Editor refused and audited; the submission
  service absent from the build's action manifest; every screen at 1280 / 768 / 390 / 320 in light and dark, nothing
  past the screen, axe clean; the gate off (every A7 address the public 404 path, the file route 404, no database
  connection); the public Contact page byte for byte unchanged.
- **Proven failing before their fix:** the 16 review tests on `06a90a4` (unit 0 / 5, integration 0 / 11); the label and
  history tests on `c1ed475`.

**Earlier runs on the working checkout** (before the fresh clone): unit 363 / 363 and integration 529 / 529 on
`7f0d2ca`; admin 164 / 164 on `7f0d2ca`'s build; the A7 spec alone 17 / 17 on `7f0d2ca` and on `19c08c7`.

**How to run:** README, "Admin (local development)", part 9 and "Tests".

## 7. Desktop / mobile evidence

`rawasy-a7-evidence.zip` (not committed, as in A2–A6; session scratchpad, 75 files, about 22.5 MB): 64 full-page
captures and 8 contact sheets, from the admin suite's throwaway database with synthetic enquiries
(`.evidence/a7.capture.ts`, untracked).

- **Every A7 screen** (forms list, form editor, inbox, an enquiry, one with a failed notification, one closed with a
  reason) at 1280 light and dark, 768, 390 light and dark, and 320 px.
- **States:** the forms and the form before set-up, the empty inbox, a filtered empty inbox, the form's field errors,
  the stale message (a second tab), the reason asked before closing without an answer, the export behind the step-up.
- **Roles:** an Admin seeing the Owner's settings read-only and no export; an Editor reading the form, refused the
  inbox, and the Editor's dashboard (no Enquiries card); the Owner's dashboard with it.
- **The form preview** in English and Arabic, light and dark, at 1280, 390 and 320.
- **Measurements:** 0 horizontal overflow and 0 elements past the screen in all 64 (sticky bars set static for the
  captures). The browser spec checks the same at 1280 / 768 / 390 / 320 in light and dark, with axe (WCAG 2.0–2.2 A / AA
  + best practice) clean at 1280 light and 390 dark. Every control is a native button, link, input, select or
  details element (keyboard-operable as such, with A2's visible focus); A7 adds no keyboard walkthrough test of its own
  (A2's shell keyboard test still runs).
- **Found by the capture and corrected** (`19c08c7`): the enquiry page showed the project type's stored key, and the
  history named who assigned with their email.

## 8. Public preservation proof

Against `preserve/pre-admin-a7` (`da1fe11`; its public sources are `fcc37c9`'s, whose clean build is the baseline):

- **Sources.** `git diff da1fe11..19c08c7` touches no public file: nothing under `src/components/commerce`,
  `src/app/(commerce)`, `src/content`, `src/i18n`, `src/lib` or `public/`, and not `global-not-found`, `src/proxy.ts`,
  `next.config.ts`, `server.js` or the lockfile. `package.json` gains two CLI scripts only (no dependency). The public
  quote form (`QuoteForm.tsx`, its golden outputs in `commerce-contact.spec.ts`) is unchanged and still hands off.
- **Build output** (the fresh clone's build copied right after `next build`): 890 / 890 public files, none added or
  missing; every prerendered page, page data, segment and meta file equal — 114 byte-identical, 601 equal once the
  build id and hashed asset names are normalised, 0 different; stylesheets and scripts identical on 104 / 104 pages.
- **Server code:** 28 server-bundle files differ by chunk grouping (admin code now imports more content modules); all
  16 public entries are built from the same 299 source files (49 of ours) with identical content.
- **HTTP:** 229 / 229 answers equal — status, the compared headers and the bodies once the build id and hashed asset
  names are normalised: 102 documents (`/en/contact`, `/ar/contact` among them), 102 page-data requests and 25 others
  (404s, `/admin` and `/api` paths with the gate off, `/media`, the image optimizer). Each server on its own fresh copy
  of its clean build, the admin gate off (production without `ADMIN_ENABLED`).
- **Pixels** (resting, reduced motion; 17 pages × EN / AR × light / dark × 1440 / 390; 398 captures per build): **377
  identical at once**; page heights equal in all 136 views. The other 21:
  - 20 screens of the Arabic Projects gallery on a phone (dark): the browser's timing choice of one gallery photo's
    srcset candidate (`tulip-roundabout-1.webp` at `w=384` or `w=640`), the effect the A5, A6 and A6-closure freezes
    recorded. Recaptured three times per build per theme: every two captures with the same choice are pixel-identical
    (0 pixels in 17 such pairs, between the builds and within one), every pair with different choices differs; 21,401 px
    high in all 12 runs. This baseline build made both choices in the A6 closure's recapture.
  - 1 capture of the Arabic Projects page on the desktop (dark): 25 pixels in rows 5,398–5,404. Recaptured four times
    per build, alternating: all 8 captures pixel-identical to each other (0 pixels in 28 pairs), 9,219 px high each — a
    capture-timing difference that did not reproduce.
- **Public E2E:** 612 / 612 in the fresh clone's first run (after the image warm-up).
- **In the browser:** the A7 spec records `/en/contact` and `/ar/contact` before any A7 data exists and compares them
  byte for byte after the form's working copy, a storing form and stored enquiries exist (equal); the A6 parity tests
  keep comparing the preview with the public pages.
- **No collection path:** no route or Server Action reaches the submission service (`server-reference-manifest.json`
  checked by the spec); with the gate off every A7 address is the public 404 path and no database connection is made
  (the spec's counting stand-in database).

## 9. Unresolved Owner / legal decisions

Nothing below was guessed; each stays gated (off, empty or the Owner-only setting) until decided.

**Owner and legal decisions (A7 brief §5):**
1. **Handoff versus storing, and when.** The public form stays `handoff`. Switching it to `store` /
   `store_and_notify` is a setting (the Owner's) plus the A9 cutover's route; both need the Owner's go-ahead.
2. **Retention period and privacy-policy wording** (legal review): no period is chosen; the privacy page's wording about
   stored enquiries, the visitor's address and browser kept for abuse review, attachments and notifications is not
   written (the legal pages' pending notes still block launch).
3. **Consent:** stay with today's notice, or a checkbox — its words in both languages are the Owner's.
4. **Attachments:** whether stored submissions accept files, which types (PDF / JPEG / PNG available), how many and how
   large (today's form allows 5 × 10 MB).
5. **Notifications:** who receives them; the SMTP provider, sender address and domain records (SPF / DKIM / DMARC), the
   credentials (pre-staging, never in Git); how the outbox runs (host cron calling a CLI, or the A1-planned
   `/api/internal/*` route with `CRON_SECRET` — not built: no new endpoint in A7).
6. **Who may export:** the registry gives `enquiries.export` to the Owner alone (with a step-up); confirm or change.
7. **Inbox search in the address** (review I9): accept the GET search (terms in the browser's history and the host's
   access log), or switch the search to a POST that keeps terms out of the address.
8. **Spam limits:** 5 per address in 10 minutes, 20 a day (IPv6 per /64), 5 per email address an hour, 3 s minimum fill
   time, 2-hour token; no CAPTCHA (A2 default) — confirm the values before activation.
9. **Dev-only audit entries:** 12 moderate (the accepted `drizzle-kit` chain plus `minimatch` in the lint toolchain,
   published after A6); no non-breaking fix; production 0. Accept, or authorize a toolchain update.

**Carried, not A7's:** A9's decoupling of `/media/u` from `ADMIN_ENABLED`; the reduced-motion press (`scale: none`);
the legal pages' pending notes; pre-staging account checks (process count, upload and body limits, ModSecurity, mail,
cron) and key escrow; RAWASY's confirmations from A6 (place link, SEO description, share image, company facts).

## 10. A7 acceptance recommendation

**READY for the Owner's acceptance review.** Not self-approved; A8 is not started.

- Every authorized item A7.1–A7.8 is built, local and gated: the quote form's working copy and preview, enquiry
  storage prepared but reachable by nothing public, the inbox, workflow, assignment, notes and history, notifications
  through an outbox with no SMTP, private attachments, the Owner's formula-safe export behind a step-up, and retention
  configurable but inactive.
- The independent security review found no High or Medium issue; its 6 Low and 5 Info findings are corrected, each
  with a test that fails on the code before. The evidence capture's two display findings are corrected the same way.
- Every suite passed in its first run on a fresh clone, above the A6 baselines (unit 364, integration 529, admin 164,
  public 612); the production audit is 0.
- The public website is proven unchanged against `preserve/pre-admin-a7` (sources, build output, server sources, HTTP,
  pixels, the public suite). Nothing collects customer data.
- Owner and legal decisions remain open (item 9); each is gated until decided. The 12 dev-only audit entries are
  recorded there.

## 11. Proposed A8 roadmap (not started)

**A8 — Publishing, Versions, Audit & Backup Safety** (locked roadmap; not started, needs the Owner's authorization).
Proposed scope, from A1-PUBLISHING-VERSIONS and the items earlier phases allocated to it:

1. **Revisions in use:** immutable snapshots of every working copy (pages, services, projects, machinery, industries,
   clients, certificates, layouts, reusable sections, site controls, the quote form) on review and publish; history,
   compare and restore into the working copy (never over a newer one without the version check).
2. **The publish workflow:** draft → in review → published per language (`review`, `publish_reviewed`; certificates
   published by the Owner only); `published_documents` public projections written in the publishing transaction, still
   read by nothing public until A9; unpublish and archive.
3. **The reference index** (`content_references`): which page, section or record uses a media item or a record, so
   "Used by", the unused filter and Trash warnings see sections too (A4/A5 note); the rendered-page certificate check
   (A5 I4).
4. **Slug changes and redirects:** automatic redirects on a published slug change, updating or warning on existing
   ones (A6 L2's follow-up); A1's menu index (A6 I1).
5. **The audit log in the admin** (`audit.view`): filters by actor, entity, action, outcome and time; no personal data
   (A7's rule); export for the Owner with a step-up.
6. **Backup safety:** a documented, scripted database backup (consistent snapshot) and media / private-area backup,
   checked restores into a scratch database, the restore's new cache epoch (A1 §8), key escrow and retired key versions
   kept while a backup needs them; the `backup required outside APP_ENV=local` rule of the migration runner exercised.
7. **Hardening carried:** A3's relation rows written as a diff (the overlapping-save deadlock), A5's Low / Info items
   allocated to A8, A6 I1.
8. **Not in A8:** the public site reading the database, the content import, the cache handler, the public enquiry route
   — all A9's cutover.

Tests as in A2–A7 (unit, integration on MariaDB with migration proofs, admin browser at 1280–320 px with axe, the public
suite and the freeze proof against `preserve/pre-admin-a8`).

## A7 FINAL CORRECTION AND CLOSURE

**Brief:** "RAWASY METAL WEBSITE — A7 FINAL ACCEPTANCE & A8 IMPLEMENTATION AUTHORIZATION", items 2 and 3. The Owner
authorized formal A7 technical closure once the privacy correction passed verification and no material A7 defect
remained. Technical closure authorizes nothing else: no real visitor enquiry is collected, no SMTP or real email, no
stored attachments, no retention deletion — those stay the Owner's (and legal review's) decisions.

### The correction: the inbox search never reaches an address

The search for a name, an email or a phone number was a GET form (`?q=` in the address bar, the browser's history, the
host's access log and every page link of the list) — recorded for the Owner in item 5 above; the brief made it a
correction. Now (`2ce4889`, tests `db587d2`):

- The search form posts to a Server Action (`searchEnquiriesAction`, `enquiries.view`, audited when refused) that keeps
  the search in a cookie of its own, `__Host-rawasy_enq_search`: sealed with AES-256-GCM under the active
  `AUTH_ENCRYPTION_KEY` version (the browser holds ciphertext only), bound to the user's id and a 2-hour expiry (the
  associated data: another user's or an expired seal opens as no search), HttpOnly, Secure, SameSite=Strict, no expiry
  date (gone when the browser closes). `src/server/enquiries/search-state.ts` (framework-free), `src/server/admin/enquiry-search.ts`.
- The list's address carries only the filters that hold no personal data (status, assignment, sort, size, page:
  `listAddress`); pagination, sorting and filters keep working with the search applied from the cookie; an old
  `?q=` address is redirected to the same list without it (the words are dropped, never applied).
- "Clear", an empty search, sign-out (with the session cookie) and every sign-in remove it; a search sealed for another
  user never opens. The CSV export reads the same sealed search on the server (what is exported is what the list shows).
- Nothing of a search reaches the audit log, analytics (there are none), a redirect location or a generated link; the
  search box is `autocomplete="off"`.

Tests: `tests/unit/enquiries-search-state.test.ts` (5: round trip, ciphertext only, another user, expired and far-ahead
seals, a changed byte, a retired key, malformed values, cleaning, the list's address never carries the search) and two
new tests in `e2e-admin/enquiries.spec.ts`: the privacy walkthrough (every request URL, every `Location` header, every
main-frame navigation and every link watched for the search's words; the cookie's flags and its absence from
`document.cookie`; paging with the search kept; an enquiry opened and Back; the export matching the list; an old `?q=`
address; Clear; sign-out and another user's sign-in on the same browser; no search words in any audit row; a Reviewer's
forged search refused and audited) and the **keyboard walkthrough of the A7 screens** (Tab only, a visible focus ring at
every stop: the search with Enter, opening an enquiry, a note, Open, Close without an answer with Space and its reason,
the assignment, the form editor's sections with Enter, Save form, the forms list, the dashboard's card). On the code
before the correction the privacy test fails at its first search (7 passed, 1 failed, 11 not run); on the correction
19 / 19.

### Closure verification (fresh clone of `db587d2`)

| Check | Result |
|---|---|
| `npm ci` · both SWC binaries | ✓ · ✓ |
| `npm audit --omit=dev` | **0** |
| `npm audit` (all) | 12 moderate, dev-only (the accepted lint / drizzle-kit chains; no non-breaking fix) |
| lint · typecheck | ✓ · ✓ |
| build | ✓, no warning, 0 dynamic-filesystem warnings |
| packaging check (13 held back) | ✓ |
| `db:check` | ✓ (10 migration files, seeds match the registries) |
| unit | **369 / 369** (364 + the 5 search-state tests) |
| integration | **529 / 529** |
| admin (browser) | **166 / 166** (164 + the privacy and keyboard tests), first run |
| public E2E | **612 / 612**, first run (after the image warm-up, 1,484 / 1,484) |

Public freeze against `preserve/pre-admin-a7` (its public sources `fcc37c9`, clean builds on fresh copies): no public
source changed (`git diff 19c08c7 db587d2` over every public path: empty).

| Check | Result |
|---|---|
| build output | 890 / 890 public files, none added or missing, 0 different (114 identical, 601 once normalised) |
| CSS and JS per page | 104 / 104 identical |
| against the A7 QA build (`19c08c7`) | 890 / 890 public files, 0 different |
| HTTP | 229 / 229 answers equal (102 documents, 102 page-data requests, 25 others) |
| resting pixels (EN/AR × light/dark × 1440 / 390 px, reduced motion) | **396 / 398 identical at once** |

The two other captures, both the Projects page on the desktop in the dark theme: Arabic, 25 pixels — 8 recaptures per
build, every pair across the builds 0 pixels apart; English, 48,698 pixels of one gallery photo (`lighting-tree-1`,
rows 5,154–5,382) — 12 recaptures per build: 23 of the 24 identical across the builds, and once more the same variant on
the current build, with the same image sources chosen and the photo's optimized bytes identical on both servers at every
width (sha256, 9 sizes). Both servers deliver the same HTML, CSS, JS and image bytes, so the variant is the browser's
drawing of that photo (a decode-timing choice), not the build.

**No material A7 defect remains.** The A7 items the Owner keeps (no real collection, SMTP, attachments, retention period,
consent wording) are decisions, not defects (item 9 above). **A7 is technically closed**; rollback checkpoint:
GitHub branch `preserve/pre-admin-a8` at the closure docs commit, pushed before any A8 commit.
