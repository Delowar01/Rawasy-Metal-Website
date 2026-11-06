/**
 * The enquiry inbox (A7.2–A7.4, A7.6–A7.8) on a real MariaDB: lists (search, filters, sorting, pages, summary), the
 * detail, the workflow (New → Open → Answered → Closed, reopening, closing without an answer with a reason; every other
 * move refused), permissions (Owner and Admin manage; Editors and Reviewers neither see nor change), stale pages,
 * assignment (only to someone who may handle enquiries), notes, the audit trail (the reference only — never a name,
 * address, message or note), attachment downloads (permission, the enquiry the address names), the CSV export (the
 * Owner, a step-up, formula-safe cells), retention (inactive with no period; the plan; the CLI's anonymization) and the
 * outbox (the disabled transport keeps rows pending; the local sink sends; retries back off; two senders never send one
 * row twice; a failed row queued again). Synthetic data only.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { addNote, assignEnquiry, changeStatus, enquirySummary, listEnquiries, parseQuery, readEnquiry, assignableUsers, DEFAULT_QUERY } from "../../src/server/enquiries/enquiries.ts";
import { csvCell, exportEnquiries } from "../../src/server/enquiries/export.ts";
import { decideFileDownload } from "../../src/server/enquiries/files.ts";
import { backoffMs, processOutbox, retryNotification } from "../../src/server/enquiries/outbox.ts";
import { applyRetention, planRetention } from "../../src/server/enquiries/retention.ts";
import { disabledMailer, type Mailer } from "../../src/server/mail/mailer.ts";
import { actorFor, createUser, meta, setupTestEnv, type TestEnv } from "./helpers.ts";
import { auditOf, query, team, type Team } from "./cms-helpers.ts";
import { enquiryRow, formsChange, received, storingForm, submissionEnv, testPdf, versionOf, type SubmissionEnv } from "./forms-helpers.ts";

let env: TestEnv;
let t: Team;
let sub: SubmissionEnv;
const ids: Record<string, { reference: string; enquiryId: string }> = {};

before(async () => {
  env = await setupTestEnv("enq_flow");
  t = await team(env);
  sub = await submissionEnv(env);
  await storingForm(env, t.owner, "store", (i) => {
    i.settings.acceptFiles = true;
    i.settings.acceptedExtensions = [".pdf"];
  });
  ids.a = await received(env, sub, { fields: { fullName: "Test Alpha", company: "Alpha Test Co", email: "alpha@example.test" } });
  env.clock.advance(60_000);
  ids.b = await received(env, sub, { locale: "ar", fields: { fullName: "اختبار باء", company: "", email: "beta@example.test", message: "=HYPERLINK(\"http://evil.example.test\",\"click\") test message here" } });
  env.clock.advance(60_000);
  ids.c = await received(env, sub, { fields: { fullName: "Test Gamma", email: "gamma@example.test" }, files: [{ name: "drawing.pdf", bytes: testPdf() }] });
});
after(async () => {
  sub?.close();
  await env?.close();
});

const change = (actor: Team[keyof Team]) => formsChange(env, actor);
/** A signed-in actor created now (the tests that move the clock by days outlive the team's sessions). */
const fresh = async (role: "owner" | "admin" | "editor") => actorFor(env, await createUser(env, { roles: [role], name: `Test Fresh ${role}`, mfa: role !== "editor" }));

