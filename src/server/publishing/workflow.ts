/**
 * The publishing workflow (A8.2, A1-PUBLISHING-VERSIONS §2–§5): submit for review, request changes, withdraw, approve
 * and publish or publish directly, unpublish, discard the draft, restore an earlier version, roll back to an earlier
 * published version. Each step is one content transaction that locks the aggregate's root FOR UPDATE, decides the
 * permission again there from the seeded keys (`workflowKeys`, never role names), compares the version the page showed
 * (stale → refused, audited), checks the state the step starts from, and audits what it did with the revisions it went
 * from and to. Publishing validates the exact version going live (`publicationIssues`), writes a sealed publish revision,
 * projects it into `published_documents`, records its published references, any slug-change redirects and the cache
 * invalidation. No public page reads any of it before the A9 cutover (T1 = Option B).
 *
 * A step that has to undo work it already did in the transaction (a restore refused half-way) throws `Rollback`; the
 * refusal is then audited in a transaction of its own, so nothing of the attempt remains.
 */
import { sql } from "drizzle-orm";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { isRecentlyAuthenticated } from "../auth/sessions.ts";
import { auditActorOf, type Actor, type RequestMeta } from "../auth/types.ts";
import { SENSITIVE_PERMISSIONS } from "../policy/registry.ts";
import type { Db } from "../db/client.ts";
import { reviewComments } from "../db/schema-publishing.ts";
import { deferInvalidations, noteLocked, setIntent, markRecorded } from "../cms/changes.ts";
import { contentTransaction, duplicateKey, instantOf, rowsOf, type CmsDeps, type FieldErrors } from "../cms/store.ts";
import { plainText } from "../cms/text.ts";
import type { PageType } from "../cms/registry.ts";
import { ulid } from "../security/ids.ts";
import { recordInvalidations, tagsFor } from "./cache.ts";
import { takeOffline } from "./offline.ts";
import { projectSnapshot } from "./projection.ts";
import { referencesOfSnapshot, sourceLabel, usedBy, writeReferences } from "./references.ts";
import { AGGREGATES, allowed, canApprove, PUBLISHING_LIMITS, workflowKeys, type AggregateType, type RecordFacts, type WorkflowAction } from "./registry.ts";
import { restoreSnapshot, type RestoreOutcome } from "./restore.ts";
import { readRevision, readRootStatus, ROOTS, submitterOf, writeRevision } from "./revisions.ts";
import { readSnapshot, sha256, canonicalJson } from "./snapshot.ts";
import { applySlugRedirects, planSlugRedirects, type RoutableType } from "./slug-redirects.ts";
import { publicationIssues, shownSnapshot, type PublishIssue } from "./validate.ts";

export interface PublishingChange {
  deps: CmsDeps;
  actor: Actor;
  meta: RequestMeta;
}

export type WorkflowResult =
  | { kind: "ok"; summary: string; lockVersion: number; revisionId?: string | null; warnings?: string[] }
  | { kind: "stale" }
  | { kind: "not_found" }
  | { kind: "denied"; message: string }
  | { kind: "step_up"; message: string }
  | { kind: "refused"; message: string; issues?: PublishIssue[]; errors?: FieldErrors; details?: { path?: string; ref?: string; message: string }[] };

export const STEP_UP_MESSAGE = "Confirm your identity first (valid for 10 minutes), then try again.";

export const STALE_MESSAGE = "This content changed after you opened it. Reload and review the latest version before continuing.";

class Rollback extends Error {
  readonly result: WorkflowResult;
  readonly audit: { action: string; summary: string; outcome: AuditOutcome };
  constructor(result: WorkflowResult, audit: { action: string; summary: string; outcome: AuditOutcome }) {
    super("rollback");
    this.result = result;
    this.audit = audit;
  }
}

interface Locked {
  type: AggregateType;
  id: string;
  version: number;
  publication: "unpublished" | "published" | "archived";
  draft: "none" | "draft" | "in_review";
  publishedRevisionId: string | null;
  currentRevisionId: string | null;
  slug: string | null;
  facts: RecordFacts;
  label: string;
}

const hasSlug = (type: AggregateType) => AGGREGATES[type].routable;

