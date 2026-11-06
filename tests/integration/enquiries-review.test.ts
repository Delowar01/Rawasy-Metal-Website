/**
 * The A7 security review's findings on a real MariaDB (each test fails on the code before its correction): an
 * attachment's download name keeps its stored extension (L1); a visitor's email can't carry mailto parameters in its
 * domain (L2); the visitor's address is not copied into the audit trail and close-without-answer reasons go with
 * anonymization (L4); retention counts only the files it removed and names the others, and the maintenance report
 * lists stray files in the enquiries area (L5); the honeypot trips on any value but an empty string (L6); the per-email
 * limit reads A2's normalized address and the per-address limit an IPv6 /64 (I7); a form changed while a submission is
 * on its way refuses it (I8); a sender's late answer never overwrites another claim, and an anonymized enquiry's
 * notifications are cancelled, never sent empty or queued again (I10); a storage failure never carries the visitor's
 * values in its message (I11). Synthetic data only.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { changeStatus, readEnquiry } from "../../src/server/enquiries/enquiries.ts";
import { decideFileDownload } from "../../src/server/enquiries/files.ts";
import { processOutbox, retryNotification } from "../../src/server/enquiries/outbox.ts";
import { applyRetention } from "../../src/server/enquiries/retention.ts";
import { submitEnquiry } from "../../src/server/enquiries/submission.ts";
import { contentDisposition } from "../../src/server/media/headers.ts";
import { scanMedia } from "../../src/server/media/maintenance.ts";
import { enquiryFileKey, type MediaStore } from "../../src/server/media/storage.ts";
import { ulid } from "../../src/server/security/ids.ts";
import type { Mailer } from "../../src/server/mail/mailer.ts";
import { query, team, type Team } from "./cms-helpers.ts";
import { actorFor, createUser, setupTestEnv, type TestEnv } from "./helpers.ts";
import { enquiryRow, formsChange, received, storingForm, submissionEnv, submit, testPdf, validInput, versionOf, type SubmissionEnv } from "./forms-helpers.ts";

let env: TestEnv;
let t: Team;
let sub: SubmissionEnv;
before(async () => {
  env = await setupTestEnv("enq_review");
  t = await team(env);
  sub = await submissionEnv(env);
  await storingForm(env, t.owner, "store", (i) => {
    i.settings.acceptFiles = true;
    i.settings.acceptedExtensions = [".pdf"];
  });
});
after(async () => {
  sub?.close();
  await env?.close();
});

/** A signed-in actor created now (tests that move the clock by days outlive the team's sessions). */
const fresh = async (role: "owner" | "admin" | "editor") => actorFor(env, await createUser(env, { roles: [role], name: `Test Review ${role}`, mfa: role !== "editor" }));
const reason = async (overrides: Parameters<typeof submit>[2]) => {
  const result = await submit(env, sub, overrides);
  return result.kind === "refused" ? result.reason : result.kind;
};

/** The store with one method replaced (`Reflect.get` with the real object as receiver; the rest bound to it). */
function hooked(store: MediaStore, name: "writeNew" | "remove", replacement: (original: (...args: unknown[]) => Promise<unknown>, ...args: unknown[]) => Promise<unknown>): MediaStore {
  return new Proxy(store, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop === name) return (...args: unknown[]) => replacement((value as (...a: unknown[]) => Promise<unknown>).bind(target), ...args);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("L1: an attachment's download name", () => {
  test("a long name cut for the header keeps the stored extension (never '….bat')", async () => {
    const name = `Drawing-${"x".repeat(188)}.bat.pdf`;
    const { enquiryId } = await received(env, sub, { files: [{ name, bytes: testPdf() }] });
    const [file] = await query<{ id: string; original_filename: string }>(env, "SELECT id, original_filename FROM enquiry_files WHERE enquiry_id = ?", [enquiryId]);
    assert.match(file.original_filename, /\.pdf$/);
    const decision = await decideFileDownload(formsChange(env, t.admin), enquiryId, file.id);
    assert.equal(decision.kind, "ok");
    const header = contentDisposition("attachment", decision.kind === "ok" ? decision.file.filename : "");
    const [, ascii, encoded] = /filename="([^"]*)"; filename\*=UTF-8''(.*)$/.exec(header) ?? [];
    assert.match(ascii, /\.pdf$/, header);
    assert.match(decodeURIComponent(encoded), /\.pdf$/, header);
    assert.ok(!/\.bat$/.test(ascii));
  });
});