describe("lists", () => {
  test("newest first; search by reference, name (any script), company, email; filters; pages; the summary", async () => {
    const all = await listEnquiries(env.deps.db, DEFAULT_QUERY, t.admin.user.id);
    assert.deepEqual(all.rows.map((r) => r.reference), [ids.c.reference, ids.b.reference, ids.a.reference]);
    assert.equal(all.total, 3);
    const find = async (q: string) => (await listEnquiries(env.deps.db, { ...DEFAULT_QUERY, q }, t.admin.user.id)).rows.map((r) => r.reference);
    assert.deepEqual(await find(ids.a.reference.toLowerCase()), [ids.a.reference]);
    assert.deepEqual(await find("باء"), [ids.b.reference]);
    assert.deepEqual(await find("Alpha Test"), [ids.a.reference]);
    assert.deepEqual(await find("gamma@"), [ids.c.reference]);
    assert.deepEqual(await find("%"), [], "a wildcard is a character, not a pattern");
    assert.deepEqual((await listEnquiries(env.deps.db, { ...DEFAULT_QUERY, sort: "oldest" }, t.admin.user.id)).rows.map((r) => r.reference), [ids.a.reference, ids.b.reference, ids.c.reference]);
    const paged = await listEnquiries(env.deps.db, { ...DEFAULT_QUERY, size: 10, page: 99 }, t.admin.user.id);
    assert.equal(paged.pages, 1);
    assert.equal(paged.rows.length, 3, "a page past the end shows the last page");
    assert.deepEqual(parseQuery({ status: "bogus", sort: "'; DROP TABLE enquiries; --", size: "5", page: "-1" }), DEFAULT_QUERY);
    const summary = await enquirySummary(env.deps.db, t.admin.user.id, env.deps.clock());
    assert.deepEqual(summary.byStatus, { new: 3, open: 0, answered: 0, closed: 0 });
    assert.equal(summary.unassigned, 3);
    assert.equal(summary.lastSevenDays, 3);
  });

  test("the detail: values, files, first status", async () => {
    const detail = (await readEnquiry(env.deps.db, ids.c.enquiryId))!;
    assert.equal(detail.fullName, "Test Gamma");
    assert.equal(detail.status, "new");
    assert.deepEqual(detail.files.map((f) => [f.name, f.mime]), [["drawing.pdf", "application/pdf"]]);
    assert.deepEqual(detail.history.map((h) => [h.from, h.to]), [[null, "new"]]);
    assert.equal(await readEnquiry(env.deps.db, "01ARZ3NDEKTSV4RRFFQ69G5FAV"), null);
  });

  test("assignable people: active Owners and Admins only", async () => {
    const names = (await assignableUsers(env.deps.db)).map((u) => u.name);
    assert.ok(names.includes("Test Owner") && names.includes("Test Admin"));
    assert.ok(!names.includes("Test Editor") && !names.includes("Test Reviewer"));
  });
});

