import Image from "next/image";

export interface MachineRow {
  slug: string;
  name: string;
  type: string;
  power?: string;
  image: { src: string; width: number; height: number; blurDataURL: string };
}

/**
 * The machine list as a technical table: thumbnail, name, type and rated
 * power (a dash where the profile states none). Rows light up with an orange
 * edge on hover.
 */
export function MachineTable({
  machines,
  caption,
  columns,
  notStated,
}: {
  machines: MachineRow[];
  caption: string;
  columns: { machine: string; type: string; power: string };
  notStated: string;
}) {
  return (
    <div className="card overflow-hidden" data-tone="eng">
      <table className="w-full border-collapse text-start">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-strong bg-[var(--eng-surface-2)]">
            <th scope="col" className="t-label px-4 py-3 text-start font-medium text-[var(--eng-ink)] sm:px-5">
              {columns.machine}
            </th>
            <th scope="col" className="t-label px-4 py-3 text-start font-medium text-[var(--eng-ink)] max-sm:hidden">
              {columns.type}
            </th>
            <th scope="col" className="t-label px-4 py-3 text-end font-medium text-[var(--eng-ink)] sm:px-5">
              {columns.power}
            </th>
          </tr>
        </thead>
        <tbody>
          {machines.map((machine) => (
            <tr key={machine.slug} className="machine-row border-b border-line last:border-b-0">
              <th scope="row" className="px-4 py-3 text-start font-normal sm:px-5">
                <span className="flex items-center gap-4">
                  <span className="relative hidden h-11 w-16 shrink-0 overflow-hidden border border-line bg-[#f4f3ef] sm:block">
                    <Image
                      src={machine.image.src}
                      alt=""
                      fill
                      sizes="64px"
                      placeholder="blur"
                      blurDataURL={machine.image.blurDataURL}
                      className="object-contain p-0.5"
                    />
                  </span>
                  <span className="font-display text-[0.98rem] font-semibold text-ink">{machine.name}</span>
                </span>
              </th>
              <td className="px-4 py-3 text-[0.92rem] text-ink-2 max-sm:hidden">{machine.type}</td>
              <td className="px-4 py-3 text-end sm:px-5">
                {machine.power ? (
                  <span className="t-stat text-[1.3rem] text-ink" dir="ltr">
                    {machine.power}
                  </span>
                ) : (
                  <>
                    <span aria-hidden className="text-ink-2">
                      —
                    </span>
                    <span className="sr-only">{notStated}</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
