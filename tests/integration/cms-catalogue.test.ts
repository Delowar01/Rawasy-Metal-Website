/**
 * Core CMS (A3) — industries, clients and certificates on a real MariaDB: industries with their classification,
 * services and projects in order; client metadata with a validated https address, the featured working flag and
 * archive; certificate document metadata only — no file, no public address, no invented or sensitive numbers (the
 * digit guard on every public text), the expiry date admin-only. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, loadEditorItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { certificateSpec, clientSpec, industrySpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { loadOrder, moveItem } from "../../src/server/cms/ordering.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_catalogue");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);

describe("industries", () => {
  let svc = "";
  let prj = "";
  const industry = (slug: string, extra: Fields = {}): Fields => ({
    slug,
    classification: "website_classification",
    "en.name": `Test Industry ${slug}`,
    "en.description": "A test sector description.",
    ...extra,
  });

  before(async () => {
    svc = expectOk(
      await createItem(
        ctxOf(env, t.editor),
        serviceSpec,
        formOf({ slug: "test-service", serviceGroup: "metal", iconKey: "fabrication", "en.name": "Test Service", "en.tagline": "T", "en.summary": "S", "en.body": "B" }),
      ),
    ).id;
    prj = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "demo-project", "en.title": "Demo Project", "en.summary": "Demo." }))).id;
  });

  test("CRUD with services and projects in order, an Arabic translation and a classification from the list only", async () => {
    const id = expectOk(await createItem(ctxOf(env, t.editor), industrySpec, formOf(industry("energy-test", { "rel.services": [svc], "rel.projects": [prj] })))).id;
    expectOk(
      await updateItem(
        ctxOf(env, t.editor),
        industrySpec,
        id,
        formOf(industry("energy-test", { lockVersion: "0", "ar.name": "قطاع تجريبي", "ar.description": "وصف تجريبي.", "ar.complete": "1", "rel.services": [svc], "rel.projects": [prj] })),
      ),
    );
    const item = await loadEditorItem(db(), industrySpec, id);
    assert.deepEqual(item?.rel, { services: [svc], projects: [prj] });
    assert.deepEqual(item?.states, { en: "draft", ar: "complete" });
    const bad = await updateItem(ctxOf(env, t.editor), industrySpec, id, formOf(industry("energy-test", { lockVersion: "1", classification: "invented" })));
    assert.equal(bad.kind, "invalid");
  });

  test("order: Move up / Move down", async () => {
    const second = expectOk(await createItem(ctxOf(env, t.editor), industrySpec, formOf(industry("water-test")))).id;
    const order = (await loadOrder(db(), "industry"))!;
    assert.equal(order.rows.at(-1)?.id, second);
    expectOk(await moveItem(ctxOf(env, t.editor), "industry", second, "up", order.lockVersion));
    assert.equal((await loadOrder(db(), "industry"))!.rows[0].id, second);
  });
});

describe("clients", () => {
  let id = "";
  const client = (extra: Fields = {}): Fields => ({ slug: "demo-client", "en.name": "Demo Client Co.", "ar.name": "شركة عميل تجريبية", ...extra });

  test("metadata CRUD: name per language, featured working flag; logos only as A1's media references (A4)", async () => {
    id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(client({ isFeatured: "1" })))).id;
    const [row] = await query(env, "SELECT is_featured, website_url, publication_status, logo_media_id, logo_mono_media_id FROM clients WHERE id = ?", [id]);
    assert.deepEqual(row, { is_featured: 1, website_url: null, publication_status: "unpublished", logo_media_id: null, logo_mono_media_id: null });
    const columns = (await query<{ c: string }>(env, "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'")).map(
      (r) => r.c,
    );
    // A3 had no logo; A4 adds exactly A1's two media references (ids of media items), never a file, path or upload column.
    assert.deepEqual(columns.filter((c) => /logo|media|file|upload|path/.test(c)).sort(), ["logo_media_id", "logo_mono_media_id"], columns.join(","));
  });

  test("the website address: https only, a public host, no credentials, no script", async () => {
    for (const websiteUrl of [
      "http://example.com",
      "javascript:alert(1)",
      "https://user:secret@example.com",
      "https://localhost",
      "https://exa mple.com",
      "//example.com",
      "data:text/html,hi",
      `https://example.com/${"x".repeat(250)}`,
    ]) {
      const result = await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(client({ lockVersion: "0", websiteUrl })));
      assert.equal(result.kind, "invalid", websiteUrl);
    }
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(client({ lockVersion: "0", websiteUrl: "  https://example.com/about  " }))));
    assert.equal((await query(env, "SELECT website_url FROM clients WHERE id = ?", [id]))[0].website_url, "https://example.com/about");
  });

  test("archive needs clients.archive (not an Editor's); archived clients are kept and restorable", async () => {
    assert.equal((await setItemArchived(ctxOf(env, t.editor), clientSpec, id, true, 1)).kind, "denied");
    expectOk(await setItemArchived(ctxOf(env, t.admin), clientSpec, id, true, 1));
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM client_translations WHERE client_id = ?", [id]))[0].n, 2);
    expectOk(await setItemArchived(ctxOf(env, t.owner), clientSpec, id, false, 2));
  });
});

describe("certificates (document metadata only)", () => {
  let id = "";
  const certificate = (extra: Fields = {}): Fields => ({ slug: "test-licence", "en.title": "Test Licence", "en.issuer": "Test Issuing Body", ...extra });

  test("edited by Owner and Admin only (certificates.edit); archived by the Owner only", async () => {
    assert.equal((await createItem(ctxOf(env, t.editor), certificateSpec, formOf(certificate()))).kind, "denied");
    id = expectOk(await createItem(ctxOf(env, t.admin), certificateSpec, formOf(certificate({ expiresOn: "2028-06-30", sourceNote: "Renewal reminder for the test." })))).id;
    assert.equal((await setItemArchived(ctxOf(env, t.admin), certificateSpec, id, true, 0)).kind, "denied");
    expectOk(await setItemArchived(ctxOf(env, t.owner), certificateSpec, id, true, 0));
    expectOk(await setItemArchived(ctxOf(env, t.owner), certificateSpec, id, false, 1));
  });

  test("no file, address or number column exists — files only as A1's media references (A4); the expiry date is a plain admin-only date", async () => {
    const columns = (await query<{ t: string; c: string }>(
      env,
      "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'certificate%'",
    )).map((r) => `${r.t}.${r.c}`);
    // A4 adds exactly A1's references to media items: the thumbnail and the documents table (previews and the private
    // original, by role). Never a URL, a path, a stored file, a number or a QR column.
    const media = ["certificates.thumb_media_id", "certificate_documents.certificate_id", "certificate_documents.media_id", "certificate_documents.role", "certificate_documents.locale", "certificate_documents.position"];
    assert.deepEqual(columns.filter((c) => /url|file|document|media|path|number|qr|thumb/.test(c)).sort(), [...media].sort(), columns.join(","));
    assert.ok(!columns.some((c) => /url|file|path|number|qr/.test(c.replace(/^certificate_documents\./, ""))), columns.join(","));
    assert.deepEqual((await query(env, "SELECT CAST(expires_on AS CHAR) AS d FROM certificates WHERE id = ?", [id]))[0], { d: "2028-06-30" });
  });

  test("the digit guard: no registration number (7+ digits, grouped digits) or expiry wording in any public text", async () => {
    const attempts: Fields[] = [
      { "en.title": "Test Licence 1234567" },
      { "en.title": "Test Licence ١٢٣٤٥٦٧" },
      { "en.issuer": "Body No. 123 456 789" },
      { "en.title": "Test Licence, expires 2028" },
      { "ar.title": "رخصة تجريبية تاريخ الانتهاء" },
      { children: JSON.stringify([{ id: null, en: { label: "Number", value: "10-2034-5678" }, ar: { label: "", value: "" } }]) },
      { children: JSON.stringify([{ id: null, en: { label: "Expiry", value: "Soon" }, ar: { label: "", value: "" } }]) },
    ];
    for (const extra of attempts) {
      const result = await updateItem(ctxOf(env, t.admin), certificateSpec, id, formOf(certificate({ lockVersion: "2", ...extra })));
      assert.equal(result.kind, "invalid", JSON.stringify(extra));
    }
    const facts = JSON.stringify([
      { id: null, en: { label: "Entity type", value: "Test company" }, ar: { label: "نوع المنشأة", value: "شركة تجريبية" } },
      { id: null, en: { label: "Issued", value: "2026-01-15" }, ar: { label: "تاريخ الإصدار", value: "2026-01-15" } },
    ]);
    expectOk(await updateItem(ctxOf(env, t.admin), certificateSpec, id, formOf(certificate({ lockVersion: "2", children: facts, "ar.title": "رخصة تجريبية", "ar.issuer": "جهة تجريبية" }))));
    const item = await loadEditorItem(db(), certificateSpec, id);
    assert.deepEqual(
      item?.children.map((c) => c.en.label),
      ["Entity type", "Issued"],
    );
  });

  test("nothing about a certificate is invented: optional fields stay empty and the audit holds no long text", async () => {
    const [row] = await query(env, "SELECT source_basis, source_pages, publication_status FROM certificates WHERE id = ?", [id]);
    assert.deepEqual(row, { source_basis: null, source_pages: null, publication_status: "unpublished" });
    for (const event of await auditOf(env, "certificate", id)) assert.ok(event.summary.length <= 500);
  });
});
