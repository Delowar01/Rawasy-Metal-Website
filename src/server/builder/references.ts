/**
 * What a section names, checked when it is saved (A5 brief §16–§18, §49, §51–§53): media items (A4), records (A3) and
 * link targets — so a section can never name a private media item, newly choose one in the Trash, archived or without a
 * ready file, newly link an archived record, or point at a page that is not a generic page.
 *
 * - Media follow A4's one rule for content (`cms/media-refs.ts`): never private (refused exactly like an unknown id), the
 *   field's kinds, and the stricter "newly chosen" rules for items this section did not name before; new ones are
 *   share-locked inside the save's transaction (they can't be trashed or archived in the same moment).
 * - Records follow A3's relation rule (`cms/store.ts` `checkTargets`): they exist, and only active ones are added anew
 *   (archived ones may stay where they are); new ones share-locked.
 * - Certificate copy keeps A3's digit guard: no registration or certificate number, no expiry wording — in every text of
 *   both languages (each piece as it is drawn), in every value shown as text (a figure) and in every link target's
 *   address, wherever the section shows: on the Certificates page, or a certificate block on any page (A5 security
 *   review, F1; final review). A reusable section is checked for every page that links it; a section's anchor there is
 *   checked too (it is part of the page's address).
 *
 * Choosing never approves or publishes anything (A8 refuses non-deliverable references at publication).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mediaChoiceProblem, mediaTargetStates, type ContentMediaKind } from "../cms/media-refs.ts";
import { rowsOf, targetStates } from "../cms/store.ts";
import { digitGuardProblem, hasRegistrationNumber } from "../cms/text.ts";
import type { BlockDefinition, OwnerKind } from "./block.ts";
import { referencesOf, shownTextsOf, shownValuesOf, type BlockReferences, type Content, type FieldIssue, type Locale, type RecordType, type Settings } from "./fields.ts";
import type { LinkTarget } from "./links.ts";

/** Blocks whose texts are certificate copy wherever they appear (A3's guard: no numbers, no expiry wording). */
const CERTIFICATE_BLOCKS = new Set(["home.compliance", "about.compliance", "generic.certificates"]);

/**
 * Whether a block's texts are certificate copy where it shows: on the Certificates page, or a certificate block on any
 * page. `kinds`: the owner the section belongs to, or every owner that links a reusable section.
 */
export const isCertificateCopy = (kinds: OwnerKind | readonly OwnerKind[], def: BlockDefinition) =>
  CERTIFICATE_BLOCKS.has(def.key) || (typeof kinds === "string" ? kinds === "system:certificates" : kinds.includes("system:certificates"));

export const CERTIFICATE_ANCHOR = "An anchor on certificate copy can't hold a registration or certificate number (seven or more digits): it is part of the page's address.";
export const CERTIFICATE_LINK =
  "A link on certificate copy can't hold a registration or certificate number (seven or more digits) in its address, anchor, email or phone number.";

/** A piece of text as the page draws it: runs of spaces and line breaks become one space (a line break in a paragraph field is not drawn). */
const asDrawn = (text: string) => text.replace(/\s+/g, " ").trim();

/** The parts of a link target a visitor's page carries (addresses, anchors, email, phone); record ids are not shown. */
function linkText(target: LinkTarget): string {
  switch (target.type) {
    case "external":
      return target.url;
    case "email":
      return target.address;
    case "phone":
      return target.number;
    case "anchor":
      return target.anchor;
    case "system":
    case "page":
    case "service":
      return target.anchor ?? "";
    default:
      return "";
  }
}

/**
 * A3's digit guard on a section's data: each text piece of both languages as it is drawn (a text or paragraph field, a
 * line, a paragraph or list item — never texts joined across fields, so a line break can't split a number or a phrase
 * past the guard: A5 final security review), every value shown as text, and every link target's address.
 */
export function certificateIssues(def: BlockDefinition, data: SectionData): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const check = (path: string, value: string) => {
    const problem = digitGuardProblem(asDrawn(value));
    if (problem && !issues.some((issue) => issue.path === path && issue.message === problem)) issues.push({ path, message: problem });
  };
  for (const { path, value } of shownValuesOf(def.settings, data.settings)) check(path, value);
  for (const locale of ["en", "ar"] as const) {
    for (const { path, text } of shownTextsOf(def.content, def.settings, data.content[locale], locale)) check(path, text);
  }
  for (const { target, path } of referencesOf(def.settings, def.content, data.settings, data.content).links) {
    if (hasRegistrationNumber(linkText(target)) && !issues.some((issue) => issue.path === path && issue.message === CERTIFICATE_LINK)) {
      issues.push({ path, message: CERTIFICATE_LINK });
    }
  }
  return issues;
}

