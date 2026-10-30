/**
 * Helpers for the A6 (site controls) integration tests: the change context, and form inputs built from the stored
 * working copies, so each test changes only what it is about.
 */
import type { Actor } from "../../src/server/auth/types.ts";
import { inTransaction } from "../../src/server/db/client.ts";
import { syncPublicMedia } from "../../src/server/media/deliverability.ts";
import { ulid } from "../../src/server/security/ids.ts";
import type { SiteChange, SiteResult } from "../../src/server/site/common.ts";
import type { MenuInput, MenuModel } from "../../src/server/site/menus.ts";
import type { SettingsInput, SettingsModel } from "../../src/server/site/settings.ts";
import { query } from "./cms-helpers.ts";
import { meta, type TestEnv } from "./helpers.ts";

/** An approved release photo that A4 delivers: its public_media row written by A4's own rule (`syncPublicMedia`). */
export async function deliveredPhoto(env: TestEnv): Promise<string> {
  const id = ulid();
  const file = ulid();
  await query(env, "INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'image', 'public', 'approved')", [id]);
  await query(
    env,
    `INSERT INTO media_files (id, media_id, version, storage_area, storage_key, original_filename, mime_type, extension, byte_size, sha256, width, height, processing_status, uploaded_at)
     VALUES (?, ?, 1, 'release', ?, 'test-photo.webp', 'image/webp', 'webp', 1000, UNHEX(SHA2(?, 256)), 640, 480, 'ready', ?)`,
    [file, id, `/media/projects/test-${id.slice(-6).toLowerCase()}.webp`, id, new Date()],
  );
  await query(env, "UPDATE media_assets SET current_file_id = ? WHERE id = ?", [file, id]);
  await inTransaction(env.pool, (tx) => syncPublicMedia(tx, id, new Date()));
  return id;
}

/** A flag on a media item, and A4's rule applied again (a blocking flag removes its public_media row). */
export async function flagMedia(env: TestEnv, id: string, flag: string): Promise<void> {
  await query(env, "INSERT INTO media_flags (media_id, flag, created_at) VALUES (?, ?, ?)", [id, flag, new Date()]);
  await inTransaction(env.pool, (tx) => syncPublicMedia(tx, id, new Date()));
}

export const siteChange = (env: TestEnv, actor: Actor): SiteChange => ({ deps: env.deps, actor, meta: meta() });

/** The settings form as the stored working copy fills it. */
export function settingsInputOf(model: SettingsModel): SettingsInput {
  const v = model.values;
  return {
    expectedVersion: model.lockVersion,
    websiteUrl: v.websiteUrl,
    email: v.email,
    postalCode: v.postalCode,
    geoLat: v.geoLat,
    geoLng: v.geoLng,
    geoIsApproximate: v.geoIsApproximate,
    facebookUrl: v.facebookUrl,
    mapsPlaceUrl: v.mapsPlaceUrl,
    mapsQuery: v.mapsQuery,
    defaultOgImageMediaId: v.defaultOgImageMediaId,
    phones: v.phones.map((p) => ({ ...p })),
    texts: { en: structuredClone(v.texts.en), ar: structuredClone(v.texts.ar) },
    complete: { en: model.status.en === "complete", ar: model.status.ar === "complete" },
    otherUnaffected: false,
  };
}

/** A slot's form as the stored working copy fills it. */
export function menuInputOf(menu: MenuModel): MenuInput {
  return {
    key: menu.key,
    expectedVersion: menu.lockVersion,
    items: menu.items.map((i) => ({ id: i.id, route: i.route, label: i.label ? { ...i.label } : null, isVisible: i.isVisible })),
  };
}

export function expectKind<K extends SiteResult["kind"]>(result: SiteResult, kind: K): Extract<SiteResult, { kind: K }> {
  if (result.kind !== kind) throw new Error(`Expected ${kind}, got ${JSON.stringify(result)}`);
  return result as Extract<SiteResult, { kind: K }>;
}

/** The issue messages of an invalid result, joined (for regex checks). */
export const issuesOf = (result: SiteResult) => (result.kind === "invalid" ? result.issues.map((i) => `${i.path}: ${i.message}`).join(" | ") : "");
