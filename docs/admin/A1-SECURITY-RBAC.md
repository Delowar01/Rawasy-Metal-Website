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
  PHC string, so parameters can be raised later (rehash on next login).
- **No pepper by default (A1 Correction 1).** Argon2id is the password-hashing control. An `AUTH_PEPPER` is **not**
  used in A2. If one is ever enabled, losing it makes every password unverifiable (all accounts would need a reset),
  so it would become a recovery-critical secret with offline escrow and a rotation runbook (§12.1) before activation.
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
  (`TRUSTED_PROXY_HOPS`, default 1), never the left-most (client-controlled). Verified on the host before staging
  (A1-ARCHITECTURE §7.3); A2 tests the rule locally.

### 3.5 Password reset
Request form (rate-limited: 3 per account per hour, 10 per IP per hour) → generic response → if the account exists and
is active, an email with a single-use link (32 random bytes, hashed in `auth_tokens`, **valid 30 minutes**) → new
password → all sessions revoked → audit. Reset emails are sent directly, never stored in the outbox (no token at rest).
The Owner can also reset any account from the CLI (§3.9).

### 3.6 Two-factor authentication (optional TOTP)
- RFC 6238 TOTP (30 s, 6 digits, ±1 step) with any authenticator app; secret encrypted at rest with AES-256-GCM using
  the active `AUTH_ENCRYPTION_KEY` (32 bytes, base64), each row stamped with the key's version (`user_mfa.key_version`);
  `last_used_step` blocks replay. The key is a **recovery-critical secret** with offline escrow, versioned rotation and
  an emergency reset path (§12.2–§12.4).
- 10 single-use recovery codes, shown once, stored hashed.
- Enabling and disabling need the password and a valid code; both are audited and announced by email.
- **Enforcement** (Owner decision; proposed): required for Owner and Admin, optional for Editor and Reviewer.
- **Lost device:** the user signs in with a recovery code and re-enrols. An Owner (step-up) may reset another user's 2FA
  after confirming the person's identity outside the system; the reset revokes that user's sessions and is audited. An
  Owner who has lost both the device and the recovery codes uses the server CLI (`admin-bootstrap.mjs --reset`, §3.9),
  which requires access to the hosting account.

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

- **Routing:** `/admin/**` in its own route group with its own root layout (no public shell, ambient or motion), every
  admin page rendered dynamically (it reads the session; the admin root layout also forces dynamic rendering).
