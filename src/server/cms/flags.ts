/**
 * Project safety flags (A1-CONTENT-MODEL §8.2; A3 brief §24, §38): a project is made more restrictive by adding a flag
 * (`projects.add_flags`: every role) and less restrictive only by clearing one (`projects.clear_flags`: Owner and
 * Admin), with a note that the audit event keeps. Every change runs under the project's row lock, inside the content
 * transaction (the acting user and session still valid).
 *
 * - **No stale clearing.** The page names the flag instance it offers to clear (`flagToken`: the time it was added); a
 *   flag cleared and added again since is a newer restriction, and a page opened before cannot clear it.
 * - **Adding never needs the item's version**: it only ever restricts, so it cannot overwrite anyone's decision, and an
 *   archived project can still be restricted. Clearing on an archived project waits until it is restored (read-only).
 * - Flags never change the editor's version (`lock_version`): the editor form does not carry them.
 *
 * Nothing here publishes or approves anything: a flag only records a restriction for the publishing step (A8/A9) and
 * the media library (A4).
 */
import { and, asc, eq } from "drizzle-orm";
import { users } from "../db/schema.ts";
import { projectFlags, projectTranslations } from "../db/schema-cms.ts";
import { isUlid } from "../security/ids.ts";
import type { ChangeContext } from "./engine.ts";
import { flagLabel, isBlockingFlag, isKnownFlag, LIMITS, PROJECT_FLAGS, type FlagInfo } from "./registry.ts";
import { decideFlagChange, flagToken } from "./restrictions.ts";
import { contentAudit, contentTransaction, labelOf, lockRoot } from "./store.ts";
import type { Db } from "../db/client.ts";
import { charLength, normalizeNewlines, textProblem, TEXT_PROBLEM_MESSAGES } from "./text.ts";

export interface FlagView {
  flag: string;
  label: string;
  description: string | null;
  blocking: boolean;
  known: boolean;
  note: string | null;
  createdAt: Date;
  createdBy: string | null;
  /** Names this instance of the flag for a clear request. */
  token: string;
}

export async function listProjectFlags(db: Db, projectId: string): Promise<FlagView[]> {
  if (!isUlid(projectId)) return [];
  const rows = await db
    .select({ flag: projectFlags.flag, note: projectFlags.note, createdAt: projectFlags.createdAt, createdBy: users.displayName })
    .from(projectFlags)
    .leftJoin(users, eq(users.id, projectFlags.createdBy))
    .where(eq(projectFlags.projectId, projectId))
    .orderBy(asc(projectFlags.createdAt), asc(projectFlags.flag));
  return rows.map((r) => ({
    flag: r.flag,
    label: flagLabel(r.flag),
    description: (PROJECT_FLAGS as Record<string, FlagInfo>)[r.flag]?.description ?? null,
    blocking: isBlockingFlag(r.flag),
    known: isKnownFlag(r.flag),
    note: r.note,
    createdAt: r.createdAt,
    createdBy: r.createdBy ?? null,
    token: flagToken(r.createdAt),
  }));
}

export type FlagResult =
  | { kind: "ok"; summary: string }
  | { kind: "unchanged"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "stale"; message: string }
  | { kind: "denied"; message: string }
  | { kind: "not_found" };

/** A note: plain text, trimmed, at most `max` characters; "" when empty. */
function noteProblem(note: string, max: number): string | null {
  if (charLength(note) > max) return `Use at most ${max} characters.`;
  const problem = textProblem(note, { multiline: true });
  return problem ? TEXT_PROBLEM_MESSAGES[problem] : null;
}

async function projectTitle(db: Db, id: string): Promise<string> {
  const rows = await db.select({ locale: projectTranslations.locale, title: projectTranslations.title }).from(projectTranslations).where(eq(projectTranslations.projectId, id));
  return rows.find((r) => r.locale === "en")?.title || rows.find((r) => r.locale === "ar")?.title || "";
}

