/**
 * Test only (the preview parity tests, A5 brief §72): lays out the About, Contact, Privacy and homepage records and the
 * Laser Engraving service's page in the admin E2E run's database with today's approved words, read from the static content layer (`src/content/*`, read
 * only), so `e2e-admin/preview-parity.spec.ts` can compare each block's preview with the public page drawn from the same
 * words. This is not a content migration: the database is the run's throwaway `rawasy_e2e_*` one, dropped afterwards,
 * and nothing here is part of the site or the deployment archive.
 *
 *   node e2e-admin/seed-parity.mjs
 *
 * Refuses anything but APP_ENV=local and a database named rawasy_e2e_*. Writes through the admin's own services (the A3
 * records, the builder's set-up and save, so every value passes the block registry's validation), as an Owner it adds
 * for itself. The release media must be imported first (`npm run media:import-release`): photos are the approved release
 * items, found by their media key. The six services and six machines become A3 records (first in their collections'
 * order, as today's numbers and showcase need); the parts that show records this seed does not create (projects,
 * clients, certificates, industries) are hidden. Prints the ids of the pages, services and machines as JSON.
 */
import { randomBytes } from "node:crypto";

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

if (process.env.APP_ENV !== "local" || !/^rawasy_e2e_[0-9a-f]+$/.test(process.env.DB_NAME ?? "")) {
  console.error("seed-parity: only for the local admin E2E database (APP_ENV=local, DB_NAME=rawasy_e2e_*).");
  process.exit(2);
}

const { eq, sql } = await import("drizzle-orm");
const { readDbConfig } = await import("../src/server/config/env.ts");
const { createAppPool } = await import("../src/server/db/pool.ts");
const { dbFor } = await import("../src/server/db/client.ts");
const { rowsOf } = await import("../src/server/cms/store.ts");
const { createAuthDeps } = await import("../src/server/auth/deps.ts");
const { createSession } = await import("../src/server/auth/sessions.ts");
const { userRoles, users } = await import("../src/server/db/schema.ts");
const { ulid } = await import("../src/server/security/ids.ts");
const { permissionsOf, rankOf } = await import("../src/server/policy/registry.ts");
const { formToObject } = await import("../src/server/cms/form.ts");
const { createItem } = await import("../src/server/cms/engine.ts");
const { machineSpec, serviceSpec } = await import("../src/server/cms/kinds.ts");
const { createPage } = await import("../src/server/cms/pages.ts");
const { loadOrder, moveItem } = await import("../src/server/cms/ordering.ts");
const { initializeLayout, saveLayout } = await import("../src/server/builder/sections.ts");
const { readOwner, readSections } = await import("../src/server/builder/store.ts");

const { about } = await import("../src/content/about.ts");
const { company } = await import("../src/content/company.ts");
const { metrics, capabilityStatements } = await import("../src/content/metrics.ts");
const { pillars } = await import("../src/content/pillars.ts");
const { services } = await import("../src/content/services.ts");
const { legalChrome, privacyPolicy } = await import("../src/content/legal.ts");
const { contactPage } = await import("../src/content/contact.ts");
const { home } = await import("../src/content/home.ts");
const { machines } = await import("../src/content/machines.ts");
const { getDictionary } = await import("../src/i18n/dictionaries.ts");
const { serviceDetails } = await import("../src/content/service-details.ts");
const { industriesPage, servicePage } = await import("../src/content/pages.ts");

const LOCALES = ["en", "ar"];
const pool = createAppPool({ ...readDbConfig(), poolLimit: 2 });
const deps = createAuthDeps(pool);
const db = dbFor(pool);

/** A form as the browser sends it (repeated names for lists). */
function formOf(fields) {
  const entries = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) entries.push([name, v]);
  }
  return formToObject(entries);
}

function expectOk(result, what) {
  if (result.kind !== "ok") throw new Error(`seed-parity: ${what} was not stored: ${JSON.stringify(result).slice(0, 800)}`);
  return result;
}

/** One value per language, as the builder stores texts: { en: f(en), ar: f(ar) }. */
const both = (f) => Object.fromEntries(LOCALES.map((l) => [l, f(l)]));

