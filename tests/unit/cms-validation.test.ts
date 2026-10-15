/**
 * Core CMS (A3) — per-record validation on the server (A3 brief §35), without a database: every type's schema reads
 * only the fields it defines, refuses markup and over-long text, checks addresses, years, power, enums, relation ids,
 * the attribute/fact list's exact shape and the SEO lengths, and names each problem by its form field.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseInput } from "../../src/server/cms/engine.ts";
import { formToObject } from "../../src/server/cms/form.ts";
import { certificateSpec, clientSpec, industrySpec, machineSpec, pageSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { LIMITS } from "../../src/server/cms/registry.ts";

const form = (fields: Record<string, string | string[]>) =>
  formToObject(Object.entries(fields).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]])));
const ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("validation names each problem by its field", () => {
  test("a page: title length, markup, SEO lengths, canonical path, and the version on update", () => {
    const ok = parseInput(pageSpec, "update", form({ lockVersion: "3", slug: "x", "en.title": "Title", "ar.seoTitle": "عنوان" }));
    assert.equal(ok.ok, true);
    const bad = parseInput(
      pageSpec,
      "update",
      form({
        lockVersion: "-1",
        "en.title": "x".repeat(LIMITS.text.pageTitle + 1),
        "ar.title": "<b>x</b>",
        "en.seoTitle": "x".repeat(LIMITS.text.seoTitle + 1),
        "en.seoDescription": "x".repeat(LIMITS.text.seoDescription + 1),
        "seo.advanced": "1",
        "seo.canonicalOverride": "https://evil.example/x",
      }),
    );
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["ar.title", "en.seoDescription", "en.seoTitle", "en.title", "lockVersion", "seo.canonicalOverride"]);
    assert.equal(parseInput(pageSpec, "update", form({ "en.title": "T" })).ok, false, "an update needs the version it was opened with");
  });

  test("a service: enums from the registry, required on save; rich text paragraphs; at most 8 highlights", () => {
    const bad = parseInput(serviceSpec, "create", form({ serviceGroup: "other", iconKey: "<svg>", "en.body": "<script>x</script>", "en.highlights": Array(9).fill("x").join("\n") }));
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["en.body", "en.highlights", "iconKey", "serviceGroup"]);
    const ok = parseInput(serviceSpec, "create", form({ serviceGroup: "metal", iconKey: "laser-cutting", "en.body": "One.\n\nTwo." }));
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal((ok.input.en.body as { content: unknown[] }).content.length, 2);
  });

  test("relations: ids only (ULIDs), never names or paths", () => {
    const bad = parseInput(serviceSpec, "create", form({ serviceGroup: "metal", iconKey: "fabrication", "rel.machines": ["../../x"] }));
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.ok(bad.errors["rel.machines.0"] ?? bad.errors["rel.machines"]);
    assert.equal(parseInput(serviceSpec, "create", form({ serviceGroup: "metal", iconKey: "fabrication", "rel.machines": [ID] })).ok, true);
  });

  test("a machine: power is a whole number of watts when stated, empty when not; attributes are an exact list", () => {
    for (const powerWatts of ["0", "-1", "6,000", "6kW", "1.5", "100001"]) assert.equal(parseInput(machineSpec, "create", form({ powerWatts })).ok, false, powerWatts);
    const none = parseInput(machineSpec, "create", form({ powerWatts: "" }));
    assert.ok(none.ok && none.input.powerWatts === undefined);
    const children = (value: unknown) => parseInput(machineSpec, "create", form({ children: JSON.stringify(value) }));
    assert.equal(children([{ id: null, en: { label: "Bed", value: "3 m" }, ar: { label: "", value: "" } }]).ok, true);
    assert.equal(children([{ id: null, en: { label: "Bed", value: "3 m" }, ar: { label: "", value: "" }, onclick: "x" }]).ok, false);
    assert.equal(children([{ id: "not-an-id", en: { label: "a", value: "b" }, ar: { label: "", value: "" } }]).ok, false);
    assert.equal(children([{ id: null, en: { label: "a", value: "b" } }]).ok, false);
    assert.equal(children("a string").ok, false);
    assert.equal(children(Array.from({ length: LIMITS.attributes + 1 }, () => ({ id: null, en: { label: "a", value: "b" }, ar: { label: "", value: "" } }))).ok, false);
    assert.equal(parseInput(machineSpec, "create", form({ children: "{oops" })).ok, false);
  });

  test("a project: year range, gallery reference shape, client id, confirmed details plain text", () => {
    for (const [field, value] of [
      ["year", "1899"],
      ["year", "2101"],
      ["year", "two thousand"],
      ["galleryRef", "<b>04</b>"],
      ["galleryRef", "x".repeat(LIMITS.text.galleryRef + 1)],
      ["clientId", "client-1"],
      ["en.location", "<iframe src=x>"],
    ]) {
      assert.equal(parseInput(projectSpec, "create", form({ [field]: value })).ok, false, `${field}=${value}`);
    }
    const ok = parseInput(projectSpec, "create", form({ year: "2024", galleryRef: "p.3", isFeatured: "1" }));
    assert.ok(ok.ok && ok.input.year === 2024 && ok.input.isFeatured === true);
  });

  test("an industry: classification from the list only", () => {
    assert.equal(parseInput(industrySpec, "create", form({ classification: "profile_sector" })).ok, true);
    assert.equal(parseInput(industrySpec, "create", form({ classification: "anything" })).ok, false);
  });

  test("a client: https address only", () => {
    assert.equal(parseInput(clientSpec, "create", form({ websiteUrl: "https://example.com" })).ok, true);
    for (const websiteUrl of ["http://example.com", "javascript:alert(1)", "https://localhost"]) assert.equal(parseInput(clientSpec, "create", form({ websiteUrl })).ok, false, websiteUrl);
  });

  test("a certificate: the digit guard on title, issuer and facts; the expiry a real date", () => {
    const cases: Record<string, string>[] = [{ "en.title": "Licence 1234567" }, { "ar.issuer": "جهة ١٢٣٤٥٦٧" }, { expiresOn: "2027-02-30" }, { expiresOn: "31/12/2027" }];
    for (const fields of cases) {
      assert.equal(parseInput(certificateSpec, "create", form(fields)).ok, false, JSON.stringify(fields));
    }
    const facts = JSON.stringify([{ id: null, en: { label: "Number", value: "10 2034 5678" }, ar: { label: "", value: "" } }]);
    assert.equal(parseInput(certificateSpec, "create", form({ children: facts })).ok, false);
    assert.equal(parseInput(certificateSpec, "create", form({ expiresOn: "2028-02-29", "en.title": "Test Licence" })).ok, true);
  });

  test("fields a schema does not define never reach a column (no mass assignment)", () => {
    const parsed = parseInput(clientSpec, "create", form({ "en.name": "Demo", createdBy: ID, publicationStatus: "published", id: ID, lockVersion: "9", "en.translationStatus": "complete" }));
    assert.ok(parsed.ok);
    if (parsed.ok) {
      for (const key of ["createdBy", "publicationStatus", "id", "lockVersion"]) assert.equal(key in parsed.input, false, key);
      assert.equal("translationStatus" in parsed.input.en, false);
    }
  });

  test("source fields: a basis from the list, pages as numbers, a plain-text note", () => {
    assert.equal(parseInput(machineSpec, "create", form({ sourceBasis: "profile", sourcePages: "7", sourceNote: "Profile page 7." })).ok, true);
    assert.equal(parseInput(machineSpec, "create", form({ sourceBasis: "rumour" })).ok, false);
    assert.equal(parseInput(machineSpec, "create", form({ sourcePages: "seven" })).ok, false);
    assert.equal(parseInput(machineSpec, "create", form({ sourceNote: "<a href=x>x</a>" })).ok, false);
  });
});
