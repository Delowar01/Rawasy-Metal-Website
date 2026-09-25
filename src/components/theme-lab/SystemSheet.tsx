import type { ReactNode } from "react";
import type { LabData } from "./data";
import { Icon, type IconName } from "./Icon";
import { LabBar, serviceIcon } from "./ui";

export interface Swatch {
  name: string;
  value: string;
  role: string;
}

export interface SystemSpec {
  /** Root class and font classes of the option. */
  root: string;
  summary: { en: string; ar: string };
  palette: { group: string; swatches: Swatch[] }[];
  fonts: { role: string; family: string; detail: string; lang: "en" | "ar"; className: string; sample: string }[];
  radius: { label: string; value: string; token: string }[];
  borders: { label: string; value: string; style: string }[];
  shadows: { label: string; token: string; use: string }[];
  buttons: { label: string; className: string; icon?: boolean }[];
  tones: string[];
}

const uiIcons: IconName[] = ["power", "bevel", "layers", "grid", "machine", "factory", "shield", "truck", "doc", "phone", "mail", "chat", "pin", "globe", "arrow", "check"];

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-10 first:border-t-0 first:pt-0">
      <div className="max-w-[46rem]">
        <h2 className="t-h3">{title}</h2>
        {note && <p className="t-small mt-2">{note}</p>}
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="block font-mono text-[0.72rem] leading-snug text-ink-2" dir="ltr">
      {children}
    </span>
  );
}

/**
 * The design-system sheet of one option: palette, fonts, radius, borders,
 * shadows, buttons, cards, icons and fields — rendered with the option's own
 * classes, between its real header and footer.
 */
