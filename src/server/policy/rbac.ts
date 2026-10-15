/**
 * Authorization rules beyond the permission matrix (A1-SECURITY-RBAC §5.2), as pure functions so every server-side
 * check uses the same logic and the tests can run them table by table.
 *
 * - Rank rule: nobody manages (invites, edits, disables, signs out) a user of equal or higher rank — except the Owner,
 *   who may manage other Owners.
 * - Only the Owner grants or removes the Admin and Owner roles; others may grant only roles ranked below their own.
 * - Nobody changes their own roles or status (the Owner included): a second Owner must do it.
 * - A change of roles adds privilege when the account gains a permission, a higher rank or the Owner role
 *   (`addsPrivilege`, A2 Correction 2): such a change is also decided on the account's credentials.
 */
import { permissionsOf, rankOf, roleRank } from "./registry.ts";

export interface RankedPrincipal {
  roles: readonly string[];
}

export const isOwner = (principal: RankedPrincipal) => principal.roles.includes("owner");

/**
 * Would replacing an account's roles `before` with `after` give it anything it did not have (A2 Correction 2)? A
 * permission it did not hold; a higher rank (the rank decides whom it may manage, which roles it may grant and who may
 * manage it); or the Owner role (which the rank rules do not bind). Removing roles, or swapping a role for one whose
 * permissions and rank the account already has (Admin → Editor, Owner → Admin), gives nothing, whatever role keys the
 * change names; Editor → Reviewer gives the review and publish-after-review permissions an Editor does not hold.
 * Decided on the roles the account has under its row lock, never on what a page says the change is.
 */
export function addsPrivilege(before: readonly string[], after: readonly string[]): boolean {
  const held = permissionsOf(before);
  for (const key of permissionsOf(after)) if (!held.has(key)) return true;
  return rankOf(after) > rankOf(before) || (isOwner({ roles: after }) && !isOwner({ roles: before }));
}

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
