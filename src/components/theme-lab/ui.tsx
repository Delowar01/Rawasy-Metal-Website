import type { LabData } from "./data";

/*
 * Theme-lab helpers. The photo, logo and icon helpers are the production Modern Commerce ones
 * (src/components/commerce/ui.tsx), shared so the lab and the website render the same markup.
 */
export { Cutout, Logo, Photo, delay, metricIcon, serviceIcon, statementIcon } from "@/components/commerce/ui";

/** Preview chrome: switch option, homepage / design system, and language. Not part of any theme. */
export function LabBar({ data, view }: { data: LabData; view: "home" | "system" }) {
  const { lab } = data;
  const here = view === "home" ? lab.homeHref : lab.systemHref;
  return (
    <aside className="lab-bar" aria-label={lab.lab}>
      <p>
        <strong>{lab.lab}</strong> · {lab.preview}
      </p>
      <nav aria-label={`${lab.lab} — ${lab.preview}`}>
        <span className="lab-seg">
          {lab.options.map((o) => (
            <a key={o.key} href={view === "home" ? o.href : `${o.href}/system`} aria-current={o.key === data.option ? "page" : undefined}>
              {o.short}
              <span className="lab-long"> · {o.name.split(" · ")[1]}</span>
            </a>
          ))}
        </span>
        <span className="lab-seg">
          <a href={lab.homeHref} aria-current={view === "home" ? "page" : undefined}>
            {lab.homepage}
          </a>
          <a href={lab.systemHref} aria-current={view === "system" ? "page" : undefined}>
            {lab.system}
          </a>
        </span>
        <span className="lab-seg">
          <a href={lab.switchHref(here)} lang={lab.otherLocale} hrefLang={lab.otherLocale}>
            {lab.otherLabel}
          </a>
        </span>
      </nav>
      <p className="lab-note">{data.option === "a2" ? lab.noteA2 : lab.note}</p>
    </aside>
  );
}
