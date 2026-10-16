"use client";
/**
 * A service's captioned gallery (A4; A1 `service_gallery_items`): photos in order, each with its caption per language
 * (the caption names the photo, so it is needed for a language to be complete) and an optional alt text — not written
 * yet, decorative (the caption already names it), or written. Photos are chosen with the media picker; an entry keeps its
 * photo (to change one, remove the entry and add the new photo). Buttons only (Up, Down, Remove), changes announced;
 * the list goes out as one JSON field the server validates strictly.
 */
import { useId, useState } from "react";
import type { ChildrenModel, ChildValues } from "@/server/admin/actions/cms-model";
import type { MediaCardModel } from "@/server/admin/actions/media-model";
import { MediaSummary } from "./MediaCard";
import { MediaPicker } from "./MediaPicker";

type AltMode = "unset" | "decorative" | "text";
const modeOf = (value: string | null | undefined): AltMode => (value === null || value === undefined ? "unset" : value === "" ? "decorative" : "text");

const LOCALES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
] as const;

export function GalleryRows({
  model,
  value,
  cards,
  onChange,
  onCard,
  canUpload,
  disabled,
  error,
}: {
  model: ChildrenModel;
  value: ChildValues[];
  cards: Record<string, MediaCardModel>;
  onChange: (rows: ChildValues[]) => void;
  onCard: (card: MediaCardModel) => void;
  canUpload: boolean;
  disabled: boolean;
  error?: string;
}) {
  const uid = useId();
  const [announce, setAnnounce] = useState("");
  // Typed alt texts survive switching the mode away and back (only "Written" sends them).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const focusLater = (selector: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
  const keyOf = (row: ChildValues) => `${uid}-${row.media}`;
  const cardOf = (media: string | null | undefined): MediaCardModel | null => (media ? (cards[media] ?? null) : null);

  const update = (index: number, locale: "en" | "ar", patch: Record<string, string | null>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, [locale]: { ...row[locale], ...patch } } : row)));
  const move = (index: number, step: -1 | 1) => {
    const next = [...value];
    const [row] = next.splice(index, 1);
    next.splice(index + step, 0, row);
    onChange(next);
    setAnnounce(`Photo moved to position ${index + step + 1} of ${next.length}.`);
    const target = index + step;
    const edge = step === -1 ? target === 0 : target === next.length - 1;
    focusLater(`[data-entry="${keyOf(row)}"] [data-move="${edge ? (step === -1 ? "down" : "up") : step === -1 ? "up" : "down"}"]`);
  };
  const remove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    setAnnounce(`Photo ${index + 1} removed from the gallery.`);
    focusLater(next[index] ? `[data-entry="${keyOf(next[index])}"] input` : `#f-children`);
  };

  return (
    <div className="adm-children">
      <p className="adm-hint">{model.hint}</p>
      {value.length === 0 ? (
        <p className="adm-muted" id="f-children" tabIndex={-1}>
          No photos in the gallery yet.
        </p>
      ) : (
        <ol className="adm-child-list" id="f-children" tabIndex={-1}>
          {value.map((row, index) => {
            const n = index + 1;
            const card = cardOf(row.media);
            return (
              <li key={keyOf(row)} className="adm-child" data-entry={keyOf(row)}>
                <fieldset className="adm-child-set" disabled={disabled}>
                  <legend className="adm-label">Photo {n}</legend>
                  {card ? <MediaSummary card={card} href={`/admin/media/${card.id}`} /> : <p className="adm-muted">Photo not available.</p>}
                  <div className="adm-child-grid">
                    {LOCALES.map((locale) => {
                      const base = `f-children-${index}-${locale.code}`;
                      const alt = row[locale.code].alt;
                      const mode = modeOf(alt);
                      const draftKey = `${keyOf(row)}-${locale.code}`;
                      return (
                        <div className="adm-gallery-locale" key={locale.code}>
                          <div className="adm-field">
                            <label className="adm-label" htmlFor={`${base}-caption`}>
                              {locale.name} caption <span className="adm-muted">(needed for complete)</span>
                            </label>
                            <input
                              id={`${base}-caption`}
                              className="adm-input"
                              dir={locale.code === "ar" ? "rtl" : "ltr"}
                              lang={locale.code}
                              value={row[locale.code].caption ?? ""}
                              maxLength={(model.texts.find((t) => t.key === "caption")?.max ?? 300) * 2}
                              onChange={(e) => update(index, locale.code, { caption: e.target.value })}
                              autoComplete="off"
                            />
                          </div>
                          <div className="adm-field">
                            <label className="adm-label" htmlFor={`${base}-altmode`}>
                              {locale.name} alt text
                            </label>
                            <select
                              id={`${base}-altmode`}
                              className="adm-input"
                              value={mode}
                              onChange={(e) => {
                                const next = e.target.value as AltMode;
                                if (mode === "text") setDrafts((d) => ({ ...d, [draftKey]: alt ?? "" }));
                                update(index, locale.code, { alt: next === "unset" ? null : next === "decorative" ? "" : (drafts[draftKey] ?? "") || " " });
                              }}
                            >
                              <option value="unset">Not written yet</option>
                              <option value="decorative">Decorative (the caption names the photo)</option>
                              <option value="text">Written</option>
                            </select>
                          </div>
                          {mode === "text" ? (
                            <div className="adm-field">
                              <label className="adm-label" htmlFor={`${base}-alt`}>
                                {locale.name} alt text, written
                              </label>
                              <input
                                id={`${base}-alt`}
                                className="adm-input"
                                dir={locale.code === "ar" ? "rtl" : "ltr"}
                                lang={locale.code}
                                value={(alt ?? "").trim() === "" ? "" : (alt ?? "")}
                                onChange={(e) => update(index, locale.code, { alt: e.target.value === "" ? " " : e.target.value })}
                                autoComplete="off"
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="adm-actions">
                    <button type="button" className="adm-btn is-small" data-move="up" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move photo ${n} up`}>
                      Up
                    </button>
                    <button type="button" className="adm-btn is-small" data-move="down" onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label={`Move photo ${n} down`}>
                      Down
                    </button>
                    <button type="button" className="adm-btn is-small is-danger" onClick={() => remove(index)} aria-label={`Remove photo ${n}`}>
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
          <MediaPicker
            label="Add a photo…"
            title="Add a photo to the gallery"
            kinds={["image"]}
            canUpload={canUpload}
            exclude={value.map((r) => r.media ?? "")}
            disabled={value.length >= model.max}
            onChoose={(card) => {
              onCard(card);
              onChange([...value, { id: null, media: card.id, en: { caption: "", alt: null }, ar: { caption: "", alt: null } }]);
              setAnnounce(`${card.label} added as photo ${value.length + 1}. Write its captions, then save.`);
              focusLater(`#f-children-${value.length}-en-caption`);
            }}
          />
          <span className="adm-hint">At most {model.max} photos.</span>
        </div>
      ) : null}
      {error ? <p className="adm-hint adm-error">{error}</p> : null}
      <input type="hidden" name="children" value={JSON.stringify(value.map((r) => ({ id: r.id, media: r.media, en: r.en, ar: r.ar })))} />
      <span className="adm-sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
