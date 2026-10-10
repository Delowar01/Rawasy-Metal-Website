# Admin / CMS program — Phase A2: authentication, RBAC, database foundation and admin shell

Date: 2026-10-09 · Branch: `claude/new-session-5eijs6` · Brief: "RAWASY METAL WEBSITE / ADMIN / CMS PROGRAM / PHASE A2 —
AUTHENTICATION, RBAC, DATABASE FOUNDATION & ADMIN SHELL / LOCAL IMPLEMENTATION ONLY / A1 IS APPROVED AND CLOSED / DO NOT
START A3".

## Summary and status

Phase A2 is implemented and tested **locally**, against a local MariaDB 11.4 only. It adds:
- the database foundation: 13 tables, reviewed migrations and a migration CLI;
- authentication with Argon2id, database sessions in a `__Host-` cookie, invitations, password reset, first-Owner
  bootstrap and recovery from the server's command line;
- TOTP two-factor authentication with encrypted, versioned secrets and recovery codes;
- throttling and lockout, the A1 role and permission matrix with rank rules and last-Owner protection, step-up for
  sensitive actions, and an append-only security audit;
- the proxy's admin branch (a nonce CSP per request) and admin and API headers;
- an English admin shell at `/admin`: sign-in, dashboard, account, security, sessions, users, invitations and roles.

The public website is frozen and proven unchanged against `preserve/pre-admin-a2`. Every one of its 102 sitemap pages
was compared over HTTP: status, headers, normalised HTML, title, description, canonical, hreflang, structured data,
visible text, media and page data. The build output was compared file by file, stylesheet by stylesheet and module by
module. 238 screens were compared pixel by pixel.

Nothing was deployed. No Namecheap resource was touched. `main` was not touched. A3 was not started.

**QA on the final code** (a fresh clone of `20bef7a`; `npm ci`; built with no database settings): lint 0 problems,
typecheck 0 errors, build OK, `npm audit --omit=dev` 0 vulnerabilities; **public suite 612 / 612**; unit 15 / 15, MariaDB
integration 83 / 83, admin browser 24 / 24; **combined 734 / 734**. Reported plainly (item 26): one earlier full run on
the same build ended 611 / 612 on a race in the frozen homepage showcase, which fails at the same rate on the baseline
build; and the first full run on `ce6a63b` found one real A2 effect (API headers at unknown `/api` addresses), fixed in
`20bef7a` without touching the test. An independent review of the security core found eight defects, all fixed, each
with a test that fails on the code before (section "Independent code review").

**A2 STATUS: READY FOR INDEPENDENT REVIEW** (not self-approved).

## Report items (brief §38, in order)

### 1. Starting SHA
`ed6b6521f8e5cae04f983acd298e0ef1e6b9aac0` ("Admin A1 Correction 1 report section and project memory (docs only)"), the
expected approved HEAD. Before any change, local HEAD equalled `origin/claude/new-session-5eijs6` and the working tree was
clean.

### 2. preserve/pre-admin-a2 SHA
GitHub branch `preserve/pre-admin-a2` was created at exactly `ed6b6521f8e5cae04f983acd298e0ef1e6b9aac0` and pushed
(no force push; it did not exist before). `git ls-remote` at the end still shows it there.

### 3. Final branch HEAD
The commit that adds this report (documentation only), directly on top of `20bef7a`, the last code commit; pushed to
`claude/new-session-5eijs6`. Its hash is in the hand-over message.

### 4. Commit list
On top of `ed6b652`, each on its own:

| Commit | Content |
|---|---|
| `00ec00b` | Database foundation, dependencies and migration CLI |
| `240607e` | Authentication, sessions, invitations and password reset |
| `58adaf8` | Two-factor authentication, user management and server CLIs |
| `d50d5da` | Proxy admin branch, nonce CSP and admin/API headers |
| `36dcda6` | Admin shell, sign-in, account security and user management UI |
| `e82ba0e` | Unit, MariaDB integration and admin browser tests |
| `1677a48` | The reset request page reads the mail setting without the database |
| `0275c7c` | The unused `CONTENT_SOURCE` reader dropped |
| `45ec91e` | README (local admin set-up), `.env.example` (variable names only), CLAUDE.md |
| `ce6a63b` | Fixes from the independent code review: the eight findings and their tests (section below) |
| `7f97207` | CLAUDE.md: the documentation and code-review commits listed (documentation only) |
| `20bef7a` | The API headers only on `/api/admin/**` and `/api/internal/**` (the public suite's one failure; "Deviations") |
| this report's commit | This report and CLAUDE.md (documentation only) |

### 5. Files changed
Against `ed6b652`, up to `20bef7a`: 107 files (98 added, 9 modified), +23,367 / −4,008 lines; this report adds one more. Modified existing files: `package.json`, `package-lock.json`, `tsconfig.json`
(`allowImportingTsExtensions`), `eslint.config.mjs` (the rules in item 11), `next.config.ts` (the API namespaces' headers,
`serverExternalPackages: ["mysql2"]`), `src/proxy.ts` (the admin branch), plus `README.md`, `.env.example`,
`CLAUDE.md`. **No public file changed:** nothing under `src/app/(commerce)`, `src/app/*` (root files), `src/components/commerce`,
`src/content`, `src/i18n`, `src/lib` (except the new `src/lib/admin-headers.ts`), `public/`, `e2e/` or `server.js`.
Added:
- `drizzle.config.ts`, `drizzle/` (2 migrations + journal and snapshots);
- `src/server/**` (config, db, security, auth, policy, audit, mail, admin, cli: 39 files);
- `src/lib/admin-headers.ts`;
- `src/app/(admin)/admin/**` (23 files), `src/components/admin/**` (10 files);
- `scripts/db-migrate.mjs`, `generate-access-seed.mjs`, `generate-common-passwords.mjs`, `admin-bootstrap.mjs`,
  `admin-2fa-reset.mjs`, `admin-keys.mjs`;
- `tests/unit/` (1), `tests/integration/` (8 incl. helpers), `e2e-admin/` (3), `playwright.admin.config.ts`;
- `docs/reports/2026-10-09-admin-a2-auth-rbac-shell.md`.

The lockfile's text diff is large because npm re-wrote it. By package: **112 entries added** (26 for production:
`@node-rs/argon2` and its 13 optional platform binaries, `drizzle-orm`, `mysql2` and its 9 dependencies,
`qrcode-generator`) and **0 removed**. **No existing version changed.** Three flags changed: `zod` became a production
dependency, as did `@types/node` and `undici-types`, because `mysql2` lists `@types/node` (type definitions only, no
runtime code) as a dependency.

### 6. Exact dependency versions and licences
Pinned exactly (no ranges), each chosen in the dependency review before installation:

| Package | Version | Licence | Purpose |
|---|---|---|---|
| `drizzle-orm` | 0.45.3 | Apache-2.0 | typed SQL, **core query builder only** (`db.query` and `drizzle(…, { schema / mode })` fail lint) |
| `mysql2` | 3.24.4 | MIT | MariaDB driver and pool (`mysql2/promise`) |
| `@node-rs/argon2` | 2.2.1 (+ `-linux-x64-gnu` and `-linux-x64-musl` 2.2.1) | MIT | Argon2id password hashing (prebuilt native module) |
| `zod` | 4.6.5 | MIT | input validation of every Server Action and CLI |
| `qrcode-generator` | 2.0.4 | MIT | the 2FA QR code, drawn as one SVG path (no inline style, no canvas, no network) |
| `drizzle-kit` (dev) | 0.31.11 | MIT | `generate` and `check` of migrations only (never `push` / `pull`) |

The transitive production packages: `aws-ssl-profiles` 1.1.2, `generate-function` 2.3.1, `iconv-lite` 0.7.3,
`is-property` 1.0.2, `long` 5.3.2 (Apache-2.0), `lru.min` 1.1.5, `named-placeholders` 1.1.6, `safer-buffer` 2.1.2,
`sql-escaper` 1.5.2 (all MIT unless noted). The common-password list (1,642 entries, `src/server/security/common-passwords.generated.ts`) is
derived from SecLists (MIT) by `scripts/generate-common-passwords.mjs`. Node.js 22.22.2 and npm 10.9.7, as before.

### 7. DB schema and migration files
- `src/server/db/schema.ts`: **exactly the 13 A2 tables** of A1-DATABASE-SCHEMA: `locales`, `users`, `roles`,
  `permissions`, `role_permissions`, `user_roles`, `sessions`, `auth_tokens`, `user_mfa`, `user_recovery_codes`,
  `login_attempts`, `rate_limits`, `audit_events`. Column helpers (`src/server/db/columns.ts`):
  - ULID ids as `CHAR(26) ascii_bin`; ASCII keys `ascii_bin`;
  - `DATETIME(3)` in UTC (connections run `SET time_zone = '+00:00'`); BIGINT for the log tables;
  - `email_normalized` and JSON `LONGTEXT` as `utf8mb4_bin` with `json_valid` checks;
  - every other text column `utf8mb4_unicode_520_ci`; `InnoDB` with explicit table options on every table.
- `drizzle/0000_access_control.sql` (generated by drizzle-kit, reviewed by hand): 13 `CREATE TABLE`s with
  `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`, named foreign keys (`fk_*`), unique and plain
  indexes (`uq_*`, `ix_*`): 49 statements.
- `drizzle/0001_seed_access_control.sql`: locales `en` (default) and `ar` (`ar-SA`); the 4 roles; **129 permissions**;
  **296 role-permission rows**. It is generated from `src/server/policy/registry.ts` by
  `scripts/generate-access-seed.mjs`, which refuses to overwrite a different existing seed. `npm run db:check`
  re-derives it and fails on any drift.
- `drizzle/meta/` (journal and snapshots); `drizzle.config.ts` is the only file allowed to import `drizzle-kit`.

### 8. Migration proof
`scripts/db-migrate.mjs` (`check | status | up [--backup-file=…] [--set-database-default]`), on
`src/server/db/migrate.ts`:
- **Before any database work:** the journal is read and checked: consecutive indexes, tag format, strictly increasing
  timestamps, every listed file present, no unlisted `.sql` file (the stock migrator would skip it silently), and the
  reviewed table options on every `CREATE TABLE`.
- **Lock:** `GET_LOCK('rawasy_migrate.<database>', 0)`. MariaDB lock names are server-wide, so the name includes the
  database. A second runner exits 2 and changes nothing.
- **History:** every applied file's SHA-256 must equal the file on disk (Drizzle-compatible hash). A changed file, a
  database newer than the code, or a history out of journal order exits 3. Nothing is skipped silently.
- **Charsets:** an empty database gets the default collation `utf8mb4_unicode_520_ci` explicitly (MariaDB 11.4's server
  default is not that). Every table and column is checked against the rules in item 7 before and after applying; a
  mismatch exits 5.
- **No reliance on DDL atomicity:** DDL commits implicitly in MariaDB, so files run statement by statement, a data-only
  file runs in one transaction, and the bookkeeping row (`__drizzle_migrations`, file hash) is written only after the
  file succeeded.
- **Backup hook:** dormant locally. Outside `APP_ENV=local`, once the database has tables, `--backup-file=<path>`
  must name a backup less than 60 minutes old (exit 4).
- **Audit:** every run writes a `db.migrate` audit row (actor `cli`, success or failed). Exit codes 0–6.
- **Tests:** the integration file `migrations.test.ts` (13 tests, real MariaDB, through the CLI with its exit codes)
  covers: empty database; second run unchanged; lock held (exit 2); a changed applied file (exit 3); a table with
  another collation (exit 5); journal order; an unlisted file; missing table options; database newer than the code;
  backup required outside local (exit 4, and no credential printed); no database during `next build`.
- **On the local development database:** `status` prints "Database default: utf8mb4 / utf8mb4_unicode_520_ci;
  tables: 14 · Applied (2): 0000_access_control, 0001_seed_access_control · Pending (0)". The 14 tables are the 13
  tables plus the bookkeeping table.

### 9. Local MariaDB version
**11.4.13-MariaDB-ubu2404**: the official `mariadb:11.4` image in Docker, bound to `127.0.0.1` only. The A2
user has `ALL PRIVILEGES ON rawasy\_%.*`: the development database plus the throwaway test databases, which the tests
create and drop. Its credentials exist only in the session's scratch folder, never in the repository. No connection
to any Namecheap database was made or attempted, and no production credential was asked for.

### 10. Connection-pool implementation
`src/server/db/pool.ts`:
- one lazy `mysql2` pool per Node process (`globalThis` holder, created on first use);
- `connectionLimit = DB_POOL_LIMIT` (**production default 2**, 1–4 accepted, never derived from an assumed process
  count; A1 budget `P × L + R ≤ U`); `maxIdle = limit − 1`, `idleTimeout` 30 s, `queueLimit` 50 (fails fast);
  `connectTimeout` 10 s; keep-alive; `multipleStatements: false`; `maxPreparedStatements` 64; `timezone: "Z"`;
- connection collation `utf8mb4_unicode_520_ci`. Each new connection runs `SET time_zone = '+00:00'` and a strict
  `sql_mode` (`STRICT_ALL_TABLES, NO_ZERO_DATE, NO_ZERO_IN_DATE, ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION`)
  before its first query. A connection whose setup fails is destroyed;
- `client.ts`: `drizzle(pool)` with no schema (core builder only). `inTransaction` takes its own connection, releases it
  in `finally` and retries once on a deadlock (1213). Drizzle's own pool transaction leaks the connection when `BEGIN`
  fails;
- errors are reduced to the driver's code (`dbErrorInfo`, `describeDbError`). Drizzle's error message holds the SQL and
  its parameters, so it is never logged or shown. The CLIs use a pool of 1.

### 11. Auth implementation
- **Layers.** Framework-free services in `src/server/auth/*` take their dependencies (pool, clock, hasher, key ring,
  mailer, base URL) as one object, so the CLIs and the integration tests drive exactly the code the app runs.
  `src/server/admin/*` is the Next.js side:
  - `getAdminState()` (React `cache`, once per request) reads the `__Host-rawasy_admin` cookie and validates the
    session in the database;
  - `requireActor()` redirects to sign-in, the second step or the required set-up;
  - `actionContext(action, { permission, stepUp })` starts every authenticated Server Action. It checks the origin, the
    permission and the 10-minute step-up, and audits every refusal;
  - `publicActionContext()` (sign-in, invitation, reset) checks the origin only;
  - the 2FA set-up actions (also reachable during the required set-up) check the origin and, for a replacement, the
    step-up themselves; their refusals are audited through the same `auditDenied` helper.
- **Checked everywhere server-side.** Every page and layout calls `requireActor()`. Every Server Action calls
  `actionContext`/`publicActionContext`, and the services repeat the rank and last-Owner rules themselves. The proxy
  never checks a session.
- **Sign-in states:** anonymous → password → (2FA enrolled) second step on a pending session (10 minutes, grants
  nothing) → active; Owners and Admins without 2FA → the required set-up page only. Signing in always issues a new
  session (no fixation).
- **No enumeration.** Unknown email, wrong password, disabled, invited and locked accounts all return the same
  "Sign-in failed" message. A dummy Argon2 verification equalises the timing; the integration test measures it.
- **Same-origin rule** (`isSameOriginRequest`): `Origin` must equal `ADMIN_BASE_URL` exactly; a missing Origin is
  refused; when `Sec-Fetch-Site` is present it must be `same-origin`. This is on top of Next.js's own Server Action
  host check.
