# RAWASY Metal Website — Admin / CMS Phase A6: Global site controls

**Brief:** "RAWASY METAL WEBSITE — OWNER ACCEPTANCE OF A5 & AUTHORIZATION TO EXECUTE A6".
**Status:** A6 is built — **local implementation only** — and awaits the Owner's review. It is not self-approved. A7 is
not started. Nothing was deployed. No hosting, DNS or cPanel change was made, nothing was merged into `main`, and no
production credential was used.
**A5:** recorded as approved and closed (`CLAUDE.md`, "Where the project stands"). Its final implementation is A6's
baseline. Its Low / Info backlog stays with the later milestones named in the A5 reports.
**Public website:** unchanged. No public source file changed. The public build output, HTTP answers, pixels and the
public suite are identical to the checkpoint (item 7). T1 Option B holds: the public site reads none of A6.

## 1. Starting and final commit SHAs

- **Start:** `7722640` ("Docs: A5 final correction — public suite result and project memory"). The rollback checkpoint
  **`preserve/pre-admin-a6`** was created at `7722640` and pushed before any A6 work.
- **Last commit with code:** `10f862b`. Docs only after it:
  - `4f2b69b` README; this is the tree the fresh clone tested;
  - `cd73c9b` this report, `CLAUDE.md` and a status line under the A1 roadmap, with the browser results then pending;
  - `f1e0050`, `91c5de1` and the final docs commit (the branch's head), which add the results as they finished.
- **Branch:** `claude/new-session-5eijs6`. All pushes were fast-forward; nothing was force-pushed.

The commits, in order, each on its own:

| Commit | What |
|---|---|
| `87343f0` | Registry: site routes, the four menu slots and the header's rules, the 34 interface-text keys, theme tokens (none approved), limits |
| `ea9bb20` | Schema `schema-site.ts`, migration `0006_site_controls`, generated seed `0007_seed_site_controls` |
| `6a07830` | Server services: settings, menus, interface text, theme, redirects, paths, the working-copy overlay |
| `70ecf6c` | Correction: the interface text is saved as one form (a per-group save lost other groups' typing on remount) |
| `920e4fa` | Server Actions (`actionContext` first; theme with step-up) |
| `9a98a43` | Admin screens, the SITE navigation group, styles |
| `e44266a` | Preview integration: the shell preview and every page preview draw the working copy |
| `b35d173` | Integration tests of the services |
| `d7bb07b` | Correction: redirect addresses refuse hidden characters and read in their own script |
| `a9cb651` | Correction: the preview's WhatsApp number and link come from one choice |
| `90d473a` | Correction: a change reopens its screen at the stored version (`?…&v=`) |
| `4f01999` | Correction: a refused redirect save is audited under its change's name |
| `d1264c5` | Tests: unit tests and the browser spec `e2e-admin/site.spec.ts` |
| `0b2fd6e` | Tests: the A3–A5 migration tests take A6's two files as well |
| `c13920f` | Tests: the A6 migrations on MariaDB (proofs A–G) |
| `a81f7de` | Review corrections: company settings (L1, L5, I3, field heights) |
| `748ecff` | Review corrections: redirects (L2, L3, L4, I2, I7, the list's row header) |
| `aa89611` | Review corrections: navigation (L5, I4) |
| `10f862b` | Tests: the review corrections (each fails on `c13920f`) |
| `4f2b69b` | README: the site controls |

## 2. Completed A6 features

Everything below is a **working copy** in the local database. The public website keeps today's values. These become
public only through publishing (A8) and the database switch (A9). Every screen is in the admin's SITE group.

**A6.1 Company & website (`/admin/settings`).**
- **Set-up.** "Copy today's company details" copies what the website shows today (`static-source.ts`, from
  `src/content/*`, the same values the pages use). Nothing is invented: RAWASY's own Google Maps place link, a site-wide
  SEO description and a default share image start empty.
- **Fields:**
  - website (https);
  - email;
  - 1–4 phone numbers, in order, with "Has WhatsApp" and "Shown on the website" (E.164 for links; the WhatsApp number is
    the first shown number that has WhatsApp, today's rule);
  - Facebook page (facebook.com only);
  - postal code and approximate coordinates (both or neither; country SA fixed);
  - the map search;
  - RAWASY's own Google Maps place link: optional, Google Maps hosts only, up to 500 characters. It is empty and must
    stay so until RAWASY confirms its link. The field says so.
  - the default share image: an approved image the media library delivers (A4; D-A6-7);
  - English and Arabic texts: site name, brand and legal names, the company statement, address lines and the full
    address, street address, city, country, vision statement, aims and closing line, default SEO description.
- **Languages.** Arabic fields are right to left. Each language has A3's "<language> is complete" box, and one "This
  change does not affect the other language" box sits below them. The server plans each status from those boxes and from
  what changed (`planTranslationStatus`), so changing one language marks the other "Needs review".
- **Saving.** One save sends the whole form with the version it was opened on.

**A6.2 Navigation (`/admin/navigation`).** Four slots:
- **Header navigation** (3–8 pages). Services stays third and opens the Services menu, and the first three always show:
  the frozen header draws its items by position (`[home, about, servicesNav, ...rest]`). Projects stays after Services,
  where the header also marks it on project pages.
- **Services menu.** Fixed: its live services list, plus its "every service" link, whose label changes.
- **Footer company links** (1–8) and **footer legal links** (1–4).
- **Per item:** the page (only the website's own 11 pages), shown or hidden, a label in English and Arabic (with a
  character counter), and Move up / Move down / Remove / Add a page. There is no dragging, as in A4 and A5.
- **Saving.** Each slot saves with its own version, so another slot's unsaved typing survives a save. Set-up copies
  today's menus.

**A6.3 Interface text (`/admin/interface-text`).**
- **Keys.** Only the registry's 34 keys (D-A6-5): every text of `src/i18n/dictionaries.ts` except the status code
  `notFound.code`, plus the footer company column's title. No free-form key can be added.
- **Grouping and search.** The keys are grouped (Accessibility labels, Controls, Common words, Footer, Navigation, Page
  not found), with a search across names, keys and both languages.
- **Per key:** English and Arabic values, a length counter (each key's maximum: twice today's longest text, rounded up
  to ten, between 24 and 200), and today's text.
- **Rules.** One line of plain text. An empty value means today's text. The language switch's label is written in the
  language it leads to, and its fields take that language and direction.
- **Saving.** One form and one save, on the site settings' version.

**A6.4 Theme (`/admin/theme`, the Owner only).** The approved design's ten core tokens are shown for reference (light
and dark values, kept equal to `system.css` by a unit test). Owner decisions D-A6-3 and the brief's "keep editable token
overrides empty" mean no token is approved for overriding. The screen therefore offers no field: no colour, font, CSS or
script can be entered. Behind it, the mechanism is built:
- an approved-token registry with a contrast rule per token;
- `tokenValueProblem`, which accepts lower-case `#rrggbb` only and checks contrast unrounded;
- `tokenStyle`, which draws only approved, valid values;
- the override service (Owner + step-up, version, audit) and "Remove every override".

Because no screen offers it, the build registers no action for setting an override at all. That is proven in the browser
spec.

**A6.5 Redirects (`/admin/redirects`, `new`, `[id]`).**
- **Old address:** the language first, without the domain, query or fragment. It is normalised: one %-encoding, NFC, no
  trailing slash, and never a character that draws nothing. It must be unique, and never an address a page answers: the
  site's own pages and files, today's services and projects, and the working records' slugs.
- **Destination:** a page of today's website, or a working page, service or project (not archived), in the old
  address's language. Kind 308 or 307, and an optional note.
- **Refused:** loops and chains.
- **Later changes elsewhere** are marked in the list and on the redirect's page: a page now answers its old address, or
  its target became another active redirect's old address.
- **Lifecycle.** Deactivate (always allowed) and Reactivate (checked again). Edits are decided on the version shown.
- **List and permissions.** Filter by state and by an address fragment (Arabic too), 25 a page. Every role reads;
  Owner and Admin change.
- **Not active yet.** Redirects are stored and validated only: nothing resolves before A9 (D-A6-4). Automatic
  slug-change redirects are A8's.

**A6.6 Preview integration.** The authenticated preview draws the working copy with the public components, unchanged:
- **`/admin/preview/site/shell?locale=en|ar&theme=light|dark`** shows the header and footer as the working copy sets
  them. The settings, navigation and interface-text screens link to it in both languages and themes.
- **Every page preview** (A5) draws its header, footer and site-dependent blocks the same way: company details, menus,
  interface strings, contact rows, legal name.
- **What is overlaid.** `overlayShell` lays only the set-up parts over `getShellView`'s output; a part not set up shows
  today's. `getShellView`, the content files and the dictionaries are unchanged.
- **Proven:** set up from today's website, the shell preview equals the public shell word for word, link for link, in
  English and Arabic.

## 3. Database migration and seed details

**`drizzle/0006_site_controls.sql`** creates 11 tables (generated by drizzle-kit from `src/server/db/schema-site.ts`,
then reviewed; InnoDB, `utf8mb4_unicode_520_ci`, ASCII keys `ascii_bin`):
- `site_settings`, `site_setting_translations`, `company_phones`;
- `ui_strings`, `ui_string_translations`;
- `menus`, `menu_items`, `menu_item_translations`;
- `theme_settings`, `design_token_overrides`;
- `redirects`.

The tables follow A1-DATABASE-SCHEMA §7, plus these additions:
- `menu_items.link_type 'route'` with `route_key` (a site page by its route key);
- `redirects.lock_version` and an ASCII `target_path`;
- checks that repeat what the application validates:
  - the singleton ids `site` and `theme`;
  - positions ≥ 1;
  - E.164 numbers;
  - `ui_strings.max_length` 1–500;
  - exactly one menu target and one redirect target;
  - a redirect's normalised source form;
  - status 307 / 308;
  - the token-key form.

No existing table changes and no row is written by 0006.

**`drizzle/0007_seed_site_controls.sql`** is generated by `scripts/generate-access-seed.mjs` from
`src/server/site/registry.ts` and checked by `npm run db:check`. It writes:
- the `site` settings row (empty website, email and map search; country SA);
- the `theme` row;
- the four menu slots;
- the 34 interface-text keys with their groups, descriptions and maximum lengths.

It writes no company fact, label, text, override or redirect: the admin's set-up copies today's website.

**Applying:** `node --env-file=.env.local scripts/db-migrate.mjs up` (by hand, never at app start; the A2 runner: lock,
journal order, hashes, charsets, backup required outside local). Proofs A–G on MariaDB 11.4
(`tests/integration/site-migration.test.ts`):
- **A.** An empty database takes all eight files.
- **B.** An A5 database holding A2 accounts, A3 content, A4 media and A5 sections takes exactly 0006 and 0007.
- **C.** A second run is a no-op.
- **D.** A changed or reordered A6 file is refused.
- **E.** Every A6 table's engine, collation and key collations are as specified, and the checks, uniques, foreign keys,
  RESTRICT and CASCADE rules hold.
- **F.** No earlier row or table shape changes, and the seed writes exactly the singletons, slots and keys.
- **G.** `db:check` passes ("Migration files OK: 8").

The A3, A4 and A5 migration tests were extended to the eight files, as A5 extended the earlier ones.

Known: A1's `uq_menu_items_position (menu_key, parent_id, position)` admits repeated NULL parents, so top-level positions
are kept unique by the menu service (the slot's root lock and the renumbering), not by the index (review I1; A1's design,
unchanged).

## 4. Security and RBAC verification

**Permission matrix** (registry keys, never role names; printed from `src/server/policy/registry.ts`):

| Role | Read (`content.view`, `redirects.view`, `preview.use`) | Settings + interface text (`settings.edit`) | Menus (`menus.edit`) | Redirects (`redirects.manage`) | Theme (`theme.edit` + step-up) |
|---|---|---|---|---|---|
| Owner | yes | yes | yes | yes | yes |
| Admin | yes | yes | yes | yes | no (screen forbidden) |
| Editor | yes | no | no | no | no |
| Reviewer | yes | no | no | no | no |

**Controls, each covered by tests:**
- **Action gate.** Every Server Action calls `actionContext` (admin gate, session, same origin, permission, and for the
  theme a recent sign-in) before it reads its input. Refusals are audited on the user (`denied`).
- **Service re-check.** Every service decides the permission again inside its transaction (`contentTransaction`: the
  actor locked first), locks the aggregate root FOR UPDATE and compares the version the form showed. Stale saves are
  refused ("… changed after you opened it …"), audited `failed`, and keep what was typed.
- **Schemas.** Strict schemas. No actor, status, version authority, publication or translation status is read from
  input (a sent `status` field is refused).
- **Locking reads** for everything a decision depends on: newly linked records and media, the share image's
  `public_media` row, the slugs a source would name.
- **Audit.** Field names, languages and counts are recorded, never values (tested: the new email does not appear in
  the audit row).

**Proven in the browser:**
- A Reviewer's hand-made requests to every registered A6 action are refused and audited, and nothing changes.
- The Owner's override is impossible (no such action in the build).
- An Admin's reset is refused (permission); the Owner's is refused after 10 minutes without a sign-in (step-up).
- Signed out, every A6 address goes to the sign-in page.
- With `ADMIN_ENABLED` unset in production, every A6 address and action is the public 404 path and no database
  connection is attempted. With it on, the same requests reach the database (positive control).

**Independent security review** (a separate reviewer given the diff and the rules, not my conclusions): **no High or
Medium finding**; 5 Low and 7 Info. All were verified against the code. Fixed, each with a test that fails on `c13920f`:
- **L1:** a newly chosen share image could carry a blocking flag. It must now have its `public_media` row (A4
  deliverability), share-locked.
- **L2:** later slug changes elsewhere could silently break a stored redirect. They are now marked in the list and on
  the redirect's page. The full re-check belongs to A8 and A9 (item 10).
- **L3:** default-ignorable characters and look-alike Unicode forms in redirect addresses. They are now refused; parts
  are NFC-normalised; the readable form never shows an invisible character.
- **L4:** a search cut inside an emoji crashed the list. The search is now cut by whole characters and lone surrogates
  are dropped.
- **L5:** the settings took a language status from the form and re-stamped completion. They now use A3's plan, and
  completion is stamped only when confirmed. Menu labels are stamped only when changed.
- **I2:** the inward chain check share-locked every redirect, so two edits of different redirects waited on each other.
  It is now a plain read.
- **I3:** the map link was capped at 255 and `maps.google.com/?cid=` was refused. The limit is now 500, with the right
  host and path rules.
- **I4:** Projects placed first or second would lose the header's section mark. It now stays after Services.
- **I7:** the duplicate-key fallback was not audited. It now is.

Documented, not changed:
- **I1:** A1's menu index (above).
- **I5:** the preview keeps `approximate: true` (the type) and falls back to today's coordinates. No preview part shows
  coordinates; they are structured data for A9.
- **I6:** the two redirect actions read `id` / `active` before `actionContext`, only to name the audited refusal.
  This is A3/A5's accepted pattern.

Found and fixed during my own work and evidence:
- the per-group interface-text save lost other groups' typing;
- refused redirect saves were audited as `redirect.save`, not under the change's name;
- a second save in a row could reuse the router cache (now `?…&v=<version>`);
- the preview's WhatsApp number and link could disagree;
- the phone fields stretched;
- the redirect list's row border ended short.

## 5. All test results

Fresh clone of `4f2b69b` (the README commit on top of `10f862b`, the last code), Node 22.22.2, MariaDB 11.4.13 (local
Docker), Playwright 1.56.1 driving the container's Chrome for Testing 153 through untracked wrapper configs (as in A5):

| Check | Result | A5 baseline |
|---|---|---|
| `npm ci` | pass (403 packages; `@next/swc-linux-x64-gnu` present) | |
| `npm audit --omit=dev` | **0 vulnerabilities** | 0 |
| `npm audit` (all) | 4 moderate, dev-only (the accepted drizzle-kit / esbuild chain) | 4 |
| `npm run lint` / `npm run typecheck` | pass / pass | |
| `npm run build` (no database settings) | pass, **no warning** (0 "dynamic filesystem access") | |
| `npm run db:check` | pass: "Migration files OK: 8", "Seed migrations match the registries" | 6 files |
| Packaging check (`scripts/package-namecheap.mjs`) | PASS: 0 of 13 held-back files, 111 / 111 public files, 102 sitemap pages | same |
| Unit (`npm run test:unit`) | **336 / 336** | 311 / 311 |
| Integration (`npm run test:integration`) | **470 / 470** | 425 / 425 |
| Admin browser (`npm run test:admin`, every spec, the parity project included) | **146 / 146** in the first run (27.9 min) | 122 / 122 |
| Public E2E (`npm run test:e2e`, against `server.js`, after the image warm-up: 1,484 / 1,484 sizes) | **612 / 612** in the first run (23.1 min) | 612 / 612 |

New A6 tests:
- **Unit (25):**
  - `site-registry` (14): drift against the dictionaries, `routes.ts`, `system.css`, `Header.tsx` and the seed; today's
    menus valid; the menu rules; the token value rule.
  - `site-paths` (8): normalisation, invisible and NFC addresses, the readable form, answered and live addresses.
  - `site-working` (3): nothing set up and a copy of today's both give today's values exactly; an edited copy changes
    only what it holds.
- **Integration (45):**
  - `site-settings` (17): set-up, saves, stale, validation, phones, the share image, statuses, the map link, the Editor,
    the ended session, interface text, the theme with an injected approved token.
  - `site-navigation` (9): set-up, the header's shape, the fixed Services menu, stale, footers, label stamps, Projects
    placement.
  - `site-redirects` (12): sources, targets, records, chains, versions, (de)activation, roles, the list, conflict
    warnings, no cross-redirect wait, the emoji search.
  - `site-migration` (7): proofs A–G.
- **Admin browser (24, `e2e-admin/site.spec.ts`):**
  - roles and the SITE group; set-up per role;
  - settings: edit both languages, phones and the share image picker, errors at fields with typing kept, stale tabs;
  - navigation: shape, relabel / hide / reorder with another slot's typing kept, rules, stale;
  - interface text: search, an emptied value, too long refused;
  - theme; redirects (rules, Arabic addresses, (de)activation, the Editor's read-only view, stale);
  - the Reviewer's forged actions; signed out;
  - the shell preview equal to the public shell once set up; the public pages' header, footer and HTML byte for byte
    unchanged;
  - every screen at 1280 / 768 / 390 / 320 px in light and dark with nothing past the screen, and axe (WCAG 2.0–2.2 A /
    AA + best practice) clean at 1280 light and 390 dark;
  - the shell preview tab's headers; the admin gate off and on.

**How to run.** README, "Admin (local development)": `npm run test:unit`; `TEST_DB_*=… npm run test:integration`;
`npm run build`; `TEST_DB_*=… npm run test:admin`; `npm run test:e2e` (no database). The admin spec empties the A6
working copy when it ends, so the parity tests that follow see today's website.

## 6. Desktop / mobile visual evidence

`rawasy-a6-evidence.zip` (not committed, as in A2–A5; session scratchpad, 75 files, about 21 MB) holds 64 full-page
captures and 8 contact sheets.

**What is captured** (Owner's working copy, test data only: today's copied values and test redirects):
- every A6 screen at 1280 light and dark, 768, 390 light and dark, and 320 px;
- the "not set up" screens;
- field errors (settings, redirect) at 1280 and 390;
- the stale message (a second tab) at 1280 and 390;
- an Editor's read-only settings and redirect, and an Admin refused the theme;
- the shell preview in English and Arabic, light and dark, at 1280, 390 and 320.

**Measurements:** 0 horizontal overflow and 0 elements past the screen in all 64 (sticky bars set static for the
captures).

Defects the captures showed, fixed and recaptured:
- a hint under one phone field stretched the other field's input;
- the redirect list's one-line title cell ended short of the row.

## 7. Public website freeze proof

Against `preserve/pre-admin-a6` (`7722640`), its clean build made in a worktree:

- **Sources.** `git diff 7722640..HEAD` touches no public file: nothing under `src/components/commerce`,
  `src/app/(commerce)`, `src/content`, `src/i18n`, `src/lib` or `public/`, and not `global-not-found`, `src/proxy.ts`,
  `next.config.ts`, `server.js`, `package.json` or the lockfile. The shared change in `src/server/cms/text.ts` (an
  optional maximum, default 255) is server-only; public files cannot import `src/server/**` (lint rule).
- **Build output** (the fresh clone's build copied right after `next build`):
  - 890 / 890 public files, none added or missing;
  - every prerendered page, page data, segment and meta file equal: 114 byte-identical, 601 equal once the build id and
    hashed asset names are normalised, 0 different;
  - stylesheets and scripts identical on 104 / 104 pages (the same files, by content, in the same order).
- **Server code.** 30 server-bundle files differ: each public page entry lists differently named chunks, because the
  content modules are now also imported by admin code and Turbopack groups them apart. All 16 public entries build
  from the same 299 source files (49 of ours) with byte-identical content (from the chunks' source maps, with embedded
  sources).
- **HTTP:** 229 / 229 answers equal: status, the compared headers, and bodies once the build id and hashed asset names
  are normalised. That is 102 documents, 102 page-data requests and 25 others: 404s, `/admin` paths (the public 404 with
  the gate off), `/api` and `/media` paths, and the image optimizer. Each server ran on its own fresh copy of its clean
  build.
- **Pixels.** Resting pixels with reduced motion: 17 pages, English and Arabic, light and dark, desktop (1440) and
  phone (390), 398 captures per build.
  - **358 identical at once.** Page heights are equal in all 136 views.
  - **The other 40** are all screens of the Arabic Projects gallery on a phone (light and dark). The cause is the
    browser's timing choice of one gallery photo's srcset candidate: `tulip-roundabout-1.webp` at `w=384` or `w=640`.
  - **Recaptured** three times per build per theme. Every two captures with the same choice are pixel-identical
    (0 pixels), between the builds and within one build. Captures with different choices differ within one build too,
    and both builds make both choices. The height is 21,401 px in all 12 runs. The A5 freeze recorded the same effect.
- **Public E2E** on the fresh clone: 612 / 612 in the first run.
- **Shell and HTML in the browser.** The admin spec compares the public pages' header and footer markup and their
  served HTML before and after the working copy exists (`/en`, `/ar`, `/en/contact`, `/ar/contact`, `/en/about`):
  byte for byte equal.

## 8. Unresolved issues

**For RAWASY to confirm (nothing was invented):**
- RAWASY's own Google Maps place link: empty until RAWASY confirms it. Today's map uses the address search, unchanged.
- Whether a site-wide default SEO description is wanted: empty, and every page has its own.
- Which approved image should be the default share image: empty. The public share images stay as they are until A9.
- The company facts copied into the working copy are today's website's. Any correction (phones, address, legal name)
  is RAWASY's to give.

**For the Owner:**
- No design token is approved for overriding (D-A6-3). The mechanism waits for a token-by-token approval with its
  contrast rule.
- The Projects-after-Services rule (from the frozen header's positional marks; review I4) is a navigation constraint the
  Owner may want to know about.
- A6's Low / Info items documented, not changed: I1 (A1's menu index), I5 (the preview's coordinates), I6 (the accepted
  read-before-gate naming).

**Known limitations:**
- **Preview fidelity.** The Contact page's map section and quote form (`Location`, `QuoteSection`) still read today's
  company inside the preview, and their preview notes say so. The header, footer, contact rows, About's legal name and
  every generic block read the working copy.
- **Redirects** that a later change elsewhere breaks are only marked. A8 (slug redirects) and the A9 cutover must
  re-check every redirect, resolve visitors' addresses through the same normaliser, and let pages win (item 10's notes).
- **Carried open items:**
  - the A5 Low / Info backlog;
  - the reduced-motion press (`scale: none`, public CSS frozen);
  - `/media/u` delivery decoupled from `ADMIN_ENABLED` at A9;
  - the legal pages' pending notes (they block launch);
  - pre-staging account checks and key escrow.
- **Test environment.** Playwright drove Chrome for Testing 153 (the container's; 1.56.1 expects 141) through untracked
  wrapper configs, as in A5.

## 9. A6 acceptance recommendation

**READY for the Owner's acceptance review.**
- Every A6.1–A6.6 item is built.
- The independent review found no High or Medium issue, and every Low it found is fixed with a test.
- All suites exceed the A5 baselines, and the production audit is 0.
- The public website is proven unchanged.

It is not self-approved. A7 starts only with the Owner's separate authorization.

## 10. Next phase: A7 plan only (not started)

**A7 — Forms & Enquiries** (A1 roadmap: form copy and fields, enquiry storage (gated), workflow, notifications, export,
retention).

1. **Scope.**
   - **Form definitions** in the admin: the quote form first, A1 `forms`, `form_translations`, `form_fields` and
     `form_field_translations`. Fields, labels and help text in both languages; required and optional fields; consent
     text. `delivery_mode` starts as `handoff`: exactly today's behaviour, the visitor sends the prepared email or
     WhatsApp message.
   - **Enquiry storage:** `enquiries`, `enquiry_files`, `enquiry_notes`, `enquiry_status_history`, built and used
     locally and in staging. It is gated, so the public quote form keeps its handoff and its "no backend" note until the
     Owner decides and the A9 cutover publishes it.
   - **The workflow** in the admin: an enquiry inbox, the status (new → open → answered → closed), notes, assignment,
     and a human reference `Q-YYYY-NNNNN` (never an id).
   - **Notifications** through `email_outbox`: mail stays disabled / the local sink until SMTP is decided (pre-staging).
   - **CSV export** (`enquiries.export`: sensitive, so it needs a step-up) and **retention** (`forms.retention_days`,
     an Owner / legal decision; deletion audited).
2. **Flow (A1 §5.8).** A public Server Action (or a Route Handler for files) runs, in order:
   - the origin check;
   - Zod validation, the same rules as today's form;
   - a honeypot and a timing token;
   - a per-address rate limit (`rate_limits`; no CAPTCHA, A2 default).

   Then one transaction writes the enquiry, its first status and an outbox row. "Received, reference …" is shown only
   after the commit. The email is attempted after the response (`after()`), with retries by cron
   (`/api/internal/email-outbox`, `CRON_SECRET`, every 5 minutes at most). It must work without JavaScript (progressive
   enhancement).
3. **Security.**
   - Enquiries are PRIVATE: never public, never in the preview's public data.
   - Attachments go to `RAWASY_DATA_DIR/enquiries/`. The bytes decide the type (A4's signatures: PDF and images; no SVG
     or office files unless the Owner decides), with size and count limits. Files are served only to `enquiries.view`,
     with downloads audited.
   - Permissions: `enquiries.view` / `manage` / `export` / `delete` (registry keys). Personal data is never in the audit
     summaries.
   - The public endpoint stays outside the proxy's admin branch, and its database use is gated like `/media/u`.
4. **Public freeze.** The public quote form's code (`QuoteForm.tsx`, frozen with golden outputs in
   `commerce-contact.spec.ts`) is not changed in A7. Storage is proven in the admin preview and staging only. Switching
   the public form from handoff to stored submission is the A9 cutover's decision.
5. **Owner decisions needed before or during A7:**
   - handoff versus storing (and when);
   - the retention period and the privacy policy wording (legal);
   - who receives notifications, and the SMTP provider and credentials (pre-staging, never in Git);
   - whether attachments are accepted, and which types;
   - the consent wording in both languages;
   - who may export.
6. **Tests.**
   - Unit: schemas, the honeypot and timing token, the reference format.
   - Integration: storage, the rate limit, concurrency of references, retention, the outbox retry, permissions, audit.
   - Browser: the admin inbox at 1280–320 px, light and dark, axe; the no-JS submission; the gate off.
   - The public suite unchanged (612 / 612) with the freeze proof.
7. **Carried into A8 / A9 from A6** (not A7's scope):
   - A8's automatic slug redirects must update or warn on existing redirects.
   - The A9 cutover must re-check every redirect (source not answered, target live, one step).
   - A9 must resolve visitor addresses through `normalizeSitePath` (NFC, one encoding) and let pages win.
   - A9 publishes the settings, menus, interface text and the share image through the public projections.
