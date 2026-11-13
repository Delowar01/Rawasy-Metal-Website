/**
 * A9.2 — the approved pages as A5 page-builder layouts, and back (A1-MIGRATION-PLAN §6, A1-CONTENT-MODEL §5.3). One
 * declarative map per owner says, for every bespoke block of its layout, which value of the static content layer each
 * field holds. The importer encodes today's copy with it (`planLayouts`), the database read model decodes a published
 * layout with the same map (`decodeLayouts`), so the two directions cannot drift; `tests/unit/migration-layouts.test.ts`
 * proves decode(encode(static)) equals the static content and lists every value the CMS does not hold.
 *
 * Rules the map keeps:
 * - A value shown in several places (the pillars, the capability statements, the site-support items, a service page's
 *   shared labels) is decoded from one block only, its canonical place; the other blocks carry a read-only copy, so the
 *   page builder shows it there too (`ro`).
 * - Values the approved components take from code (a service's look and colour role, the homepage's project order, the
 *   collage, the industry strip, the profile's figures) are written into the block settings for the preview and never read
 *   back: the public pages keep them in code (the reconciliation report lists them).
 * - Company facts, the site name and the interface text are the A6 settings' (decoded there), never a block's.
 * - Media are written as library ids and read back as release keys (`DecodeRefs.mediaKey`).
 */
import type { ContentSet } from "../../content/static-set.ts";
import type { MediaId } from "../../content/media.generated.ts";
import type { EntityType } from "../cms/registry.ts";
import { serviceLooks } from "../../components/commerce/services/looks.ts";
import { serviceTone } from "../../components/commerce/tones.ts";
import { COMPOSITION_RECORDS } from "../publishing/composition.ts";

export type Loc = "en" | "ar";
export const LOCALES: readonly Loc[] = ["en", "ar"];
type Rec = Record<string, unknown>;
// The content set is addressed by paths; its static types are checked where the decoded set is used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** How the encoder names media and records. */
export interface EncodeRefs {
  media(key: MediaId): string | null;
  id(type: EntityType, slug: string): string;
  leftOut(owner: string, key: MediaId, why: string): void;
}

/** How the decoder names them back. */
export interface DecodeRefs {
  /** A library id as the static key the components take (a release file's MediaId, or the id of an uploaded item). */
  mediaKey(id: unknown): string | null;
  slugOf(type: EntityType, id: unknown): string | null;
}

/** One section as the importer saves it. */
export interface SectionPlan {
  block: string;
  anchor: string | null;
  visible: boolean;
  settings: Rec;
  content: Record<Loc, Rec>;
}

/** One section as the public projection holds it (visible sections only). */
export interface PublishedSection {
  id?: unknown;
  blockType: string;
  anchor: string | null;
  settings: Rec | null;
  content: Partial<Record<Loc, Rec | null>> | null;
}

/** The layouts' owners: the A3 page's system key, or a service's slug. */
export type OwnerKey = { page: string } | { service: string };
export const ownerName = (o: OwnerKey) => ("page" in o ? `page ${o.page}` : `service ${o.service}`);

// --- Paths ---------------------------------------------------------------------------------------------------------------

const at = (o: Any, path: string): Any => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function setAt(o: Any, path: string, v: unknown) {
  const keys = path.split(".");
  let x = o;
  for (const k of keys.slice(0, -1)) x = x[k] ??= {};
  x[keys[keys.length - 1]] = v;
}
function deleteAt(o: Any, path: string) {
  const keys = path.split(".");
  const parent = at(o, keys.slice(0, -1).join("."));
  if (parent && typeof parent === "object") delete parent[keys[keys.length - 1]];
}

/** A localized value: read from the set, written back (unless read-only). */
interface Acc {
  get(s: Any): Any;
  put?(s: Any, v: Record<Loc, unknown>): void;
}

const p = (path: string): Acc => ({ get: (s) => at(s, path), put: (s, v) => setAt(s, path, v) });
const ro = (a: Acc | string): Acc => ({ get: (typeof a === "string" ? p(a) : a).get });
/** One entry of a localized list (`paragraphs.en[0]`). */
const nth = (path: string, i: number): Acc => ({
  get: (s) => ({ en: at(s, path)?.en?.[i], ar: at(s, path)?.ar?.[i] }),
  put: (s, v) => {
    for (const l of LOCALES) at(s, path)[l][i] = v[l];
  },
});
/** A value the block takes from a dictionary (the A6 interface text owns it). */
const dict = (key: string): Acc => ({ get: (s) => ({ en: at(s.dictionaries.en, key), ar: at(s.dictionaries.ar, key) }) });
/** A localized list of localized values (`uses: [{ en, ar }]`) as one lines field per language. */
const pairs = (path: string): Acc => ({
  get: (s) => ({ en: (at(s, path) ?? []).map((u: Any) => u.en), ar: (at(s, path) ?? []).map((u: Any) => u.ar) }),
  put: (s, v) => {
    const en = (v.en as string[]) ?? [];
    const ar = (v.ar as string[]) ?? [];
    if (!en.length && !ar.length && at(s, path) === undefined) return;
    setAt(
      s,
      path,
      en.map((e, i) => ({ en: e, ar: ar[i] ?? "" })),
    );
  },
});

// --- Block maps ----------------------------------------------------------------------------------------------------------

/** A setting of an item: written from the static element, and (unless encode-only) read back into it. */
interface ElemSetting {
  enc(x: Any, r: EncodeRefs, owner: string): unknown;
  dec?(el: Any, v: unknown, d: DecodeRefs): void;
}

