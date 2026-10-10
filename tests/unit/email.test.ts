/** A2 Correction 1 (security review, finding 3): one key for every spelling of an email address. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEmail } from "../../src/server/auth/accounts.ts";

/** Latin, Greek, Cyrillic and the Latin Extended Additional / Greek Extended blocks: letters that take combining marks. */
const BASES = [
  [0x20, 0x24f],
  [0x370, 0x3ff],
  [0x400, 0x4ff],
  [0x1e00, 0x1fff],
].flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)));
const MARKS = Array.from({ length: 0x36f - 0x300 + 1 }, (_, i) => String.fromCodePoint(0x300 + i));

test("normalizing twice gives the same key: every code point, every letter with one combining mark, and with two", () => {
  const unstable: string[] = [];
  const check = (value: string) => {
    const once = normalizeEmail(value);
    if (normalizeEmail(once) !== once && unstable.length < 5) unstable.push([...value].map((c) => c.codePointAt(0)?.toString(16)).join(" "));
  };
  for (let cp = 0; cp <= 0x10ffff; cp++) if (cp < 0xd800 || cp > 0xdfff) check(String.fromCodePoint(cp));
  for (const base of BASES) {
    for (const mark of MARKS) {
      check(base + mark);
      for (const second of MARKS.slice(0, 16)) check(base + mark + second);
    }
  }
  assert.deepEqual(unstable, []);
});

test("the spellings of one address give one key", () => {
  const key = "ǰosef@example.test";
  for (const spelling of ["ǰosef@example.test", "J̌osef@example.test", "ǰosef@EXAMPLE.test", " J̌OSEF@example.test\t", "ǰOSEF@Example.Test"]) {
    assert.equal(normalizeEmail(spelling), key, JSON.stringify(spelling));
  }
  assert.equal(normalizeEmail("  Owner@Example.TEST "), "owner@example.test");
});
