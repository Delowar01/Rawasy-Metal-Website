"use client";
/**
 * Media in a content form (A4 brief §52–§56): a single slot (a cover photo, a logo, a share image …) and an ordered list
 * (a project's photos, a certificate's redacted previews). Each shows the chosen items as cards with their state written
 * out, is changed with buttons only (Choose, Remove, Move up / down — no dragging), announces each change politely, and
 * goes out as hidden fields the server validates again (`media.<key>`, `mediaList.<key>` as JSON).
 */
import { useId, useState } from "react";
import type { MediaCardModel, MediaEntryValue, MediaListModel, MediaSlotModel } from "@/server/admin/actions/media-model";
import { MediaSummary } from "./MediaCard";
import { MediaPicker } from "./MediaPicker";

const fieldId = (name: string) => `f-${name.replace(/\./g, "-")}`;
const unavailable = (id: string): MediaCardModel => ({
  id,
  label: "Not available",
  labelAr: null,
  kind: "image",
  visibility: "public",
  status: "pending_review",
  trashed: false,
  ready: false,
  flags: [],
  blocking: false,
  width: null,
  height: null,
  thumb: null,
  unavailable: true,
});

export function MediaSlotField({
  model,
  value,
  cards,
  onChange,
  onCard,
  canUpload,
  disabled,
  error,
}: {
  model: MediaSlotModel;
  value: string;
  cards: Record<string, MediaCardModel>;
  onChange: (id: string) => void;
  onCard: (card: MediaCardModel) => void;
  canUpload: boolean;
  disabled: boolean;
  error?: string;
}) {
  const name = `media.${model.key}`;
  const id = fieldId(name);
  const [announce, setAnnounce] = useState("");
  const card = value ? (cards[value] ?? unavailable(value)) : null;
  return (
    <fieldset className="adm-subset adm-media-slot" aria-describedby={[model.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}>
      <legend className="adm-label">{model.label}</legend>
      <div id={id} tabIndex={-1} className="adm-media-chosen">
        {card ? <MediaSummary card={card} href={`/admin/media/${card.id}`} /> : <p className="adm-muted">None chosen.</p>}
      </div>
      {model.hint ? (
        <p className="adm-hint" id={`${id}-hint`}>
          {model.hint}
        </p>
      ) : null}
      {error ? (
        <p className="adm-hint adm-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
      {!disabled ? (
        <div className="adm-actions">
          <MediaPicker
            label={card ? `Change ${model.label.toLowerCase()}…` : `Choose ${model.label.toLowerCase()}…`}
            title={`Choose ${model.label.toLowerCase()}`}
            kinds={model.kinds}
            canUpload={canUpload}
            exclude={value ? [value] : []}
            onChoose={(chosen) => {
              onCard(chosen);
              onChange(chosen.id);
              setAnnounce(`${model.label}: ${chosen.label} chosen. Save to keep it.`);
            }}
          />
          {card ? (
            <button
              type="button"
              className="adm-btn is-danger"
              onClick={() => {
                onChange("");
                setAnnounce(`${model.label} removed. Save to keep the change.`);
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      <input type="hidden" name={name} value={value} />
      <span className="adm-sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </fieldset>
  );
}

export function MediaListField({
  model,
  value,
  cards,
  onChange,
  onCard,
  canUpload,
  disabled,
  error,
}: {
  model: MediaListModel;
  value: MediaEntryValue[];
  cards: Record<string, MediaCardModel>;
  onChange: (entries: MediaEntryValue[]) => void;
  onCard: (card: MediaCardModel) => void;
  canUpload: boolean;
  disabled: boolean;
  error?: string;
}) {
  const name = `mediaList.${model.key}`;
  const id = fieldId(name);
  const uid = useId();
  const [announce, setAnnounce] = useState("");
  const focusLater = (selector: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
  const move = (index: number, step: -1 | 1) => {
    const next = [...value];
    const [entry] = next.splice(index, 1);
    next.splice(index + step, 0, entry);
    onChange(next);
    const label = (cards[entry.media] ?? unavailable(entry.media)).label;
    setAnnounce(`${label} moved to position ${index + step + 1} of ${next.length}.`);
    const target = index + step;
    const edge = step === -1 ? target === 0 : target === next.length - 1;
    focusLater(`[data-entry="${uid}-${entry.media}"] [data-move="${edge ? (step === -1 ? "down" : "up") : step === -1 ? "up" : "down"}"]`);
  };
  const remove = (index: number) => {
    const entry = value[index];
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    setAnnounce(`${(cards[entry.media] ?? unavailable(entry.media)).label} removed from ${model.label.toLowerCase()}.`);
    focusLater(next[index] ? `[data-entry="${uid}-${next[index].media}"] [data-move="up"], [data-entry="${uid}-${next[index].media}"] button` : `#${CSS.escape(id)}`);
  };
  return (
    <fieldset className="adm-subset adm-media-list" aria-describedby={[model.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}>
      <legend className="adm-label">
        {model.label} <span className="adm-muted">({value.length} of at most {model.max})</span>
      </legend>
      {model.hint ? (
        <p className="adm-hint" id={`${id}-hint`}>
          {model.hint}
        </p>
      ) : null}
      {value.length === 0 ? (
        <p className="adm-muted" id={id} tabIndex={-1}>
          None yet.
        </p>
      ) : (
        <ol className="adm-rel-list" id={id} tabIndex={-1}>
          {value.map((entry, index) => {
            const card = cards[entry.media] ?? unavailable(entry.media);
            const n = index + 1;
            return (
              <li key={entry.media} className="adm-rel-item adm-media-entry" data-entry={`${uid}-${entry.media}`}>
                <span className="adm-rel-pos" aria-hidden="true">
                  {n}.
                </span>
                <MediaSummary card={card} href={`/admin/media/${card.id}`} />
                {model.locales ? (
                  <span className="adm-field adm-media-locale">
                    <label className="adm-label" htmlFor={`${uid}-${entry.media}-locale`}>
                      Language of {model.one} {n}
                    </label>
                    <select
                      id={`${uid}-${entry.media}-locale`}
                      className="adm-input"
                      value={entry.locale ?? ""}
                      disabled={disabled}
                      onChange={(e) => onChange(value.map((v, i) => (i === index ? { ...v, locale: (e.target.value || null) as MediaEntryValue["locale"] } : v)))}
                    >
                      <option value="">Both languages</option>
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </span>
                ) : null}
                {!disabled ? (
                  <span className="adm-rel-buttons">
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
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {error ? (
        <p className="adm-hint adm-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
      {!disabled ? (
        <div className="adm-actions">
          <MediaPicker
            label={`Add ${model.one}…`}
            title={`Add to ${model.label.toLowerCase()}`}
            kinds={model.kinds}
            canUpload={canUpload}
            exclude={value.map((v) => v.media)}
            disabled={value.length >= model.max}
            onChoose={(chosen) => {
              onCard(chosen);
              onChange([...value, { media: chosen.id, locale: null }]);
              setAnnounce(`${chosen.label} added as ${model.one} ${value.length + 1}. Save to keep it.`);
            }}
          />
        </div>
      ) : null}
      <input type="hidden" name={name} value={JSON.stringify(value.map((v) => (model.locales ? { media: v.media, locale: v.locale } : { media: v.media })))} />
      <span className="adm-sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </fieldset>
  );
}
