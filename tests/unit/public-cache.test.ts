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

