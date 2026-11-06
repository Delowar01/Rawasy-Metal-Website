/**
 * Forms and enquiries (A7) — the code registry against today's public quote form, so nothing drifts: the ten fields'
 * keys, groups, required flags and lengths against `QuoteForm.tsx` (its markup's `maxLength` and `required`, its
 * `validate`) and `src/content/contact.ts`; today's copy and field texts in the working shapes, valid under the copy
 * schema, and laid back together into exactly today's `QuoteFormText`; the workflow's moves; the reference's form and
 * year; the stored-attachment types (checkable bytes only, never SVG); the seed migration against the generator.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { quoteFormText } from "../../src/components/commerce/contact/quote-text.ts";
import { contactPage } from "../../src/content/contact.ts";
import { services } from "../../src/content/services.ts";
import { fieldTextsSchema, quoteCopySchema, staticCopy, staticFieldTexts, workingQuoteFormText } from "../../src/server/forms/copy.ts";
import { ACCEPTED_TYPES } from "../../src/server/media/registry.ts";
import {
  ATTACHMENT_TYPES,
  ENQUIRY_STATUSES,
  formatReference,
  LOCALES,
  PROJECT_TYPES,
  QUOTE_FIELDS,
  REFERENCE_RE,
  referenceYear,
  transitionOf,
  TRANSITIONS,
} from "../../src/server/forms/registry.ts";

const ROOT = join(import.meta.dirname, "../..");
const FORM_SOURCE = readFileSync(join(ROOT, "src/components/commerce/contact/QuoteForm.tsx"), "utf8");

describe("the quote form's fields against today's form", () => {
  test("the same ten keys as today's content, in today's groups", () => {
    assert.deepEqual(QUOTE_FIELDS.map((f) => f.key).sort(), Object.keys(contactPage.form.fields).sort());
    const groups = Object.fromEntries(QUOTE_FIELDS.map((f) => [f.key, f.group]));
    assert.deepEqual(groups, { fullName: "details", company: "details", email: "details", phone: "details", service: "project", projectType: "project", requirement: "project", location: "project", message: "message", files: "message" });
  });

  test("required exactly where today's `validate` requires (name, email, phone, service, message)", () => {
    const body = FORM_SOURCE.slice(FORM_SOURCE.indexOf("function validate("), FORM_SOURCE.indexOf("return out;", FORM_SOURCE.indexOf("function validate(")));
    const requiredToday = [...body.matchAll(/out\.(\w+) = errors\.\1;/g)].map((m) => m[1]).sort();
    assert.deepEqual(requiredToday, ["email", "fullName", "message", "phone", "service"]);
    assert.deepEqual(QUOTE_FIELDS.filter((f) => f.required).map((f) => f.key).sort(), requiredToday);
    assert.match(body, /length < 2\) out\.fullName/);
    assert.match(body, /message\.length < 20\) out\.message = errors\.messageShort/);
    assert.equal(QUOTE_FIELDS.find((f) => f.key === "fullName")!.length!.min, 2);
    assert.equal(QUOTE_FIELDS.find((f) => f.key === "message")!.length!.min, 20);
  });

  test("each text field's maximum is the markup's maxLength", () => {
    for (const field of QUOTE_FIELDS.filter((f) => f.length)) {
      const m = new RegExp(`control\\("${field.key}"\\)[^>]*?maxLength=\\{(\\d+)\\}`, "s").exec(FORM_SOURCE);
      assert.ok(m, field.key);
      assert.equal(field.length!.max, Number(m![1]), field.key);
    }
  });

  test("the project types are today's values; the error texts named exist", () => {
    assert.deepEqual([...PROJECT_TYPES], contactPage.form.projectTypes.map((p) => p.value));
    for (const field of QUOTE_FIELDS) for (const key of Object.values(field.errors ?? {})) assert.ok(key in contactPage.form.errors, `${field.key}: ${key}`);
  });
});

describe("today's copy in the working shapes", () => {
  test("valid under the copy and field schemas, both languages; the consent wording starts empty", () => {
    for (const locale of LOCALES) {
      const copy = quoteCopySchema.safeParse(staticCopy(locale));
      assert.ok(copy.success, JSON.stringify(copy.error?.issues));
      assert.deepEqual(copy.data, staticCopy(locale), "the schema changes nothing of today's copy");
      assert.deepEqual(staticCopy(locale).consent, { label: "", error: "" });
      for (const field of QUOTE_FIELDS) {
        const texts = fieldTextsSchema.safeParse(staticFieldTexts(field, locale));
        assert.ok(texts.success, `${field.key} ${locale}: ${JSON.stringify(texts.error?.issues)}`);
      }
    }
  });

  test("laid back together, it is today's QuoteFormText exactly (the preview draws today's form word for word)", () => {
    for (const locale of LOCALES) {
      const base = quoteFormText(locale, contactPage, services);
      const fields = QUOTE_FIELDS.map((f) => ({ key: f.key, texts: staticFieldTexts(f, locale), options: f.options ? [...f.options] : null }));
      assert.deepEqual(workingQuoteFormText(base, staticCopy(locale), fields), base, locale);
    }
  });

  test("an edited copy changes only what it holds", () => {
    const base = quoteFormText("en", contactPage, services);
    const copy = { ...staticCopy("en"), submit: "Test prepare", serviceOther: "Test not sure" };
    const fields = QUOTE_FIELDS.map((f) => ({ key: f.key, texts: staticFieldTexts(f, "en"), options: f.options ? [...f.options] : null }));
    fields.find((f) => f.key === "email")!.texts = { ...fields.find((f) => f.key === "email")!.texts, label: "Test email", errorInvalid: "Test invalid" };
    fields.find((f) => f.key === "projectType")!.options = ["other", "new-project"];
    const text = workingQuoteFormText(base, copy, fields);
    assert.equal(text.submit, "Test prepare");
    assert.equal(text.fields.email.label, "Test email");
    assert.equal(text.errors.emailInvalid, "Test invalid");
    assert.equal(text.services.at(-1)!.label, "Test not sure");
    assert.deepEqual(text.services.slice(0, -1), base.services.slice(0, -1));
    assert.deepEqual(text.projectTypes.map((p) => p.value), ["other", "new-project"]);
    assert.deepEqual(text.files.accept, base.files.accept, "the handoff form's own file list is today's");
  });

  test("markup, a missing placeholder or a direction override is refused", () => {
    const bad = (change: (c: ReturnType<typeof staticCopy>) => void) => {
      const copy = structuredClone(staticCopy("en"));
      change(copy);
      return quoteCopySchema.safeParse(copy).success;
    };
    assert.equal(bad((c) => (c.submit = "<b>Send</b>")), false);
    assert.equal(bad((c) => (c.privacy.text = "No link")), false);
    assert.equal(bad((c) => (c.privacy.text = "{link} and {link}")), false);
    assert.equal(bad((c) => (c.errors.fileType = "Not supported")), false);
    assert.equal(bad((c) => (c.ready.title = "Test \u202e reversed")), false);
    assert.equal(bad((c) => (c.submit = "")), false);
  });
});

describe("the workflow, references and attachments", () => {
  test("the moves: forward, reopening, closing without an answer (with a reason); nothing else", () => {
    const moves = TRANSITIONS.map((t) => `${t.from}>${t.to}${t.noteRequired ? "!" : ""}`).sort();
    assert.deepEqual(moves, ["answered>closed", "answered>open", "closed>open", "new>closed!", "new>open", "open>answered", "open>closed!"]);
    for (const from of ENQUIRY_STATUSES) assert.equal(transitionOf(from, from), null, `${from} stays`);
    assert.equal(transitionOf("new", "answered"), null);
    assert.equal(transitionOf("closed", "answered"), null);
  });

  test("references: Q-YYYY-NNNNN, the year in Riyadh time", () => {
    assert.equal(formatReference(2026, 1), "Q-2026-00001");
    assert.equal(formatReference(2026, 123456), "Q-2026-123456");
    assert.match(formatReference(2026, 99999), REFERENCE_RE);
    assert.equal(referenceYear(new Date("2026-12-31T20:59:59Z")), 2026);
    assert.equal(referenceYear(new Date("2026-12-31T21:00:00Z")), 2027);
  });

  test("stored attachments: only types A4 checks by their bytes; never SVG, office or executable files", () => {
    for (const type of ATTACHMENT_TYPES) assert.ok(ACCEPTED_TYPES.some((a) => a.type === type.kind && a.extensions.includes(type.extension.slice(1)) && a.mime === type.mime), type.extension);
    for (const ext of [".svg", ".svgz", ".html", ".exe", ".docx", ".xlsx", ".dwg", ".zip"]) assert.ok(!ATTACHMENT_TYPES.some((t) => t.extension === ext), ext);
  });

  test("the seed migrations match the generator (0009 holds the quote form's root only)", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts/generate-access-seed.mjs"), "--check"], { encoding: "utf8" });
    assert.match(out, /Seed migrations match the registries/);
    const seed = readFileSync(join(ROOT, "drizzle/0009_seed_forms_enquiries.sql"), "utf8");
    assert.equal(seed.match(/INSERT INTO/g)?.length, 1);
    assert.match(seed, /'handoff'/);
    assert.doesNotMatch(seed, /form_fields|form_translations|enquiries/);
  });
});
