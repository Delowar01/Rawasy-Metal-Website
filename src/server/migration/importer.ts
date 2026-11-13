/**
 * A9.2 / A9.3 — the static content import (A1-MIGRATION-PLAN §1–§8): today's website, from `src/content/*`, into the
 * A3–A8 working copies, each with an `import` revision and published through A8's pipeline.
 *
 * - **Through the services, as an Owner.** Every record, layout, setting, menu, interface text and form is written by
 *   the same service an editor's form calls (A3 `createItem` / `updateItem`, A5 `initializeLayout` / `saveLayout`, A6,
 *   A7), so every value passes the same validation; publication is A8's `publish` with its strict checks. The import
 *   acts as an existing, active Owner the operator names, through a short-lived session it opens and always closes; its
 *   audit events are `cli` events naming that account and the operator (A2's CLIs: the server shell is the authority).
 * - **All or nothing.** Everything happens in one content transaction: the first refusal (an invalid value, a blocking
 *   publication issue, a slug conflict) rolls the whole import back, so a failed run leaves no partial content, public
 *   or not; the report says what was refused and why.
 * - **Idempotent, never overwriting.** Each aggregate is matched by its legacy key (slug, system key, collection, menu
 *   slot, the settings singleton, the form key). One that exists is updated only when the import created it, nobody
 *   has changed it since (its working copy is still its last import revision's) and the static source changed (the
 *   source fingerprint in that revision's message); otherwise it is left as it is and listed (A1 §3.2 step 4).
 * - **Media by legacy key.** The release media must be registered first (`npm run media:import-release`); a reference
 *   resolves only to an item A4 delivers. The 13 held-back files are never referenced; the report lists each one left out.
 * - **Legal pages** are published only when the operator names the person who reviewed the legal text (A8's legal gate;
 *   the A9 brief: verified review and explicit approval before production). Without it they are imported unpublished.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AuthDeps } from "../auth/deps.ts";
import type { Actor, RequestMeta } from "../auth/types.ts";
import { findUserByEmail, normalizeEmail, principalOf } from "../auth/accounts.ts";
import { createSession, revokeSession } from "../auth/sessions.ts";
import { recordAudit } from "../audit/audit.ts";
import { auditActorOf } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import type { FormObject } from "../cms/form.ts";
import { createItem, updateItem, type ChangeContext } from "../cms/engine.ts";
import { categorySpec, certificateSpec, clientSpec, industrySpec, machineSpec, projectSpec, serviceSpec } from "../cms/kinds.ts";
import { ENTITIES, type EntityType } from "../cms/registry.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { markRecorded } from "../cms/changes.ts";
import { addProjectFlag } from "../cms/flags.ts";
import { publish } from "../publishing/workflow.ts";
import { writeRevision } from "../publishing/revisions.ts";
import { canonicalJson } from "../publishing/snapshot.ts";
import type { AggregateType } from "../publishing/registry.ts";
import type { ContentSet } from "../../content/static-set.ts";
import type { MediaId } from "../../content/media.generated.ts";
import { createPage, pageTypeOf } from "../cms/pages.ts";
import { pageSpec } from "../cms/kinds.ts";
import { SYSTEM_PAGES, ORDERINGS } from "../cms/registry.ts";
import { initializeLayout, saveLayout } from "../builder/sections.ts";
import { readOwner, readSections } from "../builder/store.ts";
import { readSettings, setUpSettings } from "../site/settings.ts";
import { readMenus, setUpNavigation } from "../site/menus.ts";
import { setUpUiText } from "../site/ui-text.ts";
import { MENU_SLOTS } from "../site/registry.ts";
import { staticMenus, staticSettings, staticUiTexts } from "../site/static-source.ts";
import { readForm, setUpForm } from "../forms/forms.ts";
import { FORM_IDS } from "../forms/registry.ts";
import { categoryForm, certificateForm, clientForm, industryForm, machineForm, projectForm, serviceForm, type Form, type ImportRefs } from "./records.ts";
import { layoutOwners, planLayout, type OwnerKey, type SectionPlan } from "./layouts.ts";

export interface ImportOptions {
  /** The active Owner account the import acts as (its email). */
  ownerEmail: string;
  /** Who runs it, for the audit label (`cli:<user>`). */
  operator: string;
  /** Who reviewed the legal pages' text; without it the legal pages are imported but not published. */
  legalReviewer?: string | null;
  requestId: string;
  /** Run everything, report, then roll the whole transaction back (nothing is written). */
  dryRun?: boolean;
}

export type Outcome = "created" | "updated" | "unchanged" | "edited_kept" | "conflict";

export interface UnitReport {
  type: AggregateType;
  key: string;
  outcome: Outcome;
  id: string | null;
  published: boolean;
  notes: string[];
}

