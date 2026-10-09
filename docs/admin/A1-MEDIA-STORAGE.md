# A1 — Media library and storage

**Status:** Phase A1 specification. **Design only — nothing in this document is implemented.** A3 creates the media
registry of today's files (read-only picker and the restriction rules); A4 builds the library: uploads, versions,
variants, folders, replacement, private documents.

Related: [A1-ARCHITECTURE](A1-ARCHITECTURE.md) · [A1-DATABASE-SCHEMA](A1-DATABASE-SCHEMA.md) (media tables) ·
[A1-CONTENT-MODEL](A1-CONTENT-MODEL.md) · [A1-SECURITY-RBAC](A1-SECURITY-RBAC.md) · [A1-MIGRATION-PLAN](A1-MIGRATION-PLAN.md).

---

## 1. Today

- 143 media files in `public/media/{certificates,clients,machines,projects,services,site}` (3.4 MB, all WebP), listed
  with their sizes and blur placeholders in the generated `src/content/media.generated.ts` (`mediaRegistry`, keyed by
  ids such as `projects/tulip-roundabout-1`). Plus `public/brand` (3 SVG logos) and `public/og` (2 share images).
- Pages show them through `next/image` → `/_next/image` (Next's optimizer, qualities 75 and 85; cache in
  `.next/cache/images`; the known 16.3.8 cold-cancellation defect is mitigated by `scripts/warm-images.mjs`).
- **13 files are held back** from every deployment archive by `scripts/package-namecheap.mjs`: 10 project photos (the
  three AI-watermarked files in `withheldMedia`, and every photo of the five projects whose flags hold all photos back)
  and the three Laser Engraving images (`services/engraving-nameplates`, `engraving-wood`, `engraving-rotary`, asset
  inventory item 12). On the server their addresses answer 404.
- Certificate files are already **redacted** copies; no original (with numbers, QR codes or names) is in the
  repository.

## 2. Requirements (from the A1 brief)

Folders, uploads, replacement, metadata, search, alt text in English and Arabic, caption, dimensions, size, MIME type,
focal point, usage tracking, delete protection, rights and approval status, restricted and private items, originals and
derivatives, variants, audit; **stable media ids (never file names) in content**; storage that survives releases;
private originals never reachable at a public address.

## 3. Identity

| Concept | Where | Notes |
|---|---|---|
| Media item | `media_assets.id` (ULID) | what content refers to; never changes |
| Legacy id | `media_assets.legacy_key` | today's `MediaId` (e.g. `projects/clock-tower-1`), kept for migration and for today's addresses |
| File version | `media_files` (`version` 1, 2 …) | each upload of a binary; replacing a file adds a version, references stay valid |
| Variant | `media_variants` | derivatives generated once (WebP widths, thumbnail) |
| Metadata | `media_files`: storage key, original file name (display only), MIME type, extension, byte size, SHA-256, width, height, page count, blur placeholder, uploader, upload time, processing status | MIME type from the file's bytes |
| Editorial | `media_assets`: kind, folder, focal point, rights holder and note, licence expiry, provenance; `media_translations`: alt text, caption, title per language | alt text `''` = decorative |

## 4. Status, rights and the deliverability rule

| Field | Values | Meaning |
|---|---|---|
| `visibility` | `public` · `private` | delivery class. **Private items are never deliverable publicly** — whatever else changes; they live in a separate storage area |
| `usage_status` | `pending_review` (default for uploads) · `approved` · `restricted` · `internal` · `archived` | editorial approval for public use |
| `media_flags` | `rights_pending`, `authorship_unconfirmed`, `ai_watermark`, `ai_generated`, `ai_edited`, `product_render`, `third_party_branding`, `contains_identifiers`, `contains_personal_data`, `low_resolution` … | why an item may not (yet) be shown |

Flag policy is code (`FLAG_POLICY`): every flag is **blocking** except the informative ones (`low_resolution`, and
`ai_edited` only if the Owner decides so); **an unknown flag blocks**. Anyone with `media.edit` (and reviewers) may add a
flag or restrict an item — making something safer is never gated. Approving an item or removing a blocking flag needs
`media.approve` (Owner/Admin), a note, and is audited.

**Deliverability rule** — an item is publicly deliverable only if **all** hold: `visibility = 'public'`,
`usage_status = 'approved'`, no blocking flag, not in the Trash, current file `ready`. The `public_media` table holds a
row exactly for the deliverable items and is rebuilt in the same transaction as any change to these inputs.

**Three independent safeguards** (an editor selecting a restricted item is never enough to publish it):
1. **Publication gate:** strict validation refuses to submit or publish an aggregate that shows a non-deliverable item
   in a displayed slot ([A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) §4.2).
