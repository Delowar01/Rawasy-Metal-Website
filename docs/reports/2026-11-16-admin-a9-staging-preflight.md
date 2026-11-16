# A9 — Acceptance and Namecheap staging preflight (2026-11-16)

**Brief:** "RAWASY METAL WEBSITE — A9 ACCEPTANCE & NAMECHEAP STAGING PREFLIGHT": read-only investigation and planning
only.

**What this preflight did not touch:**
- nothing was deployed;
- no hosting account, cPanel setting, DNS, SSL, staging or production database was touched;
- no migration ran on hosting, and no production backup was touched;
- `main` is unchanged;
- no external message was sent;
- the approved website design is unchanged.

Every database used here was a disposable local MariaDB 11.4.13 (`rawasy_e2e_*`).

**Status:**

- **A9's local implementation:** the brief accepts it as technically ready for staging. Production stays blocked: the
  acceptance report's items 8–9 still hold.
- **Hosting: H1–H14 are all UNVERIFIED.**
  - No session has access to the Namecheap account.
  - This environment's network proxy blocks Namecheap's own pages.
  - Nothing about the RAWASY account is assumed; the documented platform facts are listed beside each check, never
    taken as proof.
- **A staging deployment cannot safely be authorized yet** (item 8).
  - What can be authorized now is the hosting operator's read-only verification (item 6, phase A).
  - The staging deployment can be authorized once phase A passes and the Owner's decisions D1–D8 (item 5) are made.
- **Code:** ready for staging, with one new finding that blocks production.
  - **F-1:** in a database release, a fixed page that is not live answers Next.js's bare English "404: This page could
    not be found.", not the website's localized 404.
  - It applies to the legal pages before their review, and to any of the 11 fixed pages taken offline.
  - Found by this preflight's rehearsal; not fixed here, because the brief is read-only. See the section after item 3.
- **Changes:** docs only.
  - The staging package is refined: proposed defaults; the Node patch and "not a standalone build" notes; the
    connection and memory budget; the `noindex` header; parity with the legal pages unpublished; the rollback in place.
  - This report and the project memory.
- **A local rehearsal of the proposed staging configuration** (Privacy and Terms unpublished) measured exactly what
  staging will differ in (item 3).

## 1. Current verified SHA

