/**
 * The enquiry inbox's search, kept out of every address (A7 final correction). A search for a name, an email or a phone
 * number is personal data: in a `?q=` it reached the address bar, the browser's history, the host's access log and every
 * page link of the list. Instead the search form posts it to a Server Action, which keeps it in a cookie of its own:
 *
 * - sealed with AES-256-GCM under the active key of A2's ring (`AUTH_ENCRYPTION_KEY`): the browser holds only
 *   ciphertext, and it cannot be read, changed or moved to another account (the user's id and the expiry are the
 *   associated data);
 * - `__Host-`, HttpOnly, Secure, SameSite=Strict and without an expiry date (gone when the browser closes), and sealed
 *   for 2 hours at most (the admin's idle limit): an older one is ignored;
 * - removed by "Clear", by an empty search, at sign-out (with the session cookie) and at every sign-in (another person
 *   may use the browser next); one sealed for another user is ignored.
 *
 * The list's address carries only the filters that hold no personal data (status, assignment, sort, page, size). The
 * CSV export reads the same sealed search on the server, so what is exported is what the list shows. Framework-free:
 * the unit tests call it directly; `src/server/admin/enquiry-search.ts` is the cookie side.
 */
import { decryptSecret, encryptSecret } from "../security/encryption.ts";
import type { KeyRing } from "../config/env.ts";
import { ENQUIRY_LIMITS } from "../forms/registry.ts";

/** How long a sealed search counts (the admin's idle limit). */
export const SEARCH_STATE_MS = 2 * 60 * 60 * 1000;

const SEALED = /^([1-9][0-9]{0,5})\.([0-9]{13})\.([A-Za-z0-9_-]{40,})$/;
const boundTo = (userId: string, expiresAt: number) => `enquiry_search:v1:${userId}:${expiresAt}`;

/** A search as the list reads it: trimmed, at most the list's limit (code points); control characters dropped. */
export function cleanSearch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim();
  return [...text].slice(0, ENQUIRY_LIMITS.search).join("");
}

/** Seals a search for one user: "<key version>.<expiry ms>.<base64url of iv | tag | ciphertext>". */
export function sealSearch(ring: KeyRing, userId: string, search: string, now: Date): string {
  const expiresAt = now.getTime() + SEARCH_STATE_MS;
  const { blob, version } = encryptSecret(ring, Buffer.from(cleanSearch(search), "utf8"), boundTo(userId, expiresAt));
  return `${version}.${expiresAt}.${blob.toString("base64url")}`;
}

/**
 * Opens a sealed search: "" when there is none, or when it is malformed, expired, sealed further ahead than a search
 * can be, tampered with, sealed for another user, or its key version is no longer configured.
 */
export function openSearch(ring: KeyRing, sealed: string | undefined, userId: string, now: Date): string {
  const match = sealed ? SEALED.exec(sealed) : null;
  if (!match) return "";
  const expiresAt = Number(match[2]);
  if (expiresAt <= now.getTime() || expiresAt > now.getTime() + SEARCH_STATE_MS) return "";
  try {
    return cleanSearch(decryptSecret(ring, Buffer.from(match[3], "base64url"), Number(match[1]), boundTo(userId, expiresAt)).toString("utf8"));
  } catch {
    return "";
  }
}
