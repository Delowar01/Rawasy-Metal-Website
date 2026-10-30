/**
 * The site-controls screens (A6): company & website settings, navigation, interface text, theme and redirects. Every
 * screen checks the session (`requireActor`) and a permission key itself; reading is open to every signed-in role
 * (`content.view`; redirects `redirects.view`), changing to the keys the services check again (`settings.edit`,
 * `menus.edit`, `redirects.manage`; the theme is the Owner's `theme.edit` alone). Route files are thin wrappers.
 * Everything here is a working copy: the public website keeps today's values (T1 = Option B).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuEditor } from "@/components/admin/site/MenuEditor";
import { RedirectForm, RedirectToggle } from "@/components/admin/site/RedirectForm";
import { SetUpButton } from "@/components/admin/site/SetUpButton";
import { SettingsForm } from "@/components/admin/site/SettingsForm";
import { ThemeReset } from "@/components/admin/site/ThemeReset";
import { UiTextEditor } from "@/components/admin/site/UiTextEditor";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { SITE_WORKING_NOTE, type MenuFormModel, type RedirectFormModel, type SettingsFormModel, type UiGroupFormModel } from "@/server/admin/actions/site-model";
import { mediaCards } from "@/server/media/cards";
import { readMenus, routeChoices } from "@/server/site/menus";
import { readablePath } from "@/server/site/paths";
import { listRedirects, readRedirect, redirectTargetChoices } from "@/server/site/redirects";
import { APPROVED_TOKENS, COUNTRY_CODE, REFERENCE_TOKENS, UI_GROUPS } from "@/server/site/registry";
import { readSettings } from "@/server/site/settings";
import { readTheme } from "@/server/site/theme";
import { readUiText } from "@/server/site/ui-text";
import type { SearchParams } from "./cms";
import { Forbidden, formatTime, PageHeader } from "./parts";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Saved({ show, text }: { show: boolean; text: string }) {
  return show ? (
    <div className="adm-alert is-success" role="status">
      <p>{text}</p>
    </div>
  ) : null;
}

/** Links to the shell's preview (the header and footer of the working copy), both languages and themes. */
function PreviewLinks({ show }: { show: boolean }) {
  if (!show) return null;
  const link = (locale: "en" | "ar", theme: "light" | "dark", label: string) => (
    <a className="adm-btn is-small" href={`/admin/preview/site/shell?locale=${locale}&theme=${theme}`} target="_blank" rel="noopener">
      {label}
      <span className="adm-sr-only"> (opens in a new tab)</span>
    </a>
  );
  return (
    <div className="adm-actions adm-site-actions" aria-label="Preview the header and footer">
      {link("en", "light", "Preview English")}
      {link("ar", "light", "Preview Arabic")}
      {link("en", "dark", "English, dark")}
      {link("ar", "dark", "Arabic, dark")}
    </div>
  );
}

// --- Settings ---------------------------------------------------------------------------------------------------------

export async function SettingsScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const query = searchParams;
  const db = authDeps().db;
  const settings = await guarded(() => readSettings(db));
  const canEdit = actor.permissions.has("settings.edit");
  const canPreview = actor.permissions.has("preview.use");
  const ogId = settings.values.defaultOgImageMediaId;
  const cards = ogId ? await guarded(() => mediaCards(db, actor.permissions, [ogId])) : {};
  const model: SettingsFormModel = {
    lockVersion: settings.lockVersion,
    ...settings.values,
    countryCode: COUNTRY_CODE,
    phones: settings.values.phones.map((p) => ({ ...p })),
    status: { en: settings.status.en === "needs_review" ? "needs_review" : "complete", ar: settings.status.ar === "needs_review" ? "needs_review" : "complete" },
  };
  return (
    <>
      <PageHeader title="Company & website" lead="The company's identity and contact details, the address and map, the social link and the global SEO defaults, in English and Arabic." actions={<PreviewLinks show={canPreview && settings.setUp} />} />
      <p className="adm-hint">{SITE_WORKING_NOTE}</p>
      <Saved show={one(query.saved) === "1"} text="Saved. The preview shows the working copy; visitors still see today's website." />
      {settings.setUp ? (
        <>
          <p className="adm-muted">Last changed {formatTime(settings.updatedAt)} · version {settings.lockVersion}</p>
          <SettingsForm key={settings.lockVersion} model={model} cards={cards} canEdit={canEdit} canUpload={actor.permissions.has("media.upload")} />
        </>
      ) : (
        <section className="adm-card" aria-labelledby="settings-setup-title">
          <div className="adm-card-head">
            <h2 id="settings-setup-title">Not set up yet</h2>
          </div>
          <p>The working copy is empty. Copy today&apos;s company details from the website to start; nothing changes for visitors.</p>
          {canEdit ? <SetUpButton part="settings" label="Copy today's company details" savedHref="/admin/settings?saved=1" /> : <p className="adm-muted">An Owner or Admin can set it up.</p>}
        </section>
      )}
    </>
  );
}

