import { getShellView } from "@/components/commerce/data";
import { ProjectFilterProvider } from "@/components/commerce/projects/Gallery";
import { PageShell } from "@/components/commerce/shell/PageShell";
import type { RouteKey } from "@/i18n/routes";
import type { PreviewMapEntry } from "@/server/admin/actions/preview-protocol";
import type { PreviewModel } from "@/server/builder/preview";
import { REGISTRY } from "@/server/builder/registry";
import { idsOf } from "@/server/builder/structure";
import { sectionNotes } from "@/server/builder/view";
import { overlayShell, type WorkingSite } from "@/server/site/working";
import { routeHref, type RenderContext } from "./context";
import { PreviewBridge } from "./PreviewBridge";
import { PreviewLanguageLink } from "./PreviewLanguageLink";
import { siteViewOf } from "./site";
import { isRenderedBlock } from "./keys";
import { blockSection, compose, runs, type Placed } from "./compose";
import { BLOCK_ABSENT, BLOCK_NOTES, BLOCK_SELECTORS, GroupView, SectionView } from "./render";

/** The header's current page for the site's own pages (nothing is marked on generic, service and template pages). */
const ROUTE_OF: Partial<Record<string, RouteKey>> = {
  home: "home",
  "system:about": "about",
  "system:services": "services",
  "system:capabilities": "capabilities",
  "system:projects": "projects",
  "system:industries": "industries",
  "system:clients": "clients",
  "system:certificates": "certificates",
  "system:contact": "contact",
  "legal:privacy": "privacy",
  "legal:terms": "terms",
  service: "service",
  "template:service_detail_default": "service",
  "template:project_detail": "project",
};

/** A bespoke block's own notes (records left out, photos stood in for); a block whose notes fail to work out says so. */
function adapterNotes(placed: Placed, ctx: RenderContext): string[] {
  const { section } = placed;
  const notes = isRenderedBlock(section.blockType) ? BLOCK_NOTES[section.blockType] : undefined;
  if (!notes || placed.absent) return [];
  try {
    return notes({ section: blockSection(section, placed.ordinal), ctx });
  } catch {
    return ["This section's notes could not be worked out."];
  }
}

/**
 * A preview page (A5 brief §36): the website's shell (header and footer from the site's working copy, A6 — today's
 * where it is not set up) around the working sections, each drawn by its block's renderer; then the bridge to the
 * builder. A reusable section is shown on its own, without the shell. Notes about each section (missing language,
 * placeholders, records left out) go to the bridge, never into the page.
 */
export async function PreviewCanvas({ model, frame, site }: { model: PreviewModel; frame: boolean; site: WorkingSite }) {
  const route = model.ownerKind ? ROUTE_OF[model.ownerKind] : undefined;
  const shell = overlayShell(await getShellView(model.locale, route && model.path ? { route, path: model.path } : { route: null, path: null }), site, model.locale);
  const base: Omit<RenderContext, "layout"> = {
    locale: model.locale,
    kind: model.kind,
    ownerKind: model.ownerKind,
    path: model.path === "/" ? "" : (model.path ?? ""),
    label: model.label,
    records: model.records,
    media: model.media,
    service: model.service,
    project: model.sample?.type === "project" ? (model.records.projects.find((p) => p.id === model.sample?.id) ?? null) : null,
    page: model.page,
    shell,
    site: siteViewOf(site, model.locale),
    hrefOf: routeHref,
  };
  const { placed, layout } = compose(model.sections, base, BLOCK_ABSENT);
  const ctx: RenderContext = { ...base, layout };
  const map: PreviewMapEntry[] = placed.map((item) => {
    const { section } = item;
    const def = REGISTRY.get(section.blockType);
    const notes = [
      ...new Set([
        ...section.notes,
        ...(item.absent ? [`Not shown on this page: ${item.absent}`] : []),
        ...(def && section.state === "ok" ? [...sectionNotes(def, section.settings, model.locale, ctx), ...adapterNotes(item, ctx)] : []),
      ]),
    ];
    return {
      id: section.id,
      label: section.label,
      blockType: section.blockType,
      anchor: section.anchor,
      ids: def ? idsOf({ id: section.id, blockType: section.blockType, anchor: null, visible: true, devices: { desktop: true, tablet: true, mobile: true }, locked: false, reusableId: null }, def) : [],
      selector: isRenderedBlock(section.blockType) && !item.absent ? (BLOCK_SELECTORS[section.blockType] ?? null) : null,
      notes: section.state === "ok" ? notes : [section.problem ?? "This section can't be shown."],
      state: section.state,
      linked: section.linked,
    };
  });
  const drawn = (
    <>
      {runs(placed).map((run) =>
        run.group ? (
          <GroupView key={run.items[0].section.id} group={run.group} items={run.items} ctx={ctx} />
        ) : (
          <SectionView key={run.items[0].section.id} placed={run.items[0]} ctx={ctx} />
        ),
      )}
      {model.sections.length === 0 && (
        <div className="shell gb-failed" lang="en" dir="ltr">
          <div className="gb-missing">
            <span className="gb-note">Preview only — this layout has no sections {model.skipped.length ? "shown on this screen size" : "yet"}.</span>
          </div>
        </div>
      )}
    </>
  );
  // The Projects overview's opening (its quick toggles) and gallery share one choice, as today's page does.
  const sections = model.ownerKind === "system:projects" ? <ProjectFilterProvider>{drawn}</ProjectFilterProvider> : drawn;
  if (model.kind === "reusable") {
    return (
      <>
        <main id="main" tabIndex={-1} className="outline-none gb-reusable">
          {sections}
        </main>
        <PreviewBridge map={map} frame={frame} />
      </>
    );
  }
  return (
    <>
      <PageShell shell={shell} sameAddressLink={PreviewLanguageLink}>
        {sections}
      </PageShell>
      <PreviewBridge map={map} frame={frame} />
    </>
  );
}