export interface ImportReport {
  ok: boolean;
  /** Set when the run was refused: nothing was written. */
  failure: { stage: string; unit: string; message: string; details?: unknown } | null;
  units: UnitReport[];
  /** Static media references not imported, with the reason (the held-back photos). */
  leftOut: { owner: string; key: string; why: string }[];
  /** Notes for the Owner (decisions the import had to take, warnings A8 raised). */
  notes: string[];
  /** Source → imported → published, by type (A9 brief §3.2 reconciliation). */
  reconciliation: { type: string; source: number; created: number; updated: number; unchanged: number; leftAsTheyAre: number; publishedNow: number; live: number }[];
  /** Published documents naming a record that is not published (none once an import completes). */
  missingReferences: { from: string; to: string }[];
  dryRun: boolean;
}

/** A refusal: the whole import is rolled back and reported. */
export class ImportRefused extends Error {
  readonly stage: string;
  readonly unit: string;
  readonly details?: unknown;
  constructor(stage: string, unit: string, message: string, details?: unknown) {
    super(message);
    this.stage = stage;
    this.unit = unit;
    this.details = details;
  }
}

/**
 * The release files the static website holds back (the 13 of A1-MIGRATION-PLAN §7): the withheld photos, every photo
 * of a project awaiting authorship or product confirmation, and Laser Engraving's three images (the asset inventory's
 * item 12; `HELD_BACK_MEDIA` of scripts/package-namecheap.mjs).
 */
export function heldBackMedia(set: ContentSet): string[] {
  const out = new Set<string>(set.withheldMedia);
  for (const p of set.projects) if ((p.flags ?? []).some((f) => f !== "ai-watermark")) for (const m of p.media) out.add(m);
  for (const m of ["services/engraving-nameplates", "services/engraving-wood", "services/engraving-rotary"]) out.add(m);
  return [...out].sort();
}

/** Ends a dry run: the report is kept, the transaction rolled back. */
class DryRunDone extends ImportRefused {
  readonly report: ImportReport;
  constructor(report: ImportReport) {
    super("dry-run", "import", "Dry run: nothing was written.");
    this.report = report;
  }
}

export const IMPORT_MESSAGE = "Imported from the static website (A9 content import).";
const fingerprintOf = (value: unknown) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex").slice(0, 16);
const FINGERPRINT = /Source fingerprint ([0-9a-f]{16})\./;

// --- The acting Owner ------------------------------------------------------------------------------------------------------

/** Opens the import's own session for an active Owner (closed by `end`, whatever happens). */
export async function openImportActor(deps: AuthDeps, options: ImportOptions): Promise<{ actor: Actor; end: () => Promise<void> }> {
  const user = await findUserByEmail(deps.db, normalizeEmail(options.ownerEmail));
  if (!user || user.status !== "active" || user.deletedAt) throw new ImportRefused("preflight", "owner", "The account named to run the import is not an active user.");
  const principal = await principalOf(deps.db, user);
  if (!principal.roles.includes("owner")) throw new ImportRefused("preflight", "owner", "The import runs as an Owner: the account named is not one.");
  const now = deps.clock();
  const { session } = await createSession(deps.db, { userId: user.id, now, ip: null, userAgent: `content-import (${options.operator})`.slice(0, 255), mfaVerified: true });
  const actor: Actor = { ...principal, session, cli: { operator: options.operator } };
  return { actor, end: async () => void (await revokeSession(deps.db, session.id, "logout", deps.clock())) };
}

// --- Media and record references -------------------------------------------------------------------------------------------

interface LibraryItem {
  id: string;
  deliverable: boolean;
  status: string;
}

async function libraryByKey(db: Db): Promise<Map<string, LibraryItem>> {
  const rows = await rowsOf<{ id: string; legacy_key: string; usage_status: string; delivered: number }>(
    db,
    sql`SELECT a.id, a.legacy_key, a.usage_status, (p.media_id IS NOT NULL) AS delivered FROM media_assets a LEFT JOIN public_media p ON p.media_id = a.id WHERE a.legacy_key IS NOT NULL AND a.deleted_at IS NULL`,
  );
  return new Map(rows.map((r) => [r.legacy_key, { id: r.id, deliverable: Number(r.delivered) === 1, status: r.usage_status }]));
}

/** The import's record of an aggregate it wrote: its newest `import` revision. */
async function lastImport(db: Db, type: AggregateType, id: string): Promise<{ sha: Buffer; fingerprint: string | null } | null> {
  const [row] = await rowsOf<{ snapshot_sha256: Buffer; message: string | null }>(
    db,
    sql`SELECT snapshot_sha256, message FROM revisions WHERE entity_type = ${type} AND entity_id = ${id} AND kind = 'import' ORDER BY revision_number DESC LIMIT 1`,
  );
  if (!row) return null;
  return { sha: Buffer.from(row.snapshot_sha256), fingerprint: FINGERPRINT.exec(row.message ?? "")?.[1] ?? null };
}

async function currentSha(db: Db, type: AggregateType, table: string, idColumn: string, id: string): Promise<Buffer | null> {
  const [row] = await rowsOf<{ sha: Buffer | null }>(
    db,
    sql`SELECT r.snapshot_sha256 AS sha FROM ${sql.identifier(table)} t LEFT JOIN revisions r ON r.id = t.current_revision_id WHERE t.${sql.identifier(idColumn)} = ${id}`,
  );
  return row?.sha ? Buffer.from(row.sha) : null;
}

