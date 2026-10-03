import type { CapabilityMachine } from "./data";

/**
 * The rated power of the machines that have one in the company profile, as horizontal bars from one baseline (a single
 * series in one colour; the value at each bar's tip), each a link to its machine on the stage. The machines without a
 * stated rating are listed under it in words — never as an empty or zero bar. The register below gives the same data
 * in rows and columns.
 */
export function PowerChart({ machines, caption, notStated }: { machines: CapabilityMachine[]; caption: string; notStated: string }) {
  const rated = machines.filter((m) => m.power);
  const unrated = machines.filter((m) => !m.power);
  const watts = (m: CapabilityMachine) => Number(m.power!.value.replace(/,/g, ""));
  const peak = Math.max(...rated.map(watts));
  return (
    <figure className="card cm-power">
      <figcaption className="cm-power-caption">{caption}</figcaption>
      <ol className="cm-bars">
        {rated.map((m) => (
          <li key={m.slug}>
            <a href={`#${m.slug}`} className="cm-bar-row" style={{ "--v": watts(m) / peak } as React.CSSProperties}>
              <span className="cm-bar-name">{m.name}</span>
              <span className="cm-bar-track">
                <span className="cm-bar" />
                <span className="cm-bar-value">
                  <span dir="ltr">{m.power!.value}</span> {m.power!.unit}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
      {unrated.length > 0 && (
        <ul className="cm-unrated">
          {unrated.map((m) => (
            <li key={m.slug}>
              <a href={`#${m.slug}`}>{m.name}</a>
              <span>{notStated}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
