# A1 — Content model

**Status:** Phase A1 specification. **Design only — nothing in this document is implemented.** It defines what the
admin will manage and how: structured entities, pages, the section (block) model, localization, SEO, navigation,
settings, forms, and the rules that keep the public site exactly as approved.

Related: [A1-ARCHITECTURE](A1-ARCHITECTURE.md) · [A1-DATABASE-SCHEMA](A1-DATABASE-SCHEMA.md) ·
[A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) · [A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md) ·
[A1-SECURITY-RBAC](A1-SECURITY-RBAC.md) · [A1-MIGRATION-PLAN](A1-MIGRATION-PLAN.md).

---

## 1. Principles

1. **The CMS feeds the approved components; it does not replace them.** Every section of every approved page becomes a
   *bespoke block type* whose data is exactly what that component reads today. No phase changes what the visitor sees:
   A3–A8 build the CMS beside the static production site, and the single A9 cutover changes only where the data comes
   from, proven pixel for pixel (T1 = Option B, [A1-MIGRATION-PLAN](A1-MIGRATION-PLAN.md) §3). New generic blocks (A5)
   are built in the same Modern Commerce design system.
2. **Facts are source-strict.** Records carry admin-only provenance (`source_basis`, `source_pages`, `source_note`);
   optional facts stay empty until confirmed; a statistic or a machine's power needs a provenance note before it can
   be published. The CMS cannot make something true, but it records who confirmed it and never invents defaults.
3. **Structured where the data is structured, flexible where the layout is.** Entities (services, projects, machines,
   industries, clients, certificates, media, menus, settings) are relational tables. Page composition (sections, their
   settings and copy) is a fixed relational skeleton with **validated, versioned JSON** per block type, so a new block
   type needs no database migration and no unvalidated data ever reaches a page.
4. **Public projection.** What visitors see is a projection of a published revision with every admin-only field
   removed ([A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) §1).
5. **No code from the admin.** No HTML, script, CSS, template or query is ever accepted as content (§13).
6. **English and Arabic are equals.** Both are written, reviewed and published together; neither is generated from
   the other.

## 2. Aggregates at a glance

| Aggregate | Tables (see A1-DATABASE-SCHEMA) | Public surfaces |
|---|---|---|
| Page | `pages`, `page_translations`, `page_sections`, `page_section_translations` | its route; generic pages at `/{locale}/{slug}` |
| Reusable section | `reusable_sections` (+ translations) | every page that links it |
| Service | `services` (+ translations), `service_gallery_items` (+ translations), `service_machines`, `service_related_services`, `service_featured_projects`, its `page_sections` | `/services/{slug}`, services overview, homepage, header menu, industries, capabilities, contact form options |
| Machine | `machines` (+ translations) | capabilities (fleet, power, console, register), homepage machinery, service pages, About |
| Project | `projects` (+ translations), `project_media`, `project_category_assignments`, `project_services`, `project_flags` | `/projects/{slug}`, projects overview, homepage, About, service pages |
| Project category | `project_categories` (+ translations) | gallery filter, cards |
| Industry | `industries` (+ translations), `industry_services` | industries page, homepage |
| Client | `clients` (+ translations) | clients wall, homepage, About |
| Certificate | `certificates` (+ translations), `certificate_facts` (+ translations), `certificate_documents` | certificates register and dialog, homepage compliance, About |
| Ordering | `entity_orderings`, `entity_ordering_items` | order of every list of that collection |
| Menu | `menus`, `menu_items` (+ translations) | header, phone menu, footer |
| Site settings | `site_settings` (+ translations), `company_phones`, `ui_strings` (+ translations) | shell, footer, contact, structured data, titles |
| Theme | `theme_settings`, `design_token_overrides` | every page (empty = approved design) |
| Form | `forms` (+ translations), `form_fields` (+ translations) | the quote form |
| Media (approval, not draft/publish) | `media_*`, `public_media` | wherever referenced |

## 3. Localization

### 3.1 Model
- `locales` lists the languages (`en` default, `ar` RTL, `html_lang` `ar-SA`, `og_locale` `ar_SA` — today's values from
  `src/i18n/config.ts`). Adding a language is a row plus translations; **no schema change**. (The public route list,
  fonts and typography still need design work for a third script; that is a later brief.)
- Each entity with text has a **translation table** `*_translations` keyed `(entity_id, locale)`: one row per language,
  typed columns, each field independent. One canonical identity (the root row) is shared by all languages.
- Rejected alternatives: columns per language (`title_en`, `title_ar` — a schema change per language), one JSON object
  per field (`{en, ar}` — unvalidated, unsearchable), and a generic key/value translations table (loses types and
  constraints).
- Section copy is localized per section in `page_section_translations.content` (validated per block type).