interface ItemsMap {
  list: Acc;
  id: (x: Any, i: number) => string;
  texts: Record<string, string>;
  settings?: Record<string, ElemSetting>;
  /** A new element (an item added in the builder): its fixed fields. */
  make?: (id: string) => Rec;
  /** How a decoded item finds its static element: by id (default) or by position. */
  base?: "id" | "index";
}

interface BlockMap {
  block: string;
  anchor?: string | null;
  /** Today's page shows the section (default yes); a hidden one is imported hidden. */
  shown?: (s: Any) => boolean;
  /** The section's presence is the content: decoding a layout without it removes this path. */
  optional?: string;
  texts?: Record<string, Acc>;
  settings?: (s: Any, r: EncodeRefs, owner: string) => Rec;
  decodeSettings?: (out: Any, settings: Rec, d: DecodeRefs) => void;
  items?: Record<string, ItemsMap & { ro?: boolean }>;
}

const head = (prefix: string, keys: readonly string[] = ["label", "title", "intro"]): Record<string, Acc> =>
  Object.fromEntries(keys.map((k) => [k, p(`${prefix}.${k}`)]));
const roHead = (prefix: string, keys: readonly string[]): Record<string, Acc> => Object.fromEntries(keys.map((k) => [k, ro(`${prefix}.${k}`)]));
const texts = (pairsOf: Record<string, string>): Record<string, Acc> => Object.fromEntries(Object.entries(pairsOf).map(([k, path]) => [k, p(path)]));

const media = (path: string): ElemSetting => ({
  enc: (x, r, owner) => mediaId(r, owner, at(x, path)),
  dec: (el, v, d) => {
    const key = d.mediaKey(v);
    if (key) setAt(el, path, key);
    // No deliverable item: the photo is absent (a captioned photo goes with its caption).
    else deleteAt(el, path.includes(".") ? path.split(".")[0] : path);
  },
});
const valueOf = (f: (x: Any) => unknown): ElemSetting => ({ enc: (x) => f(x) });

function mediaId(r: EncodeRefs, owner: string, key: MediaId | undefined | null): string | null {
  if (!key) return null;
  const id = r.media(key);
  if (!id) r.leftOut(owner, key, "not delivered by the media library (restricted or missing)");
  return id;
}

const bySlug = (x: Any) => String(x.slug);
const byIndex = (prefix: string) => (_: Any, i: number) => `${prefix}-${i + 1}`;
const statementId = (x: Any) =>
  String(x.title.en)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const target: ElemSetting = {
  enc: (x) => ({ type: "system", key: x.route, ...(x.hash ? { anchor: x.hash } : {}) }),
  dec: (el, v) => {
    const t = v as { key?: unknown; anchor?: unknown } | null;
    el.route = t?.key ?? el.route;
    if (typeof t?.anchor === "string" && t.anchor) el.hash = t.anchor;
    else delete el.hash;
  },
};

/** The closing call to action of an inner page (`<prefix>.cta`). */
const closing = (prefix: string, numbered = true): BlockMap => ({
  block: "page.closing_cta",
  texts: { label: p(`${prefix}.cta.label`), title: p(`${prefix}.cta.title`), body: p(`${prefix}.cta.body`) },
  settings: () => ({ numbered }),
  items: { links: { list: p(`${prefix}.cta.links`), id: byIndex("link"), base: "index", texts: { label: "label", description: "description" }, settings: { target } } },
});

const facts = (path: string): ItemsMap => ({ list: p(path), id: byIndex("fact"), base: "index", texts: { label: "label", value: "value" } });
const manual = (type: EntityType, slugs: readonly string[], r: EncodeRefs) => ({ mode: "manual", ids: slugs.map((slug) => r.id(type, slug)) });
const auto = (source: "all" | "featured", limit: number) => ({ mode: "automatic", source, limit });
/** A manual selection the approved page reads (slugs in the page's copy). */
const slugsBack = (type: EntityType, key: string, path: string, single = false) => (out: Any, settings: Rec, d: DecodeRefs) => {
  const ids = ((settings[key] as { ids?: unknown[] } | undefined)?.ids ?? []).map((id) => d.slugOf(type, id)).filter((s): s is string => Boolean(s));
  setAt(out, path, single ? (ids[0] ?? at(out, path)) : ids);
};

// The approved page's own choices in code (A1: "the same data"; the public page keeps them in its component).
const HOME_PROJECTS = ["tulip-roundabout-sculpture", "clock-tower-landmark", "geometric-lanterns", "wave-form-sculpture", "suspended-lantern", "palm-leaf-shade-canopies"];
const PROJECTS_COLLAGE = COMPOSITION_RECORDS.project;
const INDUSTRIES_STRIP = COMPOSITION_RECORDS.industry;
const METRICS = (slugs: readonly string[]): ItemsMap => ({
  list: { get: (s) => slugs.map((slug) => s.metrics.find((m: Any) => m.slug === slug)) },
  id: bySlug,
  texts: { label: "label", unit: "unit" },
  settings: { value: valueOf((m) => (m.value !== undefined ? m.value.toLocaleString("en-US") : m.display.en)) },
});

// --- The homepage ----------------------------------------------------------------------------------------------------------

