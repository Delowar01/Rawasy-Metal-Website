import type { CSSProperties, ReactNode } from "react";
import type { DesignSpec, DesignValues } from "@/server/builder/design";
import { designView, type DesignView } from "@/server/builder/view";
import type { BlockSection } from "./context";

/*
 * The frame every generic block is drawn in (A5 brief §23–§25, §42): a Modern Commerce section — open on the page (`.sec`,
 * with reading zones under its text), on a muted or raised sheet (`.sec-sheet`), or around a dark panel — whose design
 * values become `data-*` attributes that `blocks.css` styles from the design system's tokens (spacing, measure, alignment,
 * columns, gaps, tone, borders, radii, shadows, motion). Nothing here takes CSS from anyone: every value is one of the
 * inspector's enumerations, already validated.
 */

const SURFACE_CLASS = { plain: "sec gb", muted: "sec sec-sheet sec-muted gb", raised: "sec sec-sheet sec-raised gb", dark: "sec gb gb-on-dark" } as const;

/** The id of a section's title: the section's ULID (upper case) never equals an anchor (lower case only). */
export const titleId = (section: BlockSection) => `gb-${section.id}-title`;

/** The design values stored in a section's `design` setting. */
export const designOf = (section: BlockSection) => (section.settings.design as DesignValues | undefined) ?? {};

export function GenericSection({
  section,
  spec,
  name,
  labelled = true,
  label,
  children,
}: {
  section: BlockSection;
  spec: DesignSpec;
  /** The block's short name (`data-gb`), for its own rules in blocks.css. */
  name: string;
  /** The section is named by its title (`aria-labelledby`); false when it has none. */
  labelled?: boolean;
  /** The section's accessible name when it has no visible title. */
  label?: string;
  children: (view: DesignView) => ReactNode;
}) {
  const view = designView(spec, designOf(section));
  return (
    <section
      id={section.anchor ?? undefined}
      data-section={section.id}
      data-gb={name}
      className={SURFACE_CLASS[view.surface]}
      {...(labelled ? { "aria-labelledby": titleId(section) } : label ? { "aria-label": label } : {})}
      {...view.attrs}
    >
      <div className="shell gb-in">{view.surface === "dark" ? <div className="gb-dark">{children(view)}</div> : children(view)}</div>
    </section>
  );
}

/**
 * The reveal attributes of one element: its preset, duration and delay (`index` staggers the items of a list). Words
 * never fade: an element that holds text (`text`, the default) takes a media preset (fade, scale) as "reveal" — it
 * appears whole and rises — and so does a list's container when its items stagger.
 */
export function motionProps(view: DesignView, index = 0, options: { text?: boolean } = {}): { [key: `data-${string}`]: string } & { style?: CSSProperties } {
  const { preset, duration, delay } = view.motion;
  if (preset === "none") return {};
  const text = options.text ?? true;
  const stagger = preset === "stagger" ? Math.min(index, 8) * 60 : 0;
  const style = { ["--d" as string]: `${delay + stagger}ms` } as CSSProperties;
  const kind = preset === "stagger" || (text && (preset === "fade" || preset === "scale")) ? "reveal" : preset;
  return { "data-reveal": kind === "fade" ? "fade" : "", "data-motion": kind, "data-dur": duration, style };
}

/** The reveal of a whole text block (a head, a panel): never staggered, never faded. */
export const textMotion = (view: DesignView) => motionProps({ ...view, motion: view.motion.preset === "stagger" ? { ...view.motion, preset: "reveal" } : view.motion });

/** Text on the open page sits on a reading zone (the ambient stays around it); sheets and panels need none. */
export const readClass = (view: DesignView) => (view.surface === "plain" ? "a2-read" : "");

export function Head({
  section,
  view,
  eyebrow,
  title,
  intro,
  level,
  className = "",
}: {
  section: BlockSection;
  view: DesignView;
  eyebrow?: string;
  title?: string;
  intro?: string;
  level?: 2 | 3 | 4;
  className?: string;
}) {
  if (!eyebrow && !title && !intro) return null;
  const H = `h${level ?? view.heading}` as "h2" | "h3" | "h4";
  const dark = view.surface === "dark";
  return (
    <div className={`gb-head ${readClass(view)} ${className}`.trim()} {...textMotion(view)}>
      {eyebrow && <p className={dark ? "eyebrow eyebrow-dark" : "eyebrow"}>{eyebrow}</p>}
      {title && (
        <H id={titleId(section)} className={`t-h${level ?? view.heading} gb-title`}>
          {title}
        </H>
      )}
      {intro && <p className="t-lead gb-intro">{intro}</p>}
    </div>
  );
}

/** An admin-only note inside the preview (English: the admin's language), for what the preview cannot show. */
export function PreviewNote({ children, block = false }: { children: ReactNode; block?: boolean }) {
  const Tag = block ? "div" : "span";
  return (
    <Tag className={block ? "gb-note gb-note-block" : "gb-note"} lang="en" dir="ltr" data-preview-note="">
      {children}
    </Tag>
  );
}