async function lockVersionOf(db: Db, table: string, idColumn: string, id: string): Promise<number> {
  const [row] = await rowsOf<{ lock_version: number }>(db, sql`SELECT lock_version FROM ${sql.identifier(table)} WHERE ${sql.identifier(idColumn)} = ${id}`);
  return Number(row?.lock_version ?? 0);
}

// --- The run -----------------------------------------------------------------------------------------------------------------

const RECORD_SPECS = {
  project_category: categorySpec,
  service: serviceSpec,
  machine: machineSpec,
  project: projectSpec,
  industry: industrySpec,
  client: clientSpec,
  certificate: certificateSpec,
} as const;
type RecordType = keyof typeof RECORD_SPECS;

/** Encoder references for source fingerprints: names only, never ids (the fingerprint is today's source, not the database). */
const FAKE_REFS = { media: (key: string) => `media:${key}`, id: (type: string, slug: string) => `${type}:${slug}`, leftOut: () => undefined };
const LEGAL_PAGES: readonly string[] = ["privacy", "terms"];
/** Which static list gives a collection its order. */
const ORDERING_SOURCE: Record<string, string> = { project_categories: "projectCategories" };
/** Records first (what others link), then the pages that show them, then the site's frame. */
const PUBLISH_ORDER: readonly AggregateType[] = ["project_category", "machine", "client", "certificate", "project", "service", "industry", "ordering", "page", "menu", "site_settings", "form"];

/** What the run decided for an aggregate before it is published. */
interface Pending {
  unit: UnitReport;
  /** Publish it (created or updated by this run). */
  publish: boolean;
  fingerprint: string;
  table: string;
  idColumn: string;
}

export class ImportRun implements ImportRefs {
  readonly report: ImportReport = { ok: true, failure: null, units: [], leftOut: [], notes: [], reconciliation: [], missingReferences: [], dryRun: false };
  private readonly ids = new Map<string, string>();
  private readonly pending: Pending[] = [];
  private library = new Map<string, LibraryItem>();
  private firstPublicationWarnings = 0;

  readonly tx: Db;
  readonly change: ChangeContext;
  readonly set: ContentSet;
  readonly options: ImportOptions;
  constructor(tx: Db, change: ChangeContext, set: ContentSet, options: ImportOptions) {
    this.tx = tx;
    this.change = change;
    this.set = set;
    this.options = options;
  }

  // ImportRefs
  media(key: MediaId): string | null {
    const item = this.library.get(key);
    return item?.deliverable ? item.id : null;
  }
  id(type: EntityType, slug: string): string {
    const id = this.ids.get(`${type}:${slug}`);
    if (!id) throw new ImportRefused("references", `${type} ${slug}`, `The ${ENTITIES[type].one} “${slug}” is referenced but was not imported.`);
    return id;
  }
  leftOut(owner: string, key: MediaId, why: string): void {
    const item = this.library.get(key);
    this.report.leftOut.push({ owner, key, why: item ? `${item.status} in the media library` : "not in the media library" });
    void why;
  }

  /** Checks the release media are registered (A4's importer runs first) and the held-back ones restricted. */
  async preflight(): Promise<void> {
    this.library = await libraryByKey(this.tx);
    const keys = Object.keys(this.set.mediaRegistry);
    const missing = keys.filter((k) => !this.library.has(k));
    if (missing.length) throw new ImportRefused("preflight", "media", `${missing.length} release media are not in the media library: run the release media import first (npm run media:import-release).`, { missing: missing.slice(0, 20) });
    // The static website's held-back photos (A1-MIGRATION-PLAN §7): must not be delivered by the library, or the import
    // would publish them (security review L4). The library's restriction is what keeps them back from here on.
    const held = heldBackMedia(this.set);
    const delivered = held.filter((k) => this.library.get(k)?.deliverable);
    if (delivered.length) throw new ImportRefused("preflight", "media", `${delivered.length} of the static website's held-back photos are delivered by the media library: restrict them again before importing.`, { delivered });
    const restricted = keys.filter((k) => this.library.get(k)?.status === "restricted");
    if (restricted.length !== held.length) this.report.notes.push(`The media library holds ${restricted.length} restricted release items (the static website holds back ${held.length}).`);
  }

  private remember(type: EntityType, slug: string, id: string) {
    this.ids.set(`${type}:${slug}`, id);
  }

