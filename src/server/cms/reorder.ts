/**
 * Ordering a collection with accessible "Move up" / "Move down" controls (A3 brief §33). An item moves past the nearest
 * active item in that direction by exchanging positions with it; archived items keep their place (they come back there
 * when restored) and are stepped over. Pure planning; the service applies a plan under the ordering's row lock.
 */

export interface OrderedItem {
  id: string;
  position: number;
  active: boolean;
}

export type MoveDirection = "up" | "down";

export type MovePlan = { kind: "swap"; a: { id: string; position: number }; b: { id: string; position: number } } | { kind: "edge" } | { kind: "missing" };

/** Items sorted by position (ties are impossible: the database keeps positions unique per collection). */
export const byPosition = <T extends OrderedItem>(items: readonly T[]) => [...items].sort((x, y) => x.position - y.position);

export function planMove(items: readonly OrderedItem[], id: string, direction: MoveDirection): MovePlan {
  const sorted = byPosition(items);
  const index = sorted.findIndex((item) => item.id === id);
  if (index < 0 || !sorted[index].active) return { kind: "missing" };
  const step = direction === "up" ? -1 : 1;
  for (let i = index + step; i >= 0 && i < sorted.length; i += step) {
    if (sorted[i].active) {
      return { kind: "swap", a: { id: sorted[index].id, position: sorted[index].position }, b: { id: sorted[i].id, position: sorted[i].position } };
    }
  }
  return { kind: "edge" };
}

/** The position for an item added at the end. */
export const nextPosition = (items: readonly { position: number }[]) => items.reduce((max, item) => Math.max(max, item.position), 0) + 1;

/** What changed between two ordered lists of ids (relations): added, removed, and whether the kept ones moved. */
export function diffOrdered(before: readonly string[], after: readonly string[]) {
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  const keptBefore = before.filter((id) => after.includes(id));
  const keptAfter = after.filter((id) => before.includes(id));
  const reordered = keptBefore.some((id, i) => keptAfter[i] !== id);
  return { added, removed, reordered, changed: added.length > 0 || removed.length > 0 || reordered };
}
