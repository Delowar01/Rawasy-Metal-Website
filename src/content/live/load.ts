/**
 * The database content source (A9.4, A1-PUBLISHING-VERSIONS §8): what `@/content/load` resolves to in a build made with
 * `CONTENT_SOURCE=database` (next.config.ts). Never imported directly.
 *
 * - **Same modules, database values.** The approved components keep importing `src/content/*`; before a page reads them,
 *   `ensureContent` fills those very objects (in place, every level) with the content set decoded from the published
 *   documents and the media A4 delivers (`@/server/public/decode`). A static value no published document holds stays
 *   (the approved composition's own choices: `layouts.ts`, the reconciliation report).
 * - **Fail-closed, never stale.** Every request reads the shared cache generation first (A8: every publication,
 *   unpublication, rollback and restore moves it; a restore starts a new epoch); content decoded for another generation
 *   is never served. The database unreachable → the request fails (500), never the last or the static content; after five
 *   failures in a row the breaker answers at once for 60 s without trying. Logs name error codes only.
 * - **Rendered on demand, cached fail-closed.** Nothing is prerendered from the database at build (the routes list no
 *   parameters); a page renders on its first request and Next.js keeps it in the page cache
 *   (`src/server/public/cache-handler.cjs`), which serves it only while the shared generation is the one read before
 *   it was rendered. During `next build` a route that reaches the content (the sitemap) is made dynamic instead.
 */
import { cache } from "react";
import { connection } from "next/server";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { staticContentSet, type ContentSet } from "../static-set.ts";
import { company } from "@/content/company";
import { serviceSlugs } from "@/content/services";
import { refreshMapLinks } from "@/lib/maps";
import { getPool, describeDbError } from "@/server/db/pool";
import { dbFor } from "@/server/db/client";
import { PUBLIC_READ_LIMITS, readGenerationWithin, readPublicSnapshot, within } from "@/server/public/read-model";
import { decodeContentSet } from "@/server/public/decode";
import { resolvePublicRedirect, type LiveAddresses } from "@/server/public/redirects";

export const contentIsStatic = false;

/** The modules' own objects (the same instances the components import). */
const TARGET: ContentSet = staticContentSet();
if (TARGET.company !== company) throw new Error("The content modules were loaded twice: the database content cannot replace them.");
/** Today's static content, kept apart: the base the published documents are laid over. */
const BASE: ContentSet = structuredClone(TARGET);

interface Loaded {
  generation: number;
  epoch: string;
  livePages: ReadonlySet<string>;
  addresses: LiveAddresses;
}
let loaded: Loaded | null = null;
let loading: Promise<void> | null = null;

const BREAKER_FAILURES = 5;
const BREAKER_OPEN_MS = 60_000;
let failures = 0;
let openUntil = 0;

export class ContentUnavailableError extends Error {
  constructor() {
    super("The website's content is not available right now.");
    this.name = "ContentUnavailableError";
  }
}

/** Replaces `target`'s contents with `source`'s, keeping every object's identity (arrays are refilled). */
function replaceInPlace(target: unknown, source: unknown): void {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.splice(0, target.length, ...source);
    return;
  }
  if (!target || typeof target !== "object" || !source || typeof source !== "object") return;
  const t = target as Record<string, unknown>;
  const s = source as Record<string, unknown>;
  for (const key of Object.keys(t)) if (!Object.hasOwn(s, key)) delete t[key];
  for (const [key, value] of Object.entries(s)) {
    const current = t[key];
    const bothObjects = current && value && typeof current === "object" && typeof value === "object" && Array.isArray(current) === Array.isArray(value);
    if (bothObjects) replaceInPlace(current, value);
    else t[key] = value;
  }
}

/** Lays a decoded content set into the modules, synchronously (no request sees half of it). */
function swap(next: ContentSet) {
  for (const key of Object.keys(TARGET) as (keyof ContentSet)[]) replaceInPlace(TARGET[key], next[key]);
  serviceSlugs.splice(0, serviceSlugs.length, ...TARGET.services.map((s) => s.slug as (typeof serviceSlugs)[number]));
  refreshMapLinks();
}

async function load(): Promise<void> {
  const snapshot = await within(readPublicSnapshot(getPool()), PUBLIC_READ_LIMITS.snapshotMs, "Reading the published content");
  const { set, livePages } = decodeContentSet(snapshot, BASE);
  const ids = (type: string) => new Map(snapshot.docs.filter((d) => d.type === type && d.slug).map((d) => [d.id, d.slug as string]));
  const serviceIds = ids("service");
  const projectIds = ids("project");
  const pageKeys = new Map(
    snapshot.docs
      .filter((d) => d.type === "page")
      .map((d) => [d.id, String((d.document.root as Record<string, unknown> | undefined)?.systemKey ?? "")] as const)
      .filter(([, key]) => key),
  );
  swap(set);
  loaded = {
    generation: snapshot.generation,
    epoch: snapshot.epoch,
    livePages,
    addresses: { services: new Set(serviceIds.values()), projects: new Set(projectIds.values()), serviceSlugs: serviceIds, projectSlugs: projectIds, pageKeys },
  };
}

async function readCurrent(): Promise<Loaded> {
  // `next build` never reads the database: a route that reaches the content there is rendered per request instead.
  if (process.env.NEXT_PHASE === "phase-production-build") await connection();
  if (Date.now() < openUntil) throw new ContentUnavailableError();
  try {
    const { generation, epoch } = await readGenerationWithin(getPool());
    // Load until this request's generation (or a newer one of the same epoch) is in: a load that started for an older
    // generation may finish first. Content of another epoch (before a restore) is never served.
    const stale = () => !loaded || loaded.epoch !== epoch || loaded.generation < generation;
    for (let attempt = 0; attempt < 3 && stale(); attempt++) {
      loading ??= load().finally(() => (loading = null));
      await loading;
    }
    if (stale()) throw new ContentUnavailableError();
    failures = 0;
    return loaded!;
  } catch (error) {
    if (error instanceof ContentUnavailableError) throw error;
    // The pool's own queue being full is load on this process, not the database failing: never opens the breaker.
    const local = error instanceof Error && /Queue limit reached/i.test(error.message);
    if (!local) failures += 1;
    if (failures >= BREAKER_FAILURES) {
      openUntil = Date.now() + BREAKER_OPEN_MS;
      failures = 0;
    }
    console.error(`content source: database read failed (${describeDbError(error)})`);
    throw new ContentUnavailableError();
  }
}

/** One check of the shared generation per request (the layout, the page and their metadata share it). */
const current = cache(readCurrent);

export async function ensureContent(page?: string): Promise<void> {
  const live = await current();
  if (page && !live.livePages.has(page)) notFound();
}

/** Follows the published redirect of an address no live page answers (`redirect` throws; nothing else returns). */
export async function redirectFor(path: string): Promise<null> {
  const live = await current();
  let found: Awaited<ReturnType<typeof resolvePublicRedirect>>;
  try {
    found = await resolvePublicRedirect(dbFor(getPool()), path, live.addresses);
  } catch (error) {
    console.error(`content source: redirect lookup failed (${describeDbError(error)})`);
    throw new ContentUnavailableError();
  }
  if (found) (found.permanent ? permanentRedirect : redirect)(found.location);
  return null;
}

export function isLivePage(page: string): boolean {
  return loaded?.livePages.has(page) ?? false;
}