  /** Creates or updates one record by slug (see the module comment for when an existing one is left alone). */
  async record(type: RecordType, slug: string, form: Form, source: unknown): Promise<string> {
    const spec = RECORD_SPECS[type];
    const info = ENTITIES[type];
    const table = info.table;
    const fingerprint = fingerprintOf(source);
    const [existing] = await rowsOf<{ id: string }>(this.tx, sql`SELECT id FROM ${sql.raw(table)} WHERE slug = ${slug} AND deleted_at IS NULL`);
    const unit: UnitReport = { type, key: slug, outcome: "created", id: existing?.id ?? null, published: false, notes: [] };
    let publishIt = true;
    if (!existing) {
      const result = await createItem(this.change, spec, form as FormObject);
      if (result.kind !== "ok") throw new ImportRefused("records", `${type} ${slug}`, `The ${info.one} “${slug}” was refused (${result.kind}).`, result);
      unit.id = result.id;
    } else {
      const decided = await this.decideExisting(type, existing.id, fingerprint, table, "id");
      unit.outcome = decided;
      publishIt = decided === "updated" || (decided === "unchanged" && (await this.neverPublished(type, existing.id)));
      if (decided === "updated") {
        const result = await updateItem(this.change, spec, existing.id, { ...form, lockVersion: String(await lockVersionOf(this.tx, table, "id", existing.id)) } as FormObject);
        if (result.kind !== "ok") throw new ImportRefused("records", `${type} ${slug}`, `The ${info.one} “${slug}” update was refused (${result.kind}).`, result);
      }
    }
    this.remember(type, slug, unit.id!);
    this.report.units.push(unit);
    this.pending.push({ unit, publish: publishIt, fingerprint, table, idColumn: "id" });
    return unit.id!;
  }

  /** An existing aggregate: updated only when the import wrote it, nobody changed it since, and the source changed. */
  async decideExisting(type: AggregateType, id: string, fingerprint: string, table: string, idColumn: string): Promise<Outcome> {
    const imported = await lastImport(this.tx, type, id);
    if (!imported) return "conflict";
    // Archived or taken offline since its import: the Owner's decision, never undone by an import (security review M3).
    const [status] = await rowsOf<{ s: string | null }>(this.tx, sql`SELECT ${sql.raw(table === "entity_orderings" || table === "menus" || table === "site_settings" || table === "forms" ? "NULL" : "publication_status")} AS s FROM ${sql.identifier(table)} WHERE ${sql.identifier(idColumn)} = ${id}`);
    if (status?.s === "archived") return "edited_kept";
    const [offline] = await rowsOf<{ n: number }>(this.tx, sql`SELECT COUNT(*) AS n FROM revisions WHERE entity_type = ${type} AND entity_id = ${id} AND kind IN ('unpublish', 'archive')`);
    if (Number(offline?.n ?? 0) > 0) return "edited_kept";
    const current = await currentSha(this.tx, type, table, idColumn, id);
    if (!current || !current.equals(imported.sha)) return "edited_kept";
    return imported.fingerprint === fingerprint ? "unchanged" : "updated";
  }

  /**
   * Imported but never published (a legal page waiting for its reviewer): the only case a later run publishes an
   * unchanged aggregate. Anything published once and taken offline since is the Owner's decision and stays offline
   * (security review M3).
   */
  async neverPublished(type: AggregateType, id: string): Promise<boolean> {
    const [row] = await rowsOf<{ n: number }>(this.tx, sql`SELECT COUNT(*) AS n FROM revisions WHERE entity_type = ${type} AND entity_id = ${id} AND kind IN ('publish', 'unpublish', 'archive')`);
    return Number(row?.n ?? 0) === 0 && !(await this.isLive(type, id));
  }

  /** Whether the aggregate has a published version. */
  async isLive(type: AggregateType, id: string): Promise<boolean> {
    const [row] = await rowsOf<{ n: number }>(this.tx, sql`SELECT COUNT(*) AS n FROM published_documents WHERE entity_type = ${type} AND entity_id = ${id}`);
    return Number(row?.n ?? 0) > 0;
  }

  /** Adds a non-blocking static flag (the AI-watermark note) to a project created by this run. */
  async projectFlags(p: ContentSet["projects"][number], id: string): Promise<void> {
    if (!p.flags?.includes("ai-watermark")) return;
    const result = await addProjectFlag(this.change, id, "ai_watermark", "Imported from the static website: one or more photos carry an AI-image watermark and are held back.");
    if (result.kind !== "ok" && result.kind !== "unchanged") throw new ImportRefused("records", `project ${p.slug}`, "The project's AI-watermark flag was refused.", result);
  }

  // --- Records ---------------------------------------------------------------------------------------------------------

