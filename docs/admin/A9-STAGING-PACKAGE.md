# A9 — Staging rehearsal package and hosting verification (for operator review)

**Status: prepared for review; nothing here has been run on Namecheap.** Every step that touches the hosting account,
a staging database, DNS or the live site needs the Owner's separate, explicit authorization for that environment (the
A9 brief §5; the A9 acceptance brief §4–§5). Production is out of scope here: it follows only after this rehearsal has
passed and the Owner authorizes it (`A9-CUTOVER-RUNBOOK.md` §5–§7).

Read with: `A9-CUTOVER-RUNBOOK.md` (what changes at the cutover, the H1–H14 table, cutover and rollback outline),
`A8-BACKUP-RESTORE.md` (backups and restore), the README ("Namecheap Stellar Plus deployment", "Admin (local
development)"), `A1-SECURITY-RBAC.md` §12 (secrets and key escrow), and the A9 acceptance report
(`docs/reports/2026-11-15-admin-a9-final-acceptance-staging-readiness.md`) for the measured local behaviour.

**Conventions.** `<…>` is a value the operator fills in; nothing in angle brackets may be guessed. Every command is
read-only unless its step says "writes". Commands marked **[server]** run in cPanel → Terminal (or SSH) on the
hosting account; **[engineer]** on the release engineer's own Linux or macOS machine, in a fresh clone of the approved
commit; **[browser]** in a normal browser. Platform facts below come from A1-ARCHITECTURE §7.1; anything about the
RAWASY account is unverified until a step here records it.

## 0. Roles and who must act

| Role | Who | Holds |
|---|---|---|
| **Owner** | RAWASY's Owner | every authorization; the backup key pair's private key and the escrowed `AUTH_ENCRYPTION_KEY`; the staging Owner account (password, 2FA); the legal reviewer decision |
| **Hosting operator** | whoever holds the cPanel login (the Owner, or someone the Owner names) | cPanel, Terminal / SSH, the staging database user's password |
| **Release engineer** | builds and packages; needs no hosting access except an SSH tunnel for §6 | a fresh clone at the approved commit, the two archives and their checksums |

Steps marked **Owner** or **Hosting operator** cannot be done from a development session: they need the account, the
keys or a decision only those people hold.

### 0.1 Proposed staging defaults *(the staging preflight brief; each needs the Owner's approval)*

