/**
 * Collection order (A3 brief §33): "Move up" / "Move down" buttons, keyboard-usable, no drag and drop. A move is decided
 * on the order the page showed (the ordering's `lock_version`): under the ordering's row lock a stale page changes
 * nothing, and the two items exchange positions in one transaction, so positions stay unique and the order
 * deterministic. Archived items keep their place and are stepped over.
 */
import type { Db } from "../db/client.ts";
import { isUlid } from "../security/ids.ts";
import type { ChangeContext } from "./engine.ts";
import { refLabel, refsByIds, type ItemRef } from "./lookups.ts";
import { can } from "./permissions.ts";
import { ENTITIES, type EntityType, type OrderingKey } from "./registry.ts";
import type { MoveDirection } from "./reorder.ts";
import { contentAudit, contentTransaction, moveInOrdering, orderingVersion, readOrder } from "./store.ts";

export interface OrderView {
  key: OrderingKey;
  /** Read before the rows: a move committed in between makes the page stale, never wrongly current. */
  lockVersion: number;
  rows: (ItemRef & { position: number })[];
}

export async function loadOrder(db: Db, type: EntityType): Promise<OrderView | null> {
  const key = ENTITIES[type].orderingKey;
  if (!key) return null;
  const lockVersion = await orderingVersion(db, key);
  const order = await readOrder(db, key, type);
  const refs = await refsByIds(
    db,
    type,
    order.map((o) => o.id),
  );
  const byId = new Map(refs.map((r) => [r.id, r]));
  return {
    key,
    lockVersion,
    rows: order.flatMap((o) => {
      const ref = byId.get(o.id);
      return ref ? [{ ...ref, position: o.position }] : [];
    }),
  };
}

export type ReorderResult =
  | { kind: "ok"; summary: string; lockVersion: number }
  | { kind: "edge"; message: string }
  | { kind: "stale" }
  | { kind: "denied"; message: string }
  | { kind: "not_found" };

export async function moveItem(ctx: ChangeContext, type: EntityType, itemId: string, direction: MoveDirection, expectedVersion: number): Promise<ReorderResult> {
  const { deps, actor, meta } = ctx;
  const info = ENTITIES[type];
  const key = info.orderingKey;
  if (!key || !isUlid(itemId)) return { kind: "not_found" };
  const action = `${type}.reorder`;
  if (!can(actor.permissions, type, "reorder")) {
    await contentAudit(deps.db, actor, meta, deps.clock(), {
      action,
      type,
      id: itemId,
      outcome: "denied",
      summary: `Refused: changing the order of ${info.many.toLowerCase()} needs orderings.edit.`,
    });
    return { kind: "denied", message: "You don't have permission to change the order." };
  }
  return contentTransaction(deps, actor, async (tx, now) => {
    const result = await moveInOrdering(tx, key, type, itemId, direction, expectedVersion, actor.user.id, now);
    if (result.kind === "stale") {
      await contentAudit(tx, actor, meta, now, {
        action,
        type,
        id: itemId,
        outcome: "failed",
        summary: `Refused: the order of ${info.many.toLowerCase()} changed after the page was opened.`,
      });
      return { kind: "stale" } as const;
    }
    if (result.kind === "edge") return { kind: "edge", message: direction === "up" ? "This item is already first." : "This item is already last." } as const;
    if (result.kind === "missing") return { kind: "not_found" } as const;
    const [moved, other] = await refsByIds(tx, type, [itemId, result.otherId]);
    const name = moved ? refLabel(moved) : itemId;
    const past = other ? refLabel(other) : result.otherId;
    await contentAudit(tx, actor, meta, now, {
      action,
      type,
      id: itemId,
      label: name,
      summary: `Moved ${info.one} “${name}” ${direction} past “${past}”.`,
      changes: { after: { direction, past: result.otherId } },
    });
    return { kind: "ok", summary: `Moved “${name}” ${direction}.`, lockVersion: result.lockVersion } as const;
  });
}
