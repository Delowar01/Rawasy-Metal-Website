/**
 * Test only (the A6 final correction's preview-fidelity test in `e2e-admin/preview-parity.spec.ts`): writes the company
 * settings' working copy in the admin E2E run's database through the A6 services (`setUpSettings`, then `saveSettings`
 * with the given edits, so every value passes the settings' validation), as an Owner it adds for itself; or empties the
 * A6 working copy again, as `e2e-admin/site.spec.ts` does when it ends. Synthetic values only; nothing here is part of
 * the site or the deployment archive.
 *
 *   node e2e-admin/seed-site.mjs set '<edits as JSON>'
 *   node e2e-admin/seed-site.mjs clear
 *
 * Edits: `email`, `mapsQuery`, `mapsPlaceUrl`, `phone` ({ display, e164 }: the first number), and per language
 * (`en`, `ar`) `legalName`, `addressLines`, `addressFull`. Refuses anything but APP_ENV=local and a database named
 * rawasy_e2e_*. Prints the stored settings' version.
 */
import { randomBytes } from "node:crypto";

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

if (process.env.APP_ENV !== "local" || !/^rawasy_e2e_[0-9a-f]+$/.test(process.env.DB_NAME ?? "")) {
  console.error("seed-site: only for the local admin E2E database (APP_ENV=local, DB_NAME=rawasy_e2e_*).");
  process.exit(2);
}

const [mode, json] = process.argv.slice(2);
if (mode !== "set" && mode !== "clear") {
  console.error("seed-site: set '<edits as JSON>' | clear");
  process.exit(2);
}

const { eq, sql } = await import("drizzle-orm");
const { readDbConfig } = await import("../src/server/config/env.ts");
const { createAppPool } = await import("../src/server/db/pool.ts");
const { dbFor } = await import("../src/server/db/client.ts");
const { createAuthDeps } = await import("../src/server/auth/deps.ts");
const { createSession } = await import("../src/server/auth/sessions.ts");
const { userRoles, users } = await import("../src/server/db/schema.ts");
const { ulid } = await import("../src/server/security/ids.ts");
const { permissionsOf, rankOf } = await import("../src/server/policy/registry.ts");
const { readSettings, saveSettings, setUpSettings } = await import("../src/server/site/settings.ts");

const pool = createAppPool({ ...readDbConfig(), poolLimit: 2 });
const deps = createAuthDeps(pool);
const db = dbFor(pool);

try {
  if (mode === "clear") {
    // The A6 working copy back to the seed's empty rows (the same statements as site.spec.ts's afterAll).
    await db.execute(sql`UPDATE site_settings SET primary_whatsapp_phone_id = NULL, default_og_image_media_id = NULL`);
    for (const table of ["company_phones", "site_setting_translations", "ui_string_translations", "menu_items", "design_token_overrides", "redirects"]) {
      await db.execute(sql.raw(`DELETE FROM ${table}`));
    }
    console.log(JSON.stringify({ cleared: true }));
  } else {
    const edits = JSON.parse(json ?? "{}");
    const now = deps.clock();
    const id = ulid(now.getTime());
    const email = `site.seed.${id.slice(-6).toLowerCase()}@example.test`;
    await db.insert(users).values({
      id,
      email,
      emailNormalized: email,
      displayName: "Test site seed owner",
      status: "active",
      passwordHash: await deps.hasher.hash(randomBytes(24).toString("hex")),
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(userRoles).values({ userId: id, roleKey: "owner", grantedAt: now });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    const { session } = await createSession(db, { userId: id, now, ip: "203.0.113.6", userAgent: "site-seed", mfaVerified: true });
    const actor = { user, roles: ["owner"], permissions: permissionsOf(["owner"]), rank: rankOf(["owner"]), session };
    const change = () => ({ deps, actor, meta: { requestId: ulid(), ip: "203.0.113.6", userAgent: "site-seed" } });

    const setUp = await setUpSettings(change());
    if (setUp.kind !== "ok") throw new Error(`seed-site: set-up refused: ${JSON.stringify(setUp)}`);
    const model = await readSettings(db);
    const v = model.values;
    const texts = { en: structuredClone(v.texts.en), ar: structuredClone(v.texts.ar) };
    for (const locale of ["en", "ar"]) {
      for (const key of ["legalName", "addressLines", "addressFull"]) if (edits[locale]?.[key] !== undefined) texts[locale][key] = edits[locale][key];
    }
    const phones = v.phones.map((p) => ({ ...p }));
    if (edits.phone) Object.assign(phones[0], edits.phone);
    const input = {
      expectedVersion: model.lockVersion,
      websiteUrl: v.websiteUrl,
      email: edits.email ?? v.email,
      postalCode: v.postalCode,
      geoLat: v.geoLat,
      geoLng: v.geoLng,
      geoIsApproximate: v.geoIsApproximate,
      facebookUrl: v.facebookUrl,
      mapsPlaceUrl: edits.mapsPlaceUrl ?? v.mapsPlaceUrl,
      mapsQuery: edits.mapsQuery ?? v.mapsQuery,
      defaultOgImageMediaId: v.defaultOgImageMediaId,
      phones,
      texts,
      complete: { en: true, ar: true },
      otherUnaffected: false,
    };
    const saved = await saveSettings(change(), input);
    if (saved.kind !== "ok") throw new Error(`seed-site: the settings were not stored: ${JSON.stringify(saved).slice(0, 800)}`);
    console.log(JSON.stringify({ lockVersion: saved.lockVersion }));
  }
} finally {
  await pool.end();
}
