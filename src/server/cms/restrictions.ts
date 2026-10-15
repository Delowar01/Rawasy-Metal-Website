/**
 * The direction of a safety change (A1-SECURITY-RBAC §5.3; A3 brief §24, §38). Making a project more restrictive is
 * open to every role (`projects.add_flags`); making it less restrictive — clearing any flag, blocking or not — needs
 * `projects.clear_flags` (Owner, Admin) and a note. Only flags the registry knows can be added; a flag the code does not
 * know (an older or newer release's) blocks, and can still be cleared by those allowed to clear.
 *
 * Pure: the services decide with the permissions of the acting session and the flags read under the project's lock.
 */
import { isBlockingFlag, isKnownFlag } from "./registry.ts";

export type FlagChange = "add" | "clear";

export type FlagDecision = { ok: true } | { ok: false; reason: "permission" | "unknown_flag" | "note_required" };

export const ADD_FLAG_PERMISSION = "projects.add_flags";
export const CLEAR_FLAG_PERMISSION = "projects.clear_flags";

export function decideFlagChange(permissions: ReadonlySet<string>, change: FlagChange, flag: string, note?: string | null): FlagDecision {
  if (change === "add") {
    if (!permissions.has(ADD_FLAG_PERMISSION)) return { ok: false, reason: "permission" };
    if (!isKnownFlag(flag)) return { ok: false, reason: "unknown_flag" };
    return { ok: true };
  }
  if (!permissions.has(CLEAR_FLAG_PERMISSION)) return { ok: false, reason: "permission" };
  if (!note || note.trim().length < 3) return { ok: false, reason: "note_required" };
  return { ok: true };
}

export type RestrictionLevel = "blocked" | "flagged" | "clear";

/** A project's restriction: blocked by any blocking (or unknown) flag; flagged by informative flags only. */
export function restrictionLevel(flags: readonly string[]): RestrictionLevel {
  if (flags.some(isBlockingFlag)) return "blocked";
  return flags.length ? "flagged" : "clear";
}

const RANK: Record<RestrictionLevel, number> = { clear: 0, flagged: 1, blocked: 2 };

/** Whether a change of flags leaves a project at least as restricted as before (adding never lowers it). */
export const isAtLeastAsRestrictive = (before: readonly string[], after: readonly string[]) =>
  before.every((flag) => after.includes(flag)) && RANK[restrictionLevel(after)] >= RANK[restrictionLevel(before)];

/**
 * The token that names one instance of a flag on a page: the time it was added (ms). A page that offers "clear" for an
 * instance that was cleared and added again since cannot clear the newer one (A3 brief §24).
 */
export const flagToken = (createdAt: Date) => String(createdAt.getTime());
