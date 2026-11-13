/**
 * A9.4 — the database read model (A1-PUBLISHING-VERSIONS §1, A1-MIGRATION-PLAN §9): the public website's content set
 * rebuilt from published documents and the media A4 delivers, in exactly the shape `src/content/*` exports, so the
 * approved components render the database's content without a change. Pure: the loader (`read-model.ts`) reads the rows.
 *
 * - **Published only.** Only `published_documents` rows (the A8 public projections: no working copy, no admin-only field)
 *   and `public_media` rows (A4's deliverable items) are read; a record, relation or photo that is not published or not
 *   delivered is absent, never filled in from the static files.
 * - **Records** are rebuilt whole (the static records are not consulted), in their published collection order.
 * - **Page copy** starts from the static content set and every value the published layouts, settings, menus, interface
 *   text and form hold replaces it (`layouts.ts` says which). What no published document holds is today's code: the
 *   approved composition's own choices and the previous design's unused copy (the reconciliation report lists them).
 */
import type { ContentSet } from "../../content/static-set.ts";
import type { AggregateType } from "../publishing/registry.ts";
import type { EntityType } from "../cms/registry.ts";
import { decodeLayout, type DecodeRefs, type PublishedSection } from "../migration/layouts.ts";

// The documents are JSON; their shape is the A8 projection's (projection.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Rec = Record<string, unknown>;
type Loc = "en" | "ar";
const LOCALES: readonly Loc[] = ["en", "ar"];

export interface PublishedDoc {
  type: AggregateType;
  id: string;
  slug: string | null;
  document: Rec;
}

export interface DeliveredMedia {
  id: string;
  legacyKey: string | null;
  kind: string;
  src: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
}

export interface PublishedInput {
  docs: readonly PublishedDoc[];
  media: readonly DeliveredMedia[];
}

/** The decoded content set, and which fixed pages are live (an unpublished one answers 404). */
export interface LiveContent {
  set: ContentSet;
  livePages: ReadonlySet<string>;
}

const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const textsOf = (doc: Rec, l: Loc) => asRec(asRec(doc.texts)[l]);
const T = (doc: Rec, field: string) => ({ en: str(textsOf(doc, "en")[field]), ar: str(textsOf(doc, "ar")[field]) });
const pad = (n: number) => String(n).padStart(2, "0");

/** A3's paragraph document (`{ type: "doc", content: [paragraph…] }`) as the static list of paragraphs. */
function paragraphs(v: unknown): string[] {
  const doc = asRec(v);
  const content = Array.isArray(doc.content) ? doc.content : [];
  return content.map((p: Any) => (Array.isArray(p?.content) ? p.content.map((n: Any) => (n.type === "text" ? str(n.text) : n.type === "hard_break" ? "\n" : "")).join("") : ""));
}
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : typeof v === "string" && v ? v.split("\n") : []);
const both = <T,>(f: (l: Loc) => T) => ({ en: f("en"), ar: f("ar") });

/** A record's source as the static content writes it (`pages` only when stated). */
function sourceOf(root: Rec): { basis: string; pages?: number[] } | undefined {
  if (typeof root.sourceBasis !== "string" || !root.sourceBasis) return undefined;
  const pages = str(root.sourcePages)
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return { basis: root.sourceBasis, ...(pages.length ? { pages } : {}) };
}

const ORDERING_OF: Record<string, EntityType> = {
  services: "service",
  machines: "machine",
  projects: "project",
  project_categories: "project_category",
  clients: "client",
  industries: "industry",
  certificates: "certificate",
};