### 3.2 Translation status
Each translation row has `translation_status`:

| Status | Meaning | Set by |
|---|---|---|
| *(no row)* or required field empty | **Missing** | computed |
| `draft` | being written | default on create/edit |
| `complete` | an editor confirmed this language is finished | "Mark English/Arabic complete" |
| `needs_review` | another language changed after this one was completed | automatic on save (see below) |

When an editor saves a change to one language of a `complete` aggregate, the other languages' rows become
`needs_review` (both directions — Arabic is not "the translation" of English). The save dialog offers "This change does
not affect the other language" for typo fixes, which keeps them `complete`. The admin shows, for example,
**EN Complete · AR Missing**, **EN Complete · AR Needs review**, per aggregate, per section and in lists (filterable).

### 3.3 Publication rule
An aggregate can be submitted or published only when **every required locale is complete** (`locales.is_required`:
both today). There is no automatic fallback from Arabic to English on the public site (a mixed-language page in an RTL
layout is not acceptable), and no machine translation is ever inserted. If the Owner ever wants a page in one language
only, that is a new rule (its address in the other language would answer 404 and hreflang would omit it) — not
proposed.

### 3.4 Slugs and addresses
- **One slug per aggregate, shared by all languages** — exactly today's model (`/en/services/laser-cutting` ↔
  `/ar/services/laser-cutting`), so the language switch always lands on the same page. ASCII, lowercase, words joined by
  hyphens: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–80 characters.
- Per-language (Arabic) slugs are **not** proposed: they would break today's addresses-by-symmetry and the language
  switch logic for no SEO gain the site needs. The model leaves room for them (a nullable column on translation tables
  in a later migration).
- Changing the slug of a live aggregate creates permanent redirects at publication (§11.6).

### 3.5 Writing rules the admin supports
Arabic is never letter-spaced (a design rule, not editable). Inline text in the other language is marked with `lang`
(and `dir`) — the rich-text model has a **language mark** for that (§12). Numbers and units are content; nothing
converts digits.

## 4. Routes, pages and the URL contract

### 4.1 Today's public addresses (inventory, all kept)

| Route (per locale `en`, `ar`) | Type today | Source of content today | CMS page |
|---|---|---|---|
| `/{locale}` | prerendered | `home.ts`, many modules via `home/data.ts` | `pages.system_key = home` |
| `/about` | prerendered | `about.ts`, pillars, metrics, machines, projects, clients, certificates | `about` |
| `/services` | prerendered | `servicesPage` (`pages.ts`), services | `services` |
| `/services/{slug}` (6) | prerendered, unknown slug → 404 | `services.ts`, `service-details.ts`, `servicePage`, `looks.ts` | each service's own sections |
| `/capabilities` | prerendered | `capabilities.ts`, `machines.ts` | `capabilities` |
| `/projects` | prerendered | `projectsPage`, `projects.ts` | `projects` |
| `/projects/{slug}` (34) | prerendered, unknown slug → 404 | `projects.ts`, `projectDetailPage` | template `project_detail` + each project |
| `/industries` | prerendered | `industriesPage`, `industries.ts` | `industries` |
| `/clients` | prerendered | `clientsPage`, `clients.ts` | `clients` |
| `/certificates` | prerendered | `certificatesPage`, `certificates.ts` | `certificates` |
| `/contact` | prerendered | `contact.ts`, `company.ts` | `contact` |
| `/privacy`, `/terms` | prerendered | `legal.ts` | `privacy`, `terms` (legal) |
| any other `/{locale}/…` | dynamic → localized 404 | dictionaries | `not_found` + generic pages + redirects |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | generated | `sitemap.ts` (102 addresses), `robots.ts`, `manifest.ts` | generated from published data |
| unprefixed addresses | `src/proxy.ts` redirects to `/{locale}/…` (cookie, then Accept-Language) | — | unchanged |

Structured data today: Organization + LocalBusiness + WebSite (homepage); WebPage / AboutPage / ContactPage /
CollectionPage + BreadcrumbList (inner pages); Service (service pages); ItemList (capabilities); WebPage +
BreadcrumbList (project pages). Canonical + `en` / `ar` / `x-default` alternates on every page; Open Graph image
`/og/og-{locale}.png`. The CMS generates all of these from published data with the same shapes (§11).

### 4.2 Page types
| `page_type` | Examples | Route | Can be created / deleted by editors |
|---|---|---|---|
| `home` | homepage | `/{locale}` | no / no |
| `system` | about, services, capabilities, projects, industries, clients, certificates, contact, not_found | fixed route files | no / no |
| `legal` | privacy, terms | fixed route files | no / no |
| `template` | `project_detail` (layout of every project page), `service_detail_default` (sections a new service starts with) | — | no / no |
| `generic` | an owner-created page (e.g. "Quality") | `/{locale}/{slug}` | yes / yes (archive → Trash → purge) |

