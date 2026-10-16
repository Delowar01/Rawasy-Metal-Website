/**
 * Media library (A4) — the JSON bodies of the upload routes are read with a byte cap while they stream (security review
 * M3): a chunked body (no Content-Length) is never buffered whole.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readJsonBody } from "../../src/server/media/json-body.ts";

/** A request whose body streams `chunks` chunks of `size` bytes, counting what was pulled from it. */
function streaming(chunks: number, size: number, headers: Record<string, string> = {}) {
  let pulled = 0;
  let sent = 0;
  // highWaterMark 0: a chunk is produced only when the reader asks for one (nothing is pulled ahead).
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (sent >= chunks) return controller.close();
        sent++;
        pulled += size;
        controller.enqueue(new Uint8Array(size).fill(0x20));
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request("http://localhost/api/admin/media/uploads", { method: "POST", body, headers, duplex: "half" } as RequestInit);
  return { request, pulled: () => pulled };
}

describe("readJsonBody", () => {
  test("a chunked body longer than the cap is refused after the cap, not read to its end", async () => {
    const big = streaming(1024, 64 * 1024);
    assert.equal(await readJsonBody(big.request, 4096), null);
    assert.ok(big.pulled() <= 2 * 64 * 1024, `pulled ${big.pulled()} bytes of 64 MiB`);
  });

  test("a declared length over the cap is refused before anything is read", async () => {
    const declared = streaming(10, 1024, { "content-length": "10240" });
    assert.equal(await readJsonBody(declared.request, 4096), null);
    assert.equal(declared.pulled(), 0);
    assert.equal(await readJsonBody(new Request("http://localhost/x", { method: "POST", body: "{}", headers: { "content-length": "1e3" } }), 4096), null, "a malformed length");
  });

  test("JSON within the cap is parsed; an empty body is {}; not JSON or not UTF-8 is null", async () => {
    const post = (body: BodyInit) => new Request("http://localhost/x", { method: "POST", body });
    assert.deepEqual(await readJsonBody(post(JSON.stringify({ purpose: "new", filename: "ملف.jpg", size: 10 }))), { purpose: "new", filename: "ملف.jpg", size: 10 });
    assert.deepEqual(await readJsonBody(new Request("http://localhost/x", { method: "POST" })), {});
    assert.deepEqual(await readJsonBody(post("")), {});
    assert.equal(await readJsonBody(post("{not json")), null);
    assert.equal(await readJsonBody(post(new Uint8Array([0x7b, 0xff, 0x7d]))), null);
    assert.equal(await readJsonBody(post(JSON.stringify({ x: "y".repeat(300) })), 256), null, "the complete route's 256-byte cap");
  });
});
