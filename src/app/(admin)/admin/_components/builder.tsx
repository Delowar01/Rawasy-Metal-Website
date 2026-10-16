/**
 * The page builder's screens (A5 brief §28, §44): a page's or a service's layout builder, and the reusable sections'
 * list, new-item and editor pages. Server components: each one checks the session again (`requireActor`) and reads with
 * the acting user's permissions; every save is decided again by the Server Actions and the builder services.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Builder } from "@/components/admin/builder/Builder";
import { ReusableCreateForm, ReusableEditor } from "@/components/admin/builder/ReusableEditor";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { loadBuilder, loadReusableEditor } from "@/server/builder/editor";
import { listReusables, reusableBlockTypes } from "@/server/builder/reusable";
import type { SearchParams } from "./cms";
import { Forbidden, formatTime, PageHeader } from "./parts";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/** What the builder confirms after a change it reloaded (the address names it; the words are fixed here). */
const DONE: Record<string, string> = {
  saved: "Layout saved.",
  setup: "The layout is set up with its required sections.",
  detached: "Detached: the section is now a local copy.",
  copied: "Created a reusable copy; the section stays as it is.",
  linked: "Created the reusable section; the section now shows it.",
};

const WORKING_NOTE = "Working layout only: the public website does not use it until publishing exists (A8) and the website switches to the database (A9).";

/** The layout builder of a page or a service. */
export async function BuilderScreen({ type, id, searchParams }: { type: "page" | "service"; id: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  if (!ULID.test(id)) notFound();
  const model = await guarded(() => loadBuilder(authDeps().db, actor.permissions, { type, id }));
  if (!model) notFound();
  const list = type === "page" ? { label: "Pages", href: "/admin/pages" } : { label: "Services", href: "/admin/services" };
  const section = one(searchParams.section);
  const doneKey = one(searchParams.done) ?? "";
  const done = Object.hasOwn(DONE, doneKey) ? DONE[doneKey] : null;
  return (
    <>
      <PageHeader
        title={`Layout: ${model.owner.label}`}
        crumbs={[list, { label: model.owner.label, href: model.owner.editHref }, { label: "Layout" }]}
        lead={
          <span className="adm-badges">
            <span className="adm-badge">{model.owner.kindLabel}</span>
            {model.owner.archived ? <span className="adm-badge">Archived</span> : null}
            {!model.can.content ? <span className="adm-badge">View only</span> : null}
          </span>
        }
        actions={
          <Link className="adm-btn" href={model.owner.editHref}>
            {type === "page" ? "Page details" : "Service details"}
          </Link>
        }
      />
      <p className="adm-hint">{WORKING_NOTE}</p>
      {done ? (
        <div className="adm-alert is-success" role="status">
          <p>{done} The preview shows the saved working copy; nothing is public until publishing exists (A8).</p>
        </div>
      ) : null}
      {!actor.permissions.has("preview.use") ? (
        <div className="adm-alert is-warning" role="note">
          <p>Your role can edit this layout but not open previews; the preview frame stays empty.</p>
        </div>
      ) : null}
      <Builder key={`${model.owner.id}:${model.lockVersion}`} model={model} initialSection={section ?? null} />
    </>
  );
}

/** Every reusable section, with its block, how many sections link it and its state. */
export async function ReusableList() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const rows = await guarded(() => listReusables(authDeps().db));
  const canCreate = actor.permissions.has("reusable_sections.edit");
  return (
    <>
      <PageHeader
        title="Reusable sections"
        lead="A block kept once and linked by pages and services; editing it changes every page that links it (working previews only)."
        actions={
          canCreate ? (
            <Link className="adm-btn is-primary" href="/admin/reusable-sections/new">
              New reusable section
            </Link>
          ) : null
        }
      />
      <p className="adm-hint">{WORKING_NOTE}</p>
      {rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">Reusable sections</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Block</th>
                <th scope="col">Used by</th>
                <th scope="col">State</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="adm-cell-title">
                    <Link href={`/admin/reusable-sections/${r.id}`}>{r.name}</Link>
                  </th>
                  <td data-label="Block">{r.blockLabel}</td>
                  <td data-label="Used by" className="is-num">
                    {r.uses} section{r.uses === 1 ? "" : "s"}
                  </td>
                  <td data-label="State">{r.archived ? <span className="adm-badge">Archived</span> : <span className="adm-badge is-success">Working</span>}</td>
                  <td data-label="Updated">{r.updatedAt ? formatTime(r.updatedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adm-empty">
          <p>No reusable section yet.</p>
        </div>
      )}
    </>
  );
}

/** A new reusable section: its name and block. */
export async function ReusableNew() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("reusable_sections.edit")) return <Forbidden />;
  const blocks = reusableBlockTypes().map((def) => ({ key: def.key, label: def.label, description: def.description }));
  return (
    <>
      <PageHeader title="New reusable section" crumbs={[{ label: "Reusable sections", href: "/admin/reusable-sections" }, { label: "New" }]} />
      <p className="adm-hint">Generic blocks only: the site&apos;s own page sections (the homepage, service pages …) can&apos;t be reused.</p>
      <ReusableCreateForm blocks={blocks} />
    </>
  );
}

/** One reusable section's editor. */
export async function ReusableEdit({ id, searchParams }: { id: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  if (!ULID.test(id)) notFound();
  const model = await guarded(() => loadReusableEditor(authDeps().db, actor.permissions, id));
  if (!model) notFound();
  return (
    <>
      <PageHeader
        title={model.name}
        crumbs={[{ label: "Reusable sections", href: "/admin/reusable-sections" }, { label: model.name }]}
        lead={
          <span className="adm-badges">
            <span className="adm-badge">{model.block?.label ?? model.blockType}</span>
            {model.archived ? <span className="adm-badge">Archived</span> : null}
            {!model.can.edit ? <span className="adm-badge">View only</span> : null}
          </span>
        }
      />
      {one(searchParams.created) ? (
        <div className="adm-alert is-success" role="status">
          <p>Created “{model.name}”. Write its texts and settings, then link it from a page&apos;s layout.</p>
        </div>
      ) : one(searchParams.done) === "saved" ? (
        <div className="adm-alert is-success" role="status">
          <p>Saved. Every page and service that links it shows the change in its preview; nothing is public until publishing exists (A8).</p>
        </div>
      ) : null}
      <ReusableEditor key={`${model.id}:${model.lockVersion}`} model={model} />
    </>
  );
}
