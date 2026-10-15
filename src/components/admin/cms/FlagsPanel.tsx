"use client";
/**
 * A project's safety flags (A3 brief §24, §38): anyone may make the project more restrictive by adding a flag; only
 * Owner and Admin see "Clear", and clearing asks why. Each Clear names the flag instance this page showed, so a flag
 * cleared and set again since cannot be cleared from an older page. The server decides every change again.
 */
import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { addFlagAction, clearFlagAction } from "@/server/admin/actions/cms";
import type { FlagModel } from "@/server/admin/actions/cms-model";
import { idle, type ActionState } from "@/server/admin/actions/state";
import { ConfirmAction } from "../ConfirmAction";
import { FormAlert, SubmitButton } from "../forms";

export function FlagsPanel({
  projectId,
  flags,
  choices,
  canAdd,
  canClear,
  archived,
}: {
  projectId: string;
  flags: FlagModel[];
  choices: { value: string; label: string; description: string; blocking: boolean }[];
  canAdd: boolean;
  canClear: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [flag, setFlag] = useState("");
  const [note, setNote] = useState("");
  const [state, add] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await addFlagAction(previous, form);
    if (result.status === "ok") {
      setFlag("");
      setNote("");
      router.refresh();
    }
    return result;
  }, idle);
  const id = useId();
  const set = new Set(flags.map((f) => f.flag));
  const available = choices.filter((c) => !set.has(c.value));
  return (
    <div className="adm-flags">
      {flags.length === 0 ? (
        <p className="adm-muted">No restriction flags. The project is not restricted.</p>
      ) : (
        <ul className="adm-list">
          {flags.map((f) => (
            <li key={f.flag}>
              <div className="adm-flag-text">
                <strong>{f.label}</strong>{" "}
                {f.blocking ? <span className="adm-badge is-danger">Blocking</span> : <span className="adm-badge is-warning">Informative</span>}
                {f.description ? <p className="adm-hint">{f.description}</p> : null}
                {f.note ? <p className="adm-flag-note">Note: {f.note}</p> : null}
                <p className="adm-hint">
                  Added {f.addedAt}
                  {f.addedBy ? ` by ${f.addedBy}` : ""}
                </p>
              </div>
              {canClear && !archived ? (
                <ConfirmAction
                  action={clearFlagAction}
                  label="Clear"
                  title={`Clear “${f.label}”?`}
                  confirmLabel="Clear the flag"
                  fields={{ project: projectId, flag: f.flag, token: f.token }}
                  danger
                  small
                >
                  <p>This makes the project less restricted. Say why it can be cleared; the reason is kept in the audit log.</p>
                  <div className="adm-field">
                    <label className="adm-label" htmlFor={`${id}-${f.flag}-note`}>
                      Reason (required)
                    </label>
                    <textarea id={`${id}-${f.flag}-note`} name="note" className="adm-input adm-textarea" rows={3} maxLength={400} required />
                  </div>
                </ConfirmAction>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canClear && archived && flags.length ? <p className="adm-hint">Flags of an archived project can be cleared after it is restored.</p> : null}
      {!canClear && flags.length ? <p className="adm-hint">Only an Owner or Admin can clear a flag.</p> : null}
      {canAdd ? (
        <form action={add} className="adm-form adm-flag-add">
          <input type="hidden" name="project" value={projectId} />
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${id}-flag`}>
              Add a restriction
            </label>
            <select id={`${id}-flag`} name="flag" className="adm-input" value={flag} onChange={(e) => setFlag(e.target.value)} required aria-describedby={`${id}-flag-hint`}>
              <option value="">Choose a flag…</option>
              {available.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                  {c.blocking ? " (blocking)" : ""}
                </option>
              ))}
            </select>
            <p className="adm-hint" id={`${id}-flag-hint`}>
              {available.find((c) => c.value === flag)?.description ?? "Adding a flag only ever makes the project more restricted. Every role may add one."}
            </p>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${id}-note`}>
              Note (optional)
            </label>
            <textarea id={`${id}-note`} name="note" className="adm-input adm-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <FormAlert state={state} />
          <div className="adm-actions">
            <SubmitButton pending="Adding…">Add restriction</SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
