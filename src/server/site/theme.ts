/**
 * Theme settings (A6.4; A1 `theme_settings`, `design_token_overrides`): the controlled mechanism for overriding the
 * approved design's tokens — registry keys only (registry.ts `APPROVED_TOKENS`), typed and validated values (#rrggbb and
 * the contrast each token must keep on the surfaces it is drawn on), never free CSS, colours, fonts or script.
 *
 * The approved Modern Commerce design is binding: no token is approved for overriding (D-A6-3), so every override is
 * refused and the theme stays the approved design. The Owner alone holds `theme.edit`, and a change needs a recent
 * sign-in (step-up). A change is decided on the theme's version; refusals are audited. Overrides would apply in the
 * admin preview only (T1 = Option B), never to the public website before A8 / A9.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { designTokenOverrides } from "../db/schema-site.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { bumpSiteRoot, INVALID, lockThemeRoot, refuse, siteAudit, stale, STALE_THEME, versionSchema, type SiteChange, type SiteResult } from "./common.ts";
import { APPROVED_TOKENS, tokenValueProblem, type TokenDef, type TokenScheme } from "./registry.ts";

export interface ThemeOverride {
  tokenKey: string;
  scheme: TokenScheme;
  value: string;
}

export interface ThemeModel {
  lockVersion: number;
  overrides: ThemeOverride[];
}

export async function readTheme(db: Db): Promise<ThemeModel> {
  const [root] = await rowsOf<{ lock_version: number }>(db, sql`SELECT lock_version FROM theme_settings WHERE id = 'theme'`);
  const rows = await rowsOf<{ token_key: string; scheme: TokenScheme; value: string }>(
    db,
    sql`SELECT token_key, scheme, value FROM design_token_overrides WHERE theme_id = 'theme' ORDER BY token_key, scheme`,
  );
  return { lockVersion: Number(root?.lock_version ?? 0), overrides: rows.map((r) => ({ tokenKey: r.token_key, scheme: r.scheme, value: r.value })) };
}

const overrideSchema = z
  .object({
    expectedVersion: versionSchema,
    tokenKey: z.string().max(64),
    scheme: z.enum(["all", "light", "dark"]),
    value: z
      .string()
      .max(100)
      .transform((v) => v.trim().toLowerCase()),
  })
  .strict();

/** Set one token override: refused unless the token is approved (none is: D-A6-3), then validated. */
export async function setTokenOverride(change: SiteChange, raw: unknown, approved: readonly TokenDef[] = APPROVED_TOKENS): Promise<SiteResult> {
  const parsed = overrideSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: [{ path: "value", message: "The override couldn't be read." }] };
  const input = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockThemeRoot(tx);
    if (!root) return { kind: "not_found" };
    const event = { action: "theme.override", type: "theme" as const, id: "theme", label: "Theme" };
    if (!actor.permissions.has("theme.edit")) return refuse(tx, change, now, event, "Changing the theme needs a permission you don't hold.");
    if (root.lockVersion !== input.expectedVersion) return stale(tx, change, now, event, input.expectedVersion, root.lockVersion, STALE_THEME);
    const def = approved.find((d) => d.key === input.tokenKey);
    if (!def) return refuse(tx, change, now, event, "This design token is not approved for overriding. The approved design applies.");
    const problem = tokenValueProblem(def, input.scheme, input.value);
    if (problem) return { kind: "invalid", message: INVALID, issues: [{ path: "value", message: problem }] };
    await tx
      .insert(designTokenOverrides)
      .values({ themeId: "theme", tokenKey: def.key, scheme: input.scheme, value: input.value })
      .onDuplicateKeyUpdate({ set: { value: input.value } });
    await bumpSiteRoot(tx, "theme_settings", "id", "theme", actor.user.id, now);
    await siteAudit(tx, change, now, { ...event, summary: `Overrode the design token ${def.key} (${input.scheme}).`, changes: { token: def.key, scheme: input.scheme } });
    return { kind: "ok", id: "theme", lockVersion: root.lockVersion + 1, summary: "Saved. The preview shows the change; visitors still see today's website." };
  });
}

/** Remove every override (back to the approved design), decided on the theme's version. */
export async function resetTheme(change: SiteChange, raw: unknown): Promise<SiteResult> {
  const parsed = z.object({ expectedVersion: versionSchema }).strict().safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: [] };
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockThemeRoot(tx);
    if (!root) return { kind: "not_found" };
    const event = { action: "theme.reset", type: "theme" as const, id: "theme", label: "Theme" };
    if (!actor.permissions.has("theme.edit")) return refuse(tx, change, now, event, "Changing the theme needs a permission you don't hold.");
    if (root.lockVersion !== parsed.data.expectedVersion) return stale(tx, change, now, event, parsed.data.expectedVersion, root.lockVersion, STALE_THEME);
    const [{ n }] = await rowsOf<{ n: number }>(tx, sql`SELECT COUNT(*) AS n FROM design_token_overrides WHERE theme_id = 'theme'`);
    if (!Number(n)) return { kind: "ok", id: "theme", lockVersion: root.lockVersion, summary: "The theme is already the approved design." };
    await tx.execute(sql`DELETE FROM design_token_overrides WHERE theme_id = 'theme'`);
    await bumpSiteRoot(tx, "theme_settings", "id", "theme", actor.user.id, now);
    await siteAudit(tx, change, now, { ...event, summary: `Removed every design-token override (${Number(n)}): the approved design applies.`, changes: { removed: Number(n) } });
    return { kind: "ok", id: "theme", lockVersion: root.lockVersion + 1, summary: "Removed: the approved design applies." };
  });
}
