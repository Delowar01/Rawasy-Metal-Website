"use client";
/**
 * One section's settings and texts (A5 brief §34–§35): the texts of the chosen language (English or Arabic, side by
 * side in tabs; Arabic written right to left), the repeated items, the shared settings and the design inspector's
 * choices, then each language's "complete" mark. Changing one language while the other is marked complete makes the
 * other "Needs review" on save unless the editor says the change does not affect it. Values stay as typed when a save is
 * refused; the server's messages show under the fields they name. Used by the page builder and by the reusable section
 * editor alike.
 */
import { useId } from "react";
import type { BlockModel, BuilderLocale, SectionData } from "@/server/admin/actions/builder-model";
import type { CmsLocaleState } from "@/server/admin/actions/cms-model";
import { LocaleBadge } from "../cms/ContentEditor";
import { ContentFieldEditor, ItemsInput, SettingFieldEditor } from "./Fields";
import { useEnv } from "./env";
import { hasText, LANGUAGE, LOCALES, missingTexts, shownFields } from "./model";

export type DataUpdate = (recipe: (d: SectionData) => SectionData, editKey: string) => void;

export function LanguageTabs({ locale, setLocale, label = "Language of the texts" }: { locale: BuilderLocale; setLocale: (l: BuilderLocale) => void; label?: string }) {
  return (
    <div className="adm-bld-tabs" role="group" aria-label={label}>
      {LOCALES.map((l) => (
        <button key={l} type="button" className="adm-btn is-small" aria-pressed={locale === l} onClick={() => setLocale(l)}>
          {LANGUAGE[l]}
          {l === "ar" ? (
            <span lang="ar" dir="rtl" className="adm-muted">
              {" "}
              (العربية)
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function SectionEditor({
  block,
  data,
  status,
  locale,
  setLocale,
  update,
  changed,
}: {
  block: BlockModel;
  data: SectionData;
  /** The stored language states (null for a new section). */
  status: Record<BuilderLocale, CmsLocaleState> | null;
  locale: BuilderLocale;
  setLocale: (l: BuilderLocale) => void;
  update: DataUpdate;
  /** Whether the texts or settings differ from the stored ones (the "does not affect" question applies). */
  changed: boolean;
}) {
  const env = useEnv();
  const id = useId();
  const content = shownFields(block.content, data.settings);
  const settings = shownFields(block.settings, data.settings);
  const items = settings.filter((f) => f.kind === "items");
  const plain = settings.filter((f) => f.kind !== "items" && f.kind !== "design");
  const design = settings.filter((f) => f.kind === "design");
  const setText = (key: string, value: unknown) =>
    update((d) => ({ ...d, content: { ...d.content, [locale]: { ...(d.content[locale] ?? {}), [key]: value } } }), `${locale}.${key}`);
  const setSetting = (key: string, value: unknown) => update((d) => ({ ...d, settings: { ...d.settings, [key]: value } }), `settings.${key}`);
  const anyComplete = LOCALES.some((l) => status?.[l] === "complete" || data.complete[l]);

  return (
    <div className="adm-bld-editor">
      {block.note ? <p className="adm-hint adm-bld-note">{block.note}</p> : null}
      {content.length || items.length ? (
        <section className="adm-bld-group" aria-labelledby={`${id}-texts`}>
          <div className="adm-bld-group-head">
            <h3 id={`${id}-texts`}>Texts</h3>
            <LanguageTabs locale={locale} setLocale={setLocale} />
          </div>
          <p className="adm-hint">
            Editing the {LANGUAGE[locale]} texts. Each language is written on its own terms; nothing is translated automatically.
          </p>
          {content.map((field) => (
            <ContentFieldEditor key={`${locale}:${field.key}`} field={field} value={data.content[locale]?.[field.key]} onChange={(v) => setText(field.key, v)} locale={locale} path={`content.${locale}.${field.key}`} />
          ))}
          {items.map((field) =>
            field.kind === "items" ? <ItemsInput key={`${locale}:${field.key}`} field={field} data={data} locale={locale} update={(recipe) => update(recipe, `items.${field.key}`)} /> : null,
          )}
        </section>
      ) : null}
      {plain.length ? (
        <section className="adm-bld-group" aria-labelledby={`${id}-settings`}>
          <h3 id={`${id}-settings`}>Settings</h3>
          <p className="adm-hint">Shared by both languages.</p>
          {plain.map((field) => (
            <SettingFieldEditor key={field.key} field={field} value={data.settings[field.key]} onChange={(v) => setSetting(field.key, v)} path={`settings.${field.key}`} />
          ))}
        </section>
      ) : null}
      {design.map((field) => (
        <section key={field.key} className="adm-bld-group" aria-label="Design">
          <SettingFieldEditor field={field} value={data.settings[field.key]} onChange={(v) => setSetting(field.key, v)} path={`settings.${field.key}`} />
        </section>
      ))}
      <section className="adm-bld-group" aria-labelledby={`${id}-langs`}>
        <h3 id={`${id}-langs`}>Languages</h3>
        {LOCALES.map((l) => {
          const missing = missingTexts(block, data, l);
          const written = hasText(block, data, l);
          return (
            <div key={l} className="adm-field">
              <div className="adm-bld-lang">
                <label className="adm-check" htmlFor={`${id}-${l}-complete`}>
                  <input
                    id={`${id}-${l}-complete`}
                    type="checkbox"
                    checked={data.complete[l]}
                    disabled={env.disabled}
                    onChange={(e) => update((d) => ({ ...d, complete: { ...d.complete, [l]: e.target.checked } }), `complete.${l}`)}
                    aria-describedby={`${id}-${l}-hint`}
                  />
                  <span>{LANGUAGE[l]} is complete</span>
                </label>
                {status ? <LocaleBadge locale={l} state={status[l]} /> : null}
              </div>
              <p className="adm-hint" id={`${id}-${l}-hint`}>
                {!written ? `No ${LANGUAGE[l]} text yet.` : missing.length ? `Still needed before ${LANGUAGE[l]} can be complete: ${missing.join(", ")}.` : `${LANGUAGE[l]} has every required text.`}
              </p>
              {env.issues
                .filter((i) => i.path === `content.${l}.complete`)
                .map((i, n) => (
                  <p key={n} className="adm-hint adm-error" role="alert">
                    {i.message}
                  </p>
                ))}
            </div>
          );
        })}
        {changed && anyComplete ? (
          <div className="adm-field">
            <label className="adm-check" htmlFor={`${id}-unaffected`}>
              <input
                id={`${id}-unaffected`}
                type="checkbox"
                checked={data.otherUnaffected}
                disabled={env.disabled}
                onChange={(e) => update((d) => ({ ...d, otherUnaffected: e.target.checked }), "otherUnaffected")}
              />
              <span>This change does not affect the other language.</span>
            </label>
            <p className="adm-hint">Otherwise, a language marked complete that you did not change becomes “Needs review” when you save.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
