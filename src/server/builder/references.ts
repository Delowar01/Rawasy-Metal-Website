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
 * - Certificate copy keeps A3's digit guard: no registration or certificate number, no expiry wording.
 *
 * Choosing never approves or publishes anything (A8 refuses non-deliverable references at publication).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mediaChoiceProblem, mediaTargetStates, type ContentMediaKind } from "../cms/media-refs.ts";
import { rowsOf, targetStates } from "../cms/store.ts";
import { digitGuardProblem } from "../cms/text.ts";
import type { BlockDefinition, OwnerKind } from "./block.ts";
import { plainTextOf, referencesOf, type BlockReferences, type Content, type FieldIssue, type Locale, type RecordType, type Settings } from "./fields.ts";

/** Blocks whose texts are certificate copy wherever they appear (A3's guard: no numbers, no expiry wording). */
const CERTIFICATE_BLOCKS = new Set(["home.compliance", "about.compliance", "generic.certificates"]);

export const isCertificateCopy = (kind: OwnerKind, def: BlockDefinition) => kind === "system:certificates" || CERTIFICATE_BLOCKS.has(def.key);

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
 * a new section): what it already named may stay even if it is now archived or trashed.
 */
export async function referenceIssues(tx: Db, kind: OwnerKind, def: BlockDefinition, data: SectionData, before: BlockReferences | null): Promise<FieldIssue[]> {
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

  // Certificate copy: A3's digit guard on every text of both languages.
  if (isCertificateCopy(kind, def)) {
    for (const locale of ["en", "ar"] as const) {
      const text = plainTextOf(def.content, def.settings, data.content[locale]);
      for (const line of text.split("\n")) {
        const problem = line ? digitGuardProblem(line) : null;
        if (problem) {
          issues.push({ path: `content.${locale}`, message: problem });
          break;
        }
      }
    }
  }
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
