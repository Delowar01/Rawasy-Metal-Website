# Admin / CMS program — Phase A1: architecture, database and content-model specification

Date: 2026-10-09 · Branch: `claude/new-session-5eijs6` · Brief: "ADMIN / CMS PROGRAM — PHASE A1 — ARCHITECTURE, DATABASE &
CONTENT-MODEL SPECIFICATION — LOCKED ROADMAP — DESIGN ONLY".

## Summary and status

Phase A1 is complete as a **design-only** deliverable. Seven specification documents are in `docs/admin/`. Together they
specify how every visible part of the public website becomes manageable from `/admin` without redesigning it:
- the system architecture, a database schema of 83 tables with generated ERDs, the content and block model, and the
  migration plan;
- security and roles, media storage, publishing, versions, preview and caching.

The specification rests on research into four areas: the installed Next.js 16.3.8 source, the published Drizzle and
mysql2 packages, MariaDB, and the Namecheap hosting model. The preferred stack (MariaDB + Drizzle ORM + mysql2) is
recommended, with six documented constraints; none requires replacing it.

Two findings change the design materially, and the Owner should know them:
1. **Next.js 16.3.8 keeps cache invalidations in the memory of one process only.** Several or restarted processes would
   keep serving old pages after a publish. A3 therefore adds a custom cache handler backed by a shared
   `cache_invalidations` table.
2. **Drizzle's relational query API and `drizzle-kit push`/`pull` do not work on MariaDB.** The design uses only the core
   query builder and reviewed, generated migrations.

Nothing was implemented, installed, migrated or deployed. The product, configuration, dependency and test files are
byte-identical to `74220ea`.

**A1 STATUS: READY FOR INDEPENDENT REVIEW** (not self-approved).

## Report items

### 1. Starting SHA
`74220ea96abebd381a4bfdd2d764309ac084c383`, the expected approved HEAD. It was checked before any change: local HEAD =
`origin/claude/new-session-5eijs6` = `74220ea`, and the working tree was clean.

### 2. Preservation checkpoint
GitHub branch `preserve/pre-admin-a1` was created and pushed at exactly `74220ea96abebd381a4bfdd2d764309ac084c383`, with
no force push; it did not exist before. `git ls-remote` after the work still shows it at `74220ea`.

### 3. Final branch HEAD
Two commits sit on top of `74220ea`:
- `48684af69e4df195cf385ff8eda743c313d1248d`: the seven specification documents, pushed.
- The commit that adds this report and the CLAUDE.md update; its hash is given in the hand-over message.

`main` was not touched.

### 4. Files changed
Added:
- `docs/admin/A1-ARCHITECTURE.md`
- `docs/admin/A1-DATABASE-SCHEMA.md`
- `docs/admin/A1-CONTENT-MODEL.md`
- `docs/admin/A1-MIGRATION-PLAN.md`
- `docs/admin/A1-SECURITY-RBAC.md`
- `docs/admin/A1-MEDIA-STORAGE.md`
- `docs/admin/A1-PUBLISHING-VERSIONS.md`
- `docs/reports/2026-10-09-admin-a1-architecture.md`

Modified: `CLAUDE.md` (project memory: latest report and the A1 status).

Nothing else changed. `src/`, `public/`, `server.js`, `package.json`, `package-lock.json`, `next.config.ts`,
`tsconfig.json`, `playwright.config.ts`, `.env.example`, `scripts/package-namecheap.mjs`, `scripts/warm-images.mjs` and
`e2e/` are byte-identical to `74220ea`: `git diff 74220ea HEAD` on those paths is empty, and the lockfile SHA-256 is
unchanged.

### 5. Locked roadmap confirmation
The roadmap is confirmed as locked:
- **A1** Architecture & Database Foundation
- **A2** Authentication, RBAC & Admin Shell
- **A3** Core CMS
- **A4** Media Library
- **A5** Page Builder / Visual Editor
- **A6** Global Site Controls
- **A7** Forms & Enquiries
- **A8** Publishing, Versions, Audit & Backup Safety
- **A9** Full Content Migration & Complete QA

A1-ARCHITECTURE §1 maps every part of the design to its phase. No phase is merged, reordered, skipped or expanded.

Three dependencies are listed openly as the minimum an earlier phase needs, not as a scope change:
- A3 creates the media *registry* tables, the `redirects` table (automatic redirects on a slug change) and
  `cache_invalidations`.
- A2 creates `audit_events`.

One question is put to the Owner instead of being decided: whether the public site switches to the database domain by
domain or all at once in A9 (item 30, T1).

### 6. Public visual-baseline rule
Confirmed: admin development does not redesign the public site.
- A1–A4 change only where the data comes from.
- Every approved section becomes a **bespoke block type** that feeds the existing component the same data.
- The service pages' `looks.ts` variants become the same enumerated settings.
- In A3 the sections are structure-locked.
- Every domain switch is proven with the project's freeze-proof method: visible HTML, resolved RSC, CSS, JS module sets,
  screenshots in EN/AR × light/dark, the 612-test E2E suite, and identical sitemap, SEO and structured data.

