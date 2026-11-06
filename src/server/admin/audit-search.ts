/**
 * The audit log's search for the signed-in user (A8.5): read from its sealed cookie, never from an address — a search
 * may hold a person's name or email (audit labels name who acted). The sealing is the enquiry search's
 * (`src/server/enquiries/search-state.ts`) with its own purpose, so one never opens as the other; cleared at sign-in and
 * sign-out with the session cookie.
 */
import type { Actor } from "@/server/auth/types";
import { openSearch, sealSearch } from "@/server/enquiries/search-state";
import { authDeps, readAuditSearchCookie, writeAuditSearchCookie } from "./context";

export async function currentAuditSearch(actor: Actor): Promise<string> {
  const deps = authDeps();
  return openSearch(deps.keyRing(), await readAuditSearchCookie(), actor.user.id, deps.clock(), "audit_search");
}

export async function keepAuditSearch(actor: Actor, search: string): Promise<void> {
  const deps = authDeps();
  await writeAuditSearchCookie(search ? sealSearch(deps.keyRing(), actor.user.id, search, deps.clock(), "audit_search") : null);
}