/** Locks the aggregate's root FOR UPDATE (and notes it for the closing revision pass); null if it doesn't exist. */
async function lockAggregate(tx: Db, type: AggregateType, id: string): Promise<Locked | null> {
  const root = ROOTS[type];
  const extra = type === "page" ? sql`, page_type, slug` : hasSlug(type) ? sql`, NULL AS page_type, slug` : sql`, NULL AS page_type, NULL AS slug`;
  const softDelete = root.softDelete ? sql` AND deleted_at IS NULL` : sql``;
  const [row] = await rowsOf<{
    lock_version: number;
    publication_status: Locked["publication"];
    draft_status: Locked["draft"];
    published_revision_id: string | null;
    current_revision_id: string | null;
    page_type: string | null;
    slug: string | null;
  }>(
    tx,
    sql`SELECT lock_version, publication_status, draft_status, published_revision_id, current_revision_id${extra}
          FROM ${sql.identifier(root.table)} WHERE ${sql.identifier(root.key)} = ${id}${softDelete} FOR UPDATE`,
  );
  if (!row) return null;
  noteLocked(tx, type, id, Number(row.lock_version));
  return {
    type,
    id,
    version: Number(row.lock_version),
    publication: row.publication_status,
    draft: row.draft_status,
    publishedRevisionId: row.published_revision_id,
    currentRevisionId: row.current_revision_id,
    slug: row.slug,
    facts: row.page_type ? { pageType: row.page_type as PageType } : {},
    label: await sourceLabel(tx, type, id),
  };
}

async function setRoot(tx: Db, locked: Locked, actorId: string, now: Date, columns: ReturnType<typeof sql>) {
  const root = ROOTS[locked.type];
  await tx.execute(
    sql`UPDATE ${sql.identifier(root.table)} SET ${columns}, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE ${sql.identifier(root.key)} = ${locked.id}`,
  );
}

function audit(tx: Db, change: PublishingChange, now: Date, locked: Pick<Locked, "type" | "id" | "label">, event: { action: string; outcome?: AuditOutcome; summary: string; changes?: Record<string, unknown>; before?: string | null; after?: string | null }) {
  return recordAudit(tx, {
    at: now,
    requestId: change.meta.requestId,
    actor: auditActorOf(change.actor),
    ip: change.meta.ip,
    action: `${locked.type}.${event.action}`,
    entity: { type: locked.type, id: locked.id, label: locked.label.slice(0, 120) },
    outcome: event.outcome ?? "success",
    summary: event.summary.slice(0, 500),
    changes: event.changes,
    beforeRevisionId: event.before ?? null,
    afterRevisionId: event.after ?? null,
  });
}

const what = (locked: Pick<Locked, "type" | "label">) => `${AGGREGATES[locked.type].one} ${locked.label}`;

const keyList = (type: AggregateType, action: WorkflowAction, facts: RecordFacts) => {
  switch (action) {
    case "publish":
      return facts.pageType === "legal" ? "legal.publish" : `${AGGREGATES[type].resource}.publish`;
    default:
      return `${AGGREGATES[type].resource}.${action}`;
  }
};

/**
 * A step whose keys include a sensitive one (`legal.publish` today: publishing, unpublishing or rolling back a legal page)
 * needs a re-authentication within the last 10 minutes (A1-SECURITY-RBAC §3.7), decided here on the session as it is,
 * like A7's export. Null when it may go on; otherwise the refusal, audited as denied.
 */
async function stepUpRefusal(tx: Db, change: PublishingChange, now: Date, locked: Locked, step: string, action: WorkflowAction): Promise<WorkflowResult | null> {
  const sensitive = workflowKeys(locked.type, action, locked.facts).filter((key) => SENSITIVE_PERMISSIONS.has(key));
  if (!sensitive.length || isRecentlyAuthenticated(change.actor.session, now)) return null;
  await audit(tx, change, now, locked, { action: step, outcome: "denied", summary: `Refused: ${step.replace(/_/g, " ")} of ${what(locked)} needs ${sensitive.join(", ")} confirmed within the last 10 minutes.` });
  return { kind: "step_up", message: STEP_UP_MESSAGE };
}

/** The common start of a step: lock, permission, version. Returns the locked root or the refusal (audited). */
async function begin(tx: Db, change: PublishingChange, now: Date, type: AggregateType, id: string, step: string, needs: WorkflowAction | null, expectedVersion: number): Promise<Locked | WorkflowResult> {
  const locked = await lockAggregate(tx, type, id);
  if (!locked) return { kind: "not_found" };
  if (needs && !allowed(change.actor.permissions, type, needs, locked.facts)) {
    await audit(tx, change, now, locked, { action: step, outcome: "denied", summary: `Refused: ${step.replace(/_/g, " ")} of ${what(locked)} needs ${keyList(type, needs, locked.facts)}.` });
    return { kind: "denied", message: `You don't have permission to ${step.replace(/_/g, " ")} this ${AGGREGATES[type].one}.` };
  }
  if (needs) {
    const stepUp = await stepUpRefusal(tx, change, now, locked, step, needs);
    if (stepUp) return stepUp;
  }
  if (locked.version !== expectedVersion) {
    await audit(tx, change, now, locked, { action: step, outcome: "failed", summary: `Refused: ${what(locked)} changed after the page was opened (version ${expectedVersion}, now ${locked.version}).` });
    return { kind: "stale" };
  }
  return locked;
}

