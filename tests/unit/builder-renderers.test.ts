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
import { HOME_SHOWCASE_MACHINES, showcaseNotes } from "../../src/server/builder/view.ts";

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

describe("the homepage machinery showcase, frozen since TM-1", () => {
  /** A `const NAME = [ "…", … ]` list of strings, read from a source file. */
  const listIn = (file: string, name: string) => {
    const source = readFileSync(join(ROOT, file), "utf8");
    const match = new RegExp(`const ${name}(?:: [^=]+)? = \\[([^\\]]*)\\]`).exec(source);
    assert.ok(match, `${name} in ${file}`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };

  test("the preview's list of the showcase's machines is the frozen component's own, in its order", () => {
    assert.deepEqual([...HOME_SHOWCASE_MACHINES], listIn("src/components/commerce/home/Machinery.tsx", "ORDER"));
    // The Capabilities page presents the machines in the same order (its data says so).
    assert.deepEqual([...HOME_SHOWCASE_MACHINES], listIn("src/components/commerce/capabilities/data.ts", "MACHINE_ORDER"));
  });

  test("a selection the showcase draws otherwise gets a note: machines it leaves out, an order it does not keep", () => {
    const machine = (slug: string) => ({ slug, label: `Test ${slug}` });
    // The six in the showcase's order, or some of them in that order: drawn as chosen.
    assert.deepEqual(showcaseNotes(HOME_SHOWCASE_MACHINES.map(machine)), []);
    assert.deepEqual(showcaseNotes(["tube-cutting-12kw", "cnc-press-brake"].map(machine)), []);
    assert.deepEqual(showcaseNotes([]), []);
    // Another order: the showcase keeps its own.
    const reordered = showcaseNotes([...HOME_SHOWCASE_MACHINES].reverse().map(machine));
    assert.equal(reordered.length, 1);
    assert.match(reordered[0], /in its approved order/);
    // A machine outside the six: not drawn, named.
    const outside = showcaseNotes(["fiber-laser-6kw", "test-new-machine"].map(machine));
    assert.deepEqual(outside, ["The homepage showcase draws only its six approved machines: “Test test-new-machine” is not shown."]);
    // Both at once.
    const both = showcaseNotes(["test-a", "laser-welding", "test-b", "fiber-laser-3kw"].map(machine));
    assert.equal(both.length, 2);
    assert.match(both[0], /“Test test-a”, “Test test-b” are not shown/);
    assert.match(both[1], /in its approved order/);
  });
});
