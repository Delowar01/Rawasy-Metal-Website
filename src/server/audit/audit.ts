/**
 * The security audit log (A1-SECURITY-RBAC §11; A1-DATABASE-SCHEMA `audit_events`). Append-only: this module only
 * inserts — there is no update or delete path for audit rows in the application.
 *
 * Never logged (A2 brief §21): passwords, raw tokens, TOTP secrets, TOTP codes, recovery codes, encryption keys,
 * database or mail credentials. Summaries are written by code from names, emails, role keys and counts only, and
 * `changes` passes through `redactChanges`, which drops any key that could hold a secret.
 */
import type { Db } from "../db/client.ts";
import { auditEvents, AUDIT_OUTCOMES } from "../db/schema.ts";

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export interface AuditActor {
  type: "user" | "system" | "cli";
  userId?: string | null;
  /** Display name and email at the time (or the CLI operator). */
  label?: string | null;
  roles?: readonly string[];
  sessionId?: string | null;
}

export interface AuditEntity {
  type: string;
  id?: string | null;
  label?: string | null;
}

export interface AuditEvent {
  requestId: string;
  actor: AuditActor;
  ip?: string | null;
  action: string;
  entity?: AuditEntity;
  outcome: AuditOutcome;
  summary: string;
  changes?: Record<string, unknown>;
  at: Date;
}

/** Keys that are never stored in `changes`, whatever their value. */
const SECRET_KEY = /pass|token|secret|otp|totp|recovery|code|key|hash|cookie|credential|nonce|salt/i;
const ALLOWED_KEYS = new Set(["roles", "status", "before", "after", "role_keys", "sessions", "count", "reason", "applied"]);

/** Removes anything that might be a secret from a `changes` object (recursively). */
export function redactChanges(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactChanges(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (!ALLOWED_KEYS.has(key) && SECRET_KEY.test(key)) continue;
      out[key] = redactChanges(inner, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.slice(0, 200);
  return value;
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

export async function recordAudit(db: Db, event: AuditEvent): Promise<void> {
  await db.insert(auditEvents).values({
    occurredAt: event.at,
    requestId: event.requestId,
    actorType: event.actor.type,
    actorUserId: event.actor.userId ?? null,
    actorLabel: clip(event.actor.label, 200),
    actorRoles: clip(event.actor.roles?.join(",") ?? null, 100),
    sessionId: event.actor.sessionId ?? null,
    ip: clip(event.ip, 45),
    action: event.action,
    entityType: event.entity?.type ?? null,
    entityId: clip(event.entity?.id, 64),
    entityLabel: clip(event.entity?.label, 255),
    outcome: event.outcome,
    summary: event.summary.slice(0, 500),
    changes: event.changes ? redactChanges(event.changes) : null,
  });
}

/** "Name <email>" for actor and entity labels. */
export const userLabel = (user: { displayName: string; email: string }) => `${user.displayName} <${user.email}>`;
