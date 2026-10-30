"use client";
/**
 * A site-controls form's submission (A6): calls the Server Action with the form's state in a transition (no automatic
 * form reset, so typed values stay on an error), keeps the answer, and after a success opens the screen again from what
 * is stored (`?saved=<key>&v=<version>`: the screen shows the confirmation, and the form, keyed by the stored version,
 * remounts; the version makes every save a new address, so a second save in a row is never answered from the router's
 * cache).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SiteActionState } from "@/server/admin/actions/site-model";

/** The address to open after a change: the screen's own, with the stored version. */
export function savedAt(href: string, version: number): string {
  return `${href}${href.includes("?") ? "&" : "?"}v=${version}`;
}

export function useSiteSave<T>(action: (input: T) => Promise<SiteActionState>, savedHref: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SiteActionState>({ status: "idle" });
  const submit = (input: T) =>
    startTransition(async () => {
      const result = await action(input);
      setState(result);
      if (result.status === "ok") router.replace(savedAt(savedHref, result.lockVersion), { scroll: false });
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