  async records(): Promise<void> {
    const s = this.set;
    for (const c of s.projectCategories) await this.record("project_category", c.slug, categoryForm(c), c);
    // Services first without their relations (machines, projects and related services do not exist yet). A service's
    // source is its record, its page's details and its page layout as the import lays it out.
    for (const svc of s.services) await this.record("service", svc.slug, serviceForm(svc, this, false, []), { svc, detail: s.serviceDetails[svc.slug], layout: planLayout({ service: svc.slug }, s, FAKE_REFS) });
    for (const m of s.machines) await this.record("machine", m.slug, machineForm(m, this), m);
    for (const p of s.projects) {
      const before = this.report.units.length;
      const id = await this.record("project", p.slug, projectForm(p, this), p);
      if (this.report.units[before]?.outcome === "created") await this.projectFlags(p, id);
      for (const f of p.flags ?? []) if (f !== "ai-watermark") this.report.units[before]?.notes.push(`static flag ${f}: recorded on the note and on each photo (restricted), not as an A3 blocking flag`);
    }
    // Now the services' relations (the same unit: its fingerprint is the complete form).
    for (const svc of s.services) {
      const id = this.id("service", svc.slug);
      const unit = this.pending.find((p) => p.unit.type === "service" && p.unit.key === svc.slug)!;
      const form = serviceForm(svc, this, true, s.serviceDetails[svc.slug].related);
      if (unit.unit.outcome === "created" || unit.unit.outcome === "updated") {
        const result = await updateItem(this.change, serviceSpec, id, { ...form, lockVersion: String(await lockVersionOf(this.tx, "services", "id", id)) } as FormObject);
        if (result.kind !== "ok") throw new ImportRefused("records", `service ${svc.slug}`, `The service “${svc.slug}” relations were refused (${result.kind}).`, result);
      }
    }
    for (const i of s.industries) await this.record("industry", i.slug, industryForm(i, this), i);
    for (const c of s.clients) await this.record("client", c.slug, clientForm(c, this), c);
    for (const c of s.certificates) await this.record("certificate", c.slug, certificateForm(c, this), c);
    // The service pages' layouts, now that every record they name exists.
    for (const svc of s.services) {
      const unit = this.pending.find((p) => p.unit.type === "service" && p.unit.key === svc.slug)!;
      if (unit.unit.outcome === "created" || unit.unit.outcome === "updated") await this.layOut({ type: "service", id: unit.unit.id! }, { service: svc.slug });
    }
  }

  // --- Pages and their layouts --------------------------------------------------------------------------------------------

  /** The A3 record of a fixed page: its name (the route label), navigation label and SEO texts, as today's site has them. */
  pageForm(key: string): Form {
    const s = this.set as unknown as Record<string, unknown> & ContentSet;
    const seo = (s.seo as Record<string, { title: Record<string, string>; description: Record<string, string> } | undefined>)[key];
    const label = (s.routeLabels as Record<string, Record<string, string> | undefined>)[key];
    const title = (l: "en" | "ar") =>
      label?.[l] ?? (key === "not_found" ? s.dictionaries[l].notFound.metaTitle : key === "project_detail" ? s.projectDetailPage.eyebrow[l] : (seo?.title[l] ?? key));
    const group = (l: "en" | "ar") => ({
      complete: "1",
      title: title(l),
      navLabel: label?.[l] ?? "",
      seoTitle: seo?.title[l] ?? "",
      seoDescription: seo?.description[l] ?? "",
    });
    const legal = (s.legalDocuments as Record<string, { updated: string } | undefined>)[key];
    return { en: group("en"), ar: group("ar"), ...(legal ? { effectiveDate: legal.updated } : {}) };
  }

  /** Every fixed page with a layout map: its record, then its layout (A5), with one fingerprint for both. */
  async pages(): Promise<void> {
    for (const owner of layoutOwners(this.set)) {
      if (!("page" in owner)) continue;
      const key = owner.page;
      const system = SYSTEM_PAGES.find((p) => p.key === key);
      if (!system) throw new ImportRefused("pages", `page ${key}`, `“${key}” is not one of the site's fixed pages.`);
      const form = this.pageForm(key);
      const fingerprint = fingerprintOf({ form, layout: planLayout(owner, this.set, FAKE_REFS) });
      const [existing] = await rowsOf<{ id: string }>(this.tx, sql`SELECT id FROM pages WHERE system_key = ${key} AND deleted_at IS NULL`);
      const unit: UnitReport = { type: "page", key, outcome: "created", id: existing?.id ?? null, published: false, notes: [] };
      let write = true;
      let publishLater = false;
      if (!existing) {
        const result = await createPage(this.change, { kind: "system", key }, form as FormObject);
        if (result.kind !== "ok") throw new ImportRefused("pages", `page ${key}`, `The page “${key}” was refused (${result.kind}).`, result);
        unit.id = result.id;
      } else {
        unit.outcome = await this.decideExisting("page", existing.id, fingerprint, "pages", "id");
        write = unit.outcome === "updated";
        // Imported earlier but never published (a legal page waiting for its reviewer): published now, as it is.
        if (unit.outcome === "unchanged" && (await this.neverPublished("page", existing.id))) publishLater = true;
        if (write) {
          const result = await updateItem(this.change, pageSpec, existing.id, { ...form, lockVersion: String(await lockVersionOf(this.tx, "pages", "id", existing.id)) } as FormObject, { pageTypeOf });
          if (result.kind !== "ok") throw new ImportRefused("pages", `page ${key}`, `The page “${key}” update was refused (${result.kind}).`, result);
        }
      }
      if (write) await this.layOut({ type: "page", id: unit.id! }, owner);
      this.report.units.push(unit);
      this.pending.push({ unit, publish: write || publishLater, fingerprint, table: "pages", idColumn: "id" });
    }
  }

