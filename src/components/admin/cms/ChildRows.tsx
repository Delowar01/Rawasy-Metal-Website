"use client";
/**
 * Ordered label/value pairs in both languages (machine technical attributes, certificate displayed facts — A3 brief
 * §27, §30): plain-text inputs only, Arabic right to left, Move up / Move down / Remove per entry. The list goes out as
 * one JSON field the server validates strictly (known keys, lengths, entry count, the certificate digit guard).
 */
import { useId, useState } from "react";
import type { ChildrenModel, ChildValues } from "@/server/admin/actions/cms-model";

export function ChildRows({
  model,
  value,
  onChange,
  disabled,
  error,
}: {
  model: ChildrenModel;
  value: ChildValues[];
  onChange: (rows: ChildValues[]) => void;
  disabled: boolean;
  error?: string;
}) {
  const id = useId();
  const [announce, setAnnounce] = useState("");
  // Stable React keys, also for new rows (they have no id until saved); every change below updates them with the rows.
  const [keys, setKeys] = useState(() => value.map((_, i) => `row${i}`));
  const [counter, setCounter] = useState(value.length);
  const focusLater = (selector: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());

  const update = (index: number, locale: "en" | "ar", part: "label" | "value", text: string) =>
    onChange(value.map((row, i) => (i === index ? { ...row, [locale]: { ...row[locale], [part]: text } } : row)));
  const move = (index: number, step: -1 | 1) => {
    const next = [...value];
    const [row] = next.splice(index, 1);
    next.splice(index + step, 0, row);
    const k = [...keys];
    const [key] = k.splice(index, 1);
    k.splice(index + step, 0, key);
    setKeys(k);
    onChange(next);
    setAnnounce(`${capitalize(model.one)} moved to position ${index + step + 1} of ${next.length}.`);
    const target = index + step;
    const edge = step === -1 ? target === 0 : target === next.length - 1;
    focusLater(`[data-child="${key}"] [data-move="${edge ? (step === -1 ? "down" : "up") : step === -1 ? "up" : "down"}"]`);
  };
  const remove = (index: number) => {
    const k = [...keys];
    k.splice(index, 1);
    setKeys(k);
    onChange(value.filter((_, i) => i !== index));
    setAnnounce(`${capitalize(model.one)} ${index + 1} removed.`);
    focusLater(k[index] ? `[data-child="${k[index]}"] input` : `#${CSS.escape(`${id}-add`)}`);
  };
  const add = () => {
    const key = `row${counter}`;
    setKeys([...keys, key]);
    setCounter(counter + 1);
    onChange([...value, { id: null, en: { label: "", value: "" }, ar: { label: "", value: "" } }]);
    setAnnounce(`${capitalize(model.one)} ${value.length + 1} added.`);
    focusLater(`[data-child="${key}"] input`);
  };

  return (
    <div className="adm-children">
      <p className="adm-hint">{model.hint}</p>
      {value.length === 0 ? (
        <p className="adm-muted" id="f-children" tabIndex={-1}>
          No {model.label.toLowerCase()} yet.
        </p>
      ) : (
        <ol className="adm-child-list" id="f-children" tabIndex={-1}>
          {value.map((row, index) => {
            const key = keys[index] ?? `row-extra-${index}`;
            const n = index + 1;
            return (
              <li key={key} className="adm-child" data-child={key}>
                <fieldset className="adm-child-set" disabled={disabled}>
                  <legend className="adm-label">
                    {capitalize(model.one)} {n}
                  </legend>
                  <div className="adm-child-grid">
                    {(["en", "ar"] as const).map((locale) =>
                      (["label", "value"] as const).map((part) => (
                        <div className="adm-field" key={`${locale}-${part}`}>
                          <label className="adm-label" htmlFor={`${key}-${locale}-${part}`}>
                            {locale === "en" ? "English" : "Arabic"} {part}
                          </label>
                          <input
                            id={`${key}-${locale}-${part}`}
                            className="adm-input"
                            dir={locale === "ar" ? "rtl" : "ltr"}
                            lang={locale}
                            value={row[locale][part] ?? ""}
                            onChange={(e) => update(index, locale, part, e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                      )),
                    )}
                  </div>
                  <div className="adm-actions">
                    <button type="button" className="adm-btn is-small" data-move="up" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${model.one} ${n} up`}>
                      Up
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-small"
                      data-move="down"
                      onClick={() => move(index, 1)}
                      disabled={index === value.length - 1}
                      aria-label={`Move ${model.one} ${n} down`}
                    >
                      Down
                    </button>
                    <button type="button" className="adm-btn is-small is-danger" onClick={() => remove(index)} aria-label={`Remove ${model.one} ${n}`}>
                      Remove
                    </button>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}
      {!disabled ? (
        <div className="adm-actions">
          <button type="button" id={`${id}-add`} className="adm-btn" onClick={add} disabled={value.length >= model.max}>
            Add {model.one}
          </button>
          <span className="adm-hint">
            At most {model.max}; {model.texts.map((t) => `${t.label}s up to ${t.max} characters`).join(", ")}.
          </span>
        </div>
      ) : null}
      {error ? <p className="adm-hint adm-error">{error}</p> : null}
      <input type="hidden" name="children" value={JSON.stringify(value)} />
      <span className="adm-sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