describe("L2: the visitor's email address", () => {
  test("a domain carrying mailto parameters is refused at the field", async () => {
    const result = await submit(env, sub, { fields: { email: "buyer@example.test?bcc=attacker%40evil.example.test&body=Pay" } });
    assert.equal(result.kind, "invalid");
    assert.ok(result.kind === "invalid" && result.errors.email);
    for (const email of ["buyer@exa#mple.test", "buyer@example.test&x=1", "buyer@example%2Etest"]) {
      const r = await submit(env, sub, { fields: { email } });
      assert.equal(r.kind, "invalid", email);
    }
    assert.equal((await submit(env, sub, { fields: { email: "first.last+quote@example.test" } })).kind, "received", "an ordinary address with a plus still passes");
  });
});

describe("L4: personal data after anonymization", () => {
  test("the received event holds no address; a close-without-answer reason goes with the retention run", async () => {
    const owner = await fresh("owner");
    await storingForm(env, owner, "store", (i) => (i.settings.retentionDays = null));
    const { enquiryId } = await received(env, sub, { ip: "198.51.100.77" });
    const [event] = await query<{ ip: string | null }>(env, "SELECT ip FROM audit_events WHERE action = 'enquiry.received' AND entity_id = ?", [enquiryId]);
    assert.equal(event.ip, null);
    const admin = await fresh("admin");
    const closed = await changeStatus(formsChange(env, admin), enquiryId, { expectedVersion: await versionOf(env, enquiryId), to: "closed", note: "Test reason naming the visitor Test Person" });
    assert.equal(closed.kind, "ok");
    await storingForm(env, owner, "store", (i) => (i.settings.retentionDays = 30));
    env.clock.advance(40 * 86_400_000);
    const run = await applyRetention(env.deps, sub.store, "quote", "test operator");
    assert.equal(run.kind, "done");
    const notes = await query<{ note: string | null }>(env, "SELECT note FROM enquiry_status_history WHERE enquiry_id = ?", [enquiryId]);
    assert.deepEqual(notes.map((n) => n.note), [null, null]);
    const detail = (await readEnquiry(env.deps.db, enquiryId))!;
    assert.ok(detail.history.every((h) => h.note === null));
    await storingForm(env, await fresh("owner"), "store", (i) => (i.settings.retentionDays = null));
  });
});