export function decodeContentSet(input: PublishedInput, base: ContentSet): LiveContent {
  const out: Any = structuredClone(base);
  const byType = new Map<string, PublishedDoc[]>();
  for (const d of input.docs) byType.set(d.type, [...(byType.get(d.type) ?? []), d]);
  const docsOf = (type: AggregateType) => byType.get(type) ?? [];

  // Media: what A4 delivers, by the static key the components take (a release file's MediaId; an upload by its id).
  const mediaById = new Map(input.media.map((m) => [m.id, m]));
  const keyOf = (id: unknown): string | null => {
    const m = typeof id === "string" ? mediaById.get(id) : undefined;
    return m ? (m.legacyKey ?? m.id) : null;
  };
  out.mediaRegistry = Object.fromEntries(
    input.media.map((m) => [
      m.legacyKey ?? m.id,
      // An uploaded item (`/media/u/…`) is drawn as it is: the optimizer never takes its address (A4).
      { src: m.src, width: m.width ?? 0, height: m.height ?? 0, ...(m.blurDataUrl ? { blurDataURL: m.blurDataUrl } : {}), ...(m.src.startsWith("/media/u/") ? { unoptimized: true } : {}) },
    ]),
  );

  // Records in their published collection order (any published record the order does not list follows, by slug).
  const slugs = new Map<string, string>();
  for (const d of input.docs) if (d.slug) slugs.set(`${d.type}:${d.id}`, d.slug);
  const slugOf = (type: EntityType, id: unknown): string | null => (typeof id === "string" ? (slugs.get(`${type}:${id}`) ?? null) : null);
  const slugList = (type: EntityType, ids: unknown) => (Array.isArray(ids) ? ids.map((id) => slugOf(type, id)).filter((s): s is string => Boolean(s)) : []);
  const ordered = (type: EntityType): PublishedDoc[] => {
    const docs = docsOf(type);
    const key = Object.entries(ORDERING_OF).find(([, t]) => t === type)?.[0];
    const order = key ? (docsOf("ordering").find((d) => d.id === key)?.document.items as unknown[] | undefined) : undefined;
    const position = new Map((order ?? []).map((id, i) => [String(id), i]));
    return [...docs].sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || str(a.slug).localeCompare(str(b.slug)));
  };
  const root = (d: PublishedDoc) => asRec(d.document.root);
  const rel = (d: PublishedDoc) => asRec(d.document.relations);
  const children = (d: PublishedDoc) => (Array.isArray(d.document.children) ? (d.document.children as Rec[]) : []);
  const mediaList = (d: PublishedDoc, key: string) => {
    const list = asRec(d.document.mediaLists)[key];
    return Array.isArray(list) ? list.map((x) => keyOf(asRec(x).media)).filter((k): k is string => Boolean(k)) : [];
  };
  const media = (id: unknown) => keyOf(id);
  const withSource = <T extends Rec>(record: T, r: Rec): T => {
    const source = sourceOf(r);
    return (source ? { ...record, source } : record) as T;
  };

  out.projectCategories = ordered("project_category").map((d) => ({ slug: d.slug, label: T(d.document, "label") }));

  out.services = ordered("service").map((d, i) => {
    const r = root(d);
    const gallery = children(d)
      .map((c) => ({ media: media(c.media), caption: both((l) => str(asRec(asRec(c.texts)[l]).caption)) }))
      .filter((g) => g.media);
    return withSource(
      {
        slug: d.slug,
        index: pad(i + 1),
        name: T(d.document, "name"),
        tagline: T(d.document, "tagline"),
        summary: T(d.document, "summary"),
        body: both((l) => paragraphs(textsOf(d.document, l).body)),
        highlights: both((l) => lines(textsOf(d.document, l).highlights)),
        cover: media(r.coverMediaId),
        coverAlt: T(d.document, "coverAlt"),
        supporting: { media: media(r.supportingMediaId), alt: T(d.document, "supportingAlt") },
        gallery,
        machines: slugList("machine", rel(d).machines),
        projects: slugList("project", rel(d).featuredProjects),
      },
      r,
    );
  });

  out.machines = ordered("machine").map((d) => {
    const r = root(d);
    return withSource(
      {
        slug: d.slug,
        name: T(d.document, "name"),
        shortName: T(d.document, "shortName"),
        category: T(d.document, "category"),
        ...(typeof r.powerWatts === "number" ? { powerWatts: r.powerWatts } : {}),
        capability: T(d.document, "capability"),
        service: slugOf("service", r.primaryServiceId),
        media: media(r.mediaId),
      },
      r,
    );
  });

  out.projects = ordered("project").map((d) => {
    const r = root(d);
    return {
      slug: d.slug,
      galleryRef: str(r.galleryRef),
      title: T(d.document, "title"),
      summary: T(d.document, "summary"),
      categories: slugList("project_category", rel(d).categories),
      services: slugList("service", rel(d).services),
      media: mediaList(d, "photos"),
      ...(r.isFeatured === true ? { featured: true } : {}),
      ...(typeof r.year === "number" ? { year: r.year } : {}),
    };
  });

  out.industries = ordered("industry").map((d) => {
    const r = root(d);
    const feature = media(r.featureMediaId);
    return {
      slug: d.slug,
      name: T(d.document, "name"),
      description: T(d.document, "description"),
      media: media(r.mediaId),
      ...(feature ? { feature } : {}),
      services: slugList("service", rel(d).services),
      source: sourceOf(r) ?? { basis: r.classification === "profile_sector" ? "profile" : "inferred" },
    };
  });

  out.clients = ordered("client").map((d) => {
    const r = root(d);
    const mono = media(r.logoMonoMediaId);
    return { slug: d.slug, name: T(d.document, "name"), logo: media(r.logoMediaId), ...(mono ? { logoMono: mono } : {}) };
  });

  out.certificates = ordered("certificate").map((d) => {
    const r = root(d);
    return withSource(
      {
        slug: d.slug,
        title: T(d.document, "title"),
        issuer: T(d.document, "issuer"),
        facts: children(d).map((c) => ({ label: both((l) => str(asRec(asRec(c.texts)[l]).label)), value: both((l) => str(asRec(asRec(c.texts)[l]).value)) })),
        previews: mediaList(d, "previews"),
        thumb: media(r.thumbMediaId),
      },
      r,
    );
  });

  // The site settings (A6): the company's facts, the site's name, the interface text.
  const settings = docsOf("site_settings").find((d) => d.id === "site");
  if (settings) {
    const v = asRec(settings.document.values);
    const t = (l: Loc) => asRec(asRec(v.texts)[l]);
    const L = (field: string) => both((l) => str(t(l)[field]));
    const c = out.company;
    c.legalName = L("legalName");
    c.brandName = L("brandName");
    c.statement = L("statement");
    c.address = both((l) => ({ lines: lines(t(l).addressLines), full: str(t(l).addressFull) }));
    c.city = L("city");
    c.country = L("country");
    if (str(v.postalCode)) c.postalCode = str(v.postalCode);
    else delete c.postalCode;
    if (str(v.geoLat) && str(v.geoLng)) c.geo = { lat: Number(v.geoLat), lng: Number(v.geoLng), approximate: v.geoIsApproximate !== false };
    else delete c.geo;
    const phones = Array.isArray(v.phones) ? (v.phones as Rec[]) : [];
    c.phones = phones.map((p) => ({ display: str(p.display), e164: str(p.e164), whatsapp: p.hasWhatsapp === true }));
    c.email = str(v.email);
    c.website = str(v.websiteUrl);
    c.social = str(v.facebookUrl) ? { facebook: str(v.facebookUrl) } : {};
    c.vision = { statement: L("visionStatement"), aims: both((l) => lines(t(l).visionAims)), closing: L("visionClosing") };
    const primary = phones.findIndex((p) => p.id === settings.document.primaryWhatsappPhoneId);
    out.primaryWhatsApp = c.phones[primary] ?? c.phones.find((p: Any) => p.whatsapp) ?? c.phones[0];
    out.siteName = L("siteName");
    for (const [key, value] of Object.entries(asRec(settings.document.interfaceText))) {
      for (const l of LOCALES) {
        const text = str(asRec(value)[l]);
        if (!text) continue;
        if (key === "navigation.footerCompanyTitle") {
          if (out.footerNav[0]) out.footerNav[0].title[l] = text;
          continue;
        }
        const [group, name] = key.split(".");
        if (out.dictionaries[l][group] && typeof out.dictionaries[l][group][name] === "string") out.dictionaries[l][group][name] = text;
      }
    }
  }

  // The menus (A6): the header's pages, the footer's company and legal columns.
  const menu = (key: string) => {
    const d = docsOf("menu").find((m) => m.id === key);
    return d ? (Array.isArray(d.document.items) ? (d.document.items as Rec[]) : []) : null;
  };
  const routeItems = (items: Rec[]) => items.filter((i) => i.linkType === "route" && typeof i.route === "string").map((i) => ({ route: i.route, label: both((l) => str(asRec(i.label)[l])) }));
  const header = menu("header_main");
  if (header) out.headerNav = routeItems(header);
  const company = menu("footer_company");
  if (company && out.footerNav[0]) out.footerNav[0].items = routeItems(company);
  const legal = menu("footer_legal");
  if (legal) out.legalNav = routeItems(legal);

  // Pages: their record (navigation label, SEO texts, a legal page's date) and their layout.
  const reusables = new Map(docsOf("reusable_section").map((d) => [d.id, d.document]));
  const sectionsOf = (d: PublishedDoc): PublishedSection[] =>
    (Array.isArray(d.document.layout) ? (d.document.layout as Rec[]) : []).map((s) => {
      const linked = typeof s.reusableId === "string" ? reusables.get(s.reusableId) : undefined;
      return {
        id: s.id,
        blockType: str(linked?.blockType ?? s.blockType),
        anchor: typeof s.anchor === "string" ? s.anchor : null,
        settings: asRec(linked ? linked.settings : s.settings),
        content: asRec(linked ? linked.content : s.content) as PublishedSection["content"],
      };
    });
  const refs: DecodeRefs = { mediaKey: keyOf, slugOf };
  const livePages = new Set<string>();
  for (const d of docsOf("page")) {
    const r = root(d);
    const key = typeof r.systemKey === "string" ? r.systemKey : null;
    if (!key) continue;
    livePages.add(key);
    if (out.seo[key]) out.seo[key] = { title: T(d.document, "seoTitle"), description: T(d.document, "seoDescription") };
    if (out.routeLabels[key]) {
      const nav = T(d.document, "navLabel");
      out.routeLabels[key] = { en: nav.en || T(d.document, "title").en, ar: nav.ar || T(d.document, "title").ar };
    }
    if (out.legalDocuments[key] && typeof r.effectiveDate === "string") out.legalDocuments[key].updated = r.effectiveDate.slice(0, 10);
    try {
      decodeLayout({ page: key }, sectionsOf(d), out, base, refs);
    } catch {
      // A page without a layout map (a generic page) is not one the static components draw.
    }
  }

  // The service pages: each service's details from its layout, its related services and section from its record.
  const details: Rec = {};
  for (const d of out.services as Any[]) {
    const doc = docsOf("service").find((x) => x.slug === d.slug)!;
    if (!out.serviceDetails[d.slug]) out.serviceDetails[d.slug] = emptyDetail();
    decodeLayout({ service: d.slug }, sectionsOf(doc), out, base, refs);
    out.serviceDetails[d.slug].related = slugList("service", rel(doc).relatedServices);
    out.serviceDetails[d.slug].section = root(doc).serviceGroup === "scaffolding" ? "scaffolding" : "metal";
    details[d.slug] = out.serviceDetails[d.slug];
  }
  out.serviceDetails = details;

  // The quote form (A7): its copy and its fields' words.
  const form = docsOf("form").find((d) => asRec(d.document).key === "quote");
  if (form) decodeForm(out.contactPage.form, form.document);

  return { set: out as ContentSet, livePages };
}

