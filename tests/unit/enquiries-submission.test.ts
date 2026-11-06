/**
 * The prepared submission's pure parts (A7.5): the signed timing token (its signature, its form, its age, its key
 * derived for its own purpose), the field checks against a form definition (today's rules and messages: names, email,
 * phone digits of any script, the choices, lengths, hidden characters, unknown fields, the consent box) and the CSV
 * export's cells (never a formula).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { projectTypeLabel } from "../../src/server/enquiries/enquiries.ts";
import { csvCell, csvRow } from "../../src/server/enquiries/export.ts";
import { issueToken, tokenKeyFrom, verifyToken } from "../../src/server/enquiries/token.ts";
import { latinDigits, validateSubmission } from "../../src/server/enquiries/validate.ts";
import { staticCopy, staticFieldTexts } from "../../src/server/forms/copy.ts";
import type { FormModel } from "../../src/server/forms/forms.ts";
import { QUOTE_FIELDS } from "../../src/server/forms/registry.ts";

const KEY = Buffer.alloc(32, 3);
const NOW = new Date("2026-11-01T10:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("the timing token", () => {
  test("valid from the minimum fill time to two hours, for its form, with its key", () => {
    assert.equal(verifyToken(KEY, issueToken(KEY, "quote", ago(60_000)), "quote", NOW, 3).ok, true);
    assert.deepEqual(verifyToken(KEY, issueToken(KEY, "quote", ago(2_000)), "quote", NOW, 3), { ok: false, reason: "too_fast" });
    assert.deepEqual(verifyToken(KEY, issueToken(KEY, "quote", ago(2 * 60 * 60 * 1000 + 1)), "quote", NOW, 3), { ok: false, reason: "expired" });
    assert.deepEqual(verifyToken(KEY, issueToken(KEY, "quote", ago(60_000)), "other", NOW, 3), { ok: false, reason: "token" });
    assert.deepEqual(verifyToken(Buffer.alloc(32, 4), issueToken(KEY, "quote", ago(60_000)), "quote", NOW, 3), { ok: false, reason: "token" });
    assert.deepEqual(verifyToken(KEY, issueToken(KEY, "quote", new Date(NOW.getTime() + 10 * 60_000)), "quote", NOW, 3), { ok: false, reason: "token" });
  });

  test("any change to a token is refused; garbage is refused", () => {
    const token = issueToken(KEY, "quote", ago(60_000));
    const parts = token.split(".");
    const later = [...parts];
    later[1] = (parseInt(parts[1], 36) - 3_600_000).toString(36);
    for (const forged of [later.join("."), token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), `${token}x`, "", "v1.....", 42, null, "v1.x.y.quote.z"]) {
      assert.equal(verifyToken(KEY, forged, "quote", NOW, 3).ok, false, String(forged));
    }
  });

  test("the key is derived for its own purpose (never the encryption key itself) and stable", () => {
    const active = Buffer.alloc(32, 9);
    const derived = tokenKeyFrom(active);
    assert.equal(derived.length, 32);
    assert.notDeepEqual(derived, active);
    assert.deepEqual(tokenKeyFrom(active), derived);
  });
});

/** The quote form as set-up stores it (today's), with the given changes. */
function form(change: (f: FormModel) => void = () => {}): FormModel {
  const model: FormModel = {
    id: "01K8F0RM000000000000000QTE",
    key: "quote",
    setUp: true,
    lockVersion: 1,
    updatedAt: null,
    settings: { isEnabled: true, deliveryMode: "store", notificationEmails: [], retentionDays: null, honeypotEnabled: true, minFillSeconds: 3, consentMode: "notice", acceptFiles: false, maxFiles: 5, maxFileMb: 10, acceptedExtensions: [".pdf"] },
    copy: { en: staticCopy("en"), ar: staticCopy("ar") },
    status: { en: "complete", ar: "complete" },
    fields: QUOTE_FIELDS.map((def, i) => ({
      id: `F${i}`,
      key: def.key,
      type: def.type,
      group: def.group,
      position: i + 1,
      isRequired: def.required,
      isSystem: true,
      requiredLocked: def.requiredLocked,
      bounds: def.length ? { floor: def.length.floor, ceiling: def.length.max } : null,
      minLength: def.length?.min ?? null,
      maxLength: def.length?.max ?? null,
      options: def.options ? [...def.options] : null,
      texts: { en: staticFieldTexts(def, "en"), ar: staticFieldTexts(def, "ar") },
    })),
  };
  change(model);
  return model;
}
const SERVICES = ["laser-cutting", "laser-engraving"];
const valid = { fullName: "Test Person", email: "test@example.test", phone: "+966 50 123 4567", service: "laser-cutting", message: "A synthetic request for the unit tests." };