/** Why an anchor can't be used on certificate copy, or null (A3 guards certificate slugs, the page's anchors, alike). */
export const certificateAnchorProblem = (anchor: string | null) => (anchor && hasRegistrationNumber(anchor) ? CERTIFICATE_ANCHOR : null);

export interface SectionData {
  settings: Settings;
  content: Partial<Record<Locale, Content>>;
}

const RECORD_LABELS: Record<RecordType, string> = {
  service: "service",
  project: "project",
  machine: "machine",
  client: "client",
  certificate: "certificate",
  industry: "industry",
  page: "page",
  project_category: "project category",
};

/**
 * The problems of a section's references, or an empty list. `before`: the same section's references as stored (empty for
 * a new section): what it already named may stay even if it is now archived or trashed. `kinds`: where the section shows
 * (its owner, or the owners linking a reusable section), for the certificate guard.
 */
export async function referenceIssues(tx: Db, kinds: OwnerKind | readonly OwnerKind[], def: BlockDefinition, data: SectionData, before: BlockReferences | null): Promise<FieldIssue[]> {
  const issues: FieldIssue[] = [];
  const refs = referencesOf(def.settings, def.content, data.settings, data.content);

  // Media: never private, the field's kinds, new ones under the stricter rules (share-locked).
  const knownMedia = new Set((before?.media ?? []).map((m) => m.id));
  const fresh = [...new Set(refs.media.filter((m) => !knownMedia.has(m.id)).map((m) => m.id))];
  const kept = [...new Set(refs.media.filter((m) => knownMedia.has(m.id)).map((m) => m.id))];
  const states = new Map([...(await mediaTargetStates(tx, fresh, { lock: true })), ...(await mediaTargetStates(tx, kept, { lock: false }))]);
  for (const media of refs.media) {
    const problem = mediaChoiceProblem(states.get(media.id), media.kinds as readonly ContentMediaKind[], !knownMedia.has(media.id));
    if (problem) issues.push({ path: media.path, message: problem });
  }

  // Records: they exist; new ones are active (share-locked); kept ones may be archived.
  const knownRecords = new Set((before?.records ?? []).map((r) => `${r.type}:${r.id}`));
  const byType = new Map<RecordType, { id: string; path: string }[]>();
  for (const record of refs.records) byType.set(record.type, [...(byType.get(record.type) ?? []), { id: record.id, path: record.path }]);
  for (const [type, list] of byType) {
    const ids = [...new Set(list.map((r) => r.id))];
    const added = ids.filter((id) => !knownRecords.has(`${type}:${id}`));
    const stay = ids.filter((id) => knownRecords.has(`${type}:${id}`));
    const found = new Map([...(await targetStates(tx, type, stay)), ...(await targetStates(tx, type, added, { lock: true }))]);
    const generic = type === "page" ? await genericPages(tx, ids) : null;
    for (const record of list) {
      const state = found.get(record.id);
      const label = RECORD_LABELS[type];
      if (!state) issues.push({ path: record.path, message: `A chosen ${label} no longer exists. Choose another.` });
      else if (state.archived && !knownRecords.has(`${type}:${record.id}`)) issues.push({ path: record.path, message: `The chosen ${label} is archived: it can stay where it was, but can't be added again. Restore it first.` });
      else if (generic && !generic.has(record.id)) issues.push({ path: record.path, message: "Link to the site's own pages with “A page of the site”; “A generic page” takes generic pages only." });
    }
  }

  // Certificate copy: A3's digit guard on every text of both languages and every value shown as text.
  if (isCertificateCopy(kinds, def)) issues.push(...certificateIssues(def, data));
  return issues;
}

async function genericPages(db: Db, ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await rowsOf<{ id: string }>(
    db,
    sql`SELECT id FROM pages WHERE page_type = 'generic' AND deleted_at IS NULL AND id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  );
  return new Set(rows.map((r) => r.id));
}
