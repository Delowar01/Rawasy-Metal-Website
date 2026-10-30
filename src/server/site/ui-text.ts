/**
 * Interface text (A6.3; A1 `ui_strings`, `ui_string_translations`): the shell's labels in both languages — the skip
 * link, menus, landmarks, controls, contact actions, the footer's titles and the page-not-found text — for the keys the
 * code registry defines (registry.ts; no free-form key, D-A6-5).
 *
 * - Read: every signed-in role (`content.view`); change: `settings.edit` (Owner, Admin): the interface text belongs to
 *   the site settings' aggregate (A1), so every change locks its root and is decided on its version.
 * - Set-up copies today's text (the dictionaries) for every key and language without a value.
 * - A save is the whole interface text (every key, both languages: the screen is one form, its groups only headings, so
 *   saving never loses another group's typing): plain text on one line, at most the key's length; an empty field
 *   removes the working value (the preview then shows today's text, marked as such).
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { uiStringTranslations } from "../db/schema-site.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { plainText } from "../cms/text.ts";
import { bumpSiteRoot, INVALID, lockSettingsRoot, refuse, siteAudit, stale, STALE_SETTINGS, versionSchema, type SiteChange, type SiteIssue, type SiteResult } from "./common.ts";
import { LOCALES, UI_STRINGS, uiString, type Locale, type UiStringDef } from "./registry.ts";
import { staticUiTexts } from "./static-source.ts";

export interface UiTextRow {
  def: UiStringDef;
  /** The working value (null: none, the preview shows today's text). */
  value: Record<Locale, string | null>;
  today: Record<Locale, string>;
}

export interface UiTextModel {
  lockVersion: number;
  setUp: boolean;
  rows: UiTextRow[];
}

/** The working interface text by key and language (keys the registry no longer lists are left out). */
export async function readUiValues(db: Db): Promise<Map<string, Partial<Record<Locale, string>>>> {
  const rows = await rowsOf<{ string_key: string; locale: string; value: string }>(db, sql`SELECT string_key, locale, value FROM ui_string_translations`);
  const out = new Map<string, Partial<Record<Locale, string>>>();
  for (const row of rows) {
    if (!uiString(row.string_key) || !(LOCALES as readonly string[]).includes(row.locale)) continue;
    out.set(row.string_key, { ...(out.get(row.string_key) ?? {}), [row.locale]: row.value });
  }
  return out;
}

export async function readUiText(db: Db): Promise<UiTextModel> {
  const [root] = await rowsOf<{ lock_version: number }>(db, sql`SELECT lock_version FROM site_settings WHERE id = 'site'`);
  const values = await readUiValues(db);
  const today = staticUiTexts();
  return {
    lockVersion: Number(root?.lock_version ?? 0),
    setUp: values.size > 0,
    rows: UI_STRINGS.map((def) => ({ def, value: { en: values.get(def.key)?.en ?? null, ar: values.get(def.key)?.ar ?? null }, today: today[def.key] })),
  };
}

async function writeValue(tx: Db, key: string, locale: Locale, value: string, actorId: string, now: Date) {
  const values = { value, translationStatus: "complete" as const, completedAt: now, completedBy: actorId, updatedAt: now, updatedBy: actorId };
  await tx
    .insert(uiStringTranslations)
    .values({ stringKey: key, locale, ...values })
    .onDuplicateKeyUpdate({ set: values });
}

/** Copy today's interface text into every key and language that has no working value. */
export async function setUpUiText(change: SiteChange): Promise<SiteResult> {
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockSettingsRoot(tx);
    if (!root) return { kind: "not_found" };
    const event = { action: "ui_text.setup", type: "ui_text" as const, id: "site", label: "Interface text" };
    if (!actor.permissions.has("settings.edit")) return refuse(tx, change, now, event, "Setting up the interface text needs a permission you don't hold.");
    const current = await readUiValues(tx);
    const today = staticUiTexts();
    let written = 0;
    for (const def of UI_STRINGS) {
      for (const locale of LOCALES) {
        if (current.get(def.key)?.[locale] !== undefined) continue;
        await writeValue(tx, def.key, locale, today[def.key][locale], actor.user.id, now);
        written++;
      }
    }
    if (!written) return { kind: "ok", id: "site", lockVersion: root.lockVersion, summary: "The interface text was already set up." };
    await bumpSiteRoot(tx, "site_settings", "id", "site", actor.user.id, now);
    await siteAudit(tx, change, now, { ...event, summary: `Set up the interface text from today's website (${written} values).`, changes: { values: written } });
    return { kind: "ok", id: "site", lockVersion: root.lockVersion + 1, summary: "The interface text now holds today's website. Nothing changed for visitors." };
  });
}

