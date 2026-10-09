# A1 — Content migration plan

**Status:** Phase A1 specification. **Design only — no content is migrated in A1, no content file is replaced.** T1 is
locked to **Option B** (A1 Correction 1, §3): A3–A8 build the import tool and its per-domain tests against local and
staging databases while the production public site stays on its static source; A9 "Full Content Migration & Complete
QA" runs the complete import, the full parity proof and **one controlled cutover**, with a rollback to the static source
until A9 is accepted.

Related: [A1-CONTENT-MODEL](A1-CONTENT-MODEL.md) · [A1-DATABASE-SCHEMA](A1-DATABASE-SCHEMA.md) ·
[A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md) · [A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) ·
[A1-ARCHITECTURE](A1-ARCHITECTURE.md).

---

## 1. Goal and rules

Move every piece of content the public site shows from the TypeScript modules into the database **without changing a
single visible pixel, word, address, link, image or SEO signal**, and without any period where restricted media could
become public.

1. **Identical output.** For every one of today's 102 public addresses (+ the 404s, the sitemap, robots, manifest), the
   database-backed build must produce the same visible HTML, the same resolved page data, the same CSS and JS (by module
   set), the same images (same URLs, same bytes) and the same structured data as the static build at the checkpoint —
   proven with the project's existing freeze-proof method (CLAUDE.md, "Approved pages are frozen").
2. **Byte-exact text.** Strings are copied as stored — no trimming, no Unicode normalization, no quote or dash
   "fixing". Invisible characters are preserved (for example the left-to-right mark before `+966` in the Arabic phone
   hint).
