import Image from "next/image";
import type { CommerceImage } from "../types";

/**
 * The size every machine photo is requested at — the hero plate, the selector and the stage alike — so the browser picks
 * the same file for each machine everywhere on the page and loads it once. The largest photo is 557 px wide, so no
 * request returns more than the source.
 */
const SIZES = "(min-width: 48rem) 560px, 92vw";

/**
 * A machine cut-out from the company profile, as large as its box allows and never larger than its source: its width is
 * the smallest of the box's width, the source width and the width the box's height allows at the photo's own ratio
 * (capabilities.css, from `--w` / `--h`), so it neither overflows a narrow box nor is enlarged in a wide one. The box
 * gives the size units it is measured in (cqw, cqh). `eager` loads the hero's photos with the page instead of when they
 * near the screen; every other instance is lazy and finds the same file already loaded (one request size for all).
 */
export function MachinePhoto({ image, eager = false }: { image: CommerceImage; eager?: boolean }) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={SIZES}
      className="cm-photo"
      style={{ "--w": image.width, "--h": image.height } as React.CSSProperties}
      loading={eager ? "eager" : "lazy"}
    />
  );
}