| Default | How it is set |
|---|---|
| Staging host `staging.rawasymetal.com` (a proposal: the Owner names the host) | H13 (a DNS record: the Owner's authorization) |
| The admin on, only behind the staging access control | `ADMIN_ENABLED=1` (§3) and H14.2's address allowlist; 2FA required for Owner and Admin (A2) |
| Privacy and Terms unpublished until reviewed | the import without `--legal-reviewer` (§7.6); both pages answer 404 on staging with the website's localized 404 in their language (finding F-1 of the staging preflight, corrected: `not-found.db.tsx`); the sitemap lists 98 addresses, and the footer's two legal links lead to that 404 (§10.2) |
| No real visitor enquiries, no SMTP, no external notification | the quote form stays a handoff form (nothing stores an enquiry); `MAIL_TRANSPORT` unset |
| No production data or credentials | staging's own database, data folder, `AUTH_ENCRYPTION_KEY` and backup key pair; test users named "Test …" |
| Not indexed | H14.2: the allowlist (crawlers get 403) and the `X-Robots-Tag: noindex, nofollow` header |

## 1A. Phase A: read-only checks on the RAWASY account, in this order *(Owner or Hosting operator)*

The first pass on the real account. It **changes nothing**: it only opens pages and runs commands that read. It
needs only the Owner's go-ahead for phase A (decision D1 of the staging preflight report), not the staging
authorization.

**What to send back for review:**
- a screenshot of each panel named below;
- the Terminal output, pasted as text.

**What must never be shared** (in a screenshot, a paste or a message): no password, no 2FA code, no API token, no
private key, no `~/.my.cnf`, no database dump. Blank anything like that before sharing. None of the steps below shows
one.

**Status rules.** Each step's evidence goes into the record sheet (§14).
- A row of §1 becomes **PASS** only when all its evidence is recorded, and most rows also need phase B (§1, the steps
  marked *writes*, after the staging authorization D8). So phase A can confirm a row's account facts, or find a
  **FAIL**. It never makes a row pass on a platform page's word.
- A **FAIL** on A1–A5 for H1, H2, H4 (version) or H9 stops the plan before any write.

**Do not click, in any panel:**
- Create / Add / Save / Run / Generate / Download a backup / Enable / Disable;
- "Run AutoSSL";
- "Manage" (SSH keys);
- "Create Application" followed by Save.

Viewing a page, a list or a dropdown is fine.

| Step | Where | What to record (send a screenshot) | Feeds | Pass in phase A |
|---|---|---|---|---|
| A1 | cPanel home → right column **General Information**, then **Server Information** | hosting package, server name, cPanel version, web server (LiteSpeed) version, MySQL/MariaDB version, architecture, operating system, kernel | H1, H2, H4, H14 | MariaDB 10.11 or later; LiteSpeed named; Linux x86-64 |
| A2 | cPanel → Metrics → **Resource Usage** (the overview and "Current Usage" / limits; the last 24 hours and 7 days) | the limits: CPU (speed), physical memory, entry processes, number of processes, I/O, IOPS; any "faults" | H6, H7 | memory limit recorded (Stellar Plus: 2 GB); entry processes recorded (30); faults noted |
| A3 | cPanel left column (Statistics): **Disk Usage**, **File Usage**, **MySQL Databases** count, **MySQL Disk Usage** | used / limit of each | H9 | at least 5 GB and at least 60,000 inodes free |
| A4 | cPanel → Advanced → **Terminal** (opening it is read-only), then the command block below | the whole output, pasted | H1, H2, H3, H6, H9, H11 | Terminal opens; glibc 2.28 or later; a Node.js 22 of 22.18 or later is installed |
| A5 | cPanel → Databases → **phpMyAdmin**: the home page's "Database server" panel; then the **SQL** tab, the read-only query below, **Go** | server version, server charset; the query's one row | H4, H5 | MariaDB 10.11 or later; `max_user_connections` (`U`) recorded |
| A6 | cPanel → Software → **Setup Node.js App** | the list of applications (none expected for staging yet); do not create one | H1, H6 | the page opens |
| A7 | cPanel → Security → **ModSecurity** | on / off for each domain | H10 | recorded (the upload test is phase B) |
| A8 | cPanel → Advanced → **Cron Jobs** | the page opens; the existing jobs (none should be needed) | H11 | **H11 can pass here**: available, nothing created |
| A9 | cPanel → Files → **Backup** (and **JetBackup** or **Backup Wizard** if listed) | what exists: automatic backups, their schedule and retention as shown; do not generate or download one | H12 | recorded (the encrypted staging backup is phase B) |
| A10 | cPanel → Security → **SSL/TLS Status** | the domains listed and their AutoSSL state; do not run AutoSSL | H14.1 | AutoSSL available on the account |
| A11 | cPanel → Security → **SSH Access** | whether SSH is offered and the port shown; do not manage keys | H3 | SSH offered (the key and the tunnel are phase B) |
| A12 | cPanel → Domains → **Domains**, and **Zone Editor** if listed (view only) | the domains and subdomains that exist; whether `rawasymetal.com`'s records are edited here | H13 | recorded; no `staging` subdomain created |
| A13 | Namecheap dashboard → Domain List → `rawasymetal.com` → **Advanced DNS** (view only) | the nameservers in use (Namecheap BasicDNS, custom, or the hosting's) | H13 | recorded: tells where the staging record would be made |
| A14 | **[engineer]** on any computer (public answers only) | the output of the command block below | H13, H14 | today's records captured; `staging.rawasymetal.com` resolves to nothing yet |

**A4 — [server] the Terminal block** (every line reads; none writes, installs or starts anything):

```bash
echo "== identity"; whoami; echo "$HOME"; hostname
echo "== system"; uname -m; grep -E '^(NAME|VERSION)=' /etc/os-release 2>/dev/null; ldd --version | head -1
echo "== Node.js versions installed on the server"; ls -d /opt/alt/alt-nodejs*/ 2>/dev/null
for v in 22 24; do n=/opt/alt/alt-nodejs$v/root/usr/bin/node; [ -x "$n" ] && echo "alt-nodejs$v: $("$n" -v) glibc $("$n" -p 'process.report.getReport().header.glibcVersionRuntime')"; done
echo "== Node.js selector (a listing)"; cloudlinux-selector get --json --interpreter nodejs 2>/dev/null | head -c 3000; echo
echo "== existing Node.js app environments"; ls ~/nodevenv 2>/dev/null || echo "none"
echo "== database clients on the server"; command -v mariadb mysql mariadb-dump mysqldump; mariadb --version 2>/dev/null || mysql --version
echo "== space"; df -h "$HOME" | tail -1; quota -s 2>/dev/null | tail -2
echo "== limits this shell sees"; ulimit -a | grep -Ei 'processes|open files|virtual memory'
echo "== this account's processes"; ps -u "$USER" -o pid,etimes,rss,args | head -20
echo "== cron (listing only)"; crontab -l 2>/dev/null || echo "no crontab"
echo "== what the main domain serves today (names only)"; ls -la ~/public_html | head -30
```

**A5 — phpMyAdmin, SQL tab** (a read-only query; it changes nothing):

```sql
SELECT VERSION() AS version, @@max_user_connections AS max_user_connections, @@max_connections AS max_connections,
       @@wait_timeout AS wait_timeout, @@max_allowed_packet AS max_allowed_packet,
       @@innodb_lock_wait_timeout AS innodb_lock_wait_timeout, @@character_set_server AS charset,
       @@collation_server AS collation, @@sql_mode AS sql_mode, @@time_zone AS time_zone,
       @@system_time_zone AS system_time_zone, CURRENT_USER() AS account;
```

`@@max_user_connections` read here is the value for the cPanel user phpMyAdmin connects as. The staging database user
(phase B) is checked again in H4. A value of 0 means only `@@max_connections` limits a user.

**A14 — [engineer] public answers only:**

```bash
dig +short NS rawasymetal.com; dig +short A rawasymetal.com; dig +short CNAME www.rawasymetal.com
dig +short MX rawasymetal.com; dig +short TXT rawasymetal.com; dig +short TXT _dmarc.rawasymetal.com
dig +short A staging.rawasymetal.com          # expected: nothing yet
curl -sI https://www.rawasymetal.com/ | head -8; curl -sI https://rawasymetal.com/ | head -5
```

**After phase A.** The engineer reads the evidence and fills the record sheet (§14). Each H row then reads one of:
- **FAIL** — the plan stops (see the status rules above);
- **UNVERIFIED** — the account facts are confirmed and only the phase B steps remain;
- **PASS** — H11, which phase A settles.

Phase B (the steps of §1 marked *writes*, then §4–§12) starts only with the Owner's written staging authorization (D8).

## 1. Hosting verification H1–H14 (exact procedure)

Record every answer in the record sheet (§14). A row passes only on its recorded evidence. Phase A (§1A) covers every
read-only part; the steps here marked *writes* are phase B (after the staging authorization).

### H1 — Node.js 22, Passenger start file *(Hosting operator, cPanel)*

1. cPanel → Software → **Setup Node.js App** → **Create Application**. The "Node.js version" list must offer **22.x**.
   Create the staging app: version 22.x, mode **Production**, application root `rawasy-staging` (in the home folder,
   never `public_html`), application URL the staging subdomain (H13), startup file **`server.js`**. *(writes: an app
   entry and its folder)*
2. The panel then shows a command "Enter to the virtual environment", of the form
   `source /home/<cpanel user>/nodevenv/rawasy-staging/22/bin/activate && cd /home/<cpanel user>/rawasy-staging`.
   **[server]** Run it, then `node -v && npm -v`.
3. **Pass:** `node -v` prints **v22.18.0 or later** (tested on 22.22.2). Earlier 22.x releases cannot run the
   operations CLIs (they read the TypeScript sources through Node's type stripping, 22.18+). Record the exact version:
   `package.json` pins `engines` to 22.22.2, so another 22.x patch makes Run NPM Install print an `EBADENGINE` warning
   (a warning, not a failure: npm's `engine-strict` is off by default); every recorded QA ran on 22.22.2.
4. The release is **not** a Next.js `output: "standalone"` build: Passenger starts the CommonJS `server.js` (Next's own
   request handler, as `next start` uses it) over the archive's full `.next`, with the production dependencies Run NPM
   Install puts in the app's virtual environment (Next.js, React, `sharp`, `mysql2`, …; about 460 MB, watch H9).
   **[server]** after the first Run NPM Install, inside the virtual environment: `ls -ld ~/rawasy-staging/node_modules`
   (record whether it is a link into `~/nodevenv/…`: §12 depends on it) and
   `node -e "require('next'); require('mysql2'); console.log('ok')"` → `ok`.

### H2 — glibc for sharp *(Hosting operator, Terminal)*

**[server]** `ldd --version | head -1` → **pass:** 2.28 or later. After the first **Run NPM Install** (§9), inside the
virtual environment: `node -e "const s=require('sharp'); console.log(Object.keys(s.versions).join(' '))"` → prints
versions, no error.

### H3 — Terminal, SSH and port forwarding *(Hosting operator)*

1. cPanel → Advanced → **Terminal** opens a shell. **[server]** `whoami; echo $HOME`.
2. cPanel → Security → **SSH Access**: an SSH key can be added and the SSH port is shown (Namecheap shared hosting
   documents a non-standard port; take it from the panel). **[engineer]** `ssh -p <port> <cpanel user>@<server host>
   'echo ok'` → `ok`.
3. **Port forwarding** (needed by §6): **[engineer]** `ssh -p <port> -N -L 127.0.0.1:3307:localhost:3306 <cpanel
   user>@<server host>` in one terminal, then in another `nc -z 127.0.0.1 3307 && echo forwarded`.
4. **Pass:** all three. If forwarding is refused, record it: §6 then uses its fallback (an operations folder on the host).

### H4 — MariaDB settings, character set, authentication, grants *(Hosting operator)*

1. cPanel → Databases → **MySQL Databases**: create the database `<cpanel user>_rawasy_stg` and the user
   `<cpanel user>_rawasy_stg` (a generated password, kept in the operator's password manager), and add the user to the
   database with **ALL PRIVILEGES**. *(writes)*
2. **[server]** `mariadb -u <db user> -p <db name>` then:

   ```sql
   SELECT VERSION(), @@character_set_server, @@collation_server, @@time_zone, @@system_time_zone, @@sql_mode,
          @@max_user_connections, @@max_connections, @@wait_timeout, @@max_allowed_packet,
          @@innodb_lock_wait_timeout;
   SHOW GRANTS FOR CURRENT_USER();
   SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE();
   ```

3. **Pass:** MariaDB 10.11 or later (11.4.x listed by Namecheap); grants include CREATE, ALTER, INDEX, DROP, LOCK
   TABLES, REFERENCES, CREATE TEMPORARY TABLES on the database; `@@max_user_connections` recorded (it is `U` in H5;
   0 means only `@@max_connections` limits the user). The database's default character set may read `latin1`
   (MariaDB 11.4's server default): the first migration (§7) sets `utf8mb4` / `utf8mb4_unicode_520_ci` itself.
4. **Authentication plugin:** mysql2 speaks `mysql_native_password` (and `caching_sha2_password`), not ed25519 or
   PARSEC. The connection test of §6 step 4 (`db-migrate.mjs status`) proves it: an unsupported plugin fails there.

### H5 — Connection budget *(Hosting operator, during §11)*

`P × (L + 1) + R ≤ U`: `P` app processes (H6), `L` = `DB_POOL_LIMIT` (2), **+1 per process** for the page cache's own
connection, `R` = 5 reserved (CLIs, phpMyAdmin, a backup), `U` = H4's `@@max_user_connections`.
**[server]** while §11's load runs, every few seconds:

```sql
SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE USER = SUBSTRING_INDEX(CURRENT_USER(), '@', 1);
```

**Pass:** the peak stays at or below `U − R`. Record `P`, `U` and the peak.

| Processes `P` | Connections needed `P × (2 + 1) + 5` | If `U` is smaller |
|---|---|---|
| 1 | 8 | — |
| 2 | 11 | `DB_POOL_LIMIT=1`: 9 |
| 3 | 14 | `DB_POOL_LIMIT=1`: 11 |
| 4 | 17 | `DB_POOL_LIMIT=1`: 13 |

With `DB_POOL_LIMIT=1` a process renders one uncached page at a time (1 connection + 50 waiting, so first renders queue
longer); change it only from these numbers, and record it.

### H6 — Processes and their lifecycle *(Hosting operator, during §11)*

**[server]** `ps -u $USER -o pid,etimes,rss,args | grep -E '[s]erver\.js'` — during the warm-up, then after 10, 30
and 60 idle minutes; then **Restart** in Setup Node.js App and list again. Record how many processes serve the app
(`P`), how long an idle process lives, and that a restart replaces them. Each process keeps its own page cache (at most
400 pages, 128 MiB); correctness never depends on how many there are.

### H7 — Memory *(Hosting operator)*

cPanel → Metrics → **Resource Usage**: the limits (physical memory — 2 GB on Stellar Plus —, CPU (the LVE speed
limit; the platform pages disagree on its figure), entry processes — 30 —, number of processes, I/O) and the current
use, during and after §11. Also H6's `rss` column (kilobytes per process).
Locally a warmed database-release process was about 560 MB. **Pass:** `P × peak RSS` stays under the memory limit with
at least 25 % headroom, and Resource Usage reports no limit hit (no "faults"). With 2 GB and 560 MB a process, that is
`P ≤ 2` (1.12 GB; three would need 1.68 GB, above 1.5 GB): if H6 shows more processes, record their real RSS before
the rehearsal goes on.

### H8 — Response times *(Release engineer, against staging)*

§11 step 2 collects them. **Pass (proposed; the Owner may set others):** every sitemap page 200; first render p95
≤ 2 s; a cached page p95 ≤ 0.5 s, measured from a client on a normal network (locally: first renders 53–365 ms,
cached 8–11 ms).

### H9 — The data folder, quota and inodes *(Hosting operator)*

1. **[server]** *(writes)* `mkdir -p ~/rawasy-data-staging && chmod 700 ~/rawasy-data-staging && ls -ld
   ~/rawasy-data-staging && realpath ~/rawasy-data-staging` — outside `public_html` and outside the application root.
2. cPanel sidebar (Statistics): **Disk Usage** and **File Usage** (inodes; the platform allows 300,000).
   **[server]** `du -sh ~ 2>/dev/null; find ~ -xdev 2>/dev/null | wc -l` (both slow on a full account).
3. **Pass:** at least 5 GB free (a release with its installed dependencies is about 1.5 GB; each archive and backup
   adds to it) and at least 60,000 inodes free (an installed release uses tens of thousands).

### H10 — Request size limits and ModSecurity *(Hosting operator, after §9, admin on)*

1. cPanel → Security → **ModSecurity**: record whether it is on for the staging domain.
2. **[browser]** In the staging admin, upload a synthetic 15 MB JPEG (a test image, never a client photo) to the
   media library. The upload protocol sends parts of at most 4 MiB plus small JSON requests; Server Actions send
   forms below 1 MB.
3. **Pass:** the upload completes and is listed as pending review; cPanel → Metrics → **Errors** shows no ModSecurity
   or request-size rejection. A rejection is recorded with its rule id for the hosting operator.

### H11 — Cron *(Hosting operator)*

cPanel → Advanced → **Cron Jobs** exists and shows the shortest allowed interval. A9 schedules nothing: **pass** is
"available"; no job is created.

### H12 — Backups and key custody *(Owner and Hosting operator)*

1. cPanel → Files → **Backup** (or the account's backup tool): record what exists, its schedule and retention.
2. **[engineer]** `mariadb-dump --version` (the release engineer's machine runs the A8 backup tool through §6's tunnel).
3. The Owner creates the backup key pair on the Owner's own computer: `node scripts/backup.mjs keygen --out <private
   folder>` (`A8-BACKUP-RESTORE.md` §2); the private key never reaches the server, Git or the release engineer.
4. **Pass for staging:** an encrypted backup of the staging database created (§5) and **verified with the private key on
   the Owner's computer**. **Production additionally needs** an off-site location, a retention period and key custody,
   decided by the Owner (Owner default: no automatic production backups before that).

### H13 — Staging address, DNS and mail *(Owner and Hosting operator)*

1. **[engineer]** Record today's DNS before anything changes: `dig +short NS rawasymetal.com; dig +short A
   rawasymetal.com; dig +short CNAME www.rawasymetal.com; dig +short MX rawasymetal.com; dig +short TXT
   rawasymetal.com; dig +short TXT _dmarc.rawasymetal.com`.
2. The staging subdomain (`<staging host>`): creating it in cPanel → Domains may add a DNS record. **That is a DNS
   change: it needs the Owner's authorization.** Nothing else in DNS changes for staging; mail is not touched (SMTP
   stays off).

### H14 — Proxy hops, HTTPS and staging access control *(Hosting operator, after §9)*

1. **HTTPS:** cPanel → Security → **SSL/TLS Status**: AutoSSL covers `<staging host>`. **[engineer]**
   `curl -sI https://<staging host>/en | head -5` → a valid certificate (no `-k`), status 200 or 401 (below). The admin
   needs HTTPS: its session cookie is `__Host-` and `Secure`.
2. **Access control:** staging must not be public or indexed (its `NEXT_PUBLIC_SITE_URL` makes every canonical address
   point at staging). Preferred: an address allowlist in the subdomain document root's `.htaccess`, above the Passenger
   lines the panel wrote (*writes*):

   ```apache
   <IfModule mod_authz_core.c>
     Require ip <engineer's public address> <Owner's public address>
   </IfModule>
   ```

   Below it, the same file also marks every answer as not for indexing, whatever reaches it (*writes*):

   ```apache
   <IfModule mod_headers.c>
     Header always set X-Robots-Tag "noindex, nofollow"
   </IfModule>
   ```

   **[engineer]** from an allowed address: `curl -sI https://<staging host>/en | grep -i '^x-robots-tag'` →
   `noindex, nofollow` (the app itself sends none on public pages: they are published as indexable). The parity proof of
   §10.2 then reads this header as an expected difference on every answer.

   The allowlist keeps §9's warm-up and §11's scripts working (they send no credentials). Alternative: HTTP basic authentication
   (cPanel → Files → **Directory Privacy**); the warm-up tool cannot send credentials, so the image cache then warms
   on first visits instead. **[engineer]** from an address not on the list (a phone's mobile data, for example)
   `curl -s -o /dev/null -w '%{http_code}\n' https://<staging host>/en` → **403** (401 with basic authentication); from
   an allowed address → 200. That LiteSpeed applies either control in front of the Passenger app is itself to be
   verified here; if neither holds, staging stays closed (NO-GO, §13) until another control is agreed.
3. **Proxy hops:** with `TRUSTED_PROXY_HOPS=1` (§3), sign in to the staging admin from a connection whose public address
   you know, then open **Audit log**: the sign-in event's address must be yours. 127.0.0.1 means the setting is too
   low; an address that is not yours means too high. Record the value that gives your address.

### Also verified on the way

| Need | Where it is checked |
|---|---|
| Node.js and MariaDB compatibility | H1, H2, H4, §6 step 4 |
| Process management (Passenger, no daemons) | H6; A9 starts no daemon and no cron job |
| Filesystem permissions | H9 (0700 data folder); the app writes only `RAWASY_DATA_DIR` and its own `.next/cache` |
| Storage and backup quotas | H9, H12 |
| Upload and ModSecurity limits | H10 |
| SSL and reverse proxy | H14 |
| Deployment and rollback | §9, §12 (rehearsed on staging) |

## 2. What the hosting checks block

| Before … | needs |
|---|---|
| staging deploy (§9) | H1, H2, H3, H4, H9, H13 (the subdomain), H14.1–2 |
| the admin on staging | H10, H14.3, the staging key (§5) |
| the staging GO (§13) | all of §11 measured: H5–H8 |
| production | every row, H12 with off-site storage and custody, and the Owner's production authorization |

## 3. Environment checklist (staging)

Set in Setup Node.js App → the staging app → **Environment variables** (never in Git, never in the archive). The CLIs
of §6 read the same values from the release engineer's own 0600 file.

| Variable | Staging value | Notes |
|---|---|---|
| `APP_ENV` | `staging` | |
| `NEXT_PUBLIC_SITE_URL` | `https://<staging host>` | also given at build (§4) |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` (the app); `127.0.0.1` / `3307` (the CLIs, through the tunnel) | |
| `DB_USER` / `DB_NAME` / `DB_PASSWORD` | H4's | the password only in the panel and the operator's password manager |
| `DB_POOL_LIMIT` | `2` | change only from H5's numbers |
| `AUTH_ENCRYPTION_KEY` / `AUTH_ENCRYPTION_KEY_VERSION` | staging's own key / `1` | §5; never the production key, never a key from a local run |
| `ADMIN_ENABLED` | `1` only if the rehearsal includes the admin (Owner decision S8) | unset: `/admin` answers the public 404 |
| `ADMIN_BASE_URL` | `https://<staging host>` | the address in setup and reset links |
| `TRUSTED_PROXY_HOPS` | `1` until H14.3 records the right value | required with the admin on |
| `RAWASY_DATA_DIR` | `/home/<cpanel user>/rawasy-data-staging` | H9 |
| `MAIL_TRANSPORT` | unset (disabled) | SMTP stays off |
| `CONTENT_SOURCE` | **unset** | the release carries its own; a value naming the other source stops the app (blank counts as unset) |

## 4. Preflight *(Release engineer)*

**[engineer]** in an empty folder:

```bash
git clone --branch claude/new-session-5eijs6 https://github.com/Delowar01/Rawasy-Metal-Website.git rawasy && cd rawasy
git checkout <approved sha> && git log -1 --format=%H          # must print the approved commit
node -v                                                         # v22.22.x
npm ci && ls node_modules/@next | grep swc-linux-x64-gnu        # the glibc build of Next's compiler is present
npm audit --omit=dev                                            # 0 vulnerabilities
npm run lint && npm run typecheck && npm run db:check && npm run test:unit
```

With a local MariaDB (README, "Admin (local development)"), the suites on QA builds (the production address, as every
recorded run used):

```bash
npm run test:integration
npm run build && npm run test:admin && npm run test:e2e                     # the static release
CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
npm run test:dbmode                                                         # the publishing path end to end
```

Then the two staging archives, each packed right after its own build:

```bash
NEXT_PUBLIC_SITE_URL=https://<staging host> npm run build
node scripts/package-namecheap.mjs --out=../rawasy-static-<sha>.tar.gz
CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://<staging host> npm run build
node scripts/package-namecheap.mjs --out=../rawasy-database-<sha>.tar.gz   # prints "Content source of this build: database"
sha256sum ../rawasy-*-<sha>.tar.gz                                          # recorded in the record sheet
```

**Every database archive made after a content import** (staging's second deployment, every production release after
the cutover) leaves out the release files the target environment's library no longer delivers (A9 acceptance review
M-2: a restricted, archived, trashed or replaced photo that came with the website is no longer named by any page, but
a release still serves its file at its own address, and the image optimizer from it). Write the list through §6 the
same day, then pack with it:

```bash
node --env-file=$HOME/.rawasy/staging.env scripts/media-maintenance.mjs --release-withheld=$HOME/rawasy-withheld-<date>.json
#   prints "release files not delivered now …: N" (exit 2 only when the report lists other problems: read them)
CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://<staging host> npm run build
node scripts/package-namecheap.mjs --out=../rawasy-database-<sha>.tar.gz --withhold=$HOME/rawasy-withheld-<date>.json
#   prints "Held back (N files, through the media registry and the --withhold list)"; every check ✓
```

The first database archive (no library yet) needs no list: the release files it carries beyond the 13 held back are the
ones today's static release serves. Never pass a list to the static archive (the rollback stays A8's, 13 held back; its
check refuses a list that names a file its pages use).

**Pass:** every command succeeds; both packaging checks print PASS; the database archive names its content source.
The archives hold `.next` secrets (the Server Actions key, the preview id): keep them like credentials. Production
needs its own two archives built with the production `NEXT_PUBLIC_SITE_URL`.

## 5. Backups and key escrow *(Owner; before any staging data exists)*

1. **`AUTH_ENCRYPTION_KEY` for staging** — the Owner generates it on the Owner's own computer:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, stores it offline outside the hosting
   account (A1-SECURITY-RBAC §12: never Git, the database or a backup), and gives it to the hosting operator for the
   panel only. Losing it means every staging 2FA must be reset (`scripts/admin-2fa-reset.mjs`).
2. **The backup key pair** (H12.3): the public key goes to the release engineer; the private key stays with the Owner.
3. **Before every migration on a database with tables, and before and after the import:** **[engineer]** through the
   tunnel (§6):

   ```bash
   node --env-file=$HOME/.rawasy/staging.env scripts/backup.mjs create \
     --out $HOME/rawasy-backups/rawasy-staging-$(date -u +%Y%m%dT%H%M%SZ) --public-key <backup public key> --no-files
   ```

   `--no-files` is right while the staging data folder is empty (release media stay in the release); once staging has
   uploads, the data folder is backed up on the server (`A8-BACKUP-RESTORE.md`). Record the printed manifest
   fingerprint; the Owner verifies the backup with the private key (`backup.mjs verify --from … --private-key …
   --manifest-sha256 …`).

## 6. The operations path: CLIs from a clean checkout *(Release engineer)*

**Why:** the deployment archive carries no `scripts/` and no `drizzle/` (the migrations), so the migration, import,
bootstrap, backup and 2FA-reset CLIs cannot run from the deployed app folder. They run from the release engineer's
fresh clone of the **same commit** (§4), against the staging database through an SSH tunnel. The imports read the
clone's own `src/content` and `public/media`, identical to the release's, and write database rows only (no file goes
to the server).

1. **[engineer]** the tunnel, in its own terminal: `ssh -p <port> -N -L 127.0.0.1:3307:localhost:3306 <cpanel
   user>@<server host>`.
2. **[engineer]** the CLI environment, 0600, outside the clone: `install -m 600 /dev/null $HOME/.rawasy/staging.env`,
   then write into it `APP_ENV=staging`, `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
   `AUTH_ENCRYPTION_KEY`, `AUTH_ENCRYPTION_KEY_VERSION=1`, `ADMIN_BASE_URL=https://<staging host>`,
   `NEXT_PUBLIC_SITE_URL=https://<staging host>`.
3. Every CLI below runs as `node --env-file=$HOME/.rawasy/staging.env scripts/<cli>.mjs …` from the clone.
4. **Connection test:** `node --env-file=$HOME/.rawasy/staging.env scripts/db-migrate.mjs status` → it connects and
   lists the pending migration files (an authentication-plugin or grant problem fails here: H4).
5. **Fallback** when H3 refuses port forwarding: an operations folder on the host. **[engineer]** `git archive
   --format=tar.gz -o ../rawasy-ops-<sha>.tar.gz <sha> scripts drizzle src public/media package.json package-lock.json
   tsconfig.json`; the hosting operator extracts it into `~/rawasy-ops-<sha>` (outside `public_html` and the app),
   then **[server]** inside the app's virtual environment: `cd ~/rawasy-ops-<sha> && npm ci --omit=dev` (about 460 MB,
   watch H9), and the CLIs run there with an env file in `~` (0600) and `DB_HOST=localhost`, `DB_PORT=3306`. Delete
   the folder after the rehearsal.

## 7. Migrations and the content import *(Release engineer, with the Owner)*

All through §6, in this order; each step's output is kept with the record sheet.

1. `scripts/db-migrate.mjs status` — every migration pending on an empty database.
2. *(writes)* `scripts/db-migrate.mjs up` — no backup is needed while the database has no table; later runs need
   `--backup-file=<backup folder>/manifest.json` of a backup under 60 minutes old (§5.3). Exit code 0; `status`
   again shows none pending. Exit 5 (character set) or 6 (a statement) stops the rehearsal: restore or drop and redo.
3. *(writes)* `scripts/media-import-release.mjs` — 143 release files
   registered: 108 approved, 22 pending review, 13 restricted (the held-back files). Run it again: nothing changes.
4. The Owner account first (§8), then:
5. `scripts/content-import.mjs --owner=<owner email> --dry-run --report=$HOME/rawasy-import-dry.json` — nothing is
   written; read the reconciliation with the Owner (what is imported, what is left out and why).
6. *(writes)* `scripts/content-import.mjs --owner=<owner email> --report=$HOME/rawasy-import-1.json` and, only if the
   Owner named the legal pages' reviewer (decision S7), `--legal-reviewer="<name>"`. Exit code 0.
7. The same command again: **every row "unchanged"**, no new revision (idempotence on the real database).
8. §5.3 backup after the import.

## 8. The Owner account *(Owner, with the release engineer)*

1. **[engineer]** *(writes)* `node --env-file=$HOME/.rawasy/staging.env scripts/admin-bootstrap.mjs --email <owner
   email> --name "<owner name>"` — prints a one-time setup link for `https://<staging host>/admin/invite/…`.
2. The link goes to the Owner by a channel the Owner chose; the Owner opens it (after §9, with the admin on), sets a
   passphrase and sets up two-factor authentication, and keeps the recovery codes offline.
3. The Owner invites the other staging users from the admin (Users → Invite); test users are named "Test …".

## 9. Deploying the database release to staging *(Hosting operator)*

1. Setup Node.js App → the staging app → **Stop App**.
2. Upload `rawasy-database-<sha>.tar.gz` with File Manager; **[server]** `sha256sum ~/<archive>` equals the recorded
   checksum; extract into `~/rawasy-staging` (replacing any starter `server.js`).
3. Set the environment variables of §3; press **Run NPM Install**; **Start App**.
4. **[engineer]** the warm-up, from an allowed address (H14.2), against staging:
   `node scripts/warm-images.mjs https://<staging host>` until it reports 0 failed and 0 timed out (README).
5. Keep the previous release's archive (the static one of the same commit) next to it for §12.

## 10. End-to-end smoke tests *(Release engineer and Owner)*

**Public website (database release)** — **[engineer]**, from an allowed address (H14.2):

```bash
B=https://<staging host>
for u in / /en /ar /en/about /ar/services/laser-cutting /en/capabilities /en/projects /en/projects/clock-tower-landmark \
         /en/contact /en/privacy /en/terms /sitemap.xml /robots.txt; do
  curl -s -o /dev/null -w "%{http_code} $u\n" "$B$u"; done
curl -s -o /dev/null -w "%{http_code}\n" $B/en/not-a-page                                  # 404
curl -s -o /dev/null -w "%{http_code}\n" $B/media/projects/wheat-monument-1.webp           # 404 (held back)
curl -s -o /dev/null -w "%{http_code}\n" $B/media/services/engraving-nameplates.webp       # 404 (held back)
curl -s -D - -o /dev/null $B/en | grep -i '^cache-control'                                 # private, no-cache
curl -s $B/sitemap.xml | grep -c '<loc>'                                                   # 102 (98 while the legal pages wait)
```

**Pass:** `/` redirects (307) to a language; the pages answer 200 (Privacy and Terms 404 while their reviewer is not
named — S7; the website's localized 404 in each language since the F-1 correction); held-back files 404; database pages send `private, no-cache`; the quote form on `/en/contact` prepares its
email and WhatsApp text exactly as the static release does (nothing is stored or sent).

**The publishing path** — the steps `npm run test:dbmode` proves locally, done by hand once on staging with test text
on a project that is not part of the fixed composition (for example `gateway-welcome-signs`), then put back:

1. An Editor changes the project's English and Arabic title and saves → the public page still shows the old title.
2. The Editor submits it → still old.
3. A Reviewer approves and publishes → the next request of `/en/projects/<slug>`, `/ar/projects/<slug>` and the gallery
   shows the new titles.
4. An Admin rolls back to the imported version (Version history → Roll back to this) → the old titles return.
5. An Admin tries to unpublish `clock-tower-landmark` → refused ("fixed place"); its page stays 200.
6. An Admin unpublishes the test project → its pages answer 404 and it leaves the gallery and the sitemap; Publish →
   back.
7. Audit log: each step with its actor.
8. An Admin removes Laser Cutting's cover photo in its editor (Services → Laser Cutting), saves and presses Publish →
   refused ("can't be drawn there"; the homepage would answer 500 otherwise); the public homepage stays 200. Put the
   photo back and save (the working copy then equals the live version again).

### 10.1 A release photo withdrawn between releases (the emergency step) *(Owner, Hosting operator)*

Rehearse it once on staging with a client logo, then put it back. In a database release, restricting, archiving or
trashing a photo that came with the website takes it off every page at the next request, but its own address
(`/media/<group>/<file>.webp`) and its optimized copies (`/_next/image?url=…`, kept up to 4 hours) still answer until a
release leaves the file out (A1-MEDIA-STORAGE §12). When that is too long (a rights complaint):

1. **[Owner]** the admin: restrict (or archive, or trash) the item; its pages stop naming it at the next request.
2. **[server]** *(deletes)* the file from the running release, and every optimized copy:
   `rm ~/rawasy-staging/public/media/<group>/<file>.webp && rm -rf ~/rawasy-staging/.next/cache/images`
3. Setup Node.js App → the app → **Restart** (Next.js reads `public/` once, at start).
4. **[engineer]** `curl -s -o /dev/null -w '%{http_code}\n' https://<staging host>/media/<group>/<file>.webp` → 404, and
   the optimized address the page used before → 404; then the warm-up (§9 step 4) refills the other optimized copies.
5. The next database archive leaves it out (§4: the `--withhold` list names it).

Locally on a database build (drill `r4.sh`): before the step, the withdrawn logo's file and optimized copy 200 while
`/en/clients` no longer named it; after it, both 404, the page 200, the other logos 200. To put a rehearsal's logo back:
lift the restriction in the admin, extract that one file from the archive into the same place, restart.

### 10.2 Parity on staging, and what differs while the legal pages wait *(Release engineer)*

The staging rehearsal is accepted against the static release **of the same commit**, never against production.

1. **[engineer]** On the engineer's machine, extract the static archive (§4), built with the same
   `NEXT_PUBLIC_SITE_URL`, and start it: `NODE_ENV=production PORT=3400 node server.js`.
2. Compare it with staging, both from the allowed address:
   - every sitemap page's visible HTML (scripts removed, `/_next/static` paths and the build id normalised);
   - every page's HTTP answer (status, type, `X-Robots-Tag` and robots meta, `Location`; the bodies of non-HTML
     answers);
   - the public suite against staging: `E2E_BASE_URL=https://<staging host> npx playwright test --trace off`, about
     17 minutes at 3 workers (decision D7).
3. The comparison tools of the A9 parity proof are session scratch tools, not in the repository. The A9 report's
   item 6 describes them; committing them under `scripts/qa/` is offered to the Owner, not done.

**Expected differences, and nothing else:**
- `Cache-Control`: `private, no-cache` on the database release's documents and sitemap.
- `X-Robots-Tag: noindex, nofollow` on every staging answer (H14.2, set by `.htaccess`).
- The three unknown-address 404s stream their metadata elsewhere in the document (A9).
- Next.js's own 404 bodies differ (A9).

**While the legal pages wait for their reviewer (S7, the proposed default)** — measured locally on the final database
build (`2813ccc`, with the F-1 correction), imported without `--legal-reviewer`:
- **Import:** 113 created and 111 published; Privacy and Terms kept as working copies.
- **Legal addresses:** `/en/privacy`, `/ar/privacy`, `/en/terms` and `/ar/terms` answer **404** (200 on the static
  release).
- **Sitemap:** lists **98** addresses instead of 102.
- **Footer:** every page's footer still links both legal pages, unchanged from the approved design.
- **What those links reach:** the website's own localized 404 in the page's language (`en` / `ar-SA`, light and dark):
  - header and footer, a link home, "Page not found" and `noindex`, as at any unknown address;
  - without JavaScript a blank body under the right title, as every 404 of this design (TM-2.1).

  Before the F-1 correction they reached Next.js's bare English page (the staging preflight report, F-1). The same
  localized 404 answers for any of the 11 fixed pages taken offline.
- **HTML and HTTP:** these four documents and the sitemap body are the only further differences, out of 102 sitemap
  pages and 224 answers.
- **The public suite** (612 tests): 573 passed, 11 skipped (A9's fallback-404 checks, which skip against an outside
  server) and **28 failed**.
  - They are exactly the 28 that open Privacy or Terms as pages, or count the sitemap's 102 addresses. 601 pass on the
    database release with the legal pages published, so nothing else changed.
  - Before the F-1 correction it was 29: the D4 sweep (`commerce-projects.spec.ts`), which requires the design's
    `body.mc` on `/privacy`, passes now.

  The expected list, by spec:
  - `commerce-anchors.spec.ts` (6): the four `cold load with delayed fonts: legal` cells (`/en/privacy#contact`,
    `/ar/terms#contact`, desktop and phone); `after the page has settled › with reduced motion …` and `without
    JavaScript › a direct address with an #anchor …` (both open `/ar/terms#contact`).
  - `commerce-fonts.spec.ts` (1): `Arabic pages preload the Arabic files …` (it opens `/en/privacy`).
  - `commerce-inner.spec.ts` (12):
    - `legal pages ›`: its four content checks, `the shell …`, `the contents mark the section …`, `anchor jumps land
      every heading …`, `phone › the contents are a disclosure …`, `without JavaScript › the contents are open …`;
    - `localized 404 ›`: `real HTTP status codes …` (it counts the legal pages as known pages), `phone menu › on a page
      with an address of its own …` (it expects the privacy page's own language links), `the sitemap and robots: the
      legal pages are listed …`.
  - `commerce-polish.spec.ts` (1): `the inner pages' hero › without its script …` (its pages include both).
  - `site.spec.ts` (2): `internal links … resolve` (the footer's four legal links answer 404) and `the sitemap lists
    every page … 102 addresses …`.
  - `stage-1c.spec.ts` (6): `routes, language and SEO ›` the four legal routes and `the sitemap lists every published
    page …`; `inner pages without JavaScript › all content is rendered and visible` (`INNER_PAGES` includes both).

  Any other failure on staging is a finding, not an expected difference. Once the legal pages are published (a named
  reviewer, the Owner's decision), the suite must pass whole (601 + 11 skipped).

## 11. Performance and recovery tests *(Release engineer and Hosting operator)*

Never load-test beyond these steps (shared hosting); stop at the first 429, 503 or 508 and record it.

1. H6–H7: processes and memory during step 2.
2. Timings (H8), twice per page (the second is cached): **[engineer]**
   `for u in $(curl -s $B/sitemap.xml | grep -o '<loc>[^<]*' | cut -c6-); do for i in 1 2; do curl -s -o /dev/null
   -w "%{http_code} %{time_starttransfer} $u\n" "$u"; done; done > timings.txt`.
3. Concurrency within the account's entry processes: 20 requests at once to cached pages and 20 to addresses that do
   not exist (a 404 is rendered each time): **[engineer]** `seq 1 20 | xargs -P 20 -I{} curl -s -o /dev/null -w
   "%{http_code}\n" "$B/en" | sort | uniq -c` and the same with `"$B/en/no-such-page-{}"`. **Pass:** all 200 and all
   404 respectively; H5's connection peak recorded. (Locally one process takes 52 such uncached requests at once — 2
   connections and 50 waiting — before shedding the rest with 500; the platform's 30 entry processes stay below that.)
4. Database outage (staging only, Owner's approval for this step): the hosting operator changes the staging database
   user's password in cPanel for one minute, then puts the panel's value back. **Pass:** during the minute every page
   answers 500 within about 5 s (never an old page), release files (`/media/site/…`) still 200; within 65 s of the
   password's return every page answers 200 again (the page cache's breaker is 30 s, the content loader's 60 s; locally
   cached pages returned after 29 s and a fresh render after 60 s); the
   app's `stderr.log` names error codes only, no SQL, value or address.
5. A restart (Setup Node.js App → Restart) → the first request is slower, then normal; nothing else changes.

## 12. Rollback *(Hosting operator)*

The static release of the same commit is the rollback. **[server]** / panel:

1. Setup Node.js App → **Stop App**.
2. *(writes)* in place, as the README's update does, keeping the database release's build aside for a roll-forward:
   `cd ~/rawasy-staging && mkdir ~/rawasy-staging-database-<sha> && mv .next public src ~/rawasy-staging-database-<sha>/ && tar -xzf ~/rawasy-static-<sha>.tar.gz -C ~/rawasy-staging`
   (the app folder and its installed dependencies stay, and so does the document root's `.htaccess` (H14.2); both
   archives come from one commit, so `package.json` and `package-lock.json` are the same files:
   `sha256sum ~/rawasy-staging/package-lock.json` before and after is unchanged).
3. Environment: remove `CONTENT_SOURCE` if anyone set it (a release refuses to start when it names the other source);
   leave the rest.
4. **Run NPM Install** (it finds nothing to change for the same lockfile; record how long it takes), **Start App**, then
   §10's public checks: every page 200 with `Cache-Control: s-maxage=…` (the static release), and
   `node scripts/warm-images.mjs https://<staging host>` (the warm-up is not part of the 5 minutes: pages serve before
   it).
5. The database is left as it is (edits stay for the next attempt). Only if the database itself must go back: restore
   the pre-import backup into a **new, empty** database (`backup.mjs restore … --database <new db>`), point the app at
   it, and start a new cache epoch (the restore does).

**Pass:** the static release serves within 5 minutes of the decision, with the CMS data untouched (row counts of
`published_documents`, `revisions` and `cache_generation` equal before and after).

## 13. GO / NO-GO

The staging preflight report (`docs/reports/2026-11-16-admin-a9-staging-preflight.md`, item 7) restates these gates as
the brief's 13 items, each with its pass rule here.

**GO for staging deployment (§9)** — all of:
1. The Owner's written authorization for staging, naming the staging host.
2. H1, H2, H3 (or §6's fallback), H4, H9 and H13 recorded as passing; H14.1–2 ready to verify.
3. §4 preflight passed on the approved commit; both archives' checksums recorded.
4. §5: the staging key generated and escrowed; the backup key pair exists, its private key with the Owner.
5. Decisions S7 (legal reviewer or pages left unpublished) and S8 (admin on staging) made.

**GO for the staging rehearsal's acceptance (the step before any production request)** — all of:
1. §7: migrations exit 0; the import's repeat reads "unchanged" on every row; the backups verified by the Owner.
2. §10: every public check passes; the publishing path passes all eight steps.
3. §11: H5–H8 within their pass rules; the outage test fails closed and recovers within 65 s; no 429/503/508.
4. §12: a rollback to the static release rehearsed and timed (≤ 5 minutes), CMS data unchanged.
5. H10 and H14.3 passed if the admin runs on staging.

**NO-GO (stop, roll back per §12, report)** — any of:
- a page served with old content after a publication, or any page served while the database is unreachable;
- a held-back file (the 13) answering 200, or a private or restricted media item delivered;
- a working copy or draft text visible on a public page;
- a migration exit code other than 0, or an import repeat that is not all "unchanged";
- staging reachable without its access control (H14.2) or indexed;
- a resource limit hit (Resource Usage faults, 508) under §11's load;
- logs containing SQL, credentials or personal data;
- any step needing production, DNS beyond H13.2, SMTP or a credential nobody authorized.

## 14. Record sheet

Keep one copy with the Owner. For each row: date and time, who, the command or panel page, the output (pasted), pass or
fail.

| Item | Recorded |
|---|---|
| Phase A (§1A): A1–A14 screenshots and outputs received; FAILs, if any | |
| Approved commit; archive checksums (static, database) | |
| H1 Node version · H2 glibc, sharp · H3 SSH port, forwarding · H4 version, settings, grants, `U` | |
| H5 `P`, peak connections · H6 processes, idle lifetime · H7 RSS, Resource Usage · H8 timings | |
| H9 data folder, free space, inodes · H10 upload, ModSecurity · H11 cron · H12 backups, verification | |
| H13 DNS before; subdomain authorization · H14 HTTPS, access control, `TRUSTED_PROXY_HOPS` | |
| §7 migration and import outputs; reconciliation reviewed by the Owner | |
| §10 smoke results · §11 results · §12 rollback time | |
| GO / NO-GO decision, by whom | |
