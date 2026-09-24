import { mediaRegistry, type MediaId } from "./media.generated";

export interface MediaAsset {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

export function getMedia(id: MediaId): MediaAsset {
  return mediaRegistry[id];
}
