/**
 * The Core CMS screens (A3), shared by the seven content areas: the list (search, filters, sorting, pagination in the
 * address), the editor page (form, status, restrictions, "used by"), the new-item page and the order page. Server
 * components: each one checks the session again (`requireActor`) and reads with the acting user's permissions; the
 * Server Actions and the services check every change again.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArchiveControl } from "@/components/admin/cms/ArchiveControl";
import { ContentEditor } from "@/components/admin/cms/ContentEditor";
import { FlagsPanel } from "@/components/admin/cms/FlagsPanel";
import { OrderList } from "@/components/admin/cms/OrderList";
import { LOCALE_STATE_TEXT, type CmsLocaleState } from "@/server/admin/actions/cms-model";
import { editorModel, editorValues, userNames } from "@/server/admin/cms";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { loadEditorItem } from "@/server/cms/engine";
import { listProjectFlags } from "@/server/cms/flags";
import { SPECS } from "@/server/cms/kinds";
import { LANG_FILTERS, listHref, listItems, parseListParams, SORTS, type ListParams, type ListRow } from "@/server/cms/list";
import { pickerOptions, refLabel, usagesOf } from "@/server/cms/lookups";
import { loadOrder } from "@/server/cms/ordering";
import { newPageChoices, pageTypeOf, registeredSystemKeys } from "@/server/cms/pages";
import { can, canCreateAnyPage, isFixedPage } from "@/server/cms/permissions";
import {
  ENTITIES,
  INDUSTRY_CLASSIFICATION_LABELS,
  LEGAL_REVIEW_LABEL,
  LIMITS,
  PAGE_TYPE_LABELS,
  PROJECT_FLAGS,
  SERVICE_GROUP_LABELS,
  systemPage,
  type EntityType,
  type PageType,
} from "@/server/cms/registry";
import { Forbidden, formatTime, PageHeader, RIYADH_NOTE } from "./parts";

export type SearchParams = Record<string, string | string[] | undefined>;

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const STATE_CLASS: Record<CmsLocaleState, string> = { missing: "is-danger", incomplete: "is-warning", draft: "", complete: "is-success", needs_review: "is-warning" };

export function StateBadge({ locale, state }: { locale: "en" | "ar"; state: CmsLocaleState }) {
  return (
    <span className={`adm-badge ${STATE_CLASS[state]}`.trim()}>
      {locale.toUpperCase()} {LOCALE_STATE_TEXT[state]}
    </span>
  );
}

/** The A3 boundary, said once on every content screen: drafts only, nothing public. */
export function DraftNote() {
  return <p className="adm-hint">Working records only: nothing here changes the public website. Publishing arrives in a later phase (A8).</p>;
}

// --- Lists -------------------------------------------------------------------------------------------------------------

const typeLabel = (row: ListRow) => PAGE_TYPE_LABELS[row.extra.page_type as PageType] ?? String(row.extra.page_type ?? "");
const watts = (value: unknown) => (value === null || value === undefined ? "Not stated" : `${Number(value).toLocaleString("en-US")} W`);

