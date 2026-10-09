/** A user's own sessions (A1-SECURITY-RBAC §3.3 "device list"): sign out one other session, or all of them. */
import { and, eq } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { sessions } from "../db/schema.ts";
import type { AuthDeps } from "./deps.ts";
import { revokeSession, revokeUserSessions } from "./sessions.ts";
import { auditActorOf, type Actor, type RequestMeta } from "./types.ts";

/** Signs out one of the actor's other sessions (the current one is signed out with "Sign out"). */
export async function revokeOwnSession(deps: AuthDeps, actor: Actor, sessionId: string, meta: RequestMeta): Promise<boolean> {
  if (sessionId === actor.session.id) return false;
  const [owned] = await deps.db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, actor.user.id)))
    .limit(1);
  if (!owned) return false;
  const now = deps.clock();
  const done = await revokeSession(deps.db, sessionId, "revoked", now);
  if (done) {
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action: "session.revoke",
      entity: { type: "user", id: actor.user.id, label: userLabel(actor.user) },
      outcome: "success",
      summary: "Signed out one of their own sessions.",
    });
  }
  return done;
}

/** Signs out every other session of the actor. */
export async function revokeOtherOwnSessions(deps: AuthDeps, actor: Actor, meta: RequestMeta): Promise<number> {
  const now = deps.clock();
  const count = await revokeUserSessions(deps.db, actor.user.id, "revoked", now, actor.session.id);
  await recordAudit(deps.db, {
    at: now,
    requestId: meta.requestId,
    actor: auditActorOf(actor),
    ip: meta.ip,
    action: "session.revoke",
    entity: { type: "user", id: actor.user.id, label: userLabel(actor.user) },
    outcome: "success",
    summary: `Signed out of ${count} other session(s).`,
  });
  return count;
}