| | |
|---|---|
| HEAD at the start, verified | `19494ce`, equal to `origin/claude/new-session-5eijs6`; working tree clean |
| Final A9 code commit | `4601919` (every commit after it is docs only) |
| `main` | `474f61f`, unchanged |
| Rollback checkpoints on GitHub | `preserve/pre-admin-a9` `babf932` (before A9) · `preserve/pre-admin-a8` `c0e1074` · `preserve/pre-namecheap-adapter` `422c397` (the approved RC) · `preserve/pre-stage-1j` `f69e2fa` · and the earlier ones (`pre-admin-a1` … `pre-admin-a7`, `pre-tm*`, `pre-stage-1e/1f/1i`), 26 in all |
| Release rollback | the static archive of the same commit (A8's output, byte-identical public pages: the acceptance report, item 5) |
| This preflight's commit | docs only, on top of `19494ce`; its SHA is the branch head after this report |

## 2. H1–H14 status

The legend for the platform facts:
- **[P]**: a platform fact from the official Namecheap pages the A1 Correction 1 brief cites.
- **[O]**: a Namecheap page seen only through search extracts.
- **[V]**: verified from another primary source.

None of them is proof about the RAWASY account.

| Check | What the release needs | Documented platform fact | Status |
|---|---|---|---|
| H1 Node.js, Passenger | Node 22.18+ (QA on 22.22.2); Passenger starts the CommonJS `server.js`; the release is **not** a Next.js standalone build | Node.js 22.22 in the pool [P]; Setup Node.js App (CloudLinux selector) [O]; Passenger loads CommonJS start files [V] | **UNVERIFIED** |
| H2 glibc for `sharp` | glibc ≥ 2.28 (`sharp` 0.35.5's minimum) | CloudLinux 8 / glibc 2.28 [O, inferred] | **UNVERIFIED** |
| H3 Terminal, SSH, forwarding | Terminal or SSH; port forwarding for the CLIs (else the operations-folder fallback) | SSH on request, port 21098 [O] | **UNVERIFIED** |
| H4 MariaDB | MariaDB ≥ 10.11; the grants of the package's H4; `mysql_native_password` or `caching_sha2_password`; `utf8mb4_unicode_520_ci` set by the first migration | MariaDB 11.4.9 [P]; remote access disabled [O] | **UNVERIFIED** |
| H5 Connection budget | `P × (DB_POOL_LIMIT + 1) + 5 ≤ max_user_connections` | no page states the limit | **UNVERIFIED** |
| H6 Processes | any number of processes, frequent restarts (the design assumes none) | processes started on demand [O] | **UNVERIFIED** |
| H7 Memory, CPU, entry processes | about 560 MB per warmed process locally → `P ≤ 2` with 25 % headroom | 2 GB memory · `maxEntryProc` 30 · I/O 50 MB/s [P]; CPU figures inconsistent [O] | **UNVERIFIED** |
| H8 Response times | proposed: first render p95 ≤ 2 s, cached ≤ 0.5 s | — | **UNVERIFIED** (needs staging) |
| H9 Filesystem | data folder 0700 outside `public_html`; ≥ 5 GB and ≥ 60,000 inodes free | 300,000 inodes [P] | **UNVERIFIED** |
| H10 ModSecurity, uploads | 4 MiB upload parts, Server Actions below 1 MB, a 15 MB test upload completing | ModSecurity CRS default 12.5 MiB [V] | **UNVERIFIED** |
| H11 Cron | available (A9 schedules nothing) | ≥ 5 min, ≤ 5 jobs at once [P] | **UNVERIFIED** |
| H12 Backups, encryption | an encrypted A8 backup verified with the Owner's private key; `mariadb-dump` on the engineer's machine (or the host) | AutoBackup 6 daily / 3 weekly / 5 monthly [O] | **UNVERIFIED** |
| H13 Staging DNS | the staging host's record (a DNS change: the Owner's authorization); today's records captured first | — | **UNVERIFIED** |
| H14 HTTPS, access, proxy | AutoSSL for the staging host; LiteSpeed honouring `Require ip` and `Header` in `.htaccess` above Passenger; `TRUSTED_PROXY_HOPS` read from the audit log's address | LiteSpeed 6.2.2 [P]; socket address 127.0.0.1, `X-Forwarded-For` appended [V] | **UNVERIFIED** |

**Totals:** 0 PASS · 0 FAIL · 14 UNVERIFIED.

## 3. Exact remaining hosting requirements

Each is a pass rule in `docs/admin/A9-STAGING-PACKAGE.md` §1, to be recorded in its §14 record sheet.

- **H1**
  - The Node selector offers 22.x, and `node -v` in the app's virtual environment prints v22.18.0 or later; record the
    exact patch.
  - Another patch than 22.22.2 makes Run NPM Install warn `EBADENGINE`, but it does not fail.
  - After the first Run NPM Install, `require('next')` and `require('mysql2')` load.
  - Record whether `node_modules` is a link into `~/nodevenv/…`.
- **H2** — `ldd --version` reports 2.28 or later, and `require('sharp')` loads.
- **H3** — Terminal opens; `ssh -p <port> … 'echo ok'` prints `ok`; port forwarding answers on 127.0.0.1:3307. Without
  forwarding, the operations folder of §6 is used instead.
- **H4**
  - The version and settings query runs; the grants include CREATE, ALTER, INDEX, DROP, LOCK TABLES, REFERENCES and
    CREATE TEMPORARY TABLES.
  - Record `@@max_user_connections` (`U`).
  - `db-migrate.mjs status` connects (this proves the authentication plugin).
- **H5**
  - For `P = 2` processes: `U ≥ 11`.
  - Otherwise `DB_POOL_LIMIT=1` (9). The table is in the package's H5.
  - The connection peak, measured during §11, stays at or below `U − 5`.
- **H6** — process count, idle lifetime and restart behaviour, recorded.
- **H7** — `P × peak RSS` stays under 75 % of the memory limit, with no Resource Usage faults; record the CPU and
  entry-process limits.
- **H8** — the timings of §11.2.
- **H9** — the data folder at 0700 outside `public_html`, plus the free space and inode thresholds.
- **H10** — the 15 MB synthetic upload completes, with no ModSecurity or size rejection.
- **H11** — the Cron Jobs page exists.
- **H12** — the account's backups recorded; the Owner's key pair made on the Owner's computer; one encrypted staging
  backup verified.
- **H13** — today's DNS recorded with `dig`; the staging host authorized and resolving.
- **H14**
  - The certificate is valid.
  - From outside the allowlist the answer is 403; from an allowed address 200.
  - `X-Robots-Tag: noindex, nofollow` is present.
  - The audit log shows your real address with `TRUSTED_PROXY_HOPS=1`, or the value that does.

**What the local rehearsal of the proposed configuration showed.**

The final database build ran on a fresh local database: the CLIs, then the import without a legal reviewer.

- **Import:** 113 aggregates created and 111 published. Privacy and Terms were kept as working copies: "not published:
  no legal reviewer was named".
- **Against the static release of the same code:**
  - the sitemap lists 98 addresses instead of 102;
  - `/en/privacy`, `/ar/privacy`, `/en/terms` and `/ar/terms` answer 404 instead of 200;
  - the footer still links both legal pages, which then show the 404;
  - that 404 is Next.js's bare default page, not the website's localized 404: finding F-1, below.
- **Visible HTML:** every other sitemap page is identical. The three 404 addresses differ only where their metadata
  streams, as in A9.
- **HTTP:** beyond `Cache-Control` (as designed), only those four documents, the sitemap body and A9's known 404 bodies
  differ.
- **The public suite against it:** 612 tests, 16.9 minutes: 572 passed, 11 skipped (A9's fallback-404 checks, which
  skip against an outside server) and **29 failed**.
  - Every one of the 29 opens Privacy or Terms, or counts the sitemap's 102 pages:
    - `commerce-anchors` 6, `commerce-fonts` 1, `commerce-inner` 12, `commerce-polish` 1, `commerce-projects` 1,
      `site` 2, `stage-1c` 6.
    - 22 name Privacy, Terms or the legal pages' sitemap entries in their titles.
    - The other seven had their errors read and their page lists checked in the specs. Five open a legal page:
      `/en/privacy` (fonts, projects) or `/ar/terms#contact` (two anchor tests); polish's and stage-1c's page lists
      include both. The seventh, `site`, got the footer's four legal links answering 404.
  - With the legal pages published, the same database build had passed 601 + 11 skipped in the A9 acceptance QA. So
    601 − 572 = 29: nothing else changed.
  - The list, test by test, is now the expected-differences list of the package's §10.2. Any other failure on staging
    is a finding.

### Finding F-1 (new): a fixed page that is not live gets Next.js's bare 404 *(not fixed: the brief is read-only)*

**Measured** on the final database build, on a fresh local database imported without a legal reviewer, against
`/en/privacy`, `/ar/terms` and an unknown address, in a browser with and without JavaScript:

| | `/en/privacy`, `/ar/terms` (not live) | `/en/not-a-page` (unknown) |
|---|---|---|
| Status | 404 | 404 |
| Served HTML | Next's error shell, 10.9 / 12.0 KB, `<title>` "RAWASY" / "رواسي", `noindex` | Next's error shell, 63.9 KB, "Page not found \| RAWASY", carrying the localized 404 |
| With JavaScript | **"404 — This page could not be found."**, black on white, English on the Arabic address too, no `lang`, no header, footer or way back | the localized 404: header, footer, both languages, the way home |
| Without JavaScript | a blank page | a blank page (the known no-JS 404 limit since TM-2.1) |

**Cause.**
- Each fixed route calls `ensureContent("<page>")`, which calls `notFound()` when the page is not live
  (`src/content/live/load.ts`).
- Only `(missing)`, `services/[slug]` and `projects/[slug]` have a not-found boundary, so Next.js falls back to its own
  default page.
- The boundary is absent on purpose (TM-2.1): a boundary rides in the page data of every page under it, about 49 KB raw
  per page, measured in TM-2.4.

**Scope.**
- The 11 fixed routes: the homepage, About, the services overview, Capabilities, the projects overview, Industries,
  Clients, Certificates, Contact, Privacy and Terms.
- The static release is not affected: there, every page is always live.
- On the database release it shows:
  - for the legal pages until their reviewer is named (the staging default);
  - for any fixed page an Owner or Admin unpublishes or archives. Today nothing refuses taking a fixed page offline;
    A9's composition guard covers records only.

**Impact.**
- On staging (private): the footer's two legal links lead to that page.
- In production: any fixed page taken offline would show it. That breaks the bilingual design and gives an Arabic
  visitor an English page with no way back.

**Options for the Owner (a correction that needs its own authorization):**
1. Refuse taking the 11 fixed pages offline in a database release, as the composition guard does for records. This
   leaves the legal pages' first publication to be decided by D4.
2. A not-found boundary on those routes, rendering the localized 404. This changes every one of those pages' page data
   in both releases, so it needs the freeze proof and the Owner's approval of a public change.
3. Both. In any case, publish the legal pages before any audience sees the website.

This does not change item 8's verdict for staging, which is private and access-controlled. It is added to the risks
below as a production blocker: O10.

## 4. Recommended staging configuration

Every value is subject to the Owner's approval. The package has the table (§0.1) and the full variable list (§3).

| Setting | Value |
|---|---|
| Staging host | **`staging.rawasymetal.com`** (a proposal; the Owner names it; its record is a DNS change) |
| cPanel app | Setup Node.js App → Node 22.x (≥ 22.18), mode Production, root `~/rawasy-staging`, startup file `server.js` |
| Release | the **database** archive of the approved commit, built with `NEXT_PUBLIC_SITE_URL=https://<staging host>`; the static archive of the same commit beside it for rollback |
| Database | `<cpanel user>_rawasy_stg` and its own user (ALL PRIVILEGES on it only); never the production database |
| Environment | `APP_ENV=staging` · `NEXT_PUBLIC_SITE_URL` and `ADMIN_BASE_URL` = `https://<staging host>` · `DB_*` (H4) · `DB_POOL_LIMIT=2` (1 if H5 says so) · staging's own `AUTH_ENCRYPTION_KEY` with `AUTH_ENCRYPTION_KEY_VERSION=1` · `ADMIN_ENABLED=1` · `TRUSTED_PROXY_HOPS=1` until H14.3 · `RAWASY_DATA_DIR=/home/<cpanel user>/rawasy-data-staging` · `MAIL_TRANSPORT` unset · `CONTENT_SOURCE` unset |
| Access | `.htaccess` above the Passenger lines: `Require ip <engineer> <Owner>`, plus `Header always set X-Robots-Tag "noindex, nofollow"` |
| Admin | on only behind the allowlist; the Owner bootstrapped by the CLI; 2FA required for Owner and Admin (A2); test users named "Test …" |
| Content | the release's content imported by the CLI; **Privacy and Terms unpublished** (no `--legal-reviewer`); no production data |
| Enquiries, mail | the quote form stays a handoff form; no SMTP; no external notification |

## 5. Owner decisions needed before staging

1. **D1 — authorize phase A:** the read-only hosting verification (item 6), and name the hosting operator.
2. **D2 — the staging host:** `staging.rawasymetal.com` or another name, and authorize its DNS record (H13).
3. **D3 — the proposed defaults:**
   - admin on, behind the allowlist;
   - legal pages unpublished;
   - no enquiries, SMTP or notifications;
   - no production data;
   - not indexed.
4. **D4 — the legal pages on staging.** Production still needs the real review either way.
   - **(a) Keep them unpublished** (the proposed default). This accepts:
     - the 404s, which are Next.js's bare page (F-1);
     - the 98-page sitemap;
     - the footer links into that page;
     - the 29 expected test differences of item 3.
   - **(b) Name a staging-only reviewer label** (for example "Staging rehearsal — not a legal review"). Staging then
     equals the approved website, the suite must pass whole and the legal pages' publishing path is rehearsed too; the
     label stays in the audit log.
   - **Recommendation:** (a), because no unreviewed legal text is published anywhere. Record F-1 as known, and decide
     O10 before production.
5. **D5 — the access control:** the public addresses to allow (the engineer's and the Owner's), or basic
   authentication instead. Basic authentication stops the image warm-up script.
6. **D6 — keys:** the Owner generates staging's `AUTH_ENCRYPTION_KEY` and the backup key pair on the Owner's own
   computer, and decides where each is kept offline. They are never written into Git, the database, a backup or this
   report.
7. **D7 — the disruptive tests:** the one-minute database password change (§11.4), the 20 + 20 concurrent requests
   (§11.3) and the public suite against staging (about 17 minutes at 3 workers).
8. **D8 — written authorization of the staging deployment itself**, after phase A has passed.

The production decisions O3–O9 of the acceptance report, and O10 (F-1, new), are not needed for staging. They remain
open and are not accepted by this preflight.

## 6. Operator commands for the next stage

### Phase A — read-only verification (needs D1 only; changes nothing)

Screens to open in cPanel; nothing is clicked except navigation:

| Where | Look at | Expected (to record) |
|---|---|---|
| Software → **Setup Node.js App** (do not create) | the Node.js version list | 22.x offered; the exact versions |
| Metrics → **Resource Usage** | limits and current use | memory, CPU, entry processes (30?), processes, I/O; no faults |
| Statistics: **Disk Usage**, **File Usage** | free space and inodes | ≥ 5 GB, ≥ 60,000 inodes free |
| Security → **ModSecurity** | on or off for the domains | recorded |
| Advanced → **Cron Jobs** | the page exists | available |
| Files → **Backup** (or the account's backup tool) | what exists, schedule, retention | recorded |
| Security → **SSL/TLS Status** | AutoSSL enabled | recorded |
| Security → **SSH Access** | SSH enabled, its port | recorded (adding a key is a write: phase B) |
| Databases → **MySQL Databases** | existing databases and users | recorded (creating one is phase B) |

**[server]** in cPanel → Advanced → **Terminal** (every command only reads):

```bash
whoami; echo "$HOME"; uname -m
ldd --version | head -1                                   # pass: glibc 2.28 or later
cat /etc/os-release 2>/dev/null | head -3
command -v mariadb mysql mariadb-dump mysqldump           # which clients exist on the host
mariadb --version 2>/dev/null || mysql --version          # the client's version (the server's needs a user: phase B)
ls -d ~/nodevenv 2>/dev/null; ls ~/nodevenv 2>/dev/null   # the Node selector's environments, if any
df -h "$HOME" 2>/dev/null | tail -1
ls -la ~/public_html | head -20                           # what the main domain serves from today (record, change nothing)
```

**[engineer]** on the release engineer's own machine, read-only, public answers only:

```bash
dig +short NS rawasymetal.com; dig +short A rawasymetal.com; dig +short CNAME www.rawasymetal.com
dig +short MX rawasymetal.com; dig +short TXT rawasymetal.com; dig +short TXT _dmarc.rawasymetal.com
dig +short A staging.rawasymetal.com                      # expected: nothing yet
curl -sI https://www.rawasymetal.com/ | head -8           # what answers on the live domain today
```

**Pass for phase A:** every row recorded in the package's §14 sheet. A FAIL on H1, H2, H4 (version), H9 or H14
(AutoSSL) stops the plan before any write.

### Phase B — after the Owner's written staging authorization (D8): writes, in this order

1. The package's §1 writes:
   - **H1:** create the app.
   - **H4:** the database and its user, then the SQL checks.
   - **H9:** the data folder.
   - **H13:** the subdomain.
   - **H14:** `.htaccess` with the allowlist and the `noindex` header.
   - **H3:** the SSH key and the tunnel.
2. §4: the preflight on a fresh clone of the approved commit, then the two archives and their checksums.
3. §5: the staging key and the backup key pair (Owner).
4. §6–§7, through the tunnel:
   - `db-migrate.mjs status`, then `up`;
   - `media-import-release.mjs`, twice;
   - the Owner bootstrap (§8);
   - the content import: a dry run, the real run without `--legal-reviewer`, then the repeat ("unchanged" everywhere);
   - a backup.
5. §9: stop, upload, `sha256sum`, extract, the variables, Run NPM Install, start, warm-up.
6. §10: the public smoke checks, the 8-step publishing path, §10.1 (the emergency step, rehearsed with a client logo),
   §10.2 (parity with the expected differences).
7. §11: timings, concurrency, the outage (D7), a restart.
8. §12: the rollback to the static archive, timed; then forward again.
9. The record sheet goes back to the Owner for the rehearsal's GO.

## 7. Updated staging GO / NO-GO checklist

| # | Item | Plan (package) | GO when | Now |
|---|---|---|---|---|
| 1 | Verified hosting compatibility | §1 H1–H14 | every H row recorded as passing (H5–H8 measured during §11) | open: 14 UNVERIFIED |
| 2 | Staging hostname | §0.1, H13 | the Owner names it in writing and authorizes its DNS record | open (proposal `staging.rawasymetal.com`) |
| 3 | Database and connection budget | H4, H5, H7 | `U ≥ P × (L + 1) + 5`; the peak under `U − 5`; `P ≤ 2` by memory | open |
| 4 | Secure staging access | H14.2 | 403 from outside the allowlist, 200 inside; `X-Robots-Tag` on every answer; nothing indexed | open |
| 5 | Admin and MFA | §3, §8, H10, H14.3 | admin only behind the allowlist; the Owner's 2FA set; the audit log shows real addresses; the 15 MB upload completes | open |
| 6 | Legal pages | §0.1, §7.6, §10.2 | D4 decided; if unpublished, exactly the four 404s (F-1's bare page), the 98-page sitemap and the 29 expected test differences | open; F-1 blocks production (O10) |
| 7 | Encryption key and escrow | §5.1 | the Owner confirms staging's key generated and kept offline (never Git, database, backup) | open |
| 8 | Backup and restore | §5.3, H12, `A8-BACKUP-RESTORE.md` | an encrypted backup before each migration and around the import, verified with the private key; optionally a restore into a new empty database (another database: a write, part of D8) | open |
| 9 | Migration and import | §7 | every migration exits 0; the import's repeat reads "unchanged" on all 113 | open |
| 10 | Static-to-database parity | §10.2 | only the expected differences: Cache-Control, the `X-Robots-Tag` header, the four legal pages and the sitemap while D4 keeps them unpublished, A9's three 404 bodies | open |
| 11 | End-to-end publishing | §10 steps 1–8 | all eight pass, the M-1 refusal included; each step in the audit log | open |
| 12 | Load, outage, recovery | §11 | 20 + 20 concurrent requests as expected; 500 within about 5 s during the outage, never an old page; every page back within 65 s; no 429 / 503 / 508; logs name codes only | open |
| 13 | Rollback | §12 | the static release serving within 5 minutes of the decision (the warm-up not counted); CMS row counts unchanged | open (duration unmeasured on the host) |

**NO-GO** (stop, roll back, report) — any of:
- a page served with old content after a publication, or any page served while the database is unreachable;
- a held-back file answering 200, or a private or restricted item delivered;
- a working copy or draft text on a public page;
- a migration exit other than 0, or an import repeat that is not all "unchanged";
- staging reachable without its access control, or indexed;
- a resource limit hit under §11's load;
- logs with SQL, credentials or personal data;
- any step needing production, DNS beyond the staging record, SMTP or a credential nobody authorized.

## 8. Can a staging deployment be safely authorized?

**Not yet.**

- The code is ready for staging, and the procedure is written and rehearsed locally. F-1 is a production blocker, not a
  staging one: staging is private, and D4 decides what the legal links show there.
- The unknowns that remain are all on the hosting account, and none of them is verified:
  - H1, H2 and H4 decide whether the release can run at all;
  - H9 decides whether it fits;
  - H13 and H14 decide whether staging can be reached safely.

**Safe now:** authorizing phase A (D1). It changes nothing.

**Safe once phase A passes and D2–D7 are made:** a written authorization of the staging deployment (D8) for the named
host only. Production stays out of scope.

**Stopping here, at the approval gate.**

## Known risks, carried forward (none accepted for production by this preflight)

| Risk | What is measured | On staging | Production |
|---|---|---|---|
| A fixed-position photo withdrawn | 15 of 108 items take a page offline: the homepage (2), Industries (5), Projects (1) answer 500; seven service photos leave their service out (404) | not rehearsed on composition photos; §10.1 rehearses the emergency step with a client logo | Owner decision O3 |
| A withdrawn release file still reachable | its file and optimized copy 200 until a release leaves it out, or the emergency step (both 404 after it) | §10.1 rehearsal; the second database archive packed with `--withhold` | O4 |
| Database overload, queue limits | one process takes 52 uncached requests at once, then 500 at once; cached pages took 400 | §11.3 (20 + 20); the account's 30 entry processes answer 508 first | O5 |
| One-render publication overlap (L4) | bounded by one render; never served again after the publication | seen at most once per publication | O5 |
| Homepage hydration race | 1 / 240 (static), 2 / 240 (database) in targeted runs; the same on both releases and every build since A2 | a test-only effect; a visitor's click still lands | O8 |
| Database outage and recovery | 500 within 5 s (stall) / at once (refused), never stale; back in 29 s (cached) and 60 s (a fresh render); restart 3 s | §11.4 on the host, pass ≤ 65 s | to be measured there |
| A fixed page not live gets Next's bare 404 (F-1, new) | the legal pages before review, and any of the 11 fixed pages taken offline: English, unstyled, no way back; blank without JavaScript | the legal links while D4 (a) holds | **blocks production**: O10 (refuse offline, a localized boundary, or both), with the legal pages published before launch |
| Legal and media-rights approvals | the legal pages unpublished without a named reviewer; the 13 held back; RAWASY's confirmations in `docs/ASSET_INVENTORY.md` | D4; nothing held back is delivered | block production |

## QA run in this preflight

- **Git:** HEAD `19494ce` equals the remote branch; the tree was clean; `main` untouched; the 26 `preserve/*`
  checkpoints listed.
- **Local rehearsal of the proposed staging configuration.** It ran on the fresh-clone database build of `0de9452`
  (`git diff 0de9452 19494ce`: docs only, four files), on a fresh local database:
  - migrations 13 applied;
  - release media 143;
  - an import Owner;
  - the content import without a legal reviewer: 113 created, 111 published;
  - sitemap 102 / 98; the four legal addresses 200 / 404; the footer links both;
  - visible HTML: the four legal documents differ, plus the three 404s A9 already knew;
  - HTTP: 224 answers; besides `Cache-Control`, 4 status differences and 10 body differences (A9's 5, plus the four
    legal documents and the sitemap);
  - the public suite: 572 passed, 29 failed (all traced to the legal pages, item 3), 11 skipped; 16.9 minutes.
- **The F-1 probe:** the same build on a second fresh local database, with the same import.
  - curl captured the served documents for `/en/privacy`, `/ar/terms` and `/en/not-a-page`.
  - Chromium captured each one with and without JavaScript: status, `lang`, title, headings, header, footer, menu,
    text and a screenshot.
  - The database was dropped afterwards.
- **Clean-up:** both rehearsal databases were dropped at the end, along with two left over from the 15 November QA. No
  server is left running.
- **The first attempt failed before any check.** The local MariaDB container had stopped overnight, so the import was
  refused (`ECONNREFUSED`) and the script went on regardless. Docker and the container were restarted, the script now
  stops when the import fails, and it was rerun. Nothing from the failed attempt is used.
- **Nothing ran against Namecheap:** no account access, and the network proxy refuses its pages.

## Items needing RAWASY's confirmation

- O10 (new): how a fixed page that is not live should answer (F-1).
- The staging host name.
- The legal pages' reviewer (production; D4 for staging).
- The items of `docs/ASSET_INVENTORY.md` (Google Maps place link, image rights, AI-watermarked images, the 13 held
  back, licence renewal, registration numbers).

## Known limitations

- **H1–H14 are unverified.** This report proves nothing about the account.
- **The parity tools are not committed.** The HTML, HTTP, pixel and asset comparisons live in a session scratchpad
  (as in A9), so the package's §10.2 names what to compare, not a committed script. Committing them (for example
  `scripts/qa/`) is a small change that needs its own go-ahead; it is offered, not done.
- **The public suite cannot gate staging on its own while D4 keeps the legal pages unpublished.** Its run there is
  read against the expected-differences list of item 3.
- **F-1 is not fixed** (read-only brief). Its options are listed under item 3; the choice is the Owner's (O10).
- **The rollback's duration on the host is unmeasured.** In particular, how long Run NPM Install takes when nothing
  changes.

## How to run (the local rehearsal)

On a database build with a local MariaDB:

- the CLIs of `e2e-dbmode/server.mjs`, without `--legal-reviewer`;
- `node server.js` with `DB_NAME` set;
- the public suite with `E2E_BASE_URL`;
- the comparison tools against a static build on port 3400.

## Next steps

1. The Owner reads this report and the updated `docs/admin/A9-STAGING-PACKAGE.md`.
2. The Owner decides D1 (phase A) and names the hosting operator.
3. The operator runs phase A and returns the record sheet.
4. With phase A passing and D2–D7 decided, the Owner may give D8 for the named staging host.
