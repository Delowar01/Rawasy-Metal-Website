/**
 * The strict publication check (A8.2, A1-PUBLISHING-VERSIONS §4.2), run inside the publish transaction against the
 * version about to go live:
 *
 * - blocking: both required languages complete (marked complete, every required field and item text filled; each
 *   visible layout section's texts complete); a page's or service's layout set up; every media item the live version
 *   shows deliverable now (A4's `public_media`, share-locked); no blocking project flag; a certificate's texts through
 *   the digit guard again; the slug free among live versions of its type.
 * - warnings (shown before publishing, never blocking): references to aggregates that are not live — the public renderer
 *   leaves them out until they are (A1-CONTENT-MODEL §5.6, §9). Treating them as errors would make two records that name
 *   each other (a project and its services) impossible to publish first; recorded for the Owner in the A8 report.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { SPECS } from "../cms/kinds.ts";
import { isBlockingFlag, flagLabel, LOCALES, type EntityType } from "../cms/registry.ts";
import { rowsOf } from "../cms/store.ts";
import { digitGuardProblem } from "../cms/text.ts";
import { REGISTRY } from "../builder/registry.ts";
import { isCertificateCopy } from "../builder/references.ts";
import { ownerKindOf } from "../builder/structure.ts";
import { CONTENT_AGGREGATES, AGGREGATES, type AggregateType } from "./registry.ts";
import { referencesOfSnapshot } from "./references.ts";
import { sourceLabel } from "./references.ts";
import type { Snapshot } from "./snapshot.ts";

export interface PublishIssue {
  code: string;
  message: string;
  blocking: boolean;
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(asRecord) : []);
const isContent = (type: AggregateType): type is EntityType => (CONTENT_AGGREGATES as readonly string[]).includes(type);
const LANGUAGE = { en: "English", ar: "Arabic" } as const;

const emptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  const doc = asRecord(value);
  if (doc.type === "doc") return !Array.isArray(doc.content) || doc.content.length === 0;
  return false;
};

/** The snapshot as it will be shown: hidden layout sections left out (their media and links are never displayed). */
export function shownSnapshot(snapshot: Snapshot): Snapshot {
  if (!Array.isArray(snapshot.layout)) return snapshot;
  return { ...snapshot, layout: list(snapshot.layout).filter((s) => s.visible === true) };
}

function languageIssues(type: EntityType, snapshot: Snapshot): PublishIssue[] {
  const spec = SPECS[type];
  const issues: PublishIssue[] = [];
  const texts = asRecord(snapshot.texts);
  for (const locale of LOCALES) {
    const row = texts[locale] ? asRecord(texts[locale]) : null;
    if (!row) {
      issues.push({ code: `language.${locale}`, message: `${LANGUAGE[locale]} has no text yet: both languages must be complete to publish.`, blocking: true });
      continue;
    }
    const missing = spec.fields.filter((f) => f.required && emptyValue(row[f.key])).map((f) => f.label);
    if (missing.length) issues.push({ code: `language.${locale}.fields`, message: `${LANGUAGE[locale]}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.`, blocking: true });
    else if (row.translationStatus !== "complete") issues.push({ code: `language.${locale}.status`, message: `${LANGUAGE[locale]} is not marked complete${row.translationStatus === "needs_review" ? " (it needs review after a change in the other language)" : ""}.`, blocking: true });
    if (spec.children) {
      const required = spec.children.texts.filter((t) => t.required);
      const incomplete = list(snapshot.children).filter((c) => required.some((t) => emptyValue(asRecord(asRecord(c.texts)[locale])[t.key]))).length;
      if (incomplete) issues.push({ code: `language.${locale}.children`, message: `${LANGUAGE[locale]}: ${incomplete} ${spec.children.one}${incomplete === 1 ? "" : "s"} still need${incomplete === 1 ? "s" : ""} ${required.map((t) => t.label.toLowerCase()).join(" and ")}.`, blocking: true });
    }
  }
  return issues;
}

function sectionIssues(texts: unknown, blockType: unknown, what: string): PublishIssue[] {
  const def = typeof blockType === "string" ? REGISTRY.get(blockType) : undefined;
  if (!def) return [{ code: "block.unknown", message: `${what} uses a block this version of the admin doesn't know.`, blocking: true }];
  if (!Object.keys(def.content).length) return [];
  const t = asRecord(texts);
  return LOCALES.filter((l) => asRecord(t[l]).status !== "complete").map((l) => ({ code: `section.${l}`, message: `${what} (${def.label}): ${LANGUAGE[l]} is not complete.`, blocking: true }));
}