// --- Navigation -------------------------------------------------------------------------------------------------------

export async function NavigationScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const query = searchParams;
  const menus = await guarded(() => readMenus(authDeps().db));
  const canEdit = actor.permissions.has("menus.edit");
  const setUp = menus.some((m) => m.setUp);
  const saved = one(query.saved);
  const models: MenuFormModel[] = menus.map((m) => ({
    key: m.key,
    name: m.slot.name,
    description: m.slot.description,
    lockVersion: m.lockVersion,
    minItems: m.slot.minItems,
    maxItems: m.slot.maxItems,
    labelMax: m.slot.labelMax,
    pinned: m.slot.pinned ?? null,
    alwaysShown: [...(m.slot.alwaysShown ?? [])],
    fixed: Boolean(m.slot.fixed),
    items: m.items.map((i) => ({ id: i.id, linkType: i.linkType, route: i.route, label: i.label ? { ...i.label } : null, isVisible: i.isVisible })),
  }));
  return (
    <>
      <PageHeader title="Navigation" lead="The header's pages and Services menu, and the footer's company and legal links: order, visibility and labels in English and Arabic." actions={<PreviewLinks show={actor.permissions.has("preview.use") && setUp} />} />
      <p className="adm-hint">{SITE_WORKING_NOTE}</p>
      <Saved show={Boolean(saved && menus.some((m) => m.key === saved))} text="Saved. The preview shows the working copy; visitors still see today's website." />
      {setUp ? (
        models.map((model) => <MenuEditor key={`${model.key}:${model.lockVersion}`} model={model} routes={routeChoices()} canEdit={canEdit} />)
      ) : (
        <section className="adm-card" aria-labelledby="nav-setup-title">
          <div className="adm-card-head">
            <h2 id="nav-setup-title">Not set up yet</h2>
          </div>
          <p>The menus are empty. Copy today&apos;s navigation from the website to start; nothing changes for visitors.</p>
          {canEdit ? <SetUpButton part="navigation" label="Copy today's navigation" savedHref="/admin/navigation" /> : <p className="adm-muted">An Owner or Admin can set it up.</p>}
        </section>
      )}
    </>
  );
}

// --- Interface text -----------------------------------------------------------------------------------------------------

export async function InterfaceTextScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const query = searchParams;
  const ui = await guarded(() => readUiText(authDeps().db));
  const canEdit = actor.permissions.has("settings.edit");
  const groups: UiGroupFormModel[] = UI_GROUPS.map((g) => ({
    key: g.key,
    name: g.name,
    description: g.description,
    strings: ui.rows
      .filter((r) => r.def.group === g.key)
      .map((r) => ({
        key: r.def.key,
        description: r.def.description,
        maxLength: r.def.maxLength,
        otherLanguage: Boolean(r.def.otherLanguage),
        value: { en: r.value.en ?? "", ar: r.value.ar ?? "" },
        today: { ...r.today },
      })),
  }));
  return (
    <>
      <PageHeader title="Interface text" lead="The labels of the website's shell — skip link, menus, controls, contact actions, footer titles, page not found — in English and Arabic." actions={<PreviewLinks show={actor.permissions.has("preview.use") && ui.setUp} />} />
      <p className="adm-hint">{SITE_WORKING_NOTE}</p>
      <Saved show={one(query.saved) === "1"} text="Saved. The preview shows the working copy; visitors still see today's website." />
      {ui.setUp ? (
        <UiTextEditor key={ui.lockVersion} groups={groups} lockVersion={ui.lockVersion} canEdit={canEdit} />
      ) : (
        <section className="adm-card" aria-labelledby="ui-setup-title">
          <div className="adm-card-head">
            <h2 id="ui-setup-title">Not set up yet</h2>
          </div>
          <p>No text is in the working copy yet. Copy today&apos;s interface text from the website to start; nothing changes for visitors.</p>
          {canEdit ? <SetUpButton part="ui" label="Copy today's interface text" savedHref="/admin/interface-text?saved=1" /> : <p className="adm-muted">An Owner or Admin can set it up.</p>}
        </section>
      )}
    </>
  );
}

