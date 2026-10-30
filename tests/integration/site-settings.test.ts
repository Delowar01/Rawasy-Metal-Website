/**
 * Site controls (A6) — company & website settings, interface text and theme on a real MariaDB: the seed's empty
 * singletons, set-up copied from today's website (never invented), saves decided on the version the form showed, the
 * validation rules (A3 plain text, https allow-lists, E.164, the share image an approved public image), phones and the
 * WhatsApp number, interface text by group (keys from the registry only, lengths, emptying), the theme's refusals (no
 * token approved: D-A6-3) and its mechanism with an injected approved token, permissions and the audit trail (keys and
 * states only). Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { SessionEndedError } from "../../src/server/auth/sessions.ts";
import { company } from "../../src/content/company.ts";
import { getDictionary } from "../../src/i18n/dictionaries.ts";
import { readSettings, saveSettings, setUpSettings } from "../../src/server/site/settings.ts";
import { readTheme, resetTheme, setTokenOverride } from "../../src/server/site/theme.ts";
import { readUiText, readUiValues, saveUiText, setUpUiText } from "../../src/server/site/ui-text.ts";
import { UI_STRINGS, type TokenDef } from "../../src/server/site/registry.ts";
import { auditOf, query, seedMedia, team, type Team } from "./cms-helpers.ts";
import { actorFor, createUser, setupTestEnv, type TestEnv } from "./helpers.ts";
import { expectKind, issuesOf, settingsInputOf, siteChange } from "./site-helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("site_settings");
  t = await team(env);
});
after(async () => env?.close());

const version = async () => Number((await query<{ v: number }>(env, "SELECT lock_version AS v FROM site_settings WHERE id = 'site'"))[0].v);

describe("the seed", () => {
  test("the singletons, the four menu slots and every interface-text key exist; no company fact is written", async () => {
    const [site] = await query(env, "SELECT * FROM site_settings");
    assert.equal(site.id, "site");
    assert.equal(site.website_url, "");
    assert.equal(site.email, "");
    assert.equal(site.maps_query, "");
    assert.equal(site.country_code, "SA");
    assert.equal((await query(env, "SELECT * FROM site_setting_translations")).length, 0);
    assert.deepEqual((await query<{ key: string }>(env, "SELECT `key` FROM menus ORDER BY `key`")).map((r) => r.key), ["footer_company", "footer_legal", "header_main", "header_services"]);
    assert.equal((await query(env, "SELECT * FROM menu_items")).length, 0);
    assert.deepEqual((await query<{ key: string }>(env, "SELECT `key` FROM ui_strings ORDER BY `key`")).map((r) => r.key), UI_STRINGS.map((s) => s.key).sort());
    assert.equal((await query(env, "SELECT * FROM ui_string_translations")).length, 0);
    assert.equal((await query(env, "SELECT * FROM theme_settings")).length, 1);
    assert.equal((await query(env, "SELECT * FROM design_token_overrides")).length, 0);
    assert.equal((await readSettings(env.deps.db)).setUp, false);
  });
});

describe("settings set-up", () => {
  test("an Editor and a Reviewer are refused (audited); the settings stay empty", async () => {
    for (const actor of [t.editor, t.reviewer]) {
      const result = await setUpSettings(siteChange(env, actor));
      assert.match(expectKind(result, "denied").message, /permission you don't hold/);
    }
    assert.equal((await readSettings(env.deps.db)).setUp, false);
    const events = await auditOf(env, "site_settings", "site");
    assert.equal(events.filter((e) => e.action === "site_settings.setup" && e.outcome === "denied").length, 2);
  });

  test("an Admin copies today's website: company, contact, address, phones (WhatsApp from the first), both languages", async () => {
    const before = await version();
    expectKind(await setUpSettings(siteChange(env, t.admin)), "ok");
    const s = await readSettings(env.deps.db);
    assert.equal(s.setUp, true);
    assert.equal(s.lockVersion, before + 1);
    assert.equal(s.values.websiteUrl, company.website);
    assert.equal(s.values.email, company.email);
    assert.equal(s.values.postalCode, company.postalCode);
    assert.equal(s.values.facebookUrl, company.social.facebook);
    assert.equal(s.values.mapsPlaceUrl, "", "RAWASY's own map link stays empty until confirmed");
    assert.equal(s.values.mapsQuery, company.address.en.full);
    assert.equal(s.values.defaultOgImageMediaId, "");
    assert.deepEqual(
      s.values.phones.map((p) => ({ display: p.display, e164: p.e164, w: p.hasWhatsapp })),
      company.phones.map((p) => ({ display: p.display, e164: p.e164, w: p.whatsapp })),
    );
    assert.equal(s.primaryWhatsappPhoneId, s.values.phones[0].id);
    for (const locale of ["en", "ar"] as const) {
      assert.equal(s.values.texts[locale].legalName, company.legalName[locale]);
      assert.equal(s.values.texts[locale].statement, company.statement[locale]);
      assert.deepEqual(s.values.texts[locale].addressLines, company.address[locale].lines);
      assert.deepEqual(s.values.texts[locale].visionAims, company.vision.aims[locale]);
      assert.equal(s.values.texts[locale].defaultSeoDescription, "", "no site-wide description exists today");
      assert.equal(s.status[locale], "complete");
    }
    const [event] = await auditOf(env, "site_settings", "site");
    assert.equal(event.action, "site_settings.setup");
    assert.equal(event.outcome, "success");
    expectKind(await setUpSettings(siteChange(env, t.owner)), "ok");
    assert.equal(await version(), before + 1, "a second set-up changes nothing");
  });
});

describe("settings saves", () => {
  test("an Owner's edit is stored; the audit names the fields and languages, never the values", async () => {
    const model = await readSettings(env.deps.db);
    const input = settingsInputOf(model);
    input.email = "test.contact@example.com";
    input.texts!.ar.statement = "نص تجريبي للاختبار";
    const result = expectKind(await saveSettings(siteChange(env, t.owner), input), "ok");
    assert.equal(result.lockVersion, model.lockVersion + 1);
    const after = await readSettings(env.deps.db);
    assert.equal(after.values.email, "test.contact@example.com");
    assert.equal(after.values.texts.ar.statement, "نص تجريبي للاختبار");
    assert.equal(after.values.texts.en.statement, model.values.texts.en.statement);
    const [event] = await auditOf(env, "site_settings", "site");
    assert.equal(event.action, "site_settings.update");
    assert.match(event.summary, /email/);
    assert.match(event.summary, /Arabic/);
    assert.doesNotMatch(JSON.stringify(event), /test\.contact@example\.com|نص تجريبي/);
  });

  test("a form opened on an older version is refused as stale (audited failed), and the newer save stays", async () => {
    const model = await readSettings(env.deps.db);
    const first = settingsInputOf(model);
    const second = settingsInputOf(model);
    first.texts!.en.city = "Test City One";
    second.texts!.en.city = "Test City Two";
    expectKind(await saveSettings(siteChange(env, t.admin), first), "ok");
    assert.match(expectKind(await saveSettings(siteChange(env, t.owner), second), "stale").message, /changed after you opened them/);
    assert.equal((await readSettings(env.deps.db)).values.texts.en.city, "Test City One");
    const [event] = await auditOf(env, "site_settings", "site");
    assert.equal(event.outcome, "failed");
  });

  test("invalid values are refused field by field and nothing is stored", async () => {
    const model = await readSettings(env.deps.db);
    const cases: [string, (i: ReturnType<typeof settingsInputOf>) => void, RegExp][] = [
      ["email", (i) => (i.email = "not an email"), /email: Enter one email address/],
      ["website http", (i) => (i.websiteUrl = "http://www.example.com"), /websiteUrl: Only https/],
      ["facebook host", (i) => (i.facebookUrl = "https://evil.example.com/page"), /facebookUrl: Enter a Facebook address/],
      ["maps host", (i) => (i.mapsPlaceUrl = "https://maps.example.com/x"), /mapsPlaceUrl: Enter a Google Maps address/],
      ["maps path", (i) => (i.mapsPlaceUrl = "https://www.google.com/search?q=x"), /mapsPlaceUrl: Enter a Google Maps address/],
      ["phone", (i) => (i.phones![0].e164 = "0537368310"), /phones\.0\.e164: Enter the number in international form/],
      ["no WhatsApp", (i) => i.phones!.forEach((p) => (p.hasWhatsapp = false)), /phones: At least one shown number must have WhatsApp/],
      ["empty Arabic", (i) => (i.texts!.ar.legalName = "  "), /texts\.ar\.legalName: Required in both languages/],
      ["markup", (i) => (i.texts!.en.city = "<b>Riyadh</b>"), /texts\.en\.city/],
      ["five address lines", (i) => (i.texts!.en.addressLines = ["a", "b", "c", "d", "e"]), /addressLines: Use at most 4 lines/],
      ["one coordinate", (i) => ((i.geoLat = "24.6"), (i.geoLng = "")), /geoLat: Give both coordinates/],
      ["unknown phone id", (i) => (i.phones![0].id = "01ARZ3NDEKTSV4RRFFQ69G5FAV"), /phones: The phone list changed/],
    ];
    for (const [name, change, pattern] of cases) {
      const input = settingsInputOf(model);
      change(input);
      const result = await saveSettings(siteChange(env, t.owner), input);
      assert.equal(result.kind, "invalid", name);
      assert.match(issuesOf(result), pattern, name);
    }
    assert.equal(await version(), model.lockVersion, "nothing was stored");
  });

  test("a form cannot carry other fields (no mass assignment: version, WhatsApp id, publication)", async () => {
    const model = await readSettings(env.deps.db);
    for (const extra of [{ lockVersion: 99 }, { primaryWhatsappPhoneId: model.values.phones[1].id }, { publicationStatus: "published" }]) {
      const result = await saveSettings(siteChange(env, t.owner), { ...settingsInputOf(model), ...extra });
      assert.equal(result.kind, "invalid");
    }
    assert.equal(await version(), model.lockVersion);
  });

  test("phones keep their ids; a removed first phone hands WhatsApp to the next shown WhatsApp number", async () => {
    const model = await readSettings(env.deps.db);
    const input = settingsInputOf(model);
    const [, second] = model.values.phones;
    input.phones = [{ ...second }, { id: "", display: "+966 50 000 0000", e164: "+966500000000", hasWhatsapp: false, isVisible: true }];
    expectKind(await saveSettings(siteChange(env, t.owner), input), "ok");
    const after = await readSettings(env.deps.db);
    assert.equal(after.values.phones.length, 2);
    assert.equal(after.values.phones[0].id, second.id);
    assert.equal(after.primaryWhatsappPhoneId, second.id);
    assert.equal((await query(env, "SELECT * FROM company_phones WHERE id = ?", [model.values.phones[0].id])).length, 0);
  });

  test("the default share image: an approved public image only (D-A6-7)", async () => {
    const approved = await seedMedia(env, { status: "approved", title: "Test approved" });
    const pending = await seedMedia(env, { status: "pending_review" });
    const privateDoc = await seedMedia(env, { visibility: "private", kind: "document" });
    const doc = await seedMedia(env, { kind: "document", status: "approved" });
    const notReady = await seedMedia(env, { status: "approved", ready: false });
    for (const [id, pattern] of [
      [pending, /Choose an approved image/],
      [privateDoc, /can't be used here/],
      [doc, /Choose an image here/],
      [notReady, /no ready file/],
    ] as const) {
      const input = settingsInputOf(await readSettings(env.deps.db));
      input.defaultOgImageMediaId = id;
      const result = await saveSettings(siteChange(env, t.owner), input);
      assert.match(issuesOf(result), pattern);
    }
    const input = settingsInputOf(await readSettings(env.deps.db));
    input.defaultOgImageMediaId = approved;
    expectKind(await saveSettings(siteChange(env, t.owner), input), "ok");
    assert.equal((await readSettings(env.deps.db)).values.defaultOgImageMediaId, approved);
    // Kept as it is even after its approval is withdrawn (A4: a kept reference may stay; publishing checks again in A8).
    await query(env, "UPDATE media_assets SET usage_status = 'pending_review' WHERE id = ?", [approved]);
    expectKind(await saveSettings(siteChange(env, t.owner), settingsInputOf(await readSettings(env.deps.db))), "ok");
  });

  test("an Editor's save is refused (audited denied); a session ended meanwhile saves nothing", async () => {
    const model = await readSettings(env.deps.db);
    const refused = await saveSettings(siteChange(env, t.editor), settingsInputOf(model));
    assert.equal(refused.kind, "denied");
    const [event] = await auditOf(env, "site_settings", "site");
    assert.equal(event.outcome, "denied");
    // A second Admin of its own, so the team's sessions stay live for the other tests.
    const leaving = await actorFor(env, await createUser(env, { roles: ["admin"], name: "Test Leaving Admin", mfa: true }));
    await query(env, "UPDATE sessions SET revoked_at = ?, revoked_reason = 'logout' WHERE id = ?", [new Date(), leaving.session.id]);
    const input = settingsInputOf(model);
    input.texts!.en.city = "Never Stored";
    await assert.rejects(saveSettings(siteChange(env, leaving), input), SessionEndedError);
    assert.notEqual((await readSettings(env.deps.db)).values.texts.en.city, "Never Stored");
  });
});

describe("interface text", () => {
  test("set-up copies today's text for every key and language; a Reviewer is refused", async () => {
    assert.equal((await setUpUiText(siteChange(env, t.reviewer))).kind, "denied");
    expectKind(await setUpUiText(siteChange(env, t.owner)), "ok");
    const values = await readUiValues(env.deps.db);
    assert.equal(values.size, UI_STRINGS.length);
    assert.equal(values.get("a11y.skipToContent")?.en, getDictionary("en").a11y.skipToContent);
    assert.equal(values.get("a11y.languageSwitch")?.en, getDictionary("en").a11y.languageSwitch, "the language switch keeps its other-language text");
    assert.equal(values.get("navigation.footerCompanyTitle")?.ar, "الشركة");
    assert.equal(values.get("notFound.code"), undefined, "the status code is not interface text");
  });

  test("a save of the whole text: changed and emptied values; the audit lists keys only", async () => {
    const model = await readUiText(env.deps.db);
    const values = Object.fromEntries(model.rows.map((r) => [r.def.key, { en: r.value.en ?? "", ar: r.value.ar ?? "" }]));
    values["controls.getQuote"].en = "Test Quote";
    values["controls.theme"].ar = "";
    expectKind(await saveUiText(siteChange(env, t.admin), { expectedVersion: model.lockVersion, values }), "ok");
    const after = await readUiValues(env.deps.db);
    assert.equal(after.get("controls.getQuote")?.en, "Test Quote");
    assert.equal(after.get("controls.theme")?.ar, undefined, "an emptied value is removed (the preview shows today's text)");
    assert.equal(after.get("footer.rights")?.en, getDictionary("en").footer.rights, "untouched keys keep their values");
    const [event] = await auditOf(env, "ui_text", "site");
    assert.match(JSON.stringify(event.changes), /controls\.getQuote:en/);
    assert.equal((event.changes as { values: string[] }).values.length, 2);
    assert.doesNotMatch(JSON.stringify(event), /Test Quote/);
  });

  test("lengths, line breaks, unknown and missing keys are refused; the site version is shared with the settings", async () => {
    const model = await readUiText(env.deps.db);
    const all = () => Object.fromEntries(model.rows.map((r) => [r.def.key, { en: r.value.en ?? "", ar: r.value.ar ?? "" }]));
    const long = all();
    long["footer.rights"].en = "x".repeat(41);
    assert.match(issuesOf(await saveUiText(siteChange(env, t.owner), { expectedVersion: model.lockVersion, values: long })), /at most 40 characters/);
    const newline = all();
    newline["footer.legal"].ar = "سطر\nآخر";
    assert.equal((await saveUiText(siteChange(env, t.owner), { expectedVersion: model.lockVersion, values: newline })).kind, "invalid");
    const unknown = { ...all(), "footer.freeform": { en: "x", ar: "x" } };
    assert.match(issuesOf(await saveUiText(siteChange(env, t.owner), { expectedVersion: model.lockVersion, values: unknown })), /couldn't be read/);
    const missing = all();
    delete missing["footer.rights"];
    assert.match(issuesOf(await saveUiText(siteChange(env, t.owner), { expectedVersion: model.lockVersion, values: missing })), /couldn't be read/);
    assert.equal((await saveUiText(siteChange(env, t.editor), { expectedVersion: model.lockVersion, values: all() })).kind, "denied");
    // A settings save in between makes the interface-text form stale (one aggregate, A1).
    expectKind(await saveSettings(siteChange(env, t.owner), settingsInputOf(await readSettings(env.deps.db))), "ok");
    const fresh = all();
    fresh["footer.rights"].en = "Test rights.";
    assert.equal((await saveUiText(siteChange(env, t.owner), { expectedVersion: model.lockVersion, values: fresh })).kind, "stale");
  });
});

describe("theme", () => {
  const approved: TokenDef = {
    key: "color.test_accent",
    label: "Test accent",
    cssVar: "--brand",
    type: "color",
    schemes: ["all", "light", "dark"],
    against: { light: ["#fdfdfb"], dark: ["#1c232d"], minRatio: 3 },
  };

  test("no token is approved: every override is refused, even the Owner's (audited); an Admin holds no theme permission", async () => {
    const model = await readTheme(env.deps.db);
    const refused = await setTokenOverride(siteChange(env, t.owner), { expectedVersion: model.lockVersion, tokenKey: "color.accent", scheme: "all", value: "#f15f22" });
    assert.match(expectKind(refused, "denied").message, /not approved for overriding/);
    assert.match(expectKind(await setTokenOverride(siteChange(env, t.admin), { expectedVersion: model.lockVersion, tokenKey: "color.accent", scheme: "all", value: "#f15f22" }), "denied").message, /permission/);
    assert.equal((await readTheme(env.deps.db)).overrides.length, 0);
    const events = await auditOf(env, "theme", "theme");
    assert.equal(events.filter((e) => e.outcome === "denied").length, 2);
  });

  test("the mechanism, with a token approved for this test only: validated values, contrast, version, reset", async () => {
    const model = await readTheme(env.deps.db);
    assert.match(issuesOf(await setTokenOverride(siteChange(env, t.owner), { expectedVersion: model.lockVersion, tokenKey: approved.key, scheme: "all", value: "orange" }, [approved])), /#rrggbb/);
    assert.match(issuesOf(await setTokenOverride(siteChange(env, t.owner), { expectedVersion: model.lockVersion, tokenKey: approved.key, scheme: "light", value: "#fefefe" }, [approved])), /contrast/);
    const ok = expectKind(await setTokenOverride(siteChange(env, t.owner), { expectedVersion: model.lockVersion, tokenKey: approved.key, scheme: "light", value: "#B3410D" }, [approved]), "ok");
    assert.deepEqual((await readTheme(env.deps.db)).overrides, [{ tokenKey: approved.key, scheme: "light", value: "#b3410d" }]);
    assert.equal((await setTokenOverride(siteChange(env, t.owner), { expectedVersion: model.lockVersion, tokenKey: approved.key, scheme: "dark", value: "#f26a2e" }, [approved])).kind, "stale");
    assert.equal((await resetTheme(siteChange(env, t.admin), { expectedVersion: ok.lockVersion })).kind, "denied");
    expectKind(await resetTheme(siteChange(env, t.owner), { expectedVersion: ok.lockVersion }), "ok");
    assert.equal((await readTheme(env.deps.db)).overrides.length, 0);
  });
});