async function mediaIssues(tx: Db, type: AggregateType, snapshot: Snapshot): Promise<PublishIssue[]> {
  const ids = [...new Set(referencesOfSnapshot(type, shownSnapshot(snapshot)).filter((r) => r.targetType === "media").map((r) => r.targetId))];
  if (!ids.length) return [];
  const rows = await rowsOf<{ media_id: string }>(tx, sql`SELECT media_id FROM public_media WHERE media_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) LOCK IN SHARE MODE`);
  const delivered = new Set(rows.map((r) => r.media_id));
  const missing = ids.filter((id) => !delivered.has(id)).length;
  return missing
    ? [{ code: "media", message: `${missing} media item${missing === 1 ? " is" : "s are"} not deliverable to the public site (pending review, restricted, flagged, private, archived or in the Trash). Approve ${missing === 1 ? "it" : "them"} in the media library or choose another.`, blocking: true }]
    : [];
}

async function referenceWarnings(tx: Db, type: AggregateType, id: string, snapshot: Snapshot): Promise<PublishIssue[]> {
  const refs = referencesOfSnapshot(type, shownSnapshot(snapshot)).filter((r) => r.targetType !== "media" && !(r.targetType === type && r.targetId === id));
  const keys = [...new Map(refs.map((r) => [`${r.targetType}:${r.targetId}`, r])).values()];
  if (!keys.length) return [];
  const live = await rowsOf<{ entity_type: string; entity_id: string }>(
    tx,
    sql`SELECT entity_type, entity_id FROM published_documents WHERE ${sql.join(
      keys.map((r) => sql`(entity_type = ${r.targetType} AND entity_id = ${r.targetId})`),
      sql` OR `,
    )}`,
  );
  const liveKeys = new Set(live.map((r) => `${r.entity_type}:${r.entity_id}`));
  const missing = keys.filter((r) => !liveKeys.has(`${r.targetType}:${r.targetId}`));
  if (!missing.length) return [];
  const names: string[] = [];
  for (const r of missing.slice(0, 6)) names.push(`${AGGREGATES[r.targetType as AggregateType]?.one ?? r.targetType} ${await sourceLabel(tx, r.targetType as AggregateType, r.targetId)}`);
  return [
    {
      code: "references.unpublished",
      message: `${missing.length} linked item${missing.length === 1 ? " is" : "s are"} not published and will be left out of the public page until ${missing.length === 1 ? "it is" : "they are"}: ${names.join("; ")}${missing.length > 6 ? "; …" : ""}.`,
      blocking: false,
    },
  ];
}

/**
 * The certificate guard on the rendered page (A8.7; the A5 acceptance review's item 8 and final pass I4): certificate copy
 * — the Certificates page, or a certificate block anywhere — also draws record texts (the grids' project, service,
 * machine, client and industry names and summaries, from their live versions) and media alt texts that the save-time
 * guard does not read. At publish, every such text the page would draw passes A3's digit guard, line by line.
 */
async function renderedCertificateIssues(tx: Db, type: AggregateType, snapshot: Snapshot): Promise<PublishIssue[]> {
  if (type !== "page" && type !== "service") return [];
  const root = asRecord(snapshot.root);
  const kind = type === "service" ? "service" : ownerKindOf({ pageType: root.pageType as never, systemKey: (root.systemKey as string | null) ?? null });
  if (!kind) return [];
  const sections = list(snapshot.layout).filter((s) => s.visible === true && typeof s.blockType === "string" && REGISTRY.get(s.blockType as string) && isCertificateCopy(kind, REGISTRY.get(s.blockType as string)!));
  if (!sections.length) return [];
  const ids = new Set(sections.map((s) => s.id));
  const refs = referencesOfSnapshot(type, { ...snapshot, layout: sections }).filter((r) => r.sectionId && ids.has(r.sectionId));
  const texts: string[] = [];
  const records = refs.filter((r) => r.targetType !== "media");
  if (records.length) {
    const docs = await rowsOf<{ document: unknown }>(
      tx,
      sql`SELECT document FROM published_documents WHERE ${sql.join(
        records.map((r) => sql`(entity_type = ${r.targetType} AND entity_id = ${r.targetId})`),
        sql` OR `,
      )}`,
    );
    for (const d of docs) {
      const doc = asRecord(typeof d.document === "string" ? JSON.parse(d.document) : d.document);
      for (const t of Object.values(asRecord(doc.texts))) collectStrings(t, texts);
    }
  }
  const media = [...new Set(refs.filter((r) => r.targetType === "media").map((r) => r.targetId))];
  if (media.length) {
    const alts = await rowsOf<{ alt_text: string | null }>(tx, sql`SELECT alt_text FROM media_translations WHERE media_id IN (${sql.join(media.map((m) => sql`${m}`), sql`, `)})`);
    for (const a of alts) if (a.alt_text) texts.push(a.alt_text);
  }
  // Each text whole with its line breaks drawn as spaces (a paragraph field's break is drawn as a space: A5 final pass L1),
  // and each line alone (a field drawn with its lines kept).
  const bad = texts.some((t) => digitGuardProblem(t.replace(/\r?\n/g, " ")) || t.split(/\r?\n/).some((line) => digitGuardProblem(line)));
  return bad
    ? [{ code: "certificate.rendered", message: "The certificate copy on this page would show a record's text or a photo's alt text that holds what looks like a registration number, date or expiry. Change that record or alt text before publishing.", blocking: true }]
    : [];
}

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
}

