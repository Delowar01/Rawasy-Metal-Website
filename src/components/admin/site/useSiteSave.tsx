"use client";
/**
 * A site-controls form's submission (A6): calls the Server Action with the form's state in a transition (no automatic
 * form reset, so typed values stay on an error), keeps the answer, and after a success opens the screen again from what
 * is stored (`?saved=<key>`: the screen shows the confirmation, and the form, keyed by the stored version, remounts).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SiteActionState } from "@/server/admin/actions/site-model";

export function useSiteSave<T>(action: (input: T) => Promise<SiteActionState>, savedHref: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SiteActionState>({ status: "idle" });
  const submit = (input: T) =>
    startTransition(async () => {
      const result = await action(input);
      setState(result);
      if (result.status === "ok") router.replace(savedHref, { scroll: false });
    });
  const reload = () => {
    setState({ status: "idle" });
    router.refresh();
  };
  const issue = (path: string) => (state.status === "error" ? state.issues.find((i) => i.path === path || i.path.startsWith(`${path}.`))?.message : undefined);
  return { pending, state, submit, reload, issue };
}

/** The answer of the last save: errors at once (alert), with the list of fields and, when stale, the way back. */
export function SaveAlert({ state, onReload }: { state: SiteActionState; onReload: () => void }) {
  if (state.status !== "error") return null;
  return (
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
          <button type="button" className="adm-btn" onClick={onReload}>
            Reload the latest version
          </button>
        </div>
      ) : null}
    </div>
  );
}
