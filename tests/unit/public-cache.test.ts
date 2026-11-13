/**
 * A9.4 — the database-content release's page cache (`src/server/public/cache-handler.cjs`): an entry is served only
 * while the shared cache generation (and epoch) is the one read before its render; the read failing fails the request.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
type State = { generation: number; epoch: string };
type Handler = { get(key: string): Promise<{ value: unknown } | null>; set(key: string, data: unknown): Promise<void> };
const { createHandlerClass } = require("../../src/server/public/cache-handler.cjs") as {
  createHandlerClass: (read: () => Promise<State>, max?: number, maxBytes?: number) => new () => Handler;
};

function shared(initial: State) {
  const state = { ...initial };
  let down = false;
  return {
    state,
    fail(on: boolean) {
      down = on;
    },
    read: async () => {
      if (down) throw new Error("ECONNREFUSED");
      return { ...state };
    },
  };
}
const page = (html: string) => ({ kind: "APP_PAGE", html });

describe("A9: the fail-closed page cache", () => {
  test("a page is served from the cache while the generation holds, and rendered again once it moves", async () => {
    const s = shared({ generation: 4, epoch: "E1" });
    const cache = new (createHandlerClass(s.read))();
    assert.equal(await cache.get("/en/about"), null);
    await cache.set("/en/about", page("v4"));
    assert.deepEqual((await cache.get("/en/about"))?.value, page("v4"));
    s.state.generation = 5; // a publication
    assert.equal(await cache.get("/en/about"), null);
  });

  test("an entry is stamped with the generation read before its render: a publication during the render leaves it stale", async () => {
    const s = shared({ generation: 7, epoch: "E1" });
    const cache = new (createHandlerClass(s.read))();
    assert.equal(await cache.get("/en"), null); // the miss reads generation 7, then the render starts
    s.state.generation = 8; // published while it rendered
    await cache.set("/en", page("rendered during 7→8"));
    assert.equal(await cache.get("/en"), null, "never served as generation 8");
  });

  test("overlapping renders of one page keep the oldest stamp", async () => {
    const s = shared({ generation: 1, epoch: "E1" });
    const cache = new (createHandlerClass(s.read))();
    await cache.get("/ar");
    s.state.generation = 2;
    await cache.get("/ar"); // a second request misses while the first renders
    await cache.set("/ar", page("first"));
    await cache.set("/ar", page("second")); // its stamp was consumed: not stored under a newer one
    assert.equal(await cache.get("/ar"), null);
  });

  test("a restore's new epoch invalidates every entry, even at the same generation number", async () => {
    const s = shared({ generation: 3, epoch: "E1" });
    const cache = new (createHandlerClass(s.read))();
    await cache.get("/en/contact");
    await cache.set("/en/contact", page("before restore"));
    s.state.epoch = "E2";
    assert.equal(await cache.get("/en/contact"), null);
  });

  test("the shared state unreadable: the lookup fails (the request fails), it never falls back to a cached page", async () => {
    const s = shared({ generation: 9, epoch: "E1" });
    const cache = new (createHandlerClass(s.read))();
    await cache.get("/en/services");
    await cache.set("/en/services", page("cached"));
    s.fail(true);
    await assert.rejects(cache.get("/en/services"));
    s.fail(false);
    assert.deepEqual((await cache.get("/en/services"))?.value, page("cached"));
  });

  test("a set without a lookup stores nothing; the cache is bounded", async () => {
    const s = shared({ generation: 1, epoch: "E1" });
    const cache = new (createHandlerClass(s.read, 2))();
    await cache.set("/en/x", page("no lookup"));
    assert.equal(await cache.get("/en/x"), null);
    for (const key of ["/a", "/b", "/c"]) {
      await cache.get(key);
      await cache.set(key, page(key));
    }
    assert.equal(await cache.get("/a"), null, "the oldest was evicted");
    assert.deepEqual((await cache.get("/c"))?.value, page("/c"));
  });

  test("an answer other than 200 is never stored, and the bytes are bounded (security review L2)", async () => {
    const s = shared({ generation: 1, epoch: "E1" });
    const cache = new (createHandlerClass(s.read, 400, 10_000))();
    await cache.get("/en/services/no-such-service");
    await cache.set("/en/services/no-such-service", { kind: "APP_PAGE", html: "not found", status: 404 });
    assert.equal(await cache.get("/en/services/no-such-service"), null);
    for (const key of ["/x1", "/x2", "/x3"]) {
      await cache.get(key);
      await cache.set(key, { kind: "APP_PAGE", html: "x".repeat(4000), status: 200 });
    }
    assert.equal(await cache.get("/x1"), null, "the oldest left to stay within the bytes");
    assert.ok(await cache.get("/x3"));
  });

  test("after five failed reads in a row the cache fails at once, without waiting on the database (security review L2)", async () => {
    let reads = 0;
    const cache = new (createHandlerClass(async () => {
      reads++;
      throw new Error("ETIMEDOUT");
    }))();
    for (let i = 0; i < 5; i++) await assert.rejects(cache.get("/en"));
    await assert.rejects(cache.get("/en"));
    assert.equal(reads, 5, "the sixth lookup did not read");
  });
});


describe("A9: a server takes the content source its build was made with (the fail-closed drill)", () => {
  const { builtSource, contentSourceFor, SERVER_PHASE } = require("../../src/server/public/release-source.cjs") as {
    builtSource: (distDir: string) => "static" | "database" | null;
    contentSourceFor: (phase: string, asked: string | undefined, readBuilt: () => "static" | "database" | null) => "static" | "database";
    SERVER_PHASE: string;
  };
  const { mkdtempSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const { tmpdir } = require("node:os") as typeof import("node:os");
  const distWith = (config: Record<string, unknown> | null) => {
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a9-dist-"));
    if (config) writeFileSync(join(dir, "required-server-files.json"), JSON.stringify({ version: 1, config }));
    return dir;
  };

  test("the build's record says which source it was built with", () => {
    assert.equal(builtSource(distWith({ cacheHandler: "../src/server/public/cache-handler.cjs", cacheMaxMemorySize: 0 })), "database");
    assert.equal(builtSource(distWith({ cacheHandler: "/srv/app/src/server/public/cache-handler.cjs" })), "database");
    assert.equal(builtSource(distWith({ cacheMaxMemorySize: 52428800 })), "static");
    assert.equal(builtSource(distWith({ cacheHandler: "../some-other-handler.cjs" })), "static");
    assert.equal(builtSource(distWith(null)), null, "no build yet");
  });

  test("a server follows its build, whatever its environment lacks; it refuses an environment that names the other source", () => {
    const database = () => "database" as const;
    const statics = () => "static" as const;
    // The defect the drill found: a database build served with no CONTENT_SOURCE in the server's environment.
    assert.equal(contentSourceFor(SERVER_PHASE, undefined, database), "database");
    assert.equal(contentSourceFor(SERVER_PHASE, "database", database), "database");
    assert.equal(contentSourceFor(SERVER_PHASE, undefined, statics), "static");
    assert.throws(() => contentSourceFor(SERVER_PHASE, "static", database), /built with CONTENT_SOURCE=database/);
    assert.throws(() => contentSourceFor(SERVER_PHASE, "database", statics), /built with CONTENT_SOURCE=static/);
    assert.throws(() => contentSourceFor(SERVER_PHASE, "postgres", database), /must be "static" or "database"/);
    // The build itself (and the development server) decide from the environment; a server without a build too.
    assert.equal(contentSourceFor("phase-production-build", "database", statics), "database");
    assert.equal(contentSourceFor("phase-production-build", undefined, database), "static");
    assert.equal(contentSourceFor("phase-development-server", undefined, database), "static");
    assert.equal(contentSourceFor(SERVER_PHASE, "database", () => null), "database");
  });

  test("Next.js constructing the handler marks the fail-closed page cache as in use (the live loader requires the mark)", () => {
    const mark = Symbol.for("rawasy.public.pageCacheInUse");
    delete (globalThis as Record<symbol, unknown>)[mark];
    const Handler = createHandlerClass(async () => ({ generation: 1, epoch: "E" }));
    assert.equal((globalThis as Record<symbol, unknown>)[mark], undefined, "loading the module alone marks nothing");
    new Handler();
    assert.equal((globalThis as Record<symbol, unknown>)[mark], true);
  });
});
