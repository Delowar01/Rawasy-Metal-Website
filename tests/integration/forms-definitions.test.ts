/**
 * Forms (A7.1) on a real MariaDB: the seed's root row (today's handoff delivery, no retention period), set-up copied
 * from today's form (never invented: the consent wording stays empty), saves decided on the version the page showed,
 * the Owner's data-collection decisions (delivery mode, stored attachments, consent mode: `forms.delivery_mode`; the
 * retention period: `enquiries.delete`), the registry's rules (locked "required", length bounds, error texts, choices,
 * file types, notification addresses, the consent wording), field order kept inside its group, the languages' statuses
 * and the audit trail (keys and states only). Synthetic data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { readForm, saveForm, setUpForm } from "../../src/server/forms/forms.ts";
import { staticCopy, staticFieldTexts } from "../../src/server/forms/copy.ts";
import { QUOTE_FIELDS } from "../../src/server/forms/registry.ts";
import { auditOf, query, team, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";
import { QUOTE, formInputOf, formsChange, quote } from "./forms-helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("forms_defs");
  t = await team(env);
});
after(async () => env?.close());

const issues = (result: { kind: string; issues?: { path: string }[] }) => (result.kind === "invalid" ? (result.issues ?? []).map((i) => i.path) : []);

describe("the seed and set-up", () => {
  test("the seed holds the quote form's root only: handoff, on, honeypot, 3 s, notice, no stored files, no retention period", async () => {
    const [row] = await query(env, "SELECT * FROM forms");
    assert.equal(row.id, QUOTE);
    assert.equal(row.key, "quote");
    assert.equal(row.delivery_mode, "handoff");
    assert.equal(Number(row.is_enabled), 1);
    assert.equal(row.retention_days, null);
    assert.equal(Number(row.honeypot_enabled), 1);
    assert.equal(Number(row.min_fill_seconds), 3);
    assert.equal(row.consent_mode, "notice");
    assert.equal(Number(row.accept_files), 0);
    assert.equal(row.accepted_extensions, ".pdf,.jpg,.jpeg,.png");
    assert.equal((await query(env, "SELECT * FROM form_fields")).length, 0);
    assert.equal((await query(env, "SELECT * FROM form_translations")).length, 0);
    assert.equal((await query(env, "SELECT * FROM enquiries")).length, 0);
    assert.equal((await quote(env)).setUp, false);
  });

  test("an Editor or a Reviewer can't set it up (refused, audited); an Admin copies today's form, once", async () => {
    for (const actor of [t.editor, t.reviewer]) assert.equal((await setUpForm(formsChange(env, actor), QUOTE)).kind, "denied");
    const done = await setUpForm(formsChange(env, t.admin), QUOTE);
    assert.equal(done.kind, "ok");
    const again = await setUpForm(formsChange(env, t.admin), QUOTE);
    assert.equal(again.kind, "ok");
    assert.match(again.kind === "ok" ? again.summary : "", /already set up/);
    const model = await quote(env);
    assert.equal(model.setUp, true);
    assert.deepEqual(model.status, { en: "complete", ar: "complete" });
    for (const locale of ["en", "ar"] as const) assert.deepEqual(model.copy[locale], staticCopy(locale));
    assert.deepEqual(model.fields.map((f) => f.key), QUOTE_FIELDS.map((f) => f.key));
    for (const field of model.fields) {
      const def = QUOTE_FIELDS.find((f) => f.key === field.key)!;
      assert.equal(field.isRequired, def.required, field.key);
      assert.equal(field.group, def.group);
      assert.equal(field.isSystem, true);
      assert.deepEqual([field.minLength, field.maxLength], def.length ? [def.length.min, def.length.max] : [null, null], field.key);
      for (const locale of ["en", "ar"] as const) assert.deepEqual(field.texts[locale], staticFieldTexts(def, locale), `${field.key} ${locale}`);
    }
    assert.equal(model.copy.en.consent.label, "", "no consent wording is invented");
    const audit = await auditOf(env, "form", QUOTE);
    assert.deepEqual(audit.filter((a) => a.outcome === "denied").length, 2);
    assert.ok(audit.some((a) => a.action === "form.setup" && a.outcome === "success"));
  });
});

describe("saving", () => {
  test("an Admin edits texts, lengths, the order inside a group and an optional field's 'required'; the other language needs review", async () => {
    const before = await quote(env);
    const input = formInputOf(before);
    input.copy.en.submit = "Test prepare";
    const company = input.fields.findIndex((f) => f.id === before.fields.find((x) => x.key === "company")!.id);
    input.fields[company].isRequired = true;
    input.fields[company].texts.en.errorRequired = "Test: enter your company.";
    input.fields[company].texts.ar.errorRequired = "تجربة: أدخل اسم الشركة.";
    const message = input.fields.findIndex((f) => f.id === before.fields.find((x) => x.key === "message")!.id);
    input.fields[message].minLength = 30;
    // Move "company" first (inside the details group) and try to move "message" (message group) to the top: groups win.
    const [moved] = input.fields.splice(company, 1);
    input.fields.unshift(moved);
    const [msg] = input.fields.splice(input.fields.findIndex((f) => f.id === before.fields.find((x) => x.key === "message")!.id), 1);
    input.fields.splice(1, 0, msg);
    const saved = await saveForm(formsChange(env, t.admin), QUOTE, input);
    assert.equal(saved.kind, "ok", JSON.stringify(saved));
    const after = await quote(env);
    assert.equal(after.lockVersion, before.lockVersion + 1);
    assert.equal(after.copy.en.submit, "Test prepare");
    assert.deepEqual(after.fields.map((f) => f.key), ["company", "fullName", "email", "phone", "service", "projectType", "requirement", "location", "message", "files"]);
    assert.equal(after.fields.find((f) => f.key === "company")!.isRequired, true);
    assert.equal(after.fields.find((f) => f.key === "message")!.minLength, 30);
    // Both languages changed and both were confirmed complete.
    assert.deepEqual(after.status, { en: "complete", ar: "complete" });
    // An English-only change: Arabic needs review (A3's plan), unless the editor says it does not affect Arabic.
    const english = formInputOf(after);
    english.copy.en.noscript = "Test noscript";
    assert.equal((await saveForm(formsChange(env, t.admin), QUOTE, english)).kind, "ok");
    assert.deepEqual((await quote(env)).status, { en: "complete", ar: "needs_review" });
    const unaffected = formInputOf(await quote(env));
    unaffected.copy.en.noscript = "Test noscript 2";
    unaffected.complete.ar = true;
    unaffected.otherUnaffected = true;
    assert.equal((await saveForm(formsChange(env, t.admin), QUOTE, unaffected)).kind, "ok");
    assert.deepEqual((await quote(env)).status, { en: "complete", ar: "complete" });
    const events = (await auditOf(env, "form", QUOTE)).filter((a) => a.action === "form.update");
    assert.ok(events.length >= 3);
    for (const event of events) assert.doesNotMatch(String(event.summary) + JSON.stringify(event.changes), /Test prepare|Test: enter|Test noscript/);
  });

  test("a save from an older page is refused (audited failed) and changes nothing", async () => {
    const model = await quote(env);
    const input = formInputOf(model);
    input.expectedVersion = model.lockVersion - 1;
    input.copy.en.submit = "Test stale";
    const result = await saveForm(formsChange(env, t.owner), QUOTE, input);
    assert.equal(result.kind, "stale");
    assert.equal((await quote(env)).copy.en.submit, model.copy.en.submit);
    assert.ok((await auditOf(env, "form", QUOTE)).some((a) => a.action === "form.update" && a.outcome === "failed" && /changed after it was opened/.test(String(a.summary))));
  });

  test("an Admin can't change the Owner's decisions (delivery, stored files, consent, retention); the Owner can", async () => {
    for (const change of [
      (i: ReturnType<typeof formInputOf>) => (i.settings.deliveryMode = "store"),
      (i: ReturnType<typeof formInputOf>) => (i.settings.acceptFiles = true),
      (i: ReturnType<typeof formInputOf>) => (i.settings.acceptedExtensions = [".pdf"]),
      (i: ReturnType<typeof formInputOf>) => (i.settings.retentionDays = 365),
    ]) {
      const input = formInputOf(await quote(env));
      change(input);
      const result = await saveForm(formsChange(env, t.admin), QUOTE, input);
      assert.equal(result.kind, "denied", JSON.stringify(input.settings));
      assert.match(result.kind === "denied" ? result.message : "", /Owner's decision/);
    }
    const input = formInputOf(await quote(env));
    input.settings.deliveryMode = "store";
    input.settings.retentionDays = 365;
    assert.equal((await saveForm(formsChange(env, t.owner), QUOTE, input)).kind, "ok");
    const model = await quote(env);
    assert.equal(model.settings.deliveryMode, "store");
    assert.equal(model.settings.retentionDays, 365);
    // The Admin may still save the rest of the form (the Owner's settings unchanged on the page).
    const other = formInputOf(model);
    other.settings.minFillSeconds = 5;
    assert.equal((await saveForm(formsChange(env, t.admin), QUOTE, other)).kind, "ok");
    // Back to handoff and no period for the other tests.
    const reset = formInputOf(await quote(env));
    reset.settings.deliveryMode = "handoff";
    reset.settings.retentionDays = null;
    assert.equal((await saveForm(formsChange(env, t.owner), QUOTE, reset)).kind, "ok");
  });

  test("Editors and Reviewers can't save (refused, audited)", async () => {
    for (const actor of [t.editor, t.reviewer]) {
      const result = await saveForm(formsChange(env, actor), QUOTE, formInputOf(await quote(env)));
      assert.equal(result.kind, "denied");
    }
  });

  test("the registry's rules: locked 'required', length bounds, error texts, choices, files, addresses, consent wording", async () => {
    const model = await quote(env);
    const at = (key: string) => model.fields.findIndex((f) => f.key === key);
    const cases: [string, (i: ReturnType<typeof formInputOf>) => void, string][] = [
      ["email can't become optional", (i) => (i.fields[at("email")].isRequired = false), `fields.${at("email")}.isRequired`],
      ["files can't be required", (i) => (i.fields[at("files")].isRequired = true), `fields.${at("files")}.isRequired`],
      ["a name shorter than 2 can't be allowed", (i) => (i.fields[at("fullName")].minLength = 1), `fields.${at("fullName")}.minLength`],
      ["a message longer than 4000 can't be allowed", (i) => (i.fields[at("message")].maxLength = 5000), `fields.${at("message")}.maxLength`],
      ["minimum above maximum", (i) => ((i.fields[at("requirement")].minLength = 50), (i.fields[at("requirement")].maxLength = 20)), `fields.${at("requirement")}.minLength`],
      ["a choice field has no length", (i) => (i.fields[at("service")].maxLength = 10), `fields.${at("service")}.maxLength`],
      ["a required field needs its message", (i) => (i.fields[at("phone")].texts.ar.errorRequired = ""), `fields.${at("phone")}.texts.ar.errorRequired`],
      ["every choice needs its label", (i) => delete i.fields[at("projectType")].texts.en.optionLabels.rental, `fields.${at("projectType")}.texts.en.optionLabels`],
      ["store_and_notify needs an address", (i) => ((i.settings.deliveryMode = "store_and_notify"), (i.settings.notificationEmails = [])), "settings.notificationEmails"],
      ["the consent box needs RAWASY's wording", (i) => (i.settings.consentMode = "checkbox"), "copy.en.consent.label"],
      ["stored files need a type", (i) => ((i.settings.acceptFiles = true), (i.settings.acceptedExtensions = [])), "settings.acceptedExtensions"],
    ];
    for (const [name, change, path] of cases) {
      const input = formInputOf(model);
      change(input);
      const result = await saveForm(formsChange(env, t.owner), QUOTE, input);
      assert.equal(result.kind, "invalid", name);
      assert.ok(issues(result).includes(path), `${name}: ${JSON.stringify(issues(result))}`);
    }
    // Zod: unknown types, markup in copy, a missing placeholder, a status from the browser.
    const bad = (change: (i: Record<string, unknown>) => void) => {
      const input = formInputOf(model) as unknown as Record<string, unknown>;
      change(input);
      return saveForm(formsChange(env, t.owner), QUOTE, input);
    };
    assert.equal((await bad((i) => ((i.settings as Record<string, unknown>).acceptedExtensions = [".svg"]))).kind, "invalid");
    assert.equal((await bad((i) => (((i.copy as Record<string, Record<string, unknown>>).en).submit = "<b>Send</b>"))).kind, "invalid");
    assert.equal((await bad((i) => ((((i.copy as Record<string, Record<string, Record<string, string>>>).en).privacy.text = "No link here")))).kind, "invalid");
    assert.equal((await bad((i) => (i.status = { en: "complete" }))).kind, "invalid");
    assert.equal((await quote(env)).lockVersion, model.lockVersion, "nothing was saved");
  });

  test("the consent box with RAWASY's wording in both languages is accepted; a field list from another page is refused", async () => {
    const model = await quote(env);
    const input = formInputOf(model);
    input.settings.consentMode = "checkbox";
    input.copy.en.consent = { label: "Test consent wording", error: "Test: tick the box." };
    input.copy.ar.consent = { label: "نص موافقة تجريبي", error: "تجربة: ضع علامة." };
    assert.equal((await saveForm(formsChange(env, t.owner), QUOTE, input)).kind, "ok");
    const next = formInputOf(await quote(env));
    next.settings.consentMode = "notice";
    next.fields.pop();
    assert.deepEqual(issues(await saveForm(formsChange(env, t.owner), QUOTE, next)), ["fields"]);
    next.fields = formInputOf(await quote(env)).fields;
    assert.equal((await saveForm(formsChange(env, t.owner), QUOTE, next)).kind, "ok");
  });

  test("the stored form reads back as saved (no other row changed)", async () => {
    const model = await readForm(env.deps.db, { key: "quote" });
    assert.ok(model);
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM form_fields"))[0].n, 10);
    assert.equal(Number((await query(env, "SELECT COUNT(*) AS n FROM form_field_translations"))[0].n), 20);
    assert.equal((await query(env, "SELECT * FROM enquiries")).length, 0, "saving a form stores no enquiry");
  });
});
