import type { ReactNode } from "react";
import { HOME_NOTES, HOME_RENDERERS } from "./adapters/home";
import { SERVICE_ABSENT, SERVICE_NOTES, SERVICE_RENDERERS } from "./adapters/service";
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
import { AbsentSection, blockSection, type Placed, type Presence } from "./compose";
import { InvalidSection } from "./Placeholder";
import { SectionBoundary } from "./SectionBoundary";

type Renderer = (props: BlockProps) => ReactNode | Promise<ReactNode>;

/** Until a block's adapter is written: an admin-only note in its place. */
function Pending({ section }: BlockProps) {
  return <InvalidSection id={section.id} label={section.blockType} problem="This block's preview is not available yet." />;
}

/** The renderer of every storable block (keys.ts): a missing one fails the typecheck. */
export const RENDERERS: Record<RenderedBlock, Renderer> = {
  ...HOME_RENDERERS,
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
  ...SERVICE_RENDERERS,
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

/** What a bespoke block's preview leaves out or stands in for, beyond what its declared fields tell (`sectionNotes`). */
export const BLOCK_NOTES: Partial<Record<RenderedBlock, (props: BlockProps) => string[]>> = {
  ...HOME_NOTES,
  ...SERVICE_NOTES,
};

/** Blocks that show nothing where their content is missing (as today's pages leave such a section out): the reason. */
export const BLOCK_ABSENT: Partial<Record<RenderedBlock, Presence>> = {
  ...SERVICE_ABSENT,
};

/**
 * Where the preview finds a block that renders neither its anchor nor an id of its own (the builder's outline and the
 * pointer's picks), as a selector of the approved component's markup.
 */
export const BLOCK_SELECTORS: Partial<Record<RenderedBlock, string>> = {};

/** Frames that hold several sections (`compose.tsx`): drawn by one renderer each. */
export type GroupRenderer = (props: { items: Placed[]; ctx: RenderContext }) => ReactNode | Promise<ReactNode>;

export const GROUP_RENDERERS: Record<string, GroupRenderer> = {
  // The homepage's clients and compliance share one muted sheet (the sheet's own top space when compliance comes first).
  "home-sheet": ({ items, ctx }) => (
    <div className={items[0].section.blockType === "home.compliance" ? "sec-sheet sec-muted gb-sheet-top" : "sec-sheet sec-muted"}>
      {items.map((item) => (
        <SectionView key={item.section.id} placed={item} ctx={ctx} />
      ))}
    </div>
  ),
};

/**
 * One section, drawn by its block's renderer: a renderer that fails while it reads its data shows a placeholder for that
 * section alone (caught here, on the server), and so does one that fails in the browser (`SectionBoundary`); a section
 * that could not be read shows its reason, and one whose content is missing on this page says so. No Suspense boundary:
 * the page hydrates in one piece, as the website does, so the reveals and the rest of the motion start on every section
 * together.
 */
export async function SectionView({ placed, ctx }: { placed: Placed; ctx: RenderContext }) {
  const { section, absent, ordinal } = placed;
  if (section.state !== "ok" || !isRenderedBlock(section.blockType)) {
    return <InvalidSection id={section.id} label={section.label} problem={section.problem ?? "This section can't be shown."} />;
  }
  if (absent) return <AbsentSection id={section.id} label={section.label} reason={absent} />;
  const Render = RENDERERS[section.blockType];
  let output: ReactNode;
  try {
    output = await Render({ section: blockSection(section, ordinal), ctx });
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

/** A frame of several sections, drawn by its group's renderer (a failure shows each of its sections' placeholder). */
export async function GroupView({ group, items, ctx }: { group: string; items: Placed[]; ctx: RenderContext }) {
  const Render = GROUP_RENDERERS[group];
  let output: ReactNode;
  try {
    output = Render ? await Render({ items, ctx }) : null;
  } catch (error) {
    console.error(`Preview: sections ${items.map((i) => i.section.id).join(", ")} (${group}) could not be drawn: ${error instanceof Error ? error.name : "error"}`);
    output = null;
  }
  if (output === null) {
    return items.map((item) => (
      <InvalidSection key={item.section.id} id={item.section.id} label={item.section.label} problem="This section could not be drawn. Its other sections are shown; check its settings in the editor." />
    ));
  }
  return (
    <SectionBoundary id={items[0].section.id} label={items.map((i) => i.section.label).join(", ")}>
      {output}
    </SectionBoundary>
  );
}