const isResult = (value: Locked | WorkflowResult): value is WorkflowResult => "kind" in value;

async function refuse(tx: Db, change: PublishingChange, now: Date, locked: Locked, step: string, message: string, issues?: PublishIssue[]): Promise<WorkflowResult> {
  await audit(tx, change, now, locked, {
    action: step,
    outcome: "failed",
    summary: `Refused: ${message}`,
    changes: issues ? { blocking: issues.filter((i) => i.blocking).map((i) => i.code) } : undefined,
  });
  return { kind: "refused", message, issues };
}

/** Runs a step; a `Rollback` undoes everything it did and the refusal is audited on its own. */
async function step(change: PublishingChange, type: AggregateType, id: string, work: (tx: Db, now: Date) => Promise<WorkflowResult>): Promise<WorkflowResult> {
  try {
    return await contentTransaction(change.deps, change.actor, work);
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
    await contentTransaction(change.deps, change.actor, async (tx, now) => {
      await audit(tx, change, now, { type, id, label: await sourceLabel(tx, type, id) }, error.audit);
    });
    return error.result;
  }
}

const restoreRefusal = (outcome: Exclude<RestoreOutcome, { kind: "ok" }>): WorkflowResult => {
  switch (outcome.kind) {
    case "stale":
      return { kind: "stale" };
    case "not_found":
      return { kind: "not_found" };
    case "denied":
      return { kind: "denied", message: outcome.message };
    case "archived":
      return { kind: "refused", message: "This item is archived: restore it from the archive first." };
    case "unsupported":
      return { kind: "refused", message: outcome.message };
    case "refused":
      return { kind: "refused", message: outcome.message, errors: outcome.errors, details: outcome.issues };
  }
};

const versionNow = async (tx: Db, type: AggregateType, id: string) => (await readRootStatus(tx, type, id))?.lockVersion ?? -1;

/** A revision written now (and noted, so the closing pass adds none for this version). */
async function revisionNow(tx: Db, type: AggregateType, id: string, kind: "restore" | "publish", actorId: string, now: Date, extra: { restoredFromId?: string | null; message?: string | null } = {}) {
  const written = await writeRevision(tx, { type, id, kind, actorId, now, force: true, ...extra });
  markRecorded(tx, type, id, await versionNow(tx, type, id));
  return written;
}

// --- Review ---------------------------------------------------------------------------------------------------------------

export function submitForReview(change: PublishingChange, type: AggregateType, id: string, expectedVersion: number, message?: string): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    if (!AGGREGATES[type].review) return { kind: "refused", message: `A ${AGGREGATES[type].one} is published directly by someone who may publish it: there is no review step.` };
    const locked = await begin(tx, change, now, type, id, "submit", "submit", expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.publication === "archived") return refuse(tx, change, now, locked, "submit", "This item is archived: restore it from the archive first.");
    if (locked.draft === "in_review") return refuse(tx, change, now, locked, "submit", "This version is already in review.");
    if (locked.draft === "none") return refuse(tx, change, now, locked, "submit", "Nothing to submit: the working copy is the live version.");
    const snapshot = await readSnapshot(tx, type, id);
    if (!snapshot) return { kind: "not_found" };
    const issues = await publicationIssues(tx, type, id, snapshot);
    if (issues.some((i) => i.blocking)) return refuse(tx, change, now, locked, "submit", "This version isn't ready for review yet.", issues);
    const note = cleanNote(message);
    setIntent(tx, type, id, { kind: "submit", message: note });
    await setRoot(tx, locked, change.actor.user.id, now, sql`draft_status = 'in_review'`);
    await audit(tx, change, now, locked, { action: "submit", summary: `Submitted ${what(locked)} for review.`, before: locked.currentRevisionId });
    return { kind: "ok", summary: "Submitted for review.", lockVersion: locked.version + 1, warnings: issues.map((i) => i.message) };
  });
}

const commentSchema = plainText(PUBLISHING_LIMITS.comment, { multiline: true });