const HOME: BlockMap[] = [
  {
    block: "home.hero",
    texts: {
      ...texts({ eyebrow: "home.hero.eyebrow", location: "home.hero.location", headline: "home.hero.headline", sub: "home.hero.sub", primary: "home.hero.secondaryCta", secondary: "home.hero.primaryCta", platePart: "home.hero.plate.part", plateSequence: "home.hero.plate.sequence" }),
      photoAlt: ro({ get: (s) => s.services[0].coverAlt }),
    },
    settings: (s, r, o) => ({ media: mediaId(r, o, "site/laser-sparks" as MediaId) }),
    items: {
      figures: { ...METRICS(["peak-laser-power", "service-lines"]), ro: true },
      statements: { list: p("capabilityStatements"), id: statementId, texts: { title: "title" }, ro: true },
    },
  },
  { block: "home.capability_strip", texts: { label: ro("home.services.label") }, settings: () => ({ services: auto("all", 6) }) },
  {
    block: "home.about",
    texts: {
      ...head("home.intro", ["label", "statement", "link", "servicesLink", "workshopCaption", "visionLabel"]),
      paragraph: nth("home.intro.paragraphs", 0),
      vision: ro("company.vision.statement"),
      location: ro("home.hero.location"),
      beyondLabel: ro("about.beyond.label"),
      beyondTitle: ro("about.beyond.title"),
      beyondLink: ro("about.beyond.link"),
      whyLabel: p("home.why.label"),
    },
    settings: (s, r, o) => ({ media: mediaId(r, o, "services/fabrication-workshop" as MediaId), beyondTarget: { type: "service", id: r.id("service", "scaffolding") } }),
    items: {
      beyond: { list: p("about.beyond.items"), id: bySlug, texts: { label: "label" }, ro: true },
      pillars: { list: p("pillars"), id: bySlug, texts: { title: "title", body: "body" }, ro: true },
    },
  },
  {
    block: "home.services",
    texts: head("home.services", ["label", "title", "intro", "open", "all"]),
    settings: () => ({ services: auto("all", 6) }),
    items: { specs: { ...METRICS(["peak-laser-power", "bevel-cutting"]), ro: true } },
  },
  {
    block: "home.machinery",
    texts: { ...head("home.machinery", ["label", "title", "intro", "power", "service", "all"]), quote: dict("controls.requestQuote") },
    settings: () => ({ machines: auto("all", 6) }),
  },
  {
    block: "home.projects",
    texts: { ...head("home.projects", ["label", "title", "intro", "all"]), cta: p("home.projects.inGallery") },
    settings: (s, r) => ({ projects: manual("project", HOME_PROJECTS, r) }),
  },
  {
    block: "home.industries",
    texts: { ...head("home.industries", ["label", "title", "note", "all"]), basisProfile: ro("industriesPage.basis.profile"), basisInferred: ro("industriesPage.basis.inferred") },
    settings: () => ({ industries: auto("all", 8) }),
  },
  {
    block: "home.clients",
    texts: { ...head("home.clients", ["label", "title", "intro", "all"]), colours: ro("clientsPage.colours"), listLabel: ro("clientsPage.listLabel"), note: ro("clientsPage.note") },
    settings: () => ({ clients: auto("all", 40) }),
  },
  { block: "home.compliance", texts: head("home.certificates", ["label", "title", "note", "all"]), settings: () => ({ certificates: auto("all", 6) }) },
  { block: "home.contact", texts: head("home.cta", ["label", "title", "steps", "whatsapp"]), settings: (s, r, o) => ({ media: mediaId(r, o, "site/riyadh-night" as MediaId) }) },
];

// --- About -----------------------------------------------------------------------------------------------------------------

const ABOUT: BlockMap[] = [
  {
    block: "page.hero",
    texts: { ...head("about.hero", ["eyebrow", "title", "intro", "caption", "nameplate"]), photoAlt: p("about.hero.mediaAlt") },
    settings: (s, r, o) => ({ variant: "about", media: mediaId(r, o, s.about.hero.media) }),
    decodeSettings: (out, st, d) => setAt(out, "about.hero.media", d.mediaKey(st.media) ?? out.about.hero.media),
    items: { facts: facts("about.hero.meta") },
  },
  { block: "about.overview", texts: head("about.overview", ["label", "title", "paragraphs"]) },
  { block: "about.what", texts: head("about.what"), items: { divisions: { list: p("about.what.divisions"), id: bySlug, make: (slug) => ({ slug }), texts: { label: "label", title: "title", body: "body", link: "link" } } } },
  {
    block: "about.metal",
    texts: head("about.metal", ["label", "title", "intro", "explore"]),
    settings: (s, r) => ({ services: manual("service", s.services.filter((x: Any) => x.slug !== "scaffolding").map(bySlug), r) }),
  },
  {
    block: "about.beyond",
    texts: { ...head("about.beyond", ["label", "title", "intro", "link"]), photoAlt: p("about.beyond.mediaAlt") },
    settings: (s, r, o) => ({ media: mediaId(r, o, s.about.beyond.media), target: { type: "service", id: r.id("service", "scaffolding") } }),
    decodeSettings: (out, st, d) => setAt(out, "about.beyond.media", d.mediaKey(st.media) ?? out.about.beyond.media),
    items: { items: { list: p("about.beyond.items"), id: bySlug, make: (slug) => ({ slug }), texts: { label: "label" } } },
  },
  {
    block: "about.vision",
    texts: { label: p("about.vision.label"), aimsLabel: p("about.vision.aimsLabel"), statement: ro("company.vision.statement"), aims: ro("company.vision.aims"), closing: ro("company.vision.closing") },
  },
  {
    block: "about.approach",
    texts: head("about.approach"),
    items: {
      figures: { ...METRICS(["peak-laser-power", "laser-systems", "service-lines"]), ro: true },
      statements: { list: p("capabilityStatements"), id: statementId, base: "index", texts: { title: "title", body: "body" } },
    },
  },
  { block: "about.process", texts: head("about.process"), items: { steps: { list: p("about.process.steps"), id: bySlug, make: (slug) => ({ slug }), texts: { title: "title", body: "body" } } } },
  { block: "about.why", texts: head("about.why"), items: { pillars: { list: p("pillars"), id: bySlug, make: (slug) => ({ slug, icon: "check" }), texts: { title: "title", body: "body" } } } },
  {
    block: "about.workshop",
    texts: head("about.workshop"),
    items: { photos: { list: p("about.workshop.photos"), id: byIndex("photo"), base: "index", texts: { caption: "caption" }, settings: { media: media("media") } } },
  },
  {
    block: "about.machinery",
    texts: head("about.machinery", ["label", "title", "intro", "link", "machine", "type", "power", "notStated"]),
    settings: (s, r) => ({ machines: manual("machine", s.machines.map(bySlug), r) }),
  },
  {
    block: "about.work",
    texts: { ...head("about.projects", ["label", "title", "intro", "link"]), refLabel: ro("projectsPage.refLabel"), cardAction: ro("home.projects.inGallery") },
    settings: (s, r) => ({ projects: manual("project", s.about.projects.slugs, r) }),
    decodeSettings: slugsBack("project", "projects", "about.projects.slugs"),
  },
  { block: "about.clients", texts: head("about.clients", ["label", "title", "intro", "link"]), settings: () => ({ clients: auto("all", 6) }) },
  { block: "about.compliance", texts: head("about.compliance", ["label", "title", "intro", "link", "note"]), settings: () => ({ certificates: auto("all", 6) }) },
  closing("about"),
];