export const uiTextInputSchema = z
  .object({
    expectedVersion: versionSchema,
    values: z.record(z.string().max(100), z.object({ en: z.string().max(2000), ar: z.string().max(2000) }).strict()),
  })
  .strict();

export type UiTextInput = z.input<typeof uiTextInputSchema>;

/** The checked values of every key, or the issues (pure: the unit tests check it with the registry alone). */
export function checkUiValues(values: Record<string, Record<Locale, string>>): { ok: true; values: Record<string, Record<Locale, string>> } | { ok: false; issues: SiteIssue[] } {
  const defs = UI_STRINGS;
  const issues: SiteIssue[] = [];
  const keys = Object.keys(values);
  if (keys.length !== defs.length || keys.some((k) => !defs.some((d) => d.key === k))) {
    return { ok: false, issues: [{ path: "values", message: "The interface text couldn't be read. Reload the page." }] };
  }
  const out: Record<string, Record<Locale, string>> = {};
  for (const def of defs) {
    out[def.key] = { en: "", ar: "" };
    for (const locale of LOCALES) {
      const parsed = plainText(def.maxLength).safeParse(values[def.key][locale]);
      if (!parsed.success) issues.push({ path: `values.${def.key}.${locale}`, message: parsed.error.issues[0]?.message ?? "Check this text." });
      else out[def.key][locale] = parsed.data;
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, values: out };
}

/** Save the interface text (every key), decided on the site settings' version as the page showed it. */
export async function saveUiText(change: SiteChange, raw: unknown): Promise<SiteResult> {
  const parsed = uiTextInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: [{ path: "values", message: "The interface text couldn't be read. Reload the page." }] };
  const checked = checkUiValues(parsed.data.values);
  if (!checked.ok) return { kind: "invalid", message: INVALID, issues: checked.issues };
  const { expectedVersion } = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockSettingsRoot(tx);
    if (!root) return { kind: "not_found" };
    const event = { action: "ui_text.update", type: "ui_text" as const, id: "site", label: "Interface text" };
    if (!actor.permissions.has("settings.edit")) return refuse(tx, change, now, event, "Editing the interface text needs a permission you don't hold.");
    if (root.lockVersion !== expectedVersion) return stale(tx, change, now, event, expectedVersion, root.lockVersion, STALE_SETTINGS);
    const stored = await readUiValues(tx);
    const changed: string[] = [];
    for (const [key, value] of Object.entries(checked.values)) {
      for (const locale of LOCALES) {
        const before = stored.get(key)?.[locale];
        if ((before ?? "") === value[locale]) continue;
        changed.push(`${key}:${locale}`);
        if (value[locale]) await writeValue(tx, key, locale, value[locale], actor.user.id, now);
        else await tx.execute(sql`DELETE FROM ui_string_translations WHERE string_key = ${key} AND locale = ${locale}`);
      }
    }
    if (!changed.length) return { kind: "ok", id: "site", lockVersion: root.lockVersion, summary: "Nothing to save." };
    await bumpSiteRoot(tx, "site_settings", "id", "site", actor.user.id, now);
    await siteAudit(tx, change, now, { ...event, summary: `Edited the interface text: ${changed.length} value${changed.length === 1 ? "" : "s"}.`, changes: { values: changed } });
    return { kind: "ok", id: "site", lockVersion: root.lockVersion + 1, summary: "Saved. The preview shows the change; visitors still see today's website." };
  });
}