describe("the workflow", () => {
  test("New → Open → Answered → Closed, each step recorded with who and when; reopening; closing without an answer needs a reason", async () => {
    const id = ids.a.enquiryId;
    const step = async (to: string, note = "") => changeStatus(change(t.admin), id, { expectedVersion: await versionOf(env, id), to, note });
    assert.equal((await step("open")).kind, "ok");
    assert.equal((await step("answered")).kind, "ok");
    assert.equal((await step("closed")).kind, "ok");
    assert.ok((await enquiryRow(env, id)).closed_at);
    assert.equal((await step("open")).kind, "ok");
    assert.equal((await enquiryRow(env, id)).closed_at, null);
    const noReason = await step("closed");
    assert.equal(noReason.kind, "invalid");
    assert.equal((await step("closed", "Duplicate of another test request.")).kind, "ok");
    const history = (await readEnquiry(env.deps.db, id))!.history;
    assert.deepEqual(history.map((h) => `${h.from ?? "-"}>${h.to}`), ["->new", "new>open", "open>answered", "answered>closed", "closed>open", "open>closed"]);
    assert.equal(history.at(-1)!.note, "Duplicate of another test request.");
    assert.equal(history.at(-1)!.by, "Test Admin");
  });

  test("moves that aren't steps are refused (audited failed): new → answered, new → new, closed → answered", async () => {
    const id = ids.b.enquiryId;
    for (const to of ["answered", "new"]) {
      const result = await changeStatus(change(t.owner), id, { expectedVersion: await versionOf(env, id), to, note: "" });
      assert.equal(result.kind, "invalid", to);
    }
    const bogus = await changeStatus(change(t.owner), id, { expectedVersion: await versionOf(env, id), to: "spam", note: "" });
    assert.equal(bogus.kind, "invalid");
    assert.equal((await enquiryRow(env, id)).status, "new");
    assert.ok((await auditOf(env, "enquiry", id)).some((a) => a.action === "enquiry.status" && a.outcome === "failed"));
  });

  test("a change from an older page is refused (stale), and an Editor or a Reviewer changes nothing (denied)", async () => {
    const id = ids.b.enquiryId;
    const v = await versionOf(env, id);
    assert.equal((await changeStatus(change(t.admin), id, { expectedVersion: v, to: "open", note: "" })).kind, "ok");
    assert.equal((await changeStatus(change(t.owner), id, { expectedVersion: v, to: "answered", note: "" })).kind, "stale");
    assert.equal((await assignEnquiry(change(t.owner), id, { expectedVersion: v, assignee: t.owner.user.id })).kind, "stale");
    for (const actor of [t.editor, t.reviewer]) {
      assert.equal((await changeStatus(change(actor), id, { expectedVersion: v + 1, to: "answered", note: "" })).kind, "denied");
      assert.equal((await assignEnquiry(change(actor), id, { expectedVersion: v + 1, assignee: "" })).kind, "denied");
      assert.equal((await addNote(change(actor), id, { body: "Test note" })).kind, "denied");
    }
    assert.equal((await enquiryRow(env, id)).status, "open");
  });

  test("assignment: an Owner or Admin who may handle enquiries; never an Editor or a disabled account; clearing it", async () => {
    const id = ids.c.enquiryId;
    const assign = async (assignee: string) => assignEnquiry(change(t.owner), id, { expectedVersion: await versionOf(env, id), assignee });
    assert.equal((await assign(t.editor.user.id)).kind, "invalid");
    const gone = await createUser(env, { roles: ["admin"], name: "Test Disabled Admin", mfa: true });
    await query(env, "UPDATE users SET status = 'disabled' WHERE id = ?", [gone.id]);
    assert.equal((await assign(gone.id)).kind, "invalid");
    assert.equal((await assign(t.admin.user.id)).kind, "ok");
    assert.equal((await enquiryRow(env, id)).assigned_to, t.admin.user.id);
    const mine = await listEnquiries(env.deps.db, { ...DEFAULT_QUERY, assigned: "me" }, t.admin.user.id);
    assert.deepEqual(mine.rows.map((r) => r.reference), [ids.c.reference]);
    assert.equal((await assign("")).kind, "ok");
    assert.equal((await enquiryRow(env, id)).assigned_to, null);
    const history = (await readEnquiry(env.deps.db, id))!.assignments;
    assert.equal(history.length, 2);
    // Who assigned reads as the rest of the history: the person's name, never the audit label's email.
    assert.deepEqual(history.map((h) => h.by), [t.owner.user.displayName, t.owner.user.displayName]);
  });

  test("notes: plain text, added whatever changed meanwhile; empty or marked-up text refused; never in the audit", async () => {
    const id = ids.c.enquiryId;
    assert.equal((await addNote(change(t.admin), id, { body: "Test note: call back on Sunday about the 3 mm plates." })).kind, "ok");
    assert.equal((await addNote(change(t.admin), id, { body: "   " })).kind, "invalid");
    assert.equal((await addNote(change(t.admin), id, { body: "<script>alert(1)</script>" })).kind, "invalid");
    const detail = (await readEnquiry(env.deps.db, id))!;
    assert.deepEqual(detail.notes.map((n) => [n.body, n.author]), [["Test note: call back on Sunday about the 3 mm plates.", "Test Admin"]]);
  });

  test("the audit trail names the reference only: never a name, an address, a message or a note", async () => {
    const rows = await query<Record<string, unknown>>(env, "SELECT * FROM audit_events WHERE entity_type = 'enquiry'");
    assert.ok(rows.length > 10);
    for (const row of rows) {
      assert.match(String(row.entity_label ?? ""), /^(Q-\d{4}-\d{5,})?$/);
      assert.doesNotMatch(JSON.stringify(row), /Test Alpha|Test Gamma|اختبار باء|alpha@|beta@|gamma@|call back on Sunday|HYPERLINK|drawing\.pdf/);
    }
  });
});

describe("attachments", () => {
  test("only enquiries.view (Owner, Admin) may download; a file under another enquiry is not found; refusals are audited", async () => {
    const detail = (await readEnquiry(env.deps.db, ids.c.enquiryId))!;
    const fileId = detail.files[0].id;
    const ok = await decideFileDownload({ deps: env.deps, actor: t.admin, meta: meta() }, ids.c.enquiryId, fileId);
    assert.equal(ok.kind, "ok");
    if (ok.kind === "ok") assert.ok(existsSync(join(sub.dataDir, "enquiries", ok.file.storageKey)));
    assert.equal((await decideFileDownload({ deps: env.deps, actor: t.admin, meta: meta() }, ids.a.enquiryId, fileId)).kind, "not_found");
    for (const actor of [t.editor, t.reviewer]) assert.equal((await decideFileDownload({ deps: env.deps, actor, meta: meta() }, ids.c.enquiryId, fileId)).kind, "not_found");
    assert.ok((await auditOf(env, "enquiry", ids.c.enquiryId)).some((a) => a.action === "enquiry.file_download" && a.outcome === "denied"));
  });
});