// --- The other system pages ------------------------------------------------------------------------------------------------

const SERVICES_PAGE: BlockMap[] = [
  {
    block: "page.hero",
    texts: { ...head("servicesPage.hero", ["eyebrow", "title", "intro"]), plateLabel: p("servicesPage.plateLabel") },
    settings: () => ({ variant: "services", services: auto("all", 6) }),
    items: { facts: facts("servicesPage.hero.meta") },
  },
  { block: "services.index", texts: head("servicesPage", ["indexLabel", "includesLabel", "equipmentLabel", "open"]), settings: () => ({ services: auto("all", 12) }) },
  closing("servicesPage"),
];

const CAPABILITIES: BlockMap[] = [
  {
    block: "page.hero",
    texts: {
      eyebrow: p("capabilitiesPage.hero.eyebrow"),
      title: ro("seo.capabilities.title"),
      intro: ro("seo.capabilities.description"),
      explore: p("capabilitiesPage.hero.explore"),
      quote: p("capabilitiesPage.quote"),
      fleet: p("capabilitiesPage.hero.fleet"),
      factMachines: p("capabilitiesPage.hero.facts.machines"),
      factLaser: p("capabilitiesPage.hero.facts.laser"),
      factPeak: p("capabilitiesPage.hero.facts.peak"),
      powerUnit: ro("capabilitiesPage.power.unit"),
    },
    settings: () => ({ variant: "capabilities", machines: auto("all", 6) }),
  },
  {
    block: "capabilities.power",
    texts: { ...head("capabilitiesPage.power", ["label", "title", "intro", "chart", "unit"]), notStated: ro("capabilitiesPage.fields.notStated") },
    settings: () => ({ machines: auto("all", 12) }),
  },
  {
    block: "capabilities.console",
    texts: {
      ...head("capabilitiesPage.console", ["label", "title", "intro", "list", "showing", "schematic"]),
      ...roHead("capabilitiesPage.fields", ["power", "service", "source", "notStated"]),
      quote: ro("capabilitiesPage.quote"),
      serviceLink: p("capabilitiesPage.serviceLink"),
      sourceLine: ro({ get: (s) => ({ en: `${s.capabilitiesPage.fields.profile.en} · ${s.capabilitiesPage.fields.page.en}`, ar: `${s.capabilitiesPage.fields.profile.ar} · ${s.capabilitiesPage.fields.page.ar}` }) }),
      unit: ro("capabilitiesPage.power.unit"),
    },
    settings: () => ({ machines: auto("all", 12) }),
  },
  {
    block: "capabilities.register",
    texts: {
      ...head("capabilitiesPage.register", ["label", "title", "intro", "caption", "number", "machine", "type"]),
      ...Object.fromEntries(["power", "service", "source", "notStated"].map((k) => [k, p(`capabilitiesPage.fields.${k}`)])),
      sourceLine: ro({ get: (s) => ({ en: `${s.capabilitiesPage.fields.profile.en} · ${s.capabilitiesPage.fields.page.en}`, ar: `${s.capabilitiesPage.fields.profile.ar} · ${s.capabilitiesPage.fields.page.ar}` }) }),
      unit: ro("capabilitiesPage.power.unit"),
    },
    settings: () => ({ machines: auto("all", 12) }),
  },
  { block: "capabilities.service_lines", texts: head("capabilitiesPage.services", ["label", "title", "intro", "machines", "open"]), settings: () => ({ machines: auto("all", 12) }) },
  { block: "capabilities.source", texts: head("capabilitiesPage.source", ["label", "title", "body"]) },
  closing("capabilitiesPage"),
];

