# A8 — Backup, restore and key escrow (operator procedures)

**Status:** Phase A8, local implementation. The tools exist and are tested on disposable local databases only. **No
production backup has been taken, no production restore has been run, and no production key has been escrowed** —
those steps belong to the Owner (or an operator the Owner names) once staging exists, after the account checks of
A1-ARCHITECTURE §7.3. Nothing here connects to Namecheap or any production system.

Related: [A1-ARCHITECTURE §11](A1-ARCHITECTURE.md) (backup and restore design) · [A1-SECURITY-RBAC §12](A1-SECURITY-RBAC.md)
(secrets, escrow, rotation, disaster restore) · [A1-PUBLISHING-VERSIONS §8.2](A1-PUBLISHING-VERSIONS.md) (cache epoch).

## 1. Principles

- Operator tools only: `scripts/backup.mjs` is run by hand over SSH or cPanel Terminal (or on a local copy). The app
  never runs it, nothing runs it at start-up, there is no HTTP route and no schedule (a schedule is an Owner decision).
- Backups and keys never go into Git (the tool refuses a folder inside a repository), never into `public/` or the
  release folder, never into the database, never into email or chat.
- A backup holds no secret value: no environment value, no password, no session or reset token (those tables' rows are
  left out), no TOTP key. TOTP secrets in `user_mfa` stay encrypted with `AUTH_ENCRYPTION_KEY`, which is escrowed
  separately (§6) — a database backup alone cannot decrypt them.
- A restore never overwrites: it goes into a new, empty database and a new, empty data folder, and is checked before
  anything is switched over.

## 2. What a backup contains

| File | Content | Excluded |
|---|---|---|
| `database.sql.gz` | `mariadb-dump --single-transaction --quick --routines --triggers --hex-blob --default-character-set=utf8mb4` of every table | the rows of `sessions`, `auth_tokens`, `rate_limits`, `login_attempts` |
| `database-excluded-schema.sql.gz` | the structure of those four tables (so a restore is complete) | their rows |
| `files.tar.gz` | everything under `RAWASY_DATA_DIR` except `tmp/`: public-class originals and their derivatives, private certificate originals, private enquiry attachments | `tmp/` (unfinished uploads) |
| `config.json` | configuration **metadata**: which variables are set (names only), `APP_ENV`, the `AUTH_ENCRYPTION_KEY` versions rows still need, the Node version | every value |
| `manifest.json` | format, time, every file's size and SHA-256, the applied migrations' hashes, row counts per table, the encryption envelope (key fingerprint, wrapped data key) | — |

With `--public-key`, every file is encrypted (AES-256-GCM under a fresh data key, the data key wrapped with RSA-OAEP
SHA-256 for the Owner's public key) and saved as `<name>.enc`; the plain files are removed. Only the matching private key
opens it.

## 3. The backup encryption key (one-time set-up)

1. On the **Owner's own computer** (not the server), with this repository's code: `node scripts/backup.mjs keygen --out
   <a folder outside any repository>`. It writes `backup-public.pem` and `backup-private.pem` and prints the key's
   fingerprint.
2. Put `backup-private.pem` into escrow (§6): at least two offline copies in different places. Then delete it from the
   computer.
3. Copy only `backup-public.pem` to the server, outside the release and `public_html` (for example
   `~/rawasy-keys/backup-public.pem`, mode 0644). Record its fingerprint in the escrow record.
4. Rotating it: make a new pair the same way, escrow the new private key, replace the public key on the server. Keep an
   old private key until every backup encrypted for it has expired (retention, §4).

## 4. Making a backup

```bash
# On the server, from the release folder, with the app's environment (DB_*, RAWASY_DATA_DIR) loaded:
node scripts/backup.mjs create --out ~/rawasy-backups/rawasy-<env>-$(date -u +%Y%m%dT%H%M%SZ) \
  --public-key ~/rawasy-keys/backup-public.pem --note "before release X"
node scripts/backup.mjs verify --from ~/rawasy-backups/rawasy-<env>-…        # sizes and SHA-256 of every file
```

- When (proposed, Owner decision): before every migration and every release, and nightly once staging runs. A1 §11
  proposes 03:15 Riyadh; nothing is scheduled in A8.
- Retention (proposed, Owner decision): 14 daily, 8 weekly, 6 monthly on the account, plus off-site copies the Owner
  downloads or pushes to storage the Owner chooses (never the same account only). Namecheap AutoBackup stays on as an
  extra layer.
- Each run is recorded in the source database: `system_job_runs` (`job_key = 'backup'`, counts only) and an audit event
  (`system.backup`, actor `cli`).
- A database-only backup: `--no-files`. An unencrypted backup (no `--public-key`) is made only with `--unencrypted`
  outside `APP_ENV=local`; keep it only where the database itself may be kept.
- **Record the manifest fingerprint.** `create` prints `Manifest fingerprint (SHA-256): <64 hex>`. Write it into the
  operations log and next to the escrow record — somewhere the backup storage's users can't change. Anyone who can write
  to the backup storage could replace a whole backup (a manifest that matches its files, files encrypted to the public
  key, which is on the server); only that recorded fingerprint proves a backup is the one that was made.
- Where backups, keys and restored data may go: never inside a Git repository, inside the application's folder (the
  release, its `public/` and `.next`) or under `public_html` — the tool refuses those, following symbolic links. The
  backup folder is made 0700 (an existing empty one is tightened); every file in it is 0600. Plain dumps and the file
  archive are made in a private staging folder inside it and removed as soon as they are encrypted or copied; a run
  that fails leaves nothing of itself behind.
