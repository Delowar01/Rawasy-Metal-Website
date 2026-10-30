/**
 * What every change to the site's global controls (A6) shares: the change context (A3's `contentTransaction` deps, the
 * actor and the request), the result kinds, the audit event (keys and states only — never the texts, addresses or
 * values a person typed), refusals, and the locks of the aggregate roots: the site settings 'site' (company, phones and
 * interface text), each menu slot, the theme 'theme'. A change is decided on the root's version as its form showed it.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { auditActorOf, type Actor, type RequestMeta } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import { rowsOf, type CmsDeps } from "../cms/store.ts";

export interface SiteChange {
  deps: CmsDeps;
  actor: Actor;
  meta: RequestMeta;
}

/** A field (as the form names it) and what is wrong with it. */
export interface SiteIssue {
  path: string;
  message: string;
}

export type SiteResult =
  | { kind: "ok"; id: string; lockVersion: number; summary: string }
  | { kind: "invalid"; message: string; issues: SiteIssue[] }
  | { kind: "stale"; message: string }
  | { kind: "not_found" }
  | { kind: "denied"; message: string };

export const INVALID = "Some fields need attention. Nothing was saved.";
export const STALE_SETTINGS = "The site settings changed after you opened them. Reload and review the latest version before saving.";
export const STALE_MENU = "This menu changed after you opened it. Reload and review the latest version before saving.";
export const STALE_THEME = "The theme changed after you opened it. Reload and review the latest version before saving.";
export const STALE_REDIRECT = "This redirect changed after you opened it. Reload and review the latest version before saving.";

export const versionSchema = z.number().int().min(0).max(2_147_483_647);

export type SiteEntity = "site_settings" | "ui_text" | "menu" | "theme" | "redirect";

export interface SiteEvent {
  action: string;
  type: SiteEntity;
  id: string;
  label?: string | null;
  outcome?: AuditOutcome;
  summary: string;
  changes?: Record<string, unknown>;
}

export async function siteAudit(db: Db, change: SiteChange, at: Date, event: SiteEvent): Promise<void> {
  await recordAudit(db, {
    at,
    requestId: change.meta.requestId,
    actor: auditActorOf(change.actor),
    ip: change.meta.ip,
    action: event.action,
    entity: { type: event.type, id: event.id, label: event.label ? event.label.slice(0, 120) : null },
    outcome: event.outcome ?? "success",
    summary: event.summary.slice(0, 500),
    changes: event.changes,
  });
}

/** A refused change: audited as denied, the person told why. */
export async function refuse(db: Db, change: SiteChange, at: Date, event: Omit<SiteEvent, "outcome" | "summary">, message: string): Promise<SiteResult> {
  await siteAudit(db, change, at, { ...event, outcome: "denied", summary: `Refused: ${message}` });
  return { kind: "denied", message };
}

/** A stale change: audited as failed (the version the form showed, the stored one). */
export async function stale(db: Db, change: SiteChange, at: Date, event: Omit<SiteEvent, "outcome" | "summary">, expected: number, stored: number, message: string): Promise<SiteResult> {
  await siteAudit(db, change, at, { ...event, outcome: "failed", summary: `Refused: changed after it was opened (version ${expected}, now ${stored}).` });
  return { kind: "stale", message };
}

export interface RootRow {
  lockVersion: number;
}

/** The site settings root, FOR UPDATE (every change to settings, phones or interface text). */
export async function lockSettingsRoot(tx: Db): Promise<RootRow | null> {
  const [row] = await rowsOf<{ lock_version: number }>(tx, sql`SELECT lock_version FROM site_settings WHERE id = 'site' FOR UPDATE`);
  return row ? { lockVersion: Number(row.lock_version) } : null;
}

/** A menu slot's root, FOR UPDATE. */
export async function lockMenuRoot(tx: Db, key: string): Promise<RootRow | null> {
  const [row] = await rowsOf<{ lock_version: number }>(tx, sql`SELECT lock_version FROM menus WHERE \`key\` = ${key} FOR UPDATE`);
  return row ? { lockVersion: Number(row.lock_version) } : null;
}

/** The theme root, FOR UPDATE. */
export async function lockThemeRoot(tx: Db): Promise<RootRow | null> {
  const [row] = await rowsOf<{ lock_version: number }>(tx, sql`SELECT lock_version FROM theme_settings WHERE id = 'theme' FOR UPDATE`);
  return row ? { lockVersion: Number(row.lock_version) } : null;
}

/** The root's new version after a change (lock_version + 1, updated at / by). Table names come from code only. */
export async function bumpSiteRoot(tx: Db, table: "site_settings" | "menus" | "theme_settings", keyColumn: "id" | "key", key: string, actorId: string, now: Date) {
  await tx.execute(
    sql`UPDATE ${sql.identifier(table)} SET lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE ${sql.identifier(keyColumn)} = ${key}`,
  );
}

/** Positions are renumbered through a free range first, so the unique (owner, position) index never meets itself. */
export const FREE_RANGE = 1_000_000;

/** The first message of a Zod failure, or a fallback. */
export const firstMessage = (error: z.ZodError, fallback: string) => error.issues[0]?.message ?? fallback;

/** Zod issues as form issues (the path joined with dots, as the forms name their fields). */
export const zodIssues = (error: z.ZodError): SiteIssue[] => error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
