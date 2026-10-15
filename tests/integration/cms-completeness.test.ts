/**
 * Core CMS (A3 Correction 1) — one rule of language completeness, on a real MariaDB. For every one of the eight types,
 * items are saved with each required field missing in turn, with every required field filled, marked complete, with
 * the other language partly written, needing review, and (machinery, certificates) with child items missing a label or
 * a value in one language; the state the lists and pickers compute in SQL (`localeStateSql`, read through `listItems`
 * and `refsByIds`) must equal the editor's own (`loadEditorItem` → `requiredFilled`) for every item and language, and
 * the editor's state is checked against the expected one. A field definition, a SQL test or a child rule that drifts on
 * either side makes them disagree here. Test data only ("Demo …").
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, loadEditorItem, updateItem } from "../../src/server/cms/engine.ts";
import { SPECS } from "../../src/server/cms/kinds.ts";
import { listItems, parseListParams } from "../../src/server/cms/list.ts";
import { refsByIds } from "../../src/server/cms/lookups.ts";
import { createPage, updatePage } from "../../src/server/cms/pages.ts";
import { ENTITIES, ENTITY_TYPES, type EntityType } from "../../src/server/cms/registry.ts";
import type { TrField } from "../../src/server/cms/translated.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_completeness");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
/** Letters only: certificate texts pass the digit guard. */
const TAGS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike"];
const valueOf = (field: TrField, tag: string) =>
  field.kind === "rich" ? `Demo paragraph ${tag}.` : field.kind === "lines" ? `Demo point ${tag}` : field.kind === "text" ? `Demo text ${tag}.` : `Demo ${tag}`;
const ROOT: Partial<Record<EntityType, Fields>> = { service: { serviceGroup: "metal", iconKey: "fabrication" }, industry: { classification: "website_classification" } };

/** The required fields of a language, all filled except `except`. */
function texts(type: EntityType, locale: "en" | "ar", tag: string, except?: string): Fields {
  return Object.fromEntries(SPECS[type].fields.filter((f) => f.required && f.key !== except).map((f) => [`${locale}.${f.key}`, valueOf(f, tag)]));
}

/** A language with text but without `missing`: the other required fields, or else an optional one (null: impossible). */
function textsWithout(type: EntityType, locale: "en" | "ar", tag: string, missing: string): Fields | null {
  const fields = texts(type, locale, tag, missing);
  if (Object.keys(fields).length) return fields;
  const optional = SPECS[type].fields.find((f) => !f.required && (f.kind === "line" || f.kind === "text"));
  return optional ? { [`${locale}.${optional.key}`]: valueOf(optional, tag) } : null;
}
const child = (en: [string, string], ar: [string, string]) => ({ id: null, en: { label: en[0], value: en[1] }, ar: { label: ar[0], value: ar[1] } });

async function create(type: EntityType, slug: string, fields: Fields): Promise<string> {
  const form = formOf({ slug, ...ROOT[type], ...fields });
  const result = type === "page" ? await createPage(ctxOf(env, t.owner), { kind: "generic" }, form) : await createItem(ctxOf(env, t.owner), SPECS[type], form);
  return expectOk(result).id;
}

/** The three views of one item's language states: the editor, the list (SQL), the picker (SQL). */
async function states(type: EntityType, id: string) {
  const editor = (await loadEditorItem(db(), SPECS[type], id))!.states;
  const listed = (await listItems(db(), type, parseListParams(type, { status: "all", size: "100" }))).rows.find((r) => r.id === id)!.state;
  const [ref] = await refsByIds(db(), type, [id]);
  return { editor, listed, picked: ref.state };
}

describe("the lists' SQL state equals the editor's state, for every type", () => {
  for (const type of ENTITY_TYPES) {
    test(type, async () => {
      const spec = SPECS[type];
      const required = spec.fields.filter((f) => f.required);
      const cases: { slug: string; fields: Fields; expect: { en: string; ar: string }; then?: Fields }[] = [];
      let n = 0;
      const slug = () => `demo-${type.replace("_", "-")}-${TAGS[n++ % TAGS.length]}-${n}`;
      // Every required field filled: a draft; the other language has no text: missing.
      cases.push({ slug: slug(), fields: texts(type, "en", "alpha"), expect: { en: "draft", ar: "missing" } });
      // Each required field missing in turn, the language still holding text: incomplete. (A type whose only field is
      // required — categories, clients — can't be incomplete: without that field the language has no text at all.)
      for (const field of required) {
        const fields = textsWithout(type, "en", "bravo", field.key);
        if (fields) cases.push({ slug: slug(), fields, expect: { en: "incomplete", ar: "missing" } });
      }
      // Marked complete; the other language partly written (its first required field only).
      const first = required[0];
      cases.push({
        slug: slug(),
        fields: { ...texts(type, "en", "charlie"), "en.complete": "1", [`ar.${first.key}`]: valueOf(first, "charlie") },
        expect: { en: "complete", ar: required.length > 1 ? "incomplete" : "draft" },
      });
      // Both complete, then English changes: Arabic needs review.
      cases.push({
        slug: slug(),
        fields: { ...texts(type, "en", "delta"), ...texts(type, "ar", "delta"), "en.complete": "1", "ar.complete": "1" },
        then: { ...texts(type, "en", "echo"), ...texts(type, "ar", "delta"), "en.complete": "1", "ar.complete": "1" },
        expect: { en: "complete", ar: "needs_review" },
      });
      if (spec.children) {
        const full = { ...texts(type, "en", "foxtrot"), ...texts(type, "ar", "foxtrot") };
        // A child item with both languages: both drafts.
        cases.push({ slug: slug(), fields: { ...full, children: JSON.stringify([child(["Demo label", "Demo value"], ["تسمية", "قيمة"])]) }, expect: { en: "draft", ar: "draft" } });
        // A child item without its Arabic label and value: Arabic incomplete.
        cases.push({ slug: slug(), fields: { ...full, children: JSON.stringify([child(["Demo label", "Demo value"], ["", ""])]) }, expect: { en: "draft", ar: "incomplete" } });
        // A child item with an Arabic label but no Arabic value: Arabic incomplete.
        cases.push({ slug: slug(), fields: { ...full, children: JSON.stringify([child(["Demo label", "Demo value"], ["تسمية", ""])]) }, expect: { en: "draft", ar: "incomplete" } });
        // English without its value: English incomplete.
        cases.push({ slug: slug(), fields: { ...full, children: JSON.stringify([child(["Demo label", ""], ["تسمية", "قيمة"])]) }, expect: { en: "incomplete", ar: "draft" } });
      }
      assert.ok(cases.length >= 3);
      for (const c of cases) {
        const id = await create(type, c.slug, c.fields);
        if (c.then) {
          const [{ v }] = await query<{ v: number }>(env, `SELECT lock_version AS v FROM ${ENTITIES[type].table} WHERE id = ?`, [id]);
          const form = formOf({ slug: c.slug, ...ROOT[type], ...c.then, lockVersion: String(v) });
          expectOk(type === "page" ? await updatePage(ctxOf(env, t.owner), id, form) : await updateItem(ctxOf(env, t.owner), spec, id, form));
        }
        const seen = await states(type, id);
        assert.deepEqual(seen.editor, c.expect, `${type} ${c.slug}: the editor's state`);
        assert.deepEqual(seen.listed, seen.editor, `${type} ${c.slug}: the list's SQL state`);
        assert.deepEqual(seen.picked, seen.editor, `${type} ${c.slug}: the picker's SQL state`);
      }
    });
  }
});
