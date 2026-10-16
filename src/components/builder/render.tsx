import type { ReactNode } from "react";
import type { PreviewSection } from "@/server/builder/preview";
import type { BlockProps, RenderContext } from "./context";
import { GenericContactDetails, GenericQuoteForm } from "./generic/contact";
import { GenericDownloads, GenericGallery, GenericImage, GenericLogoStrip, GenericMap, GenericTextImage, GenericVideo } from "./generic/media";
import { GenericCertificates, GenericClientLogos, GenericIndustries, GenericMachineGrid, GenericProjectsGrid, GenericServicesGrid } from "./generic/records";
import {
  GenericButtonGroup,
  GenericCta,
  GenericDivider,
  GenericFaq,
  GenericFeatureCards,
  GenericHeading,
  GenericHero,
  GenericProcess,
  GenericRichText,
  GenericSpacer,
  GenericStatistics,
  GenericTimeline,
} from "./generic/text";
import { isRenderedBlock, type RenderedBlock } from "./keys";
import { SectionBoundary } from "./SectionBoundary";

type Renderer = (props: BlockProps) => ReactNode | Promise<ReactNode>;

/** Until a block's adapter is written: an admin-only note in its place. */
function Pending({ section }: BlockProps) {
  return <InvalidSection id={section.id} label={section.blockType} problem="This block's preview is not available yet." />;
}

/** The renderer of every storable block (keys.ts): a missing one fails the typecheck. */
export const RENDERERS: Record<RenderedBlock, Renderer> = {
  "home.hero": Pending,
  "home.capability_strip": Pending,
  "home.about": Pending,
  "home.services": Pending,
  "home.machinery": Pending,
  "home.projects": Pending,
  "home.industries": Pending,
  "home.clients": Pending,
  "home.compliance": Pending,
  "home.contact": Pending,
  "page.hero": Pending,
  "page.closing_cta": Pending,
  "about.overview": Pending,
  "about.what": Pending,
  "about.metal": Pending,
  "about.beyond": Pending,
  "about.vision": Pending,
  "about.approach": Pending,
  "about.process": Pending,
  "about.why": Pending,
  "about.workshop": Pending,
  "about.machinery": Pending,
  "about.work": Pending,
  "about.clients": Pending,
  "about.compliance": Pending,
  "services.index": Pending,
  "service.hero": Pending,
  "service.overview": Pending,
  "service.scope": Pending,
  "service.process": Pending,
  "service.machines": Pending,
  "service.applications": Pending,
  "service.gallery": Pending,
  "service.why": Pending,
  "service.related": Pending,
  "service.projects": Pending,
  "service.cta": Pending,
  "capabilities.power": Pending,
  "capabilities.console": Pending,
  "capabilities.register": Pending,
  "capabilities.service_lines": Pending,
  "capabilities.source": Pending,
  "projects.featured": Pending,
  "projects.highlights": Pending,
  "projects.gallery": Pending,
  "projects.index": Pending,
  "project.hero": Pending,
  "project.photos": Pending,
  "project.details": Pending,
  "industries.sectors": Pending,
  "industries.index": Pending,
  "clients.wall": Pending,
  "certificates.register": Pending,
  "certificates.redaction": Pending,
  "contact.quote": Pending,
  "contact.location": Pending,
  "legal.contents": Pending,
  "legal.section": Pending,
  "not_found.view": Pending,
  "generic.hero": GenericHero,
  "generic.heading": GenericHeading,
  "generic.rich_text": GenericRichText,
  "generic.image": GenericImage,
  "generic.text_image": GenericTextImage,
  "generic.gallery": GenericGallery,
  "generic.video": GenericVideo,
  "generic.services_grid": GenericServicesGrid,
  "generic.projects_grid": GenericProjectsGrid,
  "generic.machine_grid": GenericMachineGrid,
  "generic.client_logos": GenericClientLogos,
  "generic.certificates": GenericCertificates,
  "generic.statistics": GenericStatistics,
  "generic.feature_cards": GenericFeatureCards,
  "generic.timeline": GenericTimeline,
  "generic.process": GenericProcess,
  "generic.industries": GenericIndustries,
  "generic.faq": GenericFaq,
  "generic.cta": GenericCta,
  "generic.contact_details": GenericContactDetails,
  "generic.quote_form": GenericQuoteForm,
  "generic.map": GenericMap,
  "generic.logo_strip": GenericLogoStrip,
  "generic.divider": GenericDivider,
  "generic.spacer": GenericSpacer,
  "generic.button_group": GenericButtonGroup,
  "generic.downloads": GenericDownloads,
};

/** A section the preview cannot draw (unknown type, newer version, invalid data): an admin-only placeholder with its reason. */
export function InvalidSection({ id, label, problem }: { id: string; label: string; problem: string }) {
  return (
    <div className="shell gb-failed" data-section={id} lang="en" dir="ltr">
      <div className="gb-missing">
        <span className="gb-note">
          Preview only — “{label}” ({id}): {problem}
        </span>
      </div>
    </div>
  );
}

/**
 * One section, drawn by its block's renderer: a renderer that fails while it reads its data shows a placeholder for that
 * section alone (caught here, on the server), and so does one that fails in the browser (`SectionBoundary`); a section
 * that could not be read shows its reason. No Suspense boundary: the page hydrates in one piece, as the website does, so
 * the reveals and the rest of the motion start on every section together.
 */
export async function SectionView({ section, ctx }: { section: PreviewSection; ctx: RenderContext }) {
  if (section.state !== "ok" || !isRenderedBlock(section.blockType)) {
    return <InvalidSection id={section.id} label={section.label} problem={section.problem ?? "This section can't be shown."} />;
  }
  const Render = RENDERERS[section.blockType];
  let output: ReactNode;
  try {
    output = await Render({ section: { id: section.id, blockType: section.blockType, anchor: section.anchor, settings: section.settings, content: section.content }, ctx });
  } catch (error) {
    // The server log keeps the reason; the page shows only that this section could not be drawn.
    console.error(`Preview: section ${section.id} (${section.blockType}) could not be drawn: ${error instanceof Error ? error.name : "error"}`);
    return <InvalidSection id={section.id} label={section.label} problem="This section could not be drawn. Its other sections are shown; check its settings in the editor." />;
  }
  return (
    <SectionBoundary id={section.id} label={section.label}>
      {output}
    </SectionBoundary>
  );
}