- The MariaDB client programs: `MARIADB_DUMP_BIN` / `MARIADB_BIN` (defaults `mariadb-dump`, `mariadb`). Use the same or a
  newer client than the server (MariaDB 11 dumps start with a sandbox-mode line older clients reject).

## 5. Verifying and restoring

**Routine verification** (monthly proposed): `verify --from <backup> --manifest-sha256 <recorded fingerprint>` checks the
manifest against its recorded fingerprint, then sizes and hashes; with `--private-key` (on the Owner's computer, from
escrow) it also decrypts every file, checks the contents' hashes, that each dump ran to its end, and that the file
archive holds only regular files and folders with relative names (no links, devices, absolute paths or `..`). A changed
byte, a replaced manifest, a missing file, an unsafe archive member or another key is reported (exit code 4).

**Restore drill** (A1 §11: every quarter and after any schema change, into staging or a local copy — never production):

```bash
node scripts/backup.mjs restore --from <backup> --database rawasy_restore_<date> --data-dir <new empty folder> \
  --private-key <escrowed private key> --manifest-sha256 <recorded fingerprint>
node scripts/db-migrate.mjs status          # with DB_NAME=rawasy_restore_<date>: every migration applied, unchanged
```

Outside `APP_ENV=local` a restore requires `--manifest-sha256`. The tool verifies the backup first (the fingerprint, the
hashes, the archive's members), refuses a database or data folder that is not empty or not in an allowed place, loads
the dump and the excluded tables' structure through the MariaDB client in `--sandbox` mode (a dump can't run shell or
file commands; the client must be 11.4.2 or newer, as on the host's MariaDB 11.4), extracts the files, **sets a new cache epoch** (A1 §8.2: no page cached before the restore is
served), compares every table's row count with the manifest and records the restore in `system_job_runs`
(`job_key = 'restore'`). Record the drill's result (date, backup, counts, problems) in the operations log.

**Disaster restore** (Owner, A1 §11 and A1-SECURITY-RBAC §12.3), in this order:

1. Stop the app (or show a maintenance page).
2. Restore into a **new** database and a **new** data folder (the command above). Check its output: no count difference
   that cannot be explained, `db-migrate status` clean.
3. Point the app at them (`DB_NAME`, `RAWASY_DATA_DIR`) — the old database and folder stay untouched until the restore is
   accepted.
4. Restore the recovery-critical keys from escrow: the active `AUTH_ENCRYPTION_KEY` and every retired version
   `config.json` lists under `authEncryptionKeyVersionsInUse` (check: `SELECT DISTINCT key_version FROM user_mfa`).
5. Issue new replaceable secrets: database password, SMTP password (when SMTP exists), `CRON_SECRET`,
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; rebuild with `.next/cache/.previewinfo` deleted.
6. Sessions and reset links: none exist in the restored database (their rows are not backed up) — everyone signs in
   again; reset links are issued anew where needed.
7. Start the app, warm the images (`scripts/warm-images.mjs`), spot-check: an Owner sign-in with 2FA, the dashboard,
   one published record's history, the audit log continuing.
8. If a key version cannot be found in escrow, follow A1-SECURITY-RBAC §12.4 (emergency 2FA reset) for those users.

## 6. Key escrow (operator procedure)

Two kinds of keys must be recoverable separately from the backups (A1-SECURITY-RBAC §12.1):

| Key | Where it lives | Escrow |
|---|---|---|
| `AUTH_ENCRYPTION_KEY` (active and every retired version still needed) | the app's environment only | yes — two offline copies outside the hosting account |
| The backup private key (`backup-private.pem`) | nowhere online | yes — two offline copies; never on the server |

Procedure (the Owner decides the medium; proposed: an encrypted entry in the Owner's password manager plus a sealed paper
or offline-drive copy kept at a different place):

1. Generate the key where it will be used first (the server for `AUTH_ENCRYPTION_KEY`: `scripts/admin-keys.mjs`; the
   Owner's computer for the backup key: `backup.mjs keygen`).
2. Put it into escrow **before** it protects anything (a rotation escrows the new key first: A1-SECURITY-RBAC §12.2).
3. Write the escrow record — never the key in it:

   | Field | Example (format only) |
   |---|---|
   | Key | `AUTH_ENCRYPTION_KEY` / backup private key |
   | Version or fingerprint | `3` / `sha256:…` |
   | Created | date, by whom |
   | Copies | where each copy is kept, who holds it |
   | Needed until | for a retired key: when no row and no retained backup needs it |
   | Destroyed | date, by whom (only after "needed until") |

4. Test the escrow once a year (proposed): restore the backup key from a copy and `verify` a recent backup with it; check
   the `AUTH_ENCRYPTION_KEY` versions against `admin-keys.mjs status`.
5. Never: Git, the database, a backup, email, chat, a ticket, a screenshot.

**State today:** nothing has been escrowed. The local tests generate throwaway keys in temporary folders and delete them.

## 7. What A8 does not do

- No backup or restore of production; no connection to Namecheap; no schedule (cron is pre-staging work and an Owner
  decision).
- No off-site upload: where off-site copies go is the Owner's decision.
- Retention periods for backups are proposals; nothing deletes old backups automatically.
