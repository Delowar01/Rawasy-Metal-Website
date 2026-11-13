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
  /**
   * A server command acting as this account (A9's content import): the server shell is its authority, as for A2's
   * CLIs. Its audit events are `cli` events that still name the account, with the operator in the label.
   */
  cli?: { operator: string };
}

export const auditActorOf = (actor: { user: Principal["user"]; roles: readonly string[]; session?: SessionRow | null; cli?: { operator: string } }): AuditActor => ({
  type: actor.cli ? "cli" : "user",
  userId: actor.user.id,
  label: actor.cli ? `${userLabel(actor.user)} via ${actor.cli.operator}`.slice(0, 200) : userLabel(actor.user),
  roles: actor.roles,
  sessionId: actor.session?.id ?? null,
});
