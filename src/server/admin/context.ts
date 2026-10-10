/**
 * The admin's data-access layer on the Next.js side (A1-SECURITY-RBAC §3.3, §5): the session read from the cookie and
 * validated against the database once per request, the request facts recorded with events, and the cookie itself.
 * Every admin page, layout and Server Action calls these — never only a layout, and never the proxy.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { isAdminEnabled } from "@/lib/admin-gate";
import type { MfaState, UserRow } from "@/server/auth/accounts";
import { createAuthDeps, type AuthDeps } from "@/server/auth/deps";
import { readSessionState } from "@/server/auth/session-state";
import { SESSION_COOKIE, SessionEndedError, type SessionRow } from "@/server/auth/sessions";
import type { Actor, RequestMeta } from "@/server/auth/types";
import { adminBaseUrl, trustedProxyHops } from "@/server/config/env";
import { describeDbError, getPool } from "@/server/db/pool";
import { resolveClientIp } from "@/server/security/client-ip";
import { ulid } from "@/server/security/ids";

/**
 * The pre-A9 admin gate (A2 Correction 1), enforced here as well as in the proxy: with the admin off (ADMIN_ENABLED,
 * src/lib/admin-gate.ts) every admin layout, page and Server Action ends as "not found" before it reads a cookie or
 * opens a database connection. Read from the environment at request time: the admin's root layout awaits
 * `connection()` before calling it, so `next build` never decides it.
 */
export function assertAdminEnabled(): void {
  if (!isAdminEnabled()) notFound();
}

const HOLDER = Symbol.for("rawasy.admin.authDeps");

/** This process's services, created on first use (only while the admin is on). */
export function authDeps(): AuthDeps {
  assertAdminEnabled();
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

/** Where a request whose session has ended goes: the sign-in page, saying so. */
export const SESSION_ENDED_PATH = "/admin/login?session_ended=1";

/**
 * Runs database work, turning a driver error into a code-only error (redirects and not-found pass through). A session
 * revoked while the request ran (a rotation found it ended: signed out elsewhere, password or role changed) ends the
 * request as signed out.
 */
export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof SessionEndedError) redirect(SESSION_ENDED_PATH);
    throw new AdminUnavailableError(error);
  }
}

export type AdminState =
  /** `ended`: the cookie names a session that has ended — revoked, rotated by another request, or expired. */
  | { status: "anonymous"; ended: boolean }
  | { status: "mfa_pending"; session: SessionRow; user: UserRow }
  | { status: "enrolment_required"; actor: Actor; mfa: MfaState }
  | { status: "active"; actor: Actor; mfa: MfaState };

/** The sign-in page for a request without a usable session (saying so when its session has ended). */
export const signInPathFor = (state: AdminState) => (state.status === "anonymous" && state.ended ? SESSION_ENDED_PATH : "/admin/login");

/**
 * The current admin session, validated once per request (cached with React's `cache`). Only a live session counts: a
 * cookie holding a revoked token — the old token of a rotation included — is signed out, never mapped to its successor.
 * The session, its user, roles and second factor come from one database snapshot (`readSessionState`).
 */
export const getAdminState = cache(async (): Promise<AdminState> => {
  assertAdminEnabled();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { status: "anonymous", ended: false };
  return guarded(async (): Promise<AdminState> => {
    const state = await readSessionState(authDeps(), token);
    switch (state.kind) {
      case "none":
      case "ended":
        return { status: "anonymous", ended: state.kind === "ended" };
      case "mfa_pending":
        return { status: "mfa_pending", session: state.session, user: state.user };
      case "enrolment_required":
        return { status: "enrolment_required", actor: { ...state.principal, session: state.session }, mfa: state.mfa };
      case "active":
        return { status: "active", actor: { ...state.principal, session: state.session }, mfa: state.mfa };
    }
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