3. **Idempotent import.** The import tool can run any number of times: it upserts by **legacy key** (slugs for entities,
   today's `MediaId` for media, route keys for pages, dictionary keys for interface text) and never duplicates.
4. **Restricted media stay restricted** at every step (§7).
5. **Reversible until A9 is accepted.** The static modules stay in the repository and the last static-mode release is
   kept ready: redeploying it returns the whole public site to them at once (§3, §9). There is no per-domain switch.
6. **Legal text is copied verbatim, never edited** (§6.11).
7. Every imported aggregate is written with an `import` revision and published through the normal publish pipeline
   (projection, references, cache tags, audit with `actor_type = 'cli'`), so migrated content behaves exactly like
   content published in the admin.

## 2. Responsibilities

| Role | Responsibility |
|---|---|
| Developer (the phase's implementer) | import tool, mappings, parity proofs, tests, reports |
| Owner | approves each phase and the single A9 cutover, confirms open content questions (asset inventory), decides the open points in §3.3 and §7 |
| Reviewer (Owner's choice) | spot-checks Arabic and English text in the admin after import |

## 3. When the public site switches to the database — T1 locked: Option B (A1 Correction 1)

The website is not publicly deployed yet, and the Owner wants the complete admin/CMS before public hosting is activated.
T1 is therefore locked to **Option B**; the per-domain cutover during A3–A8 that A1 first recommended (Option A) is
withdrawn. The phase order A1 → A9 is unchanged.

### 3.1 What runs where

| Phase | Production public site | Admin, database and import (local and authenticated staging only) |
|---|---|---|
| A2 | static source (as today) | authentication, roles, the admin shell — built and tested locally (A1-ARCHITECTURE §7.3) |
| A3 | static source | working-copy CMS, published projections, preview, revisions, the cache architecture, redirects, the media registry; the import tool for A3's domains with its round-trip and parity tests (§8) against local and staging databases |
| A4–A8 | static source | media, page builder, global controls, forms, publishing/audit/backup safety; each phase extends the importer and its parity tests to its domains |
| A9 | **one controlled cutover** to the database | complete import, full freeze/parity proof, cutover, rollback kept ready until A9 is accepted |

Admin edits made before A9 are visible only in preview and staging; nothing an editor does before the cutover reaches
the production public site.

**Mechanism:** one switch for the whole public site, `CONTENT_SOURCE=static|database`, fixed into a release when it is
built (A1-ARCHITECTURE §6). `src/content/repository.ts` keeps its functions' names, arguments and return types ("Phase 2
can replace the static modules … without changing any component", its header comment) and reads either the static
modules or the public read model. Components do not change. There is no per-domain or per-page switch.

### 3.2 The A9 cutover (outline; the A9 brief settles the details)

1. **Content freeze** in the static source for the cutover window (no content commits).
2. **Rehearsal in staging:** migrations, the complete import from the cutover commit's static source, the
   database-mode release built from the **same commit** as the last static release (so only the content source
   differs), and the full parity proof of §8 against that static release.
3. **Production:** fresh database backup (from the second cutover on), migrations, the same complete import (idempotent,
   with its text equality report), deployment of the database-mode release, page and image warm-up, the smoke checks of
   §8 on the live site.
4. **Rollback kept ready:** the static-mode release archive stays deployable until the Owner accepts A9; rolling back is
   redeploying it (minutes, no database step). The database is left as it is, and edits made after the cutover stay
   there for the next attempt: on a retry the importer leaves every aggregate edited since its import revision
   untouched and lists it, unless the Owner chooses to start again from the static source (an A9 decision).
5. **After acceptance only:** the static modules become the frozen test fixture (§8, item 6) and the static release
   is retired from the rollback plan.

### 3.3 Content entered before A9 (Owner decision, B16)

During A3–A8 the staging database is a test bench. Proposed: **staging content is not carried into production**; real
content changes before A9 keep going through the static source (reviewed code changes, as today), so the A9 import has
one source of truth. If the Owner wants specific aggregates written in staging to go live, they are exported and
re-imported after the cutover through the normal publish pipeline (an A9 decision).

## 4. Inventory: current source → future storage

Records = top-level entries; "pairs" = English/Arabic text pairs counted in A1 (1,220 in total).

| Current source | What it holds (A1 count) | Future entity / table | Transformation | Validation | Risk | Rollback |
|---|---|---|---|---|---|---|
| `src/content/home.ts` → `home` | homepage copy (13 groups, 72 pairs) | homepage `pages` row + `home.*` sections (content per locale; settings: media ids, actions, selections) | one section per group (§5.1); `string[]` lines → JSON arrays; `home.services.all` also feeds the header's "All services" item → menu item label | homepage freeze proof; every pair present byte-equal | wrong section mapping | static release (§9) |
| `src/components/commerce/home/data.ts` (view rules) | hero photo `site/laser-sparks` with the Laser Cutting cover's alt text; workshop photo `services/fabrication-workshop` with its caption; closing photo `site/riyadh-night`; engraving photos excluded; card categories = first two; featured projects = `featured` and no flag | section settings (media ids, alt texts copied), selections (`automatic: featured`, limit 6), media restrictions (engraving) | rules become data + code policy | same images, alts, six project cards in the same order | an implicit rule missed | freeze proof catches it |
| `about.ts` → `about` | About page (15 groups, 102 pairs; 4 project slugs; 7 workshop photos; 6 process steps) | `about` page + `about.*` sections | project slugs → manual selection; photos → media ids | About freeze proof | — | static release (§9) |
| `pillars.ts` → `pillars` | 6 pillars (12 pairs), used on the homepage and About | one **reusable section** linked from both | — | both pages identical | — | static release (§9) |
| `metrics.ts` → `metrics`, `capabilityStatements` | 4 figures (with provenance), 4 statements | one reusable "company figures" section (statistics items keep `source` admin-only) | numeric `value` + display strings preserved ("04", "12,000") | strip and About identical | display formatting drift | static release (§9) |
| `process.ts` → `processSteps` | 6 steps (18 pairs) — **read by no page today** | an **unpublished** reusable section, or skip (Owner decision) | — | not public | none | — |
| `services.ts` → `services` | 6 services (63 pairs): slug, index, names, taglines, summaries, body, highlights, cover, supporting, gallery (21 captioned items), machines, projects, provenance | `services` + translations + `service_gallery_items` (+ captions) + `service_machines` + `service_featured_projects`; `index` ("01"…"06") derived from the `services` ordering | gallery captions per locale; body paragraphs → rich text; **Laser Engraving cover/supporting set to empty** (restricted media, §7) | six service pages, overview, homepage, menu identical; index values equal | engraving media leak | restricted media can't project |
| `service-details.ts` → `serviceDetails` | per-service page copy (297 pairs): meta facts, overview, scope, process, machines, applications, gallery, why, related, projects, CTA | each service's own `page_sections` (`service.*` blocks, locked) and `service_related_services` | repeated items get stable ids (§5.5 of the content model) | six service pages identical | item pairing | ids generated from item slugs |
| `src/components/commerce/services/looks.ts` | per-service hero/scope/process/gallery variants and icons | the same values as section settings | — | identical markup | — | — |
| `machines.ts` → `machines` | 6 machines (24 pairs), power where printed | `machines` + translations; `primary_service_id`; media | `powerWatts` absent → `NULL` | capabilities, homepage, services, About identical | inventing a value | validation: NULL stays NULL |
| `capabilities/data.ts` → `MACHINE_ORDER` | showcase order | `machines` ordering | — | order identical | — | — |
| `capabilities.ts` → `capabilitiesPage` | Capabilities page labels (46 pairs) | `capabilities` page sections | — | Capabilities freeze proof + its 72 tests | — | static release (§9) |
| `projects.ts` → `projects` | 34 records (68 pairs), 59 photo references, 6 featured, 8 flagged, 2 internal notes, no optional details | `projects` + translations + `project_media` + `project_category_assignments` + `project_services` + `project_flags`; `note` → `source_note` | flags: `confirm-authorship` → `authorship_unconfirmed`, `render` → `product_render`, `ai-watermark` → `ai_watermark` | 68 project pages, overview, cards identical; 27 showcased; 7 pages without photos | flag policy drift | code policy unchanged |
| `projects.ts` → `projectCategories` | 9 classifications (filter order) | `project_categories` + translations + ordering | — | filter identical | — | — |
| `projects.ts` → `withheldMedia`, flag rules | 3 withheld files; `isShowcased`, `projectDetailMedia`, `featuredProjects` | media flags + code policy (§7) | — | 13 held-back files never projected | **leak** | three safeguards |
| `industries.ts` → `industries` | 8 sectors (16 pairs), media, services, basis | `industries` + translations + `industry_services`; `basis` → `classification` (public) | — | Industries + homepage identical | — | — |
| `clients.ts` → `clients` | 21 clients, 42 logo files | `clients` + translations; ordering = profile order | — | wall identical; no counts | — | — |
| `certificates.ts` → `certificates` | 3 certificates (20 pairs), facts, 4 previews, 3 thumbs, provenance (licence expiry note) | `certificates` + translations + `certificate_facts` (+ translations) + `certificate_documents` (public previews); expiry note → `source_note` | — | register, dialog, file hashes identical; digit guard passes | an ID number entering a public field | digit guard at publish |
| `pages.ts` → `servicesPage`, `industriesPage`, `clientsPage`, `certificatesPage`, `projectsPage`, `projectDetailPage` | page copy and labels (≈ 155 pairs) | the pages' sections; `projectsPage.featured.slug` / `editorial.slugs` → selections; `projectDetailPage` + `projectsPage.refLabel` → `project_detail` template | — | pages identical | — | — |
| `pages.ts` → `servicePage` | labels shared by all six service pages (31 pairs) | interface text (`ui_strings` group `servicePage`) | — | six pages identical | — | — |
| `contact.ts` → `contactPage` | Contact page and quote-form copy (93 pairs), project types, file rules | `contact` page sections + `forms` ('quote', **delivery_mode = handoff**) + `form_fields` (10 system fields) + translations | form copy → `form_translations.copy`; field texts → `form_field_translations` | Contact freeze proof; **golden email/WhatsApp/copy outputs of `commerce-contact.spec.ts` unchanged** | form behaviour change | system fields stay code-defined |
| `company.ts` → `company`, `primaryWhatsApp` | legal and brand names, statement, address, city, country, postal code, approximate geo, 2 phones, email, website, Facebook, vision | `site_settings` + translations + `company_phones`; primary WhatsApp → `primary_whatsapp_phone_id` | address lines → JSON array | shell, footer, contact, structured data identical | — | — |
| `src/lib/seo.tsx` (hard-coded street address) | `"Al Mashael, Sulay"` / `"حي المشاعل، السلي"` in Organization JSON-LD | `site_setting_translations.street_address` | — | homepage JSON-LD identical | — | — |
| `seo.ts` → `siteName`, `seo` | site name; titles and descriptions of 11 routes | `site_setting_translations.site_name`; `page_translations.seo_title/seo_description` | — | every `<title>`, description, OG, Twitter tag identical | — | — |
| `navigation.ts` → `headerNav`, `footerNav`, `legalNav`, `routeLabels` | 8 header links, 6 footer links, 2 legal links, 11 page labels | `menus` (`header_main`, `footer_company`, `footer_legal`, `header_services` with the services collection) + items + translations; `routeLabels` → `page_translations.nav_label` | — | header, phone sheet, footer, breadcrumbs identical (incl. `aria-current`) | — | — |
| `src/i18n/dictionaries.ts` | interface strings (a11y, controls, common, footer, 404) | `ui_strings` keys (seeded by migration) + translations (imported) | — | shell and 404 identical | — | — |
| `legal.ts` → `legalDocuments`, `legalChrome` | Privacy (14 sections, 5 pending notes) and Terms (9 sections, 2 pending) — 59 pairs; dates 2026-09-25 / 2026-09-24; chrome labels | `privacy`, `terms` pages (`requires_legal_review = 1`, `effective_date`) with `legal.section` sections; chrome → interface text | **verbatim** (§6.11) | legal pages byte-identical; pending notes present | an accidental edit | import refuses any text difference |
| `src/content/media.generated.ts` → `mediaRegistry` | 143 entries: src, width, height, blur placeholder | `media_assets` + `media_files` (`storage_area = 'release'`) + `public_media` | `legacy_key` = MediaId; alt texts from their usages | all image URLs, sizes and placeholders identical | — | — |
| `docs/ASSET_INVENTORY.md` | open questions and flags per asset | `media_flags` notes, `source_note`, `rights_note` | written by hand during import review | — | — | — |
| `src/i18n/config.ts`, `routes.ts`, `src/lib/page-meta.ts` | locales; route table; every route `published` | `locales` seed; route table stays in code; system pages imported as published | — | sitemap identical (102 addresses) | — | — |
| `public/og`, `public/brand` | share images, logos | stay in the release (design assets); the default share image becomes a setting later (A6) | — | identical | — | — |
| `src/content/types.ts` | the public content types | stay: the published read model returns these shapes | — | typecheck | — | — |

## 5. Transformations in detail

- **Identity:** entities get ULIDs; their slugs stay their public identity. An `import_map` (legacy key → id) is part of
  the import output and stored in the import revisions, so the import can be re-run without creating duplicates.
- **Localized values** (`Localized<T>` = `{ en, ar }`) → one translation row per locale, field by field. `string[]`
  values (headline lines, highlights, paragraphs, steps) → JSON arrays or rich-text paragraphs, order kept.
- **Lists of objects inside copy** (scope items, process steps, why points, divisions, beyond items, workshop photos) →
  section items with stable ids derived from the item's own slug where it has one (e.g. `power`, `bevel` in
  `looks.ts` icons), else from its position at import (`i1`, `i2` …), and the same id used in both languages.
- **References by slug** (`ServiceSlug`, `ProjectSlug`, `MachineSlug`, `MediaId`) → ids through the import map; an
  unresolvable reference stops the import.
- **Provenance** (`source.basis`, `pages`, `note`) → `source_basis`, `source_pages`, `source_note` (admin-only).
- **Translation status:** every imported row is `complete` (the content is approved in both languages).
- **Publication:** every imported aggregate is published through the pipeline (import revision → projection →
  `published_documents`).
- **Orderings:** array order in the modules → `entity_orderings` (services, machines in `MACHINE_ORDER`, projects in
  record order, categories in filter order, clients in profile order, industries, certificates).

## 6. Domain notes

1. **Homepage** — ten bespoke sections (clients and compliance share one sheet), locked; selections reproduce today's lists exactly (services all, machines
   all in showcase order, six featured projects, industries all, clients all, certificates all).
2. **Navigation** — four menus; the services dropdown is the `services` collection plus "All services"
   (`home.services.all`) and the quote action; current-page marks stay computed by code.
3. **Services** — six aggregates with their sections; Laser Engraving without photos (§7); "general workflow, not a
   certified procedure" note kept as a locked field; gallery photos never repeated in the page's project cards
   (validation); `projects/canopy-tree-1` not in any gallery (restricted).
4. **Projects** — 34 aggregates; 27 showcased; 7 detail pages without photos (5 flagged projects + 2 whose only photos
   are withheld — exactly as today); optional details empty; the two internal notes admin-only.
5. **Machines** — six; two without stated power; never a maker.
6. **Industries** — eight; classification public (profile sector vs website classification).
7. **Clients** — 21, no counts anywhere.
8. **Certificates** — three, public redacted previews only (the repository has no originals); the licence's expiry
   question stays an admin note; digit guard at publication; file hashes checked by the existing spec.
9. **Contact** — page sections; the quote form imported with `delivery_mode = handoff` (no behaviour change).
10. **SEO** — titles/descriptions for system and legal pages; detail pages keep deriving theirs from title/summary
    (SEO fields left empty so the fallback reproduces today's output); hreflang, canonical, Open Graph and structured
    data generated as today.
11. **Legal** — copied verbatim (every string compared byte for byte after import); `requires_legal_review = 1`;
    effective dates 2026-09-25 (Privacy) and 2026-09-24 (Terms); pending notes kept. Nothing in the migration edits
    legal text; any later change follows the legal gate.
12. **Media** — 143 release files registered; 13 restricted (§7); no URL change before A9; the option of serving the
    same addresses from persistent storage (A1-MEDIA-STORAGE §12; T7) applies only with the A9 cutover and is decided by
    the Owner. The import **reproduces today's
    decisions**: the 130 files the site shows today are imported `approved`; the asset inventory's open questions about
    them (stock-looking service photos, authorship of a few gallery items, low resolution) become `rights_note`s and
    *informative* flags, not blocking ones — otherwise the site would change. Turning any of them into a blocking
    restriction is an Owner decision taken in the admin after migration.
13. **Settings** — company, contact, SEO defaults, interface text; theme overrides empty (approved design).

## 7. Held-back media: the 13 rules carried into the database

| Files | Today's rule | Database representation | Never public because |
|---|---|---|---|
| `projects/wheat-monument-1`, `projects/stainless-landmark-1`, `projects/billboard-structure-1` | `withheldMedia` (AI-image watermark) | `usage_status = restricted`, flag `ai_watermark` | not deliverable → no `public_media` row; publish gate; projection filter |
| `projects/canopy-tree-1`, `projects/lattice-cubes-1`, `projects/seed-sculpture-1` | project flag `confirm-authorship` (all photos of the project held back) | project flag `authorship_unconfirmed` **and** each photo restricted with flag `authorship_unconfirmed` | project policy (no photos, not showcased) **and** media rule |
| `projects/laser-cut-bench-1`, `projects/litter-bins-1`, `-2`, `-3` | project flag `render` | project flag `product_render` **and** each photo restricted with flag `product_render` | as above |
| `services/engraving-nameplates`, `services/engraving-wood`, `services/engraving-rotary` | asset inventory item 12; `HELD_BACK_MEDIA` in the packaging script | restricted, flags `third_party_branding` / `rights_pending` (as noted in the inventory); the Laser Engraving service's cover and supporting slots empty | media rule; no displayed slot references them |

Additional guarantees:
- `scripts/package-namecheap.mjs` keeps excluding the 13 files from every archive until the release no longer carries
  them (the relocation option, applied only with the A9 cutover, moves media out of the release; the packaging check is
  then updated to the database's restricted list, with the Owner's approval).
- Parity proof includes: the 13 addresses answer 404 on the package; none appears in any page, page data, sitemap or
  `public_media`; the restricted count in the database is exactly 13 after import.
- Lifting a restriction requires RAWASY's confirmation, `media.approve`, a note, and is audited — never a side effect
  of migration.

## 8. Validation and parity proof (per domain in local and staging tests during A3–A8; complete in A9 before the cutover)

1. **Counts:** aggregates, translations, sections, items, media, flags, orderings equal the inventory above.
2. **Round trip:** the published read model returns objects **deep-equal** to the static modules' objects for every
   repository function (`getServices()`, `getProjectBySlug(slug)` …), in both languages — a test that runs against the
   seeded database.
3. **Freeze proof** of all 102 addresses + 404s against the checkpoint build: visible server HTML (normalized as in
   CLAUDE.md), resolved RSC trees, CSS bytes and stylesheet lists, JS module sets, screenshots EN/AR × light/dark ×
   desktop/phone.
4. **SEO:** `sitemap.xml`, `robots.txt`, every page's title, description, canonical, alternates, Open Graph, Twitter and
   JSON-LD identical.
5. **Media:** every image URL and srcset identical; the 13 held-back addresses 404 on the package; `public_media` = 130
   deliverable release items.
6. **Full E2E suite** (612 today) passes against the database-backed build. Specs that import `src/content/*` as their
   oracle (11 specs) keep doing so while the static modules exist; once A9 is accepted those modules move to a frozen
   fixture that also **seeds the test database**, so tests stay deterministic after the Owner starts editing production
   content.
7. **Text equality report:** every imported string compared byte for byte with its source (legal pages included).

## 9. Rollback

- **A2–A8:** the production public site never changes (static source), so there is nothing public to roll back; a
  phase's own work is rolled back with its `preserve/pre-<phase>` branch.
- **From the A9 cutover until A9 is accepted:** redeploy the retained static-mode release — the whole public site reads
  the static modules again at once (no database step). Edits made in the admin after the cutover stay in the database
  for the next attempt.
- **Release:** every phase has a `preserve/pre-<phase>` branch; redeploying the previous archive is the existing
  rollback.
- **Database:** pre-migration backup (`mariadb-dump`) restored with the migration CLI's restore procedure (and a new
  cache epoch, A1-PUBLISHING-VERSIONS §8.2).
- **After A9 is accepted** (static modules retired to fixtures): rollback = restore the database backup taken before
  the change, or re-import from the frozen fixture.

## 10. Risks

| Risk | Mitigation |
|---|---|
| A view rule hidden in a component is missed | freeze proofs over every address; the inventory above lists the known ones |
| Restricted media becomes public | three safeguards (A1-MEDIA-STORAGE §4); 13-file checks in every proof |
| Text altered by normalization | byte-exact copy and comparison; no trimming |
| Arabic/English item misalignment | stable item ids, validated coverage in both languages |
| Legal text changed | verbatim import, byte comparison, legal gate afterwards |
| Mismatches discovered late (one public switch in A9, Option B) | each phase from A3 builds its domains' importer with round-trip and parity tests in local and staging databases; A9 reruns proven tests on the complete set and rehearses the cutover in staging |
| The static source and the staging database diverge before A9 | staging content is test content (§3.3); A9 imports from the cutover commit's static source |
| Tests lose their oracle when modules retire | frozen fixture seeds the test database (after A9 is accepted) |
| Performance change (database mode renders at runtime) | page warm-up after release; the fail-closed cache handler; measured in staging before the cutover |

## 11. Forms: no dishonest period (A7)
The quote form is imported with `delivery_mode = handoff`, so migration changes nothing. Storing enquiries is a
separate, later switch with its own gate: legally reviewed privacy policy published first; "received" shown only after
the database commit; hand-off kept as fallback ([A1-CONTENT-MODEL](A1-CONTENT-MODEL.md) §14.3).

## 12. URL compatibility
Every current address keeps working with the same content: system routes are unchanged route files; services and
projects keep their slugs; media keep their URLs (until A9) or are served at the same URLs (the relocation option, only
with the A9 cutover); the proxy's locale
redirects are unchanged. New generic pages cannot take a reserved or system slug. Redirects are needed only for future
slug changes, and they are created automatically at publication.
