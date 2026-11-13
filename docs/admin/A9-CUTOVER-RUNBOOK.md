# A9 — Hosting checklist, staging rehearsal and the cutover runbook

**Status: prepared for the Owner's approval. Nothing here has been run on Namecheap, staging or production.** A9 was
built and proven on disposable local databases only (the A9 report, items 5–8). Every step below that touches the
hosting account, a staging or production database, DNS or the live site needs the Owner's explicit go-ahead for that
environment first (the A9 brief §5). No step enables SMTP, stored enquiries, attachments, automatic retention, a backup
schedule or off-site copies.

Read with: `A1-ARCHITECTURE.md` §7 (hosting facts and checks), `A1-MIGRATION-PLAN.md` §3.2, §8, §9 (cutover outline,
parity proof, rollback), `A8-BACKUP-RESTORE.md` (backups and restore), the README ("Namecheap Stellar Plus deployment").

## 1. What changes at the cutover

- **One switch, fixed at build:** `CONTENT_SOURCE`. `static` (the default) is today's release: `src/content/*`, every
  page prerendered. `database` builds the same code so that every public page renders from the published documents
  (`published_documents`), the media A4 delivers (`public_media`) and the active redirects, per request, kept by a
  fail-closed page cache (`src/server/public/cache-handler.cjs`). A database build needs `NEXT_PUBLIC_SITE_URL` at
  build (canonical and share addresses never come from the database).
- **Rollback is the previous archive.** The static release archive stays deployable until the Owner accepts A9;
  redeploying it serves the static content again at once. The database is left as it is (edits made after the cutover
  stay there for the next attempt).
- **The admin gate is separate.** A database release serves public content whatever `ADMIN_ENABLED` says (and
  `/media/u/**` with it). Whether the admin itself runs in production (`ADMIN_ENABLED=1`) is the Owner's decision; with
  it off, the published content cannot be changed until it is turned on.

## 2. Hosting compatibility checklist (A9.1)

Platform facts are A1-ARCHITECTURE §7.1's (official Namecheap pages); none of them is a measurement of the RAWASY
account. Each row below is **to be verified on the account** before staging, by the Owner or with the Owner's approval;
until then it is an open item, not a pass.

| # | Check | How | Needed for | Blocks |
|---|---|---|---|---|
| H1 | Node.js 22.22.x in "Setup Node.js App"; Passenger start file `server.js` | cPanel | both releases | staging |
| H2 | glibc ≥ 2.28 (`ldd --version`) — sharp 0.35.5's prebuilt binaries | Terminal / SSH | media processing, the image optimizer | staging |
| H3 | SSH or cPanel Terminal available | Namecheap support / cPanel | migrations, imports, backups, the 2FA reset CLI | staging |
| H4 | MariaDB: `VERSION()`, `@@character_set_server`, `@@collation_server`, `@@time_zone`, `@@sql_mode`, `@@max_user_connections`, `@@wait_timeout`; `SHOW CREATE USER` (authentication plugin: `mysql_native_password`, not ed25519/PARSEC — mysql2 lacks those); `SHOW GRANTS` (CREATE, ALTER, INDEX, LOCK TABLES, TRIGGER) | phpMyAdmin or `mariadb` | migrations, the pool | staging |
| H5 | Connection budget: `P × (L + 1) + R ≤ U` — P app processes (measured), L = `DB_POOL_LIMIT` (2), **+1 per process for the page cache handler (A9)**, R = 5 reserved (cron, CLIs, phpMyAdmin), U = `max_user_connections` | load test + `SHOW PROCESSLIST` | database release | production |
| H6 | App processes and lifecycle: distinct process ids under load; first request after 10 / 30 / 60 idle minutes; what a restart does (each process keeps its own page cache in memory, at most 400 pages; correctness does not depend on the count) | staging load test | database release | production |
| H7 | Memory: resident size of one database-release process after warm-up (both languages, 102 pages, images) against the 2 GB account limit and `maxEntryProc` 30 | cPanel Resource Usage during H6 | database release | production |
| H8 | Response times: first render of each page (no cache) and cached answers, on the account | warm-up script timings | database release | production |
| H9 | `RAWASY_DATA_DIR` outside `public_html` and the app folder; filesystem quota; inodes (300,000) | Terminal | uploads (A4) | staging |
| H10 | Upload limits the app sees (5 / 12 / 15 / 20 MB; ModSecurity) | staging uploads | the admin's media library | admin in production |
| H11 | Cron: a job every 5 minutes, never more than 5 at once (none is configured by A9) | cPanel | later scheduled jobs | — |
| H12 | Backups: an AutoBackup test restore; `mariadb-dump` available; **an off-site location, retention and key custody chosen by the Owner** (A8 brief, A9 Owner defaults: no automatic production backups before that) | cPanel / Owner | production database | production |
| H13 | Mail and DNS (SPF, DKIM, DMARC) — only if the Owner later enables SMTP (it stays off) | DNS panel | none in A9 | — |
| H14 | `X-Forwarded-For` hops the host adds (`TRUSTED_PROXY_HOPS`) | `curl` against a staging page that logs the header | admin sign-in limits | admin in production |

