import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";
import type { RouteKey } from "@/i18n/routes";
import type { PreviewMapEntry } from "@/server/admin/actions/preview-protocol";
import type { PreviewModel, PreviewSection } from "@/server/builder/preview";
import { REGISTRY } from "@/server/builder/registry";
import { idsOf } from "@/server/builder/structure";
import { sectionNotes } from "@/server/builder/view";
import { routeHref, type RenderContext } from "./context";
import { PreviewBridge } from "./PreviewBridge";
import { PreviewLanguageLink } from "./PreviewLanguageLink";
import { isRenderedBlock } from "./keys";
import { BLOCK_NOTES, SectionView } from "./render";

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

/** The homepage's clients and compliance blocks share one muted sheet when they follow each other (as today). */
const HOME_SHEET = new Set(["home.clients", "home.compliance"]);

/** The sections in page order, consecutive clients and compliance blocks grouped on their sheet. */
function runs(sections: PreviewSection[]): { sheet: boolean; sections: PreviewSection[] }[] {
  const out: { sheet: boolean; sections: PreviewSection[] }[] = [];
  for (const section of sections) {
    const last = out[out.length - 1];
    const sheet = HOME_SHEET.has(section.blockType);
    if (sheet && last?.sheet) last.sections.push(section);
    else out.push({ sheet, sections: [section] });
  }
  return out;
}

/** A bespoke block's own notes (records left out, photos stood in for); a block whose notes fail to work out says so. */
function adapterNotes(section: PreviewSection, ctx: RenderContext): string[] {
  const notes = isRenderedBlock(section.blockType) ? BLOCK_NOTES[section.blockType] : undefined;
  if (!notes) return [];
  try {
    return notes({ section: { id: section.id, blockType: section.blockType, anchor: section.anchor, settings: section.settings, content: section.content }, ctx });
  } catch {
    return ["This section's notes could not be worked out."];
  }
}

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
    const notes = [...new Set([...section.notes, ...(def && section.state === "ok" ? [...sectionNotes(def, section.settings, model.locale, ctx), ...adapterNotes(section, ctx)] : [])])];
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
      {runs(model.sections).map((run) =>
        run.sheet ? (
          <div key={run.sections[0].id} className={run.sections[0].blockType === "home.compliance" ? "sec-sheet sec-muted gb-sheet-top" : "sec-sheet sec-muted"}>
            {run.sections.map((section) => (
              <SectionView key={section.id} section={section} ctx={ctx} />
            ))}
          </div>
        ) : (
          <SectionView key={run.sections[0].id} section={run.sections[0]} ctx={ctx} />
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
