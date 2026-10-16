import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";
import type { RouteKey } from "@/i18n/routes";
import type { PreviewMapEntry } from "@/server/admin/actions/preview-protocol";
import type { PreviewModel } from "@/server/builder/preview";
import { REGISTRY } from "@/server/builder/registry";
import { idsOf } from "@/server/builder/structure";
import { sectionNotes } from "@/server/builder/view";
import { routeHref, type RenderContext } from "./context";
import { PreviewBridge } from "./PreviewBridge";
import { PreviewLanguageLink } from "./PreviewLanguageLink";
import { SectionView } from "./render";

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
};

/**
 * A preview page (A5 brief §36): the website's shell (header and footer as today: Site settings, A6, will manage them)
 * around the working sections, each drawn by its block's renderer; then the bridge to the builder. A reusable section is
 * shown on its own, without the shell. Notes about each section (missing language, placeholders, records left out)
 * go to the bridge, never into the page.
 */
export async function PreviewCanvas({ model, frame }: { model: PreviewModel; frame: boolean }) {
  const route = model.ownerKind ? ROUTE_OF[model.ownerKind] : undefined;
  const shell = await getShellView(model.locale, route && model.path ? { route, path: model.path } : { route: null, path: null });
  const ctx: RenderContext = {
    locale: model.locale,
    kind: model.kind,
    ownerKind: model.ownerKind,
    path: model.path === "/" ? "" : (model.path ?? ""),
    label: model.label,
    records: model.records,
    media: model.media,
    service: model.service,
    page: model.page,
    shell,
    hrefOf: routeHref,
  };
  const map: PreviewMapEntry[] = model.sections.map((section) => {
    const def = REGISTRY.get(section.blockType);
    const notes = [...section.notes, ...(def && section.state === "ok" ? sectionNotes(def, section.settings, model.locale, ctx) : [])];
    return {
      id: section.id,
      label: section.label,
      blockType: section.blockType,
      anchor: section.anchor,
      ids: def ? idsOf({ id: section.id, blockType: section.blockType, anchor: null, visible: true, devices: { desktop: true, tablet: true, mobile: true }, locked: false, reusableId: null }, def) : [],
      notes: section.state === "ok" ? notes : [section.problem ?? "This section can't be shown."],
      state: section.state,
      linked: section.linked,
    };
  });
  const sections = (
    <>
      {model.sections.map((section) => (
        <SectionView key={section.id} section={section} ctx={ctx} />
      ))}
      {model.sections.length === 0 && (
        <div className="shell gb-failed" lang="en" dir="ltr">
          <div className="gb-missing">
            <span className="gb-note">Preview only — this layout has no sections {model.skipped.length ? "shown on this screen size" : "yet"}.</span>
          </div>
        </div>
      )}
    </>
  );
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