describe("L5: attachments left on disk", () => {
  test("retention counts only the files it removed and names the others; the maintenance report lists strays", async () => {
    const owner = await fresh("owner");
    // Whatever earlier tests left due goes first, so the run below has exactly one enquiry.
    await storingForm(env, owner, "store", (i) => (i.settings.retentionDays = 30));
    env.clock.advance(40 * 86_400_000);
    assert.equal((await applyRetention(env.deps, sub.store, "quote", "test operator")).kind, "done");
    const { enquiryId } = await received(env, sub, { files: [{ name: "drawing.pdf", bytes: testPdf() }] });
    const [{ storage_key: key }] = await query<{ storage_key: string }>(env, "SELECT storage_key FROM enquiry_files WHERE enquiry_id = ?", [enquiryId]);
    env.clock.advance(40 * 86_400_000);
    const failing = hooked(sub.store, "remove", async (original, area, k) => {
      if (k === key) throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      return original(area, k);
    });
    const run = await applyRetention(env.deps, failing, "quote", "test operator");
    assert.equal(run.kind, "done");
    assert.equal(run.kind === "done" ? run.files : -1, 0, "a file still on disk is not counted as removed");
    assert.deepEqual(run.kind === "done" ? (run as { failedFiles?: string[] }).failedFiles : null, [key]);
    assert.ok(existsSync(join(sub.dataDir, "enquiries", key)));
    const stray = enquiryFileKey(ulid(env.deps.clock().getTime()), "pdf", env.deps.clock());
    await sub.store.writeNew("enquiries", stray, testPdf("stray"));
    const report = await scanMedia({ pool: env.pool, db: env.deps.db, store: sub.store, releaseDir: resolve("public"), now: env.deps.clock(), actor: { type: "cli", label: "Test operator" } });
    const orphans = report.orphans.filter((o) => o.area === "enquiries").map((o) => o.key).sort();
    assert.deepEqual(orphans, [key, stray].sort());
    await storingForm(env, await fresh("owner"), "store", (i) => (i.settings.retentionDays = null));
  });
});

describe("L6: the honeypot", () => {
  test("any value but an empty string trips it: a list, an object, a number", async () => {
    for (const website of [["x"], { a: 1 }, 7]) assert.equal(await reason({ fields: { website } }), "honeypot", JSON.stringify(website));
    assert.equal(await reason({ fields: { website: "" } }), "received");
  });
});

describe("I7: the rate-limit keys", () => {
  test("the per-email limit reads the normalized address (compatibility forms are one address)", async () => {
    for (let i = 0; i < 5; i++) assert.equal(await reason({ fields: { email: "test.same@example.test" } }), "received");
    assert.equal(await reason({ fields: { email: "ｔｅｓｔ.same@example.test" } }), "rate_limited");
  });

  test("the per-address limit counts an IPv6 /64 as one address", async () => {
    for (let i = 1; i <= 5; i++) assert.equal(await reason({ ip: `2001:db8:1:2::${i}` }), "received");
    assert.equal(await reason({ ip: "2001:db8:1:2:aaaa:bbbb:cccc:dddd" }), "rate_limited");
    assert.equal(await reason({ ip: "2001:db8:1:3::1" }), "received", "another /64 is another address");
  });
});

describe("I8: the form changed while a submission was on its way", () => {
  test("files accepted when it was read, then turned off before the transaction: refused, nothing stored, the file removed", async () => {
    const before = Number((await query<{ n: number }>(env, "SELECT COUNT(*) AS n FROM enquiries"))[0].n);
    let written = "";
    const store = hooked(sub.store, "writeNew", async (original, area, key, bytes) => {
      written = String(key);
      await query(env, "UPDATE forms SET accept_files = 0, lock_version = lock_version + 1");
      return original(area, key, bytes);
    });
    const result = await submitEnquiry({ ...sub.deps, store: async () => store }, validInput(env, { files: [{ name: "drawing.pdf", bytes: testPdf() }] }));
    assert.equal(result.kind, "refused");
    assert.equal(result.kind === "refused" ? result.reason : "", "changed");
    assert.equal(Number((await query<{ n: number }>(env, "SELECT COUNT(*) AS n FROM enquiries"))[0].n), before);
    assert.ok(written && !existsSync(join(sub.dataDir, "enquiries", written)));
    await query(env, "UPDATE forms SET accept_files = 1, lock_version = lock_version + 1");
  });
});