  /**
   * Sets up an owner's layout (A5 \u201cSet up this layout\u201d when it has none) and saves today's sections into it: each
   * plan takes the stored section of its block (a legal section: of its anchor), new ones are added, and any other section
   * stays, hidden (a required part is never removed).
   */
  async layOut(ref: { type: "page" | "service"; id: string }, owner: OwnerKey): Promise<void> {
    const plans: SectionPlan[] = planLayout(owner, this.set, this);
    const unit = `${ref.type} ${"page" in owner ? owner.page : owner.service}`;
    const ALL = { desktop: true, tablet: true, mobile: true };
    let version = (await readOwner(this.tx, ref, { lock: false }))?.lockVersion;
    if (version === undefined) throw new ImportRefused("layouts", unit, "The layout's owner was not found.");
    if (!(await readSections(this.tx, ref, { lock: false })).length) {
      const result = await initializeLayout(this.change, ref, version);
      if (result.kind !== "ok") throw new ImportRefused("layouts", unit, `Setting up the layout was refused (${result.kind}).`, result);
      version = result.lockVersion;
    }
    const unused = [...(await readSections(this.tx, ref, { lock: false }))];
    let fresh = 0;
    const entries: Record<string, unknown>[] = [];
    for (const plan of plans) {
      const at = unused.findIndex((s) => s.blockType === plan.block && (plan.block !== "legal.section" || s.anchor === plan.anchor));
      const existing = at >= 0 ? unused.splice(at, 1)[0] : null;
      const entry: Record<string, unknown> = existing
        ? { ref: existing.id, visible: plan.visible, devices: ALL, anchor: plan.anchor ?? existing.anchor }
        : { ref: `new:${++fresh}`, blockType: plan.block, visible: plan.visible, devices: ALL, anchor: plan.anchor };
      if (plan.visible) entry.data = { settings: plan.settings, content: plan.content, complete: { en: true, ar: true }, otherUnaffected: false };
      entries.push(entry);
    }
    for (const s of unused) entries.push({ ref: s.id, visible: false, devices: ALL, anchor: s.anchor });
    const saved = await saveLayout(this.change, { owner: ref, expectedVersion: version, sections: entries });
    if (saved.kind !== "ok") throw new ImportRefused("layouts", unit, `Saving the layout was refused (${saved.kind}).`, saved);
  }

  // --- Site settings, interface text, menus and the quote form (A6, A7) -------------------------------------------------

  /** A6's and A7's own set-up copies today's website (static-source.ts, copy.ts); an aggregate already set up is decided as above. */
  async site(): Promise<void> {
    const settingsSource = { settings: staticSettings(), ui: staticUiTexts() };
    await this.singleton("site_settings", "site", "site_settings", "id", settingsSource, async () => (await readSettings(this.tx)).setUp, async () => {
      for (const step of [setUpSettings, setUpUiText]) {
        const result = await step(this.change);
        if (result.kind !== "ok") throw new ImportRefused("site", "site settings", `Setting up the site settings was refused (${result.kind}).`, result);
      }
    });
    // A6 sets up the four menus together (each one not yet set up); each is then its own aggregate.
    const menus = staticMenus();
    const wasSetUp = new Map((await readMenus(this.tx)).map((m) => [m.key, m.setUp]));
    if (MENU_SLOTS.some((slot) => !wasSetUp.get(slot.key))) {
      const result = await setUpNavigation(this.change);
      if (result.kind !== "ok") throw new ImportRefused("site", "navigation", `Setting up the navigation was refused (${result.kind}).`, result);
    }
    for (const slot of MENU_SLOTS) {
      await this.singleton("menu", slot.key, "menus", "key", menus[slot.key as keyof typeof menus], async () => Boolean(wasSetUp.get(slot.key)), async () => undefined);
    }
    const formSetUp = async () => Boolean((await readForm(this.tx, { id: FORM_IDS.quote }))?.setUp);
    await this.singleton("form", FORM_IDS.quote, "forms", "id", { form: "quote", copy: "today's quote form (A7 set-up)" }, formSetUp, async () => {
      const result = await setUpForm(this.change, FORM_IDS.quote);
      if (result.kind !== "ok") throw new ImportRefused("site", "quote form", `Setting up the quote form was refused (${result.kind}).`, result);
    });
  }

  /** A seeded aggregate (A6/A7 rows exist from their migrations): set up once by the import; afterwards only reported. */
  private async singleton(type: AggregateType, key: string, table: string, idColumn: string, source: unknown, isSetUp: () => Promise<boolean>, setUp: () => Promise<void>): Promise<void> {
    const fingerprint = fingerprintOf(source);
    const [row] = await rowsOf<{ k: string }>(this.tx, sql`SELECT ${sql.identifier(idColumn)} AS k FROM ${sql.identifier(table)} WHERE ${sql.identifier(idColumn)} = ${key}`);
    if (!row) throw new ImportRefused("site", `${type} ${key}`, `The seeded ${type} “${key}” is missing: run the migrations first.`);
    const unit: UnitReport = { type, key, outcome: "created", id: key, published: false, notes: [] };
    let publishIt = true;
    if (await isSetUp()) {
      unit.outcome = await this.decideExisting(type, key, fingerprint, table, idColumn);
      if (unit.outcome === "updated") {
        // The import never rewrites a set-up working copy: a changed source is reported for the Owner to review.
        unit.outcome = "edited_kept";
        unit.notes.push("today's website changed since the last import: review and apply the change in the admin");
      }
      publishIt = false;
    } else await setUp();
    this.report.units.push(unit);
    this.pending.push({ unit, publish: publishIt, fingerprint, table, idColumn });
  }

