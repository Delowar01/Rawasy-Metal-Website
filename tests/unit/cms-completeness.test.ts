/**
 * Core CMS (A3 Correction 1) — one definition of language completeness. The editor decides a language's state from its
 * spec's fields (`engine.ts` `requiredFilled`) and the lists and pickers in SQL (`list.ts` `localeStateSql`); until
 * this correction the SQL side kept its own map of required columns. Both now read `translated.ts`, and these tests hold
 * every one of the eight types to it: the specs use the shared fields (not copies), the SQL rule is exactly the required
 * fields with the right emptiness test per kind, required columns are NOT NULL (a NULL would read as filled in SQL),
 * child items match, the title column is valid, and the registry's table names match the schema. A drift on either
 * side fails here; `tests/integration/cms-completeness.test.ts` compares the two states on real rows.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { MySqlDialect, type AnyMySqlTable } from "drizzle-orm/mysql-core";
import { SPECS } from "../../src/server/cms/kinds.ts";
import { localeStateSql } from "../../src/server/cms/list.ts";
import { ENTITIES, ENTITY_TYPES, type EntityType } from "../../src/server/cms/registry.ts";
import { COMPLETENESS, completenessRule, TRANSLATED, type TextKind } from "../../src/server/cms/translated.ts";

type ColumnInfo = { name: string; notNull: boolean };
const columns = (table: AnyMySqlTable) => getTableColumns(table) as unknown as Record<string, ColumnInfo>;

/** What the SQL rule must be, worked out here from the editor's own spec (the table's columns, by field key). */
function expectedRule(type: EntityType) {
  const spec = SPECS[type];
  const cols = columns(spec.tr);
  const required = (kinds: TextKind[]) => spec.fields.filter((f) => f.required && kinds.includes(f.kind)).map((f) => cols[f.key]?.name);
  return { title: cols[spec.titleKey]?.name, text: required(["line", "text"]), rich: required(["rich"]), lines: required(["lines"]) };
}

const dialect = new MySqlDialect();
const sqlOf = (type: EntityType) => dialect.sqlToQuery(localeStateSql(type, "te", "en")).sql;

describe("language completeness has one definition, used by the editor and the lists", () => {
  test("all eight types are covered", () => {
    assert.deepEqual(Object.keys(TRANSLATED).sort(), [...ENTITY_TYPES].sort());
    assert.deepEqual(Object.keys(COMPLETENESS).sort(), [...ENTITY_TYPES].sort());
    assert.deepEqual(Object.keys(SPECS).sort(), [...ENTITY_TYPES].sort());
  });

  for (const type of ENTITY_TYPES) {
    describe(type, () => {
      const spec = SPECS[type];
      const shared = TRANSLATED[type];

      test("the editor's spec uses the shared definition itself (no copy of the fields)", () => {
        assert.equal(spec.fields, shared.fields, "the same field list");
        assert.equal(spec.titleKey, shared.titleKey);
        assert.equal(spec.tr, shared.tr);
        assert.equal(spec.trParentColumn, shared.trParentColumn);
        assert.equal(spec.trLocaleColumn, shared.trLocaleColumn);
        assert.equal(spec.trParentKey, shared.trParentKey);
      });

      test("the SQL rule is exactly the required fields, each tested by its kind", () => {
        const rule = COMPLETENESS[type];
        const expected = expectedRule(type);
        assert.deepEqual({ title: rule.title, text: rule.text, rich: rule.rich, lines: rule.lines }, expected);
        assert.deepEqual(completenessRule(type), rule, "derived once, the same each time");
        assert.ok(rule.text.length + rule.rich.length + rule.lines.length > 0, "at least one required field (an empty AND would be invalid SQL)");
        const text = sqlOf(type);
        for (const column of rule.text) assert.ok(text.includes(`\`te\`.\`${column}\` <> ''`), `${column} is tested as text`);
        for (const column of rule.rich) assert.ok(text.includes(`JSON_LENGTH(\`te\`.\`${column}\`, '$.content') > 0`), `${column} is tested as a document`);
        for (const column of rule.lines) assert.ok(text.includes(`JSON_LENGTH(\`te\`.\`${column}\`) > 0`), `${column} is tested as a list`);
        const tested = [...text.matchAll(/`te`\.`([a-z_]+)`/g)].map((m) => m[1]).filter((c) => c !== ENTITIES[type].trParent && c !== "translation_status");
        assert.deepEqual([...new Set(tested)].sort(), [...rule.text, ...rule.rich, ...rule.lines].sort(), "the SQL tests no other column");
      });

      test("every required column, and the title, is NOT NULL (the SQL test of a NULL would read as filled)", () => {
        const cols = columns(spec.tr);
        const title = spec.fields.find((f) => f.key === spec.titleKey);
        assert.ok(title?.required, "the title field is required");
        assert.equal(title?.kind, "line");
        for (const field of spec.fields.filter((f) => f.required)) {
          assert.ok(cols[field.key], `${field.key} has a column`);
          assert.equal(cols[field.key].notNull, true, `${field.key} is NOT NULL`);
          assert.notEqual(field.optional, true, `${field.key} is not also optional (stored NULL when empty)`);
        }
      });

      test("child items: the same tables in the editor and the SQL rule, label and value required", () => {
        const rule = COMPLETENESS[type];
        const tables = shared.childTables;
        if (!tables) {
          assert.equal(spec.children, undefined, "no child items in the editor either");
          assert.equal(rule.children, undefined);
          return;
        }
        assert.ok(spec.children, "the editor has the child items");
        for (const key of ["table", "idColumn", "parentColumn", "positionColumn", "parentKey", "trTable", "trParentColumn", "trLocaleColumn", "trParentKey"] as const) {
          assert.equal(spec.children[key], tables[key], `children.${key}`);
        }
        assert.deepEqual(rule.children, {
          table: getTableName(spec.children.table),
          parent: (spec.children.parentColumn as unknown as ColumnInfo).name,
          tr: getTableName(spec.children.trTable),
          trParent: (spec.children.trParentColumn as unknown as ColumnInfo).name,
        });
        const trCols = columns(spec.children.trTable);
        assert.equal(trCols.label?.notNull, true, "the child label is NOT NULL");
        assert.equal(trCols.value?.notNull, true, "the child value is NOT NULL");
        const text = sqlOf(type);
        assert.ok(text.includes(`ct.\`${rule.children!.trParent}\` IS NULL OR ct.label = '' OR ct.value = ''`), "the SQL requires each child's label and value");
      });

      test("the registry's table and column names are the schema's", () => {
        assert.equal(ENTITIES[type].table, getTableName(spec.root));
        assert.equal(ENTITIES[type].trTable, getTableName(spec.tr));
        assert.equal(ENTITIES[type].trParent, (spec.trParentColumn as unknown as ColumnInfo).name);
      });
    });
  }

  test("only machinery and certificates have child items", () => {
    assert.deepEqual(
      ENTITY_TYPES.filter((type) => TRANSLATED[type].childTables),
      ["machine", "certificate"],
    );
  });
});