export function SystemSheet({
  data,
  spec,
  header,
  footer,
  cards,
}: {
  data: LabData;
  spec: SystemSpec;
  header: ReactNode;
  footer: ReactNode;
  cards: ReactNode;
}) {
  const { lab } = data;
  const t = lab.sheet;
  const name = lab.options.find((o) => o.key === data.option)!.name;

  return (
    <>
      <a href="#main" className="skip-link">
        {data.ui.skip}
      </a>
      <LabBar data={data} view="system" />
      <div className={spec.root}>
        <div id="top" />
        {header}
        <main id="main" tabIndex={-1} className="shell grid grid-cols-1 gap-14 py-12 outline-none sm:py-16">
          <header className="max-w-[48rem]">
            <p className="eyebrow">{lab.system}</p>
            <h1 className="t-h2 mt-4">{name}</h1>
            <p className="t-lead mt-4">{spec.summary[data.locale]}</p>
          </header>

          <Block title={t.palette} note={t.paletteNote}>
            <div className="grid grid-cols-1 gap-8">
              {spec.palette.map((group) => (
                <div key={group.group}>
                  <h3 className="t-h4">{group.group}</h3>
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {group.swatches.map((s) => (
                      <li key={s.name} className="card overflow-hidden p-0">
                        <span className="block h-16 border-b border-line-subtle" style={{ background: s.value }} />
                        <span className="block p-3">
                          <span className="block text-[0.86rem] font-semibold leading-snug">{s.name}</span>
                          <Meta>{s.value}</Meta>
                          <span className="mt-1 block text-[0.76rem] leading-snug text-ink-2">{s.role}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Block>

          <Block title={t.type}>
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {spec.fonts.map((f) => (
                <li key={`${f.lang}-${f.role}`} className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="tag">
                      {f.lang === "en" ? t.english : t.arabic} · {f.role}
                    </span>
                    <Meta>
                      {f.family} · {f.detail}
                    </Meta>
                  </div>
                  <p lang={f.lang} dir={f.lang === "ar" ? "rtl" : "ltr"} className={`mt-4 ${f.className}`}>
                    {f.sample}
                  </p>
                </li>
              ))}
            </ul>
          </Block>

          <div className="grid grid-cols-1 gap-14 lg:grid-cols-3 lg:gap-8">
            <Block title={t.radius}>
              <ul className="grid grid-cols-3 gap-3 lg:grid-cols-2">
                {spec.radius.map((r) => (
                  <li key={r.label} className="text-center">
                    <span className="mx-auto block aspect-square w-full max-w-[5rem] border-2 border-line-strong bg-surface" style={{ borderRadius: `var(${r.token})` }} />
                    <span className="mt-2 block text-[0.84rem] font-semibold">{r.label}</span>
                    <Meta>{r.value}</Meta>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title={t.borders}>
              <ul className="grid grid-cols-2 gap-3">
                {spec.borders.map((b) => (
                  <li key={b.label} className="grid h-24 content-end rounded-[var(--r-sm)] bg-surface p-3" style={{ border: b.style }}>
                    <span className="text-[0.84rem] font-semibold">{b.label}</span>
                    <Meta>{b.value}</Meta>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title={t.shadows}>
              <ul className="grid grid-cols-2 gap-4">
                {spec.shadows.map((s) => (
                  <li key={s.label} className="grid h-24 content-end rounded-[var(--r-card)] bg-surface p-3" style={{ boxShadow: `var(${s.token})` }}>
                    <span className="text-[0.84rem] font-semibold">{s.label}</span>
                    <span className="text-[0.74rem] leading-snug text-ink-2">{s.use}</span>
                  </li>
                ))}
              </ul>
            </Block>
          </div>

          <Block title={t.buttons}>
            <div className="overflow-x-auto" role="region" aria-label={t.buttons} tabIndex={0}>
              <table className="w-full min-w-[40rem] border-separate border-spacing-y-3 text-start">
                <thead>
                  <tr className="text-[0.78rem] text-ink-2">
                    <th className="pe-4 text-start font-medium">
                      <span className="sr-only">{t.buttons}</span>
                    </th>
                    <th className="text-start font-medium">{t.states.rest}</th>
                    <th className="text-start font-medium">{t.states.hover}</th>
                    <th className="text-start font-medium">{t.states.focus}</th>
                    <th className="text-start font-medium">{t.states.disabled}</th>
                  </tr>
                </thead>
                <tbody>
                  {spec.buttons.map((b) => (
                    <tr key={b.label}>
                      <th scope="row" className="pe-4 text-start text-[0.84rem] font-semibold">
                        {b.label}
                      </th>
                      {["", "is-hover", "is-focus", "disabled"].map((state) => (
                        <td key={state} className={`py-1 pe-3 ${b.className.includes("on-dark") ? "rounded-[var(--r-sm)] bg-dark ps-3" : ""}`}>
                          <button type="button" className={`${b.className} ${state === "disabled" ? "" : state}`} disabled={state === "disabled"} tabIndex={-1}>
                            {data.ui.getQuote}
                            {b.icon && <Icon name="arrow" size={17} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <Block title={t.cards}>{cards}</Block>

          <Block title={t.icons}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {data.services.items.map((s, i) => (
                  <li key={s.slug} className="grid justify-items-center gap-2 text-center" data-tone={spec.tones[i % spec.tones.length]}>
                    <span className="icon-chip icon-chip-lg">
                      <Icon name={serviceIcon[s.slug]} size={24} />
                    </span>
                    <span className="text-[0.74rem] leading-tight text-ink-2">{s.name}</span>
                  </li>
                ))}
                {uiIcons.map((name) => (
                  <li key={name} className="grid justify-items-center">
                    <span className="icon-chip">
                      <Icon name={name} size={20} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 content-start gap-4">
                <ul className="flex flex-wrap gap-2">
                  {data.services.items[0].highlights.map((h) => (
                    <li key={h} className="tag">
                      {h}
                    </li>
                  ))}
                </ul>
                <ul className="flex flex-wrap gap-2">
                  {spec.tones.map((tone, i) => (
                    <li key={i} className="tag tag-tone" data-tone={tone}>
                      <Icon name={serviceIcon[data.services.items[i % 6].slug]} size={14} />
                      {data.services.items[i % 6].name}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">
                    <Icon name="machine" size={14} />
                    {data.machinery.items[0].category}
                  </span>
                  <span className="badge">
                    <Icon name="power" size={14} />
                    {data.machinery.items[0].power?.value} {data.machinery.items[0].power?.unit}
                  </span>
                </div>
              </div>
            </div>
          </Block>

          <Block title={t.forms}>
            <div className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-7" role="group" aria-label={t.forms}>
              <label className="grid gap-1.5">
                <span className="text-[0.86rem] font-semibold">
                  {t.name} <span className="text-ink-2">· {t.required}</span>
                </span>
                <input className="field" name="name" autoComplete="off" defaultValue="" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[0.86rem] font-semibold">{t.email}</span>
                <input className="field is-focus" name="email" type="email" autoComplete="off" dir="ltr" defaultValue={data.contact.email} />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-[0.86rem] font-semibold">{t.message}</span>
                <textarea className="field min-h-24" name="message" defaultValue="" />
                <span className="text-[0.8rem] text-ink-2">{t.helper}</span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[0.86rem] font-semibold text-ink-2">
                  {t.states.disabled}
                </span>
                <input className="field" disabled defaultValue={data.services.items[0].name} />
              </label>
            </div>
          </Block>
        </main>
        {footer}
      </div>
    </>
  );
}
