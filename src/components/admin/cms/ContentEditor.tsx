"use client";
/**
 * The Core CMS editor (A3 brief §18): one form per item with General, English, العربية, the item's own lists,
 * Relations and SEO, saved as a draft (never published). Fields are controlled and the form is sent with the version it
 * was opened with, so a refused save — stale, invalid, denied — keeps every typed value in place for the person to
 * compare or copy (§41); a successful save opens the item again from what is stored. Arabic inputs are right to left;
 * the admin itself stays English (§47). Leaving with unsaved changes asks first (§48).
 *
 * A4: the type's media — slots (a cover photo, a logo …), ordered lists (a project's photos, a certificate's redacted
 * previews) and a service's captioned gallery — are chosen with the media picker and saved with the rest of the form;
 * choosing an item never approves or publishes it. Alt texts are "not written yet", "decorative" or written.
 */
import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { saveContentAction } from "@/server/admin/actions/cms";
import {
  contentIdle,
  LOCALE_STATE_TEXT,
  type ChildValues,
  type CmsLocale,
  type CmsLocaleState,
  type EditorModel,
  type EditorValues,
  type RootFieldModel,
  type TextFieldModel,
} from "@/server/admin/actions/cms-model";
import type { MediaCardModel } from "@/server/admin/actions/media-model";
import { GalleryRows } from "../media/GalleryRows";
import { MediaListField, MediaSlotField } from "../media/MediaFields";
import { ChildRows } from "./ChildRows";
import { RelationPicker } from "./RelationPicker";
import { useUnsavedChanges } from "./useUnsavedChanges";

const LOCALES: { code: CmsLocale; name: string; heading: string; anchor: string }[] = [
  { code: "en", name: "English", heading: "English", anchor: "english" },
  { code: "ar", name: "Arabic", heading: "العربية", anchor: "arabic" },
];

const fieldId = (name: string) => `f-${name.replace(/\./g, "-")}`;

/** A slug suggestion from typed text (the server checks the slug again and never rewrites one silently). */
const suggestSlug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

const STATE_BADGE: Record<CmsLocaleState, string> = {
  missing: "is-danger",
  incomplete: "is-warning",
  draft: "",
  complete: "is-success",
  needs_review: "is-warning",
};

export function LocaleBadge({ locale, state }: { locale: CmsLocale; state: CmsLocaleState }) {
  return (
    <span className={`adm-badge ${STATE_BADGE[state]}`.trim()}>
      {locale.toUpperCase()} {LOCALE_STATE_TEXT[state]}
    </span>
  );
}

export interface EditorSection {
  id: string;
  label: string;
}

