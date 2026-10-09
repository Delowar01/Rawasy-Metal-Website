# A1 — Security, authentication and roles (RBAC)

**Status:** Phase A1 specification. **Design only — nothing in this document is implemented.** A2 builds
authentication, roles and the admin shell; later phases apply these rules to every feature.

Related: [A1-ARCHITECTURE](A1-ARCHITECTURE.md) · [A1-DATABASE-SCHEMA](A1-DATABASE-SCHEMA.md) (access tables) ·
[A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) · [A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md) ·
[A1-CONTENT-MODEL](A1-CONTENT-MODEL.md).

Facts marked *(16.3.8 source)* were verified in the installed Next.js 16.3.8 docs and source during A1.

---

## 1. Threat model

| Asset | Threats | Main controls |
|---|---|---|
| Public site integrity (what visitors read) | stolen admin account, malicious or careless edit, injected script, defacement | RBAC + review, revisions + restore, audit, no code from content (§10), publication gates |
| Admin accounts | password guessing, credential stuffing, phishing, session theft, session fixation | strong hashing, rate limits and lockout, optional TOTP, `__Host-` HttpOnly SameSite cookies, rotation, step-up |
| Drafts and unpublished content | leaking through the public site or caches | public reads only published projections; preview needs draft mode **and** an admin session; admin `no-store` |
| Private documents (certificate originals) | public exposure, unauthorized download | separate private storage outside web roots, Owner-only permission, step-up, audit |
| Enquiries (personal data) | exposure, over-retention, export misuse | least privilege, retention job, audited Owner-only export, private files |
| Server | code execution via uploads or content, path traversal, SSRF | re-encoded images, type allowlist, server-generated keys, no URL fetching from content, no HTML |
| Secrets | leaks via repository, archive, logs, backups | env vars only, `.next`/archive treated as secret, redaction, backup protection |
| Availability | brute force, upload floods, cache-file growth from crawlers | rate limits, chunk and size caps, 404s not cached |

## 2. Principles

1. **Authorize on the server, at the data.** Every Server Action and Route Handler checks the session, the permission and
   the specific record (Next's docs: actions are public POST endpoints; layouts and the proxy are not security
   boundaries *(16.3.8 docs)*). The UI hiding a button is convenience only.
2. **Least privilege, separation of duties.** Editors draft; reviewers approve; Owner/Admin publish; only the Owner
   touches private documents, theme, backups, legal publication and purges.
3. **Fail closed.** Unknown flags restrict; unknown permissions deny; a validation error blocks; a missing Origin on a
   mutating route is refused.
4. **No code from the admin**, ever (§10).
5. **Everything sensitive is audited** (§11), including denied attempts.

## 3. Authentication

### 3.1 Accounts
- No public registration. Accounts are created by **invitation** (Owner, or Admin for Editor/Reviewer) or by the
  **first-owner bootstrap** (§3.9). Invitations are single-use links valid 72 hours (`auth_tokens`, hashed).
- Login identifier: email (normalized: trimmed, lower-cased). Account states: `invited`, `active`, `disabled`.
- **The last active Owner cannot be disabled, demoted or deleted** (checked in the same transaction).

### 3.2 Passwords
- Minimum 12 characters, maximum 128, any characters (passphrases welcome), no composition rules, no forced periodic
  change; rejected if found in a bundled list of common/breached passwords. Checking a third-party breach service would
  send a hash prefix outside the site — an Owner decision, not proposed by default.
- **Hashing: Argon2id** (OWASP baseline m = 19 MiB, t = 2, p = 1; tuned on the host to ≈ 250–500 ms) via a maintained
  library with prebuilt binaries for the host (glibc 2.28) — verified in A2 before adoption. **Fallback** if no native
  module is acceptable: Node's built-in `crypto.scrypt` (N = 2^15, r = 8, p = 1, ≈ 32 MiB). Stored as a self-describing
  PHC string, so parameters can be raised later (rehash on next login). An optional server-side pepper
  (`AUTH_PEPPER`) is an A2 decision.
- Password change requires the current password (or a reset token) and revokes all other sessions.

