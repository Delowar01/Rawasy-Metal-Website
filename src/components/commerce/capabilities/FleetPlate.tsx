import type { CapabilityMachine } from "./data";
import { MachinePhoto } from "./MachinePhoto";

/**
 * The hero's composition: the six machines on one graphite plate, laid out like parts nested on a sheet — two columns
 * of bays divided by hairlines, each with its place in the page's order, its rated power where the profile states one,
 * the machine standing on its own floor line and its short name — with one pass of the scan line as the page opens.
 * Every bay is a link to its machine in the console. No bay is a card, and the photos keep one scale rule: each as large
 * as its bay allows, never above its source size, so the plate says nothing about the machines' real sizes.
 */
export function FleetPlate({ machines, label }: { machines: CapabilityMachine[]; label: string }) {
  return (
    <div className="cm-fleet" data-ambient>
      <ul className="cm-fleet-grid" aria-label={label}>
        {machines.map((m) => (
          <li key={m.slug}>
            <a href={`#${m.slug}`} className="cm-fleet-bay">
              <span className="cm-fleet-n" aria-hidden dir="ltr">
                {m.index}
              </span>
              <span className="cm-fleet-photo">
                <MachinePhoto image={{ ...m.image, alt: "" }} eager />
              </span>
              <span className="cm-fleet-name">{m.shortName}</span>
              {m.power && (
                <span className="cm-fleet-power">
                  <span dir="ltr">{m.power.value}</span> {m.power.unit}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      <span className="cm-scan" aria-hidden />
    </div>
  );
}
