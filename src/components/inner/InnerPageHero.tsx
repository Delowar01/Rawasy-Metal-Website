import type { CSSProperties, ReactNode } from "react";
import { Phrases } from "@/components/ui/Phrases";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";

export interface HeroMeta {
  label: string;
  value: ReactNode;
}

type Backdrop = "grid" | "perforated" | "fine" | "none";

/**
 * Shared opener for inner pages: breadcrumb, index + eyebrow, title, intro and
 * an optional technical metadata strip. Pages choose a layout and pass their
 * own visual (`aside` beside the text, `below` under it), so each hero shares
 * the system without being identical.
 *
 * - `split`   text beside a visual (about, services, contact)
 * - `stacked` text across, visual underneath (industries)
 * - `compact` text only (clients, certificates, legal)
 */
export function InnerPageHero({
  layout = "split",
  backdrop = "grid",
  breadcrumb,
  breadcrumbLabel,
  index,
  eyebrow,
  title,
  intro,
  actions,
  aside,
  below,
  meta,
}: {
  layout?: "split" | "stacked" | "compact";
  backdrop?: Backdrop;
  breadcrumb: Crumb[];
  breadcrumbLabel: string;
  index?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  below?: ReactNode;
  meta?: HeroMeta[];
}) {
  const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;
  return (
    <section aria-labelledby="page-title" className="relative isolate overflow-hidden">
      <HeroBackdrop kind={backdrop} />
      <div className="container-x relative pt-[calc(var(--header-h)+1.75rem)] sm:pt-[calc(var(--header-h)+2.5rem)]">
        <Breadcrumbs items={breadcrumb} label={breadcrumbLabel} />
        <div
          className={cn(
            "grid gap-x-10 gap-y-12 pt-10 sm:pt-12 lg:grid-cols-12 lg:pt-16",
            layout === "split" ? "pb-16 lg:items-center lg:pb-20" : "pb-12 lg:pb-16",
          )}
        >
          <div className={cn(layout === "split" ? "lg:col-span-6" : "lg:col-span-9")}>
            <p className="t-label eyebrow" data-reveal="fade">
              {index && (
                <>
                  <span className="t-num">{index}</span>
                  <span aria-hidden>/</span>
                </>
              )}
              <span>{eyebrow}</span>
            </p>
            <h1 id="page-title" className="t-h1 mt-6 max-w-[14em] text-ink" data-reveal style={delay(60)}>
              <Phrases>{title}</Phrases>
            </h1>
            {intro && (
              <p className="t-lead mt-7 max-w-[38rem]" data-reveal style={delay(140)}>
                {intro}
              </p>
            )}
            {actions && (
              <div className="mt-9 flex flex-wrap items-center gap-3" data-reveal style={delay(220)}>
                {actions}
              </div>
            )}
          </div>
          {aside && layout === "split" && <div className="lg:col-span-5 lg:col-start-8">{aside}</div>}
        </div>
        {below}
      </div>
      {meta && meta.length > 0 && <MetaStrip items={meta} />}
    </section>
  );
}

/** Technical metadata under the hero, on a measured rule. */
function MetaStrip({ items }: { items: HeroMeta[] }) {
  return (
    <div className="relative border-t border-line">
      <div aria-hidden className="ruler-ticks absolute inset-x-0 top-0 h-2.5" />
      <dl className={cn("container-x grid gap-x-8 gap-y-6 py-7", items.length > 2 ? "grid-cols-2 md:grid-cols-4" : "sm:grid-cols-2 md:grid-cols-4")}>
        {items.map((item, i) => (
          <div key={item.label} className={cn("min-w-0", items.length === 2 && i === 1 && "md:col-span-3")} data-reveal="fade" style={{ ["--d" as string]: 80 * i }}>
            <dt className="t-label flex items-center gap-2 text-ink-3">
              <span aria-hidden className="size-1 bg-accent" />
              {item.label}
            </dt>
            <dd className="mt-2 font-display text-[0.97rem] font-medium text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HeroBackdrop({ kind }: { kind: Backdrop }) {
  if (kind === "none") return null;
  if (kind === "perforated") {
    return (
      <div
        aria-hidden
        className="bg-perforated pointer-events-none absolute inset-y-0 end-0 -z-10 w-2/3 opacity-70 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]"
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10",
        kind === "grid"
          ? "bg-grid [mask-image:radial-gradient(ellipse_70%_80%_at_75%_40%,black_15%,transparent_75%)] rtl:[mask-image:radial-gradient(ellipse_70%_80%_at_25%_40%,black_15%,transparent_75%)]"
          : "bg-grid-fine opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]",
      )}
    />
  );
}