No generic CMS theme or page-builder markup reaches the approved pages (A1-CONTENT-MODEL §1, §5.3; A1-MIGRATION-PLAN
§1, §8).

### 7. Proposed architecture
Full design: A1-ARCHITECTURE §4–§6.

**The app (one Next.js application on `server.js`):**
- Public routes read only a **published read model**: `published_documents` (the public projection of each live
  aggregate), `public_media` and `redirects`, through tagged, cached functions.
- `/admin` runs in its own route group with its own root layout.
- Mutations go through Server Actions, plus Route Handlers for uploads, files, preview, media delivery and the cron
  endpoint.

**Behind it:** a server-only data-access layer (sessions, RBAC, Zod validation, domain services, audit), MariaDB, and
persistent file storage in `~/rawasy-data` outside the release.

**Rendering:**
- Pages render at runtime on first request and are then cached (ISR). The build machine has no production database, and
  Namecheap disables remote MySQL.
- A custom cache handler shares invalidations across processes.
- A page warm-up runs after each release.

### 8. Database recommendation
MariaDB, as hosted. Namecheap's knowledgebase lists **MariaDB 11.4.9** for the Stellar plans; this was seen through
search extracts and must be verified on the account.

**Character set and collation:**
- `utf8mb4` everywhere, declared explicitly; the server default is `latin1` before MariaDB 11.6.
- Collation **`utf8mb4_unicode_520_ci`**, chosen because:
  - dumps are portable between MariaDB and MySQL;
  - Arabic diacritics are ignored at primary strength;
  - it can be requested in mysql2's handshake.
- Arabic search additionally uses application-level normalization: alef forms, ta marbuta, alef maqsura, tatweel and
  digits, none of which the collation folds.
- `ascii_bin` for ULIDs, slugs, keys and paths.

**Time and ids:**
- `DATETIME(3)` in UTC, with `time_zone = '+00:00'` set on each connection; display in Asia/Riyadh.
- ULID ids for entities, `BIGINT` for logs.

Details in A1-DATABASE-SCHEMA §1–§3.

### 9. ORM recommendation
**Drizzle ORM, core query builder only**, with schema changes via `drizzle-kit generate`, reviewed SQL and the runtime
migrator.

Constraints, all verified in the published 0.45.4 / 0.31.11 / 3.24.5 package sources:
- **(1) Relational queries emit `LEFT JOIN LATERAL`, which MariaDB lacks.** `db.query` is therefore forbidden by a lint
  rule. This also survives the Drizzle 1.0 upgrade.
- **(2) `push`/`pull` crash on MariaDB.** They are never used.
- **(3) The migrator skips out-of-order files, is not atomic and takes no lock.** A wrapper CLI adds a backup check,
  `GET_LOCK`, journal-order and applied-file hash checks, and one DDL statement per file.
- **(4) Drizzle cannot declare collations.** Table options are added in review and checked in CI.
- **(5) JSON parsing depends on MariaDB ≥ 10.5 and mysql2 ≥ 3.23.** A defensive JSON type plus Zod covers it.
- **(6) mysql2 lacks MariaDB's ed25519/PARSEC authentication plugins.** The database user uses `mysql_native_password`.

**Version pins:**
- `drizzle-orm` ≥ 0.45.2, which carries an SQL-injection fix in identifier escaping.
- `mysql2` ≥ 3.23.0.
- Drizzle 1.0 (still a release candidate) is not adopted.
- Exact pins are chosen in A2.

**Alternatives** (Kysely, Prisma, raw mysql2) are recorded in A1-DATABASE-SCHEMA §1.

### 10. Database connection strategy
- One mysql2 pool per Node process, kept on `globalThis`.
- Settings: `connectionLimit` 4 (`DB_POOL_LIMIT`), `maxIdle` 1 (otherwise idle connections never close), `idleTimeout`
  30 s, `queueLimit` 50, keep-alive, `charset: utf8mb4_unicode_520_ci`, `timezone: 'Z'`, `multipleStatements: false`,
  `maxPreparedStatements` 64.
- On each new connection: `SET time_zone = '+00:00'` and a strict `sql_mode`.
- Budget: ≤ 4 per process × up to 4 processes, within a reported 30-connection user limit, leaving room for the CLI,
  backups and phpMyAdmin.
- Transactions use pooled connections with savepoints for nested work.
- No database access during `next build` (guarded by `NEXT_PHASE`).
- Proposed: a SIGTERM handler that closes the pool. It would change `server.js`, so it is an Owner decision.

Details in A1-DATABASE-SCHEMA §4.

### 11. Localization model
- A `locales` table: `en` (default) and `ar` (RTL, `ar-SA`). A new language is a row, not a schema change.
- Per-entity `*_translations` tables keyed `(id, locale)`, with typed, independent fields.
- A translation status per row: draft, complete, or needs review. The admin shows statuses such as "EN Complete / AR
  Missing", and editing one language flags the others for review in both directions.
- Publication requires every required locale to be complete. There is no automatic fallback and no machine
  translation.
- One ASCII slug per aggregate, shared by both languages, exactly as today.

Details in A1-CONTENT-MODEL §3.

