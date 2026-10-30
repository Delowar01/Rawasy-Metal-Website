/**
 * Navigation (A6.2; A1 `menus`, `menu_items`, `menu_item_translations`): the working copies of the design's four menu
 * slots — header navigation, the Services menu, the footer's company and legal links — with their order, visibility and
 * labels in both languages.
 *
 * - Read: every signed-in role (`content.view`); change: `menus.edit` (Owner, Admin), re-decided in the transaction.
 * - Each slot is an aggregate root with its own version; a save is the slot's full state, decided on the version its
 *   form showed ("This menu changed after you opened it…"). Set-up copies today's navigation (navigation.ts) into the
 *   slots that are still empty, locking the four roots in key order.
 * - Targets: site pages by route key only (the approved menus hold nothing else; no free address, no external link);
 *   each page at most once per slot; labels required in both languages, plain text, the slot's maximum length.
 * - The design's shape (registry.ts): the header keeps Services third and its first three items shown; the Services
 *   menu is fixed (its collection and its "every service" link, only that label changes).
 * The public website never reads this (T1 = Option B); the admin preview does.
 */
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { menuItemTranslations, menuItems } from "../db/schema-site.ts";
import { ULID_RE } from "../builder/links.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { plainText } from "../cms/text.ts";
import { ulid } from "../security/ids.ts";
import {
  bumpSiteRoot,
  FREE_RANGE,
  INVALID,
  lockMenuRoot,
  refuse,
  siteAudit,
  stale,
  STALE_MENU,
  versionSchema,
  zodIssues,
  type SiteChange,
  type SiteIssue,
  type SiteResult,
} from "./common.ts";
import { isSiteRoute, LOCALES, MENU_SLOT_KEYS, MENU_SLOTS, menuSlot, ROUTE_NAMES, SITE_ROUTE_KEYS, type Locale, type MenuSlot, type MenuSlotKey, type SiteRouteKey } from "./registry.ts";
import { staticMenus } from "./static-source.ts";

export interface MenuItemModel {
  id: string;
  linkType: "route" | "collection";
  route: SiteRouteKey | null;
  collection: string | null;
  label: Record<Locale, string> | null;
  isVisible: boolean;
}

export interface MenuModel {
  key: MenuSlotKey;
  slot: MenuSlot;
  lockVersion: number;
  setUp: boolean;
  items: MenuItemModel[];
}

/** Every slot's working copy, in the registry's order. */
export async function readMenus(db: Db): Promise<MenuModel[]> {
  const roots = await rowsOf<{ key: string; lock_version: number }>(db, sql`SELECT \`key\`, lock_version FROM menus`);
  const items = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT id, menu_key, link_type, route_key, collection, is_visible FROM menu_items WHERE parent_id IS NULL ORDER BY menu_key, position`,
  );
  const labels = await rowsOf<{ item_id: string; locale: string; label: string }>(db, sql`SELECT item_id, locale, label FROM menu_item_translations`);
  const labelOf = new Map<string, Record<Locale, string>>();
  for (const row of labels) {
    const entry = labelOf.get(row.item_id) ?? { en: "", ar: "" };
    if ((LOCALES as readonly string[]).includes(row.locale)) entry[row.locale as Locale] = row.label;
    labelOf.set(row.item_id, entry);
  }
  return MENU_SLOTS.map((slot) => {
    const root = roots.find((r) => r.key === slot.key);
    const own = items
      .filter((i) => i.menu_key === slot.key)
      .map((i) => ({
        id: String(i.id),
        linkType: (String(i.link_type) === "collection" ? "collection" : "route") as MenuItemModel["linkType"],
        route: isSiteRoute(i.route_key) ? i.route_key : null,
        collection: i.collection ? String(i.collection) : null,
        label: labelOf.get(String(i.id)) ?? null,
        isVisible: Boolean(Number(i.is_visible)),
      }));
    return { key: slot.key, slot, lockVersion: Number(root?.lock_version ?? 0), setUp: own.length > 0, items: own };
  });
}

async function insertItem(
  tx: Db,
  slot: MenuSlotKey,
  position: number,
  item: { linkType: "route" | "collection"; route: SiteRouteKey | null; collection: string | null; label: Record<Locale, string> | null; isVisible: boolean },
  actorId: string,
  now: Date,
): Promise<string> {
  const id = ulid(now.getTime());
  await tx.insert(menuItems).values({
    id,
    menuKey: slot,
    position,
    linkType: item.linkType,
    routeKey: item.route,
    collection: item.collection,
    isVisible: item.isVisible,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  });
  if (item.label) await writeLabels(tx, id, item.label, actorId, now);
  return id;
}

async function writeLabels(tx: Db, itemId: string, label: Record<Locale, string>, actorId: string, now: Date) {
  for (const locale of LOCALES) {
    const values = { label: label[locale], translationStatus: "complete" as const, completedAt: now, completedBy: actorId, updatedAt: now, updatedBy: actorId };
    await tx
      .insert(menuItemTranslations)
      .values({ itemId, locale, ...values })
      .onDuplicateKeyUpdate({ set: values });
  }
}

/** Copy today's navigation into the slots that are still empty (each slot once). */
export async function setUpNavigation(change: SiteChange): Promise<SiteResult> {
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const event = { action: "menu.setup", type: "menu" as const, id: "navigation", label: "Navigation" };
    // The four roots in key order (every multi-root change locks them so).
    const roots = new Map<MenuSlotKey, number>();
    for (const key of [...MENU_SLOT_KEYS].sort()) {
      const root = await lockMenuRoot(tx, key);
      if (!root) return { kind: "not_found" };
      roots.set(key, root.lockVersion);
    }
    if (!actor.permissions.has("menus.edit")) return refuse(tx, change, now, event, "Setting up the navigation needs a permission you don't hold.");
    const current = await readMenus(tx);
    const source = staticMenus();
    const done: MenuSlotKey[] = [];
    for (const menu of current) {
      if (menu.setUp) continue;
      for (const [i, item] of source[menu.key].entries()) await insertItem(tx, menu.key, i + 1, { ...item, isVisible: true }, actor.user.id, now);
      await bumpSiteRoot(tx, "menus", "key", menu.key, actor.user.id, now);
      done.push(menu.key);
    }
    if (!done.length) return { kind: "ok", id: "navigation", lockVersion: 0, summary: "The navigation was already set up." };
    await siteAudit(tx, change, now, { ...event, summary: `Set up the navigation from today's website (${done.join(", ")}).`, changes: { slots: done } });
    return { kind: "ok", id: "navigation", lockVersion: 0, summary: "The menus now hold today's navigation. Nothing changed for visitors." };
  });
}

