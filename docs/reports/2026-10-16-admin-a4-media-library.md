# Admin / CMS program — Phase A4: Media library

Date: 2026-10-16 · Branch: `claude/new-session-5eijs6` · Brief: "PHASE A4 — MEDIA LIBRARY / MEDIA REGISTRY + UPLOADS +
VERSIONS + VARIANTS + RIGHTS + PRIVATE DOCUMENTS / LOCAL IMPLEMENTATION ONLY / PUBLIC WEBSITE REMAINS STATIC / DO NOT
START A5".

## Summary and status

Phase A4 is built and tested **locally**, against a local MariaDB 11.4 and temporary `RAWASY_DATA_DIR` folders only.

- **A media library in the database.** Every file is a media item with versions, generated sizes, bilingual metadata,
  safety flags, a usage status and an audit trail.
  - Today's 143 release files are registered as items that stay where they are (`public/media`, served by the release as
    before): 108 approved as the baseline the site uses, 22 pending review, 13 held back as restricted with their flags.
  - Uploads go to one persistent root outside the release (`RAWASY_DATA_DIR`), through a chunked protocol whose bytes,
    owner, size and pixels are checked before any record exists.
- **Rights and safety decide delivery.** One rule — public, approved, no blocking flag, not in the Trash, a ready
  current file with its files — decides whether an item may be delivered; `public_media` holds exactly the deliverable
  items, written in the same transaction as every change of those inputs.
- **The admin.** A library (grid and list, search, filters, folders), an item page (details in English and Arabic, alt
  decisions, focal point, rights, flags, approval, restriction, versions, "Used by", Trash), upload with progress, and
  media pickers inside the A3 content editors (project photos, client logos, service images and gallery, machine and
  industry images, share images, certificate previews).
- **Certificates.** Redacted public previews are ordinary public-class uploads that start pending; the certificate's
  private originals are the Owner's alone: a separate private root, never derived, never public, never approvable, and
  downloaded only with a fresh step-up.
- **One new anonymous route family**, `/media/u/{id}/{name}`, for uploaded items that are approved. No public page
  refers to it; with the admin gate off (production and staging) it answers 404 before any database access.

The public website is frozen: it reads nothing of the library, `public/media` and the 13 package exclusions are as they
were, and item 45 proves the public output unchanged against `preserve/pre-admin-a4`. Nothing was deployed, no Namecheap
resource was touched, `main` was not touched, and A5 was not started.

**Security review** (brief §87): no High finding; 3 Medium, 3 Low and 4 Info. All ten are fixed, each with a test that
fails on the code before it (item 44).

**QA** on a fresh clone of the final code `a1f562e` (brief §89–§90; every count split by origin in items 46–49):