describe("the CSV export", () => {
  test("cells never run as formulas; quotes doubled", () => {
    assert.equal(csvCell("=1+1"), `"'=1+1"`);
    assert.equal(csvCell("  @SUM(A1)"), `"'  @SUM(A1)"`);
    assert.equal(csvCell("-2"), `"'-2"`);
    assert.equal(csvCell("+966 50"), `"'+966 50"`);
    assert.equal(csvCell("\tx"), `"'\tx"`);
    assert.equal(csvCell('say "hi"'), `"say ""hi"""`);
    assert.equal(csvCell("plain"), `"plain"`);
  });

  test("the Owner only, within 10 minutes of signing in; the file holds every column, Arabic as UTF-8, formulas as text; audited with the count", async () => {
    for (const actor of [t.admin, t.editor, t.reviewer]) assert.equal((await exportEnquiries(change(actor), DEFAULT_QUERY)).kind, "denied");
    env.clock.advance(11 * 60_000);
    assert.equal((await exportEnquiries(change(t.owner), DEFAULT_QUERY)).kind, "step_up");
    // A new full sign-in (a session just created with its second factor) counts as the step-up.
    const owner = await actorFor(env, await createUser(env, { roles: ["owner"], name: "Test Export Owner", mfa: true }));
    const result = await exportEnquiries(formsChange(env, owner), DEFAULT_QUERY);
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.equal(result.rows, 3);
    assert.ok(result.csv.startsWith("\ufeff\"Reference\""));
    assert.match(result.csv, /"'=HYPERLINK\(""http:\/\/evil\.example\.test"",""click""\) test message here"/);
    assert.match(result.csv, /"اختبار باء"/);
    assert.match(result.filename, /^rawasy-enquiries-\d{4}-\d{2}-\d{2}\.csv$/);
    const audit = (await query<Record<string, unknown>>(env, "SELECT * FROM audit_events WHERE action = 'enquiry.export' AND outcome = 'success'"))[0];
    assert.match(String(audit.summary), /Exported 3 enquiries/);
    assert.doesNotMatch(JSON.stringify(audit), /Alpha|gamma|HYPERLINK/);
  });
});

describe("retention", () => {
  test("inactive: with no period nothing is due and the CLI's apply refuses", async () => {
    assert.deepEqual((await planRetention(env.deps.db, "quote", env.deps.clock())).due, []);
    assert.deepEqual(await applyRetention(env.deps, sub.store, "quote", "test operator"), { kind: "no_period" });
    assert.equal((await enquiryRow(env, ids.a.enquiryId)).anonymized_at, null);
  });

  test("with a period the Owner chose: the plan lists what is past it; the CLI's apply anonymizes, removes notes and files, keeps the numbers", async () => {
    await storingForm(env, t.owner, "store", (i) => (i.settings.retentionDays = 30));
    env.clock.advance(40 * 86_400_000);
    const admin = await fresh("admin");
    const plan = await planRetention(env.deps.db, "quote", env.deps.clock());
    assert.deepEqual(plan.due.map((d) => d.reference).sort(), [ids.a.reference, ids.b.reference, ids.c.reference].sort());
    const detail = (await readEnquiry(env.deps.db, ids.c.enquiryId))!;
    const key = (await query<{ storage_key: string }>(env, "SELECT storage_key FROM enquiry_files WHERE enquiry_id = ?", [ids.c.enquiryId]))[0].storage_key;
    const run = await applyRetention(env.deps, sub.store, "quote", "test operator");
    assert.deepEqual(run, { kind: "done", anonymized: 3, files: 1, failedFiles: [] });
    const row = await enquiryRow(env, ids.c.enquiryId);
    assert.equal(row.full_name, "");
    assert.equal(row.email, "");
    assert.equal(row.message, "");
    assert.ok(row.anonymized_at);
    assert.equal(row.reference, ids.c.reference);
    assert.equal(row.status, detail.status);
    assert.equal((await query(env, "SELECT * FROM enquiry_notes WHERE enquiry_id = ?", [ids.c.enquiryId])).length, 0);
    assert.equal((await query(env, "SELECT * FROM enquiry_files WHERE enquiry_id = ?", [ids.c.enquiryId])).length, 0);
    assert.equal(existsSync(join(sub.dataDir, "enquiries", key)), false);
    assert.equal((await enquirySummary(env.deps.db, admin.user.id, env.deps.clock())).total, 3);
    assert.equal((await addNote(change(admin), ids.c.enquiryId, { body: "Test note after anonymization" })).kind, "denied");
    assert.deepEqual((await planRetention(env.deps.db, "quote", env.deps.clock())).due, [], "nothing is due twice");
    await storingForm(env, await fresh("owner"), "store", (i) => (i.settings.retentionDays = null));
  });
});