### 12. Page model
**Page types:**
- `home`
- `system`: about, services, capabilities, projects, industries, clients, certificates, contact, 404
- `legal`: privacy, terms, which require legal review
- `template`: the project-detail layout and the default sections for a new service
- `generic`: owner-created pages at `/{locale}/{slug}`

**Generic pages** render without new source files through the existing catch-all:
- Static routes always win.
- The catch-all looks up a published page, then an active redirect, then shows the localized 404.
- The slug validator rejects reserved words.

Service detail pages keep their sections inside the service aggregate. Every current address is kept.

Details in A1-CONTENT-MODEL §4.

### 13. Block / page-builder model
A **hybrid** model:
- A relational section skeleton holds identity, owner, position, visibility per device, structure lock, anchor and
  reusable-block link.
- Each block type adds **validated, versioned JSON**: `settings`, plus `content` per locale.
- Block types are defined in a code registry with Zod schemas, projections, upcasters and renderer mappings, so a new
  block type needs no migration and nothing unvalidated reaches a page.
- Repeated items use stable ids, so English and Arabic never misalign.
- Selections can be manual or automatic.
- Reusable (global) blocks can be linked or detached.

**Block families:**
- **Bespoke:** every section of the approved pages, in A3.
- **Generic:** the brief's list of about 28 blocks, in A5.

The A5 inspector edits token references and enumerations only:
- typography, layout, appearance;
- responsive overrides for desktop, tablet and mobile;
- motion presets mapped onto the existing motion system: no fading words, reduced motion respected, contrast checked.

Details in A1-CONTENT-MODEL §5–§6.

### 14. Media model
- **Stable ids** (`media_assets`) with file versions (`media_files`), variants, and EN/AR alt text, captions and titles.
- **Folders, focal point, rights fields and provenance.**
- **Visibility (public or private), usage status (pending review, approved, restricted, internal, archived) and
  flags.** Blocking flags are defined in code, and unknown flags block.
- **One deliverability rule**, materialized in `public_media`.
- **Three independent safeguards** ensure an editor's selection never publishes a restricted item: a publication gate, a
  projection filter and a delivery check.
- Usage tracking via `content_references`, plus delete protection.
- Replacement keeps the id.

Details in A1-MEDIA-STORAGE §3–§4, §11.

### 15. Persistent storage model
**Location:** `RAWASY_DATA_DIR`, for example `/home/<user>/rawasy-data`, outside the release and `public_html`:
- `media/originals/`: never served publicly;
- `media/derived/`: content-hashed variants, served only when deliverable;
- `media/private/`: a separate root;
- `enquiries/`, `tmp/uploads/` and `backups/`.

**Permissions and paths:** 0700 directories and 0600 files; server-generated keys; resolved-path checks.

**Uploads** (A4):
- chunked 4 MB `PUT`s to a Route Handler outside the proxy;
- the file signature must match the extension;
- size and pixel limits;
- `sharp` processes one image at a time;
- WebP variants at 320–2048 px, never wider than the source.

**Delivery:** `/media/u/{id}/{variant}-{hash}.{ext}` with `nosniff` and immutable caching. Next 16.3.8 reads `public/`
only at start-up, so uploads can never be served from it.

**Today's 143 files stay where they are in A3.** As an A4 option they could be served at the same addresses from
persistent storage.

Details in A1-MEDIA-STORAGE §5–§8, §12.

### 16. Private document model
| | Private original | Public version |
|---|---|---|
| Media item | `visibility = private`, `usage_status = internal` | `visibility = public`, approved |
| Storage | the separate `private/` root | normal storage |
| Link | `certificate_documents.role = private_original` | separate redacted upload, approved |
| Who | download for `private_documents.view` (Owner) only, with step-up and an audited access | — |
| Headers | `no-store`, attachment | — |

- No public projection can include a private original.
- No "make public" action exists.
- A public file is never derived from a private one automatically.
- Separate upload buttons, badges and confirmations make mistakes hard.

The repository holds no originals today. Details in A1-MEDIA-STORAGE §9–§10.

### 17. SEO model
- **Per routable aggregate:** title and description per language, falling back to the title and summary as today; Open
  Graph and Twitter fields with fallbacks; a share image (the site default otherwise); robots index/follow; sitemap
  inclusion; a restricted canonical override.
- **Generated from published data with today's shapes:**
  - hreflang `en`/`ar`/`x-default`
  - the sitemap (102 addresses at migration)
  - structured data: Organization/LocalBusiness/WebSite, WebPage subtypes, BreadcrumbList, Service, ItemList
- Editors cannot type JSON-LD.
- **Slug changes** create 308 redirects when published, with conflict, chain and loop checks.
- **Redirects** are resolved only where a page would otherwise 404, never in the proxy.

Details in A1-CONTENT-MODEL §11.

### 18. Form / enquiry model
**Data:** forms, fields and copy tables. The quote form keeps its code-defined system fields, so the golden email,
WhatsApp and copy outputs stay exact.

**Delivery mode** `handoff | store | store_and_notify`. Migration sets `handoff`, which is today's behaviour.