- **Proxy: network and header boundary only (corrected in A1 Correction 1).** `/admin/**` *page* requests pass through
  `src/proxy.ts` (today's matcher already includes them) for one narrow purpose, in an **admin branch checked before
  any public logic**:
  - generate a cryptographically random nonce for every request (16 random bytes, base64);
  - set the nonce-based `Content-Security-Policy` (and an `x-nonce` header) on the **request**, so Next.js applies the
    nonce to its own scripts while rendering, and the same policy on the **response** — the pattern of the installed
    Next.js 16.3.8 guide (`docs/01-app/02-guides/content-security-policy.md`, "Adding a nonce with Proxy"; nonces need
    dynamic rendering, which admin pages have);
  - add the admin response headers (below);
  - **never** perform the public locale redirect or any public routing, and **never** read the session, check
    permissions or redirect to the login page. Authentication and authorization stay in the data-access layer: every
    admin page, Server Action and Route Handler validates the session and RBAC server-side (§2.1, §5). An
    unauthenticated admin page request is redirected to `/admin/login` by the page's own server-side check.
  - The proxy buffers non-GET bodies it matches (up to `proxyClientMaxBodySize`, 10 MB): admin Server Actions (POSTs to
    admin pages) stay within their 1 MB limit, and no file ever goes through an action.
- **Outside the proxy:** `/api/**` stays excluded by the matcher (as today), so the chunked upload endpoints
  (`/api/admin/media/uploads/**`), private-file downloads (`/api/admin/files/**`), preview switches and cron endpoints
  (`/api/internal/**`) are never buffered or truncated by it; `/media/**` (media delivery) and `/_next/**` stay excluded
  too. These endpoints return no HTML, so they need no script nonce; they get **static** headers from `next.config`
  `headers()` (A2): `Cache-Control: no-store` (media delivery has its own immutable caching instead),
  `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox`.
- **Admin page headers** (set by the proxy's admin branch): the nonce CSP — proposed
  `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'nonce-{n}'; img-src 'self'
  blob: data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none';
  form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` (`frame-src 'self'` allows the same-origin
  preview frames; whether the admin UI needs inline `style` attributes, which nonces do not cover, is settled in A2
  — preferably none) — plus `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: same-origin`,
  `X-Content-Type-Options: nosniff`, `Permissions-Policy` (camera, microphone, geolocation off). Dynamic pages already
  answer `Cache-Control: private, no-cache, no-store, …`; A2 verifies that every admin response carries `no-store`.
  Every admin page also has `robots: noindex, nofollow` metadata.
- **Authentication everywhere** except `/admin/login`, `/admin/reset/*`, `/admin/invite/*` (and `/admin/setup` in the
  fallback) — enforced server-side in each page, action and handler (§2.1).
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
  the public host (verified on the host before staging). Body limit stays at the default 1 MB (files never go through
  actions), well below what the proxy buffers for admin page requests (§4).
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
Summarized from [A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md): Route Handler under `/api/admin/…`, outside the proxy
(§4); session, permission, Origin
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
`.env` outside the release; never in the repository, the deployment archive, database or media backups, or
documentation):

| Variable | Purpose | Phase |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or `DB_SOCKET_PATH`) | MariaDB connection | A2 |
| `DB_POOL_LIMIT` | connections per Node process — **production default 2** until the account is measured (A1-DATABASE-SCHEMA §4.2) | A2 |
| `CONTENT_SOURCE` | `static` (public site from the TypeScript modules — production until the A9 cutover) or `database` | A3 / A9 |
| `CACHE_SYNC_INTERVAL_MS` | how old the shared invalidation state may be when a cached page is served: default **0** (read for every request); a larger value is a documented propagation delay and an Owner decision (A1-PUBLISHING-VERSIONS §8.2) | A3 |
| `RAWASY_DATA_DIR` | persistent storage root | A3/A4 |
| `AUTH_ENCRYPTION_KEY` | active AES-256-GCM key for TOTP secrets (base64, 32 bytes) | A2 |
| `AUTH_ENCRYPTION_KEY_VERSION` | the active key's version number (stored with every encrypted row) | A2 |
| `AUTH_ENCRYPTION_RETIRED_KEYS` | previous key versions, only while rows or retained backups still need them (§12.2) | A2 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | stable Server Actions key across processes and releases | A2 |
| `TRUSTED_PROXY_HOPS` | how many `X-Forwarded-For` entries the host adds (default 1) | A2 |
| `CRON_SECRET` | authenticates cron calls to `/api/internal/*` | A3/A8 |
| `ADMIN_BOOTSTRAP_TOKEN` | fallback bootstrap only; unset otherwise | A2 |
| `APP_ENV` | `local` · `staging` · `production` (banners, safety guards) | A2 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | outgoing mail | A2 (reset mail) / A7 |
| `BACKUP_ENCRYPTION_RECIPIENT` | public key (fingerprint) used to encrypt backups, if backups are encrypted; the private key never sits on the server | A8 (decision) |
| `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET` | optional CAPTCHA | A7 (decision) |
| `NEXT_PUBLIC_SITE_URL` | public origin (exists today) | — |

`AUTH_PEPPER` is not used (§3.2). Database dumps read credentials from `~/.my.cnf` (mode `0600`), never from a command
line. The A1 documents contain no credential or key values; the Owner is never asked to put production credentials in
source control.

### 12.1 Two kinds of secrets

Database and media backups do not contain secrets — so some secrets must be recoverable **separately**, or the data
they protect is lost even when the backups are perfect.

| Secret | Kind | If lost | If leaked | Offline escrow |
|---|---|---|---|---|
| `AUTH_ENCRYPTION_KEY` and every retired version still needed | **recovery-critical** | encrypted TOTP secrets cannot be decrypted → emergency 2FA reset (§12.4) | together with a database copy, TOTP secrets can be decrypted → rotate (§12.2), revoke sessions, ask users to re-enrol 2FA | **yes** — at least two offline copies outside the hosting account |
| Backup decryption key (only if backups are encrypted) | **recovery-critical** | encrypted backups are unusable | backups readable by whoever holds them | **yes** — the Owner's offline store, never on the server |
| `AUTH_PEPPER` (not used; only if ever enabled) | would be recovery-critical | every password unverifiable → mass reset | weaker protection of stolen hashes | would be required before enabling |
| `DB_PASSWORD` | replaceable | set a new one in cPanel | rotate in cPanel and in the app's environment | no |
| `SMTP_PASSWORD` | replaceable | reset the mailbox password | rotate | no |
| `CRON_SECRET` | replaceable | generate a new one; update the cron command | rotate | no |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | replaceable | generate a new one (open admin tabs must reload) | rotate | no |
| `.next` build secrets (draft-mode id, closure key) | replaceable per build | rebuild | rebuild with `.next/cache/.previewinfo` deleted | no |
| `ADMIN_BOOTSTRAP_TOKEN` | one-time | — | unset; it works only while no Owner exists | no |
| `CAPTCHA_SECRET` | replaceable | re-issue | rotate | no |

