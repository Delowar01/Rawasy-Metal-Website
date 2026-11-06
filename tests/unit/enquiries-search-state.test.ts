/**
 * The enquiry inbox's sealed search (A7 final correction): what the browser holds is ciphertext bound to one user and a
 * 2-hour window; anything else — another user, an expired or far-future seal, a changed byte, a retired key, garbage —
 * opens as no search at all. The list's address never carries the search.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_QUERY, listAddress } from "../../src/server/enquiries/enquiries.ts";
import { cleanSearch, openSearch, sealSearch, SEARCH_STATE_MS } from "../../src/server/enquiries/search-state.ts";

const ring = { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32, 7)]]) };
const NOW = new Date("2026-11-07T08:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const USER = "01K9USER000000000000000001";
const OTHER = "01K9USER000000000000000002";

describe("the sealed search", () => {
  test("opens for its user within its window; the browser never holds the words", () => {
    const sealed = sealSearch(ring, USER, "Test Alpha Visitor", NOW);
    assert.equal(openSearch(ring, sealed, USER, later(60_000)), "Test Alpha Visitor");
    assert.ok(!sealed.includes("Alpha"));
    assert.ok(!Buffer.from(sealed.split(".")[2], "base64url").toString("latin1").includes("Alpha"));
    const arabic = sealSearch(ring, USER, "اختبار باء", NOW);
    assert.equal(openSearch(ring, arabic, USER, NOW), "اختبار باء");
  });

  test("another user, an expired seal, one sealed further ahead than a search can be: no search", () => {
    const sealed = sealSearch(ring, USER, "Test Alpha Visitor", NOW);
    assert.equal(openSearch(ring, sealed, OTHER, NOW), "");
    assert.equal(openSearch(ring, sealed, USER, later(SEARCH_STATE_MS)), "");
    const [version, expiry, blob] = sealed.split(".");
    assert.equal(openSearch(ring, `${version}.${Number(expiry) + SEARCH_STATE_MS}.${blob}`, USER, NOW), "", "a moved expiry fails the seal");
    const ahead = sealSearch(ring, USER, "x", later(SEARCH_STATE_MS * 2));
    assert.equal(openSearch(ring, ahead, USER, NOW), "");
  });

  test("a changed byte, a retired key, a malformed value or none: no search", () => {
    const sealed = sealSearch(ring, USER, "Test Alpha Visitor", NOW);
    const blob = Buffer.from(sealed.split(".")[2], "base64url");
    blob[blob.length - 1] ^= 1;
    assert.equal(openSearch(ring, `${sealed.split(".").slice(0, 2).join(".")}.${blob.toString("base64url")}`, USER, NOW), "");
    assert.equal(openSearch({ activeVersion: 2, keys: new Map([[2, Buffer.alloc(32, 9)]]) }, sealed, USER, NOW), "");
    for (const bad of ["", "garbage", "1.2.3", `1.${NOW.getTime() + 1000}.short`, undefined]) assert.equal(openSearch(ring, bad, USER, NOW), "", String(bad));
  });

  test("a search is cleaned as the list reads it: trimmed, control characters dropped, at most 100 characters", () => {
    assert.equal(cleanSearch("  Test  "), "Test");
    assert.equal(cleanSearch(`a${String.fromCharCode(0)}b${String.fromCharCode(10)}c`), "a b c");
    assert.equal([...cleanSearch("ب".repeat(150))].length, 100);
    assert.equal(cleanSearch(42), "");
  });
});

describe("the list's address", () => {
  test("carries only the filters that hold no personal data, never the search", () => {
    assert.equal(listAddress({ ...DEFAULT_QUERY, q: "Test Alpha Visitor" }), "/admin/enquiries");
    assert.equal(listAddress({ ...DEFAULT_QUERY, q: "alpha@example.test", status: "new", sort: "oldest", page: 2, size: 10 }), "/admin/enquiries?status=new&sort=oldest&size=10&page=2");
  });
});