Service detail pages are not `pages` rows: their sections belong to the service (`page_sections.service_id`) and are
published with it.

### 4.3 How a generic page renders without new source files
In database mode (local and staging from A3, production from the A9 cutover; in static mode the catch-all keeps today's
behaviour) the existing catch-all (`app/(commerce)/[locale]/(missing)/[...rest]`, today always `notFound()`) becomes
the resolver:

1. **Static routes always win** — Next's router matches `/about`, `/services/...` etc. before the catch-all, so a generic
   page can never shadow a system route; and the slug validator rejects reserved words anyway (§4.4).
2. One segment matching a **published generic page** slug → render its sections (cached, tagged).
3. Otherwise an **active redirect** for the exact path → `permanentRedirect` (308) or `redirect` (307).
4. Otherwise the **localized 404**, as today (real 404 status; not cached — see A1-PUBLISHING-VERSIONS §8.2).

The same redirect lookup runs in the `notFound` branch of `/services/[slug]` and `/projects/[slug]`, so a renamed
service or project keeps its old address. Redirects are therefore resolved **only where a page would otherwise answer
404** — never in `src/proxy.ts`, which would add a database read to every request.

Generic pages are one level deep in A3 (`/{locale}/{slug}`); nesting (`parent_id`) is reserved for later.

### 4.4 Reserved slugs
A generic page slug may not be any of: `about`, `services`, `capabilities`, `projects`, `industries`, `clients`,
`certificates`, `contact`, `privacy`, `terms`, `admin`, `api`, `media`, `uploads`, `brand`, `og`, `_next`, `en`, `ar`
(and every future locale code), `sitemap`, `sitemap.xml`, `robots`, `robots.txt`, `manifest`, `manifest.webmanifest`,
`icon`, `icon.svg`, `apple-icon`, `apple-icon.png`, `favicon.ico`, `not-found`, `404`, `500`, `search`, `preview`,
`login`. The list lives in code next to the route table and is checked on save and publish. Adding a system route later
first checks that no generic page uses its slug.

### 4.5 Page fields
`page_type`, `system_key` / `slug`, EN/AR `title` and `nav_label`, publication state (§ publishing), `nav_hidden`
(leave out of automatic menus), `header_variant` / `footer_variant` (only `standard` exists; new variants need a design
brief), SEO fields (§11), `requires_legal_review` and `effective_date` (legal pages), created/updated/published by and at,
its sections, its revisions.

## 5. Sections (the block model)

### 5.1 Structure
A **section** is one row in `page_sections` (owned by a page or a service) with:

| Part | Where | Notes |
|---|---|---|
| identity, owner, order | `id`, `page_id` / `service_id`, `position` | stable ids survive reorders and appear in revisions |
| type and version | `block_type`, `schema_version` | registry key, e.g. `home.hero` v1 |
| visibility | `is_visible`, `show_desktop`, `show_tablet`, `show_mobile` | hidden sections never reach the public projection |
| structure lock | `is_locked` | locked sections cannot be moved, hidden or removed by editors (content stays editable) |
| in-page anchor | `anchor` | e.g. `quote`, `location`, `gallery` (links land on them) |
| reuse | `reusable_section_id`, `detached_from_id` | linked global block, or provenance after detach |
| settings | `settings` (JSON) | non-localized: variant, design-token references, responsive overrides, motion preset, item ids, selections, media ids |
| copy | `page_section_translations.content` (JSON per locale) | localized texts, keyed by the item ids in settings |

### 5.2 The block registry (code, not database)
Each block type is defined once in code (A3/A5) with: its key and version; a **settings schema** and a **content
schema** (validation, §15); its **projection** (which fields are public); the **component** that renders it (the
approved component for bespoke types); editor metadata (label, icon, which page types may contain it, how many per
page, default `is_locked`); **upcasters** from older versions; and the list of fields that are references (so
`content_references` can be maintained). Unknown block types or versions are rejected on save; on read they render
nothing and raise an admin warning — a page never crashes because of one section.

