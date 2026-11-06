/**
 * What a content transaction changed (A8.1): every aggregate root a change locks FOR UPDATE is noted here with the
 * version it had, and when the transaction's work is done `contentTransaction` asks the revision engine
 * (`src/server/publishing/revisions.ts`) to write one revision for each root whose version moved — so every save, in
 * every service (A3 records, A5 layouts and reusable sections, A6 controls, A7 forms), leaves an immutable snapshot
 * without each service having to remember it. A service that writes a revision of a particular kind itself (submit,
 * publish, restore) records it here, and the closing pass does not write a second one for the same change.
 *
 * The store lives in an AsyncLocalStorage scoped to one transaction: it never crosses requests, and a service called
 * while a content transaction is open joins that transaction (`contentTransaction` is re-entrant) instead of opening
 * a second connection that would wait on the first one's locks.
 *
 * Framework-free and dependency-free (the CMS store, the builder store, the site and forms services import it).
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** An aggregate as the revision engine names it (A1-PUBLISHING-VERSIONS §1). */
export type AggregateType =
  | "page"
  | "service"
  | "machine"
  | "project"
  | "project_category"
  | "industry"
  | "client"
  | "certificate"
  | "reusable_section"
  | "ordering"
  | "menu"
  | "site_settings"
  | "form";

export type RevisionIntentKind = "save" | "submit" | "publish" | "unpublish" | "archive" | "restore";

export interface RevisionIntent {
  kind: RevisionIntentKind;
  restoredFromId?: string | null;
  message?: string | null;
  /** The draft status after this change (default: a save or restore leaves the aggregate in draft). */
  draft?: "none" | "draft";
}

interface Noted {
  type: AggregateType;
  id: string;
  /** The root's version when this transaction first locked it. */
  version: number;
  /** A revision written by the service itself, at this root version (the closing pass skips it while unchanged). */
  recordedAt?: number;
}

export interface ChangeStore {
  tx: unknown;
  now: Date;
  actorId: string;
  noted: Map<string, Noted>;
  intents: Map<string, RevisionIntent>;
}

const storage = new AsyncLocalStorage<ChangeStore>();
const keyOf = (type: AggregateType, id: string) => `${type}:${id}`;

/** The open content transaction's store, if `tx` is its connection (a different handle is never mixed in). */
export function currentStore(tx?: unknown): ChangeStore | undefined {
  const store = storage.getStore();
  if (!store) return undefined;
  return tx === undefined || store.tx === tx ? store : undefined;
}

export function runWithStore<T>(store: ChangeStore, work: () => Promise<T>): Promise<T> {
  return storage.run(store, work);
}

/** Notes an aggregate root this transaction locked FOR UPDATE, with its version then (the first lock wins). */
export function noteLocked(tx: unknown, type: AggregateType, id: string, version: number): void {
  const store = currentStore(tx);
  if (!store) return;
  const key = keyOf(type, id);
  if (!store.noted.has(key)) store.noted.set(key, { type, id, version });
}

/** Notes an aggregate this transaction creates (its first revision is written as the transaction closes). */
export function noteCreated(tx: unknown, type: AggregateType, id: string): void {
  noteLocked(tx, type, id, -1);
}

/** Says what the next revision of this aggregate in this transaction is (default: a save). */
export function setIntent(tx: unknown, type: AggregateType, id: string, intent: RevisionIntent): void {
  const store = currentStore(tx);
  if (store) store.intents.set(keyOf(type, id), intent);
}

export function intentOf(store: ChangeStore, type: AggregateType, id: string): RevisionIntent {
  return store.intents.get(keyOf(type, id)) ?? { kind: "save" };
}

/** Records that a revision was written at this root version (by a publish, a submit…), so none is added for it. */
export function markRecorded(tx: unknown, type: AggregateType, id: string, version: number): void {
  const store = currentStore(tx);
  if (!store) return;
  const key = keyOf(type, id);
  const noted = store.noted.get(key) ?? { type, id, version };
  noted.recordedAt = version;
  store.noted.set(key, noted);
}