const PROJECTS_PAGE: BlockMap[] = [
  {
    block: "page.hero",
    texts: { ...head("projectsPage.hero", ["eyebrow", "title", "intro", "quickFilter"]), allLabel: ro("projectsPage.gallery.all"), refLabel: ro("projectsPage.refLabel") },
    settings: (s, r) => ({ variant: "projects", prints: manual("project", PROJECTS_COLLAGE, r) }),
    items: { facts: facts("projectsPage.hero.meta") },
  },
  {
    block: "projects.featured",
    texts: { label: p("projectsPage.featured.label"), refLabel: ro("projectsPage.refLabel"), action: ro("projectsPage.view") },
    settings: (s, r) => ({ project: manual("project", [s.projectsPage.featured.slug], r) }),
    decodeSettings: slugsBack("project", "project", "projectsPage.featured.slug", true),
  },
  {
    block: "projects.highlights",
    texts: { ...head("projectsPage.editorial"), refLabel: ro("projectsPage.refLabel"), action: ro("projectsPage.view") },
    settings: (s, r) => ({ projects: manual("project", s.projectsPage.editorial.slugs, r) }),
    decodeSettings: slugsBack("project", "projects", "projectsPage.editorial.slugs"),
  },
  {
    block: "projects.gallery",
    texts: { ...head("projectsPage.gallery", ["label", "title", "intro", "filterLabel", "all", "showing"]), refLabel: p("projectsPage.refLabel"), view: p("projectsPage.view") },
    settings: () => ({ projects: auto("all", 60) }),
  },
  { block: "projects.index", texts: head("projectsPage.index", ["label", "title", "note"]) },
  closing("projectsPage"),
];

const INDUSTRIES_PAGE: BlockMap[] = [
  {
    block: "page.hero",
    texts: head("industriesPage.hero", ["eyebrow", "title", "intro"]),
    settings: (s, r) => ({ variant: "industries", strip: manual("industry", INDUSTRIES_STRIP, r) }),
    items: { facts: facts("industriesPage.hero.meta") },
  },
  {
    block: "industries.sectors",
    texts: texts({ label: "industriesPage.listLabel", profile: "industriesPage.basis.profile", inferred: "industriesPage.basis.inferred", related: "industriesPage.relatedLabel" }),
    settings: () => ({ industries: auto("all", 12) }),
  },
  { block: "industries.index", texts: head("industriesPage.note", ["label", "title", "paragraphs"]) },
  closing("industriesPage"),
];

const CLIENTS_PAGE: BlockMap[] = [
  { block: "page.hero", texts: head("clientsPage.hero", ["eyebrow", "title", "intro"]), settings: () => ({ variant: "clients" }) },
  { block: "clients.wall", texts: texts({ label: "clientsPage.listLabel", colours: "clientsPage.colours", note: "clientsPage.note" }), settings: () => ({ clients: auto("all", 60) }) },
  closing("clientsPage", false),
];

const CERTIFICATES_PAGE: BlockMap[] = [
  {
    block: "page.hero",
    texts: {
      ...head("certificatesPage.hero", ["eyebrow", "title", "intro"]),
      ...texts({
        registerLabel: "certificatesPage.registerLabel",
        colNumber: "certificatesPage.columns.number",
        colDocument: "certificatesPage.columns.document",
        colIssuer: "certificatesPage.columns.issuer",
        colReference: "certificatesPage.columns.reference",
        reference: "certificatesPage.reference",
      }),
    },
    settings: () => ({ variant: "certificates", certificates: auto("all", 6) }),
  },
  {
    block: "certificates.register",
    texts: {
      label: ro("certificatesPage.registerLabel"),
      view: p("certificatesPage.view"),
      preview: p("certificatesPage.previewLabel"),
      english: nth("certificatesPage.versions", 0),
      arabic: nth("certificatesPage.versions", 1),
      dialogNote: p("certificatesPage.dialogNote"),
      referenceLabel: ro("certificatesPage.columns.reference"),
      reference: ro("certificatesPage.reference"),
    },
    settings: () => ({ certificates: auto("all", 6) }),
  },
  { block: "certificates.redaction", texts: head("certificatesPage.redaction", ["label", "title", "points"]) },
  closing("certificatesPage"),
];

const CONTACT_PAGE: BlockMap[] = [
  {
    block: "page.hero",
    texts: {
      ...head("contactPage.hero", ["eyebrow", "title", "intro"]),
      ...texts({
        quote: "contactPage.actions.quote",
        findUs: "contactPage.actions.findUs",
        call: "contactPage.actions.call",
        methodsLabel: "contactPage.methods.label",
        phoneLabel: "contactPage.methods.phone",
        whatsappLabel: "contactPage.methods.whatsapp",
        chat: "contactPage.methods.chat",
        emailLabel: "contactPage.methods.email",
        send: "contactPage.methods.send",
        addressLabel: "contactPage.methods.address",
        viewMap: "contactPage.methods.viewMap",
      }),
    },
    settings: () => ({ variant: "contact" }),
  },
  {
    block: "contact.quote",
    texts: { ...head("contactPage.form", ["label", "title", "intro", "steps", "status"]), stepsLabel: p("contactPage.methods.stepsLabel") },
  },
  {
    block: "contact.location",
    texts: {
      ...head("contactPage.location", ["label", "title", "intro", "mapTitle", "mapCaption", "directions", "openMap"]),
      contactLabel: p("contactPage.location.contact"),
      nameLabel: p("contactPage.methods.name"),
      addressLabel: ro("contactPage.methods.address"),
      call: ro("contactPage.actions.call"),
      phoneLabel: ro("contactPage.methods.phone"),
      send: ro("contactPage.methods.send"),
      emailLabel: ro("contactPage.methods.email"),
    },
  },
];

const NOT_FOUND: BlockMap[] = [
  {
    block: "not_found.view",
    texts: Object.fromEntries(
      ["code", "note", "title", "body", "home", "contact"].map((k) => [
        k,
        {
          get: (s: Any) => ({ en: s.dictionaries.en.notFound[k], ar: s.dictionaries.ar.notFound[k] }),
          put: (s: Any, v: Record<Loc, unknown>) => {
            for (const l of LOCALES) s.dictionaries[l].notFound[k] = v[l];
          },
        } satisfies Acc,
      ]),
    ),
  },
];