**Known blockers today:** H1–H5, H9 and H12 are unverified (no access from this session, by design); the legal pages
have no named legal reviewer (they stay unpublished in a database release until one is named, so `/en/privacy` and
`/en/terms` would answer 404 — the footer links them); no off-site backup location or key custody exists.

## 3. Staging rehearsal (requires the Owner's go-ahead for staging)

Staging is a separate cPanel Node app with its **own** database and data folder; never the production database.

1. **Prepare the database.** Create the staging database with `utf8mb4` / `utf8mb4_unicode_520_ci`; record H4.
2. **Configure** (cPanel environment, never in Git): `DB_*`, `DB_POOL_LIMIT=2`, `APP_ENV=staging`, `AUTH_ENCRYPTION_KEY`
   (staging's own, escrowed as A1-SECURITY-RBAC §12 says), `NEXT_PUBLIC_SITE_URL=<staging address>`,
   `RAWASY_DATA_DIR=<outside public_html>`; `ADMIN_ENABLED=1` only if the rehearsal includes the admin.
3. **Migrate:** `node scripts/db-migrate.mjs up` (outside `APP_ENV=local`, once the database has tables, it requires
   `--backup-file=<path>` of a backup under 60 minutes old; an empty database needs none).
4. **Release media:** `npm run media:import-release` — 143 release files registered; the 13 held back restricted.
5. **The Owner account:** `node scripts/admin-bootstrap.mjs` (the Owner completes the setup link, password and 2FA).
6. **Import:** `npm run content:import -- --owner=<owner email> --dry-run` (nothing written; read the reconciliation),
   then without `--dry-run`, with `--report=<file>` (0600). The legal pages stay unpublished unless the Owner names
   their reviewer: `--legal-reviewer="<name>"` (A9 Owner default: verified review and explicit approval first).
7. **Repeat the import** once: every row must read `unchanged` (idempotence on the real database).
8. **Build the database release** from the **same commit** as the static release it replaces, on a local Linux machine
   (README): `CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=<address> npm run build`, then
   `node scripts/package-namecheap.mjs` (it reports "Content source of this build: database" and checks the cache
   handler is packed).
9. **Deploy to staging** as the README describes (upload, extract, Run NPM Install, restart), then warm the pages and
   images: `node scripts/warm-images.mjs <staging address>` and one request per sitemap page.
10. **Parity proof** against the static release of the same commit (A1-MIGRATION-PLAN §8): the A9 report's tools — the
    visible HTML of all 102 sitemap addresses and the 404s, the HTTP answers, the browser's files, the public E2E suite
    against the staging address (`E2E_BASE_URL`), the pixel comparison — and the smoke checks of §6.
11. **Fail-closed check:** with the database user's password changed (or the database stopped) for a minute, pages
    answer 500 (never an old page); restored, they answer again after at most 60 s (the breaker).
12. **Record H5–H8** during the warm-up and the E2E run. Staging content is test content: it is not imported into
    production (A9 Owner default).

## 4. The deployment package

- Two archives from one commit: the **static** release (rollback; today's) and the **database** release. Both are made
  by `scripts/package-namecheap.mjs` from a fresh clone's build; both keep the 13 held-back files out.
- The archive holds `.next` secrets (Server Actions key, preview id): handle it as secret (CLAUDE.md gotchas).
- The database release also needs, at run time: `DB_*` (the app pool and the page cache handler use the same
  variables), and the same `NEXT_PUBLIC_SITE_URL` it was built with. `CONTENT_SOURCE` itself matters only at build.

## 5. Production cutover — for approval only

Preconditions: the Owner's written go-ahead for production; staging rehearsal passed (§3) on the same commit; H1–H8
and H12 verified; the legal pages' reviewer named (or the Owner's explicit decision to cut over with them answering
404); a maintenance window agreed; nobody edits content in the static source during it (content freeze).

1. **Back up** the production database (A8-BACKUP-RESTORE.md: encrypted with the Owner's public key, verified, copied
   off the account) — before the migrations and again before the import.
2. **Migrate** (`db-migrate up`), **register the release media**, **bootstrap the Owner** if not done.
3. **Import** with `--dry-run`, read the reconciliation with the Owner, then for real (`--report`, `--legal-reviewer`
   as the Owner decided). Keep the report with the cutover record.
4. **Deploy the database release** (same commit as the live static release), restart the app, warm up (§3 step 9).
5. **Smoke checks** (§6) on the live address. Any failure → rollback (§7) at once.
6. **Keep the static archive** deployable until the Owner accepts A9 (A1-MIGRATION-PLAN §3.2 step 4).

## 6. Smoke checks (staging and production)

- Every sitemap address answers 200 in both languages; unknown addresses answer the localized 404; `/en/admin` answers
  the public 404 when the admin is off.
- `/sitemap.xml` lists exactly the live pages; `/robots.txt` names the site address.
- The 13 held-back files answer 404 (`/media/...` and `/_next/image?url=…`); a restricted library item answers 404 at
  `/media/u/…`.
- The quote form prepares the email and WhatsApp text exactly as before (handoff; nothing is stored or sent).
- A test publication (a harmless text on a test record, published and then reverted) appears on the next request and
  disappears after its rollback — the cache generation at work.

## 7. Rollback — for approval only

1. Redeploy the **static release archive** (README "Rollback"): upload, extract over the app folder, restart. The public
   site serves the static content again at once; no database step.
2. Leave the database as it is. Edits made after the cutover stay there; a later import leaves every aggregate edited
   since its import revision untouched and lists it.
3. If the database itself must go back: restore the pre-import backup into an empty database (A8-BACKUP-RESTORE.md),
   which starts a new cache epoch.

## 8. Known limits of the database release (A9)

- **Fixed page structure.** The approved pages keep their composition in code: a system page's section hidden, moved
  or added in the page builder (and a generic page) shows in the admin preview only; the published texts, items,
  records, media and settings are what the public pages take. A service page's optional sections (machines, gallery,
  projects) follow their layout's visibility.
- **Code-owned values** (listed in the A9 report, item 4): the approved composition's own choices (the homepage's
  project order, the collage, the industries strip, service looks and colour roles, the profile's figures), the quote
  form's validation, the composed "Company profile · p.N" line.
- **Per-request rendering on a miss.** Every page renders once per process after a publication (about 10–60 ms each
  locally); measure on the account (H8).
- **A render that overlaps a publication** may mix the old and new content for that one response; the cache never keeps
  it (its stamp is older than the publication).
