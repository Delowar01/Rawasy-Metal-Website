/**
 * Media folders (A4 brief §36): organization only — a folder never changes an address, a storage key or anything
 * public. Create, rename, move (nest), reorder among siblings, and delete only an empty folder (no subfolder, no item,
 * the Trash's items included). Names are plain text on one line, without path separators or control characters, unique
 * among their siblings (case and accents as the database collation compares them); no folder is its own ancestor;
 * at most 6 levels and 500 folders.
 *
 * Every change runs in the content transaction (acting user and session still valid) holding the whole folder tree's
 * rows FOR UPDATE (at most 500 small rows), so two changes to the tree never interleave: a cycle or a duplicate name
 * can never be committed by two requests that each looked fine alone. Needs `media.edit` (Owner, Admin, Editor).
 */
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mediaFolders } from "../db/schema-media.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { charLength, textProblem, TEXT_PROBLEM_MESSAGES } from "../cms/text.ts";
import { isUlid, ulid } from "../security/ids.ts";
import { MEDIA_LIMITS } from "./registry.ts";
import { mediaAudit, type MediaContext, type MediaResult } from "./service.ts";

export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
}

export interface FolderNode extends FolderRow {
  depth: number;
  /** "Projects / 2026 / Site photos" */
  path: string;
  children: number;
  items: number;
}

/** A folder name: NFC, trimmed, one line, no "/" or "\\", no control or direction characters, 1–120 characters. */
export function folderNameProblem(raw: string): { name: string } | { problem: string } {
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!name) return { problem: "Write a name." };
  if (charLength(name) > MEDIA_LIMITS.folderNameMax) return { problem: `Use at most ${MEDIA_LIMITS.folderNameMax} characters.` };
  if (/[/\\]/.test(name)) return { problem: "A folder name can't contain / or \\." };
  if (name === "." || name === "..") return { problem: "Choose another name." };
  const problem = textProblem(name, { multiline: false });
  if (problem) return { problem: TEXT_PROBLEM_MESSAGES[problem] };
  return { name };
}

/** The whole tree, in display order (parents before children, siblings by position then name). */
export async function folderTree(db: Db): Promise<FolderNode[]> {
  const rows = await db.select({ id: mediaFolders.id, parentId: mediaFolders.parentId, name: mediaFolders.name, position: mediaFolders.position }).from(mediaFolders).orderBy(asc(mediaFolders.position), asc(mediaFolders.name));
  const counts = await rowsOf<{ folder_id: string; n: number }>(db, sql`SELECT folder_id, COUNT(*) AS n FROM media_assets WHERE folder_id IS NOT NULL GROUP BY folder_id`);
  const items = new Map(counts.map((c) => [c.folder_id, Number(c.n)]));
  const byParent = new Map<string | null, FolderRow[]>();
  for (const row of rows) byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row]);
  const out: FolderNode[] = [];
  const visit = (parent: string | null, depth: number, prefix: string) => {
    for (const row of byParent.get(parent) ?? []) {
      const path = prefix ? `${prefix} / ${row.name}` : row.name;
      out.push({ ...row, depth, path, children: (byParent.get(row.id) ?? []).length, items: items.get(row.id) ?? 0 });
      if (depth < 20) visit(row.id, depth + 1, path);
    }
  };
  visit(null, 0, "");
  return out;
}

/** Locks every folder row (FOR UPDATE) and returns them: the tree, decided on its latest state. */
async function lockTree(tx: Db): Promise<FolderRow[]> {
  return tx.select({ id: mediaFolders.id, parentId: mediaFolders.parentId, name: mediaFolders.name, position: mediaFolders.position }).from(mediaFolders).for("update");
}

const depthOf = (rows: readonly FolderRow[], id: string | null): number => {
  let depth = 0;
  for (let current = id; current && depth <= 64; depth++) current = rows.find((r) => r.id === current)?.parentId ?? null;
  return depth;
};

/** Whether `candidate` is `id` or one of its descendants. */
const isWithin = (rows: readonly FolderRow[], id: string, candidate: string | null): boolean => {
  for (let current = candidate, steps = 0; current && steps <= 64; steps++) {
    if (current === id) return true;
    current = rows.find((r) => r.id === current)?.parentId ?? null;
  }
  return false;
};

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;

/** The deepest level below a folder (0 for a folder without subfolders). */
const heightOf = (rows: readonly FolderRow[], id: string): number => {
  const children = rows.filter((r) => r.parentId === id);
  return children.length ? 1 + Math.max(...children.map((c) => heightOf(rows, c.id))) : 0;
};

