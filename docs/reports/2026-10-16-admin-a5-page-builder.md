# Admin / CMS program — Phase A5: Page builder

Date: 2026-10-16 (final QA 2026-10-20) · Branch: `claude/new-session-5eijs6` · Brief: "PHASE A5 — PAGE BUILDER /
VISUAL EDITOR / STRUCTURED BLOCKS + LIVE PREVIEW + REUSABLE SECTIONS + CONTROLLED DESIGN INSPECTOR / LOCAL
IMPLEMENTATION ONLY / PUBLIC WEBSITE REMAINS STATIC / DO NOT START A6".

## Summary and status

Phase A5 is built and tested **locally**, against a local MariaDB 11.4 and temporary folders only.

- **Sections in the database.** A page or a service page is an ordered list of sections (A1's section model): each one
  a block type and version, its settings as validated JSON, its texts as one JSON document per language, where it
  shows (desktop, tablet, phone), an anchor, and optionally a link to a reusable section. Migration `0005` adds the four
  A1 tables and nothing else; nothing of today's website was imported into them.
- **A code-defined block registry.** 87 block types: **59 bespoke** blocks — today's approved sections of the homepage,
  the inner pages, the six service pages, the project page template and the 404, drawn in the preview by the approved
  components themselves — and **28 generic** blocks (27 that can be stored, plus the library entry that inserts a reusable
  section). Every value is typed: plain text, a structured rich-text document, media ids, record ids, link targets and
  design tokens. No HTML, CSS, script, embed code or raw JSON is ever typed, stored or rendered.
- **Structure policy.** Each kind of page has a contract: one main heading (first, visible everywhere, locked), its
  required parts, today's order as its starting layout, and the generic blocks it may receive. The legal pages, the 404
  and the project page template are locked whole. Structure changes need the structure permission; texts and settings
  need the content permission (permission keys, never role names).
- **The builder.** `/admin/pages/<id>/builder` and `/admin/services/<id>/builder`: an outline, the live preview and an
  inspector (settings, English and Arabic texts, design tokens, screens, anchor), a library, undo and redo, an explicit
  save with optimistic concurrency, and phone tabs. Reusable sections have their own list and editor.
- **A private preview.** `/admin/preview/{page|service|reusable}/<id>`: the saved working layout drawn with the
  website's own components, styles and fonts, in either language and theme and at each screen size. Signed-in only
  (`content.view` + `preview.use`), never cached or indexed, framed by the admin only, no shareable link.

The public website is frozen: it reads none of this (T1 Option B), and item 38 proves its output unchanged against
`preserve/pre-admin-a5`: files, page data, stylesheets and scripts, 102 pages over HTTP in three admin-off settings,
1,484 image answers, 143 release files, no public database query with the admin on, and the pixels of 238 screens.
Nothing was deployed, no Namecheap resource was touched, `main` was not
touched, and A6 was not started.

**Security review** (brief §68): no High finding; 1 Medium, 5 Low and 6 Info. The Medium, the five Low and four Info
items are fixed, each with a test that fails on the code before (`a0f381b`); two Info items are documented as accepted
(item 35). The final security pass (brief §92) found no High or Medium: of its 3 Low and 3 Info, two Low and the
link part of one Info are fixed with tests that fail on the code before (`96c3ebb`); one Low (a deadlock that is retried,
availability only) and the rest are documented or put to RAWASY (item 35).

**QA** on a fresh clone of the final code `f2b73c9` (brief §78–§79; every count split by origin in items 40–42):

| Check | Result |
|---|---|
| `npm ci` | exit 0 (fresh clone of the local branch at `f2b73c9`, the commit pushed before the run) |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm audit` | 9 (4 moderate, 5 high), development tools only — the same two chains as A3 and A4; `audit fix` not run |
| lint / typecheck | 0 problems / 0 errors |
| build | 147 / 147 pages, **no warning**, no database settings, no `RAWASY_DATA_DIR`, no admin secret |
| `db:check` | passed (6 migration files; seeds match the registries) |
| unit | **294 / 294** — A2 inherited 30, A3 inherited 102, A4 inherited 35, A5 new 127 |
| integration | **425 / 425** — A2 inherited 164, A3 inherited 94, A4 inherited 102, A5 new 65 |
| admin browser | **112 / 112** — A2 inherited 47, A3 inherited 17, A4 inherited 18, A5 new 30 (item 42: both runs on `b4f61f9` timed out in the parity spec — the test browser froze — which `f2b73c9` fixes) |
| public E2E | **612 / 612** (32.8 min) on `server.js` after the image warm-up (1,484 / 1,484 sizes, none failed); the suite is `cc0cae2`'s, unchanged (item 43) |
| deployment package | its script's own check passed on the final build: 2,779 files, the 13 held-back files left out, the 102 sitemap pages complete |
| public freeze | unchanged against `preserve/pre-admin-a5` (item 38): 939 / 939 files (only `/en/terms`'s page data renumbered: the same drawn page and resolved payload), stylesheets identical on 104 / 104 pages, 5 client modules changed only by A5's `unoptimized` spread (proved equal once it is removed), 102 / 102 pages over HTTP in 3 settings, 1,484 / 1,484 `/_next/image` answers, 143 / 143 release files, 0 public database connections, 238 screens (233 identical, 5 proven capture noise), 44 / 44 page heights |
| security | first review: 1 Medium, 5 Low, 6 Info (10 fixed with tests, 2 documented); final pass: 3 Low, 3 Info (2 Low + 1 Info part fixed with tests, the rest documented or put to RAWASY); no High; no open High or Medium |
| evidence | `rawasy-a5-final-evidence.zip` (not committed): 108 captures of 37 screens, 13 contact sheets, **0 page-level horizontal overflow**; test content and approved release photos only (items 50–51) |

Four findings changed the code in the final round:

- the final security pass's certificate-copy gaps (`eeead56`, tests `40ee741`; item 35);
- a page 4 px wider than a 320 px screen when the inspector shows a rich text, which the evidence capture found
  (`8f72332`, test `3cc3aa4`; item 51);
- a public test that failed on the fresh clone of `3cc3aa4` (611 / 612): it pins the bytes of the homepage's frozen
  machinery component, which `595f50c` had edited without changing the page (`fc51705` restored the file, `b4f61f9`
  makes the builder's preview say what the frozen showcase draws; items 38 and 43);
- the admin suite's preview parity spec, which timed out at a 390 px page in both fresh-clone runs on `b4f61f9`.
  Chromium's headless renderer froze in its own compositor, in the browser that had just run the other admin specs; it
  was diagnosed in four more runs. `f2b73c9` gives the spec a browser of its own (test and config only; item 42).

The first two have tests that fail on the code before; the third is the public suite's own test; the fourth is proven
by the runs before and after it (item 42).

**A5 STATUS: READY FOR INDEPENDENT REVIEW.** Not self-approved.

## Report items (brief §89, in order)

### 1. Starting SHA

`cc0cae20dfaf1a5335b9744b7664e7928b743e83` — the A4 documentation head; A5's first commit (`277a379`) has it as its
parent.

### 2. preserve/pre-admin-a5 SHA

GitHub branch `preserve/pre-admin-a5` at `cc0cae20dfaf1a5335b9744b7664e7928b743e83`, created and pushed before the first
A5 commit (no force push) and unchanged since (item 59).

### 3. Implementation commits

In order, each on its own (never squashed):

| Commit | What |
|---|---|
| `277a379` | Page-builder schema and migration 0005 |
| `b863a4e` | Block registry, rich text, links, design tokens and structure policy |
| `d5af882` | Layout and reusable-section services, editor model and Server Actions |
| `1b95e9c` | Contact: the quotation form's words built in one place (the page is unchanged) |
| `8f0aef9` | The private preview and the generic blocks' renderers |
| `595f50c` | Homepage: the showcase orders move into the view builder; uploaded images drawn as they are (the page is unchanged) |
| `606b575` | The homepage blocks' preview adapters |
| `07325a3` | Projects: the card photo rule in one function (the pages are unchanged) |
| `0401824` | Services: the service sections draw uploaded photos as they are (the pages are unchanged) |
| `15783d6` | The preview's composition and the service page adapters |
| `dac8c57` | Inner pages: their sections as components the page builder can reuse (the pages are unchanged) |
| `5c498ec` | The inner pages' block adapters (opening, closing, services index, clients, certificates, industries, contact, legal) |
| `99f981b` | Inner pages (Capabilities, Projects, project pages, About): their sections as components the page builder can reuse |
| `d65912c` | Inner pages: the 404's panel takes its texts, About's support link may be left out (the pages are unchanged) |
| `df41e77` | The About, Capabilities, Projects, project page and 404 block adapters |
| `f1b3737` | The reusable section editor's model, preview notes and checked messages |
| `b3f9f82` | The builder's client: outline, library, inspector, fields, rich text, preview canvas |
| `ac2fef1` | The builder screens: page and service layouts, reusable sections, navigation |
| `a739644` | The page builder's styles |
| `45c2798` | Unit tests: renderer coverage, design-token drift, the editor's rich-text model, frame messages |
| `b5bc3cf` | Integration tests: the preview's data, private media, batched reads, reorder races, audit by kind |
| `bc174eb` | After a save, the builder and the reusable editor wait for the stored version |
| `6ae169b` | The Pages list and the new-page form point to the page builder |
| `30245bb` | Browser tests: the page builder end to end |
| `a0f381b` | Preview parity tests: the bespoke blocks draw today's approved components |
| `6da85c2` | The security review's fixes: certificate copy, reusable-section locks, upcast texts, audits |
| `eee94f3` | The preview canvas and the map frame are sandboxed (security review F6) |
| `1f006e1` | Tests for the security review's fixes (each fails on `a0f381b`) |
| `96c3ebb` | The builder's browser test checks the preview canvas's sandbox (security review F6) |
| `eeead56` | The final security pass's fixes: certificate copy read as it is drawn, format characters, link targets; lock-order comments |
| `40ee741` | Tests for the final security pass's fixes (each fails on `96c3ebb`) |
| `8f72332` | The inspector's rich text and repeaters stay inside a 320 px screen (found by the evidence capture) |
| `3cc3aa4` | The builder's phone test opens a rich text at 320 px (fails on `40ee741`) |
| `fc51705` | Homepage: the machinery showcase back to its frozen bytes (the page is unchanged) |
| `b4f61f9` | The homepage machinery preview says where the frozen showcase draws a selection otherwise (with its unit tests) |
| `f2b73c9` | The preview parity spec runs in a browser of its own and scrolls once its photos are in (test and config only; item 42) |

The eight commits that touch public components (`1b95e9c`, `595f50c`, `07325a3`, `0401824`, `dac8c57`, `99f981b`,
`d65912c`, `fc51705`) are separate from the admin commits on purpose: each one only moves a page's existing markup into
exported components (or one rule into one function) so the preview can draw the same component, and each was checked
page by page against the pages before it (item 38). `fc51705` takes one such move back: `595f50c` had moved the
homepage showcase's machine order out of `home/Machinery.tsx`, a file the public suite pins byte for byte (item 43).

### 4. Final code SHA

`f2b73c9f451e20c2577a6db0b8f9fb14388bdd04` (`f2b73c9`) — the last commit with code or tests; everything after it is
documentation.

### 5. Final docs HEAD

The docs commit that adds this report, `CLAUDE.md` and `README.md` follows `f2b73c9` and is the branch's HEAD
(`git log -1 origin/claude/new-session-5eijs6`). Its SHA is given in the final message, since a commit cannot name
itself.

### 6. Migration files

One new file: `drizzle/0005_page_builder.sql` (generated by `drizzle-kit generate` from `src/server/db/schema-builder.ts`,
reviewed, table options added as for 0000–0004), with `drizzle/meta/0005_snapshot.json`; `drizzle/meta/_journal.json`
lists it sixth. The files `0000`–`0004` are byte-identical (their applied hashes still match). A5 adds no permission, so
no seed file: the builder uses the permissions A2 seeded (`pages.*`, `services.*`, `legal.edit`,
`reusable_sections.*`, `content.view`, `preview.use`). `drizzle.config.ts` lists the new schema file.

### 7. A4→A5 migration proof

`tests/integration/builder-migration.test.ts` (7 tests), run through `scripts/db-migrate.mjs` as an operator would:

- **A.** An empty database takes all six migrations and reports nothing pending.
- **B.** A database at A4 (`0000`–`0004`) holding A2 accounts, A3 content and A4 media takes exactly the A5 file.
- **C.** A second run is a no-op.
- **D.** The runner's hash and order checks still refuse a changed or reordered A5 file.
- **E.** Every A5 table is InnoDB `utf8mb4_unicode_520_ci`; ids and keys `ascii_bin`; the schema's own rules hold: one
  owner per section, at least one device, the anchor and block-key formats, unique positions and anchors per owner, the
  reusable link RESTRICT and the owner CASCADE.
- **F.** No A2, A3 or A4 row is lost or changed; no existing table changes shape; the section tables start empty (nothing
  of today's website is imported).
- **G.** `npm run db:check` passes (drizzle-kit check, the migration files' hashes and order, the seeds against the
  registries).

Three inherited migration tests were widened for the sixth file (item 41).

### 8. Tables implemented

Four tables, A1's columns (A1-DATABASE-SCHEMA §7, "Pages and the section (block) model"):

| Table | What it holds |
|---|---|
| `page_sections` | owner (`page_id` or `service_id`, exactly one, CASCADE), `position` (≥ 1, unique per owner), `block_type` (`^[a-z][a-z_]*\.[a-z][a-z_]*$`), `schema_version` (≥ 1), `settings` (JSON), `is_visible`, `show_desktop` / `show_tablet` / `show_mobile` (at least one on), `is_locked`, `anchor` (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, ≤ 64, unique per owner), `reusable_section_id` (RESTRICT), `detached_from_id` (provenance, no key), timestamps and actors |
| `page_section_translations` | `section_id` + `locale` (key), `content` (JSON), A1's translation status columns |
| `reusable_sections` | `name`, `block_type`, `schema_version`, `settings`, A1's publication, timestamp and soft-delete columns (A5 writes only working states: unpublished · draft, archived · none) |
| `reusable_section_translations` | `reusable_section_id` + `locale`, `content`, translation status |

A section's layout version is its owner's root `lock_version` (pages, services: A3's columns); a reusable section has its
own `lock_version`. `content_references` (A1's reference index) is left to A8, where publication needs it: A5 resolves
"used by" through `page_sections.reusable_section_id` (indexed) and the section JSON (small tables, read on demand).

### 9. Block registry architecture

`src/server/builder/` is framework-free (explicit `.ts` imports, used by the Server Actions, the CLIs' tests and Node
directly):

- **`block.ts`** — what a block type is: its key and version, label, category, icon and description, the owners it
  belongs to, `max` instances, `locked`, `h1` (the page's one main heading), its anchor policy (`fixed` with
  `fixedAnchor`, `editable` or `none`), `reusable`, `storable`, its structure policy (`FIXED`, `BESPOKE_OPTIONAL`,
  `CLOSING`, `FREE`), the ids its component renders (`renderedIds`) or builds from record slugs (`recordIds`), its
  settings and content fields, design controls, cross-field rules and upcasters.
- **`blocks/*`** — the 87 definitions (`home.ts`, `page.ts`, `about.ts`, `services.ts`, `capabilities-projects.ts`,
  `company.ts`, `generic.ts`; `kit.ts` holds the field constructors).
- **`fields.ts`** — the field language: text (plain, bounded), textarea, lines, rich text, enum, boolean, int, value,
  media (A4 ids by kind), selection (A3 records, manual or automatic), link, design, repeated items. From each block's
  declaration it derives the strict Zod schemas, the defaults (functions, never shared), language completeness, the
  references, the values shown as text (`shownValuesOf`) and a duplicate's new item ids. One source per block; no second
  list of fields anywhere.
- **`registry.ts`** — assembles and checks the definitions (unique keys, every owner known, a renderer for every key —
  `src/components/builder/render.tsx`'s map is typed over every registered key, so a missing renderer fails typecheck) and
  exposes `validate` (what an editor sends) and `read` (what the database holds; item 12).
- **`structure.ts`** — the owner contracts and the structural checks (item 13); **`design.ts`** — the inspector's token
  vocabulary (item 24); **`richtext.ts`**, **`links.ts`** — the document and link models (item 20).
- Around it: `sections.ts` and `reusable.ts` (the changes), `store.ts` (reads and locks), `references.ts` (media,
  records, the certificate guard), `texts.ts` (translation states), `editor.ts` (the builder's model), `preview.ts`,
  `preview-data.ts`, `view.ts` (what a section shows) and `input.ts` (what the Server Actions accept).

### 10. Exact bespoke block count

**59**: homepage 10 (`home.hero`, `home.capability_strip`, `home.about`, `home.services`, `home.machinery`,
`home.projects`, `home.industries`, `home.clients`, `home.compliance`, `home.contact`); the inner pages' opening and
closing 2 (`page.hero`, `page.closing_cta`); About 13; the services overview 1 (`services.index`); a service page 11
(`service.hero`, `overview`, `scope`, `process`, `machines`, `applications`, `gallery`, `why`, `related`, `projects`,
`cta`); Capabilities 5; the Projects overview 4; the project page template 3; Industries 2; Clients 1; Certificates 2;
Contact 2; the legal pages 2 (`legal.contents`, `legal.section`); the 404 1.

### 11. Exact generic block count

**28**: 27 storable — `generic.hero`, `heading`, `rich_text`, `image`, `text_image`, `gallery`, `video`,
`services_grid`, `projects_grid`, `machine_grid`, `client_logos`, `certificates`, `statistics`, `feature_cards`,
`timeline`, `process`, `industries`, `faq`, `cta`, `contact_details`, `quote_form`, `map`, `logo_strip`, `divider`,
`spacer`, `button_group`, `downloads` — and `generic.reusable`, a library entry only (an inserted section keeps the
reusable section's own block type and a link to it).

### 12. Schema-version / upcaster design

Every block has a version (all are 1 today) and `upcasters` keyed by version: n → n + 1 for every n below the current
one. `REGISTRY.read` decides what a stored section is:

- a version newer than the code knows is never shown or edited (it would be read silently wrong): the builder shows it
  read-only with its reason, the preview a placeholder;
- an older one is upcast step by step; a missing step fails closed ("unsupported"); the result is validated again in
  full;
- anything invalid is reported, never rendered (an admin-only placeholder with the reason, never a stack trace);
- stored JSON is never rewritten in place: a section is saved at the latest version only when someone edits it, and then
  its texts are written at that version too (security review F3: a settings-only save of an upcast section used to leave
  the texts in the old shape).

`createRegistry` takes any list of definitions, so the unit tests exercise upcasts to versions the real blocks do not
have yet (a v2 block whose upcaster renames a content field, a gap, a future version).

### 13. Structure policy

`structure.ts` holds one contract per kind of owner — `home`, `system:<about|services|capabilities|projects|industries|
clients|certificates|contact|not_found>`, `legal:<privacy|terms>`, `template:project_detail`,
`template:service_detail_default`, `generic` and `service`:

- `h1`: the block that carries the page's one main heading (`home.hero`, `page.hero`, `service.hero`, `project.hero`,
  `generic.hero`, `not_found.view`): always first, visible on every device, locked.
- required parts: the h1 block and every `FIXED` block the registry gives the owner.
- `initial`: today's composition, in order. An empty layout is "not set up"; **Set up this layout** inserts it (empty
  texts, defaults) in one change.
- `additions`: the generic blocks the owner may receive. The site's own pages and services take 24 safe additions (no
  second main heading, quote form or map); the Certificates page the same minus Contact details (F1); generic pages all
  27 storable generic blocks; the legal pages, the 404 and the project page template none.
- `last`: the closing call to action stays at the end.
- `protectedAnchors`: anchors other pages link to (`console` on Capabilities, `gallery` on Projects, `quote` and
  `location` on Contact) must stay.

`layoutIssues` checks the final layout of every save, whoever makes it: owners and maxima, one h1 block first, required
parts present and visible, anchors valid and unique — also against the ids the shell and the components render
(`renderedIds`) and build from record slugs (`recordIds`: `m-<machine>`, `line-<service>`, `<machine>-name`,
`<service>-title`, the record slugs themselves; I1) —, protected anchors present, the hero's composition the owner's,
and the legal sections exactly today's. `changeIssues` checks what changed against the stored layout: removals,
additions, moves, visibility, anchors and reusable links are structure; texts and settings are content.

### 14. Locked-section rules

- `is_locked` is set from the registry when a section is created and is never read from input: nobody can change it or
  a section's block type.
- A locked section is never moved, hidden, removed or duplicated, by anyone; locked sections keep their order relative to
  each other; their texts and settings stay editable with the content permission.
- The legal pages, the 404 and the project page template are locked whole: their layout is exactly the initial one, in
  order (`lockedReason` in words).
- The builder shows each refusal's reason in words ("This section is a required part of this page.", "Homepage hero must
  remain first.", "Legal-page structure is locked." …), and the server decides again on save.

### 15. Generic-page builder

A generic page (A3: `page_type = 'generic'`, created at Pages → New) starts with no sections; **Set up this layout**
(`pages.edit`) creates its one locked `generic.hero`. Owner, Admin and Editor (`pages.edit`) then add any of the 27
storable generic blocks, edit their texts and settings, reorder, hide, set screens and anchors, duplicate, remove and
link reusable sections. `tests/integration/builder-sections.test.ts` ("a generic page's layout", 16 tests) and the
browser tests' generic page (6 tests) cover it.

### 16. Service builder

A service's page belongs to the service (`page_sections.service_id`); the service record (A3) supplies its facts (name,
number, tagline, summary, cover, gallery, machines, related services, featured projects), the blocks hold the page's
copy, labels and today's layout variants (`looks.ts`' choices as enumerated settings). **Set up this layout** inserts
the template's eleven parts in today's order (`template:service_detail_default`); structure belongs to Owner and Admin
(`services.edit` + `services.archive`), texts to whoever edits services (Editors included). `service.hero`,
`service.overview`, `service.scope` and `service.process` are required; the process note ("general workflow, not a
certified procedure") is a required field; the closing call to action stays last; machinery, applications, gallery and
projects show only where the record holds them. The template itself (a generic page record of type
`service_detail_default`, when registered) has the same contract; a service set up from it refuses an archived or
missing reusable link (F2).

### 17. Bilingual content

English and Arabic are equals: each section's texts are one JSON document per language (`page_section_translations`),
validated by the same strict schema; neither language is required to save; a language exists only while it holds text
(emptying it removes its row). Repeated items keep one id across languages (item 19). Arabic inputs are `dir="rtl"
lang="ar"`; the preview draws each language with its own direction, faces and wording (the language switch of the
preview's header changes the builder's view). Nothing is translated automatically.

### 18. Translation status

A3's one rule (`cms/completeness.ts` `planTranslationStatus`, applied by `texts.ts`): a language is missing, incomplete
(required texts empty), draft, complete (the editor marks it complete; only possible when its required texts are filled)
or needs review. Changing one language of a complete section sets the other to "needs review" unless the editor says
the change does not affect it ("The other language is unaffected"). The statuses are computed on the server; the client
sends only the checkboxes. The outline marks each section's languages, and the preview notes a missing language.

### 19. Repeaters

Repeated items (A1-CONTENT-MODEL §5.5) keep their order and non-text options in settings (`[{ id, … }]`) and their
texts per language in content, keyed by the same ids (`{ [id]: { … } }`); every language present must cover exactly
those ids. Ids are lowercase ASCII (`^[a-z0-9][a-z0-9-]{0,39}$`); new items get `i` + 8 random base-36 characters; a
duplicated section gets new item ids and its texts follow them. Each repeater has a minimum, a maximum and an initial
count; items move up and down with buttons (no dragging); removing a section that holds items asks first.

### 20. Rich-text model

`richtext.ts` (A1-CONTENT-MODEL §12): a validated JSON document, never HTML. Nodes: paragraph, heading (levels 3 and 4
only; a page's h1 and a section's h2 are structural), bulleted list, numbered list, list item, line break. Marks: bold,
italic, link (a structured target) and language (`en` / `ar`; the renderer adds the direction). Text follows A3's
plain-text rules (no control or direction-override characters, nothing in angle brackets). Limits per field (nodes,
characters); the whole JSON value is depth-bounded (16; the deepest valid value is 13, I6). An unknown node, mark or key
fails validation, so a document can never carry a script, a style, an event handler or another URL scheme. A3's
paragraph documents are valid documents (A3 content reads unchanged). `RichText.tsx` builds React elements from a
validated document only; the editor (`RichTextEditor`) converts pasted content to the model and never takes markup.

Link targets (`links.ts`): a page of the site by key (with an optional anchor), a generic page by id, a service, a
project or a machine by id, an anchor on the same page, an external `https:` address (no credentials, no private hosts,
normalised to `URL.href`), and — only where a field allows contact links — `mailto:` (no `%` or `#`, I3) and `tel:`.
There is no free URL kind: `javascript:`, `data:` and every other scheme cannot be expressed.

### 21. Entity selections

A selection names A3 records (services, projects, machines, clients, certificates, industries): **manual** (ids in the
editor's order, at most the field's maximum) or **automatic** (`all`, `featured` where the collection has the flag, or a
project `category`, with a limit). Records are A3 ids, checked against their own table with share locks when newly
chosen; an archived record stays where it was but is never added anew; a missing one is refused. In the preview the
manual order is kept, automatic modes follow the collection's order, and archived or missing records are left out with a
note. Projects with a blocking flag never show their photos. One exception, by the freeze: the homepage's machinery
showcase (`home/Machinery.tsx`, whose bytes the public suite pins) draws only its six approved machines, in its own order,
whatever the selection holds; the preview notes a chosen machine it leaves out and an order it does not keep
(`showcaseNotes`, item 52).

### 22. Media integration

A section names A4 media items by id (never paths or URLs), per field kind (image, document). A4's one rule for content
applies (`cms/media-refs.ts`): never private (refused exactly like an unknown id), the field's kinds, and the stricter
"newly chosen" rules (not in the Trash, not archived, a ready file; share-locked inside the save) for items the section
did not name before; kept items may stay. Choosing never approves or publishes anything. The preview draws an item as an
image only while it has a `public_media` row (public, approved, no blocking flag, not in the Trash, a ready file) and
otherwise an admin-only placeholder that says why ("Pending review", "Restricted", …); a private item says only "Not
available". The media picker is A4's (`MediaPicker`). Uploaded items (`/media/u/**`) are drawn as they are
(`unoptimized`): Next's optimizer never takes them (A4's `images.localPatterns`).

### 23. Focal point

A4's focal point (x, y in 0–1 on the media item) is applied wherever a block crops a photo (`object-position` in
`BlockImage.tsx`, the cover frames of the generic image, text-and-image, hero and gallery blocks); a photo is never drawn
larger than its file (a frame is at most as wide as the source). The bespoke blocks draw their photos exactly as the
approved components do. The browser test "a photo from the media picker at its focal point" checks the computed
`object-position`.

### 24. Design inspector

`design.ts`: typed values that name the approved design system's tokens, never CSS. A block's registry entry declares
which controls it offers; the settings schema accepts exactly those keys and values; `frame.tsx` turns them into
`data-*` attributes that `src/components/builder/blocks.css` styles from the Modern Commerce tokens.

- Type role (display, h2, h3, lead, body, small), heading level (2–4), alignment (start, centre, end — logical, mirrored
  in Arabic), measure (narrow, normal, wide), gaps, padding, width (page, wide, full), media position, columns (1–4).
- Appearance: surface (plain, muted sheet, raised sheet, dark panel) × tone (steel, teal, brass, orange accent), border,
  radius, shadow. Only combinations that reach AA (4.5:1) for the tone's text and the body text in both themes are
  offered (`APPEARANCE`; all 16 do today); orange is an accent tone, never a surface.
- No letter-spacing control (Arabic is never letter-spaced), no free number, colour, font or CSS text.
- `tests/unit/builder-tokens.test.ts` reads `system.css` and `blocks.css` and fails when a token the inspector names
  drifts or is missing.

### 25. Responsive controls

Two layers: **where a section shows** — desktop, tablet, phone (at least one; "hidden" separately), honoured by the
preview's screen sizes and saved per section — and **responsive design values**: desktop is the base, a block that
allows it may override chosen controls for tablet (≤ 1023 px) and phone (≤ 639 px) (`responsive` in the settings, the
same enumerations). The inspector shows the effective value at each size. The builder's preview frame switches between
1280 (desktop), 768 (tablet), 390 (phone) and 320 px (small phone); a section's screens decide what each one shows.

### 26. Motion controls

Presets only (none, reveal, fade, slide, scale, stagger), the approved durations (`--dur-1`–`--dur-4`) and a delay
(0–600 ms in 60 ms steps). What a block may choose follows what its animated element holds (`motionPresetsFor`): words
never fade or scale (text appears whole and rises or slides — the Stage 1I rule), media may also fade and scale,
decoration may fade, lists may stagger (each item appears whole, in turn). No layout-shifting or continuous animation
exists to choose; every preset is a one-time transform on reveal; `blocks.css` holds every preset inside
`prefers-reduced-motion: no-preference`, so reduced motion always wins. Unit tests cover each rule.

### 27. Preview architecture

- **Route.** The route group `src/app/(preview)/admin/preview/` has its own root layout: the Modern Commerce
  stylesheets and page sheets, the faces (Arabic preloads on Arabic previews), `Ambient`, `Cursor`, `Motion`, and its own
  boot script without the stored theme (the theme is the preview's, never the visitor's). `[kind]/[id]/page.tsx` reads
  `locale`, `theme`, `device` and `frame` from the address.
- **Model.** `loadPreview` (`preview.ts`, `preview-data.ts`) reads the saved working layout for one request: the visible
  sections for the chosen screen size, each section through `REGISTRY.read`, the records and media the sections name in
  batched reads (item 36), and notes per section. Never cached.
- **Rendering.** `PreviewCanvas` → `render.tsx`: every registered key has a renderer. Bespoke blocks draw the approved
  components (`src/components/commerce/*`) through adapters (`src/components/builder/adapters/*`) that build the same view
  types the static pages build; generic blocks are `src/components/builder/generic/*` inside `frame.tsx`; `compose.tsx`
  does what the pages do around their sections (a part whose content is missing shows nothing, numbering, a service
  page's alternating surfaces, parts that share one frame). A section that throws becomes an admin-only placeholder
  (`SectionBoundary`); an unreadable one shows its reason.
- **Canvas and bridge.** The builder frames the preview (`Canvas.tsx`, `sandbox="allow-scripts allow-same-origin"`) and
  reloads it after each save; `PreviewBridge` (frame mode) finds each section on the page, outlines the selected or
  hovered one, reports clicks and keeps links and forms from navigating the frame; messages go both ways by
  `postMessage`, accepted only from the other window and this origin, with their shape checked
  (`preview-protocol.ts`). Nothing the frame sends saves anything.
- **Parity.** `e2e-admin/preview-parity.spec.ts` (item 42) lays out five pages in the builder with today's approved
  words and compares each part the preview draws with the same part of the public page: DOM, text, media and pixels
  (30 of the 59 bespoke blocks; item 52 lists what it leaves out).

### 28. Preview security / CSP

- The admin gate first (the layout's `assertAdminEnabled()`; off: the public 404 path, no database).
- `requireActor` (a signed-in session with every step done; otherwise the sign-in page — a new tab needs the session
  too; no bearer link exists), then `content.view` and `preview.use` (the registry's keys); an unknown kind or id, or a
  trashed owner, is "not found".
- Headers (`PREVIEW_PAGE_HEADERS`): `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, `X-Frame-Options:
  SAMEORIGIN`, the admin's other headers; robots meta `noindex, nofollow, nocache`; rendered at request time only
  (`connection()`). Not in any sitemap; no public page links it.
- Its own CSP (`previewContentSecurityPolicy`, `src/lib/admin-headers.ts`), set by the proxy's admin branch for
  `/admin/preview/**` only: the admin's nonce rules (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self'
  'nonce-…'`), plus `style-src-attr 'unsafe-inline'` (the components set custom properties such as a reveal's delay; no
  person's CSS reaches them), `frame-src` limited to `https://www.youtube-nocookie.com`, `https://player.vimeo.com` and
  `https://www.google.com` (typed ids and address searches only, never an embed code), `form-action 'self' mailto:` (the
  quote form's hand-off), `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'none'`. Every other admin page keeps
  the admin's own policy (not weakened).
- The preview's language and theme reach the layout as `x-preview-locale` / `x-preview-theme`, always set by the proxy
  from the address (a header a client sends is replaced).
- Frames: the builder's canvas is sandboxed (`allow-scripts allow-same-origin`), and so are the generic map block's frame
  (`allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`) and the generic video player; none may
  navigate the window above it (F6). The bespoke Contact block draws today's map frame unchanged (see the end of item
  35).
- Browser test "the preview in its own tab: private, never indexed or stored, framed by the admin only; anonymous
  visitors sign in", and the gate tests (off: every builder, reusable and preview address is the public 404 path).

### 29. Reusable sections

A generic block marked reusable, kept once (`reusable_sections` + translations) and linked by page sections on any page
or service whose contract allows that block. Its own aggregate root with its own `lock_version` ("This reusable section
changed after you opened it…"). `/admin/reusable-sections` lists them (block, used by, state); `new` creates one from a
block's defaults (`reusable_sections.edit`: Owner, Admin, Editor); `[id]` edits its settings and texts (strict validation,
references, language states — checked as the copy of every page that links it, F1) and shows where it is used. Archive
and restore need `reusable_sections.archive` (Owner, Admin); archiving is allowed only while nothing links it (a locking
read under its row lock; the database's RESTRICT key behind it); an archived one is read-only and can't be linked anew.
Editing changes only the working previews of the pages that link it.

### 30. Link / detach

- **Link.** Add a block → Reusable sections inserts a section that stores the reusable section's block type and
  `reusable_section_id`; its own settings and texts are ignored while it is linked (the preview shows the reusable
  section's). Linking needs the structure permission (an addition) and is allowed only where the owner's contract
  allows the block; the reusable section is share-locked (with locking reads of every column the decision uses) before
  the owner's sections are locked, so an archive and a link never cross (F2). A linked section duplicates as another link.
- **Detach (make a local copy).** Copies the reusable section's current settings and texts into the page's own section
  (new item ids, `detached_from_id` set), which no longer follows it; needs a clean builder and the layout's version.
- **Make it reusable.** From a section: an explicit copy (the section stays as it is; the new reusable section is in the
  library) or "Create and link" (structure holders: the section becomes a link to it). Nothing is linked unless chosen.
- Link, duplicate, detach and edit run the certificate guard for every page involved (F1).

### 31. Concurrency

- **The layout's version.** Every change locks the owner's root row FOR UPDATE and refuses a version other than the one
  the builder opened: "This page layout changed after you opened it. Reload and review the latest version before saving."
  Typed values stay in the browser until a reload. A save that changes nothing does not move the version.
- **Lock order.** Owner root (X) → the reusable sections the change shows anew (S, id order, locking reads) → the owner's
  sections (X). A reusable section's archive: its row (X) → the sections linking it (S); an archive and a link never form
  a cycle (F2). A reusable section's edit: its row (X) → the records it newly references (S) — when one of them is a
  page or service that a concurrent save is linking it into, the two orders cross and InnoDB ends one; `inTransaction`
  retries it once and it decides again under its locks (final pass L3, availability only, as A3's project ↔ service
  case). Every read a decision rests on is a locking read (A3's snapshot gotcha).
- **Positions.** Renumbered through a free range in one transaction, so the unique (owner, position) key never collides.
- **Tests.** Two editors saving one version: exactly one wins, the other is stale; eight editors reordering one version
  at once: exactly one wins, positions stay dense; archive-versus-link and detach-versus-edit held deterministic with a
  third connection's row lock (F2); a browser test with two people on one layout.

### 32. Undo / redo boundary

Undo and redo work on the builder's working copy in the browser, for the session, until the next save or reload: adds,
removals, moves, visibility, screens, anchors and edits. A save, set-up, link, detach or "Make it reusable" makes the
saved layout the new starting point (link, detach and "Make it reusable" need a clean builder for that reason). Leaving
with unsaved changes warns (`beforeunload` and same-origin links). A removal that was saved can't be undone in A5: the
layout's history needs revisions (A8).

### 33. Audit

One event per operation, written in the change's transaction: `layout.save`, `layout.initialize`, `layout.reorder`,
`section.create`, `section.update`, `section.remove`, `section.duplicate`, `section.visibility`, `section.anchor`,
`section.link_reusable`, `section.detach_reusable`, `reusable_section.create`, `reusable_section.update`,
`reusable_section.archive`, `reusable_section.restore`. Each holds block names, ids and states — never texts or JSON.
Refusals are audited too: permission refusals as `denied`, structure-policy refusals, stale archives and refused
detaches as `failed` (F5). Integration test "every kind of change writes its audit event; a refusal is audited too;
texts never enter the audit".

### 34. RBAC

Permission keys from the session only (`decideAccess` / A2's registry), never role names (`structure.ts`):

| What | Keys | Roles today |
|---|---|---|
| open the builder, see the layout | `content.view` | all four |
| texts and settings: generic, system and home pages, the service template | `pages.edit` | Owner, Admin, Editor |
| texts and settings: legal pages | `legal.edit` | Owner, Admin |
| texts and settings: services | `services.edit` | Owner, Admin, Editor |
| structure: generic pages | `pages.edit` | Owner, Admin, Editor |
| structure: the site's own pages, the service template | `pages.edit` + `pages.archive` | Owner, Admin |
| structure: services | `services.edit` + `services.archive` | Owner, Admin |
| structure: legal pages, 404, project template | nobody (locked) | — |
| set up a layout | the structure keys (legal pages: `legal.edit`) | as above |
| reusable sections: create, edit | `reusable_sections.edit` | Owner, Admin, Editor |
| reusable sections: archive, restore | `reusable_sections.archive` | Owner, Admin |
| preview | `content.view` + `preview.use` | all four |

Every Server Action calls `actionContext` (gate, session, same origin) before it parses its input or answers anything
about it (the archive action reads only its `archived` flag first, to name the refusal it audits, as A3's), and the
services decide the permission again inside the transaction. A Reviewer views and previews only; every save, set-up, link, detach or
reusable change from a Reviewer is refused and audited (integration and browser tests, a forged Server Action included).

### 35. Security-review findings / fixes

**First review** (brief §68), an adversarial read-only review of every A5 commit up to `a0f381b`. It found no stored XSS,
dangerous URL scheme, CSS injection, IDOR, preview bypass, private-media leak or Reviewer write, and:

| Id | Severity | Finding | Fix |
|---|---|---|---|
| F1 | Medium | Certificate digit guard bypass on the Certificates page: values shown as text (a figure, a contact block's phone) were not read; reusable sections were always checked as "generic"; anchors were not guarded | `6da85c2`: every value shown as text is read (`shownValuesOf`; `technical` values never shown); a reusable section is checked for every page linking it, when linked, duplicated, detached or edited (a locking read of its links); an anchor on certificate copy holds no 7-digit run; the Certificates page takes no Contact details block |
| F2 | Low | Archive-versus-link race: the reusable section's state was read from the transaction's snapshot after a waited share lock, so an archive committed in between was missed (and a detach could copy older texts) | `6da85c2`: locking reads of every column and the translations; the reusable sections are share-locked before the owner's sections |
| F3 | Low (latent) | A settings-only save of an upcast section stored the new version with texts in the old shape | `6da85c2`: an upcast section's texts are rewritten at the new version |
| F4 | Low | Reusable section names skipped the plain-text rules (control and bidi characters, markup) | `6da85c2`: A3's `plainText(120)`, never empty |
| F5 | Low | Structure-policy refusals, a stale archive and a refused detach were not audited | `6da85c2`: audited as `failed` |
| F6 | Low / Info | The map frame had no sandbox; the canvas frame was unsandboxed | `eee94f3`: both sandboxed, no top navigation |
| I1 | Info | Ids the components build from record slugs (`m-<machine>`, `line-<service>`, …) were not reserved | `6da85c2`: `recordIds` reserved on their page |
| I2 | Info | Copies (template set-up, "Make it reusable", detach) carry media and records the source already named, skipping the "newly chosen" rules | Detach now checks references for the target; otherwise accepted: a kept reference may stay (A4's rule), private media can't reach a section |
| I3 | Info | Email targets accepted `%` and `#` | `6da85c2`: refused |
| I4 | Info | A reusable section's edit needs `reusable_sections.edit` only, not each linking owner's content permission | Accepted and documented: no owner with a stricter permission can link one today (the legal pages take no additions) |
| I5 | Info | Zod 4.6.5 copies value defaults one level deep, so default arrays and rich documents were shared between parses | `6da85c2`: function defaults |
| I6 | Info | The depth limit (12) refused a valid FAQ answer with a link in a list item (13) | `6da85c2`: 16 |

`1f006e1` adds the tests: 8 unit (`tests/unit/builder-review.test.ts`) and 11 integration
(`tests/integration/builder-review.test.ts`). Negative control: on `a0f381b` with only the tests applied, the unit file
fails 8 / 8 and the integration file 11 / 11 (each test fails; logs kept); on the fixes all 19 pass.

**Final security pass** (brief §92): a second adversarial, read-only review of `cc0cae2..1f006e1`, which answered the
brief's six questions one by one and re-checked every fix above (F1–F6, I1, I3, I5, I6: correct). It found **no High or
Medium**; 3 Low and 3 Info:

| Id | Severity | Finding | Outcome |
|---|---|---|---|
| L1 | Low | F1's guard read a section's texts line by line, so a line break inside one field — drawn as a space — split a number or an expiry phrase past it ("Registration 1010⏎123⏎456", "This licence is valid⏎until 1447 AH" on the Certificates page: both saved) | Fixed in `eeead56`: each text piece is checked on its own, as it is drawn (a text or paragraph field whole, each line, each paragraph, heading or list item; repeated items alike), and the issue names its field |
| L2 | Low | Invisible format characters (Unicode Cf: zero-width space and joiners, LRM / RLM, ALM, soft hyphen, word joiner, byte-order mark) — accepted as plain text — between the digits hid a number from A3's guard (inherited from A3) | Fixed in `eeead56`, in A3's shared guard (`cms/text.ts`): the guard reads past them, for numbers and expiry wording alike (stricter only; A3's tests unchanged and passing) |
| L3 | Low (availability) | A lock-order cycle: a layout save linking reusable section R into page P locks P, then R; an edit of R that newly links P (a button to it) locks R, then P. The two can deadlock, and three comments said they never cycle | Comments corrected in `eeead56`. Behaviour kept, as A3's accepted class: InnoDB ends one, `inTransaction` retries it once, every attempt decides again under its locks (nothing on an older state); a second deadlock reaches the editor as an error. Share-locking the reusable sections before the owner's row would remove it: offered with A3's diff-based relation writes as a pre-production hardening candidate (item 55) |
| I4 | Info | Two more text sources on certificate copy: link targets (an address or an anchor carrying a number), and the A4 media item's alt text, which an image uses when its block leaves its own alt text empty | Link targets fixed in `eeead56`: an external address, an anchor (this page's or another's), an email address or a phone number holding a registration number is refused on certificate copy. The alt-text fallback is documented (item 52): it is A4's text, it can change after the section is saved, so it belongs to A8's check of the rendered page at publication |
| I5 | Info | Copies (template set-up, "Make it reusable", detach) skip the "newly chosen" reference rule, so a trashed or archived media item or an archived record can be copied into a new section | Accepted, as the first review's I2: private items can never pass a first save, and publication (A8) refuses anything not deliverable |
| I6 | Info | An authority question: Editors can choose and order the certificates a section shows (manual selections in `certificates.register`, the Certificates page's opening, the compliance blocks and `generic.certificates`), while A3 keeps the certificate collection's own order to Owner and Admin | For RAWASY (item 52): nothing is exposed (only the redacted previews are ever shown) |

`40ee741` adds the tests: 3 unit (`tests/unit/builder-review.test.ts`, "Final review — certificate copy as a visitor
reads it") and 1 integration (`tests/integration/builder-review.test.ts`, the same title). Negative control in a
worktree of `96c3ebb` with only the tests applied: the 3 unit tests fail on the assertions they target (0 issues for
"Registration 1010⏎123⏎456"; `hasRegistrationNumber` false for the zero-width-split number; no link issue), and the
integration test records all five sections — a number over three lines, an expiry phrase over two, zero-width spaces
between the digits, a word joiner between every digit, a number in a button's address — **saved** on the Certificates
page; on the fixes all four tests pass, the five sections are refused there and the same five save on a generic page.

The six questions (brief §92), answered by the final pass on the code and re-checked after the fixes:

1. **Executable code?** No. Text is A3 plain text or the strict rich-text model drawn as React elements; no
   `dangerouslySetInnerHTML` for editor content (only the JSON-LD, which escapes `<`, and the nonce'd constant boot
   scripts); links come only from `resolveLink` (https external addresses, `mailto:` / `tel:` built from checked values,
   no free URL kind); video ids are checked again when drawn; the map place link is https with a host allow-list; design
   values are enums; stored data is validated again by the registry when drawn (tampered JSON becomes a placeholder).
2. **Escape validation?** No (after L1 and L2): strict schemas everywhere, `__proto__` keys refused, depth bounded
   before Zod (100,000 levels refused in 0 ms), size caps before `JSON.parse`, and lock state, versions, statuses and the
   actor never read from input.
3. **Private data?** No: private and unknown media are refused alike, newly chosen or kept; media cards are built
   without private access; the preview shows `public_media` rows only and certificates' `public_preview` documents only;
   section ids are looked up within the locked owner only.
4. **Bypass a structure lock?** No: the change and layout checks run on every save (permission per block, pinned order,
   the h1 first, the closing section last, required parts present and shown, fixed anchors, `is_locked` tied to the
   block type, `allowedOn` for new, linked and duplicated sections, maximum counts, locked contracts equal to their
   starting layout); detach checks the lock; a linked reusable section needs the structure permission.
5. **Overwrite a newer layout?** No: every change locks the owner's row and compares `lock_version`; reusable sections
   compare theirs under FOR UPDATE; an archive decides on a locked read of the links.
6. **Anonymous preview?** No: the admin gate, `connection()` + `assertAdminEnabled()`, `requireActor()` with
   `content.view` and `preview.use` (anything else is not found), no-store and noindex, framed by the same origin only,
   no bearer link; only the preview's own policy is loosened (inline style attributes, three frame hosts, `mailto:` as a
   form target), never the global admin CSP.

One observation, not a finding: the public Contact page's map frame keeps today's attributes (byte-identical, frozen
since TM-2.2); inside the builder's canvas it inherits the canvas's sandbox, while in the preview's own tab it is drawn
as on the public site.

No unresolved High or Medium A5 finding remains.

### 36. Performance / batching

- The builder's model and the preview read records and media in batches (one query per table, not per section):
  integration test "the builder's model and the preview of 30 sections take the same number of queries as 3".
- A layout save is one transaction with set-based writes; limits: 60 sections, 48 KB a section, 900 KB a save (refused
  unread past it; the global Server Action body limit is not raised), JSON depth 16.
- The preview is rendered per request; the canvas reloads only after a save, not on every keystroke (the inspector edits
  the working copy; the preview shows the saved one).
- Sharp, the image optimizer and the public pages' bundles are untouched (item 38: the public pages' scripts identical).

### 37. Accessibility

- Builder: every control labelled; one `h1` per screen and headings per panel; the outline is a list with Move up / Move
  down buttons (no dragging needed); status changes ("Saved", "Undone.") in a polite live region; refusals in words
  next to the control; the preview frame has a title; focus stays on the control after a move; phones get one view at a
  time (tabs) with no sideways scroll at 390 and 320 px.
- axe-core (WCAG 2.0–2.2 A/AA) on the builder, the reusable editor and the list: no violations (browser test "axe on the
  builder, the reusable editor and the list; labels, headings, the frame's title").
- The preview draws the approved components, so the public site's accessibility work (contrast, motion, focus, RTL) is
  what an editor sees; generic blocks follow the same rules (no fading words, reduced motion wins, AA appearance pairs).
- Evidence: item 50.

### 38. Public freeze proof

Against `preserve/pre-admin-a5` (`cc0cae2`), built in a worktree, and the final build: the fresh clone of `f2b73c9`,
copied right after `next build` (no database settings, no `RAWASY_DATA_DIR`, no admin secret in the environment).
Everything below ran on that final code.

- **Source.** Since `cc0cae2` the public paths changed only where the brief allows a narrow refactor (§74): 24 files in
  `src/components/commerce/` and `src/lib/project-cards.ts`, in the public-component commits of item 3. Each moves a
  page's existing markup into exported components, or one rule into one function, so the preview can draw the same
  component: no CSS, no copy, no data, no route. `home/Machinery.tsx` and `home/MachineShowcase.tsx`, which the public
  suite pins byte for byte, are identical to `cc0cae2` (`fc51705`). The reason in each case is reuse — the preview draws today's sections through these
  components, never a copy of them. Unchanged since `cc0cae2`: `public/`, `src/content/`, `src/i18n/`, the public route
  group `src/app/(commerce)/`, the fallback 404 and its fonts, `src/fonts/`, every stylesheet of the public site,
  `server.js`, `next.config.ts`, `package.json` / `package-lock.json`, the packaging and warm-up scripts, and the public
  E2E tests and their config. Outside the components, A5 changed `src/proxy.ts` (its admin branch only: the preview's
  policy and its language and theme headers, for `/admin/preview/**` while the gate is on) and `src/lib/admin-headers.ts`
  (the preview's headers). No public file imports the builder's or the admin's code (a search of the public folders finds
  none; a lint rule refuses `src/server/**` there), and no public page reads the new tables.
- **Build output.** The baseline's 939 files under `.next/server/app` (the admin and the preview left out) are all in the
  final build, and nothing else is: 114 byte-identical, 598 identical once the build id and `/_next/static` chunk paths
  are normalised, 0 that differ only in the router's sibling entry (both builds list `["admin","api","media"]`: A5 adds
  no top-level route), and **3 different: `en/terms.html`, `en/terms.rsc` and `en/terms.segments/_full.segment.rsc`**.
  The 224 server bundles, source maps and manifests are left out of the byte comparison: they hold the server's code,
  which A5 changed for the admin; what they serve is compared over HTTP below, and the browser's code module by module.
- **The one page whose files changed: `/en/terms`.** Its drawn HTML (scripts removed) is identical, 51,513 characters on
  both builds, and its page data resolve into identical trees in all three files (70 rows, 68,377 bytes resolved): moving
  the legal page's sections into exported components (`dac8c57`) renumbered the page data's rows without changing what
  they hold — the TM-2 gotcha on Flight rows. `/ar/terms`, `/en/privacy` and `/ar/privacy`, built by the same
  components, are byte-identical once normalised.
- **Stylesheets:** on all 104 prerendered public pages, the same stylesheets in the same order, byte-identical. A5's two
  stylesheets (`admin.css`, `blocks.css`) reach no public page.
- **Scripts:** on 94 of the 104 pages, the same chunk names and bytes. On the other 10 — the homepage, Capabilities,
  Certificates, Industries and Projects, in both languages — the module set is the same and exactly one client module
  changed on each: the photo helpers of the homepage's machine showcase (`ui.tsx`'s `Photo` and `Cutout`, module 9921),
  the Capabilities console (11653), the certificate register (69183), the Industries index (31377) and the Projects
  gallery (16631); each changed chunk grew by 37–86 bytes (the homepage's script 636,590 → 636,664 bytes in all,
  Projects' 605,400 → 605,474). The change is the `unoptimized` property A5 passes where a photo is drawn
  (`...x.unoptimized ? { unoptimized: !0 } : {}`; `595f50c`, `dac8c57`, `99f981b`), which static data never sets.
  Proof (`minproof.mjs`): in every copy of each module in both builds' chunks — the preview's own chunk included — those
  spreads were removed from the syntax tree and both factories minified again with one minifier and its name mangling
  (terser, as Next ships it): **all equal to the baseline** (PASS). Negative control: one token changed in the current
  copies (`className:` → `classname:`) fails every module (FAIL). The Turbopack runtime chunk
  (`turbopack-1259tmma_rllk.js`) is byte-identical on all 104 pages, and neither build holds an async module (A4's rule
  holds).
- **HTTP.** Three admin-off settings — nothing set, `ADMIN_ENABLED=0` and `APP_ENV=staging` — each against a freshly
  started baseline with its route cache emptied, gave the same results:
  - **102 / 102 sitemap pages** with the same status, headers (date, ETag and cache state aside), page data and SEO
    facts: 102 titles, 102 descriptions, 102 canonicals, 306 hreflang links, 208 JSON-LD blocks, 618 media references
    and 292,957 characters of visible text. Their normalised HTML is identical on 101; `/en/terms` draws the same page
    with the same resolved payload (above).
  - `robots.txt`, `sitemap.xml` (48,451 bytes), the manifest and both icons are byte-identical; `/favicon.ico` (no such
    file) answers 404 on both with the same headers and a body that differs only by the build id.
  - **55 / 55 redirect and locale cases** and **28 / 28 not-found cases** are identical — among them every new A5
    address with the gate off (the builders, the reusable sections and the preview: the public locale redirect, then the
    localized 404, as before A5), and **9 / 9** form POSTs to admin addresses (the same locale redirect).
  - The 13 held-back files answer exactly as on the baseline; no public page links to the admin or mentions `/media/u`;
    the API and `/media/u/**` addresses answer as on the baseline (A2's API headers, A4's plain 404 before any database
    access).
- **Release media.** All 143 release files (`public/media`) from both builds: **143 / 143** with identical bytes, status
  200 and identical headers apart from `Last-Modified` and its weak ETag, which are in every case that side's own file
  date (the worktree and the clone were checked out at different times). The 148 files in `public/` are byte-identical
  on disk; none added or removed.
- **Image optimizer.** Every `/_next/image` address the 102 sitemap pages offer — 1,484 on each build, the same set —
  requested from both builds as a browser asks (WebP accepted), each from an empty image cache: **1,484 / 1,484
  identical** (status 200, type, caching, ETag, bytes). `/og/og-en.png` and `/apple-icon.png` are optimized exactly as
  before; SVGs, `/media/u/…`, a `..` path into it, a page, a missing file and a release picture with a query string are
  refused with 400 on both builds, with the same reason.
- **No public database query.** The build served with the admin **on** (`APP_ENV=production`, `ADMIN_ENABLED=1`) and
  `DB_*` pointing at a stand-in that counts connection attempts and refuses each one: the 102 sitemap pages, their page
  data, 7 public files and 7 404s made **0 attempts**, and so did the admin's sign-in page; the positive control, a
  forged admin sign-in, made 1.
- **Pixels.** 11 representative pages were captured screen by screen (as many screens as the page's height gives, at
  most 6), in EN/AR × light/dark × desktop 1440 × 900 / phone 390 × 844, with reduced motion, every image decoded and
  the map stubbed. Result: **238 screens, 233 pixel-identical**. The other 5 were captured 3 more times on each build;
  in each, at least one pair of repeats is identical across the builds, and what remains is each build differing from
  itself by the same amount:
  - `/en/about`, phone dark (74 pixels): each build differs from itself by those 74 pixels (A2–A4 noted 66–74 on
    About).
  - `/ar/services/laser-cutting` (the Arabic signature): desktop light 37 pixels and phone dark 35; in the repeats each
    build differs from itself by 27–44. The phone's second screen (888 pixels in the first capture) was identical in
    every repeat.
  - `/en/projects`, desktop light (7 pixels): the final build differs from itself by 1–8 pixels and matched the baseline
    in one pair. In the previous round (on `b4f61f9`, whose code differs from `f2b73c9` only in the admin suite's test
    files) the same state was captured 10 more times per build: both builds drew the same two main variants, 8 pixels
    apart (the baseline 6 and 4 times, `b4f61f9` 2 and 6 times, plus two single variants 1–4 pixels from them).
- **Page heights.** Measured after each page was walked, every image loaded and decoded and the 404 rendered: **all 44
  page states (11 pages × desktop / phone × light / dark) have the same height on both builds**, with no image left
  unloaded.
- **Public E2E:** item 43.

### 39. A4 regression

Every A4 test passes on the fresh clone of `f2b73c9`: unit 35 / 35, integration 102 / 102 (two renamed only to expect the
sixth migration file, item 41) and the media browser spec 18 / 18 (items 40–42). A5 changed nothing under
`src/server/media/`, the upload, file and preview Route Handlers, `/media/u/**`, the media admin components and actions,
`cms/media-refs.ts` or `next.config.ts`. What A5 relies on and leaves as it was:

- **`public_media` invariant:** written only by A4's `syncPublicMedia`; A5 reads it and never writes it. The preview
  draws a media item as an image only while it has a `public_media` row, and otherwise a placeholder that says why
  (item 22). A4's `assertPublicMediaInvariant` still runs after every media integration test.
- **Private media isolation:** a section refuses a private item exactly like an unknown id, newly chosen or kept; the
  preview never draws one ("Not available"); certificates show their `public_preview` documents only, never a
  `private_original`. The pickers are A4's (`MediaPicker`, `mediaCards`).
- **Approval, restriction, chunk security, certificate private originals, media routes:** unchanged code, unchanged
  tests (all passing). Choosing an item in a section never approves or publishes it.
- **Held-back media:** the packaging script's own check left the 13 out of the final build's archive (item 46), and
  their addresses answer as on the baseline (item 38).
- **Image optimizer restriction:** `images.localPatterns` is unchanged. Uploaded items are drawn `unoptimized`
  (`CommerceImage.unoptimized`), so the optimizer never takes `/media/u/**`; every `/_next/image` answer of the public
  pages is identical to the baseline's (item 38).
- **Only A4's helpers:** choices go through `mediaTargetStates` and `mediaChoiceProblem` (`cms/media-refs.ts`, share
  locks on new choices); the preview reads the `public_media` projection and the item's state for the placeholder's
  reason, in one batched read per table.

### 40. Unit counts

`npm run test:unit` on the fresh clone of `f2b73c9`: **294 / 294 passed** (0 failed, cancelled, skipped or todo), 9.1 s.

Split by test name (brief §79) against the A2, A3 and A4 closing states, each listed with the same reporter on its own
checkout (A4's closing list is `a1f562e`'s, the tests of `cc0cae2`):

| Origin | Tests | Passed | Files |
|---|---|---|---|
| A2 inherited | 30 | 30 | `admin-gate` 6, `email` 2, `privilege` 4, `security` 18 — names and code unchanged |
| A3 inherited | 102 | 102 | `cms-access`, `cms-completeness`, `cms-rules`, `cms-slugs`, `cms-validation` — names and code unchanged since A4 |
| A4 inherited | 35 | 35 | `media-rules`, `media-storage`, `media-json-body`, `media-bundle`, `cms-completeness` (alt texts) — unchanged |
| A5 new | 127 | 127 | `builder-registry` 40, `builder-structure` 34, `builder-content` 21, `builder-review` 11, `builder-editing` 9, `builder-renderers` 6, `builder-tokens` 6 |
| **Total** | **294** | **294** | |

A5 changed no inherited unit test (only new files under `tests/unit/`); every name at A4's close is present.

### 41. Integration counts

`npm run test:integration` (local MariaDB 11.4.13, a fresh `rawasy_t_*` database per file) on the fresh clone:
**425 / 425 passed** (0 failed, cancelled, skipped or todo), 219 s.

| Origin | Tests | Passed | Notes |
|---|---|---|---|
| A2 inherited | 164 | 164 | names as at A4's close; `migrations.test.ts`'s expected status now lists six files (below) |
| A3 inherited | 94 | 94 | 93 with their names; 1 renamed by A5 (below) |
| A4 inherited | 102 | 102 | 100 with their names; 2 renamed by A5 (below) |
| A5 new | 65 | 65 | `builder-sections` 28, `builder-review` 12, `builder-reusable` 11, `builder-migration` 7, `builder-preview` 7 |
| **Total** | **425** | **425** | |

Inherited integration tests A5 changed — only to expect the sixth migration file; each check kept or made stricter:

- `migrations.test.ts` (A2): names unchanged; "Applied (6) … 0005_page_builder" and "Migration files OK: 6".
- `cms-migration.test.ts` (A3), A: "takes every migration (the A3 files and A4's 0004) …" → "… (the A3 files, A4's 0004
  and A5's 0005) …": six applied, nothing pending.
- `media-migration.test.ts` (A4), A: "takes all five migrations …" → "takes every migration (the A4 file and A5's 0005
  after it) …"; B: "… takes exactly the A4 file" → "… takes the A4 file (and, since A5, 0005 after it)" — it still
  asserts that no A2 or A3 file is applied again; E counts the A5 tables in the table total; G expects six files.

### 42. Admin-browser counts

`npm run test:admin` (`playwright.admin.config.ts`: one worker at a time, a fresh `rawasy_e2e_*` database, a temporary
`RAWASY_DATA_DIR`, `server.js` on 3401, no retries). The counts below are the final run's, on the fresh clone of
`f2b73c9`.

| Origin | Tests | Passed | Files |
|---|---|---|---|
| A2 inherited | 47 | 47 | `admin.spec.ts`, `gate.spec.ts` — names and code unchanged |
| A3 inherited | 17 | 17 | `cms.spec.ts` — names unchanged |
| A4 inherited | 18 | 18 | `media.spec.ts` — names unchanged |
| A5 new | 30 | 30 | `page-builder.spec.ts` 15, `preview-parity.spec.ts` 15 (the `parity` project, run last) |
| **Total** | **112** | **112** | |

Every full run of the 112 tests, in order. The A2, A3 and A4 tests and the builder's own 15 passed in every run:

| Run | Code | Result | What failed |
|---|---|---|---|
| QA 1 | fresh clone of `b4f61f9` | 107 passed, 1 failed, 4 did not run | parity "home (en, 390 px, dark)" timed out (90 s) loading the public homepage; the spec runs in order, so its last four tests did not run |
| QA 2 | the same clone, run again | 99 passed, 1 failed, 12 did not run | parity "about (en, 390 px, light)", loading the public page |
| D1–D3 | the same build, copied with an empty image cache; browser on a DevTools port, sampled every 10 s | 99 passed, 1 failed, 12 did not run — in each | "about (en, 390 px, light)" each time: the preview once (D1), the public page twice (D2, D3) |
| D4 | the same build: the other five specs (97 / 97), then the parity spec alone in a new browser, on the same server and database | **15 / 15** | — |
| V1 | `f2b73c9`'s spec and config on the same build, empty image cache | **112 / 112** (25.1 min) | — |
| Final | fresh clone of `f2b73c9` | **112 / 112** (25.7 min) | — |

What the diagnostics showed:

- The frozen tab never answered DevTools again: no reply to `Runtime.evaluate` or `Debugger.pause` for over two minutes.
  Every other tab kept drawing frames.
- The image optimizer's known defect (a cut-off first request leaves an image size unanswered) is not the cause. In
  D1–D3 every image of the frozen page had arrived, and after each run all 655 image sizes the parity pages offer
  answered within 20 s. In QA 1, three client logos and one photo were also still unanswered when the test ended, so
  the defect may have added to that run.
- No JavaScript was running: every renderer's main thread was asleep in the kernel, with no CPU time added over 3 s.
- `gdb` on the renderers (D3) found the cause. The frozen renderer's main thread was waiting in Chromium's compositor,
  `cc::LayerTreeHost::WaitForProtectedSequenceCompletion()`, entered from a scroll offset update (the spec's instant
  scroll walk). The other renderers were idle in their message loops.
- It froze only in the browser that had already run the other admin specs, about 100 tests: 5 runs of 5. With the
  parity spec in a fresh browser, against the same server and database, it passed (D4).
- In the earlier rounds the whole suite passed 112 / 112 (`40ee741`, 22.8 min; `3cc3aa4`, 22.9 min), so the freeze
  is intermittent. It hit every run between 16 and 20 October, and 4 of the 5 freezes were on the public page, whose
  code A5 does not change.

The fix, `f2b73c9`, changes no comparison and no website or admin code:

- the parity spec is the config's `parity` project: it still runs after every other spec, but in a new worker and so a
  new browser;
- it closes each test's tabs when the test ends (it used to keep up to 28 open);
- it scrolls a page only once every image is loaded and decoded. next/image decodes and re-renders each photo as it
  loads, and the walk used to scroll among those updates.

The freeze is Chromium's (headless shell 141.0.7390.37, Playwright 1.56.1), not the site's: the frozen pages were the
same pages that pass in the public suite. No retry was added.

The split is by test name against the lists taken at A4's close (`split.py`); every name at A4's close is present and
passed. The server's three "Invalid Server Actions request" log lines come from the A2 tests that send forged requests on
purpose (the same lines as in A4's runs).

### 43. Public 612 / 612

`npm run test:e2e` — the public suite, byte-identical to `cc0cae2`'s (A5 changed no public test or its config) — on the
fresh clone, against `server.js`, after the image warm-up (`scripts/warm-images.mjs`: 1,484 / 1,484 sizes warmed —
1,418 new, 66 already cached — none failed or timed out, 107.8 s). The suite has no retries; every run is reported as
it ran.

- **On `f2b73c9` (the final code): 612 / 612** (32.8 min). Every spec took longer than on `b4f61f9` (1.18× to
  1.67×, 1.50× in all), and so did every stage of this round, which ran on 20 October (lint 47 s against 26 s on
  16 October, the build 64 s against 40 s, the integration suite 219 s against 150 s). The code the public suite runs
  is the same (`f2b73c9` changes two admin test files only), and the stages ran one after another with nothing
  alongside: the machine was slower, not the pages. No test failed.
- **On `b4f61f9`: 612 / 612** (21.7 min; warm-up 1,484 / 1,484, none failed or timed out). `f2b73c9` changes only the
  admin suite's parity spec and config, which the public suite does not run.
- **On `3cc3aa4`: 611 / 612** (21.5 min; warm-up 1,484 / 1,484, none failed or timed out). The one failure:
  `commerce-capabilities.spec.ts` "the homepage machinery stays frozen: its two components are byte-identical to TM-3",
  which hashes `home/Machinery.tsx` and `home/MachineShowcase.tsx` against TM-3's bytes. A5's `595f50c` had moved the
  showcase's machine order out of `Machinery.tsx` into `getHomeView`: the page did not change (the freeze proof's
  output comparisons passed on that build too), but the file did. The expectation stays as it is (brief §73): `fc51705`
  put `Machinery.tsx` back to its TM-3 bytes (`MachineShowcase.tsx` was untouched), and `b4f61f9` makes the builder's
  preview note what the frozen showcase draws (item 52). Every other test of that run passed.

### 44. Lint

`npm run lint` on the fresh clone of `f2b73c9`: passed, no errors or warnings (47 s). Its import boundaries hold: public
code never imports `src/server/**`, and the admin's client components (the builder's included) import only the Server
Actions.

### 45. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`) on the fresh clone: passed (41 s).

### 46. Build

`npm run build` on the fresh clone with **no database settings, no `RAWASY_DATA_DIR` and no admin secret** in its
environment (brief §75: none of `DB_*`, `ADMIN_ENABLED`, `APP_ENV`, `RAWASY_DATA_DIR`, `AUTH_*`, `CRON_SECRET` was set;
only the QA script's own `TEST_DB_*` variables were, which only the test runners read, never the app): compiled in
18.8 s, TypeScript 36.8 s, 147 pages generated in 4.1 s (64 s in all), **no warning** (0 "dynamic filesystem
access" warnings, as at A4's close). The deployment package script, run on that build as the README says: PASS —
2,779 files, the 13 held-back files left out, the 102 sitemap pages each with its HTML, page data and public files.

### 47. db:check

`npm run db:check`: "Everything's fine", migration files OK: 6 (`0000`–`0005`), the seed migrations match the
registries.

### 48. npm audit --omit=dev

`npm audit --omit=dev` on the fresh clone: **found 0 vulnerabilities**.

### 49. Full audit

`npm audit` (dev dependencies included): 9 (4 moderate, 5 high), all in two dev-only chains already on record, none
served: the 5 high are `braces` ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ← `eslint-config-next` (lint
only; the only offered fix is a `--force` downgrade of `eslint-config-next`), the 4 moderate are `esbuild` ←
`@esbuild-kit/core-utils` ← `@esbuild-kit/esm-loader` ← `drizzle-kit` (the dev-only advisory accepted in A2 Correction 1).
`npm audit fix` and `--force` were not run (brief §78).

### 50. Evidence ZIP

`rawasy-a5-final-evidence.zip` is not committed. It is in the session scratchpad:
`/tmp/claude-0/-home-user-Rawasy-Metal-Website/34883015-4850-5415-b502-fd42eee69ac3/scratchpad/a5/rawasy-a5-final-evidence.zip`
(55.0 MB, 123 files, SHA-256 `031d28ded6dd595bb0707950d95ce9d0b3a8834299055c035fc1765993b9ea52`).

- **How it was captured.** From the fresh clone of `f2b73c9`, after its QA passed: the production build on `server.js`
  (`APP_ENV=local`), a throwaway local MariaDB database and a throwaway `RAWASY_DATA_DIR`, both removed afterwards.
  Today's release media were registered with the real importer (143 items), one test account per role was seeded, and
  every screen was captured with reduced motion. No UI was changed for the captures.
- **What it holds.**
  - 108 captures of 37 screens, each in up to six variants: desktop 1280 × 800 light (34) and dark (22), tablet
    768 × 1024 light (1, the preview), phone 390 × 844 light (33) and dark (6), and a narrow phone 320 × 640 light (12).
  - 13 contact sheets (6 desktop, 6 phone, 1 tablet).
  - `INDEX.md`: §80's list mapped to screen ids, and every screen with its variants.
  - `shots.json`: window and page sizes, and overflow, for every capture.
- **§80's screens**, each mapped in `INDEX.md`: the builder (desktop, dark, phone); the outline; the add-block library;
  a generic page with several blocks; the selected block's inspector; English and Arabic texts; the structured rich
  text; an image block; a gallery; the focal point; an entity grid; the responsive, motion and visibility controls; a
  locked block (About, as the Owner); reorder, duplicate and the remove confirmation; a service's layout; the reusable
  sections' list and editor, a linked section, its detach and its "used by"; the live preview at desktop, tablet and
  phone widths, in light and dark and in Arabic; a validation error and the certificate digit guard; the stale editor;
  the Reviewer's read-only view; and an Editor's permission refusal.
- **What it shows.**
  - Test content only: a page, a service, three projects and a reusable section named "Test …" (in Arabic
    "اختبار …"), and the seeded test accounts.
  - Approved release photos only, chosen by their media keys: `services/scaffolding-2` and five project photos the
    public site already shows (`suspended-lantern-1`, `tulip-roundabout-1`, `lighting-tree-1`, `screen-enclosures-1`,
    `perforated-canopy-1`). The capture stops unless each one is approved and carries no flag.
- **What it does not show:** private documents, registration numbers, QR codes, personal IDs, or held-back engraving or
  project imagery: none of the 13 held-back files is chosen anywhere. Every sheet was checked by eye, and so were the
  full-page preview captures below the sheets' cut.

### 51. Overflow result

**0 page-level horizontal overflow** in all 108 captures of the final evidence: the document is as wide as the window at every
size (`shots.json`; 1280 × 800, 768 × 1024, 390 × 844 and 320 × 640).

The first capture of the final round, on the fresh clone of `40ee741`, found one builder screen wider than its window at
320 px, with a section open in the inspector: 4 px past the screen.
- **The cause.** The inspector's repeaters and rich text are grids with no column template, so their one implicit `auto`
  column takes its widest item's minimum width — a `<select>` is at least as wide as its longest choice (a paragraph's
  kind menu, a repeated item's icon menu).
- **The fix (`8f72332`).** Those grids have one `minmax(0, 1fr)` column (`.adm-bld-items`, `.adm-bld-item-list`,
  `.adm-bld-item`, `.adm-bld-rich` and its blocks, links and marks); wider screens are unchanged (an `auto` column
  already filled the box there). `admin.css` only.
- **The test (`3cc3aa4`).** The builder's phone test now also opens a rich text in the inspector at 390 px (light and
  dark) and 320 px, and checks the page and every element of `main` (the preview canvas aside) against the screen's
  edge. Negative control: on `40ee741` the test fails with "320 light rich text", 4 px; with the fix the spec passes
  15 / 15.

The admin browser suite also checks 390 px light and dark, and 320 px, for the builder (the outline, editing and saving,
a rich text, the preview) and for A2–A4's screens (item 42); the evidence covers the reusable sections' list, editor and
linked section at 390 and 320 px too (item 50).

### 52. Known limitations

- **Nothing is public.** The builder edits working layouts only; the public site keeps its static source (T1 Option B).
  A generic page has no public address until publishing (A8) and the switch (A9).
- **The preview shows the saved working copy.** Unsaved edits are not drawn; the canvas reloads after each save. Undo
  and redo end at a save or reload, and a saved removal can't be undone until revisions exist (A8).
- **Locked whole in A5:** the legal pages, the 404 and the project page template (their texts are editable; their
  structure is today's). The site's own pages take only the generic additions their contracts allow.
- **The homepage machinery showcase draws its six approved machines in its own order.** Its component is frozen (a public
  test pins `home/Machinery.tsx` byte for byte), so the `home.machinery` block's selection decides only which of those six
  show; a machine outside them, or another order, is not drawn, and the builder's preview says so in a note. The other
  bespoke selections (the homepage's selected work included) follow the selection.
- **Company details are read-only** in the blocks that show them (phones, email, address: today's content layer) until
  Site settings (A6). The header, footer and menus of the preview are today's.
- **The quote form block is today's form exactly** (it prepares an email or WhatsApp message; no submission). Forms and
  enquiries are A7.
- **Media usage.** A4's "Used by", the library's "unused" filter and the dashboard count read the A3 records' media
  columns only: an item named only by a section or a reusable section reads as unused. The builder knows its own media
  (each section's references, its preview notes), and A8's reference index (`content_references`) will join the two; the
  brief (§62) asks for no competing index before then. An item trashed while a draft section names it shows in the
  preview as a placeholder that says so; nothing public is affected.
- **Copies keep kept references** (first review I2, final pass I5): a template set-up, "Make it reusable" and a detach
  copy media and records the source already named, as a kept reference may stay (A4's rule) — so a media item trashed or
  archived meanwhile, or an archived record, can be copied into the new section; a later edit of the copy applies the
  "newly chosen" rules to anything new, and publication (A8) refuses anything not deliverable. Private media can't reach
  a section at all.
- **Certificate copy and the media alt text** (final pass I4): an image on certificate copy whose block leaves its own
  alt text empty uses the A4 media item's alt text, which the section's guard does not read (A4's text, editable after
  the section is saved). Texts, values, anchors and link targets of certificate copy are guarded; the rendered page's
  alt attributes are left to A8's publication check (the public site reads none of this until A9).
- **Two saves of related items can deadlock** (final pass L3, availability only): a layout save that links reusable
  section R into a page and an edit of R that newly links that page lock the two rows in opposite orders; InnoDB ends
  one and `inTransaction` retries it once, deciding again under its locks, so a second deadlock reaches the editor as an
  error ("try again"). The same class as A3's accepted project ↔ service deadlock (item 55).
- **A reusable section's edit** needs `reusable_sections.edit` only, not each linking owner's content permission (I4); no
  owner with a stricter content permission can link one today (the legal pages take no additions).
- **Pixel parity covers 30 of the 59 bespoke blocks.** The parity spec compares five pages laid out with today's words,
  part by part (DOM, text, media and pixels; 14 language, width and theme cases plus a control): About (its opening, ten
  of its thirteen parts and its closing), Contact (the opening, the quotation and the location), the Privacy policy (the
  opening, the contents and the sections), the homepage (six of its ten parts) and the Laser Engraving page (eight of its
  eleven parts). Ten more blocks of those pages are laid out but not compared: they need records the seed does not
  create, so they are hidden on both sides (About's work, clients and compliance; the homepage's projects, industries,
  clients and compliance; the service page's machines), or they draw nothing on either side (Laser Engraving's gallery
  and projects, which today's page does not show). The other 19 bespoke blocks (the services index, Capabilities 5,
  Projects 4, the project page 3, Industries 2, Clients 1, Certificates 2, the 404 1) are drawn by the same approved
  components through their adapters and covered by the renderer and composition unit tests and the freeze proof of their
  extracted components, but are not compared pixel by pixel: seeding them needs project, client, industry and
  certificate records with media, which A9's import will provide.
- **Third-party frames.** The video (YouTube-nocookie, Vimeo) and map (Google) frames load only where those hosts are
  reachable; in this cloud session google.com is blocked, so map previews were checked with the frame's own address and
  attributes, not its pixels.
- **The pressed-button scale with reduced motion** (public CSS, frozen in A5) is recorded for the Owner (item 58).
- **The test browser's renderer freeze** (item 42): Chromium 141's headless renderer froze for good during the parity
  spec's scroll walk, in the browser that had run the other admin specs first. The spec now runs in a browser of its
  own; nothing in the site or the admin changed. It was never seen in the public suite, in a fresh browser, or outside
  this test.

### 53. A6 deferred items

Site settings and interface text (company details, phones, emails, address, social links), menus and the global header
and footer controls, the theme, redirects, SEO defaults. Today the blocks that show company details read them from the
static content layer, read-only ("read-only until Site settings, A6"), and the preview's header and footer are today's.

### 54. A7 deferred items

Forms and enquiries: the quote form block is today's form exactly (it prepares an email or WhatsApp message; no
submission, no storage, no SMTP, never "sent"); form copy and fields editing, delivery modes and enquiry storage are A7.

### 55. A8 deferred items

Publishing, revisions, version history and restore, scheduled publication, the audit view, backups, `content_references`
(the reference index publication needs), the publish-time check that every reference is deliverable, the public
projections (`published_documents`), the cache handler and invalidations, and A3's relation rows written as a diff
(the overlapping-save deadlock, A4 brief §88). A saved removal can't be undone until revisions exist. Two candidates the
final pass adds: the publication check reads the rendered certificate copy (alt attributes included, I4); and, with the
relation diff as pre-production hardening, a layout save could share-lock the reusable sections it links before the
owner's row (the L3 deadlock).

### 56. A9 migration / cutover still not performed

Nothing of today's website was imported into `page_sections` (the seed in `e2e-admin/seed-parity.mjs` writes only the
admin test run's throwaway database, which is dropped). The public site still reads its static source; no route, the
homepage data source, navigation, media, the sitemap or the catch-all was switched; `CONTENT_SOURCE` does not exist yet.

### 57. `/media/u` ADMIN_ENABLED A9 dependency recorded

Recorded, not changed (A5 brief): `/media/u/**` answers 404 before any database access while the admin gate is off, which
is how production and staging run today. **A9 must decouple public uploaded-media delivery from `ADMIN_ENABLED` before
public content uses `/media/u/**`**; A5 did not change that gate. Recorded in `CLAUDE.md` too.

### 58. Reduced-motion public follow-up recorded

Recorded, not changed (the public stylesheet is frozen in A5): with reduced motion, pressed buttons still shrink to 98 %
over 180 ms. The Owner-approved future fix is **`scale: none` for pressed `.btn` in the reduced-motion rule**. Recorded
in `CLAUDE.md` too.

### 59. Preservation refs unchanged

All 21 `preserve/*` branches on GitHub are at the commits the project memory records (read with `git ls-remote` after
the final push): `pre-tm1-a-v2-migration` `3260415`, `pre-tm2` `5cfeaed`, `pre-tm2.2` `e5a3834`, `pre-tm2.3` `2026047`,
`pre-tm2.4` `4b28ad2`, `pre-tm2.5` `304a277`, `pre-tm2.6` `9c7d2af`, `pre-tm3` `de62bc5`, `pre-stage-1e` `ca672d7`,
`pre-stage-1f` `c2aed58`, `pre-stage-1i` `b1f4fe1`, `pre-stage-1j` `f69e2fa`, `pre-namecheap-adapter` `422c397`,
`pre-admin-a1` `74220ea`, `pre-admin-a2` `ed6b652`, `pre-admin-a2-correction1` `b47d8e5`, `pre-admin-a2-correction2`
`bca33aa`, `pre-admin-a3` `dcd089d`, `pre-admin-a3-correction1` `a7e6637`, `pre-admin-a4` `37a1e67` and — new in A5,
created before the first A5 commit — `pre-admin-a5` `cc0cae2`. None was moved, deleted or recreated; nothing was
force-pushed.

### 60. main untouched

`main` is at `474f61f10f12981e41f9b7e7fd6065a0ec9da541` on GitHub (read after the final push), as it was before A5: A5
never checked it out, merged into it or pushed to it. Every A5 commit is on `claude/new-session-5eijs6` only.

### 61. Nothing deployed

Nothing was deployed, uploaded or published: no cPanel, DNS, SSL or nameserver change, no production or staging database
or `RAWASY_DATA_DIR`, no production admin, no `CONTENT_SOURCE` switch, no public content migrated. All A5 work ran on this
machine against local throwaway databases and folders.

## Decisions for the Owner (none blocks A5's review)

1. **Who chooses and orders the certificates a section shows** (final pass I6). Editors (`pages.edit`,
   `reusable_sections.edit`) can pick and order certificates by hand in four blocks (the Certificates register, the
   Certificates page's opening, the compliance blocks, the generic certificates block), while A3 keeps the certificate
   collection's own order to Owner and Admin. Nothing is exposed (only the redacted previews are ever drawn). Keep it, or
   require `certificates.edit` for those selections.
2. **A reusable section's edit** needs `reusable_sections.edit` only, not each linking owner's content permission (first
   review I4). No owner with a stricter permission can link one today; decide before the legal pages take additions.
3. **The L3 deadlock** (availability only, retried once): keep the current order (as A3), or schedule the reordering with
   A3's relation diff as pre-production hardening (item 55).
4. **Pixel parity of the 29 bespoke blocks not compared pixel by pixel** (item 52: ten on the compared pages and 19 on
   other pages, all needing records the test seed does not create): compare them after A9's import, or seed test
   records for them earlier.
5. **The homepage machinery showcase** (item 52): it draws its six approved machines in its frozen order. Letting the
   builder's selection decide (a new machine, another order) means changing `home/Machinery.tsx` and its pinned bytes —
   a decision for you, with A9 or later.
6. **Recorded, not changed** (items 57–58): A9 decouples `/media/u/**` from `ADMIN_ENABLED`; the pressed-button
   `scale: none` fix for reduced motion waits for your go-ahead on the public CSS.

## How to run (local only)

Follow the README, section "Admin (local development)":
1. Start a local MariaDB 11.4, put the settings in `.env.local` (`APP_ENV=local`, `DB_*`, a throwaway
   `AUTH_ENCRYPTION_KEY`, a `RAWASY_DATA_DIR` outside the project).
2. Migrate: `npm run db:check`, then `node --env-file=.env.local scripts/db-migrate.mjs up` (a database migrated during
   A4 takes `0005` alone).
3. Optionally register today's media: `npm run media:import-release`.
4. Start the app (`npm run dev`, or `npm run build && npm start`), create the first Owner with
   `scripts/admin-bootstrap.mjs`, sign in at `/admin/login`.
5. Pages → a page → "Edit page layout" (or Services → a service → "Edit page layout"); Reusable sections in the sidebar.
   README step 7 describes the builder.

The tests: `npm run test:unit`; `npm run test:integration` and `npm run test:admin` with `TEST_DB_HOST/PORT/USER/PASSWORD`;
`npm run test:e2e` for the public site (no database).

## Next steps

- The Owner's independent review of A5: this report, `rawasy-a5-final-evidence.zip` (not committed) and the commits in
  item 3.
- A6 (Global site controls) starts only when the Owner approves A5 and says so.
- Production and staging stay untouched: no deployment, no CMS database, no Namecheap change.

## A5 FINAL CORRECTION

Date: 2026-10-30 · Branch: `claude/new-session-5eijs6` · Brief: "RAWASY METAL WEBSITE — A5 FINAL SECURITY &
DATA-PRESERVATION CORRECTION". Full report: `docs/reports/2026-10-30-admin-a5-final-correction.md`. Rollback checkpoint:
GitHub branch `preserve/pre-admin-a5-final-correction` at `2e01a1f` (the A5 acceptance review's last commit). Local only;
A5 is not Owner-approved by this section.

**1. Security dependencies (the Owner's authorized exception)** — `0613fe5`, with the tracing fix `a116222`.
- `next` 16.3.8 → 16.4.1 (with `@next/env` and the eight `@next/swc-*` binaries) and `zod` 4.6.5 → 4.6.6: the minimum
  patched versions of GHSA-2464-fhr4-w9xw (critical: Image Optimization API, SVG), GHSA-p3m5-59mp-jv5r (high: Server
  Actions denial of service), GHSA-673q-mjm6-r5xr (critical: `use cache` typed arrays) and GHSA-mrhx-c7xc-m3w5 (high:
  oversized collections). Nothing else changed (React 19.2.8, `sharp` 0.35.5, Node 22.22.2, Drizzle, mysql2 as before);
  no `npm audit fix`. `npm audit --omit=dev`: 0.
- The one incompatibility: 16.4's tracer read `resolve(process.cwd())` in `dataDirFrom` (`src/server/media/storage.ts`)
  as an access to the whole project (434 source files in 47 routes' traces). The call is a string comparison; it carries
  `/* turbopackIgnore: true */` now (as A4's run-time paths do). Same refusals (`media-storage.test.ts`), no build
  warning, traces as with 16.3.8.

**2. Unsaved work when a session ends** — `bbb53f2`, tests `96e9ded`, media cards `eb2119a`.
- The five builder actions start with `editorContext`: `actionContext(…, { signedOut: "answer" })` answers `signed_out`
  instead of redirecting (nothing done), and the editor's own user id (`editor`) must be the session's user (otherwise
  refused, audited) — both before the payload is read; a session ending inside the transaction answers the same. The
  media picker answers in its dialog. Sign-in, MFA, RBAC and the 2 h / 12 h limits are unchanged; nothing polls.
- The builder and the reusable section editor keep the edits in the page ("Your session has ended, so nothing was saved.
  Your changes are still here … Sign in again in a new tab") and, while dirty, a copy in the tab's `sessionStorage`
  (`draft.ts`, `useDraft.ts`): content only (no credential, token, file or private item), keyed by user and record, with
  its version; offered back after the page's own sign-in and permission checks, restored only onto the same version
  (an older copy: download or discard, never applied over newer content); removed after a save, on discard, on a
  confirmed leave, on sign-out (all admin tabs), when another user signs in in the tab, after 12 hours.
- Tests: `tests/unit/builder-draft.test.ts` (16); "A5 final correction" in `e2e-admin/page-builder.spec.ts` (7: session
  ended, reload and restore, two editors, another user, sign-out, reusable editor, picker), each failing on `0613fe5`.

QA on a fresh clone of `eb2119a`, and the public freeze proof against the 16.3.8 baseline: the full report's items 5 and 6.
