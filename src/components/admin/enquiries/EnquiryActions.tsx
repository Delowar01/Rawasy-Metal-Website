"use client";
/**
 * The enquiry page's controls (A7.3–A7.4): the workflow's next steps, the assignment, internal notes and a failed
 * notification's retry; and the inbox's CSV export (the Owner, with a step-up). Each calls its Server Action in a
 * transition, shows the answer where it was asked (a polite status line, errors as alerts) and, after a change, opens the
 * page again from what is stored (`?v=<version>`, never answered from the router's cache). The server decides every
 * change again: the version the page showed, the permission, the workflow's steps.
 */
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { addEnquiryNoteAction, assignEnquiryAction, changeEnquiryStatusAction, exportEnquiriesAction, retryNotificationAction } from "@/server/admin/actions/forms";
import type { ExportState, FormsActionState, TransitionModel } from "@/server/admin/actions/forms-model";

function useAction(href: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormsActionState>({ status: "idle" });
  const run = (work: () => Promise<FormsActionState>, after?: () => void) =>
    startTransition(async () => {
      const result = await work();
      setState(result);
      if (result.status === "ok") {
        after?.();
        router.replace(`${href}?done=1&v=${Date.now().toString(36)}`, { scroll: false });
      }
    });
  return { pending, state, run, reload: () => (setState({ status: "idle" }), router.refresh()) };
}

function Answer({ state, onReload }: { state: FormsActionState; onReload: () => void }) {
  if (state.status !== "error") return null;
  return (
    <div className="adm-alert is-error" role="alert">
      <p>{state.message}</p>
      {state.issues.length ? (
        <ul className="adm-error-list">
          {state.issues.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      ) : null}
      {state.stale ? (
        <div className="adm-actions">
          <button type="button" className="adm-btn" onClick={onReload}>
            Reload the latest version
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The workflow's next steps from the current status; closing without an answer asks for the reason first. */
export function StatusControls({ id, lockVersion, transitions }: { id: string; lockVersion: number; transitions: TransitionModel[] }) {
  const { pending, state, run, reload } = useAction(`/admin/enquiries/${id}`);
  const [reasonFor, setReasonFor] = useState<TransitionModel | null>(null);
  const [note, setNote] = useState("");
  const noteId = useId();
  const go = (t: TransitionModel, reason = "") => run(() => changeEnquiryStatusAction(id, { expectedVersion: lockVersion, to: t.to, note: reason }));
  return (
    <div className="adm-enq-controls">
      <Answer state={state} onReload={reload} />
      <div className="adm-actions">
        {transitions.map((t) => (
          <button
            key={`${t.to}-${t.label}`}
            type="button"
            className={`adm-btn${t.noteRequired ? " is-danger" : t.to === "closed" || t.to === "answered" || t.to === "open" ? " is-primary" : ""}`}
            disabled={pending}
            aria-disabled={pending}
            aria-expanded={t.noteRequired ? reasonFor === t : undefined}
            onClick={() => (t.noteRequired ? setReasonFor(reasonFor === t ? null : t) : go(t))}
          >
            {t.label}
          </button>
        ))}
      </div>
      {reasonFor ? (
        <form
          className="adm-enq-reason"
          onSubmit={(e) => {
            e.preventDefault();
            go(reasonFor, note);
          }}
        >
          <label className="adm-label" htmlFor={noteId}>
            Why is it closed without an answer? (required, kept in the history)
          </label>
          <textarea id={noteId} className="adm-input adm-textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
          <div className="adm-actions">
            <button type="submit" className="adm-btn is-danger" disabled={pending || !note.trim()} aria-disabled={pending || !note.trim()}>
              Close without an answer
            </button>
            <button type="button" className="adm-btn" onClick={() => setReasonFor(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <p className="adm-sr-only" role="status" aria-live="polite">
        {pending ? "Saving…" : ""}
      </p>
    </div>
  );
}

/** Who handles the enquiry (people who may manage enquiries, or nobody). */
export function AssignForm({ id, lockVersion, current, people }: { id: string; lockVersion: number; current: string | null; people: { id: string; name: string }[] }) {
  const { pending, state, run, reload } = useAction(`/admin/enquiries/${id}`);
  const [value, setValue] = useState(current ?? "");
  const selectId = useId();
  return (
    <form
      className="adm-enq-assign"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => assignEnquiryAction(id, { expectedVersion: lockVersion, assignee: value }));
      }}
    >
      <Answer state={state} onReload={reload} />
      <label className="adm-label" htmlFor={selectId}>
        Assigned to
      </label>
      <div className="adm-enq-inline">
        <select id={selectId} className="adm-input" value={value} onChange={(e) => setValue(e.target.value)} disabled={pending}>
          <option value="">Nobody</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit" className="adm-btn" disabled={pending || value === (current ?? "")} aria-disabled={pending || value === (current ?? "")}>
          {pending ? "Saving…" : "Assign"}
        </button>
      </div>
    </form>
  );
}

/** An internal note (plain text; staff only). */
export function NoteForm({ id }: { id: string }) {
  const [body, setBody] = useState("");
  const { pending, state, run, reload } = useAction(`/admin/enquiries/${id}`);
  const fieldId = useId();
  return (
    <form
      className="adm-enq-note-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addEnquiryNoteAction(id, { body }), () => setBody(""));
      }}
    >
      <Answer state={state} onReload={reload} />
      <label className="adm-label" htmlFor={fieldId}>
        Add an internal note
      </label>
      <textarea id={fieldId} className="adm-input adm-textarea" rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} disabled={pending} />
      <p className="adm-hint">Plain text, for staff only. Notes are never sent to the visitor.</p>
      <div className="adm-actions">
        <button type="submit" className="adm-btn is-primary" disabled={pending || !body.trim()} aria-disabled={pending || !body.trim()}>
          {pending ? "Adding…" : "Add note"}
        </button>
      </div>
    </form>
  );
}

/** Queue a failed notification again. */
export function RetryButton({ enquiryId, outboxId }: { enquiryId: string; outboxId: string }) {
  const { pending, state, run, reload } = useAction(`/admin/enquiries/${enquiryId}`);
  return (
    <>
      <button type="button" className="adm-btn is-small" disabled={pending} aria-disabled={pending} onClick={() => run(() => retryNotificationAction(outboxId))}>
        Send again
      </button>
      <Answer state={state} onReload={reload} />
    </>
  );
}

/** The inbox's CSV export: the current filters; the file is saved by the browser (never stored on the server). */
export function ExportButton({ params }: { params: Record<string, string> }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ExportState>({ status: "idle" });
  return (
    <div className="adm-enq-export">
      <button
        type="button"
        className="adm-btn"
        disabled={pending}
        aria-disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await exportEnquiriesAction(params);
            setState(result.status === "ok" ? { ...result, csv: "" } : result);
            if (result.status === "ok") {
              const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = result.filename;
              document.body.append(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
          })
        }
      >
        {pending ? "Exporting…" : "Export CSV"}
      </button>
      <p role="status" aria-live="polite" className={state.status === "error" ? "adm-alert is-error" : "adm-muted"}>
        {state.status === "idle" ? "" : state.message}
      </p>
    </div>
  );
}