const denied = { kind: "denied", message: "You don't have permission to organize media folders." } as const;

export async function createFolder(ctx: MediaContext, rawName: string, parentId: string | null): Promise<MediaResult & { id?: string }> {
  if (!ctx.actor.permissions.has("media.edit")) return denied;
  const checked = folderNameProblem(rawName);
  if ("problem" in checked) return { kind: "invalid", message: checked.problem, errors: { name: checked.problem } };
  if (parentId !== null && !isUlid(parentId)) return { kind: "not_found" };
  return contentTransaction(ctx.deps, ctx.actor, async (tx, now) => {
    const rows = await lockTree(tx);
    if (rows.length >= MEDIA_LIMITS.folders) return { kind: "refused", message: `The library holds the most folders allowed (${MEDIA_LIMITS.folders}).` } as const;
    if (parentId && !rows.some((r) => r.id === parentId)) return { kind: "not_found" } as const;
    if (depthOf(rows, parentId) + 1 > MEDIA_LIMITS.folderDepth) return { kind: "refused", message: `Folders go at most ${MEDIA_LIMITS.folderDepth} levels deep.` } as const;
    const siblings = rows.filter((r) => r.parentId === parentId);
    if (siblings.some((s) => sameName(s.name, checked.name))) return { kind: "invalid", message: "A folder with this name is already there.", errors: { name: "A folder with this name is already there." } } as const;
    const id = ulid(now.getTime());
    await tx.insert(mediaFolders).values({ id, parentId, name: checked.name, position: Math.max(0, ...siblings.map((s) => s.position)) + 1, createdAt: now, createdBy: ctx.actor.user.id, updatedAt: now, updatedBy: ctx.actor.user.id });
    await mediaAudit(tx, ctx.actor, ctx.meta, now, { action: "media_folder.create", id, label: checked.name, summary: `Created the media folder “${checked.name}”.` });
    return { kind: "ok", summary: `Created “${checked.name}”.`, id } as const;
  });
}

export async function renameFolder(ctx: MediaContext, id: string, rawName: string): Promise<MediaResult> {
  if (!ctx.actor.permissions.has("media.edit")) return denied;
  if (!isUlid(id)) return { kind: "not_found" };
  const checked = folderNameProblem(rawName);
  if ("problem" in checked) return { kind: "invalid", message: checked.problem, errors: { name: checked.problem } };
  return contentTransaction(ctx.deps, ctx.actor, async (tx, now) => {
    const rows = await lockTree(tx);
    const folder = rows.find((r) => r.id === id);
    if (!folder) return { kind: "not_found" } as const;
    if (folder.name === checked.name) return { kind: "unchanged", message: "The name is the same." } as const;
    if (rows.some((r) => r.parentId === folder.parentId && r.id !== id && sameName(r.name, checked.name))) {
      return { kind: "invalid", message: "A folder with this name is already there.", errors: { name: "A folder with this name is already there." } } as const;
    }
    await tx.update(mediaFolders).set({ name: checked.name, updatedAt: now, updatedBy: ctx.actor.user.id }).where(eq(mediaFolders.id, id));
    await mediaAudit(tx, ctx.actor, ctx.meta, now, { action: "media_folder.rename", id, label: checked.name, summary: `Renamed the media folder “${folder.name}” to “${checked.name}”.` });
    return { kind: "ok", summary: `Renamed to “${checked.name}”.` } as const;
  });
}