**Enquiries:**
- Workflow NEW → CONTACTED → QUALIFIED → CLOSED, or SPAM, with history, notes and assignment.
- Spam protection: honeypot, timing token, database rate limits, and an optional CAPTCHA (an Owner decision).
- Notifications go through an outbox with cron retries.
- CSV export is Owner-only, step-up, audited and formula-safe.
- Retention via `retain_until`. The period is an Owner and legal decision, with Saudi PDPL review.
- File uploads are off by default.

**No dishonest period:** the privacy policy update is legally reviewed and published first; "received" is shown only
after the database commit; hand-off remains the fallback.

Details in A1-CONTENT-MODEL §14.

### 19. Publishing workflow
**Two state columns:**
- `publication_status`: unpublished, published or archived.
- `draft_status`: none, draft or in review.

These map to the brief's DRAFT / IN REVIEW / PUBLISHED / ARCHIVED, plus "Published · changes in draft/review",
Scheduled and Trash.

**Transitions:** 17 transitions with permissions and gates, and invalid transitions are rejected:
- strict validation: complete locales, live references, deliverable media, slugs, the digit guard, provenance for
  figures;
- a legal gate for Privacy and Terms;
- four-eyes review;
- an audited Owner override.

**Publish** is one transaction: revision, projection, redirects, references, invalidations and audit.

**Scheduling** runs from cron every 5 minutes through an authenticated internal endpoint.

**Removal:** unpublish, archive, Trash and purge, with impact checks.

Details in A1-PUBLISHING-VERSIONS §2–§7, §13.

### 20. Revisions
- **What a revision is:** an immutable full-aggregate JSON snapshot with a schema version and upcasters.
- **Kinds:** save, submit, publish, unpublish, archive, restore and import. All except save are sealed.
- **Operations:** compare (field-level, per language), preview any revision, and restore into the draft (never
  rewriting history).
- **History:** `live_from`/`live_until` answer "what was live on date X". This is used to record which privacy policy
  version an enquiry was submitted under.
- **Section-level change tracking** with "revert section". The page is the unit of publication.
- **Undo/redo** is a separate in-editor command history that is never stored.
- **Retention (proposed):** sealed revisions are kept; unsealed saves are pruned after 90 days, keeping the latest 20.

Details in A1-PUBLISHING-VERSIONS §9–§12.

### 21. Audit model
- **Table:** `audit_events`, append-only in the application, with an optional hash chain and, if the host allows them,
  triggers that block updates and deletes.
- **Each event records:** actor and roles at the time, session, request id, IP, action, entity, outcome (including
  denied attempts), a summary, before/after revision ids, and a redacted diff for changes without revisions.
- **Coverage:** sign-ins, every content transition, media approvals and restrictions, private-file access, exports,
  settings, backups and cache purges.
- **Never logged:** secrets.
- **Indexes:** time, entity, actor, action and request.
- **Retention:** 24 months proposed.
- **Access:** Owner can view and export; Admin can view.

Details in A1-SECURITY-RBAC §11.

### 22. RBAC
- **Roles:** Owner (100), Admin (80), Editor (40), Reviewer (30).
- **Permissions:** code-defined `resource.action` keys seeded from a full matrix covering users, roles, pages, legal
  pages, services, projects, machinery, industries, clients, certificates, private documents, media, menus, settings,
  theme, SEO, redirects, forms, enquiries, publish, restore, delete and purge, audit, backups and cache.
- **Rules:**
  - rank (nobody manages an equal or higher rank);
  - four eyes;
  - record-level checks;
  - permissions re-checked when a schedule runs;
  - the last Owner is protected.
- **Admin ≠ Owner.** Only the Owner manages Admins, security, theme, legal and certificate publication, private
  documents, enquiry export, backups, restores and purges.
- **Owner-decision defaults** are marked ⚑ in the matrix.

Details in A1-SECURITY-RBAC §5.

### 23. Backup / restore
**Database:** a nightly `mariadb-dump --single-transaction --quick …` (excluding the session and token tables), also run
before every migration and every release.

**Media:** nightly incremental and weekly full `tar` of originals, private files and enquiries; variants are
regenerated.

**Supporting rules:**
- naming with environment and UTC stamp, plus a SHA-256;
- credentials from `~/.my.cnf`;
- off-site copies;
- Namecheap AutoBackup kept as an extra layer (6 daily, 3 weekly, 5 monthly).

**Restore** is an Owner-only CLI procedure:
- uses the matching `mariadb` client;
- regenerates the derived data;
- revokes all sessions;
- runs a page warm-up.

Restores are rehearsed quarterly on staging. No backup job exists in A1.

Details in A1-ARCHITECTURE §11.

### 24. Migration strategy
**Schema:** generated and reviewed SQL, applied by a locked, backup-checked CLI on the server. It is forward-only,
uses expand/contract, never `push`, never edits production by hand, and treats seed data as migrations
(A1-DATABASE-SCHEMA §10).

