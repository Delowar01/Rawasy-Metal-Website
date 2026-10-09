"use client";
/** Form building blocks of the admin: labelled fields with linked hints and errors, pending buttons, live alerts. */
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/admin/actions/state";

export function SubmitButton({
  children,
  pending: pendingLabel,
  variant = "primary",
  block = false,
}: {
  children: ReactNode;
  pending?: string;
  variant?: "primary" | "secondary" | "danger";
  block?: boolean;
}) {
  const { pending } = useFormStatus();
  const cls = ["adm-btn", variant === "primary" ? "is-primary" : variant === "danger" ? "is-danger" : "", block ? "is-block" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="submit" className={cls} disabled={pending} aria-disabled={pending}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

/** The result of the last submission: errors are announced at once (alert), successes politely (status). */
export function FormAlert({ state, id }: { state: ActionState; id?: string }) {
  if (state.status === "idle" || !state.message) return null;
  const error = state.status === "error";
  return (
    <div id={id} className={`adm-alert ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
      <p>{state.message}</p>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export function Field({ label, name, hint, error, className, ...input }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={["adm-input", className].filter(Boolean).join(" ")}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      {hint ? (
        <p className="adm-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="adm-hint adm-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const PASSWORD_HINT = "12 to 128 characters. A few unrelated words make a strong password; common or leaked passwords are refused.";
