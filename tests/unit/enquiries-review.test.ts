/**
 * The A7 security review's findings in pure code (each test fails on the code before its correction): the inbox's
 * sort is read from its own keys only, never the prototype's (L3); an enquiry's Email and Phone links carry the address
 * as an address — no mailto parameters, Arabic digits dialled (L2); a download name keeps the stored extension however
 * it is cut (L1); the per-address limit's bucket (I7).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseQuery } from "../../src/server/enquiries/enquiries.ts";

/** A named export of a module, which the correction adds (an assertion, not a load error, on the code before). */
async function exported<T>(path: string, name: string): Promise<T> {
  const mod = (await import(path)) as Record<string, unknown>;
  assert.equal(typeof mod[name], "function", `${path} exports ${name}`);
  return mod[name] as T;
}

describe("L3: the inbox's sort", () => {
  test("a prototype name is not a sort: the default instead (no raw SQL from Object.prototype)", () => {
    for (const sort of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) assert.equal(parseQuery({ sort }).sort, "newest", sort);
    for (const sort of ["newest", "oldest", "reference", "status"]) assert.equal(parseQuery({ sort }).sort, sort);
  });
});

describe("L2: the Email and Phone links", () => {
  test("mailto: the address's own characters are encoded, so nothing in it becomes a parameter", async () => {
    const mailtoHref = await exported<(email: string) => string>("../../src/server/enquiries/enquiries.ts", "mailtoHref");
    assert.equal(mailtoHref("test.visitor@example.test"), "mailto:test.visitor@example.test");
    assert.equal(mailtoHref("first.last+quote@example.test"), "mailto:first.last%2Bquote@example.test");
    const tricky = mailtoHref("a?bcc=x&body=y#z%@example.test");
    assert.equal(tricky, "mailto:a%3Fbcc%3Dx%26body%3Dy%23z%25@example.test");
    assert.doesNotMatch(tricky.slice("mailto:".length), /[?&#=]/);
  });

  test("tel: digits of any script are dialled as Latin digits; the plus kept", async () => {
    const telHref = await exported<(phone: string) => string>("../../src/server/enquiries/enquiries.ts", "telHref");
    assert.equal(telHref("+966 50 123 4567"), "tel:+966501234567");
    assert.equal(telHref("٠٥٠١٢٣٤٥٦٧"), "tel:0501234567");
    assert.equal(telHref("۰۵۰ ۱۲۳ ۴۵۶۷"), "tel:0501234567");
  });
});

describe("L1: a download name", () => {
  test("cut to fit, it still ends with the stored extension; the extension is never doubled or lost", async () => {
    const downloadName = await exported<(name: string, extension: string, max?: number) => string>("../../src/server/enquiries/files.ts", "downloadName");
    const long = downloadName(`Drawing-${"x".repeat(188)}.bat.pdf`, "pdf", 200);
    assert.match(long, /\.pdf$/);
    assert.ok([...long].length <= 200);
    assert.equal(downloadName("drawing.pdf", "pdf"), "drawing.pdf");
    assert.equal(downloadName("drawing.PDF", "pdf"), "drawing.PDF");
    assert.equal(downloadName("photo.jpeg", "jpg"), "photo.jpeg");
    assert.equal(downloadName("scan", "png"), "scan.png");
    assert.equal(downloadName(".pdf", "pdf"), "file.pdf");
    assert.match(downloadName(`${"ب".repeat(300)}.pdf`, "pdf", 200), /^ب+\.pdf$/);
  });
});

describe("I7: the per-address bucket", () => {
  test("IPv4 as it is; IPv6 by its /64; an IPv4-mapped address as IPv4", async () => {
    const addressBucket = await exported<(ip: string) => string>("../../src/server/enquiries/submission.ts", "addressBucket");
    assert.equal(addressBucket("198.51.100.7"), "198.51.100.7");
    assert.equal(addressBucket("2001:db8:1:2::1"), addressBucket("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"));
    assert.notEqual(addressBucket("2001:db8:1:2::1"), addressBucket("2001:db8:1:3::1"));
    assert.equal(addressBucket("::ffff:198.51.100.7"), "198.51.100.7");
    assert.equal(addressBucket("2001:DB8::1"), addressBucket("2001:db8:0:0::2"));
  });
});