- **Lint guards** (`eslint.config.mjs`, each proven to fire with probe files):
  - no `db.query` / `tx.query` (Drizzle's relational API emits `LATERAL` joins MariaDB lacks);
  - no `drizzle(…, { schema | mode })`;
  - no `drizzle-kit` import outside `drizzle.config.ts`;
  - public files (`src/app/(commerce)/**`, `src/app/*`, `src/components/commerce/**`, `src/content/**`, `src/lib/**`,
    `src/i18n/**`, `src/proxy.ts`) may not import `src/server/**`;
  - admin client components may import only `@/server/admin/actions/*` from the server tree.

### 12. Password hashing implementation
`src/server/security/password.ts` and `password-policy.ts`:
- **Argon2id** (`@node-rs/argon2`): m = 19,456 KiB, t = 2, p = 1 (the OWASP minimum profile), a self-describing PHC
  string;
- **scrypt fallback** (Node's built-in): N = 2^15, r = 8, p = 1, 32 bytes, for a host where the native module cannot
  load (`AUTH_PASSWORD_HASHER=scrypt`). Each hasher verifies the other's hashes;
- **rehash on login** when the stored hash uses another algorithm or weaker parameters (audited
  `auth.password_rehashed`). It is written only over the hash that was verified, so a password changed or reset while
  the new hash was computed is never overwritten;
- **no pepper** (`AUTH_PEPPER` does not exist);
- passwords compared as NFKC text;
- **policy:** 12–128 characters, no composition rules; refused when common or leaked (1,642-entry list, SecLists,
  MIT), repetitive, sequential, or containing the user's own name or email;
- plaintext passwords are never stored, logged or audited; the secrets test (item 27) scans the database and every
  console line.

### 13. Invitation and reset implementation
- **Tokens:** `auth_tokens` stores only `SHA-256(token)` (32 random bytes, base64url, 43 characters). Purpose and
  expiry: invitation **72 h**, password reset **30 min**, Owner setup **30 min**. Single use: the row is locked
  `FOR UPDATE` and consumed in the same transaction. Issuing a new token retires the user's earlier tokens of the same
  purpose. Tokens are never logged; links are built from `ADMIN_BASE_URL`, never from the request.
- **Invitation** (`users.invite`, step-up): creates the user `invited` with the chosen roles. Rank rules apply: only the
  Owner invites Admins or Owners. The invitation is mailed when a mailer is configured. **Without one, the page says
  plainly that nothing was sent and shows the link once** for the inviter to pass on; nothing ever claims a delivery
  that did not happen. Accepting sets the password (policy above) and activates the account; it is audited
  `user.invite_accepted`.
- **Reset:** the request page gives one generic answer for any email. Limits: 3 per account per hour and 10 per address
  per hour; refusals are audited `auth.password_reset_throttled` and the answer stays the same. Only an active account
  gets a token. With mail disabled, no token is created and the page says that reset by email is unavailable (an Owner,
  or the server's recovery command, helps instead). Completing a reset signs out every session and clears the lock.
- **Mail abstraction** (`src/server/mail/mailer.ts`): `disabled` (default) or `sink` (local only: messages written as
  JSON files, used by the browser tests); no SMTP transport in A2, so no `SMTP_*` variables.
- **First Owner** (`scripts/admin-bootstrap.mjs --email … --name "…"`): refused while an active Owner exists (exit 2).
  It creates the Owner as `invited` and prints a single-use 30-minute setup link; a run for an Owner who has not
  finished renews the link. No password on the command line; audited `auth.bootstrap`.
- **Recovery** (`--reset <email> [--remove-2fa]`): unlocks, signs out everywhere, prints a 30-minute reset link and
  optionally removes 2FA; audited.

### 14. Session implementation
`src/server/auth/sessions.ts`, `src/server/admin/context.ts`:
- **Cookie:** `__Host-rawasy_admin` = 32 random bytes (base64url). Attributes: `HttpOnly`, `Secure`, `SameSite=Strict`,
  `Path=/`, no `Domain`, no expiry (a browser session cookie; no remember-me). Verified in the browser test: Chromium
  accepts it on `http://localhost`. The database stores only `SHA-256(token)`; malformed tokens are refused before any
  lookup.
- **Lifetimes:** idle **2 h** (moved by use, at most one write a minute) and absolute **12 h** (never extended). A
  pending second-factor session lives 10 minutes and grants nothing. Step-up window **10 min** (`reauthenticated_at`; a
  full sign-in counts as the confirmation).
- **Rotation:** a new token and row on sign-in, after the second factor, after a password change, after 2FA changes, and
  periodically: the shell's `SessionKeeper` calls a rotation action on the first navigation 30 minutes after the
  session began. The old row is revoked `rotated` and honoured for 30 seconds (it resolves to its replacement, so a
  request in flight does not fail), then refused. A rotation keeps the idle and absolute limits, so it cannot extend a
  session. It first claims the old row (`UPDATE … WHERE revoked_at IS NULL`) and only then inserts the successor: a
  session revoked meanwhile (signed out elsewhere, password or role changed) is never given a successor. The request
  then ends at the sign-in page ("Your session has ended"), and its transaction (a password change, for example) is
  rolled back. Two rotations of one session at once leave one successor.
- **Step-up window:** a full sign-in or a step-up (password, and a code with 2FA) opens it. A password change opens it
  only for accounts without 2FA (with 2FA the window still needs a code).
- **Revocation:** sign-out (no grace); "sign out" per session and "all other sessions" on the Sessions page. Forced
  revocation of every session of a user on: password change (others) and reset (all), disabling, a role change, 2FA
  enabled / disabled / reset, Owner "sign out everywhere", the emergency reset. A disabled user's session stops working
  at once, even before revocation (the status is checked on every request).
- **Sessions page:** each live session with browser, address and times (Riyadh time), and a label for a sign-in that
  passed the password but not the second step ("your password was entered here, but not the code").

### 15. Rate-limit and lockout implementation
`src/server/auth/sign-in.ts`, `rate-limit.ts`, `client-ip.ts`:
- **Per account:** 5 failures (password or second factor) within 15 minutes lock the account for **15 minutes**. The
  lock doubles while failures continue (15, 30, 60 … minutes), capped at **24 hours**. The count runs since the last
  success, reset or unlock. A locked account fails exactly like a wrong password; even the right password fails until
  the lock ends. Locks are audited `auth.lockout`; an Owner or Admin can unlock (`user.unlock`, step-up).
- **Second-factor codes** (sign-in and step-up) are checked inside one transaction that holds the user's row
  (`SELECT … FOR UPDATE`): the lock is read, the code checked and the failure counted (or the sign-in completed) under
  that lock. Concurrent wrong codes are therefore checked one at a time: of 12 sent at once, exactly 5 are checked and
  the lock refuses the rest (tested on both paths).
- **In a session**, a password is never checked while the account is locked (step-up, password change, 2FA set-up):
  the answer is "temporarily locked" and nothing is counted. A failure that locks the account, or comes during a lock,
  ends the session it came from.
- **Per address:** 30 sign-in attempts per 15 minutes (fixed window in `rate_limits`, one atomic
  `INSERT … ON DUPLICATE KEY UPDATE`); refused attempts are audited `auth.login_throttled`.
- **Reset requests:** 3 per account and 10 per address per hour.
- **Client address:** the `X-Forwarded-For` entry written by the outermost of `TRUSTED_PROXY_HOPS` trusted proxies
  (local default 0, so the socket address; any other environment must set it explicitly), picked by its raw position
  and only then validated: if a trusted proxy wrote something that is not an address (`unknown`), there is no address,
  never a client-written one. Client-written entries are never trusted.
- **No CAPTCHA** (locked default).

### 16. TOTP and recovery implementation
`src/server/security/totp.ts`, `src/server/auth/mfa.ts`, `sign-in.ts`:
- **RFC 6238:** SHA-1, 6 digits, 30-second steps, **±1 step**. The RFC 4226 and RFC 6238 test vectors are unit tests.
  Constant-time comparison.
- **Replay prevention:** `user_mfa.last_used_step` is updated atomically; a code from a step already used (or older) is
  refused.
- **Enrolment:** password confirmation (refused while the account is locked), then a secret (20 random bytes) shown as
  a QR code (an SVG path drawn by `qrcode-generator`; nonce CSP, no inline style) and as a key. **Nothing is stored
  yet:** the secret goes to the browser sealed (AES-256-GCM with the active key, bound to the user, the session, a
  10-minute expiry and whether it replaces an app) and comes back with the first code. Only a valid code stores it, in
  one transaction holding the user's row, and issues **10 recovery codes**, shown once (format `xxxxx-xxxxx`, 50 bits
  each, stored as `SHA-256` hashes), revokes the user's other sessions and rotates this one. After 10 minutes the
  page offers "Start again".
- **Replacing the app** (step-up): the current app keeps working until the new one is confirmed; the confirmation
  swaps them in one step and replaces the recovery codes. An abandoned replacement changes nothing. A first set-up
  never overwrites an app confirmed meanwhile in another window.
- **Required for Owner and Admin** (they reach only the set-up page until it is done); optional for Editor and Reviewer.
  Only those roles may turn it off: step-up, audited, sessions revoked.
- **Recovery codes:** each works once, as the second factor or for step-up; "Create new recovery codes" (step-up)
  replaces all ten; the dashboard and the sign-in say how many are left.
- **Reset:** an Owner may reset another user's 2FA (step-up, audited `user.mfa_reset`, sessions revoked); an Admin may
  not. `scripts/admin-2fa-reset.mjs` handles the lost-key case.

### 17. Key-version implementation
`src/server/config/env.ts` (`readKeyRing`), `src/server/security/encryption.ts`:
- **Encryption:** TOTP secrets are encrypted with **AES-256-GCM**, a random 12-byte nonce per secret, and the row bound
  in as additional data (`user_mfa:<id>`), so a ciphertext copied to another row does not decrypt.
  `user_mfa.key_version` records the key used.
- **Keys:** `AUTH_ENCRYPTION_KEY` (base64 of exactly 32 bytes) + `AUTH_ENCRYPTION_KEY_VERSION` (1–255) is the active key.
  `AUTH_ENCRYPTION_RETIRED_KEYS` (`version:base64,…`) holds the retired versions still needed for decryption; duplicates
  are refused.
- **Missing or wrong key:** TOTP becomes "unavailable" and is never accepted. Recovery codes still work. The event is
  audited `auth.mfa_key_unavailable`, by code only, never key material.
- **Tools:** `scripts/admin-keys.mjs status` (rows per version and whether each is configured) and `rekey`
  (re-encrypts every older row with the active key). `scripts/admin-2fa-reset.mjs --user … | --all --confirm` is the
  emergency reset when a version is lost for good.
- **Escrow:** no escrow material exists in Git, docs or tests. Tests generate throwaway keys per run.
- **Tests:** the integration tests cover encryption bound to the row, rotation with a retired version, `rekey`, a
  missing key and a wrong key.

### 18. RBAC matrix implementation
`src/server/policy/registry.ts` (code) → seed migration (database). The integration test checks that the database holds
exactly the registry.
- **Roles and ranks:** Owner 100, Admin 80, Editor 40, Reviewer 30.
- **The A1 matrix:** 129 permission keys (A1 §5.4). Owner holds all 129, Admin 107, Editor 36, Reviewer 24. 15 keys are
  "sensitive" (step-up, A1 §3.7).
- **The test transcribes the A1 matrix independently** and compares every role × permission cell.
- **Interpretations of A1 §5.3** (the Owner may change them; item 33):
  - the certificate keys the matrix leaves open follow edit (Owner, Admin) or publish (Owner);
  - `media.view` is granted to all roles;
  - "Project flags — add" has no key yet and waits for A3.
  - The ⚑ defaults are applied as proposed.
- **Rules (`rbac.ts`, enforced again inside the services):**
  - nobody manages an equal or higher rank except the Owner;
  - only the Owner grants Admin or Owner, or resets another user's 2FA;
  - **the last active Owner can never be disabled, demoted or removed.** The rule locks the Owner rows `FOR UPDATE`, so
    two Owners disabling each other at the same moment leave exactly one Owner (tested in 5 concurrent rounds);
  - users are never deleted in A2 (disable only).
- **A2 uses** `users.view`, `users.invite`, `users.edit` (roles and unlock; with the Owner role, 2FA reset),
  `users.disable`, `users.sessions_revoke` and `roles.view` (`users.delete` and `roles.manage` exist but nothing uses them:
  there is no delete and the matrix is read-only). One's own account, password, 2FA and sessions need no permission.
  The other keys are seeded for A3+.


### 19. Audit implementation
`src/server/audit/audit.ts` → `audit_events`:
- **Append-only:** the application only inserts. There is no update or delete path, and no admin screen edits events.
  The optional hash chain (`prev_hash`, `hash`) is left empty; A1 makes it an A8 decision.
- **Each event records:** request id, actor (user, system or `cli`, with label, roles and session), address, action,
  entity, outcome (`success`, `failed`, `denied`), a summary written by code, and `changes` passed through
  `redactChanges` (drops any key that could hold a secret).
- **Events (brief §21 → action):**
  - bootstrap → `auth.bootstrap`, `auth.owner_setup_completed`
  - invite → `user.invite`, `user.invite_resend`; invite accept → `user.invite_accepted`
  - login success → `auth.login`; login failure → `auth.login_failed`, `auth.mfa_failed`, `auth.login_throttled`
  - lockout → `auth.lockout`
  - logout → `auth.logout`
  - password change → `auth.password_changed`; password reset → `auth.password_reset_requested`,
    `auth.password_reset`, `auth.password_reset_throttled`, `auth.recovery_reset`
  - 2FA enable → `auth.mfa_enrolment_started`, `auth.mfa_enabled`; replace → `auth.mfa_replacement_started`,
    `auth.mfa_replaced`; 2FA disable/reset → `auth.mfa_disabled`, `user.mfa_reset`, `auth.mfa_emergency_reset`
  - recovery-code use → `auth.recovery_code_used`, `auth.recovery_codes_regenerated`
  - session revoke → `session.revoke`
  - user disable/enable → `user.disable`, `user.enable`, `user.status_change`
  - role change → `user.roles_change`
  - denied sensitive action → every `actionContext` refusal (other origin, missing permission, missing step-up), the
    2FA set-up's refusals (other origin, replacement without step-up) and every service-level refusal (rank, self,
    owner only, last Owner), outcome `denied`
  - also: `auth.reauthenticated` / `auth.reauth_failed`, `auth.password_rehashed`, `auth.mfa_key_unavailable`,
    `user.unlock`, `db.migrate`
- **Never logged:** passwords, raw tokens, TOTP secrets and codes, recovery codes, keys, database or mail credentials.
  `secrets.test.ts` runs a complete flow (bootstrap, setup, sign-in, 2FA enrolment and challenge, a recovery code, a
  password change, a reset, an invitation). It then searches every value of every table, as text, hex, base64 and
  latin1, and everything written to the console, for the passwords, raw tokens, the TOTP secret (and its sealed
  set-up value), the codes used and the recovery codes: none found. (The local mail sink holds links by design; it exists only with `APP_ENV=local`.)
- **Shown in A2:** the dashboard shows your own last 8 security events; the full viewer is A8.

### 20. Proxy / CSP implementation
`src/proxy.ts` (A1 Correction 1, exactly):
- `isAdminPath` (`/admin` or `/admin/…`, not `/administrator`, `/en/admin` or `/ADMIN`) is checked **first**, before
  any locale logic.
- The admin branch creates a 16-byte nonce (`crypto.getRandomValues`, base64), builds the policy and sets on the
  **request** `x-nonce` and `Content-Security-Policy` (Next.js reads the nonce there and puts it on its own scripts). On
  the **response** it sets the same policy and the admin headers.
- The branch does nothing else: no locale redirect, no public routing, no session, permission or database work.
- Every other path takes the unchanged public branch (locale negotiation, cookie, redirects). The matcher is unchanged,
  so `/api/**`, `/_next/**`, `/media/**` and files stay outside the proxy.
- **Policy:**
  `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
  - plus `upgrade-insecure-requests` over HTTPS only, and `'unsafe-eval'` only under `next dev`;
  - no `'unsafe-inline'`, so the admin uses no inline style attributes;
  - the QR code is an SVG path; Next's route announcer styles itself through the CSS object model, which CSP allows.
- **Proved in the browser test:** the nonce matches `^[A-Za-z0-9+/]{22}==$` and differs between two requests; every page
  script carries the page's single nonce; the served HTML has no script without a nonce and no `style=` attribute; no
  CSP violation fires on the sign-in, dashboard, users, roles or security pages; the public pages carry no CSP and no
  admin header.
- The admin pages are dynamic (`await connection()` in the admin root layout), so each response gets a fresh nonce.

### 21. Admin headers
On every `/admin` response (proxy): `Content-Security-Policy` (above), `X-Robots-Tag: noindex, nofollow`,
`Cache-Control: no-store`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(),
usb=(), browsing-topics=()`. The pages also carry `<meta name="robots" content="noindex, nofollow, nocache">`.
On the API namespaces `/api/admin/**` and `/api/internal/**`, where every endpoint A1 plans lives (uploads, private
files, preview, cron); static, from `next.config.ts`; A2 has no API route, so these addresses are 404s with the
headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox`. Any other
`/api/…` address has no route and keeps Next.js's own 404 exactly as before A2 (see "Deviations": A1 §4 says `/api/**`).
`robots.txt` and `sitemap.xml` are unchanged and do not mention `/admin` (tested).

### 22. Admin routes
Own root layout `src/app/(admin)/admin/layout.tsx` (English, `admin.css`, light and dark from the system setting,
dynamic):
- **Entry:**
  - `/admin/login` (sign-in);
  - `/admin/login/verify` (second step; a pending session only);
  - `/admin/login/enrol` (the required 2FA set-up);
  - `/admin/invite/[token]` (accept an invitation, or the Owner's setup link);
  - `/admin/reset` (request, generic answer);
  - `/admin/reset/[token]` (choose a new password).
- **Shell** (`requireActor()` in the layout and again in every page):
  - `/admin` (dashboard: A2 facts only);
  - `/admin/account` (profile and password);
  - `/admin/account/security` (2FA);
  - `/admin/account/sessions`;
  - `/admin/users` (list);
  - `/admin/users/invite`;
  - `/admin/users/[id]` (manage: roles, enable/disable, sign out everywhere, unlock, 2FA reset by an Owner; no delete;
    step-up gate);
  - `/admin/users/roles` (the read-only matrix).
- Any other `/admin/…` address gets the admin's 404 (`[...rest]`, `noindex`); errors show a plain message (`error.tsx`).
- No public registration and no account enumeration (item 11). The public site has no link to the admin.
- **UI:** a sidebar from 64 rem and a menu below; top bar with brand, View website (into the menu below 40 rem) and an
  account menu; skip link, breadcrumbs, focus rings, loading state, empty states, accessible forms with inline errors,
  native confirmation dialogs, security status. axe (WCAG 2.0–2.2 A/AA + best practice) finds 0 violations on the
  sign-in, dashboard, users, account, security and sessions pages. Seven shell pages have no sideways scroll at 320,
  390, 768 and 1280 px.

### 23. Admin screenshots and evidence
Three contact sheets, captured from the real flows on the final build with throwaway data (a fresh `rawasy_e2e_*`
database, dropped afterwards; the QR code, key and recovery codes in them are worthless): 30 screens, sent with this
report (not committed; the session's scratch folder keeps them and the raw screens).
- **Entry (12):** sign-in; the one failure answer; the first Owner's setup link; the required 2FA set-up (password, then
  the QR code and key "within 10 minutes", then the 10 recovery codes shown once); the second step with a code and with
  a recovery code; accepting an invitation; sign-in in the dark theme.
- **Shell (14):** dashboard; invite (a fresh sign-in counts as the confirmation) and "invitation sent" (mail sink); an
  Editor refused on Users; the user list; managing a user (roles, access, sessions, events; no delete); the roles
  matrix; profile and password; 2FA status; **replacing the app** ("your current authenticator app keeps working until
  the new one is confirmed"); sessions with a sign-in stopped at the second step; the step-up gate after 10 minutes;
  the admin's 404; the dashboard in the dark theme.
- **Phone (4):** 390 and 320 px top bar and menu ("View website" moves into the menu below 640 px), and the roles matrix
  scrolling inside its own box.

### 24. Build-time DB guard
- `getPool()` and `createAppPool()` call `assertNotBuildPhase()`. During `next build`, Next sets
  `NEXT_PHASE=phase-production-build` before it prerenders, and any database use throws `BuildPhaseDatabaseError`, so a
  page that needed the database would fail the build loudly instead of baking data in.
- The admin root layout calls `await connection()`, so every admin route renders on request. The build lists them as
  dynamic (ƒ) and prerenders none (0 `/admin` entries in `prerender-manifest.json`).
- **Proved:** the fresh clone's `npm run build` ran with no `DB_*` variable in the environment at all and passed
  ("✓ Compiled successfully … ✓ Generating static pages using 3 workers (120/120)"). The integration test "the pool refuses to exist in the production build phase" covers the guard.
- **Static public count:** **109 prerendered routes** (the same 109 keys as the baseline; 13 dynamic route patterns
  before and after). The build log's "Generating static pages" says 120/120 instead of 109/109: Next counts the 11 admin
  pages it tried and found dynamic. **102 sitemap URLs**, unchanged.

### 25. Public freeze proof
Against `preserve/pre-admin-a2` (`ed6b652`), both built clean from scratch: the baseline in a worktree, the A2 code in a
fresh clone with `npm ci` and no database settings. Each was served by `server.js` (baseline on port 3500, A2 on 3400).
Every comparison below was run on the final code, a fresh clone of `20bef7a`; the same comparisons on the earlier A2
builds (`0275c7c`, `ce6a63b`) gave identical results. Scripts and raw results stay in the session's scratch folder.

**Build output, file by file** (`.next/server/app` without the admin, 890 files per build):
- every path exists in both builds;
- 114 files are byte-identical;
- 193 differ only by the build id or `/_next/static` chunk names;
- 408 differ only in the router-tree entry that lists the static siblings of the dynamic `[locale]` segment: `[]` became
  `["admin"]` (`"siblings":["admin"]` in the `_tree.segment.rsc` prefetch files). This is Next.js metadata: it tells the
  client router that `/admin` is not a locale (the retired theme lab added the same kind of entry);
- **0 other differences.** 175 server bundles and manifests were compared by module instead.

**Stylesheets:** on all 104 prerendered public pages, the same stylesheets, in the same order, byte-identical.

**Scripts, by module:** every public page loads the same module set with the same code, compared as token streams with
local names renamed by first appearance. Only file names changed: two shared chunks traded modules (6,126 + 162,441 =
12,887 + 155,680 = 168,567 bytes). On all 104 pages the only module-level differences are two: the Turbopack runtime,
which lists the two new chunk names, and one module (Next's error-page styles), which reads differently only because an
object key `d` collided with a renamed local (its raw source is identical). Total script bytes per page are unchanged
(e.g. Projects AR: 605,400 = 605,400).

**HTTP, all 102 sitemap URLs:**
- same status, the same headers (date, etag and cache-state headers aside), the same normalised HTML;
- the same lang/dir, title, description, robots, canonical, hreflang (306 links), Open Graph tags, JSON-LD (208
  blocks), media references (618) and visible text (292,957 characters);
- the same page data (`RSC: 1`);
- `robots.txt`, `sitemap.xml`, the manifest and both icons byte-identical; `/favicon.ico` (no such file: a 404 in both)
  answers with the same status and headers, and its body differs only by the build id and chunk names.

**Redirects and locale negotiation (14 cases), all identical:** `/` (no header → `/en`; `ar-SA` → `/ar`; `fr-FR` →
`/en`; cookie `NEXT_LOCALE=ar` → `/ar`), `/about` (with and without the cookie), `/services/laser-cutting` (Arabic
header), `/projects/clock-tower-landmark`, `/contact?x=1`, `/administrator`, `/admin-panel`, `/ADMIN`,
`/adminx/login` and `/theme-lab/en/modern-commerce-a-v2` (each → its `/en/…` address, as before).

**404s (12 cases), identical** status, title, robots and headers: `/en/not-a-page`, `/ar/not-a-page`,
`/en/services/unknown`, `/ar/projects/unknown`, `/en/projects/unknown/deeper`, `/en/admin`, `/ar/admin/login`,
`/media/nope.webp`, `/_next/static/nope.js`, `/api/anything`, `/api/no-such`, `/api/administrator`.

**Held-back media:**
- `scripts/package-namecheap.mjs` (unchanged) on the A2 build of `0275c7c` (whose public output equals the final one by
  the comparisons above) still holds back exactly the 13 files (10 project photos and 3 Laser Engraving images, through
  the media registry), and every archive check passes: 0 of 13 in the archive; 0 pages,
  page data, styles or scripts referring to a held-back file; 111 / 111 referenced public files; 102 sitemap pages
  complete;
- no public page refers to any of them (the media lists are identical);
- each of the 13 addresses answers the same in both builds (200 locally: the files are in `public/`, kept out only of
  the deployment archive, as before).

**The intended differences**, and only these:
- `/admin` and `/admin/login` now reach the admin (before: `307 → /en/admin` and the localized 404);
- `/api/admin/…` and `/api/internal/…` (404s in both) now carry the API headers. Every other `/api/…` address
  (`/api/anything`, `/api/no-such`, `/api/administrator`) answers exactly as before.

**Pixels.** 11 representative pages, captured screen by screen (up to 6 screens) in EN/AR × light/dark × desktop
1440 × 900 / phone 390 × 844, with reduced motion, every image decoded and the map stubbed: `/en`, `/ar`, `/en/about`,
`/ar/services/laser-cutting`, `/en/services/laser-engraving`, `/en/projects`, `/ar/capabilities`, `/en/contact`,
`/ar/certificates`, `/en/projects/clock-tower-landmark`, `/ar/not-a-page`. On the final build:
- **238 screens; 236 pixel-identical** at the first pass.
- The other 2 (`/ar/services/laser-cutting`, phone, light, screens 1 and 2: 31 and 882 pixels) were captured 3 more
  times per build: screen 2 was identical in every pair, and screen 1's 31 pixels differ between the baseline's own
  captures too (anti-aliasing in the Laser Cutting drawing): run-to-run noise, not a change.
- Two homepage phone states read different page heights (12,063 vs 11,980 px; 12,030 vs 11,928 px) while all their
  compared screens were identical. On both builds the homepage measures 11,980 px at load and 12,063 px once its images
  have loaded (11,928 → 12,030 in Arabic), 3 times out of 3, and all 15 screens of each page are pixel-identical: the
  script had read the two builds at different loading moments.
- The same comparison on the `0275c7c` build: 230 / 238 identical, its 8 differences likewise run-to-run noise.

### 26. Existing public E2E result
On the fresh clone of `20bef7a` (the final code), served by `server.js` on port 3400 after the image warm-up
(1,484 / 1,484 sizes):
- **612 / 612** (21.8 min). No test was changed, skipped or retried.
- Every other full run is reported too:
  - **`ce6a63b`: 611 / 612.** `commerce-inner.spec.ts` › "outside any language (paths the locale handling never sees),
    the fallback is unchanged" failed at `/api/no-such`: A2's API headers stopped Next.js's client-built 404 there.
    Fixed in `20bef7a` by scoping the headers, with the test unchanged ("Deviations").
  - **`20bef7a`, first run: 611 / 612.** `commerce-capabilities.spec.ts` › "/en → #tube-cutting-12kw: the homepage
    showcase's link opens Capabilities on that machine" timed out: its click on a machine pick in the frozen homepage
    showcase was lost (the pick took focus; the stage stayed on the first machine). Investigated, not dismissed: the
    homepage's HTML, page data, styles and scripts equal the baseline's (item 25). The 12 showcase-link tests, 10 times
    each, at the suite's 3 workers: 120 / 120 on the A2 build **and** 120 / 120 on the baseline. At 8 workers (heavier
    load): 1 / 120 failed on the A2 build **and** 1 / 120 on the baseline, with the same symptom. A pre-existing race of
    the frozen component under load (limitation 11), not an A2 change.
  - An earlier partial run on the `0275c7c` build was stopped at 135 / 135 for a rebuild; it is not counted.

### 27. New A2 test result
On the fresh clone of `20bef7a`, against the local MariaDB 11.4.13:
- `npm run test:unit`: **15 / 15** (security primitives without a database: TOTP with the RFC test vectors, base32,
  AES-256-GCM and key rings, the client address including the raw-position rule, ids and tokens, password policy and
  hashing, audit redaction).
- `npm run test:integration`: **83 / 83** in 8 files, each on its own fresh `rawasy_t_*` database (migrations, sign-in
  and lockout, sessions, tokens, two-factor, RBAC and user management, secrets), 11 of them added with the review fixes.
- `npm run test:admin`: **24 / 24** (the production build, `server.js` on 3401, a fresh `rawasy_e2e_*` database, a
  throwaway key, the mail sink), 2 of them added with the review fixes.
- `npm run db:check`: drizzle-kit check passes; 2 migration files; the seed equals the registry.
- Negative control: the 15 new or changed integration and unit tests, run against the code before the review fixes:
  13 fail there (section "Independent code review").

### 28. Combined test result
- existing public suite: **612 / 612**
- new A2 suites: **122 / 122** (unit 15, integration 83, admin browser 24)
- combined: **734 / 734**

### 29. Audit result
On the fresh clone of `20bef7a` after `npm ci`:
- **`npm audit --omit=dev`: found 0 vulnerabilities** (the served application).
- **`npm audit` (with development dependencies): 9 entries (4 moderate, 5 high), all development-only, both chains
  already understood:**
  - **5 high** (pre-existing since Stage 1J, unchanged): `braces` ← `micromatch` ← `fast-glob` ←
    `@next/eslint-plugin-next` ← `eslint-config-next`, the lint toolchain. The only offered fix is `--force` to
    `eslint-config-next@14.2.35`, a breaking downgrade; not run.
  - **4 moderate (new with A2):** `esbuild` ≤ 0.24.2 (GHSA-67mh-4wv8-2f99: esbuild's *development server* answers other
    sites' requests) ← `@esbuild-kit/core-utils` ← `@esbuild-kit/esm-loader` ← `drizzle-kit` 0.31.11. drizzle-kit only
    transpiles the schema for `generate` / `check` and never starts esbuild's server. It is a dev dependency, absent
    from a production install. The only offered fix is `--force` to `drizzle-kit@0.18.1`, a breaking downgrade; not run.
    For the Owner: accept as dev-only, or drop drizzle-kit and write migrations by hand (not recommended: the generated
    and reviewed SQL is safer).

### 30. Lint
`npm run lint` (eslint 9, with the A2 rules in item 11): 0 problems, in the working tree and in the fresh clone of
`20bef7a`.

### 31. Typecheck
`npm run typecheck` (`next typegen` + `tsc --noEmit`, the tests and scripts included): 0 errors, in both.

### 32. Build
`npm run build` on the fresh clone of `20bef7a` with no `DB_*`, `AUTH_*` or `.env.local` at all: success ("✓ Compiled
successfully", "Generating static pages … (120/120)"). 109 prerendered public routes (+ 11 admin pages found dynamic),
13 dynamic route patterns, 102 sitemap URLs (item 24). The routes manifest holds exactly two header rules, for
`/api/admin/:path*` and `/api/internal/:path*`.

### 33. Outstanding limitations
1. **A release from this branch would carry `/admin`.**
   - A1 says nothing from the admin reaches production before the A9 cutover (T1 = Option B), and nothing is deployed.
   - But a package built from this branch includes the admin routes. Without database settings, the sign-in page
     shows, and any sign-in fails with "Something went wrong" (the database is not configured).
   - **Before the next production release, the Owner decides how pre-A9 releases leave `/admin` out.** Options:
     - (a) cut them from a branch without the admin;
     - (b) a build switch that makes the proxy answer 404 for `/admin` in a static release;
     - (c) a web-server rule.
   - (b) is the cleanest; it needs the user's go-ahead (scope).
2. **No mail transport** (A2 has `disabled` and the local `sink`; no `SMTP_*`).
   - Invitations show their link once to the inviter.
   - Password reset by email says it is unavailable; recovery goes through an Owner or the server's CLI.
   - A real transport is a later decision: production SMTP was out of bounds.
3. **Step-up after a fresh sign-in.** A full sign-in (password + code) counts as the 10-minute confirmation (A1 §3.7
   reading); the gate appears once 10 minutes have passed. The Owner may want a separate confirmation even right after
   signing in.
4. **Periodic rotation needs navigation.** The shell rotates the session on the first navigation 30 minutes after it
   began. A tab left open on one page rotates at its next navigation; the idle and absolute limits still apply.
5. **Lockout as a denial-of-service lever.** Anyone who knows an admin email can keep that account locked (by design of
   any account lockout; capped at 24 h; the per-address limit slows it). While it is locked, the account's live
   sessions keep working but cannot confirm identity for sensitive actions, change the password or set up 2FA (review
   finding 3). The Owner can unlock; the recovery CLI also unlocks.
6. **Interpretations of the A1 matrix** (item 18), for the Owner to confirm:
   - the certificate keys the matrix leaves open;
   - `media.view` for all roles;
   - no key yet for "Project flags — add".
7. **Audit hash chain** (`prev_hash` / `hash`) not filled: an A8 decision in A1.
8. **Concurrent wrong passwords at the sign-in page.** The password is hashed outside the user-row lock (holding a
   row lock and a pooled connection through an Argon2 hash would let one client stall the pool), so wrong passwords
   arriving at the same instant can each be checked before the lock is written. The per-address limit (30 per 15
   minutes) bounds it per network; codes and every in-session check are serialized (item 15). A reservation scheme
   (count first, hash second) would close it; proposed for A8 hardening, not done.
9. **A started 2FA set-up lasts 10 minutes** (sealed in the page, never stored); after that the page offers "Start
   again". A session rotated in between (another tab's sign-out of this session, for example) also needs a new start.
10. **`npm audit` dev-only entries** (item 29): 5 high (lint chain, pre-existing) and 4 moderate (drizzle-kit's esbuild,
   new). Both are fixable only by breaking downgrades.
11. **Public-site limitations** recorded in earlier stages are unchanged, because the public site is unchanged. One was
    newly *measured* in A2 and is pre-existing: the frozen homepage's machine showcase (`MachineShowcase.tsx`, byte-
    identical to TM-3 and pinned by hash) can lose a pick clicked while the page is still hydrating: the pick takes focus,
    the stage stays on the first machine. Under heavy load (8 parallel browsers on 4 CPUs) the 12
    "homepage showcase's link" tests fail 1 in 120 on the A2 build **and 1 in 120 on the baseline build**, with the same
    symptom; at the suite's normal 3 workers both builds pass 120 / 120. It is why one full public run ended 611 / 612
    (item 26). Not changed in A2: the homepage is frozen, and the public tests are not to be rewritten. Two possible
    fixes for the Owner (Owner decision 7 below): a test-only wait for the showcase's hydration
    (`.a2-mx-stage[data-js]`) before the pick is clicked, or a component change so that an early pick is not lost.
12. **Not tested here:** a real host (Passenger process model, LiteSpeed in front, `X-Forwarded-For` hops), real
    MariaDB account limits, and email delivery. These are pre-staging checks (item 34).

### 34. Account-specific Namecheap checks still pending
None blocks local A2. Each comes before any staging or production use (A1-ARCHITECTURE §7.3):
- the actual Node process behaviour (how many processes Passenger runs, their lifetime): sets `DB_POOL_LIMIT` through
  `P × L + R ≤ U`;
- `max_user_connections` (U) and `wait_timeout`;
- the MariaDB account's auth plugin (mysql2 cannot do ed25519 / PARSEC) and its grants (DDL for migrations?);
- SSH / cPanel Terminal access (the bootstrap and recovery CLIs need a shell in the app's environment);
- actual resource usage (memory with Argon2's 19 MiB per hash, entry processes);
- upload limits (A4);
- mail and DNS (records before any change; whether to use the host's SMTP);
- SSL (`__Host-` cookies need HTTPS; `upgrade-insecure-requests` is sent only over HTTPS);
- `TRUSTED_PROXY_HOPS` behind LiteSpeed (must be measured, not assumed);
- the escrow procedure for `AUTH_ENCRYPTION_KEY` and a `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` per release.

### 35. Confirmation: no A3 implementation
- No CMS editing, media library, page builder, navigation/settings management, enquiries, publishing, revisions,
  scheduling, preview, cache handler, public projections, redirects, persistent media or visual editor.
- No public page reads the database: no public repository adapter; `src/content` is untouched.
- Only the 13 A2 tables exist. Permission keys for later phases are seeded, but nothing uses them.

### 36. Confirmation: nothing deployed
- Nothing was uploaded, packaged for a host or published. The test archive made by `scripts/package-namecheap.mjs` stayed
  in the session's scratch folder.
- No Namecheap database, cPanel app, DNS, nameserver, SSL, email or SMTP change.
- No production secret was created. No connection to any remote database. All databases were local throwaway ones.

### 37. Confirmation: main untouched
`main` was not checked out, merged, pushed or modified. All work is on `claude/new-session-5eijs6`; the only other push
was the new branch `preserve/pre-admin-a2`.

## Deviations from A1 and interpretations (reported, not silent)
- **The A1 matrix:** the interpretations in item 18. Everything else follows A1 §5.1–§5.4 key for key (tested).
- **Step-up:** a full sign-in counts as the confirmation (item 33.3). A1 §3.7 says "a password (and TOTP when enabled)
  confirmation within the last 10 minutes"; a sign-in is one.
- **Lockout escalation** counts failures since the last success, reset or unlock (A1 says "increasing"; this is how).
- **Mail:** no SMTP transport in A2 (the brief: `SMTP_*` only if required). The flows say plainly when nothing is
  sent.
- **`CONTENT_SOURCE`:** not read by anything in A2 (no database mode exists yet). A validator added early and called
  by nothing was removed (`0275c7c`); A3 adds the reader where the public read model starts. The public site is static
  by construction.
- **Hash chain:** not filled (A8 decision, as A1 says).
- **The API headers' scope:** A1-SECURITY-RBAC §4 gives "`/api/**`" the static headers, including
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox`. Applied to every `/api` address, that
  policy also stopped Next.js's own client-built 404 at unknown `/api/…` addresses (scripts, styles and fonts refused;
  the tab kept the server's "Page not found" instead of "404: This page could not be found."), and the approved public
  test `commerce-inner.spec.ts` › "outside any language … the fallback is unchanged" failed on `/api/no-such`. The brief
  forbids rewriting a public test to accept changed output, so A2 scopes the headers to `/api/admin/**` and
  `/api/internal/**`, where every endpoint A1 plans lives (uploads, private files, preview, cron); every other `/api`
  address has no route and is unchanged since before A2. The brief's §23 asks for these headers on "API admin
  responses"; they are there. A1's documents were not edited (A1 is closed): this report records the change.
- **`user_mfa.confirmed_at`:** A1 describes it as "NULL until the first valid code". A2 never stores an unconfirmed
  set-up (it travels sealed until confirmed; review finding 1), so every row A2 writes is confirmed. The column and its
  meaning are unchanged; A2 just never writes the NULL case.
- **Admin UI layout choices** made for this phase (not specified by A1):
  - "View website" moves into the menu below 40 rem;
  - sessions that stopped at the second step are labelled on the Sessions page.
- No A1 architecture decision was changed: the proxy branch, pool budget, key escrow, T1 = Option B, Drizzle core only
  and the build guard all follow A1 and its Correction 1.

## Defects found and fixed during A2 QA (before this report)
- **The admin's top bar overflowed phones** (137 px at 320, 67 px at 390): View website moved into the menu below
  40 rem, tighter paddings.
- **The roles matrix widened the page** on phones. Its visually hidden cell text (absolutely positioned) escaped the
  scroll box. Fixed with a positioned scroll box and a `minmax(0, 1fr)` main track.
- **`/admin/reset` answered 500 on a server without database settings** (it built the pool only to ask whether mail is
  configured). It now reads the mail setting directly.
- **Session rotation moved the idle limit** (it counted as activity). A rotation now keeps both limits; tested.
- **The full public suite on the fresh clone of `ce6a63b` failed one approved test:** `commerce-inner.spec.ts` ›
  "outside any language (paths the locale handling never sees), the fallback is unchanged". At `/api/no-such` the A1
  API headers' sandbox CSP stopped Next.js's client-built 404 (the tab title stayed "Page not found"). The headers now
  cover only `/api/admin/**` and `/api/internal/**` (see "Deviations"); the test is unchanged and passes.
- Browser-test issues, not product defects:
  - Next's route announcer counted as a styled element and an alert;
  - a race between a Server Action's redirect and the next navigation;
  - case-insensitive text filters matching hidden dialog text;
  - a step-up test that assumed no confirmation right after sign-in.
  Each was fixed without weakening what the test proves (see the commit messages and `e2e-admin/`).

## Independent code review of the security core, and its fixes
Before this report, a separate review agent read the security core (sign-in, sessions, two-factor authentication,
step-up, the Server Actions, the proxy branch, the client address) looking for real defects. It reported eight. Each was
verified against the code, fixed in `ce6a63b`, and given a test. The 15 new or changed integration and unit tests were
then run against the code before the fix (`45ec91e`, with two inert shims so the files load) as a negative control:
13 fail there, each on the defect it targets; finding 1's tests and the secrets test also stumble on the missing sealed
value, so finding 1 is proven by the assertion named below. The other 2 guard the new design and pass on both (a first
set-up never overwrites one confirmed meanwhile; the rehash is audited). All 15 pass after the fix.

| # | Finding (verified) | Fix | Proof |
|---|---|---|---|
| 1 | **Replacing the authenticator removed the working one at "Continue".** An abandoned replacement left the account with no second factor. For an Owner or Admin the password alone then reached the required set-up again, where a stolen password could enrol the attacker's app. | Nothing is stored until the new app is confirmed. The new secret travels sealed (AES-256-GCM with the active key, bound to the user, the session, a 10-minute expiry and the replace flag). The confirmation writes the row in one transaction holding the user row. A first set-up never overwrites one confirmed meanwhile. In the UI: a hidden field, and "Start again" after 10 minutes. | Integration: nothing stored before the code; the set-up is bound to its user and session; 8 forged or altered sealed values are refused; expiry; the old app still signs in until the confirmation, then only the new one. Browser: the same with the real pages (the old app's code refused, the new one accepted, other sessions signed out). Before: a row was written at "Continue" (assertion "nothing stored" fails), and a separate control script showed the effect: after an abandoned replacement, the password alone signed an Admin in (`signed_in`, set-up required, no code asked). On the fixed code the same script gets `mfa_required`, and the current app's code completes the sign-in. |
| 2 | **A password change opened the 10-minute step-up window.** With 2FA that window normally needs the password and a code. | Only for accounts without 2FA. | Before: the window reopened for a 2FA account. After: unchanged. |
| 3 | **In a session, passwords were checked while the account was locked** (step-up, password change, 2FA set-up): a password oracle around the lock. | Refused while locked ("temporarily locked"); nothing checked or counted. A failure that comes during a lock also ends its session. | Before: the password was checked and accepted, and the session survived a failure during a lock. After: `locked`, no attempt recorded, the session ended. |
| 4 | **A rotation could revive a revoked session.** The successor was inserted first, then the claim of the old row silently matched nothing. Two concurrent rotations made two successors. | Claim first (`UPDATE … WHERE revoked_at IS NULL`), then insert. Otherwise `SessionEndedError` rolls the transaction back and the request ends at sign-in ("Your session has ended"). The periodic rotation treats it as nothing to do. | Before: no rejection; 2 successors. After: rejected, no successor, a password change in that request rolled back; 1 successor. |
| 5 | **Second-factor checks raced the lockout:** 12 concurrent wrong codes were all checked (the limit is 5). | The lock read, the code check and the failure (or the completed sign-in) run in one transaction holding the user row (`SELECT … FOR UPDATE`), at sign-in and at step-up. | Before: 12 of 12 checked, on both paths. After: exactly 5; the lock refuses the rest. |
| 6 | **The sign-in rehash could overwrite a password changed or reset while the new hash was computed.** | Written only over the hash that was verified. | Before: overwritten. After: kept, and no `auth.password_rehashed` event. |
| 7 | **Refusals of the 2FA set-up actions were not audited** (another origin; a replacement without a recent step-up). | Through the shared `auditDenied` helper, like every `actionContext` refusal. | Browser: replayed set-up requests (cross-site, a foreign origin, a stale step-up) are refused, carry no secret and are audited; the genuine replay works (positive control). Not run against the old build. |
| 8 | **`X-Forwarded-For`: malformed entries were dropped before counting,** so a client-written address could slide into the trusted position when a proxy writes, for example, `unknown`. | Picked by raw position, then validated. An invalid entry there gives no address. | Unit: before, the client's `203.0.113.9`; after, `null`. |

Found while fixing finding 5, not reported by the review: concurrent wrong **passwords** at the sign-in page are hashed
outside the row lock. It is recorded as limitation 8 (item 33), with the proposed fix.

## Items needing the Owner's (RAWASY's) confirmation
1. **Pre-A9 releases and `/admin`** (limitation 1): which option (a), (b) or (c) — before the next production release.
2. **The matrix interpretations** (item 18): certificate keys, `media.view` for all, "Project flags — add" in A3.
3. **Step-up right after sign-in** (limitation 3): keep "a sign-in counts", or always ask again for sensitive actions.
4. **Mail for invitations and resets:** keep "show the link once" until a transport is approved, or choose a transport
   (and its account) for staging.
5. **drizzle-kit's dev-only advisory** (item 29): accept as development-only (recommended) or drop the generator.
6. **The account checks of item 34** before any staging use, and the key-escrow procedure (who holds the offline copy).
7. **The homepage showcase's early-click race** (limitation 11, pre-existing, the same on the baseline): leave it, add a
   test-only hydration wait to the 12 showcase link tests, or change the frozen showcase component.
8. **The API headers' scope** ("Deviations"): keep them on `/api/admin/**` and `/api/internal/**` (A2's choice, so the
   approved public 404 test passes unchanged), or extend them to every `/api` address and update that public test.

## How to run (local)
README → "Admin (local development)". Briefly:
1. Start a local MariaDB 11.4 (Docker command in the README) and create `rawasy_admin`, with a user allowed on
   `rawasy\_%`.
2. Copy `.env.example` to `.env.local` and fill the `DB_*` settings and a throwaway `AUTH_ENCRYPTION_KEY`.
3. `node --env-file=.env.local scripts/db-migrate.mjs up`.
4. `npm run dev`.
5. `node --env-file=.env.local scripts/admin-bootstrap.mjs --email … --name "…"`, then open the printed link.

Tests:
- `npm run test:unit`;
- `TEST_DB_*=… npm run test:integration`;
- `npm run build && TEST_DB_*=… npm run test:admin`;
- the public suite as before: `npm run test:e2e`, no database needed.

## Next steps (after independent review)
1. The user's independent review of A2: this report, the evidence and the branch.
2. On approval and the user's go-ahead only: **A3 (Core CMS)**. Its first decisions:
   - where `CONTENT_SOURCE` is read;
   - the cache handler of A1 §8;
   - the public read model.
3. Before any staging: the account checks (item 34), the `/admin` release decision (limitation 1), and the key escrow.

---

A2 STATUS: READY FOR INDEPENDENT REVIEW


---

## A2 CORRECTION 1

Date: 2026-10-09/10 · Branch: `claude/new-session-5eijs6` · Brief: "RAWASY METAL WEBSITE / ADMIN / CMS PROGRAM / PHASE A2 —
CORRECTION 1 / SESSION PRIVILEGE BOUNDARY + RECOVERY CODE STRENGTH / CONCURRENT PASSWORD ADMISSION + PRE-A9 ADMIN GATE /
LOCAL ONLY — DO NOT START A3".

### Summary and status

The independent review of A2 found four defects. All four are corrected, each in its own commit, each with tests that
fail on the reviewed code (`b47d8e5`) and pass now:
1. **Rotated tokens (critical).** After a rotation the old session token was honoured for 30 seconds and resolved to its
   successor, so a token from before the second factor, a step-up, a password change or a 2FA change took on what the
   new session had been given. A revoked token now never authenticates.
2. **Recovery codes:** 50 → 100 bits each (20 Crockford Base32 characters, `xxxxx-xxxxx-xxxxx-xxxxx`).
3. **Concurrent wrong passwords:** at most 5 password checks (Argon2 or the dummy hash) per email in any 15 minutes,
   reserved atomically in the database before the account is even looked up.
4. **The pre-A9 admin gate:** outside local development the admin is off unless `ADMIN_ENABLED=1`. Off, `/admin/**`
   is the public site's unknown address again (locale redirect, localized 404) — exactly as before A2 — and every admin
   layout, page and Server Action refuses on its own as well.

The brief's focused security review (§13) then found one more case of the kind the brief rules out: a sign-in whose
password was checked just before a password reset, a password change or a disable still created its session afterwards
(a defect present since A2). It is fixed, with three smaller findings (`ba53a3e`). The fresh-clone QA found a race in
the new credential-check slots, also fixed (`4eab6d3`). Two more review passes followed on the corrected code: the
second found six smaller gaps (`d9bec5a`); the third found one more case of the kind the brief rules out — an invitation
link that outlived a role raise of the invited account, so an Admin holding the link could have activated an Owner
account — and a deadlock in the new limiter (`ddf7b71`). Seven more passes followed, each on the fixes of the one
before; the first six each found something smaller: a promotion that could land on an account its inviting Admin had
just activated (`6ac8c55`); a user-management form that could undo a change made after its page was shown, and a
sign-out that did not follow a session's rotation (`89edcc5`); role boxes sent with a newer fingerprint after the page
refreshed (`b66468d`); a two-factor reset let through after the password was replaced, and older role boxes restored on
Back (`da3e5a3`); an availability lever in that reset's fingerprint and the emergency CLI's lock order (`98735f9`). The
ninth found that the reset still missed a sign-in that passed the password, and that the emergency CLI could lose the
links it had issued when one user failed (`d21e222`); a tenth pass reviewed that round and found no High or Medium
defect and no old-credential path; its six Low and Info items are recorded in item 32, and the review loop ends there.

The public website is unchanged: proven again against `preserve/pre-admin-a2` (item 19), now including `/admin` itself,
which with the gate off answers exactly as the baseline did.

Nothing was deployed. `main` was not touched. A3 was not started.

**Final QA, on a fresh clone of `d21e222` (the final code):** `npm ci`; `npm audit --omit=dev` 0 (the full audit: A2's 9
development-only entries, unchanged); lint, typecheck and build (no database settings) clean; `db:check` clean; unit
**26 / 26**, integration **157 / 157**, admin browser **44 / 44** (A2: **227 / 227**); public E2E **611 / 612** in the
first full run — one Chromium view-transition timeout under load, which passes 20 / 20 on this build and 20 / 20 on the
baseline (item 20) — and **612 / 612** in the second full run (combined **839 / 839**). The public site is proven
unchanged against `preserve/pre-admin-a2` (item 19).

**A2 CORRECTION 1 STATUS: READY FOR INDEPENDENT REVIEW** (not self-approved).

### Owner decisions recorded (brief §10, locked; not asked again)

1. RBAC: certificate edit = Owner + Admin; certificate publish = Owner only; `media.view` = all four roles; A3 will add a
   "project flags — add" permission (Owner, Admin, Editor and Reviewer may add restrictive flags; only Owner and Admin
   may clear blocking flags or approve public media). Nothing in A2's matrix changed for this: these keys belong to A3.
2. A complete sign-in with password and required 2FA counts as the re-authentication for 10 minutes (unchanged).
3. Mail stays disabled / local sink; no SMTP.
4. drizzle-kit's advisory is accepted as development-only: no forced downgrade; the production audit stays 0 (item 25).
5. The homepage showcase race: component and tests unchanged.
6. The API headers stay on `/api/admin/**` and `/api/internal/**`.
7. Host / account checks and key escrow remain pre-staging work.
8. No Next.js upgrade (16.3.8 stays).

### Report items (brief §17, in order)

#### 1. Starting SHA
`b47d8e533bc59543f9d2de839d10894ba63831cb` ("Admin A2: report and project memory (docs only)") — the expected HEAD, equal to
`origin/claude/new-session-5eijs6` at the start. `preserve/pre-admin-a2` was at `ed6b6521f8e5cae04f983acd298e0ef1e6b9aac0`
as required.

#### 2. Correction checkpoint SHA
`preserve/pre-admin-a2-correction1` → `b47d8e533bc59543f9d2de839d10894ba63831cb`. It did not exist before; it was created
and pushed without force, and has not moved since (`git ls-remote` at the end, item 33).

#### 3. Implementation SHAs (each correction on its own)
| Commit | What |
|---|---|
| `0a7a3c9` | Correction 1 (critical): a rotated or revoked session token never authenticates again |
| `7d55e4a` | Correction 2: recovery codes of 100 bits |
| `c844c27` | Correction 3: at most 5 password checks per email before any hash |
| `d09cb4b` | Correction 4: the pre-A9 admin gate (`ADMIN_ENABLED`, fail-closed) |
| `ba53a3e` | The focused security review's fixes (item 31) |
| `4eab6d3` | Credential-check slots are freed, never deleted (found by the fresh-clone QA) |
| `d9bec5a` | The second review pass's fixes (item 31) |
| `ddf7b71` | The third review pass's fixes: an invitation link carries its issuer's authority; slot rows in key order (item 31) |
| `6ac8c55` | The fourth review pass's fixes: nothing decided on an older state of an account; one snapshot per request (item 31) |
| `89edcc5` | The fifth review pass's fixes: every user-management change decided on the account as its page showed it; a sign-out also ends the session it rotated into; REPEATABLE READ set per connection; smaller items (item 31) |
| `b66468d` | The sixth review pass's fixes: the role boxes rebuilt with the page's fingerprint; the unlock decided on the lock and the attempts the page showed; the access fingerprint narrowed to what its decisions depend on (item 31) |
| `da3e5a3` | The seventh review pass's fixes: a fingerprint per kind of decision (a 2FA reset also on the password, an unlock also on the access); the roles form `autocomplete="off"` (item 31) |
| `98735f9` | The eighth review pass's fixes: the 2FA reset decided on the password and the failed second steps, not on wrong passwords; the emergency 2FA CLI locks the user first; the refusal names what changed (item 31) |
| `d21e222` | The ninth review pass's fixes: the 2FA reset also decided on the sessions the account has had (every sign-in that passed the password and every rotation); the emergency CLI reports each user and goes on after a failure (item 31) |
| (the commit that adds this section) | This report section and `CLAUDE.md` (docs only; the branch's last commit) |

Each commit was checked on its own where it matters: `7d55e4a` alone (a worktree): typecheck clean, unit 18 / 18,
integration 93 / 93; `c844c27`: unit 24 / 24, integration 104 / 104, admin browser 31 / 31; `d09cb4b`: unit 24 / 24,
gate and admin browser 40 / 40; the review rounds in the working checkout before each commit — `6ac8c55`: unit 26 / 26,
integration 133 / 133, admin 41 / 41; `89edcc5`: 26 / 147 / 42; `b66468d`: 26 / 149 / 43; `da3e5a3`: 26 / 152 / 44;
`98735f9`: 26 / 154 / 44; `d21e222`: 26 / 157 / 44 (each with lint, typecheck and build). The final code is items 20–30's fresh clone.

#### 4. Final branch HEAD
`d21e2226f4c4247a3d41a709dc08dc81d6a024e8` (`d21e222`) is the last commit with code; every QA result below is from a fresh clone of
it. The docs commit that adds this section follows it and is the branch's HEAD (`git log -1 origin/claude/new-session-5eijs6`).

#### 5. Files changed (`b47d8e5..d21e222`, then the docs commit)
47 files, + 3,764 / − 338 lines (9 new), all in the admin's own code (30 files, + 1,087 / − 299), its tests (14,
+ 2,565 / − 29) and its documentation (3):
- **The gate:** `src/lib/admin-gate.ts` (new), `src/proxy.ts`, `src/app/(admin)/admin/layout.tsx`,
  `src/server/admin/context.ts`, `src/server/admin/guards.ts`, `.env.example`, `README.md`.
- **Sessions and rotation:** `src/server/auth/sessions.ts`, `sign-in.ts`, `mfa.ts`, `passwords.ts`, `self-service.ts`,
  `user-admin.ts`, `session-state.ts` (new: one snapshot per request), `src/server/db/pool.ts` (every connection at
  REPEATABLE READ), `src/server/admin/actions/account.ts` and `auth.ts`, `(entry)/login/verify` and `login/enrol` pages.
- **Recovery codes:** `src/server/security/recovery-codes.ts` (new), `mfa.ts`, `sign-in.ts`,
  `src/components/admin/AuthForms.tsx`, `StepUp.tsx`, `admin.css`.
- **Credential admission:** `src/server/auth/rate-limit.ts`, `sign-in.ts`, `mfa.ts`, `passwords.ts`, `user-admin.ts`,
  `invitations.ts`, `bootstrap.ts`.
- **Review fixes:** `accounts.ts` (email normalisation), `tokens.ts`, `invitations.ts`, `bootstrap.ts` (setup links),
  `user-admin.ts` (the fingerprints), `self-service.ts`, `sessions.ts` (`revokeSessionLineage`), `sign-in.ts`, `mfa.ts`,
  `src/server/admin/actions/users.ts`, `(shell)/users/[id]/page.tsx`, `src/components/admin/UserForms.tsx` and
  `scripts/admin-2fa-reset.mjs`.
- **Tests:** `tests/unit/admin-gate.test.ts` and `email.test.ts` (new), `security.test.ts`;
  `tests/integration/privilege-boundary.test.ts`, `admission.test.ts`, `review-races.test.ts` (new), `mfa`, `rbac`,
  `secrets`, `sessions`, `sign-in`; `e2e-admin/gate.spec.ts` (new), `admin.spec.ts`, `helpers.ts`.
- **Docs commit:** `docs/reports/2026-10-09-admin-a2-auth-rbac-shell.md` (this section) and `CLAUDE.md`.

Unchanged: every public path (item 19), `package.json` and `package-lock.json`, the migrations and the schema
(`drizzle/`, `src/server/db/schema.ts` and the other database modules; only `pool.ts`'s connection setup changed),
`server.js` and the deployment scripts.

#### 6. The rotated-token defect
`findSessionByToken()` on `b47d8e5` looked a cookie's token up and, when the row was revoked with
`revoked_reason = 'rotated'` less than `ROTATION_GRACE_MS` (30 seconds) ago, followed `replaced_by_id` and returned the
**successor** session and its user. A2 rotates exactly where privilege rises: the second factor completed (a pending
password-only session becomes a verified one), a step-up (`reauthenticated_at` set on the successor), a password change,
2FA turned on, replaced or off, and the periodic rotation. So a token captured before such a step — the pending token of
a sign-in that had not passed 2FA, a session before its step-up — authenticated, for 30 seconds, as the session that had
passed it. The grace window was meant for requests in flight; it worked as an alias.

#### 7. The exact old-token fix (`0a7a3c9`)
- `src/server/auth/sessions.ts`: `ROTATION_GRACE_MS` is gone. `lookupSession(db, token, now)` answers `live` (the row is
  unrevoked, inside its idle and absolute limits, its user active and not deleted), `ended` (the row exists but is
  revoked — whatever `revoked_reason` says — or expired, or its user cannot sign in) or `none`. `findSessionByToken` returns
  a session only for `live`. `replaced_by_id` is still written (lineage, for the record) and is read by nothing that
  authenticates; since `89edcc5` it is followed in one place, `revokeSessionLineage`, and only to end a session (a
  sign-out also ends the session it rotated into).
- Unchanged and kept: a single successor (`rotateSession` claims the old row first, `UPDATE … WHERE revoked_at IS NULL`,
  then inserts; a lost claim is `SessionEndedError` and rolls the transaction back), no resurrection of a revoked
  session, the idle and absolute limits (a rotation extends neither).
- `src/server/admin/context.ts`: a cookie naming an ended session is "signed out, session ended"
  (`{ status: "anonymous", ended: true }`); pages and actions send it to `/admin/login?session_ended=1` ("Your session has
  ended"). A stale tab recovers only with the **new** cookie its own legitimate response delivered: the sign-in page sends
  a request that carries a live session to the dashboard. No server-side alias of any kind exists.

#### 8. MFA privilege boundary — negative and positive proof
- **Integration** (`tests/integration/privilege-boundary.test.ts`, "Test A", 2 tests): a sign-in returns the pending
  (password-only) token; completing the second factor with a TOTP code — and, in the second test, a recovery code — yields
  a new token. At that instant, and 1 ms, 1 s, 16 s and 30 s later (every moment of the old 30-second window, its last
  included), the pending token is refused (`findSessionByToken` → null, `lookupSession` → `ended`); the new token is live
  and verified; the old row is revoked `rotated` with `replaced_by_id` = the new id (lineage recorded, never followed).
- **Browser** (`e2e-admin/admin.spec.ts`, "Test A"): before the second factor a copy of the pending token reaches only the
  verification page. The browser completes the second factor; from then on the copy gets "session ended" on `/admin`,
  `/admin/users`, `/admin/account/sessions` and the verification page. A "Sign out all other sessions" request, captured
  from a second (witness) session, replayed with the copy **within 30 seconds** of the verification (inside the old
  window): nothing happens, the witness stays signed in. Replayed with the new token, it signs the witness out (positive
  control: the replay itself works).
- **Negative control:** the 9 integration tests (A–D) run against `b47d8e5` (with a two-line shim that maps the new
  `lookupSession` name onto the old `findSessionByToken`, changing nothing it authenticates): **9 of 9 fail**, each at
  "the old token is refused at the same instant". All 9 pass now.

#### 9. Step-up privilege boundary
- **Integration** ("Test B"): a session older than 10 minutes steps up (password + code); the old token is refused at
  once and through the old window; only the new token has the fresh `reauthenticated_at`.
- **Browser** ("Test B"): the "Send invitation" request (a sensitive action) is captured; replayed with the pre-step-up
  token it creates nobody (session ended); replayed with the new token it creates the user (positive control).
- Fails on `b47d8e5` (item 8's control), passes now.

#### 10. The other security rotations
- **Integration** ("Test C", 5 tests): a password change, 2FA turned on (the old password-only token), the authenticator
  replaced, 2FA turned off (an optional role), and the periodic rotation — in each, the old token is refused at the same
  instant and for the whole old window; the new one works.
- **"Test D"** (concurrent periodic rotation): 5 rounds of 4 simultaneous `rotateIfDue` calls on one session: exactly one
  successor each round, 2 rows (old + new), the old token refused, and `rotateSession` on the old row afterwards throws
  `SessionEndedError` (nothing resurrected).
- **Browser:** "D1" replays the captured rotation request 3 times at once: 1 new token, 1 new row, the old cookie then
  reaches "Your session has ended"; "D2": a tab's own rotation gives the browser the new cookie, a request with the old
  token ends at `session_ended`, and a second tab at `/admin/login?session_ended=1` goes straight to the dashboard (it
  holds the new cookie) — the only way a stale tab recovers. The 2FA-replacement browser test also checks that the token
  from before the replacement ends.
- All fail on `b47d8e5` (item 8's control: 9 of 9), pass now.

#### 11. Recovery codes — old and new
| | Before (`b47d8e5`) | After (`7d55e4a`) |
|---|---|---|
| Alphabet | Crockford Base32, 32 symbols (`0-9 a-h j k m n p-t v-z`) | the same |
| Length | 10 characters | **20 characters** |
| Entropy per code | log₂(32) × 10 = **50 bits** | log₂(32) × 20 = **100 bits** |
| Format shown | `xxxxx-xxxxx` | `xxxxx-xxxxx-xxxxx-xxxxx` |
| Count, use | 10, single use, shown once | unchanged |
| Typed | case, spaces, dashes ignored; i/l → 1, o → 0 | unchanged |

- One module, `src/server/security/recovery-codes.ts`: the generator (`crypto.randomInt` per character, uniform), the
  normalisation, the hash, and the alphabet and length the generator uses. `mfa.ts` and `sign-in.ts` import it. The old
  generator hashed `code.replace("-", "")` (only the first dash); every path now hashes the normalised code.
- The sign-in and the step-up take the longer code (the step-up form gained "Use a recovery code instead"); the list of
  new codes fits a 320 px phone, one code per line.
- **Entropy test** (`tests/unit/security.test.ts`): 4,000 codes from the generator itself: every code matches the
  four-group format, normalises to 20 characters, all 32 symbols occur, log₂(32) × 20 = 100 ≥ 100 bits measured from what
  was generated, no repeats, each symbol 2,000–3,000 times of 80,000 (uniform); the declared constants agree.
- Fails on `b47d8e5` (its generator gives `s4k8d-5htek`: 10 characters), passes now.

#### 12. Recovery-code storage proof
- `user_recovery_codes.code_hash` = SHA-256(`rawasy-recovery:` + the normalised code), 32 bytes; no other column holds
  anything derived from the code.
- Integration (`mfa.test.ts`): the 10 stored hashes equal the hashes of the 10 codes shown; no stored value (hex, base64,
  latin1, id) contains any code; the code typed in capitals with spaces signs in once and is then refused in any form; a
  code of the old 10-character shape is not a code.
- Secrets test (`secrets.test.ts`): every code as shown, without dashes and in capitals, plus every token, password and
  TOTP value of a full flow, is searched in every value of every table and in everything written to the console: none
  found.
- Browser: a recovery code works once at the sign-in (typed in capitals with spaces) and once at the step-up; the same
  code a second time "didn't match".

#### 13. Pre-hash credential admission — design (`c844c27`, `4eab6d3`)
- `src/server/auth/rate-limit.ts`, `reserveCredentialCheck(db, normalisedEmail, now)`: 5 rows per email in the existing
  `rate_limits` table (no schema change), keyed by SHA-256 of `login:credential:<hex SHA-256 of the normalised email>#<slot>`
  — the plain email is never stored. A row holds the moment its slot frees again (`expires_at`). Taking a slot is one
  conditional `UPDATE … SET expires_at = now + 15 min WHERE key = ? AND expires_at <= now`; `INSERT IGNORE` creates the
  free rows the first time. Two requests can never take the same slot, in any number of processes: at most 5 checks for an
  email start in any 15 minutes (a sliding window).
- Order in `signIn`: the per-address limit (30 / 15 min, unchanged) → **the slot** → only then the account lookup → the
  Argon2 verification, or the dummy hash for an unknown, disabled, invited or locked account. With all 5 taken nothing is
  hashed: the answer is the same "failed", the attempt is recorded (`rate_limited`) and audited (`auth.login_throttled`).
- The same slots guard every other password check: the step-up, the password change and the 2FA set-up ("temporarily
  locked", nothing hashed).
- Freed (never deleted — `4eab6d3`, item 31) by a successful password check, a completed password reset, an Owner or
  Admin unlock, the bootstrap recovery reset and an accepted invitation.
- The 5 rows are inserted in key order, the order in which freeing them locks them (`ddf7b71`: in slot order the two
  deadlocked, 21 and 26 times in two probes of 600 rounds; 0 and 0 since).
- The user-row lock is unchanged: second-factor codes are still checked under `SELECT … FOR UPDATE`.

#### 14. Concurrent wrong-password proof (`tests/integration/admission.test.ts`, 13 tests)
- 12 wrong passwords at once against **a known account**: exactly **5** Argon2 verifications; the account locked for
  15 minutes after the 5th; 5 attempts recorded `bad_credentials`, 7 `rate_limited` (refused before any hash); at most 4
  pool connections in use at once (the test pool's limit; no pool explosion).
- The same against **an unknown email** and **a disabled account**: 5 dummy verifications each, the same answers.
- 12 wrong step-ups at once from one session: at most 5 hashes, the account locked.
- Freeing: by a success (then 5 more checks), by a completed reset (the new password signs in at once), by an Admin unlock;
  the sliding window (slots taken at 0, 2, 4, 6, 8 minutes free again at 15, 17 …); slots freed while another request is
  between its insert and its claim are still there to claim (`4eab6d3`); 300 rounds of 6 reservations and 6 freeings at
  the same moment end without a single database error (`ddf7b71`).
- **On `b47d8e5`** (a shim that answers "always free"): 12 of 12 hashed for the known, the unknown and the disabled email;
  12 hashed at the step-up; 8 of the 11 then-existing tests fail; the 3 that pass on both guard identical answers, slots
  per email and the unlock. The slot-freeing test fails on `d09cb4b` (the delete version) and passes now.

#### 15. Known / unknown enumeration proof
- The slot is taken before the account is looked up, for every email alike; a refusal there does the same thing for all.
- 21 attempts (7 each against a known, an unknown and a disabled email; 5 checked and 2 refused per email) give 21
  identical answers `{ kind: "failed" }`; the browser shows one message for all of them ("Sign-in failed. Check the email
  address and password. After several failed attempts, sign-in is paused for a while.").
- Unknown and disabled accounts still verify a dummy hash, so a checked attempt costs the same Argon2 time
  (`sign-in.test.ts`, "an unknown email takes about as long as a wrong password").
- The only other answer is the per-address throttle ("Too many sign-in attempts from your network"), which depends on the
  address, not the account.

#### 16. `ADMIN_ENABLED` — design (`d09cb4b`)
- `src/lib/admin-gate.ts`, `isAdminEnabled(env = process.env)`, read on every call, framework-free:
  - `ADMIN_ENABLED` set (after trimming) → on **only** if it is exactly `1` (`0`, `true`, `yes`, `on`, `01`, `1.0` … are off,
    locally too);
  - unset or empty → on only in local development: `APP_ENV=local`, or no `APP_ENV` outside a production build (`next dev`);
    `production`, `staging` and any unknown `APP_ENV` → off; a production build without `APP_ENV` → off;
  - never inferred from `DB_*` or any other setting.
- **Proxy:** the admin branch (nonce CSP, admin headers) only when on. Off, `/admin/**` falls through to the public locale
  logic: `307 → /en/admin…`, then the localized 404 — as on `preserve/pre-admin-a2`.
- **Server side** (the proxy is not the boundary): `assertAdminEnabled()` → `notFound()` at the start of the admin root
  layout (after `await connection()`, so at request time, never at build), `getAdminState()`, `authDeps()`,
  `actionContext()` and `publicActionContext()`. Every admin page and Server Action passes through one of these before it
  reads a cookie or opens a database connection. Needed because Next forwards a Server Action posted to **any** page to the
  worker that has it.
- No database is needed to decide; `npm run build` needs no database and no gate setting.
- `.env.example` documents the variable (commented, no value); the README's admin section explains it and its Namecheap
  section says to set none. No production value was created.

#### 17. Production with the admin disabled — proof
- `e2e-admin/gate.spec.ts` starts `node server.js` of the build with each setting and a stand-in database (a listener that
  counts connection attempts and answers none). **Off** — production unset, production `0`, a production build without
  `APP_ENV`, staging unset, staging `0`, production `true`:
  - `/admin`, `/admin/login`, `/admin/users`, `/admin/anything/at/all` → `307` to `/en/…`, no CSP, no `X-Robots-Tag`, the
    same header names as the public `/about` redirect; Arabic by header and by cookie → `/ar/admin`;
  - `/en/admin` → 404 with the same title as `/en/not-a-page`, no CSP; a session cookie changes nothing;
  - a forged sign-in Server Action, posted to `/admin/login` (→ the locale redirect) and to the public `/en`: **0 database
    connection attempts**. The same request reaches the database in the "on" tests (positive control: without it the
    "0" could mean a malformed request — the first version of this test had exactly that flaw, caught by the "on" case).
- **Negative control:** on `b47d8e5`, all 6 "off" tests fail (`/admin` → `/admin/login`: the admin answers); the 3 "on"
  tests pass on both.
- **Without the proxy** (a scratch build of `d09cb4b` whose proxy matcher excludes `/admin`, so only the server-side gate
  stands): gate off → `/admin/login`, `/admin`, `/admin/users`, `/admin/reset`, `/admin/account/security` all **404**
  (Next's error shell; no form, no password field), the forged action at `/admin/login` 404 and at `/en` nothing, **0
  database connections**; gate on → the sign-in page 200, and the forged action reaches the database (2 attempts).
- The HTTP freeze proof (item 19): with the gate off, the whole `/admin` family answers byte-for-byte as on
  `preserve/pre-admin-a2`.

#### 18. Local development with the admin enabled — proof
- The admin browser suite runs `server.js` with `APP_ENV=local` and no `ADMIN_ENABLED` (on by default): every admin test
  passes (item 23).
- `gate.spec.ts` "on" (production `1`, staging `1`, local unset): `/admin/login` 200 with `script-src 'self'
  'nonce-<22 base64 chars>==' 'strict-dynamic'`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`; `/admin`
  → `/admin/login`; deciding needed no database (0 connections before the first action); the forged sign-in reaches the
  database at the admin and through a public page.

#### 19. Public freeze proof (against `preserve/pre-admin-a2`, `ed6b652`)
- **Sources.** `git diff ed6b652..d21e222` is empty for every public path: `src/app/(commerce)/**`,
  `src/components/commerce/**`, `src/content/**`, `public/**`, `src/i18n/**`, `src/lib/page-meta.ts`,
  `src/app/global-not-found.tsx`, `server.js`, `scripts/package-namecheap.mjs`, `scripts/warm-images.mjs`, `e2e/**` and
  `playwright.config.ts`. The public E2E tests are byte-identical to the baseline's; the 13 held-back-media rules
  (`withheldMedia`, `projectDetailMedia`, `HELD_BACK_MEDIA`) are untouched.
- **Build output** (a clean build of `d21e222`, copied right after `next build`, against the baseline's clean
  build): 890 public files per build: 114 byte-identical, 193 differing only by the build id or `/_next/static` chunk
  names, 408 only by the router-tree entry that lists the `[locale]` segment's static siblings (`[]` → `["admin"]`, as in
  A2), **0 other differences** (175 server bundles and manifests compared by module instead). Stylesheets: on all 104
  prerendered public pages the same stylesheets in the same order, byte-identical. Scripts by module: the same module set
  and code on every page; the only module-level differences are A2's own two (the Turbopack runtime naming the two
  renamed shared chunks, and Next's error-page styles module, whose renamed local collides with an object key). Every one
  of these figures equals A2's final proof (`20bef7a`): this correction changed no client byte of the public site.
- **HTTP** (both builds served by `server.js` in production mode; the final one with the gate off: no `ADMIN_ENABLED`,
  no `APP_ENV`, no database settings): three gate-off settings, each against a freshly started baseline with its route cache emptied —
  production with nothing set (the deployment default), production with `ADMIN_ENABLED=0`, and staging with nothing
  set — and in all three:
  - **102 / 102 sitemap pages:** the same status, headers (date, etag and cache-state headers aside), normalised HTML,
    SEO facts (lang / dir, title, description, robots, canonical, 306 hreflang links, Open Graph, 208 JSON-LD blocks, 618
    media references, 292,957 characters of visible text) and page data (`RSC: 1`);
  - `robots.txt`, `sitemap.xml`, the manifest and both icons byte-identical; `/favicon.ico` (no such file) answers 404 on
    both with the same headers and a body that differs only by the build id and chunk names (identical once normalised);
  - **28 / 28 redirect and locale cases identical**, among them `/admin`, `/admin/`, `/admin/login`,
    `/admin/login?next=…`, `/admin/users`, `/admin/reset`, `/admin/invite/abc`, `/admin/anything/at/all` (each `307` →
    `/en/…`), `/admin` with an Arabic header (→ `/ar/admin`), with the language cookie and with a forged session cookie,
    `/ADMIN`, `/Admin`, `/%61dmin`, `//admin`, `/administrator`, `/admin-panel` and `/adminx/login`;
  - **18 / 18 not-found cases identical** (status, title, robots, headers), among them `/en/admin`, `/ar/admin`,
    `/en/admin/login`, `/ar/admin/login`, `/en/admin/users`, `/en/administrator`, `/en/admin-panel`, `/en/ADMIN` (the
    localized 404) and the unknown `/api/anything`, `/api/no-such`, `/api/administrator` (Next's own 404, unchanged);
  - a form POST to `/admin/login` or `/admin` answers the same locale redirect; no public page links to the admin;
  - the only intended difference: `/api/admin/…` and `/api/internal/…` (404 on both) carry the A2 API headers.
- **Pixels:** the same 11 representative pages as A2's proof (`/en`, `/ar`, `/en/about`, `/ar/services/laser-cutting`,
  `/en/services/laser-engraving`, `/en/projects`, `/ar/capabilities`, `/en/contact`, `/ar/certificates`,
  `/en/projects/clock-tower-landmark`, `/ar/not-a-page`), screen by screen (up to 6) in EN/AR × light/dark × desktop
  1440 × 900 / phone 390 × 844, reduced motion, every image decoded, the map stubbed: **237 screens, 228 pixel-identical**
  at the first pass, with equal page heights in every state. The other 9 (1 to 888 pixels: the Arabic Laser Cutting
  drawing on desktop and phone, `/en/projects`, one pixel of `/ar/certificates`, the Arabic 404) were captured 3 more
  times per build: each is pixel-identical between the builds in at least one of the three pairs, and the baseline
  differs from itself by the same amounts (31, 28 and 8 pixels; once 1,197,225, when its browser-built 404 was caught
  mid-render) — run-to-run noise, not a change.
- **Held-back media:** the 13 files answer the same on both builds, and no page refers to them (every page's media list is
  identical, item above).

#### 20. Public E2E
On the fresh clone of `d21e222` (the final code), served by `server.js` on port 3400 after the image warm-up (1,484 /
1,484 sizes, none failed), two full runs of the whole suite (3 workers):
- **First run: 611 / 612** (31.2 min). The one failure: `commerce-transitions.spec.ts:151` (Arabic, "a gallery choice
  moves the cards that stay…"): `page.evaluate: TimeoutError: Transition was aborted because of timeout in DOM update`.
  Chromium gave up on the gallery's view transition because its update step did not finish in time while two other
  workers were rendering heavy pages; none of the test's assertions was reached. Not this correction's: the public code
  is byte-identical to the baseline's (item 19), and the same test, run 10 times per language 3 at a time, passed 20 / 20
  on the final build and 20 / 20 on the baseline build (`preserve/pre-admin-a2`).
- **Second run (the whole suite again, not the failing test alone): 612 / 612 (31.5 min)**.

#### 21. A2 unit result
**26 / 26** (fresh clone; A2 had 15): + 6 `admin-gate.test.ts` (the gate's settings A–E and every other value), + 2
`email.test.ts` (normalisation idempotent over every code point and 3.9 million letter + mark strings; one key per
spelling), + 3 in `security.test.ts` (recovery-code entropy, format and normalisation).

#### 22. MariaDB integration result
**157 / 157** (fresh clone, local MariaDB 11.4.13, a fresh `rawasy_t_*` database per file; A2 had 83): + 9
`privilege-boundary.test.ts` (Tests A–D), + 13 `admission.test.ts`, + 51 `review-races.test.ts` (review passes 1 to 9),
+ 1 in `mfa.test.ts` (recovery-code storage).

#### 23. Admin browser result
**44 / 44** (17.3 min; fresh clone; `server.js` on port 3401 with `APP_ENV=local`, a fresh `rawasy_e2e_*`
database and the mail sink; A2 had 24): `admin.spec.ts` 35 (A2's 24 + Tests A, B, D1 and D2, the recovery code at the
step-up, the new codes list at 320 and 390 px, and the review passes' four: roles chosen while the account showed
Invited, a listed session that rotated meanwhile, the role boxes after another action refreshed the page, and Back to a
user page) and `gate.spec.ts` 9 (6 settings off, 3 on).

#### 24. Combined
A2 alone: unit 26 + integration 157 + admin browser 44 = **227 / 227** (A2 had 15 + 83 + 24 = 122). With the public
suite: **838 / 839** with the first public run (its one failure above) and **839 / 839** with the second.

#### 25. `npm audit --omit=dev`
**0 vulnerabilities** (fresh clone).

#### 26. Full `npm audit`
**9 (4 moderate, 5 high), all development-only, the report byte-identical to A2's final run** — no dependency changed in
this correction (`package.json` and `package-lock.json` untouched since `b47d8e5`):
- 5 high: `braces` ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ← `eslint-config-next` (lint only; the
  offered fix is a forced downgrade to `eslint-config-next@14.2.35`);
- 4 moderate: `esbuild ≤ 0.24.2` ← `@esbuild-kit/core-utils` ← `@esbuild-kit/esm-loader` ← `drizzle-kit` (the migration
  generator, development only; the offered fix is a forced downgrade to `drizzle-kit@0.18.1`). Accepted as dev-only by
  Owner decision 4; no forced downgrade.

#### 27. Lint
`npm run lint`: exit 0, no warning (fresh clone).

#### 28. Typecheck
`npm run typecheck`: exit 0 (fresh clone).

#### 29. Build
`npm run build` with no `DB_*`, `APP_ENV` or `ADMIN_ENABLED`: exit 0, no warning (fresh clone). Nothing touches a database
during the build (`assertNotBuildPhase`).

#### 30. `db:check`
Exit 0: "Everything's fine" (drizzle-kit), "Migration files OK: 2 (0000_access_control, 0001_seed_access_control)",
"Seed migration matches the registry." The schema did not change in this correction (the limiter uses `rate_limits` as
it was).

#### 31. Focused security review findings (brief §13)
Ten read-only review passes, each by an independent agent that read the code (the first two also probed the local
MariaDB; from the fourth on, each reviewed the fixes of the one before). Each confirmed finding was fixed with a test that
fails on the code before the fix, or is recorded in item 32.

| Pass (code reviewed) | Finding | Severity | Outcome |
|---|---|---|---|
| 1 (`0a7a3c9` + tree) | A sign-in whose password was checked before a reset, a password change, a disable or a lock created its session afterwards (and a re-enable revived it) — **an old credential outliving the change** | High | Fixed `ba53a3e`: the session is created under the user-row lock, only while hash, status and lock are as checked; a re-enable revokes leftovers |
| 1 | A change asked for by a session revoked mid-request still completed | Low | Fixed `ba53a3e` (`lockActingSession` in every such transaction; `lockForChange`) |
| 1 | Email normalisation not idempotent (two slot keys; an account invited with "J + combining caron" could never sign in) | Low | Fixed `ba53a3e` (NFKC → lower → NFKC → trim) |
| 1 | Failures at the public sign-in form also block the signed-in step-up (the same slots and lock) | Low (availability) | Not changed: options for the Owner (item 32) |
| 1 | Invitations stay valid after their inviter is disabled or demoted | Info | Fixed `ba53a3e` (withdrawn) |
| 1 | Reset-request timing reveals a known account once mail exists; clock skew shortens the slot window; `getAdminState` runs before the origin check (same-site only, SameSite=Strict) | Info | Reported (item 32) |
| QA (fresh clone) | Freeing the slots by deleting their rows raced a reservation between its insert and its claim (4 checks instead of 5) | Low | Fixed `4eab6d3` (rows freed, never deleted) |
| 2 (`ba53a3e`) | Two correct sign-ins while the stored hash is upgraded: one refused | Low | Fixed `d9bec5a` (re-verify against the stored hash) |
| 2 | A race-refused sign-in counted towards the lockout | Low | Fixed `d9bec5a` (audited only) |
| 2 | Unlock and "sign out everywhere" did not re-decide the rank rule under the lock | Low | Fixed `d9bec5a` |
| 2 | Lock-order inversions: invite / resend / rotation against revocations (deadlocks absorbed by the single retry) | Low (robustness) | Fixed `d9bec5a` (`lockActor`, `rotateIfDue` locks the user): 24 / 13 / 15 → 0 / 0 / 0 deadlocks per 60 probe rounds |
| 2 | A change overlapping its own session's periodic rotation ends "session ended" | Info | By design (no grace window); item 32 |
| 2 | Re-enable revoked leftover sessions but not leftover reset links | Info | Fixed `d9bec5a` |
| 2 | `lockActingSession` did not check the acting user's status | Info | Fixed `d9bec5a` (defence in depth) |
| 2 | Removing any role withdraws all invitations the user sent | Info | Documented; item 32 |
| 3 (`d9bec5a`) | **An invitation link outlived a role raise of the invited account**: an Admin's link for an Editor still activated the account after an Owner made it an Owner (the Admin holds the link when no mail is configured) — **the old-credential → newer-privilege case** | High | Fixed `ddf7b71`: a role change withdraws the invited account's link; acceptance and the invitation page check the issuer's authority against the account as it is (again inside the accept transaction, under lock); a new link is decided under the account's row lock |
| 3 | A re-enable brought back an invitation link issued around the disable | Low | Fixed `ddf7b71` |
| 3 | Pre-existing deadlock cycles: token-first (`completePasswordReset`, `acceptInvitation`) against user-first transactions; the emergency 2FA CLI's lock order; the slot `INSERT IGNORE` against the slot freeing | Info | The slot cycle confirmed by a probe (21 and 26 deadlocks in 600 rounds) and fixed `ddf7b71` (rows inserted in key order: 0 and 0); the other two resolve correctly on the single retry — item 32 |
| 3 | The Owner's in-app 2FA reset leaves the password valid (the next password-only sign-in enrols a new authenticator) | Info (design) | Not changed (accepted A2 behaviour): an option for the Owner, item 32 |
| 4 (`ddf7b71`) | **A promotion decided while the account showed "Invited" could land on an account its inviting Admin had just activated with the older Editor link**: the Owner ticks Owner on the invited account, the Admin accepts the link first and sets the password, the Owner's save then makes the Admin-controlled account an Owner (Owner-assisted; Admin → Owner) — **the old-credential → newer-privilege kind** | Medium | Fixed `6ac8c55`: the roles form sends the status the page showed; `setUserRoles` refuses (`changed`, "reload and check") when the account is no longer in that state, decided before and again under the account's row lock |
| 4 | A role change left the account's password-reset link alive: a link minted (by the recovery CLI) for an Editor could set the password of the Admin it became — **the same kind** | Low | Fixed `6ac8c55`: a role change also retires the account's `password_reset` and `email_change` links |
| 4 | `getAdminState` read the session, the roles and the 2FA state in separate statements: a promotion committed in between could render one read-only page with the new roles for the session it revoked, and a 2FA removal could render a password-only session as signed in (every change still refused under lock) | Low | Fixed `6ac8c55`: `readSessionState` reads all four in one transaction (one snapshot); the session's activity is recorded after it |
| 4 | Owner setup links: the link of an earlier bootstrap run (a mistyped email) stayed valid and could create a second Owner after the first was active | Low | Fixed `6ac8c55`: each bootstrap retires every other unused setup link; a setup link is refused while any Owner is active (decided again under lock in the accept transaction, the link withdrawn and audited) |
| 4 | `resetUserMfa` ignored a target that vanished before its lock | Info | Fixed `6ac8c55` (`not_found`, nothing changed) |
| 5 (`6ac8c55`) | **The roles form applied the whole set of roles its page showed, so a role another Owner had just taken away came back** (an older page re-granted Admin after a demotion); enable, unlock, a 2FA reset and a new invitation link carried no state either (an older page's "Enable" undid a newer disable) — **the decision-on-an-older-state kind** | Low | Fixed `89edcc5`: every user-management form sends the account's fingerprint as its page showed it (`accountVersion`: status, last change, disable, lock, roles, second factor, read in one snapshot); roles, enable, unlock, a 2FA reset and a new invitation link are refused (`changed`) under the account's row lock when it differs; disabling and signing out never are |
| 5 | Signing a session out by its id did not follow its rotation: a device whose session rotated after the list was shown stayed signed in ("That session has already ended."), and a lockout or "Sign out" racing a rotation left the successor live — the mirror image (a newer token escaping a revocation) | Low | Fixed `89edcc5`: `revokeSessionLineage` also ends the session it rotated into, under the user's row lock (sign-out now takes it); `replaced_by_id` is followed only to end sessions, never to authenticate |
| 5 | The one-snapshot read relied on the server's default isolation level (READ COMMITTED would split it again) | Info | Fixed `89edcc5`: every connection is set to REPEATABLE READ; proven with the local server's default switched to READ COMMITTED: round 4's two snapshot tests fail on `6ac8c55` and pass now |
| 5 | Removing a second factor left pending reset links valid (a link not enough to sign in while 2FA was on became enough) — **the same kind** | Info | Fixed `89edcc5`: `removeMfa` and `disableMfa` withdraw reset and email-change links (the CLIs issue their own link afterwards) |
| 5 | A session already past its absolute limit by the revoker's clock was not revoked, so a request whose clock was behind could read it live with the new roles for one page — **the same kind** (negligible) | Info | Fixed `89edcc5`: every unrevoked row is ended (only live ones counted); `readSessionState` reads the time once it holds its connection |
| 5 | The admin's origin check accepts any page of the shared origin, and the public pages carry no CSP | Info | Not changed: nothing but RAWASY's own code runs on the public site today; carried to A3 (item 32) |
| 5 | A recovery code used for a step-up was neither audited nor notified | Info | Fixed `89edcc5` (as at sign-in) |
| 6 (`89edcc5`) | **After any other action refreshed the user page, the roles form sent the boxes ticked for the older state together with the page's new fingerprint**: the boxes are uncontrolled and keep what they showed across the page refresh, while the hidden fingerprint takes the new one — so once, say, "Disable" on the same page had refreshed it, a page that still showed Admin ticked gave back the Admin role another Owner had just taken away, and the server's check passed — **the decision-on-an-older-state kind**, in the browser | Medium | Fixed `b66468d`: the boxes are rebuilt together with the fingerprint (`<Fragment key={version}>` in `UserRolesForm`): a new fingerprint remounts them from the account as it is now |
| 6 | An unlock decided on the page cleared failed attempts counted after it was shown (the fingerprint held the lock, not the count), resetting the escalation those attempts had earned | Info | Fixed `b66468d`: the unlock form sends its own fingerprint (`unlockVersion`: the lock and the attempts counted since the last success) and is refused (`changed`) when either moved |
| 6 | The access fingerprint held the last-change time and the lock, so the user's own password change or a failed sign-in refused an Owner's role change made on a page opened before it — a stall, not a hole | Info | Fixed `b66468d`: the access fingerprint (`accountVersion`) holds only what roles, enable, a 2FA reset and a new invitation link are decided on: status, the disable time, roles and the second factor |
| 6 | Portability of the per-connection isolation: `transaction_isolation` exists from MariaDB 11.1 (`tx_isolation` before), and from 11.6.2 `innodb_snapshot_isolation` is on by default (a write to a row changed after the snapshot fails with error 1020, which the admin shows as "unavailable") | Info | Not changed (the local server and Namecheap's listed version are 11.4): added to the pre-staging checks (item 32) |
| 7 (`b66468d`) | **A two-factor reset decided on the page no longer saw a password replaced, a lock set or second-factor codes failed after the page was shown** (the sixth review's narrower fingerprint had dropped the last change and the lock): someone holding a reset link for the account (its mailbox, once mail exists) or its password could have the Owner remove the second factor that still stood between them and the account — **the old-credential → newer-access kind**, Owner-assisted | Low | Fixed `da3e5a3`: the reset form sends its own fingerprint (`mfa_reset`: the access, the sign-in lock and failed attempts, and the password's last change) and is refused when any of them moved |
| 7 | The unlock compared only the lock and the attempts: an older page could unlock an account whose second factor had been reset, or that had been disabled or promoted, after it was shown | Info | Fixed `da3e5a3`: the unlock's fingerprint (`unlock`) holds the access as well |
| 7 | **Going Back to a user page that the browser loads again, or restoring a session, put the older page's role ticks back beside the newer fingerprint** (Chromium restores form state into the form as the server wrote it, and React keeps it while hydrating): a save then gave back a role taken away meanwhile — **the decision-on-an-older-state kind**, in the browser | Low | Fixed `da3e5a3`: the roles form carries `autocomplete="off"`, so the browser neither saves nor restores its boxes |
| 8 (`da3e5a3`) | The two-factor reset's fingerprint counted every wrong password, so anyone who knows the email could keep an Owner's reset refused ("changed") with a wrong password every few minutes, without ever locking the account; the refusal did not say why | Low (availability) | Fixed `98735f9`: the reset is decided on the password's last change and the newest failed second step (a wrong code needs the right password first), no longer on the lock or the count; the refusal names password changes and sign-in attempts |
| 8 | Adding a role to an account without two-factor does not notice a password replaced after the page was shown (the access fingerprint leaves the password out, so the user's own password change never stalls an Owner) | Low (design) | Not changed: the round-6 choice, recorded with the option (item 32) |
| 8 | The emergency 2FA-reset CLI removed the factor without taking the user's row first, so a change decided under that lock could read the factor while it was being removed, and the two could wait on each other's rows (one retry) | Low | Fixed `98735f9`: the CLI locks the user's row first, as every other change to a second factor does |
| 9 (`98735f9`) | The two-factor reset's fingerprint did not see a sign-in that passed the password after the page was shown, whether it stopped at the code prompt (a pending session, listed on the page) or completed | Low | Fixed `d21e222`: the reset is also decided on the sessions the account has ever had (each sign-in and each rotation adds one, under its row lock); only someone holding the password or a session can move it |
| 9 | Lock order against token-first writers (`completePasswordReset`, `acceptInvitation`, a reset request with mail): with the emergency CLI now locking the user first, it joins the documented cycle, and in `--all` mode a second deadlock on one user threw away the links already issued to the others | Low | The CLI fixed `d21e222`: each user is reported (a failure with its error code, nothing changed for that account) and the others go on; the cycle itself stays documented (item 32) |
| 9 | Test gaps: the CLI lock test did not show the CLI waiting and left transactions open on failure; a wrong recovery code, a wrong step-up code and a lock from wrong passwords were untested for the reset | Low | Fixed `d21e222`: the test shows the CLI still waiting and rolls back before releasing; the three cases are tested |
| 9 | Two writers outside the "user row first" rule: re-encrypting TOTP secrets (changes nothing a decision reads) and the bootstrap recovery reset (decides from a read before its transaction; harmless) | Info | Comments corrected `d21e222`; recorded |
| 9 | The newest failed second step is found by walking the user's `login_attempts` rows, which anyone can add to (about 480 a day per email); nothing prunes them in A2 | Info | `d21e222` reads it only for the reset and the user page while the account has a second factor; an index on `(user_id, failure_reason)` and pruning belong to A8 (item 32) |
| 10 (`d21e222`) | The emergency CLI reports a user whose transaction failed as "NOT reset … nothing was changed"; if the connection dropped after the server had committed, the reset was in fact applied and its link lost | Low | Not changed: recorded (item 32); running the command again for that user is right in both cases (it issues a fresh link) |
| 10 | The 2FA reset's session count would be lowered by the daily purge of expired sessions planned in A1 (no purge exists in A2): a purge and a new sign-in could cancel out | Low (latent) | Not changed: recorded for A8 (item 32) — count and newest id, or a per-user counter, when the purge is built |
| 10 | Test gaps: the complete-sign-in half of the new test does not isolate a counted rotation; the CLI failure is injected before any write (the rollback of a partly done reset and the script's exit code are not exercised) | Info | Recorded (item 32) |
| 10 | One `now` for the whole emergency run: after lock-wait timeouts, later users' 30-minute links start with less time | Info | Recorded (item 32) |
| 10 | Comment wording: "every sign-in that passed the password adds a session" overstates (a sign-in refused under the lock checks the password and adds none) | Info | Recorded (item 32) |

**The brief's question — an old credential that follows, aliases or inherits a newer privilege:** passes 1 and 3 each
found one such case (a password checked before it was replaced; an invitation link outliving a role raise); both are
fixed and tested. Passes 4 and 7 found three more of that kind, all fixed and tested: a promotion decided on an invited
account landing on one its inviting Admin had just activated with the older link, and a reset link minted for an Editor
still working after the promotion (pass 4); a two-factor reset that removed the only thing between a password replaced
after the page was shown and the account (pass 7). Passes 5 to 7 closed the neighbouring kind, a decision taken on an
older state of an account, on the server (a fingerprint per kind of decision) and in the browser (role boxes rebuilt
with it, never restored by the browser). Passes 8 to 10 found no old-credential path in the seventh to ninth rounds'
code, and pass 10 no High or Medium defect of any kind: the loop ends there, its remaining Low and Info items in item 32.
Paths checked across the passes: the pending, verified, rotated, revoked and expired session tokens (`replaced_by_id` is
written and never read for authentication; since `89edcc5` it is followed only to end a session); the step-up timestamp
(set only by a password-plus-code step, a full sign-in, a password change without 2FA or an enrolment, and carried only
within one session's own rotation); the sealed enrolment blob (bound to user, session, expiry and the replace flag); invitation,
reset, email-change and Owner-setup tokens (single use, retired by password change, reset, disable, re-enable, role
change and a second factor's removal; an invitation checked against its issuer's authority now; only the newest Owner
setup link, none once an Owner is active); the user page's forms (each decided on the account as its page showed it, in
what that decision depends on); recovery codes (single use under the user-row lock,
deleted on regenerate, disable, replace and reset); TOTP (±1 step, `last_used_step` strictly increasing); roles cached in
an actor (every role change revokes the target's sessions; every change proves its session live under lock); replayed
Server Actions (the old cookie reads "ended"); the `next` parameter (admin pages only); the cookie (`__Host-`, Secure,
HttpOnly, SameSite=Strict, the token only).

**Negative controls — which new security tests fail on the code before their fix and pass now:**

| Tests | On the code before | Now |
|---|---|---|
| `privilege-boundary.test.ts` (Tests A–D, 9) | `b47d8e5`: **9 of 9 fail** ("the old token is refused at the same instant") | 9 / 9 |
| `security.test.ts` recovery codes (3) / recovery-code integration (`mfa.test.ts`, `secrets.test.ts`) | `b47d8e5`: 2 of 3 fail / 2 of 21 fail | pass |
| `admission.test.ts` (the 11 first tests) | `b47d8e5` with an "always free" shim: **8 of 11 fail** (12 of 12 wrong passwords hashed; the 3 that pass guard identical answers, per-email slots and the unlock) | pass |
| `admission.test.ts` — slots freed mid-reservation | `d09cb4b` (the delete version): fails | passes |
| `admission.test.ts` — reservations and freeing at the same moment (300 rounds) | `d9bec5a`: fails (`ER_LOCK_DEADLOCK`) | passes |
| `gate.spec.ts` — the 6 "off" settings | `b47d8e5`: **6 of 6 fail** (`/admin` answers); the 3 "on" tests pass on both (positive controls) | 9 / 9 |
| `review-races.test.ts` — passes 1 (14 tests) | `b47d8e5` and `d09cb4b`: **13 of 14 fail** (the 14th is a positive control) | pass |
| `email.test.ts` (2) | `b47d8e5`: 2 of 2 fail | 2 / 2 |
| `review-races.test.ts` — pass 2 (4 new tests) | `4eab6d3`: 4 of 4 fail | pass |
| `review-races.test.ts` — pass 3 (4 new tests) | `d9bec5a`: **4 of 4 fail** (the Admin's link still showed "Owner" and activated it; the accept and resend races; the re-enable) | pass |
| `review-races.test.ts` — pass 4 (7 new tests) | `ddf7b71` (the session read through a shim of `ddf7b71`'s separate reads): **7 of 7 fail** — the role change decided on "Invited" succeeds (twice: before and under the lock), the reset link minted for the Editor still works after the promotion, the revoked session reads the new roles (`enrolment_required: admin`), the password-only session reads as `active`, the first bootstrap's setup link still works (and, run on its own, a stray setup link accepted after the real Owner activated creates a second Owner: `kind: ok`), the 2FA reset of a removed account returns `ok`; the 20 earlier tests in the file pass on both | 27 / 27 |
| `admin.spec.ts` — roles chosen while the account showed Invited (1 new test) | `ddf7b71` (built in a worktree, the new spec copied in): **fails** — no refusal appears, the Owner's save goes through on the account the older link has just activated; the 12 tests before it pass (the spec runs in order, so the 19 after it did not run) | passes (admin 41 / 41) |
| `review-races.test.ts` — pass 5 (14 new tests) | `6ac8c55` (the two role tests pass the status the page showed, the only state that commit compared): **14 of 14 fail** — the older roles form gives Admin back (`editor → admin, reviewer`, also under the lock), the older enable, unlock and 2FA reset go through, the older resend issues a link, the listed session's successor stays signed in (the own list answers "already ended", the Owner's "out of 0 session(s)", the lockout and "Sign out" leave it `active`), the connection stays at `READ-COMMITTED`, the reset link outlives the 2FA reset, the expired session is read with the new roles (`enrolment_required`), and the step-up's recovery code leaves no audit entry | 41 / 41 |
| Round 4's two snapshot tests, with the local server's default isolation switched to READ COMMITTED (restored after) | `6ac8c55`: **2 of 2 fail** (the separate reads come back); now: pass | pass |
| `admin.spec.ts` — a listed session that rotated meanwhile (1 new test) | `6ac8c55` (built in a worktree, the new spec copied in): **fails** — the dialog answers "That session has already ended." and stays open, the device's new session still signed in; the 14 tests before it pass (the 18 after it did not run) | passes (admin 42 / 42) |
| `review-races.test.ts` — pass 6 (2 new tests) | `89edcc5` (the unlock test sends the fingerprint that commit compared): **2 of 2 fail** — the older unlock clears 7 counted attempts (`kind: ok`), and the Owner's role change is refused after the user's own password change (`denied`, `changed`) | pass |
| `admin.spec.ts` — the role boxes after another action refreshed the page (1 new test) | `89edcc5` (built in a worktree, the new spec copied in): **fails** — after "Disable" refreshed the page, the Admin box is still ticked although another Owner took Admin away; a variant that saves anyway **gives Admin back** (`admin, editor, reviewer` in the database); the 13 tests before it pass | passes |
| `review-races.test.ts` — pass 7 (3 new tests) | `b66468d` (the reset tests send the fingerprint that commit compared): **3 of 3 fail** — the 2FA reset goes through after the password was replaced and after a failed code, and the unlock after a 2FA reset (`kind: ok` each time) | pass |
| `admin.spec.ts` — Back to a user page (1 new test) | `b66468d` (its build, the new spec): **fails** — the page is loaded again (`back_forward`) and Chromium puts the Reviewer box back ticked although another Owner took Reviewer away; a variant that saves anyway **gives Reviewer back** (`admin, editor, reviewer` in the database); the 14 tests before it pass | passes |
| `review-races.test.ts` — pass 8 (2 new tests) | `da3e5a3`: **2 of 2 fail** — two wrong passwords refuse the Owner's 2FA reset (`denied`, `changed`), and while another change holds the user's row the CLI already holds the second factor's row (`ER_LOCK_WAIT_TIMEOUT` on a no-wait probe) | pass |
| `review-races.test.ts` — pass 9 (3 new tests) | `98735f9`: **2 of 3 fail** — the 2FA reset goes through after a sign-in that passed the password (`kind: ok`), and the emergency CLI's whole run aborts on the failing user, losing the link already issued to the first; the third (a wrong recovery code, a wrong step-up code, a lock from wrong passwords) passes on both, as intended: it pins round 8's rule, which the review found untested | pass |

#### 32. Remaining limitations
- **Availability lever (pass 1):** anyone who knows an Owner's email can keep that account's 5 credential-check slots
  taken and its sign-in lock set; the signed-in Owner then cannot step up (no disable or role change in an incident).
  Options for the Owner: a separate per-user budget for in-session checks, or recovery through the server-side CLI (which
  exists: `admin-bootstrap --reset`, `admin-2fa-reset`).
- **The in-app 2FA reset leaves the password valid (pass 3):** the next password-only sign-in may enrol any authenticator.
  The emergency CLI forces a password-reset link; doing the same in the app is an option for the Owner (not changed: an
  accepted A2 behaviour, §11).
- **With no mail transport the inviting Owner or Admin holds the invitation link** (the A2 design) and could activate the
  account themselves; since `ddf7b71` such a link can only ever activate roles its issuer may grant, and since `6ac8c55`
  a promotion the Owner decided on the invited account is refused once the account was activated meanwhile.
- The slot window uses each app process's clock (skew shortens it by the skew); `rate_limits` rows are never pruned (5
  rows per email ever tried; housekeeping belongs to A8).
- Reset-request timing can reveal whether an account exists once mail is configured (mail is disabled: no effect now).
- Pre-existing lock order: token-first transactions (`completePasswordReset`, `acceptInvitation`, a reset request when
  mail is configured) can deadlock with user-first ones on the same user (role and status changes, 2FA removal, a password
  change and, since the eighth review, the emergency 2FA CLI); `inTransaction` retries once and the outcome is correct (the
  token is used → "invalid"); a second deadlock is an error page, and the CLI reports that user and goes on (ninth
  review). Two writers stay outside the "user row first" rule, harmlessly: re-encrypting TOTP secrets (changes nothing a
  decision reads) and the bootstrap recovery reset (decides from a read made before its transaction).
- The newest failed second step is found by walking the user's `login_attempts` rows, which anyone can add to (about
  480 a day per email) and which nothing prunes in A2: it is read only for the 2FA reset and the user page of an account
  with a second factor; an index on `(user_id, failure_reason)` and pruning belong to A8.
- A change that overlaps its own session's periodic rotation ends "session ended" (the tab recovers with the new cookie);
  periodic rotation happens on navigation only.
- Removing any role from a user withdraws every invitation they sent (they can be sent again).
- **Adding a role to an account without two-factor does not notice a password replaced after the page was shown** (pass
  8, a design choice of the sixth round): the access fingerprint leaves the password out so that the user's own password
  change never stalls an Owner's role change. Option for the Owner: also compare the password's last change when a
  change adds a role to an account without a confirmed second factor (a second hidden fingerprint on the roles form).
- **The two-factor reset is decided on what happened after its page was shown** (a password replaced, a sign-in that
  passed the password — pending or complete —, a session rotated, a failed second step: each refuses it since
  `d21e222`). What happened before is on the page itself (sessions, recent security events) for the Owner to read before
  confirming: part of the accepted in-app reset behaviour above.
- **A compromised account can replace its own authenticator, which moves the fingerprint**, so an Owner's change decided
  on an older page is refused until the page is reloaded; the incident step is to disable the account first (disabling
  is never refused for this reason).
- **A sign-out request that carries an already-ended token ends nothing**; if another tab's late rotation left the browser
  holding the successor, "Sign out everywhere" (or an Owner's sign-out, which follows the rotation) ends it.
- **Shared origin (pass 5):** the admin's same-origin check accepts any page of the site, and the public pages carry no
  CSP. Nothing but RAWASY's own code runs on the public site today; carried to A3.
- **Database portability (pass 6):** every connection sets `transaction_isolation` (MariaDB 11.1 or later; older servers
  call it `tx_isolation`), and from MariaDB 11.6.2 `innodb_snapshot_isolation` is on by default, under which a write to a
  row changed after the transaction's snapshot fails with error 1020 (the admin would answer "unavailable"). Namecheap
  lists 11.4.9 and the local server is 11.4.13; both checks are added to the pre-staging account checks.
- **Form-state restoration is tested in Chromium only** (the browser suite's engine). Firefox does not restore form state
  for no-store pages; `autocomplete="off"` also covers Safari's WebKit, untested here.
- **Emergency CLI (pass 10):** a user whose reset failed is reported as "NOT reset … nothing was changed"; in the rare
  case where the connection dropped right after the server committed, the reset was applied and its link lost. Running
  the command again for that user is right in both cases (it issues a fresh link). All links of one run count their 30
  minutes from the run's start, so after lock-wait timeouts later users' links have less time left.
- **For A8 (pass 10):** the 2FA reset's fingerprint counts the sessions an account has ever had; the daily purge of
  expired sessions planned in A1 must not lower what it counts (use the count and the newest id, or a per-user counter,
  when the purge is built).
- **Test gaps (pass 10):** no test isolates a rotation counted by the 2FA reset, or a CLI failure after its first write;
  the CLI script's exit code 3 is not tested. One comment overstates which sign-ins add a session (one refused under the
  lock checks the password and adds none).
- `last_owner` is now defence in depth: a disabled or demoted Owner's sessions end first.
- With the gate off and the proxy bypassed (not possible in this deployment), `/admin` answers Next's error shell with
  the admin root layout's title rather than the localized 404.
- Carried over: the frozen homepage showcase race (Owner decision 5: unchanged); the dev-only audit advisories (decision
  4); nothing tested on a real Namecheap host (decision 7: account checks and key escrow before staging).

#### 33. `preserve/pre-admin-a2` unchanged
`git ls-remote` at the end: `refs/heads/preserve/pre-admin-a2` → `ed6b6521f8e5cae04f983acd298e0ef1e6b9aac0`, as at the
start (never pushed to); `refs/heads/preserve/pre-admin-a2-correction1` → `b47d8e533bc59543f9d2de839d10894ba63831cb`
(created once, without force, and not moved since).

#### 34. `main` untouched
`refs/heads/main` → `474f61f10f12981e41f9b7e7fd6065a0ec9da541`, as at the start: nothing was pushed to `main`, and no
branch other than `claude/new-session-5eijs6` and the new checkpoint was pushed.

#### 35. No A3
Nothing of A3–A9 was started: no CMS editing, media, page builder, navigation or settings management, enquiries,
publishing, revisions, database-backed public pages, content migration, cache handler, projections, redirects or
persistent media. Every change is in the four corrected areas and the review fixes (item 5), plus their tests and docs.

#### 36. Nothing deployed
Nothing was uploaded, no Namecheap database was created or connected to, no cPanel, DNS, nameserver, SSL or email setting
was touched, no production SMTP was used and no production secret or `ADMIN_ENABLED` value was created. All database work
ran against the local Docker MariaDB 11.4.13 (`127.0.0.1:3307`).

### Items for the Owner's decision (none blocks this correction)
1. The options recorded in item 32: an in-app 2FA reset that also forces a password reset (as the emergency CLI does); a
   separate budget for in-session password checks; comparing the password's last change when a role is added to an
   account without a second factor; the emergency CLI's wording after a connection lost at commit.
2. Two additions to the pre-staging account checks (A1-ARCHITECTURE §7.3): the server is MariaDB 11.1 or later
   (`transaction_isolation`), and from 11.6.2 `innodb_snapshot_isolation` is either off or handled. With the key escrow
   and the other account checks, unchanged.
3. For A8: the planned purge of expired sessions must keep the 2FA reset's session count from going down (item 32).

### How to run (local)
Unchanged from A2 (README, "Admin (local development)"): a local MariaDB compatible with 11.4, then `npm run test:unit`,
`npm run test:integration` and `npm run test:admin` with `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER` and
`TEST_DB_PASSWORD`. Locally the admin is on without `ADMIN_ENABLED` (`APP_ENV=local`); staging and production leave it
unset, so `/admin` stays the public localized 404 there.

### Next steps
The independent review of A2 with this correction. A3 starts only when the Owner approves A2 and says so; nothing is
deployed before the Owner's go-ahead.

---

A2 CORRECTION 1 STATUS: READY FOR INDEPENDENT REVIEW
