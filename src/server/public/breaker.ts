/**
 * The content loader's circuit breaker (A9.4; A9 acceptance review L-1). After `limit` failed database reads in a row it
 * answers at once for `openMs` instead of queueing every request on a stalled database. A failure is counted once per
 * failed read: requests that waited on one shared snapshot load receive the same error, and that load is one read (before,
 * each waiting request counted it, so a single timed-out load opened the breaker for 60 s). A full local queue is load on
 * this process, not the database failing: it is never counted.
 *
 * Framework-free: the unit tests read it directly.
 */
export interface Breaker {
  /** True while the breaker answers at once. */
  isOpen(): boolean;
  /** A read succeeded: the count starts again. */
  succeeded(): void;
  /** A read failed with `error`; `local` failures (a full queue here) are not counted. */
  failed(error: unknown, local: boolean): void;
}

export function createBreaker(limit: number, openMs: number, now: () => number = Date.now): Breaker {
  let failures = 0;
  let openUntil = 0;
  const counted = new WeakSet<object>();
  return {
    isOpen: () => now() < openUntil,
    succeeded() {
      failures = 0;
    },
    failed(error, local) {
      if (local) return;
      if (error !== null && typeof error === "object") {
        if (counted.has(error)) return;
        counted.add(error);
      }
      failures += 1;
      if (failures >= limit) {
        openUntil = now() + openMs;
        failures = 0;
      }
    },
  };
}
