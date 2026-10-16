/**
 * The media library's screens (A4 brief §36–§48, §57, §63): the library (grid or list, search, filters and pagination
 * in the address), one item's page (overview, both languages, rights and safety, versions, used by, storage), and the
 * folders. Server components: each checks the session again (`requireActor`) and reads with the acting user's
 * permissions — a private item does not exist for anyone without private access; the Server Actions and Route Handlers
 * check every change and download again. Never a server path or storage key on screen.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StepUpForm } from "@/components/admin/StepUp";
import { FolderManager } from "@/components/admin/media/FolderManager";
import { LibraryUpload } from "@/components/admin/media/LibraryUpload";
import { MediaBadges, MediaThumb } from "@/components/admin/media/MediaCard";
import { MediaFlagsPanel, MediaMetadataForm, MediaStatusActions, RevealPreview, VersionsPanel, type MetadataValues } from "@/components/admin/media/MediaDetailForms";
import { STATUS_BADGE, STATUS_TEXT, type UsageStatusName } from "@/server/admin/actions/media-model";
import { authDeps, guarded } from "@/server/admin/context";
import { hasRecentAuth, requireActor } from "@/server/admin/guards";
import { ENTITIES } from "@/server/cms/registry";
import { canSeePrivate, mayUploadPublic } from "@/server/media/access";
import { cardOf } from "@/server/media/cards";
import { folderOptions, loadMediaDetail } from "@/server/media/detail";
import { folderTree } from "@/server/media/folders";
import { libraryHref, listMedia, PAGE_SIZES, parseLibraryQuery, uploaders, type LibraryQuery } from "@/server/media/list";
import { MEDIA_FLAG_KEYS, MEDIA_FLAGS, USAGE_STATUS_LABELS } from "@/server/media/registry";
import { Forbidden, formatTime, PageHeader, RIYADH_NOTE } from "./parts";

export type SearchParams = Record<string, string | string[] | undefined>;

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** A byte count as people read it (1 KB = 1,024 bytes). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const AREA_LABELS = { release: "Release files (today's site build)", originals: "Uploaded originals (persistent storage)", private: "Private originals (separate private storage)" } as const;

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={`filter-${name}`}>
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={value} className="adm-input">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Library -------------------------------------------------------------------------------------------------------------

function LibraryFilters({
  query,
  seePrivate,
  folders,
  people,
}: {
  query: LibraryQuery;
  seePrivate: boolean;
  folders: { id: string; label: string }[];
  people: { id: string; name: string }[];
}) {
  return (
    <form className="adm-card" method="get" action="/admin/media" role="search" aria-label="Search and filter media">
      <div className="adm-filters">
        <div className="adm-field is-wide">
          <label className="adm-label" htmlFor="filter-q">
            Search media
          </label>
          <input id="filter-q" name="q" type="search" className="adm-input" defaultValue={query.q} maxLength={100} aria-describedby="filter-q-hint" />
          <p className="adm-hint" id="filter-q-hint">
            Titles, alt texts and captions in English or Arabic, file names, release keys, folder names, and flag or status names.
          </p>
        </div>
        <Select name="folder" label="Folder" value={query.folder} options={[["", "Any"], ["none", "No folder"], ...folders.map((f) => [f.id, f.label] as [string, string])]} />
        <Select
          name="kind"
          label="Kind"
          value={query.kind}
          options={[
            ["", "Any"],
            ["image", "Images"],
            ["document", "PDF documents"],
          ]}
        />
        {seePrivate ? (
          <Select
            name="visibility"
            label="Visibility"
            value={query.visibility}
            options={[
              ["", "Any"],
              ["public", "Public class"],
              ["private", "Private"],
            ]}
          />
        ) : null}
        <Select name="status" label="Status" value={query.status} options={[["", "Any"], ...(Object.entries(USAGE_STATUS_LABELS) as [string, string][])]} />
        <Select name="flag" label="Flags" value={query.flag} options={[["", "Any"], ["any", "Any flag"], ["blocking", "A blocking flag"], ...MEDIA_FLAG_KEYS.map((k) => [k, MEDIA_FLAGS[k].label] as [string, string])]} />
        <Select
          name="processing"
          label="Processing"
          value={query.processing}
          options={[
            ["", "Any"],
            ["failed", "Failed"],
            ["processing", "Still processing"],
          ]}
        />
        <Select name="uploader" label="Uploaded by" value={query.uploader} options={[["", "Anyone"], ...people.map((p) => [p.id, p.name] as [string, string])]} />
        <Select
          name="sort"
          label="Sort"
          value={query.sort}
          options={[
            ["newest", "Newest first"],
            ["oldest", "Oldest first"],
            ["name", "By name"],
            ["size", "Largest first"],
          ]}
        />
        <Select name="size" label="Per page" value={String(query.pageSize)} options={PAGE_SIZES.map((n) => [String(n), String(n)] as [string, string])} />
        <Select
          name="view"
          label="View"
          value={query.view}
          options={[
            ["grid", "Grid"],
            ["list", "List"],
          ]}
        />
        <label className="adm-check" htmlFor="filter-missing">
          <input type="checkbox" id="filter-missing" name="missing" value="alt" defaultChecked={query.missingAlt} />
          <span>Alt text not decided</span>
        </label>
        <label className="adm-check" htmlFor="filter-unused">
          <input type="checkbox" id="filter-unused" name="unused" value="1" defaultChecked={query.unused} />
          <span>Not used by any content</span>
        </label>
        <label className="adm-check" htmlFor="filter-trash">
          <input type="checkbox" id="filter-trash" name="trash" value="1" defaultChecked={query.trash} />
          <span>Show the Trash instead</span>
        </label>
      </div>
      <div className="adm-actions">
        <button type="submit" className="adm-btn is-primary">
          Apply
        </button>
        <Link className="adm-btn" href="/admin/media">
          Clear filters
        </Link>
      </div>
    </form>
  );
}

function LibraryPager({ query, total }: { query: LibraryQuery; total: number }) {
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="adm-pager" aria-label="Pages of results">
      <p className="adm-muted">
        Page {query.page} of {pages} ({total} in all)
      </p>
      <ul>
        <li>
          {query.page > 1 ? (
            <Link className="adm-btn is-small" href={libraryHref({ ...query, page: query.page - 1 })} rel="prev">
              Previous page
            </Link>
          ) : null}
        </li>
        <li>
          {query.page < pages ? (
            <Link className="adm-btn is-small" href={libraryHref({ ...query, page: query.page + 1 })} rel="next">
              Next page
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}

export async function MediaLibrary({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("media.view")) return <Forbidden />;
  const deps = authDeps();
  const query = parseLibraryQuery(searchParams);
  const seePrivate = canSeePrivate(actor.permissions);
  const [result, folders, people] = await guarded(() => Promise.all([listMedia(deps.db, actor.permissions, query), folderOptions(deps.db), uploaders(deps.db, actor.permissions)]));
  const filtered = libraryHref({ ...query, view: "grid", sort: "newest", pageSize: 24, page: 1 }) !== "/admin/media";
  return (
    <>
      <PageHeader
        title={query.trash ? "Media Trash" : "Media library"}
        lead="Uploads start as pending review. Nothing here changes the public website: today's site keeps its own files until the cutover (A9)."
        actions={
          <Link className="adm-btn" href="/admin/media/folders">
            Folders
          </Link>
        }
      />
      {mayUploadPublic(actor.permissions) && !query.trash ? (
        <section className="adm-card" aria-labelledby="upload-title">
          <h2 id="upload-title">Upload</h2>
          <LibraryUpload folderId={query.folder && query.folder !== "none" ? query.folder : undefined} />
        </section>
      ) : null}
      <LibraryFilters query={query} seePrivate={seePrivate} folders={folders} people={people} />
      <div className="adm-list-meta">
        <p role="status">
          {result.total === 0 ? "No items" : `${result.total} item${result.total === 1 ? "" : "s"}`}
          {filtered ? " match these filters" : ""}
          {query.trash ? " in the Trash" : ""}.
        </p>
      </div>
      {result.rows.length === 0 ? (
        <p className="adm-empty">{filtered ? "Nothing matches. Clear the filters or search for something else." : "The library is empty."}</p>
      ) : query.view === "grid" ? (
        <ul className="adm-media-grid" aria-label="Media items">
          {result.rows.map((row) => {
            const card = cardOf(row);
            return (
              <li key={row.id} className="adm-media-tile">
                <MediaThumb card={card} size="lg" />
                <div className="adm-media-tile-text">
                  <Link href={`/admin/media/${row.id}`} className="adm-media-tile-title">
                    {card.label}
                  </Link>
                  {card.labelAr ? (
                    <span lang="ar" dir="rtl" className="adm-muted">
                      {card.labelAr}
                    </span>
                  ) : null}
                  <span className="adm-hint">
                    {row.kind === "document" ? "PDF" : "Image"}
                    {row.width && row.height ? ` · ${row.width} × ${row.height}` : ""} · {formatBytes(row.byteSize)}
                  </span>
                  <MediaBadges card={card} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">Media items, page {query.page}</caption>
            <thead>
              <tr>
                <th scope="col">Preview</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Kind</th>
                <th scope="col">Dimensions</th>
                <th scope="col" className="is-num">
                  Size
                </th>
                <th scope="col">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const card = cardOf(row);
                return (
                  <tr key={row.id}>
                    <td data-label="Preview">
                      <MediaThumb card={card} size="sm" />
                    </td>
                    <th scope="row" className="adm-cell-title">
                      <Link href={`/admin/media/${row.id}`}>{card.label}</Link>
                      {card.labelAr ? (
                        <span lang="ar" dir="rtl" className="adm-muted">
                          {card.labelAr}
                        </span>
                      ) : null}
                      {row.folderName ? <span className="adm-slug">{row.folderName}</span> : null}
                    </th>
                    <td data-label="Status">
                      <MediaBadges card={card} />
                    </td>
                    <td data-label="Kind">{row.kind === "document" ? "PDF" : "Image"}</td>
                    <td data-label="Dimensions">{row.width && row.height ? `${row.width} × ${row.height}` : "—"}</td>
                    <td data-label="Size" className="is-num">
                      {formatBytes(row.byteSize)}
                    </td>
                    <td data-label="Uploaded">
                      {formatTime(row.createdAt)}
                      {row.uploader ? <span className="adm-muted"> by {row.uploader}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <LibraryPager query={query} total={result.total} />
      <p className="adm-hint">{RIYADH_NOTE}</p>
    </>
  );
}

// --- One item -------------------------------------------------------------------------------------------------------------

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif";

export async function MediaItem({ id, searchParams }: { id: string; searchParams: SearchParams }) {
  const { actor, mfa } = await requireActor();
  if (!actor.permissions.has("media.view")) return <Forbidden />;
  if (!ULID.test(id)) notFound();
  const deps = authDeps();
  const now = deps.clock();
  const [detail, folders] = await guarded(() => Promise.all([loadMediaDetail(deps.db, actor.permissions, id, now), folderOptions(deps.db)]));
  if (!detail) notFound();
  const tr = detail.translations;
  const label = tr.en.title || tr.ar.title || detail.legacyKey || detail.current?.filename || "(untitled)";
  const status = detail.status as UsageStatusName;
  const blocked = detail.flags.some((f) => f.blocking);
  const isImage = detail.kind === "image";
  const current = detail.current;
  const preview = isImage && detail.visibility === "public" && current?.status === "ready" ? `/api/admin/media/${id}/preview/large?file=${current.id}` : null;
  const altMode = (alt: string | null) => (alt === null ? "undecided" : alt === "" ? "decorative" : "text") as "undecided" | "decorative" | "text";
  const initial: MetadataValues = {
    en: { title: tr.en.title ?? "", altMode: altMode(tr.en.alt), alt: tr.en.alt ?? "", caption: tr.en.caption ?? "" },
    ar: { title: tr.ar.title ?? "", altMode: altMode(tr.ar.alt), alt: tr.ar.alt ?? "", caption: tr.ar.caption ?? "" },
    folderId: detail.folderId ?? "",
    focalX: detail.focal ? String(detail.focal.x) : "",
    focalY: detail.focal ? String(detail.focal.y) : "",
    rightsHolder: detail.rightsHolder ?? "",
    rightsNote: detail.rightsNote ?? "",
    sourceNote: detail.sourceNote ?? "",
    licenceExpiresOn: detail.licenceExpiresOn ?? "",
  };
  const isPrivate = detail.visibility === "private";
  const recent = hasRecentAuth(actor, deps);
  const canDownload = detail.can.view_original && (!isPrivate || recent);
  const notice = searchParams.saved ? "Saved the details." : searchParams.uploaded ? `Uploaded. The item is ${STATUS_TEXT[status].toLowerCase()}: nothing is public until it is approved and published.` : null;
  const sections: { id: string; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "english", label: "English" },
    { id: "arabic", label: "العربية" },
    { id: "rights", label: "Rights & safety" },
    { id: "versions", label: "Versions" },
    { id: "used-by", label: "Used by" },
    { id: "storage", label: "Storage" },
  ];
  const fact = (term: string, value: ReactNode) => (
    <>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </>
  );
  return (
    <>
      <PageHeader
        title={label}
        crumbs={[{ label: "Media library", href: "/admin/media" }, { label }]}
        lead={
          <span className="adm-badges">
            {isPrivate ? <span className="adm-badge is-info">Private — never publishable</span> : null}
            <span className={`adm-badge ${STATUS_BADGE[status]}`.trim()}>{STATUS_TEXT[status]}</span>
            {detail.deleted ? <span className="adm-badge is-danger">In the Trash</span> : null}
            {blocked ? <span className="adm-badge is-danger">Blocking flag</span> : null}
          </span>
        }
      />
      {notice ? (
        <div className="adm-alert is-success" role="status">
          <p>{notice}</p>
        </div>
      ) : null}
      {isPrivate ? (
        <div className="adm-alert is-warning" role="note">
          <p>
            <strong>This file can never be published.</strong> It is a private original: it has no public address, no public preview or variant, and it can never be chosen
            for public content. A redacted public copy is always uploaded separately.
          </p>
        </div>
      ) : null}
      {detail.deleted ? (
        <div className="adm-alert is-info" role="note">
          <p>This item is in the Trash (since {formatTime(detail.deletedAt)}). It is read-only and never delivered until it is restored.</p>
        </div>
      ) : null}
      <nav className="adm-editor-nav" aria-label="Sections of this page">
        <ul>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} lang={s.id === "arabic" ? "ar" : undefined}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className="adm-card" id="overview" aria-labelledby="overview-title">
        <h2 id="overview-title">Overview</h2>
        <div className="adm-media-overview">
          <div className="adm-media-preview-box">
            {preview ? (
              // Keyed on the flag state: a blocking flag added on this page hides the preview again at once.
              <RevealPreview key={blocked ? "blocked" : "clear"} src={preview} label={label} blocked={blocked} width={current?.width ?? null} height={current?.height ?? null} />
            ) : (
              <span className="adm-media-thumb is-lg is-doc" aria-hidden="true">
                {detail.kind === "document" ? "PDF" : isPrivate ? "Private" : "No preview"}
              </span>
            )}
          </div>
          <dl className="adm-dl">
            {fact("Kind", detail.kind === "document" ? "PDF document" : "Image")}
            {fact("Visibility", isPrivate ? "Private (owner only; never publishable)" : "Public class (deliverable only once approved)")}
            {fact("Status", STATUS_TEXT[status])}
            {fact(
              "Deliverable now",
              detail.deliverable ? (
                "Yes (through the uploaded-media route; today's site still uses its own files)"
              ) : (
                <>
                  No
                  {detail.reasons.length ? <span className="adm-muted"> — {detail.reasons.join("; ")}</span> : null}
                </>
              ),
            )}
            {detail.publicSrc ? fact("Public address", <span className="adm-mono">{detail.publicSrc}</span>) : null}
            {fact("Folder", detail.folderPath ?? "No folder")}
            {isImage ? fact("Focal point", detail.focal ? `${Math.round(detail.focal.x * 100)}% from the left, ${Math.round(detail.focal.y * 100)}% from the top` : "Not set") : null}
            {current ? fact("Current version", `Version ${current.version}${current.width && current.height ? ` · ${current.width} × ${current.height}` : ""} · ${formatBytes(current.byteSize)}`) : fact("Current version", "None yet")}
            {detail.approval ? fact("Approved", `${formatTime(detail.approval.at)}${detail.approval.by ? ` by ${detail.approval.by}` : ""}${detail.approval.note ? ` — ${detail.approval.note}` : ""}`) : null}
            {detail.restriction ? fact("Restricted", `${formatTime(detail.restriction.at)}${detail.restriction.by ? ` by ${detail.restriction.by}` : ""}${detail.restriction.reason ? ` — ${detail.restriction.reason}` : ""}`) : null}
            {fact("Uploaded", `${formatTime(detail.created.at)}${detail.created.by ? ` by ${detail.created.by}` : ""}`)}
            {fact("Last changed", `${formatTime(detail.updated.at)}${detail.updated.by ? ` by ${detail.updated.by}` : ""}`)}
          </dl>
        </div>
        <h3>Status</h3>
        <MediaStatusActions id={id} version={detail.lockVersion} status={status} visibility={detail.visibility} deleted={detail.deleted} can={detail.can} />
        {detail.can.view_original ? (
          <div className="adm-subset">
            <h3>Original file</h3>
            {isPrivate && !recent ? (
              <StepUpForm mfa={mfa.enrolled} reason="Downloading a private original needs a fresh confirmation." />
            ) : current?.status === "ready" ? (
              <p>
                <a className="adm-btn" href={`/api/admin/files/${id}`}>
                  {isPrivate ? "Download the private original" : "Download the original file"}
                </a>{" "}
                <span className="adm-hint">Every download is recorded in the audit log.</span>
              </p>
            ) : (
              <p className="adm-muted">No ready file to download.</p>
            )}
          </div>
        ) : null}
        <p className="adm-hint">{RIYADH_NOTE}</p>
      </section>

      <MediaMetadataForm
        key={`${id}:${detail.lockVersion}`}
        id={id}
        lockVersion={detail.lockVersion}
        kind={detail.kind}
        approved={status === "approved"}
        editable={detail.can.edit && !detail.deleted}
        initial={initial}
        folders={folders.map((f) => ({ id: f.id, label: f.label }))}
        preview={blocked ? null : preview}
        latestHref={`/admin/media/${id}`}
        privateItem={isPrivate}
      />

      <section className="adm-card" id="rights" aria-labelledby="rights-title">
        <h2 id="rights-title">Rights &amp; safety</h2>
        <p className="adm-hint">
          Flags say why an item may not be shown. A blocking flag stops delivery at once; an unknown flag blocks too. Anyone who may view media can add a flag; only an Owner
          or Admin can clear one, with a reason.
        </p>
        <MediaFlagsPanel
          id={id}
          flags={detail.flags.map((f) => ({ ...f, addedAt: formatTime(f.addedAt) }))}
          choices={MEDIA_FLAG_KEYS.map((k) => ({ value: k, label: MEDIA_FLAGS[k].label, description: MEDIA_FLAGS[k].description, blocking: MEDIA_FLAGS[k].blocking }))}
          canAdd={detail.can.flag && !detail.deleted}
          canClear={detail.can.clear_flag && !detail.deleted}
        />
      </section>

      <section className="adm-card" id="versions" aria-labelledby="versions-title">
        <h2 id="versions-title">Versions</h2>
        <VersionsPanel
          id={id}
          version={detail.lockVersion}
          versions={detail.versions.map((v) => ({
            id: v.id,
            version: v.version,
            current: v.current,
            status: v.status,
            error: v.error,
            filename: v.filename,
            size: formatBytes(v.byteSize),
            dimensions: v.width && v.height ? `${v.width} × ${v.height}` : null,
            uploaded: formatTime(v.uploadedAt),
            uploadedBy: v.uploadedBy,
            purgeEligible: v.purgeEligible,
            thumb: null,
          }))}
          canRestore={detail.can.restore_version && !detail.deleted}
          canReplace={detail.can.replace && !detail.deleted && detail.kind !== "svg"}
          canDownload={canDownload}
          replaceHint={`The same kind of file (${detail.kind === "document" ? "PDF" : "JPEG, PNG, WebP or AVIF"}). The item keeps its id and history; an approved item returns to review.`}
          accept={detail.kind === "document" ? "application/pdf,.pdf" : ACCEPT_IMAGES}
        />
      </section>

      <section className="adm-card" id="used-by" aria-labelledby="used-by-title">
        <h2 id="used-by-title">Used by</h2>
        {detail.usage.length === 0 ? (
          <p className="adm-muted">Not used by any content record.</p>
        ) : (
          detail.usage.map((group) => (
            <div key={group.key} className="adm-field">
              <h3>
                {group.label} <span className="adm-muted">({ENTITIES[group.owner].many})</span>
              </h3>
              <ul className="adm-list">
                {group.items.map((ref) => (
                  <li key={ref.id}>
                    <Link href={`${group.path}/${ref.id}`}>{ref.title.en || ref.title.ar || ref.slug || "(untitled)"}</Link>
                    {ref.archived ? <span className="adm-badge">Archived</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        <p className="adm-hint">Working content only: nothing here is public before publishing (A8).</p>
      </section>

      <section className="adm-card" id="storage" aria-labelledby="storage-title">
        <h2 id="storage-title">Storage and technical details</h2>
        {current ? (
          <dl className="adm-dl">
            {fact("Stored in", AREA_LABELS[current.area])}
            {fact("Type", <span className="adm-mono">{current.mime}</span>)}
            {fact("Size", `${formatBytes(current.byteSize)} (${current.byteSize.toLocaleString("en-US")} bytes)`)}
            {fact("SHA-256", <span className="adm-mono">{`${current.sha256.slice(0, 12)}…${current.sha256.slice(-6)}`}</span>)}
            {current.width && current.height ? fact("Dimensions", `${current.width} × ${current.height} pixels`) : null}
            {fact("Processing", current.status)}
            {current.variants.length ? fact("Generated sizes", current.variants.map((v) => (v.key === "thumb" ? "admin thumbnail" : `${v.width} px`)).join(", ")) : null}
            {detail.legacyKey ? fact("Release key", <span className="adm-mono">{detail.legacyKey}</span>) : null}
          </dl>
        ) : (
          <p className="adm-muted">No ready file yet.</p>
        )}
      </section>
    </>
  );
}

// --- Folders ----------------------------------------------------------------------------------------------------------------

export async function MediaFolders() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("media.view")) return <Forbidden />;
  const tree = await guarded(() => folderTree(authDeps().db));
  return (
    <>
      <PageHeader title="Media folders" crumbs={[{ label: "Media library", href: "/admin/media" }, { label: "Folders" }]} lead="Folders only organise the library. They never change a file's address or anything public." />
      <section className="adm-card" aria-labelledby="folders-title">
        <h2 id="folders-title">Folders</h2>
        <FolderManager
          canEdit={actor.permissions.has("media.edit")}
          folders={tree.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, depth: f.depth, path: f.path, children: f.children, items: f.items }))}
        />
      </section>
    </>
  );
}
