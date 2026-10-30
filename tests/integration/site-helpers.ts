/**
 * Helpers for the A6 (site controls) integration tests: the change context, and form inputs built from the stored
 * working copies, so each test changes only what it is about.
 */
import type { Actor } from "../../src/server/auth/types.ts";
import type { SiteChange, SiteResult } from "../../src/server/site/common.ts";
import type { MenuInput, MenuModel } from "../../src/server/site/menus.ts";
import type { SettingsInput, SettingsModel } from "../../src/server/site/settings.ts";
import { meta, type TestEnv } from "./helpers.ts";

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
    status: { en: model.status.en === "needs_review" ? "needs_review" : "complete", ar: model.status.ar === "needs_review" ? "needs_review" : "complete" },
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
