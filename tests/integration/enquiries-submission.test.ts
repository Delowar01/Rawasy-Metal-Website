/**
 * The prepared public submission (A7.5) on a real MariaDB, called directly (nothing on the website calls it): every
 * refusal before anything is stored — origin, size, a form that does not store (today's handoff), the per-address limit,
 * the honeypot, the timing token (missing, forged, another form's, too fast, too old, replayed), the fields against the
 * form's working definition with the form's own messages, the per-email limit; the stored enquiry (typed values, the
 * reference Q-YYYY-NNNNN gapless under concurrency, its first status, no personal data in the audit); attachments (only
 * when the form accepts them; the bytes decide; the private area, never `public/`; nothing left behind when refused);
 * notifications queued only for store_and_notify, carrying no personal data. Synthetic data only.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { issueToken } from "../../src/server/enquiries/token.ts";
import { submitEnquiry } from "../../src/server/enquiries/submission.ts";
import { REFERENCE_RE } from "../../src/server/forms/registry.ts";
import { dateOnly } from "../../src/server/cms/store.ts";
import { query, team, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";
import { enquiryRow, nextIp, received, storingForm, submissionEnv, submit, testPdf, testPng, TOKEN_KEY, validInput, type SubmissionEnv } from "./forms-helpers.ts";

let env: TestEnv;
let t: Team;
let sub: SubmissionEnv;
before(async () => {
  env = await setupTestEnv("enq_submit");
  t = await team(env);
  sub = await submissionEnv(env);
});
after(async () => {
  sub?.close();
  await env?.close();
});

const refusedFor = async (overrides: Parameters<typeof submit>[2]) => {
  const result = await submit(env, sub, overrides);
  return result.kind === "refused" ? result.reason : result.kind;
};
const count = async (table: string) => Number((await query<{ n: number }>(env, `SELECT COUNT(*) AS n FROM ${table}`))[0].n);

describe("while the form hands off (today's)", () => {
  test("nothing is stored: not set up, then set up but 'handoff', then switched off", async () => {
    assert.equal(await refusedFor({}), "closed");
    await storingForm(env, t.owner, "handoff");
    assert.equal(await refusedFor({}), "closed");
    await storingForm(env, t.owner, "store", (i) => (i.settings.isEnabled = false));
    assert.equal(await refusedFor({}), "closed");
    assert.equal(await count("enquiries"), 0);
  });
});

describe("refusals before anything is stored", () => {
  before(async () => {
    await storingForm(env, t.owner, "store", (i) => (i.settings.isEnabled = true));
  });

  test("another origin, no origin, a cross-site fetch", async () => {
    assert.equal(await refusedFor({ origin: "https://evil.example.test" }), "origin");
    assert.equal(await refusedFor({ origin: null }), "origin");
    assert.equal(await refusedFor({ origin: "https://rawasy.example.test.evil.test" }), "origin");
    assert.equal(await refusedFor({ secFetchSite: "cross-site" }), "origin");
  });

  test("a body or text past its limit", async () => {
    assert.equal(await refusedFor({ contentLength: 70 * 1024 }), "too_large");
    assert.equal(await refusedFor({ fields: { message: "x".repeat(40 * 1024) } }), "too_large");
  });

  test("the honeypot filled; the token missing, forged, for another form, too fast, too old", async () => {
    const now = env.deps.clock();
    assert.equal(await refusedFor({ fields: { website: "http://spam.example.test" } }), "honeypot");
    assert.equal(await refusedFor({ fields: { token: undefined } }), "token");
    const good = issueToken(TOKEN_KEY, "quote", new Date(now.getTime() - 60_000));
    assert.equal(await refusedFor({ fields: { token: `${good.slice(0, -2)}AA` } }), "token");
    assert.equal(await refusedFor({ fields: { token: issueToken(Buffer.alloc(32, 9), "quote", new Date(now.getTime() - 60_000)) } }), "token");
    assert.equal(await refusedFor({ fields: { token: issueToken(TOKEN_KEY, "other", new Date(now.getTime() - 60_000)) } }), "token");
    assert.equal(await refusedFor({ fields: { token: issueToken(TOKEN_KEY, "quote", new Date(now.getTime() - 1_000)) } }), "too_fast");
    assert.equal(await refusedFor({ fields: { token: issueToken(TOKEN_KEY, "quote", new Date(now.getTime() - 3 * 60 * 60 * 1000)) } }), "expired");
    assert.equal(await count("enquiries"), 0);
  });

  test("fields checked against the form: the form's own messages, in the submission's language; unknown names refused", async () => {
    const result = await submit(env, sub, { locale: "ar", fields: { fullName: "x", email: "name@", phone: "12", service: "not-a-service", projectType: "bogus", message: "short" } });
    assert.equal(result.kind, "invalid");
    if (result.kind !== "invalid") return;
    assert.deepEqual(Object.keys(result.errors).sort(), ["email", "fullName", "message", "phone", "projectType", "service"]);
    assert.equal(result.errors.email, "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@company.com.");
    assert.equal(result.errors.message, "أضف مزيدًا من التفاصيل، 20 حرفًا على الأقل.");
    const missing = await submit(env, sub, { fields: { fullName: "", email: "", phone: "", service: "", message: "" } });
    assert.equal(missing.kind, "invalid");
    if (missing.kind === "invalid") assert.equal(missing.errors.fullName, "Enter your full name.");
    const unknown = await submit(env, sub, { fields: { isAdmin: "1" } });
    assert.equal(unknown.kind, "invalid");
    if (unknown.kind === "invalid") assert.ok("isAdmin" in unknown.errors);
    // Hidden direction overrides and control characters are refused; Arabic-Indic digits in a phone are accepted.
    const bidi = await submit(env, sub, { fields: { fullName: "Test \u202eesreveR" } });
    assert.equal(bidi.kind, "invalid");
    assert.equal(await count("enquiries"), 0);
  });

  test("the per-address limit (5 in 10 minutes) and the per-email limit (5 an hour)", async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) await submit(env, sub, { ip, fields: { fullName: "" } });
    assert.equal(await refusedFor({ ip }), "rate_limited");
    const email = "test.repeat@example.test";
    for (let i = 0; i < 5; i++) assert.equal((await submit(env, sub, { fields: { email } })).kind, "received");
    assert.equal(await refusedFor({ fields: { email: "Test.Repeat@example.test" } }), "rate_limited");
    await query(env, "DELETE FROM enquiry_status_history");
    await query(env, "DELETE FROM enquiries");
    await query(env, "UPDATE enquiry_reference_counters SET last_number = 0");
  });
});

describe("a stored enquiry", () => {
  test("its values as typed (trimmed), its reference, its first status, its audit event (the reference only)", async () => {
    const input = validInput(env, { locale: "ar", fields: { fullName: "  اسم تجريبي  ", phone: "٠٥٠١٢٣٤٥٦٧", company: "", message: "طلب تجريبي لاختبارات التكامل فقط، لا أكثر." } });
    const result = await submitEnquiry(sub.deps, input);
    assert.equal(result.kind, "received", JSON.stringify(result));
    if (result.kind !== "received") return;
    assert.match(result.reference, REFERENCE_RE);
    assert.equal(result.reference, "Q-2026-00001");
    const row = await enquiryRow(env, result.enquiryId);
    assert.equal(row.status, "new");
    assert.equal(row.locale, "ar");
    assert.equal(row.full_name, "اسم تجريبي");
    assert.equal(row.company, null);
    assert.equal(row.phone, "٠٥٠١٢٣٤٥٦٧");
    assert.equal(row.service_key, "laser-cutting");
    assert.equal(row.service_label, "القص بالليزر");
    assert.equal(row.source_path, "/en/contact");
    assert.equal(row.notification_status, "not_required");
    assert.equal(row.retain_until, null, "no retention period is chosen");
    const history = await query(env, "SELECT * FROM enquiry_status_history WHERE enquiry_id = ?", [result.enquiryId]);
    assert.deepEqual(history.map((h) => [h.from_status, h.to_status, h.changed_by]), [[null, "new", null]]);
    const [audit] = await query<Record<string, unknown>>(env, "SELECT * FROM audit_events WHERE entity_type = 'enquiry' AND entity_id = ?", [result.enquiryId]);
    assert.equal(audit.action, "enquiry.received");
    assert.equal(audit.entity_label, result.reference);
    assert.equal(audit.actor_type, "system");
    assert.doesNotMatch(JSON.stringify(audit), /اسم تجريبي|٠٥٠|example\.test|طلب تجريبي/);
  });

  test("a token is used once: the same submission again is refused", async () => {
    const input = validInput(env);
    assert.equal((await submitEnquiry(sub.deps, input)).kind, "received");
    const again = await submitEnquiry(sub.deps, { ...input, ip: nextIp(), fields: { ...input.fields, email: "test.other@example.test" } });
    assert.deepEqual(again, { kind: "refused", reason: "replayed" });
  });

  test("references are gapless and unique under 20 concurrent submissions", async () => {
    const before = await count("enquiries");
    const results = await Promise.all(Array.from({ length: 20 }, () => submit(env, sub)));
    const refs = results.map((r) => (r.kind === "received" ? r.reference : `x:${JSON.stringify(r)}`)).sort();
    assert.ok(refs.every((r) => REFERENCE_RE.test(r)), refs.join(" "));
    assert.equal(new Set(refs).size, 20);
    const numbers = refs.map((r) => Number(r.slice(-5))).sort((a, b) => a - b);
    assert.deepEqual(numbers, Array.from({ length: 20 }, (_, i) => before + 1 + i));
    assert.equal(Number((await query(env, "SELECT last_number FROM enquiry_reference_counters WHERE year = 2026"))[0].last_number), before + 20);
  });

  test("the year is Riyadh's: 31 December 21:30 UTC is already the next year", async () => {
    const saved = env.clock.now;
    env.clock.now = new Date("2026-12-31T21:30:00.000Z");
    const result = await received(env, sub);
    assert.equal(result.reference, "Q-2027-00001");
    env.clock.now = saved;
  });
});

describe("attachments", () => {
  test("refused while the form does not accept them (today's decision)", async () => {
    const result = await submit(env, sub, { files: [{ name: "drawing.pdf", bytes: testPdf() }] });
    assert.equal(result.kind, "invalid");
    assert.equal(readdirSync(join(sub.dataDir, "enquiries")).length, 0);
  });

  test("once accepted: the bytes decide, the count and size hold, nothing is left behind when refused", async () => {
    await storingForm(env, t.owner, "store", (i) => {
      i.settings.acceptFiles = true;
      i.settings.acceptedExtensions = [".pdf", ".png"];
      i.settings.maxFiles = 2;
      i.settings.maxFileMb = 1;
    });
    const cases: [string, { name: string; bytes: Uint8Array }[]][] = [
      ["an SVG", [{ name: "x.svg", bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }]],
      ["HTML named .pdf", [{ name: "x.pdf", bytes: Buffer.from("<html><script>alert(1)</script></html>") }]],
      ["a PNG named .pdf", [{ name: "x.pdf", bytes: testPng() }]],
      ["a PDF without its end", [{ name: "x.pdf", bytes: Buffer.from("%PDF-1.4\nno end") }]],
      ["a JPEG (not on the form's list)", [{ name: "x.jpg", bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]) }]],
      ["an executable", [{ name: "x.exe", bytes: Buffer.from("MZ\x90\x00") }]],
      ["three files", [1, 2, 3].map((n) => ({ name: `d${n}.pdf`, bytes: testPdf() }))],
      ["a file over 1 MB", [{ name: "big.pdf", bytes: Buffer.concat([testPdf(), Buffer.alloc(1024 * 1024)]) }]],
      ["an empty file", [{ name: "empty.pdf", bytes: Buffer.alloc(0) }]],
    ];
    for (const [name, files] of cases) {
      const result = await submit(env, sub, { files });
      assert.equal(result.kind, "invalid", name);
      if (result.kind === "invalid") assert.ok(result.errors.files, name);
    }
    assert.deepEqual(readdirSync(join(sub.dataDir, "enquiries")), [], "nothing written for refused files");
    const ok = await received(env, sub, { files: [{ name: "../../etc/Drawing \u202e.pdf", bytes: testPdf() }, { name: "photo.PNG", bytes: testPng() }] });
    const files = await query<Record<string, unknown>>(env, "SELECT * FROM enquiry_files WHERE enquiry_id = ? ORDER BY original_filename", [ok.enquiryId]);
    assert.deepEqual(files.map((f) => [f.original_filename, f.extension, f.mime_type]), [["Drawing .pdf", "pdf", "application/pdf"], ["photo.PNG", "png", "image/png"]]);
    for (const f of files) {
      assert.match(String(f.storage_key), /^\d{4}\/\d{2}\/[0-9A-HJKMNP-TV-Z]{26}\.(pdf|png)$/);
      assert.ok(existsSync(join(sub.dataDir, "enquiries", String(f.storage_key))), "stored in the private area");
    }
    assert.equal(existsSync(join(process.cwd(), "public", "enquiries")), false, "never under public/");
  });

  test("a refused submission removes the files it wrote (a replayed token after the files were written)", async () => {
    const input = validInput(env, { files: [{ name: "a.pdf", bytes: testPdf("first") }] });
    assert.equal((await submitEnquiry(sub.deps, input)).kind, "received");
    const before = (await query(env, "SELECT storage_key FROM enquiry_files")).length;
    const listing = () => readdirSync(join(sub.dataDir, "enquiries"), { recursive: true }).filter((p) => String(p).endsWith(".pdf") || String(p).endsWith(".png")).length;
    const onDisk = listing();
    const replay = await submitEnquiry(sub.deps, { ...input, ip: nextIp(), fields: { ...input.fields, email: "test.replay@example.test" }, files: [{ name: "b.pdf", bytes: testPdf("second") }] });
    assert.deepEqual(replay, { kind: "refused", reason: "replayed" });
    assert.equal((await query(env, "SELECT storage_key FROM enquiry_files")).length, before);
    assert.equal(listing(), onDisk);
  });
});

describe("notifications", () => {
  test("queued only for store_and_notify, one per address, with the reference and an admin link — no personal data", async () => {
    const before = await count("email_outbox");
    await received(env, sub);
    assert.equal(await count("email_outbox"), before, "store: no notification");
    await storingForm(env, t.owner, "store_and_notify", (i) => {
      i.settings.notificationEmails = ["test.office@example.test", "test.sales@example.test"];
      i.settings.acceptFiles = false;
    });
    const result = await received(env, sub, { fields: { fullName: "Test Private Name", email: "test.private@example.test", message: "Test private message for the notification check." } });
    const rows = await query<Record<string, unknown>>(env, "SELECT * FROM email_outbox WHERE related_id = ? ORDER BY to_address", [result.enquiryId]);
    assert.deepEqual(rows.map((r) => [r.to_address, r.status, r.kind]), [["test.office@example.test", "pending", "enquiry_notification"], ["test.sales@example.test", "pending", "enquiry_notification"]]);
    for (const r of rows) {
      assert.match(String(r.subject), new RegExp(result.reference));
      assert.match(String(r.body_text), new RegExp(`/admin/enquiries/${result.enquiryId}`));
      assert.doesNotMatch(`${r.subject} ${r.body_text}`, /Test Private Name|test\.private|private message/);
    }
    assert.equal((await enquiryRow(env, result.enquiryId)).notification_status, "pending");
  });

  test("with a retention period chosen, the keep-until date is set at submission", async () => {
    await storingForm(env, t.owner, "store", (i) => (i.settings.retentionDays = 365));
    const result = await received(env, sub);
    assert.equal(dateOnly((await enquiryRow(env, result.enquiryId)).retain_until), "2027-10-09");
    await storingForm(env, t.owner, "store", (i) => (i.settings.retentionDays = null));
  });
});
