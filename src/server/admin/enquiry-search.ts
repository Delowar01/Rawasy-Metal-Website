/**
 * The enquiry inbox's search for the signed-in user (A7 final correction): read from its sealed cookie, never from an
 * address. See `src/server/enquiries/search-state.ts` for the sealing and `context.ts` for the cookie.
 */
import type { Actor } from "@/server/auth/types";
import { openSearch, sealSearch } from "@/server/enquiries/search-state";
import { authDeps, readEnquirySearchCookie, writeEnquirySearchCookie } from "./context";

/** The search the list applies for this user ("" when none, or when the sealed value is not theirs or has expired). */
export async function currentEnquirySearch(actor: Actor): Promise<string> {
  const deps = authDeps();
  return openSearch(deps.keyRing(), await readEnquirySearchCookie(), actor.user.id, deps.clock());
}

/** Keeps a new search for this user (Server Actions only); an empty one removes the cookie. */
export async function keepEnquirySearch(actor: Actor, search: string): Promise<void> {
  const deps = authDeps();
  await writeEnquirySearchCookie(search ? sealSearch(deps.keyRing(), actor.user.id, search, deps.clock()) : null);
}