Sessions, reset tokens and recovery codes are not environment secrets: they live in the database only as hashes, and
any of them can be revoked at once.

**Escrow** (Owner decision on the medium; proposed: an encrypted entry in the Owner's password manager plus a sealed
paper or offline-drive copy kept at a different place). Never in Git, never in the database, never in database or
media backups, never in email or chat. The escrow record states each key's version and creation date, and when a
retired version may be destroyed.

### 12.2 `AUTH_ENCRYPTION_KEY`: versions and rotation

- Every encrypted value records the version of the key that encrypted it (`user_mfa.key_version`); the app holds the
  active key (`AUTH_ENCRYPTION_KEY` + `AUTH_ENCRYPTION_KEY_VERSION`) and, during and after a rotation, the retired
  versions still needed (`AUTH_ENCRYPTION_RETIRED_KEYS`). It encrypts only with the active key and decrypts with the
  version a row names.
- **Rotation** (Owner, server CLI, audited with `actor_type = 'cli'`):
  1. generate the new key on the server or the Owner's computer and put it **into escrow first**;
  2. move the current key to the retired set, make the new key active with version + 1, restart the app;
  3. run the re-encryption command: every row with an older version is decrypted with its version and encrypted with
     the active one, in batches, each batch in its own transaction;
  4. verify that no row still uses an older version.
- **Retention of retired keys:** a retired version stays in escrow until **both** no row uses it **and** every
  retained backup that may contain rows encrypted with it has expired or been superseded (the longest backup retention
  — proposed 6 monthly copies, plus any off-site copies). Only then is it destroyed, and the destruction date is
  recorded. It may leave the app's environment as soon as no live row uses it.
- Rotate on suspicion of leak, when a person who knew it leaves, and at least yearly (proposed).

### 12.3 Disaster restore (secrets part)

1. Restore the database and the media from backups (A1-ARCHITECTURE §11), decrypting them first with the escrowed
   backup key if backups are encrypted; in database mode set a new cache epoch so that no page cached before the
   restore is served (A1-PUBLISHING-VERSIONS §8.2).
2. Restore the recovery-critical secrets from escrow: the active `AUTH_ENCRYPTION_KEY` and every retired version that
   rows in the restored database reference (check with a query on `user_mfa.key_version`).
3. Issue **new** replaceable secrets: database password, SMTP password, `CRON_SECRET`,
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; rebuild with `.next/cache/.previewinfo` deleted.
4. Revoke every session and unused reset token (they are excluded from dumps; this also covers a partial restore).
5. Verify: an Owner sign-in with 2FA, a TOTP check for each user on next sign-in, the audit log continues.
6. If the restored rows reference a key version that cannot be found, follow §12.4 for those users.

### 12.4 Emergency 2FA reset (key irrecoverably lost)

- Run from the server only (CLI over SSH or cPanel Terminal — access to the hosting account is the proof of authority;
  that access is a pre-staging requirement, A1-ARCHITECTURE §7.3): `admin-2fa-reset --all` (or `--user <email>`).
- It deletes the affected `user_mfa` and `user_recovery_codes` rows (they can no longer be read), revokes every session
  of those users, sends each of them a password-reset link (so re-enrolment requires proof of control of the account
  email), generates and escrows a new `AUTH_ENCRYPTION_KEY` version, and writes an audit event.
- At next sign-in each user sets a new password and enrols 2FA again (required at once for roles where 2FA is enforced).
- The Owner's own account can be recovered the same way (`admin-bootstrap.mjs --reset`, §3.9).

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
Revoke all sessions (one SQL statement or an Owner action); rotate `AUTH_ENCRYPTION_KEY` with the versioned procedure
(§12.2: escrow first, re-encrypt, keep the retired version as long as backups need it); issue new
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `CRON_SECRET`, database and SMTP passwords; review the audit log for the period;
restore content from revisions or a backup (§12.3 for the secrets); rebuild and redeploy (new draft-mode value).

## 16. Tests the later phases must include
Permission matrix as table-driven tests (each role × each permission, allowed and denied); every Server Action and
mutating route rejects an anonymous call, a wrong role, a cross-origin call and a stale `lock_version`; session expiry,
rotation and revocation; lockout and enumeration resistance; preview without an admin session shows published data;
private items never reachable through `/media/u`, `/_next/image` or any public page; uploads with a wrong signature,
oversize, oversize pixels, path tricks; draft content absent from every public response.
