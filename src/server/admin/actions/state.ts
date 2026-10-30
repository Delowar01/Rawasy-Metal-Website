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
  /**
   * No fully signed-in session (ended, or a sign-in still waiting for its second factor): nothing was done. Only actions
   * that ask for it answer this way (`actionContext`'s `signedOut: "answer"`); the others redirect to the sign-in page.
   */
  signedOut?: true;
};

export const idle: ActionState = { status: "idle" };
