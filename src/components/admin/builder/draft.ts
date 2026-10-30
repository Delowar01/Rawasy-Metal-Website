/**
 * Unsaved editor work kept in this browser tab (A5 final correction): while the page builder or a reusable section's
 * editor holds unsaved changes, a copy of its working copy is kept in the tab's `sessionStorage`, so a session that ends,
 * a reload or a redirect to the sign-in page loses nothing — the editor offers it back the next time it opens here.
 *
 * What a copy holds, and nothing else: the editor's own content — a layout's sections as the editor holds them (order,
 * visibility, devices, anchors, links to reusable sections, the texts and settings of edited and new sections), or a
 * reusable section's name and data — with the user, the record and the version it was made from. Never a credential,
 * token, cookie, session id, password, code or file: media and records are named by id, exactly as a save sends them.
 *
 * Where it lives and when it goes: `sessionStorage` is this tab's own (other tabs and windows never see it; it ends with
 * the tab). A copy belongs to one user and one record; it is offered back only to that user, in that record's editor,
 * after the page's own sign-in and permission checks, and only when the record is still at the version it was made from
 * (anything else is offered for download or discarding, never applied over newer content). It is removed after a save,
 * when the person discards it or confirms leaving the editor through a link ("Leave this page and lose them?"), after 12
 * hours (the absolute session limit), when another user signs in in this tab (`purgeDrafts`), and on sign-out
 * (`forgetDrafts`: every copy of this tab and of the admin's other open tabs). A reload, closing the tab, Back or Forward
 * and a redirect keep it.
 *
 * Framework-free (no React, no server code; type imports only), so the unit tests run it with an in-memory storage:
 * `tests/unit/builder-draft.test.ts`. The hook that reads and writes it is `useDraft.ts`.
 */
import type { SectionData } from "@/server/admin/actions/builder-model";
import type { WorkingSection } from "./model";

export const DRAFT_PREFIX = "rawasy-draft:v1:";
/** Never kept longer than a session can last (A2: 12 hours absolute). */
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;
/** A copy dated in the future (a clock moved back) is believed up to this far ahead. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
/** A layout save takes at most 60 sections (`BUILDER_LIMITS`); a kept copy never holds more. */
const MAX_SECTIONS = 60;

export type DraftKind = "page" | "service" | "reusable";
export interface DraftRef {
  /** The user who opened the editor (their id). */
  user: string;
  kind: DraftKind;
  /** The page's, service's or reusable section's id. */
  id: string;
}

export interface Draft<P> {
  v: 1;
  user: string;
  kind: DraftKind;
  id: string;
  /** The record's version the editor had opened when these edits were made. */
  base: number;
  /** When the copy was last written (ms since the epoch). */
  savedAt: number;
  payload: P;
}

// Ids are ULIDs (users, pages, services, reusable sections): letters and digits only, so a key can't be confused.
const ID = /^[0-9A-Za-z]{1,40}$/;
const KINDS: readonly string[] = ["page", "service", "reusable"];
const validRef = (ref: DraftRef) => ID.test(ref.user) && ID.test(ref.id) && KINDS.includes(ref.kind);

export const draftKey = (ref: DraftRef) => `${DRAFT_PREFIX}${ref.user}:${ref.kind}:${ref.id}`;

