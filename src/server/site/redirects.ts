/**
 * Redirects (A6.5; A1 `redirects`): old addresses that move, 308 (permanent) or 307 (temporary). In A6 they are working
 * records — created, edited, deactivated and validated; they resolve only from the A9 cutover, when the database
 * becomes the public source (D-A6-4); automatic redirects on a published slug change come with publishing (A8).
 *
 * - Read: `redirects.view` (every role); change: `redirects.manage` (Owner, Admin), re-decided in the transaction;
 *   every change audited (the addresses' paths are recorded: they are site addresses, never a query string).
 * - Source: a normalised site address (`paths.ts`), unique, and never one a page of the website answers — the site's
 *   own pages and files, today's services and projects, and the working records' slugs that become addresses at the
 *   cutover (read with a share lock, so a slug cannot arrive under the check).
 * - Target: an address of today's website, or a working page, service or project (share-locked, not archived; the
 *   address in the source's language). No loop (the target is never the source) and no chain (the target is never an
 *   active redirect's source, and no active redirect points at this source): every redirect resolves in one step.
 * - A redirect's version: edits and (de)activation are decided on the version its form showed; reactivation checks again.
 * - Later changes elsewhere (a record given an old address's slug, a record's slug changed into a chain) are not refused
 *   here: the list and the redirect's page say so (`warning`), and A8 (automatic slug redirects) and the A9 cutover
 *   re-check every redirect before any resolves (A6 report).
 */
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { redirects } from "../db/schema-site.ts";
import { ULID_RE } from "../builder/links.ts";
import { contentTransaction, duplicateKey, instantOf, rowsOf } from "../cms/store.ts";
import { likePattern, plainText } from "../cms/text.ts";
import { ulid } from "../security/ids.ts";
import { INVALID, refuse, siteAudit, stale, STALE_REDIRECT, versionSchema, type SiteChange, type SiteIssue, type SiteResult } from "./common.ts";
import { answeredBy, isLiveAddress, normalizeSitePath, type LiveSlugs } from "./paths.ts";
import { isSiteRoute, routePath, SITE_ROUTES, type Locale, type SiteRouteKey } from "./registry.ts";
import { staticProjectSlugs, staticServiceSlugs } from "./static-source.ts";

export type TargetType = "path" | "page" | "service" | "project";

export interface RedirectRow {
  id: string;
  sourcePath: string;
  targetType: TargetType;
  targetPath: string | null;
  targetId: string | null;
  /** What the target is, for the list (a record's title, or the address). */
  targetLabel: string;
  /** Where it leads today, or null when the target can't be resolved (a record archived or gone). */
  targetAddress: string | null;
  statusCode: 307 | 308;
  isActive: boolean;
  note: string;
  lockVersion: number;
  updatedAt: Date | null;
  warning: string | null;
}

// --- Targets ----------------------------------------------------------------------------------------------------------------

interface RecordTarget {
  id: string;
  title: string;
  archived: boolean;
  /** Its address without the language (null: it has none, a template page). */
  path: string | null;
}

const TITLE_SQL: Record<"page" | "service" | "project", { table: string; translations: string; parent: string; title: string }> = {
  page: { table: "pages", translations: "page_translations", parent: "page_id", title: "title" },
  service: { table: "services", translations: "service_translations", parent: "service_id", title: "name" },
  project: { table: "projects", translations: "project_translations", parent: "project_id", title: "title" },
};

