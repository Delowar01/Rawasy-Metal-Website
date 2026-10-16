"use client";
/**
 * The media item page's forms (A4 brief §38–§43): the details form (English and Arabic titles, alt texts and captions,
 * the folder, the focal point, rights and provenance), the status actions (approve, restrict, archive, Trash and their
 * reverses), the flags, the versions and replacement, and a preview that a blocking flag keeps hidden until asked for.
 * Every change goes to a Server Action that decides it again from the session; "Save details" never approves an item.
 * Arabic inputs are right to left; the admin stays English; the focal point is set with two sliders (keyboard) or a
 * click on the preview, and drawn as SVG (the admin's CSP allows no inline styles).
 */
import { useActionState, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addMediaFlagAction,
  approveMediaAction,
  archiveMediaAction,
  clearMediaFlagAction,
  restoreMediaAction,
  restoreVersionAction,
  restrictMediaAction,
  saveMediaMetadataAction,
  trashMediaAction,
  unarchiveMediaAction,
  unrestrictMediaAction,
} from "@/server/admin/actions/media";
import { idle, type ActionState } from "@/server/admin/actions/state";
import { ConfirmAction } from "../ConfirmAction";
import { FormAlert, SubmitButton } from "../forms";
import { useUnsavedChanges } from "../cms/useUnsavedChanges";
import { MediaUploader } from "./MediaUploader";

type AltMode = "text" | "decorative" | "undecided";
type LocaleValues = { title: string; altMode: AltMode; alt: string; caption: string };

export interface MetadataValues {
  en: LocaleValues;
  ar: LocaleValues;
  folderId: string;
  focalX: string;
  focalY: string;
  rightsHolder: string;
  rightsNote: string;
  sourceNote: string;
  licenceExpiresOn: string;
}

const LOCALES = [
  { code: "en", heading: "English", name: "English" },
  { code: "ar", heading: "العربية", name: "Arabic" },
] as const;