const PROJECT_TEMPLATE: BlockMap[] = [
  {
    block: "project.hero",
    texts: {
      ...head("projectDetailPage", ["eyebrow", "source", "quote", "back", "photoAlt"]),
      classification: p("projectDetailPage.facts.classification"),
      services: p("projectDetailPage.facts.services"),
      refLabel: ro("projectsPage.refLabel"),
    },
  },
  { block: "project.photos", texts: head("projectDetailPage.photos", ["title", "intro"]) },
  { block: "project.details", texts: head("projectDetailPage.details", ["title", "client", "location", "year", "materials", "scope", "description", "challenge", "solution"]) },
  closing("projectDetailPage"),
];

// --- Legal pages -----------------------------------------------------------------------------------------------------------

type LegalKey = "privacy" | "terms";
const legalHead = (key: LegalKey): BlockMap[] => [
  {
    block: "page.hero",
    texts: {
      ...head(`legalDocuments.${key}.hero`, ["eyebrow", "title", "intro"]),
      updatedLabel: p("legalChrome.updated"),
      appliesTo: p("legalChrome.appliesTo"),
      appliesToValue: p("legalChrome.appliesToValue"),
    },
    settings: () => ({ variant: "legal" }),
  },
  {
    block: "legal.contents",
    texts: {
      onThisPage: p("legalChrome.onThisPage"),
      pending: p("legalChrome.pending"),
      email: p("legalChrome.contactLabels.email"),
      phone: p("legalChrome.contactLabels.phone"),
      address: p("legalChrome.contactLabels.address"),
    },
  },
];

/** A legal section's paragraphs and bulleted lists as the builder's rich document, and back. */
type LegalBlock = string | { list: string[] };
export function legalDoc(blocks: readonly LegalBlock[]) {
  return {
    type: "doc",
    content: blocks.map((b) =>
      typeof b === "string"
        ? { type: "paragraph", content: [{ type: "text", text: b }] }
        : { type: "bullet_list", content: b.list.map((item) => ({ type: "list_item", content: [{ type: "text", text: item }] })) },
    ),
  };
}
const inline = (node: Any): string => (Array.isArray(node?.content) ? node.content.map((n: Any) => (n.type === "text" ? String(n.text ?? "") : n.type === "hard_break" ? "\n" : inline(n))).join("") : "");
export function legalBlocks(doc: Any): LegalBlock[] {
  const out: LegalBlock[] = [];
  for (const node of Array.isArray(doc?.content) ? doc.content : []) {
    if (node.type === "bullet_list" || node.type === "ordered_list") out.push({ list: (node.content ?? []).map(inline) });
    else out.push(inline(node));
  }
  return out;
}

// --- Service pages ---------------------------------------------------------------------------------------------------------