/** An Owner for this seed alone (a full session, created directly, as the integration tests do). */
async function owner() {
  const now = deps.clock();
  const id = ulid(now.getTime());
  const email = `parity.owner.${id.slice(-6).toLowerCase()}@example.test`;
  await db.insert(users).values({
    id,
    email,
    emailNormalized: email,
    displayName: "Test parity owner",
    status: "active",
    passwordHash: await deps.hasher.hash(randomBytes(24).toString("hex")),
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(userRoles).values({ userId: id, roleKey: "owner", grantedAt: now });
  const [user] = await db.select().from(users).where(eq(users.id, id));
  const { session } = await createSession(db, { userId: id, now, ip: "203.0.113.5", userAgent: "parity-seed", mfaVerified: true });
  return { user, roles: ["owner"], permissions: permissionsOf(["owner"]), rank: rankOf(["owner"]), session };
}

const actor = await owner();
const meta = () => ({ requestId: ulid(), ip: "203.0.113.5", userAgent: "parity-seed" });
const ctx = () => ({ deps, actor, meta: meta() });

/** An approved release photo's media id, by its media key ("about/workshop"); null when it is not approved. */
async function approved(key) {
  const [row] = await rowsOf(db, sql`SELECT id FROM media_assets WHERE legacy_key = ${key} AND usage_status = 'approved' AND deleted_at IS NULL`);
  return row ? String(row.id) : null;
}

/** A photo the compared parts show: it must be an approved release item. */
async function media(key) {
  const id = await approved(key);
  if (!id) throw new Error(`seed-parity: the approved release photo ${key} is not in the library (run the release import first).`);
  return id;
}

// --- The six services, as A3 records, first in the collection's order ---------------------------------------------------

async function serviceRecord(s, position) {
  const [found] = await rowsOf(db, sql`SELECT id FROM services WHERE slug = ${s.slug} AND deleted_at IS NULL`);
  if (found) return String(found.id);
  // A held-back photo (the Laser Engraving ones: restricted, never approved) leaves its slot empty, as the site never
  // shows it (decision D6); none of the compared parts shows a service photo.
  const cover = await approved(s.cover);
  const supporting = await approved(s.supporting.media);
  const fields = {
    slug: s.slug,
    serviceGroup: s.slug === "scaffolding" ? "scaffolding" : "metal",
    iconKey: s.slug,
    "media.coverMediaId": cover,
    "media.supportingMediaId": supporting,
    // The compared service page (Laser Engraving) shows its related services: the record lists them, as today.
    ...(s.slug === "laser-engraving" ? { "rel.relatedServices": serviceDetails[s.slug].related.map((slug) => serviceIds[slug]) } : {}),
  };
  for (const l of LOCALES) {
    Object.assign(fields, {
      [`${l}.name`]: s.name[l],
      [`${l}.tagline`]: s.tagline[l],
      [`${l}.summary`]: s.summary[l],
      [`${l}.body`]: s.body[l].join("\n\n"),
      [`${l}.highlights`]: s.highlights[l].join("\n"),
      ...(cover ? { [`${l}.coverAltMode`]: "text", [`${l}.coverAlt`]: s.coverAlt[l] } : {}),
      ...(supporting ? { [`${l}.supportingAltMode`]: "text", [`${l}.supportingAlt`]: s.supporting.alt[l] } : {}),
    });
  }
  return expectOk(await createItem(ctx(), serviceSpec, formOf(fields)), `service ${s.slug} (${position})`).id;
}

const serviceIds = {};
for (const [i, s] of services.entries()) serviceIds[s.slug] = await serviceRecord(s, i);
// Today's numbers ("01" … "06") are the services' places in the collection's order: the six come first.
for (const [i, s] of services.entries()) {
  for (;;) {
    const order = await loadOrder(db, "service");
    const at = order.rows.findIndex((r) => r.id === serviceIds[s.slug]);
    if (at <= i) break;
    expectOk(await moveItem(ctx(), "service", serviceIds[s.slug], "up", order.lockVersion), `moving ${s.slug}`);
  }
}

// --- The six machines, as A3 records, first in the collection's order (the homepage showcase's order) -------------------

const SHOWCASE_ORDER = ["fiber-laser-combo-12kw", "tube-cutting-12kw", "fiber-laser-6kw", "fiber-laser-3kw", "cnc-press-brake", "laser-welding"];

async function machineRecord(m) {
  const [found] = await rowsOf(db, sql`SELECT id FROM machines WHERE slug = ${m.slug} AND deleted_at IS NULL`);
  if (found) return String(found.id);
  const fields = { slug: m.slug, powerWatts: m.powerWatts ? String(m.powerWatts) : "", primaryServiceId: serviceIds[m.service], "media.mediaId": await media(m.media) };
  for (const l of LOCALES) {
    Object.assign(fields, { [`${l}.name`]: m.name[l], [`${l}.shortName`]: m.shortName[l], [`${l}.category`]: m.category[l], [`${l}.capability`]: m.capability[l] });
  }
  return expectOk(await createItem(ctx(), machineSpec, formOf(fields)), `machine ${m.slug}`).id;
}

const machineIds = {};
for (const slug of SHOWCASE_ORDER) machineIds[slug] = await machineRecord(machines.find((m) => m.slug === slug));
for (const [i, slug] of SHOWCASE_ORDER.entries()) {
  for (;;) {
    const order = await loadOrder(db, "machine");
    const at = order.rows.findIndex((r) => r.id === machineIds[slug]);
    if (at <= i) break;
    expectOk(await moveItem(ctx(), "machine", machineIds[slug], "up", order.lockVersion), `moving ${slug}`);
  }
}

// --- Pages and their layouts ------------------------------------------------------------------------------------------

async function systemPage(key, extra = {}) {
  const [found] = await rowsOf(db, sql`SELECT id FROM pages WHERE system_key = ${key}`);
  if (found) return String(found.id);
  return expectOk(await createPage(ctx(), { kind: "system", key }, formOf({ "en.title": `Test ${key} page`, ...extra })), `page ${key}`).id;
}

const ALL = { desktop: true, tablet: true, mobile: true };

/**
 * Sets up a page's layout (when it has none) and saves it with the given data: `plan` lists the block types in the
 * page's order, each with its data (shown), `undefined` (shown, its data left as it is) or `null` (hidden). Blocks of the layout not in the plan are
 * hidden; `extra` adds sections of a block (legal sections), reusing the layout's own ones first.
 */
async function layOut(pageId, plan, type = "page") {
  const ref = { type, id: pageId };
  let version = (await readOwner(db, ref, { lock: false })).lockVersion;
  if (!(await readSections(db, ref, { lock: false })).length) {
    expectOk(await initializeLayout(ctx(), ref, version), `setting up ${pageId}`);
    version = (await readOwner(db, ref, { lock: false })).lockVersion;
  }
  const stored = await readSections(db, ref, { lock: false });
  const unused = [...stored];
  const entries = [];
  let fresh = 0;
  for (const step of plan) {
    const at = unused.findIndex((s) => s.blockType === step.block);
    const existing = at >= 0 ? unused.splice(at, 1)[0] : null;
    const entry = existing
      ? { ref: existing.id, visible: step.data !== null, devices: ALL, anchor: step.anchor ?? existing.anchor }
      : { ref: `new:${++fresh}`, blockType: step.block, visible: true, devices: ALL, anchor: step.anchor ?? null };
    if (step.data) entry.data = { ...step.data, complete: { en: true, ar: true }, otherUnaffected: false };
    entries.push(entry);
  }
  // Whatever else the layout holds stays, hidden (a page's required parts can't be removed).
  for (const s of unused) entries.push({ ref: s.id, visible: false, devices: ALL, anchor: s.anchor });
  expectOk(await saveLayout(ctx(), { owner: ref, expectedVersion: version, sections: entries }), `the layout of ${pageId}`);
}

/** Items of a repeater: settings [{ id, ...settings }] and texts { en: { id: {...} }, ar: … }. */
function repeater(list, id, settingsOf, textsOf) {
  return {
    settings: list.map((x, i) => ({ id: id(x, i), ...(settingsOf ? settingsOf(x) : {}) })),
    texts: both((l) => Object.fromEntries(list.map((x, i) => [id(x, i), textsOf(x, l)]))),
  };
}

/** Section data from its settings and its texts per language. */
const data = (settings, texts) => ({ settings, content: both(texts) });
const head = (part, l) => ({ label: part.label[l], title: part.title[l], intro: part.intro[l] });
const system = (key, anchor) => ({ type: "system", key, ...(anchor ? { anchor } : {}) });

// About ------------------------------------------------------------------------------------------------------------------

const aboutId = await systemPage("about");
{
  const facts = repeater(about.hero.meta, (_, i) => `fact-${i + 1}`, null, (m, l) => ({ label: m.label[l], value: m.value[l] }));
  const divisions = repeater(about.what.divisions, (d) => d.slug, null, (d, l) => ({ label: d.label[l], title: d.title[l], body: d.body[l], link: d.link[l] }));
  const beyondItems = repeater(about.beyond.items, (i) => i.slug, null, (i, l) => ({ label: i.label[l] }));
  const figures = repeater(metrics, (m) => m.slug, (m) => ({ value: m.display.en }), (m, l) => ({ label: m.label[l], unit: m.unit?.[l] ?? "" }));
  const statementId = (s) => s.title.en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const statements = repeater(capabilityStatements, statementId, null, (s, l) => ({ title: s.title[l], body: s.body[l] }));
  const steps = repeater(about.process.steps, (s) => s.slug, null, (s, l) => ({ title: s.title[l], body: s.body[l] }));
  const why = repeater(pillars, (p) => p.slug, null, (p, l) => ({ title: p.title[l], body: p.body[l] }));
  const photoIds = await Promise.all(about.workshop.photos.map((p) => media(p.media)));
  const photos = repeater(
    about.workshop.photos.map((p, i) => ({ ...p, mediaId: photoIds[i] })),
    (_, i) => `photo-${i + 1}`,
    (p) => ({ media: p.mediaId }),
    (p, l) => ({ caption: p.caption[l] }),
  );
  const cta = repeater(about.cta.links, (_, i) => `link-${i + 1}`, (x) => ({ target: system(x.route, x.hash) }), (x, l) => ({ label: x.label[l], description: x.description?.[l] ?? "" }));
  const metal = services.filter((s) => s.slug !== "scaffolding").map((s) => serviceIds[s.slug]);

  await layOut(aboutId, [
    {
      block: "page.hero",
      data: data({ variant: "about", facts: facts.settings, media: await media(about.hero.media) }, (l) => ({
        eyebrow: about.hero.eyebrow[l],
        title: about.hero.title[l],
        intro: about.hero.intro[l],
        photoAlt: about.hero.mediaAlt[l],
        caption: about.hero.caption[l],
        nameplate: about.hero.nameplate[l],
        facts: facts.texts[l],
      })),
    },
    { block: "about.overview", data: data({}, (l) => ({ label: about.overview.label[l], title: about.overview.title[l], paragraphs: about.overview.paragraphs[l] })) },
    { block: "about.what", data: data({ divisions: divisions.settings }, (l) => ({ ...head(about.what, l), divisions: divisions.texts[l] })) },
    { block: "about.metal", data: data({ services: { mode: "manual", ids: metal } }, (l) => ({ ...head(about.metal, l), explore: about.metal.explore[l] })) },
    {
      block: "about.beyond",
      data: data({ media: await media(about.beyond.media), target: { type: "service", id: serviceIds.scaffolding }, items: beyondItems.settings }, (l) => ({
        ...head(about.beyond, l),
        photoAlt: about.beyond.mediaAlt[l],
        link: about.beyond.link[l],
        items: beyondItems.texts[l],
      })),
    },
    {
      block: "about.vision",
      data: data({}, (l) => ({ label: about.vision.label[l], statement: company.vision.statement[l], aimsLabel: about.vision.aimsLabel[l], aims: company.vision.aims[l], closing: company.vision.closing[l] })),
    },
    { block: "about.approach", data: data({ figures: figures.settings, statements: statements.settings }, (l) => ({ ...head(about.approach, l), figures: figures.texts[l], statements: statements.texts[l] })) },
    { block: "about.process", data: data({ steps: steps.settings }, (l) => ({ ...head(about.process, l), steps: steps.texts[l] })) },
    { block: "about.why", data: data({ pillars: why.settings }, (l) => ({ ...head(about.why, l), pillars: why.texts[l] })) },
    { block: "about.workshop", data: data({ photos: photos.settings }, (l) => ({ ...head(about.workshop, l), photos: photos.texts[l] })) },
    {
      block: "about.machinery",
      // The register lists the machines in the profile's order (machines.ts), not the showcase's.
      data: data({ machines: { mode: "manual", ids: machines.map((m) => machineIds[m.slug]) } }, (l) => ({
        ...head(about.machinery, l),
        link: about.machinery.link[l],
        machine: about.machinery.machine[l],
        type: about.machinery.type[l],
        power: about.machinery.power[l],
        notStated: about.machinery.notStated[l],
      })),
    },
    { block: "about.work", data: null },
    { block: "about.clients", data: null },
    { block: "about.compliance", data: null },
    { block: "page.closing_cta", data: data({ numbered: true, links: cta.settings }, (l) => ({ label: about.cta.label[l], title: about.cta.title[l], body: about.cta.body?.[l] ?? "", links: cta.texts[l] })) },
  ]);
}

// Contact ----------------------------------------------------------------------------------------------------------------

const contactId = await systemPage("contact");
{
  const { methods, form, location, actions } = contactPage;
  await layOut(contactId, [
    {
      block: "page.hero",
      data: data({ variant: "contact" }, (l) => ({
        eyebrow: contactPage.hero.eyebrow[l],
        title: contactPage.hero.title[l],
        intro: contactPage.hero.intro[l],
        quote: actions.quote[l],
        findUs: actions.findUs[l],
        methodsLabel: methods.label[l],
        phoneLabel: methods.phone[l],
        call: actions.call[l],
        whatsappLabel: methods.whatsapp[l],
        chat: methods.chat[l],
        emailLabel: methods.email[l],
        send: methods.send[l],
        addressLabel: methods.address[l],
        viewMap: methods.viewMap[l],
      })),
    },
    {
      block: "contact.quote",
      data: data({}, (l) => ({ label: form.label[l], title: form.title[l], intro: form.intro[l], stepsLabel: methods.stepsLabel[l], steps: form.steps[l], status: form.status[l] })),
    },
    {
      block: "contact.location",
      data: data({}, (l) => ({
        label: location.label[l],
        title: location.title[l],
        intro: location.intro[l],
        addressLabel: methods.address[l],
        nameLabel: methods.name[l],
        contactLabel: location.contact[l],
        mapTitle: location.mapTitle[l],
        mapCaption: location.mapCaption[l],
        directions: location.directions[l],
        openMap: location.openMap[l],
        call: actions.call[l],
        phoneLabel: methods.phone[l],
        send: methods.send[l],
        emailLabel: methods.email[l],
      })),
    },
  ]);
}

// Privacy ----------------------------------------------------------------------------------------------------------------

const privacyId = await systemPage("privacy", { effectiveDate: privacyPolicy.updated });
// A record made earlier (by another spec) may hold another date: the page's date is the static document's here.
await pool.query("UPDATE pages SET effective_date = ? WHERE id = ?", [privacyPolicy.updated, privacyId]);
{
  /** A legal text block as the builder's rich document: paragraphs and bulleted lists of plain text. */
  const doc = (blocks) => ({
    type: "doc",
    content: blocks.map((b) =>
      typeof b === "string"
        ? { type: "paragraph", content: [{ type: "text", text: b }] }
        : { type: "bullet_list", content: b.list.map((item) => ({ type: "list_item", content: [{ type: "text", text: item }] })) },
    ),
  });
  await layOut(privacyId, [
    {
      block: "page.hero",
      data: data({ variant: "legal" }, (l) => ({
        eyebrow: privacyPolicy.hero.eyebrow[l],
        title: privacyPolicy.hero.title[l],
        intro: privacyPolicy.hero.intro[l],
        updatedLabel: legalChrome.updated[l],
        appliesTo: legalChrome.appliesTo[l],
        appliesToValue: legalChrome.appliesToValue[l],
      })),
    },
    {
      block: "legal.contents",
      data: data({}, (l) => ({
        onThisPage: legalChrome.onThisPage[l],
        pending: legalChrome.pending[l],
        email: legalChrome.contactLabels.email[l],
        phone: legalChrome.contactLabels.phone[l],
        address: legalChrome.contactLabels.address[l],
      })),
    },
    ...privacyPolicy.sections.map((s) => ({
      block: "legal.section",
      anchor: s.id,
      data: data({ contact: s.contact === true }, (l) => ({ title: s.title[l], body: doc(s.body[l]), pendingNote: s.pending?.[l] ?? "" })),
    })),
  ]);
}

// Homepage ---------------------------------------------------------------------------------------------------------------

const homeId = await systemPage("home");
{
  // The plate's two figures (peak laser power, service lines) and the hero's statements, as today's view gives them.
  const figure = (slugs) =>
    repeater(
      slugs.map((slug) => metrics.find((m) => m.slug === slug)),
      (m) => m.slug,
      (m) => ({ value: m.value !== undefined ? m.value.toLocaleString("en-US") : m.display.en }),
      (m, l) => ({ label: m.label[l], unit: m.unit?.[l] ?? "" }),
    );
  const figures = figure(["peak-laser-power", "service-lines"]);
  const specs = figure(["peak-laser-power", "bevel-cutting"]);
  const statementId = (s) => s.title.en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const statements = repeater(capabilityStatements, statementId, null, (s, l) => ({ title: s.title[l] }));
  const beyond = repeater(about.beyond.items, (i) => i.slug, null, (i, l) => ({ label: i.label[l] }));
  const why = repeater(pillars, (p) => p.slug, null, (p, l) => ({ title: p.title[l], body: p.body[l] }));
  const laser = services[0];
  await layOut(homeId, [
    {
      block: "home.hero",
      data: data({ media: await media("site/laser-sparks"), figures: figures.settings, statements: statements.settings }, (l) => ({
        eyebrow: home.hero.eyebrow[l],
        location: home.hero.location[l],
        headline: home.hero.headline[l],
        sub: home.hero.sub[l],
        primary: home.hero.secondaryCta[l],
        secondary: home.hero.primaryCta[l],
        photoAlt: laser.coverAlt[l],
        platePart: home.hero.plate.part[l],
        plateSequence: home.hero.plate.sequence[l],
        figures: figures.texts[l],
        statements: statements.texts[l],
      })),
    },
    { block: "home.capability_strip", data: data({ services: { mode: "automatic", source: "all", limit: 6 } }, (l) => ({ label: home.services.label[l] })) },
    {
      block: "home.about",
      data: data(
        { media: await media("services/fabrication-workshop"), beyondTarget: { type: "service", id: serviceIds.scaffolding }, beyond: beyond.settings, pillars: why.settings },
        (l) => ({
          label: home.intro.label[l],
          statement: home.intro.statement[l],
          paragraph: home.intro.paragraphs[l][0],
          link: home.intro.link[l],
          servicesLink: home.intro.servicesLink[l],
          workshopCaption: home.intro.workshopCaption[l],
          visionLabel: home.intro.visionLabel[l],
          vision: company.vision.statement[l],
          location: home.hero.location[l],
          beyondLabel: about.beyond.label[l],
          beyondTitle: about.beyond.title[l],
          beyondLink: about.beyond.link[l],
          whyLabel: home.why.label[l],
          beyond: beyond.texts[l],
          pillars: why.texts[l],
        }),
      ),
    },
    {
      block: "home.services",
      data: data({ services: { mode: "automatic", source: "all", limit: 6 }, specs: specs.settings }, (l) => ({
        label: home.services.label[l],
        title: home.services.title[l],
        intro: home.services.intro[l],
        open: home.services.open[l],
        all: home.services.all[l],
        specs: specs.texts[l],
      })),
    },
    {
      block: "home.machinery",
      data: data({ machines: { mode: "automatic", source: "all", limit: 6 } }, (l) => ({
        label: home.machinery.label[l],
        title: home.machinery.title[l],
        intro: home.machinery.intro[l],
        power: home.machinery.power[l],
        service: home.machinery.service[l],
        all: home.machinery.all[l],
        quote: getDictionary(l).controls.requestQuote,
      })),
    },
    { block: "home.projects", data: null },
    { block: "home.industries", data: null },
    { block: "home.clients", data: null },
    { block: "home.compliance", data: null },
    {
      block: "home.contact",
      data: data({ media: await media("site/riyadh-night") }, (l) => ({ label: home.cta.label[l], title: home.cta.title[l], steps: home.cta.steps[l], whatsapp: home.cta.whatsapp[l] })),
    },
  ]);
}

// Laser Engraving's page (a service's own layout): no machines, sectors, gallery or projects, as today (its drawings only).
{
  const slug = "laser-engraving";
  const detail = serviceDetails[slug];
  const labels = servicePage;
  const look = { scope: "materials", process: "rail", rail: "fine", icons: { materials: "laser-engraving", lasting: "shield", detail: "precision" } };
  const icon = (slug, fallback) => look.icons[slug] ?? fallback;
  const facts = repeater(detail.meta, (_, i) => `fact-${i + 1}`, null, (m, l) => ({ label: m.label[l], value: m.value[l] }));
  const scope = repeater(detail.scope.items, (p) => p.slug, (p) => ({ icon: icon(p.slug, "precision") }), (p, l) => ({ title: p.title[l], body: p.body?.[l] ?? "", caption: "" }));
  const steps = repeater(detail.process.steps, (p) => p.slug, (p) => ({ icon: icon(p.slug, "layers") }), (p, l) => ({ title: p.title[l], body: p.body?.[l] ?? "" }));
  const points = repeater(detail.why.points, (p) => p.slug, (p) => ({ icon: icon(p.slug, "precision") }), (p, l) => ({ title: p.title[l], body: p.body?.[l] ?? "" }));
  await layOut(
    serviceIds[slug],
    [
      {
        block: "service.hero",
        data: data({ visual: "plate", tone: "brass", facts: facts.settings }, (l) => ({
          section: labels.sections[detail.section][l],
          serviceLabel: labels.service[l],
          quote: labels.quote[l],
          seeWork: labels.seeWork[l],
          facts: facts.texts[l],
        })),
      },
      { block: "service.overview", data: data({}, (l) => ({ label: labels.labels.overview[l], title: detail.overview.title[l], includesLabel: labels.includes[l], caption: "" })) },
      {
        block: "service.scope",
        data: data({ layout: look.scope, items: scope.settings, figures: [] }, (l) => ({ label: labels.labels.scope[l], title: detail.scope.title[l], intro: detail.scope.intro[l], items: scope.texts[l], figures: {} })),
      },
      {
        block: "service.process",
        data: data({ layout: look.process, rail: look.rail, steps: steps.settings }, (l) => ({
          label: labels.labels.process[l],
          title: detail.process.title[l],
          intro: detail.process.intro[l],
          note: labels.processNote[l],
          steps: steps.texts[l],
        })),
      },
      { block: "service.machines", data: null },
      {
        block: "service.applications",
        data: data({}, (l) => ({
          label: labels.labels.applications[l],
          title: detail.applications.title[l],
          intro: detail.applications.intro[l],
          uses: (detail.applications.uses ?? []).map((u) => u[l]),
          sectorsLabel: labels.applications.sectors[l],
          usesLabel: labels.applications.uses[l],
          workLabel: labels.applications.work[l],
          linkLabel: labels.applications.link[l],
          basisProfile: industriesPage.basis.profile[l],
          basisInferred: industriesPage.basis.inferred[l],
        })),
      },
      // The opening links to the gallery and the projects (when they show): they stay on, and show nothing here, as today.
      { block: "service.gallery", data: undefined },
      { block: "service.why", data: data({ points: points.settings }, (l) => ({ label: labels.labels.why[l], title: detail.why.title[l], points: points.texts[l] })) },
      {
        block: "service.related",
        data: data({}, (l) => ({ label: labels.labels.related[l], title: labels.relatedTitle[l], allServices: labels.allServices[l], explore: labels.explore[l] })),
      },
      { block: "service.projects", data: undefined },
      {
        block: "service.cta",
        data: data({}, (l) => ({
          label: detail.cta.label[l],
          title: detail.cta.title[l],
          body: detail.cta.body[l],
          quote: labels.quote[l],
          call: labels.cta.call[l],
          or: labels.cta.or[l],
          services: labels.cta.services[l],
          projects: labels.cta.projects[l],
        })),
      },
    ],
    "service",
  );
}

console.log(JSON.stringify({ about: aboutId, contact: contactId, privacy: privacyId, home: homeId, engraving: serviceIds["laser-engraving"], services: serviceIds, machines: machineIds }));
await pool.end();
