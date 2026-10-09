/** Shared types of the authentication services. */
import type { AuditActor } from "../audit/audit.ts";
import { userLabel } from "../audit/audit.ts";
import type { Principal } from "./accounts.ts";
import type { SessionRow } from "./sessions.ts";

/** What the services know about the request: never trusted for authorization, only recorded. */
export interface RequestMeta {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

/** A signed-in, fully verified admin user acting through a session. */
export interface Actor extends Principal {
  session: SessionRow;
}

export const auditActorOf = (actor: { user: Principal["user"]; roles: readonly string[]; session?: SessionRow | null }): AuditActor => ({
  type: "user",
  userId: actor.user.id,
  label: userLabel(actor.user),
  roles: actor.roles,
  sessionId: actor.session?.id ?? null,
});
