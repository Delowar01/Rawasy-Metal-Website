/**
 * Helpers of the page-builder (A5) integration tests: layouts read back from the database, save entries built from them
 * the way the builder sends them, valid section data from a block's defaults, and owners (generic pages, the site's own
 * pages, services) created through the A3 services. Test data only ("Test …", "Demo …").
 */
import type { Actor } from "../../src/server/auth/types.ts";
import { REGISTRY } from "../../src/server/builder/registry.ts";
import { defaultsOf, LOCALES, type Content, type Settings } from "../../src/server/builder/fields.ts";
import type { SectionInput } from "../../src/server/builder/input.ts";
import { saveLayout, type BuilderChange, type LayoutResult } from "../../src/server/builder/sections.ts";
import { readOwner, readSections, type OwnerRef, type StoredSection } from "../../src/server/builder/store.ts";
import { createItem } from "../../src/server/cms/engine.ts";
import { serviceSpec } from "../../src/server/cms/kinds.ts";
import { createPage } from "../../src/server/cms/pages.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { ctxOf, expectOk, formOf } from "./cms-helpers.ts";
import { meta, type TestEnv } from "./helpers.ts";

export const changeOf = (env: TestEnv, actor: Actor): BuilderChange => ({ deps: env.deps, actor, meta: meta() });

export async function layoutOf(env: TestEnv, owner: OwnerRef): Promise<StoredSection[]> {
  return readSections(dbFor(env.pool), owner, { lock: false });
}

export async function versionOf(env: TestEnv, owner: OwnerRef): Promise<number> {
  return (await readOwner(dbFor(env.pool), owner, { lock: false }))!.lockVersion;
}

/** A stored section as an unchanged save entry (structure fields only). */
export const entryOf = (s: StoredSection): SectionInput => ({ ref: s.id, visible: s.visible, devices: { ...s.devices }, anchor: s.anchor });

/** Valid data for a block: its defaults, repeaters with `items` entries, texts in the given languages. */
export function dataFor(blockType: string, options: { items?: number; texts?: Partial<Record<"en" | "ar", Record<string, unknown>>>; settings?: Settings; complete?: { en: boolean; ar: boolean }; otherUnaffected?: boolean } = {}) {
  const def = REGISTRY.get(blockType)!;
  let n = 0;
  const defaults = defaultsOf(def.settings, def.content, () => `t${++n}`);
  const settings: Settings = { ...defaults.settings, ...(options.settings ?? {}) };
  const content: Partial<Record<"en" | "ar", Content>> = {};
  for (const locale of LOCALES) {
    const texts = options.texts?.[locale];
    if (!texts) continue;
    const base = structuredClone(defaults.content);
    // Repeater texts follow the settings' items (ids from the settings given, else the defaults').
    for (const [key, field] of Object.entries(def.settings)) {
      if (field.kind !== "items") continue;
      const ids = ((settings[key] as { id: string }[]) ?? []).map((i) => i.id);
      base[key] = Object.fromEntries(ids.map((id) => [id, Object.fromEntries(Object.keys(field.content).map((k) => [k, field.content[k].kind === "lines" ? [] : field.content[k].kind === "rich" ? { type: "doc", content: [] } : ""]))]));
    }
    content[locale] = { ...base, ...texts };
  }
  return { settings, content, complete: options.complete ?? { en: false, ar: false }, otherUnaffected: options.otherUnaffected ?? false };
}

/** A save with the given entries, decided on `version` (default: the stored one). */
export async function save(env: TestEnv, actor: Actor, owner: OwnerRef, sections: SectionInput[], version?: number): Promise<LayoutResult> {
  return saveLayout(changeOf(env, actor), { owner, expectedVersion: version ?? (await versionOf(env, owner)), sections });
}

let pageCounter = 0;
/** A generic page created by `actor` through A3 (slug "test-builder-page-<n>"). */
export async function genericPage(env: TestEnv, actor: Actor, title = "Test Builder Page"): Promise<OwnerRef> {
  const slug = `test-builder-page-${++pageCounter}`;
  const created = expectOk(await createPage(ctxOf(env, actor), { kind: "generic" }, formOf({ slug, "en.title": `${title} ${pageCounter}` })));
  return { type: "page", id: created.id };
}

/** One of the site's own pages (homepage, About, Contact …, a legal page or a template), registered by an Owner or Admin. */
export async function systemPage(env: TestEnv, actor: Actor, key: string): Promise<OwnerRef> {
  const created = expectOk(await createPage(ctxOf(env, actor), { kind: "system", key }, formOf({ "en.title": `Test ${key} page` })));
  return { type: "page", id: created.id };
}

let serviceCounter = 0;
export async function service(env: TestEnv, actor: Actor): Promise<OwnerRef> {
  const name = `Test Builder Service ${++serviceCounter}`;
  const created = expectOk(
    await createItem(ctxOf(env, actor), serviceSpec, formOf({ slug: `test-builder-service-${serviceCounter}`, serviceGroup: "metal", iconKey: "laser-cutting", "en.name": name, "en.summary": `${name} summary.` })),
  );
  return { type: "service", id: created.id };
}

export function expectInvalid(result: LayoutResult, pattern: RegExp): void {
  if (result.kind !== "invalid") throw new Error(`Expected invalid, got ${JSON.stringify(result)}`);
  const text = [result.message, ...result.issues.map((i) => i.message)].join(" | ");
  if (!pattern.test(text)) throw new Error(`Expected ${pattern}, got: ${text}`);
}

export function expectDenied(result: LayoutResult, pattern: RegExp): void {
  if (result.kind !== "denied" || !pattern.test(result.message)) throw new Error(`Expected denied ${pattern}, got ${JSON.stringify(result)}`);
}
