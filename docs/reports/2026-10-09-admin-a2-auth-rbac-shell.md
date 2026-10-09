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
