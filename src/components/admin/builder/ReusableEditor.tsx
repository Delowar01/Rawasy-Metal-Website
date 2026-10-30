"use client";
/**
 * A reusable section's editor (A5 brief §44–§45): its name, its block's settings and texts (the same section editor as
 * the page builder), its "Used by" list with links to those pages' builders, its preview, archive and restore. Saving
 * changes only the working copy that the linking pages' previews show; no visitor sees it (publishing is A8). An edit is
 * decided on the version this editor opened ("This reusable section changed after you opened it…"); nothing is merged.
 * Unsaved edits survive a session that ends, as in the page builder (A5 final correction): the save answers in the page,
 * and a copy is kept in this tab, offered back onto the same version only.
 */
import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { createReusableAction, saveReusableAction, setReusableArchivedAction } from "@/server/admin/actions/builder";
import type { BuilderLocale, ReusableEditorModel, SectionData } from "@/server/admin/actions/builder-model";
import type { MediaCardModel } from "@/server/admin/actions/media-model";
import type { PreviewToBuilder } from "@/server/admin/actions/preview-protocol";
import { idle } from "@/server/admin/actions/state";
import { ConfirmAction } from "../ConfirmAction";
import { FormAlert, SubmitButton } from "../forms";
import { useUnsavedChanges } from "../cms/useUnsavedChanges";
import { Canvas, DEVICES, previewUrl, type PreviewDevice } from "./Canvas";
import { keptCards, readKeptReusable } from "./draft";
import { KeptWorkNotice, SignedOutNotice } from "./DraftNotice";
import { FieldEnvProvider, type FieldEnv } from "./env";
import { fillLanguages } from "./model";
import { SectionEditor } from "./SectionEditor";
import { useDraft } from "./useDraft";
import { useStickyBar } from "./useStickyBar";

type Issue = { path?: string; message: string };
type SaveView =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "stale"; message: string }
  | { status: "signed_out"; message: string; reason: "ended" | "other_user" }
  | { status: "error"; message: string; issues: Issue[] };

