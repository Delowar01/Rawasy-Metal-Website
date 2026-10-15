# Admin / CMS program — Phase A3: Core CMS

Date: 2026-10-15 · Branch: `claude/new-session-5eijs6` · Brief: "PHASE A3 — CORE CMS / PAGES + SERVICES + PROJECTS +
MACHINERY + INDUSTRIES + CLIENTS + CERTIFICATES / DATABASE-BACKED ADMIN WORKING COPIES / PUBLIC WEBSITE REMAINS STATIC /
LOCAL IMPLEMENTATION ONLY / DO NOT START A4".

## Summary and status

Phase A3 is built and tested **locally**, against a local MariaDB 11.4 only. It adds the core content records as
database **working copies**. The admin edits them; the public website never reads them.

- **Content types.** Pages (generic pages, plus records for the site's fixed pages: homepage, system, legal and template
  pages), services, projects with their categories, machinery, industries, clients and certificate metadata.
  - Every type is bilingual, with English and Arabic as equals and each language tracking its own state.
  - Every type supports soft archive and restore (the site's fixed pages excepted).
  - Relations, a collection order, per-record SEO and admin-only provenance exist where A1 defines them (pages, for
    example, have no order).
- **One engine for create, save, archive and restore.**
  - Authority comes from the session only.
  - Permissions come from the A1 registry, with record-level checks for legal pages, certificates and advanced SEO.
  - Every change uses optimistic concurrency: `lock_version` is checked under a row lock. A stale form gets "This
    content changed after you opened it. Reload and review the latest version before saving."
  - Zod validates every field on the server. Only plain text is accepted: no HTML, script or markup is ever stored.
  - Every change, and every refusal that matters, writes an audit event.
- **Project restrictions.** Every role may add a restrictive flag (`projects.add_flags`, the one permission A3 adds).
  Only an Owner or Admin can clear one. A clear needs a reason and is decided on the flag instance the page showed.
- **Admin screens.**
  - A CONTENT navigation group and a dashboard of real counts.
  - A list per area: search with Arabic normalization, filters, sorting, 25 a page, and the state kept in the address.
  - An editor per type, in tabs: General · English · العربية · the type's own rows · Relations · SEO · Status.
  - Move up / Move down ordering, archive and restore with confirmations, "used by" panels and an unsaved-changes
    warning.

Nothing in A3 publishes. There is no Publish button, no public route reads the database, and media and files wait for
A4. The public website is frozen, and item 30 proves it unchanged against `preserve/pre-admin-a3`. Nothing was deployed,
no Namecheap resource was touched, `main` was not touched, and A4 was not started.

**QA**, on a fresh clone of the final code `e2c67db`:

| Check | Result |
|---|---|
| `npm ci` | passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Full `npm audit` | 9, all in development tools (as in A2's final audit; item 36) |
| Lint | 0 problems |
| Typecheck | 0 errors |
| Build | passed, with no database settings |
| `db:check` | OK |
| Unit | 90 / 90 (A2 30 + A3 60) |
| Integration | 243 / 243 (A2 164 + A3 79) |
| Admin browser | 63 / 63 (A2 47 + A3 16) |
| Public E2E | 612 / 612, first full run |

**Public freeze proof** against `preserve/pre-admin-a3`:
- the files, stylesheets and script modules are unchanged;
- the 102 sitemap pages answer identically over HTTP in three admin-off settings, with every A3 address getting the
  public locale redirect and 404;
- no database connection is made by the public site, even with the admin on;
- 237 screens were compared: 233 identical at the first pass, and the other 4 are proven run-to-run noise.

**Security review:** no High or Medium finding. The 4 Low and 4 Info findings are all fixed, each with a test that fails
before the fix.

**Visual evidence:** `rawasy-a3-evidence.zip` (not committed): 108 captures of 25 screens, 0 sideways overflow.

**A3 STATUS: READY FOR INDEPENDENT REVIEW** (not self-approved).

## Report items (brief §63, in order)

### 1. Starting SHA
`dcd089d33c474b28c725d35e3537fa8f8d3aef02` ("Admin A2 final visual correction: report section and project memory (docs
only)"). This is the approved HEAD the brief expected (§1). Before any change, local HEAD equalled
`origin/claude/new-session-5eijs6` and the working tree was clean. The expected refs matched: `preserve/pre-admin-a2`,
both A2 correction checkpoints, and `main` at `474f61f`.

### 2. preserve/pre-admin-a3 SHA
GitHub branch `preserve/pre-admin-a3` was created at exactly `dcd089d33c474b28c725d35e3537fa8f8d3aef02` and pushed. It
did not exist before, and no force push was used. `git ls-remote` at the end still shows it there (item 50).

### 3. Implementation commits
On top of `dcd089d`, each on its own, pushed to `claude/new-session-5eijs6`:

| Commit | Content |
|---|---|
| `d85d2f2` | Core CMS schema (`schema-cms.ts`), migrations `0002` (32 tables) and `0003` (orderings seed, `projects.add_flags`), the permission in the policy registry and its seed generator, and the CMS registry. Also the migration proofs A–F (`cms-migration.test.ts`), and two A2 tests updated for the shared-interface change (item 33). |
| `c6b70e0` | The Core CMS services (`src/server/cms/*`: engine, kinds, store, pages, flags, restrictions, ordering, lists, lookups, slugs and reserved routes, text rules, completeness, permissions) and their MariaDB integration tests |
| `a4c9d5c` | Unit tests of the Core CMS rules: slugs and reserved routes, completeness, permissions and restriction direction, validation |
| `861c6e7` | The shared content editor, list, order and restriction UI, and the Server Actions |
| `1465ecd` | Pages and Services screens |
| `921e47f` | Projects, project categories and restriction screens |
| `eb9cd7c` | Machinery and Industries screens |
| `af9439b` | Clients and Certificates screens |
| `e3c7239` | The CONTENT navigation and the dashboard's content counts |
| `f24f870` | Browser tests of the Core CMS (`e2e-admin/cms.spec.ts`, the test-only seed script) |
| `221fea7` | README: local use of the Core CMS (docs only) |
| `a7e501e` | The focused security review's fixes (4 Low, 4 Info) and the 320 px stale-message fix, each with a test that fails before (item 29) |
| `e2c67db` | Phone list rows keep the title cell's lines apart (`admin.css`, A3 rules only), with a browser assertion that fails before (item 29) |
| docs commit | This report, the project memory (CLAUDE.md) and two README corrections (docs only; item 4) |

### 4. Final branch HEAD
`e2c67db17486ed15434380ec2057ce9a9d93608d` (`e2c67db`) is the last commit with code. Every QA result below (items
30–42) comes from a fresh clone of it. The docs commit that adds this report follows it and is the branch's HEAD. Its
SHA is given in the hand-over message, since a commit cannot name itself (`git log -1 origin/claude/new-session-5eijs6`).

### 5. Files changed
`git diff --stat dcd089d e2c67db`: 88 files (78 added, 10 modified), +25,594 / −54 lines. Of these, 13,794 lines are the
generated Drizzle snapshots (`drizzle/meta/0002_snapshot.json`, `0003_snapshot.json`, `_journal.json`).
- **Added.**
  - Schema and migrations: `src/server/db/schema-cms.ts`, `drizzle/0002_core_cms.sql`, `drizzle/0003_seed_core_cms.sql`
    and two snapshots.
  - Services: `src/server/cms/` (16 files) and `src/i18n/reserved-slugs.ts`.
  - Admin: `src/server/admin/cms.ts`, `src/server/admin/actions/cms.ts`, `cms-model.ts`, `src/components/admin/cms/`
    (7 client components), `src/app/(admin)/admin/_components/cms.tsx`, and 31 route files under
    `src/app/(admin)/admin/(shell)/{pages,services,projects,projects/categories,machinery,industries,clients,certificates}/`.
  - Tests: `tests/unit/cms-{slugs,rules,access,validation}.test.ts`; `tests/integration/cms-{migration,pages,services,
    projects,catalogue,general,review}.test.ts` and `cms-helpers.ts`; `e2e-admin/cms.spec.ts` and `e2e-admin/seed-user.mjs`.
- **Modified.**
  - `README.md` (docs).
  - `drizzle.config.ts` (the second schema file) and `drizzle/meta/_journal.json` (entries 2 and 3).
  - `scripts/generate-access-seed.mjs` (also writes `0003`) and `src/server/policy/registry.ts` (the one new
    permission).
  - `src/app/(admin)/admin/(shell)/layout.tsx` (the CONTENT navigation group) and `(shell)/page.tsx` (the dashboard's
    content counts).
  - `src/app/(admin)/admin/admin.css`: an A3 block appended, plus the editor-message wrap rule and the phone title-cell
    rule; A2 rules untouched.
  - `tests/integration/rbac.test.ts` and `migrations.test.ts` (item 33).
- **The docs commit** adds this report and changes `CLAUDE.md` and `README.md`. The README changes: pages have no Order
  screen; `db:generate` reads both schema files.
- **Not touched:**
  - every public file: `src/app/(commerce)`, `src/components/commerce`, `src/content`, `src/lib`, `public`,
    `src/proxy.ts`, `next.config.ts`, `server.js`;
  - `package.json` and `package-lock.json` (no new dependency), and `.env.example` (no new variable);
  - the packaging and warm-up scripts, and the A1 documents.
- **The one new file under `src/i18n/`**, `reserved-slugs.ts`, is read only by the CMS server code
  (`src/server/cms/slug.ts`, and `engine.ts` for a type) and its unit test. No public module imports it (item 30:
  every public page's modules are unchanged).

### 6. Migration number / files
- `drizzle/0002_core_cms.sql`: the 32 A3 tables (item 8).
  - Generated by `drizzle-kit generate` from `src/server/db/schema-cms.ts`, then reviewed.
  - Uses the runner's table options (InnoDB, `utf8mb4`, `utf8mb4_unicode_520_ci`) and ASCII key columns, as in A2.
- `drizzle/0003_seed_core_cms.sql`: seed data, generated by `scripts/generate-access-seed.mjs` from the registries.
  - The seven collection orderings (`entity_orderings`: services, machines, projects, project_categories, clients,
    industries, certificates).
  - The permission A3 adds: `projects.add_flags`, "Add a restrictive flag to a project (never clears one)", not
    sensitive.
  - Its four role grants (Owner, Admin, Editor, Reviewer).
  - `npm run db:check` regenerates it and compares.
- `drizzle/meta/_journal.json` (entries 2 and 3), `drizzle/meta/0002_snapshot.json` and `0003_snapshot.json`.

Only `scripts/db-migrate.mjs` applies them. It is A2's runner, unchanged: a named lock, journal order, applied hashes,
verified charsets, and a backup required outside `APP_ENV=local`.

### 7. Migration proof
`tests/integration/cms-migration.test.ts` covers the brief's §8 proofs A–F, each on a fresh `rawasy_t_*` database:
- **A. An empty database** takes all four migrations (0000–0003). Afterwards `status` reports "Applied (4)" and
  "Pending (0): none".
- **B. An A2 database** has only 0000 and 0001 applied. It holds an Owner with a role, a confirmed second factor, a
  session and an audit row. It takes 0002 and 0003, and nothing else.
- **C.** A second `up` is a no-op ("Nothing to apply").
- **D. The runner's safety checks still hold for the A3 files.** A seed file changed after it was applied is refused
  ("0003_seed_core_cms.sql changed after it was applied"), and so is a journal put out of order ("out of order").
- **E. Table and column settings.**
  - Every A3 table is InnoDB with `utf8mb4_unicode_520_ci`.
  - Every id and key column (`id`, `*_id`, `slug`, `locale`, `flag`, `ordering_key`, `system_key`, `icon_key`) is
    `ascii_bin`; the text columns are `utf8mb4_unicode_520_ci`.
  - The runner's charset verification passes, and `status` is clean.
- **F. No A2 row is lost or changed.**
  - Each A2 table is compared row by row before and after; the append-only audit and migration history only grew.
  - The permissions are A2's 129 plus exactly `projects.add_flags`, with its four grants, and the grant total matches
    the registry.
  - The seven orderings start at version 0.
  - Every other A3 table is empty: no content was imported.

A2's own `migrations.test.ts` still covers the runner: lock, history, backup requirement and exit codes (item 33).

### 8. Tables added
`drizzle/0002_core_cms.sql` adds 32 tables (A1-DATABASE-SCHEMA §5–§7; Drizzle source `src/server/db/schema-cms.ts`).
All of them use:
- InnoDB, `utf8mb4` / `utf8mb4_unicode_520_ci`;
- ULID ids and ASCII keys (`ascii_bin`), and `DATETIME(3)` in UTC;
- A1's column groups where A1 gives a table one: TS (timestamps and actors), SD (soft delete), PUB (publication), SRC
  (admin-only provenance), SEO_R / SEO_T (per-record SEO) and TR (translation status).

| Area | Tables |
|---|---|
| Pages | `pages`, `page_translations` |
| Services | `services`, `service_translations`, `service_machines`, `service_related_services`, `service_featured_projects` |
| Machinery | `machines`, `machine_translations`, `machine_attributes`, `machine_attribute_translations` |
| Projects | `projects`, `project_translations`, `project_services`, `project_flags`, `project_categories`, `project_category_translations`, `project_category_assignments` |
| Industries | `industries`, `industry_translations`, `industry_services`, `industry_projects` |
| Clients | `clients`, `client_translations` |
| Certificates | `certificates`, `certificate_translations`, `certificate_facts`, `certificate_fact_translations` |
| Shared | `entity_orderings`, `entity_ordering_items` (collection order), `search_documents` (admin search, working scope), `revisions` (empty in A3: the publication columns refer to it) |

Tables are left out until the phase that builds them, following A1's own phase column:
- every media reference and alt text (A4);
- section and block tables (A5);
- menus and settings (A6);
- enquiries (A7);
- the public read model, the references index, and the cache and redirect tables (A8/A9).

Three additions go beyond A1's catalogue because the A3 brief asks for them. Each follows an existing A1 pattern, and
each is reported here rather than added silently:
- `machine_attributes` (+ translations), for the brief's "technical attributes" (§26–§27): a label and value per
  language, with a sort order. It is shaped exactly like A1's `certificate_facts`.
- `industry_projects`, for "Industries ↔ Projects" (§28, §32). It is shaped like A1's `industry_services`.
- `clients.is_featured`, for the brief's "featured" client (§29). It works like A1's `projects.is_featured`.

No A1 table or column was changed or removed.

### 9. Relations added
Every list relation is its own table with a composite primary key (owner, target), so a duplicate cannot be stored.
Each row has a `position` for its order. The owner side cascades on delete (nothing in A3 deletes); the target side
restricts. The two single references are columns with foreign keys: a machine's primary service and a project's client
record.

| Relation | Table | Limit | Rule |
|---|---|---|---|
| Service → machines | `service_machines` | 20 | in order |
| Service → related services | `service_related_services` | 10 | never itself |
| Service → featured projects | `service_featured_projects` | 12 | the project's own record must list the service |
| Project → services | `project_services` | 6 | "the services the project's own record lists" |
| Project → categories | `project_category_assignments` | 6 | website classifications |
| Industry → services | `industry_services` | 12 | in order |
| Industry → projects | `industry_projects` | 24 | in order |
| Machine → primary service | `machines.primary_service_id` | 1 | must exist and be active when chosen |
| Project → client record | `projects.client_id` | 1 | an archived client stays where named, can't be chosen anew |

Rules for every relation, applied by `checkTargets` in `src/server/cms/store.ts` inside the item's transaction:
- Ids only (ULIDs), never names or paths.
- The target must exist in the target type's table. An id of another type is treated as "no longer exists".
- No duplicates, and no more than the limit.
- An archived target may stay linked but cannot be added.
- A newly added target or reference is read with a share lock, so a target archived at the same moment can't be linked
  anew (review finding 3, item 29).

A relation is written only when it changed (`diffOrdered`):
- as a whole ordered list;
- in the same transaction as the item and under the item's `lock_version`, so a stale form changes no relation;
- with an audit event `<type>.relations_change` (+n / −n / reordered).

The editor shows the reverse side read-only as "Used by" (for example, a machine lists the services that use it), so
archiving something in use is never a surprise.

### 10. Content concurrency design
- **Items.** Every root row carries `lock_version`, and the editor sends the version it opened with. `updateItem` runs
  in one transaction:
  1. It locks the row (`SELECT … FOR UPDATE`) and compares the version.
  2. It writes the root, both translations, children, relations and the search rows.
  3. It increments the version.

  A different version is refused as `stale` (audited, outcome `failed`) and nothing is written. The browser keeps every
  typed value and shows "This content changed after you opened it. Reload and review the latest version before saving."
  It offers two ways on: open the latest version in a new tab, or reload (explicitly labelled as discarding the typed
  changes).
- **Archive and restore** are decided on the same version (`setItemArchived`), so an archive races neither a save nor
  another archive: one applies and the other is refused. Integration test: "a save and an archive of the same version
  at once".
- **Collection order.**
  - Each ordering has its own `lock_version`, read before the rows, so a move committed in between makes the page
    stale, never wrongly current.
  - A move swaps two positions under the ordering's row lock.
  - Archive and restore also change the order's version, because the page's neighbours change (review finding 7).
  - A create reads the order's last position with a locking read, so two creates at once never share a position
    (review finding 4).
- **Restrictions.**
  - A clear names the flag instance its page showed (the time it was added). A flag cleared and set again since is a
    newer restriction, and the old page does not clear it.
  - Adding a flag never needs a version, since it only restricts.
  - Flags never change the item's version, so they never make an open editor stale.
- **Session and account.** Every change runs in `contentTransaction`, which starts with A2's `lockActor` (the acting
  user's row, then its session). A signed-out session or a disabled account changes nothing, as for A2's own changes.
- **Two saves at once** from the same version: exactly one applies (integration test with two concurrent saves).

### 11. Localization model implementation
Each item has one identity and one translation row per language (`<type>_translations`, primary key item + locale).
English and Arabic are equals. Each language has its own state, computed in two places with the same rule:
`src/server/cms/completeness.ts` for the editor (from the `required` fields in `kinds.ts`) and `localeStateSql` in
`list.ts` for the lists' badges and filters (from its `REQUIRED` map). The two field lists were compared type by type
for this report and agree; nothing derives one from the other yet (item 43.11). The unit tests cover the editor's rule,
and the integration tests cover the lists' language filters. The states:
- **Missing**: no text in that language (no row).
- **Incomplete**: some text, but a required field is empty.
- **Draft**: every required field is filled, but not confirmed.
- **Complete**: confirmed by an editor ("English is complete"). This is refused while a required field is empty.
- **Needs review**: the other language changed after this one was completed. It is set on save, unless the editor
  ticks "This change does not affect the other language".

Neither language is required to save a draft; an English-only draft is normal. The editor tells three kinds of
message apart:
- a field missing, shown on the field: "Required before Arabic can be marked complete.";
- the language incomplete, shown on its "complete" box with the missing fields listed;
- invalid content, refused by the schema field by field.

Further rules:
- Arabic inputs are `dir="rtl" lang="ar"`; English ones are `dir="ltr"`. The section heading is "العربية" and the admin
  chrome stays English.
- Child rows (machine attributes, certificate facts) carry their own label and value per language.
- The admin search (`search_documents`) keeps one normalized row per language. Arabic diacritics and tatweel are
  removed, alef forms unified, ta marbuta → ha, alef maqsura → ya, Arabic-Indic digits → ASCII, and Latin text is
  lower-cased.
- A form is the item's full state. A language whose fields are all emptied loses its row and its state becomes
  Missing; this is how a translation is removed.

### 12. Pages implementation
`src/server/cms/pages.ts` and `pageSpec` in `kinds.ts`; screens `/admin/pages`, `/new` and `/[id]` (pages have no order
screen).
- A record's **type is fixed at creation**: A1's `page_type` never changes.
- A **generic page** has a slug, checked against the reserved routes (item 24).
- A **fixed page** record stands for one of the site's 14 fixed pages (14 system keys): the homepage, About, Services
  overview, Capabilities, Projects overview, Industries, Clients, Certificates, Contact, the 404, Privacy, Terms, and
  the project and service templates. Such a record:
  - is registered once per key (`system_key` is unique);
  - has no slug and is never archived;
  - is registered only by Owner and Admin (`pages.edit` + `pages.archive`).
- A **legal page** record (Privacy, Terms) needs `legal.edit`, both to register and to edit. Its list row carries a
  "Legal review" badge, and its editor says "Requires legal review before publication": the record is a draft with no
  effect on the public legal pages.
- An Editor creates generic pages only (`pages.create_generic`).
- Fields per language: title (required), navigation label, SEO title and description, share title and description.
- Root fields: "Hide from menus" (a working setting for A6), the effective date (legal pages only), and the advanced SEO
  fields (item 27).
- A3 manages a page's identity and basic metadata only. It never manages the page's sections (A5) or its public route,
  which stays static until the A9 cutover.

### 13. Services implementation
`serviceSpec`; screens `/admin/services`, `/new`, `/[id]` and `/order`.
- Root fields:
  - slug (unique);
  - section (`metal` | `scaffolding`);
  - icon / drawing: a key of the public site's icon set, validated against the registry;
  - provenance (basis, pages, note; admin-only);
  - advanced SEO.
- Per language: name, tagline, summary, description, highlights, and the SEO title/description/share fields.
  - The description is A1's paragraph document, edited as plain text with blank lines between paragraphs, never HTML.
  - Highlights are one per line, at most 8.
- Relations:
  - machines (at most 20);
  - related services (at most 10, never itself);
  - featured projects (at most 12). Each must list the service in its own record. This is checked on every save, and
    the picker offers only those projects.
- Collection order.

### 14. Projects implementation
`projectSpec`; screens `/admin/projects`, `/new`, `/[id]` and `/order`.
- Root fields:
  - slug (unique). It is also the gallery anchor `#<slug>`, so the gallery page's own ids are refused.
  - gallery reference (e.g. `04` or `p.3`);
  - year (1900–2100, "only once confirmed");
  - client record (optional). An archived client stays where named but cannot be chosen anew.
  - featured: a working flag only, since nothing is public in A3;
  - provenance and advanced SEO.
- Per language:
  - title and summary, required for completeness;
  - the optional confirmed details: scope, description, materials, location, client name (only when the client has no
    record), challenge and solution. Each is stored NULL until entered (A1 §3.5) and hinted "Only once confirmed.";
  - SEO fields.
- Relations: categories (at most 6) and services (at most 6). Restrictions: item 16. Collection order.
- A project is not restored while one of its categories is archived (item 22).
- Nothing is inferred. A3 starts empty, and the current static projects are not imported (item 48).

### 15. Project category implementation
`categorySpec`; screens `/admin/projects/categories`, `/new`, `/[id]` and `/order`.
- A label per language, a slug and its own order.
- Categories are website classifications, as on today's public gallery.
- A category assigned to an active project cannot be archived ("in use by N projects"). Once unused it can be, and it
  stays restorable.
- The archive check reads the projects without locking them, which is safe. Linking a category anew reads it under a
  share lock (item 9), so no project gains a category that is being archived.

### 16. Restriction safety implementation
`src/server/cms/flags.ts`, `restrictions.ts`, and the `FlagsPanel` on the project editor.
- **The flags.** A1-CONTENT-MODEL §8.2 defines them, kept as a registry in code:
  - pending confirmation, authorship unconfirmed, rights or copyright pending;
  - render (not a photograph), AI-generated or AI-edited;
  - AI watermark: the only non-blocking flag (the photo is held back);
  - restricted, hidden, internal only.

  A flag the code does not know (one written by another release) **blocks**, failing closed. An Owner or Admin can
  still clear it.
- **Adding** a flag:
  - needs `projects.add_flags`, the permission A3 adds (Owner, Admin, Editor, Reviewer);
  - accepts only known flags, with an optional plain-text note (at most 500 characters);
  - adding the same flag twice changes nothing ("already set");
  - an archived project can still be restricted.
- **Clearing** a flag:
  - needs `projects.clear_flags` (Owner, Admin) and a reason (plain text, at most 200 characters, kept whole in the
    audit event);
  - is refused on an archived project until it is restored; the refusal is audited (review finding 8);
  - is decided on the flag instance the page showed. A flag cleared and set again since is a newer restriction, and the
    old page cannot clear it: "This flag was set again after you opened the page. Reload and review it before clearing
    it."
  - Two clears at once: one succeeds and the other finds the flag gone.
- **Direction proof.** `tests/unit/cms-access.test.ts` checks, over every subset of the nine flags:
  - adding never makes a project less restricted, and removing never adds (`isAtLeastAsRestrictive`);
  - every role may add, and only Owner and Admin may clear.

  A refused clear is audited (`project.restriction_clear`, `denied`). In the browser suite, a forged clear from a
  signed-in Editor is refused and audited.
- Flags never change the editor's version and never publish or approve anything. They record restrictions for A4
  (media) and A8 (publishing).

### 17. Machinery implementation
`machineSpec`; screens `/admin/machinery`, `/new`, `/[id]` and `/order`.
- Root fields:
  - slug (unique). It is also the `/capabilities#<slug>` anchor, so the page's own ids are refused.
  - power in watts: whole numbers from 1 to 100,000. Empty means "not stated" and is stored as NULL, never 0. Values
    like "6,000", "6kW" or "1.5" are refused.
  - the primary service, which must exist and be active when chosen;
  - provenance.
- Per language: the name as printed, a short name, the type, and the capability ("only what the source states").
- **Technical attributes** (§27) live in `machine_attributes` + translations: ordered rows of label and value per
  language.
  - At most 20 rows; a label is at most 80 characters and a value at most 200.
  - The list is validated as an exact shape (`{ id, en: {label, value}, ar: {label, value} }` and nothing else). Extra
    keys, markup, unknown ids, too many rows and broken JSON are refused.
  - Ids are kept when rows are reordered.
- No machine fact is pre-filled or invented, and machines have no SEO fields (A1 defines none for them).

### 18. Industries implementation
`industrySpec`; screens `/admin/industries`, `/new`, `/[id]` and `/order`.
- Root fields: slug, classification, and provenance. The classification is either a profile sector or a website
  classification; the public page distinguishes the two.
- Per language: name and description.
- Relations: services (at most 12) and projects (at most 24; the brief's "Industries ↔ Projects", item 8).
- An icon or image comes with A4.
- No SEO fields:
  - A1 gives industries none, because they have no page of their own. The Industries page's SEO belongs to its page
    record.
  - Per §34 ("Implement only per-record SEO fields approved by A1"), none were added.
  - The brief's §28 "SEO fields" is met through the `industries` page record.

### 19. Clients implementation
`clientSpec`; screens `/admin/clients`, `/new`, `/[id]` and `/order`.
- A name per language, a slug, featured (a working flag), provenance and order.
- The website:
  - must be `https://` with a real public host: no user name or password, no spaces, at most 255 characters;
  - `http:`, `javascript:`, `data:`, local hosts and IP literals are refused, and so are backslashes and control
    characters (review finding 6);
  - is stored in the address parser's own form (`URL.href`: lower-case host, punycode, normalized path);
  - is never fetched by the server and not shown publicly. Showing links needs the Owner's decision.
- No logo or upload field (A4).
- A client category is not in A1 and was not approved, so none was added.
- A draft client record claims nothing publicly.

### 20. Certificates metadata implementation
`certificateSpec`; screens `/admin/certificates`, `/new`, `/[id]` and `/order`. Certificates hold document **metadata
only**:
- title and issuer per language;
- displayed facts: at most 12, with a label and value per language;
- an admin-only expiry date: a real calendar date, for renewal reminders, never shown publicly;
- provenance and order.

Owner and Admin edit and order certificates (`certificates.edit`). Only the Owner archives and restores them.

**The digit guard** applies to every public text, facts included, and to the certificate's slug, which is part of its
public address (review finding 1). It refuses registration and certificate numbers:
- seven or more digits in a row, or in groups;
- digits of any script count, including Arabic-Indic and full-width digits (text is NFKC-normalised first);
- any single space, dash, dot, comma, slash, apostrophe or Arabic separator between digits groups them;
- a date is allowed, and so are "ISO 9001:2015" and "14001, 9001";
- English and Arabic expiry wording ("valid until", "صالحة حتى", "صلاحية") is refused too.

No file, document, URL, number, QR or thumbnail column exists, and an integration test checks the columns. Every
certificate screen says: "Document upload and public/private file management arrives in A4."

### 21. Media boundary / why A4 was not started
A3 stores no file and references no media.
- Every A1 media column was left out of the A3 tables: `media_id`, `feature_media_id`, alt texts, and logo and document
  references. Nothing in the database can point at a picture, a logo or a certificate document yet. Adding them is an
  A4 migration that will introduce the media library and its own tables together.
- There is no file input anywhere in the CMS. The browser suite checks the certificate, project, client and service
  screens for `input[type=file]` and for upload, download or publish buttons, and finds none.
- The places where media will belong say so:
  - certificates: "Document upload and public/private file management arrives in A4.";
  - clients: no logo field (A4);
  - industries: icon or image (A4).
- The 13 held-back public media and the packaging script's exclusions are unchanged (item 30).

A4 was not started because the brief stops at A3 (§66). There is no upload route, no `RAWASY_DATA_DIR`, no `/media/u/…`,
no `media.*` permission in use and no restricted-media items.

### 22. Archive / restore design
Archiving is soft only (A1 T12/T13):
- **Archive** sets `publication_status = 'archived'`, `draft_status = 'none'`, `archived_at` and `archived_by`, and
  increments `lock_version`. The row, its translations, relations, children, order position and flags all stay.
- Nothing is deleted: there is no Trash or purge in A3.

Archived items:
- are read-only in the editor ("Archived (read-only, restorable)"). A save sent anyway is refused and audited (review
  finding 8).
- leave the default lists (Status: Active) and show under Status: Archived or All;
- keep their slugs, so a new item can't take an archived item's slug;
- keep their place in the order (moves step over them);
- stay linked where they were, but can't be added to a new relation.

**Restore** returns the item to a draft (`unpublished` / `draft`), never to a published state. Nothing is published in
A3, and the database itself refuses a published state without a published revision.

Who may archive and restore:
- Both need `<resource>.archive`: Owner and Admin, and for certificates the Owner only.
- A1's separate `<resource>.restore` key means restoring a revision (A8) and is not used here.

Archive and restore are decided on the version the page showed. Both ask for confirmation, are audited, and change the
collection's order version (item 10).

Exceptions:
- Fixed pages are never archived.
- A category in use by active projects can't be archived.
- A project can't be restored while one of its categories is archived ("Restore it first, then the project"). That check
  reads under a share lock and is audited (review finding 3).

### 23. Sorting / reordering
Collections with an order use A1's `entity_orderings` (one row per collection, with its own `lock_version`) and
`entity_ordering_items` (item, position). These are services, machines, projects, project categories, industries,
clients and certificates.
- New items join at the end. The last position is read with a locking read (item 10).
- The Order screen lists the collection with **Move up / Move down** buttons:
  - keyboard-usable, with no drag and drop;
  - focus stays with the moved item, or moves to its other button at an end;
  - the result is announced in a live region.
- Who may move: `orderings.edit` (Owner, Admin, Editor). A certificate also needs `certificates.edit`, so only Owner and
  Admin move certificates (review finding 2). The order page shows the buttons only to them.
- A move swaps two adjacent active items, in one transaction under the ordering's row lock. It is decided on the order
  version the page showed:
  - a stale page changes nothing ("The order changed after you opened this page. Reload it and try again.");
  - of two moves sent at once from the same page, exactly one applies;
  - positions stay unique (a unique index) and the order deterministic.
- Archived items keep their place and are stepped over.
- A forged move changes nothing: another collection's item, an archived item, or a made-up id or direction.
- Each move is audited (`<type>.reorder`).
- Lists sort by site order (the default for ordered collections), last updated, title or slug.

### 24. Search / filter / pagination
`src/server/cms/list.ts`. Lists are server-side only and never return unlimited rows.
- **Paging.** 25 a page by default, sizes 10–100, and the page number clamped to the last page.
- **Safe queries.** Every value is a bound parameter, and every table or column name comes from a fixed map in the file.
- **State in the address.** `q`, `status`, `lang`, `featured`, `restricted`, `category`, `classification`, `type`,
  `group`, `sort`, `page` and `size` live in the address, so a list is bookmarkable.
  - Unknown or out-of-range values fall back to the defaults.
  - Links keep only what differs from the defaults.
- **Search** (at most 100 characters):
  - compares the normalized title and body of `search_documents` (Arabic normalized, item 11);
  - matches the slug only for ASCII queries;
  - escapes `%`, `_` and `\`.
- **Filters.**
  - Status: active, archived or all.
  - Language: English or Arabic missing / not complete, or needs review. These states are computed in SQL with the
    same required fields as the editor.
  - Per type: page type, service section, project restricted (a blocking flag) / featured / category, industry
    classification, and client featured.

**Reserved slugs.** A generic page's slug may not take a public route: `src/i18n/reserved-slugs.ts`, a new file that
only the CMS server code reads. A unit test checks it against `src/i18n/routes.ts`, the app's top-level folders and its
metadata files. Machine, project and certificate slugs may not repeat an id of the page they anchor on.

### 25. RBAC implementation
`src/server/cms/permissions.ts` maps a content action to the permission keys it needs. `can()` checks them against the
acting session's permission set, which comes from A2's seeded registry, never from role names.

Record-level rules:
- a legal page is edited and registered with `legal.edit`;
- a fixed page is registered with `pages.edit` + `pages.archive`;
- a certificate needs `certificates.*`; moving one needs `orderings.edit` + `certificates.edit`;
- robots, canonical and sitemap need `seo.advanced`;
- order needs `orderings.edit`;
- viewing a CMS screen needs `content.view`.

Enforcement:
- Every page, layout and Server Action keeps A2's guards: the admin gate, the session, the same-origin check, and audited
  refusals.
- Every A3 Server Action runs those guards before it reads or answers anything about its input (review finding 5).
- Every content change is re-decided inside its transaction, on the stored record. For example, a legal page is
  recognized from its stored type, never from the form.

The resulting matrix (A1 §5.3):

| Action | Owner | Admin | Editor | Reviewer |
|---|---|---|---|---|
| View every CMS area | yes | yes | yes | yes |
| Create / edit general content (pages, services, projects, categories, machines, industries, clients) | yes | yes | yes | — |
| Archive / restore general content | yes | yes | — | — |
| Register fixed pages; edit legal pages | yes | yes | — | — |
| Edit and order certificates / archive and restore certificates | yes / yes | yes / — | — | — |
| Order collections (certificates: row above) | yes | yes | yes | — |
| Robots, canonical, sitemap (`seo.advanced`) | yes | yes | — | — |
| Add a project restriction (`projects.add_flags`, new) | yes | yes | yes | yes |
| Clear a project restriction (`projects.clear_flags`) | yes | yes | — | — |

`tests/unit/cms-access.test.ts` checks every content action of every type for each role against this table, written out
independently of the code. `tests/integration/rbac.test.ts` checks the seeded matrix (130 permissions).

### 26. Audit implementation
Audit events go through A2's insert-only `audit_events` (`contentAudit` in `store.ts`).
- **Actions recorded:** `<type>.create`, `.update`, `.slug_change`, `.relations_change` (+n / −n / reordered per
  relation), `.archive`, `.restore`, `.reorder`, `project.restriction_add`, and `project.restriction_clear` (with the
  reason).
- **Each event holds:**
  - the actor and session from the request;
  - the entity type, id and label;
  - the outcome (`success`, `denied`, `failed`);
  - a one-line summary naming what changed (languages, fields, relations), never the long texts themselves.
- **Refusals that matter are audited too:**
  - a permission refusal (`denied`), for example an Editor's forged save of a legal page or move of a certificate;
  - a stale save, archive, move or clear (`failed`);
  - a save of an archived item, an archive of a category in use, a restore into an archived category, and a clear on an
    archived project (`failed`, with the reason; review findings 3 and 8);
  - every refusal of A2's `actionContext` (other origin, missing permission).

### 27. Per-record SEO implementation
Per-record SEO exists only where A1 defines it (§34): pages, services and projects.
- **Per language:** SEO title, SEO description, share title and share description.
  - Each is optional and will fall back to the title or summary later.
  - The editor shows the recommended 60 / 160 characters as hints; stored lengths go up to 120 / 320.
- **Per record** (`seo.advanced`, Owner and Admin): index / noindex, follow / nofollow, include in the sitemap, and a
  canonical override.
  - The canonical override must be a same-site path (`/` or lowercase segments). Absolute URLs, other hosts and query
    strings are refused.
  - An Editor sees these fields disabled ("Only roles with the advanced SEO permission (Owner, Admin) can change
    these."). The form then sends no advanced marker, and a forged change is refused and audited.
- Global SEO defaults, organization data and settings stay in A6.
- Nothing reaches the public `<head>`: the public site does not read these records.

### 28. Build-time DB guard
The guard is unchanged from A2 and proven again:
- `next build` sets `NEXT_PHASE=phase-production-build` before it prerenders, and any database use during the build
  fails loudly (`BuildPhaseDatabaseError`).
- Every A3 page is dynamic: it sits inside the admin's dynamic root layout, after `connection()`.
- The final build lists all 46 admin routes as `ƒ` (server-rendered on demand): A2's 15 and A3's 31. The prerender
  manifest has 109 prerendered routes and 13 dynamic route patterns, and none of them is under `/admin`.
- The final build ran with no `DB_*`, `ADMIN_ENABLED` or `APP_ENV` variable set (item 39).

### 29. Security-review findings / fixes
A focused, read-only review of the A3 code followed every path from the Server Action through the engine and store to
the SQL and the migrations. It covered the brief's §58 list:
- IDOR, client-submitted actor ids, RBAC bypass;
- stale writes, archive / restore races, restriction-clear bypass;
- mass assignment, unsafe URLs, HTML/script storage, SQL injection;
- slug route conflicts, relation authorization, forged sort order, hidden form fields, archived relations.

**No High or Medium finding.** It reported 4 Low and 4 Info findings. Every one was verified against the code, and all
eight are fixed within A3's scope, although §58 only requires High and Medium. Each fix has a test that **fails on the
code before the fix**.

Negative control: the new tests were run on a worktree of `221fea7`, the last commit before the fixes.
- **Unit:** 86 / 90. The 4 new tests fail (findings 1, 1, 2 and 6).
- **Integration:** `cms-review.test.ts` passes 0 / 7. Each test fails for its own reason:
  - the Editor's certificate move succeeds;
  - the project is linked to the archived category;
  - the machine keeps an archived primary service;
  - the project is restored into an archived category;
  - the second create is told "The slug “test-together-b” is already used.";
  - the stale move succeeds;
  - the archived save is not audited.
- **Browser:**
  - the 320 px stale message measures 20 px of overflow;
  - the gate-on positive control fails: the malformed request was answered before the session check, with no database
    attempt.

On `a7e501e`, and on the final `e2c67db`, all of them pass. The findings, in the review's order:

| # | Severity | Finding (verified) | Fix | Test |
|---|---|---|---|---|
| 1 | Low | The certificate digit guard had lost the public test's no-break space from its separator class (two plain spaces were left). "1010 123 456" written with no-break spaces passed, and so did en dashes, commas, the Arabic thousands separator, full-width digits and "valid until" wording. Certificate slugs (the public anchor) were not guarded. | `text.ts` normalizes with NFKC first and counts every decimal digit of any script. One separator of any space, dash, dot, comma, slash, apostrophe or Arabic separator between digits groups them; a colon, or two characters, does not ("ISO 9001:2015" and "14001, 9001" stay allowed). The English and Arabic expiry wording is wider. Non-ASCII characters are written as `\u` escapes only. `slug.ts` applies the guard to certificate slugs. | `cms-rules.test.ts`, `cms-slugs.test.ts` |
| 2 | Low | An Editor (holding `orderings.edit`) could move certificates in their order, although every other certificate action is Owner/Admin. | Per A1 §5.2 "certificate → `certificates.*`", a certificate move needs `orderings.edit` and `certificates.edit`. The order page shows the buttons only to those roles, and a refusal is audited. | `cms-access.test.ts`, `cms-review.test.ts` |
| 3 | Low | Relation targets and references were checked with snapshot reads. A category archived at the same moment as a project's save that linked it ended up linked to an active project (§23's invalid state). The same happened for a machine's primary service and a project's client. Even without a race, "archive the project, archive the category, restore the project" produced it. | Newly added targets and references are read with a share lock (`LOCK IN SHARE MODE`). The save either waits for the archive and then sees the target archived, or keeps it from being archived until the save commits. A project is not restored while one of its categories is archived ("Restore it first, then the project"); that check reads under a share lock and is audited. | `cms-review.test.ts` (deterministic: the other side holds the row lock, and the test checks the save is waiting before releasing it) |
| 4 | Low | When two creates of one type ran at the same moment, the second read the order's last position from its snapshot and took the same position. The duplicate-key error was then reported as "slug already used". | The last position is read with a locking read. Duplicate-key errors are told apart by the index they name: a slug, the system page, or "Another change was saved at the same moment … Try again". | `cms-review.test.ts` (deterministic, as above) |
| 5 | Info | The A3 Server Actions answered malformed input before the admin's own checks. Without a valid session, or from another origin, a malformed request got a validation message instead of the sign-in redirect or the audited origin refusal. The review's "admin off" variant did not reproduce: with the gate off, Next's forwarded request meets the proxy's locale redirect and nothing runs, on both builds. | Every A3 action calls `actionContext` (gate, session, origin, audited refusals) before it reads or answers anything about its input. | `e2e-admin/cms.spec.ts`: the gate-on positive control (the malformed request now reaches the session check; it fails before) and a gate-off guard (the forwarded answer never holds the message) |
| 6 | Info | A client's website was stored as typed, after checks on the parsed address. `https://evil.com\@example.com` (a browser opens evil.com) was kept, and so were control characters the parser drops. | Backslashes and control characters are refused. The address is stored in the parser's own form (`URL.href`: lower-case host, punycode, normalized path), and its length is checked again. | `cms-validation.test.ts` |
| 7 | Info | Archive and restore did not change the order's version, so a move from an order page opened earlier could pass a different neighbour than the page showed. | Archive and restore of an ordered item bump its collection's order version, so the page becomes stale. | `cms-review.test.ts` |
| 8 | Info | Three refusals were not audited: saving an archived item, archiving a category in use, and clearing a flag on an archived project. | All three are audited (`failed`, with the reason). | `cms-review.test.ts` |

The review also checked these areas and found them safe:
- **Cross-record access.**
  - The table always comes from the validated type, and an id of another type is "not found".
  - Child rows must belong to the item.
  - Relation targets are looked up in their own type's table and pinned by foreign keys.
- **Actor ids.** Every created/updated/archived/completed-by value and every flag's `created_by` comes from the
  session.
- **Permissions** come from the session's registry permissions, are record-level on the stored record, and are re-proved
  under lock by `lockActor`.
- **Stale writes:** the root is locked `FOR UPDATE`, then the version is compared.
- **Archive versus edit:** one lock decides both.
- **Flag clearing** checks the permission, the reason, the project lock and the exact instance.
- **Mass assignment.** `formToObject` drops `_`-prefixed, nested and prototype names, and Zod strips unknown keys.
  Status, version and audit columns are set by the server.
- **URLs:** https only, no credentials, an alphabetic top-level domain. The canonical override must be a lowercase site
  path.
- **Markup.** Plain text refuses tags, control characters and bidi-override characters. Rich text is built on the server,
  and there is no `dangerouslySetInnerHTML`.
- **SQL.** Names come from code maps and every value is bound. ORDER BY comes from a fixed switch, LIKE patterns are
  escaped, and `NO_BACKSLASH_ESCAPES` is not used.
- **Slugs.** An ASCII pattern, a CHECK constraint and `ascii_bin`; reserved routes and anchors are refused; archived
  items keep theirs.
- **Order moves** are validated, permission-checked, locked and versioned, and the item must be active in that type's
  ordering.
- **Hidden fields.**
  - `_page` is read only on create and resolved from the registry.
  - `lockVersion` is used only for concurrency.
  - The `seo.advanced` marker grants nothing.
- **Pages and lists.**
  - Every A3 page calls `requireActor`.
  - Lists cap the page size at 100, clamp the page number and cap the search at 100 characters.
  - Pickers return at most 500 rows, and error messages are generic.

The evidence dry run, not the review, found one more layout defect, fixed in the same series. At 320 px the stale
message's "Open the latest version in a new tab" button kept its label on one line (A2's `.adm-btn` is `nowrap`) and
widened the page to 340 px. `.adm-editor-alert .adm-btn` now wraps. This is the A2 entry cards' rule, scoped to the
editor's messages, so A2 screens are unchanged. The 320 px browser test now saves into a stale state and measures it,
and it fails on the code before the fix.

Reviewing the final evidence found one more layout defect.
- **The defect:** on phones, a list row's title cell ran the English title, the Arabic title and the slug together on
  one line ("Test Laser Servicetest-laser-service").
- **The cause:** A2's stacked-table rule `.adm-table.is-stack th { display: block }` outranked the A3 title cell's
  `display: grid`.
- **The fix (`e2c67db`):** the stacked title cell keeps its grid. The rule is in the A3 part of `admin.css` only, and A2
  screens do not use the title cell.
- **The test:** the 390 / 320 px browser test now checks every list title cell's lines. Negative control on
  `a7e501e`: it fails on the services list at 390 px ("Test Laser Servicetest-laser-service", "Test Bending
  Servicetest-bending-service"). On `e2c67db` it passes, and the whole CMS spec passes 16 / 16.

### 30. Public freeze proof
Against `preserve/pre-admin-a3` (`dcd089d`, the approved A2), on a fresh clone of `e2c67db`. The baseline was built from
a worktree of `dcd089d`. Each build was served from its own folder by `server.js` in production mode.

- **Sources.** `git diff dcd089d..e2c67db` is empty for every public path:
  - `src/app/(commerce)/**`, `src/components/commerce/**`, `src/content/**`, `src/lib/**`, `public/**`;
  - `src/app/global-not-found*`, `src/app/{robots,sitemap,manifest}.ts`, `src/fonts/**`, `src/proxy.ts`,
    `next.config.ts`, `server.js`;
  - `scripts/package-namecheap.mjs`, `scripts/warm-images.mjs`, `e2e/**`, `playwright.config.ts`, `package.json`,
    `package-lock.json`, `.env.example`.

  The one addition under a public folder is `src/i18n/reserved-slugs.ts`: a new file read only by the CMS server code
  (item 5). The public E2E tests are byte-identical to the baseline's, and the 13 held-back-media rules are untouched.
- **Build output.** A clean build of `e2c67db` was copied right after `next build` and compared with the baseline's clean
  build. Each build has 890 public files:
  - 114 byte-identical;
  - 601 differing only by the build id or `/_next/static` chunk paths;
  - **0 other differences**. The 175 server bundles and manifests are compared by module instead.

  Unlike A2's proof, no file differs in the router's sibling entry: the baseline already lists `["admin"]`.
  - **Stylesheets:** on all 104 prerendered public pages, the same stylesheets in the same order, byte-identical.
  - **Scripts:** the same chunk names and bytes on all 104 pages, and the same module set and code. For example, `en.html`
    has 182 modules and 636,590 bytes on both builds; `ar/projects.html` has 177 modules and 605,400 bytes on both.
- **HTTP.** Three admin-off settings were tested, each against a freshly started baseline with its route cache emptied:
  nothing set (the deployment default), `ADMIN_ENABLED=0`, and `APP_ENV=staging` with nothing else set. In all three:
  - **102 / 102 sitemap pages** have the same status, headers (date, etag and cache-state headers aside), normalised
    HTML, SEO facts and page data (`RSC: 1`). The SEO facts are 102 titles, 102 descriptions, 102 canonicals, 306
    hreflang links, 208 JSON-LD blocks, 618 media references and 292,957 characters of visible text.
  - `robots.txt`, `sitemap.xml` (48,451 bytes), the manifest and both icons are byte-identical.
  - `/favicon.ico` (no such file) answers 404 on both builds, with the same headers and a body identical once the build
    id is normalised.
  - **40 / 40 redirect and locale cases** are identical. They include every A3 address:
    - `/admin/pages`, `/admin/services/order`, `/admin/projects/categories`, `/admin/certificates` (with and without a
      made-up session cookie), and an id address under `/admin/projects/`;
    - each answers `307` to its localized address, exactly as on the baseline.
  - **22 / 22 not-found cases** are identical. Among them, `/en/admin/pages`, `/ar/admin/services`,
    `/en/admin/projects/categories` and `/en/admin/certificates/new` give the localized 404 with `noindex`.
  - A form POST to `/admin/login`, `/admin`, `/admin/pages/new` or `/admin/projects/categories` gets the same locale
    redirect.
  - No public page links to the admin.
  - The 13 held-back files answer the same, and no page refers to them.
  - `/api/admin/…` and `/api/internal/…` (including `/api/admin/cms/pages`) give the same 404, with A2's API headers
    (`default-src 'none'; frame-ancestors 'none'; sandbox`), identical once the build id is normalised.
- **How the HTTP proof was run.** On the final code it ran once per setting, on build copies untouched since
  `next build`, and gave the figures above. Two lessons from the earlier run on `a7e501e`, which gave the same figures in
  the end:
  - the check now compares the API bodies after normalising the build id (it first compared them raw);
  - a second run on the same copies must first empty their runtime route cache (`.next/server/route-cache`, written by
    a running server). Otherwise two unknown-slug 404s answer from that cache with other headers. The baseline's route
    cache is emptied at each start.
- **No public database query.** The build was served with the admin **on** (`APP_ENV=production`,
  `ADMIN_ENABLED=1`) and `DB_*` pointing at a stand-in that counts connection attempts and refuses each one. Crawling the
  102 sitemap pages, their page data, 7 public files and 7 404s made **0 attempts**, and so did the admin's sign-in page.
  The positive control, a forged admin sign-in in React's current reply encoding, made 1 attempt. So "0" means the
  public site asked nothing, not that the stand-in was unreachable.
- **Pixels.**
  - **Setup:** 11 representative pages, screen by screen (up to 6), in EN/AR × light/dark × desktop 1440 × 900 /
    phone 390 × 844. Reduced motion, every image decoded, the map stubbed.
  - **First pass:** **237 screens, 233 pixel-identical.**
  - **Repeat captures** of the other 4 states, 3 more per build. Each differs by exactly what a build differs from
    itself, and each matched the other build in at least one pair:
    - `/en/about` on the phone: 69 pixels, which the baseline also shows against itself. A2 noted the same 69.
    - the Arabic Laser Cutting signature on the desktop: 37 pixels, at most 2 levels apart, which both builds show
      against themselves.
    - `/en/projects` on the desktop, dark: 8 pixels, which both builds show against themselves. A2 noted the same 8.
    - `/en/contact` on the phone: 37 pixels, which the current build shows against itself.
  - **Page heights:** 13 screens measured their page height at different loading moments on the two builds. Measured
    after walking each page (every image loaded), the heights are equal on both builds:
    - the phone homepage, 12,063 px in English (light) and 12,030 px in Arabic (dark);
    - the Arabic 404 on the desktop, 1,244 px. It is built in the browser, so one load measured 900 px before it
      rendered.

    Every screen of those pages is identical (15 + 15 + 2 screens). The phone homepage growing after its images load is
    a known effect, the same on every build.
  - **The earlier proof on `a7e501e`** gave the same picture: 236 screens, 228 identical, the other 8 proven noise in
    the same way.

### 31. Public E2E
**612 / 612 in the first full run** (3 workers, 22.3 min).
- **Setup:** the fresh clone of `e2c67db` (the final code), served by `server.js` on port 3400.
- **Image warm-up first:** 1,484 / 1,484 sizes, none failed or timed out, at most 2 requests at once, 102 s.
- No test failed, was retried or was skipped, so this one full run is the only one on the final code.
- The earlier full run on `a7e501e` had also passed 612 / 612 in its first full run (23.1 min).
- The public E2E tests and `playwright.config.ts` are byte-identical to the baseline's (item 30).

### 32. Unit counts
**90 / 90** (fresh clone of `e2c67db`, `npm run test:unit`, 4.2 s).

| | Files | Tests |
|---|---|---|
| A2, inherited (unchanged) | `admin-gate` 6, `email` 2, `privilege` 4, `security` 18 | **30** |
| A3, new | `cms-access` 12, `cms-rules` 24, `cms-slugs` 13, `cms-validation` 11 | **60** |
| Total | 8 files | **90** |

### 33. Integration counts
**243 / 243** (fresh clone, local MariaDB 11.4.13, a fresh `rawasy_t_*` database per file, 58 s).

| | Files | Tests |
|---|---|---|
| A2, inherited | `admission`, `mfa`, `migrations`, `privilege-boundary`, `promotion-boundary`, `rbac`, `review-races`, `secrets`, `sessions`, `sign-in`, `tokens` | **164** (as at the end of A2) |
| A3, new | `cms-catalogue` 9, `cms-general` 15, `cms-migration` 6, `cms-pages` 14, `cms-projects` 14, `cms-review` 7, `cms-services` 14 | **79** |
| Total | 18 files | **243** |

Two A2 integration tests were updated in `d85d2f2`, because A3 changes an interface they pin. No assertion was removed or
weakened, and each still checks an exact list:
- `migrations.test.ts`: the committed migrations are now 4 files, not 2 ("Applied (4): …", "Migration files OK: 4").
  The backup test's extra migration now takes the next free number, computed from the journal instead of the fixed
  `0002`, which A3 took.
- `rbac.test.ts`: the matrix has 130 keys, not 129. The test lists the added `projects.add_flags` row (all four roles)
  and still compares the full key set.

No A2 unit or browser test was changed (§53, §55).

### 34. Admin browser counts
**63 / 63** (fresh clone, `npm run test:admin`, the production build served by `server.js` on port 3401 with a fresh
`rawasy_e2e_*` database; 19.3 min).

| | Files | Tests |
|---|---|---|
| A2, inherited (unchanged) | `admin.spec.ts`, `gate.spec.ts` | **47** |
| A3, new | `cms.spec.ts` | **16** |
| Total | 3 files | **63** |

The 16 A3 browser tests:
1. The Owner sees every CONTENT area; a Reviewer sees the areas but not Users & access.
2. The dashboard shows real counts (all zero before any content) and nothing invented.
3. Create a generic page in English, then add Arabic (right to left) and mark English complete.
4. A stale save is refused with the stale message, the typed values stay, and the newer content is kept.
5. Leaving with unsaved changes asks first (in-app links and closing the tab).
6. An Editor can't register fixed pages or touch a legal record; an Admin registers the privacy record with the review
   label.
7. Create a service and a machine with a technical attribute, relate them, and change the order.
8. Create a project with a category and a service. A Reviewer adds a restriction; only the Owner clears it.
9. A stale page cannot clear a newer restriction.
10. An Admin archives and restores a client; the archived filter works; an Editor can't archive.
11. Search in English and normalized Arabic, the language filter, sorting, and the state in the address.
12. Certificate metadata only: the A4 note, no file input anywhere in the CMS, and the digit guard.
13. At 390 px the list stacks (each title cell keeps its lines) and the editor works; at 320 px no CMS screen scrolls
    sideways, the stale message included.
14. Dark mode follows the system; axe finds nothing on a list and an editor; there are no inline styles (CSP).
15. Gate off (production without `ADMIN_ENABLED`): every A3 route is the public 404 path and no CMS action runs.
16. Gate on (`ADMIN_ENABLED=1`): the same requests reach the database, so "off" means the gate stopped them.

**Combined (§61):**

| Suite | A2 inherited | A3 new | Total |
|---|---|---|---|
| Unit | 30 | 60 | 90 |
| Integration | 164 | 79 | 243 |
| Admin browser | 47 | 16 | 63 |
| Admin suites together | 241 | 155 | 396 |
| Public E2E (the public site's own suite, unchanged by A2 and A3) | — | — | 612 / 612 |
| **Combined** | | | **1,008 / 1,008** |

### 35. npm audit --omit=dev
**0 vulnerabilities** (fresh clone, after `npm ci`). A3 added no dependency: `package.json` and `package-lock.json` are
unchanged since `dcd089d`.

### 36. Full npm audit
`npm audit` exits 1 with **9 vulnerabilities (4 moderate, 5 high)**. All of them are in development-only tools, and the
list is identical to A2's final audit:
- the lint chain `braces` ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ← `eslint-config-next` (5 high).
  The only offered fix is `--force` to `eslint-config-next@14.2.35`, a breaking downgrade, so it is not applied.
- `esbuild` ← `drizzle-kit` (4 moderate). This dev-only advisory was accepted by the Owner in A2: no forced downgrade.

Nothing in either chain is part of the served app (item 35).

### 37. Lint
`npm run lint`: **0 problems** (fresh clone). This includes A2's rules:
- client components import only `@/server/admin/actions/*`;
- public files never import `src/server/**`;
- Drizzle's relational API is not used.

### 38. Typecheck
`npm run typecheck` (`tsc --noEmit`): **0 errors** (fresh clone).

### 39. Build
`npm run build`: **exit 0** (fresh clone, 31 s).
- No `DB_*`, `ADMIN_ENABLED` or `APP_ENV` variable was set; the log's environment lines before `next build` are empty.
- The routes are the public site's static and SSG pages, unchanged, plus 46 dynamic admin routes (item 28).
- The public build output equals the baseline's apart from build ids and chunk paths (item 30).

### 40. db:check
`npm run db:check`: **"Migration files OK: 4 (0000…0003). Seed migrations match the registries."** The seed files
regenerate byte for byte from `src/server/policy/registry.ts` and `src/server/cms/registry.ts`.

### 41. Visual evidence filename
**`rawasy-a3-evidence.zip`**, 38,267,418 bytes, not committed. It is in the session scratchpad:
`/tmp/claude-0/-home-user-Rawasy-Metal-Website/34883015-4850-5415-b502-fd42eee69ac3/scratchpad/a3/evidence/rawasy-a3-evidence.zip`.

**How it was captured.** From the fresh clone of `e2c67db` (the final code), after its QA passed:
- the production build was served by `server.js` with `APP_ENV=local`, on a throwaway local database dropped afterwards;
- one test account per role was seeded by the test-only script;
- every record shown was created through the screens themselves and is test data ("Test …", "Demo …").

**What it holds.**
- `INDEX.md`, `shots.json`, 108 full-page PNGs in `raw/`, and 10 contact sheets (5 desktop, 5 phone).
- 25 screens in up to five variants: desktop 1280 × 800 light (25) and dark (20), phone 390 × 844 light (25) and dark
  (18), narrow phone 320 × 640 light (20).

The brief's §59 list, screen by screen:

| §59 screen | Evidence id |
|---|---|
| dashboard | D01 (no content yet: real zero counts), D02 (with test content) |
| Pages list | P07 |
| Page editor EN/AR | P03 (English complete, Arabic draft, right to left) |
| Services list / editor | V01 / V02, and the order screen V03 |
| Projects list / editor | J01 / J02, and categories J04 |
| project restrictions | J03 (a Reviewer adds one), J05 (the Owner clears one, with a reason) |
| Machinery | M01 (editor with technical attributes), M02 (list) |
| Industries | I01 |
| Clients | L01, L02 (website validation), L03 (an archived client) |
| Certificates | C01 (metadata only, the A4 note) |
| archive filter | L01 (Status: Archived) |
| stale-edit message | S01 |
| permission-denied | P06 (an Editor on a legal page), and P01 (an Editor's new-page choices) |

The set also has P02 (a reserved slug refused), P04 (an Admin registering fixed pages) and P05 (a legal page record
with its review label).

**Two notes on reading the evidence.**
- *Sticky bars.* Full-page captures are taken from the top with the top bar and the editor's save bar in their place in
  the page. In the browser, both stay on screen while the page scrolls. The first capture run drew them at the window's
  edge, over the title and the first fields (a full-page screenshot artefact, not the screen), so it was redone with this
  capture-script fix. Nothing in the product changed for it.
- *The phone list fix.* Looking through the second run's phone captures found the run-together title cells (item 29).
  They were fixed in `e2c67db`, and the package was captured again from that final code.
- *Recovery codes.* The test accounts get a second factor but no recovery codes from the seed script, so the
  dashboard's security card reads "0 of 10 left". That is the seed, not the product.

### 42. Responsive / overflow result
**0 page-level horizontal overflow in all 108 captures**: document width equals window width at 1280, 390 and 320 px,
light and dark. The browser suite checks the same at 390 and 320 px on every CMS screen, the stale message included
(item 34, test 13).

The one overflow found on the way was fixed in `a7e501e`, with a test that fails before the fix (item 29). The evidence
dry run had found the stale message's button at 320 px widening the page to 340 px. The phone lists' run-together title
cells were not an overflow; they were fixed in `e2c67db`, also with a test that fails before (item 29).

At 390 and 320 px:
- lists stack into labelled cards;
- editors use one column, with full-width fields and buttons whose labels wrap;
- the CONTENT navigation lives in the Menu panel;
- Arabic fields stay right to left.

### 43. Known limitations
1. **Leaving with unsaved changes.** Closing or reloading the tab (`beforeunload`) asks first, and so does every in-app
   link. The browser's own Back / Forward buttons are not intercepted, so the typed values are lost then. Next.js offers
   no blocking hook for history navigation, and a `popstate` trap would break Back for every admin page. Documented per
   §48.
2. **Permissions are read per request.** A change is decided on the acting session's permission set as read at the start
   of the request (A2's pattern). The transaction re-checks that the user is still active and the session still live
   (A2's `lockActor`), but not the role set itself. A role removed while a request is in flight takes effect from the
   next request.
3. **Two saves that newly link each other at the same moment can deadlock.** Examples: a service adding a machine while
   that machine takes the service as its primary one, or two services adding each other as related. The deadlock comes
   from the share locks of finding 3. InnoDB stops one save and `inTransaction` retries it once (A2). In the rare case
   that the retry deadlocks too, the person sees an error and saves again.

   Also, "featured projects must list the service" is checked when the service is saved. It is not kept up when a
   project later drops the service; the service's next save names the projects to remove.
4. **Search** is a substring match over normalized text, with no ranking, stemming or full-text index, and at most 100
   characters. The slug is matched only for ASCII queries. Pickers offer at most 500 items per type.
5. **Rich text** is paragraphs and line breaks only, edited as plain text (§36: no HTML or WYSIWYG). Headings, lists and
   links come with A5's structured editing, if approved.
6. **Address validation is syntactic.** A client website must be `https://` with a dotted, public-looking host name (IP
   literals, `localhost` and credentials are refused), and it is never fetched. A canonical override is checked as a
   same-site path, not against the routes that exist.
7. **No history yet.** There are no revisions, compare, rollback, Trash, purge or delete (A8). Archived is the only
   "removed" state.
8. **No preview, no publication.** Nothing a record says reaches the public site before A8/A9.
9. **A2's gate test still uses the old reply encoding (reported, not changed).**
   - React's current reply encoding names a FormData argument's fields `_1_<name>` and needs them before part `0`.
   - The A2 gate test `e2e-admin/gate.spec.ts` still sends `1_<name>` after part `0`, so its forged sign-in reaches the
     action without fields.
   - The test remains valid: its positive control shows the same request reaching the database with the admin on, and
     none with it off. But the request is not "as the page sends it".
   - A2 tests stay unchanged in A3 (§53, §55). The A3 spec uses the corrected encoding, and a small fix of the A2 helper
     is offered for the Owner's decision. CLAUDE.md's gotcha is corrected.
10. **Fixed-page records are registered by hand.** A3 creates no record for the site's 14 fixed pages: the Owner or an
    Admin registers one when it is needed. The A9 import creates them all.
11. **Two copies of the required fields.** The editor's language state reads the `required` fields in `kinds.ts`, and
    the lists' SQL reads `REQUIRED` in `list.ts`. They agree for all eight types today (checked by hand), but no test
    ties them together. A small test, or deriving the SQL list from the kind specs, is offered as a follow-up.

### 44. Deferred to A4 (Media Library)
- Uploads, the media library and its tables.
- Every media reference and alt text: `media_id`, `feature_media_id`, logos, certificate documents, project photos,
  service and industry images.
- Private certificate originals and public redacted files.
- `RAWASY_DATA_DIR` and `/media/u/…`.
- Restricted media items for the 13 held-back files.
- The `media.*` permissions in use, and the flags' effect on media.

### 45. Deferred to A5 (Page Builder / Visual Editor)
- Page sections and blocks: the approved sections as structure-locked block types.
- Headings, lists and links inside long text.
- Any visual or WYSIWYG editing, and page layouts.

### 46. Deferred to A6 (Global Site Controls)
- Navigation and menus. A3 stores only a page's "Hide from menus" working setting and its navigation label.
- Global SEO defaults, and organization and schema settings.
- Contact details, site settings and the footer.

### 47. Deferred to A8 (Publishing, Versions, Audit & Backup Safety)
- The review and publish workflow and its UI. No Publish button, label or state exists in A3.
- Revisions (the table exists and stays empty), compare and rollback, scheduling and preview links.
- The public projections (`published_documents`), cache invalidation, and redirects for changed slugs.
- Trash and purge, the backup UI and the audit viewer.

Restrictions and translation states are recorded now, so that A8 can enforce them at publication.

### 48. Current-content migration explicitly NOT performed
No current content was imported. The database holds no page, service, project, machine, industry, client or certificate
of the live site; A3 starts empty. Every record in the tests and the evidence is test data ("Test …", "Demo …") in
throwaway local databases, dropped afterwards. The public website still renders entirely from `src/content/*` (static).
The full import, its parity proof and the cutover belong to A9.

### 49. main unchanged
`main` is at `474f61f10f12981e41f9b7e7fd6065a0ec9da541`, as at the start (brief §1), checked with `git ls-remote` after the
final push. No commit, merge or push touched it.

### 50. Preservation refs unchanged
After the final push, `git ls-remote origin` shows every preservation branch where it was:
- `preserve/pre-admin-a3` → `dcd089d33c474b28c725d35e3537fa8f8d3aef02` (created in A3, item 2);
- `preserve/pre-admin-a2` → `ed6b6521f8e5cae04f983acd298e0ef1e6b9aac0`;
- `preserve/pre-admin-a2-correction1` → `b47d8e533bc59543f9d2de839d10894ba63831cb`;
- `preserve/pre-admin-a2-correction2` → `bca33aad848b84a629de76f6a658a9316408a5d8`;
- `preserve/pre-admin-a1` → `74220ea`, `preserve/pre-namecheap-adapter` → `422c397`, and every earlier stage checkpoint,
  unchanged.

No branch was deleted, renamed or force-pushed.

### 51. Nothing deployed
- Nothing was uploaded, packaged for Namecheap or deployed.
- No production or staging CMS database was created, and Namecheap's MariaDB was never connected.
- cPanel, DNS, SSL and mail were not changed.
- No production secret was created, and the production admin was not enabled.

Every A3 database was a local, throwaway MariaDB 11.4 database (`rawasy_t_*`, `rawasy_e2e_*`, a scratch database and
the evidence database), dropped after use. Only the local development database from A2 (`rawasy_dev`, A2 tables only)
remains in the local container, as it was. The public website still builds and runs without any database. A release
built from this branch serves no admin unless `ADMIN_ENABLED=1` (item 30).

## Decisions for the Owner (none blocks A3's review)
1. **The three additions beyond A1's catalogue (item 8):** `machine_attributes`, `industry_projects` and
   `clients.is_featured`. Each follows an existing A1 pattern for something the A3 brief asks for. Keep them, or name
   another shape.
2. **The permission key `projects.add_flags`.** It fills A1 §5.3's row "Project flags — add", which §5.4 left without a
   key (A3 brief §38). All four roles hold it.
3. **Certificate restore is Owner-only.** It follows from `certificates.archive` being the Owner's alone. An Admin can
   edit and order certificates but cannot archive or restore one.
4. **Industries have no per-record SEO**, because A1 defines none (item 18). The Industries page's SEO lives on its page
   record.
5. **The A2 gate test's reply encoding (item 43.9).** Apply the small helper fix (`_1_` fields before part `0`) in a
   later phase, or keep the test as it is.
6. **Showing client websites publicly** is not decided. They are stored, but no public use exists until A9.
7. **The required-field follow-up (item 43.11):** a test that ties the editor's and the lists' required fields together,
   when you choose to schedule it.

## How to run (local only)
Follow the README, section "Admin (local development)", steps 1–5:
1. Start a local MariaDB 11.4.
2. Put the settings in `.env.local` (`APP_ENV=local`, `DB_*`, a throwaway `AUTH_ENCRYPTION_KEY`).
3. Migrate: `npm run db:check`, then `node --env-file=.env.local scripts/db-migrate.mjs up`. A database migrated during
   A2 takes the two A3 files with the same command.
4. Start the app (`npm run dev`, or `npm run build && npm start`). Create the first Owner with
   `node --env-file=.env.local scripts/admin-bootstrap.mjs --email … --name …`, then sign in at `/admin/login`.
5. Use the CONTENT group in the sidebar.

The tests:
- `npm run test:unit`;
- `npm run test:integration` and `npm run test:admin`, with `TEST_DB_HOST/PORT/USER/PASSWORD` set;
- `npm run test:e2e` for the public site, which needs no database.

## Next steps
- The Owner's independent review of A3: this report, the evidence package `rawasy-a3-evidence.zip` (not committed), and
  the commits in item 3.
- A4 (Media Library) starts only when the Owner approves A3 and says so (§66).
- Production and staging stay untouched: no deployment, no CMS database, no Namecheap change (§65).