/** Adds a restriction (idempotent: a flag already set stays as it is). */
export async function addProjectFlag(ctx: ChangeContext, projectId: string, flag: string, rawNote: string): Promise<FlagResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(projectId)) return { kind: "not_found" };
  const decision = decideFlagChange(actor.permissions, "add", flag);
  if (!decision.ok && decision.reason === "permission") {
    await contentAudit(deps.db, actor, meta, deps.clock(), {
      action: "project.restriction_add",
      type: "project",
      id: projectId,
      outcome: "denied",
      summary: "Refused: adding a project flag needs projects.add_flags.",
    });
    return { kind: "denied", message: "You don't have permission to add flags." };
  }
  if (!decision.ok) return { kind: "invalid", message: "Choose one of the listed flags." };
  const note = normalizeNewlines(rawNote).trim();
  const problem = noteProblem(note, LIMITS.text.flagNote);
  if (problem) return { kind: "invalid", message: `Note: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const state = await lockRoot(tx, "project", projectId);
    if (!state) return { kind: "not_found" } as const;
    const [existing] = await tx.select({ flag: projectFlags.flag }).from(projectFlags).where(and(eq(projectFlags.projectId, projectId), eq(projectFlags.flag, flag)));
    if (existing) return { kind: "unchanged", message: `“${flagLabel(flag)}” is already set on this project.` } as const;
    await tx.insert(projectFlags).values({ projectId, flag, note: note || null, createdAt: now, createdBy: actor.user.id });
    const title = await projectTitle(tx, projectId);
    await contentAudit(tx, actor, meta, now, {
      action: "project.restriction_add",
      type: "project",
      id: projectId,
      label: title || state.slug,
      summary: `Added the flag “${flagLabel(flag)}” to project ${labelOf(title, state.slug)}${isBlockingFlag(flag) ? " (blocking)" : ""}.`,
      changes: { after: { flag }, ...(note ? { reason: note } : {}) },
    });
    return { kind: "ok", summary: `Added “${flagLabel(flag)}”.` } as const;
  });
}

/**
 * Clears one instance of a flag (`token`), with a note that says why. Refused without `projects.clear_flags`, on an
 * archived project, and when the flag the page showed was cleared or replaced since.
 */
export async function clearProjectFlag(ctx: ChangeContext, projectId: string, flag: string, token: string, rawNote: string): Promise<FlagResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(projectId) || !/^[a-z0-9_]{1,32}$/.test(flag) || !/^[0-9]{1,16}$/.test(token)) return { kind: "not_found" };
  const note = normalizeNewlines(rawNote).trim();
  const decision = decideFlagChange(actor.permissions, "clear", flag, note);
  if (!decision.ok && decision.reason === "permission") {
    await contentAudit(deps.db, actor, meta, deps.clock(), {
      action: "project.restriction_clear",
      type: "project",
      id: projectId,
      outcome: "denied",
      summary: `Refused: clearing the flag “${flagLabel(flag)}” needs projects.clear_flags (Owner or Admin).`,
    });
    return { kind: "denied", message: "Only an Owner or Admin can clear a flag." };
  }
  if (!decision.ok) return { kind: "invalid", message: "Say why the flag can be cleared (at least 3 characters)." };
  const problem = noteProblem(note, LIMITS.text.clearNote);
  if (problem) return { kind: "invalid", message: `Reason: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const state = await lockRoot(tx, "project", projectId);
    if (!state) return { kind: "not_found" } as const;
    const title = await projectTitle(tx, projectId);
    const refuse = async (summary: string) =>
      contentAudit(tx, actor, meta, now, { action: "project.restriction_clear", type: "project", id: projectId, label: title || state.slug, outcome: "failed", summary });
    if (state.publicationStatus === "archived") {
      await refuse(`Refused: clearing the flag “${flagLabel(flag)}” on an archived project (read-only until restored).`);
      return { kind: "invalid", message: "This project is archived and read-only. Restore it before clearing a flag." } as const;
    }
    const [current] = await tx
      .select({ createdAt: projectFlags.createdAt })
      .from(projectFlags)
      .where(and(eq(projectFlags.projectId, projectId), eq(projectFlags.flag, flag)));
    if (!current) {
      await refuse(`Refused: the flag “${flagLabel(flag)}” was already cleared.`);
      return { kind: "stale", message: "This flag was already cleared. Reload the page." } as const;
    }
    if (flagToken(current.createdAt) !== token) {
      await refuse(`Refused: the flag “${flagLabel(flag)}” was set again after the page was opened.`);
      return { kind: "stale", message: "This flag was set again after you opened the page. Reload and review it before clearing it." } as const;
    }
    await tx.delete(projectFlags).where(and(eq(projectFlags.projectId, projectId), eq(projectFlags.flag, flag)));
    await contentAudit(tx, actor, meta, now, {
      action: "project.restriction_clear",
      type: "project",
      id: projectId,
      label: title || state.slug,
      summary: `Cleared the flag “${flagLabel(flag)}” from project ${labelOf(title, state.slug)}${isBlockingFlag(flag) ? " (blocking)" : ""}.`,
      changes: { before: { flag }, reason: note },
    });
    return { kind: "ok", summary: `Cleared “${flagLabel(flag)}”.` } as const;
  });
}