2. **Projection filter:** the public projection and the renderer resolve media only through `public_media`; an item
   that stops being deliverable after publication disappears from every page at the next render (cache tag `media`).
3. **Delivery check:** the media route (§8) serves a file only if `public_media` has the item; private files are never
   under the public route's root at all.

## 5. Storage layout (persistent, outside every release)

A release (the app folder Passenger/LiteSpeed runs) is replaced on every deploy; uploads must survive it. Next.js 16.3.8
also reads `public/` **only at start-up** (verified in `server/lib/router-utils/filesystem.js`), so uploads could never
be served from `public/` anyway. Root: the `RAWASY_DATA_DIR` environment variable, e.g.
`/home/<cpanel-user>/rawasy-data` — outside the app root and outside `public_html`, never web-served directly.

```
$RAWASY_DATA_DIR/
├── media/
│   ├── originals/YYYY/MM/<file-ulid>.<ext>      public-class items: the verified original as received (never served publicly)
│   ├── derived/<media-ulid>/<variant>-<hash8>.<ext>  generated variants (served publicly only when deliverable)
│   └── private/<media-ulid>/<file-ulid>.<ext>   private-class items (certificate originals) and their previews — separate root
├── enquiries/YYYY/MM/<file-ulid>.<ext>          A7, only if file uploads are enabled (private)
├── tmp/uploads/<upload-ulid>/part-<n>           upload staging (chunked), deleted after completion or 24 h
└── backups/{db,media}/…                         rotated, shipped off the account (A1-ARCHITECTURE §11)
```

- Directories `0700`, files `0600` (the app's own user); nothing world-readable.
- Keys are generated by the server from ULIDs and a content hash; **user-supplied names never form a path**.
- Every path is resolved and checked to start with its area's root (`realpath`) before use (defence in depth against
  traversal even though keys are validated by pattern).