| Check | Result |
|---|---|
| `npm ci` | 403 packages, exit 0 |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm audit` | 9 (4 moderate, 5 high), development tools only — the same list as A3; `audit fix` not run |
| lint / typecheck | 0 problems / 0 errors |
| build | 145 / 145 static pages, no warning, no database settings |
| `db:check` | passed (5 migration files; seeds match the registries) |
| unit | **167 / 167** — A2 inherited 30, A3 inherited 102, A4 new 35 |
| integration | **360 / 360** — A2 inherited 164, A3 inherited 94, A4 new 102 |
| admin browser | **82 / 82** — A2 inherited 47, A3 inherited 17, A4 new 18 |
| public E2E | **612 / 612** (third full run; the first two ended 611 / 612 — a Chromium renderer crash, and a pre-existing reduced-motion press transition that the baseline shows too — item 49) |
| combined | **1,221 / 1,221** in the final runs (167 + 360 + 82 + 612) |
| deployment package | its script's own check passed on the final build: the 13 held-back files left out, nothing else missing or added |
| public freeze | unchanged against `preserve/pre-admin-a4` apart from the router's sibling entry (item 45) |
| evidence | `rawasy-a4-final-evidence.zip` (not committed): 133 captures of 37 screens, 14 contact sheets, **0 page-level horizontal overflow**; synthetic uploads and approved release photos only (items 56–57) |

Four findings changed the code before the final round: the public pages' runtime chunk (`a6cd373`, item 45), two new
build warnings (`66de7be`, item 52), an inherited unit test whose A3 rule had become implicit (`ead98a9`, item 46), and
a page 18 px wider than a 320 px phone that the evidence capture found (`a1f562e`, item 57).

One finding is left for the Owner because it is on the public site, which A4 must not change: with reduced motion,
pressed buttons still shrink to 98 % over 180 ms. It is pre-existing and the same on `preserve/pre-admin-a4` (item 49).

**A4 STATUS: READY FOR INDEPENDENT REVIEW.** Not self-approved.

## Report items (brief §92, in order)

### 1. Starting SHA

`37a1e6753b6a57c9a0750511503776a3f122a17b` — the A3 Correction 1 documentation head; A4's first commit (`905dc48`) has
it as its parent.

### 2. preserve/pre-admin-a4 SHA

GitHub branch `preserve/pre-admin-a4` at `37a1e6753b6a57c9a0750511503776a3f122a17b`, created before the first A4 commit
and unchanged since (item 64).

### 3. Implementation commits

In order, each on its own (never squashed):

| Commit | What |
|---|---|
| `905dc48` | Media library schema and migration 0004 |
| `c764e83` | Media storage root, signatures and limits |
| `a6e6c2b` | Image processing (sharp 0.35.5, pinned) |
| `29a2eb2` | Rights, approval, restriction, Trash, versions and delivery |
| `6ed79c7` | Chunked upload protocol and versions |
| `bc1ab82` | Release media import (`media:import-release`) |
| `e6701f7` | Folders, library queries, usage and maintenance |
| `4d952e4` | Tests of the media server layer (unit and integration) |
| `a0c5553` | Media library admin UI |
| `b2331db` | Content media slots, project photos, service gallery and certificate previews |
| `4e382b7` | Certificate private originals in the certificate editor |
| `fab0ef3` | Tests of the content media references |
| `a074415` | Media item page fixes found by the browser tests |
| `b7a4c8b` | Browser tests of the media library |
| `fc98e21` | README and `.env.example` for the media library |
| `74dcae1` | Security review fixes (M1–M3, L4–L6, I1–I4) |
| `3a7bbc1` | Picker button labels wrap on narrow phones (found by the full admin run at 320 px) |
| `83b1ba7` | Tests of the security review fixes and the maintenance tool |
| `29c4178` | Refuse non-uploaders before reading an upload's opening body (the rest of the review's M3 advice) |
| `ead98a9` | Keep A3's child-text rule pinned by name in the completeness unit test (test only; item 46) |
| `a6cd373` | Load sharp at run time, outside the bundle: the public pages' runtime chunk unchanged again (found by the freeze proof, item 45) |
| `a50a96c` | Test that sharp never enters the bundler's module graph |
| `66de7be` | Scope the media code's file tracing: no build warnings (found in the fresh-clone build log, item 52) |
| `a1f562e` | The original file's download button wraps on narrow phones (found by the evidence capture at 320 px, item 57) |

### 4. Final code SHA

`a1f562e4ebd6ae9acb28b2e201edaa7366d99ed1` (`a1f562e`) — the last commit with code or tests; everything after it is
documentation.

### 5. Final docs HEAD

The docs commit that adds this report, `CLAUDE.md` and `README.md` follows `a1f562e` and is the branch's HEAD
(`git log -1 origin/claude/new-session-5eijs6`). Its SHA is given in the final message, since a commit cannot name
itself.

### 6. Migration files

One new file: `drizzle/0004_media_library.sql` (generated by `drizzle-kit generate` from `src/server/db/schema-media.ts`
and the A3 schema's new columns, reviewed, table options added as for 0000–0003). `drizzle/meta/_journal.json` lists it
fifth. The A2 and A3 files (`0000`–`0003`) are byte-identical: their applied hashes still match. A4 adds no permission,
so no seed file: the media and private-document permissions were seeded by A2 (`0001`).

### 7. A3→A4 migration proof

`tests/integration/media-migration.test.ts` (7 tests) and `npm run db:check`:

- **A.** An empty database takes all five migrations and reports nothing pending.
- **B.** A database at A3 — with A2 accounts and A3 content in it — takes exactly the A4 file.
- **C.** A second run is a no-op.
- **D.** The runner's hash and order checks still refuse a changed or reordered A4 file.
- **E.** Every A4 table is InnoDB `utf8mb4_unicode_520_ci`; ids, keys and storage keys are `ascii_bin`; the CHECK
  constraints hold (a private item can't be approved or pending review, a flag key's shape, …).
- **F.** No A2 or A3 row is lost or changed; the new columns start NULL; the media tables start empty.
- **G.** `npm run db:check` passes: `drizzle-kit check`, the migration files' hashes and order, the seed against the
  registries.

### 8. Media tables implemented

Eleven tables (A1-DATABASE-SCHEMA's media group):

| Table | Holds |
|---|---|
| `media_assets` | The item: kind, visibility (public / private, fixed at creation), usage status, folder, current file, focal point, rights holder and notes, licence expiry, approval and restriction facts, Trash, `legacy_key` (release items), `lock_version` |
| `media_files` | One row per version: storage area (`release` / `originals` / `private`) and key, original name (display only), type, size, SHA-256, dimensions, blur placeholder, processing status, upload facts, `superseded_at` |
| `media_variants` | Generated WebP sizes of a file (`w320`…`w2048`, `thumb`): size, dimensions, storage key (unique), SHA-256 |
| `media_translations` | Title, alt text (NULL undecided / `''` decorative / text) and caption per language |
| `media_flags` | Safety flags with note, creator and time (the flag instance a clear is decided on) |
| `media_folders` | The folder tree (name, parent, position) |
| `public_media` | The materialized deliverable set: media id → current file, written only by `syncPublicMedia` |
| `project_media` | A project's ordered photos |
| `service_gallery_items` (+ `service_gallery_item_translations`) | A service's gallery: ordered photos with captions per language |
| `certificate_documents` | A certificate's files by role: `public_preview` (per language) and `private_original` |

### 9. Deferred A3 media-schema catch-up

A3 deferred every media reference to A4. Migration 0004 adds A1's media columns to the A3 records, each a
foreign key to `media_assets` (`ON DELETE RESTRICT`), never a path or URL: `pages.og_image_media_id`,
`services.cover_media_id`, `services.supporting_media_id` (with `service_translations.cover_alt` and `supporting_alt`),
`services.og_image_media_id`, `projects.og_image_media_id`, `machines.media_id`, `industries.media_id`,
`industries.feature_media_id`, `clients.logo_media_id`, `clients.logo_mono_media_id`, `certificates.thumb_media_id`, plus
the relation tables of item 8 (`project_media`, `service_gallery_items`, `certificate_documents`). The A3 editors gained
the matching fields (item 38); the language-completeness single source (`translated.ts`) counts the two service alt
columns, and its drift tests were extended to them.

### 10. Release registry import

`npm run media:import-release` (`scripts/media-import-release.mjs` → `src/server/media/release.ts`), run by hand, never by a
migration or at app start:

- Reads the committed baseline `src/server/media/release-baseline.json` (generated from the repository by
  `node scripts/media-release-baseline.mjs --write` after a build: each file's size, SHA-256, dimensions and blur
  placeholder from the media registry, whether a built page uses it, its alt as the built site gives it, and the held-back
  rules from `src/content/projects.ts` and `scripts/package-namecheap.mjs`); `--check` proves the committed baseline
  equals the repository.
- **Fails closed:** every file is checked against the baseline (size and SHA-256) and every existing record against the
  file before anything is written; any difference stops the run with nothing written.
- **Idempotent:** items are matched by `legacy_key` (today's media id); a second run writes nothing.
- **Never moves a file:** release items are `storage_area = 'release'`, key = the address the site uses; the release
  keeps serving them exactly as before. A9's cutover moves them into the persistent store.
- **Refresh** (`--refresh=<legacy key>`, audited): when RAWASY replaces a release file under the same name, the record takes
  the new file's facts and an approved item returns to review.
- Alt texts only as the built site gives them consistently: 32 described, 20 decorative (`''`), 91 undecided. No rights
  holder, licence or authorship is invented.

### 11. Exact release count

**143** files (`RELEASE_COUNT`; the baseline schema requires exactly 143): certificates 8, clients 42, machines 6,
projects 57, services 22, site 8. Statuses: **108 approved** (every file a built page uses — a baseline, not a rights
claim), **22 pending review** (not used by any page), **13 restricted** (held back). `tests/integration/media-importer.test.ts`
(and the evidence's library screens) check the counts.

### 12. Exact held-back count / status

**13**, each `restricted` with its documented flags and **no `public_media` row**:

| Item | Flags |
|---|---|
| `projects/billboard-structure-1`, `stainless-landmark-1`, `wheat-monument-1` | AI watermark |
| `projects/canopy-tree-1`, `lattice-cubes-1`, `seed-sculpture-1` | Authorship unconfirmed |
| `projects/laser-cut-bench-1`, `litter-bins-1`, `litter-bins-2`, `litter-bins-3` | Render, not a photograph |
| `services/engraving-nameplates` | Contains identifiers, Rights pending, Third-party branding |
| `services/engraving-rotary`, `services/engraving-wood` | Render, not a photograph |

They are the same 13 the deployment package leaves out (`scripts/package-namecheap.mjs`, unchanged). Their thumbnails
never appear in the admin (a blocking flag hides an item's picture everywhere) or in the evidence.

### 13. RAWASY_DATA_DIR design

`src/server/media/storage.ts`, one root from `RAWASY_DATA_DIR`:

```
$RAWASY_DATA_DIR/media/originals/YYYY/MM/<file-ulid>.<ext>       public-class originals (never served publicly)
$RAWASY_DATA_DIR/media/derived/<media-ulid>/<variant>-<hash8>.webp  generated sizes (served when deliverable)
$RAWASY_DATA_DIR/media/private/<media-ulid>/<file-ulid>.<ext>     private originals (separate root)
$RAWASY_DATA_DIR/tmp/uploads/<upload-ulid>/…                       upload staging
```

- Must be absolute, outside the application folder and never inside a `public` or `public_html` folder (refused at use,
  `StorageConfigError`); required only when media is uploaded or served — `npm run build` and the public site never use
  it (a build that tries fails loudly).
- Keys are made by the server from ULIDs and hashes and checked against a strict grammar per area; a user's file name
  never forms a path. Every path is resolved under its area and checked again against the real (symlink-free) path of
  its directory; files are opened with `O_NOFOLLOW` and must be regular files. Directories 0700, files 0600. Writes are
  atomic (a temporary file, then a rename — or, for generated files since the review, a hard link that never replaces a
  name).
- Local tests use temporary folders; no real path is assumed (item 59).

### 14. Upload protocol

Route Handlers under `/api/admin/media/uploads` (outside the proxy; never Server Actions, whose 1 MB in-memory body would
not do):

```
POST   /api/admin/media/uploads                     open: purpose, file name, size → upload id, part size, parts
PUT    /api/admin/media/uploads/{upload}/parts/{n}  one part, streamed to disk with a byte cap
POST   /api/admin/media/uploads/{upload}/complete   assemble, verify, store, process → the media item
DELETE /api/admin/media/uploads/{upload}            cancel
```

- Every request: the admin gate, a live session, the exact admin `Origin` and same-origin fetch metadata
  (`adminRouteContext`), then the permission of the purpose (`new`, `replace`, `private_original`), decided again at
  every step and at the end of processing.
- **Steps of a completion:** an exclusive completion lock; the parts assembled while hashing; the signature and
  structure checked; the pixel limit read from the header; duplicates offered; then the item and file rows written
  `processing` **before** any byte moves (a crash leaves a visible row for the maintenance tool); the original moved
  into its area; sizes generated; the stored bytes checked back; one transaction makes the file ready and current (item
  33). A failure marks the file `failed`, removes what that upload wrote, and leaves everything else as it was.
- The browser side (`MediaUploader`): parts sent in order, a `<progress>` bar and a polite status line, cancel, and the
  duplicate question.

### 15. Chunk security

- **Ownership** is in the upload's private manifest (0600): the user and the session that opened it (its rotation
  lineage followed, at most 20 steps). Another user, another session or an unknown id get the same "not found".
- Parts of exactly 4 MiB (the last shorter), at most 5; the part number and `Content-Length` are checked before the body
  is read, the length again while streaming (never buffered whole), and the assembled size against the declared size.
- At most 5 open uploads per user (slots in `rate_limits`, claimed by one conditional UPDATE each and freed only by the
  upload that holds them — review L4) and 60 new uploads per user per hour; uploads expire after 1 hour, and opening an
  upload removes the person's own expired, abandoned ones (L4).
- The JSON bodies of the open and complete requests are read as a stream with a byte cap (4 KiB / 256 B), and someone
  who may upload nothing is refused before the body is read (review M3).
- A tampered part on disk (a different length) is refused at completion; a completion lock stops two completions and a
  cancel while completing.

### 16. MIME / signature validation

`src/server/media/signature.ts`: the extension must be on the allowlist (JPEG, PNG, WebP, AVIF, PDF) **and** the bytes'
signature must agree with it; the browser's type and the name are never trusted.

- JPEG (SOI + a marker), PNG (the 8-byte signature + IHDR first), WebP (RIFF with a consistent size + `WEBP`), AVIF (an
  `ftyp` box with an `avif`/`avis` brand — HEIC/HEIF refused — and the decoder must report AV1), PDF (`%PDF-` header and a
  `startxref … %%EOF` end).
- Refused: SVG (no upload of SVG exists in A4), HTML, GIF, HEIC, TIFF, archives, video, anything else; animated or
  multi-page images.
- Images are decoded and re-encoded before anything is delivered, which neutralizes polyglots (a JPEG with an HTML page
  appended is accepted only as its pixels); PDFs are only ever delivered as attachments with a sandbox CSP.

### 17. Size / pixel limits

20 MiB per file (declared size checked before anything is read, and again assembled); 40 megapixels per image (width ×
height as displayed, read from the header before decoding, and `limitInputPixels` on decode: a "decompression bomb" —
a tiny PNG announcing 400 MP — is refused before decoding); parts of 4 MiB, at most 5; file names kept for display up
to 255 characters (cleaned: no path separators, control or direction characters). Text limits: title 200, alt 500,
caption 500, rights holder 200, rights and source notes 2,000, folder name 120.

### 18. Dependencies + licences

One dependency added to `package.json`: **`sharp` 0.35.5**, pinned (Apache-2.0). It is the same version Next.js 16.3.8
already installed as an optional dependency: the lockfile only lost the `optional` marks of `sharp`, `@img/colour` and
`detect-libc` — no package or version was added or changed. Its tree: `@img/colour` 1.1.0 (MIT), `detect-libc` 2.1.2
(Apache-2.0), `semver` 7.8.5 (ISC), and the prebuilt platform packages `@img/sharp-linux-x64` 0.35.5 (Apache-2.0) with
`@img/sharp-libvips-linux-x64` 1.3.4 (libvips, **LGPL-3.0-or-later**, shipped as a separate shared library, unmodified).
Its glibc requirement (2.28 or later for the prebuilt binaries) is a pre-staging check on the account (item 59). The
application never bundles it: Node loads it from `node_modules` at run time (item 19), like Next's own optimizer does.

### 19. Image processing

`src/server/media/images.ts`: one image at a time per process (`sharp.concurrency(1)`, cache off, a queue in front — the
host shares 2 GB). sharp is loaded by Node when the first image is processed (`import(/* turbopackIgnore: true */ "sharp")`),
never bundled: a bundled import made every public page's runtime chunk grow (item 45), and those libvips settings, which
Next's image optimizer shares in the same process, now apply only once the admin processes an image. The source is decoded once with the pixel limit, the EXIF orientation applied, converted to sRGB and
scaled to the largest width needed as raw pixels, and every size is made from those pixels. No metadata (EXIF, GPS, ICC,
comments) reaches a generated file. A truncated or damaged image that passes the header check fails here and is
refused.

### 20. Variants

WebP at 320, 640, 1080, 1600 and 2048 px wide — only widths not wider than the source, never an upscale (a source
narrower than 320 px gets one size at its own width). Quality 82. Names: `<variant>-<hash8>.webp`, where the hash covers
the file version and the bytes (since the review: two versions never share a name). Rows record each file's size,
dimensions and SHA-256; the tests compare them with the files on disk. Public-class images only: documents and private
originals get none.

### 21. Blur / thumbnail

A 256 px admin thumbnail (`thumb`, quality 74, inside a square; never public: the public route refuses it) and a blur
placeholder (inside 16 px, a WebP data URL kept only when at most 600 characters, in `media_files.blur_data_url`, as the
registry's own placeholders). Admin previews (`/api/admin/media/{id}/preview/thumb|large`, brief §47) need a session
and `media.view`, serve only public-class images — pending and restricted ones included, so they can be reviewed — and
are `no-store`; a private item has none (a document shows an icon, never an inline PDF). The library cards and the item
page show no picture while a blocking flag is set.

### 22. Duplicate detection

By SHA-256 of the whole file, at completion, before anything is stored: when the library already holds the same bytes the
person is offered the existing items (up to 5) — reuse, or upload anyway as a separate item. Only items the person may
know of are offered: a private item's bytes are never named to an Admin or Editor (the Owner is told the file equals a
private document); items in the Trash are not offered. A replacement identical to the item's current version is refused
("nothing to replace").

### 23. Folders

`src/server/media/folders.ts` and `/admin/media/folders`: organization only — a folder never changes an address, a
storage key or anything public. Create, rename, move (nest), reorder among siblings, delete only when empty (the
Trash's items count). Names are plain text on one line, without separators or control characters, unique among siblings
(as the collation compares them); no folder is its own ancestor; at most 6 levels and 500 folders. Every change holds
the whole tree's rows FOR UPDATE, so two changes never interleave into a cycle or a duplicate. Needs `media.edit`.
Since the review (L5) a private document is never filed in a folder.

### 24. Bilingual metadata

Title, alt text and caption in English and Arabic, as equals; Arabic fields `dir="rtl" lang="ar"` and kept as typed.
Alt is three-state per language: **undecided** (NULL), **decorative** (`''`, a deliberate decision) or **text**. Plain
text only (no markup, control or bidi-override characters). An approved image keeps its alt decision in both languages
and an approved document its title (removing one is refused). Search covers both languages, Arabic normalized like A3's
(item 37's library search).

### 25. Focal point

Two coordinates from 0 to 1 (three decimals), both or neither ("Set a focal point" turns it on). The two labelled sliders
("From the left", "From the top") are the accessible control and work from the keyboard; a click on the preview is a
shortcut, and a ring marks the point. Stored on the item (`focal_x`, `focal_y`) for later crops; the original is never
cropped. Images only.

### 26. Flag policy

`src/server/media/registry.ts` `MEDIA_FLAGS`: rights pending, authorship unconfirmed, AI watermark, AI-generated, AI-edited
(blocking in A4: the Owner's locked decision 7), render (not a photograph), third-party branding, contains identifiers,
contains personal data — all **blocking**; low resolution — **informative**. A flag the code does not know blocks
(fail-closed). Every role may add a flag (`media.flag`), never needing the page's version (it only makes the item safer);
a blocking flag withdraws an approved item at once. Only Owner or Admin clear a blocking flag, with a reason, decided on
the flag instance the page showed (a flag cleared and added again meanwhile is not cleared by that page). Flags never
change an item's version.

### 27. Approval policy

Approval is its own action (Owner or Admin, `media.approve`), with a note, on the version the page showed, of an item
pending review. It needs, under the item's lock: no blocking flag, a ready current file whose files are on disk, the
alt decision in both languages (images) or the title in both languages (documents). Saving metadata never approves.
A private item can never be approved (no path exists, and a CHECK constraint forbids it). Approval is audited with its
note and version.

### 28. Restriction policy

Owner or Admin restrict at once, with a reason, never needing the page's version (safety-increasing): the item is
withdrawn in the same transaction. Lifting a restriction (and leaving the archive) needs the page's version and returns
the item to **review**, never straight to approved. A replacement never lifts a restriction. Since the review (I1) none
of these happens while the item is in the Trash.

### 29. public_media invariant

`src/server/media/deliverability.ts`: deliverable ⇔ public visibility, status approved, no blocking flag (unknown flags
block), not in the Trash, a current file that is ready, and its delivery files (width variants for an uploaded image; the
file itself for a document; release files served by the release). `syncPublicMedia` runs at the end of every
transaction that changes one of those inputs, with the item's row locked, and writes or deletes the `public_media` row;
nothing else writes it. `assertPublicMediaInvariant` checks both directions (every deliverable item has its row naming
its current file; every row belongs to a deliverable item; no private item has one) **after every media integration
test and every content-media test**, and the maintenance tool reports and (on request) rebuilds any drift.

### 30. Public uploaded-media route

`GET|HEAD /media/u/{media-ulid}/{name}` (`src/app/media/u/[id]/[name]/route.ts` → `public-delivery.ts`):

- the admin gate first: off (production, staging) → plain 404 before any database access;
- a strict grammar (`w<width>-<hash8>.webp` or `document-<hash8>.pdf`); looked up through `public_media` only, and only the
  current file's width variants or its document — never the thumbnail, an image's original or a private file;
- 200 with the exact type, length, the content hash as ETag (304 on a match), `public, max-age=31536000, immutable` (the
  name carries the hash), `nosniff`, a sandbox CSP, `inline` for images and `attachment` for PDFs; no cookies read or
  set;
- not deliverable → 404 (not cached); database unreachable → 503 with `Retry-After`, never a possibly withdrawn file.

Since the review (M1), Next.js's image optimizer refuses these addresses (item 44).

### 31. Private route

`GET /api/admin/files/{media-id}[?version=<file-id>]` (originals):

- a private item: only a holder of `private_documents.view` (the Owner), with a step-up in the last 10 minutes; to anyone
  else it does not exist (404);
- a public-class item's original: `media.view_original` (Owner, Admin);
- `no-store` (next.config's static `/api/admin/**` headers), `nosniff`, a sandbox CSP, an attachment with an RFC 5987
  name (sanitized; never the storage key); every download and every refusal of a signed-in user audited
  (`media.private_download` / `media.original_download` / `media.download` denied) — never with the file's name.

### 32. Certificate private/public split

`certificate_documents` holds both roles, never mixed:

- **`public_preview`** (per language): a redacted preview is an ordinary public-class upload (image or PDF), chosen in
  the certificate editor's picker; it starts pending review and is delivered only once approved. Content saves write only
  this role.
- **`private_original`**: uploaded only by the Owner from the certificate editor ("Private originals" — acknowledged,
  never publishable), stored under the private root, `visibility = 'private'`, status `internal`, never derived, never
  previewed, never chosen by content (a private id is refused exactly like an unknown one), never approvable, downloaded
  only with a step-up. Content saves never touch these rows. An Admin, Editor or Reviewer never sees that they exist.

### 33. Versioning / replacement

A replacement is a new version (`media_files` row, the next number under the item's lock) of the same item: the kind and
visibility never change, a Trash item can't be replaced, identical bytes are refused. The previous version stays
current and deliverable until the new one is ready. Finishing (one transaction): the variant rows, the file ready, the
current version switched only to a newer one (of two replacements finishing out of order the newer wins), an approved
item **returns to review** (Owner decision 8) and is withdrawn until approved again, a restriction is never lifted,
`public_media`, search rows and audit. A failed replacement leaves the item exactly as it was — and since the review
(M2) it can never delete another version's files.

### 34. Restore old version

Owner or Admin, on the version the page showed: an earlier ready version whose files are on disk becomes current again;
the newer version stays (never deleted); an approved item returns to review (restoring is a replacement too);
restricted and archived items keep their status; refused in the Trash. Audited.

### 35. Trash / restore

Owner or Admin (`media.delete`): moving to the Trash withdraws the item at once and keeps everything (metadata, files,
versions, flags, history); the item is read-only there (metadata, status changes, replacements and version restores are
refused). Restored from the Trash, an approved item comes back **pending review**; restricted and archived items keep
their status. Content keeps references it already had (shown with a warning) but can't newly choose a trashed item.
Permanent deletion is not offered (brief §59): no purge exists in A4.

### 36. Maintenance tool

`npm run media:maintenance` (`scripts/media-maintenance.mjs` → `src/server/media/maintenance.ts`), by hand only (no cron,
no schedule):

- **Report** (read-only, saved for the dashboard): abandoned temporary uploads (older than 24 h), stuck processing
  (older than 15 min), failed files, records whose files are missing on disk, files on disk without a record (orphans),
  entries that are not files (links), old versions past the 30-day retention (purge candidates — never purged), and
  `public_media` rows that disagree with the rule.
- **Repairs, only when asked:** `--clean-tmp`, `--fail-stuck`, `--regenerate=<id>` / `--regenerate-all`,
  `--rebuild-public`, `--purge-dry-run`. Each is audited as the CLI operator. An unknown file on disk is reported, never
  deleted; a file is never marked ready while its bytes are missing.
- Exit codes: 0 nothing to look at, 1 usage or configuration, 2 problems listed, 3 database error. Prints ids, counts and
  areas, never a server path.
- The Owner's and Admin's dashboard shows the last report's counts; an Admin's view leaves private items out (review I3).
- `tests/integration/media-maintenance.test.ts` (new since the review; the tool had none before) covers every category and
  repair.

### 37. Usage tracking

`src/server/media/usage.ts`: one list of every A1 media reference (the content types' media columns and their relation
rows), read by the item's "Used by" panel (each content item linked, with its slot), the library's "unused" filter and
the dashboard — direct queries on indexed columns, no second usage table. Release items are linked to the content that
uses them once A9 imports content; in A4 the built pages' use is recorded by the importer's status (item 11).

### 38. CMS media pickers

`src/server/cms/media-refs.ts` (the rule), the A3 engine's media slots and lists, and the client components
`MediaFields`, `GalleryRows` and `MediaPicker`:

- **Slots and lists:** page / service / project share images; service cover and supporting images (with alt per language)
  and gallery (ordered, captions per language); project photos (ordered); machine image; industry image and feature
  image; client logo (colour) and logo (monochrome); certificate thumbnail and redacted previews (per language).
- **The picker** is a `<dialog>` inside the content form (no nested form): search, the item's status, warnings for
  anything not approved, keyboard order, and an upload inside the picker for new files. Up / Down / Remove, no dragging.
- **The rule, decided by the server in the save's transaction:** a newly chosen item is read with a share lock and must be
  public-class, not trashed, not archived, ready and of the slot's kind; a kept item may stay with its warning; private
  and unknown ids get the same message; no duplicates in a list. Choosing never approves anything.

### 39. Permissions

No new permission (A2's registry already held them): every role views the library and adds flags (`media.view`,
`media.flag`); Owner, Admin and Editor upload and edit public-class items (`media.upload`, `media.edit`); Owner and Admin
approve, clear blocking flags, restrict, archive, restore versions (`media.approve`), use the Trash (`media.delete`) and
download public-class originals (`media.view_original`); private documents are the Owner's alone
(`private_documents.view` / `.upload` / `.delete`) — to everyone else a private item does not exist. Decided on the
locked row from the session (`decideAccess`), never from a hidden button; every refusal audited; the role matrix is
tested in the unit, integration and browser suites.

### 40. Concurrency tests

`tests/integration/media-races.test.ts` (8): approve vs a blocking flag (never delivered with the flag), approve vs Trash
(the Trash wins), metadata vs approve on the same page version (one wins, the other is stale), approve vs a replacement
being processed (an approval of the old version never outlives the new one), replace vs restrict (a replacement never
lifts a restriction), two replacements at once (both kept, the newer current), restore a version vs a replacement
(decided on the page's version), clear vs clear-and-re-add (a stale clear never removes the newer flag). Each holds one
side on a row lock so the order is deterministic, then checks the end state and the `public_media` invariant. Also: the
Trash during a replacement (`media-uploads.test.ts`), a certificate archived during a private upload
(`media-delivery.test.ts`), slots claimed again after expiry, and the folder tree's lock.

### 41. Path-security tests

`tests/unit/media-storage.test.ts`: each area's grammar accepts only generated keys (traversal, absolute paths, encoded
separators, NUL, wrong extensions, lower-case ULIDs, over-long keys refused, and `path()` throws for each); a symbolic
link never leads out, at the file (`O_NOFOLLOW`) or at its directory (real path checked), for reads, `writeAtomic` and
`writeNew`; streamed writes keep their cap and leave nothing partial; `RAWASY_DATA_DIR` must be absolute, outside the app
and any `public`/`public_html` folder; release keys resolve only inside `public/`. Browser and route tests: no storage
key or data path ever appears in a page.

### 42. MIME attack tests

`tests/unit/media-rules.test.ts` and `media-uploads.test.ts`: renamed and forged files (PNG as `.jpg`, JPEG as `.png`,
HTML or SVG as `.jpg`, a fake WebP, a fake AVIF, HEIC), a type the extension does not allow (refused before any byte is
read), a damaged PDF (no end marker, no cross-reference), a decompression bomb (refused before decoding), a truncated
image (passes the header, fails decoding: nothing stored, nothing public), a polyglot (accepted only as pixels; its sizes
hold none of the page), file names with traversal, separators, control and direction characters (shown cleaned, never a
path), metadata stripping (EXIF and GPS gone, orientation applied).

### 43. Public / private invariant tests

`assertPublicMediaInvariant` after every test of `media-states`, `media-races`, `media-delivery`, `media-maintenance`,
`cms-media` (and at the end of `media-uploads`); private originals: stored under the private root, internal, linked to
the certificate, no derivative, no `public_media`, no public address, no preview even for the Owner, not approvable, never
turned public by any path (the schema refuses a private approved row), never offered as a duplicate to others, never
chosen by content, invisible to Admin/Editor/Reviewer in every list, search, count, card, picker and route; the audit log
never holds a private document's words (I2).

### 44. Security review findings / fixes

A read-only adversarial review of `git diff 37a1e67` (path traversal, symlink escape, IDOR, private-file leakage,
duplicate-hash leakage, MIME spoofing, decompression bombs, upload exhaustion, chunk ownership, cross-origin upload,
stale `public_media`, approval bypass, blocking-flag removal, concurrent approval/replacement and restriction/approval,
stale version restore, private-original conversion, file name and Content-Disposition injection, XSS through titles and
captions, SQL injection, mass assignment). **No High finding.** Every finding is fixed (`74dcae1`, `3a7bbc1`, `29c4178`),
each with a test that fails on `fc98e21` (`83b1ba7`):

| # | Severity | Finding | Fix | Test (fails before) |
|---|---|---|---|---|
| M1 | Medium | Next's image optimizer accepted any local address, `/media/u/**` included, and cached the result for max(4 h, the source's max-age) = a year: a withdrawn upload stayed public through `/_next/image` | `images.localPatterns` lists the release's pictures only (the six media folders, `/og/**`, `/apple-icon.png`, no query string); anything else answers 400 | `media.spec.ts` approval test: `/_next/image?url=/media/u/…` (and `…/projects/../u/…`, `…?v=1`) 400, a release picture 200 WebP. With `fc98e21`'s `next.config.ts` the same test got **200** |
| M2 | Medium | Derivative names were the bytes' hash only: a replacement with identical pixels (other EXIF) collided on the unique storage key, and its clean-up deleted the delivered version's files | Name hash = SHA-256(file version id, bytes); generated files written once (`writeNew`, a hard link never replaces a name); a failure removes only the files it created | `media-uploads.test.ts` "same pixels in other bytes": on the old code the replacement answered 422 and v1's files were gone; `media-storage.test.ts` `writeNew`; `media-maintenance.test.ts` regeneration keeps other versions' files |
| M3 | Medium | The upload routes' JSON body was read whole (`request.text()`) when sent chunked (no `Content-Length`) | Streamed read with a byte cap that cancels the stream; non-uploaders refused before the read | `media-json-body.test.ts`: a 64 MiB chunked body is refused after ≤ 128 KiB read; the old reader pulled all 64 MiB (~128 MiB of buffers) |
| L4 | Low | A late cancel or complete of an expired upload freed the slot a newer upload had claimed (more than 5 open); expired uploads' parts stayed until the maintenance tool ran | A slot is freed only while its holder holds it (`expires_at` is the claim's mark); opening an upload removes the person's own expired, unlocked uploads | `media-uploads.test.ts` slot test (old: the newer upload's slot freed) and sweep test (old: abandoned folders stayed) |
| L5 | Low | A private document filed in a folder showed in the folder's item count (and the delete refusal) to every role | A private document is never filed in a folder (server refusal; the field hidden on its page) | `media-states.test.ts` (old: filed, counted) |
| L6 | Low | `contentDisposition` cut names by UTF-16 units and could throw on a lone surrogate — after the file was opened and the download audited | Cut by code points, lone surrogates → U+FFFD; headers built before the file is opened and the download recorded; the file closed if the audit fails | `media-rules.test.ts` (old: `URIError`) |
| I1 | Info | The Trash was not read-only for a replacement finishing there or for lifting a restriction / leaving the archive | `finishUpload` fails on a trashed item; `statusBack` refuses in the Trash (audited) | `media-uploads.test.ts`, `media-states.test.ts` (old: 201 / ok) |
| I2 | Info | Audit rows of private items carried their title (A8's audit viewer would show it to an Admin) | `mediaLabel` is always "private document" for a private item | `media-states.test.ts` (old: the title in the label and summary) |
| I3 | Info | The dashboard's storage-check counts shown to an Admin included private items and the private area | `publicView` for roles without `private_documents.view`; the report records `failedPrivate` | `media-maintenance.test.ts` |
| I4 | Info | A private original's finish locked the media row, then (through the foreign key) the certificate: the reverse of a certificate save's order, and the certificate was not re-checked | The certificate is share-locked and re-checked first (archived or removed meanwhile: failed, no link, the stored file removed) | `media-delivery.test.ts` (old: linked to the archived certificate) |

The review also confirmed as sound: the storage grammar and symlink checks, chunk ownership, signatures and decoding,
metadata stripping, duplicate offers, the public route's lookup and headers, private originals' isolation, permissions
and mass assignment, the concurrency and `public_media` rule, content media references, SQL binding, rendering and
redirects, the importer and maintenance; and that Next 16.3.8 fetches local images **without the visitor's headers**, so
the admin's own image routes were never reachable through the optimizer.

### 45. Public freeze proof

Against `preserve/pre-admin-a4` (`37a1e67`), built in a worktree, and the final build: the fresh clone of `a1f562e`,
copied right after `next build` (no database settings in the environment). Everything below ran on that final code. A
first run on `ead98a9` found one change in every public page, described at the end, which is fixed. The rounds on
`a50a96c` (whose build log led to `66de7be`, item 52) and on `66de7be` gave the same figures as below, apart from the
pixel captures' run-to-run noise. `a1f562e` changed only admin CSS, an admin component and an admin test.

- **Source.** Since `37a1e67` no public path changed: `public/`, the public route group, its components, content, `lib`,
  `i18n`, the proxy, the fallback 404 and its fonts, the public E2E tests and their config, `server.js`, the packaging and
  warm-up scripts. The 13 held-back-media rules are untouched. Outside the admin, A4 changed only `next.config.ts` (the
  optimizer list, item 44 M1), `package.json` / `package-lock.json` (`sharp` direct, three `media:*` scripts),
  `drizzle.config.ts` (the media schema file), `.env.example`, the README and three new hand-run tools in `scripts/`.
- **Build output.** The baseline's 890 files under `.next/server/app` (admin pages left out) all exist in the final
  build:
  - 114 byte-identical;
  - 193 identical once the build id and `/_next/static` chunk paths are normalised;
  - 408 differ only in the router's sibling entry (below);
  - **0 other differences**.

  49 files are new: the server files of A4's 7 route handlers (`api/admin/media/**` 35, `api/admin/files/[id]` 7,
  `media/u/[id]/[name]` 7). The 175 server bundles and manifests are compared by module.
  - **The router's sibling entry.** Every public page's HTML and page data list the static top-level segments next to
    `[locale]`: `["admin"]` on the baseline (A2's `/admin`), `["admin","api","media"]` now. A4's route handlers are the
    first real route files under `/api` and `/media`, and `/media/u/**` is the route the brief asks for. A2's `/admin`
    had the same effect; the comparisons normalise exactly that entry.
  - **Stylesheets:** on all 104 prerendered public pages, the same stylesheets in the same order, byte-identical.
  - **Scripts:** on all 104 pages, the same chunk names and bytes, and the same module set and code. That includes the
    Turbopack runtime `turbopack-1259tmma_rllk.js`, 9,721 bytes on both builds.
- **HTTP.** Three admin-off settings were tested: nothing set, `ADMIN_ENABLED=0`, and `APP_ENV=staging`. Each ran against
  a freshly started baseline with its route cache emptied. In all three:
  - **102 / 102 sitemap pages** have the same status, headers (date, ETag and cache state aside), normalised HTML and
    page data. Their SEO facts match too: 102 titles, 102 descriptions, 102 canonicals, 306 hreflang links, 208 JSON-LD
    blocks, 618 media references and 292,957 characters of visible text.
  - `robots.txt`, `sitemap.xml` (48,451 bytes), the manifest and both icons are byte-identical.
  - `/favicon.ico` (no such file) answers 404 on both builds with the same headers. Its body is identical once
    normalised; it differs only by the build id and the sibling entry.
  - **45 / 45 redirect and locale cases** and **25 / 25 not-found cases** are identical.
  - Form POSTs to admin addresses get the same locale redirect.
  - No public page links to the admin, and none mentions `/media/u`.
  - API addresses that no route answers give the same 404 with A2's API headers: `/api/admin/anything`,
    `/api/internal/anything`, `/api/admin/cms/pages`, `/api/admin/media/anything` and `/api/admin/files`.
  - The 13 held-back files answer the same as before (no page refers to them; the package leaves them out).
  - **A4's new addresses with the gate off:** every `/media/u/…` address and every media API address answers a
    plain-text 404 (`no-store`, `nosniff`, no cookie) before any database access (the no-database check below). The
    baseline gave Next's HTML 404 there. `GET /api/admin/media/uploads` answers 405, since that route defines POST only.
- **Release media.** All 143 release files (`public/media`) were requested from both builds:
  - **143 / 143** have identical bytes, status 200, and identical headers (`content-type`, `content-length`,
    `cache-control`, `accept-ranges`), apart from `Last-Modified` and its weak ETag;
  - in all 143 cases `Last-Modified` is that side's own file date: the worktree and the clone were checked out at
    different times;
  - the 148 files in `public/` are byte-identical on disk, with none added or removed.
- **Image optimizer** (M1, item 44). Every `/_next/image` address the 102 sitemap pages offer was compared: 1,484 on
  each build, the same set. Each was requested from both builds as a browser asks (WebP accepted), each build starting
  from an empty image cache.
  - **1,484 / 1,484 are identical:** status 200, type, caching, ETag and bytes.
  - Outside the list, `/og/og-en.png` and `/apple-icon.png` are optimized exactly as before.
  - SVGs, `/media/u/…`, a `..` path into it, a page address, a missing file and a release picture with a query string
    are refused with 400 on both builds. Only the reason text differs: the final build refuses before fetching
    (`"url" parameter is not allowed`), where the baseline fetched and then refused.
- **No public database query.** The build was served with the admin **on** (`APP_ENV=production`, `ADMIN_ENABLED=1`) and
  `DB_*` pointing at a stand-in that counts connection attempts and refuses each one.
  - The 102 sitemap pages, their page data, 7 public files and 7 404s made **0 attempts**, and so did the admin's
    sign-in page.
  - The positive control, a forged admin sign-in, made 1 attempt.
- **Pixels.** 11 representative pages were captured screen by screen (as many screens as the page's height gives, at
  most 6), in EN/AR × light/dark × desktop 1440 × 900 / phone 390 × 844, with reduced motion, every image decoded and
  the map stubbed. Result: **235 screens, 228 pixel-identical**. The other 7 were captured 3 more times on each build;
  each differs by exactly what a build differs from itself, and each matched the other build in at least one pair:
  - `/en/about`, desktop dark (66 pixels) and phone light (69): every repeat identical across the builds (A2 and A3
    noted the same 69 on the phone).
  - `/ar/services/laser-cutting` (the Arabic signature): desktop dark 37 pixels and phone light 31. In the repeats the
    final build differed from itself by the same 37 and 31 and matched the baseline in the other pairs; the phone's
    second screen (882 pixels in the first capture) was identical in every repeat.
  - `/en/projects` on the desktop, light and dark: 8 pixels, which both builds show against themselves (A2 and A3 noted
    the same 8).

  **Page heights.** The capture reads each page's height just after it loads, before the walk that loads every image,
  and two pages are still growing then:
  - the English homepage on the phone: 12,063 px on the baseline, 11,980 on the final build (it grows by 83 px when its
    images arrive, on every build);
  - the Arabic 404, which is built in the browser: 1,244 / 900 px on the desktop and 2,054 / 844 on the phone, read
    before it had rendered.

  Every captured screen of those two pages was pixel-identical. Re-measured after loading, with each page walked, every
  image loaded and decoded and the 404 rendered, **all 44 page states (11 pages × desktop/phone × light/dark) have the
  same height on both builds**, with no image left unloaded. The round on `66de7be` recorded the same 12 homepage
  readings.

  The earlier rounds gave 236 screens with 228 identical (`a50a96c`) and 238 with 232 (`66de7be`); the number of
  screens follows the heights read at capture time. The rest was the same kind of noise:
  - the Arabic Laser Cutting signature (35–888 pixels);
  - `/en/about` and `/en/projects`;
  - `/ar/certificates` (1–6 pixels);
  - the Arabic 404, where the baseline once differed from itself by 1,197,225 pixels.
- **The runtime chunk: found and fixed.** The first run of this proof (on `ead98a9`) found every public page's
  Turbopack runtime chunk changed: `turbopack-1259tmma_rllk.js` (9,721 bytes) became `turbopack-35ek18i37z_e6.js`
  (10,946 bytes) on all 104 pages, while every other module was identical.
  - **The cause.** The added code was Turbopack's async-module machinery. `images.ts` imported sharp statically, and
    sharp 0.35's ES module entry is an external ES module to the bundler, which makes it an async module. One async
    module anywhere in the module graph adds that code to every page's browser runtime, even when no page uses it.
  - **A plain dynamic `import()` did not help.** It still left the external in the graph: same 10,946 bytes, two async
    modules.
  - **The fix (`a6cd373`).** sharp is now loaded with `import(/* turbopackIgnore: true */ "sharp")`, and Node resolves
    it from `node_modules` at run time. The build holds **0 async modules**, and the runtime chunk is byte-identical to
    the baseline's again (above).
  - **Side effect.** The same change keeps sharp's process-wide libvips settings (one thread, no cache), which Next's
    optimizer shares, from being applied when an admin route merely loads; they now apply only once the admin processes
    an image.
  - **The test (`a50a96c`).** It reads the source and fails on a static import of sharp. The media browser spec (18 / 18)
    and the full suites passed on the fix, so uploads are still processed both through the built server and directly
    under Node.
- **Public E2E:** see item 49.

### 46. Unit results

`npm run test:unit` on the fresh clone of `a1f562e`: **167 / 167 passed** (0 failed, cancelled, skipped or todo), 13
files.

Split by test name (brief §90) against the A2 closing state (`dcd089d`, `preserve/pre-admin-a3`) and the A3 closing
state (`37a1e67`, `preserve/pre-admin-a4`), each listed with the same reporter on its own checkout:

| Origin | Tests | Passed | Files |
|---|---|---|---|
| A2 inherited | 30 | 30 | `admin-gate` 6, `email` 2, `privilege` 4, `security` 18 — names and code unchanged |
| A3 inherited | 102 | 102 | `cms-access` 12, `cms-completeness` 42, `cms-rules` 24, `cms-slugs` 13, `cms-validation` 11 — 93 unchanged, 9 renamed and widened (below) |
| A4 new | 35 | 35 | `media-rules` 14, `media-storage` 8, `media-json-body` 3, `media-bundle` 2, `cms-completeness` 8 (alt texts) |
| **Total** | **167** | **167** | |

The 9 renamed A3 tests (`cms-completeness.test.ts`): the 8 per-type "child items: … label and value required" tests are
now "… each child's required texts required", and "only machinery and certificates have child items" is now "child
items: machinery attributes, certificate facts and (A4) a service's gallery". A4 gave child items a list of texts (a
gallery photo has a caption and an optional alt), so the same checks — the same tables in the editor and the SQL rule,
required columns NOT NULL, the SQL's emptiness test — now run over each required text, and the set of types with child
items is still an exact list. Because the generic form derives its expectation from the definition it checks,
`ead98a9` pins the rule by name again: machinery attributes and certificate facts need label **and** value (A3's rule),
a gallery photo its caption. Negative control: with an attribute's value made optional, that test fails (49 / 50 in
the file).

### 47. Integration results

`npm run test:integration` (local MariaDB 11.4, a fresh `rawasy_t_*` database per file) on the fresh clone:
**360 / 360 passed** (0 failed, cancelled, skipped or todo), 28 files, 129 s.

| Origin | Tests | Passed | Notes |
|---|---|---|---|
| A2 inherited | 164 | 164 | 162 with their A2 names; 2 renamed during **A3** (not A4): `migrations.test.ts` "… both files applied …" → "… every file applied …", `rbac.test.ts` "129 keys …" → "130 keys: A1 §5.4's 129 and A3's projects.add_flags" |
| A3 inherited | 94 | 94 | 91 with their A3 names; 3 renamed by A4 (below) |
| A4 new | 102 | 102 | `media-uploads` 29, `media-states` 19, `cms-media` 11, `media-delivery` 10, `media-importer` 10, `media-maintenance` 8, `media-races` 8, `media-migration` 7 |
| **Total** | **360** | **360** | |

Baselines run the same way: A2's closing state 164 / 164, A3's 258 / 258.

Inherited integration tests A4 changed (each kept or made stricter):

- `cms-catalogue.test.ts` (A3), clients: "… no logo field (A4)" → "…; logos only as A1's media references (A4)". A3 refused
  any logo, media, file or upload column; A4 requires **exactly** `logo_media_id` and `logo_mono_media_id` (both NULL on
  a new client) and still no file, upload or path column.
- `cms-catalogue.test.ts` (A3), certificates: "no file, document, address or number column exists; …" → "no file, address
  or number column exists — files only as A1's media references (A4); …". The exact list of the six media-reference
  columns (the thumbnail and `certificate_documents`), and still no URL, file, path, number or QR column.
- `cms-migration.test.ts` (A3), A: "takes all four migrations …" → "takes every migration (the A3 files and A4's 0004)
  …": five applied, nothing pending.
- `migrations.test.ts` (A2): names unchanged; the expected status lists five migrations ("Applied (5)", "Migration files
  OK: 5").
- `cms-completeness.test.ts` (A3): names unchanged; child cases are built from each type's required texts. For
  machinery attributes and certificate facts the four A3 cases are exactly as before (both languages, Arabic missing,
  Arabic value missing, English value missing); the service gallery adds its own.
- `cms-helpers.ts` gained `seedMedia` (a helper for the content-media tests).

### 48. Admin browser results

`npm run test:admin` (Playwright, one worker, `server.js` on a throwaway database and a temporary `RAWASY_DATA_DIR`) on
the fresh clone: **82 / 82 passed** in 20.7 min (0 failed, flaky or skipped).

| Origin | Tests | Passed | Files |
|---|---|---|---|
| A2 inherited | 47 | 47 | `admin.spec.ts` 38, `gate.spec.ts` 9 — names unchanged |
| A3 inherited | 17 | 17 | `cms.spec.ts` — 16 unchanged names, 1 renamed (below) |
| A4 new | 18 | 18 | `media.spec.ts` |
| **Total** | **82** | **82** | |

Since `a1f562e`, `media.spec.ts`'s 320 px Owner sweep also opens the private original's media page and a public item's
page, with their download links shown (item 57). The test count is unchanged.

Inherited browser tests A4 changed:

- `admin.spec.ts` (A2), "the public site's locale proxy and pages are unchanged; /api stays outside the proxy …": the
  probe address `/api/admin/media/uploads/x` became `/api/admin/media/uploads/x/unknown`, because A4 put a real route at
  `/api/admin/media/uploads/{upload}`; an address no route answers is still a 404 with the static API headers. Name
  unchanged.
- `cms.spec.ts` (A3), the dashboard test: "nothing invented" still refuses views, leads and SEO scores on the whole page;
  "storage" is now refused in the content-counts section only, because A4's media card shows recorded storage sizes
  (checked against the database in `media.spec.ts`). Name unchanged.
- `cms.spec.ts` (A3), "certificate metadata only: the A4 note, no file input anywhere in the CMS, the digit guard" →
  "certificate metadata: the files note (A4), uploads only inside the media pickers, no publishing, the digit guard":
  the A3 placeholder note gave way to A4's ("Public and private files are kept apart."); "no file input" became "no
  visible file input, and every file input inside a picker dialog"; no upload, download or publish button on the
  editors, and the digit guard, exactly as before.
- `e2e-admin/server.mjs` and `helpers.ts`: a temporary `RAWASY_DATA_DIR` per run, removed at the end.

### 49. Public 612 / 612

`npm run test:e2e` (the public suite, byte-identical to `37a1e67`'s) on the fresh clone of `a1f562e`, against
`server.js`, after the image warm-up (`scripts/warm-images.mjs`: 1,484 / 1,484 sizes warmed, none failed or timed out, at
most 2 requests at once). The suite has no retries; every run below is reported as it ran.

- **Third full run: 612 / 612 passed** (25.7 min, a fresh server and warm-up). This is the requirement's run.
- **First full run: 611 / 612.** `commerce-home-depth.spec.ts` "marking the page as scrolling restyles only the two
  moving layers, not the page" stopped with `page.evaluate: Target crashed`.
  - Chromium's renderer process died in the test's first `page.evaluate`, right after `browser.startTracing`, before any
    assertion ran. No out-of-memory kill was logged.
  - That test alone, 20 times on each build (3 at a time): **20 / 20** on the final build, **20 / 20** on the baseline.
- **Second full run: 611 / 612.** `commerce-motion.spec.ts` "reduced motion › nothing moves on the way down any page or
  through its controls…" recorded, on `/en/contact`, a 180 ms `scale` transition on the quote form's submit button. This
  is real behaviour of the public site, and it is pre-existing:
  - pressed buttons shrink to 98 % (`.mc .btn:active { scale: 0.98 }`, with `scale` in `.mc .btn`'s transition list);
    the reduced-motion block stills the buttons' lift and arrow, but not this press;
  - the test sees it only when a frame is drawn between Playwright's mouse-down and mouse-up, which happens under load;
  - a probe that holds the mouse down for two frames with reduced motion finds the same 180 ms `scale` transition, and
    the same transition list, on `preserve/pre-admin-a4` and on `a1f562e` (the stylesheet is byte-identical, item 45);
  - 200 clicks per build with the CPU slowed 4×: the press transition started once on the baseline and never on the final
    build, so the race exists on both;
  - that test alone, 20 times on each build: 19 / 20 on the final build (the same `/en/contact` press), 20 / 20 on the
    baseline.

  A4 does not change the public site, so this stays as it is. The fix (no press `scale` with reduced motion) is offered
  for the Owner's decision (item 58).
- **The round on `66de7be`** (the same public code): 611 / 612, then 612 / 612. The one failure was the gallery's
  view-transition abort ("Transition was aborted because of timeout in DOM update"), which the project memory records
  since A2 Correction 1. That test alone gave 38 / 40 on both builds.

### 50. Lint

`npm run lint` (ESLint with the project's import boundaries: public code never imports `src/server/**`, admin client
components import Server Actions only, no Drizzle relational API, drizzle-kit only in its config) on the fresh clone:
**0 problems**, exit 0.

### 51. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`) on the fresh clone: **0 errors**, exit 0.

### 52. Build

`npm run build` on the fresh clone with no database or admin settings in the environment: Next.js 16.3.8 (Turbopack),
compiled successfully, **145 / 145 static pages** generated, exit 0, **no warning**. The A4 routes are dynamic
(`ƒ /media/u/[id]/[name]`, the six `/api/admin/media/**` and `/api/admin/files/[id]` handlers, the admin pages); the
public pages are prerendered exactly as before (item 45). The build needs no database (`BuildPhaseDatabaseError` guards
it) and no `RAWASY_DATA_DIR` (the storage root is read only when media is uploaded or served).

The round on `a50a96c` built with two Turbopack warnings, new in A4 ("Dynamic filesystem access causes tracing of the
whole project", for `MediaStore.areaRoot` and the release-file check in `presence.ts`): the `/media/u` route's and the
admin media routes' file traces listed the whole project, 357 source files and all of `public/`. `66de7be` marks
those two run-time paths `turbopackIgnore`; the final build has no warning, and those traces list the media code's own
folder and `public/` (which the presence check reads). The deployment package never reads traces: the packaging script
built and checked its archive on the final build (3,408 entries, every check passed, the 13 held-back files left out).

### 53. db:check

`npm run db:check` on the fresh clone, exit 0: `drizzle-kit check` "Everything's fine"; "Migration files OK: 5
(0000_access_control, 0001_seed_access_control, 0002_core_cms, 0003_seed_core_cms, 0004_media_library)"; "Seed
migrations match the registries".

### 54. npm audit --omit=dev

`npm audit --omit=dev` on the fresh clone (after `npm ci`: 403 packages added, 404 audited): **found 0 vulnerabilities**.

### 55. Full audit

`npm audit` exits 1 with **9 vulnerabilities (4 moderate, 5 high)**, the same list as A3's (item 36 of the A3
report). All are in development-only tools:

- the lint chain `braces` ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ← `eslint-config-next` (5 high; the
  only offered fix is a breaking downgrade to `eslint-config-next@14.2.35`);
- `esbuild` ← `@esbuild-kit/*` ← `drizzle-kit` (4 moderate), the advisory the Owner accepted in A2.

`npm audit fix` and `npm audit fix --force` were not run (brief §89). A4's one dependency, `sharp` 0.35.5, adds none.

### 56. Evidence ZIP

`rawasy-a4-final-evidence.zip` is not committed. It is in the session scratchpad:
`/tmp/claude-0/-home-user-Rawasy-Metal-Website/34883015-4850-5415-b502-fd42eee69ac3/scratchpad/a4/rawasy-a4-final-evidence.zip`
(47.2 MB, 151 files, SHA-256 `3933eb5f52f27b56c1558998cd74e4acc0cbbbef0d9f23b8012fd479edee0c79`).

- **How it was captured.** From the fresh clone of `a1f562e`, after its QA: the production build on `server.js`
  (`APP_ENV=local`), a throwaway local database and a throwaway `RAWASY_DATA_DIR`, both removed afterwards. Today's
  release media were registered with the real importer, and one test account per role was seeded.
- **What it holds.**
  - 133 captures of 37 screens, each in up to five variants: desktop 1280 × 800 light and dark, phone 390 × 844 light
    and dark, and a narrow phone 320 × 640 (light) for the representative screens.
  - 14 contact sheets (7 desktop, 7 phone).
  - `INDEX.md`: §91's list mapped to screen ids, and every screen with its variants.
  - `shots.json`: window and page sizes, and overflow, for every capture.
- **§91's screens.**
  - The dashboard and the library: grid, list, filters, the approved release baseline, the blocking-flagged items.
  - Folders.
  - Upload: the upload card, its progress, the item pending review.
  - Details: metadata in English and Arabic (with a decorative Arabic alt) and the focal point.
  - Rights and flags.
  - Approval (the dialog, the approved item) and restriction (the dialog, the restricted item).
  - Versions and replacement, including a restore.
  - Used by.
  - The Trash: an item in it, and the Trash view.
  - The project photo picker and the ordered photos.
  - The client logo picker and the logo slots.
  - The certificate's redacted preview: the picker, the editor, the media section.
  - The private document's metadata, with no picture: its section and its page.
  - Permission refusals: a Reviewer on an item and on the folders; an Admin opening a private original gets "not found".
- **What it shows.**
  - Synthetic uploads only: generated pictures labelled "Synthetic test …", one-page PDFs that say they are test
    documents, and seeded test accounts with made-up names at `example.test`.
  - Approved release photos, in the library's approved-baseline view.
  - The pickers are searched for "Test", so they list the synthetic uploads only. The certificate picker's search also
    shows that the private original, whose name matches, is never offered.
  - Blocking-flagged and held-back items show only their names, on a "Hidden" card.
- **What it does not show:** private real documents, registration numbers, QR codes, personal IDs, or held-back
  engraving or project imagery. Every sheet was checked by eye.

The first capture of this round left two pickers unsearched: the certificate preview picker and the client logo picker.
They listed today's release files, among them a client's monochrome logo still pending review. §91 allows approved
release thumbnails only, so the capture script now searches those pickers too, and the evidence was captured again. The
product did not change.

### 57. Overflow result

**0 page-level horizontal overflow** in all 133 captures of the final evidence: the document is as wide as the window at
every size (`shots.json`).

The first full capture, on `66de7be`, found one page wider than the window.
- **The page.** The private original's media page, for the Owner, at 320 px: 338 px wide.
- **The cause.** "Download the private original" (286 px) never wraps (`.adm-btn` is `nowrap`), so it widened its
  block's grid track.
- **The fix (`a1f562e`).** The original file's buttons wrap and centre (`.adm-original .adm-btn`), as the pickers'
  buttons have since `3a7bbc1`.
- **The test.** `media.spec.ts`'s 320 px Owner sweep now also opens the private original's page and a public item's
  page, with their download links shown. Negative control: without the rule, that test fails with 18 px of overflow.

The admin browser suite also checks 390 px light and dark, and 320 px, for the library, an item, the folders, the picker
and every content editor with media fields (item 48).

### 58. Known limitations

- **Immutable public addresses can't be recalled from caches outside the server.** `/media/u/…` answers carry a year of
  immutable caching (the brief's requirement); after a withdrawal the server answers 404 at once, but a browser or CDN that
  already holds the file may keep showing it. The optimizer no longer adds a server-side copy (M1).
- **No purge.** Old versions, trashed items and orphan files are kept and reported; deletion waits for A8's backup gate.
- **Release items keep their release files.** They have no versions and no generated sizes until A9 moves them into the
  persistent store; a release file replaced in a new build is refreshed only with `--refresh=<key>`.
- **Usage of release media** by today's static pages is recorded only as the importer's status; "Used by" lists
  references from the A3 working copies (A9 links the rest).
- **Processing is synchronous** inside the completion request (one image at a time per process); a 40 MP image takes a
  few seconds. No background queue (no daemons on the host).
- **SVG** is not accepted (no sanitizer in A4); the three brand SVGs stay release files.
- **The maintenance tool runs by hand**; nothing reminds anyone to run it (cron is pre-staging).
- **Two saves of related content items** can still deadlock once and be retried (A3's accepted behaviour; the relation-row
  diff is recorded for A8, brief §88).
- **The optimizer's list is kept by hand.** `images.localPatterns` (`next.config.ts`) names the release's picture folders;
  a new folder of public pictures must be added there, or `/_next/image` refuses it (400). Every address today's pages
  use answers exactly as before (item 45).
- **The focal point is recorded, not yet used:** nothing crops by it until A5.
- **libvips settings are process-wide.** Once the admin processes an image, sharp's one-thread, no-cache settings also
  apply to Next's image optimizer in that process. Today that happens only locally or in staging; production keeps the
  admin off, so the optimizer there is never touched.
- **The media routes' file traces list `public/`** (the release files the presence check reads at run time). The
  deployment package is built by `scripts/package-namecheap.mjs`, which does not read traces.
- **Pre-existing public-suite races under load.** Chromium can stop a test before it asserts anything:
  - it can abandon the gallery's view transition in `commerce-transitions.spec.ts` (38 / 40 in isolation on both the
    final build and the baseline);
  - its renderer can crash while `commerce-home-depth.spec.ts` traces the page (20 / 20 in isolation on both builds).

  Item 49 has the runs.
- **A pre-existing reduced-motion gap on the public site, open for the Owner.** With reduced motion, pressed buttons
  still shrink to 98 % over 180 ms (item 49).
  - It is not A4's: the stylesheet is byte-identical to `preserve/pre-admin-a4`.
  - The public suite catches it now and then under load.
  - A4 must not change the public site. The fix is the Owner's decision: `scale: none` for a pressed `.btn` in the
    reduced-motion block, or no `scale` in its transition list there.

### 59. Pre-staging checks

Never guessed, all pending until the hosting account is inspected (brief §93; A1-ARCHITECTURE §7.3): the real
`RAWASY_DATA_DIR` path (outside `public_html` and the app folder, on the account's persistent disk); filesystem quotas
and inodes (300,000 on Stellar Plus); the app's process count; the real upload and body limits (LiteSpeed / Passenger,
ModSecurity behaviour with 4 MiB parts and PUT); glibc ≥ 2.28 and sharp's prebuilt binaries on the account; MariaDB
account limits (`max_user_connections`, `wait_timeout`, packet size); cron (the maintenance tool, at most every 5 minutes);
the backup location and an off-site backup of the database **and** `RAWASY_DATA_DIR` together.

### 60. Items deferred to A5

Crops and art direction from the focal point; section-level media in the page builder (A5's structure-locked blocks);
media in rich text; the editor's live preview of chosen media.

### 61. Items deferred to A8

Publication of content that names media (publication refuses non-deliverable media); revisions in use; the audit-log
viewer (it must hide private items' events from non-Owners — I2); permanent purge of old versions, trashed items and
orphans behind the backup/restore gate; backups of `RAWASY_DATA_DIR`; the relation-row diff (brief §88, recorded as an
A8 / pre-production hardening candidate).

### 62. Items deferred to A9

Moving the 143 release files into the persistent store (with versions and generated sizes), switching the public site to
`public_media` / `/media/u` addresses after a parity proof, retiring `public/media` and the image warm-up's role for them,
linking release media to imported content, and the cutover of `CONTENT_SOURCE`.

### 63. main unchanged

`main` is at `474f61f10f12981e41f9b7e7fd6065a0ec9da541` on GitHub (read after the final code push), as it was before A4 (A4 never checked it out, merged
into it or pushed to it). Every A4 commit is on `claude/new-session-5eijs6` only.

### 64. Preservation refs unchanged

All 20 `preserve/*` branches on GitHub are at the commits the project memory records (read with `git ls-remote` after
the final code push, `a1f562e`): `pre-tm1-a-v2-migration` `3260415`, `pre-tm2` `5cfeaed`, `pre-tm2.2` `e5a3834`, `pre-tm2.3`
`2026047`, `pre-tm2.4` `4b28ad2`, `pre-tm2.5` `304a277`, `pre-tm2.6` `9c7d2af`, `pre-tm3` `de62bc5`, `pre-stage-1e`
`ca672d7`, `pre-stage-1f` `c2aed58`, `pre-stage-1i` `b1f4fe1`, `pre-stage-1j` `f69e2fa`, `pre-namecheap-adapter`
`422c397`, `pre-admin-a1` `74220ea`, `pre-admin-a2` `ed6b652`, `pre-admin-a2-correction1` `b47d8e5`,
`pre-admin-a2-correction2` `bca33aa`, `pre-admin-a3` `dcd089d`, `pre-admin-a3-correction1` `a7e6637` and
`pre-admin-a4` `37a1e67`. None was moved, deleted or recreated.

### 65. No deployment

Nothing was deployed or uploaded; no Namecheap resource, cPanel setting, DNS, SSL or email was touched; no production or
staging database was connected to and no production credential was asked for; no production media folder was created;
the production admin stays off (`ADMIN_ENABLED` unset); `public/media` is intact and no public page was switched to A4
media.
