"use client";
/**
 * A button that opens a confirmation dialog (native <dialog>: focus moves in, Escape closes, focus returns) whose form
 * runs a Server Action. The page refreshes after a success so the change shows; errors stay in the dialog.
 */
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import type { ActionState } from "@/server/admin/actions/state";
import { idle } from "@/server/admin/actions/state";
import { FormAlert, SubmitButton } from "./forms";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function ConfirmAction({
  action,
  label,
  title,
  children,
  confirmLabel,
  fields,
  danger = false,
  small = false,
}: {
  action: Action;
  label: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  fields: Record<string, string>;
  danger?: boolean;
  small?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, run] = useActionState(action, idle);
  const router = useRouter();
  const titleId = useId();
  useEffect(() => {
    if (state.status === "ok") {
      dialog.current?.close();
      router.refresh();
    }
  }, [state, router]);
  return (
    <>
      <button
        type="button"
        className={["adm-btn", danger ? "is-danger" : "", small ? "is-small" : ""].filter(Boolean).join(" ")}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      {state.status === "ok" && state.message ? (
        <span className="adm-sr-only" role="status">
          {state.message}
        </span>
      ) : null}
      <dialog ref={dialog} className="adm-dialog" aria-labelledby={titleId}>
        <form action={run} className="adm-dialog-body">
          <h2 id={titleId}>{title}</h2>
          <div>{children}</div>
          <FormAlert state={state} />
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="adm-actions">
            <SubmitButton variant={danger ? "danger" : "primary"} pending="Working…">
              {confirmLabel}
            </SubmitButton>
            <button type="button" className="adm-btn" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