export function requestChanges(change: PublishingChange, type: AggregateType, id: string, expectedVersion: number, rawComment: unknown): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "request_changes", "review", expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.draft !== "in_review") return refuse(tx, change, now, locked, "request_changes", "This item is not in review.");
    const comment = commentSchema.safeParse(typeof rawComment === "string" ? rawComment : "");
    if (!comment.success || !comment.data.trim()) return { kind: "refused", message: "Say what needs to change (a comment is required).", errors: { comment: comment.success ? "Say what needs to change." : (comment.error.issues[0]?.message ?? "Say what needs to change.") } };
    await tx.insert(reviewComments).values({ id: ulid(now.getTime()), entityType: type, entityId: id, revisionId: locked.currentRevisionId, authorId: change.actor.user.id, body: comment.data, status: "open", createdAt: now });
    await setRoot(tx, locked, change.actor.user.id, now, sql`draft_status = 'draft'`);
    await audit(tx, change, now, locked, { action: "request_changes", summary: `Requested changes to ${what(locked)} (a comment of ${[...comment.data].length} characters).`, before: locked.currentRevisionId });
    return { kind: "ok", summary: "Sent back with your comment.", lockVersion: locked.version + 1 };
  });
}

export function withdrawFromReview(change: PublishingChange, type: AggregateType, id: string, expectedVersion: number): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "withdraw", null, expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.draft !== "in_review") return refuse(tx, change, now, locked, "withdraw", "This item is not in review.");
    const submitter = await submitterOf(tx, type, id);
    if (submitter !== change.actor.user.id && !allowed(change.actor.permissions, type, "edit", locked.facts)) {
      await audit(tx, change, now, locked, { action: "withdraw", outcome: "denied", summary: `Refused: withdrawing ${what(locked)} needs to be its submitter or to hold ${keyList(type, "edit", locked.facts)}.` });
      return { kind: "denied", message: "Only the person who submitted it, or someone who may edit it, can withdraw it." };
    }
    await setRoot(tx, locked, change.actor.user.id, now, sql`draft_status = 'draft'`);
    await audit(tx, change, now, locked, { action: "withdraw", summary: `Withdrew ${what(locked)} from review.` });
    return { kind: "ok", summary: "Withdrawn from review: it is a draft again.", lockVersion: locked.version + 1 };
  });
}

// --- Publishing ----------------------------------------------------------------------------------------------------------

export interface PublishOptions {
  /** Pages that need legal review (Privacy, Terms): who reviewed the legal text (A1 §4.3). */
  legalReviewer?: unknown;
  message?: unknown;
}

const reviewerSchema = plainText(200);
const cleanNote = (raw: unknown): string | null => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = plainText(PUBLISHING_LIMITS.message, { multiline: true }).safeParse(raw);
  return parsed.success && parsed.data.trim() ? parsed.data.trim() : null;
};

