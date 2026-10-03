import type { CapabilityMachine } from "./data";

export interface RegisterLabels {
  caption: string;
  number: string;
  machine: string;
  type: string;
  power: string;
  service: string;
  source: string;
  notStated: string;
}

/**
 * The technical register: the six machines with every field of their records — name, type, rated power (or that the
 * profile states none), the service each supports and the source — and no other column, no photo. Rows and columns
 * from 64 rem (a caption, column headers and a row header per machine); below that the same fields as one card per
 * machine, each value under its label. Each machine's name opens it in the console.
 */
export function Register({ machines, labels }: { machines: CapabilityMachine[]; labels: RegisterLabels }) {
  const power = (m: CapabilityMachine) =>
    m.power ? (
      <span className="cm-reg-power">
        <span dir="ltr">{m.power.value}</span> {m.power.unit}
      </span>
    ) : (
      <span className="cm-reg-none">{labels.notStated}</span>
    );

  return (
    <>
      <div className="card cm-reg-wide">
        <table className="cm-reg-table">
          <caption className="sr-only">{labels.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="cm-reg-n">
                {labels.number}
              </th>
              <th scope="col">{labels.machine}</th>
              <th scope="col">{labels.type}</th>
              <th scope="col">{labels.power}</th>
              <th scope="col">{labels.service}</th>
              <th scope="col">{labels.source}</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.slug}>
                <td className="cm-reg-n" dir="ltr">
                  {m.index}
                </td>
                <th scope="row">
                  <a href={`#${m.slug}`} className="cm-reg-machine">
                    {m.name}
                  </a>
                </th>
                <td>{m.category}</td>
                <td>{power(m)}</td>
                <td>
                  <a href={m.service.href} className="cm-reg-service">
                    {m.service.name}
                  </a>
                </td>
                <td className="cm-reg-source">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="cm-reg-cards" aria-label={labels.caption}>
        {machines.map((m) => (
          <li key={m.slug} className="card cm-reg-card">
            <p className="cm-reg-card-head">
              <span className="cm-reg-n" aria-hidden dir="ltr">
                {m.index}
              </span>
              <a href={`#${m.slug}`} className="cm-reg-machine">
                {m.name}
              </a>
            </p>
            <dl>
              <div>
                <dt>{labels.type}</dt>
                <dd>{m.category}</dd>
              </div>
              <div>
                <dt>{labels.power}</dt>
                <dd>{power(m)}</dd>
              </div>
              <div>
                <dt>{labels.service}</dt>
                <dd>
                  <a href={m.service.href} className="cm-reg-service">
                    {m.service.name}
                  </a>
                </dd>
              </div>
              <div>
                <dt>{labels.source}</dt>
                <dd>{m.source}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </>
  );
}