/** `viewer`: the id of the person this editor was opened for (its saves name them; its kept copy is theirs). */
export function ReusableEditor({ model, viewer }: { model: ReusableEditorModel; viewer: string }) {
  const router = useRouter();
  const id = useId();
  const openedData = model.data && model.block ? fillLanguages(model.block, model.data) : null;
  const [name, setName] = useState(model.name);
  const [data, setData] = useState<SectionData | null>(openedData);
  const [changed, setChanged] = useState(false);
  const [locale, setLocale] = useState<BuilderLocale>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [save, setSave] = useState<SaveView>({ status: "idle" });
  const [media, setMedia] = useState<Record<string, MediaCardModel>>(model.media);
  const [notes, setNotes] = useState<string[]>([]);
  // Counts the edits (the kept copy is written after each burst of them).
  const [edits, setEdits] = useState(0);
  const dirty = changed || name !== model.name;

  // The copy of these edits kept in the tab, and the one an earlier visit kept (until restored or discarded).
  const keeper = useDraft({
    user: viewer,
    kind: "reusable",
    id: model.id,
    base: model.lockVersion,
    enabled: model.can.edit && !model.archived && model.block !== null && openedData !== null,
    dirty,
    version: `${edits}:${name}`,
    payload: () => ({ name, data: data as SectionData, media: keptCards([data], media) }),
    read: readKeptReusable,
  });
  useUnsavedChanges(dirty, undefined, keeper.drop);
  const kept = keeper.pending;
  const keptBlocked =
    kept && kept.base !== model.lockVersion
      ? `this reusable section was saved again since then (version ${kept.base}, now ${model.lockVersion}), and restoring them would overwrite the newer version.`
      : null;
  const restoreKept = () => {
    if (!kept || keptBlocked || !model.block) return;
    setName(kept.payload.name);
    setMedia((m) => ({ ...Object.fromEntries(kept.payload.media.map((card) => [card.id, card])), ...m }));
    setData(fillLanguages(model.block, kept.payload.data));
    setChanged(true);
    setEdits((n) => n + 1);
    keeper.restored();
  };
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useStickyBar(root, bar);

  const env: FieldEnv = {
    options: model.options,
    links: model.links,
    media,
    remember: (card) => setMedia((m) => ({ ...m, [card.id]: card })),
    canUpload: model.canUpload,
    // A reusable section can be linked into any page: it names no in-page anchor of its own.
    anchors: [],
    // Nothing more is edited between a save and the stored version replacing this one (it would be dropped).
    disabled: !model.can.edit || save.status === "saving" || save.status === "saved" || kept !== null,
    issues: save.status === "error" ? save.issues : [],
  };

  const saveNow = async () => {
    if (!data || !dirty) return;
    setSave({ status: "saving" });
    try {
      const result = await saveReusableAction(JSON.stringify({ id: model.id, expectedVersion: model.lockVersion, name, data }), viewer);
      if (result.status === "ok") {
        // The editor opens again on the stored version (its new version number remounts it, and puts it in the address so
        // the version is always read again); the screen confirms.
        if (result.lockVersion === model.lockVersion) {
          // Nothing was stored (the same as before): this editor stays as it is.
          setChanged(false);
          setSave({ status: "idle" });
          return;
        }
        keeper.saved();
        setSave({ status: "saved", message: result.message });
        // Should the reload not arrive (a lost connection), editing comes back rather than staying locked; a save from
        // this older version is then refused as changed elsewhere, never stored over the new one.
        window.setTimeout(() => setSave((s) => (s.status === "saved" ? { status: "idle" } : s)), 20_000);
        router.replace(`${window.location.pathname}?done=saved&v=${result.lockVersion}`, { scroll: false });
      } else if (result.status === "stale") setSave({ status: "stale", message: result.message });
      else if (result.status === "signed_out") setSave({ status: "signed_out", message: result.message, reason: result.reason });
      else setSave({ status: "error", message: result.message, issues: result.issues ?? [] });
    } catch {
      setSave({ status: "error", message: "The save didn't reach the server. Try again; your changes are still here.", issues: [] });
    }
  };
  const onFrame = (message: PreviewToBuilder) => {
    if (message.type === "ready") setNotes(Object.values(message.notes).flat());
    if (message.type === "locale") setLocale(message.locale);
    if (message.type === "theme") setTheme(message.theme);
  };
  const nameIssue = save.status === "error" ? save.issues.find((i) => i.path === "name")?.message : undefined;

  return (
    <div className="adm-bld adm-bld-reusable" ref={root}>
      <div className="adm-bld-top" role="group" aria-label="Reusable section controls" ref={bar}>
        <div className="adm-bld-top-group">
          <span className="adm-bld-save" data-state={save.status === "idle" ? (dirty ? "dirty" : "saved") : save.status} role="status" aria-live="polite">
            {save.status === "saving"
              ? "Saving…"
              : save.status === "saved"
                ? "Saved: loading it…"
                : save.status === "error"
                  ? "Error: not saved"
                  : save.status === "stale"
                    ? "Changed elsewhere: not saved"
                    : save.status === "signed_out"
                      ? "Signed out: not saved"
                      : dirty
                      ? "Unsaved changes"
                      : "Saved"}
          </span>
          <button type="button" className="adm-btn is-primary" onClick={() => void saveNow()} disabled={!dirty || !model.can.edit || save.status === "saving" || save.status === "saved" || !data || kept !== null}>
            {save.status === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="adm-bld-top-group">
          <label className="adm-sr-only" htmlFor={`${id}-device`}>
            Preview width
          </label>
          <select id={`${id}-device`} className="adm-input adm-bld-select" value={device} onChange={(e) => setDevice(e.target.value as PreviewDevice)}>
            {DEVICES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <label className="adm-sr-only" htmlFor={`${id}-theme`}>
            Preview theme
          </label>
          <select id={`${id}-theme`} className="adm-input adm-bld-select" value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <a className="adm-btn is-small" href={previewUrl(model.previewHref, locale, theme, device, false)} target="_blank" rel="noopener">
            Open preview in a new tab
          </a>
        </div>
      </div>
      {kept ? (
        <KeptWorkNotice
          savedAt={kept.savedAt}
          blocked={keptBlocked}
          onRestore={restoreKept}
          onDiscard={keeper.discard}
          download={{
            name: `unsaved-reusable-section-${model.id}-${new Date(kept.savedAt).toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`,
            json: () =>
              JSON.stringify(
                { kind: "RAWASY admin: unsaved reusable section", record: { id: model.id, name: model.name }, keptAt: new Date(kept.savedAt).toISOString(), madeOnVersion: kept.base, storedVersionNow: model.lockVersion, ...kept.payload },
                null,
                2,
              ),
          }}
        />
      ) : null}
      {save.status === "signed_out" ? <SignedOutNotice reason={save.reason} message={save.message} saveLabel="Save" /> : null}
      {save.status === "stale" ? (
        <div className="adm-alert is-warning adm-bld-notice" role="alert">
          <p>{save.message}</p>
          <p>Reloading shows the latest version; your edits are not applied to it, but a copy stays in this tab and is offered for download after the reload.</p>
          <button type="button" className="adm-btn" onClick={() => window.confirm("Reload the latest version? Your edits are not applied to it; a copy stays in this tab for download.") && window.location.reload()}>
            Reload the latest version
          </button>
        </div>
      ) : null}
      {save.status === "error" ? (
        <div className="adm-alert is-error" role="alert">
          <p>{save.message}</p>
        </div>
      ) : null}

      <div className="adm-bld-grid is-two">
        <section className="adm-bld-panel adm-bld-inspector" aria-labelledby={`${id}-edit`}>
          <h2 id={`${id}-edit`}>{model.block?.label ?? model.blockType}</h2>
          <div className="adm-alert is-info" role="note">
            <p>
              <strong>
                Used by {model.uses.length} section{model.uses.length === 1 ? "" : "s"}.
              </strong>{" "}
              Saving changes the working preview of every page and service that links it; no visitor sees it until publishing exists (A8).
            </p>
            {model.uses.length ? (
              <ul>
                {model.uses.map((u, i) => (
                  <li key={i}>
                    <a href={u.builderHref}>{u.label}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {model.problem ? (
            <div className="adm-alert is-warning" role="note">
              <p>{model.problem}</p>
            </div>
          ) : null}
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${id}-name`}>
              Name (shown in the admin only)
            </label>
            <input id={`${id}-name`} className="adm-input" value={name} maxLength={240} disabled={!model.can.edit || save.status === "saving" || save.status === "saved" || kept !== null} onChange={(e) => setName(e.target.value)} aria-invalid={nameIssue ? true : undefined} />
            {nameIssue ? <p className="adm-hint adm-error">{nameIssue}</p> : null}
          </div>
          {data && model.block ? (
            <FieldEnvProvider env={env}>
              <SectionEditor
                block={model.block}
                data={data}
                status={model.status}
                locale={locale}
                setLocale={setLocale}
                update={(recipe) => {
                  setData((d) => (d ? recipe(d) : d));
                  setChanged(true);
                  setEdits((n) => n + 1);
                  if (save.status === "saved") setSave({ status: "idle" });
                }}
                changed={changed}
              />
            </FieldEnvProvider>
          ) : (
            <p className="adm-hint">This reusable section&apos;s data can&apos;t be edited here.</p>
          )}
          {model.missing.length || model.warnings.length || notes.length ? (
            <section className="adm-bld-group" aria-labelledby={`${id}-notes`}>
              <h3 id={`${id}-notes`}>Notes</h3>
              <ul className="adm-bld-warnings">
                {model.missing.length ? <li>Not set yet: {model.missing.join(", ")}.</li> : null}
                {model.warnings.map((w, i) => (
                  <li key={`w${i}`}>{w}</li>
                ))}
                {notes.map((n, i) => (
                  <li key={`n${i}`}>In the preview: {n}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {model.can.archive ? (
            <section className="adm-bld-group" aria-label="Archive">
              {model.archived ? (
                <ConfirmAction
                  action={setReusableArchivedAction}
                  label="Restore"
                  title={`Restore “${model.name}”?`}
                  confirmLabel="Restore"
                  fields={{ id: model.id, version: String(model.lockVersion), archived: "0" }}
                >
                  <p>It can be linked again and edited.</p>
                </ConfirmAction>
              ) : (
                <ConfirmAction
                  action={setReusableArchivedAction}
                  label="Archive"
                  title={`Archive “${model.name}”?`}
                  confirmLabel="Archive"
                  fields={{ id: model.id, version: String(model.lockVersion), archived: "1" }}
                  danger
                >
                  <p>
                    {model.uses.length
                      ? `It is still used by ${model.uses.length} section${model.uses.length === 1 ? "" : "s"}: detach or remove them first, or the archive is refused.`
                      : "Nobody links it. It leaves the library and becomes read-only; it can be restored."}
                  </p>
                </ConfirmAction>
              )}
            </section>
          ) : null}
        </section>
        <section className="adm-bld-panel adm-bld-preview" aria-label="Preview">
          {dirty ? <p className="adm-hint adm-bld-warn">The preview shows the last saved version. Save to see your changes in it.</p> : null}
          <Canvas href={model.previewHref} title={`Preview of ${model.name}`} locale={locale} theme={theme} device={device} version={model.lockVersion} selected={null} hovered={null} onMessage={onFrame} />
        </section>
      </div>
    </div>
  );
}

/** A new reusable section: a name and one of the generic blocks that may be reused. */
export function ReusableCreateForm({ blocks }: { blocks: { key: string; label: string; description: string }[] }) {
  const [state, action] = useActionState(createReusableAction, idle);
  const id = useId();
  return (
    <form action={action} className="adm-card adm-form" autoComplete="off">
      <FormAlert state={state} />
      <div className="adm-field">
        <label className="adm-label" htmlFor={`${id}-name`}>
          Name (shown in the admin only)
        </label>
        <input id={`${id}-name`} name="name" className="adm-input" required maxLength={120} defaultValue={state.fields?.name ?? ""} />
      </div>
      <fieldset className="adm-field">
        <legend className="adm-label">Block</legend>
        <div className="adm-choice-list">
          {blocks.map((b, i) => (
            <label key={b.key} className="adm-choice">
              <input type="radio" name="blockType" value={b.key} required defaultChecked={i === 0} />
              <span>
                <strong>{b.label}</strong>
                <span className="adm-hint">{b.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton pending="Creating…">Create the reusable section</SubmitButton>
    </form>
  );
}
