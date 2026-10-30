"use client";
/**
 * The interface text (A6.3): a search across every key, then the groups (Accessibility labels, Controls …) as cards of
 * one form, each text with its English and Arabic value, a length counter and today's text. An empty value means
 * "today's text" (the preview shows it). The language switch's label is written in the language it leads to (its fields
 * say so and take that language's direction). One save sends every text with the version the page was opened on (the
 * texts share the site settings' version, so one form never loses another group's typing); the server checks every key
 * and length again.
 */
import { useState } from "react";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { saveUiTextAction } from "@/server/admin/actions/site";
import type { LocaleKey, UiGroupFormModel } from "@/server/admin/actions/site-model";
import { SaveAlert, useSiteSave } from "./useSiteSave";

const LANGS: { code: LocaleKey; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
];

export function UiTextEditor({ groups, lockVersion, canEdit }: { groups: UiGroupFormModel[]; lockVersion: number; canEdit: boolean }) {
  const initial = Object.fromEntries(groups.flatMap((g) => g.strings.map((s) => [s.key, { ...s.value }])));
  const [values, setValues] = useState<Record<string, Record<LocaleKey, string>>>(initial);
  const [query, setQuery] = useState("");
  const { pending, state, submit, reload, issue } = useSiteSave(saveUiTextAction, "/admin/interface-text?saved=1");
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedChanges(canEdit && dirty);
  const disabled = !canEdit || pending;
  const q = query.trim().toLowerCase();
  const total = groups.reduce((n, g) => n + g.strings.length, 0);
  const filled = (code: LocaleKey) => Object.values(values).filter((v) => v[code]).length;

  return (
    <form
      className="adm-editor adm-site-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (canEdit) submit({ expectedVersion: lockVersion, values });
      }}
    >
      <div className="adm-field adm-site-search">
        <label className="adm-label" htmlFor="ui-search">
          Find a text
        </label>
        <input id="ui-search" className="adm-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-describedby="ui-search-hint" />
        <p className="adm-hint" id="ui-search-hint">
          Searches names, keys and both languages. Set: English {filled("en")} / {total}, Arabic {filled("ar")} / {total} (an empty value shows today&apos;s text).
        </p>
      </div>
      <SaveAlert state={state} onReload={reload} />
      {groups.map((group) => {
        const shown = group.strings.filter((s) => !q || [s.key, s.description, ...Object.values(values[s.key]), ...Object.values(s.today)].some((v) => v.toLowerCase().includes(q)));
        if (!shown.length) return null;
        return (
          <section key={group.key} className="adm-card adm-site-ui-group" aria-labelledby={`ui-${group.key}-title`}>
            <div className="adm-card-head">
              <h2 id={`ui-${group.key}-title`}>{group.name}</h2>
            </div>
            <p className="adm-hint">{group.description}</p>
            <ul className="adm-site-rows">
              {shown.map((s) => (
                <li key={s.key} className="adm-site-row">
                  <div>
                    <strong>{s.description}</strong> <span className="adm-muted adm-mono">{s.key}</span>
                    {s.otherLanguage ? <p className="adm-hint">Written in the language it leads to: the English page shows the Arabic text, and the other way round.</p> : null}
                  </div>
                  <div className="adm-site-pair">
                    {LANGS.map((lang) => {
                      const id = `ui-${s.key.replace(/\./g, "-")}-${lang.code}`;
                      // The language switch reads in the other language: its text's language and direction follow it.
                      const textLang = s.otherLanguage ? (lang.code === "en" ? "ar" : "en") : lang.code;
                      const value = values[s.key][lang.code];
                      const error = issue(`values.${s.key}.${lang.code}`);
                      return (
                        <div className="adm-field" key={lang.code}>
                          <label className="adm-label" htmlFor={id}>
                            {lang.name} page{s.otherLanguage ? ` (in ${textLang === "ar" ? "Arabic" : "English"})` : ""}
                          </label>
                          <input
                            id={id}
                            className="adm-input"
                            value={value}
                            lang={textLang}
                            dir={textLang === "ar" ? "rtl" : "ltr"}
                            disabled={disabled}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={`${id}-count ${id}-today${error ? ` ${id}-error` : ""}`}
                            onChange={(e) => setValues((v) => ({ ...v, [s.key]: { ...v[s.key], [lang.code]: e.target.value } }))}
                          />
                          <p className="adm-hint adm-site-count" id={`${id}-count`}>
                            {[...value].length} / {s.maxLength}
                            {value ? "" : " — empty: today's text shows"}
                          </p>
                          <p className="adm-hint" id={`${id}-today`}>
                            Today:{" "}
                            <span lang={textLang} dir={textLang === "ar" ? "rtl" : "ltr"}>
                              {s.today[lang.code]}
                            </span>
                          </p>
                          {error ? (
                            <p className="adm-hint adm-error" id={`${id}-error`}>
                              {error}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {q && !groups.some((g) => g.strings.some((s) => [s.key, s.description, ...Object.values(values[s.key]), ...Object.values(s.today)].some((v) => v.toLowerCase().includes(q)))) ? (
        <p className="adm-empty">No text matches “{query}”.</p>
      ) : null}
      {canEdit ? (
        <div className="adm-savebar">
          <span className="adm-savebar-status" role="status">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>
          <button type="submit" className="adm-btn is-primary" disabled={pending} aria-disabled={pending}>
            {pending ? "Saving…" : "Save interface text"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
