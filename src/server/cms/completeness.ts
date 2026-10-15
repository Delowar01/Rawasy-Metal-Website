/**
 * Translation completeness (A1-CONTENT-MODEL §3.2; A3 brief §9). English and Arabic are equals: each language of an
 * item has its own state, and neither is required to save a draft.
 *
 * - **Missing** — no text in that language at all (no translation row; computed, never stored).
 * - **Incomplete** — some text, but a required field of that language is empty (computed, never stored).
 * - **Draft** — every required field filled, not yet confirmed (the stored default).
 * - **Complete** — an editor confirmed this language is finished ("English is complete" ticked; refused while a
 *   required field is empty).
 * - **Needs review** — another language changed after this one was completed; set automatically on save unless the
 *   editor ticks "This change does not affect the other language" (for typo fixes).
 *
 * Pure: the services pass in what they read under the row lock.
 */
import { LOCALES, type Locale } from "./registry.ts";

export type TranslationStatus = "draft" | "complete" | "needs_review";
export type LocaleState = "missing" | "incomplete" | TranslationStatus;

export const LOCALE_STATE_LABELS: Record<LocaleState, string> = {
  missing: "Missing",
  incomplete: "Incomplete",
  draft: "Draft",
  complete: "Complete",
  needs_review: "Needs review",
};

/** The state shown for one language (`status` null: the language has no text). */
export function localeState(status: TranslationStatus | null, requiredFilled: boolean): LocaleState {
  if (status === null) return "missing";
  if (!requiredFilled) return "incomplete";
  return status;
}

export interface StatusInput {
  /** The stored status per language (null: no row). */
  previous: Record<Locale, TranslationStatus | null>;
  /** Whether this save changes the language's text (its own fields and its child items). */
  changed: Record<Locale, boolean>;
  /** "<Language> is complete" ticked in the form. */
  marked: Record<Locale, boolean>;
  /** Whether every required field of the language is filled after this save. */
  filled: Record<Locale, boolean>;
  /** Whether the language keeps any text after this save (otherwise its rows are removed). */
  exists: Record<Locale, boolean>;
  /** "This change does not affect the other language" ticked. */
  otherUnaffected: boolean;
}

export interface StatusPlan {
  /** The status to store per language (null: no row). */
  status: Record<Locale, TranslationStatus | null>;
  /** Languages confirmed complete by this save (their completed_at/by are set now). */
  completedNow: Record<Locale, boolean>;
  /** Languages ticked complete that cannot be (empty, or a required field missing). */
  refused: Locale[];
}

const perLocale = <T>(fn: (locale: Locale) => T) => Object.fromEntries(LOCALES.map((l) => [l, fn(l)])) as Record<Locale, T>;

export function planTranslationStatus(input: StatusInput): StatusPlan {
  const refused = LOCALES.filter((l) => input.marked[l] && (!input.exists[l] || !input.filled[l]));
  const status = perLocale<TranslationStatus | null>(() => null);
  const completedNow = perLocale(() => false);
  for (const locale of LOCALES) {
    if (!input.exists[locale]) continue;
    const prev = input.previous[locale];
    const changed = input.changed[locale];
    if (!input.marked[locale] || refused.includes(locale)) {
      status[locale] = prev === "needs_review" && !changed ? "needs_review" : "draft";
      continue;
    }
    if (changed || prev !== "complete") {
      status[locale] = "complete";
      completedNow[locale] = true;
      continue;
    }
    const otherChanged = LOCALES.some((l) => l !== locale && input.changed[l]);
    status[locale] = otherChanged && !input.otherUnaffected ? "needs_review" : "complete";
  }
  return { status, completedNow, refused };
}

/** Whether two values of a translated field are the same (strings, string lists, JSON documents, null). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}
