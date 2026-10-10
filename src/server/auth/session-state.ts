/**
 * What a session cookie's token gives one admin request (A1-SECURITY-RBAC §3.3), framework-free so the integration tests
 * run it as the admin does (`getAdminState` in src/server/admin/context.ts maps it to the page's state).
 *
 * The session, its user, the user's roles and second factor are read inside one transaction, so all four come from one
 * snapshot of the database (A2 Correction 1, fourth review): a role change or a removed second factor — both of which
 * revoke the session — committed between two of those reads can never be combined with a session read from before it.
 * Read separately, a just-promoted user's revoked session could render one page with the new roles, and a password-only
 * session awaiting its second factor could render as signed in once that factor was removed. The session's activity is
 * recorded afterwards, outside the snapshot.
 */
import { inTransaction } from "../db/client.ts";
import { mfaStateOf, principalOf, type MfaState, type Principal, type UserRow } from "./accounts.ts";
import type { AuthDeps } from "./deps.ts";
import { lookupSession, touchSession, type SessionRow } from "./sessions.ts";

export type SessionState =
  /** No session: no cookie, or a token that names none. */
  | { kind: "none" }
  /** The cookie names a session that has ended: revoked (rotated by another request included) or expired. */
  | { kind: "ended" }
  /** Password checked, second factor not yet given. */
  | { kind: "mfa_pending"; session: SessionRow; user: UserRow }
  /** Signed in, but the roles require a second factor that is not set up yet. */
  | { kind: "enrolment_required"; principal: Principal; session: SessionRow; mfa: MfaState }
  | { kind: "active"; principal: Principal; session: SessionRow; mfa: MfaState };

export async function readSessionState(deps: AuthDeps, token: unknown): Promise<SessionState> {
  const now = deps.clock();
  const read = await inTransaction(deps.pool, async (tx) => {
    const found = await lookupSession(tx, token, now);
    if (found.kind !== "live") return { kind: found.kind };
    const principal = await principalOf(tx, found.user);
    const mfa = await mfaStateOf(tx, found.user.id, principal.roles);
    return { kind: "live" as const, session: found.session, user: found.user, principal, mfa };
  });
  if (read.kind !== "live") return { kind: read.kind };
  const session = await touchSession(deps.db, read.session, now);
  if (read.mfa.enrolled && !session.mfaVerifiedAt) return { kind: "mfa_pending", session, user: read.user };
  if (read.mfa.required && !read.mfa.enrolled) return { kind: "enrolment_required", principal: read.principal, session, mfa: read.mfa };
  return { kind: "active", principal: read.principal, session, mfa: read.mfa };
}
