/**
 * The admin's data-access layer on the Next.js side (A1-SECURITY-RBAC §3.3, §5): the session read from the cookie and
 * validated against the database once per request, the request facts recorded with events, and the cookie itself.
 * Every admin page, layout and Server Action calls these — never only a layout, and never the proxy.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { mfaStateOf, principalOf, type MfaState, type UserRow } from "@/server/auth/accounts";
import { createAuthDeps, type AuthDeps } from "@/server/auth/deps";
import { findSessionByToken, SESSION_COOKIE, touchSession, type SessionRow } from "@/server/auth/sessions";
import type { Actor, RequestMeta } from "@/server/auth/types";
import { adminBaseUrl, trustedProxyHops } from "@/server/config/env";
import { describeDbError, getPool } from "@/server/db/pool";
import { resolveClientIp } from "@/server/security/client-ip";
import { ulid } from "@/server/security/ids";

const HOLDER = Symbol.for("rawasy.admin.authDeps");

/** This process's services, created on first use. */
export function authDeps(): AuthDeps {
  const holder = globalThis as { [HOLDER]?: AuthDeps };
  return (holder[HOLDER] ??= createAuthDeps(getPool()));
}

/** A database problem, by code only (the driver's message can hold SQL and parameters). */
export class AdminUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`The admin database is unavailable (${describeDbError(cause)}).`);
    this.name = "AdminUnavailableError";
  }
}

/** Runs database work, turning a driver error into a code-only error (redirects and not-found pass through). */
export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    unstable_rethrow(error);
    throw new AdminUnavailableError(error);
  }
}

export type AdminState =
  | { status: "anonymous" }
  | { status: "mfa_pending"; session: SessionRow; user: UserRow }
  | { status: "enrolment_required"; actor: Actor; mfa: MfaState }
  | { status: "active"; actor: Actor; mfa: MfaState };

/** The current admin session, validated once per request (cached with React's `cache`). */
export const getAdminState = cache(async (): Promise<AdminState> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { status: "anonymous" };
  return guarded(async () => {
    const deps = authDeps();
    const now = deps.clock();
    const found = await findSessionByToken(deps.db, token, now);
    if (!found) return { status: "anonymous" } as const;
    const session = await touchSession(deps.db, found.session, now);
    const principal = await principalOf(deps.db, found.user);
    const mfa = await mfaStateOf(deps.db, found.user.id, principal.roles);
    if (mfa.enrolled && !session.mfaVerifiedAt) return { status: "mfa_pending", session, user: found.user } as const;
    const actor: Actor = { ...principal, session };
    if (mfa.required && !mfa.enrolled) return { status: "enrolment_required", actor, mfa } as const;
    return { status: "active", actor, mfa } as const;
  });
});

/** What is recorded about this request: its id, the client address (trusted hops only) and the user agent. */
export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return {
    requestId: ulid(),
    ip: resolveClientIp(h.get("x-forwarded-for"), trustedProxyHops()),
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
  };
}

/**
 * A mutation must come from the admin's own pages (A1 §6): an Origin exactly equal to the admin's origin (a missing
 * one is refused) and, when the browser sends fetch metadata, `same-origin`. Next.js also checks Origin against Host
 * for Server Actions; this check does not depend on the request's Host header.
 */
export async function isSameOriginRequest(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin || origin !== adminBaseUrl()) return false;
  const site = h.get("sec-fetch-site");
  return !site || site === "same-origin";
}

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: "strict", path: "/" } as const;

/** Sets the session cookie (Server Actions only): the token alone, `__Host-` prefixed, no expiry (browser session). */
export async function writeSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

export async function clearSessionCookie() {
  (await cookies()).delete({ name: SESSION_COOKIE, ...COOKIE_OPTIONS });
}
