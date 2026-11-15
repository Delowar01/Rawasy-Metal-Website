/**
 * A9.5 — redirects on the public website in database mode (A1-ARCHITECTURE §6, A6 rules, A8.4): consulted only for an
 * address no live page answers (the catch-all and the unknown-slug branches), so pages always win. One lookup, never
 * followed onward: the target must be a live page itself (a record's published address, a live fixed page, or a path
 * one of them answers); anything else — a target unpublished, archived or gone, a target that is itself only a redirect,
 * a loop — is no redirect (the 404 stands).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "../cms/store.ts";
import { isLiveAddress, normalizeSitePath } from "../site/paths.ts";
import { SITE_ROUTES } from "../site/registry.ts";
import type { LiveContent, PublishedInput } from "./decode.ts";

export interface LiveAddresses {
  /** The services and projects the read model draws, by slug (a published one it leaves out answers 404). */
  services: ReadonlySet<string>;
  projects: ReadonlySet<string>;
  /** The same records by id: their slugs. */
  serviceSlugs: ReadonlyMap<string, string>;
  projectSlugs: ReadonlyMap<string, string>;
  /** Published fixed pages by id: their system key. */
  pageKeys: ReadonlyMap<string, string>;
  /** The system keys of the published fixed pages (an unpublished one answers 404). */
  pages: ReadonlySet<string>;
}

/**
 * What a live page answers in this release, from the published documents and what the read model drew of them (A9
 * acceptance review L-3: a redirect followed an address whose page was unpublished, or a published record the read model
 * leaves out, to a 404).
 */
export function liveAddressesOf(snapshot: PublishedInput, live: LiveContent): LiveAddresses {
  const drawn = (list: readonly { slug: string }[]) => new Set(list.map((x) => x.slug));
  const services = drawn(live.set.services);
  const projects = drawn(live.set.projects);
  const ids = (type: string, keep: ReadonlySet<string>) =>
    new Map(snapshot.docs.filter((d) => d.type === type && d.slug && keep.has(d.slug)).map((d) => [d.id, d.slug as string]));
  const pageKeys = new Map(
    snapshot.docs
      .filter((d) => d.type === "page")
      .map((d) => [d.id, String((d.document.root as Record<string, unknown> | undefined)?.systemKey ?? "")] as const)
      .filter(([, key]) => key),
  );
  return { services, projects, serviceSlugs: ids("service", services), projectSlugs: ids("project", projects), pageKeys, pages: live.livePages };
}

/** Site pages by their address's one segment (`about` → about). */
const ROUTE_OF_SEGMENT = new Map(
  Object.entries(SITE_ROUTES)
    .filter(([, p]) => p !== "/")
    .map(([key, p]) => [p.slice(1), key]),
);

/** Whether a live page answers a normalised address: a published fixed page, or a service or project the read model draws. */
function answeredLive(path: string, live: LiveAddresses): boolean {
  if (!isLiveAddress(path, live)) return false;
  const rest = path.split("/").filter(Boolean).slice(1);
  if (rest.length > 1) return true;
  const key = rest.length === 0 ? "home" : ROUTE_OF_SEGMENT.get(rest[0]);
  return key !== undefined && live.pages.has(key);
}

export interface PublicRedirect {
  location: string;
  permanent: boolean;
}

export async function resolvePublicRedirect(db: Db, address: string, live: LiveAddresses): Promise<PublicRedirect | null> {
  const parsed = normalizeSitePath(address);
  if (!parsed.ok) return null;
  const source = parsed.path;
  // Pages win: an address a live page answers is never redirected (the route draws it; this is a second line).
  if (answeredLive(source, live)) return null;
  const [row] = await rowsOf<{ target_type: string; target_path: string | null; target_page_id: string | null; target_service_id: string | null; target_project_id: string | null; status_code: number }>(
    db,
    sql`SELECT target_type, target_path, target_page_id, target_service_id, target_project_id, status_code FROM redirects WHERE source_path = ${source} AND is_active = 1`,
  );
  if (!row) return null;
  const locale = parsed.locale;
  let target: string | null = null;
  if (row.target_type === "path" && row.target_path) {
    const t = normalizeSitePath(row.target_path, { allowLocaleRoot: true });
    target = t.ok && answeredLive(t.path, live) ? t.path : null;
  } else if (row.target_type === "service" && row.target_service_id) {
    const slug = live.serviceSlugs.get(row.target_service_id);
    target = slug ? `/${locale}/services/${slug}` : null;
  } else if (row.target_type === "project" && row.target_project_id) {
    const slug = live.projectSlugs.get(row.target_project_id);
    target = slug ? `/${locale}/projects/${slug}` : null;
  } else if (row.target_type === "page" && row.target_page_id) {
    const key = live.pageKeys.get(row.target_page_id);
    const route = key ? (SITE_ROUTES as Record<string, string>)[key] : undefined;
    target = route === undefined ? null : route === "/" ? `/${locale}` : `/${locale}${route}`;
  }
  if (!target || target === source) return null;
  return { location: target, permanent: Number(row.status_code) !== 307 };
}
