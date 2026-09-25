import type { CSSProperties } from "react";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";
import type { ServiceLook } from "./looks";

export interface ProcessStepView {
  slug: string;
  title: string;
  body?: string;
}

const COLS: Record<number, string> = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" };
const pad = (n: number) => String(n + 1).padStart(2, "0");
const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * How the work runs, in the layout that suits the service: a rail of numbered
 * stations (horizontal on desktop, vertical on phones), a vertical timeline,
 * or a cycle that returns to its start (scaffolding). Every layout carries the
 * note that this is a general workflow, not a certified procedure.
 */
export function ServiceProcess({
  layout,
  line = "fine",
  tone,
  steps,
  note,
  icons,
  icon,
  band = false,
}: {
  layout: ServiceLook["process"]["layout"];
  line?: "cut" | "fold" | "fine";
  tone: Tone;
  steps: ProcessStepView[];
  note: string;
  icons: Record<string, LineIconName>;
  /** The service's own line icon (timeline aside). */
  icon: LineIconName;
  band?: boolean;
}) {
  const noteNode = (
    <p className={cn("mt-12 max-w-[40rem] border-s-2 border-accent ps-4 text-[0.92rem] leading-relaxed", band ? "text-band-ink-2" : "text-ink-2")}>{note}</p>
  );

  if (layout === "timeline") {
    return (
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-12">
        <ol className="lg:col-span-8">
          {steps.map((step, i) => (
            <li key={step.slug} className="step relative grid grid-cols-[3.25rem_1fr] gap-x-5 sm:grid-cols-[4.5rem_1fr] sm:gap-x-8" data-reveal="fade" style={delay(60 * i)}>
              <div className="relative flex flex-col items-center">
                <span className="relative z-10 grid size-11 place-items-center border border-[var(--tone-line)] bg-elevated shadow-[var(--shadow-card)]" data-tone={tone}>
                  <span className="t-num text-[0.78rem] text-ink" dir="ltr">
                    {pad(i)}
                  </span>
                </span>
                {i < steps.length - 1 && <span aria-hidden className="step-rail relative w-px flex-1 bg-line-strong" />}
              </div>
              <div className={cn("pb-10 pt-2 sm:pb-12", i < steps.length - 1 && "border-b border-line")}>
                <h3 className="t-h3 text-ink">{step.title}</h3>
                {step.body && <p className="t-body mt-2 max-w-[36rem]">{step.body}</p>}
              </div>
            </li>
          ))}
        </ol>
        <aside className="lg:col-span-4">
          <div className="card card-edge relative overflow-hidden p-6 sm:p-7 lg:sticky lg:top-28" data-tone={tone}>
            <LineIcon name={icon} size={150} strokeWidth={0.6} className="pointer-events-none absolute -bottom-8 -end-6 text-[var(--tone)] opacity-[0.14]" />
            <div aria-hidden className="relative flex flex-wrap gap-1.5">
              {steps.map((step) => (
                <span key={step.slug} className="icon-chip size-10">
                  <LineIcon name={icons[step.slug] ?? "integrated"} size={20} />
                </span>
              ))}
            </div>
            <p className="relative mt-6 border-s-2 border-accent ps-4 text-[0.92rem] leading-relaxed text-ink-2">{note}</p>
          </div>
        </aside>
      </div>
    );
  }

  if (layout === "cycle") {
    return (
      <div>
        <ol className={cn("relative grid gap-4 sm:grid-cols-2 lg:gap-6", COLS[steps.length])}>
          {steps.map((step, i) => (
            <li key={step.slug} className="card card-edge relative flex flex-col p-5 sm:p-6" data-tone={tone} data-reveal style={delay(80 * i)}>
              <div className="flex items-center justify-between gap-3">
                <span className="icon-chip">
                  <LineIcon name={icons[step.slug] ?? "integrated"} size={24} />
                </span>
                <span className="t-num text-xs text-ink-2" dir="ltr">
                  {pad(i)}
                </span>
              </div>
              <h3 className="t-h4 mt-5 text-ink">{step.title}</h3>
              {step.body && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{step.body}</p>}
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute -end-[1.05rem] top-9 z-10 hidden h-px w-6 bg-[var(--tone)] lg:block">
                  <span className="absolute -top-[3px] end-0 size-[7px] rotate-45 border-e border-t border-[var(--tone)] rtl:-rotate-[135deg]" />
                </span>
              )}
            </li>
          ))}
        </ol>
        {/* The return: after dismantling, the cycle starts again on the next site. */}
        <div aria-hidden className="relative mx-[10%] hidden h-12 lg:block" data-reveal="fade">
          <span className="absolute inset-x-0 bottom-0 top-0 border-x border-b border-dashed border-[var(--tone)]" data-tone={tone} />
          <span className="absolute -top-px start-0 size-[9px] -translate-x-1/2 rotate-45 border-l border-t border-[var(--tone)] rtl:translate-x-1/2" data-tone={tone} />
        </div>
        {noteNode}
      </div>
    );
  }

  // Rail
  return (
    <div>
      <ol className={cn("relative grid gap-y-9 lg:gap-x-8", COLS[steps.length])}>
        <span aria-hidden className={cn("rail-v absolute bottom-6 start-[1.35rem] top-6 w-px lg:hidden", `rail-${line}`, line === "fine" && "w-[5px]")} data-reveal="line" />
        <span aria-hidden className={cn("absolute inset-x-0 top-[1.35rem] hidden lg:block", `rail-${line}`, line === "fine" ? "h-[5px]" : line === "fold" ? "h-3 -translate-y-1.5" : "h-[2px]")} data-reveal="line" />
        {steps.map((step, i) => (
          <li key={step.slug} className="relative ps-16 lg:ps-0 lg:pt-16" data-reveal style={delay(90 * i)}>
            <span
              className={cn(
                "absolute start-0 top-0 grid size-11 place-items-center border bg-elevated shadow-[var(--shadow-card)]",
                i === 0 ? "border-accent" : "border-[var(--tone-line)]",
              )}
              data-tone={tone}
            >
              <span className={cn("t-num text-[0.78rem]", i === 0 ? "text-accent-ink" : "text-ink")} dir="ltr">
                {pad(i)}
              </span>
            </span>
            <h3 className="t-h4 text-ink">{step.title}</h3>
            {step.body && <p className="mt-2 max-w-[22rem] text-[0.95rem] leading-relaxed text-ink-2">{step.body}</p>}
          </li>
        ))}
      </ol>
      {noteNode}
    </div>
  );
}
