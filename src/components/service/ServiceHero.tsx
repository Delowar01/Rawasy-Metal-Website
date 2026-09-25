import type { CSSProperties, ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/inner/Breadcrumbs";
import { MetaStrip, type HeroMeta } from "@/components/inner/InnerPageHero";
import { Phrases } from "@/components/ui/Phrases";
import { Backdrop } from "@/components/visual/Backdrop";
import { PointerLight } from "@/components/visual/PointerLight";
import { cn } from "@/lib/utils";
import { SURFACE_CLASS, type Surface } from "./looks";

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * Opener of a service page: breadcrumb, service number and section, the
 * service name, its source-backed tagline and summary, the quote action, the
 * service's own technical visual and a metadata strip. The large outlined
 * numeral is decorative; the number is also in the eyebrow text.
 */
export function ServiceHero({
  surface,
  backdrop,
  breadcrumb,
  breadcrumbLabel,
  index,
  serviceLabel,
  section,
  title,
  lead,
  intro,
  actions,
  visual,
  meta,
}: {
  surface: Surface;
  backdrop: "grid" | "fine" | "perforated";
  breadcrumb: Crumb[];
  breadcrumbLabel: string;
  index: string;
  serviceLabel: string;
  section: string;
  title: string;
  lead: string;
  intro: string;
  actions: ReactNode;
  visual: ReactNode;
  meta: HeroMeta[];
}) {
  return (
    <section aria-labelledby="page-title" className={cn(SURFACE_CLASS[surface], "relative isolate overflow-hidden")}>
      <HeroBackdrop kind={backdrop} tinted={surface !== "base"} />
      <div className="container-x relative pt-[calc(var(--header-h)+1.75rem)] sm:pt-[calc(var(--header-h)+2.5rem)]">
        <Breadcrumbs items={breadcrumb} label={breadcrumbLabel} />
        <div className="grid gap-x-10 gap-y-14 pb-16 pt-10 sm:pt-12 lg:grid-cols-12 lg:items-center lg:pb-20 lg:pt-14">
          <div className="relative lg:col-span-6 xl:col-span-5">
            <span
              aria-hidden
              data-n={index}
              className="outline-num t-stat pointer-events-none absolute -top-6 end-0 text-[5.5rem] leading-none sm:text-[7rem] lg:-top-10 lg:text-[8.5rem]"
              data-reveal="fade"
            />
            <p className="t-label eyebrow relative" data-reveal="fade">
              <span className="sr-only">{serviceLabel} </span>
              <span className="t-num">{index}</span>
              <span aria-hidden>/</span>
              <span>{section}</span>
            </p>
            <h1 id="page-title" className="t-h1 relative mt-6 max-w-[12em] text-ink" data-reveal style={delay(60)}>
              <Phrases>{title}</Phrases>
            </h1>
            <p className="relative mt-6 max-w-[34rem] font-display text-[1.15rem] font-medium leading-snug text-ink sm:text-[1.25rem]" data-reveal style={delay(120)}>
              {lead}
            </p>
            <p className="t-body relative mt-4 max-w-[36rem]" data-reveal style={delay(170)}>
              {intro}
            </p>
            <div className="relative mt-9 flex flex-wrap items-center gap-3" data-reveal style={delay(230)}>
              {actions}
            </div>
          </div>
          <div className="relative lg:col-span-6 xl:col-span-6 xl:col-start-7">{visual}</div>
        </div>
      </div>
      <MetaStrip items={meta} />
    </section>
  );
}

function HeroBackdrop({ kind, tinted }: { kind: "grid" | "fine" | "perforated"; tinted: boolean }) {
  if (kind === "perforated") {
    return (
      <>
        <Backdrop
          kind="perforated"
          className="start-auto w-2/3 opacity-70 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]"
        />
        <PointerLight className="-z-10" />
      </>
    );
  }
  const fadeTo = tinted ? "var(--curtain)" : "var(--background)";
  return (
    <Backdrop
      kind={kind}
      drift
      style={
        {
          ["--bd-fade" as string]:
            kind === "grid"
              ? `radial-gradient(ellipse 70% 80% at var(--hx, 75%) 40%, transparent 15%, ${fadeTo} 75%)`
              : `linear-gradient(to bottom, transparent, ${fadeTo} 85%)`,
        } as CSSProperties
      }
      className={cn("rtl:[--hx:25%]", kind === "fine" && "[--bd-opacity:0.75]")}
    />
  );
}
