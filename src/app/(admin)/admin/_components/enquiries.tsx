/**
 * The forms and enquiry screens (A7). Every screen checks the session (`requireActor`) and a permission key itself:
 * the form definitions are read by every signed-in role (`content.view`) and changed with `forms.edit`; enquiries are
 * PRIVATE — read with `enquiries.view`, changed with `enquiries.manage` (Owner, Admin), exported by the Owner alone
 * (`enquiries.export`, with a step-up). Route files are thin wrappers. The website's quote form stays today's handoff
 * form (T1 = Option B): nothing here reaches visitors.
 *
 * Personal data is shown as text only (React escapes it; never markup), each value isolated in its own direction, and
 * never in a page title, a URL or an audit summary (the reference stands for the enquiry).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignForm, ExportButton, NoteForm, RetryButton, StatusControls } from "@/components/admin/enquiries/EnquiryActions";
import { FormEditor, SetUpFormButton } from "@/components/admin/forms/FormEditor";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import type { FormEditorModel } from "@/server/admin/actions/forms-model";
import { assignableUsers, enquirySummary, listEnquiries, parseQuery, readEnquiry } from "@/server/enquiries/enquiries";
import { listForms, readForm } from "@/server/forms/forms";
import { ATTACHMENT_EXTENSIONS, DELIVERY_LABELS, ENQUIRY_STATUSES, FORM_LIMITS, STATUS_LABELS, TRANSITIONS, type EnquiryStatus } from "@/server/forms/registry";
import type { SearchParams } from "./cms";
import { Forbidden, formatTime, PageHeader, RIYADH_NOTE, StepUpGate } from "./parts";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const FORM_NAMES: Record<string, string> = { quote: "Quote request form" };
const WORKING_NOTE = "A working copy for the admin and its preview: the website's quote form stays today's handoff form — the visitor sends the prepared email or WhatsApp message — until the approved cutover.";

function Done({ show, text }: { show: boolean; text: string }) {
  return show ? (
    <div className="adm-alert is-success" role="status">
      <p>{text}</p>
    </div>
  ) : null;
}

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const tone = status === "new" ? " is-warning" : status === "closed" ? "" : status === "answered" ? " is-success" : " is-info";
  return <span className={`adm-badge${tone}`}>{STATUS_LABELS[status]}</span>;
}

/** A visitor's value as text, in its own direction (an Arabic name in an English row stays readable). */
const Value = ({ children, ltr }: { children: string; ltr?: boolean }) => <bdi dir={ltr ? "ltr" : "auto"}>{children || "—"}</bdi>;

// --- Forms ---------------------------------------------------------------------------------------------------------------