- Each environment (local, staging, production) has its own `RAWASY_DATA_DIR`.
- Release-bundled files (today's `public/media`) are registered as `storage_area = 'release'` in A3, unchanged and
  still served by Next as static files (§12).

## 6. Upload pipeline (A4)

1. **Endpoint:** a Route Handler under `/api/admin/media/uploads` — outside the `src/proxy.ts` matcher (the proxy buffers
   and truncates non-GET bodies above `proxyClientMaxBodySize`, 10 MB by default), not a Server Action (1 MB default
   limit; `formData()` buffers the whole body in memory: a 40 MB multipart upload measured +120 MB of buffers on Node 22).
2. **Authorization:** admin session, `media.upload`, exact `Origin` check and `Sec-Fetch-Site: same-origin`, rate limit
   (proposed 60 uploads per user per hour).
3. **Chunked, streamed upload:** the browser sends the file in chunks of **4 MB** (`PUT …/uploads/{id}/parts/{n}`), each
   streamed to `tmp/` with a running byte cap; `POST …/complete` assembles. This stays under the web server's request
   limit (Namecheap does not publish it; a ModSecurity default rejects bodies above 12.5 MiB) and keeps memory flat.
   Declared size checked before reading; the session's quota checked.
4. **Verification:** extension in the allowlist **and** magic-byte signature agreeing with it; size limits (proposed:
   images ≤ 20 MB and ≤ 40 megapixels; PDF ≤ 20 MB); SHA-256 computed (duplicates detected and offered for reuse).
5. **Decode and normalize (images):** `sharp` with `limitInputPixels` = 40 MP, EXIF orientation applied, one image at a
   time per process (`sharp.concurrency(1)`, cache off) — the account shares 2 GB of memory with everything else.
6. **Store:** move the verified original to `originals/` (public class) or `private/` (private class); create
   `media_assets` (`pending_review`), `media_files` (`processing`), translations (alt text required per language before
   approval).
7. **Variants (public-class images):** WebP at widths 320, 640, 1080, 1600 and 2048 (never wider than the source —
   the site never enlarges a photo), plus a 256 px admin thumbnail and a blur placeholder; metadata (EXIF, GPS) is not
   copied into variants. Names carry a content hash (`w1080-3f9a1c2b.webp`).
8. **Finish:** `media_files.processing_status = 'ready'`, audit event, the item appears in the library as **Pending
   review**. Nothing is public until approved (§4).
9. **Failures:** the item stays `failed` with the reason; temporary files are removed; a cleanup job removes
   abandoned uploads after 24 h.

If processing a large image in the request ever approaches the host's limits, step 7 moves to the 5-minute cron job
(`processing` → `ready`) without changing the model.

## 7. Accepted types

| Type | Accepted | Public delivery | Notes |
|---|---|---|---|
| JPEG, PNG, WebP, AVIF | yes | variants only (re-encoded WebP) | the re-encode neutralizes polyglot files |
| PDF | yes (documents) | only when approved and public; `Content-Disposition: attachment`, `nosniff`, CSP `sandbox` | no automatic preview (the bundled `sharp` has no PDF renderer); a preview image is uploaded separately, as certificate previews are today |
| SVG | **no** (A4) | — | SVG can carry script; logos stay in code (`src/components/brand/Logo.tsx`) or are uploaded as PNG/WebP. A sanitizing pipeline would be a separate decision |
| GIF, HEIC/HEIF, TIFF, video files | no | — | video appears only as embeds (YouTube/Vimeo id) |
| DWG, DXF, STEP | only as enquiry attachments (A7, if enabled) | never public | private, attachment-only download |

## 8. Public delivery

- **Route:** `GET /media/u/{media-ulid}/{variant}-{hash}.{ext}` (a Route Handler; `/media/` is already outside the proxy
  matcher). It validates the path pattern, looks up `public_media` (a per-process cache that follows the pages'
  fail-closed rule: used only after this request's read of the shared invalidation state succeeds, otherwise read from
  the database; if the database is unreachable the route answers 503 — never a possibly withdrawn file,
  [A1-PUBLISHING-VERSIONS](A1-PUBLISHING-VERSIONS.md) §8.2), maps to `derived/…`, verifies the resolved path, streams
  the file.
- **Headers:** exact `Content-Type`; `X-Content-Type-Options: nosniff`; `Cache-Control: public, max-age=31536000,
  immutable` (names are content-hashed, so a replacement is a new address); `ETag`; `Content-Disposition: inline` for
  images, `attachment` for PDFs; no cookies read.
- **In pages:** `next/image` with a per-image `loader` that maps each requested width to the nearest variant — no
  optimizer work at runtime for uploads, no warm-up needed for them, and a withdrawn item answers 404 at once.
  `images.localPatterns` (A4) restricts `/_next/image` to `/media/**` sources, and private items are never passed to
  it (the optimizer fetches through an internal request without cookies and caches the result for everyone).
- **Withdrawal:** restricting an item removes it from every page at the next render and makes `/media/u/…` answer
  404 immediately. Copies already in a visitor's browser cache cannot be recalled (true of any website).

## 9. Private delivery (admin only)

- Route: `GET /api/admin/files/{media-ulid}` (original or a named version) — admin session, the right permission
  (`private_documents.view` for private items, `media.view_original` for public-class originals), step-up
  re-authentication within 10 minutes for private documents, audit event per view/download.
- Headers: `Cache-Control: private, no-store`; `Content-Disposition: attachment; filename*=UTF-8''…` (sanitized
  original name); `nosniff`; CSP `sandbox`.
- Private files are read only from `private/` — a separate root the public route never touches.

## 10. Certificates: private original vs public redacted version

| | Private original | Public redacted version |
|---|---|---|
| What | the registration / licence as issued (numbers, QR code, names) | a copy with those removed (by a person, outside the CMS) |
| Media item | `visibility = 'private'`, `usage_status = 'internal'` | `visibility = 'public'`, approved |
| Link | `certificate_documents.role = 'private_original'` | `role = 'public_preview'` (per language) + `certificates.thumb_media_id` |
| Who | upload: Owner (Admin if the Owner decides); view/download: `private_documents.view` (Owner) with step-up | editors with `media.upload`; approval `media.approve`; publication `certificates.publish` (Owner) |
| Public? | **never**: visibility of an item linked as `private_original` cannot be changed; no projection includes it; stored under `private/` | after approval and publication of the certificate |

The CMS never derives a public file from a private original automatically. Hard-to-make mistakes by design: separate
upload buttons ("Upload private original" / "Upload redacted preview"), different badges, a confirmation stating the
file will never be public, the digit guard on every public certificate text, and no "make public" action for private
items at all (to publish a redacted version, upload it as a new item).

## 11. Replacement, deletion, usage

- **Replace** (keeps the id): upload a new version → new variants with new hashed names → `current_file_id` switches in
  the same transaction as `public_media` → `media` tag invalidated. The previous version stays (restorable) for 30 days,
  then is purged (proposed). Replacing an approved item puts the new version through approval again unless the
  approver replaces it (Owner decision; proposed: replacement by an Editor returns the item to `pending_review`, which
  withdraws it from the site — so editors cannot swap a public photo silently).
- **Usage:** `content_references` (working and published scopes) plus the media foreign keys answer "used in: Homepage
  hero (live) · Project 'Clock Tower Landmark' (draft) …" on every item.
- **Delete:** Trash first (soft delete; the item stops being deliverable at once); **purge** (Owner) only when no
  reference exists in either scope, then the files are deleted by the cleanup job. Backups keep deleted files for their
  own retention period (§13).
- **Search and filters:** title, alt text and caption (both languages, Arabic normalized), original file name, folder,
  status, flags, kind, dimensions, size, uploader, date; "unused", "pending review", "restricted", "missing alt text".

## 12. Today's files and the 13 held-back media

- **A3** registers the 143 release files (`storage_area = 'release'`, `storage_key = '/media/…'`, `legacy_key` = today's
  id, width, height and blur placeholder from `mediaRegistry`, alt texts from today's content) — **no address or pixel
  changes**; pages keep `/_next/image?url=/media/…` exactly as now.
- The **13 held-back items** are registered **restricted** with their reasons as flags — `ai_watermark` (3 files:
  `wheat-monument-1`, `stainless-landmark-1`, `billboard-structure-1`), `authorship_unconfirmed` (3 files of 3 projects:
  `canopy-tree-1`, `lattice-cubes-1`, `seed-sculpture-1`), `product_render` (4 files of 2 projects: `laser-cut-bench-1`,
  `litter-bins-1…3`), and `third_party_branding` / `rights_pending` for the three Laser Engraving images (asset inventory
  item 12) — with `source_note`s explaining why. They
  can never be in a published projection, never get a `public_media` row, and `scripts/package-namecheap.mjs` keeps
  excluding them from every archive. They are never public during or after migration unless RAWASY approves them and an
  Owner/Admin clears the flags (audited).
- **Relocation at the A9 cutover** (proposed, Owner approval, T7; T1 = Option B moved it from A4, A1 Correction 1): A4
  builds and tests, in local and staging, the copy of the release files into the persistent store and a Route Handler
  that serves their **same addresses** (`/media/{group}/{name}.webp`) after checking `public_media` by `legacy_key`; the
  first database-mode release (A9) then stops carrying `public/media`. Same URLs and bytes (no visual or HTML change),
  and a restriction then takes the file's address offline at once instead of waiting for a release.
- **Before the A9 cutover** the production site is the static release: a restriction set in the admin acts in preview
  and staging only, and production keeps today's held-back list (the packaging script's 13 files). **If the relocation
  is not adopted**, after the cutover restricting a release-bundled file removes it from every page at once, but its
  direct file address stays reachable until the next release excludes it, and optimized copies at `/_next/image`
  addresses can stay in the optimizer cache for up to 4 hours (`minimumCacheTTL` 14,400 s); an emergency "clear image
  cache" action (Owner) can empty `.next/cache/images`.
- **A9** (proposed, Owner decision, needs a pixel-parity proof): serve every image from pre-generated variants and stop
  using the runtime optimizer — no image CPU load on the shared host, no cold-cancellation defect, no image warm-up.

## 13. Backups of media

Database dumps hold every row; files are backed up as **originals + private + enquiry files** (variants are derivable
and are regenerated by a CLI from the originals). Nightly incremental archive (GNU tar `--listed-incremental`), weekly
full, retention per [A1-ARCHITECTURE](A1-ARCHITECTURE.md) §11, copies kept off the account. Restoring media restores
files and then runs "regenerate variants" and "rebuild `public_media`".

## 14. Cleanup jobs (cron, every hour; A4)

- Remove `tmp/uploads` older than 24 h.
- Retry or fail stuck `processing` files.
- Purge replaced versions after their retention.
- Report (never auto-delete) files on disk without a database row and rows whose file is missing — shown on the
  dashboard for the Owner.

## 15. Hosting constraints that shape media

| Constraint (Namecheap Stellar Plus, see A1-ARCHITECTURE §7) | Consequence |
|---|---|
| 2 GB memory for the whole account (app, cron, SSH) | stream uploads; one `sharp` job at a time; pixel limit |
| request-body limit not published; ModSecurity default 12.5 MiB | 4 MB chunks |
| 300,000 inodes | 5 widths + thumbnail per image (≈ 7 files per item: 2,000 photos ≈ 14,000 inodes) |
| 10 GB fair-use cap on multimedia files (reported) | optional downscale of originals above 4,096 px long edge (Owner decision); off-site backups |
| glibc 2.28 on the server = `sharp` 0.35.5's minimum | pin `sharp` and Next; check glibc before any upgrade |
| no long-running daemons; cron every ≥ 5 minutes | no background worker; processing in the upload request or in the cron job |
