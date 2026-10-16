import type { ReactElement } from "react";
import { Icon, type IconName } from "@/components/commerce/Icon";
import { getDictionary } from "@/i18n/dictionaries";
import type { DesignField, Locale } from "@/server/builder/fields";
import type { DesignSpec } from "@/server/builder/design";
import type { LinkTarget } from "@/server/builder/links";
import type { Loc } from "@/server/builder/preview-data";
import { REGISTRY } from "@/server/builder/registry";
import { itemsOf, itemText, resolveLink, type DesignView } from "@/server/builder/view";
import type { BlockSection, RenderContext } from "./context";
import { PreviewNote } from "./frame";

/** The design spec a block's `design` setting offers (the registry's declaration). */
export function specOf(blockType: string): DesignSpec {
  const field = REGISTRY.get(blockType)?.settings.design;
  return field?.kind === "design" ? (field as DesignField).spec : {};
}

/** The approved button styles; on a dark panel the light-surface styles take the on-dark variant (`.btn-on-dark`). */
const BUTTON_CLASS: Record<string, string> = { primary: "btn btn-primary", secondary: "btn btn-secondary", dark: "btn btn-dark", steel: "btn btn-steel" };
const ON_DARK: Record<string, string> = { primary: "btn btn-primary", secondary: "btn btn-on-dark", dark: "btn btn-on-dark", steel: "btn btn-on-dark" };

/**
 * A block's buttons (A5 brief §50): each a label in the chosen language, a structured target resolved to its address
 * and one of the approved styles. A button without a label in this language, or whose target no longer exists, is left
 * out (the section's notes say why).
 */
export function buttonElements(section: BlockSection, ctx: RenderContext, repeater: string, view: DesignView): ReactElement[] {
  const external = getDictionary(ctx.locale).a11y.externalLink;
  const out: ReactElement[] = [];
  for (const item of itemsOf<{ target: LinkTarget | null; style?: string }>(section.settings, repeater)) {
    const label = itemText(section.content, repeater, item.id, "label");
    const link = resolveLink(item.target, ctx.locale, ctx.records, ctx.hrefOf);
    if (!label || !link) continue;
    const style = item.style ?? "primary";
    const cls = (view.surface === "dark" ? ON_DARK : BUTTON_CLASS)[style] ?? "btn btn-primary";
    out.push(
      link.external ? (
        <a key={item.id} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
          {label}
          <span className="gb-sr"> ({external})</span>
          <Icon name="arrow-up-right" size={17} />
        </a>
      ) : (
        <a key={item.id} href={link.href} className={cls}>
          {label}
          {style === "primary" && <Icon name="arrow" size={17} />}
        </a>
      ),
    );
  }
  return out;
}

export function Buttons({ section, ctx, repeater, view, className = "gb-buttons" }: { section: BlockSection; ctx: RenderContext; repeater: string; view: DesignView; className?: string }) {
  const buttons = buttonElements(section, ctx, repeater, view);
  if (!buttons.length) return null;
  return <div className={className}>{buttons}</div>;
}

/** A record's text in the chosen language, or an admin-only note when the record has none in it. */
export function RecordText({ value, ctx, what }: { value: Loc<string>; ctx: RenderContext; what: string }) {
  const text = value[ctx.locale];
  if (text) return <>{text}</>;
  return <PreviewNote>No {ctx.locale === "ar" ? "Arabic" : "English"} {what} yet</PreviewNote>;
}

/** Icons the blocks may show (the site's icon set). */
export const ICONS: ReadonlySet<string> = new Set<IconName>([
  "laser-cutting",
  "cnc-bending",
  "steel-structures",
  "fabrication",
  "laser-engraving",
  "scaffolding",
  "power",
  "bevel",
  "layers",
  "grid",
  "machine",
  "factory",
  "shield",
  "precision",
  "truck",
  "doc",
  "phone",
  "mail",
  "chat",
  "pin",
  "globe",
  "construction",
  "infrastructure",
  "commercial",
  "architecture",
  "landmark",
  "shade",
  "signage",
  "formwork",
  "props",
  "rental",
  "installation",
  "check",
]);

export const iconName = (value: unknown, fallback: IconName = "check"): IconName => (typeof value === "string" && ICONS.has(value) ? (value as IconName) : fallback);

/** Two digits, as the site numbers steps and parts. */
export const pad = (n: number) => String(n).padStart(2, "0");

/** The other language's name, for notes. */
export const languageName = (locale: Locale) => (locale === "ar" ? "Arabic" : "English");