  /** The collections' order (A3 orderings, as the records were created in today's order). */
  async orderings(): Promise<void> {
    for (const key of Object.keys(ORDERINGS)) {
      const fingerprint = fingerprintOf({ ordering: key, order: (this.set as unknown as Record<string, { slug: string }[]>)[ORDERING_SOURCE[key] ?? key]?.map((x) => x.slug) ?? [] });
      const unit: UnitReport = { type: "ordering", key, outcome: "created", id: key, published: false, notes: [] };
      const imported = await lastImport(this.tx, "ordering", key);
      // A collection holding records the import did not write (or left as they were) is ordered by people: never
      // published by the import (security review M3).
      const foreign = this.report.units.some((u) => u.type === ORDERINGS[key as keyof typeof ORDERINGS] && (u.outcome === "conflict" || u.outcome === "edited_kept"));
      let publishIt = !foreign;
      if (foreign) unit.notes.push("the collection holds records the import did not write or left as they were: review its order and publish it in the admin");
      if (imported) {
        unit.outcome = await this.decideExisting("ordering", key, fingerprint, "entity_orderings", "key");
        publishIt = false;
        if (unit.outcome === "updated") {
          unit.outcome = "edited_kept";
          unit.notes.push("today's order changed since the last import: review it in the admin");
        }
      }
      this.report.units.push(unit);
      this.pending.push({ unit, publish: publishIt, fingerprint, table: "entity_orderings", idColumn: "key" });
    }
  }

  // --- Import revisions and publication ---------------------------------------------------------------------------------

  /** Writes each changed aggregate's import revision (with its source fingerprint) and publishes it through A8. */
  async publishAll(): Promise<void> {
    const now = this.change.deps.clock();
    const rank = (p: Pending) => PUBLISH_ORDER.indexOf(p.unit.type);
    const ordered = [...this.pending].sort((a, b) => rank(a) - rank(b));
    for (const p of ordered) {
      if (!p.publish || !p.unit.id) continue;
      const type = p.unit.type;
      const version = await lockVersionOf(this.tx, p.table, p.idColumn, p.unit.id);
      if (p.unit.outcome !== "unchanged") {
        const message = `${IMPORT_MESSAGE} Source fingerprint ${p.fingerprint}.`;
        const written = await writeRevision(this.tx, { type, id: p.unit.id, kind: "import", actorId: this.change.actor.user.id, now, force: true, message, created: p.unit.outcome === "created" });
        if (!written) throw new ImportRefused("revisions", `${type} ${p.unit.key}`, "The import revision could not be written.");
        markRecorded(this.tx, type, p.unit.id, version);
      }
      if (this.skipPublish(p)) continue;
      const result = await publish(this.change, type, p.unit.id, version, { message: IMPORT_MESSAGE, legalReviewer: this.options.legalReviewer ?? undefined });
      if (result.kind !== "ok") throw new ImportRefused("publication", `${type} ${p.unit.key}`, `Publishing “${p.unit.key}” was refused (${result.kind}).`, result);
      p.unit.published = true;
      // Linked items not yet published are A8's warnings for this moment of the run (records link each other); the
      // final check (reconcile) lists any that remain unpublished once everything is.
      if (result.warnings?.length) this.firstPublicationWarnings += result.warnings.length;
    }
  }