/** A working record as a target (share-locked when `lock`), or null when it does not exist or is in the Trash. */
async function recordTarget(db: Db, type: "page" | "service" | "project", id: string, lock: boolean): Promise<RecordTarget | null> {
  const t = TITLE_SQL[type];
  const columns = type === "page" ? sql`r.page_type, r.system_key, r.slug` : sql`r.slug`;
  const [row] = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT r.id, r.publication_status, ${columns} FROM ${sql.identifier(t.table)} r WHERE r.id = ${id} AND r.deleted_at IS NULL${lock ? sql` LOCK IN SHARE MODE` : sql``}`,
  );
  if (!row) return null;
  const [title] = await rowsOf<{ title: string }>(
    db,
    sql`SELECT ${sql.identifier(t.title)} AS title FROM ${sql.identifier(t.translations)} WHERE ${sql.identifier(t.parent)} = ${id} ORDER BY locale = 'en' DESC LIMIT 1`,
  );
  let path: string | null = null;
  if (type === "service") path = `/services/${String(row.slug)}`;
  else if (type === "project") path = `/projects/${String(row.slug)}`;
  else {
    const pageType = String(row.page_type);
    const key = row.system_key ? String(row.system_key) : "";
    if (pageType === "home") path = "/";
    else if ((pageType === "system" || pageType === "legal") && isSiteRoute(key)) path = SITE_ROUTES[key as SiteRouteKey];
    else if (pageType === "generic" && row.slug) path = `/${String(row.slug)}`;
  }
  return { id, title: title?.title ?? String(row.slug ?? id), archived: String(row.publication_status) === "archived", path };
}

const inLocale = (locale: Locale, path: string) => (path === "/" ? `/${locale}` : `/${locale}${path}`);

/** The working records whose slug a source would name (share-locked: a slug can't arrive under the check). */
async function liveSlugsFor(tx: Db, source: string) {
  const segments = source.split("/").slice(2);
  const take = async (table: "services" | "projects" | "pages", slug: string | null) => {
    if (!slug) return [] as string[];
    const extra = table === "pages" ? sql` AND page_type = 'generic'` : sql``;
    const rows = await rowsOf<{ slug: string }>(tx, sql`SELECT slug FROM ${sql.identifier(table)} WHERE slug = ${slug}${extra} LOCK IN SHARE MODE`);
    return rows.map((r) => r.slug);
  };
  const second = segments.length === 2 ? segments[1] : null;
  return {
    services: new Set([...staticServiceSlugs(), ...(segments[0] === "services" ? await take("services", second) : [])]),
    projects: new Set([...staticProjectSlugs(), ...(segments[0] === "projects" ? await take("projects", second) : [])]),
    pages: new Set(segments.length === 1 ? await take("pages", segments[0]) : []),
  };
}

// --- Input ------------------------------------------------------------------------------------------------------------------

export const redirectInputSchema = z
  .object({
    id: z.union([z.literal(""), z.string().regex(ULID_RE)]),
    expectedVersion: versionSchema,
    sourcePath: z.string().max(2000),
    targetType: z.enum(["path", "page", "service", "project"]),
    targetPath: z.string().max(2000),
    targetId: z.union([z.literal(""), z.string().regex(ULID_RE)]),
    statusCode: z.union([z.literal(307), z.literal(308)]),
    note: plainText(300),
  })
  .strict();

export type RedirectInput = z.input<typeof redirectInputSchema>;

interface Checked {
  sourcePath: string;
  targetType: TargetType;
  targetPath: string | null;
  targetId: string | null;
  address: string;
}

/** Checks a redirect's source and target under the locks (A1: no source a page answers, no loop, no chain). */
async function checkRedirect(tx: Db, input: { id: string; sourcePath: string; targetType: TargetType; targetPath: string; targetId: string }): Promise<{ ok: true; value: Checked } | { ok: false; issues: SiteIssue[] }> {
  const issues: SiteIssue[] = [];
  const source = normalizeSitePath(input.sourcePath);
  if (!source.ok) return { ok: false, issues: [{ path: "sourcePath", message: source.message }] };
  const answered = answeredBy(source.path, await liveSlugsFor(tx, source.path));
  if (answered) issues.push({ path: "sourcePath", message: `${answered} A redirect only moves an address no page answers.` });
  const [same] = await rowsOf<{ id: string }>(tx, sql`SELECT id FROM redirects WHERE source_path = ${source.path} FOR UPDATE`);
  if (same && same.id !== input.id) issues.push({ path: "sourcePath", message: "This address already has a redirect. Edit that one instead." });

  let address: string | null = null;
  let targetPath: string | null = null;
  let targetId: string | null = null;
  if (input.targetType === "path") {
    const target = normalizeSitePath(input.targetPath, { allowLocaleRoot: true });
    if (!target.ok) issues.push({ path: "targetPath", message: target.message });
    else if (!isLiveAddress(target.path, { services: staticServiceSlugs(), projects: staticProjectSlugs() })) {
      issues.push({ path: "targetPath", message: "This address isn't a page of the website. Choose a page, a service or a project, or another address." });
    } else {
      address = target.path;
      targetPath = target.path;
    }
  } else {
    const record = input.targetId ? await recordTarget(tx, input.targetType, input.targetId, true) : null;
    if (!record) issues.push({ path: "targetId", message: `Choose the ${input.targetType} the address moves to.` });
    else if (record.archived) issues.push({ path: "targetId", message: `This ${input.targetType} is archived. Choose another, or restore it first.` });
    else if (record.path === null) issues.push({ path: "targetId", message: "This page has no address of its own (a template). Choose another." });
    else {
      address = inLocale(source.locale, record.path);
      targetId = record.id;
    }
  }
  if (address !== null) {
    if (address === source.path) issues.push({ path: input.targetType === "path" ? "targetPath" : "targetId", message: "A redirect can't lead to its own address." });
    const [onward] = await rowsOf<{ id: string }>(tx, sql`SELECT id FROM redirects WHERE source_path = ${address} AND is_active = 1 AND id <> ${input.id} LOCK IN SHARE MODE`);
    if (onward) issues.push({ path: input.targetType === "path" ? "targetPath" : "targetId", message: "The target address is redirected itself. Point straight at where that redirect leads (one step)." });
  }
  // A redirect leading here would make a chain. The rules above already exclude it (a target is a page of the website,
  // which no source may be), so this stays a plain read, a safeguard only: a locking read here scans every redirect
  // (target_path has no index) and two edits of different redirects then wait on each other (A6 review, I2).
  const [inward] = await rowsOf<{ id: string }>(tx, sql`SELECT id FROM redirects WHERE target_type = 'path' AND target_path = ${source.path} AND is_active = 1 AND id <> ${input.id}`);
  if (inward) issues.push({ path: "sourcePath", message: "Another redirect leads to this address. A redirect from it would make a chain." });
  if (issues.length || address === null) return { ok: false, issues };
  return { ok: true, value: { sourcePath: source.path, targetType: input.targetType, targetPath, targetId, address } };
}

const targetColumns = (value: Checked) => ({
  targetType: value.targetType,
  targetPath: value.targetPath,
  targetPageId: value.targetType === "page" ? value.targetId : null,
  targetServiceId: value.targetType === "service" ? value.targetId : null,
  targetProjectId: value.targetType === "project" ? value.targetId : null,
});

/** Create a redirect, or save an existing one's form (decided on the version it showed). */
export async function saveRedirect(change: SiteChange, raw: unknown): Promise<SiteResult> {
  const parsed = redirectInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { kind: "invalid", message: INVALID, issues: [{ path: issue?.path.map(String).join(".") ?? "", message: issue?.message ?? "Check the form." }] };
  }
  const input = parsed.data;
  const { deps, actor } = change;
  const creating = input.id === "";
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const action = creating ? "redirect.create" : "redirect.update";
    let lockVersion = 0;
    if (!creating) {
      const [row] = await rowsOf<{ lock_version: number; source_path: string }>(tx, sql`SELECT lock_version, source_path FROM redirects WHERE id = ${input.id} FOR UPDATE`);
      if (!row) return { kind: "not_found" };
      if (!actor.permissions.has("redirects.manage")) return refuse(tx, change, now, { action, type: "redirect", id: input.id, label: row.source_path }, "Managing redirects needs a permission you don't hold.");
      lockVersion = Number(row.lock_version);
      if (lockVersion !== input.expectedVersion) return stale(tx, change, now, { action, type: "redirect", id: input.id, label: row.source_path }, input.expectedVersion, lockVersion, STALE_REDIRECT);
    } else if (!actor.permissions.has("redirects.manage")) {
      return refuse(tx, change, now, { action, type: "redirect", id: "new" }, "Managing redirects needs a permission you don't hold.");
    }
    const checked = await checkRedirect(tx, { id: input.id, sourcePath: input.sourcePath, targetType: input.targetType, targetPath: input.targetPath, targetId: input.targetId });
    if (!checked.ok) {
      await siteAudit(tx, change, now, { action, type: "redirect", id: input.id || "new", outcome: "failed", summary: `Refused: ${checked.issues.map((i) => i.message).join(" ")}`.slice(0, 480) });
      return { kind: "invalid", message: INVALID, issues: checked.issues };
    }
    const value = checked.value;
    const id = creating ? ulid(now.getTime()) : input.id;
    try {
      if (creating) {
        await tx.insert(redirects).values({
          id,
          sourcePath: value.sourcePath,
          ...targetColumns(value),
          statusCode: input.statusCode,
          isActive: true,
          reason: "manual",
          note: input.note || null,
          createdAt: now,
          createdBy: actor.user.id,
          updatedAt: now,
          updatedBy: actor.user.id,
        });
      } else {
        await tx
          .update(redirects)
          .set({ sourcePath: value.sourcePath, ...targetColumns(value), statusCode: input.statusCode, note: input.note || null, lockVersion: sql`${redirects.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
          .where(eq(redirects.id, id));
      }
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      // The statement failed alone (the transaction goes on), so the refusal is audited like the checks' own.
      const message = "This address already has a redirect. Edit that one instead.";
      await siteAudit(tx, change, now, { action, type: "redirect", id: input.id || "new", outcome: "failed", summary: `Refused: ${message}` });
      return { kind: "invalid", message: INVALID, issues: [{ path: "sourcePath", message }] };
    }
    await siteAudit(tx, change, now, {
      action,
      type: "redirect",
      id,
      label: value.sourcePath,
      summary: `${creating ? "Created" : "Edited"} the redirect ${value.sourcePath} → ${value.address} (${input.statusCode}).`,
      changes: { source: value.sourcePath, target: value.address, targetType: value.targetType, status: input.statusCode },
    });
    return { kind: "ok", id, lockVersion: creating ? 0 : lockVersion + 1, summary: creating ? "Created. It takes effect when the website switches to the database (A9)." : "Saved." };
  });
}