/** Everything that keeps this version from going live (blocking) or that the publisher should know (warnings). */
export async function publicationIssues(tx: Db, type: AggregateType, id: string, snapshot: Snapshot): Promise<PublishIssue[]> {
  const issues: PublishIssue[] = [];
  if (isContent(type)) {
    issues.push(...languageIssues(type, snapshot));
    if (type === "page" || type === "service") {
      const layout = list(snapshot.layout);
      if (!layout.length) issues.push({ code: "layout.empty", message: "The layout is not set up yet: set it up in the page builder before publishing.", blocking: true });
      layout
        .filter((s) => s.visible === true && typeof s.reusableId !== "string")
        .forEach((s) => issues.push(...sectionIssues(s.texts, s.blockType, `Section ${layout.indexOf(s) + 1}`)));
    }
    if (type === "project") {
      const blocking = list(snapshot.flags).map((f) => String(f.flag)).filter(isBlockingFlag);
      if (blocking.length) issues.push({ code: "flags", message: `This project carries a flag that keeps it off the public site: ${blocking.map(flagLabel).join(", ")}. An Owner or Admin must clear it first.`, blocking: true });
    }
    if (type === "certificate") {
      const texts = asRecord(snapshot.texts);
      const pieces: string[] = [];
      for (const locale of LOCALES) {
        for (const value of Object.values(asRecord(texts[locale]))) if (typeof value === "string") pieces.push(value);
        for (const child of list(snapshot.children)) for (const value of Object.values(asRecord(asRecord(child.texts)[locale]))) if (typeof value === "string") pieces.push(value);
      }
      if (pieces.some((p) => digitGuardProblem(p))) issues.push({ code: "certificate.digits", message: "A certificate text holds what looks like a registration number, date or expiry: remove it before publishing.", blocking: true });
    }
    const slug = asRecord(snapshot.root).slug;
    if (typeof slug === "string" && slug) {
      // A plain read for the message: the slug's unique index decides at the write (a locking read of a free slug took
      // a gap lock two first publications both held, then both inserted into — a deadlock; A8 review L3).
      const [taken] = await rowsOf<{ entity_id: string }>(tx, sql`SELECT entity_id FROM published_documents WHERE entity_type = ${type} AND slug = ${slug} AND entity_id <> ${id}`);
      if (taken) issues.push({ code: "slug.live", message: `Another live ${AGGREGATES[type].one} already uses the address “${slug}”.`, blocking: true });
    }
  } else if (type === "reusable_section") {
    issues.push(...sectionIssues(snapshot.texts, snapshot.blockType, "This reusable section"));
  } else if (type === "menu") {
    if (snapshot.setUp !== true) issues.push({ code: "setup", message: "This menu is not set up yet.", blocking: true });
    const unlabelled = list(snapshot.items).filter((i) => i.isVisible === true && LOCALES.some((l) => emptyValue(asRecord(i.label)[l]))).length;
    if (unlabelled) issues.push({ code: "menu.labels", message: `${unlabelled} visible item${unlabelled === 1 ? " needs" : "s need"} a label in both languages.`, blocking: true });
  } else if (type === "site_settings" || type === "form") {
    if (snapshot.setUp !== true) issues.push({ code: "setup", message: `The ${AGGREGATES[type].one} ${type === "form" ? "is" : "are"} not set up yet.`, blocking: true });
    const status = asRecord(snapshot.status);
    for (const locale of LOCALES) if (status[locale] !== "complete") issues.push({ code: `language.${locale}.status`, message: `${LANGUAGE[locale]} is not marked complete.`, blocking: true });
  }
  issues.push(...(await renderedCertificateIssues(tx, type, snapshot)));
  issues.push(...(await mediaIssues(tx, type, snapshot)));
  issues.push(...(await referenceWarnings(tx, type, id, snapshot)));
  return issues;
}