export function ContentEditor({
  model,
  initial,
  id,
  lockVersion,
  states,
  pageChoice,
  latestHref,
  extraSections = [],
}: {
  model: EditorModel;
  initial: EditorValues;
  id: string | null;
  lockVersion: number | null;
  states: Record<CmsLocale, CmsLocaleState> | null;
  pageChoice?: string;
  latestHref?: string;
  extraSections?: EditorSection[];
}) {
  const [values, setValues] = useState(initial);
  const [otherUnaffected, setOtherUnaffected] = useState(false);
  // Cards of the media this form shows: the stored ones from the server, plus each item chosen since.
  const [cards, setCards] = useState<Record<string, MediaCardModel>>(model.mediaCards);
  const addCard = (card: MediaCardModel) => setCards((c) => ({ ...c, [card.id]: card }));
  const [state, dispatch, pending] = useActionState(saveContentAction, contentIdle);
  const alertRef = useRef<HTMLDivElement>(null);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  useUnsavedChanges(dirty && model.editable);
  useEffect(() => {
    if (state.status !== "idle") alertRef.current?.focus();
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : {};
  const editable = model.editable;
  const set = (patch: Partial<EditorValues>) => setValues((v) => ({ ...v, ...patch }));
  const setText = (locale: CmsLocale, key: string, text: string) => setValues((v) => ({ ...v, [locale]: { ...v[locale], [key]: text } }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable || pending) return;
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };

  const contentFields = model.fields.filter((f) => !f.seo);
  const seoFields = model.fields.filter((f) => f.seo);
  // The share image belongs with the SEO fields; every other media slot and list goes in the Media section.
  const shareSlot = model.seo ? model.mediaSlots.find((m) => m.key === "ogImageMediaId") : undefined;
  const mediaSlots = model.mediaSlots.filter((m) => m !== shareSlot);
  const hasMedia = mediaSlots.length > 0 || model.mediaLists.length > 0;
  const slotField = (slot: (typeof model.mediaSlots)[number]) => (
    <MediaSlotField
      key={slot.key}
      model={slot}
      value={values.media[slot.key] ?? ""}
      cards={cards}
      onChange={(mediaId) => set({ media: { ...values.media, [slot.key]: mediaId } })}
      onCard={addCard}
      canUpload={model.canUpload}
      disabled={!editable}
      error={errors[`media.${slot.key}`]}
    />
  );
  const sections: EditorSection[] = [
    { id: "general", label: "General" },
    { id: "english", label: "English" },
    { id: "arabic", label: "العربية" },
    ...(hasMedia ? [{ id: "media", label: "Media" }] : []),
    ...(model.children ? [{ id: model.children.key, label: model.children.label }] : []),
    ...(model.relations.length ? [{ id: "relations", label: "Relations" }] : []),
    ...(model.seo ? [{ id: "seo", label: "SEO" }] : []),
    ...extraSections,
  ];
  const missingRequired = (locale: CmsLocale) => model.fields.filter((f) => f.required && !values[locale][f.key]?.trim()).map((f) => f.label);

  return (
    <form className="adm-editor" onSubmit={onSubmit} noValidate aria-describedby={state.status !== "idle" ? "editor-alert" : undefined}>
      <input type="hidden" name="_type" value={model.type} />
      {id ? <input type="hidden" name="_id" value={id} /> : null}
      {pageChoice ? <input type="hidden" name="_page" value={pageChoice} /> : null}
      {lockVersion !== null ? <input type="hidden" name="lockVersion" value={lockVersion} /> : null}

      <nav className="adm-editor-nav" aria-label="Sections of this form">
        <ul>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} lang={section.id === "arabic" ? "ar" : undefined}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {model.readOnlyReason ? (
        <div className="adm-alert is-info" role="note">
          <p>{model.readOnlyReason}</p>
        </div>
      ) : null}

      <div id="editor-alert" ref={alertRef} tabIndex={-1} className="adm-editor-alert">
        {state.status === "invalid" ? (
          <div className="adm-alert is-error" role="alert">
            <p>
              <strong>{state.message}</strong>
            </p>
            <ul className="adm-error-list">
              {Object.entries(state.errors).map(([name, message]) => (
                <li key={name}>
                  <a href={`#${fieldId(name)}`}>{message}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {state.status === "stale" ? (
          <div className="adm-alert is-error" role="alert">
            <p>
              <strong>{state.message}</strong>
            </p>
            <p>Nothing was saved. Your changes are still in this form, so you can copy them before reloading.</p>
            <div className="adm-actions">
              {latestHref ? (
                <a className="adm-btn is-small" href={latestHref} target="_blank" rel="noopener">
                  Open the latest version in a new tab
                </a>
              ) : null}
              {latestHref ? (
                <a className="adm-btn is-small" href={latestHref}>
                  Reload (discards my changes)
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="adm-alert is-error" role="alert">
            <p>{state.message}</p>
          </div>
        ) : null}
      </div>

      <fieldset className="adm-editor-body" disabled={!editable}>
        <legend className="adm-sr-only">{model.one}</legend>

        <section className="adm-card" id="general" aria-labelledby="general-title">
          <h2 id="general-title">General</h2>
          {model.page ? (
            <dl className="adm-dl">
              <dt>Page type</dt>
              <dd>
                {model.page.typeLabel}
                {model.page.pageType !== "generic" ? <span className="adm-muted"> — fixed at creation; a fixed page is never turned into a generic one.</span> : null}
              </dd>
              <dt>Route intent</dt>
              <dd className="adm-mono">{model.page.route}</dd>
            </dl>
          ) : null}
          {model.slug ? (
            <TextInput
              name="slug"
              label="Slug"
              value={values.slug}
              onChange={(slug) => set({ slug })}
              hint={model.slug.hint}
              error={errors.slug}
              dir="ltr"
              mono
              after={
                editable && !values.slug && (values.en.title || values.en.name || values.en.label) ? (
                  <button
                    type="button"
                    className="adm-link-btn"
                    onClick={() => set({ slug: suggestSlug(values.en.title || values.en.name || values.en.label || "") })}
                  >
                    Suggest from the English title
                  </button>
                ) : null
              }
            />
          ) : null}
          {model.root.map((field) => (
            <RootInput key={field.key} field={field} value={values.root[field.key]} onChange={(v) => set({ root: { ...values.root, [field.key]: v } })} error={errors[field.key]} />
          ))}
          {model.source ? (
            <fieldset className="adm-subset">
              <legend className="adm-label">Source (admin only, never shown)</legend>
              <div className="adm-field">
                <label className="adm-label" htmlFor={fieldId("sourceBasis")}>
                  Where the facts come from
                </label>
                <select
                  id={fieldId("sourceBasis")}
                  name="sourceBasis"
                  className="adm-input"
                  value={values.source.sourceBasis}
                  onChange={(e) => set({ source: { ...values.source, sourceBasis: e.target.value } })}
                  aria-invalid={errors.sourceBasis ? true : undefined}
                >
                  <option value="">Not recorded</option>
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errors.sourceBasis ? <p className="adm-hint adm-error">{errors.sourceBasis}</p> : null}
              </div>
              <TextInput
                name="sourcePages"
                label="Pages"
                value={values.source.sourcePages}
                onChange={(sourcePages) => set({ source: { ...values.source, sourcePages } })}
                hint="Pages of the source, e.g. 7 or 8-11."
                error={errors.sourcePages}
                dir="ltr"
                inputMode="numeric"
              />
              <TextArea
                name="sourceNote"
                label="Notes"
                value={values.source.sourceNote}
                onChange={(sourceNote) => set({ source: { ...values.source, sourceNote } })}
                error={errors.sourceNote}
                rows={2}
              />
            </fieldset>
          ) : null}
        </section>

        {LOCALES.map((locale) => (
          <section className="adm-card" id={locale.anchor} key={locale.code} aria-labelledby={`${locale.anchor}-title`}>
            <div className="adm-card-head">
              <h2 id={`${locale.anchor}-title`} lang={locale.code}>
                {locale.heading}
              </h2>
              {states ? <LocaleBadge locale={locale.code} state={states[locale.code]} /> : <LocaleBadge locale={locale.code} state="missing" />}
            </div>
            {contentFields.map((field) =>
              field.kind === "alt" ? (
                <AltField
                  key={field.key}
                  field={field}
                  locale={locale.code}
                  mode={(values[locale.code][`${field.key}Mode`] as AltMode | undefined) ?? "unset"}
                  value={values[locale.code][field.key] ?? ""}
                  onMode={(mode) => setText(locale.code, `${field.key}Mode`, mode)}
                  onChange={(t) => setText(locale.code, field.key, t)}
                  error={errors[`${locale.code}.${field.key}`]}
                />
              ) : (
                <LocaleField key={field.key} field={field} locale={locale.code} value={values[locale.code][field.key] ?? ""} onChange={(t) => setText(locale.code, field.key, t)} error={errors[`${locale.code}.${field.key}`]} />
              ),
            )}
            <div className="adm-field">
              <label className="adm-check" htmlFor={fieldId(`${locale.code}.complete`)}>
                <input
                  type="checkbox"
                  id={fieldId(`${locale.code}.complete`)}
                  name={`${locale.code}.complete`}
                  value="1"
                  checked={values.complete[locale.code]}
                  onChange={(e) => set({ complete: { ...values.complete, [locale.code]: e.target.checked } })}
                  aria-describedby={`${fieldId(`${locale.code}.complete`)}-hint`}
                  aria-invalid={errors[`${locale.code}.complete`] ? true : undefined}
                />
                <span>{locale.name} is complete</span>
              </label>
              <p className="adm-hint" id={`${fieldId(`${locale.code}.complete`)}-hint`}>
                {missingRequired(locale.code).length
                  ? `Still needed before ${locale.name} can be marked complete: ${missingRequired(locale.code).join(", ")}.`
                  : `Every required ${locale.name} field is filled. ${locale.name} is never required just to save a draft.`}
              </p>
              {errors[`${locale.code}.complete`] ? <p className="adm-hint adm-error">{errors[`${locale.code}.complete`]}</p> : null}
            </div>
          </section>
        ))}

        {id && editable ? (
          <div className="adm-card adm-editor-review">
            <label className="adm-check" htmlFor="f-otherUnaffected">
              <input type="checkbox" id="f-otherUnaffected" name="otherUnaffected" value="1" checked={otherUnaffected} onChange={(e) => setOtherUnaffected(e.target.checked)} />
              <span>This change does not affect the other language (for example, a typo fix)</span>
            </label>
            <p className="adm-hint">Otherwise, changing one language of an item whose other language is complete marks that language “Needs review”.</p>
          </div>
        ) : null}

        {hasMedia ? (
          <section className="adm-card" id="media" aria-labelledby="media-title">
            <h2 id="media-title">Media</h2>
            <p className="adm-hint">
              Choosing an item only links it to this draft: it never approves or publishes the item. Items not yet approved show why, and publishing (A8) will refuse
              them.
            </p>
            {mediaSlots.map(slotField)}
            {model.mediaLists.map((list) => (
              <MediaListField
                key={list.key}
                model={list}
                value={values.mediaLists[list.key] ?? []}
                cards={cards}
                onChange={(entries) => set({ mediaLists: { ...values.mediaLists, [list.key]: entries } })}
                onCard={addCard}
                canUpload={model.canUpload}
                disabled={!editable}
                error={errors[`mediaList.${list.key}`]}
              />
            ))}
          </section>
        ) : null}

        {model.children ? (
          <section className="adm-card" id={model.children.key} aria-labelledby={`${model.children.key}-title`}>
            <h2 id={`${model.children.key}-title`}>{model.children.label}</h2>
            {model.children.media ? (
              <GalleryRows
                model={model.children}
                value={values.children}
                cards={cards}
                onChange={(children: ChildValues[]) => set({ children })}
                onCard={addCard}
                canUpload={model.canUpload}
                disabled={!editable}
                error={errors.children}
              />
            ) : (
              <ChildRows model={model.children} value={values.children} onChange={(children: ChildValues[]) => set({ children })} disabled={!editable} error={errors.children} />
            )}
          </section>
        ) : null}

        {model.relations.length ? (
          <section className="adm-card" id="relations" aria-labelledby="relations-title">
            <h2 id="relations-title">Relations</h2>
            {model.relations.map((relation) => (
              <RelationPicker
                key={relation.key}
                name={`rel.${relation.key}`}
                model={relation}
                value={values.rel[relation.key] ?? []}
                onChange={(ids) => set({ rel: { ...values.rel, [relation.key]: ids } })}
                disabled={!editable}
                error={errors[`rel.${relation.key}`]}
              />
            ))}
          </section>
        ) : null}

        {model.seo ? (
          <section className="adm-card" id="seo" aria-labelledby="seo-title">
            <h2 id="seo-title">SEO</h2>
            <p className="adm-hint">Per-language titles and descriptions for search and sharing. Empty fields fall back to the title and summary.</p>
            {shareSlot ? slotField(shareSlot) : null}
            {LOCALES.map((locale) => (
              <fieldset className="adm-subset" key={locale.code}>
                <legend className="adm-label" lang={locale.code}>
                  {locale.heading}
                </legend>
                {seoFields.map((field) => (
                  <LocaleField key={field.key} field={field} locale={locale.code} value={values[locale.code][field.key] ?? ""} onChange={(t) => setText(locale.code, field.key, t)} error={errors[`${locale.code}.${field.key}`]} />
                ))}
              </fieldset>
            ))}
            <fieldset className="adm-subset" disabled={!model.seo.canAdvanced}>
              <legend className="adm-label">Indexing (robots, sitemap, canonical)</legend>
              {model.seo.canAdvanced ? <input type="hidden" name="seo.advanced" value="1" /> : <p className="adm-hint">Only roles with the advanced SEO permission (Owner, Admin) can change these.</p>}
              {(
                [
                  ["robotsIndex", "Search engines may index this page"],
                  ["robotsFollow", "Search engines may follow its links"],
                  ["inSitemap", "Include it in the sitemap"],
                ] as const
              ).map(([key, label]) => (
                <label className="adm-check" key={key} htmlFor={fieldId(`seo.${key}`)}>
                  <input
                    type="checkbox"
                    id={fieldId(`seo.${key}`)}
                    name={`seo.${key}`}
                    value="1"
                    checked={values.seo[key]}
                    onChange={(e) => set({ seo: { ...values.seo, [key]: e.target.checked } })}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <TextInput
                name="seo.canonicalOverride"
                label="Canonical path override"
                value={values.seo.canonicalOverride}
                onChange={(canonicalOverride) => set({ seo: { ...values.seo, canonicalOverride } })}
                hint="Only when this page should point search engines to another page of this site, e.g. /services/laser-cutting. Usually empty."
                error={errors["seo.canonicalOverride"]}
                dir="ltr"
                mono
              />
            </fieldset>
          </section>
        ) : null}
      </fieldset>

      {editable ? (
        <div className="adm-savebar">
          <span className="adm-savebar-status" role="status">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : id ? "No unsaved changes" : "Not saved yet"}
          </span>
          <div className="adm-actions">
            <Link className="adm-btn" href={model.path}>
              Cancel
            </Link>
            <button type="submit" className="adm-btn is-primary" disabled={pending} aria-disabled={pending}>
              {pending ? "Saving…" : id ? "Save draft" : `Create ${model.one}`}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

const SOURCE_OPTIONS = [
  { value: "profile", label: "Company profile" },
  { value: "licence", label: "Licence or registration" },
  { value: "owner", label: "Confirmed by RAWASY" },
  { value: "inferred", label: "Inferred (website classification)" },
  { value: "other", label: "Other" },
];

function Described({ name, hint, error, children, counter }: { name: string; hint?: ReactNode; error?: string; children: ReactNode; counter?: ReactNode }) {
  const id = fieldId(name);
  return (
    <>
      {children}
      {hint || counter ? (
        <p className="adm-hint" id={`${id}-hint`}>
          {hint}
          {hint && counter ? " " : null}
          {counter}
        </p>
      ) : null}
      {error ? (
        <p className="adm-hint adm-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </>
  );
}

const describedBy = (name: string, hint: boolean, error?: string) =>
  [hint ? `${fieldId(name)}-hint` : "", error ? `${fieldId(name)}-error` : ""].filter(Boolean).join(" ") || undefined;

function TextInput({
  name,
  label,
  value,
  onChange,
  hint,
  error,
  dir,
  lang,
  mono = false,
  inputMode,
  after,
  counter,
}: {
  name: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  dir?: "ltr" | "rtl";
  lang?: string;
  mono?: boolean;
  inputMode?: "numeric" | "url";
  after?: ReactNode;
  counter?: ReactNode;
}) {
  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={fieldId(name)}>
        {label}
      </label>
      <Described name={name} hint={hint} error={error} counter={counter}>
        <input
          id={fieldId(name)}
          name={name}
          className={`adm-input${mono ? " adm-mono" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          lang={lang}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={mono ? false : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, Boolean(hint || counter), error)}
        />
      </Described>
      {after}
    </div>
  );
}

function TextArea({
  name,
  label,
  value,
  onChange,
  hint,
  error,
  dir,
  lang,
  rows = 4,
  counter,
}: {
  name: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  dir?: "ltr" | "rtl";
  lang?: string;
  rows?: number;
  counter?: ReactNode;
}) {
  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={fieldId(name)}>
        {label}
      </label>
      <Described name={name} hint={hint} error={error} counter={counter}>
        <textarea
          id={fieldId(name)}
          name={name}
          className="adm-input adm-textarea"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          lang={lang}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, Boolean(hint || counter), error)}
        />
      </Described>
    </div>
  );
}

const SEO_GUIDE: Record<string, number> = { seoTitle: 60, ogTitle: 60, seoDescription: 160, ogDescription: 160 };

type AltMode = "unset" | "decorative" | "text";

/** An alt text (A4): not written yet, decorative, or written — the mode is sent beside the text (`<field>Mode`). */
function AltField({
  field,
  locale,
  mode,
  value,
  onMode,
  onChange,
  error,
}: {
  field: TextFieldModel;
  locale: CmsLocale;
  mode: AltMode;
  value: string;
  onMode: (mode: AltMode) => void;
  onChange: (value: string) => void;
  error?: string;
}) {
  const name = `${locale}.${field.key}`;
  const modeName = `${locale}.${field.key}Mode`;
  return (
    <fieldset className="adm-subset">
      <legend className="adm-label">{field.label}</legend>
      <div className="adm-field">
        <label className="adm-label" htmlFor={fieldId(modeName)}>
          Alt text
        </label>
        <select id={fieldId(modeName)} name={modeName} className="adm-input" value={mode} onChange={(e) => onMode(e.target.value as AltMode)}>
          <option value="unset">Not written yet</option>
          <option value="decorative">Decorative (no alt text)</option>
          <option value="text">Written</option>
        </select>
      </div>
      {mode === "text" ? (
        <TextInput
          name={name}
          label="Written alt text"
          value={value}
          onChange={onChange}
          hint={[field.hint, `At most ${field.max} characters. Describe what the photo shows; never a number or a name it doesn't show.`].filter(Boolean).join(" ")}
          error={error}
          dir={locale === "ar" ? "rtl" : "ltr"}
          lang={locale}
        />
      ) : (
        <>
          {field.hint ? <p className="adm-hint">{field.hint}</p> : null}
          {error ? <p className="adm-hint adm-error">{error}</p> : null}
        </>
      )}
    </fieldset>
  );
}

function LocaleField({ field, locale, value, onChange, error }: { field: TextFieldModel; locale: CmsLocale; value: string; onChange: (v: string) => void; error?: string }) {
  const name = `${locale}.${field.key}`;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const length = [...value].length;
  const guide = SEO_GUIDE[field.key];
  const counter =
    field.kind === "line" || field.kind === "text" ? (
      <span className={length > field.max || (guide && length > guide) ? "adm-count is-over" : "adm-count"}>
        {length} / {guide ? `${guide} suggested, ${field.max} at most` : field.max}
      </span>
    ) : null;
  const label = (
    <>
      {field.label}
      {field.required ? <span className="adm-muted"> (needed for complete)</span> : null}
    </>
  );
  const hint = [
    field.hint,
    field.kind === "rich" ? "Plain text: leave a blank line between paragraphs. No HTML." : null,
    field.kind === "lines" ? `One per line, at most ${field.maxItems ?? 8}.` : null,
    field.digitGuard ? "No registration or certificate numbers, and no expiry wording." : null,
  ]
    .filter(Boolean)
    .join(" ");
  if (field.kind === "line") return <TextInput name={name} label={label} value={value} onChange={onChange} hint={hint || undefined} error={error} dir={dir} lang={locale} counter={counter} />;
  return (
    <TextArea
      name={name}
      label={label}
      value={value}
      onChange={onChange}
      hint={hint || undefined}
      error={error}
      dir={dir}
      lang={locale}
      rows={field.kind === "rich" ? 7 : field.kind === "lines" ? 5 : 3}
      counter={counter}
    />
  );
}

function RootInput({ field, value, onChange, error }: { field: RootFieldModel; value: string | boolean | undefined; onChange: (v: string | boolean) => void; error?: string }) {
  const name = field.key;
  const text = typeof value === "string" ? value : "";
  switch (field.kind) {
    case "checkbox":
      return (
        <div className="adm-field">
          <label className="adm-check" htmlFor={fieldId(name)}>
            <input type="checkbox" id={fieldId(name)} name={name} value="1" checked={value === true} onChange={(e) => onChange(e.target.checked)} aria-describedby={describedBy(name, Boolean(field.hint), error)} />
            <span>{field.label}</span>
          </label>
          <Described name={name} hint={field.hint} error={error}>
            {null}
          </Described>
        </div>
      );
    case "select":
    case "reference": {
      const options =
        field.kind === "select"
          ? field.options.map((o) => ({ value: o.value, label: o.label, disabled: false }))
          : field.options.map((o) => ({ value: o.id, label: `${o.label}${o.slug ? ` (${o.slug})` : ""}${o.archived ? " — archived" : ""}`, disabled: o.archived && o.id !== text }));
      return (
        <div className="adm-field">
          <label className="adm-label" htmlFor={fieldId(name)}>
            {field.label}
          </label>
          <Described name={name} hint={field.hint} error={error}>
            <select
              id={fieldId(name)}
              name={name}
              className="adm-input"
              value={text}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(name, Boolean(field.hint), error)}
            >
              <option value="">{field.kind === "reference" ? field.emptyLabel : "Choose…"}</option>
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
          </Described>
        </div>
      );
    }
    case "date":
      return (
        <div className="adm-field">
          <label className="adm-label" htmlFor={fieldId(name)}>
            {field.label}
          </label>
          <Described name={name} hint={field.hint} error={error}>
            <input
              type="date"
              id={fieldId(name)}
              name={name}
              className="adm-input adm-input-short"
              value={text}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(name, Boolean(field.hint), error)}
            />
          </Described>
        </div>
      );
    case "number":
      return (
        <TextInput
          name={name}
          label={field.unit ? `${field.label} (${field.unit})` : field.label}
          value={text}
          onChange={onChange}
          hint={[field.hint, `A whole number from ${field.min} to ${field.max}.`].filter(Boolean).join(" ")}
          error={error}
          dir="ltr"
          inputMode="numeric"
        />
      );
    case "url":
      return <TextInput name={name} label={field.label} value={text} onChange={onChange} hint={field.hint} error={error} dir="ltr" inputMode="url" mono />;
    case "text":
      return <TextInput name={name} label={field.label} value={text} onChange={onChange} hint={field.hint} error={error} dir="ltr" />;
  }
}