export async function FormsScreen() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const rows = await guarded(() => listForms(authDeps().db));
  return (
    <>
      <PageHeader title="Forms" lead="The website's forms: their texts, fields and checks in English and Arabic, how submissions are delivered, and how they are protected." />
      <p className="adm-hint">{WORKING_NOTE}</p>
      <div className="adm-table-wrap">
        <table className="adm-table is-stack">
          <caption className="adm-sr-only">Forms</caption>
          <thead>
            <tr>
              <th scope="col">Form</th>
              <th scope="col">Delivery</th>
              <th scope="col">State</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <Link href={`/admin/forms/${r.id}`}>{FORM_NAMES[r.key] ?? r.key}</Link>
                </th>
                <td data-label="Delivery">{DELIVERY_LABELS[r.deliveryMode]}</td>
                <td data-label="State">
                  {r.setUp ? <span className="adm-badge is-success">Set up</span> : <span className="adm-badge">Not set up</span>} {r.isEnabled ? null : <span className="adm-badge is-warning">Off</span>}
                </td>
                <td data-label="Updated">{formatTime(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Links to the form's preview (the approved quote section with the working copy), both languages and themes. */
function FormPreviewLinks({ id, show }: { id: string; show: boolean }) {
  if (!show) return null;
  const link = (locale: "en" | "ar", theme: "light" | "dark", label: string) => (
    <a className="adm-btn is-small" href={`/admin/preview/form/${id}?locale=${locale}&theme=${theme}`} target="_blank" rel="noopener">
      {label}
      <span className="adm-sr-only"> (opens in a new tab)</span>
    </a>
  );
  return (
    <div className="adm-actions adm-site-actions" aria-label="Preview the form">
      {link("en", "light", "Preview English")}
      {link("ar", "light", "Preview Arabic")}
      {link("en", "dark", "English, dark")}
      {link("ar", "dark", "Arabic, dark")}
    </div>
  );
}

export async function FormEditScreen({ id, searchParams }: { id: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) notFound();
  const form = await guarded(() => readForm(authDeps().db, { id }));
  if (!form) notFound();
  const canEdit = actor.permissions.has("forms.edit");
  const title = FORM_NAMES[form.key] ?? form.key;
  const model: FormEditorModel = {
    id: form.id,
    key: form.key,
    lockVersion: form.lockVersion,
    settings: { ...form.settings, notificationEmails: [...form.settings.notificationEmails], acceptedExtensions: [...form.settings.acceptedExtensions] },
    copy: form.copy,
    status: form.status,
    fields: form.fields.map((f) => ({ id: f.id, key: f.key, type: f.type, group: f.group, isRequired: f.isRequired, requiredLocked: f.requiredLocked, bounds: f.bounds, minLength: f.minLength, maxLength: f.maxLength, options: f.options, texts: f.texts })),
    can: { edit: canEdit, ownerSettings: canEdit && actor.permissions.has("forms.delivery_mode"), retention: canEdit && actor.permissions.has("enquiries.delete") },
    limits: {
      minFill: [FORM_LIMITS.minFillSeconds.min, FORM_LIMITS.minFillSeconds.max],
      maxFiles: [FORM_LIMITS.maxFiles.min, FORM_LIMITS.maxFiles.max],
      maxFileMb: [FORM_LIMITS.maxFileMb.min, FORM_LIMITS.maxFileMb.max],
      retention: [FORM_LIMITS.retentionDays.min, FORM_LIMITS.retentionDays.max],
      emails: FORM_LIMITS.notificationEmails,
      extensions: [...ATTACHMENT_EXTENSIONS],
    },
  };
  return (
    <>
      <PageHeader title={title} crumbs={[{ href: "/admin/forms", label: "Forms" }]} actions={<FormPreviewLinks id={form.id} show={actor.permissions.has("preview.use")} />} />
      <p className="adm-hint">{WORKING_NOTE}</p>
      <Done show={one(searchParams.saved) === "1"} text="Saved. The preview shows the working copy; visitors still see today's form." />
      {form.setUp ? (
        <>
          <p className="adm-muted">
            {DELIVERY_LABELS[form.settings.deliveryMode]} · last changed {formatTime(form.updatedAt)} · version {form.lockVersion}
          </p>
          <FormEditor key={form.lockVersion} model={model} />
        </>
      ) : (
        <section className="adm-card" aria-labelledby="form-setup-title">
          <div className="adm-card-head">
            <h2 id="form-setup-title">Not set up yet</h2>
          </div>
          <p>The working copy is empty. Copy today&apos;s form from the website to start: its texts and its ten fields in both languages. Nothing changes for visitors.</p>
          {canEdit ? <SetUpFormButton id={form.id} /> : <p className="adm-muted">An Owner or Admin can set it up.</p>}
        </section>
      )}
    </>
  );
}

// --- Enquiry inbox ---------------------------------------------------------------------------------------------------------

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "New, open or answered" },
  ...ENQUIRY_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

export async function EnquiriesScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("enquiries.view")) return <Forbidden />;
  const query = parseQuery(searchParams);
  const db = authDeps().db;
  const now = authDeps().clock();
  const [list, summary] = await guarded(() => Promise.all([listEnquiries(db, query, actor.user.id), enquirySummary(db, actor.user.id, now)]));
  const params: Record<string, string> = { q: query.q, status: query.status, assigned: query.assigned, sort: query.sort };
  const href = (page: number) => `/admin/enquiries?${new URLSearchParams({ ...params, size: String(query.size), page: String(page) })}`;
  const filtered = query.q !== "" || query.status !== "all" || query.assigned !== "all";
  const cards: { label: string; value: number; href: string }[] = [
    { label: "New", value: summary.byStatus.new, href: "/admin/enquiries?status=new" },
    { label: "Open", value: summary.byStatus.open, href: "/admin/enquiries?status=open" },
    { label: "Answered", value: summary.byStatus.answered, href: "/admin/enquiries?status=answered" },
    { label: "Not assigned (still active)", value: summary.unassigned, href: "/admin/enquiries?status=active&assigned=none" },
    { label: "Assigned to me (still active)", value: summary.mine, href: "/admin/enquiries?status=active&assigned=me" },
    { label: "Received in the last 7 days", value: summary.lastSevenDays, href: "/admin/enquiries?sort=newest" },
  ];
  return (
    <>
      <PageHeader title="Enquiry inbox" lead="Requests stored by the website's forms: private, for Owners and Admins. The website's form does not store requests yet (it hands them to the visitor's email app or WhatsApp)." />
      <section aria-labelledby="enq-summary-title" className="adm-enq-summary">
        <h2 id="enq-summary-title" className="adm-sr-only">
          Summary
        </h2>
        <ul className="adm-stats">
          {cards.map((c) => (
            <li key={c.label} className="adm-stat">
              <Link href={c.href}>
                <span className="adm-stat-value">{c.value}</span>
                <span className="adm-stat-label">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form className="adm-filters" method="get" action="/admin/enquiries" role="search" aria-label="Find enquiries">
        <div className="adm-field">
          <label className="adm-label" htmlFor="enq-q">
            Search
          </label>
          <input id="enq-q" className="adm-input" type="search" name="q" defaultValue={query.q} maxLength={100} placeholder="Reference, name, company, email or phone" />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="enq-status">
            Status
          </label>
          <select id="enq-status" className="adm-input" name="status" defaultValue={query.status}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="enq-assigned">
            Assigned
          </label>
          <select id="enq-assigned" className="adm-input" name="assigned" defaultValue={query.assigned}>
            <option value="all">Anyone or nobody</option>
            <option value="me">Me</option>
            <option value="none">Nobody</option>
          </select>
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="enq-sort">
            Sort
          </label>
          <select id="enq-sort" className="adm-input" name="sort" defaultValue={query.sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="reference">Reference</option>
            <option value="status">Status</option>
          </select>
        </div>
        <button type="submit" className="adm-btn">
          Show
        </button>
        {filtered ? (
          <Link className="adm-btn is-small" href="/admin/enquiries">
            Clear
          </Link>
        ) : null}
      </form>

      {list.rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">
              Enquiries, page {Math.min(query.page, list.pages)} of {list.pages}
            </caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">From</th>
                <th scope="col">Service</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned</th>
                <th scope="col">Received</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <Link href={`/admin/enquiries/${r.id}`} className="adm-mono" dir="ltr">
                      {r.reference}
                    </Link>
                  </th>
                  <td data-label="From">
                    {r.anonymized ? (
                      <span className="adm-muted">Anonymized</span>
                    ) : (
                      <span className="adm-enq-from">
                        <Value>{r.fullName}</Value>
                        {r.company ? (
                          <span className="adm-muted">
                            <Value>{r.company}</Value>
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td data-label="Service">
                    <Value>{r.serviceLabel}</Value>
                    {r.files ? <span className="adm-muted"> · {r.files} file{r.files === 1 ? "" : "s"}</span> : null}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={r.status} />
                  </td>
                  <td data-label="Assigned">{r.assignedName ?? <span className="adm-muted">Nobody</span>}</td>
                  <td data-label="Received">{formatTime(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adm-empty">
          <p>{filtered ? "No enquiry matches these filters." : "No enquiry yet. The website's form hands requests to the visitor's email app or WhatsApp; nothing is stored until the approved cutover."}</p>
        </div>
      )}
      <p className="adm-hint">{RIYADH_NOTE}</p>
      {list.pages > 1 ? (
        <nav className="adm-actions" aria-label="Pages">
          {query.page > 1 ? (
            <Link className="adm-btn" href={href(Math.min(query.page, list.pages) - 1)}>
              Previous page
            </Link>
          ) : null}
          <span className="adm-muted">
            Page {Math.min(query.page, list.pages)} of {list.pages} ({list.total} enquiries)
          </span>
          {query.page < list.pages ? (
            <Link className="adm-btn" href={href(query.page + 1)}>
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}

      {actor.permissions.has("enquiries.export") ? (
        <section className="adm-card" aria-labelledby="enq-export-title">
          <div className="adm-card-head">
            <h2 id="enq-export-title">Export</h2>
          </div>
          <p className="adm-hint">A CSV of the enquiries these filters show (at most 5,000). It holds personal data: keep it private. Spreadsheet formulas in it are written as text. Each export is recorded.</p>
          <StepUpGate reason="Exporting enquiries is a sensitive action.">
            <ExportButton params={params} />
          </StepUpGate>
        </section>
      ) : null}
    </>
  );
}

// --- One enquiry -----------------------------------------------------------------------------------------------------------

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export async function EnquiryScreen({ id, searchParams }: { id: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("enquiries.view")) return <Forbidden />;
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) notFound();
  const db = authDeps().db;
  const enquiry = await guarded(() => readEnquiry(db, id));
  if (!enquiry) notFound();
  const canManage = actor.permissions.has("enquiries.manage");
  const people = canManage ? await guarded(() => assignableUsers(db)) : [];
  const transitions = TRANSITIONS.filter((t) => t.from === enquiry.status).map((t) => ({ to: t.to, label: t.label, noteRequired: t.noteRequired }));
  const gone = Boolean(enquiry.anonymizedAt);
  const rows: [string, string, boolean?][] = [
    ["Full name", enquiry.fullName],
    ["Company", enquiry.company],
    ["Email", enquiry.email, true],
    ["Phone", enquiry.phone, true],
    ["Service", enquiry.serviceLabel],
    ["Project type", enquiry.projectType],
    ["Estimated requirement", enquiry.requirement],
    ["Project location", enquiry.projectLocation],
  ];
  const timeline = [
    ...enquiry.history.map((h) => ({ at: h.at, text: h.from ? `${STATUS_LABELS[h.from]} → ${STATUS_LABELS[h.to]}` : "Received", by: h.by, note: h.note })),
    ...enquiry.assignments.map((a) => ({ at: a.at, text: a.summary, by: a.by, note: null as string | null })),
  ].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  return (
    <>
      <PageHeader title={`Enquiry ${enquiry.reference}`} crumbs={[{ href: "/admin/enquiries", label: "Enquiry inbox" }]} actions={<StatusBadge status={enquiry.status} />} />
      <Done show={one(searchParams.done) === "1"} text="Saved." />
      <p className="adm-muted">
        Received {formatTime(enquiry.submittedAt)} · {enquiry.locale === "ar" ? "Arabic" : "English"} · from <span dir="ltr">{enquiry.sourcePath}</span> · {FORM_NAMES[enquiry.formKey] ?? enquiry.formKey}
        {enquiry.consentAt ? ` · consent given ${formatTime(enquiry.consentAt)}` : ""}
      </p>
      {gone ? (
        <div className="adm-alert is-info" role="status">
          <p>Anonymized {formatTime(enquiry.anonymizedAt)} by the retention tool: the personal details, notes and files are gone; the reference, dates and history stay.</p>
        </div>
      ) : null}

      <div className="adm-enq-layout">
        <div className="adm-enq-main">
          <section className="adm-card" aria-labelledby="enq-request-title">
            <div className="adm-card-head">
              <h2 id="enq-request-title">The request</h2>
            </div>
            <dl className="adm-dl adm-enq-dl">
              {rows.map(([label, value, ltr]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {label === "Email" && value ? (
                      <a href={`mailto:${value}`} dir="ltr">
                        {value}
                      </a>
                    ) : label === "Phone" && value ? (
                      <a href={`tel:${value.replace(/[^\d+]/g, "")}`} dir="ltr">
                        <bdi>{value}</bdi>
                      </a>
                    ) : (
                      <Value ltr={ltr}>{value}</Value>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className="adm-label">Project details</h3>
            <p className="adm-enq-message" dir="auto">
              {enquiry.message || "—"}
            </p>
          </section>

          <section className="adm-card" aria-labelledby="enq-files-title">
            <div className="adm-card-head">
              <h2 id="enq-files-title">Files</h2>
            </div>
            {enquiry.files.length ? (
              <ul className="adm-enq-files">
                {enquiry.files.map((f) => (
                  <li key={f.id}>
                    <a className="adm-btn is-small" href={`/api/admin/enquiries/${enquiry.id}/files/${f.id}`} download>
                      Download<span className="adm-sr-only"> {f.name}</span>
                    </a>{" "}
                    <bdi className="adm-enq-file-name">{f.name}</bdi> <span className="adm-muted">({f.extension.toUpperCase()}, {size(f.size)})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-muted">No files.</p>
            )}
            <p className="adm-hint">Files are private: downloaded only here, never from a public address. Each download is recorded.</p>
          </section>

          <section className="adm-card" aria-labelledby="enq-notes-title">
            <div className="adm-card-head">
              <h2 id="enq-notes-title">Internal notes</h2>
            </div>
            {enquiry.notes.length ? (
              <ol className="adm-enq-notes">
                {enquiry.notes.map((n) => (
                  <li key={n.id}>
                    <p className="adm-muted">
                      {n.author ?? "Removed user"} · {formatTime(n.at)}
                    </p>
                    <p className="adm-enq-message" dir="auto">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="adm-muted">No note yet.</p>
            )}
            {canManage && !gone ? <NoteForm id={enquiry.id} /> : null}
          </section>
        </div>

        <aside className="adm-enq-side" aria-label="Handling">
          <section className="adm-card" aria-labelledby="enq-status-title">
            <div className="adm-card-head">
              <h2 id="enq-status-title">Status</h2>
            </div>
            <p>
              <StatusBadge status={enquiry.status} />
              {enquiry.closedAt ? <span className="adm-muted"> since {formatTime(enquiry.closedAt)}</span> : null}
            </p>
            {canManage ? <StatusControls id={enquiry.id} lockVersion={enquiry.lockVersion} transitions={transitions} /> : <p className="adm-muted">An Owner or Admin can move it along.</p>}
            {canManage ? <AssignForm key={`${enquiry.lockVersion}:${enquiry.assignedTo ?? ""}`} id={enquiry.id} lockVersion={enquiry.lockVersion} current={enquiry.assignedTo} people={people} /> : <p>Assigned to {enquiry.assignedName ?? "nobody"}.</p>}
          </section>

          <section className="adm-card" aria-labelledby="enq-history-title">
            <div className="adm-card-head">
              <h2 id="enq-history-title">History</h2>
            </div>
            <ol className="adm-enq-history">
              {timeline.map((h, i) => (
                <li key={i}>
                  <span>{h.text}</span>
                  <span className="adm-muted">
                    {" "}
                    · {h.by ?? "the website"} · {formatTime(h.at)}
                  </span>
                  {h.note ? (
                    <p className="adm-enq-message" dir="auto">
                      {h.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="adm-card" aria-labelledby="enq-mail-title">
            <div className="adm-card-head">
              <h2 id="enq-mail-title">Notifications</h2>
            </div>
            {enquiry.outbox.length ? (
              <ul className="adm-enq-mail">
                {enquiry.outbox.map((o) => (
                  <li key={o.id}>
                    <span dir="ltr">{o.to}</span> · <span className={`adm-badge${o.status === "sent" ? " is-success" : o.status === "failed" ? " is-warning" : ""}`}>{o.status}</span>
                    <span className="adm-muted">
                      {" "}
                      · {o.attempts} attempt{o.attempts === 1 ? "" : "s"}
                      {o.sentAt ? ` · sent ${formatTime(o.sentAt)}` : o.nextAttemptAt && o.status === "pending" ? ` · next ${formatTime(o.nextAttemptAt)}` : ""}
                      {o.lastError ? ` · ${o.lastError === "mail_disabled" ? "mail is off (no SMTP yet)" : o.lastError}` : ""}
                    </span>
                    {o.status === "failed" && canManage ? <RetryButton enquiryId={enquiry.id} outboxId={o.id} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-muted">No notification for this enquiry.</p>
            )}
          </section>
          <p className="adm-hint">{RIYADH_NOTE}</p>
        </aside>
      </div>
    </>
  );
}
