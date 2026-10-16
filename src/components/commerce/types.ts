import type { MediaAsset } from "@/content/media";

/**
 * A photo, cut-out or logo from the media registry, with the alt text for the place it is shown. `unoptimized`: an
 * uploaded media library item (the page builder's preview), drawn as it is — the image optimizer never takes those.
 */
export type CommerceImage = MediaAsset & { alt: string; unoptimized?: true };

/** Colour roles: brand orange for actions, steel for engineering, teal for process and site support, brass for craft. */
export type Tone = "brand" | "steel" | "teal" | "brass";

/** A machine as the machinery showcase shows it. */
export interface MachineItem {
  slug: string;
  name: string;
  shortName: string;
  category: string;
  capability: string;
  power?: { value: string; unit: string };
  service: { name: string; href: string };
  href: string;
  image: CommerceImage;
}