function extraCells(type: EntityType, row: ListRow): { label: string; cell: ReactNode }[] {
  switch (type) {
    case "page":
      return [
        {
          label: "Type",
          cell: (
            <>
              {typeLabel(row)}
              {row.extra.system_key ? <span className="adm-slug"> {String(row.extra.system_key)}</span> : null}
              {Number(row.extra.requires_legal_review) ? (
                <>
                  {" "}
                  <span className="adm-badge is-warning">Legal review</span>
                </>
              ) : null}
            </>
          ),
        },
      ];
    case "service":
      return [{ label: "Section", cell: SERVICE_GROUP_LABELS[row.extra.service_group as keyof typeof SERVICE_GROUP_LABELS] ?? "—" }];
    case "machine":
      return [{ label: "Power", cell: watts(row.extra.power_watts) }];
    case "project": {
      const blocking = Number(row.extra.blocking_count ?? 0);
      const flags = Number(row.extra.flag_count ?? 0);
      return [
        {
          label: "Restrictions",
          cell: blocking ? (
            <span className="adm-badge is-danger">Restricted ({blocking})</span>
          ) : flags ? (
            <span className="adm-badge is-warning">Flagged ({flags})</span>
          ) : (
            <span className="adm-muted">None</span>
          ),
        },
        { label: "Featured", cell: Number(row.extra.is_featured) ? "Yes" : "No" },
      ];
    }
    case "client":
      return [{ label: "Featured", cell: Number(row.extra.is_featured) ? "Yes" : "No" }];
    case "industry":
      return [
        {
          label: "Classification",
          cell: INDUSTRY_CLASSIFICATION_LABELS[row.extra.classification as keyof typeof INDUSTRY_CLASSIFICATION_LABELS] ?? "—",
        },
      ];
    case "certificate":
      return [{ label: "Expiry (admin only)", cell: row.extra.expires_on ? String(row.extra.expires_on) : <span className="adm-muted">Not set</span> }];
    default:
      return [];
  }
}

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

function Filters({ type, params, categories }: { type: EntityType; params: ListParams; categories: [string, string][] }) {
  const info = ENTITIES[type];
  const sorts = (Object.entries(SORTS) as [keyof typeof SORTS, string][]).filter(([k]) => info.orderingKey || k !== "order");
  return (
    <form className="adm-card" method="get" action={info.path} role="search" aria-label={`Search and filter ${info.many.toLowerCase()}`}>
      <div className="adm-filters">
        <div className="adm-field is-wide">
          <label className="adm-label" htmlFor="filter-q">
            Search {info.many.toLowerCase()}
          </label>
          <input id="filter-q" name="q" type="search" className="adm-input" defaultValue={params.q} maxLength={LIMITS.searchQuery} aria-describedby="filter-q-hint" />
          <p className="adm-hint" id="filter-q-hint">
            English or Arabic text, or the slug. Arabic matches with or without diacritics and letter variants.
          </p>
        </div>
        <Select
          name="status"
          label="Status"
          value={params.status}
          options={[
            ["active", "Active (drafts)"],
            ["archived", "Archived"],
            ["all", "All"],
          ]}
        />
        <Select name="lang" label="Languages" value={params.lang ?? ""} options={[["", "Any"], ...(Object.entries(LANG_FILTERS) as [string, string][])]} />
        {type === "page" ? (
          <Select name="type" label="Page type" value={params.pageType ?? ""} options={[["", "Any"], ...(Object.entries(PAGE_TYPE_LABELS) as [string, string][])]} />
        ) : null}
        {type === "service" ? <Select name="group" label="Section" value={params.group ?? ""} options={[["", "Any"], ...(Object.entries(SERVICE_GROUP_LABELS) as [string, string][])]} /> : null}
        {type === "industry" ? (
          <Select name="classification" label="Classification" value={params.classification ?? ""} options={[["", "Any"], ...(Object.entries(INDUSTRY_CLASSIFICATION_LABELS) as [string, string][])]} />
        ) : null}
        {type === "project" ? <Select name="category" label="Category" value={params.category ?? ""} options={[["", "Any"], ...categories]} /> : null}
        {type === "project" || type === "client" ? (
          <label className="adm-check" htmlFor="filter-featured">
            <input type="checkbox" id="filter-featured" name="featured" value="1" defaultChecked={params.featured} />
            <span>Featured only</span>
          </label>
        ) : null}
        {type === "project" ? (
          <label className="adm-check" htmlFor="filter-restricted">
            <input type="checkbox" id="filter-restricted" name="restricted" value="1" defaultChecked={params.restricted} />
            <span>Restricted only</span>
          </label>
        ) : null}
        <Select name="sort" label="Sort" value={params.sort} options={sorts} />
        <Select
          name="size"
          label="Per page"
          value={String(params.size)}
          options={[
            ["10", "10"],
            ["25", "25"],
            ["50", "50"],
            ["100", "100"],
          ]}
        />
      </div>
      <div className="adm-actions">
        <button type="submit" className="adm-btn is-primary">
          Apply
        </button>
        <Link className="adm-btn" href={info.path}>
          Clear filters
        </Link>
      </div>
    </form>
  );
}

