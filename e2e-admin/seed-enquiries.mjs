/**
 * Test only (the A7 browser spec, e2e-admin/enquiries.spec.ts): stores synthetic enquiries in the admin E2E run's
 * database through the A7 services — the quote form set up and switched to storing by an Owner this script adds for
 * itself (`setUpForm`, `saveForm`), then each enquiry through the prepared submission service (`submitEnquiry`: every
 * check of a real submission, with a token this script signs), attachments into the run's temporary RAWASY_DATA_DIR.
 * Synthetic values only ("Test …", example.test addresses); nothing here is part of the site or the deployment archive.
 *
 *   node e2e-admin/seed-enquiries.mjs '{"count":3,"files":1,"mode":"store_and_notify","names":["Test A"]}'
 *
 * Refuses anything but APP_ENV=local and a database named rawasy_e2e_*. Prints the stored enquiries as JSON.
 */
import { randomBytes } from "node:crypto";

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

if (process.env.APP_ENV !== "local" || !/^rawasy_e2e_[0-9a-f]+$/.test(process.env.DB_NAME ?? "")) {
  console.error("seed-enquiries: only for the local admin E2E database (APP_ENV=local, DB_NAME=rawasy_e2e_*).");
  process.exit(2);
}

const options = JSON.parse(process.argv[2] ?? "{}");
const { eq } = await import("drizzle-orm");
const { readDbConfig } = await import("../src/server/config/env.ts");
const { createAppPool } = await import("../src/server/db/pool.ts");
const { dbFor } = await import("../src/server/db/client.ts");
const { createAuthDeps } = await import("../src/server/auth/deps.ts");
const { createSession } = await import("../src/server/auth/sessions.ts");
const { userRoles, users } = await import("../src/server/db/schema.ts");
const { ulid } = await import("../src/server/security/ids.ts");
const { permissionsOf, rankOf } = await import("../src/server/policy/registry.ts");
const { readForm, saveForm, setUpForm } = await import("../src/server/forms/forms.ts");
const { FORM_IDS } = await import("../src/server/forms/registry.ts");
const { issueToken } = await import("../src/server/enquiries/token.ts");
const { submitEnquiry } = await import("../src/server/enquiries/submission.ts");
const { mediaStore } = await import("../src/server/media/storage.ts");

const pool = createAppPool({ ...readDbConfig(), poolLimit: 2 });
const deps = createAuthDeps(pool);
const db = dbFor(pool);

/** A minimal valid PDF (header and end-of-file marker). */
const pdf = (label) => Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% ${label}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, "latin1");

try {
  const now = deps.clock();
  const id = ulid(now.getTime());
  const email = `enquiry.seed.${id.slice(-6).toLowerCase()}@example.test`;
  await db.insert(users).values({
    id,
    email,
    emailNormalized: email,
    displayName: "Test enquiry seed owner",
    status: "active",
    passwordHash: await deps.hasher.hash(randomBytes(24).toString("hex")),
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(userRoles).values({ userId: id, roleKey: "owner", grantedAt: now });
  const [user] = await db.select().from(users).where(eq(users.id, id));
  const { session } = await createSession(db, { userId: id, now, ip: "203.0.113.7", userAgent: "enquiry-seed", mfaVerified: true });
  const actor = { user, roles: ["owner"], permissions: permissionsOf(["owner"]), rank: rankOf(["owner"]), session };
  const change = () => ({ deps, actor, meta: { requestId: ulid(), ip: "203.0.113.7", userAgent: "enquiry-seed" } });

  // The form set up and storing (files accepted when asked).
  if (!(await readForm(db, { id: FORM_IDS.quote })).setUp) {
    const setUp = await setUpForm(change(), FORM_IDS.quote);
    if (setUp.kind !== "ok") throw new Error(`set-up: ${JSON.stringify(setUp)}`);
  }
  const form = await readForm(db, { id: FORM_IDS.quote });
  const mode = options.mode ?? "store";
  const saved = await saveForm(change(), FORM_IDS.quote, {
    expectedVersion: form.lockVersion,
    settings: {
      ...form.settings,
      deliveryMode: mode,
      notificationEmails: mode === "store_and_notify" ? ["test.office@example.test"] : form.settings.notificationEmails,
      acceptFiles: Boolean(options.files) || form.settings.acceptFiles,
      acceptedExtensions: options.files ? [".pdf"] : form.settings.acceptedExtensions,
    },
    copy: form.copy,
    fields: form.fields.map((f) => ({ id: f.id, isRequired: f.isRequired, minLength: f.minLength, maxLength: f.maxLength, texts: f.texts })),
    complete: { en: form.status.en === "complete", ar: form.status.ar === "complete" },
    otherUnaffected: false,
  });
  if (saved.kind !== "ok") throw new Error(`form: ${JSON.stringify(saved)}`);

  const tokenKey = randomBytes(32);
  const submission = { pool, db, clock: deps.clock, tokenKey, siteOrigin: "https://rawasy.example.test", adminUrl: process.env.ADMIN_BASE_URL ?? "http://localhost:3401", store: () => mediaStore() };
  const out = [];
  const names = options.names ?? [];
  for (let i = 0; i < (options.count ?? 1); i++) {
    const ar = i % 2 === 1;
    const name = names[i] ?? (ar ? `اختبار ${i + 1}` : `Test Visitor ${i + 1}`);
    const result = await submitEnquiry(submission, {
      formKey: "quote",
      locale: ar ? "ar" : "en",
      origin: "https://rawasy.example.test",
      secFetchSite: "same-origin",
      contentLength: 4096,
      ip: `198.51.100.${(i % 200) + 20}`,
      userAgent: "enquiry-seed",
      sourcePath: ar ? "/ar/contact" : "/en/contact",
      fields: {
        token: issueToken(tokenKey, "quote", new Date(deps.clock().getTime() - 60_000)),
        website: "",
        fullName: name,
        company: options.company ?? (ar ? "" : `Test Company ${i + 1}`),
        email: `test.visitor.${i + 1}.${id.slice(-4).toLowerCase()}@example.test`,
        phone: ar ? "٠٥٠١٢٣٤٥٦٧" : "+966 50 123 4567",
        service: "laser-cutting",
        projectType: "custom-piece",
        requirement: "Test plates, 3 mm",
        location: ar ? "مدينة تجريبية" : "Test City",
        message: options.message ?? (ar ? "طلب تجريبي لاختبارات المتصفح فقط، لا أكثر." : `A synthetic request ${i + 1} for the browser tests only.`),
      },
      files: options.files && i < options.files ? [{ name: `test-drawing-${i + 1}.pdf`, bytes: pdf(`drawing ${i + 1}`) }] : [],
    });
    if (result.kind !== "received") throw new Error(`submission ${i + 1}: ${JSON.stringify(result)}`);
    out.push({ id: result.enquiryId, reference: result.reference, name });
  }
  console.log(JSON.stringify(out));
} finally {
  await pool.end();
}