/** Deactivate (always allowed) or reactivate (checked again) a redirect, decided on the version its page showed. */
export async function setRedirectActive(change: SiteChange, raw: { id: unknown; expectedVersion: unknown; active: boolean }): Promise<SiteResult> {
  const parsed = z.object({ id: z.string().regex(ULID_RE), expectedVersion: versionSchema }).safeParse({ id: raw.id, expectedVersion: raw.expectedVersion });
  if (!parsed.success) return { kind: "not_found" };
  const { id, expectedVersion } = parsed.data;
  const { deps, actor } = change;
  const action = raw.active ? "redirect.activate" : "redirect.deactivate";
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const [row] = await rowsOf<Record<string, unknown>>(tx, sql`SELECT * FROM redirects WHERE id = ${id} FOR UPDATE`);
    if (!row) return { kind: "not_found" };
    const event = { action, type: "redirect" as const, id, label: String(row.source_path) };
    if (!actor.permissions.has("redirects.manage")) return refuse(tx, change, now, event, "Managing redirects needs a permission you don't hold.");
    const lockVersion = Number(row.lock_version);
    if (lockVersion !== expectedVersion) return stale(tx, change, now, event, expectedVersion, lockVersion, STALE_REDIRECT);
    if (Boolean(Number(row.is_active)) === raw.active) return { kind: "ok", id, lockVersion, summary: raw.active ? "It was already active." : "It was already inactive." };
    if (raw.active) {
      const type = String(row.target_type) as TargetType;
      const targetId = String(row.target_page_id ?? row.target_service_id ?? row.target_project_id ?? "");
      const checked = await checkRedirect(tx, { id, sourcePath: String(row.source_path), targetType: type, targetPath: String(row.target_path ?? ""), targetId });
      if (!checked.ok) {
        await siteAudit(tx, change, now, { ...event, outcome: "failed", summary: `Refused: ${checked.issues.map((i) => i.message).join(" ")}`.slice(0, 480) });
        return { kind: "invalid", message: "This redirect can't be active as it stands. Edit it first.", issues: checked.issues };
      }
    }
    await tx
      .update(redirects)
      .set({ isActive: raw.active, lockVersion: sql`${redirects.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
      .where(and(eq(redirects.id, id)));
    await siteAudit(tx, change, now, { ...event, summary: `${raw.active ? "Reactivated" : "Deactivated"} the redirect ${String(row.source_path)}.` });
    return { kind: "ok", id, lockVersion: lockVersion + 1, summary: raw.active ? "Active again." : "Deactivated: it will not be used." };
  });
}

// --- Reads ------------------------------------------------------------------------------------------------------------------

/** What a stored redirect is compared with when it is shown: every slug that answers an address, and the active sources. */
interface ConflictContext {
  slugs: LiveSlugs;
  activeSources: ReadonlySet<string>;
}

async function conflictContext(db: Db): Promise<ConflictContext> {
  const slugsOf = async (table: "services" | "projects" | "pages") =>
    (await rowsOf<{ slug: string }>(db, sql`SELECT slug FROM ${sql.identifier(table)} WHERE slug IS NOT NULL${table === "pages" ? sql` AND page_type = 'generic'` : sql``}`)).map((r) => r.slug);
  const [services, projects, pages, sources] = await Promise.all([
    slugsOf("services"),
    slugsOf("projects"),
    slugsOf("pages"),
    rowsOf<{ source_path: string }>(db, sql`SELECT source_path FROM redirects WHERE is_active = 1`),
  ]);
  return {
    slugs: { services: new Set([...staticServiceSlugs(), ...services]), projects: new Set([...staticProjectSlugs(), ...projects]), pages: new Set(pages) },
    activeSources: new Set(sources.map((r) => r.source_path)),
  };
}

async function rowView(db: Db, row: Record<string, unknown>, context: ConflictContext): Promise<RedirectRow> {
  const type = String(row.target_type) as TargetType;
  const source = String(row.source_path);
  const locale = (source.split("/")[1] === "ar" ? "ar" : "en") as Locale;
  let targetLabel = String(row.target_path ?? "");
  let targetAddress: string | null = row.target_path ? String(row.target_path) : null;
  let warning: string | null = null;
  const targetId = type === "path" ? null : String(row.target_page_id ?? row.target_service_id ?? row.target_project_id ?? "");
  if (type !== "path" && targetId) {
    const record = await recordTarget(db, type, targetId, false);
    if (!record) {
      targetLabel = `(a ${type} that no longer exists)`;
      targetAddress = null;
      warning = `The ${type} it leads to no longer exists.`;
    } else {
      targetLabel = `${type === "page" ? "Page" : type === "service" ? "Service" : "Project"}: ${record.title}`;
      targetAddress = record.path === null ? null : inLocale(locale, record.path);
      if (record.archived) warning = `The ${type} it leads to is archived: it would not resolve.`;
    }
  }
  // Rules that held when it was saved and that later changes elsewhere can break (a slug given or changed since).
  const answered = answeredBy(source, context.slugs);
  const conflicts = [
    warning,
    answered ? `${answered.replace(/\.$/, "")} now: the page wins, so this redirect would never be used. Deactivate it or change its old address.` : null,
    targetAddress !== null && targetAddress !== source && context.activeSources.has(targetAddress)
      ? "Its target is now redirected itself (two steps): point it straight at where that redirect leads."
      : null,
  ].filter(Boolean);
  warning = conflicts.length ? conflicts.join(" ") : null;
  return {
    id: String(row.id),
    sourcePath: source,
    targetType: type,
    targetPath: row.target_path ? String(row.target_path) : null,
    targetId,
    targetLabel,
    targetAddress,
    statusCode: Number(row.status_code) === 307 ? 307 : 308,
    isActive: Boolean(Number(row.is_active)),
    note: String(row.note ?? ""),
    lockVersion: Number(row.lock_version),
    updatedAt: instantOf(row.updated_at),
    warning,
  };
}

export const REDIRECT_PAGE_SIZE = 25;

/** The list: server-side, filtered by state and by an address fragment, 25 a page, newest first. */
export async function listRedirects(db: Db, options: { state: "all" | "active" | "inactive"; q: string; page: number }): Promise<{ rows: RedirectRow[]; total: number; page: number; pages: number }> {
  const where: SQL[] = [sql`1 = 1`];
  if (options.state === "active") where.push(sql`is_active = 1`);
  if (options.state === "inactive") where.push(sql`is_active = 0`);
  // A lone surrogate (half of an emoji cut by a length limit) can't be encoded: it is dropped first.
  const q = options.q.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "").trim();
  // The source is ASCII: a fragment with other characters can match only once encoded (paths.ts), so compare that form
  // (NFC, as the stored addresses are).
  const fragment = /^[\x20-\x7e]*$/.test(q) ? q : encodeURI(q.normalize("NFC"));
  if (q) where.push(sql`(source_path LIKE ${likePattern(fragment)} OR target_path LIKE ${likePattern(fragment)})`);
  const condition = sql.join(where, sql` AND `);
  const [{ n }] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM redirects WHERE ${condition}`);
  const total = Number(n);
  const pages = Math.max(1, Math.ceil(total / REDIRECT_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(options.page) || 1), pages);
  const rows = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT * FROM redirects WHERE ${condition} ORDER BY updated_at DESC, id DESC LIMIT ${REDIRECT_PAGE_SIZE} OFFSET ${(page - 1) * REDIRECT_PAGE_SIZE}`,
  );
  const context = await conflictContext(db);
  return { rows: await Promise.all(rows.map((r) => rowView(db, r, context))), total, page, pages };
}

export async function readRedirect(db: Db, id: string): Promise<RedirectRow | null> {
  if (!ULID_RE.test(id)) return null;
  const [row] = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM redirects WHERE id = ${id}`);
  return row ? rowView(db, row, await conflictContext(db)) : null;
}

