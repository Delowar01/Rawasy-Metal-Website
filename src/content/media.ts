import { mediaRegistry, type MediaId } from "./media.generated";

export interface MediaAsset {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** An uploaded library item (database content, A9.5): drawn as it is, never through the optimizer (A4). */
  unoptimized?: true;
}

export function getMedia(id: MediaId): MediaAsset {
  return mediaRegistry[id];
}