**Content:** an idempotent import keyed by legacy keys, byte-exact text (invisible bidi marks included), published
through the normal pipeline with `import` revisions. The full mapping is in A1-MIGRATION-PLAN §4:
- every `src/content` module
- the dictionaries
- the SEO, navigation and route metadata
- the media registry
- the view rules hidden in components: the hero, workshop and closing photos, the engraving exclusion, `looks.ts`,
  `MACHINE_ORDER`, and the hard-coded street address in the structured data

**Restricted media:**
- The 13 held-back files map to restricted media with flags: 3 AI-watermark files, 3 authorship-unconfirmed photos,
  4 product-render photos, and the 3 Laser Engraving images.
- They are never public at any step, and the packaging script keeps excluding them.
- The 130 files shown today are imported as approved, so the site does not change.

**Proof and rollback:** each switched domain is proven with counts, deep-equal round trips, freeze proofs, SEO equality
and the full E2E suite. Rollback is a per-domain content-source switch until A9.

**Legal text** is copied verbatim and compared byte for byte.

### 25. Caching / revalidation
**Tags:**

| Tag | Covers |
|---|---|
| `doc:<type>:<id>` | one published aggregate |
| `type:<type>` | all aggregates of one type |
| `ordering:<key>` | one ordering |
| `menu:<key>` | one menu |
| `settings:site`, `settings:theme` | site settings and theme |
| `media` | media |
| `redirects` | redirects |
| `sitemap` | the sitemap |
| `site` | everything (emergency) |

**Invalidation:**
- Publish, unpublish, archive, media restriction and redirect changes **expire immediately**.
- The time-based safety net (1 h) uses stale-while-revalidate.

**Required by Next.js 16.3.8, as verified in its source:**
- tag invalidations live only in the memory of the process that received them;
- `revalidateTag` takes a second argument;
- revalidation cannot run outside a request.

**Hence:**
- the custom `cacheHandler` reads the shared `cache_invalidations` table;
- cron calls an internal endpoint;
- 404s are not cached (they would otherwise grow cache files against the 300,000-inode limit);
- the Next version is pinned and the handler re-tested on upgrade.

Details in A1-PUBLISHING-VERSIONS §8.

### 26. Preview architecture
- **Entering preview:** Next draft mode is enabled by an authenticated `POST`, which redirects to a server-computed
  address.
- **Who sees drafts:** working-copy data is returned only when draft mode **and** an admin session with `preview.use`
  are both present. The draft-mode cookie is a build-wide value, not an authorization.
- **Responses:** `private, no-store` and `noindex`.
- **Frames:** 1440 / 834 / 390 px, EN/AR, light/dark. The banner sits in the admin frame, never inside the page. Theme
  selection needs a draft-only parameter in the boot script (an A5 change, listed for review).
- **Revision preview** is supported.
- **Shareable links** are not proposed by default (an Owner decision).
- **Release procedure:** delete `.next/cache/.previewinfo` before each build, so each release gets a new draft-mode
  value.

Details in A1-PUBLISHING-VERSIONS §11.

### 27. Security controls
**Accounts and sign-in:**
- No public registration; invitations and a CLI bootstrap with a one-time setup link (no default password anywhere).
- Argon2id with a built-in scrypt fallback.
- Database sessions behind an `HttpOnly; Secure; SameSite=Strict` `__Host-` cookie that holds only a token whose hash is
  stored; rotation and idle/absolute timeouts.
- Step-up re-authentication.
- Database-backed throttling and lockout, with the IP taken from the right-most trusted `X-Forwarded-For` entry (the
  host rewrites the socket address to 127.0.0.1).
- Password reset and invitations through single-use hashed tokens.
- Optional TOTP with an encrypted secret and recovery codes.

**Requests:**
- Server Actions use the built-in Origin check. Route Handlers check Origin, `Sec-Fetch-Site` and a non-simple content
  type.
- A stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; `.next` and the archive are treated as secret.
- `/admin` is excluded from the proxy, carries `noindex` and `no-store`, has a strict CSP, and is never linked or listed.

**Content and files:**
- No code from content: plain text, tokens and a JSON rich-text model, with no HTML, CSS text, scripts or SQL;
  allowlisted URL schemes and embeds.
- Upload hardening.

**Data:** classified PUBLIC / ADMIN-ONLY / PRIVATE.

**Secrets:** environment variable names only; no credential in any document or file.

Details in A1-SECURITY-RBAC.

### 28. Shared-host constraints
| Constraint | Status |
|---|---|
| 2 GB memory, 30 entry processes | official extracts |
| 300,000 inodes | official extract |
| MariaDB 11.4.9 | official extract |
| No remote database | official extract |
| `max_user_connections` 30 | reported |
| Passenger gives Node one process | verified |
| LiteSpeed may spawn several Node processes | unknown which web server is used |
| App-level IP is 127.0.0.1 | verified |
| Cron every ≥ 5 minutes, ≤ 5 simultaneous | official extract |
| No daemons | official extract |
| Request limit unpublished; ModSecurity default 12.5 MiB | verified generic |
| Next's proxy truncates bodies over 10 MB | verified |
| Email 200 per hour | official extract |
| 10 GB fair-use cap for multimedia | official extract |
| glibc 2.28, exactly `sharp`'s minimum | inferred |

