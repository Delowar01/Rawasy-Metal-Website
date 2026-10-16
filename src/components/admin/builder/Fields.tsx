"use client";
/**
 * The page builder's field editors (A5 brief §13–§23, §34): one control per kind of field the block registry declares —
 * plain text, lines, choices, numbers, values, A4 media, A3 record selections, structured links, repeated items and the
 * design inspector's typed tokens. Every control is a labelled native form control (keyboard and screen reader
 * friendly); Arabic texts are written right to left (`dir="rtl" lang="ar"`); nothing accepts markup, CSS or JSON. What a
 * field may hold is decided again by the server on save; the server's messages show under the field they name.
 */
import { useId, type ReactNode } from "react";
import type { BuilderLocale, Choice, DesignControls, FieldModel, SectionData } from "@/server/admin/actions/builder-model";
import { newBuilderItemId } from "@/server/admin/actions/builder-model";
import { cardWarnings } from "@/server/admin/actions/media-model";
import { MediaBadges, MediaThumb } from "../media/MediaCard";
import { MediaPicker } from "../media/MediaPicker";
import { issuesAt, textDir, useEnv } from "./env";
import { LinkChooser, type LinkValue } from "./LinkChooser";
import { itemDefaults, itemTexts, LANGUAGE, LOCALES } from "./model";
import { RichTextEditor } from "./RichTextEditor";

// --- The frame of one field ------------------------------------------------------------------------------------------------

function FieldFrame({
  id,
  label,
  hint,
  counter,
  path,
  required,
  children,
  group = false,
}: {
  id: string;
  label: string;
  hint?: string;
  counter?: string;
  path: string;
  required?: boolean;
  children: ReactNode;
  group?: boolean;
}) {
  const env = useEnv();
  const problems = issuesAt(env, path);
  const head = (
    <>
      {label}
      {required ? <span className="adm-muted"> (needed for complete)</span> : null}
      {counter ? <span className="adm-bld-count">{counter}</span> : null}
    </>
  );
  return (
    <div className="adm-field adm-bld-field" data-path={path}>
      {group ? (
        <p className="adm-label" id={`${id}-label`}>
          {head}
        </p>
      ) : (
        <label className="adm-label" htmlFor={id}>
          {head}
        </label>
      )}
      {children}
      {hint ? (
        <p className="adm-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {problems.map((message, i) => (
        <p key={i} className="adm-hint adm-error" role="alert">
          {message}
        </p>
      ))}
    </div>
  );
}

const count = (value: string, max: number) => `${[...value].length} / ${max}`;

// --- Text ---------------------------------------------------------------------------------------------------------------------

function TextInput({ field, value, onChange, locale, path }: { field: Extract<FieldModel, { kind: "text" | "textarea" }>; value: unknown; onChange: (v: string) => void; locale: BuilderLocale; path: string }) {
  const id = useId();
  const env = useEnv();
  const text = typeof value === "string" ? value : "";
  const common = {
    id,
    value: text,
    disabled: env.disabled,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-describedby": field.hint ? `${id}-hint` : undefined,
    "aria-invalid": issuesAt(env, path).length ? true : undefined,
    ...textDir(locale),
  };
  return (
    <FieldFrame id={id} label={field.label} hint={field.hint} counter={count(text, field.max)} path={path} required={field.required}>
      {field.kind === "textarea" ? <textarea className="adm-input adm-textarea" rows={3} maxLength={field.max * 2} {...common} /> : <input className="adm-input" type="text" maxLength={field.max * 2} {...common} />}
    </FieldFrame>
  );
}

