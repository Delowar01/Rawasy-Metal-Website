/**
 * A9 acceptance review L-1 — the content loader's circuit breaker (`src/server/public/breaker.ts`): five failed reads in
 * a row open it for 60 s; a failure is counted once per failed read, so requests that waited on one shared snapshot load
 * (one error, delivered to each of them) count it once; a full local queue is never counted.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createBreaker } from "../../src/server/public/breaker.ts";

describe("A9 acceptance L-1: the content loader's breaker", () => {
  test("one shared load's failure, received by many waiting requests, counts once", () => {
    const b = createBreaker(5, 60_000, () => 0);
    const shared = new Error("PUBLIC_READ_TIMEOUT");
    for (let i = 0; i < 12; i++) b.failed(shared, false);
    assert.equal(b.isOpen(), false, "twelve requests waited on one load: one failure");
  });

  test("five failed reads in a row open it for the given time; a success starts the count again", () => {
    let t = 1_000;
    const b = createBreaker(5, 60_000, () => t);
    for (let i = 0; i < 4; i++) b.failed(new Error("ECONNREFUSED"), false);
    b.succeeded();
    for (let i = 0; i < 4; i++) b.failed(new Error("ECONNREFUSED"), false);
    assert.equal(b.isOpen(), false, "four in a row after a success");
    b.failed(new Error("ECONNREFUSED"), false);
    assert.equal(b.isOpen(), true);
    t += 59_999;
    assert.equal(b.isOpen(), true);
    t += 1;
    assert.equal(b.isOpen(), false, "closed again after 60 s");
  });

  test("a full local queue is load here, not the database failing: never counted", () => {
    const b = createBreaker(5, 60_000, () => 0);
    for (let i = 0; i < 10; i++) b.failed(new Error("Queue limit reached."), true);
    assert.equal(b.isOpen(), false);
  });

  test("a failure that is not an object (a thrown string) still counts, each time", () => {
    const b = createBreaker(2, 60_000, () => 0);
    b.failed("down", false);
    b.failed("down", false);
    assert.equal(b.isOpen(), true);
  });
});
