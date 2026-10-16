/**
 * Page builder (A5) — every storable block has a preview renderer (brief §36, §41–§42). `render.tsx` types its renderer
 * map over `RENDERED_BLOCKS` (`src/components/builder/keys.ts`), so a block missing from the map fails the typecheck;
 * this test keeps that list equal to the registry's storable blocks, so a block registered without a renderer, or a
 * renderer left for a block that no longer exists, fails here.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { isRenderedBlock, RENDERED_BLOCKS } from "../../src/components/builder/keys.ts";
import { REGISTRY } from "../../src/server/builder/registry.ts";

const ROOT = join(import.meta.dirname, "..", "..");

describe("preview renderers (§36, §41–§42)", () => {
  test("the rendered blocks are exactly the registry's storable blocks, each once", () => {
    const storable = REGISTRY.all()
      .filter((d) => d.storable)
      .map((d) => d.key)
      .sort();
    assert.deepEqual([...RENDERED_BLOCKS].sort(), storable);
    assert.equal(new Set(RENDERED_BLOCKS).size, RENDERED_BLOCKS.length);
    assert.equal(RENDERED_BLOCKS.length, 86);
  });

  test("the library-only reusable entry is never drawn as a block of its own", () => {
    const entry = REGISTRY.get("generic.reusable");
    assert.ok(entry && !entry.storable);
    assert.equal(isRenderedBlock("generic.reusable"), false);
    assert.equal(isRenderedBlock("generic.unknown"), false);
    assert.equal(isRenderedBlock("generic.hero"), true);
  });

  test("the renderer map is typed over the list (a missing renderer cannot compile)", () => {
    const source = readFileSync(join(ROOT, "src/components/builder/render.tsx"), "utf8");
    assert.match(source, /export const RENDERERS: Record<RenderedBlock, Renderer> = \{/);
    // The generic blocks are listed by hand there: each one, once.
    for (const key of RENDERED_BLOCKS.filter((k) => k.startsWith("generic."))) {
      assert.equal(source.split(`"${key}":`).length - 1, 1, key);
    }
  });

  test("the preview never renders editor content as HTML", () => {
    for (const dir of ["src/components/builder", "src/components/builder/generic", "src/components/builder/adapters", "src/components/admin/builder"]) {
      for (const name of readdirSync(join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n))) {
        const source = readFileSync(join(ROOT, dir, name), "utf8");
        assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${dir}/${name}`);
      }
    }
  });
});