  /**
   * The reconciliation (A9 brief §3.2): every type's source count, what was imported and published, what was left as it
   * was; then every published document's relations and media checked against what is published and delivered.
   */
  async reconcile(): Promise<void> {
    const s = this.set;
    const sources: Record<string, number> = {
      project_category: s.projectCategories.length,
      service: s.services.length,
      machine: s.machines.length,
      project: s.projects.length,
      industry: s.industries.length,
      client: s.clients.length,
      certificate: s.certificates.length,
      page: layoutOwners(s).filter((o) => "page" in o).length,
      ordering: Object.keys(ORDERINGS).length,
      menu: MENU_SLOTS.length,
      site_settings: 1,
      form: 1,
    };
    const docs = await rowsOf<{ entity_type: string; entity_id: string; document: unknown }>(this.tx, sql`SELECT entity_type, entity_id, document FROM published_documents`);
    const live = new Set(docs.map((d) => `${d.entity_type}:${d.entity_id}`));
    for (const [type, source] of Object.entries(sources)) {
      const units = this.report.units.filter((u) => u.type === type);
      const count = (...outcomes: Outcome[]) => units.filter((u) => outcomes.includes(u.outcome)).length;
      this.report.reconciliation.push({
        type,
        source,
        created: count("created"),
        updated: count("updated"),
        unchanged: count("unchanged"),
        leftAsTheyAre: count("edited_kept", "conflict"),
        publishedNow: units.filter((u) => u.published).length,
        live: units.filter((u) => u.id && live.has(`${type}:${u.id}`)).length,
      });
    }
    const RELATION_TYPES: Record<string, string> = { machines: "machine", relatedServices: "service", featuredProjects: "project", categories: "project_category", services: "service", projects: "project" };
    for (const d of docs) {
      const doc = (typeof d.document === "string" ? JSON.parse(d.document) : d.document) as { relations?: Record<string, unknown> };
      for (const [rel, ids] of Object.entries(doc.relations ?? {})) {
        const type = RELATION_TYPES[rel];
        if (!type || !Array.isArray(ids)) continue;
        for (const id of ids) if (!live.has(`${type}:${id}`)) this.report.missingReferences.push({ from: `${d.entity_type}:${d.entity_id}`, to: `${type}:${String(id)}` });
      }
    }
    if (this.firstPublicationWarnings) {
      const left = this.report.missingReferences.length;
      this.report.notes.push(
        `A8 warned ${this.firstPublicationWarnings} time(s) that a linked record was not yet published (records link each other, so some publish before the others); ${left === 0 ? "none remains unpublished" : `${left} reference(s) still point at unpublished records`}.`,
      );
    }
    const distinct = [...new Set(this.report.leftOut.map((l) => l.key))];
    this.report.notes.push(`${distinct.length} release media referenced by today's content were left out (not delivered by the library): ${distinct.join(", ")}.`);
  }

  /** Legal pages wait for a named legal reviewer (A8's legal gate; the A9 brief: verified review before production). */
  protected skipPublish(p: Pending): boolean {
    if (p.unit.type === "page" && LEGAL_PAGES.includes(p.unit.key) && !this.options.legalReviewer) {
      p.unit.notes.push("not published: no legal reviewer was named (imported as a working copy only)");
      return true;
    }
    return false;
  }
}

/** Runs the whole import as one transaction; a refusal returns the report with nothing written. */
export async function runContentImport(deps: AuthDeps, set: ContentSet, options: ImportOptions): Promise<ImportReport> {
  let opened: Awaited<ReturnType<typeof openImportActor>>;
  try {
    opened = await openImportActor(deps, options);
  } catch (error) {
    if (!(error instanceof ImportRefused)) throw error;
    return { ok: false, failure: { stage: error.stage, unit: error.unit, message: error.message }, units: [], leftOut: [], notes: [], reconciliation: [], missingReferences: [], dryRun: options.dryRun === true };
  }
  const { actor, end } = opened;
  const meta: RequestMeta = { requestId: options.requestId, ip: null, userAgent: `content-import (${options.operator})` };
  const change: ChangeContext = { deps, actor, meta };
  let report: ImportReport;
  try {
    report = await contentTransaction(deps, actor, async (tx) => {
      const run = new ImportRun(tx, change, set, options);
      await run.preflight();
      await run.records();
      await run.pages();
      await run.site();
      await run.orderings();
      await run.publishAll();
      await run.reconcile();
      if (options.dryRun) {
        run.report.dryRun = true;
        throw new DryRunDone(run.report);
      }
      return run.report;
    });
  } catch (error) {
    if (!(error instanceof ImportRefused) && !(error instanceof DryRunDone)) {
      // An error that is not a refusal (the database, say): nothing was written; the attempt is still audited (the
      // session is closed by the finally below).
      await recordAudit(deps.db, { requestId: meta.requestId, at: deps.clock(), actor: auditActorOf(actor), action: "content.import", entity: { type: "site", label: "Content import" }, outcome: "failed", summary: "Content import stopped by an error; nothing was written." }).catch(() => undefined);
      throw error;
    }
    if (error instanceof DryRunDone) report = error.report;
    else report = { ok: false, failure: { stage: error.stage, unit: error.unit, message: error.message, details: error.details }, units: [], leftOut: [], notes: [], reconciliation: [], missingReferences: [], dryRun: options.dryRun === true };
  } finally {
    await end();
  }
  await recordAudit(deps.db, {
    requestId: meta.requestId,
    at: deps.clock(),
    actor: auditActorOf(actor),
    action: "content.import",
    entity: { type: "site", label: "Content import" },
    outcome: report.ok ? "success" : "failed",
    summary: report.ok
      ? `Content import: ${report.units.filter((u) => u.outcome === "created").length} created, ${report.units.filter((u) => u.outcome === "updated").length} updated, ${report.units.filter((u) => u.published).length} published, ${report.units.filter((u) => u.outcome === "edited_kept" || u.outcome === "conflict").length} left as they are.`
      : `Content import refused at ${report.failure?.stage} (${report.failure?.unit}); nothing was written.`,
  }).catch(() => undefined);
  return report;
}