/** The publish itself, on a locked root whose working copy is the version going live (shared by publish and rollback). */
async function publishLocked(
  tx: Db,
  change: PublishingChange,
  now: Date,
  locked: Locked,
  options: { message: string | null; fromReview: boolean; restoredFromId?: string | null; stepName: string; legalReviewer?: string | null },
): Promise<WorkflowResult> {
  const snapshot = await readSnapshot(tx, locked.type, locked.id);
  if (!snapshot) return { kind: "not_found" };
  const issues = await publicationIssues(tx, locked.type, locked.id, snapshot);
  const routable = AGGREGATES[locked.type].routable;
  // Read only when the root names a live version: a locking read of a missing row takes a gap lock (A8 review L3).
  const [current] = locked.publishedRevisionId
    ? await rowsOf<{ slug: string | null; revision_id: string }>(tx, sql`SELECT slug, revision_id FROM published_documents WHERE entity_type = ${locked.type} AND entity_id = ${locked.id} FOR UPDATE`)
    : [];
  const newSlug = typeof (snapshot.root as Record<string, unknown> | undefined)?.slug === "string" ? String((snapshot.root as Record<string, unknown>).slug) : null;
  const plan = routable ? await planSlugRedirects(tx, locked.type as RoutableType, locked.id, current?.slug ?? null, newSlug) : null;
  if (plan) issues.push(...plan.issues);
  if (issues.some((i) => i.blocking)) throw new Rollback({ kind: "refused", message: "This version can't be published yet.", issues }, { action: options.stepName, outcome: "failed", summary: `Refused: ${what(locked)} can't be published yet (${issues.filter((i) => i.blocking).map((i) => i.code).join(", ")}).` });

  const written = await writeRevision(tx, { type: locked.type, id: locked.id, kind: "publish", actorId: change.actor.user.id, now, force: true, message: options.message, restoredFromId: options.restoredFromId ?? null });
  if (!written) return { kind: "not_found" };
  if (locked.publishedRevisionId) await tx.execute(sql`UPDATE revisions SET live_until = ${now} WHERE id = ${locked.publishedRevisionId} AND live_until IS NULL`);
  await setRoot(
    tx,
    locked,
    change.actor.user.id,
    now,
    sql`publication_status = 'published', draft_status = 'none', published_revision_id = ${written.id}, published_at = ${now}, published_by = ${change.actor.user.id}, first_published_at = COALESCE(first_published_at, ${now})`,
  );
  markRecorded(tx, locked.type, locked.id, await versionNow(tx, locked.type, locked.id));
  const projection = projectSnapshot(locked.type, written.snapshot);
  const json = canonicalJson(projection.document);
  // The live document: inserted on a first publication, otherwise updated by its own key. Never `ON DUPLICATE KEY
  // UPDATE`, which fires on any unique key — a slug taken by another live record meanwhile would have overwritten that
  // record's document. The slug's unique index is the final word (the check above reads without locks, so two first
  // publications never share a gap lock and deadlock: A8 review L3); a collision refuses the publication.
  try {
    if (current) {
      await tx.execute(
        sql`UPDATE published_documents SET revision_id = ${written.id}, slug = ${projection.slug}, schema_version = ${projection.schemaVersion}, document = ${json},
              content_sha256 = ${sha256(json)}, published_at = ${now} WHERE entity_type = ${locked.type} AND entity_id = ${locked.id}`,
      );
    } else {
      await tx.execute(
        sql`INSERT INTO published_documents (entity_type, entity_id, revision_id, slug, schema_version, document, content_sha256, published_at)
            VALUES (${locked.type}, ${locked.id}, ${written.id}, ${projection.slug}, ${projection.schemaVersion}, ${json}, ${sha256(json)}, ${now})`,
      );
    }
  } catch (error) {
    if (duplicateKey(error) !== "uq_published_documents_slug") throw error;
    const message = `Another live ${AGGREGATES[locked.type].one} already uses the address “${projection.slug ?? ""}”.`;
    throw new Rollback({ kind: "refused", message: "This version can't be published yet.", issues: [{ code: "slug.live", message, blocking: true }] }, { action: options.stepName, outcome: "failed", summary: `Refused: ${what(locked)} can't be published yet (slug.live).` });
  }
  // A first publication has no published references yet (going offline removes them): insert only.
  await writeReferences(tx, locked.type, locked.id, "published", referencesOfSnapshot(locked.type, shownSnapshot(written.snapshot)), current ? undefined : []);
  const redirected = plan ? await applySlugRedirects(tx, plan, locked.type as RoutableType, locked.id, change.actor.user.id, now) : null;
  await tx.execute(sql`UPDATE review_comments SET status = 'resolved', resolved_by = ${change.actor.user.id}, resolved_at = ${now} WHERE entity_type = ${locked.type} AND entity_id = ${locked.id} AND status = 'open'`);
  const tags = tagsFor(locked.type, locked.id, [current?.slug ?? null, projection.slug]);
  if (!deferInvalidations(tx, tags, change.meta.requestId)) await recordInvalidations(tx, tags, change.meta.requestId, now);
  const warnings = issues.filter((i) => !i.blocking).map((i) => i.message);
  const notes = [...(plan?.notes ?? [])];
  const redirectNote = redirected && redirected.created + redirected.reactivated ? ` Added ${redirected.created + redirected.reactivated} redirect${redirected.created + redirected.reactivated === 1 ? "" : "s"} from the old address.` : "";
  await audit(tx, change, now, locked, {
    action: options.stepName,
    summary: `${options.stepName === "rollback" ? "Rolled back and published" : "Published"} ${what(locked)}${options.fromReview ? " after review" : " without review"} (revision ${written.number}).${redirectNote}${warnings.length ? ` ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.` : ""}`,
    // A1 §4.3: the legal review's confirmation is kept with the publish revision and in the audit event (a staff name).
    changes: { reviewed: options.fromReview, revision: written.number, ...(options.legalReviewer ? { legalReviewer: options.legalReviewer } : {}), ...(redirected ? { redirects: redirected } : {}), warnings: warnings.length },
    before: locked.publishedRevisionId,
    after: written.id,
  });
  return { kind: "ok", summary: `Published (revision ${written.number}).`, lockVersion: locked.version + 1, revisionId: written.id, warnings: [...warnings, ...notes] };
}