const blank = () => ({ en: "", ar: "" });
function emptyDetail() {
  return {
    section: "metal",
    meta: [],
    overview: { title: blank() },
    scope: { title: blank(), intro: blank(), items: [] },
    process: { title: blank(), intro: blank(), steps: [] },
    applications: { title: blank(), intro: blank() },
    why: { title: blank(), points: [] },
    related: [],
    cta: { label: blank(), title: blank(), body: blank() },
  };
}

/** The published quote form's words into `contactPage.form` (what `workingQuoteFormText` lays over today's, A7). */
function decodeForm(target: Any, doc: Rec) {
  const copy = asRec(doc.copy);
  const fields = new Map((Array.isArray(doc.fields) ? (doc.fields as Rec[]) : []).map((f) => [str(f.key), f]));
  const put = (path: string, value: (l: Loc) => unknown) => {
    const keys = path.split(".");
    let x = target;
    for (const k of keys) x = x?.[k];
    if (!x || typeof x !== "object") return;
    for (const l of LOCALES) {
      const v = value(l);
      if (typeof v === "string" && v) x[l] = v;
    }
  };
  const c = (l: Loc, path: string) => path.split(".").reduce<unknown>((x, k) => asRec(x)[k], copy[l]);
  for (const path of ["requiredNote", "groups.details", "groups.project", "groups.message", "noscript", "serviceOther", "submit", "files.choose", "files.drop", "files.remove", "files.note", "files.units.kb", "files.units.mb", "errors.summary", "errors.fileType", "errors.fileSize", "errors.fileCount", "privacy.text", "privacy.link"])
    put(path, (l) => c(l, path));
  for (const key of Object.keys(asRec(copy.en).ready ?? {})) put(`ready.${key}`, (l) => c(l, `ready.${key}`));
  const fieldText = (key: string, l: Loc, name: string) => str(asRec(asRec(fields.get(key)?.texts)[l])[name]);
  for (const key of Object.keys(target.fields ?? {})) for (const name of ["label", "hint", "placeholder"]) put(`fields.${key}.${name}`, (l) => fieldText(key, l, name));
  const errors: Record<string, [string, string]> = {
    fullName: ["fullName", "errorRequired"],
    email: ["email", "errorRequired"],
    emailInvalid: ["email", "errorInvalid"],
    phone: ["phone", "errorRequired"],
    phoneInvalid: ["phone", "errorInvalid"],
    service: ["service", "errorRequired"],
    message: ["message", "errorRequired"],
    messageShort: ["message", "errorInvalid"],
  };
  for (const [name, [key, kind]] of Object.entries(errors)) put(`errors.${name}`, (l) => fieldText(key, l, kind));
  const optionLabels = (l: Loc) => asRec(asRec(asRec(fields.get("projectType")?.texts)[l]).optionLabels);
  for (const option of Array.isArray(target.projectTypes) ? target.projectTypes : []) {
    for (const l of LOCALES) {
      const label = str(optionLabels(l)[option.value]);
      if (label) option.label[l] = label;
    }
  }
}