Each constraint has a design consequence (A1-ARCHITECTURE §7, §13). The Owner's verification checklist is in item 30
and A1-ARCHITECTURE §7.

### 29. Decision log

| Decision | Alternatives | Choice | Why | Risks | Reversibility | Owner decision? |
|---|---|---|---|---|---|---|
| Database engine | MySQL 8, PostgreSQL, SQLite | MariaDB as hosted (11.4 listed) | it is what the plan provides; portable SQL | version unverified | medium (portable collation) | verify host |
| ORM | Drizzle relational API, Kysely, Prisma, raw mysql2 | Drizzle core builder + generate/migrate | brief's preference; typed; light | MariaDB gaps (item 9) | medium | no (informed) |
| Driver and pool | MariaDB connector | mysql2 pool per process, limit 4 | Drizzle supports mysql2; small budget | user connection limit | easy (config) | no |
| Collation | `uca1400_ai_ci`, `general_ci`, `0900_ai_ci` | `utf8mb4_unicode_520_ci` | portable; ignores diacritics; handshake-capable | no alef folding (app normalization) | hard (convert tables) | optional |
| IDs | auto-increment, UUID v4/v7 | ULID `CHAR(26)` (logs: BIGINT) | app-generated, sortable, portable, readable | 26-byte keys | hard | no |
| Localization | columns per language, JSON per field, EAV | translation tables + status | typed; new language = data | more joins | hard | no |
| Slugs | per-language (Arabic) slugs | one shared ASCII slug | today's URLs and language switch | none new | medium | optional |
| Block model | table per block, free JSON | relational skeleton + validated versioned JSON | no migration per block type; validated | schema evolution (upcasters) | medium | no |
| Existing pages | rebuild with generic blocks | bespoke locked blocks (A3) | keeps the approved design exactly | slower flexibility | easy (unlock in A5) | yes (A5 unlock) |
| Publication | status on live rows, draft/published row pairs, event sourcing | working copy + revisions + published projection | drafts cannot leak; instant unpublish | dual representation | hard | no |
| Revisions | deltas, event sourcing | full snapshots + pruning of unsealed saves | simple restore/compare | storage (small) | medium | retention |
| Review rules | strict review for all | reviewer publishes reviewed items; Admin may publish directly | small team, four eyes kept | — | easy | yes |
| When the site reads the database | all in A9 | per domain as phases land (Option A) | smaller proofs; earlier value | two sources meanwhile | easy (switch) | **yes** |
| Rendering | build-time prerender with DB, content snapshot, build on server | runtime ISR + warm-up | no DB at build; host limits | first-hit latency | medium | no |
| Cross-process cache | single process, `cacheMaxMemorySize: 0` | custom cache handler + `cache_invalidations` | correct with several or restarted processes | Next internals → pin + test | medium | no |
| Media storage | `public/`, `public_html` | persistent store outside release, DB-gated route | survives releases; instant withdrawal; `public/` read at start-up only | disk/inode limits | medium | A4 option |
| Image variants | runtime optimizer | pre-generated variants for uploads | no runtime CPU, no cold-image defect | more files | medium | A9 option |
| Private documents | flag only | separate private storage + locked role | cannot be published by mistake | — | hard | who may view |
| Auth/session | stateless JWT, hosted auth | database sessions + `__Host-` cookie, Argon2id | revocable, auditable, no third party | implementation care | medium | 2FA, lifetimes |
| Preview | separate preview renderer, shareable tokens | draft mode + admin session | real components, no leak | build-wide cookie (rotated per release) | easy | shareable links |
| Mutations | REST-only, tRPC | Server Actions + Route Handlers | built-in Origin check; uploads need streams | action ids change per deploy | medium | no |
| Validation | Valibot, hand-written | Zod (pinned in A2) | server-side, shared schemas | dependency | easy | no |
| Forms | dynamic form builder | code-defined system fields, editable copy; hand-off default; storage gated | golden outputs; legal honesty | — | easy | several (item 30) |
| Search | FULLTEXT first, external engine | normalized `LIKE` | small data; Arabic normalization | none at this size | easy | no |
| Backup | AutoBackup only | dumps + incremental media + off-site + AutoBackup | own restorable copies | storage fair use | easy | retention, destination |
| Scheduling | in-process timers | cron (5 min) → internal endpoint | no daemons; caches invalidated in-process | ≤ 5 min delay | easy | no |
| Redirects | proxy lookup, `next.config` redirects | lookup only on the 404 path | no DB read per request | two hops for unprefixed URLs | easy | no |
| Rich text | sanitized HTML, Markdown | JSON document model | no HTML injection surface | editor work | medium | no |
| SVG uploads | sanitize | not accepted (A4) | script risk | logos as PNG/WebP | easy | later |
| Audit | DB triggers only | app append-only + optional hash chain/triggers | works on shared hosting | app-level only | easy | retention |

### 30. Owner decisions still required