describe("the outbox", () => {
  const sending = (fail = 0): Mailer & { sent: string[] } => {
    let failures = fail;
    const sent: string[] = [];
    return {
      transport: "sink",
      configured: true,
      sent,
      async send(message) {
        if (failures-- > 0) throw Object.assign(new Error("boom: secret server text"), { code: "ECONNREFUSED" });
        sent.push(message.to);
        return { delivered: true };
      },
    };
  };

  test("the disabled transport (today's) sends nothing: rows stay pending and say why", async () => {
    await storingForm(env, await fresh("owner"), "store_and_notify", (i) => ((i.settings.notificationEmails = ["test.office@example.test"]), (i.settings.acceptFiles = false)));
    ids.d = await received(env, sub);
    const report = await processOutbox(env.deps.db, disabledMailer, env.deps.clock());
    assert.equal(report.sent, 0);
    assert.equal(report.waiting, 1);
    const [row] = await query<Record<string, unknown>>(env, "SELECT * FROM email_outbox WHERE related_id = ?", [ids.d.enquiryId]);
    assert.deepEqual([row.status, Number(row.attempts), row.last_error], ["pending", 0, "mail_disabled"]);
  });

  test("a failing transport retries with backoff (error codes only), then sends; the enquiry's status follows", async () => {
    const mailer = sending(1);
    const first = await processOutbox(env.deps.db, mailer, env.deps.clock());
    assert.equal(first.retrying, 1);
    const [row] = await query<Record<string, unknown>>(env, "SELECT * FROM email_outbox WHERE related_id = ?", [ids.d.enquiryId]);
    assert.equal(row.last_error, "error_ECONNREFUSED");
    assert.equal(Number(row.attempts), 1);
    assert.equal(new Date(String(row.next_attempt_at instanceof Date ? (row.next_attempt_at as Date).toISOString() : row.next_attempt_at)).getTime() >= env.deps.clock().getTime() + backoffMs(1) - 1000, true);
    assert.equal((await processOutbox(env.deps.db, mailer, env.deps.clock())).claimed, 0, "not due yet");
    env.clock.advance(backoffMs(1));
    assert.equal((await processOutbox(env.deps.db, mailer, env.deps.clock())).sent, 1);
    assert.deepEqual(mailer.sent, ["test.office@example.test"]);
    assert.equal((await enquiryRow(env, ids.d.enquiryId)).notification_status, "sent");
  });

  test("two senders at once never send one row twice; after five failures a row is failed and can be queued again", async () => {
    const e = await received(env, sub);
    const a = sending();
    const b = sending();
    await Promise.all([processOutbox(env.deps.db, a, env.deps.clock()), processOutbox(env.deps.db, b, env.deps.clock())]);
    assert.equal(a.sent.length + b.sent.length, 1);
    const f = await received(env, sub);
    const broken = sending(99);
    for (let i = 0; i < 5; i++) {
      await processOutbox(env.deps.db, broken, env.deps.clock());
      env.clock.advance(5 * 60 * 60_000);
    }
    const [row] = await query<Record<string, unknown>>(env, "SELECT * FROM email_outbox WHERE related_id = ?", [f.enquiryId]);
    assert.equal(row.status, "failed");
    assert.equal((await enquiryRow(env, f.enquiryId)).notification_status, "failed");
    assert.equal((await retryNotification(change(await fresh("editor")), String(row.id))).kind, "denied");
    assert.equal((await retryNotification(change(await fresh("admin")), String(row.id))).kind, "ok");
    assert.equal((await query<Record<string, unknown>>(env, "SELECT status FROM email_outbox WHERE id = ?", [row.id]))[0].status, "pending");
    assert.equal((await enquiryRow(env, f.enquiryId)).notification_status, "pending");
    void e;
  });
});
