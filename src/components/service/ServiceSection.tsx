import type { ReactNode } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Backdrop } from "@/components/visual/Backdrop";
import { cn } from "@/lib/utils";
import { SURFACE_CLASS, type Surface } from "./looks";

/** Fades a tinted section's pattern into its own colour towards the bottom. */
const FADE: Partial<Record<Surface, string>> = {
  eng: "[--bd-fade:linear-gradient(to_bottom,transparent_30%,var(--eng-surface))]",
  proc: "[--bd-fade:linear-gradient(to_bottom,transparent_30%,var(--proc-surface))]",
  craft: "[--bd-fade:linear-gradient(to_bottom,transparent_30%,var(--craft-surface))]",
};

/**
 * One section of a service page: a surface (base, recessed, tinted or the dark
 * slate band), the shared section header and the content. Tinted sections get
 * a still fine grid; the slate band a slowly drifting engineering grid.
 */
export function ServiceSection({
  id,
  surface,
  index,
  label,
  title,
  intro,
  action,
  size = "compact",
  backdrop,
  className,
  children,
}: {
  id: string;
  surface: Surface;
  index: string;
  label: string;
  title: string;
  intro?: string;
  action?: ReactNode;
  size?: "default" | "compact";
  /** Replaces the surface's default pattern (`null` for none). */
  backdrop?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const band = surface === "slate";
  const pattern =
    backdrop !== undefined ? (
      backdrop
    ) : band ? (
      <Backdrop kind="grid" drift className="[--bd-opacity:0.7]" />
    ) : FADE[surface] ? (
      <Backdrop kind="fine" className={FADE[surface]} />
    ) : null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn(SURFACE_CLASS[surface], "section-y relative isolate overflow-hidden", className)}>
      {pattern}
      <div className="container-x relative">
        <SectionHeader id={`${id}-title`} index={index} label={label} title={title} intro={intro} action={action} size={size} tone={band ? "band" : "default"} />
        <div className="mt-12 lg:mt-16">{children}</div>
      </div>
    </section>
  );
}