function LinesInput({ field, value, onChange, locale, path }: { field: Extract<FieldModel, { kind: "lines" }>; value: unknown; onChange: (v: string[]) => void; locale: BuilderLocale; path: string }) {
  const id = useId();
  const env = useEnv();
  const lines = Array.isArray(value) ? (value as string[]) : [];
  return (
    <FieldFrame
      id={id}
      label={field.label}
      hint={field.hint ?? `One per line: at most ${field.maxItems} lines of ${field.maxLength} characters.`}
      counter={`${lines.length} / ${field.maxItems}`}
      path={path}
      required={field.required}
    >
      <textarea
        id={id}
        className="adm-input adm-textarea"
        rows={Math.min(Math.max(lines.length + 1, 3), 10)}
        value={lines.join("\n")}
        disabled={env.disabled}
        onChange={(e) => onChange(e.target.value.split("\n").map((line) => line.replace(/\r/g, "")))}
        onBlur={(e) => onChange(e.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
        aria-describedby={`${id}-hint`}
        {...textDir(locale)}
      />
    </FieldFrame>
  );
}

// --- Choices, numbers, values -------------------------------------------------------------------------------------------------

function EnumInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "enum" }>; value: unknown; onChange: (v: string) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  return (
    <FieldFrame id={id} label={field.adminOnly ? `${field.label} (admin only, never shown publicly)` : field.label} hint={field.hint} path={path}>
      <select id={id} className="adm-input" value={typeof value === "string" ? value : field.default} disabled={env.disabled} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

function BooleanInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "boolean" }>; value: unknown; onChange: (v: boolean) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  return (
    <div className="adm-field adm-bld-field" data-path={path}>
      <label className="adm-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={typeof value === "boolean" ? value : field.default} disabled={env.disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
      {field.hint ? <p className="adm-hint">{field.hint}</p> : null}
      {issuesAt(env, path).map((m, i) => (
        <p key={i} className="adm-hint adm-error" role="alert">
          {m}
        </p>
      ))}
    </div>
  );
}

function IntInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "int" }>; value: unknown; onChange: (v: number) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  return (
    <FieldFrame id={id} label={field.label} hint={field.hint ?? `From ${field.min} to ${field.max}.`} path={path}>
      <input
        id={id}
        className="adm-input adm-input-short"
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        step={1}
        value={typeof value === "number" ? value : field.default}
        disabled={env.disabled}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        aria-describedby={`${id}-hint`}
      />
    </FieldFrame>
  );
}

function ValueInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "value" }>; value: unknown; onChange: (v: string) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  const text = typeof value === "string" ? value : "";
  return (
    <FieldFrame id={id} label={field.adminOnly ? `${field.label} (never shown publicly)` : field.label} hint={field.hint} counter={count(text, field.max)} path={path} required={field.required}>
      <input
        id={id}
        className="adm-input"
        type="text"
        maxLength={field.max * 2}
        value={text}
        disabled={env.disabled}
        onChange={(e) => onChange(e.target.value)}
        dir={field.ltr ? "ltr" : undefined}
        aria-describedby={field.hint ? `${id}-hint` : undefined}
      />
    </FieldFrame>
  );
}

// --- Media --------------------------------------------------------------------------------------------------------------------

function MediaInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "media" }>; value: unknown; onChange: (v: string | null) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  const chosen = typeof value === "string" ? value : null;
  const card = chosen ? env.media[chosen] : undefined;
  const warnings = card ? cardWarnings(card) : chosen ? ["Not available"] : [];
  return (
    <FieldFrame id={id} label={field.label} hint={field.hint} path={path} required={field.required} group>
      <div className="adm-bld-media" role="group" aria-labelledby={`${id}-label`}>
        {chosen && card && !card.unavailable ? (
          <div className="adm-bld-media-card">
            <MediaThumb card={card} size="sm" />
            <span className="adm-bld-media-text">
              <span>{card.label}</span>
              <MediaBadges card={card} />
            </span>
          </div>
        ) : chosen ? (
          <p className="adm-hint">The chosen item is not available here (removed, private or unknown).</p>
        ) : (
          <p className="adm-hint">Nothing chosen yet.</p>
        )}
        {warnings.length ? (
          <p className="adm-hint adm-bld-warn">
            {warnings.join(", ")}: the preview shows a placeholder until the item is approved and deliverable.
          </p>
        ) : null}
        <div className="adm-actions">
          <MediaPicker
            label={chosen ? "Replace…" : "Choose…"}
            title={`Choose: ${field.label}`}
            kinds={field.kinds}
            canUpload={env.canUpload}
            exclude={chosen ? [chosen] : []}
            disabled={env.disabled}
            onChoose={(next) => {
              env.remember(next);
              onChange(next.id);
            }}
          />
          {chosen ? (
            <button type="button" className="adm-btn" disabled={env.disabled} onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </FieldFrame>
  );
}

// --- Record selections -----------------------------------------------------------------------------------------------------------

type Selection = { mode: "manual"; ids: string[] } | { mode: "automatic"; source: string; limit: number; categoryId?: string };

function SelectionInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "selection" }>; value: unknown; onChange: (v: Selection) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  const options = env.options[field.entity] ?? [];
  const current: Selection = (value as Selection | undefined) ?? { mode: "manual", ids: [] };
  const name = (oid: string) => options.find((o) => o.id === oid);
  const ids = current.mode === "manual" ? current.ids : [];
  const addable = options.filter((o) => !o.archived && !ids.includes(o.id));
  const move = (from: number, to: number) => {
    if (current.mode !== "manual" || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ mode: "manual", ids: next });
  };
  return (
    <FieldFrame id={id} label={field.label} hint={field.hint} path={path} group>
      <div className="adm-bld-selection" role="group" aria-labelledby={`${id}-label`}>
        <div className="adm-bld-seg">
          <label className="adm-check">
            <input type="radio" name={`${id}-mode`} checked={current.mode === "manual"} disabled={env.disabled} onChange={() => onChange({ mode: "manual", ids: [] })} />
            <span>Chosen by hand, in this order</span>
          </label>
          <label className="adm-check">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={current.mode === "automatic"}
              disabled={env.disabled}
              onChange={() => onChange({ mode: "automatic", source: field.sources[0], limit: Math.min(field.max, 6) })}
            />
            <span>Automatic</span>
          </label>
        </div>
        {current.mode === "manual" ? (
          <>
            {ids.length ? (
              <ol className="adm-bld-list">
                {ids.map((oid, i) => {
                  const option = name(oid);
                  return (
                    <li key={oid}>
                      <span className="adm-bld-list-name">
                        {option?.label ?? "(no longer exists)"}
                        {option?.archived ? <span className="adm-badge">Archived</span> : null}
                      </span>
                      <span className="adm-bld-list-buttons">
                        <button type="button" className="adm-btn is-small" disabled={env.disabled || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${option?.label ?? "this item"} up`}>
                          Up
                        </button>
                        <button
                          type="button"
                          className="adm-btn is-small"
                          disabled={env.disabled || i === ids.length - 1}
                          onClick={() => move(i, i + 1)}
                          aria-label={`Move ${option?.label ?? "this item"} down`}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="adm-btn is-small"
                          disabled={env.disabled}
                          onClick={() => onChange({ mode: "manual", ids: ids.filter((x) => x !== oid) })}
                          aria-label={`Remove ${option?.label ?? "this item"}`}
                        >
                          Remove
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="adm-hint">Nothing chosen yet.</p>
            )}
            <label className="adm-label" htmlFor={`${id}-add`}>
              Add ({ids.length} of at most {field.max})
            </label>
            <select
              id={`${id}-add`}
              className="adm-input"
              value=""
              disabled={env.disabled || ids.length >= field.max || !addable.length}
              onChange={(e) => e.target.value && onChange({ mode: "manual", ids: [...ids, e.target.value] })}
            >
              <option value="">{addable.length ? "Choose…" : "Nothing more to add"}</option>
              {addable.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="adm-bld-auto">
            <label className="adm-label" htmlFor={`${id}-source`}>
              Which
            </label>
            <select
              id={`${id}-source`}
              className="adm-input"
              value={current.source}
              disabled={env.disabled}
              onChange={(e) => onChange({ mode: "automatic", source: e.target.value, limit: current.limit, ...(e.target.value === "category" ? { categoryId: env.options.project_category[0]?.id } : {}) })}
            >
              {field.sources.map((source) => (
                <option key={source} value={source}>
                  {env.links.sources[source]}
                </option>
              ))}
            </select>
            {current.source === "category" ? (
              <>
                <label className="adm-label" htmlFor={`${id}-category`}>
                  Category
                </label>
                <select
                  id={`${id}-category`}
                  className="adm-input"
                  value={current.categoryId ?? ""}
                  disabled={env.disabled}
                  onChange={(e) => onChange({ ...current, categoryId: e.target.value || undefined })}
                >
                  <option value="">Choose…</option>
                  {env.options.project_category.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="adm-label" htmlFor={`${id}-limit`}>
              At most
            </label>
            <input
              id={`${id}-limit`}
              className="adm-input adm-input-short"
              type="number"
              min={1}
              max={field.max}
              value={current.limit}
              disabled={env.disabled}
              onChange={(e) => onChange({ ...current, limit: Math.max(1, Math.min(field.max, Math.round(Number(e.target.value)) || 1)) })}
            />
          </div>
        )}
      </div>
    </FieldFrame>
  );
}

// --- Links ----------------------------------------------------------------------------------------------------------------------

function LinkInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "link" }>; value: unknown; onChange: (v: LinkValue | null) => void; path: string }) {
  const id = useId();
  return (
    <FieldFrame id={id} label={field.label} hint={field.hint} path={path} required={field.required} group>
      <LinkChooser kinds={field.kinds} value={(value as LinkValue | null) ?? null} onChange={onChange} required={field.required} label={field.label} idBase={id} />
    </FieldFrame>
  );
}

// --- Design -----------------------------------------------------------------------------------------------------------------------

type DesignValue = Record<string, unknown>;

function DesignSelect<T extends string | number>({
  id,
  label,
  choices,
  value,
  onChange,
  disabled,
  defaultLabel = "Block's default",
}: {
  id: string;
  label: string;
  choices: Choice<T>[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  disabled: boolean;
  defaultLabel?: string;
}) {
  return (
    <div className="adm-bld-design-row">
      <label className="adm-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="adm-input"
        value={value === undefined ? "" : String(value)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) return onChange(undefined);
          const choice = choices.find((c) => String(c.value) === raw);
          onChange(choice?.value);
        }}
      >
        <option value="">{defaultLabel}</option>
        {choices.map((c) => (
          <option key={String(c.value)} value={String(c.value)}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const without = (value: DesignValue, key: string, next: unknown) => {
  const out = { ...value };
  if (next === undefined) delete out[key];
  else out[key] = next;
  return out;
};

function DesignInput({ field, value, onChange, path }: { field: Extract<FieldModel, { kind: "design" }>; value: unknown; onChange: (v: DesignValue) => void; path: string }) {
  const id = useId();
  const env = useEnv();
  const c: DesignControls = field.controls;
  const v = (value as DesignValue | undefined) ?? {};
  const set = (key: string) => (next: unknown) => onChange(without(v, key, next));
  const surface = typeof v.surface === "string" ? v.surface : "plain";
  const tones = c.tones?.filter((t) => c.appearance.includes(`${surface}/${t.value}`));
  const motion = v.motion as { preset: string; duration: string; delay: number } | undefined;
  const responsive = (v.responsive as Record<string, Record<string, unknown>> | undefined) ?? {};
  const setOverride = (bp: "tablet" | "mobile", key: string, next: unknown) => {
    const one = without(responsive[bp] ?? {}, key, next);
    const all = { ...responsive, [bp]: one };
    if (!Object.keys(one).length) delete all[bp];
    onChange(without(v, "responsive", Object.keys(all).length ? all : undefined));
  };
  const problems = issuesAt(env, path);
  return (
    <fieldset className="adm-bld-design" data-path={path}>
      <legend className="adm-label">{field.label}</legend>
      <p className="adm-hint">Typed choices from the approved design only; no colours, sizes or CSS can be entered.</p>
      {c.heading || c.roles || c.align || c.measure ? <p className="adm-bld-design-group">Typography</p> : null}
      {c.heading ? <DesignSelect id={`${id}-heading`} label="Heading level" choices={c.heading} value={v.heading as number | undefined} onChange={set("heading")} disabled={env.disabled} /> : null}
      {c.roles ? <DesignSelect id={`${id}-role`} label="Text size role" choices={c.roles} value={v.role as string | undefined} onChange={set("role")} disabled={env.disabled} /> : null}
      {c.align ? <DesignSelect id={`${id}-align`} label="Alignment (start and end follow the language)" choices={c.align} value={v.align as string | undefined} onChange={set("align")} disabled={env.disabled} /> : null}
      {c.measure ? <DesignSelect id={`${id}-measure`} label="Line length" choices={c.measure} value={v.measure as string | undefined} onChange={set("measure")} disabled={env.disabled} /> : null}
      {c.variants || c.columns || c.gap || c.padding || c.width || c.mediaPosition ? <p className="adm-bld-design-group">Layout</p> : null}
      {c.variants ? <DesignSelect id={`${id}-variant`} label="Variant" choices={c.variants} value={v.variant as string | undefined} onChange={set("variant")} disabled={env.disabled} /> : null}
      {c.columns ? <DesignSelect id={`${id}-columns`} label="Columns" choices={c.columns} value={v.columns as number | undefined} onChange={set("columns")} disabled={env.disabled} /> : null}
      {c.gap ? <DesignSelect id={`${id}-gap`} label="Gap" choices={c.gap} value={v.gap as string | undefined} onChange={set("gap")} disabled={env.disabled} /> : null}
      {c.padding ? <DesignSelect id={`${id}-padding`} label="Space above and below" choices={c.padding} value={v.padding as string | undefined} onChange={set("padding")} disabled={env.disabled} /> : null}
      {c.width ? <DesignSelect id={`${id}-width`} label="Width" choices={c.width} value={v.width as string | undefined} onChange={set("width")} disabled={env.disabled} /> : null}
      {c.mediaPosition ? (
        <DesignSelect id={`${id}-media`} label="Media position" choices={c.mediaPosition} value={v.mediaPosition as string | undefined} onChange={set("mediaPosition")} disabled={env.disabled} />
      ) : null}
      {c.surfaces || c.tones || c.border || c.radius || c.shadow ? <p className="adm-bld-design-group">Appearance</p> : null}
      {c.surfaces ? (
        <DesignSelect
          id={`${id}-surface`}
          label="Surface"
          choices={c.surfaces}
          value={v.surface as string | undefined}
          onChange={(next) => {
            // A tone that would not reach AA on the new surface is cleared (the server refuses it anyway).
            let out = without(v, "surface", next);
            if (typeof out.tone === "string" && !c.appearance.includes(`${next ?? "plain"}/${out.tone}`)) out = without(out, "tone", undefined);
            onChange(out);
          }}
          disabled={env.disabled}
        />
      ) : null}
      {tones ? <DesignSelect id={`${id}-tone`} label="Tone (only tones that reach AA contrast on this surface)" choices={tones} value={v.tone as string | undefined} onChange={set("tone")} disabled={env.disabled} /> : null}
      {c.border ? <DesignSelect id={`${id}-border`} label="Border" choices={c.border} value={v.border as string | undefined} onChange={set("border")} disabled={env.disabled} /> : null}
      {c.radius ? <DesignSelect id={`${id}-radius`} label="Corners" choices={c.radius} value={v.radius as string | undefined} onChange={set("radius")} disabled={env.disabled} /> : null}
      {c.shadow ? <DesignSelect id={`${id}-shadow`} label="Shadow" choices={c.shadow} value={v.shadow as string | undefined} onChange={set("shadow")} disabled={env.disabled} /> : null}
      {c.responsive && (c.columns || c.gap || c.padding || c.align || c.mediaPosition) ? (
        <details className="adm-bld-responsive">
          <summary>Tablet and phone</summary>
          <p className="adm-hint">Desktop uses the settings above; tablets (up to 1023 px) and phones (up to 639 px) may change these. Phones also take the tablet&apos;s choice.</p>
          {(["tablet", "mobile"] as const).map((bp) => (
            <div key={bp} className="adm-bld-design-bp">
              <p className="adm-bld-design-group">{bp === "tablet" ? "Tablet" : "Phone"}</p>
              {c.narrowerColumns ? (
                <DesignSelect id={`${id}-${bp}-columns`} label="Columns" choices={c.narrowerColumns} value={responsive[bp]?.columns as number | undefined} onChange={(n) => setOverride(bp, "columns", n)} disabled={env.disabled} defaultLabel="Same as larger screens" />
              ) : null}
              {c.gap ? <DesignSelect id={`${id}-${bp}-gap`} label="Gap" choices={c.gap} value={responsive[bp]?.gap as string | undefined} onChange={(n) => setOverride(bp, "gap", n)} disabled={env.disabled} defaultLabel="Same as larger screens" /> : null}
              {c.padding ? (
                <DesignSelect id={`${id}-${bp}-padding`} label="Space above and below" choices={c.padding} value={responsive[bp]?.padding as string | undefined} onChange={(n) => setOverride(bp, "padding", n)} disabled={env.disabled} defaultLabel="Same as larger screens" />
              ) : null}
              {c.align ? <DesignSelect id={`${id}-${bp}-align`} label="Alignment" choices={c.align} value={responsive[bp]?.align as string | undefined} onChange={(n) => setOverride(bp, "align", n)} disabled={env.disabled} defaultLabel="Same as larger screens" /> : null}
              {c.mediaPosition ? (
                <DesignSelect
                  id={`${id}-${bp}-media`}
                  label="Media position"
                  choices={c.mediaPosition}
                  value={responsive[bp]?.mediaPosition as string | undefined}
                  onChange={(n) => setOverride(bp, "mediaPosition", n)}
                  disabled={env.disabled}
                  defaultLabel="Same as larger screens"
                />
              ) : null}
            </div>
          ))}
        </details>
      ) : null}
      {c.motion ? (
        <>
          <p className="adm-bld-design-group">Motion</p>
          <p className="adm-hint">One-time entrance only; words never fade; everything is still when the visitor asks for reduced motion.</p>
          <DesignSelect
            id={`${id}-motion`}
            label="Entrance"
            choices={c.motion.presets}
            value={motion?.preset}
            onChange={(preset) => onChange(without(v, "motion", preset ? { preset, duration: motion?.duration ?? "2", delay: motion?.delay ?? 0 } : undefined))}
            disabled={env.disabled}
          />
          {motion && motion.preset !== "none" ? (
            <>
              <DesignSelect id={`${id}-duration`} label="Duration" choices={c.motion.durations} value={motion.duration} onChange={(duration) => onChange(without(v, "motion", { ...motion, duration: duration ?? "2" }))} disabled={env.disabled} defaultLabel="Standard" />
              <DesignSelect id={`${id}-delay`} label="Delay" choices={c.motion.delays} value={motion.delay} onChange={(delay) => onChange(without(v, "motion", { ...motion, delay: delay ?? 0 }))} disabled={env.disabled} defaultLabel="None" />
            </>
          ) : null}
        </>
      ) : null}
      {problems.map((m, i) => (
        <p key={i} className="adm-hint adm-error" role="alert">
          {m}
        </p>
      ))}
    </fieldset>
  );
}

// --- One field ---------------------------------------------------------------------------------------------------------------------

/** A content field (one language's text). */
export function ContentFieldEditor({ field, value, onChange, locale, path }: { field: FieldModel; value: unknown; onChange: (v: unknown) => void; locale: BuilderLocale; path: string }) {
  switch (field.kind) {
    case "text":
    case "textarea":
      return <TextInput field={field} value={value} onChange={onChange} locale={locale} path={path} />;
    case "lines":
      return <LinesInput field={field} value={value} onChange={onChange} locale={locale} path={path} />;
    case "rich":
      return <RichTextEditor field={field} value={value} onChange={onChange} locale={locale} path={path} />;
    default:
      return null;
  }
}

/** A settings field (shared by both languages), except repeated items (`ItemsInput`). */
export function SettingFieldEditor({ field, value, onChange, path }: { field: FieldModel; value: unknown; onChange: (v: unknown) => void; path: string }) {
  switch (field.kind) {
    case "enum":
      return <EnumInput field={field} value={value} onChange={onChange} path={path} />;
    case "boolean":
      return <BooleanInput field={field} value={value} onChange={onChange} path={path} />;
    case "int":
      return <IntInput field={field} value={value} onChange={onChange} path={path} />;
    case "value":
      return <ValueInput field={field} value={value} onChange={onChange} path={path} />;
    case "media":
      return <MediaInput field={field} value={value} onChange={onChange} path={path} />;
    case "selection":
      return <SelectionInput field={field} value={value} onChange={onChange} path={path} />;
    case "link":
      return <LinkInput field={field} value={value} onChange={onChange} path={path} />;
    case "design":
      return <DesignInput field={field} value={value} onChange={onChange} path={path} />;
    default:
      return null;
  }
}

// --- Repeated items ---------------------------------------------------------------------------------------------------------------

/**
 * A repeater (A5 brief §15): items keep their ids; their options are shared by both languages and their texts are kept per
 * language under the same ids, so adding, removing or moving an item changes both languages together.
 */
export function ItemsInput({
  field,
  data,
  locale,
  update,
}: {
  field: Extract<FieldModel, { kind: "items" }>;
  data: SectionData;
  locale: BuilderLocale;
  update: (recipe: (d: SectionData) => SectionData) => void;
}) {
  const env = useEnv();
  const id = useId();
  const items = (data.settings[field.key] as Record<string, unknown>[] | undefined) ?? [];
  const texts = (data.content[locale]?.[field.key] as Record<string, Record<string, unknown>> | undefined) ?? {};
  const path = `settings.${field.key}`;
  const setItems = (next: Record<string, unknown>[], content?: (map: Record<string, Record<string, unknown>>, l: BuilderLocale) => Record<string, Record<string, unknown>>) =>
    update((d) => {
      const nextContent = { ...d.content };
      if (content) for (const l of LOCALES) nextContent[l] = { ...(nextContent[l] ?? {}), [field.key]: content({ ...((nextContent[l]?.[field.key] as Record<string, Record<string, unknown>>) ?? {}) }, l) };
      return { ...d, settings: { ...d.settings, [field.key]: next }, content: nextContent };
    });
  const add = () => {
    const item = { id: newBuilderItemId(), ...itemDefaults(field.settings) };
    setItems([...items, item], (map) => ({ ...map, [item.id as string]: itemTexts(field.content) }));
  };
  const remove = (itemId: string) =>
    setItems(
      items.filter((i) => i.id !== itemId),
      (map) => {
        delete map[itemId];
        return map;
      },
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  };
  const setSetting = (index: number, key: string, value: unknown) => setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const setText = (itemId: string, key: string, value: unknown) =>
    update((d) => {
      const map = { ...((d.content[locale]?.[field.key] as Record<string, Record<string, unknown>>) ?? {}) };
      map[itemId] = { ...(map[itemId] ?? {}), [key]: value };
      return { ...d, content: { ...d.content, [locale]: { ...(d.content[locale] ?? {}), [field.key]: map } } };
    });
  const problems = issuesAt(env, path).concat(issuesAt(env, `content.${locale}.${field.key}`));
  return (
    <fieldset className="adm-bld-items" aria-describedby={`${id}-hint`}>
      <legend className="adm-label">{field.label}</legend>
      <p className="adm-hint" id={`${id}-hint`}>
        {items.length} of {field.min > 0 ? `${field.min}–` : "up to "}
        {field.max} {field.one}s. Their order and options are shared by both languages; texts below are the {LANGUAGE[locale]} ones.
      </p>
      {problems.map((m, i) => (
        <p key={i} className="adm-hint adm-error" role="alert">
          {m}
        </p>
      ))}
      <ol className="adm-bld-item-list">
        {items.map((item, index) => {
          const itemId = String(item.id);
          const name = `${field.one[0].toUpperCase()}${field.one.slice(1)} ${index + 1}`;
          return (
            <li key={itemId} className="adm-bld-item">
              <div className="adm-bld-item-head">
                <p className="adm-bld-item-name">{name}</p>
                <span className="adm-bld-list-buttons">
                  <button type="button" className="adm-btn is-small" disabled={env.disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${name} up`}>
                    Up
                  </button>
                  <button type="button" className="adm-btn is-small" disabled={env.disabled || index === items.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${name} down`}>
                    Down
                  </button>
                  <button type="button" className="adm-btn is-small" disabled={env.disabled || items.length <= field.min} onClick={() => remove(itemId)} aria-label={`Remove ${name}`}>
                    Remove
                  </button>
                </span>
              </div>
              {field.settings.map((sub) => (
                <SettingFieldEditor key={sub.key} field={sub} value={item[sub.key]} onChange={(v) => setSetting(index, sub.key, v)} path={`${path}.${index}.${sub.key}`} />
              ))}
              {field.content.map((sub) => (
                <ContentFieldEditor
                  key={sub.key}
                  field={sub}
                  value={texts[itemId]?.[sub.key]}
                  onChange={(v) => setText(itemId, sub.key, v)}
                  locale={locale}
                  path={`content.${locale}.${field.key}.${itemId}.${sub.key}`}
                />
              ))}
            </li>
          );
        })}
      </ol>
      <button type="button" className="adm-btn" disabled={env.disabled || items.length >= field.max} onClick={add}>
        Add a {field.one}
      </button>
    </fieldset>
  );
}
