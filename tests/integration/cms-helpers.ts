/**
 * Helpers of the Core CMS (A3) integration tests: signed-in actors of the four roles, forms built the way a browser
 * sends them (through `formToObject`, the Server Actions' own reader) and audit lookups. Test data only: every name
 * here is an obvious fictional example ("Test Laser Service", "Demo Project"), never RAWASY content.
 */
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Actor } from "../../src/server/auth/types.ts";
import type { ChangeContext } from "../../src/server/cms/engine.ts";
import { formToObject, type FormObject } from "../../src/server/cms/form.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents } from "../../src/server/db/schema.ts";
import { rebuildMediaSearch } from "../../src/server/media/service.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { actorFor, createUser, meta, type TestEnv } from "./helpers.ts";

export type Fields = Record<string, string | string[] | undefined | null>;

/** A form as a browser sends it: repeated names for lists, nothing for an empty checkbox. */
export function formOf(fields: Fields): FormObject {
  const entries: [string, string][] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) entries.push([name, v]);
  }
  return formToObject(entries);
}

export interface Team {
  owner: Actor;
  admin: Actor;
  editor: Actor;
  reviewer: Actor;
}

/** One signed-in user per role (Owner and Admin with two-factor, as A2 requires). */
export async function team(env: TestEnv): Promise<Team> {
  const [owner, admin, editor, reviewer] = await Promise.all([
    createUser(env, { roles: ["owner"], name: "Test Owner", mfa: true }),
    createUser(env, { roles: ["admin"], name: "Test Admin", mfa: true }),
    createUser(env, { roles: ["editor"], name: "Test Editor" }),
    createUser(env, { roles: ["reviewer"], name: "Test Reviewer" }),
  ]);
  return {
    owner: await actorFor(env, owner),
    admin: await actorFor(env, admin),
    editor: await actorFor(env, editor),
    reviewer: await actorFor(env, reviewer),
  };
}

export const ctxOf = (env: TestEnv, actor: Actor): ChangeContext => ({ deps: env.deps, actor, meta: meta() });

/** The newest audit events of an item, newest first. */
export async function auditOf(env: TestEnv, type: string, id: string) {
  return dbFor(env.pool)
    .select({ action: auditEvents.action, outcome: auditEvents.outcome, summary: auditEvents.summary, actorUserId: auditEvents.actorUserId, changes: auditEvents.changes })
    .from(auditEvents)
    .where(and(eq(auditEvents.entityType, type), eq(auditEvents.entityId, id)))
    .orderBy(desc(auditEvents.id));
}

/** Rows of a raw query (the tests read columns by their SQL names). */
export async function query<T = Record<string, unknown>>(env: TestEnv, statement: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await env.pool.query(statement, params);
  return rows as T[];
}

export function expectOk<T extends { kind: string }>(result: T): Extract<T, { kind: "ok" }> {
  if (result.kind !== "ok") throw new Error(`Expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { kind: "ok" }>;
}

export interface SeedMediaOptions {
  kind?: "image" | "document";
  visibility?: "public" | "private";
  status?: "pending_review" | "approved" | "restricted" | "internal" | "archived";
  /** A current, ready file (default); false = the first upload has not finished. */
  ready?: boolean;
  trashed?: boolean;
  flags?: string[];
  title?: string;
}

/**
 * A media item made directly in the database for content tests (A4): a row and, unless `ready: false`, a current file
 * row (no bytes on disk: content saves and pickers never read a file). Synthetic names only.
 */
export async function seedMedia(env: TestEnv, options: SeedMediaOptions = {}): Promise<string> {
  const id = ulid();
  const kind = options.kind ?? "image";
  const visibility = options.visibility ?? "public";
  const status = options.status ?? (visibility === "private" ? "internal" : "pending_review");
  await query(env, "INSERT INTO media_assets (id, kind, visibility, usage_status, deleted_at) VALUES (?, ?, ?, ?, ?)", [id, kind, visibility, status, options.trashed ? new Date() : null]);
  if (options.ready !== false) {
    const fileId = ulid();
    const extension = kind === "document" ? "pdf" : "webp";
    await query(
      env,
      `INSERT INTO media_files (id, media_id, version, storage_area, storage_key, original_filename, mime_type, extension, byte_size, sha256, width, height, processing_status, uploaded_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, 1000, ?, ?, ?, 'ready', ?)`,
      [
        fileId,
        id,
        visibility === "private" ? "private" : "originals",
        visibility === "private" ? `${id}/${fileId}.${extension}` : `2026/10/${fileId}.${extension}`,
        `synthetic-${id.slice(-6).toLowerCase()}.${extension}`,
        kind === "document" ? "application/pdf" : "image/webp",
        extension,
        createHash("sha256").update(id).digest(),
        kind === "image" ? 1200 : null,
        kind === "image" ? 800 : null,
        new Date(),
      ],
    );
    await query(env, "UPDATE media_assets SET current_file_id = ? WHERE id = ?", [fileId, id]);
  }
  for (const flag of options.flags ?? []) await query(env, "INSERT INTO media_flags (media_id, flag, created_at) VALUES (?, ?, ?)", [id, flag, new Date()]);
  if (options.title) await query(env, "INSERT INTO media_translations (media_id, locale, title) VALUES (?, 'en', ?)", [id, options.title]);
  await rebuildMediaSearch(dbFor(env.pool), id, new Date());
  return id;
}
