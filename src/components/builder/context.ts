/**
 * What every renderer of the page builder's preview receives (A5): the section (its id, type, anchor, validated settings
 * and the chosen language's texts) and the render context — the language, the working records and media the page
 * names, the static shell (header, footer, the company's current contact details: read-only until A6) and the address
 * function of the site's routes. Built once per preview request by the preview route; nothing here is cached or
 * published.
 */
import type { ShellView } from "@/components/commerce/data";
import type { Tone } from "@/components/commerce/types";
import { href } from "@/i18n/routes";
import type { OwnerKind } from "@/server/builder/block";
import type { Content, Locale, Settings } from "@/server/builder/fields";
import type { PreviewMedia, PreviewRecords, PreviewService } from "@/server/builder/preview-data";
import type { PreviewKind } from "@/server/builder/preview";
import type { RouteHref } from "@/server/builder/view";

export interface RenderContext {
  locale: Locale;
  kind: PreviewKind;
  ownerKind: OwnerKind | null;
  /** The page's or service's future address without the language (`/about`, `/services/<slug>`, `/<slug>`), for its own links. */
  path: string;
  label: string;
  records: PreviewRecords;
  media: ReadonlyMap<string, PreviewMedia>;
  service: PreviewService | null;
  page: { systemKey: string | null; effectiveDate: string | null } | null;
  shell: ShellView;
  hrefOf: RouteHref;
  /** What the rest of the page holds, for blocks whose approved component depends on it. */
  layout: LayoutFacts;
}

/**
 * Facts about the whole layout a block may need: which block types the page shows (a service opening's "See the work"
 * goes to the gallery or the projects only where the page has them), and a service page's colour role, set on its
 * opening (every section of the page takes it, as today's pages take their service's).
 */
export interface LayoutFacts {
  present: ReadonlySet<string>;
  serviceTone: Tone | null;
}

export interface BlockSection {
  id: string;
  blockType: string;
  anchor: string | null;
  settings: Settings;
  /** The chosen language's texts (null: none yet; renderers show what they can and the notes say why). */
  content: Content | null;
  /**
   * The section's place among the page's numbered sections of its kind (0 first; -1 when its kind is not numbered): a
   * service page's sections and the About parts number themselves by it, and a service section takes its surface from it.
   */
  ordinal: number;
}

export interface BlockProps {
  section: BlockSection;
  ctx: RenderContext;
}

/** The site's route table as the view helpers take it. */
export const routeHref: RouteHref = (locale, key, params) => href(locale, key, params);