/** This tab's `sessionStorage`, or null (no window, or storage refused: a private mode or a browser policy). */
export function tabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Keeps (replaces) the copy of one user's work on one record. False when it could not be kept (quota, no storage). */
export function writeDraft<P>(storage: Storage | null, ref: DraftRef, base: number, payload: P, now: number): boolean {
  if (!storage || !validRef(ref) || !Number.isInteger(base) || base < 0) return false;
  const draft: Draft<P> = { v: 1, user: ref.user, kind: ref.kind, id: ref.id, base, savedAt: now, payload };
  try {
    storage.setItem(draftKey(ref), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(storage: Storage | null, ref: DraftRef): void {
  if (!storage || !validRef(ref)) return;
  try {
    storage.removeItem(draftKey(ref));
  } catch {
    // nothing kept, or the storage refuses: nothing to remove
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const fresh = (savedAt: unknown, now: number) =>
  typeof savedAt === "number" && Number.isFinite(savedAt) && now - savedAt <= DRAFT_TTL_MS && savedAt - now <= CLOCK_SKEW_MS;

/** The copy kept for exactly this user and record, if it reads as one and has not expired; otherwise null. */
export function parseDraft<P>(raw: string | null, ref: DraftRef, now: number, payload: (value: unknown) => P | null): Draft<P> | null {
  if (!raw || !validRef(ref)) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== 1 || value.user !== ref.user || value.kind !== ref.kind || value.id !== ref.id) return null;
  if (typeof value.base !== "number" || !Number.isInteger(value.base) || value.base < 0 || !fresh(value.savedAt, now)) return null;
  const kept = payload(value.payload);
  if (kept === null) return null;
  return { v: 1, user: ref.user, kind: ref.kind, id: ref.id, base: value.base, savedAt: value.savedAt as number, payload: kept };
}

/** Reads the copy of this user's work on this record; one that does not read (or has expired) is removed. */
export function readDraft<P>(storage: Storage | null, ref: DraftRef, payload: (value: unknown) => P | null, now: number = Date.now()): Draft<P> | null {
  if (!storage || !validRef(ref)) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(draftKey(ref));
  } catch {
    return null;
  }
  const draft = parseDraft(raw, ref, now, payload);
  if (raw !== null && !draft) removeDraft(storage, ref);
  return draft;
}

function draftKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
  }
  return keys;
}

/**
 * Removes the copies this tab must not keep for the person signed in now: every other user's (someone else signed in
 * in this tab), every expired one and every one that does not read. Returns how many went.
 */
export function purgeDrafts(storage: Storage | null, keepUser: string, now: number): number {
  if (!storage) return 0;
  let removed = 0;
  try {
    for (const key of draftKeys(storage)) {
      let keep = false;
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? "");
        keep = isRecord(value) && value.v === 1 && value.user === keepUser && key.startsWith(`${DRAFT_PREFIX}${keepUser}:`) && fresh(value.savedAt, now);
      } catch {
        keep = false;
      }
      if (!keep) {
        storage.removeItem(key);
        removed++;
      }
    }
  } catch {
    // a storage that refuses holds nothing of ours
  }
  return removed;
}

/** Announced by sign-out before it clears the tab's copies, so an editor still open stops keeping its own (`useDraft`). */
export const FORGET_DRAFTS_EVENT = "rawasy:forget-drafts";
/** The admin's other tabs of this browser hear a sign-out here (`DraftJanitor`): theirs are cleared too. */
export const DRAFTS_CHANNEL = "rawasy-admin-drafts";

/** In this tab: every editor still open stops keeping its work, then every copy is removed. */
export function forgetDraftsHere(): number {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FORGET_DRAFTS_EVENT));
  return clearDrafts(tabStorage());
}

/** Sign-out: this tab forgets every copy, and tells the admin's other open tabs of this browser to do the same. */
export function forgetDrafts(): number {
  try {
    const channel = new BroadcastChannel(DRAFTS_CHANNEL);
    channel.postMessage("forget");
    channel.close();
  } catch {
    // no BroadcastChannel (an old browser): the other tabs keep theirs until another user signs in there, or 12 hours
  }
  return forgetDraftsHere();
}

