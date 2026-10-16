/**
 * A section's (or reusable section's) languages after a save (A5 brief §35; A1-CONTENT-MODEL §3.2): A3's one rule for
 * translation states (`cms/completeness.ts` `planTranslationStatus`), applied to block texts — a language exists only
 * while it holds text; it is marked complete only when its required texts are filled; changing one language of a
 * complete section sets the other to "needs review" unless the editor says the change does not affect it.
 */
import { localeState, planTranslationStatus, type LocaleState, type TranslationStatus } from "../cms/completeness.ts";
import type { BlockDefinition } from "./block.ts";
import { hasAnyText, LOCALES, missingRequired, type Content, type FieldIssue, type Locale, type Settings } from "./fields.ts";
import type { StoredTranslation, TranslationWrite } from "./store.ts";

const NAMES: Record<Locale, string> = { en: "English", ar: "Arabic" };

export interface TextPlan {
  rows: Record<Locale, TranslationWrite | null>;
  changed: Record<Locale, boolean>;
  /** Languages whose status changed, for the audit (`before → after`). */
  statusChanges: Partial<Record<Locale, { before: TranslationStatus | null; after: TranslationStatus | null }>>;
  issues: FieldIssue[];
}

/**
 * The languages to store. `content`: the validated texts per language (absent: no text); `storedContent`: the texts as
 * stored and read (validated) before this save, or null for a new section; `stored`: the stored rows (their statuses).
 */
export function planTexts(input: {
  def: BlockDefinition;
  settings: Settings;
  content: Partial<Record<Locale, Content>>;
  stored: Partial<Record<Locale, StoredTranslation>>;
  storedContent: Partial<Record<Locale, Content>> | null;
  marked: Record<Locale, boolean>;
  otherUnaffected: boolean;
  actorId: string;
  now: Date;
}): TextPlan {
  const { def } = input;
  const exists = {} as Record<Locale, boolean>;
  const filled = {} as Record<Locale, boolean>;
  const changed = {} as Record<Locale, boolean>;
  const previous = {} as Record<Locale, TranslationStatus | null>;
  for (const locale of LOCALES) {
    const text = input.content[locale];
    exists[locale] = hasAnyText(def.settings, def.content, text);
    filled[locale] = exists[locale] && missingRequired(def.settings, def.content, input.settings, text ?? {}).length === 0;
    const before = input.storedContent?.[locale];
    const beforeText = before && hasAnyText(def.settings, def.content, before) ? JSON.stringify(before) : null;
    changed[locale] = (exists[locale] ? JSON.stringify(text) : null) !== beforeText;
    previous[locale] = input.stored[locale]?.status ?? null;
  }
  const plan = planTranslationStatus({ previous, changed, marked: input.marked, filled, exists, otherUnaffected: input.otherUnaffected });
  const issues: FieldIssue[] = plan.refused.map((locale) => {
    const missing = exists[locale] ? missingRequired(def.settings, def.content, input.settings, input.content[locale] ?? {}) : [];
    return {
      path: `content.${locale}.complete`,
      message: exists[locale] ? `${NAMES[locale]} is incomplete: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.` : `${NAMES[locale]} can't be marked complete: it has no text yet.`,
    };
  });
  const rows = {} as Record<Locale, TranslationWrite | null>;
  const statusChanges: TextPlan["statusChanges"] = {};
  for (const locale of LOCALES) {
    const status = plan.status[locale];
    if (!exists[locale] || !status) {
      rows[locale] = null;
    } else {
      const before = input.stored[locale];
      const completed =
        status === "draft"
          ? { completedAt: null, completedBy: null }
          : plan.completedNow[locale]
            ? { completedAt: input.now, completedBy: input.actorId }
            : { completedAt: before?.completedAt ?? null, completedBy: before?.completedBy ?? null };
      rows[locale] = { content: input.content[locale]!, status, ...completed };
    }
    const after = rows[locale]?.status ?? null;
    if (after !== previous[locale]) statusChanges[locale] = { before: previous[locale], after };
  }
  return { rows, changed, statusChanges, issues };
}

/** The state shown for one language of a section (missing, incomplete, draft, complete, needs review). */
export function sectionLocaleState(def: BlockDefinition, settings: Settings, content: Content | undefined, status: TranslationStatus | null): LocaleState {
  if (!content || !hasAnyText(def.settings, def.content, content)) return "missing";
  return localeState(status, missingRequired(def.settings, def.content, settings, content).length === 0);
}
