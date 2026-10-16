/**
 * Short constructors for block declarations (`fields.ts`), so each block reads as a list of its fields.
 */
import type { DesignSpec, DesignValues } from "../design.ts";
import type {
  BooleanField,
  ContentField,
  DesignField,
  EnumField,
  IntField,
  ItemSettingsField,
  ItemsField,
  LinesField,
  LinkFieldSpec,
  MediaField,
  MediaKindName,
  RichField,
  SelectableEntity,
  SelectionField,
  SelectionValue,
  TextareaField,
  TextField,
  ValueField,
} from "../fields.ts";
import type { LinkKind } from "../links.ts";
import type { RichLimits } from "../richtext.ts";

type Extra<T> = Partial<Omit<T, "kind" | "label">>;

export const text = (label: string, max: number, extra: Extra<TextField> = {}): TextField => ({ kind: "text", label, max, ...extra });
export const textarea = (label: string, max: number, extra: Extra<TextareaField> = {}): TextareaField => ({ kind: "textarea", label, max, ...extra });
export const lines = (label: string, maxItems: number, maxLength: number, extra: Extra<LinesField> = {}): LinesField => ({ kind: "lines", label, maxItems, maxLength, ...extra });
export const rich = (label: string, limits: Partial<RichLimits> = {}, extra: Extra<RichField> = {}): RichField => ({ kind: "rich", label, limits, ...extra });

export const choice = (label: string, options: readonly { value: string; label: string }[], value: string, extra: Extra<EnumField> = {}): EnumField => ({
  kind: "enum",
  label,
  options,
  default: value,
  ...extra,
});
export const flag = (label: string, value: boolean, extra: Extra<BooleanField> = {}): BooleanField => ({ kind: "boolean", label, default: value, ...extra });
export const integer = (label: string, min: number, max: number, value: number, extra: Extra<IntField> = {}): IntField => ({ kind: "int", label, min, max, default: value, ...extra });
export const value = (label: string, max: number, extra: Extra<ValueField> = {}): ValueField => ({ kind: "value", label, max, default: "", ...extra });
export const media = (label: string, kinds: readonly MediaKindName[] = ["image"], extra: Extra<MediaField> = {}): MediaField => ({ kind: "media", label, kinds, ...extra });
export const link = (label: string, kinds?: readonly LinkKind[], extra: Extra<LinkFieldSpec> = {}): LinkFieldSpec => ({ kind: "link", label, ...(kinds ? { kinds } : {}), ...extra });

export const selection = (label: string, entity: SelectableEntity, max: number, value: SelectionValue, extra: Extra<SelectionField> = {}): SelectionField => ({
  kind: "selection",
  label,
  entity,
  max,
  default: value,
  ...extra,
});
export const automatic = (source: "all" | "featured", limit: number): SelectionValue => ({ mode: "automatic", source, limit });

export const items = (
  label: string,
  one: string,
  bounds: { min: number; max: number; initial?: number },
  settings: Record<string, ItemSettingsField>,
  content: Record<string, ContentField>,
  extra: Extra<ItemsField> = {},
): ItemsField => ({ kind: "items", label, one, ...bounds, settings, content, ...extra });

export const design = (spec: DesignSpec, defaults: DesignValues): DesignField => ({ kind: "design", spec, default: defaults });

/** The section head most blocks open with: a label, a title and a short introduction. */
export const head = (titleRequired = true) => ({
  eyebrow: text("Label", 80, { hint: "A short label above the title." }),
  title: text("Title", 200, { required: titleRequired }),
  intro: textarea("Introduction", 600),
});

/** The approved button styles (`.btn` variants of the Modern Commerce sheet). */
export const BUTTON_STYLES = [
  { value: "primary", label: "Primary (orange action)" },
  { value: "secondary", label: "Secondary" },
  { value: "dark", label: "Dark" },
  { value: "steel", label: "Steel" },
] as const;

/** Icons a card or step may show (names of the site's icon set, `src/components/commerce/Icon.tsx`). */
export const CARD_ICONS = [
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
] as const;

export const iconChoice = (label = "Icon", value: (typeof CARD_ICONS)[number] = "check") =>
  choice(
    label,
    CARD_ICONS.map((icon) => ({ value: icon, label: icon.replace(/-/g, " ") })),
    value,
  );

/** A media item's crop for blocks that fill a frame: the item's focal point decides what stays in view. */
export const ASPECTS = [
  { value: "original", label: "The photo's own proportions" },
  { value: "16x9", label: "Wide (16:9)" },
  { value: "3x2", label: "Landscape (3:2)" },
  { value: "4x3", label: "Standard (4:3)" },
  { value: "1x1", label: "Square" },
  { value: "4x5", label: "Portrait (4:5)" },
] as const;