// --- Theme -------------------------------------------------------------------------------------------------------------

export async function ThemeScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("theme.edit")) return <Forbidden />;
  const query = searchParams;
  const theme = await guarded(() => readTheme(authDeps().db));
  return (
    <>
      <PageHeader title="Theme" lead="The approved Modern Commerce design's tokens. The theme is the Owner's alone." />
      <Saved show={one(query.saved) === "1"} text="Saved: the approved design applies." />
      <section className="adm-card" aria-labelledby="theme-approved-title">
        <div className="adm-card-head">
          <h2 id="theme-approved-title">Overrides</h2>
        </div>
        {APPROVED_TOKENS.length ? null : (
          <p>
            No design token is approved for overriding: the approved design applies everywhere, unchanged. A token can be offered here only after the Owner approves it, one by one (decision
            D-A6-3). No colour, font, CSS or script can be entered.
          </p>
        )}
        {theme.overrides.length ? (
          <>
            <ul className="adm-site-rows">
              {theme.overrides.map((o) => (
                <li key={`${o.tokenKey}-${o.scheme}`} className="adm-site-row">
                  <span className="adm-mono">{o.tokenKey}</span> ({o.scheme}): <span className="adm-mono">{o.value}</span>
                </li>
              ))}
            </ul>
            <ThemeReset lockVersion={theme.lockVersion} />
          </>
        ) : (
          <p className="adm-muted">Overrides: none.</p>
        )}
      </section>
      <section className="adm-card" aria-labelledby="theme-reference-title">
        <div className="adm-card-head">
          <h2 id="theme-reference-title">The approved design (for reference)</h2>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">The approved design&apos;s core tokens</caption>
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Use</th>
                <th scope="col">Light</th>
                <th scope="col">Dark</th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE_TOKENS.map((t) => (
                <tr key={t.cssVar}>
                  <th scope="row" className="adm-mono">
                    {t.cssVar}
                  </th>
                  <td data-label="Use">{t.label}</td>
                  {(["light", "dark"] as const).map((scheme) => (
                    <td key={scheme} data-label={scheme === "light" ? "Light" : "Dark"}>
                      <span className="adm-mono">{t[scheme]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// --- Redirects ------------------------------------------------------------------------------------------------------------

const REDIRECT_NOTE = "Stored and checked now; redirects take effect only when the website switches to the database (A9).";

export async function RedirectsScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("redirects.view")) return <Forbidden />;
  const query = searchParams;
  const stateParam = one(query.state);
  const state = stateParam === "active" || stateParam === "inactive" ? stateParam : "all";
  const q = (one(query.q) ?? "").slice(0, 200);
  const page = Number(one(query.page) ?? "1");
  const list = await guarded(() => listRedirects(authDeps().db, { state, q, page }));
  const canManage = actor.permissions.has("redirects.manage");
  const href = (p: number) => `/admin/redirects?${new URLSearchParams({ ...(state !== "all" ? { state } : {}), ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader
        title="Redirects"
        lead="Old addresses that move to a page of the website (308 permanent, 307 temporary)."
        actions={
          canManage ? (
            <Link className="adm-btn is-primary" href="/admin/redirects/new">
              New redirect
            </Link>
          ) : null
        }
      />
      <p className="adm-hint">{REDIRECT_NOTE}</p>
      <Saved show={one(query.saved) === "created"} text="Created. It takes effect when the website switches to the database (A9)." />
      <form className="adm-filters" method="get" action="/admin/redirects" role="search" aria-label="Find redirects">
        <div className="adm-field">
          <label className="adm-label" htmlFor="redirects-q">
            Address contains
          </label>
          <input id="redirects-q" className="adm-input" name="q" defaultValue={q} dir="ltr" />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="redirects-state">
            State
          </label>
          <select id="redirects-state" className="adm-input" name="state" defaultValue={state}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button type="submit" className="adm-btn">
          Show
        </button>
      </form>
      {list.rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">Redirects, page {list.page} of {list.pages}</caption>
            <thead>
              <tr>
                <th scope="col">Old address</th>
                <th scope="col">Leads to</th>
                <th scope="col">Kind</th>
                <th scope="col">State</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="adm-cell-title">
                    <Link href={`/admin/redirects/${r.id}`} dir="ltr" className="adm-mono adm-site-path">
                      {readablePath(r.sourcePath)}
                    </Link>
                  </th>
                  <td data-label="Leads to">
                    <span className="adm-site-path" dir="ltr">
                      {r.targetType === "path" ? readablePath(r.targetAddress ?? "") : r.targetLabel}
                    </span>
                    {r.warning ? <span className="adm-badge is-warning"> {r.warning}</span> : null}
                  </td>
                  <td data-label="Kind">{r.statusCode === 308 ? "Permanent (308)" : "Temporary (307)"}</td>
                  <td data-label="State">{r.isActive ? <span className="adm-badge is-success">Active</span> : <span className="adm-badge">Inactive</span>}</td>
                  <td data-label="Updated">{formatTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adm-empty">
          <p>{q || state !== "all" ? "No redirect matches." : "No redirect yet."}</p>
        </div>
      )}
      {list.pages > 1 ? (
        <nav className="adm-actions" aria-label="Pages">
          {list.page > 1 ? (
            <Link className="adm-btn" href={href(list.page - 1)}>
              Previous page
            </Link>
          ) : null}
          <span className="adm-muted">
            Page {list.page} of {list.pages} ({list.total} redirects)
          </span>
          {list.page < list.pages ? (
            <Link className="adm-btn" href={href(list.page + 1)}>
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

export async function RedirectNewScreen() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("redirects.manage")) return <Forbidden />;
  const choices = await guarded(() => redirectTargetChoices(authDeps().db));
  const model: RedirectFormModel = { id: "", lockVersion: 0, sourcePath: "", targetType: "path", targetPath: "", targetId: "", statusCode: 308, note: "" };
  return (
    <>
      <PageHeader title="New redirect" crumbs={[{ href: "/admin/redirects", label: "Redirects" }]} />
      <p className="adm-hint">{REDIRECT_NOTE}</p>
      <RedirectForm model={model} choices={choices} canEdit />
    </>
  );
}

export async function RedirectEditScreen({ id, searchParams }: { id: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("redirects.view")) return <Forbidden />;
  const query = searchParams;
  const db = authDeps().db;
  const row = await guarded(() => readRedirect(db, id));
  if (!row) notFound();
  const canManage = actor.permissions.has("redirects.manage");
  const choices = canManage ? await guarded(() => redirectTargetChoices(db)) : { page: [], service: [], project: [] };
  if (canManage && row.targetId && row.targetType !== "path" && !choices[row.targetType].some((c) => c.id === row.targetId)) {
    choices[row.targetType].unshift({ id: row.targetId, label: row.targetLabel });
  }
  const model: RedirectFormModel = {
    id: row.id,
    lockVersion: row.lockVersion,
    sourcePath: readablePath(row.sourcePath),
    targetType: row.targetType,
    targetPath: readablePath(row.targetPath ?? ""),
    targetId: row.targetId ?? "",
    statusCode: row.statusCode,
    note: row.note,
  };
  return (
    <>
      <PageHeader title="Redirect" crumbs={[{ href: "/admin/redirects", label: "Redirects" }]} actions={canManage ? <RedirectToggle id={row.id} lockVersion={row.lockVersion} active={row.isActive} /> : null} />
      <p className="adm-hint">{REDIRECT_NOTE}</p>
      <Saved show={one(query.saved) === "1"} text="Saved." />
      <p className="adm-muted">
        {row.isActive ? "Active" : "Inactive"} · leads to <span dir="ltr">{row.targetAddress ? readablePath(row.targetAddress) : "—"}</span> · last changed {formatTime(row.updatedAt)}
      </p>
      {row.warning ? (
        <div className="adm-alert is-info" role="status">
          <p>{row.warning}</p>
        </div>
      ) : null}
      <RedirectForm key={row.lockVersion} model={model} choices={choices} canEdit={canManage} />
    </>
  );
}