/** A service page's layout (1D's sections, `looks.ts`'s variants). Shared labels are read back from Laser Cutting's only. */
function serviceMaps(slug: string, shared: boolean): BlockMap[] {
  const d = `serviceDetails.${slug}`;
  const look = serviceLooks[slug as keyof typeof serviceLooks];
  const icon = (fallback: string): ElemSetting => ({ enc: (x) => look.icons[x.slug] ?? fallback });
  const label = (path: string): Acc => (shared ? p(path) : ro(path));
  const point = (list: string, fallback: string, extra: Partial<ItemsMap> = {}): ItemsMap => ({
    list: p(list),
    id: bySlug,
    make: (id) => ({ slug: id }),
    texts: { title: "title", body: "body" },
    settings: { icon: icon(fallback) },
    ...extra,
  });
  return [
    {
      block: "service.hero",
      texts: {
        section: {
          get: (s) => s.servicePage.sections[at(s, `${d}.section`)],
          put: shared || slug === "scaffolding" ? (s, v) => (s.servicePage.sections[at(s, `${d}.section`)] = v) : undefined,
        },
        serviceLabel: label("servicePage.service"),
        quote: label("servicePage.quote"),
        seeWork: label("servicePage.seeWork"),
        detailCaption: p(`${d}.heroDetail.caption`),
      },
      settings: (s, r, o) => ({ visual: look.hero, tone: serviceTone[slug as keyof typeof serviceTone], detail: mediaId(r, o, at(s, `${d}.heroDetail.media`)) }),
      decodeSettings: (out, st, dr) => {
        const key = dr.mediaKey(st.detail);
        if (key) setAt(out, `${d}.heroDetail.media`, key);
      },
      items: { facts: facts(`${d}.meta`) },
    },
    {
      block: "service.overview",
      texts: { label: label("servicePage.labels.overview"), title: p(`${d}.overview.title`), includesLabel: label("servicePage.includes"), caption: p(`${d}.overview.media.caption`) },
      settings: (s, r, o) => ({ media: mediaId(r, o, at(s, `${d}.overview.media.media`)) }),
      decodeSettings: (out, st, dr) => {
        const key = dr.mediaKey(st.media);
        if (key) setAt(out, `${d}.overview.media.media`, key);
      },
    },
    {
      block: "service.scope",
      texts: { label: label("servicePage.labels.scope"), title: p(`${d}.scope.title`), intro: p(`${d}.scope.intro`) },
      settings: () => ({ layout: look.scope }),
      items: {
        items: point(`${d}.scope.items`, "precision", {
          texts: { title: "title", body: "body", caption: "media.caption" },
          settings: { icon: icon("precision"), media: media("media.media") },
        }),
        figures: { list: p(`${d}.scope.media`), id: byIndex("figure"), base: "index", texts: { caption: "caption" }, settings: { media: media("media") } },
      },
    },
    {
      block: "service.process",
      texts: { label: label("servicePage.labels.process"), title: p(`${d}.process.title`), intro: p(`${d}.process.intro`), note: label("servicePage.processNote") },
      settings: () => ({ layout: look.process, ...(look.rail ? { rail: look.rail } : {}) }),
      items: { steps: point(`${d}.process.steps`, "layers") },
    },
    {
      block: "service.machines",
      optional: `${d}.machines`,
      shown: (s) => at(s, `${d}.machines`) !== undefined,
      texts: {
        label: label("servicePage.labels.machines"),
        title: p(`${d}.machines.title`),
        intro: p(`${d}.machines.intro`),
        link: label("servicePage.machine.link"),
        powerLabel: label("servicePage.machine.power"),
        capabilitiesLabel: label("servicePage.machine.capabilities"),
      },
    },
    {
      block: "service.applications",
      texts: {
        label: label("servicePage.labels.applications"),
        title: p(`${d}.applications.title`),
        intro: p(`${d}.applications.intro`),
        uses: pairs(`${d}.applications.uses`),
        sectorsLabel: label("servicePage.applications.sectors"),
        usesLabel: label("servicePage.applications.uses"),
        workLabel: label("servicePage.applications.work"),
        linkLabel: label("servicePage.applications.link"),
        basisProfile: ro("industriesPage.basis.profile"),
        basisInferred: ro("industriesPage.basis.inferred"),
      },
    },
    {
      block: "service.gallery",
      optional: `${d}.gallery`,
      shown: (s) => at(s, `${d}.gallery`) !== undefined,
      texts: { label: label("servicePage.labels.gallery"), title: p(`${d}.gallery.title`), intro: p(`${d}.gallery.intro`) },
      settings: () => ({ layout: look.gallery }),
    },
    { block: "service.why", texts: { label: label("servicePage.labels.why"), title: p(`${d}.why.title`) }, items: { points: point(`${d}.why.points`, "precision") } },
    {
      block: "service.related",
      texts: { label: label("servicePage.labels.related"), title: label("servicePage.relatedTitle"), allServices: label("servicePage.allServices"), explore: label("servicePage.explore") },
    },
    {
      block: "service.projects",
      optional: `${d}.projects`,
      shown: (s) => at(s, `${d}.projects`) !== undefined,
      texts: {
        label: label("servicePage.labels.projects"),
        title: p(`${d}.projects.title`),
        intro: p(`${d}.projects.intro`),
        allProjects: label("servicePage.allProjects"),
        refLabel: ro("projectsPage.refLabel"),
        viewLabel: ro("home.projects.inGallery"),
      },
    },
    {
      block: "service.cta",
      texts: {
        ...head(`${d}.cta`, ["label", "title", "body"]),
        quote: ro("servicePage.quote"),
        call: label("servicePage.cta.call"),
        or: label("servicePage.cta.or"),
        services: label("servicePage.cta.services"),
        projects: label("servicePage.cta.projects"),
      },
    },
  ];
}

// --- Owners ----------------------------------------------------------------------------------------------------------------

/** The system pages imported with a layout, in the order the importer creates them (A3 `SYSTEM_PAGES`). */
export const PAGE_MAPS: Record<string, () => BlockMap[]> = {
  home: () => HOME,
  about: () => ABOUT,
  services: () => SERVICES_PAGE,
  capabilities: () => CAPABILITIES,
  projects: () => PROJECTS_PAGE,
  industries: () => INDUSTRIES_PAGE,
  clients: () => CLIENTS_PAGE,
  certificates: () => CERTIFICATES_PAGE,
  contact: () => CONTACT_PAGE,
  not_found: () => NOT_FOUND,
  privacy: () => legalHead("privacy"),
  terms: () => legalHead("terms"),
  project_detail: () => PROJECT_TEMPLATE,
};

const LEGAL_KEYS: readonly string[] = ["privacy", "terms"];
const SHARED_LABELS_FROM = "laser-cutting";

function mapsOf(owner: OwnerKey): BlockMap[] {
  if ("service" in owner) return serviceMaps(owner.service, owner.service === SHARED_LABELS_FROM);
  const maps = PAGE_MAPS[owner.page];
  if (!maps) throw new Error(`No layout map for page ${owner.page}.`);
  return maps();
}

// --- Encode ----------------------------------------------------------------------------------------------------------------

const localized = (v: Any, l: Loc): unknown => {
  const x = v?.[l];
  return x === undefined || x === null ? "" : Array.isArray(x) ? [...x] : x;
};

function encodeItems(spec: ItemsMap, s: Any, r: EncodeRefs, owner: string) {
  const list: Any[] = (spec.list.get(s) ?? []).filter(Boolean);
  const ids = list.map((x, i) => spec.id(x, i));
  const settings = list.map((x, i) => ({ id: ids[i], ...Object.fromEntries(Object.entries(spec.settings ?? {}).map(([k, e]) => [k, e.enc(x, r, owner)])) }));
  const content = Object.fromEntries(
    LOCALES.map((l) => [l, Object.fromEntries(list.map((x, i) => [ids[i], Object.fromEntries(Object.entries(spec.texts).map(([k, path]) => [k, localized(at(x, path), l)]))]))]),
  ) as Record<Loc, Rec>;
  return { settings, content };
}

