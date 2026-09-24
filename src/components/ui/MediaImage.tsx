import Image from "next/image";
import { getMedia } from "@/content/media";
import type { MediaId } from "@/content/types";

interface MediaImageProps {
  id: MediaId;
  alt: string;
  sizes: string;
  fill?: boolean;
  className?: string;
  preload?: boolean;
  quality?: number;
}

/** next/image backed by the media registry (intrinsic size + blur placeholder). */
export function MediaImage({ id, alt, sizes, fill, className, preload, quality }: MediaImageProps) {
  const media = getMedia(id);
  const common = {
    src: media.src,
    sizes,
    className,
    quality,
    preload,
    placeholder: "blur" as const,
    blurDataURL: media.blurDataURL,
  };
  if (fill) return <Image {...common} alt={alt} fill />;
  return <Image {...common} alt={alt} width={media.width} height={media.height} />;
}