/** Moves a folder under another (or to the top level): never into itself or its own subfolders. */
export async function moveFolder(ctx: MediaContext, id: string, parentId: string | null): Promise<MediaResult> {
  if (!ctx.actor.permissions.has("media.edit")) return denied;
  if (!isUlid(id) || (parentId !== null && !isUlid(parentId))) return { kind: "not_found" };
  return contentTransaction(ctx.deps, ctx.actor, async (tx, now) => {
    const rows = await lockTree(tx);
    const folder = rows.find((r) => r.id === id);
    if (!folder || (parentId && !rows.some((r) => r.id === parentId))) return { kind: "not_found" } as const;
    if (folder.parentId === parentId) return { kind: "unchanged", message: "The folder is already there." } as const;
    if (parentId && isWithin(rows, id, parentId)) return { kind: "refused", message: "A folder can't be moved into itself or one of its own subfolders." } as const;
    if (depthOf(rows, parentId) + 1 + heightOf(rows, id) > MEDIA_LIMITS.folderDepth) return { kind: "refused", message: `Folders go at most ${MEDIA_LIMITS.folderDepth} levels deep.` } as const;
    const siblings = rows.filter((r) => r.parentId === parentId);
    if (siblings.some((s) => sameName(s.name, folder.name))) return { kind: "refused", message: `A folder named “${folder.name}” is already there. Rename one first.` } as const;
    await tx
      .update(mediaFolders)
      .set({ parentId, position: Math.max(0, ...siblings.map((s) => s.position)) + 1, updatedAt: now, updatedBy: ctx.actor.user.id })
      .where(eq(mediaFolders.id, id));
    const target = parentId ? rows.find((r) => r.id === parentId)!.name : "the top level";
    await mediaAudit(tx, ctx.actor, ctx.meta, now, { action: "media_folder.move", id, label: folder.name, summary: `Moved the media folder “${folder.name}” to ${parentId ? `“${target}”` : target}.` });
    return { kind: "ok", summary: "Moved." } as const;
  });
}

/** Moves a folder one place up or down among its siblings (exchanging positions through a free value). */
export async function reorderFolder(ctx: MediaContext, id: string, direction: "up" | "down"): Promise<MediaResult> {
  if (!ctx.actor.permissions.has("media.edit")) return denied;
  if (!isUlid(id)) return { kind: "not_found" };
  return contentTransaction(ctx.deps, ctx.actor, async (tx, now) => {
    const rows = await lockTree(tx);
    const folder = rows.find((r) => r.id === id);
    if (!folder) return { kind: "not_found" } as const;
    const siblings = rows.filter((r) => r.parentId === folder.parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const index = siblings.findIndex((s) => s.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return { kind: "unchanged", message: direction === "up" ? "It is already first." : "It is already last." } as const;
    // Siblings are renumbered 1, 2, 3 … in their shown order with the two exchanged (positions need not be unique).
    const next = [...siblings];
    [next[index], next[target]] = [next[target], next[index]];
    for (const [i, row] of next.entries()) {
      if (row.position !== i + 1) await tx.update(mediaFolders).set({ position: i + 1, updatedAt: now, updatedBy: ctx.actor.user.id }).where(eq(mediaFolders.id, row.id));
    }
    await mediaAudit(tx, ctx.actor, ctx.meta, now, { action: "media_folder.reorder", id, label: folder.name, summary: `Moved the media folder “${folder.name}” ${direction}.` });
    return { kind: "ok", summary: `Moved ${direction}.` } as const;
  });
}

/** Deletes an empty folder: no subfolder and no item in it (items in the Trash count: restore or move them first). */
export async function deleteFolder(ctx: MediaContext, id: string): Promise<MediaResult> {
  if (!ctx.actor.permissions.has("media.edit")) return denied;
  if (!isUlid(id)) return { kind: "not_found" };
  return contentTransaction(ctx.deps, ctx.actor, async (tx, now) => {
    const rows = await lockTree(tx);
    const folder = rows.find((r) => r.id === id);
    if (!folder) return { kind: "not_found" } as const;
    if (rows.some((r) => r.parentId === id)) return { kind: "refused", message: "This folder has subfolders. Move or delete them first." } as const;
    // A locking read: an item moved into the folder at the same moment is seen (or waits until this change commits).
    const [held] = await rowsOf<{ n: number; trashed: number }>(
      tx,
      sql`SELECT COUNT(*) AS n, COALESCE(SUM(deleted_at IS NOT NULL), 0) AS trashed FROM media_assets WHERE folder_id = ${id} LOCK IN SHARE MODE`,
    );
    const count = Number(held?.n ?? 0);
    if (count > 0) {
      const trashed = Number(held?.trashed ?? 0);
      return {
        kind: "refused",
        message: `This folder holds ${count} item${count === 1 ? "" : "s"}${trashed ? ` (${trashed} in the Trash)` : ""}. Move them first.`,
      } as const;
    }
    await tx.delete(mediaFolders).where(eq(mediaFolders.id, id));
    await mediaAudit(tx, ctx.actor, ctx.meta, now, { action: "media_folder.delete", id, label: folder.name, summary: `Deleted the empty media folder “${folder.name}”.` });
    return { kind: "ok", summary: `Deleted “${folder.name}”.` } as const;
  });
}