/** Approve and publish (from review) or publish directly (from a draft): A1 T6 / T7, with the legal gate. */
export function publish(change: PublishingChange, type: AggregateType, id: string, expectedVersion: number, options: PublishOptions = {}): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "publish", null, expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.publication === "archived") return refuse(tx, change, now, locked, "publish", "This item is archived: restore it from the archive first.");
    if (locked.publication === "published" && locked.draft === "none") return refuse(tx, change, now, locked, "publish", "Nothing to publish: the working copy is already the live version.");
    const fromReview = locked.draft === "in_review";
    const submitter = fromReview ? await submitterOf(tx, type, id) : null;
    const may = fromReview ? canApprove(change.actor.permissions, type, locked.facts, change.actor.user.id, submitter) : allowed(change.actor.permissions, type, "publish", locked.facts);
    if (!may) {
      const why = fromReview && submitter === change.actor.user.id && allowed(change.actor.permissions, type, "publish_reviewed", locked.facts) ? " (a reviewer can't approve their own submission)" : "";
      await audit(tx, change, now, locked, { action: "publish", outcome: "denied", summary: `Refused: publishing ${what(locked)} needs ${keyList(type, "publish", locked.facts)}${AGGREGATES[type].review && locked.facts.pageType !== "legal" ? ` or, after someone else's submission, ${AGGREGATES[type].resource}.publish_reviewed` : ""}${why}.` });
      return { kind: "denied", message: `You don't have permission to publish this ${AGGREGATES[type].one}${why}.` };
    }
    const stepUp = await stepUpRefusal(tx, change, now, locked, "publish", "publish");
    if (stepUp) return stepUp;
    let message = cleanNote(options.message);
    let legalReviewer: string | null = null;
    if (locked.facts.pageType === "legal") {
      const reviewer = reviewerSchema.safeParse(typeof options.legalReviewer === "string" ? options.legalReviewer.trim() : "");
      if (!reviewer.success || !reviewer.data) {
        await audit(tx, change, now, locked, { action: "publish", outcome: "failed", summary: `Refused: ${what(locked)} is a legal page and its legal review was not confirmed.` });
        return { kind: "refused", message: "A legal page is published only once its legal text has been reviewed: say who reviewed it.", errors: { legalReviewer: "Say who reviewed the legal text." } };
      }
      legalReviewer = reviewer.data;
      message = `Legal text reviewed by ${reviewer.data}.${message ? ` ${message}` : ""}`.slice(0, PUBLISHING_LIMITS.message);
    }
    return publishLocked(tx, change, now, locked, { message, fromReview, stepName: "publish", legalReviewer });
  });
}

/** Unpublish (A1 T11): the live version goes offline; the working copy stays as a draft. */
export function unpublish(change: PublishingChange, type: AggregateType, id: string, expectedVersion: number): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "unpublish", "unpublish", expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.publication !== "published") return refuse(tx, change, now, locked, "unpublish", "This item is not published.");
    const impact = (await usedBy(tx, type, id)).filter((u) => u.scope === "published" && !(u.sourceType === type && u.sourceId === id));
    setIntent(tx, type, id, { kind: "unpublish" });
    await takeOffline(tx, type, id, now, change.meta.requestId);
    await setRoot(tx, locked, change.actor.user.id, now, sql`publication_status = 'unpublished', draft_status = 'draft', published_revision_id = NULL`);
    await audit(tx, change, now, locked, {
      action: "unpublish",
      summary: `Unpublished ${what(locked)}${impact.length ? `; ${impact.length} live item${impact.length === 1 ? "" : "s"} linked to it and now leave${impact.length === 1 ? "s" : ""} it out` : ""}.`,
      changes: { linkedFrom: impact.length },
      before: locked.publishedRevisionId,
    });
    return { kind: "ok", summary: "Unpublished: the working copy stays as a draft.", lockVersion: locked.version + 1, warnings: impact.map((u) => `${AGGREGATES[u.sourceType].one} ${u.label} linked to it.`) };
  });
}

// --- Restoring ------------------------------------------------------------------------------------------------------------

/** Restore an earlier version into the working copy (A1 T17): a new `restore` revision; the live version is untouched. */
export function restoreRevision(change: PublishingChange, type: AggregateType, id: string, revisionId: string, expectedVersion: number): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "restore_revision", "restore", expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.publication === "archived") return refuse(tx, change, now, locked, "restore_revision", "This item is archived: restore it from the archive first.");
    const revision = await readRevision(tx, type, id, revisionId, { lock: true });
    if (!revision) return refuse(tx, change, now, locked, "restore_revision", "That version is not part of this item's history.");
    setIntent(tx, type, id, { kind: "restore", restoredFromId: revision.id, message: `Restored revision ${revision.number}.` });
    const outcome = await restoreSnapshot(change, tx, type, id, revision.snapshot, expectedVersion);
    if (outcome.kind !== "ok") {
      const result = restoreRefusal(outcome);
      throw new Rollback(result, { action: "restore_revision", outcome: result.kind === "denied" ? "denied" : "failed", summary: `Refused: revision ${revision.number} of ${what(locked)} could not be restored (${outcome.kind}).` });
    }
    await audit(tx, change, now, locked, { action: "restore_revision", summary: `Restored revision ${revision.number} of ${what(locked)} into the working copy.${outcome.notes.length ? ` ${outcome.notes.join(" ")}` : ""}`, before: locked.currentRevisionId, changes: { revision: revision.number } });
    return { kind: "ok", summary: `Restored revision ${revision.number} into the working copy. The live version is unchanged until someone publishes.`, lockVersion: await versionNow(tx, type, id), warnings: outcome.notes };
  });
}