### 3.3 Sessions
- **Database sessions** (`sessions`), not stateless tokens: revocable, listable, attributable.
- Cookie `__Host-rawasy_admin` = 32 random bytes (base64url); the database stores only its **SHA-256**.
  Attributes: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain` (the `__Host-` prefix enforces the last
  three). Next writes `Secure` whenever the option is set, whatever the internal protocol *(16.3.8 source)*; deleting a
  `__Host-` cookie must also pass `secure: true, path: '/'`.
- Lifetimes (proposed; Owner may adjust): **idle 2 hours**, **absolute 12 hours**, re-authentication window for
  sensitive actions **10 minutes**. No "remember me" by default (Owner decision).
- **Rotation:** a new session id/token on login, on privilege change, after 2FA verification and at least every 30
  minutes of activity; the old row is revoked (`rotated`).
- `last_seen_at` updated at most once a minute (limits writes).
- **Validation on every admin request** through the data-access layer (`requireUser()` / `requirePermission()`),
  in every layout, page, Server Action and Route Handler that needs it — never only in a layout or the proxy.
- **Logout:** `POST` only (CSRF-protected), revokes the row, deletes the cookie.
- **Device list:** each user sees their sessions (browser, IP, last seen) and can revoke them; Owner/Admin can revoke
  others' (by rank, §5.2). **Forced logout:** disabling a user, changing their roles or resetting their password revokes
  all their sessions. **Restoring a database backup revokes every session** (they are excluded from dumps anyway).

### 3.4 Sign-in throttling and lockout
- Counters in the database (`rate_limits`), so every app process shares them; evidence in `login_attempts`.
- Per account: after 5 failures in 15 minutes, a 15-minute lock, doubling on repetition (max 24 h); the Owner can
  unlock. Per IP: 30 attempts per 15 minutes. The response is identical for unknown emails, wrong passwords and locked
  accounts (no account enumeration); the lock is visible only to the user via email notice (A7 mail) and to admins.
- **Client IP:** behind the host's web server the socket address is always `127.0.0.1` (LiteSpeed and Passenger both
  rewrite it), so the IP comes from `X-Forwarded-For` — **the right-most entry added by the trusted proxy**
  (`TRUSTED_PROXY_HOPS`, default 1), never the left-most (client-controlled). Verified on the host in A2.

### 3.5 Password reset
Request form (rate-limited: 3 per account per hour, 10 per IP per hour) → generic response → if the account exists and
is active, an email with a single-use link (32 random bytes, hashed in `auth_tokens`, **valid 30 minutes**) → new
password → all sessions revoked → audit. Reset emails are sent directly, never stored in the outbox (no token at rest).
The Owner can also reset any account from the CLI (§3.9).

### 3.6 Two-factor authentication (optional TOTP)
- RFC 6238 TOTP (30 s, 6 digits, ±1 step) with any authenticator app; secret encrypted at rest with AES-256-GCM using
  `AUTH_ENCRYPTION_KEY` (32 bytes, base64; `key_version` allows rotation); `last_used_step` blocks replay.
- 10 single-use recovery codes, shown once, stored hashed.
- Enabling and disabling need the password and a valid code; both are audited and announced by email.
- **Enforcement** (Owner decision; proposed): required for Owner and Admin, optional for Editor and Reviewer.

### 3.7 Step-up re-authentication
Permissions marked `is_sensitive` require a password (and TOTP when enabled) confirmation within the last 10 minutes:
managing users and roles, security settings, viewing or downloading private documents, enquiry export, theme
publication, legal publication, purges, backup actions, cache purge.

### 3.8 Account email change
Confirmation link to the **new** address (`auth_tokens.purpose = 'email_change'`) plus a notice to the old one; sessions
rotate.

### 3.9 First-owner bootstrap (no hard-coded password)
**Primary: a CLI run on the server** (cPanel Terminal or SSH, inside the app's Node environment):
`node scripts/admin-bootstrap.mjs --email <owner email> --name "<name>"`.
It refuses to run if any active Owner exists; creates the user as `invited` with the `owner` role; prints a
**one-time setup link** (token hashed in `auth_tokens`, valid 30 minutes) where the Owner chooses their password (and
TOTP). No password ever appears in a command line, shell history, environment variable, file or repository. The same CLI
offers `--reset <email>` (prints a reset link) for recovery when no Owner can sign in.

**Fallback (only if the host offers neither Terminal nor SSH):** a `/admin/setup` route that exists only while the
`ADMIN_BOOTSTRAP_TOKEN` environment variable is set **and** no Owner exists; it compares the token in constant time,
creates the Owner, and stops working immediately after (the Owner then removes the variable). Never enabled by default.

## 4. The admin surface (`/admin`)

- **Routing:** `/admin/**` in its own route group with its own root layout (no public shell, ambient or motion). A2
  adds `admin(?:/|$)` and `api(?:/|$)` to the negative look-ahead of `src/proxy.ts`'s matcher so `/admin` is no longer
  redirected to `/en/admin` (checked with Next's own matcher code: `/admin`, `/admin/login`, `/api/admin/uploads`
  excluded; `/administrator`, `/apiary` still proxied).
- **Authentication everywhere** except `/admin/login`, `/admin/reset/*`, `/admin/invite/*` (and `/admin/setup` in the
  fallback) — enforced server-side in each page/action/handler (§2.1); the proxy may add a cheap cookie-presence redirect
  for convenience only.
- **Headers** for `/admin/:path*` and `/api/admin/:path*` (via `next.config` `headers()`, A2):
  `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, `Content-Security-Policy` with `frame-ancestors 'none'`
  (and a nonce-based policy for the admin's own scripts — feasible there because admin pages render dynamically, unlike
  the static public pages), `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`
  (camera, microphone, geolocation off). Every admin page also has `robots: noindex, nofollow` metadata.
- **Never in the sitemap, never linked from public pages, not listed in `robots.txt`** (listing it would advertise the
  path; `noindex` headers and authentication do the work).
- **Admin language:** English interface first; an Arabic admin interface is an Owner decision (content is always
  edited in both languages).

## 5. Authorization (RBAC)

### 5.1 Model
Roles (`roles`): **Owner** (rank 100), **Admin** (80), **Editor** (40), **Reviewer** (30). Permissions are code-defined
keys `resource.action` seeded into `permissions`; the matrix below is seeded into `role_permissions`. A user may hold
several roles (effective permissions = union; e.g. Editor + Reviewer). Custom roles are possible in the schema but not
offered unless the Owner asks.

### 5.2 Rules beyond the matrix
- **Rank rule:** nobody invites, edits, disables or revokes the sessions of a user with an equal or higher rank, except
  the Owner. Only the Owner creates Admins or Owners; ownership transfer is Owner-only and needs step-up.
- **Four eyes:** a reviewer cannot approve their own submission; an Editor cannot publish.
- **Record-level checks:** every action loads the record and checks its state (e.g. legal page → `legal.*` keys;
  certificate → `certificates.*`; private item → `private_documents.*`).
- **Permissions are re-checked when a scheduled publication runs** (the creator must still hold them).

### 5.3 Permission matrix

O = Owner · A = Admin · E = Editor · R = Reviewer · ✓ allowed · — not allowed · ⚑ default proposed, **Owner decision**

| Area / permission | O | A | E | R |
|---|:-:|:-:|:-:|:-:|
| Dashboard; view drafts and history (`content.view`); preview (`preview.use`) | ✓ | ✓ | ✓ | ✓ |
| **Users** — view list | ✓ | ✓ | — | — |
| Users — invite, edit, disable, revoke sessions | ✓ | Editors/Reviewers only | — | — |
| Users — create Admin/Owner, transfer ownership, delete | ✓ | — | — | — |
| Own profile, password, 2FA, own sessions | ✓ | ✓ | ✓ | ✓ |
| **Roles and permissions** — view / manage | ✓ / ✓ | ✓ / — | — | — |
| Security settings (2FA enforcement, session policy) | ✓ | — | — | — |
| **Pages** (home, system, generic) — edit drafts, submit | ✓ | ✓ | ✓ | — |
| Pages — review (comment, request changes) | ✓ | ✓ | — | ✓ |
| Pages — publish directly | ✓ | ✓ ⚑ | — | — |
| Pages — publish after review | ✓ | ✓ | — | ✓ (not own) |
| Pages — create generic page | ✓ | ✓ | ✓ | — |
| Pages — unpublish, archive, Trash | ✓ | ✓ | — | — |
| **Legal pages** — edit | ✓ | ✓ | — | — |
| Legal pages — publish (with legal-review confirmation) | ✓ | — | — | — |
| **Services, projects, machinery, industries, clients, project categories, orderings, reusable sections** — edit, submit | ✓ | ✓ | ✓ | — |
| … review | ✓ | ✓ | — | ✓ |
| … publish directly / after review | ✓ / ✓ | ✓ ⚑ / ✓ | — | — / ✓ (not own) |
| … unpublish, archive, Trash | ✓ | ✓ | — | — |
| Project flags — add | ✓ | ✓ | ✓ | ✓ |
| Project flags — clear | ✓ | ✓ | — | — |
| **Certificates** — edit / publish | ✓ / ✓ | ✓ / — ⚑ | — | — |
| **Private documents** — upload, view, download | ✓ | — ⚑ | — | — |
| **Media** — upload, edit metadata, organize | ✓ | ✓ | ✓ | — |
| Media — add a flag, restrict | ✓ | ✓ | ✓ | ✓ |
| Media — approve for public use, clear blocking flags | ✓ | ✓ | — | — |
| Media — download originals | ✓ | ✓ | — | — |
| Media — Trash | ✓ | ✓ | — | — |
| **Purge** anything (permanent delete) | ✓ | — | — | — |
| Restore a revision into the draft | ✓ | ✓ | ✓ | — |
| **Menus** — edit / publish | ✓ / ✓ | ✓ / ✓ | — | — |
| **Site settings and interface text** — edit / publish | ✓ / ✓ | ✓ / ✓ | — | — |
| **Theme** (design tokens) — edit / publish | ✓ | — | — | — |
| **SEO** — titles, descriptions, share text and image | ✓ | ✓ | ✓ | — |
| SEO — robots, canonical override, sitemap inclusion | ✓ | ✓ | — | — |
| **Redirects** — view / manage | ✓ / ✓ | ✓ / ✓ | ✓ / — | ✓ / — |
| **Forms** — edit copy and fields / publish | ✓ | ✓ | — | — |
| Forms — delivery mode (hand-off → store) | ✓ | — | — | — |
| **Enquiries** — view, change status, notes, assign | ✓ | ✓ ⚑ | — ⚑ | — |
| Enquiries — export CSV, delete | ✓ | — | — | — |
| **Audit log** — view / export | ✓ / ✓ | ✓ / — | — | — |
| **Backups** — view status, run a backup now | ✓ | — | — | — |
| Backups — restore | ✓ (CLI only) | — | — | — |
| **Cache** — refresh the whole site / clear the image cache | ✓ / ✓ | ✓ / — | — | — |

Admin ≠ Owner: the Owner alone manages Admins and Owners, security settings, theme, legal publication, certificate
publication, private documents, enquiry export, backups, restores and purges.

### 5.4 Permission keys (seeded)
`content.view`, `preview.use`, `dashboard.view`; `users.view|invite|edit|disable|delete|sessions_revoke`;
`roles.view|manage`; `security.settings`; for each of `pages`, `services`, `machines`, `projects`,
`project_categories`, `industries`, `clients`, `certificates`, `orderings`, `reusable_sections`:
`.edit|submit|review|publish|publish_reviewed|archive|delete|restore`; `pages.create_generic`; `projects.clear_flags`;
`legal.edit|publish`; `media.view|upload|edit|flag|approve|view_original|delete`; `private_documents.view|upload|delete`;
`purge.any`; `menus.edit|publish`; `settings.edit|publish`; `theme.edit|publish`; `seo.advanced`;
`redirects.view|manage`; `forms.edit|publish|delivery_mode`; `enquiries.view|manage|export|delete`;
`audit.view|export`; `backups.view|run`; `cache.refresh|clear_images`.

## 6. CSRF and request integrity

- **Server Actions** (admin mutations): Next 16.3.8 compares the request's `Origin` host with `X-Forwarded-Host` (first
  value) or `Host` and aborts on mismatch; a missing `Origin` is only warned about *(16.3.8 source,
  `server/app-render/action-handler.js`)*. On top of that: the session cookie is `SameSite=Strict`, and every action
  validates the session. If the host forwards an internal host name, `experimental.serverActions.allowedOrigins` lists
  the public host (verified on the host in A2). Body limit stays at the default 1 MB (files never go through actions).
- **Route Handlers have no built-in CSRF protection** *(16.3.8 source)*. Every mutating admin route requires: a valid
  session; `Origin` exactly equal to the configured site origin (missing → reject); `Sec-Fetch-Site: same-origin`; a
  non-simple content type (JSON, octet-stream) or a custom header, so plain cross-site forms cannot reach it.
- **Public enquiry submission** (A7): a Server Action or route with the Origin check, honeypot, signed timing token and
  rate limits.
- **Server Actions encryption key:** Next encrypts action closure variables with a key it stores in the build
  (`.next/server/server-reference-manifest.json`) and reuses for 14 days *(16.3.8 source)*. Set
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (one stable value per environment) so every process and release agrees, and
  treat `.next` and the deployment archive as secret material. Releases change action ids: the admin shows "The site was
  updated — reload" when an old tab calls a removed action.
- **No absolute URLs from the request:** inside the app `request.url` carries the server's own host (`0.0.0.0:PORT`);
  links, redirects and emails use `NEXT_PUBLIC_SITE_URL`.

## 7. Preview security
Draft mode alone grants nothing: working-copy data is returned only when draft mode is on **and** the request carries a
valid admin session with `preview.use` ([A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) §11). The draft-mode cookie
value is shared by the whole build (and reused for 14 days unless `.next/cache/.previewinfo` is deleted before the
build); the release procedure deletes it so every release gets a new value. Previews are `private, no-store` and
`noindex`.

## 8. Uploads and files
Summarized from [A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md): Route Handler outside the proxy; session, permission, Origin
and rate checks; chunked streaming to private temporary storage with byte caps; extension allowlist **and** magic-byte
check; decode with pixel limits; images re-encoded for any public delivery; originals and private documents never at a
public address; server-generated storage keys; resolved-path checks; `nosniff`, exact content types, `attachment` for
documents; CSV injection neutralized in exports.

## 9. Data classification and handling

| Class | Handling |
|---|---|
| PUBLIC | cacheable; served to anyone; only from published projections, `public_media` and generated SEO files |
| ADMIN-ONLY | authenticated, permission-checked, `no-store`; never in public projections or public caches; logs show ids, not content |
| PRIVATE | Owner-level permissions; storage outside web roots; never passed to `/_next/image`; secrets hashed or encrypted (passwords: Argon2id; session/reset/recovery tokens: SHA-256; TOTP: AES-256-GCM); IPs cleared after their retention; excluded from logs; backups protected (§12) |

No private file ever lives at a public static URL: `public/` holds only approved release assets, and persistent private
storage sits outside both the release and `public_html`.

## 10. Content safety (no code execution from the admin)
- Content is plain text, typed values, token references and the rich-text JSON model — **no HTML, script, `eval`,
  template syntax, CSS text, SQL or server code** is accepted anywhere ([A1-CONTENT-MODEL](A1-CONTENT-MODEL.md) §13).
- All output goes through React (escaped); JSON-LD keeps today's `<` escaping; attributes and URLs come from validated
  fields; link schemes are allowlisted (`https`, `mailto`, `tel`, internal ids).
- Embeds take ids for allowlisted hosts and render sandboxed, titled iframes.
- Database access only through the ORM's parameterized queries; no SQL string ever built from content.
- Validation regular expressions are code-defined (no admin-supplied patterns: avoids ReDoS and injection).
- The server never fetches a URL an editor typed (no SSRF surface): external images are not supported; media are
  uploaded.

## 11. Audit logging
- **Table** `audit_events` (append-only in the application: no update or delete code path; retention purge is the only
  deletion and is itself audited). Optional tamper evidence: each row stores `hash = SHA-256(prev_hash + canonical
  event)` (A8 decision). If the host allows triggers, `BEFORE UPDATE/DELETE` triggers that raise an error add a database
  barrier (to verify: shared hosting may refuse `CREATE TRIGGER` when binary logging is on).
- **Fields:** time (UTC), request id, actor type and user id, actor label and roles at the time, session id, IP, action,
  entity type/id/label, outcome (`success` / `denied` / `failed`), human summary, before/after revision ids, and a
  redacted field diff for changes not covered by revisions (users, roles, settings of accounts).
- **Events:** sign-in success/failure/lock, logout, password and email changes, 2FA changes, session revocations,
  invitations, role changes, account disable; every content transition (save, submit, review, publish, schedule,
  unpublish, archive, Trash, restore, purge); media upload, approval, flagging, restriction, replacement, download of
  originals and private documents; menu, settings, theme and redirect changes; enquiry status changes, notes, export,
  deletion; backup runs; cache purges; permission denials.
- **Never logged:** passwords, tokens, TOTP secrets or codes, full enquiry message bodies (only ids and changed field
  names).
- **Indexing:** time; entity + time; actor + time; action + time; request id.
- **Retention:** proposed 24 months (Owner decision; legal review for personal data); export Owner-only.
- **Access:** Owner (view, export); Admin (view).

## 12. Secrets and configuration
Environment variable **names** (values are set in cPanel → Setup Node.js App → Environment variables, or a server-side
`.env` outside the release; never in the repository, the deployment archive or documentation):

| Variable | Purpose | Phase |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or `DB_SOCKET_PATH`) | MariaDB connection | A2 |
| `DB_POOL_LIMIT` | connections per process (default 4) | A2 |
| `RAWASY_DATA_DIR` | persistent storage root | A3/A4 |
| `AUTH_ENCRYPTION_KEY` | AES-256-GCM key for TOTP secrets (base64, 32 bytes) | A2 |
| `AUTH_PEPPER` | optional password pepper | A2 (decision) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | stable Server Actions key across processes and releases | A2 |
| `TRUSTED_PROXY_HOPS` | how many `X-Forwarded-For` entries the host adds (default 1) | A2 |
| `CRON_SECRET` | authenticates cron calls to `/api/internal/*` | A3/A8 |
| `ADMIN_BOOTSTRAP_TOKEN` | fallback bootstrap only; unset otherwise | A2 |
| `APP_ENV` | `local` · `staging` · `production` (banners, safety guards) | A2 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | outgoing mail | A2 (reset mail) / A7 |
| `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET` | optional CAPTCHA | A7 (decision) |
| `NEXT_PUBLIC_SITE_URL` | public origin (exists today) | — |

Database dumps read credentials from `~/.my.cnf` (mode `0600`), never from a command line. The A1 documents contain no
credential values; the Owner is never asked to put production credentials in source control.

## 13. Dependencies and supply chain
Exact versions pinned (as today); `npm audit --omit=dev` must stay at 0 for the served app; every new dependency is
named in its phase's report with its purpose and licence; native modules only with prebuilt binaries for the host's
glibc 2.28 (verified before adoption); lockfile changes reviewed; Next.js upgrades re-run the cache-handler test and the
full suite.

## 14. Public-site security headers (proposal for A2/A6, Owner decision)
Additive headers that do not change appearance: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security` once HTTPS on the domain is
confirmed. A nonce-based CSP would make every public page dynamic (no static caching) *(16.3.8 docs)*; a static CSP
with hashes for the inline boot script is possible and would be evaluated separately.

## 15. Incident response (outline)
Revoke all sessions (one SQL statement or an Owner action); rotate `AUTH_ENCRYPTION_KEY` (re-encrypt TOTP secrets),
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `CRON_SECRET`, database and SMTP passwords; review the audit log for the period;
restore content from revisions or a backup; rebuild and redeploy (new draft-mode value).

## 16. Tests the later phases must include
Permission matrix as table-driven tests (each role × each permission, allowed and denied); every Server Action and
mutating route rejects an anonymous call, a wrong role, a cross-origin call and a stale `lock_version`; session expiry,
rotation and revocation; lockout and enumeration resistance; preview without an admin session shows published data;
private items never reachable through `/media/u`, `/_next/image` or any public page; uploads with a wrong signature,
oversize, oversize pixels, path tricks; draft content absent from every public response.