const itemSchema = z
  .object({
    id: z.union([z.literal(""), z.string().regex(ULID_RE)]),
    route: z.string().max(32).nullable(),
    label: z.object({ en: plainText(80), ar: plainText(80) }).strict().nullable(),
    isVisible: z.boolean(),
  })
  .strict();

export const menuInputSchema = z
  .object({
    key: z.enum(MENU_SLOT_KEYS as [MenuSlotKey, ...MenuSlotKey[]]),
    expectedVersion: versionSchema,
    items: z.array(itemSchema).max(16),
  })
  .strict();

export type MenuInput = z.input<typeof menuInputSchema>;
type MenuItemInput = z.output<typeof itemSchema>;

/** The design's rules for a slot's new state (pure, so the unit tests check them with the registry alone). */
export function menuIssues(slot: MenuSlot, items: readonly MenuItemInput[], stored: readonly MenuItemModel[]): SiteIssue[] {
  const issues: SiteIssue[] = [];
  if (slot.fixed) {
    const sameShape = items.length === stored.length && items.every((item, i) => item.id === stored[i].id && item.isVisible === stored[i].isVisible && (item.route ?? null) === stored[i].route);
    if (!sameShape) return [{ path: "items", message: "This menu's items are fixed by the design: only their labels change." }];
    items.forEach((item, i) => {
      if (stored[i].label === null) {
        if (item.label !== null) issues.push({ path: `items.${i}.label`, message: "This item takes its names from the services themselves." });
        return;
      }
      issues.push(...labelIssues(slot, item, i));
    });
    return issues;
  }
  if (items.length < slot.minItems) issues.push({ path: "items", message: `Keep at least ${slot.minItems} item${slot.minItems === 1 ? "" : "s"}.` });
  if (items.length > slot.maxItems) issues.push({ path: "items", message: `Use at most ${slot.maxItems} items.` });
  const storedIds = new Set(stored.map((s) => s.id));
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (item.id && !storedIds.has(item.id)) issues.push({ path: `items.${i}`, message: "This menu changed. Reload the page." });
    if (!isSiteRoute(item.route)) {
      issues.push({ path: `items.${i}.route`, message: "Choose one of the website's pages." });
      return;
    }
    if (seen.has(item.route)) issues.push({ path: `items.${i}.route`, message: `${ROUTE_NAMES[item.route]} is already in this menu.` });
    seen.add(item.route);
    if (slot.pinned && item.route === slot.pinned.route && i + 1 !== slot.pinned.position) {
      issues.push({ path: `items.${i}.route`, message: `${ROUTE_NAMES[slot.pinned.route]} stays in place ${slot.pinned.position}: it opens the Services menu.` });
    }
    if (slot.alwaysShown?.includes(i + 1) && !item.isVisible) issues.push({ path: `items.${i}.isVisible`, message: "The header always shows its first three items." });
    issues.push(...labelIssues(slot, item, i));
  });
  if (slot.pinned) {
    const at = items[slot.pinned.position - 1];
    if (!at || at.route !== slot.pinned.route) issues.push({ path: "items", message: `${ROUTE_NAMES[slot.pinned.route]} must be item ${slot.pinned.position}: the header opens the Services menu there.` });
  }
  const ids = items.map((i) => i.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) issues.push({ path: "items", message: "The menu couldn't be read. Reload the page." });
  return issues;
}