describe("the fields against the form (today's rules)", () => {
  test("a valid submission, trimmed; Arabic-Indic digits in a phone", () => {
    const result = validateSubmission(form(), "en", { ...valid, fullName: "  Test Person  ", phone: "٠٥٠١٢٣٤٥٦٧" }, SERVICES);
    assert.ok(result.ok);
    if (result.ok) assert.deepEqual([result.values.fullName, result.values.phone], ["Test Person", "٠٥٠١٢٣٤٥٦٧"]);
    assert.equal(latinDigits("٠٥٠۱۲۳"), "050123");
  });

  test("today's golden refusals, with today's messages in the submission's language", () => {
    const result = validateSubmission(form(), "en", { fullName: "T", email: "name@", phone: "12", service: "", message: "Too short" }, SERVICES);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.errors, {
      fullName: "Enter your full name.",
      email: "Enter a valid email address, like name@company.com.",
      phone: "Enter a phone number with 8 to 15 digits.",
      service: "Choose a service.",
      message: "Add a little more detail — at least 20 characters.",
    });
    const ar = validateSubmission(form(), "ar", { ...valid, email: "" }, SERVICES);
    assert.equal(!ar.ok && ar.errors.email, "أدخل بريدك الإلكتروني.");
  });

  test("choices, lengths, hidden characters, line breaks in a one-line field, unknown fields", () => {
    const refused = (fields: Record<string, unknown>) => validateSubmission(form(), "en", { ...valid, ...fields }, SERVICES);
    assert.equal(refused({ service: "scaffolding-rental-xyz" }).ok, false);
    assert.equal(refused({ service: "not-sure" }).ok, true);
    assert.equal(refused({ projectType: "bogus" }).ok, false);
    assert.equal(refused({ projectType: "rental" }).ok, true);
    assert.equal(refused({ fullName: "x".repeat(121) }).ok, false);
    assert.equal(refused({ message: "x".repeat(4001) }).ok, false);
    assert.equal(refused({ fullName: "Test\u202eNamE" }).ok, false);
    assert.equal(refused({ company: "Test\u0007Co" }).ok, false);
    assert.equal(refused({ fullName: "Test\nPerson" }).ok, false);
    assert.equal(refused({ message: "Line one of the request\nline two of the request" }).ok, true);
    assert.equal(refused({ message: "Thickness < 5 mm please, about forty sheets" }).ok, true, "angle brackets are text");
    assert.equal(refused({ fullName: ["array"] }).ok, false);
    const unknown = refused({ admin: "1" });
    assert.ok(!unknown.ok && unknown.unknown.includes("admin"));
  });

  test("the form's own rules: a field made required, a narrower length, the consent box", () => {
    const strict = form((f) => {
      f.fields.find((x) => x.key === "company")!.isRequired = true;
      f.fields.find((x) => x.key === "company")!.texts.en.errorRequired = "Test: company please.";
      f.fields.find((x) => x.key === "message")!.maxLength = 50;
      f.settings.consentMode = "checkbox";
      f.copy.en.consent = { label: "Test consent", error: "Test: tick the box." };
    });
    const result = validateSubmission(strict, "en", { ...valid, message: "x".repeat(60) }, SERVICES);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.errors.company, "Test: company please.");
      assert.ok(result.errors.message);
      assert.equal(result.errors.consent, "Test: tick the box.");
    }
    assert.ok(validateSubmission(strict, "en", { ...valid, company: "Test Co", consent: "yes" }, SERVICES).ok);
  });
});

describe("the CSV export's cells", () => {
  test("formulas become text; quotes doubled; rows joined", () => {
    for (const [value, cell] of [
      ["=cmd|' /C calc'!A0", `"'=cmd|' /C calc'!A0"`],
      ["+1", `"'+1"`],
      ["-1", `"'-1"`],
      ["@x", `"'@x"`],
      ["\t=x", `"'\t=x"`],
      ["\r=x", `"'\r=x"`],
      [" =x", `"' =x"`],
      ["a,b", `"a,b"`],
      ['a"b', `"a""b"`],
      [null, `""`],
      [42, `"42"`],
      ["اسم", `"اسم"`],
    ] as [unknown, string][]) {
      assert.equal(csvCell(value), cell, String(value));
    }
    assert.equal(csvRow(["a", "=b"]), `"a","'=b"`);
  });
});

describe("an enquiry's project type", () => {
  test("shown and exported as today's English label, never the stored key; an unknown key as stored", () => {
    assert.equal(projectTypeLabel("custom-piece"), "Custom piece or one-off");
    assert.equal(projectTypeLabel("not-a-type"), "not-a-type");
    assert.equal(projectTypeLabel(""), "");
  });
});