/** Today's layout of an owner, section by section (legal pages: one section per today's legal section). */
export function planLayout(owner: OwnerKey, s: ContentSet, r: EncodeRefs): SectionPlan[] {
  const name = ownerName(owner);
  const plans: SectionPlan[] = [];
  for (const map of mapsOf(owner)) {
    const visible = map.shown ? map.shown(s) : true;
    const settings: Rec = map.settings ? map.settings(s, r, name) : {};
    const content: Record<Loc, Rec> = { en: {}, ar: {} };
    for (const [field, acc] of Object.entries(map.texts ?? {})) {
      const v = acc.get(s);
      for (const l of LOCALES) content[l][field] = localized(v, l);
    }
    for (const [field, spec] of Object.entries(map.items ?? {})) {
      const items = encodeItems(spec, s, r, name);
      settings[field] = items.settings;
      for (const l of LOCALES) content[l][field] = items.content[l];
    }
    plans.push({ block: map.block, anchor: map.anchor ?? null, visible, settings, content });
  }
  if ("page" in owner && LEGAL_KEYS.includes(owner.page)) {
    const doc = (s as Any).legalDocuments[owner.page];
    for (const section of doc.sections) {
      plans.push({
        block: "legal.section",
        anchor: section.id,
        visible: true,
        settings: { contact: section.contact === true },
        content: Object.fromEntries(LOCALES.map((l) => [l, { title: section.title[l], body: legalDoc(section.body[l]), pendingNote: section.pending?.[l] ?? "" }])) as unknown as Record<Loc, Rec>,
      });
    }
  }
  return plans;
}

// --- Decode ----------------------------------------------------------------------------------------------------------------

const textOf = (content: PublishedSection["content"], l: Loc, field: string): unknown => content?.[l]?.[field];
const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

function putTexts(target: Any, acc: Acc, values: Record<Loc, unknown>) {
  if (!acc.put) return;
  // A text the static content does not hold (an optional body) stays absent while the block leaves it empty.
  if (LOCALES.every((l) => isEmpty(values[l])) && acc.get(target) === undefined) return;
  acc.put(target, values);
}

function decodeItems(out: Any, base: Any, field: string, spec: ItemsMap, settings: unknown, content: PublishedSection["content"], d: DecodeRefs) {
  if (!spec.list.put) return;
  const rows = Array.isArray(settings) ? (settings as Rec[]) : [];
  if (!rows.length && spec.list.get(out) === undefined) return;
  const staticList: Any[] = (spec.list.get(base) ?? []).filter(Boolean);
  const textsOf = (l: Loc, id: string) => ((content?.[l]?.[field] as Rec | undefined)?.[id] as Rec | undefined) ?? {};
  const list = rows.map((row, i) => {
    const id = String(row.id ?? "");
    const found = spec.base === "index" ? staticList[i] : staticList.find((x, j) => spec.id(x, j) === id);
    const el: Any = structuredClone(found ?? (spec.make ? spec.make(id) : {}));
    for (const [k, e] of Object.entries(spec.settings ?? {})) if (e.dec) e.dec(el, row[k], d);
    for (const [k, path] of Object.entries(spec.texts)) {
      const v = Object.fromEntries(LOCALES.map((l) => [l, textsOf(l, id)[k]])) as Record<Loc, unknown>;
      if (LOCALES.every((l) => isEmpty(v[l])) && at(el, path) === undefined) continue;
      setAt(el, path, v);
    }
    return el;
  });
  spec.list.put(out, list as never);
}

/**
 * Writes an owner's published layout into `out` (a copy of the content set being rebuilt). `base` is the static content
 * set: an item found there keeps its fields the block does not hold (a pillar's icon, a project card's slug).
 */
export function decodeLayout(owner: OwnerKey, sections: readonly PublishedSection[], out: Any, base: Any, d: DecodeRefs): void {
  const maps = mapsOf(owner);
  const used = new Set<PublishedSection>();
  for (const map of maps) {
    const section = sections.find((s) => s.blockType === map.block && !used.has(s));
    if (!section) {
      if (map.optional) deleteAt(out, map.optional);
      continue;
    }
    used.add(section);
    const settings = section.settings ?? {};
    for (const [field, acc] of Object.entries(map.texts ?? {})) {
      putTexts(out, acc, Object.fromEntries(LOCALES.map((l) => [l, textOf(section.content, l, field)])) as Record<Loc, unknown>);
    }
    for (const [field, spec] of Object.entries(map.items ?? {})) {
      if (spec.ro) continue;
      decodeItems(out, base, field, spec, settings[field], section.content, d);
    }
    map.decodeSettings?.(out, settings, d);
  }
  if ("page" in owner && LEGAL_KEYS.includes(owner.page)) {
    const doc = out.legalDocuments[owner.page];
    const staticSections: Any[] = base.legalDocuments[owner.page].sections;
    doc.sections = sections
      .filter((s) => s.blockType === "legal.section")
      .map((s) => {
        const found = staticSections.find((x) => x.id === s.anchor);
        const el: Any = { id: s.anchor ?? found?.id ?? "" };
        el.title = { en: textOf(s.content, "en", "title") ?? "", ar: textOf(s.content, "ar", "title") ?? "" };
        el.body = { en: legalBlocks(textOf(s.content, "en", "body")), ar: legalBlocks(textOf(s.content, "ar", "body")) };
        if (s.settings?.contact === true) el.contact = true;
        const pending = { en: textOf(s.content, "en", "pendingNote"), ar: textOf(s.content, "ar", "pendingNote") };
        if (!LOCALES.every((l) => isEmpty(pending[l]))) el.pending = pending;
        return el;
      });
  }
}

/** Every owner the importer lays out: the system pages, then the six services. */
export function layoutOwners(s: ContentSet): OwnerKey[] {
  return [...Object.keys(PAGE_MAPS).map((page) => ({ page })), ...s.services.map((x) => ({ service: x.slug }))];
}
