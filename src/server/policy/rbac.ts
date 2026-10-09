/**
 * Authorization rules beyond the permission matrix (A1-SECURITY-RBAC §5.2), as pure functions so every server-side
 * check uses the same logic and the tests can run them table by table.
 *
 * - Rank rule: nobody manages (invites, edits, disables, signs out) a user of equal or higher rank — except the Owner,
 *   who may manage other Owners.
 * - Only the Owner grants or removes the Admin and Owner roles; others may grant only roles ranked below their own.
 * - Nobody changes their own roles or status (the Owner included): a second Owner must do it.
 */
import { rankOf, roleRank } from "./registry.ts";

export interface RankedPrincipal {
  roles: readonly string[];
}

export const isOwner = (principal: RankedPrincipal) => principal.roles.includes("owner");

/** May `actor` manage `target` (rank rule)? */
export function canManageUser(actor: RankedPrincipal, target: RankedPrincipal): boolean {
  if (isOwner(actor)) return true;
  return rankOf(actor.roles) > rankOf(target.roles);
}

/** May `actor` grant or remove each of `roleKeys`? */
export function canGrantRoles(actor: RankedPrincipal, roleKeys: readonly string[]): boolean {
  if (isOwner(actor)) return true;
  const own = rankOf(actor.roles);
  return roleKeys.every((key) => roleRank(key) > 0 && roleRank(key) < own);
}

/** The roles an actor may offer when inviting or editing a user. */
export function grantableRoles(actor: RankedPrincipal, all: readonly string[]): string[] {
  return all.filter((key) => canGrantRoles(actor, [key]));
}