### 5.3 Bespoke block types (the approved pages, unchanged)
| Page | Sections (block types), in today's order |
|---|---|
| Homepage | `home.hero` (headline lines, sub, two actions, location, plate labels, hero photo) · `home.capability_strip` (figures + statements) · `home.about` (statement, paragraphs, workshop photo, vision, beyond-metalwork items, pillars) · `home.services` (services selection, two signatures) · `home.machinery` (machines selection, showcase labels) · `home.projects` (projects selection) · `home.industries` (industries selection, basis labels) · `home.clients` and `home.compliance` (one sheet) · `home.contact` (closing call to action, steps, photo) |
| About | `page.hero` (split) · `about.overview` · `about.what` · `about.metal` · `about.beyond` · `about.vision` · `about.approach` · `about.process` · `about.why` · `about.workshop` · `about.machinery` · `about.work` (projects selection) · `about.clients` · `about.compliance` · `page.closing_cta` |
| Services overview | `page.hero` (with jump tiles) · `services.index` (contents nav + service rows) · `page.closing_cta` |
| Service detail (per service) | `service.hero` (visual variant: cut, fold, frame, workbench, plate, bays) · `service.overview` · `service.scope` (layout: profiles, folds, phases, photos, materials, support; items with icons) · `service.process` (rail, timeline, cycle; rail line) · `service.machines` · `service.applications` · `service.gallery` (mosaic, sheet, pair) · `service.why` · `service.related` · `service.projects` · `service.cta` |
| Capabilities | `page.hero` (with the fleet plate and facts) · `capabilities.power` · `capabilities.console` · `capabilities.register` · `capabilities.service_lines` · `capabilities.source` · `page.closing_cta` |
| Projects overview | `page.hero` (quick filter, prints) · `projects.featured` · `projects.highlights` · `projects.gallery` · `projects.index` · `page.closing_cta` |
| Project detail (template) | `project.hero` · `project.photos` ("More photographs") · `project.details` (renders only fields a record holds) · `page.closing_cta` |
| Industries | `page.hero` · `industries.sectors` · `industries.index` · `page.closing_cta` |
| Clients | `page.hero` · `clients.wall` · `page.closing_cta` |
| Certificates | `page.hero` · `certificates.register` (with the dialog) · `certificates.redaction` · `page.closing_cta` |
| Contact | `page.hero` (with direct-contact rows) · `contact.quote` (how it works, the no-backend note, the form) · `contact.location` (address card and map) |
| Privacy, Terms | `page.hero` · `legal.contents` · `legal.section` × n (id, title, body, contact block, pending note) |
| 404 | `not_found.view` (texts from interface text, §10) |

The visual variants that `src/components/commerce/services/looks.ts` hard-codes today become the enumerated settings
of the service blocks (the same values, so the same output). In A3 these sections are **locked** (content editable,
structure fixed) so that nothing can change the approved compositions; A5 decides with the Owner which sections may be
reordered, hidden or added, page by page.

### 5.4 Generic block types (A5)
Built in the Modern Commerce design system for owner-created pages and, where the Owner agrees, for adding to existing
pages: hero · heading · rich text · image · text + image · gallery · video (embed) · services grid · projects grid ·
machine grid · client logos · certificates · statistics · feature cards · timeline · process · industries · FAQ ·
call to action · contact details · quote form · map · logo strip · divider · spacer · button group · downloads ·
reusable (global) block. Each has a settings and a content schema like the bespoke ones.

### 5.5 Repeated items (localized repeaters)
Lists inside a section (scope items, process steps, FAQ entries, statistics) keep their **order and non-text
properties in `settings`** with a stable id per item, and their **texts per language in `content`** keyed by that id:

```json
{ "settings": { "variant": "rail", "rail": "cut",
    "items": [ { "id": "s1", "icon": "doc" }, { "id": "s2", "icon": "laser-cutting" } ] },
  "content": { "en": { "title": "How a laser-cutting job runs", "items": { "s1": { "title": "Share drawings", "body": "…" } } },
               "ar": { "title": "…", "items": { "s1": { "title": "…", "body": "…" } } } } }
```

Validation requires every language to cover exactly the item ids in settings, so reordering or removing an item can
never misalign English and Arabic.

### 5.6 Selections (manual or automatic)
Sections that show entities (homepage services / machines / projects / industries / clients / certificates, About's
projects, the projects overview's featured project and highlights, a service page's projects) store a selection:

```json
{ "selection": { "mode": "manual", "ids": ["01J…tulip", "01J…clock-tower"] } }
{ "selection": { "mode": "automatic", "source": "featured", "limit": 6 } }
```

