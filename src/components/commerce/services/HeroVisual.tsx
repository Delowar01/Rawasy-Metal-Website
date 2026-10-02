import { Figure } from "../inner/Figure";
import { LaserCut } from "../signature/LaserCut";
import { LaserEngrave } from "../signature/LaserEngrave";
import type { CommerceImage } from "../types";
import { delay } from "../ui";
import { AxisGrid, PressBrake, ScaffoldTower, WeldSeam } from "./drawings";
import type { ServiceLook } from "./looks";

/**
 * The picture of a service page's hero, as composed in Stage 1D: each service pairs its photograph with its own
 * drawing. Laser Cutting and Laser Engraving show the homepage's signatures, the same components unchanged (each fills
 * the stage it sits on here); the other four show their restyled drawings. Photos are never shown wider than their
 * source (the figure's max-width).
 */
export function HeroVisual({ kind, cover, detail }: { kind: ServiceLook["hero"]; cover?: CommerceImage; detail?: CommerceImage }) {
  // No photographs: the engraved brass plate on its stage.
  if (kind === "plate") {
    return (
      <div className="sv-visual sv-plate">
        <div className="sv-plate-stage" data-reveal="fade">
          <LaserEngrave />
        </div>
      </div>
    );
  }
  if (!cover) return null;
  switch (kind) {
    // The cutting photograph, with the nesting sheet laid over its lower corner on a dark stage.
    case "cut":
      return (
        <div className="sv-visual sv-cut">
          <Figure image={cover} sizes="(min-width: 1024px) 640px, 92vw" priority className="sv-cut-photo" />
          <div className="sv-cut-sheet" data-reveal="fade" style={delay(240)}>
            <LaserCut />
          </div>
        </div>
      );

    // The press brake drawing, with the bending photo (a small export) as a raised inset at its own size.
    case "fold":
      return (
        <div className="sv-visual sv-fold">
          <div className="sv-panel" data-tone="steel">
            <PressBrake />
          </div>
          <Figure image={cover} sizes="295px" priority delay={200} className="sv-fold-photo" />
        </div>
      );

    // The photograph on the structural axis plate.
    case "frame":
      return (
        <div className="sv-visual sv-frame">
          <AxisGrid />
          <Figure image={cover} sizes="(min-width: 1024px) 530px, 76vw" priority className="sv-frame-photo" />
        </div>
      );

    // Two workshop photos on the brass bench plate, joined by the weld seam.
    case "workbench":
      return (
        <div className="sv-visual sv-bench">
          <span aria-hidden className="sv-bench-plate" data-reveal="fade" />
          <div className="sv-bench-photos">
            <Figure image={cover} sizes="(min-width: 1024px) 396px, 72vw" priority className="sv-bench-main" />
            {detail && <Figure image={detail} sizes="(min-width: 1024px) 349px, 56vw" delay={240} className="sv-bench-detail" />}
          </div>
          <WeldSeam />
        </div>
      );

    // The tower elevation on a teal panel, beside the site photograph.
    case "bays":
      return (
        <div className="sv-visual sv-bays">
          <div className="sv-panel sv-bays-panel" data-tone="teal">
            <ScaffoldTower />
          </div>
          <Figure image={cover} sizes="(min-width: 1024px) 450px, 64vw" priority delay={200} className="sv-bays-photo" />
        </div>
      );
  }
}
