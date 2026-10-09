/**
 * The state a form shows after a Server Action (shared by the actions and the admin's client components; plain data,
 * no server code).
 */
export type ActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
  /** The form needs a re-authentication first (sensitive permission, older than 10 minutes). */
  stepUp?: boolean;
  /** Values to put back into the form (never a password, code or token). */
  fields?: Record<string, string>;
};

export const idle: ActionState = { status: "idle" };
