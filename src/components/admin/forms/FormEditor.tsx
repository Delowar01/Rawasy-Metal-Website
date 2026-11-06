"use client";
/**
 * The quote form's working copy (A7.1): delivery and protection (the Owner's decisions shown read-only to an Admin),
 * the fields in their groups (order inside a group, an optional field made required, lengths inside the registry's
 * bounds, each field's texts in both languages) and the form's own texts per language, Arabic right to left, with A3's
 * "<language> is complete" boxes and, once, "does not affect the other language". One save sends the whole form with the
 * version it was opened on; the server checks everything again. Leaving with unsaved changes asks first.
 *
 * Nothing here changes the website's form: it stays today's handoff form until the approved cutover (A9).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { saveFormAction, setUpFormAction } from "@/server/admin/actions/forms";
import type { CopyModel, FieldModelView, FieldTextsModel, FormEditorModel, FormSettingsModel, FormsActionState, LocaleKey } from "@/server/admin/actions/forms-model";

const LOCALES: { code: LocaleKey; heading: string; name: string }[] = [
  { code: "en", heading: "English", name: "English" },
  { code: "ar", heading: "العربية", name: "Arabic" },
];
const GROUPS: { key: FieldModelView["group"]; label: string }[] = [
  { key: "details", label: "Your details" },
  { key: "project", label: "Project" },
  { key: "message", label: "Details and drawings" },
];
const DELIVERY: { value: FormSettingsModel["deliveryMode"]; label: string; hint: string }[] = [
  { value: "handoff", label: "Handoff (today's)", hint: "The visitor sends the prepared email or WhatsApp message; nothing is stored." },
  { value: "store", label: "Store in the enquiry inbox", hint: "For local and staging tests until the approved cutover." },
  { value: "store_and_notify", label: "Store and notify by email", hint: "As above, and a notification (reference and admin link only) to the addresses below." },
];

/** The form's own texts, as the page groups them: [path inside the copy, label, long]. */
const COPY_GROUPS: { title: string; fields: [string, string, boolean?][] }[] = [
  {
    title: "Form",
    fields: [
      ["requiredNote", "Required fields note"],
      ["groups.details", "Group: your details"],
      ["groups.project", "Group: project"],
      ["groups.message", "Group: details and drawings"],
      ["submit", "Button"],
      ["serviceOther", "Service choice: not sure"],
      ["noscript", "Without JavaScript (note)", true],
    ],
  },
  {
    title: "Files (on the visitor's device)",
    fields: [
      ["files.choose", "Choose files"],
      ["files.drop", "Drop them here"],
      ["files.remove", "Remove"],
      ["files.note", "Files note", true],
      ["files.units.kb", "Unit: KB"],
      ["files.units.mb", "Unit: MB"],
    ],
  },
  {
    title: "Messages",
    fields: [
      ["errors.summary", "Error summary heading"],
      ["errors.fileType", "File type not supported (keep {name})"],
      ["errors.fileSize", "File too large (keep {name})"],
      ["errors.fileCount", "Too many files"],
    ],
  },
  {
    title: "The prepared request",
    fields: [
      ["ready.title", "Title"],
      ["ready.body", "Text", true],
      ["ready.email", "Send by email"],
      ["ready.whatsapp", "Send on WhatsApp"],
      ["ready.copy", "Copy request"],
      ["ready.copied", "Copied"],
      ["ready.copyFailed", "Copy failed"],
      ["ready.attach", "Remember to attach"],
      ["ready.filesLine", "Files line"],
      ["ready.fallback", "Email app fallback", true],
      ["ready.edit", "Edit request"],
      ["ready.subject", "Email subject"],
      ["ready.preview", "Summary heading"],
    ],
  },
  {
    title: "Privacy and consent",
    fields: [
      ["privacy.text", "Privacy line (keep {link})", true],
      ["privacy.link", "Privacy link text"],
      ["consent.label", "Consent box wording (RAWASY's text; only with the consent box)", true],
      ["consent.error", "Consent box message when unticked"],
    ],
  },
];

