"use client";
/**
 * A redirect's form (A6.5): the old address (normalised and checked by the server: the language first, no page answers
 * it, not already redirected), where it leads (an address of the website, or a working page, service or project), 308 or
 * 307, and a note. Saved with the version it was opened on. Deactivating or reactivating is a separate button
 * (`RedirectToggle`). Redirects take effect only from the switch to the database (A9).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { saveRedirectAction, setRedirectActiveAction } from "@/server/admin/actions/site";
import type { RedirectFormModel, SiteActionState } from "@/server/admin/actions/site-model";
import { SaveAlert, savedAt, useSiteSave } from "./useSiteSave";

type Choices = Record<"page" | "service" | "project", { id: string; label: string }[]>;

const TARGETS = [
  { value: "path", label: "An address of the website" },
  { value: "page", label: "A page" },
  { value: "service", label: "A service" },
  { value: "project", label: "A project" },
] as const;

export function RedirectForm({ model, choices, canEdit }: { model: RedirectFormModel; choices: Choices; canEdit: boolean }) {
  const [draft, setDraft] = useState(model);
  const creating = model.id === "";
  const { pending, state, submit, reload, issue } = useSiteSave(saveRedirectAction, creating ? "/admin/redirects?saved=created" : `/admin/redirects/${model.id}?saved=1`);
  const dirty = JSON.stringify(draft) !== JSON.stringify(model);
  useUnsavedChanges(canEdit && dirty && state.status !== "ok");
  const disabled = !canEdit || pending;
  const set = <K extends keyof RedirectFormModel>(key: K, value: RedirectFormModel[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const error = (path: string) => issue(path);
  const describe = (id: string, hint: boolean, err: string | undefined) => [hint ? `${id}-hint` : "", err ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form
      className="adm-editor adm-site-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (canEdit)
          submit({
            id: draft.id,
            expectedVersion: draft.lockVersion,
            sourcePath: draft.sourcePath,
            targetType: draft.targetType,
            targetPath: draft.targetType === "path" ? draft.targetPath : "",
            targetId: draft.targetType === "path" ? "" : draft.targetId,
            statusCode: draft.statusCode,
            note: draft.note,
          });
      }}
    >
      <SaveAlert state={state} onReload={reload} />
      <section className="adm-card" aria-labelledby="redirect-title">
        <div className="adm-card-head">
          <h2 id="redirect-title">{creating ? "New redirect" : "Redirect"}</h2>
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="f-sourcePath">
            Old address
          </label>
          <input
            id="f-sourcePath"
            className="adm-input"
            dir="ltr"
            value={draft.sourcePath}
            disabled={disabled}
            placeholder="/en/old-page"
            aria-invalid={error("sourcePath") ? true : undefined}
            aria-describedby={describe("f-sourcePath", true, error("sourcePath"))}
            onChange={(e) => set("sourcePath", e.target.value)}
          />
          <p className="adm-hint" id="f-sourcePath-hint">
            The language first, without the domain: /en/old-page or /ar/… . No page of the website may answer it.
          </p>
          {error("sourcePath") ? (
            <p className="adm-hint adm-error" id="f-sourcePath-error">
              {error("sourcePath")}
            </p>
          ) : null}
        </div>
        <fieldset className="adm-subset">
          <legend className="adm-label">Leads to</legend>
          <div className="adm-site-checks">
            {TARGETS.map((t) => (
              <label key={t.value} className="adm-check">
                <input type="radio" name="targetType" value={t.value} checked={draft.targetType === t.value} disabled={disabled} onChange={() => set("targetType", t.value)} />
                {t.label}
              </label>
            ))}
          </div>
          {draft.targetType === "path" ? (
            <div className="adm-field">
              <label className="adm-label" htmlFor="f-targetPath">
                New address
              </label>
              <input
                id="f-targetPath"
                className="adm-input"
                dir="ltr"
                value={draft.targetPath}
                disabled={disabled}
                placeholder="/en/about"
                aria-invalid={error("targetPath") ? true : undefined}
                aria-describedby={describe("f-targetPath", true, error("targetPath"))}
                onChange={(e) => set("targetPath", e.target.value)}
              />
              <p className="adm-hint" id="f-targetPath-hint">
                A page of today&apos;s website: a site page, a service or a project, with its language.
              </p>
              {error("targetPath") ? (
                <p className="adm-hint adm-error" id="f-targetPath-error">
                  {error("targetPath")}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="adm-field">
              <label className="adm-label" htmlFor="f-targetId">
                {TARGETS.find((t) => t.value === draft.targetType)?.label}
              </label>
              <select
                id="f-targetId"
                className="adm-input"
                value={draft.targetId}
                disabled={disabled}
                aria-invalid={error("targetId") ? true : undefined}
                aria-describedby={describe("f-targetId", true, error("targetId"))}
                onChange={(e) => set("targetId", e.target.value)}
              >
                <option value="">Choose…</option>
                {choices[draft.targetType].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="adm-hint" id="f-targetId-hint">
                A working record (not archived). It leads to the record&apos;s address in the old address&apos;s language.
              </p>
              {error("targetId") ? (
                <p className="adm-hint adm-error" id="f-targetId-error">
                  {error("targetId")}
                </p>
              ) : null}
            </div>
          )}
        </fieldset>
        <fieldset className="adm-subset">
          <legend className="adm-label">Kind</legend>
          <div className="adm-site-checks">
            <label className="adm-check">
              <input type="radio" name="statusCode" checked={draft.statusCode === 308} disabled={disabled} onChange={() => set("statusCode", 308)} />
              Permanent (308)
            </label>
            <label className="adm-check">
              <input type="radio" name="statusCode" checked={draft.statusCode === 307} disabled={disabled} onChange={() => set("statusCode", 307)} />
              Temporary (307)
            </label>
          </div>
        </fieldset>
        <div className="adm-field">
          <label className="adm-label" htmlFor="f-note">
            Note (optional, admin only)
          </label>
          <input id="f-note" className="adm-input" value={draft.note} disabled={disabled} maxLength={300} onChange={(e) => set("note", e.target.value)} aria-invalid={error("note") ? true : undefined} />
          {error("note") ? <p className="adm-hint adm-error">{error("note")}</p> : null}
        </div>
      </section>
      {canEdit ? (
        <div className="adm-savebar">
          <span className="adm-savebar-status" role="status">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>
          <button type="submit" className="adm-btn is-primary" disabled={pending} aria-disabled={pending}>
            {pending ? "Saving…" : creating ? "Create redirect" : "Save redirect"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** Deactivate (always allowed) or reactivate (checked again by the server) a redirect, with the version shown. */
export function RedirectToggle({ id, lockVersion, active }: { id: string; lockVersion: number; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SiteActionState>({ status: "idle" });
  return (
    <div className="adm-site-setup">
      <button
        type="button"
        className={`adm-btn${active ? " is-danger" : ""}`}
        disabled={pending}
        aria-disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setRedirectActiveAction({ id, expectedVersion: lockVersion, active: !active });
            setState(result);
            if (result.status === "ok") router.replace(savedAt(`/admin/redirects/${id}?saved=1`, result.lockVersion), { scroll: false });
          })
        }
      >
        {pending ? "Working…" : active ? "Deactivate" : "Reactivate"}
      </button>
      <div role="status" aria-live="polite">
        {state.status === "error" ? (
          <div className="adm-alert is-error">
            <p>{state.message}</p>
            {state.issues.length ? (
              <ul className="adm-error-list">
                {state.issues.map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