/** Discard the draft changes of a published item (A1 T10): the working copy goes back to the live version. */
export function discardChanges(change: PublishingChange, type: AggregateType, id: string, expectedVersion: number): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "discard", "edit", expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.publication !== "published" || !locked.publishedRevisionId) return refuse(tx, change, now, locked, "discard", "Only a published item's draft changes can be discarded.");
    if (locked.draft === "none") return refuse(tx, change, now, locked, "discard", "There are no draft changes to discard.");
    const live = await readRevision(tx, type, id, locked.publishedRevisionId, { lock: true });
    if (!live) return { kind: "not_found" };
    setIntent(tx, type, id, { kind: "restore", restoredFromId: live.id, message: "Discarded the draft changes: back to the live version.", draft: "none" });
    const outcome = await restoreSnapshot(change, tx, type, id, live.snapshot, expectedVersion);
    if (outcome.kind !== "ok") {
      const result = restoreRefusal(outcome);
      throw new Rollback(result, { action: "discard", outcome: result.kind === "denied" ? "denied" : "failed", summary: `Refused: the draft changes of ${what(locked)} could not be discarded (${outcome.kind}).` });
    }
    // "No draft changes" only when the working copy now equals the live version: a restore keeps what this person may not
    // change (robots / canonical / sitemap without seo.advanced, project flags, a layout the live version never set up),
    // and those leave a difference that stays a draft (A8 review L2).
    const after = await readSnapshot(tx, type, id);
    const same = after !== null && canonicalJson(after) === canonicalJson(live.snapshot);
    setIntent(tx, type, id, { kind: "restore", restoredFromId: live.id, message: "Discarded the draft changes: back to the live version.", draft: same ? "none" : "draft" });
    await audit(tx, change, now, locked, { action: "discard", summary: `Discarded the draft changes of ${what(locked)} (back to revision ${live.number}, the live version${same ? "" : "; some settings this person may not change stay as they were, so it remains a draft"}).`, before: locked.currentRevisionId });
    return {
      kind: "ok",
      summary: same ? "Discarded: the working copy is the live version again." : "Discarded what you may change. Some settings you may not change differ from the live version, so it stays a draft.",
      lockVersion: await versionNow(tx, type, id),
      warnings: outcome.notes,
    };
  });
}

/**
 * Roll back to an earlier published version (A8.2): that version is restored into the working copy and published, in
 * one transaction, through the strict check of today (references, media, flags and the legal gate as they are now).
 */
export function rollback(change: PublishingChange, type: AggregateType, id: string, revisionId: string, expectedVersion: number, options: PublishOptions = {}): Promise<WorkflowResult> {
  return step(change, type, id, async (tx, now) => {
    const locked = await begin(tx, change, now, type, id, "rollback", "publish", expectedVersion);
    if (isResult(locked)) return locked;
    if (locked.publication === "archived") return refuse(tx, change, now, locked, "rollback", "This item is archived: restore it from the archive first.");
    const revision = await readRevision(tx, type, id, revisionId, { lock: true });
    if (!revision || revision.kind !== "publish") return refuse(tx, change, now, locked, "rollback", "Only a version that was published can be rolled back to.");
    if (revision.id === locked.publishedRevisionId && locked.draft === "none") return refuse(tx, change, now, locked, "rollback", "That version is already the live version.");
    let message: string | null = `Rolled back to revision ${revision.number}.`;
    let legalReviewer: string | null = null;
    if (locked.facts.pageType === "legal") {
      const reviewer = reviewerSchema.safeParse(typeof options.legalReviewer === "string" ? options.legalReviewer.trim() : "");
      if (!reviewer.success || !reviewer.data) {
        await audit(tx, change, now, locked, { action: "rollback", outcome: "failed", summary: `Refused: ${what(locked)} is a legal page and its legal review was not confirmed.` });
        return { kind: "refused", message: "A legal page is published only once its legal text has been reviewed: say who reviewed it.", errors: { legalReviewer: "Say who reviewed the legal text." } };
      }
      legalReviewer = reviewer.data;
      message = `${message} Legal text reviewed by ${reviewer.data}.`;
    }
    setIntent(tx, type, id, { kind: "restore", restoredFromId: revision.id, message: `Restored revision ${revision.number} to roll back.` });
    const outcome = await restoreSnapshot(change, tx, type, id, revision.snapshot, expectedVersion);
    if (outcome.kind !== "ok") {
      const result = restoreRefusal(outcome);
      throw new Rollback(result, { action: "rollback", outcome: result.kind === "denied" ? "denied" : "failed", summary: `Refused: ${what(locked)} could not be rolled back to revision ${revision.number} (${outcome.kind}).` });
    }
    await revisionNow(tx, type, id, "restore", change.actor.user.id, now, { restoredFromId: revision.id, message: `Restored revision ${revision.number} to roll back.` });
    const relocked = await lockAggregate(tx, type, id);
    if (!relocked) return { kind: "not_found" };
    return publishLocked(tx, change, now, relocked, { message, fromReview: false, restoredFromId: revision.id, stepName: "rollback", legalReviewer });
  });
}