const getAt = (copy: CopyModel, path: string): string => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], copy) as string;
const setAt = (copy: CopyModel, path: string, value: string): CopyModel => {
  const next = structuredClone(copy) as unknown as Record<string, unknown>;
  const keys = path.split(".");
  let at = next;
  for (const k of keys.slice(0, -1)) at = at[k] as Record<string, unknown>;
  at[keys.at(-1)!] = value;
  return next as unknown as CopyModel;
};

interface FieldDraft extends Omit<FieldModelView, "minLength" | "maxLength"> {
  minLength: string;
  maxLength: string;
}
interface Draft {
  settings: Omit<FormSettingsModel, "notificationEmails" | "retentionDays" | "minFillSeconds" | "maxFiles" | "maxFileMb"> & {
    notificationEmails: string;
    retentionDays: string;
    minFillSeconds: string;
    maxFiles: string;
    maxFileMb: string;
  };
  copy: Record<LocaleKey, CopyModel>;
  fields: FieldDraft[];
  complete: Record<LocaleKey, boolean>;
}

const draftOf = (model: FormEditorModel): Draft => ({
  settings: {
    ...model.settings,
    acceptedExtensions: [...model.settings.acceptedExtensions],
    notificationEmails: model.settings.notificationEmails.join("\n"),
    retentionDays: model.settings.retentionDays === null ? "" : String(model.settings.retentionDays),
    minFillSeconds: String(model.settings.minFillSeconds),
    maxFiles: String(model.settings.maxFiles),
    maxFileMb: String(model.settings.maxFileMb),
  },
  copy: { en: structuredClone(model.copy.en), ar: structuredClone(model.copy.ar) },
  fields: model.fields.map((f) => ({ ...f, minLength: f.minLength === null ? "" : String(f.minLength), maxLength: f.maxLength === null ? "" : String(f.maxLength), texts: { en: { ...f.texts.en, optionLabels: { ...f.texts.en.optionLabels } }, ar: { ...f.texts.ar, optionLabels: { ...f.texts.ar.optionLabels } } } })),
  complete: { en: model.status.en === "complete", ar: model.status.ar === "complete" },
});

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function FormEditor({ model }: { model: FormEditorModel }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(model));
  const [otherUnaffected, setOtherUnaffected] = useState(false);
  const [state, setState] = useState<FormsActionState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(model)) || otherUnaffected;
  const canEdit = model.can.edit;
  useUnsavedChanges(canEdit && dirty);
  const disabled = !canEdit || pending;
  const issue = (path: string) => (state.status === "error" ? state.issues.find((i) => i.path === path || i.path.startsWith(`${path}.`))?.message : undefined);

  const setSetting = <K extends keyof Draft["settings"]>(key: K, value: Draft["settings"][K]) => setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  const setField = (id: string, change: Partial<FieldDraft>) => setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...change } : f)) }));
  const setFieldText = (id: string, locale: LocaleKey, key: keyof FieldTextsModel, value: string) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, texts: { ...f.texts, [locale]: { ...f.texts[locale], [key]: value } } } : f)) }));
  const setOption = (id: string, locale: LocaleKey, option: string, value: string) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, texts: { ...f.texts, [locale]: { ...f.texts[locale], optionLabels: { ...f.texts[locale].optionLabels, [option]: value } } } } : f)) }));
  const move = (id: string, by: -1 | 1) =>
    setDraft((d) => {
      const field = d.fields.find((f) => f.id === id)!;
      const group = d.fields.filter((f) => f.group === field.group);
      const at = group.findIndex((f) => f.id === id);
      const swap = group[at + by];
      if (!swap) return d;
      const fields = [...d.fields];
      const i = fields.findIndex((f) => f.id === id);
      const j = fields.findIndex((f) => f.id === swap.id);
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...d, fields };
    });

  const save = () =>
    startTransition(async () => {
      const s = draft.settings;
      const result = await saveFormAction(model.id, {
        expectedVersion: model.lockVersion,
        settings: {
          isEnabled: s.isEnabled,
          deliveryMode: s.deliveryMode,
          notificationEmails: s.notificationEmails.split("\n").map((v) => v.trim()).filter(Boolean),
          retentionDays: num(s.retentionDays),
          honeypotEnabled: s.honeypotEnabled,
          minFillSeconds: num(s.minFillSeconds) ?? 0,
          consentMode: s.consentMode,
          acceptFiles: s.acceptFiles,
          maxFiles: num(s.maxFiles) ?? 0,
          maxFileMb: num(s.maxFileMb) ?? 0,
          acceptedExtensions: s.acceptedExtensions,
        },
        copy: draft.copy,
        fields: GROUPS.flatMap((g) => draft.fields.filter((f) => f.group === g.key)).map((f) => ({ id: f.id, isRequired: f.isRequired, minLength: f.bounds ? num(f.minLength) : null, maxLength: f.bounds ? num(f.maxLength) : null, texts: f.texts })),
        complete: draft.complete,
        otherUnaffected,
      });
      setState(result);
      if (result.status === "ok") router.replace(`/admin/forms/${model.id}?saved=1&v=${result.lockVersion ?? ""}`, { scroll: false });
    });

  const text = (path: string, label: string, value: string, onChange: (v: string) => void, options: { long?: boolean; dir?: "ltr" | "rtl"; lang?: string; hint?: string; type?: string; disabled?: boolean; inputMode?: "numeric" } = {}) => {
    const id = `f-${path.replace(/[.{}]/g, "-")}`;
    const error = issue(path);
    const describedBy = [options.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = {
      id,
      className: options.long ? "adm-input adm-textarea" : "adm-input",
      value,
      disabled: disabled || options.disabled,
      dir: options.dir,
      lang: options.lang,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
    };
    return (
      <div className="adm-field" key={path}>
        <label className="adm-label" htmlFor={id}>
          {label}
        </label>
        {options.long ? (
          <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...common} type={options.type ?? "text"} inputMode={options.inputMode} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
        )}
        {options.hint ? (
          <p className="adm-hint" id={`${id}-hint`}>
            {options.hint}
          </p>
        ) : null}
        {error ? (
          <p className="adm-hint adm-error" id={`${id}-error`}>
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const s = draft.settings;
  const owner = model.can.ownerSettings;
  return (
    <form
      className="adm-editor adm-form-editor"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (canEdit) save();
      }}
    >
      {state.status === "error" ? (
        <div className="adm-alert is-error adm-editor-alert" role="alert">
          <p>{state.message}</p>
          {state.issues.length ? (
            <ul className="adm-error-list">
              {state.issues.slice(0, 12).map((i, n) => (
                <li key={`${i.path}-${n}`}>{i.message}</li>
              ))}
            </ul>
          ) : null}
          {state.stale ? (
            <div className="adm-actions">
              <button type="button" className="adm-btn" onClick={() => (setState({ status: "idle" }), router.refresh())}>
                Reload the latest version
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="adm-card" aria-labelledby="form-delivery-title">
        <div className="adm-card-head">
          <h2 id="form-delivery-title">Delivery and protection</h2>
        </div>
        <p className="adm-hint">The website&apos;s form stays today&apos;s handoff form whatever is chosen here: nothing reaches the website&apos;s visitors before the approved cutover. The delivery mode, stored attachments, the consent box and the retention period are the Owner&apos;s decisions.</p>
        <fieldset className="adm-subset">
          <legend className="adm-label">Delivery</legend>
          {DELIVERY.map((d) => (
            <label key={d.value} className="adm-check adm-form-choice">
              <input type="radio" name="deliveryMode" value={d.value} checked={s.deliveryMode === d.value} disabled={disabled || !owner} onChange={() => setSetting("deliveryMode", d.value)} />
              <span>
                {d.label}
                <span className="adm-hint adm-form-choice-hint">{d.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="adm-check">
          <input type="checkbox" checked={s.isEnabled} disabled={disabled} onChange={(e) => setSetting("isEnabled", e.target.checked)} />
          <span>The form is on</span>
        </label>
        {text("settings.notificationEmails", "Addresses to notify (one per line, at most 5)", s.notificationEmails, (v) => setSetting("notificationEmails", v), {
          long: true,
          dir: "ltr",
          hint: "Only with “Store and notify”. A notification carries the reference and a link to the admin — never the visitor's details. No mail is sent while the mail transport is off (today).",
        })}
        <div className="adm-site-pair">
          <label className="adm-check">
            <input type="checkbox" checked={s.honeypotEnabled} disabled={disabled} onChange={(e) => setSetting("honeypotEnabled", e.target.checked)} />
            <span>Hidden spam field (honeypot)</span>
          </label>
          {text("settings.minFillSeconds", `Minimum fill time in seconds (${model.limits.minFill[0]}–${model.limits.minFill[1]})`, s.minFillSeconds, (v) => setSetting("minFillSeconds", v), { inputMode: "numeric", dir: "ltr" })}
        </div>
        <fieldset className="adm-subset">
          <legend className="adm-label">Consent</legend>
          <label className="adm-check">
            <input type="radio" name="consentMode" checked={s.consentMode === "notice"} disabled={disabled || !owner} onChange={() => setSetting("consentMode", "notice")} />
            <span>Privacy line under the form (today&apos;s)</span>
          </label>
          <label className="adm-check">
            <input type="radio" name="consentMode" checked={s.consentMode === "checkbox"} disabled={disabled || !owner} onChange={() => setSetting("consentMode", "checkbox")} />
            <span>A consent box the visitor must tick (its wording is RAWASY&apos;s: below, per language)</span>
          </label>
        </fieldset>
        <fieldset className="adm-subset">
          <legend className="adm-label">Stored attachments</legend>
          <label className="adm-check">
            <input type="checkbox" checked={s.acceptFiles} disabled={disabled || !owner} onChange={(e) => setSetting("acceptFiles", e.target.checked)} />
            <span>Accept files with stored submissions</span>
          </label>
          <p className="adm-hint">Off today: files stay on the visitor&apos;s device. Only types whose content can be checked are offered (never SVG, office or program files).</p>
          <div className="adm-site-pair">
            {text("settings.maxFiles", `Files at most (${model.limits.maxFiles[0]}–${model.limits.maxFiles[1]})`, s.maxFiles, (v) => setSetting("maxFiles", v), { inputMode: "numeric", dir: "ltr", disabled: !owner })}
            {text("settings.maxFileMb", `Size per file in MB (${model.limits.maxFileMb[0]}–${model.limits.maxFileMb[1]})`, s.maxFileMb, (v) => setSetting("maxFileMb", v), { inputMode: "numeric", dir: "ltr", disabled: !owner })}
          </div>
          <div className="adm-form-types" role="group" aria-label="Accepted file types" aria-describedby={issue("settings.acceptedExtensions") ? "f-types-error" : undefined}>
            {model.limits.extensions.map((ext) => (
              <label key={ext} className="adm-check">
                <input
                  type="checkbox"
                  checked={s.acceptedExtensions.includes(ext)}
                  disabled={disabled || !owner}
                  onChange={(e) => setSetting("acceptedExtensions", e.target.checked ? [...s.acceptedExtensions, ext] : s.acceptedExtensions.filter((x) => x !== ext))}
                />
                <span dir="ltr">{ext}</span>
              </label>
            ))}
          </div>
          {issue("settings.acceptedExtensions") ? (
            <p className="adm-hint adm-error" id="f-types-error">
              {issue("settings.acceptedExtensions")}
            </p>
          ) : null}
        </fieldset>
        {text("settings.retentionDays", `Retention period in days (empty: none chosen; ${model.limits.retention[0]}–${model.limits.retention[1]})`, s.retentionDays, (v) => setSetting("retentionDays", v), {
          inputMode: "numeric",
          dir: "ltr",
          disabled: !model.can.retention,
          hint: "No period is chosen: the Owner decides it with legal review. Nothing is deleted automatically; a period only lets the retention tool list what it would anonymize.",
        })}
      </section>

      <section className="adm-card" aria-labelledby="form-fields-title">
        <div className="adm-card-head">
          <h2 id="form-fields-title">Fields</h2>
        </div>
        <p className="adm-hint">The ten fields of today&apos;s form. Their kind and checks stay as they are; their order inside a group, whether an optional field is required, the lengths and the texts are yours. The website&apos;s component draws today&apos;s order; stored submissions are checked against these rules.</p>
        {GROUPS.map((group) => (
          <fieldset key={group.key} className="adm-subset adm-form-group">
            <legend className="adm-label">{group.label}</legend>
            <ol className="adm-form-fields">
              {draft.fields
                .filter((f) => f.group === group.key)
                .map((f, i, list) => {
                  // The server names a field's problems by its place in the list the save sends (groups in order).
                  const base = `fields.${GROUPS.flatMap((g) => draft.fields.filter((x) => x.group === g.key)).findIndex((x) => x.id === f.id)}`;
                  return (
                    <li key={f.id} className="adm-form-field">
                      <details>
                        <summary>
                          <span className="adm-form-field-name">{f.texts.en.label || f.key}</span>
                          <span className="adm-muted">
                            {" "}
                            · {f.type === "file" ? "files" : f.isRequired ? "required" : "optional"}
                          </span>
                        </summary>
                        <div className="adm-form-field-body">
                          {canEdit ? (
                            <div className="adm-actions adm-site-actions">
                              <button type="button" className="adm-btn is-small" disabled={disabled || i === 0} onClick={() => move(f.id, -1)}>
                                Move up<span className="adm-sr-only"> {f.texts.en.label}</span>
                              </button>
                              <button type="button" className="adm-btn is-small" disabled={disabled || i === list.length - 1} onClick={() => move(f.id, 1)}>
                                Move down<span className="adm-sr-only"> {f.texts.en.label}</span>
                              </button>
                            </div>
                          ) : null}
                          <label className="adm-check">
                            <input type="checkbox" checked={f.isRequired} disabled={disabled || f.requiredLocked} onChange={(e) => setField(f.id, { isRequired: e.target.checked })} />
                            <span>Required{f.requiredLocked ? " (fixed)" : ""}</span>
                          </label>
                          {issue(`${base}.isRequired`) ? <p className="adm-hint adm-error">{issue(`${base}.isRequired`)}</p> : null}
                          {f.bounds ? (
                            <div className="adm-site-pair">
                              {text(`${base}.minLength`, `Shortest answer (from ${f.bounds.floor})`, f.minLength, (v) => setField(f.id, { minLength: v }), { inputMode: "numeric", dir: "ltr" })}
                              {text(`${base}.maxLength`, `Longest answer (up to ${f.bounds.ceiling})`, f.maxLength, (v) => setField(f.id, { maxLength: v }), { inputMode: "numeric", dir: "ltr" })}
                            </div>
                          ) : null}
                          <div className="adm-form-locales">
                            {LOCALES.map((l) => {
                              const dir = l.code === "ar" ? "rtl" : "ltr";
                              const t = f.texts[l.code];
                              const p = `${base}.texts.${l.code}`;
                              return (
                                <div key={l.code} className="adm-form-locale" lang={l.code}>
                                  <p className="adm-label" lang="en">
                                    {l.name}
                                  </p>
                                  {text(`${p}.label`, "Label", t.label, (v) => setFieldText(f.id, l.code, "label", v), { dir, lang: l.code })}
                                  {f.type !== "file" && f.type !== "select" && f.type !== "service_select" && f.type !== "textarea"
                                    ? text(`${p}.placeholder`, "Placeholder (optional)", t.placeholder, (v) => setFieldText(f.id, l.code, "placeholder", v), { dir, lang: l.code })
                                    : null}
                                  {f.type === "select" || f.type === "service_select"
                                    ? text(`${p}.placeholder`, "First choice prompt (optional)", t.placeholder, (v) => setFieldText(f.id, l.code, "placeholder", v), { dir, lang: l.code })
                                    : null}
                                  {text(`${p}.hint`, "Help text (optional)", t.hint, (v) => setFieldText(f.id, l.code, "hint", v), { dir, lang: l.code })}
                                  {f.type !== "file" ? text(`${p}.errorRequired`, "Message when missing", t.errorRequired, (v) => setFieldText(f.id, l.code, "errorRequired", v), { dir, lang: l.code }) : null}
                                  {f.type !== "file" ? text(`${p}.errorInvalid`, "Message when not valid (optional)", t.errorInvalid, (v) => setFieldText(f.id, l.code, "errorInvalid", v), { dir, lang: l.code }) : null}
                                  {(f.options ?? []).map((option) => text(`${p}.optionLabels.${option}`, `Choice “${option}”`, t.optionLabels[option] ?? "", (v) => setOption(f.id, l.code, option, v), { dir, lang: l.code }))}
                                  {issue(`${p}.optionLabels`) ? <p className="adm-hint adm-error">{issue(`${p}.optionLabels`)}</p> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    </li>
                  );
                })}
            </ol>
          </fieldset>
        ))}
      </section>

      {LOCALES.map((l) => {
        const dir = l.code === "ar" ? "rtl" : "ltr";
        return (
          <section key={l.code} className="adm-card" aria-labelledby={`form-${l.code}-title`}>
            <div className="adm-card-head">
              <h2 id={`form-${l.code}-title`} lang={l.code}>
                {l.heading}
              </h2>
            </div>
            {COPY_GROUPS.map((group) => (
              <fieldset key={group.title} className="adm-subset">
                <legend className="adm-label">{group.title}</legend>
                {group.fields.map(([path, label, long]) =>
                  text(`copy.${l.code}.${path}`, label, getAt(draft.copy[l.code], path), (v) => setDraft((d) => ({ ...d, copy: { ...d.copy, [l.code]: setAt(d.copy[l.code], path, v) } })), { dir, lang: l.code, long }),
                )}
              </fieldset>
            ))}
            <div className="adm-field">
              <label className="adm-check" htmlFor={`f-complete-${l.code}`}>
                <input
                  type="checkbox"
                  id={`f-complete-${l.code}`}
                  checked={draft.complete[l.code]}
                  disabled={disabled}
                  aria-describedby={`f-complete-${l.code}-hint`}
                  onChange={(e) => setDraft((d) => ({ ...d, complete: { ...d.complete, [l.code]: e.target.checked } }))}
                />
                <span>{l.name} is complete</span>
              </label>
              <p className="adm-hint" id={`f-complete-${l.code}-hint`}>
                {model.status[l.code] === "needs_review"
                  ? "Needs review: the other language changed after this one was confirmed. Check it, then tick this box and save."
                  : "Covers this language's form texts and field texts; untick it to keep the language as a draft."}
              </p>
            </div>
          </section>
        );
      })}

      {canEdit ? (
        <div className="adm-card adm-editor-review">
          <label className="adm-check" htmlFor="f-otherUnaffected">
            <input type="checkbox" id="f-otherUnaffected" checked={otherUnaffected} disabled={disabled} onChange={(e) => setOtherUnaffected(e.target.checked)} />
            <span>This change does not affect the other language (for example, a typo fix)</span>
          </label>
          <p className="adm-hint">Otherwise, changing one language while the other is complete marks the other “Needs review”.</p>
        </div>
      ) : null}

      {canEdit ? (
        <div className="adm-savebar">
          <span className="adm-savebar-status" role="status">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>
          <div className="adm-actions">
            <button type="submit" className="adm-btn is-primary" disabled={pending} aria-disabled={pending}>
              {pending ? "Saving…" : "Save form"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

/** "Copy today's form": fills the empty working copy from the website's form (once). */
export function SetUpFormButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormsActionState>({ status: "idle" });
  return (
    <div className="adm-site-setup">
      <button
        type="button"
        className="adm-btn is-primary"
        disabled={pending}
        aria-disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setUpFormAction(id);
            setState(result);
            if (result.status === "ok") router.replace(`/admin/forms/${id}?saved=1&v=${result.lockVersion ?? ""}`, { scroll: false });
          })
        }
      >
        {pending ? "Copying…" : "Copy today's form"}
      </button>
      <div role="status" aria-live="polite">
        {state.status === "error" ? <p className="adm-alert is-error">{state.message}</p> : null}
      </div>
    </div>
  );
}