function labelIssues(slot: MenuSlot, item: MenuItemInput, i: number): SiteIssue[] {
  const issues: SiteIssue[] = [];
  for (const locale of LOCALES) {
    const value = item.label?.[locale] ?? "";
    if (!value) issues.push({ path: `items.${i}.label.${locale}`, message: "Required in both languages." });
    else if ([...value].length > slot.labelMax) issues.push({ path: `items.${i}.label.${locale}`, message: `Use at most ${slot.labelMax} characters.` });
  }
  return issues;
}

/** Save one slot (its full state), decided on the slot's version as its form showed it. */
export async function saveMenu(change: SiteChange, raw: unknown): Promise<SiteResult> {
  const parsed = menuInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: zodIssues(parsed.error) };
  const input = parsed.data;
  const slot = menuSlot(input.key)!;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockMenuRoot(tx, input.key);
    if (!root) return { kind: "not_found" };
    const event = { action: "menu.update", type: "menu" as const, id: input.key, label: slot.name };
    if (!actor.permissions.has("menus.edit")) return refuse(tx, change, now, event, "Editing the navigation needs a permission you don't hold.");
    if (root.lockVersion !== input.expectedVersion) return stale(tx, change, now, event, input.expectedVersion, root.lockVersion, STALE_MENU);
    const stored = (await readMenus(tx)).find((m) => m.key === input.key)!;
    if (!stored.setUp) return { kind: "invalid", message: "Set up the navigation from today's website first.", issues: [] };
    const issues = menuIssues(slot, input.items, stored.items);
    if (issues.length) return { kind: "invalid", message: INVALID, issues };

    const kept = new Set(input.items.map((i) => i.id).filter(Boolean));
    const removed = stored.items.filter((i) => !kept.has(i.id));
    for (const item of removed) await tx.delete(menuItems).where(eq(menuItems.id, item.id));
    await tx.execute(sql`UPDATE menu_items SET position = position + ${FREE_RANGE} WHERE menu_key = ${input.key} AND parent_id IS NULL`);
    let added = 0;
    for (const [i, item] of input.items.entries()) {
      const storedItem = stored.items.find((s) => s.id === item.id);
      if (storedItem) {
        await tx
          .update(menuItems)
          .set({
            position: i + 1,
            ...(storedItem.linkType === "route" ? { routeKey: item.route } : {}),
            isVisible: item.isVisible,
            updatedAt: now,
            updatedBy: actor.user.id,
          })
          .where(and(eq(menuItems.id, item.id), eq(menuItems.menuKey, input.key)));
        if (item.label) await writeLabels(tx, item.id, item.label, actor.user.id, now);
      } else {
        added++;
        await insertItem(tx, input.key, i + 1, { linkType: "route", route: item.route as SiteRouteKey, collection: null, label: item.label, isVisible: item.isVisible }, actor.user.id, now);
      }
    }
    await bumpSiteRoot(tx, "menus", "key", input.key, actor.user.id, now);
    const order = (list: readonly { id: string }[]) => list.map((i) => i.id).filter((id) => kept.has(id)).join();
    const relabelled = input.items.filter((i) => {
      const s = stored.items.find((x) => x.id === i.id);
      return s && JSON.stringify(s.label) !== JSON.stringify(i.label);
    }).length;
    const visibility = input.items.filter((i) => {
      const s = stored.items.find((x) => x.id === i.id);
      return s && s.isVisible !== i.isVisible;
    }).length;
    const retargeted = input.items.filter((i) => {
      const s = stored.items.find((x) => x.id === i.id);
      return s && s.route !== i.route;
    }).length;
    const moved = order(stored.items) !== order(input.items as { id: string }[]);
    await siteAudit(tx, change, now, {
      ...event,
      summary: `Edited ${slot.name}: ${input.items.length} items (${[added && `${added} added`, removed.length && `${removed.length} removed`, moved && "reordered", retargeted && `${retargeted} page${retargeted === 1 ? "" : "s"} changed`, relabelled && `${relabelled} relabelled`, visibility && `${visibility} shown/hidden`].filter(Boolean).join(", ") || "no change"}).`,
      changes: { items: input.items.length, added, removed: removed.length, moved, retargeted, relabelled, visibility },
    });
    return { kind: "ok", id: input.key, lockVersion: root.lockVersion + 1, summary: "Saved. The preview shows the change; visitors still see today's website." };
  });
}

/** The site pages a slot may name, for the editor's choices. */
export const routeChoices = () => SITE_ROUTE_KEYS.map((key) => ({ key, name: ROUTE_NAMES[key] }));
