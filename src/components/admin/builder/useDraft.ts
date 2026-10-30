"use client";
/**
 * Keeps an editor's unsaved work in this browser tab (`draft.ts`; A5 final correction) and finds what an earlier visit
 * kept. While the editor is dirty its working copy is written to the tab's storage (half a second after the last change,
 * and at once when the page goes: a redirect to the sign-in page, a reload, closing the tab); once it is clean again —
 * saved, undone or discarded — the copy is removed.
 *
 * A copy found when the editor opens (`pending`) waits for the person: nothing new is written over it until they restore
 * or discard it, and the editor stays inert meanwhile. Nothing here talks to the server, and nothing runs on a timer
 * while the editor is idle: an idle tab neither keeps its session alive nor writes anything.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FORGET_DRAFTS_EVENT, readDraft, removeDraft, tabStorage, writeDraft, type Draft, type DraftKind, type DraftRef } from "./draft";

const WRITE_DELAY_MS = 500;
const subscribeNothing = () => () => {};

export interface DraftKeeper<P> {
  /** The copy an earlier visit kept for this user and record, until the person restores or discards it. */
  pending: Draft<P> | null;
  /** The person chose to restore `pending` (the editor applies it); writing resumes with the restored copy. */
  restored: () => void;
  /** The person discarded `pending`: it is removed. */
  discard: () => void;
  /** A save succeeded: the copy is removed and nothing more is written from this editor (the stored version replaces it). */
  saved: () => void;
  /** The person confirmed leaving the editor without saving: the copy is removed, and nothing more is kept from here. */
  drop: () => void;
}

export function useDraft<P>(options: {
  user: string;
  kind: DraftKind;
  id: string;
  /** The record's version this editor opened. */
  base: number;
  /** Whether this person may edit here at all (a view-only editor keeps nothing). */
  enabled: boolean;
  dirty: boolean;
  /** Changes whenever the working copy does (the editor's own key of its state). */
  version: string;
  /** The working copy to keep, made only when it is written. */
  payload: () => P;
  /** Reads a kept payload back (null: not one of this editor's); a module-level function, so it never changes. */
  read: (value: unknown) => P | null;
}): DraftKeeper<P> {
  const { user, kind, id, base, enabled, dirty, version, payload, read } = options;
  // What an earlier visit kept, looked for once when this editor mounts (before it writes anything of its own; nothing
  // on the server, where there is no tab storage) and shown only once hydrated, so the first render matches the server's.
  const [found] = useState(() => (enabled ? readDraft(tabStorage(), { user, kind, id }, read) : null));
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [decided, setDecided] = useState(false);
  const pending = hydrated && !decided ? found : null;

  const latest = useRef({ dirty, payload, writable: false });
  const timer = useRef<number | null>(null);
  const closed = useRef(false);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const now = latest.current;
    if (closed.current || !now.writable) return;
    const ref: DraftRef = { user, kind, id };
    if (now.dirty) writeDraft(tabStorage(), ref, base, now.payload(), Date.now());
    else removeDraft(tabStorage(), ref);
  }, [user, kind, id, base]);

  // After every change of the working copy: remember it, and write it shortly (one write for a burst of typing).
  useEffect(() => {
    latest.current = { dirty, payload, writable: hydrated && enabled && (decided || !found) };
    if (!latest.current.writable || closed.current) return;
    if (timer.current === null) timer.current = window.setTimeout(flush, WRITE_DELAY_MS);
  }, [dirty, version, payload, hydrated, enabled, decided, found, flush]);

  // When the page goes (another page in the app, a redirect, a reload, the tab closing): write what is pending now.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const stop = useCallback(() => {
    closed.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const drop = useCallback(() => {
    stop();
    removeDraft(tabStorage(), { user, kind, id });
  }, [stop, user, kind, id]);
  // Sign-out clears every copy in the tab: an editor still open keeps nothing more (not even as it unmounts).
  useEffect(() => {
    window.addEventListener(FORGET_DRAFTS_EVENT, stop);
    return () => window.removeEventListener(FORGET_DRAFTS_EVENT, stop);
  }, [stop]);

  return {
    pending,
    restored: () => setDecided(true),
    discard: () => {
      removeDraft(tabStorage(), { user, kind, id });
      setDecided(true);
    },
    saved: () => {
      stop();
      removeDraft(tabStorage(), { user, kind, id });
    },
    drop,
  };
}