function NoteField({ id, label, name, required, max, hint }: { id: string; label: string; name: string; required: boolean; max: number; hint?: string }) {
  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={id}>
        {label}
        {required ? " (required)" : " (optional)"}
      </label>
      <textarea id={id} name={name} className="adm-input adm-textarea" rows={3} maxLength={max} required={required} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint ? (
        <p className="adm-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// --- Preview --------------------------------------------------------------------------------------------------------------

/** The admin's preview of an image; an item with a blocking flag shows it only when asked (A4 brief §38, §41). */
export function RevealPreview({ src, label, blocked, width, height }: { src: string; label: string; blocked: boolean; width: number | null; height: number | null }) {
  const [shown, setShown] = useState(!blocked);
  if (!shown) {
    return (
      <div className="adm-media-hidden">
        <p>
          <strong>Preview hidden.</strong> This item has a blocking flag (for example, contested rights or identifying details). Show it only when you need to review it.
        </p>
        <button type="button" className="adm-btn" onClick={() => setShown(true)}>
          Show the preview
        </button>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="adm-media-preview" src={src} alt={`Preview of ${label}`} width={width ?? undefined} height={height ?? undefined} decoding="async" />;
}

// --- Details form ---------------------------------------------------------------------------------------------------------

function FocalPoint({ preview, x, y, on, onChange }: { preview: string | null; x: number; y: number; on: boolean; onChange: (next: { on: boolean; x: number; y: number }) => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const pick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const px = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const py = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    onChange({ on: true, x: Math.min(100, Math.max(0, px)), y: Math.min(100, Math.max(0, py)) });
  };
  return (
    <fieldset className="adm-subset">
      <legend className="adm-label">Focal point</legend>
      <p className="adm-hint">The part of the photo to keep in view when a later page crops it. The original is never cropped.</p>
      <label className="adm-check" htmlFor={`${id}-on`}>
        <input type="checkbox" id={`${id}-on`} checked={on} onChange={(e) => onChange({ on: e.target.checked, x, y })} />
        <span>Set a focal point</span>
      </label>
      {on ? (
        <div className="adm-focal">
          {preview ? (
            // A click is a shortcut; the sliders below are the accessible control.
            <div ref={box} className="adm-focal-box" onClick={pick}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="adm-focal-img" />
              <svg className="adm-focal-mark" aria-hidden="true" focusable="false">
                <circle cx={`${x}%`} cy={`${y}%`} r="11" />
                <circle cx={`${x}%`} cy={`${y}%`} r="3" />
              </svg>
            </div>
          ) : null}
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${id}-x`}>
              From the left: {x}%
            </label>
            <input id={`${id}-x`} type="range" min={0} max={100} step={1} value={x} onChange={(e) => onChange({ on, x: Number(e.target.value), y })} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${id}-y`}>
              From the top: {y}%
            </label>
            <input id={`${id}-y`} type="range" min={0} max={100} step={1} value={y} onChange={(e) => onChange({ on, x, y: Number(e.target.value) })} />
          </div>
        </div>
      ) : null}
      <input type="hidden" name="focalX" value={on ? (x / 100).toFixed(3) : ""} />
      <input type="hidden" name="focalY" value={on ? (y / 100).toFixed(3) : ""} />
    </fieldset>
  );
}

export function MediaMetadataForm({
  id,
  lockVersion,
  kind,
  approved,
  editable,
  initial,
  folders,
  preview,
  latestHref,
}: {
  id: string;
  lockVersion: number;
  kind: "image" | "svg" | "document";
  approved: boolean;
  editable: boolean;
  initial: MetadataValues;
  folders: { id: string; label: string }[];
  preview: string | null;
  latestHref: string;
}) {
  const [values, setValues] = useState(initial);
  const focalStart = { on: initial.focalX !== "", x: initial.focalX ? Math.round(Number(initial.focalX) * 100) : 50, y: initial.focalY ? Math.round(Number(initial.focalY) * 100) : 50 };
  const [focal, setFocal] = useState(focalStart);
  const [state, dispatch] = useActionState(saveMediaMetadataAction, idle);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || JSON.stringify(focal) !== JSON.stringify(focalStart);
  useUnsavedChanges(dirty && editable);
  const uid = useId();
  const isImage = kind === "image";
  const setLocale = (locale: "en" | "ar", patch: Partial<LocaleValues>) => setValues((v) => ({ ...v, [locale]: { ...v[locale], ...patch } }));
  const stale = state.status === "error" && /changed after you opened it/.test(state.message ?? "");
  return (
    <form action={dispatch} className="adm-form adm-media-form" noValidate>
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="lockVersion" value={lockVersion} />
      <fieldset className="adm-editor-body" disabled={!editable}>
        <legend className="adm-sr-only">Details of this media item</legend>
        {LOCALES.map((locale) => {
          const v = values[locale.code];
          const dir = locale.code === "ar" ? "rtl" : "ltr";
          return (
            <section className="adm-card" id={locale.code === "en" ? "english" : "arabic"} key={locale.code} aria-labelledby={`${uid}-${locale.code}`}>
              <h2 id={`${uid}-${locale.code}`} lang={locale.code}>
                {locale.heading}
              </h2>
              <div className="adm-field">
                <label className="adm-label" htmlFor={`f-${locale.code}-title`}>
                  {locale.name} title{kind === "document" && approved ? " (required while approved)" : ""}
                </label>
                <input
                  id={`f-${locale.code}-title`}
                  name={`${locale.code}.title`}
                  className="adm-input"
                  dir={dir}
                  lang={locale.code}
                  value={v.title}
                  maxLength={200}
                  onChange={(e) => setLocale(locale.code, { title: e.target.value })}
                  autoComplete="off"
                />
              </div>
              {isImage ? (
                <>
                  <div className="adm-field">
                    <label className="adm-label" htmlFor={`f-${locale.code}-altMode`}>
                      {locale.name} alt text{approved ? " (a decision is required while approved)" : ""}
                    </label>
                    <select
                      id={`f-${locale.code}-altMode`}
                      name={`${locale.code}.altMode`}
                      className="adm-input"
                      value={v.altMode}
                      onChange={(e) => setLocale(locale.code, { altMode: e.target.value as AltMode })}
                      aria-describedby={`f-${locale.code}-altMode-hint`}
                    >
                      <option value="undecided">Not decided yet</option>
                      <option value="decorative">Decorative (no alt text)</option>
                      <option value="text">Written</option>
                    </select>
                    <p className="adm-hint" id={`f-${locale.code}-altMode-hint`}>
                      “Decorative” stores an empty alt text on purpose; “Not decided yet” stores nothing. Nothing is translated automatically.
                    </p>
                  </div>
                  {v.altMode === "text" ? (
                    <div className="adm-field">
                      <label className="adm-label" htmlFor={`f-${locale.code}-alt`}>
                        {locale.name} alt text, written
                      </label>
                      <input
                        id={`f-${locale.code}-alt`}
                        name={`${locale.code}.alt`}
                        className="adm-input"
                        dir={dir}
                        lang={locale.code}
                        value={v.alt}
                        maxLength={500}
                        onChange={(e) => setLocale(locale.code, { alt: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="adm-field">
                <label className="adm-label" htmlFor={`f-${locale.code}-caption`}>
                  {locale.name} caption
                </label>
                <textarea
                  id={`f-${locale.code}-caption`}
                  name={`${locale.code}.caption`}
                  className="adm-input adm-textarea"
                  rows={2}
                  dir={dir}
                  lang={locale.code}
                  value={v.caption}
                  maxLength={500}
                  onChange={(e) => setLocale(locale.code, { caption: e.target.value })}
                />
              </div>
            </section>
          );
        })}
        <section className="adm-card" id="organisation" aria-labelledby={`${uid}-org`}>
          <h2 id={`${uid}-org`}>Folder and focal point</h2>
          <div className="adm-field">
            <label className="adm-label" htmlFor="f-folderId">
              Folder
            </label>
            <select id="f-folderId" name="folderId" className="adm-input" value={values.folderId} onChange={(e) => setValues((v) => ({ ...v, folderId: e.target.value }))} aria-describedby="f-folderId-hint">
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="adm-hint" id="f-folderId-hint">
              Folders only organise the library: they never change a file&apos;s address.
            </p>
          </div>
          {isImage ? <FocalPoint preview={preview} x={focal.x} y={focal.y} on={focal.on} onChange={setFocal} /> : null}
        </section>
        <section className="adm-card" id="rights-notes" aria-labelledby={`${uid}-rights`}>
          <h2 id={`${uid}-rights`}>Rights and provenance (admin only)</h2>
          <div className="adm-field">
            <label className="adm-label" htmlFor="f-rightsHolder">
              Rights holder
            </label>
            <input id="f-rightsHolder" name="rightsHolder" className="adm-input" value={values.rightsHolder} maxLength={200} onChange={(e) => setValues((v) => ({ ...v, rightsHolder: e.target.value }))} autoComplete="off" />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="f-licenceExpiresOn">
              Licence expires on
            </label>
            <input
              id="f-licenceExpiresOn"
              name="licenceExpiresOn"
              type="date"
              className="adm-input adm-input-short"
              value={values.licenceExpiresOn}
              onChange={(e) => setValues((v) => ({ ...v, licenceExpiresOn: e.target.value }))}
            />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="f-rightsNote">
              Rights note
            </label>
            <textarea id="f-rightsNote" name="rightsNote" className="adm-input adm-textarea" rows={3} value={values.rightsNote} onChange={(e) => setValues((v) => ({ ...v, rightsNote: e.target.value }))} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="f-sourceNote">
              Source note
            </label>
            <textarea id="f-sourceNote" name="sourceNote" className="adm-input adm-textarea" rows={3} value={values.sourceNote} onChange={(e) => setValues((v) => ({ ...v, sourceNote: e.target.value }))} />
          </div>
        </section>
      </fieldset>
      {state.status === "error" ? (
        <div className="adm-alert is-error" role="alert">
          <p>{state.message}</p>
          {stale ? (
            <>
              <p>Nothing was saved. Your changes are still in this form, so you can copy them before reloading.</p>
              <div className="adm-actions">
                <a className="adm-btn is-small" href={latestHref} target="_blank" rel="noopener">
                  Open the latest version in a new tab
                </a>
                <a className="adm-btn is-small" href={latestHref}>
                  Reload (discards my changes)
                </a>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <FormAlert state={state} />
      )}
      {editable ? (
        <div className="adm-savebar">
          <span className="adm-savebar-status" role="status">
            {dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>
          <div className="adm-actions">
            <SubmitButton pending="Saving…">Save details</SubmitButton>
          </div>
        </div>
      ) : null}
      <p className="adm-hint">Saving details never approves an item: approval is its own action, by an Owner or Admin.</p>
    </form>
  );
}

// --- Status actions -------------------------------------------------------------------------------------------------------

export function MediaStatusActions({
  id,
  version,
  status,
  visibility,
  deleted,
  can,
}: {
  id: string;
  version: number;
  status: string;
  visibility: "public" | "private";
  deleted: boolean;
  can: Record<string, boolean>;
}) {
  const uid = useId();
  const v = String(version);
  const actions: ReactNode[] = [];
  if (deleted) {
    if (can.untrash)
      actions.push(
        <ConfirmAction key="restore" action={restoreMediaAction} label="Restore from the Trash" title="Restore this item?" confirmLabel="Restore" fields={{ id, version: v }}>
          <p>It comes back in a safe state: an approved item returns to review and needs approval again before it can be delivered.</p>
        </ConfirmAction>,
      );
  } else {
    if (can.approve && visibility === "public" && status === "pending_review")
      actions.push(
        <ConfirmAction key="approve" action={approveMediaAction} label="Approve for public use" title="Approve this item?" confirmLabel="Approve" fields={{ id, version: v }}>
          <p>Approval says this item may be shown publicly once content using it is published (A8/A9). It is checked again now: no blocking flag, a ready file and an alt decision (or a document title) in both languages.</p>
          <p>For release media used on today&apos;s site, approval records a working baseline — it is not a statement about rights.</p>
          <NoteField id={`${uid}-approve`} label="Approval note" name="note" required max={200} />
        </ConfirmAction>,
      );
    if (can.restrict && status !== "restricted" && status !== "archived")
      actions.push(
        <ConfirmAction key="restrict" action={restrictMediaAction} label="Restrict" title="Restrict this item?" confirmLabel="Restrict" fields={{ id }} danger>
          <p>A restricted item is never delivered. This takes effect at once.</p>
          <NoteField id={`${uid}-restrict`} label="Reason" name="reason" required max={500} />
        </ConfirmAction>,
      );
    if (can.unrestrict && status === "restricted")
      actions.push(
        <ConfirmAction key="unrestrict" action={unrestrictMediaAction} label="Lift the restriction" title="Lift the restriction?" confirmLabel="Lift it" fields={{ id, version: v }}>
          <p>The item returns to review{visibility === "private" ? " (as an internal, private item)" : ""}; it is never approved by this.</p>
          <NoteField id={`${uid}-unrestrict`} label="Reason" name="note" required max={200} />
        </ConfirmAction>,
      );
    if (can.archive && status !== "archived")
      actions.push(
        <ConfirmAction key="archive" action={archiveMediaAction} label="Archive" title="Archive this item?" confirmLabel="Archive" fields={{ id }}>
          <p>An archived item is kept but never delivered, and can&apos;t be newly chosen for content.</p>
        </ConfirmAction>,
      );
    if (can.unarchive && status === "archived")
      actions.push(
        <ConfirmAction key="unarchive" action={unarchiveMediaAction} label="Restore from the archive" title="Restore from the archive?" confirmLabel="Restore" fields={{ id, version: v }}>
          <p>The item returns to review{visibility === "private" ? " (as an internal, private item)" : ""}; it needs approval again before it can be delivered.</p>
          <NoteField id={`${uid}-unarchive`} label="Reason" name="note" required max={200} />
        </ConfirmAction>,
      );
    if (can.trash)
      actions.push(
        <ConfirmAction key="trash" action={trashMediaAction} label="Move to the Trash" title="Move this item to the Trash?" confirmLabel="Move to the Trash" fields={{ id }} danger>
          <p>Delivery stops at once. Its details, files, versions and history are kept, and it can be restored from the Trash. Nothing is deleted.</p>
        </ConfirmAction>,
      );
  }
  if (!actions.length) return <p className="adm-hint">Your roles don&apos;t allow status changes for this item.</p>;
  return <div className="adm-actions">{actions}</div>;
}

// --- Flags ----------------------------------------------------------------------------------------------------------------

export interface MediaFlagView {
  flag: string;
  label: string;
  description: string | null;
  blocking: boolean;
  known: boolean;
  note: string | null;
  addedAt: string;
  addedBy: string | null;
  token: string;
}

export function MediaFlagsPanel({
  id,
  flags,
  choices,
  canAdd,
  canClear,
}: {
  id: string;
  flags: MediaFlagView[];
  choices: { value: string; label: string; description: string; blocking: boolean }[];
  canAdd: boolean;
  canClear: boolean;
}) {
  const router = useRouter();
  const uid = useId();
  const [flag, setFlag] = useState("");
  const [note, setNote] = useState("");
  const [state, add] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await addMediaFlagAction(previous, form);
    if (result.status === "ok") {
      setFlag("");
      setNote("");
      router.refresh();
    }
    return result;
  }, idle);
  const present = new Set(flags.map((f) => f.flag));
  const available = choices.filter((c) => !present.has(c.value));
  return (
    <div className="adm-flags">
      {flags.length === 0 ? (
        <p className="adm-muted">No flags.</p>
      ) : (
        <ul className="adm-list">
          {flags.map((f) => (
            <li key={f.flag}>
              <div className="adm-flag-text">
                <strong>{f.label}</strong> {f.blocking ? <span className="adm-badge is-danger">Blocking</span> : <span className="adm-badge is-warning">Informative</span>}
                {!f.known ? <span className="adm-badge is-danger">Unknown flag — blocks</span> : null}
                {f.description ? <p className="adm-hint">{f.description}</p> : null}
                {f.note ? <p className="adm-flag-note">Note: {f.note}</p> : null}
                <p className="adm-hint">
                  Added {f.addedAt}
                  {f.addedBy ? ` by ${f.addedBy}` : ""}
                </p>
              </div>
              {canClear ? (
                <ConfirmAction
                  action={clearMediaFlagAction}
                  label="Clear"
                  title={`Clear “${f.label}”?`}
                  confirmLabel="Clear the flag"
                  fields={{ id, flag: f.flag, token: f.token }}
                  danger
                  small
                >
                  <p>This makes the item less restricted. Say why it can be cleared; the reason is kept in the audit log. Clearing never approves the item.</p>
                  <NoteField id={`${uid}-${f.flag}-note`} label="Reason" name="note" required max={200} />
                </ConfirmAction>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {!canClear && flags.length ? <p className="adm-hint">Only an Owner or Admin can clear a flag.</p> : null}
      {canAdd ? (
        <form action={add} className="adm-form adm-flag-add">
          <input type="hidden" name="id" value={id} />
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${uid}-flag`}>
              Add a flag
            </label>
            <select id={`${uid}-flag`} name="flag" className="adm-input" value={flag} onChange={(e) => setFlag(e.target.value)} required aria-describedby={`${uid}-flag-hint`}>
              <option value="">Choose a flag…</option>
              {available.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                  {c.blocking ? " (blocking)" : " (informative)"}
                </option>
              ))}
            </select>
            <p className="adm-hint" id={`${uid}-flag-hint`}>
              {available.find((c) => c.value === flag)?.description ?? "A flag only ever makes the item safer; a blocking flag stops its delivery at once."}
            </p>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${uid}-note`}>
              Note (optional)
            </label>
            <textarea id={`${uid}-note`} name="note" className="adm-input adm-textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <FormAlert state={state} />
          <div className="adm-actions">
            <SubmitButton pending="Adding…">Add flag</SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// --- Versions -------------------------------------------------------------------------------------------------------------

export interface VersionView {
  id: string;
  version: number;
  current: boolean;
  status: string;
  error: string | null;
  filename: string;
  size: string;
  dimensions: string | null;
  uploaded: string;
  uploadedBy: string | null;
  purgeEligible: boolean;
  thumb: string | null;
}

export function VersionsPanel({
  id,
  version,
  versions,
  canRestore,
  canReplace,
  canDownload,
  replaceHint,
  accept,
}: {
  id: string;
  version: number;
  versions: VersionView[];
  canRestore: boolean;
  canReplace: boolean;
  canDownload: boolean;
  replaceHint: string;
  accept: string;
}) {
  const router = useRouter();
  return (
    <div className="adm-versions">
      <ol className="adm-rel-list">
        {versions.map((v) => (
          <li key={v.id} className="adm-rel-item">
            <span className="adm-rel-name">
              <strong>Version {v.version}</strong>
              {v.current ? <span className="adm-badge is-success">Current</span> : null}
              {v.status !== "ready" ? <span className={`adm-badge ${v.status === "failed" ? "is-danger" : "is-warning"}`}>{v.status === "failed" ? "Failed" : "Processing"}</span> : null}
              {v.purgeEligible ? <span className="adm-badge">Eligible for a future purge</span> : null}
              <span className="adm-hint">
                {v.filename} · {v.size}
                {v.dimensions ? ` · ${v.dimensions}` : ""} · uploaded {v.uploaded}
                {v.uploadedBy ? ` by ${v.uploadedBy}` : ""}
              </span>
              {v.error ? <span className="adm-hint adm-error">{v.error}</span> : null}
            </span>
            <span className="adm-rel-buttons">
              {canDownload && v.status === "ready" ? (
                <a className="adm-btn is-small" href={`/api/admin/files/${id}?version=${v.id}`}>
                  Download<span className="adm-sr-only"> version {v.version}</span>
                </a>
              ) : null}
              {canRestore && !v.current && v.status === "ready" ? (
                <ConfirmAction action={restoreVersionAction} label={`Make version ${v.version} current`} title={`Make version ${v.version} current?`} confirmLabel="Make it current" fields={{ id, file: v.id, version: String(version) }} small>
                  <p>The newer version stays in the history. An approved item returns to review and needs approval again.</p>
                </ConfirmAction>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="adm-hint">Old versions are kept. Versions older than 30 days are marked as eligible for a future purge; nothing is deleted automatically.</p>
      {canReplace ? (
        <div className="adm-subset">
          <MediaUploader purpose="replace" mediaId={id} label="Replace with a new version" hint={replaceHint} accept={accept} onUploaded={() => router.refresh()} />
        </div>
      ) : null}
    </div>
  );
}