describe("I10: the outbox", () => {
  const mailer = (onSend: (to: string) => Promise<void> = async () => {}): Mailer & { sent: string[] } => {
    const sent: string[] = [];
    return {
      transport: "sink",
      configured: true,
      sent,
      async send(message) {
        await onSend(message.to);
        sent.push(message.text);
        return { delivered: true };
      },
    };
  };

  test("a sender whose claim was taken over meanwhile never writes over the new claim", async () => {
    await storingForm(env, await fresh("owner"), "store_and_notify", (i) => (i.settings.notificationEmails = ["test.office@example.test"]));
    const { enquiryId } = await received(env, sub);
    const later = new Date(env.deps.clock().getTime() + 60 * 60_000);
    const slow = mailer(async () => {
      await query(env, "UPDATE email_outbox SET claimed_until = ?, attempts = attempts + 1 WHERE related_id = ?", [later, enquiryId]);
    });
    await processOutbox(env.deps.db, slow, env.deps.clock());
    const [row] = await query<{ status: string; claimed_until: unknown }>(env, "SELECT status, claimed_until FROM email_outbox WHERE related_id = ?", [enquiryId]);
    assert.equal(row.status, "sending", "the other sender's claim stands");
    assert.equal(new Date(String(row.claimed_until instanceof Date ? (row.claimed_until as Date).toISOString() : row.claimed_until)).getTime() > env.deps.clock().getTime(), true);
    await query(env, "UPDATE email_outbox SET status = 'sent', claimed_until = NULL WHERE related_id = ?", [enquiryId]);
  });

  test("a row whose body was cleared is cancelled, never sent empty; an anonymized enquiry's rows are cancelled and can't be queued again", async () => {
    const owner = await fresh("owner");
    await storingForm(env, owner, "store_and_notify", (i) => ((i.settings.notificationEmails = ["test.office@example.test"]), (i.settings.retentionDays = null)));
    const cleared = await received(env, sub);
    await query(env, "UPDATE email_outbox SET body_text = NULL WHERE related_id = ?", [cleared.enquiryId]);
    const sender = mailer();
    await processOutbox(env.deps.db, sender, env.deps.clock());
    assert.deepEqual(sender.sent.filter((text) => text === ""), [], "nothing sent with an empty body");
    assert.equal((await query<{ status: string }>(env, "SELECT status FROM email_outbox WHERE related_id = ?", [cleared.enquiryId]))[0].status, "cancelled");

    const failed = await received(env, sub);
    await query(env, "UPDATE email_outbox SET status = 'failed', attempts = 5 WHERE related_id = ?", [failed.enquiryId]);
    await storingForm(env, owner, "store_and_notify", (i) => (i.settings.retentionDays = 30));
    env.clock.advance(40 * 86_400_000);
    assert.equal((await applyRetention(env.deps, sub.store, "quote", "test operator")).kind, "done");
    const [row] = await query<{ id: string; status: string }>(env, "SELECT id, status FROM email_outbox WHERE related_id = ?", [failed.enquiryId]);
    assert.equal(row.status, "cancelled");
    assert.notEqual((await retryNotification(formsChange(env, await fresh("admin")), row.id)).kind, "ok");
    assert.equal((await enquiryRow(env, failed.enquiryId)).anonymized_at !== null, true);
    await storingForm(env, await fresh("owner"), "store", (i) => (i.settings.retentionDays = null));
  });
});

describe("I11: a storage failure's message", () => {
  test("never carries the visitor's values (the driver's message holds the INSERT's parameters)", async () => {
    await query(env, "ALTER TABLE enquiries ADD CONSTRAINT ck_test_review CHECK (full_name <> 'Test Leak Person')");
    try {
      await assert.rejects(
        submitEnquiry(sub.deps, validInput(env, { fields: { fullName: "Test Leak Person", email: "leak.visitor@example.test", message: "Test leak message body, long enough to pass." } })),
        (error: Error) => {
          assert.doesNotMatch(String(error.message), /Test Leak Person|leak\.visitor|Test leak message/);
          assert.doesNotMatch(String((error as { cause?: unknown }).cause ?? ""), /Test Leak Person|leak\.visitor/);
          return true;
        },
      );
    } finally {
      await query(env, "ALTER TABLE enquiries DROP CONSTRAINT ck_test_review");
    }
  });
});