function Pager({ path, params, total, pages }: { path: string; params: ListParams; total: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <nav className="adm-pager" aria-label="Pages of results">
      <p className="adm-muted">
        Page {params.page} of {pages} ({total} in all)
      </p>
      <ul>
        <li>
          {params.page > 1 ? (
            <Link className="adm-btn is-small" href={listHref(path, params, { page: params.page - 1 })} rel="prev">
              Previous page
            </Link>
          ) : null}
        </li>
        <li>
          {params.page < pages ? (
            <Link className="adm-btn is-small" href={listHref(path, params, { page: params.page + 1 })} rel="next">
              Next page
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}

export async function ContentList({ type, searchParams, intro, actions }: { type: EntityType; searchParams: SearchParams; intro?: ReactNode; actions?: ReactNode }) {
  const { actor } = await requireActor();
  if (!can(actor.permissions, type, "view")) return <Forbidden />;
  const info = ENTITIES[type];
  const deps = authDeps();
  const params = parseListParams(type, searchParams);
  const [result, categories] = await guarded(() =>
    Promise.all([listItems(deps.db, type, params), type === "project" ? pickerOptions(deps.db, "project_category") : Promise.resolve([])]),
  );
  const canCreate = type === "page" ? canCreateAnyPage(actor.permissions) : can(actor.permissions, type, "create");
  const filtered = Boolean(params.q || params.lang || params.featured || params.restricted || params.category || params.classification || params.pageType || params.group || params.status !== "active");
  return (
    <>
      <PageHeader
        title={info.many}
        lead={intro}
        actions={
          <>
            {actions}
            {info.orderingKey ? (
              <Link className="adm-btn" href={`${info.path}/order`}>
                Order
              </Link>
            ) : null}
            {canCreate ? (
              <Link className="adm-btn is-primary" href={`${info.path}/new`}>
                New {info.one}
              </Link>
            ) : null}
          </>
        }
      />
      <DraftNote />
      <Filters type={type} params={params} categories={categories.map((c) => [c.id, refLabel(c)] as [string, string])} />
      <div className="adm-list-meta">
        <p role="status">
          {result.total === 0 ? "No items" : `${result.total} ${result.total === 1 ? info.one : info.many.toLowerCase()}`}
          {filtered ? " match these filters" : ""}
          {params.status === "active" ? " (archived ones are under Status: Archived)" : ""}.
        </p>
      </div>
      {result.rows.length === 0 ? (
        <p className="adm-empty">{filtered ? "Nothing matches. Clear the filters or search for something else." : `No ${info.many.toLowerCase()} yet.`}</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">
              {info.many}, page {result.params.page} of {result.pages}
            </caption>
            <thead>
              <tr>
                {params.sort === "order" ? <th scope="col">Order</th> : null}
                <th scope="col">Title</th>
                <th scope="col">Languages</th>
                <th scope="col">Status</th>
                {extraCells(type, result.rows[0]).map((c) => (
                  <th scope="col" key={c.label}>
                    {c.label}
                  </th>
                ))}
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  {params.sort === "order" ? (
                    <td data-label="Order" className="is-num">
                      {row.position ?? "—"}
                    </td>
                  ) : null}
                  <th scope="row" className="adm-cell-title">
                    <Link href={`${info.path}/${row.id}`}>
                      {row.title.en ? (
                        row.title.en
                      ) : row.title.ar ? (
                        <span lang="ar" dir="rtl">
                          {row.title.ar}
                        </span>
                      ) : (
                        "(untitled)"
                      )}
                    </Link>
                    {row.title.en && row.title.ar ? (
                      <span lang="ar" dir="rtl" className="adm-muted">
                        {row.title.ar}
                      </span>
                    ) : null}
                    {row.slug ? <span className="adm-slug">{row.slug}</span> : null}
                  </th>
                  <td data-label="Languages">
                    <span className="adm-badges">
                      <StateBadge locale="en" state={row.state.en} />
                      <StateBadge locale="ar" state={row.state.ar} />
                    </span>
                  </td>
                  <td data-label="Status">{row.archived ? <span className="adm-badge">Archived</span> : <span className="adm-badge is-success">Draft</span>}</td>
                  {extraCells(type, row).map((c) => (
                    <td key={c.label} data-label={c.label}>
                      {c.cell}
                    </td>
                  ))}
                  <td data-label="Updated">
                    {formatTime(row.updatedAt)}
                    {row.updatedBy ? <span className="adm-muted"> by {row.updatedBy}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager path={info.path} params={result.params} total={result.total} pages={result.pages} />
      <p className="adm-hint">{RIYADH_NOTE}</p>
    </>
  );
}

// --- One item ------------------------------------------------------------------------------------------------------------

export async function ContentEdit({ type, id, searchParams }: { type: EntityType; id: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!can(actor.permissions, type, "view")) return <Forbidden />;
  if (!ULID.test(id)) notFound();
  const info = ENTITIES[type];
  const spec = SPECS[type];
  const deps = authDeps();
  const item = await guarded(() => loadEditorItem(deps.db, spec, id));
  if (!item) notFound();
  const root = item.root;
  const [model, usage, names, flags] = await guarded(() =>
    Promise.all([
      editorModel({ db: deps.db, actor, type, item }),
      usagesOf(deps.db, type, id),
      userNames(deps.db, [root.createdBy as string, root.updatedBy as string, root.archivedBy as string]),
      type === "project" ? listProjectFlags(deps.db, id) : Promise.resolve([]),
    ]),
  );
  const title = item.values.en[spec.titleKey] || item.values.ar[spec.titleKey] || item.slug || "(untitled)";
  const pageType = type === "page" ? pageTypeOf(root) : null;
  const canArchive = can(actor.permissions, type, "archive") && !(pageType && isFixedPage(pageType));
  const notice = searchParams.created ? `Created “${title}” as a draft.` : searchParams.saved ? `Saved “${title}”.` : null;
  const by = (key: string) => {
    const name = names.get(root[key] as string);
    return name ? ` by ${name}` : "";
  };
  const extraSections = [
    { id: "status", label: "Status" },
    ...(type === "project" ? [{ id: "restrictions", label: "Restrictions" }] : []),
    ...(usage.length ? [{ id: "used-by", label: "Used by" }] : []),
  ];
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: info.many, href: info.path }, { label: title }]}
        lead={
          <span className="adm-badges">
            <StateBadge locale="en" state={item.states.en} />
            <StateBadge locale="ar" state={item.states.ar} />
            {item.archived ? <span className="adm-badge">Archived</span> : <span className="adm-badge is-success">Draft</span>}
          </span>
        }
      />
      {notice ? (
        <div className="adm-alert is-success" role="status">
          <p>{notice} Nothing is public until publishing exists.</p>
        </div>
      ) : null}
      {model.page?.legal ? (
        <div className="adm-alert is-warning" role="note">
          <p>
            <strong>{LEGAL_REVIEW_LABEL}.</strong> This record is a draft with no effect on the public legal pages; their final wording and publication need legal review
            and the Owner&apos;s approval (A8/A9).
          </p>
        </div>
      ) : null}
      {type === "certificate" ? <CertificateNote /> : null}
      <ContentEditor
        key={`${id}:${item.lockVersion}`}
        model={model}
        initial={editorValues(type, item)}
        id={id}
        lockVersion={item.lockVersion}
        states={item.states}
        latestHref={`${info.path}/${id}`}
        extraSections={extraSections}
      />
      <section className="adm-card" id="status" aria-labelledby="status-title">
        <h2 id="status-title">Status</h2>
        <dl className="adm-dl">
          <dt>Working state</dt>
          <dd>{item.archived ? "Archived (read-only, restorable)" : "Draft"}</dd>
          <dt>Public</dt>
          <dd>No. Nothing in this admin is public before publishing exists (A8).</dd>
          <dt>Created</dt>
          <dd>
            {formatTime(item.createdAt)}
            {by("createdBy")}
          </dd>
          <dt>Last changed</dt>
          <dd>
            {formatTime(item.updatedAt)}
            {by("updatedBy")}
          </dd>
          {item.archived ? (
            <>
              <dt>Archived</dt>
              <dd>
                {formatTime(root.archivedAt as Date | null)}
                {by("archivedBy")}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="adm-hint">{RIYADH_NOTE}</p>
        {pageType && isFixedPage(pageType) ? (
          <p className="adm-hint">Fixed pages of the site (homepage, system, legal and template pages) are never archived.</p>
        ) : canArchive ? (
          <div className="adm-actions">
            <ArchiveControl type={type} id={id} version={item.lockVersion} archived={item.archived} one={info.one} label={title} />
          </div>
        ) : (
          <p className="adm-hint">Only roles allowed to archive {info.many.toLowerCase()} can archive or restore this {info.one}.</p>
        )}
      </section>
      {type === "project" ? (
        <section className="adm-card" id="restrictions" aria-labelledby="restrictions-title">
          <h2 id="restrictions-title">Restrictions</h2>
          <p className="adm-hint">
            Safety flags keep a project off the public site once publishing exists. They never publish or approve anything; media rights and approval arrive with the media
            library (A4).
          </p>
          <FlagsPanel
            projectId={id}
            archived={item.archived}
            canAdd={actor.permissions.has("projects.add_flags")}
            canClear={actor.permissions.has("projects.clear_flags")}
            choices={Object.entries(PROJECT_FLAGS).map(([value, f]) => ({ value, label: f.label, description: f.description, blocking: f.blocking }))}
            flags={flags.map((f) => ({
              flag: f.flag,
              label: f.label,
              description: f.description,
              blocking: f.blocking,
              known: f.known,
              note: f.note,
              addedAt: formatTime(f.createdAt),
              addedBy: f.createdBy,
              token: f.token,
            }))}
          />
        </section>
      ) : null}
      {usage.length ? (
        <section className="adm-card" id="used-by" aria-labelledby="used-by-title">
          <h2 id="used-by-title">Used by</h2>
          {usage.map((group) => (
            <div key={group.label} className="adm-field">
              <h3>{group.label}</h3>
              <ul className="adm-list">
                {group.items.map((ref) => (
                  <li key={ref.id}>
                    <Link href={`${ENTITIES[ref.type].path}/${ref.id}`}>{refLabel(ref)}</Link>
                    {ref.archived ? <span className="adm-badge">Archived</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}

function CertificateNote() {
  return (
    <div className="adm-alert is-info" role="note">
      <p>
        <strong>Document upload and public/private file management arrives in A4.</strong> This record holds the certificate&apos;s metadata only: no file, no public
        address, and never a registration or certificate number.
      </p>
    </div>
  );
}

export async function ContentNew({ type, searchParams }: { type: EntityType; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  const info = ENTITIES[type];
  const deps = authDeps();
  const crumbs = [{ label: info.many, href: info.path }, { label: `New ${info.one}` }];
  if (type === "page") {
    const kind = typeof searchParams.kind === "string" ? searchParams.kind : "";
    const registered = await guarded(() => registeredSystemKeys(deps.db));
    const choices = newPageChoices(actor.permissions, registered);
    if (!choices.generic && !choices.fixed.length) return <Forbidden />;
    const fixed = kind.startsWith("system:") ? choices.fixed.find((c) => `system:${c.key}` === kind && !c.taken) : undefined;
    if (!(kind === "generic" && choices.generic) && !fixed) {
      return (
        <>
          <PageHeader title="New page" crumbs={crumbs} lead="Choose what kind of page record this is. The type is fixed once it is created." />
          <DraftNote />
          {choices.generic ? (
            <section className="adm-card" aria-labelledby="new-generic">
              <h2 id="new-generic">A new page</h2>
              <p className="adm-hint">A generic page with its own address (/en/&lt;slug&gt;). Its sections arrive with the page builder (A5).</p>
              <div className="adm-actions">
                <Link className="adm-btn is-primary" href={`${info.path}/new?kind=generic`}>
                  New generic page
                </Link>
              </div>
            </section>
          ) : null}
          {choices.fixed.length ? (
            <section className="adm-card" aria-labelledby="new-fixed">
              <h2 id="new-fixed">A record for one of the site&apos;s fixed pages</h2>
              <p className="adm-hint">Each fixed page has at most one record. Registering it changes nothing on the public site, which stays static.</p>
              <ul className="adm-choice-list">
                {choices.fixed.map((c) => (
                  <li key={c.key}>
                    {c.taken ? (
                      <span className="adm-choice is-taken">
                        <strong>{c.label}</strong>
                        <span className="adm-hint">{PAGE_TYPE_LABELS[c.type]} · already registered</span>
                      </span>
                    ) : (
                      <Link className="adm-choice" href={`${info.path}/new?kind=system:${c.key}`}>
                        <strong>{c.label}</strong>
                        <span className="adm-hint">
                          {PAGE_TYPE_LABELS[c.type]}
                          {c.type === "legal" ? ` · ${LEGAL_REVIEW_LABEL.toLowerCase()}` : ""}
                        </span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      );
    }
    const pageType: PageType = fixed ? fixed.type : "generic";
    const model = await guarded(() => editorModel({ db: deps.db, actor, type, item: null, newPageType: pageType, newSystemKey: fixed?.key ?? null }));
    const label = fixed ? (systemPage(fixed.key)?.label ?? fixed.key) : "Generic page";
    return (
      <>
        <PageHeader title={`New page: ${label}`} crumbs={crumbs} />
        <DraftNote />
        {pageType === "legal" ? (
          <div className="adm-alert is-warning" role="note">
            <p>
              <strong>{LEGAL_REVIEW_LABEL}.</strong> Start from an empty record: never copy or invent legal wording here.
            </p>
          </div>
        ) : null}
        <ContentEditor model={model} initial={editorValues(type, null)} id={null} lockVersion={null} states={null} pageChoice={fixed ? `system:${fixed.key}` : "generic"} />
      </>
    );
  }
  if (!can(actor.permissions, type, "create")) return <Forbidden />;
  const model = await guarded(() => editorModel({ db: deps.db, actor, type, item: null }));
  return (
    <>
      <PageHeader title={`New ${info.one}`} crumbs={crumbs} />
      <DraftNote />
      {type === "certificate" ? <CertificateNote /> : null}
      <ContentEditor model={model} initial={editorValues(type, null)} id={null} lockVersion={null} states={null} />
    </>
  );
}

export async function ContentOrder({ type }: { type: EntityType }) {
  const { actor } = await requireActor();
  if (!can(actor.permissions, type, "view")) return <Forbidden />;
  const info = ENTITIES[type];
  const order = await guarded(() => loadOrder(authDeps().db, type));
  if (!order) notFound();
  const canMove = can(actor.permissions, type, "reorder");
  return (
    <>
      <PageHeader
        title={`Order of ${info.many.toLowerCase()}`}
        crumbs={[{ label: info.many, href: info.path }, { label: "Order" }]}
        lead="The order the public site will use once publishing exists. Archived items keep their place and are stepped over."
      />
      {!canMove ? <p className="adm-alert is-info">Your roles let you view this order, not change it.</p> : null}
      <section className="adm-card" aria-label={`Order of ${info.many.toLowerCase()}`}>
        <OrderList
          type={type}
          path={info.path}
          lockVersion={order.lockVersion}
          canMove={canMove}
          rows={order.rows.map((r) => ({ id: r.id, label: refLabel(r), slug: r.slug, archived: r.archived, state: r.state }))}
        />
      </section>
    </>
  );
}