/** The working records a redirect may lead to (not archived, not in the Trash), for the form's choices. */
export async function redirectTargetChoices(db: Db): Promise<Record<"page" | "service" | "project", { id: string; label: string }[]>> {
  const out = { page: [], service: [], project: [] } as Record<"page" | "service" | "project", { id: string; label: string }[]>;
  for (const type of ["page", "service", "project"] as const) {
    const t = TITLE_SQL[type];
    const extra = type === "page" ? sql` AND r.page_type <> 'template'` : sql``;
    const rows = await rowsOf<{ id: string; slug: string | null; title: string | null }>(
      db,
      sql`SELECT r.id, r.slug, (SELECT ${sql.identifier(t.title)} FROM ${sql.identifier(t.translations)} x WHERE x.${sql.identifier(t.parent)} = r.id ORDER BY x.locale = 'en' DESC LIMIT 1) AS title
            FROM ${sql.identifier(t.table)} r WHERE r.deleted_at IS NULL AND r.publication_status <> 'archived'${extra} ORDER BY title, r.id LIMIT 500`,
    );
    out[type] = rows.map((r) => ({ id: r.id, label: `${r.title ?? "(untitled)"}${r.slug ? ` (${r.slug})` : ""}` }));
  }
  return out;
}

export { routePath };