`automatic` sources: `all` (in the collection's published order), `featured` (projects with `is_featured` and no
restricting flag — today's `featuredProjects()` rule), `category` (with a category id). Rendering always filters out
aggregates that are not live and projects that are not showcased (no displayable photo or a restricting flag), so a
selection can never put a withheld project on a page.

### 5.7 Reusable (global) sections
A `reusable_sections` row holds one block's settings and copy with its own publication. A page section **links** it
(`reusable_section_id`, its own settings/content ignored) or holds a **detached copy** (`detached_from_id` records where
it came from). "Detach" copies the reusable block's current working settings and copy into the page section. Two
existing candidates: the six **pillars** (homepage About + About "why") and the **company figures** (homepage strip +
About).

### 5.8 Versioning of block schemas
`schema_version` is stored on every section and every snapshot. Changing a block's schema adds a version and an
upcaster; old drafts and revisions are upcast when read, and A8's integrity job reports sections still on old versions.
A change that removes data needs a migration plan and the Owner's approval.

## 6. Visual-editor inspector (A5): controlled design values

The inspector edits **settings**, never CSS. Every value is a token reference or an enumerated option validated on the
server:

| Group | Controls | Allowed values |
|---|---|---|
| Typography | heading level, size role, alignment, measure | roles from the design system (`display`, `h2`, `h3`, `lead`, `body`, `small`); alignment `start` / `center` / `end` (logical, mirrors in Arabic); measure `narrow` / `normal` / `wide` |
| Layout | variant, columns, gap, padding, width, media position | variants defined per block; columns 1–4; gap and padding from the spacing scale tokens; width `shell` / `wide` / `full` |
| Appearance | surface, tone, border, radius, shadow | surfaces `plain` / `muted` / `raised` / `dark` (today's sheets); tones `steel` / `teal` / `brass` / `orange-accent` (orange stays an accent, ~10 %); radius and shadow from tokens |
| Responsive | per breakpoint overrides: desktop (base), tablet (≤ 1023 px), mobile (≤ 639 px) | only layout, spacing, alignment, visibility and media position may differ per breakpoint |
| Motion | preset, duration, delay, stagger | presets `none`, `reveal` (appears whole and rises 18 px — today's reveal), `fade` (**media and decoration only**), `slide` (translate only), `scale` (**media only**), `stagger` (for lists); durations from `--dur-1…4`; delay 0–600 ms in 60 ms steps; reduced motion always wins (everything still) |

Rules enforced by validation, carried over from the approved design's rules: words never fade where they change
(no opacity animation on text-bearing blocks); no layout-shifting animation; no new continuous animation; colour
choices are checked for contrast (AA) in both themes before they can be saved; Arabic text is never letter-spaced.
Theme-wide tokens (colours, radius scale, fonts from an allowlist) are edited in **Theme** (Owner only), stored as
`design_token_overrides`, validated per token type, and emitted as CSS custom properties from validated values only.

## 7. Homepage (special)

The homepage keeps its approved composition (`home.*` blocks above). Editable in A3: hero eyebrow, the three headline
lines, sub-heading, both action labels, location line, plate labels, hero photo; the About statement, paragraphs,
workshop photo and caption; every section's label, title and intro; the closing call to action, its steps and photo;
the WhatsApp label. **Selections:** services (automatic `all`), machines (automatic `all` in the showcase order),
projects (automatic `featured`, limit 6 — today's six), industries, clients and certificates (automatic `all`); each can
be switched to manual. **Order:** the hero is first and locked; in A3 the order is locked; A5 proposes which sections
may move. **Visibility:** in A3 every section stays visible (hiding one changes the approved page); A5 enables hiding
with the Owner's agreement. Laser Engraving's photographs stay off the homepage because those media items are
restricted, not because of code (§8.1).

## 8. Domain entities

### 8.1 Services
Fields: slug, group (metal / scaffolding), icon, name, tagline, summary, body (rich text), highlights (list), cover and
supporting photos with alt texts, captioned gallery, machines (ordered), related services, featured projects (only
projects whose own record lists the service), its detail-page sections, SEO, provenance. Rules: machines, projects and
galleries appear only when sourced; every process section carries the "general workflow, not a certified procedure"
note (a required, locked field of `service.process`); gallery photos are never repeated in the same page's project
cards (validation); `projects/canopy-tree-1` stays out of the laser-cutting gallery (restricted media, see the media
document). **Laser Engraving** has no photographs: its cover and supporting slots are empty after migration and its
hero variant is the drawn plate; the three engraving images are restricted media (asset inventory item 12) and cannot
be selected for a displayed slot until RAWASY approves them.

### 8.2 Projects
Fields: slug, gallery reference, title, summary (describes only what the photos show), categories (ordered),
services (ordered; the project's own record), photos (ordered; the first leads), featured flag, optional confirmed
details (client, location, year, materials, scope, description, challenge, solution) — **rendered only when present,
never "—", "N/A" or "Not stated"** — flags, SEO, provenance.

**Project and photo safeguards** (today's code rules, moved to data + code policy):
- `project_flags`: `authorship_unconfirmed`, `product_render`, `ai_watermark`, and any flag added later. Policy: a
  project with any flag other than `ai_watermark` is not showcased and its page shows **no photos**; **an unknown flag
  restricts** (fail-closed, as `projectDetailMedia` does today).
- Each photo is a media item with its own status and flags (approved, pending confirmation, rights pending, render,
  AI-generated/edited, AI watermark, restricted, internal, archived). **A restricted or pending photo never becomes
  public because an editor selected it**: (1) strict validation blocks publication with a non-deliverable photo in a
  displayed slot; (2) the public projection drops any non-deliverable photo; (3) the media route refuses to serve it
  ([A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md) §4).
- Clearing a flag needs `projects.clear_flags` / `media.approve` (Owner/Admin), a note, and is audited.
- The record's internal `note` becomes `source_note` (admin-only; never rendered). Flags are never rendered (no badges).

### 8.3 Machinery
Fields: slug (the `/capabilities#{slug}` anchor), name as printed, short name, category, capability sentence, power in
watts **only when stated** (empty = "Not stated in the company profile" everywhere), primary related service, photo,
provenance. Never a maker, model, bed size, tolerance or speed unless RAWASY supplies it; the admin shows the rule next
to the fields. The showcase order (`MACHINE_ORDER` today) is the `machines` ordering.

### 8.4 Industries
Fields: slug, name, description, photo, feature photo, applicable services, and **classification** —
`profile_sector` (named in the company profile) or `website_classification` (proposed from the work gallery) — which
the page displays, so it is a public field, unlike provenance.

### 8.5 Clients
Fields: slug, name (EN/AR), colour logo, monochrome logo, optional website (not displayed today). Rules: no counts,
numbering, grid references, partnership claims or testimonials anywhere (the clients page and the homepage marquee);
the order is the `clients` ordering (the profile's order today).

### 8.6 Certificates
Fields: slug (anchor), title, issuer, displayed facts (label/value pairs), public redacted previews (per language),
thumbnail, provenance, an admin-only expiry date (renewal reminders; never displayed). **Numbers, QR codes and personal
names never enter public fields**: the digit guard validates every public certificate text at publication. The private
original is a separate, private media item (`certificate_documents.role = 'private_original'`) that no public
projection can include ([A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md) §10). Publishing certificates needs
`certificates.publish` (Owner by default).

## 9. Navigation

Menus are the design's slots: `header_main` (the eight top-level links), `header_services` (the Services dropdown and
phone-sheet list: an automatic `collection = services` item plus "All services" and the quote action), `footer_company`,
`footer_legal`. Items: nested one level, ordered, labelled per language (plus an optional description — the dropdown's
taglines), and pointing to a page, service, project, the services collection, an anchor (`/contact#quote`), an external
`https` address (announced as opening in a new tab when it does), or the company's phone / email / WhatsApp from
settings. Visibility per item and per device. **Unpublished targets** are skipped when rendering and flagged in the
admin; purging a target is blocked while a menu points to it. Menus are published as aggregates (preview first). The
header's current-page marks (`aria-current`) stay computed by code from the route, as today.

## 10. Global settings and interface text

`site_settings` (singleton, published as one aggregate with its translations, phones and interface text):

- **Company:** legal name, brand name, statement, address (lines, full, street, city, country, postal code), approximate
  coordinates (never invented; `geo_is_approximate`), email, website, social links, vision (statement, aims, closing).
- **Contact:** phone numbers (display and E.164, WhatsApp availability, order), the primary WhatsApp number, the map's
  address search and — once RAWASY supplies it — its own Google Maps place link (validated host).
- **SEO defaults:** site name per language (title template `%s | RAWASY`), default description, default share image.
- **Interface text:** every string of `src/i18n/dictionaries.ts` (skip link, menus, theme and language controls, footer,
  404 …) as `ui_strings` keys defined in code with editable text per language and a maximum length.
- **Theme:** separate aggregate (Owner only) — validated design-token overrides; empty means the approved design.

No settings are stored as free-form JSON; the few list fields (address lines, vision aims) are validated JSON arrays of
short strings, never queried.

## 11. SEO model

| Item | Rule |
|---|---|
| Title / description | per language on every routable aggregate (`seo_title`, `seo_description`); fallback: the page or entity title and summary (today's behaviour for services and projects); warnings above 60 / 160 characters, hard limits 120 / 320 |
| Open Graph / Twitter | `og_title`, `og_description` (fallback: SEO fields), share image (`og_image_media_id`, fallback: the site default, today `/og/og-{locale}.png`) |
| Canonical | always the page's own localized URL from `NEXT_PUBLIC_SITE_URL`; `canonical_override` only for a same-site path, Owner/Admin |
| hreflang | `en`, `ar`, `x-default` (→ English) for every published page; only languages that are published |
| Robots | `robots_index`, `robots_follow` per aggregate (default index, follow); 404s and previews always `noindex`; the admin is never indexed |
| Sitemap | every published, indexable, `in_sitemap` page in every published language with alternates — generated from `published_documents`; same shape as today (102 addresses at migration) |
| Structured data | generated by code from published data with today's shapes (Organization/LocalBusiness/WebSite, WebPage subtypes, BreadcrumbList, Service, ItemList); editors cannot type JSON-LD |
| Slug changes | publishing a changed slug creates 308 redirects from the old addresses in every language; conflicts (a live address, another redirect's source, a chain or loop) block the publish |
| Redirect management | Owner/Admin create, edit, deactivate; sources normalized (`/en/...`, no trailing slash, no query); targets resolve in one step |
| Index / noindex rules | unpublished, archived and trashed content is absent (404); a page set to noindex leaves the sitemap |

## 12. Rich text

Rich text is stored as a **validated JSON document**, never HTML. Allowed nodes: paragraph, heading (levels 3–4 inside
sections; the page's `h1` and section `h2`s are structural), bulleted list, numbered list, list item, line break.
Allowed marks: bold, italic, **link**, **language** (`lang` = a configured locale; the renderer adds `dir`). Links are
either internal (a target aggregate id + optional anchor — resolved at render, dropped if not live) or external
(`https:` only; `mailto:` and `tel:` allowed for contact links); `javascript:`, `data:` and every other scheme are
rejected. Pasted content is converted to this model (formatting outside it is discarded). The renderer is a React
component producing elements — no `dangerouslySetInnerHTML`.

## 13. Builder safety

The admin can never introduce executable code (a stolen admin account must not become code execution):

- No script, `eval`, template language, server code, SQL, `<style>` or CSS text in any field. Settings are token
  references and enumerations; copy is plain text or the rich-text model.
- No raw HTML block. If the Owner later needs one, it is a separate decision: server-side sanitization with a strict
  allowlist (no scripts, no event-handler attributes, no `javascript:` URLs, no `style` attributes, no iframes outside
  the embed allowlist), still rendered without scripts.
- Embeds (video, map) are dedicated blocks that take an **identifier**, not HTML: a YouTube video id rendered with
  `youtube-nocookie.com`, a Vimeo id, a Google Maps address query or place link — each host allowlisted, each iframe
  sandboxed and titled.
- URLs everywhere are parsed and checked against scheme and host rules; uploaded SVG is not accepted for public use
  ([A1-MEDIA-STORAGE](A1-MEDIA-STORAGE.md) §7); CSV exports neutralize formula prefixes.
- Structured data, meta tags and attributes are generated by code from typed fields (React escapes text; JSON-LD keeps
  today's `<` escaping).

## 14. Forms and enquiries (A7)

### 14.1 Today
The quote form validates in the browser and **prepares** an email or WhatsApp message that the visitor sends
themselves; nothing is sent or stored by the website, and the page says so. The privacy policy says the same
("It does not send your information to our servers or store it on the website"). Fields: full name*, company, email*,
phone* (8–15 digits), service*, project type, estimated requirement, project location, project details* (≥ 20
characters), files (PDF, DWG, DXF, STEP/STP, JPG, PNG; up to 5 × 10 MB, kept on the visitor's device). The golden outputs
of `e2e/commerce-contact.spec.ts` pin the exact email, WhatsApp and copied texts.

### 14.2 Model
- `forms.delivery_mode`: `handoff` (today — **the default after migration**), `store` (save the enquiry, show a reference
  number), `store_and_notify` (save, then email the team from the outbox). Switching modes is an Owner permission
  because it changes what the privacy policy must say.
- System fields keep their keys, types and validation in code (the golden outputs stay exact); their labels, hints,
  placeholders, options (project types) and error texts are editable per language. Custom fields (A7, optional) use
  allowlisted validators — never a regular expression typed in the admin.
- **Enquiry workflow:** `NEW → CONTACTED → QUALIFIED → CLOSED`, plus `SPAM` from any state; each change recorded in
  `enquiry_status_history`; internal notes; assignment to a user; search by reference, name, email, phone, status, date.
- **Spam protection:** honeypot field, minimum fill time (signed timestamp), per-IP and per-email rate limits
  (`rate_limits`), content heuristics (link count, repeated submissions); an optional CAPTCHA (Turnstile or hCaptcha)
  only if the Owner accepts a third party and the privacy policy says so.
- **Notifications:** after the enquiry is committed, an `email_outbox` row is sent by SMTP (authenticated, the
  account's mail server) — first attempt right after the response (`after()`), retries by the 5-minute cron job; a
  failure never loses the stored enquiry. Namecheap's reported sending limit (200 emails per hour per domain) is far
  above the need.
- **CSV export:** Owner only (personal data), step-up re-authentication, audited, cells starting with `=`, `+`, `-`, `@`
  neutralized.
- **Retention:** each enquiry gets `retain_until`; a daily job anonymizes or deletes expired ones (period: Owner and
  legal decision; Saudi Arabia's Personal Data Protection Law applies — legal review, not decided here). IP addresses
  kept 30 days for abuse handling, then cleared (proposed).
- **Files** (only if the Owner allows uploads; default off): stored in the private area, never public, downloaded only
  by authorized staff with `Content-Disposition: attachment`.

### 14.3 No dishonest period
The switch from `handoff` to `store` is atomic per release and gated: (1) the privacy policy update is legally reviewed
and published first; (2) the form shows "received, reference Q-…" **only after the database commit succeeded**; (3) any
failure shows an error and offers today's email/WhatsApp hand-off as the fallback; (4) the hand-off code stays until
the Owner retires it. At no moment does the interface claim a submission that was not stored.

## 15. Validation

- **Library:** Zod (version to pin in A2; no dependency is added in A1) or an equivalent TypeScript-first schema
  library. One schema module per aggregate, block type (settings + content), settings group and form.
- **Server-side always:** every Server Action and Route Handler parses its input with the schema before any database
  work; the client uses the same schemas only for instant feedback.
- **Lenient vs strict:** save validates shape; submit/publish validates completeness and references
  ([A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) §4).
- **Reading JSON from the database** (`settings`, `content`, `snapshot`, `document`) uses safe parsing: a failure is
  logged with the aggregate id, raises an admin warning and renders nothing for that part — never a crash, never
  unvalidated data on the page.
- **Database constraints** back the schemas: `NOT NULL`, `UNIQUE`, foreign keys, `CHECK` (MariaDB enforces them), JSON
  validity (MariaDB adds `JSON_VALID` to `JSON` columns).

## 16. Legal content

Privacy and Terms are legal-review-sensitive: editable only by `legal.edit` (Owner, Admin), always through review,
published only by `legal.publish` (Owner) with a recorded legal-review confirmation, never by schedule from someone
without that permission, never edited automatically by a migration (A9 copies the text verbatim and proves it). Their
"Pending confirmation" notes are content of `legal.section` and block launch as today. **A1 does not change legal text.**
Known couplings for later phases: storing enquiries (A7) and adding admin cookies (A2, staff only) require reviewed
updates of the privacy policy before they go live; the legal pages' hosting-provider pending note remains.

## 17. Data classification

| Class | Examples | Rules |
|---|---|---|
| **PUBLIC** | published projections, approved public media and variants, sitemap, robots, menus, settings shown on the site | served to anyone; cached |
| **ADMIN-ONLY** | drafts, revisions, unpublished pages, provenance and notes, flags, restriction reasons, review comments, audit log, users list, dashboards, job logs, search index | authenticated admin only; `no-store`; never in public projections |
| **PRIVATE** | certificate originals, enquiries and their files, email outbox bodies, password hashes, session and reset token hashes, TOTP secrets (encrypted), IP addresses in logs, backups, `.env` values, `.next` build secrets | least privilege; private storage outside every web root; excluded or minimized in logs; backups protected; never at a public URL |

## 18. Validated JSON examples

A homepage hero section (bespoke block, A3):

```json
{
  "blockType": "home.hero",
  "schemaVersion": 1,
  "settings": { "heroMediaId": "01J…site-laser-sparks", "primaryAction": { "target": { "page": "contact", "anchor": "quote" } },
                "secondaryAction": { "target": { "anchor": "machinery" } } },
  "content": {
    "en": { "eyebrow": "RAWASY United International", "headline": ["Engineering", "metal into", "possibility."],
            "sub": "Advanced metal fabrication, laser cutting, CNC bending, …", "primary": "Start a Project",
            "secondary": "Explore Our Capabilities", "location": "Riyadh · Saudi Arabia",
            "plate": { "part": "Part RW-01", "sequence": "Cut sequence" } },
    "ar": { "eyebrow": "رواسي المتحدة العالمية", "headline": ["نُشكّل المعدن", "بدقّة هندسية", "ونصنع الممكن."], "…": "…" }
  }
}
```

A statistics item with admin-only provenance (stripped by the projection):

```json
{ "settings": { "items": [ { "id": "m1", "value": 12000, "source": { "basis": "profile", "pages": "7" } } ] },
  "content": { "en": { "items": { "m1": { "label": "Peak fibre-laser power", "unit": "W" } } },
               "ar": { "items": { "m1": { "label": "أعلى قدرة لليزر الفايبر", "unit": "واط" } } } } }
```

Its public projection: `{ "items": [ { "id": "m1", "value": 12000, "label": "Peak fibre-laser power", "unit": "W" } ] }`
per language — no `source`.