**Technical** (recommendations given; each needs the Owner's yes or no):

| # | Decision | Recommendation |
|---|---|---|
| T1 | When the public site reads the database | **Option A**, domain by domain from A3 (A1-MIGRATION-PLAN §3) |
| T2 | May Admins publish without review? | yes |
| T3 | May Reviewers publish what they reviewed? | yes, never their own submissions |
| T4 | Enforce 2FA | yes for Owner and Admin |
| T5 | Session lifetimes | idle 2 h, absolute 12 h, no remember-me |
| T6 | A staging app on the same account | yes; shares the account's limits |
| T7 | A4: serve today's media at the same addresses from persistent storage | yes |
| T8 | A9: replace the runtime image optimizer with pre-generated variants | yes, after a pixel-parity proof |
| T9 | Change `server.js` to add graceful shutdown (SIGTERM → `app.close()` → pool end) | yes; `server.js` is frozen until approved |
| T10 | `next.config.ts` additions over A2–A4: `serverExternalPackages: ['mysql2']`, `cacheHandler`, admin headers, `images.localPatterns` | yes |
| T11 | Additive public security headers: `nosniff`, Referrer-Policy, Permissions-Policy, and HSTS after HTTPS is confirmed | optional |
| T12 | Collation | `unicode_520_ci` (portable) rather than `uca1400_ai_ci` |
| T13 | Third-party breached-password check | not proposed |
| T14 | Shareable preview links | not proposed |
| T15 | Admin interface language | English first; Arabic admin later? |
| T16 | Retention defaults | revisions: 90 days / latest 20 unsealed; Trash: 30 days; audit: 24 months; login attempts: 90 days |
| T17 | Backups | retention, off-site destination, encryption |
| T18 | CAPTCHA provider | none |
| T19 | Continuous integration | none today; recommended from A2 |

**Business / content** (RAWASY decides; nothing is invented):

| # | Decision |
|---|---|
| B1 | Who may see, manage and export enquiries (default Owner and Admin view; Owner exports) |
| B2 | Who may upload and view private certificate originals (default Owner only) |
| B3 | Certificate publication (default Owner only) |
| B4 | When to store enquiries instead of hand-off: needs a legally reviewed privacy policy update first, plus the retention period, notification recipients, and whether visitors may upload files |
| B5 | The legal review process and reviewer for Privacy and Terms; the open "Pending confirmation" notes |
| B6 | The open media questions of `docs/ASSET_INVENTORY.md`: image rights of service photos, authorship, renders, the Laser Engraving photographs (item 12), AI-watermarked files; whether any image shown today should become restricted |
| B7 | `src/content/process.ts` (six steps no page shows): keep as an unpublished global block, or drop |
| B8 | Which sections may be reordered, hidden or added in A5, page by page |
| B9 | Whether generic pages need nesting |
| B10 | Arabic slugs (not proposed) |
| B11 | RAWASY's Google Maps place link; a domain email address (asset inventory item 10) |
| B12 | Showing client website links (not shown today) |
| B13 | The first Owner's email and the initial Admin, Editor and Reviewer accounts |
| B14 | Whether theme tokens may be edited at all after launch (the Theme area starts empty) |
| B15 | The renewed licence (asset inventory item 5) |

**The Owner's checklist on the hosting account before A2:**
- [ ] Which web server is used: `curl -sI` and read the `server` header.
- [ ] The resource-limit values.
- [ ] SSH enabled.
- [ ] `ldd --version`, `mariadb --version`, `mariadb-dump` present.
- [ ] In phpMyAdmin: the version and `max_user_connections`, `wait_timeout`, character set and collation, `time_zone`,
  `sql_mode`; the user's authentication plugin and grants (`LOCK TABLES`, `TRIGGER`).
- [ ] Upload tests at 5 / 12 / 15 / 20 MB.
- [ ] Idle behaviour of the app.
- [ ] A 5-minute cron running a Node script.
- [ ] A test restore from AutoBackup.
- [ ] A test email, and SPF/DKIM.

### 31. Risks and open issues
1. **Hosting facts unverified.** Namecheap's site and docs were not reachable from the A1 environment; their facts come
   from search extracts. Mitigation: the checklist above before A2.
2. **Unknown web server (LiteSpeed or Apache/Passenger), so the process model is unknown.** The design assumes several
   processes and frequent restarts either way.
3. **The custom cache handler depends on a Next.js internal module.** Mitigation: Next pinned, plus a two-process test
   on every upgrade. Docs and source disagree in places (closure-key rotation, preview-id rotation, atomic cache
   writes); the design follows the source.
4. **Drizzle on MariaDB:** the relational API, push/pull and the migrator's weaknesses are mitigated (item 9). Drizzle
   1.0 will need a planned upgrade.
5. **Upload body limit unknown.** 4 MB chunks, and testing on the host.
6. **`sharp` memory against the 2 GB limit.** One image at a time and pixel limits, with processing moved to cron if
   needed.
7. **Runtime rendering after a release:** the first hit per page renders. Page warm-up.
8. **Restricting a release-bundled image is not instant at its direct address until the A4 option.** It disappears from
   pages at once, but the file stays until the next release, and optimizer copies last up to 4 h.
9. **Build secrets travel in `.next`.** The draft-mode value is reused for 14 days, and the Server Actions key is
   embedded. Mitigation: rotation in the release procedure; treat the archive as secret.
10. **`after()` callbacks can be lost when the host stops a process.** The outbox and cron retries cover this.
11. **Existing issue:** today every unknown `/…/services/<slug>` or `/…/projects/<slug>` address writes route-cache files
    (CLAUDE.md gotcha), so crawlers could grow inodes. The A3 handler stops caching 404s; until then the risk exists on
    the current site.
12. **Legal couplings.** The privacy policy states the form stores nothing, and lists only the visitor cookies. Storing
    enquiries, and possibly the staff-only admin cookies, need legal review before going live. A1 changed no legal text.
13. **Storage growth** against the 10 GB multimedia fair use and the 300,000 inodes. Optional downscaling, few variants,
    off-site backups.
14. **The E2E oracle changes when the static modules retire (A9).** Frozen fixtures seed the test database.
15. **`drizzle-orm` 0.45.4 is one day old.** Pin a release that has been public for two weeks (≥ 0.45.2).
16. **Operational ownership.** Backups, migrations and restores become recurring duties. The Owner must keep off-site
    copies.

### 32. Confirmation: no admin or product implementation
None of the following were done:
- No `/admin` route, authentication, database, table or migration file was created.
- No ORM, driver or other dependency was installed, and no lockfile changed.
- No content was migrated; no content file was replaced or edited.
- No legal text was edited.
- No public UI was changed.

The only repository changes are the eight Markdown files and `CLAUDE.md`. For research, the Drizzle, drizzle-kit,
mysql2 and mermaid packages were downloaded with `npm pack` into a scratch folder outside the repository and read as
files. mermaid was loaded only in a headless browser to check that the diagrams render. Nothing was installed into the
project.

### 33. Confirmation: nothing deployed
Not done:
- No upload to Namecheap; no cPanel, DNS, nameserver or SSL change.
- No external publication.
- `main` not fast-forwarded.

The work exists only on the branch `claude/new-session-5eijs6` (and the checkpoint `preserve/pre-admin-a1`).

## QA actually run

| Check | Result |
|---|---|
| Preflight: HEAD and origin `74220ea`, tree clean, checkpoint branch absent | passed; checkpoint created at `74220ea` |
| Baseline `npm run lint` / `npm run typecheck` (before) | exit 0 / exit 0 |
| Baseline build of `74220ea` in a scratch clone (to read the route table) | 109 / 109 static pages; route types recorded |
| Content inventory script (scratch, read-only imports of `src/content`) | 20 modules; 1,220 EN/AR pairs (53,814 / 44,266 characters); 143 media; 34 projects (27 showcased, 7 without photos, 8 flagged); 13 held-back files recomputed from the code |
| Schema specification consistency (scratch generator) | 83 tables, no duplicate names, every foreign key targets a defined table; 18 translation tables; 14 aggregate roots |
| Mermaid diagrams rendered with mermaid 11.12.2 in headless Chromium (scratch) | 11 / 11 render (9 ERDs, 1 state diagram, 1 architecture flowchart) |
| `git status` / `git diff --stat` after writing | only `docs/admin/` (then this report and `CLAUDE.md`); every frozen path identical to `74220ea`; lockfile SHA-256 identical |
| `npm run lint` / `npm run typecheck` (after) | exit 0 / exit 0 |
| Full E2E suite | **not run**: no product, configuration or test file changed (the brief does not require it in that case) |
| Production build after the change | **not run**: documentation only |

## How the research was done
Four read-only research passes fed the documents:
- **Next.js 16.3.8:** the installed documentation and source: caching, revalidation, multi-process behaviour, draft mode,
  Server Actions, CSRF, Route Handlers, proxy, image optimizer, cookies.
- **Database stack:** the published `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11 and `mysql2` 3.24.5 sources (downloaded
  to scratch and read, not executed), the MariaDB documentation and server source, and the Unicode collation data.
- **Hosting:** Namecheap and its stack. Namecheap pages were seen only through search extracts; the CloudLinux, Phusion
  Passenger, MariaDB and ModSecurity sources were read in their official repositories.
- Claims carry their verification level in A1-ARCHITECTURE §7. The Next docs and source disagree on three points (item
  31.3); the design follows the source.

## How to read and verify
- Start with `docs/admin/A1-ARCHITECTURE.md`; each document links the others.
- The schema's table catalogue and ERDs are generated from one specification, so they match each other. GitHub renders
  the Mermaid diagrams.
- To check that nothing else changed:
  - `git diff --stat 74220ea HEAD` lists only the docs and `CLAUDE.md`;
  - `git diff 74220ea HEAD -- src public server.js package.json package-lock.json next.config.ts tsconfig.json
    playwright.config.ts .env.example scripts e2e` is empty.

## Next steps (after independent review)
1. Independent review of A1, then the Owner's decisions in item 30 (T1 first) and the hosting checklist.
2. A2 only after the Owner's go-ahead.
3. Do not start A2, create authentication, create database tables, install Drizzle or mysql2, implement `/admin`,
   migrate content or deploy until then.

**A1 STATUS: READY FOR INDEPENDENT REVIEW**