// --- Reading ---------------------------------------------------------------------------------------------------------------

export interface PublishingState {
  type: AggregateType;
  id: string;
  version: number;
  publication: Locked["publication"];
  draft: Locked["draft"];
  publishedRevisionId: string | null;
  submitterId: string | null;
  comments: { id: string; body: string; status: string; authorName: string | null; createdAt: Date }[];
  issues: PublishIssue[];
  can: { submit: boolean; review: boolean; publish: boolean; unpublish: boolean; restore: boolean; edit: boolean; withdraw: boolean };
  facts: RecordFacts;
}

/** What the publishing panel shows: the state, open comments, today's check of the working copy and what this person may do. */
export async function readPublishing(db: Db, actor: Actor, type: AggregateType, id: string): Promise<PublishingState | null> {
  const status = await readRootStatus(db, type, id);
  if (!status) return null;
  const [pageRow] = type === "page" ? await rowsOf<{ page_type: string }>(db, sql`SELECT page_type FROM pages WHERE id = ${id}`) : [];
  const facts: RecordFacts = pageRow ? { pageType: pageRow.page_type as PageType } : {};
  const snapshot = await readSnapshot(db, type, id);
  const issues = snapshot && status.publicationStatus !== "archived" ? await publicationIssuesReadOnly(db, type, id, snapshot) : [];
  const submitterId = status.draftStatus === "in_review" ? await submitterOf(db, type, id) : null;
  const comments = await rowsOf<{ id: string; body: string; status: string; display_name: string | null; created_at: unknown }>(
    db,
    sql`SELECT c.id, c.body, c.status, u.display_name, c.created_at FROM review_comments c LEFT JOIN users u ON u.id = c.author_id
         WHERE c.entity_type = ${type} AND c.entity_id = ${id} ORDER BY c.created_at DESC LIMIT 20`,
  );
  const p = actor.permissions;
  return {
    type,
    id,
    version: status.lockVersion,
    publication: status.publicationStatus,
    draft: status.draftStatus,
    publishedRevisionId: status.publishedRevisionId,
    submitterId,
    comments: comments.map((c) => ({ id: c.id, body: c.body, status: c.status, authorName: c.display_name, createdAt: instantOf(c.created_at) ?? new Date(0) })),
    issues,
    facts,
    can: {
      submit: AGGREGATES[type].review && allowed(p, type, "submit", facts),
      review: AGGREGATES[type].review && allowed(p, type, "review", facts),
      publish: status.draftStatus === "in_review" ? canApprove(p, type, facts, actor.user.id, submitterId) : allowed(p, type, "publish", facts),
      unpublish: allowed(p, type, "unpublish", facts),
      restore: allowed(p, type, "restore", facts),
      edit: allowed(p, type, "edit", facts),
      withdraw: submitterId === actor.user.id || allowed(p, type, "edit", facts),
    },
  };
}

/** The strict check without locks (the panel's preview of what publishing would say). */
async function publicationIssuesReadOnly(db: Db, type: AggregateType, id: string, snapshot: Record<string, unknown>): Promise<PublishIssue[]> {
  try {
    return await publicationIssues(db, type, id, snapshot);
  } catch {
    return [];
  }
}

export type { WorkflowAction } from "./registry.ts";
export const workflowAggregate = (value: string) => (Object.hasOwn(AGGREGATES, value) ? (value as AggregateType) : null);