/** Removes every copy this tab keeps (sign-out). Returns how many went. */
export function clearDrafts(storage: Storage | null): number {
  if (!storage) return 0;
  try {
    const keys = draftKeys(storage);
    for (const key of keys) storage.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}

// --- What a copy holds ---------------------------------------------------------------------------------------------------

/** Section data as the editor holds it: the shape only (the server validates every value again on save). */
export function readSectionData(value: unknown): SectionData | null {
  if (!isRecord(value) || !isRecord(value.settings) || !isRecord(value.content) || !isRecord(value.complete)) return null;
  for (const locale of Object.keys(value.content)) if ((locale !== "en" && locale !== "ar") || !isRecord(value.content[locale])) return null;
  if (typeof value.complete.en !== "boolean" || typeof value.complete.ar !== "boolean" || typeof value.otherUnaffected !== "boolean") return null;
  return value as unknown as SectionData;
}

/**
 * A section as kept: what the editor holds, without the server's model of a stored section (taken from the page again
 * on restore, with its data where it was not edited) and with data only where the save would send it.
 */
export interface KeptSection {
  ref: string;
  id: string | null;
  blockType: string;
  label: string;
  visible: boolean;
  devices: { desktop: boolean; tablet: boolean; mobile: boolean };
  anchor: string | null;
  duplicateOf?: string;
  reusableId?: string;
  /** A new section's link to a reusable section: its id and name (the address is rebuilt from the id). */
  reusable: { id: string; name: string } | null;
  data: SectionData | null;
  dataChanged: boolean;
}

/** The copy of a layout's working copy. */
export function keepLayout(sections: WorkingSection[]): KeptSection[] {
  return sections.map((s) => ({
    ref: s.ref,
    id: s.id,
    blockType: s.blockType,
    label: s.label,
    visible: s.visible,
    devices: { desktop: s.devices.desktop, tablet: s.devices.tablet, mobile: s.devices.mobile },
    anchor: s.anchor,
    ...(s.duplicateOf ? { duplicateOf: s.duplicateOf } : {}),
    ...(s.reusableId ? { reusableId: s.reusableId } : {}),
    reusable: s.reusable ? { id: s.reusable.id, name: s.reusable.name } : null,
    // A stored section's data is the page's own unless it was edited; a new section always carries its data.
    data: s.dataChanged || !s.id ? s.data : null,
    dataChanged: s.dataChanged,
  }));
}

const str = (value: unknown, max: number) => typeof value === "string" && value.length <= max;

/** A kept layout read back: its shape checked (anything unexpected makes the whole copy unreadable). */
export function readKeptLayout(value: unknown): KeptSection[] | null {
  if (!Array.isArray(value) || value.length > MAX_SECTIONS) return null;
  const out: KeptSection[] = [];
  for (const item of value) {
    if (!isRecord(item) || !str(item.ref, 40) || !str(item.blockType, 80) || !str(item.label, 240)) return null;
    if (item.id !== null && !(str(item.id, 40) && ID.test(item.id as string))) return null;
    if (typeof item.visible !== "boolean" || typeof item.dataChanged !== "boolean") return null;
    const d = item.devices;
    if (!isRecord(d) || typeof d.desktop !== "boolean" || typeof d.tablet !== "boolean" || typeof d.mobile !== "boolean") return null;
    if (item.anchor !== null && !str(item.anchor, 80)) return null;
    if (item.duplicateOf !== undefined && !(str(item.duplicateOf, 40) && ID.test(item.duplicateOf as string))) return null;
    if (item.reusableId !== undefined && !(str(item.reusableId, 40) && ID.test(item.reusableId as string))) return null;
    const r = item.reusable;
    if (r !== null && !(isRecord(r) && str(r.id, 40) && ID.test(r.id as string) && str(r.name, 240))) return null;
    const data = item.data === null ? null : readSectionData(item.data);
    if (item.data !== null && !data) return null;
    out.push({
      ref: item.ref as string,
      id: item.id as string | null,
      blockType: item.blockType as string,
      label: item.label as string,
      visible: item.visible,
      devices: { desktop: d.desktop, tablet: d.tablet, mobile: d.mobile },
      anchor: item.anchor as string | null,
      ...(item.duplicateOf !== undefined ? { duplicateOf: item.duplicateOf as string } : {}),
      ...(item.reusableId !== undefined ? { reusableId: item.reusableId as string } : {}),
      reusable: r === null ? null : { id: (r as { id: string }).id, name: (r as { name: string }).name },
      data,
      dataChanged: item.dataChanged,
    });
  }
  return out;
}

/**
 * The working copy a kept layout gives back on the layout the editor opened (`opened`, at the copy's own version):
 * stored sections take the page's model again (and its data where they were not edited), new sections get fresh
 * references in this page's session. Null when the copy does not fit this layout (a section or block it names is not
 * here): then it is never applied.
 */
export function restoreLayout(kept: KeptSection[], opened: WorkingSection[], blocks: ReadonlySet<string>, newRef: () => string): WorkingSection[] | null {
  const stored = new Map(opened.filter((s) => s.id).map((s) => [s.id as string, s]));
  const out: WorkingSection[] = [];
  const seen = new Set<string>();
  for (const k of kept) {
    if (k.id) {
      const s = stored.get(k.id);
      if (!s || s.blockType !== k.blockType || seen.has(k.id)) return null;
      seen.add(k.id);
      if (k.dataChanged && !k.data) return null;
      out.push({ ...s, visible: k.visible, devices: { ...k.devices }, anchor: k.anchor, data: k.dataChanged ? k.data : s.data, dataChanged: k.dataChanged });
      continue;
    }
    if (!blocks.has(k.blockType)) return null;
    if (k.duplicateOf && !stored.has(k.duplicateOf)) return null;
    const reusable = k.reusable ? { id: k.reusable.id, name: k.reusable.name, archived: false, href: `/admin/reusable-sections/${k.reusable.id}` } : null;
    out.push({
      ref: newRef(),
      id: null,
      blockType: k.blockType,
      label: k.label,
      visible: k.visible,
      devices: { ...k.devices },
      anchor: k.anchor,
      locked: false,
      reusable,
      ...(k.duplicateOf ? { duplicateOf: k.duplicateOf } : {}),
      ...(k.reusableId ? { reusableId: k.reusableId } : {}),
      data: k.data,
      dataChanged: k.dataChanged,
      model: null,
    });
  }
  return out;
}

/** A reusable section's kept edits: its name and data. */
export interface KeptReusable {
  name: string;
  data: SectionData;
}

export function readKeptReusable(value: unknown): KeptReusable | null {
  if (!isRecord(value) || !str(value.name, 240)) return null;
  const data = readSectionData(value.data);
  return data ? { name: value.name as string, data } : null;
}
