"use client";
/**
 * An ordered relation (A3 brief §32–§33): the chosen items in order, each with Move up / Move down / Remove buttons,
 * and a list to add from. Archived items that are already linked stay, marked "Archived"; archived items are never
 * offered for adding. A chosen item can carry a dependency note (a service featuring this project: A3 Correction 1).
 * The order goes out as repeated hidden inputs; the server checks every target again.
 */
import { useId, useRef, useState } from "react";
import type { OptionModel, RelationModel } from "@/server/admin/actions/cms-model";

export function RelationPicker({
  name,
  model,
  value,
  onChange,
  disabled,
  error,
}: {
  name: string;
  model: RelationModel;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
  error?: string;
}) {
  const id = useId();
  const [pick, setPick] = useState("");
  const [announce, setAnnounce] = useState("");
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const select = useRef<HTMLSelectElement>(null);
  const byId = new Map(model.options.map((o) => [o.id, o]));
  const chosen: OptionModel[] = value.map((v) => byId.get(v) ?? { id: v, label: "(an item that no longer exists)", slug: null, archived: true });
  const available = model.options.filter((o) => !value.includes(o.id));
  const full = value.length >= model.max;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const focusLater = (key: string) => requestAnimationFrame(() => (buttons.current.get(key) ?? select.current)?.focus());

  const move = (index: number, step: -1 | 1) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + step, 0, item);
    onChange(next);
    const label = byId.get(item)?.label ?? "Item";
    setAnnounce(`${label} moved to position ${index + step + 1} of ${next.length}.`);
    const target = index + step;
    focusLater(`${item}:${step === -1 ? (target === 0 ? "down" : "up") : target === next.length - 1 ? "up" : "down"}`);
  };
  const remove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    setAnnounce(`${byId.get(value[index])?.label ?? "Item"} removed.`);
    const neighbour = next[index] ?? next[index - 1];
    focusLater(neighbour ? `${neighbour}:remove` : "");
  };
  const add = () => {
    if (!pick || full) return;
    onChange([...value, pick]);
    setAnnounce(`${byId.get(pick)?.label ?? "Item"} added at position ${value.length + 1}.`);
    setPick("");
  };

  return (
    <fieldset className="adm-rel" disabled={disabled} aria-describedby={[model.hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined}>
      <legend className="adm-label">
        {model.label} <span className="adm-muted adm-rel-count">({value.length} of at most {model.max})</span>
      </legend>
      {model.hint ? (
        <p className="adm-hint" id={hintId}>
          {model.hint}
        </p>
      ) : null}
      {chosen.length ? (
        <ol className="adm-rel-list" id={`f-${name.replace(/\./g, "-")}`} tabIndex={-1}>
          {chosen.map((option, index) => (
            <li key={option.id} className="adm-rel-item">
              <span className="adm-rel-name">
                <span className="adm-rel-pos" aria-hidden="true">
                  {index + 1}.
                </span>{" "}
                {option.label}
                {option.slug ? <span className="adm-muted adm-mono"> {option.slug}</span> : null}
                {option.archived ? <span className="adm-badge is-warning">Archived</span> : null}
                {option.note ? <span className="adm-badge">{option.note}</span> : null}
              </span>
              <span className="adm-rel-buttons">
                <button
                  type="button"
                  className="adm-btn is-small"
                  ref={(el) => void buttons.current.set(`${option.id}:up`, el)}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${option.label} up`}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="adm-btn is-small"
                  ref={(el) => void buttons.current.set(`${option.id}:down`, el)}
                  onClick={() => move(index, 1)}
                  disabled={index === chosen.length - 1}
                  aria-label={`Move ${option.label} down`}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="adm-btn is-small is-danger"
                  ref={(el) => void buttons.current.set(`${option.id}:remove`, el)}
                  onClick={() => remove(index)}
                  aria-label={`Remove ${option.label}`}
                >
                  Remove
                </button>
              </span>
              <input type="hidden" name={name} value={option.id} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-muted" id={`f-${name.replace(/\./g, "-")}`} tabIndex={-1}>
          None chosen.
        </p>
      )}
      {model.options.length === 0 && model.emptyNote ? <p className="adm-hint">{model.emptyNote}</p> : null}
      {!disabled && model.options.length ? (
        <div className="adm-rel-add">
          <label className="adm-sr-only" htmlFor={`${id}-add`}>
            Add to {model.label.toLowerCase()}
          </label>
          <select id={`${id}-add`} ref={select} className="adm-input" value={pick} onChange={(e) => setPick(e.target.value)} disabled={full}>
            <option value="">{full ? `At most ${model.max}` : `Add to ${model.label.toLowerCase()}…`}</option>
            {available.map((option) => (
              <option key={option.id} value={option.id} disabled={option.archived}>
                {option.label}
                {option.slug ? ` (${option.slug})` : ""}
                {option.archived ? " — archived, restore it first" : ""}
              </option>
            ))}
          </select>
          <button type="button" className="adm-btn" onClick={add} disabled={!pick || full}>
            Add
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="adm-hint adm-error" id={errorId}>
          {error}
        </p>
      ) : null}
      <span className="adm-sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </fieldset>
  );
}
